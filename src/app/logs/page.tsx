"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";

export default function LogsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="min-h-screen">
      <Navbar />
      <p className="text-sm text-neutral-500 p-8 text-center">日志已改到左上角浮窗。</p>
    </div>
  );
}