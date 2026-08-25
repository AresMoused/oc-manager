/**
 * Register guild slash commands. Needs DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID,
 * DISCORD_GUILD_ID. Or POST /api/discord/register?secret=CRON_SECRET on the site.
 */
async function main() {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const secret = process.env.CRON_SECRET || "";
  const res = await fetch(`${base}/api/discord/register?secret=${encodeURIComponent(secret)}`);
  console.log(res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
