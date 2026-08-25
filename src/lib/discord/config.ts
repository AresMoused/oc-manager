/** Discord bot channel / role IDs from env — never hardcode a role. */

export function discordDailyChannelId(): string {
  return (process.env.DISCORD_DAILY_CHANNEL_ID || "").trim();
}

/** Bulletin = daily channel unless DISCORD_BULLETIN_CHANNEL_ID is set. */
export function discordBulletinChannelId(): string {
  return (
    (process.env.DISCORD_BULLETIN_CHANNEL_ID || "").trim() ||
    discordDailyChannelId()
  );
}

export function discordWatchChannelIds(): string[] {
  return (process.env.DISCORD_WATCH_CHANNEL_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Role to @ when posting the daily prompt and when announcing results. */
export function discordPingRoleId(): string {
  return (process.env.DISCORD_PING_ROLE_ID || "").trim();
}

export function discordDailyEmoji(): string {
  return (process.env.DISCORD_DAILY_EMOJI || "❤️").trim() || "❤️";
}

/** `<@&id>` mention, or empty string if no role configured. */
export function discordPingRoleMention(): string {
  const id = discordPingRoleId();
  return id ? `<@&${id}>` : "";
}
