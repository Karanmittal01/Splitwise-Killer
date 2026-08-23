import { parseMoneyToCents, splitByWeights, splitEvenly } from "./money";
import type { SplitMethod } from "@/generated/prisma/enums";

/**
 * Interpret one row of the split editor. The form and the server action both
 * call this, so the live preview can never disagree with what gets saved.
 *
 * An empty box means "nothing" everywhere except shares, where the natural
 * default is one share each.
 */
export function participantValue(
  method: SplitMethod,
  raw: string | undefined | null,
  currency: string,
): number {
  const text = (raw ?? "").trim();

  if (method === "EQUAL") return 0;
  if (method === "SHARES") return text === "" ? 1 : Number(text);
  if (method === "PERCENT") return text === "" ? 0 : Math.round(Number(text) * 100);
  return text === "" ? 0 : parseMoneyToCents(text, currency);
}

export type Participant = {
  userId: string;
  /**
   * Meaning depends on the split method:
   *  EQUAL       — ignored (everyone listed is included)
   *  EXACT       — the exact amount owed, in cents
   *  PERCENT     — percentage in basis points (25.5% -> 2550)
   *  SHARES      — number of shares (any positive number)
   *  ADJUSTMENT  — extra amount in cents this person owes on top of an equal split
   */
  value?: number;
};

export class SplitError extends Error {}

/**
 * Turn a split definition into the exact cents each participant owes.
 * The returned amounts always sum to `totalCents`.
 */
export function computeOwed(
  method: SplitMethod,
  totalCents: number,
  participants: Participant[],
): { userId: string; owedCents: number }[] {
  if (participants.length === 0) {
    throw new SplitError("Pick at least one person to split this with.");
  }

  const ids = participants.map((p) => p.userId);
  if (new Set(ids).size !== ids.length) {
    throw new SplitError("The same person was added twice.");
  }

  let owed: number[];

  switch (method) {
    case "EQUAL": {
      owed = splitEvenly(totalCents, participants.length);
      break;
    }

    case "EXACT": {
      owed = participants.map((p) => Math.round(p.value ?? 0));
      const sum = owed.reduce((a, b) => a + b, 0);
      if (sum !== totalCents) {
        throw new SplitError(
          `The amounts entered must add up to the total. They are off by ${((totalCents - sum) / 100).toFixed(2)}.`,
        );
      }
      break;
    }

    case "PERCENT": {
      const points = participants.map((p) => Math.round(p.value ?? 0));
      if (points.some((v) => v < 0)) throw new SplitError("Percentages cannot be negative.");
      const sum = points.reduce((a, b) => a + b, 0);
      if (sum !== 10000) {
        throw new SplitError(
          `Percentages must add up to 100% (currently ${(sum / 100).toFixed(2)}%).`,
        );
      }
      owed = splitByWeights(totalCents, points);
      break;
    }

    case "SHARES": {
      const shares = participants.map((p) => Math.max(0, Math.round(p.value ?? 0)));
      if (shares.reduce((a, b) => a + b, 0) <= 0) {
        throw new SplitError("Give at least one person a share.");
      }
      owed = splitByWeights(totalCents, shares);
      break;
    }

    case "ADJUSTMENT": {
      const adjustments = participants.map((p) => Math.round(p.value ?? 0));
      const adjustmentTotal = adjustments.reduce((a, b) => a + b, 0);
      const remainder = totalCents - adjustmentTotal;
      if (remainder < 0) {
        throw new SplitError("The adjustments add up to more than the total amount.");
      }
      const base = splitEvenly(remainder, participants.length);
      owed = base.map((b, i) => b + adjustments[i]);
      break;
    }

    default:
      throw new SplitError("Unknown split method.");
  }

  if (owed.some((v) => v < 0)) {
    throw new SplitError("A split can't leave somebody owing a negative amount.");
  }

  return participants.map((p, i) => ({ userId: p.userId, owedCents: owed[i] }));
}

export function validatePayers(
  payers: { userId: string; paidCents: number }[],
  totalCents: number,
): void {
  if (payers.length === 0) throw new SplitError("Somebody has to have paid for this.");
  if (payers.some((p) => p.paidCents < 0)) {
    throw new SplitError("Paid amounts cannot be negative.");
  }
  const sum = payers.reduce((a, p) => a + p.paidCents, 0);
  if (sum !== totalCents) {
    throw new SplitError(
      `The paid amounts must add up to the total. They are off by ${((totalCents - sum) / 100).toFixed(2)}.`,
    );
  }
}

/** Merge payer and ower rows into the single ExpenseShare shape we persist. */
export function buildShares(
  payers: { userId: string; paidCents: number }[],
  owers: { userId: string; owedCents: number }[],
): { userId: string; paidCents: number; owedCents: number }[] {
  const byUser = new Map<string, { userId: string; paidCents: number; owedCents: number }>();
  for (const p of payers) {
    byUser.set(p.userId, { userId: p.userId, paidCents: p.paidCents, owedCents: 0 });
  }
  for (const o of owers) {
    const existing = byUser.get(o.userId);
    if (existing) existing.owedCents += o.owedCents;
    else byUser.set(o.userId, { userId: o.userId, paidCents: 0, owedCents: o.owedCents });
  }
  return [...byUser.values()].filter((s) => s.paidCents !== 0 || s.owedCents !== 0);
}
