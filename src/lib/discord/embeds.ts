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

export function inspireEmbed(roll: InspireRoll, title = "灵感"): {
  title: string;
  description: string;
  fields: { name: string; value: string }[];
  color: number;
} {
  const summary = inspireSummary(roll);
  const prompt =
    roll.prompt.length > 1800 ? roll.prompt.slice(0, 1800) + "…" : roll.prompt;
  return {
    title: `${title}  #${roll.code}`,
    description: summary || "（词库为空）",
    fields: [{ name: "提示词", value: "```\n" + prompt + "\n```" }],
    color: 0x7c5cbf,
  };
}

export function inspirePayload(roll: InspireRoll) {
  return {
    embeds: [inspireEmbed(roll)],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            label: "再来一条",
            custom_id: "inspire:reroll",
          },
        ],
      },
    ],
  };
}

export function dailyHowTo(code: string, emoji: string): string {
  return [
    "每天 0:00（香港时间）公布一套主题角色。用提示词出图，带着今日代码投稿，给喜欢的图投票。",
    `① 用提示词去外观生成器 / 抽卡姬出图（也可以自己画）`,
    `② 发到跑图频道，正文带上 \`#${code}\``,
    `③ 机器人转到本频道后，点 ${emoji} 投票`,
    `④ 当天 23:59 截止，次日 0:00 公布冠军`,
  ].join("\n");
}

export function dailyViewPayload(roll: InspireRoll, date: string, emoji: string) {
  const embed = inspireEmbed(roll, `每日主题  ${date}`);
  embed.fields.push({
    name: "每日主题",
    value: dailyHowTo(roll.code, emoji),
  });
  return {
    content: `今日 \`#${roll.code}\`（投票请点公布栏上的 ${emoji}）`,
    embeds: [embed],
    components: [],
  };
}

export function dailyPromptPayload(roll: InspireRoll, date: string) {
  const ping = discordPingRoleMention();
  const emoji = discordDailyEmoji();
  const embed = inspireEmbed(roll, `每日主题  ${date}`);
  embed.fields.push({
    name: "每日主题",
    value: dailyHowTo(roll.code, emoji),
  });
  return {
    content: ping ? `${ping} 今日主题角色已更新` : "今日主题角色已更新",
    allowed_mentions: allowedMentionsForPing(),
    embeds: [embed],
  };
}

export function jumpUrl(guildId: string, channelId: string, messageId: string) {
  return `https://discord.com/channels/${guildId}/${channelId}/${messageId}`;
}

export function bulletinPayload(opts: {
  authorName: string;
  authorIcon?: string | null;
  imageUrl: string;
  channelName: string;
  jump: string;
}) {
  return {
    embeds: [
      {
        author: {
          name: opts.authorName,
          icon_url: opts.authorIcon || undefined,
        },
        image: { url: opts.imageUrl },
        footer: { text: `来自 #${opts.channelName}` },
        color: 0x7c5cbf,
      },
    ],
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
