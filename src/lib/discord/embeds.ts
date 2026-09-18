import {
  discordDailyEmoji,
  discordPingRoleId,
  discordPingRoleMention,
} from "@/lib/discord/config";
import type { InspireRoll } from "@/lib/inspire";
import { inspireSummary } from "@/lib/inspire";

export function allowedMentionsForPing(): Record<string, unknown> {
  const id = discordPingRoleId();
  return id ? { roles: [id] } : { parse: [] };
}

function clipPrompt(s: string, n = 1000): string {
  const t = (s || "").trim() || "（空）";
  return t.length > n ? t.slice(0, n) + "…" : t;
}

function codeField(prompt: string): { name: string; value: string } {
  const body = clipPrompt(prompt).replace(/```/g, "'''");
  return { name: "提示词（点框复制）", value: "```\n" + body + "\n```" };
}

function summaryOf(
  roll: InspireRoll,
  part?: { prompt: string; picks: InspireRoll["picks"] }
): string {
  if (!part) return "";
  return inspireSummary({ ...roll, picks: part.picks, prompt: part.prompt }, 16);
}

function themePairEmbeds(
  roll: InspireRoll,
  labels: { person: string; scene: string }
): { title: string; description: string; fields: { name: string; value: string }[]; color: number }[] {
  const charPrompt = roll.character?.prompt?.trim() || "（未抽到人物词库）";
  const scenePrompt = roll.scene?.prompt?.trim() || "（未抽到场景词库）";
  return [
    {
      title: `${labels.person}  #${roll.code}`,
      description: summaryOf(roll, roll.character) || "（无条目）",
      fields: [codeField(charPrompt)],
      color: 0x7c5cbf,
    },
    {
      title: `${labels.scene}  #${roll.code}`,
      description: summaryOf(roll, roll.scene) || "（无条目）",
      fields: [codeField(scenePrompt)],
      color: 0x4d8fd6,
    },
  ];
}

export function inspireEmbed(roll: InspireRoll, title = "灵感"): {
  title: string;
  description: string;
  fields: { name: string; value: string }[];
  color: number;
} {
  if (roll.character || roll.scene) {
    return themePairEmbeds(roll, { person: "每日人物", scene: "每日场景" })[0]!;
  }
  const summary = inspireSummary(roll);
  return {
    title: `${title}  #${roll.code}`,
    description: summary || "（词库为空）",
    fields: [codeField(roll.prompt)],
    color: 0x7c5cbf,
  };
}

function inspireEmbeds(roll: InspireRoll, kind: "inspire" | "daily") {
  if (roll.character || roll.scene) {
    return themePairEmbeds(roll, {
      person: kind === "daily" ? "每日人物" : "灵感人物",
      scene: kind === "daily" ? "每日场景" : "灵感场景",
    });
  }
  return [inspireEmbed(roll, kind === "daily" ? "每日主题" : "灵感")];
}

export function inspirePayload(roll: InspireRoll, opts?: { shared?: boolean }) {
  const embeds = inspireEmbeds(roll, "inspire");
  return {
    content: opts?.shared
      ? "请选择其中一个主题或者两个都使用"
      : "仅你可见，5 分钟后自动消失。请选择其中一个主题或者两个都使用",
    flags: 64,
    embeds,
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "再来一条",
            custom_id: `inspire:reroll:${roll.code}`,
          },
          ...(opts?.shared
            ? []
            : [
                {
                  type: 2,
                  style: 1,
                  label: "所有人可见",
                  custom_id: `inspire:share:${roll.code}`,
                },
              ]),
        ],
      },
    ],
  };
}

export function inspirePublicPayload(roll: InspireRoll) {
  return {
    content: "请选择其中一个主题或者两个都使用 · 由 /灵感 分享",
    embeds: inspireEmbeds(roll, "inspire"),
  };
}

export function dailyHowTo(code: string, emoji: string): string {
  return [
    "每天 0:00（香港时间）公布人物主题和场景主题。可以只选其中一个，或两个都用。",
    `① 用提示词去外观生成器 / 抽卡姬出图或出片（也可以自己画）`,
    `② 把图或影片发到跑图频道，正文带上 \`#${code}\``,
    `③ 机器人转到本频道后，点 ${emoji} 投票`,
    `④ 当天 23:59 截止，次日 0:00 公布冠军`,
  ].join("\n");
}

export function dailyViewPayload(roll: InspireRoll, date: string, emoji: string) {
  const embeds = inspireEmbeds(roll, "daily");
  embeds.push({
    title: `说明  ${date}`,
    description: "请选择其中一个主题或者两个都使用\n\n" + dailyHowTo(roll.code, emoji),
    fields: [],
    color: 0xe8b86d,
  });
  return {
    content: `今日 \`#${roll.code}\`（投票请点公布栏上的 ${emoji}）`,
    embeds,
    components: [],
  };
}

export function dailyPromptPayload(roll: InspireRoll, date: string) {
  const ping = discordPingRoleMention();
  const emoji = discordDailyEmoji();
  const embeds = inspireEmbeds(roll, "daily");
  embeds.push({
    title: `说明  ${date}`,
    description: "请选择其中一个主题或者两个都使用\n\n" + dailyHowTo(roll.code, emoji),
    fields: [],
    color: 0xe8b86d,
  });
  return {
    content: ping ? `${ping} 今日主题已更新` : "今日主题已更新",
    allowed_mentions: allowedMentionsForPing(),
    embeds,
  };
}

export function jumpUrl(guildId: string, channelId: string, messageId: string) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function bulletinPayload(opts: {
  authorName: string;
  authorIcon?: string | null;
  imageUrl?: string;
  kind?: "image" | "video";
  channelName: string;
  jump: string;
}) {
  const embed: Record<string, unknown> = {
    author: {
      name: opts.authorName,
      icon_url: opts.authorIcon || undefined,
    },
    footer: { text: `来自 #${opts.channelName}` },
    color: 0x7c5cbf,
  };
  if (opts.kind === "video") {
    embed.description = "影片投稿";
  } else if (opts.imageUrl) {
    embed.image = { url: opts.imageUrl };
  }
  return {
    embeds: [embed],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "跳转原消息",
            url: opts.jump,
          },
        ],
      },
    ],
  };
}

export function resultPayload(opts: {
  date: string;
  winnerJump?: string;
  winnerName?: string;
  votes?: number;
  empty?: boolean;
}) {
  const ping = discordPingRoleMention();
  let desc: string;
  if (opts.empty) desc = `**${opts.date}** 无人投稿。`;
  else if (opts.winnerJump) {
    desc = `**${opts.date}** 冠军：${opts.winnerName || "未知"}（${opts.votes ?? 0} ${discordDailyEmoji()}）\n${opts.winnerJump}`;
  } else desc = `**${opts.date}** 未能决出冠军。`;
  return {
    content: ping ? `${ping} 昨日每日主题结果` : "昨日每日主题结果",
    allowed_mentions: allowedMentionsForPing(),
    embeds: [{ title: "每日投票结果", description: desc, color: 0xe8b86d }],
  };
}

export function avatarUrl(userId: string, avatar: string | null | undefined) {
  if (!avatar) return `https://cdn.discordapp.com/embed/avatars/${Number(userId) % 5}.png`;
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}`;
}
