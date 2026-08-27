import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { isDiscordAdmin } from "@/lib/admin";
import { dailyViewPayload, inspirePayload } from "@/lib/discord/embeds";
import { verifyDiscordSignature } from "@/lib/discord/verify";
import { editInteractionOriginal } from "@/lib/discord/rest";
import { getOrCreateToday, postTodayPrompt, runMidnightJob, votingEmoji } from "@/lib/discord/daily";
import { saveBotConfig, saveRoll, enqueueEphemeral } from "@/lib/discord/botStore";
import { hktDate, rollInspire } from "@/lib/inspire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Interaction = {
  type: number;
  token: string;
  data?: {
    name?: string;
    custom_id?: string;
    options?: {
      name: string;
      type: number;
      value?: unknown;
      options?: { name: string; type: number; value?: unknown }[];
    }[];
  };
  member?: { user?: { id: string }; roles?: string[] };
  user?: { id: string };
};

function actor(i: Interaction): { id: string; roles: string[] } {
  return {
    id: i.member?.user?.id || i.user?.id || "",
    roles: i.member?.roles || [],
  };
}

async function fill(token: string, payload: Record<string, unknown>) {
  try {
    await editInteractionOriginal(token, payload);
  } catch (e) {
    console.error("edit interaction", e);
  }
}

async function handleInspire(token: string, scheduleExpire: boolean) {
  const roll = await rollInspire();
  await saveRoll(roll);
  await fill(token, inspirePayload(roll));
  if (scheduleExpire) await enqueueEphemeral(token);
}

async function handleDaily(i: Interaction, token: string) {
  const sub = i.data?.options?.[0]?.name;
  const who = actor(i);
  if (sub === "reroll" || sub === "重抽") {
    if (!isDiscordAdmin(who.id, who.roles)) {
      await fill(token, { content: "只有管理员可以重抽今日题。" });
      return;
    }
    const { roll } = await postTodayPrompt(true);
    await fill(token, {
      content: `已重抽今日题 \`#${roll.code}\`，已发到每日频道。`,
    });
    return;
  }
  if (sub === "emoji" || sub === "表情") {
    if (!isDiscordAdmin(who.id, who.roles)) {
      await fill(token, { content: "只有管理员可以改投票表情。" });
      return;
    }
    const emoji = String(
      i.data?.options?.[0]?.options?.[0]?.value || ""
    ).trim();
    if (!emoji) {
      await fill(token, { content: "请提供一个表情。" });
      return;
    }
    await saveBotConfig({ emoji });
    await fill(token, { content: `投票表情已设为 ${emoji}` });
    return;
  }
  if (sub === "结算") {
    if (!isDiscordAdmin(who.id, who.roles)) {
      await fill(token, { content: "只有管理员可以手动结算。" });
      return;
    }
    const force = i.data?.options?.[0]?.options?.some(
      (o) => o.name === "强制" && o.value === true
    );
    try {
      const result = await runMidnightJob({
        forceAnnounce: !!force,
        forcePost: !!force,
      });
      const settleNote = result.announced
        ? "（已公布结果）"
        : result.skippedAnnounce
          ? `（跳过：${result.skippedAnnounce}）`
          : "";
      const lines = [
        force ? "已强制跑完每日任务。" : "已执行每日结算。",
        `结算日期：\`${result.settled}\`${settleNote}`,
        `今日：\`${result.posted}\`  \`#${result.code}\`${result.postedPrompt ? "（已发到频道）" : "（频道里已有今日题，未重发）"}`,
      ];
      if (!result.channelConfigured) {
        lines.push("警告：未配置 DISCORD_DAILY_CHANNEL_ID，无法发到频道。");
      }
      await fill(token, { content: lines.join("\n") });
    } catch (e) {
      await fill(token, {
        content: `结算失败：${e instanceof Error ? e.message : "unknown"}`,
      });
    }
    return;
  }
  const { roll } = await getOrCreateToday(false);
  await fill(token, dailyViewPayload(roll, hktDate(), await votingEmoji()));
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const ok = verifyDiscordSignature(
    raw,
    req.headers.get("x-signature-timestamp") || "",
    req.headers.get("x-signature-ed25519") || "",
    process.env.DISCORD_PUBLIC_KEY || ""
  );
  if (!ok) {
    return new NextResponse("invalid request signature", { status: 401 });
  }

  const i = JSON.parse(raw) as Interaction;
  if (i.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  if (i.type === 2 || i.type === 3) {
    const name = i.data?.name;
    const custom = i.data?.custom_id;
    const isInspire =
      name === "inspire" ||
      name === "灵感" ||
      name === "靈感" ||
      custom === "inspire:reroll";
    after(() => {
      if (isInspire) return handleInspire(i.token, custom !== "inspire:reroll");
      if (name === "daily" || name === "每日") return handleDaily(i, i.token);
      if (name === "daily-admin" || name === "每日管理") return handleDaily(i, i.token);
      return fill(i.token, { content: "未知指令。" });
    });
    if (custom === "inspire:reroll") {
      return NextResponse.json({ type: 6 });
    }
    if (isInspire) {
      // flags MUST live under data — top-level flags are ignored, message stays public
      return NextResponse.json({ type: 5, data: { flags: 64 } });
    }
    return NextResponse.json({ type: 5 });
  }

  return NextResponse.json({ type: 1 });
}
