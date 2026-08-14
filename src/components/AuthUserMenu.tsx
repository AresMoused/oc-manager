"use client";

import { useEffect, useState } from "react";

interface UserInfo {
  id: string;
  username: string;
  globalName: string | null;
  avatarUrl: string;
}

export default function AuthUserMenu() {
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.user) setUser(d.user);
      })
      .catch(() => {});
  }, []);

  if (!user) return null;

  const name = user.globalName || user.username;

  return (
    <div className="flex items-center gap-2 pl-2 border-l border-neutral-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={user.avatarUrl}
        alt=""
        className="w-7 h-7 rounded-full object-cover ring-1 ring-neutral-700"
      />
      <span className="text-xs text-neutral-300 hidden sm:inline max-w-[100px] truncate">
        {name}
      </span>
      <a
        href="/api/auth/logout"
        className="text-xs text-neutral-500 hover:text-white transition"
      >
        登出
      </a>
    </div>
  );
}
