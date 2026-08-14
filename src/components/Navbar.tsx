"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_SRC } from "@/lib/logo";

export default function Navbar({ worldColor }: { worldColor?: string }) {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const active =
      href === "/"
        ? pathname === "/"
        : pathname === href || pathname.startsWith(href + "/");
    return `text-sm transition ${active ? "text-white" : "text-neutral-400 hover:text-white"}`;
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
            className="w-8 h-8 rounded-full object-cover ring-1 ring-neutral-700 group-hover:ring-purple-500 transition"
          />
          <span className="font-semibold text-white tracking-tight">
            OC Manager
          </span>
        </Link>

        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className={linkClass("/")}>
            Worlds
          </Link>
          <Link href="/generator" className={linkClass("/generator")}>
            角色外观生成器
          </Link>
        </nav>
      </div>
    </header>
  );
}
