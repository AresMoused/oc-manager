/**
 * Server-side JSON file storage (local disk).
 * Per-user app data + user index + world shares.
 */
import { promises as fs } from "fs";
import path from "path";
import type { Character } from "./types";
import type { WorldMeta } from "./worlds";
import type { WorldCatalog } from "./worldCatalog";
import type { AuthUser } from "./auth";
import { avatarUrl } from "./auth";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_DIR = path.join(DATA_DIR, "users");

export interface AppData {
  characters: Character[];
  worlds: WorldMeta[];
  catalog: WorldCatalog;
  updatedAt: string;
}

export interface UserIndexEntry {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
  discriminator: string;
  avatarUrl: string;
  lastLoginAt: string;
}

export type SharePermission = "readonly" | "editors";

export interface WorldShare {
  id: string;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl: string;
  worldId: string;
  worldName: string;
  worldColor: string;
  permission: SharePermission;
  editorIds: string[];
  sharedAt: string;
  updatedAt: string;
}

const DEFAULT: AppData = {
  characters: [],
  worlds: [],
  catalog: {},
  updatedAt: new Date(0).toISOString(),
};

async function ensureDir(dir: string = DATA_DIR) {
  await fs.mkdir(dir, { recursive: true });
}

function legacyPath() {
  return path.join(DATA_DIR, "app-data.json");
}

function userDataPath(userId: string) {
  return path.join(USERS_DIR, userId, "app-data.json");
}

function usersIndexPath() {
  return path.join(DATA_DIR, "users-index.json");
}

function sharesPath() {
  return path.join(DATA_DIR, "shares.json");
}

function normalizeAppData(parsed: Partial<AppData> | null | undefined): AppData {
  return {
    characters: Array.isArray(parsed?.characters) ? parsed!.characters! : [],
    worlds: Array.isArray(parsed?.worlds) ? parsed!.worlds! : [],
    catalog:
      parsed?.catalog && typeof parsed.catalog === "object"
        ? parsed.catalog
        : {},
    updatedAt: parsed?.updatedAt || new Date().toISOString(),
  };
}

async function readJsonFile<T>(fp: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(fp, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(fp: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(fp));
  const tmp = fp + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, fp);
}

export async function readLegacyAppData(): Promise<AppData | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(legacyPath(), "utf8");
    return normalizeAppData(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function readUserAppData(userId: string): Promise<AppData> {
  await ensureDir(path.join(USERS_DIR, userId));
  const fp = userDataPath(userId);
  try {
    const raw = await fs.readFile(fp, "utf8");
    return normalizeAppData(JSON.parse(raw));
  } catch {
    const legacy = await readLegacyAppData();
    if (legacy && (legacy.characters.length || legacy.worlds.length)) {
      await writeUserAppData(userId, legacy);
      return legacy;
    }
    return { ...DEFAULT, updatedAt: new Date().toISOString() };
  }
}

export async function writeUserAppData(
  userId: string,
  data: AppData
): Promise<AppData> {
  const next: AppData = {
    characters: data.characters || [],
    worlds: data.worlds || [],
    catalog: data.catalog || {},
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(userDataPath(userId), next);
  return next;
}

export async function patchUserAppData(
  userId: string,
  partial: Partial<Pick<AppData, "characters" | "worlds" | "catalog">>
): Promise<AppData> {
  const current = await readUserAppData(userId);
  return writeUserAppData(userId, {
    characters:
      "characters" in partial && Array.isArray(partial.characters)
        ? partial.characters
        : current.characters,
    worlds:
      "worlds" in partial && Array.isArray(partial.worlds)
        ? partial.worlds
        : current.worlds,
    catalog:
      "catalog" in partial &&
      partial.catalog &&
      typeof partial.catalog === "object"
        ? partial.catalog
        : current.catalog,
    updatedAt: new Date().toISOString(),
  });
}

export async function readAppData(): Promise<AppData> {
  return (await readLegacyAppData()) || { ...DEFAULT };
}

export async function writeAppData(data: AppData): Promise<AppData> {
  await writeJsonFile(legacyPath(), {
    ...data,
    updatedAt: new Date().toISOString(),
  });
  return { ...data, updatedAt: new Date().toISOString() };
}

export async function patchAppData(
  partial: Partial<Pick<AppData, "characters" | "worlds" | "catalog">>
): Promise<AppData> {
  const current = await readAppData();
  return writeAppData({
    characters:
      "characters" in partial && Array.isArray(partial.characters)
        ? partial.characters
        : current.characters,
    worlds:
      "worlds" in partial && Array.isArray(partial.worlds)
        ? partial.worlds
        : current.worlds,
    catalog:
      "catalog" in partial &&
      partial.catalog &&
      typeof partial.catalog === "object"
        ? partial.catalog
        : current.catalog,
    updatedAt: new Date().toISOString(),
  });
}

export async function listUsers(): Promise<UserIndexEntry[]> {
  await ensureDir();
  const list = await readJsonFile<UserIndexEntry[]>(usersIndexPath(), []);
  return Array.isArray(list) ? list : [];
}

export async function upsertUserIndex(user: AuthUser): Promise<UserIndexEntry> {
  const list = await listUsers();
  const entry: UserIndexEntry = {
    id: user.id,
    username: user.username,
    globalName: user.globalName ?? null,
    avatar: user.avatar,
    discriminator: user.discriminator || "0",
    avatarUrl: avatarUrl(user),
    lastLoginAt: new Date().toISOString(),
  };
  const idx = list.findIndex((u) => u.id === user.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);
  list.sort((a, b) =>
    (a.globalName || a.username).localeCompare(b.globalName || b.username, "zh")
  );
  await writeJsonFile(usersIndexPath(), list);
  return entry;
}

export async function listShares(): Promise<WorldShare[]> {
  await ensureDir();
  const list = await readJsonFile<WorldShare[]>(sharesPath(), []);
  return Array.isArray(list) ? list : [];
}

async function saveShares(list: WorldShare[]) {
  await writeJsonFile(sharesPath(), list);
}

export async function getShare(id: string): Promise<WorldShare | null> {
  const list = await listShares();
  return list.find((s) => s.id === id) || null;
}

export function canViewShare(_share: WorldShare, _userId: string): boolean {
  return true;
}

export function canEditShare(share: WorldShare, userId: string): boolean {
  if (share.ownerId === userId) return true;
  if (share.permission === "readonly") return false;
  return share.editorIds.includes(userId);
}

export async function createShare(input: {
  owner: AuthUser;
  world: WorldMeta;
  permission: SharePermission;
  editorIds: string[];
}): Promise<WorldShare> {
  const list = await listShares();
  const existing = list.find(
    (s) => s.ownerId === input.owner.id && s.worldId === input.world.id
  );
  const now = new Date().toISOString();
  if (existing) {
    existing.permission = input.permission;
    existing.editorIds = [...new Set(input.editorIds.filter(Boolean))];
    existing.worldName = input.world.name;
    existing.worldColor = input.world.color;
    existing.ownerName = input.owner.globalName || input.owner.username;
    existing.ownerAvatarUrl = avatarUrl(input.owner);
    existing.updatedAt = now;
    await saveShares(list);
    return existing;
  }
  const share: WorldShare = {
    id: crypto.randomUUID(),
    ownerId: input.owner.id,
    ownerName: input.owner.globalName || input.owner.username,
    ownerAvatarUrl: avatarUrl(input.owner),
    worldId: input.world.id,
    worldName: input.world.name,
    worldColor: input.world.color,
    permission: input.permission,
    editorIds: [...new Set(input.editorIds.filter(Boolean))],
    sharedAt: now,
    updatedAt: now,
  };
  list.push(share);
  await saveShares(list);
  return share;
}

export async function updateShare(
  id: string,
  patch: Partial<
    Pick<WorldShare, "permission" | "editorIds" | "worldName" | "worldColor">
  >
): Promise<WorldShare | null> {
  const list = await listShares();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  list[idx] = {
    ...list[idx],
    ...patch,
    editorIds: patch.editorIds
      ? [...new Set(patch.editorIds.filter(Boolean))]
      : list[idx].editorIds,
    updatedAt: new Date().toISOString(),
  };
  await saveShares(list);
  return list[idx];
}

export async function deleteShare(id: string): Promise<boolean> {
  const list = await listShares();
  const next = list.filter((s) => s.id !== id);
  if (next.length === list.length) return false;
  await saveShares(next);
  return true;
}

export async function deleteShareByWorld(
  ownerId: string,
  worldId: string
): Promise<boolean> {
  const list = await listShares();
  const next = list.filter(
    (s) => !(s.ownerId === ownerId && s.worldId === worldId)
  );
  if (next.length === list.length) return false;
  await saveShares(next);
  return true;
}

export async function findShareByWorld(
  ownerId: string,
  worldId: string
): Promise<WorldShare | null> {
  const list = await listShares();
  return list.find((s) => s.ownerId === ownerId && s.worldId === worldId) || null;
}

export async function readShareContent(share: WorldShare): Promise<{
  world: WorldMeta | null;
  characters: Character[];
}> {
  const data = await readUserAppData(share.ownerId);
  const world =
    data.worlds.find((w) => w.id === share.worldId) ||
    data.worlds.find((w) => w.name === share.worldName) ||
    null;
  const worldName = world?.name || share.worldName;
  const characters = data.characters.filter(
    (c) => c.world?.trim() === worldName
  );
  return { world, characters };
}

export async function writeShareCharacters(
  share: WorldShare,
  characters: Character[]
): Promise<{ world: WorldMeta | null; characters: Character[] }> {
  const data = await readUserAppData(share.ownerId);
  const world =
    data.worlds.find((w) => w.id === share.worldId) ||
    data.worlds.find((w) => w.name === share.worldName);
  const worldName = world?.name || share.worldName;
  const others = data.characters.filter((c) => c.world?.trim() !== worldName);
  const normalized = characters.map((c) => ({
    ...c,
    world: worldName,
  }));
  await writeUserAppData(share.ownerId, {
    ...data,
    characters: [...others, ...normalized],
  });
  return { world: world || null, characters: normalized };
}
