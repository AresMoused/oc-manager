/** Light markdown + HTML sanitize for chat bubbles. */

import { applyRegexes, type ChatRegex } from "@/lib/chatRegex";

const ALLOW = new Set([
  "DETAILS",
  "SUMMARY",
  "P",
  "BR",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "DEL",
  "CODE",
  "PRE",
  "SPAN",
  "DIV",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "H1",
  "H2",
  "H3",
  "HR",
  "A",
  "IMG",
]);

function markdownLite(s: string): string {
  let t = s;
  t = t.replace(/```[\w]*\n?([\s\S]*?)```/g, (_m, code: string) => {
    const esc = String(code)
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">");
    return `<pre><code>${esc}</code></pre>`;
  });
  t = t.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^\w*])\*([^*\n]+)\*(?=[^\w*]|$)/g, "$1<em>$2</em>");
  t = t.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
  t = t.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
  t = t.replace(/\n/g, "<br>");
  return t;
}

export function sanitizeChatHtml(html: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, "text/html");
  const root = doc.getElementById("r");
  if (!root) return "";
  const walk = (el: Element) => {
    const kids = Array.from(el.children);
    for (const child of kids) {
      if (!ALLOW.has(child.tagName)) {
        const text = doc.createTextNode(child.textContent || "");
        child.replaceWith(text);
        continue;
      }
      for (const attr of Array.from(child.attributes)) {
        const n = attr.name.toLowerCase();
        if (n.startsWith("on") || n === "srcdoc" || n === "style") {
          child.removeAttribute(attr.name);
          continue;
        }
        if (child.tagName === "A" && n === "href") {
          const href = attr.value.trim();
          if (!/^https?:\/\//i.test(href)) child.removeAttribute("href");
          else child.setAttribute("rel", "noopener noreferrer");
          child.setAttribute("target", "_blank");
          continue;
        }
        if (child.tagName === "IMG" && n === "src") {
          const src = attr.value.trim();
          if (!/^(https?:\/\/|data:image\/)/i.test(src)) child.removeAttribute("src");
          continue;
        }
        if (n !== "href" && n !== "src" && n !== "alt" && n !== "class" && n !== "open") {
          child.removeAttribute(attr.name);
        }
      }
      walk(child);
    }
  };
  walk(root);
  return root.innerHTML;
}

export function unwrapWorldInfo(raw: string): string {
  let s = String(raw || "");
  s = s.replace(
    /\[details\]\s*\[summary\]([\s\S]*?)\[\/summary\]([\s\S]*?)\[\/details\]/gi,
    "\n<details><summary>$1</summary>$2</details>\n"
  );
  s = s.replace(/\[\/?world_info\]/gi, "");
  s = s.replace(/\[\/?content\]/gi, "");
  s = s.replace(/\[\/?details\]/gi, "");
  s = s.replace(/\[\/?summary\]/gi, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export function stripHiddenBlocks(raw: string): string {
  return unwrapWorldInfo(
    String(raw || "")
      .replace(/<分析喵>[\s\S]*?<\/分析喵>/gi, "")
      .replace(/<think>[\s\S]*?<\/think>/gi, "")
      .replace(/<apply>[\s\S]*?<\/apply>/gi, "")
      .replace(/<SystemQuery>[\s\S]*?<\/SystemQuery>/gi, "")
  );
}

export function formatChatHtml(raw: string, regexes?: ChatRegex[]): string {
  let s = stripHiddenBlocks(raw);
  s = applyRegexes(s, regexes, "display");
  s = markdownLite(s);
  return sanitizeChatHtml(s);
}