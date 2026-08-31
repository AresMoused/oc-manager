"use client";

import { usePathname } from "next/navigation";
import ZhiHuiJiDock from "@/components/ZhiHuiJiDock";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const hide = path === "/login" || path.startsWith("/login?");
  return (
    <>
      {children}
      {!hide && <ZhiHuiJiDock />}
    </>
  );
}