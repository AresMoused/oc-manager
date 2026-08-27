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
  filterTags?: string[];
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

function slugifyCatId(name: string): string {
  return (
    String(name || "")
      .trim()
      .replace(/[^\w\u4e00-\u9fff\-]/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || "cat"
  );
}

/** Find category by id or display name; create it if missing. */
function resolveOrCreateCategory(
  index: LexiconIndex,
  nameOrId: string,
  label?: string
): LexiconCategory {
  const raw = String(nameOrId || "").trim();
  const display = String(label || raw).trim() || raw;
  const needle = raw.toLowerCase();
  const displayNeedle = display.toLowerCase();

  const existing = index.categories.find(
    (c) =>
      c.id === raw ||
      c.id.toLowerCase() === needle ||
      c.label.toLowerCase() === needle ||
      c.label.toLowerCase() === displayNeedle
  );
  if (existing) return existing;

  const id = slugifyCatId(raw || display);
  const bySlug = index.categories.find((c) => c.id === id);
  if (bySlug) return bySlug;

  const cat: LexiconCategory = { id, label: display, lists: [] };
  index.categories.push(cat);
  return cat;
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

async function writeListContent(
  listId: string,
  content: LexiconListContent
): Promise<void> {
  const safe = listId.replace(/^\/+/, "").replace(/\.\./g, "");
  if (isR2Configured()) {
    await r2PutJson(`lexicon/lists/${safe}.json`, content);
    return;
  }
  const full = path.join(SEED_DIR, "lists", `${safe}.json`);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(content, null, 2), "utf8");
}

export async function updateListMeta(opts: {
  listId: string;
  label?: string;
  categoryId?: string;
  categoryLabel?: string;
  icon?: string;
  desc?: string;
  filterTags?: string[];
}): Promise<{ ok: boolean; message: string; index?: LexiconIndex }> {
  const safe = opts.listId.replace(/^\/+/, "").replace(/\.\./g, "");
  const index = await getLexiconIndex();
  let foundMeta: LexiconListMeta | null = null;
  let fromCat: LexiconCategory | null = null;
  for (const cat of index.categories) {
    const li = cat.lists.find((l) => l.id === safe);
    if (li) {
      foundMeta = li;
      fromCat = cat;
      break;
    }
  }
  if (!foundMeta || !fromCat) {
    return { ok: false, message: "找不到该列表" };
  }

  if (opts.label !== undefined) foundMeta.label = String(opts.label).trim() || foundMeta.label;
  if (opts.icon !== undefined) foundMeta.icon = opts.icon;
  if (opts.desc !== undefined) foundMeta.desc = opts.desc;
  if (opts.filterTags !== undefined) {
    foundMeta.filterTags = [...new Set(opts.filterTags.map((t) => String(t).trim()).filter(Boolean))];
    if (!foundMeta.filterTags.length) delete foundMeta.filterTags;
  }

  const targetName = opts.categoryId?.trim() || opts.categoryLabel?.trim();
  if (targetName) {
    const target = resolveOrCreateCategory(
      index,
      opts.categoryId?.trim() || targetName,
      opts.categoryLabel
    );
    if (target.id !== fromCat.id) {
      fromCat.lists = fromCat.lists.filter((l) => l.id !== safe);
      target.lists.push(foundMeta);
      index.categories = index.categories.filter((c) => c.lists.length > 0);
    } else if (opts.categoryLabel?.trim()) {
      fromCat.label = opts.categoryLabel.trim();
    }
  } else if (opts.categoryLabel?.trim()) {
    fromCat.label = opts.categoryLabel.trim();
  }

  await writeIndex(index);

  const content = await getLexiconList(safe);
  if (content) {
    content.label = foundMeta.label;
    if (opts.icon !== undefined) content.icon = opts.icon;
    if (opts.desc !== undefined) content.desc = opts.desc;
    content.source = "cdn";
    await writeListContent(safe, content);
  }

  return { ok: true, message: "已更新列表信息", index };
}

export async function bulkUpdateFilterTags(opts: {
  listIds: string[];
  mode: "set" | "add" | "remove" | "clear";
  tags?: string[];
}): Promise<{ ok: boolean; message: string; index?: LexiconIndex; updated: number }> {
  const ids = [...new Set((opts.listIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (!ids.length) return { ok: false, message: "未选择列表", updated: 0 };
  const incoming = [...new Set((opts.tags || []).map((t) => String(t).trim()).filter(Boolean))];
  if (opts.mode !== "clear" && !incoming.length) {
    return { ok: false, message: "请填写标签", updated: 0 };
  }
  const index = await getLexiconIndex();
  const wanted = new Set(ids);
  let updated = 0;
  for (const cat of index.categories) {
    for (const li of cat.lists) {
      if (!wanted.has(li.id)) continue;
      const cur = [...(li.filterTags || [])];
      let next: string[] = cur;
      if (opts.mode === "clear") next = [];
      else if (opts.mode === "set") next = incoming;
      else if (opts.mode === "add") next = [...new Set([...cur, ...incoming])];
      else if (opts.mode === "remove") next = cur.filter((t) => !incoming.includes(t));
      if (next.length) li.filterTags = next;
      else delete li.filterTags;
      updated += 1;
    }
  }
  if (!updated) return { ok: false, message: "找不到所选列表", updated: 0 };
  await writeIndex(index);
  const verb =
    opts.mode === "clear" ? "已清空" :
    opts.mode === "add" ? "已追加" :
    opts.mode === "remove" ? "已移除" : "已设为";
  return { ok: true, message: `${verb} ${updated} 个列表的过滤标签`, index, updated };
}

export async function updateListContent(
  listId: string,
  items: LexiconItem[],
  label?: string
): Promise<{ ok: boolean; message: string }> {
  const safe = listId.replace(/^\/+/, "").replace(/\.\./g, "");
  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, message: "内容不能为空" };
  }
  const cleaned = items
    .map((it) => ({
      name: String(it.name || "").trim(),
      tags: String(it.tags || "").trim() || String(it.name || "").trim(),
      ...(it.hex ? { hex: String(it.hex) } : {}),
      ...(it.image ? { image: String(it.image) } : {}),
    }))
    .filter((it) => it.name);
  if (!cleaned.length) return { ok: false, message: "没有有效条目" };

  const existing = await getLexiconList(safe);
  const index = await getLexiconIndex();
  let metaLabel = existing?.label || safe;
  for (const cat of index.categories) {
    const m = cat.lists.find((l) => l.id === safe);
    if (m) {
      metaLabel = m.label;
      if (label?.trim()) {
        m.label = label.trim();
        metaLabel = m.label;
      }
      break;
    }
  }
  if (label?.trim()) await writeIndex(index);

  const content: LexiconListContent = {
    id: safe,
    label: label?.trim() || metaLabel,
    icon: existing?.icon,
    desc: existing?.desc,
    items: cleaned,
    source: "cdn",
  };
  await writeListContent(safe, content);
  return { ok: true, message: "已更新列表内容" };
}

export async function reorderCategories(
  categories: LexiconCategory[]
): Promise<{ ok: boolean; message: string; index?: LexiconIndex }> {
  if (!Array.isArray(categories) || categories.length === 0) {
    return { ok: false, message: "无效的分类数据" };
  }
  const current = await getLexiconIndex();
  const known = new Map<string, LexiconListMeta>();
  for (const cat of current.categories) {
    for (const li of cat.lists) known.set(li.id, li);
  }
  const nextCats: LexiconCategory[] = [];
  const seen = new Set<string>();
  for (const cat of categories) {
    const id = String(cat.id || "").trim();
    if (!id) continue;
    const lists: LexiconListMeta[] = [];
    for (const li of cat.lists || []) {
      const lid = String(li.id || "").trim();
      if (!lid || seen.has(lid) || !known.has(lid)) continue;
      seen.add(lid);
      const base = known.get(lid)!;
      lists.push({
        ...base,
        label: li.label?.trim() || base.label,
        icon: li.icon ?? base.icon,
        desc: li.desc ?? base.desc,
      });
    }
    if (lists.length) {
      nextCats.push({
        id,
        label: String(cat.label || id).trim(),
        lists,
      });
    }
  }
  for (const cat of current.categories) {
    const orphan = cat.lists.filter((l) => !seen.has(l.id));
    if (!orphan.length) continue;
    let target = nextCats.find((c) => c.id === cat.id);
    if (!target) {
      target = { id: cat.id, label: cat.label, lists: [] };
      nextCats.push(target);
    }
    target.lists.push(...orphan);
  }
  const index: LexiconIndex = {
    ...current,
    categories: nextCats,
  };
  await writeIndex(index);
  return { ok: true, message: "已更新排序", index };
}

export async function renameCategory(
  categoryId: string,
  label: string
): Promise<{ ok: boolean; message: string; index?: LexiconIndex }> {
  const id = String(categoryId || "").trim();
  const nextLabel = String(label || "").trim();
  if (!id) return { ok: false, message: "缺少分类" };
  if (!nextLabel) return { ok: false, message: "分类名称不能为空" };
  const index = await getLexiconIndex();
  const cat = index.categories.find((c) => c.id === id);
  if (!cat) return { ok: false, message: "找不到该分类" };
  if (cat.label === nextLabel) {
    return { ok: true, message: "分类名称未变化", index };
  }
  cat.label = nextLabel;
  await writeIndex(index);
  return { ok: true, message: "已更新分类名称", index };
}

/**
 * Admin: publish a list immediately (skip pending queue).
 */
export async function publishListDirect(opts: {
  categoryId: string;
  categoryLabel?: string;
  label: string;
  items: LexiconItem[];
  icon?: string;
  desc?: string;
  listId?: string;
}): Promise<{ ok: boolean; message: string; listId?: string; index?: LexiconIndex }> {
  const categoryName = String(opts.categoryLabel || opts.categoryId || "").trim();
  if (!categoryName) return { ok: false, message: "缺少分类名称" };
  const label = String(opts.label || "").trim();
  if (!label) return { ok: false, message: "缺少列表名称" };
  const cleaned = (opts.items || [])
    .map((it) => ({
      name: String(it.name || "").trim(),
      tags: String(it.tags || "").trim() || String(it.name || "").trim(),
      ...(it.hex ? { hex: String(it.hex) } : {}),
      ...(it.image ? { image: String(it.image) } : {}),
    }))
    .filter((it) => it.name);
  if (!cleaned.length) return { ok: false, message: "词条为空" };

  const index = await getLexiconIndex();
  const cat = resolveOrCreateCategory(index, opts.categoryId || categoryName, categoryName);
  const categoryId = cat.id;

  const slug =
    String(opts.listId || label)
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fff\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "list";
  const listId = opts.listId?.includes("/")
    ? opts.listId.replace(/^\/+/, "").replace(/\.\./g, "")
    : `${categoryId}/${slug}`;

  const content: LexiconListContent = {
    id: listId,
    label,
    icon: opts.icon,
    desc: opts.desc,
    items: cleaned,
    source: "cdn",
  };

  const meta: LexiconListMeta = {
    id: listId,
    label,
    path: `lists/${listId}.json`,
    icon: opts.icon,
    desc: opts.desc,
  };
  const existing = cat.lists.findIndex((l) => l.id === listId);
  if (existing >= 0) cat.lists[existing] = meta;
  else cat.lists.push(meta);

  await writeListContent(listId, content);
  await writeIndex(index);
  return { ok: true, message: "已直接发布到公共词库", listId, index };
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
