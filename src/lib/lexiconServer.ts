/**
 * Server-side lexicon: read seed from public/prompts/lexicon,
 * overlay/publish via R2 when configured.
 */
import { promises as fs } from "fs";
import path from "path";
import {
  isR2Configured,
  r2GetJson,
  r2PutJson,
  r2Delete,
} from "@/lib/r2";

export interface LexiconItem {
  name: string;
  tags: string;
  hex?: string;
  image?: string;
}

export interface LexiconListMeta {
  id: string;
  label: string;
  path: string;
  icon?: string;
  desc?: string;
}

export interface LexiconCategory {
  id: string;
  label: string;
  lists: LexiconListMeta[];
}

export interface LexiconIndex {
  version: number;
  fixed?: string;
  categories: LexiconCategory[];
}

export interface LexiconListContent {
  id: string;
  label: string;
  icon?: string;
  desc?: string;
  items: LexiconItem[];
  local?: boolean;
  source?: "cdn" | "seed" | "pending";
}

export interface PendingSubmission {
  id: string;
  listId: string;
  categoryId: string;
  categoryLabel: string;
  label: string;
  path: string;
  items: LexiconItem[];
  icon?: string;
  desc?: string;
  submitterId: string;
  submitterName: string;
  createdAt: string;
  status: "pending";
}

const SEED_DIR = path.join(process.cwd(), "public", "prompts", "lexicon");
const R2_INDEX = "lexicon/index.json";
const R2_DEFAULT = "lexicon/default-enabled.json";
const R2_PENDING_INDEX = "lexicon/pending/index.json";
const LOCAL_PENDING_DIR = path.join(process.cwd(), "data", "lexicon-pending");

async function readSeedJson<T>(rel: string): Promise<T | null> {
  try {
    const full = path.join(SEED_DIR, rel);
    const text = await fs.readFile(full, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function getLexiconIndex(): Promise<LexiconIndex> {
  if (isR2Configured()) {
    const remote = await r2GetJson<LexiconIndex>(R2_INDEX);
    if (remote?.categories?.length) return remote;
  }
  const seed = await readSeedJson<LexiconIndex>("index.json");
  if (seed?.categories?.length) return seed;
  return { version: 1, fixed: "1girl, ", categories: [] };
}

export async function getDefaultEnabledIds(): Promise<string[]> {
  if (isR2Configured()) {
    const remote = await r2GetJson<{ enabledListIds?: string[] }>(R2_DEFAULT);
    if (remote?.enabledListIds) return remote.enabledListIds;
  }
  const seed = await readSeedJson<{ enabledListIds?: string[] }>(
    "default-enabled.json"
  );
  return seed?.enabledListIds || [];
}

export async function getLexiconList(
  listId: string
): Promise<LexiconListContent | null> {
  const safe = listId.replace(/^\/+/, "").replace(/\.\./g, "");
  const r2Key = `lexicon/lists/${safe}.json`;
  if (isR2Configured()) {
    const remote = await r2GetJson<LexiconListContent>(r2Key);
    if (remote?.items) return { ...remote, source: "cdn" };
  }
  const seed = await readSeedJson<LexiconListContent>(`lists/${safe}.json`);
  if (seed?.items) return { ...seed, id: seed.id || safe, source: "seed" };

  try {
    const legacyPath = path.join(
      process.cwd(),
      "public",
      "prompts",
      "original_character.json"
    );
    const text = await fs.readFile(legacyPath, "utf8");
    const legacy = JSON.parse(text) as {
      sections?: {
        key: string;
        label: string;
        icon?: string;
        desc?: string;
        items: LexiconItem[];
      }[];
    };
    const sectionKey = safe.includes("/") ? safe.split("/").pop()! : safe;
    const sec = legacy.sections?.find((s) => s.key === sectionKey);
    if (sec?.items?.length) {
      return {
        id: safe,
        label: sec.label,
        icon: sec.icon,
        desc: sec.desc,
        items: sec.items,
        source: "seed",
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

async function readPendingIndex(): Promise<PendingSubmission[]> {
  if (isR2Configured()) {
    const remote = await r2GetJson<PendingSubmission[]>(R2_PENDING_INDEX);
    return Array.isArray(remote) ? remote : [];
  }
  try {
    const text = await fs.readFile(
      path.join(LOCAL_PENDING_DIR, "index.json"),
      "utf8"
    );
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writePendingIndex(list: PendingSubmission[]): Promise<void> {
  if (isR2Configured()) {
    await r2PutJson(R2_PENDING_INDEX, list);
    return;
  }
  await fs.mkdir(LOCAL_PENDING_DIR, { recursive: true });
  await fs.writeFile(
    path.join(LOCAL_PENDING_DIR, "index.json"),
    JSON.stringify(list, null, 2),
    "utf8"
  );
}

export async function listPending(): Promise<PendingSubmission[]> {
  return readPendingIndex();
}

export async function addPending(
  sub: PendingSubmission
): Promise<PendingSubmission> {
  const list = await readPendingIndex();
  list.unshift(sub);
  await writePendingIndex(list);
  if (isR2Configured()) {
    await r2PutJson(`lexicon/pending/${sub.id}.json`, sub);
  } else {
    await fs.mkdir(LOCAL_PENDING_DIR, { recursive: true });
    await fs.writeFile(
      path.join(LOCAL_PENDING_DIR, `${sub.id}.json`),
      JSON.stringify(sub, null, 2),
      "utf8"
    );
  }
  return sub;
}

export async function reviewPending(
  id: string,
  action: "approve" | "reject"
): Promise<{ ok: boolean; message: string }> {
  const list = await readPendingIndex();
  const idx = list.findIndex((p) => p.id === id);
  if (idx < 0) return { ok: false, message: "找不到待审提交" };
  const sub = list[idx]!;

  if (action === "reject") {
    list.splice(idx, 1);
    await writePendingIndex(list);
    if (isR2Configured()) {
      try {
        await r2Delete(`lexicon/pending/${id}.json`);
      } catch {
        /* ignore */
      }
    }
    return { ok: true, message: "已拒绝" };
  }

  const content: LexiconListContent = {
    id: sub.listId,
    label: sub.label,
    icon: sub.icon,
    desc: sub.desc,
    items: sub.items,
    source: "cdn",
  };

  const index = await getLexiconIndex();
  let cat = index.categories.find((c) => c.id === sub.categoryId);
  if (!cat) {
    cat = {
      id: sub.categoryId,
      label: sub.categoryLabel || sub.categoryId,
      lists: [],
    };
    index.categories.push(cat);
  }
  const meta: LexiconListMeta = {
    id: sub.listId,
    label: sub.label,
    path: sub.path,
    icon: sub.icon,
    desc: sub.desc,
  };
  const existing = cat.lists.findIndex((l) => l.id === sub.listId);
  if (existing >= 0) cat.lists[existing] = meta;
  else cat.lists.push(meta);

  if (isR2Configured()) {
    await r2PutJson(`lexicon/lists/${sub.listId}.json`, content);
    await r2PutJson(R2_INDEX, index);
    try {
      await r2Delete(`lexicon/pending/${id}.json`);
    } catch {
      /* ignore */
    }
  } else {
    const full = path.join(SEED_DIR, "lists", `${sub.listId}.json`);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, JSON.stringify(content, null, 2), "utf8");
    await fs.writeFile(
      path.join(SEED_DIR, "index.json"),
      JSON.stringify(index, null, 2),
      "utf8"
    );
  }

  list.splice(idx, 1);
  await writePendingIndex(list);
  return { ok: true, message: "已发布到词库" };
}

async function writeIndex(index: LexiconIndex): Promise<void> {
  if (isR2Configured()) {
    await r2PutJson(R2_INDEX, index);
    return;
  }
  await fs.writeFile(
    path.join(SEED_DIR, "index.json"),
    JSON.stringify(index, null, 2),
    "utf8"
  );
}

export async function deletePublicList(
  listId: string
): Promise<{ ok: boolean; message: string }> {
  const safe = listId.replace(/^\/+/, "").replace(/\.\./g, "");
  const index = await getLexiconIndex();
  let found = false;
  for (const cat of index.categories) {
    const before = cat.lists.length;
    cat.lists = cat.lists.filter((l) => l.id !== safe);
    if (cat.lists.length !== before) found = true;
  }
  index.categories = index.categories.filter((c) => c.lists.length > 0);
  if (!found) return { ok: false, message: "找不到该列表" };
  await writeIndex(index);
  if (isR2Configured()) {
    try {
      await r2Delete(`lexicon/lists/${safe}.json`);
    } catch {
      /* ignore */
    }
  } else {
    try {
      await fs.unlink(path.join(SEED_DIR, "lists", `${safe}.json`));
    } catch {
      /* ignore */
    }
  }
  const def = await getDefaultEnabledIds();
  const next = def.filter((id) => id !== safe);
  if (next.length !== def.length) await setDefaultEnabledIds(next);
  return { ok: true, message: "已从公共词库删除" };
}

export async function setDefaultEnabledIds(ids: string[]): Promise<void> {
  const payload = { enabledListIds: ids };
  if (isR2Configured()) {
    await r2PutJson(R2_DEFAULT, payload);
    return;
  }
  await fs.writeFile(
    path.join(SEED_DIR, "default-enabled.json"),
    JSON.stringify(payload, null, 2),
    "utf8"
  );
}

export async function bootstrapLexiconToR2IfEmpty(): Promise<void> {
  if (!isR2Configured()) return;
  const existing = await r2GetJson<LexiconIndex>(R2_INDEX);
  if (existing?.categories?.length) return;
  const seed = await readSeedJson<LexiconIndex>("index.json");
  if (!seed) return;
  await r2PutJson(R2_INDEX, seed);
  const def = await readSeedJson<{ enabledListIds?: string[] }>(
    "default-enabled.json"
  );
  if (def) await r2PutJson(R2_DEFAULT, def);
  for (const cat of seed.categories) {
    for (const li of cat.lists) {
      const content = await getLexiconList(li.id);
      if (content) {
        await r2PutJson(`lexicon/lists/${li.id}.json`, content);
      }
    }
  }
}
