import { promises as fs } from "fs";
import path from "path";
import { isR2Configured, r2GetJson, r2PutJson } from "@/lib/r2";
import type { InspireRoll } from "@/lib/inspire";

export type DailySubmission = {
  sourceMessageId: string;
  sourceChannelId: string;
  sourceGuildId?: string;
  boardMessageId: string;
  authorId: string;
  authorName: string;
  imageUrl: string;
  at: string;
};

export type DailyRecord = {
  date: string;
  code: string;
  prompt: string;
  picks: InspireRoll["picks"];
  enabledListIds: string[];
  promptMessageId?: string;
  resultMessageId?: string;
  submissions: DailySubmission[];
};

export type BotConfig = {
  emoji?: string;
};

const LOCAL_DIR = path.join(process.cwd(), "data", "bot");

async function getJson<T>(key: string): Promise<T | null> {
  if (isR2Configured()) return r2GetJson<T>(key);
  try {
    const text = await fs.readFile(path.join(LOCAL_DIR, key), "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function putJson(key: string, data: unknown): Promise<void> {
  if (isR2Configured()) {
    await r2PutJson(key, data);
    return;
  }
  const full = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(data, null, 2), "utf8");
}

export async function getDaily(date: string): Promise<DailyRecord | null> {
  return getJson<DailyRecord>(`bot/daily/${date}.json`);
}

export async function saveDaily(rec: DailyRecord): Promise<void> {
  await putJson(`bot/daily/${rec.date}.json`, rec);
}

export async function getRoll(code: string): Promise<InspireRoll | null> {
  return getJson<InspireRoll>(`bot/rolls/${code}.json`);
}

export async function saveRoll(roll: InspireRoll): Promise<void> {
  await putJson(`bot/rolls/${roll.code}.json`, roll);
}

export async function getBotConfig(): Promise<BotConfig> {
  return (await getJson<BotConfig>("bot/config.json")) || {};
}

export async function saveBotConfig(cfg: BotConfig): Promise<void> {
  await putJson("bot/config.json", cfg);
}
