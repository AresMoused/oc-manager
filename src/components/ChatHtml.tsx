"use client";

import { useMemo } from "react";
import type { ChatRegex } from "@/lib/chatRegex";
import { formatChatHtml } from "@/lib/chatHtml";

export default function ChatHtml({
  raw,
  regexes,
  className,
}: {
  raw: string;
  regexes?: ChatRegex[];
  className?: string;
}) {
  const html = useMemo(() => formatChatHtml(raw, regexes), [raw, regexes]);
  if (!html) return null;
  return (
    <div
      className={`chat-html text-sm leading-relaxed [&_img]:max-h-64 [&_img]:rounded-lg [&_img]:my-2 [&_img]:block ${className || ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}