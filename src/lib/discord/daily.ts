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
}> {
  const { rec, roll, created } = await getOrCreateToday(force);
  const channelId = discordDailyChannelId();
  if (channelId && (created || force || !rec.promptMessageId)) {
    const msg = await postChannelMessage(
      channelId,
      dailyPromptPayload(roll, rec.date)
    );
    rec.promptMessageId = msg.id;
    await saveDaily(rec);
  }
  return { rec, roll };
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

export async function runMidnightJob(): Promise<{
  settled: string;
  posted: string;
  code: string;
}> {
  const today = hktDate();
  const yday = hktYesterday(today);
  try {
    await announceResults(yday);
  } catch (e) {
    console.error("announceResults", yday, e);
  }
  const { rec } = await postTodayPrompt(false);
  return { settled: yday, posted: today, code: rec.code };
}

export function firstImageUrl(msg: {
  attachments?: { url: string; content_type?: string; filename?: string }[];
  embeds?: { image?: { url?: string }; thumbnail?: { url?: string } }[];
}): string | null {
  for (const a of msg.attachments || []) {
    const t = a.content_type || "";
    if (t.startsWith("image/")) return a.url;
    if (/\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url || a.filename || "")) return a.url;
  }
  for (const e of msg.embeds || []) {
    if (e.image?.url) return e.image.url;
    if (e.thumbnail?.url) return e.thumbnail.url;
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
  attachments?: { url: string; content_type?: string; filename?: string }[];
  embeds?: { image?: { url?: string }; thumbnail?: { url?: string } }[];
}): Promise<{ ok: boolean; reason?: string; boardMessageId?: string }> {
  if (raw.author?.bot) return { ok: false, reason: "bot" };
  const imageUrl = firstImageUrl(raw);
  if (!imageUrl) return { ok: false, reason: "no-image" };

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
  const posted = await postChannelMessage(
    board,
    bulletinPayload({
      authorName,
      authorIcon: raw.author
        ? avatarUrl(raw.author.id, raw.author.avatar)
        : null,
      imageUrl,
      channelName,
      jump: jumpUrl(
        raw.guild_id || process.env.DISCORD_GUILD_ID || "@me",
        raw.channel_id,
        raw.id
      ),
    })
  );
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
    imageUrl,
    at: new Date().toISOString(),
  });
  await saveDaily(rec);
  return { ok: true, boardMessageId: posted.id };
}
