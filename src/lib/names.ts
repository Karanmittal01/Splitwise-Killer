/**
 * Pure display helpers — safe to import from client components (no database,
 * no auth), which is why they live outside session.ts.
 */

export function displayName(
  user: { name?: string | null; email?: string | null; phone?: string | null },
  selfId?: string,
  userId?: string,
): string {
  if (selfId && userId && selfId === userId) return "You";
  return user.name?.trim() || user.email?.split("@")[0] || user.phone || "Someone";
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
