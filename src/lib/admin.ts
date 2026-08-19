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

export function isAdminUser(user: AuthUser | null | undefined): boolean {
  if (!user?.id) return false;
  const ids = getAdminUserIds();
  if (ids.includes(user.id)) return true;
  const roleIds = getAdminRoleIds();
  if (roleIds.length && Array.isArray(user.roles)) {
    if (user.roles.some((r) => roleIds.includes(r))) return true;
  }
  return false;
}
