import { NextResponse } from "next/server";
import { getDiscordConfig } from "@/lib/auth";

export async function GET() {
  const cfg = getDiscordConfig();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.guildId) {
    return NextResponse.redirect(
      new URL("/login?error=config", cfg.appUrl)
    );
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "identify guilds.members.read",
    state,
    prompt: "consent",
  });

  const res = NextResponse.redirect(
    `https://discord.com/api/oauth2/authorize?${params.toString()}`
  );
  res.cookies.set("oc_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
