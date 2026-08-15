"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOGO_SRC } from "@/lib/logo";
import AuthUserMenu from "@/components/AuthUserMenu";

export default function Navbar() {
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
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="" className="w-7 h-7 object-contain" />
          <span className="font-semibold text-white group-hover:text-purple-200 transition">
            OC Manager
          </span>
        </Link>
        <nav className="flex items-center gap-4 overflow-x-auto">
          <Link href="/" className={linkClass("/")}>
            Worlds
          </Link>
          <Link href="/shared" className={linkClass("/shared")}>
            分享区
          </Link>
          <Link href="/generator" className={linkClass("/generator")}>
            角色外观生成器
          </Link>
          <Link href="/ai-generate" className={linkClass("/ai-generate")}>
            AI生成角色
          </Link>
          <Link href="/comfy" className={linkClass("/comfy")}>
            抽卡姬
          </Link>
          <AuthUserMenu />
        </nav>
      </div>
    </header>
  );
}
