"use client";

import { usePathname } from "next/navigation";
import ZhiHuiJiDock from "@/components/ZhiHuiJiDock";
import LogsDock from "@/components/LogsDock";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const hide = path === "/login" || path.startsWith("/login?");
  return (
    <>
      {children}
      {!hide && <ZhiHuiJiDock />}
      {!hide && <LogsDock />}
    </>
  );
}