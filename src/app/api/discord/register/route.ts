import { NextRequest, NextResponse } from "next/server";
import { registerGuildCommands } from "@/lib/discord/rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMANDS = [
  {
    name: "灵感",
    description: "从外观生成器词库随机一条角色提示词",
  },
  {
    name: "每日",
    description: "查看今日主题角色；管理员可重抽或改投票表情",
    options: [
      {
        type: 1,
        name: "重抽",
        description: "管理员：作废今日题并重抽（会 @ 身份组）",
      },
      {
        type: 1,
        name: "表情",
        description: "管理员：设定公布栏投票用的表情",
        options: [
          {
            type: 3,
            name: "emoji",
            description: "一个表情，例如 ❤️",
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
