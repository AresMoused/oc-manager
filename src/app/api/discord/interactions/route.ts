import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { isDiscordAdmin } from "@/lib/admin";
import { inspirePayload } from "@/lib/discord/embeds";
import { verifyDiscordSignature } from "@/lib/discord/verify";
import { editInteractionOriginal } from "@/lib/discord/rest";
import { getOrCreateToday, postTodayPrompt, votingEmoji } from "@/lib/discord/daily";
import { saveBotConfig } from "@/lib/discord/botStore";
import { rollInspire } from "@/lib/inspire";
import { saveRoll } from "@/lib/discord/botStore";

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

async function handleInspire(token: string) {
  const roll = await rollInspire();
  await saveRoll(roll);
  await fill(token, inspirePayload(roll));
}

async function handleDaily(i: Interaction, token: string) {
  const sub = i.data?.options?.[0]?.name;
  const who = actor(i);
  if (sub === "重抽") {
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
  if (sub === "表情") {
    if (!isDiscordAdmin(who.id, who.roles)) {
      await fill(token, { content: "只有管理员可以改投票表情。" });
      return;
    }
    const emoji = String(i.data?.options?.[0]?.options?.[0]?.value || "").trim();
    if (!emoji) {
      await fill(token, { content: "请提供一个表情。" });
      return;
    }
    await saveBotConfig({ emoji });
    await fill(token, { content: `投票表情已设为 ${emoji}` });
    return;
  }
  const { roll } = await getOrCreateToday(false);
  await fill(token, {
    ...inspirePayload(roll),
    content: `今日 \`#${roll.code}\`（投票请点公布栏上的 ${await votingEmoji()}）`,
  });
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
    after(() => {
      if (name === "灵感" || custom === "inspire:reroll") return handleInspire(i.token);
      if (name === "每日") return handleDaily(i, i.token);
      return fill(i.token, { content: "未知指令。" });
    });
    return NextResponse.json({ type: 5 });
  }

  return NextResponse.json({ type: 1 });
}
