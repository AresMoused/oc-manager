import { NextResponse } from "next/server";
import { clearSessionCookieOptions, getDiscordConfig } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const c = clearSessionCookieOptions();
  res.cookies.set(c.name, c.value, {
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    path: c.path,
    maxAge: c.maxAge,
  });
  return res;
}

export async function GET() {
  const cfg = getDiscordConfig();
  const res = NextResponse.redirect(new URL("/login", cfg.appUrl));
  const c = clearSessionCookieOptions();
  res.cookies.set(c.name, c.value, {
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
    path: c.path,
    maxAge: c.maxAge,
  });
  return res;
}
