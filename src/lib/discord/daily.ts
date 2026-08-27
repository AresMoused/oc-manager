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
  attachments?: { url: string; content_type?: string; filename?: string }[];
  embeds?: {
    image?: { url?: string };
    thumbnail?: { url?: string };
    video?: { url?: string };
  }[];
}): {
  kind: "image" | "video";
  url: string;
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
        filename: a.filename,
        contentType: a.content_type,
      };
    }
    if (t.startsWith("image/") || imageRe.test(name)) {
      return {
        kind: "image",
        url: a.url,
        filename: a.filename,
        contentType: a.content_type,
      };
    }
  }
  for (const e of msg.embeds || []) {
    if (e.video?.url) return { kind: "video", url: e.video.url };
    if (e.image?.url) return { kind: "image", url: e.image.url };
    if (e.thumbnail?.url) return { kind: "image", url: e.thumbnail.url };
  }
  return null;
}

async function downloadForAttach(
  url: string,
  filename: string,
  contentType: string
): Promise<{ bytes: Uint8Array; filename: string; contentType: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN || ""}` },
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) return null;
    return { bytes: buf, filename: filename || "video.mp4", contentType };
  } catch {
    return null;
  }
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
  attachments?: { url: string; content_type?: string; filename?: string }[];
  embeds?: {
    image?: { url?: string };
    thumbnail?: { url?: string };
    video?: { url?: string };
  }[];
}): Promise<{ ok: boolean; reason?: string; boardMessageId?: string }> {
  if (raw.author?.bot) return { ok: false, reason: "bot" };
  const media = firstMedia(raw);
  if (!media) return { ok: false, reason: "no-media" };

  const date = hktDate();
  const rec = await getDaily(date);
  if (!rec) return { ok: false, reason: "no-daily" };
  const text = raw.content || "";
  const hasCode =
    text.toUpperCase().includes(`#${rec.code}`) ||
    text.toUpperCase().includes(rec.code);
  if (!hasCode) return { ok: false, reason: "wrong-code" };
  if (rec.submissions.some((s) => s.sourceMessageId === raw.id)) {
    return { ok: false, reason: "dup" };
  }

  const board = discordBulletinChannelId();
  if (!board) return { ok: false, reason: "no-board" };
  const channelName = await getChannelName(raw.channel_id);
  const authorName = raw.author?.global_name || raw.author?.username || "未知";
  const payload: Record<string, unknown> = bulletinPayload({
    authorName,
    authorIcon: raw.author
      ? avatarUrl(raw.author.id, raw.author.avatar)
      : null,
    imageUrl: media.kind === "image" ? media.url : undefined,
    kind: media.kind,
    channelName,
    jump: jumpUrl(
      raw.guild_id || process.env.DISCORD_GUILD_ID || "@me",
      raw.channel_id,
      raw.id
    ),
  });
  let file:
    | { bytes: Uint8Array; filename: string; contentType: string }
    | undefined;
  if (media.kind === "video") {
    file =
      (await downloadForAttach(
        media.url,
        media.filename || "video.mp4",
        media.contentType || "video/mp4"
      )) || undefined;
    if (!file) {
      payload.content = media.url;
    }
  }
  const posted = await postChannelMessage(board, payload, file);
  try {
    await addOwnReaction(board, posted.id, await votingEmoji());
  } catch (e) {
    console.error("auto-react", posted.id, e);
  }
  rec.submissions.push({
    sourceMessageId: raw.id,
    sourceChannelId: raw.channel_id,
    sourceGuildId: raw.guild_id,
    boardMessageId: posted.id,
    authorId: raw.author?.id || "",
    authorName,
    imageUrl: media.url,
    at: new Date().toISOString(),
  });
  await saveDaily(rec);
  return { ok: true, boardMessageId: posted.id };
}
