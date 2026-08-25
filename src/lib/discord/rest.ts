const API = "https://discord.com/api/v10";

function token(): string {
  const t = process.env.DISCORD_BOT_TOKEN || "";
  if (!t) throw new Error("DISCORD_BOT_TOKEN missing");
  return t;
}

function appId(): string {
  return process.env.DISCORD_CLIENT_ID || "";
}

export async function discordFetch(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res;
}

export async function discordJson<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const res = await discordFetch(method, path, body);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Discord ${method} ${path} ${res.status}: ${text.slice(0, 400)}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export type DiscordMessage = {
  id: string;
  channel_id: string;
  content?: string;
  author?: { id: string; username?: string; bot?: boolean };
  attachments?: { url: string; content_type?: string; filename?: string }[];
  reactions?: { emoji: { name: string | null; id: string | null }; count: number }[];
};

export async function postChannelMessage(
  channelId: string,
  payload: Record<string, unknown>
): Promise<DiscordMessage> {
  return discordJson("POST", `/channels/${channelId}/messages`, payload);
}

export async function getChannelMessage(
  channelId: string,
  messageId: string
): Promise<DiscordMessage> {
  return discordJson("GET", `/channels/${channelId}/messages/${messageId}`);
}

export async function getChannelName(channelId: string): Promise<string> {
  try {
    const ch = await discordJson<{ name?: string }>("GET", `/channels/${channelId}`);
    return ch.name || channelId;
  } catch {
    return channelId;
  }
}

export async function addOwnReaction(
  channelId: string,
  messageId: string,
  emoji: string
): Promise<void> {
  const raw = emoji.trim();
  const custom = raw.match(/^<a?:(\w+):(\d+)>$/);
  const enc = encodeURIComponent(custom ? `${custom[1]}:${custom[2]}` : raw);
  const res = await discordFetch(
    "PUT",
    `/channels/${channelId}/messages/${messageId}/reactions/${enc}/@me`
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`react ${res.status}: ${t.slice(0, 300)}`);
  }
}

export async function listReactionUsers(
  channelId: string,
  messageId: string,
  emoji: string
): Promise<{ id: string; bot?: boolean }[]> {
  const raw = emoji.trim();
  const custom = raw.match(/^<a?:(\w+):(\d+)>$/);
  const enc = encodeURIComponent(custom ? `${custom[1]}:${custom[2]}` : raw);
  const users = await discordJson<{ id: string; bot?: boolean }[]>(
    "GET",
    `/channels/${channelId}/messages/${messageId}/reactions/${enc}?limit=100`
  );
  return Array.isArray(users) ? users : [];
}

export async function editInteractionOriginal(
  interactionToken: string,
  payload: Record<string, unknown>
): Promise<void> {
  const id = appId();
  const res = await fetch(
    `${API}/webhooks/${id}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`edit original ${res.status}: ${t.slice(0, 400)}`);
  }
}

export async function deleteInteractionOriginal(
  interactionToken: string
): Promise<void> {
  const id = appId();
  const res = await fetch(
    `${API}/webhooks/${id}/${interactionToken}/messages/@original`,
    { method: "DELETE" }
  );
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`delete original ${res.status}: ${t.slice(0, 400)}`);
  }
}

export type SlashCommandDef = {
  name: string;
  description: string;
  options?: unknown[];
};

export async function registerGuildCommands(
  guildId: string,
  commands: SlashCommandDef[]
): Promise<unknown> {
  const id = appId();
  return discordJson(
    "PUT",
    `/applications/${id}/guilds/${guildId}/commands`,
    commands
  );
}
