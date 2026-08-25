/** Admin identity from Vercel env vars */

import type { AuthUser } from "@/lib/auth";

/** Comma-separated Discord user IDs */
export function getAdminUserIds(): string[] {
  return (process.env.ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Comma-separated Discord role IDs (guild roles on the user session) */
export function getAdminRoleIds(): string[] {
  return (process.env.ADMIN_ROLE_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isDiscordAdmin(userId: string, roleIds: string[] = []): boolean {
  if (!userId) return false;
  if (getAdminUserIds().includes(userId)) return true;
  const adminRoles = getAdminRoleIds();
  if (adminRoles.length && roleIds.some((r) => adminRoles.includes(r))) return true;
  return false;
}

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  if (!user?.id) return false;
  return isDiscordAdmin(user.id, Array.isArray(user.roles) ? user.roles : []);
}
