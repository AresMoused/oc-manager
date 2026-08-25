import { NextRequest, NextResponse } from "next/server";
import { registerGuildCommands } from "@/lib/discord/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMANDS = [
  {
    name: "inspire",
    name_localizations: { "zh-CN": "灵感", "zh-TW": "靈感" },
    description: "Random character prompt from the appearance generator",
    description_localizations: {
      "zh-CN": "从外观生成器词库随机一条角色提示词",
      "zh-TW": "從外觀產生器詞庫隨機一條角色提示詞",
    },
  },
  {
    name: "daily",
    name_localizations: { "zh-CN": "每日", "zh-TW": "每日" },
    description: "Today's themed character; admins can reroll or set the vote emoji",
    description_localizations: {
      "zh-CN": "查看今日主题角色；管理员可重抽或改投票表情",
      "zh-TW": "查看今日主題角色；管理員可重抽或改投票表情",
    },
    options: [
      {
        type: 1,
        name: "reroll",
        name_localizations: { "zh-CN": "重抽", "zh-TW": "重抽" },
        description: "Admin: replace today's prompt and ping the role",
        description_localizations: {
          "zh-CN": "管理员：作废今日题并重抽（会 @ 身份组）",
          "zh-TW": "管理員：作廢今日題並重抽（會 @ 身分組）",
        },
      },
      {
        type: 1,
        name: "emoji",
        name_localizations: { "zh-CN": "表情", "zh-TW": "表情" },
        description: "Admin: set the bulletin voting emoji",
        description_localizations: {
          "zh-CN": "管理员：设定公布栏投票用的表情",
          "zh-TW": "管理員：設定公布欄投票用的表情",
        },
        options: [
          {
            type: 3,
            name: "emoji",
            description: "One emoji, e.g. ❤️",
            description_localizations: {
              "zh-CN": "一个表情，例如 ❤️",
              "zh-TW": "一個表情，例如 ❤️",
            },
            required: true,
          },
        ],
      },
    ],
  },
];

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET || "";
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const q = req.nextUrl.searchParams.get("secret") || "";
  if (!secret || (token !== secret && q !== secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const guildId = process.env.DISCORD_GUILD_ID || "";
  if (!guildId) {
    return NextResponse.json({ error: "DISCORD_GUILD_ID missing" }, { status: 500 });
  }
  try {
    const data = await registerGuildCommands(guildId, COMMANDS);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "register failed" },
      { status: 500 }
    );
  }
}

export const GET = POST;
