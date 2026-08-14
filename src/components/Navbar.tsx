"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_SRC } from "@/lib/logo";
import AuthUserMenu from "@/components/AuthUserMenu";

const LOGO_FALLBACK =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7c3aed"/><text x="32" y="38" text-anchor="middle" fill="#fff" font-size="14" font-family="sans-serif" font-weight="700">Ares</text></svg>'
  );

export default function Navbar({ worldColor }: { worldColor?: string }) {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const active =
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(href + "/");
    return `text-sm transition ${
      active ? "text-white" : "text-neutral-400 hover:text-white"
    }`;
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-md"
      style={
        worldColor
          ? { borderBottomColor: worldColor + "55" }
          : undefined
      }
    >
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_SRC}
            alt="AresMoused"
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover ring-1 ring-neutral-700 group-hover:ring-purple-500 transition bg-purple-700/40"
            onError={(e) => {
              const el = e.currentTarget;
              el.onerror = null;
              el.src = LOGO_FALLBACK;
            }}
          />
          <span className="font-semibold text-white tracking-tight">OC Manager</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5 flex-wrap justify-end">
          <Link href="/" className={linkClass("/")}>Worlds</Link>
          <Link href="/generator" className={linkClass("/generator")}>角色外观生成器</Link>
          <Link href="/ai-generate" className={linkClass("/ai-generate")}>AI生成角色</Link>
          <Link href="/comfy" className={linkClass("/comfy")}>抽卡姬</Link>
          <AuthUserMenu />
        </nav>
      </div>
    </header>
  );
}
