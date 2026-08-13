"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar(props: { worldColor?: string } = {}) {
  const { worldColor } = props;
  const path = usePathname();

  const linkClass = (href: string) =>
    `px-3 py-1.5 rounded-md text-sm transition ${
      path === href || (href !== "/" && path.startsWith(href))
        ? "bg-purple-600/30 text-purple-300"
        : "text-neutral-400 hover:text-white hover:bg-neutral-800"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.png"
              alt="AresMoused"
              width={36}
              height={36}
              className="rounded-lg object-contain group-hover:scale-105 transition-transform bg-purple-700/40"
              onError={(e) => {
                const t = e.currentTarget;
                t.onerror = null;
                t.src =
                  "data:image/svg+xml," +
                  encodeURIComponent(
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#7c3aed"/><text x="32" y="38" text-anchor="middle" fill="#fff" font-size="14" font-family="sans-serif" font-weight="700">Ares</text></svg>'
                  );
              }}
            />
            <span className="font-semibold text-white hidden sm:block">
              OC Manager
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/" className={linkClass("/")}>
              Worlds
            </Link>
            <Link href="/generator" className={linkClass("/generator")}>
              角色生成器
            </Link>
          </nav>
        </div>
        <div className="text-xs text-neutral-500 hidden sm:block">
          TRPG · DnD / CoC / Cyberpunk
        </div>
      </div>
    </header>
  );
}
