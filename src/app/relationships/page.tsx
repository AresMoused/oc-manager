"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Global relationships redirected — maps are now per-world */
export default function RelationshipsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-neutral-500 text-sm">
      Redirecting to Worlds…
    </div>
  );
}
