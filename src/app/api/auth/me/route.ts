import { NextResponse } from "next/server";
import { avatarUrl, getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({
    user: {
      ...session.user,
      avatarUrl: avatarUrl(session.user),
    },
  });
}
