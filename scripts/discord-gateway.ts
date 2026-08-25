/**
 * Railway sidecar: keep a Discord Gateway connection and forward
 * watched-channel image messages to the Next ingest endpoint.
 *
 * Required env: DISCORD_BOT_TOKEN, DISCORD_WATCH_CHANNEL_IDS,
 * INGEST_URL, CRON_SECRET
 */
const TOKEN = process.env.DISCORD_BOT_TOKEN || "";
const INGEST = (process.env.INGEST_URL || "").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET || "";
const WATCH = new Set(
  (process.env.DISCORD_WATCH_CHANNEL_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
);

// GUILDS + GUILD_MESSAGES + MESSAGE_CONTENT
const INTENTS = 1 | (1 << 9) | (1 << 15);
const API = "https://discord.com/api/v10";

function log(...args: unknown[]) {
  console.log(new Date().toISOString(), ...args);
}

async function gatewayUrl(): Promise<string> {
  const res = await fetch(`${API}/gateway`);
  const data = (await res.json()) as { url?: string };
  if (!data.url) throw new Error("no gateway url");
  return `${data.url}/?v=10&encoding=json`;
}

type Payload = {
  op: number;
  d: Record<string, unknown> | null;
  s: number | null;
  t: string | null;
};

async function run() {
  if (!TOKEN) throw new Error("DISCORD_BOT_TOKEN missing");
  if (!INGEST) throw new Error("INGEST_URL missing");
  if (!WATCH.size) throw new Error("DISCORD_WATCH_CHANNEL_IDS missing");

  const { default: WebSocket } = await import("ws");
  let ws: InstanceType<typeof WebSocket> | null = null;
  let seq: number | null = null;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let sessionId: string | null = null;
  let identified = false;

  const send = (op: number, d: unknown) => {
    ws?.send(JSON.stringify({ op, d }));
  };

  const heartbeat = (ms: number) => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => send(1, seq), ms);
  };

  const handleMessage = async (raw: Buffer | string) => {
    const p = JSON.parse(String(raw)) as Payload;
    if (p.s != null) seq = p.s;

    if (p.op === 10) {
      const interval = Number((p.d as { heartbeat_interval: number }).heartbeat_interval);
      heartbeat(interval);
      send(2, {
        token: TOKEN,
        intents: INTENTS,
        properties: { os: "linux", browser: "oc-manager", device: "railway" },
      });
      log("IDENTIFY intents=", INTENTS);
      return;
    }

    if (p.op === 11) return;
    if (p.op === 7 || p.op === 9) {
      log("reconnect op", p.op);
      ws?.close();
      return;
    }

    if (p.t === "READY") {
      identified = true;
      sessionId = String((p.d as { session_id?: string })?.session_id || "");
      const user = (p.d as { user?: { username?: string } })?.user;
      log("gateway ready as", user?.username, "session", sessionId);
      return;
    }

    if (p.t !== "MESSAGE_CREATE" || !p.d) return;
    const msg = p.d as {
      id: string;
      channel_id: string;
      guild_id?: string;
      author?: { bot?: boolean; id?: string };
      content?: string;
      attachments?: { url: string; content_type?: string }[];
      embeds?: { image?: { url?: string }; thumbnail?: { url?: string } }[];
    };
    if (msg.author?.bot) return;
    if (!WATCH.has(msg.channel_id)) return;
    const hasImage =
      (msg.attachments || []).some(
        (a) =>
          (a.content_type || "").startsWith("image/") ||
          /\.(png|jpe?g|gif|webp)(\?|$)/i.test(a.url || "")
      ) ||
      (msg.embeds || []).some((e) => e.image?.url || e.thumbnail?.url);
    if (!hasImage) return;
    if (!/#OC-[A-Z0-9]+/i.test(msg.content || "")) return;

    log("ingest candidate", msg.id, "ch", msg.channel_id);
    try {
      const res = await fetch(`${INGEST}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SECRET}`,
        },
        body: JSON.stringify(msg),
      });
      log("ingest", res.status, await res.text().then((t) => t.slice(0, 200)));
    } catch (e) {
      log("ingest error", e);
    }
  };

  const connect = async () => {
    const url = await gatewayUrl();
    log("connecting", url);
    ws = new WebSocket(url);
    ws.on("message", (data) => {
      void handleMessage(data as Buffer);
    });
    ws.on("close", (code, reason) => {
      log("ws close", code, String(reason));
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      identified = false;
      setTimeout(() => void connect(), 2500);
    });
    ws.on("error", (err) => log("ws error", err));
  };

  await connect();
  const expireUrl = INGEST.replace(/\/ingest\/?$/, "/expire-inspire");
  setInterval(() => {
    void fetch(expireUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
    })
      .then(async (res) => {
        if (!res.ok) log("expire", res.status);
      })
      .catch((e) => log("expire error", e));
  }, 30000);
  setInterval(() => {
    if (!identified) log("waiting for READY…");
  }, 30000);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
