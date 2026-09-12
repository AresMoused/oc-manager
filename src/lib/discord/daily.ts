import {
  discordBulletinChannelId,
  discordDailyChannelId,
  discordDailyEmoji,
} from "@/lib/discord/config";
import {
  bulletinPayload,
  dailyPromptPayload,
  jumpUrl,
  resultPayload,
  avatarUrl,
} from "@/lib/discord/embeds";
import {
  addOwnReaction,
  getChannelMessage,
  getChannelName,
  listReactionUsers,
  postChannelMessage,
} from "@/lib/discord/rest";
import {
  getBotConfig,
  getDaily,
  saveDaily,
  saveRoll,
  type DailyRecord,
  type DailySubmission,
} from "@/lib/discord/botStore";
import { hktDate, hktYesterday, rollInspire, type InspireRoll } from "@/lib/inspire";

export async function votingEmoji(): Promise<string> {
  const cfg = await getBotConfig();
  return (cfg.emoji || discordDailyEmoji()).trim() || "❤️";
}

export async function getOrCreateToday(force = false): Promise<{
  rec: DailyRecord;
  roll: InspireRoll;
  created: boolean;
}> {
  const date = hktDate();
  const existing = await getDaily(date);
  if (existing && !force) {
    return {
      rec: existing,
      roll: {
        code: existing.code,
        prompt: existing.prompt,
        picks: existing.picks,
        enabledListIds: existing.enabledListIds,
        fixed: "",
      },
      created: false,
    };
  }
  const roll = await rollInspire();
  await saveRoll(roll);
  const rec: DailyRecord = {
    date,
    code: roll.code,
    prompt: roll.prompt,
    picks: roll.picks,
    enabledListIds: roll.enabledListIds,
    submissions: force ? [] : existing?.submissions || [],
  };
  await saveDaily(rec);
  return { rec, roll, created: true };
}

export async function postTodayPrompt(force = false): Promise<{
  rec: DailyRecord;
  roll: InspireRoll;
  posted: boolean;
}> {
  const { rec, roll, created } = await getOrCreateToday(force);
  const channelId = discordDailyChannelId();
  let posted = false;
  if (channelId && (created || force || !rec.promptMessageId)) {
    const msg = await postChannelMessage(
      channelId,
      dailyPromptPayload(roll, rec.date)
    );
    rec.promptMessageId = msg.id;
    await saveDaily(rec);
    posted = true;
  }
  return { rec, roll, posted };
}

export async function announceResults(date: string): Promise<void> {
  const rec = await getDaily(date);
  const channelId = discordDailyChannelId();
  if (!channelId) return;
  if (!rec || !rec.submissions.length) {
    const msg = await postChannelMessage(
      channelId,
      resultPayload({ date, empty: true })
    );
    if (rec) {
      rec.resultMessageId = msg.id;
      await saveDaily(rec);
    }
    return;
  }
  const emoji = await votingEmoji();
  const board = discordBulletinChannelId();
  let best: { sub: DailySubmission; votes: number } | null = null;
  for (const sub of rec.submissions) {
    let votes = 0;
    try {
      const users = await listReactionUsers(board, sub.boardMessageId, emoji);
      votes = users.filter((u) => !u.bot && u.id !== sub.authorId).length;
    } catch (e) {
      console.error("reaction count", sub.boardMessageId, e);
    }
    if (!best || votes > best.votes) best = { sub, votes };
  }
  const guildId = rec.submissions[0]?.sourceGuildId || process.env.DISCORD_GUILD_ID || "@me";
  const winnerJump = best
    ? jumpUrl(guildId, board, best.sub.boardMessageId)
    : undefined;
  const msg = await postChannelMessage(
    channelId,
    resultPayload({
      date,
      winnerJump,
      winnerName: best ? best.sub.authorName : undefined,
      votes: best?.votes,
    })
  );
  rec.resultMessageId = msg.id;
  await saveDaily(rec);
}

export async function runMidnightJob(opts?: {
  forceAnnounce?: boolean;
  forcePost?: boolean;
}): Promise<{
  settled: string;
  posted: string;
  code: string;
  announced: boolean;
  postedPrompt: boolean;
  skippedAnnounce?: string;
  channelConfigured: boolean;
}> {
  const today = hktDate();
  const yday = hktYesterday(today);
  const channelId = discordDailyChannelId();
  let announced = false;
  let skippedAnnounce: string | undefined;
  if (!channelId) {
    skippedAnnounce = "DISCORD_DAILY_CHANNEL_ID missing";
    console.error("runMidnightJob", skippedAnnounce);
  } else {
    const yrec = await getDaily(yday);
    if (yrec?.resultMessageId && !opts?.forceAnnounce) {
      skippedAnnounce = `already-settled:${yrec.resultMessageId}`;
    } else {
      try {
        await announceResults(yday);
        announced = true;
      } catch (e) {
        console.error("announceResults", yday, e);
        skippedAnnounce = e instanceof Error ? e.message : "announce-failed";
      }
    }
  }
  const { rec, posted } = await postTodayPrompt(!!opts?.forcePost);
  return {
    settled: yday,
    posted: today,
    code: rec.code,
    announced,
    postedPrompt: posted,
    skippedAnnounce,
    channelConfigured: !!channelId,
  };
}

export function firstMedia(msg: {
  attachments?: {
    url: string;
    proxy_url?: string;
    content_type?: string;
    filename?: string;
  }[];
  embeds?: {
    image?: { url?: string; proxy_url?: string };
    thumbnail?: { url?: string; proxy_url?: string };
    video?: { url?: string };
  }[];
}): {
  kind: "image" | "video";
  url: string;
  proxyUrl?: string;
  filename?: string;
  contentType?: string;
} | null {
  const videoRe = /\.(mp4|webm|mov|m4v)(\?|$)/i;
  const imageRe = /\.(png|jpe?g|gif|webp)(\?|$)/i;
  for (const a of msg.attachments || []) {
    const t = (a.content_type || "").toLowerCase();
    const name = `${a.filename || ""} ${a.url || ""}`;
    if (t.startsWith("video/") || videoRe.test(name)) {
      return {
        kind: "video",
        url: a.url,
        proxyUrl: a.proxy_url,
        filename: a.filename,
        contentType: a.content_type,
      };
    }
    if (t.startsWith("image/") || imageRe.test(name)) {
      return {
        kind: "image",
        url: a.url,
        proxyUrl: a.proxy_url,
        filename: a.filename,
        contentType: a.content_type,
      };
    }
  }
  for (const e of msg.embeds || []) {
    if (e.video?.url) return { kind: "video", url: e.video.url };
    const img = e.image?.url || e.thumbnail?.url;
    const proxy = e.image?.proxy_url || e.thumbnail?.proxy_url;
    if (img) return { kind: "image", url: img, proxyUrl: proxy };
  }
  return null;
}

function safeFilename(name: string | undefined, kind: "image" | "video", contentType?: string): string {
  const raw = (name || "").split(/[/\\]/).pop() || "";
  const cleaned = raw.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  if (cleaned && /\.[a-z0-9]{2,5}$/i.test(cleaned)) return cleaned;
  if (kind === "video") return "video.mp4";
  if ((contentType || "").includes("gif")) return "image.gif";
  if ((contentType || "").includes("webp")) return "image.webp";
  if ((contentType || "").includes("jpeg") || (contentType || "").includes("jpg")) return "image.jpg";
  return "image.png";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const ingestLocks = new Map<string, Promise<unknown>>();

function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = ingestLocks.get(key) || Promise.resolve();
  const next = prev.then(fn, fn);
  ingestLocks.set(
    key,
    next.then(
      () => undefined,
      () => undefined
    )
  );
  return next;
}

function codeMatches(text: string, code: string): boolean {
  const t = (text || "").toUpperCase();
  const c = (code || "").toUpperCase();
  if (!c) return false;
  return t.includes(`#${c}`) || t.includes(c);
}

async function downloadOnce(
  url: string,
  filename: string,
  contentType: string
): Promise<{ bytes: Uint8Array; filename: string; contentType: string } | null> {
  const headers: Record<string, string> = {};
  const token = process.env.DISCORD_BOT_TOKEN || "";
  if (token) headers.Authorization = `Bot ${token}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error("download media", res.status, url.slice(0, 160));
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 10 * 1024 * 1024) {
      console.error("download media size", buf.byteLength);
      return null;
    }
    const type =
      contentType || res.headers.get("content-type") || "application/octet-stream";
    return { bytes: buf, filename, contentType: type };
  } catch (e) {
    console.error("download media error", e);
    return null;
  }
}

async function downloadForAttach(
  urls: string[],
  filename: string,
  contentType: string
): Promise<{ bytes: Uint8Array; filename: string; contentType: string } | null> {
  const unique = [...new Set(urls.filter(Boolean))];
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of unique) {
      const got = await downloadOnce(url, filename, contentType);
      if (got) return got;
    }
    await sleep(700 * (attempt + 1));
  }
  return null;
}

export async function ingestSubmission(raw: {
  id: string;
  channel_id: string;
  guild_id?: string;
  content?: string;
  author?: {
    id: string;
    username?: string;
    global_name?: string;
    avatar?: string | null;
    bot?: boolean;
  };
  attachments?: {
    url: string;
    proxy_url?: string;
    content_type?: string;
    filename?: string;
  }[];
  embeds?: {
    image?: { url?: string; proxy_url?: string };
    thumbnail?: { url?: string; proxy_url?: string };
    video?: { url?: string };
  }[];
}): Promise<{ ok: boolean; reason?: string; boardMessageId?: string }> {
  if (raw.author?.bot) return { ok: false, reason: "bot" };
  return withLock(`msg:${raw.id}`, () => ingestOnce(raw));
}

async function ingestOnce(raw: {
  id: string;
  channel_id: string;
  guild_id?: string;
  content?: string;
  author?: {
    id: string;
    username?: string;
    global_name?: string;
    avatar?: string | null;
    bot?: boolean;
  };
  attachments?: {
    url: string;
    proxy_url?: string;
    content_type?: string;
    filename?: string;
  }[];
  embeds?: {
    image?: { url?: string; proxy_url?: string };
    thumbnail?: { url?: string; proxy_url?: string };
    video?: { url?: string };
  }[];
}): Promise<{ ok: boolean; reason?: string; boardMessageId?: string }> {
  let msg = raw;
  try {
    const fresh = await getChannelMessage(raw.channel_id, raw.id);
    msg = {
      ...raw,
      ...fresh,
      guild_id: raw.guild_id || fresh.guild_id,
      attachments: fresh.attachments?.length ? fresh.attachments : raw.attachments,
      embeds: fresh.embeds?.length ? fresh.embeds : raw.embeds,
    };
  } catch (e) {
    console.error("refresh message", raw.id, e);
  }

  const media = firstMedia(msg);
  if (!media) return { ok: false, reason: "no-media" };

  const text = msg.content || raw.content || "";
  const today = hktDate();
  let rec = await getDaily(today);
  if (!rec || !codeMatches(text, rec.code)) {
    const yrec = await getDaily(hktYesterday(today));
    if (yrec && codeMatches(text, yrec.code)) rec = yrec;
  }
  if (!rec) return { ok: false, reason: "no-daily" };
  if (!codeMatches(text, rec.code)) return { ok: false, reason: "wrong-code" };
  if (rec.submissions.some((s) => s.sourceMessageId === raw.id)) {
    return { ok: false, reason: "dup" };
  }

  const board = discordBulletinChannelId();
  if (!board) return { ok: false, reason: "no-board" };

  const filename = safeFilename(media.filename, media.kind, media.contentType);
  const file = await downloadForAttach(
    [media.url, media.proxyUrl || ""],
    filename,
    media.contentType || (media.kind === "video" ? "video/mp4" : "image/png")
  );
  if (!file) {
    return { ok: false, reason: "media-not-ready" };
  }

  const channelName = await getChannelName(raw.channel_id);
  const authorName = msg.author?.global_name || msg.author?.username || "未知";
  const payload: Record<string, unknown> = bulletinPayload({
    authorName,
    authorIcon: msg.author ? avatarUrl(msg.author.id, msg.author.avatar) : null,
    imageUrl: media.kind === "image" ? `attachment://${file.filename}` : undefined,
    kind: media.kind,
    channelName,
    jump: jumpUrl(
      raw.guild_id || process.env.DISCORD_GUILD_ID || "@me",
      raw.channel_id,
      raw.id
    ),
  });
  if (media.kind === "image") {
    const embeds = (payload.embeds as Record<string, unknown>[]) || [];
    if (embeds[0]) embeds[0].image = { url: `attachment://${file.filename}` };
  }

  const posted = await postChannelMessage(board, payload, file);
  try {
    await addOwnReaction(board, posted.id, await votingEmoji());
  } catch (e) {
    console.error("auto-react", posted.id, e);
  }

  const latest = (await getDaily(rec.date)) || rec;
  if (latest.submissions.some((s) => s.sourceMessageId === raw.id)) {
    return { ok: true, boardMessageId: posted.id };
  }
  latest.submissions.push({
    sourceMessageId: raw.id,
    sourceChannelId: raw.channel_id,
    sourceGuildId: raw.guild_id,
    boardMessageId: posted.id,
    authorId: msg.author?.id || "",
    authorName,
    imageUrl: media.url,
    at: new Date().toISOString(),
  });
  await saveDaily(latest);
  return { ok: true, boardMessageId: posted.id };
}
