import { NextRequest, NextResponse } from "next/server";
import {
  encodeSession,
  getDiscordConfig,
  sessionCookieOptions,
  type AuthUser,
} from "@/lib/auth";
import { upsertUserIndex } from "@/lib/serverStore";

export async function GET(req: NextRequest) {
  const cfg = getDiscordConfig();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const savedState = req.cookies.get("oc_oauth_state")?.value;

  const fail = (codeName: string) => {
    const res = NextResponse.redirect(
      new URL(`/login?error=${codeName}`, cfg.appUrl)
    );
    res.cookies.set("oc_oauth_state", "", { path: "/", maxAge: 0 });
    return res;
  };

  if (error === "access_denied") return fail("oauth_denied");
  if (!code) return fail("token");
  if (!state || !savedState || state !== savedState) return fail("token");
  if (!cfg.clientId || !cfg.clientSecret || !cfg.guildId) return fail("config");

  const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    console.error("discord token", await tokenRes.text());
    return fail("token");
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    token_type: string;
  };

  const authHeader = {
    Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
  };

  const meRes = await fetch("https://discord.com/api/users/@me", {
    headers: authHeader,
  });
  if (!meRes.ok) return fail("token");
  const me = (await meRes.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar: string | null;
    discriminator: string;
  };

  const memberRes = await fetch(
    `https://discord.com/api/users/@me/guilds/${cfg.guildId}/member`,
    { headers: authHeader }
  );

  if (memberRes.status === 404) return fail("not_in_guild");
  if (!memberRes.ok) {
    console.error("discord member", memberRes.status, await memberRes.text());
    if (memberRes.status === 403) return fail("not_in_guild");
    return fail("token");
  }

  const member = (await memberRes.json()) as { roles?: string[] };
  const roles = member.roles || [];

  if (cfg.roleIds.length > 0) {
    const ok = cfg.roleIds.some((rid) => roles.includes(rid));
    if (!ok) return fail("missing_role");
  }

  const user: AuthUser = {
    id: me.id,
    username: me.username,
    globalName: me.global_name ?? null,
    avatar: me.avatar,
    discriminator: me.discriminator || "0",
    roles,
  };

  try {
    await upsertUserIndex(user);
  } catch (e) {
    console.error("upsertUserIndex", e);
  }

  const sessionToken = await encodeSession(user);
  const res = NextResponse.redirect(new URL("/", cfg.appUrl));
  const cookie = sessionCookieOptions(sessionToken);
  res.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });
  res.cookies.set("oc_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
