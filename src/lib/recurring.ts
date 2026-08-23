import type { Recurrence } from "@/generated/prisma/enums";

/** Next due date for a recurrence, preserving the day-of-month where possible. */
export function advance(date: Date, recurrence: Recurrence): Date | null {
  const next = new Date(date);
  switch (recurrence) {
    case "WEEKLY":
      next.setDate(next.getDate() + 7);
      return next;
    case "FORTNIGHTLY":
      next.setDate(next.getDate() + 14);
      return next;
    case "MONTHLY": {
      const day = next.getDate();
      next.setDate(1);
      next.setMonth(next.getMonth() + 1);
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, lastDay));
      return next;
    }
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      return null;
  }
}

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  NONE: "Does not repeat",
  WEEKLY: "Every week",
  FORTNIGHTLY: "Every 2 weeks",
  MONTHLY: "Every month",
  YEARLY: "Every year",
};
