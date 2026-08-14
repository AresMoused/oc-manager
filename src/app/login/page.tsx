"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LOGO_SRC } from "@/lib/logo";

const LOGO_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7c3aed"/><text x="32" y="38" text-anchor="middle" fill="#fff" font-size="14" font-family="sans-serif" font-weight="700">Ares</text></svg>'
  );

function errorText(code: string | null): string | null {
  switch (code) {
    case "not_in_guild":
      return "你不在指定的 Discord 服务器中，无法登录。";
    case "missing_role":
      return "你没有所需的服务器身份组，无法登录。请联系管理员。";
    case "oauth_denied":
      return "你取消了 Discord 授权。";
    case "config":
      return "服务器未正确配置 Discord 登录（缺少环境变量）。";
    case "token":
      return "Discord 授权失败，请重试。";
    case null:
    case "":
      return null;
    default:
      return "登录失败，请重试。";
  }
}

function LoginInner() {
  const sp = useSearchParams();
  const err = errorText(sp.get("error"));

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="w-full max-w-md">
        <div className="bg-[#141414] border border-neutral-800 rounded-2xl p-8 shadow-2xl shadow-purple-950/20 space-y-6">
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={LOGO_SRC}
              alt="AresMoused"
              width={72}
              height={72}
              className="w-18 h-18 rounded-2xl object-cover ring-2 ring-purple-700/50 bg-purple-900/30"
              onError={(e) => {
                const t = e.currentTarget;
                t.onerror = null;
                t.src = LOGO_FALLBACK;
              }}
            />
            <h1 className="text-2xl font-bold text-white tracking-tight">
              OC Manager
            </h1>
            <p className="text-sm text-neutral-500 text-center">
              使用 Discord 登录。需要加入指定服务器并拥有对应身份组。
            </p>
          </div>

          {err && (
            <div className="rounded-lg border border-rose-900/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-300">
              {err}
            </div>
          )}

          <a
            href="/api/auth/discord"
            className="flex items-center justify-center gap-3 w-full py-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium text-sm transition shadow-lg shadow-indigo-900/30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.548-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
            使用 Discord 登录
          </a>

          <p className="text-[11px] text-neutral-600 text-center leading-relaxed">
            登录即表示你同意仅在授权服务器成员身份组范围内使用本应用。
            <br />
            Created by AresMoused
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-neutral-500">
          Loading...
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
