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
