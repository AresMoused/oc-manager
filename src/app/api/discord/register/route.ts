import { NextRequest, NextResponse } from "next/server";
import { registerGuildCommands } from "@/lib/discord/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMANDS = [
  {
    name: "灵感",
    name_localizations: { "zh-TW": "靈感" },
    description: "选词库随机一条角色提示词（可公开到频道）",
    description_localizations: {
      "zh-TW": "選詞庫隨機一條角色提示詞（可公開到頻道）",
    },
  },
  {
    name: "每日",
    description: "查看今日人物主题和场景主题",
    description_localizations: { "zh-TW": "查看今日人物主題和場景主題" },
  },
  {
    name: "每日管理",
    description: "管理员：重抽、改投票表情、手动结算、扫漏",
    description_localizations: { "zh-TW": "管理員：重抽、改投票表情、手動結算、掃漏" },
    options: [
      {
        type: 1,
        name: "重抽",
        description: "作废今日题并重抽（会 @ 身份组）",
        description_localizations: { "zh-TW": "作廢今日題並重抽（會 @ 身分組）" },
      },
      {
        type: 1,
        name: "表情",
        description: "设定公布栏投票用的表情",
        description_localizations: { "zh-TW": "設定公布欄投票用的表情" },
        options: [
          {
            type: 3,
            name: "表情",
            description: "一个表情，例如 ❤️",
            description_localizations: { "zh-TW": "一個表情，例如 ❤️" },
            required: true,
          },
        ],
      },
      {
        type: 1,
        name: "结算",
        description: "手动结算昨天并发布今日题（等同香港 0 点任务）",
        description_localizations: {
          "zh-TW": "手動結算昨天並發布今日題（等同香港 0 點任務）",
        },
        options: [
          {
            type: 5,
            name: "强制",
            description: "即使已经结算/出题也再发一次",
            description_localizations: {
              "zh-TW": "即使已經結算/出題也再發一次",
            },
            required: false,
          },
        ],
      },
      {
        type: 1,
        name: "扫漏",
        description: "扫描监视频道，补转发没进公布栏的图片投稿",
        description_localizations: {
          "zh-TW": "掃描監視頻道，補轉發沒進公布欄的圖片投稿",
        },
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
