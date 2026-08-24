/**
 * Totals for personal notes.
 *
 * Deliberately its own module, with no database and no imports: these numbers
 * are shown next to real balances and must never be mistaken for them. Nothing
 * here is ever read by the balance engine — see `balances.ts`, which does not
 * know this table exists.
 */

export type NoteDirection = "GAVE" | "RECEIVED" | "SPENT";

export type NoteLike = {
  direction: NoteDirection;
  amountCents: number;
  currency: string;
};

export type NoteTotals = {
  currency: string;
  gave: number;
  received: number;
  /** Money that went nowhere in particular — never part of `net`. */
  spent: number;
  /**
   * `gave − received`: how much more has gone out than has come back.
   *
   * Positive means you're down on the exchange. It is not a debt and nobody is
   * expected to settle it, which is why it is called net rather than balance.
   */
  net: number;
};

/**
 * Totals per currency, busiest currency first.
 *
 * Currencies are never mixed — the app has no exchange rates anywhere, and
 * inventing one here would be the first place a wrong number crept in.
 */
export function summariseNotes(notes: readonly NoteLike[]): NoteTotals[] {
  const byCurrency = new Map<string, NoteTotals>();

  for (const note of notes) {
    const row = byCurrency.get(note.currency) ?? {
      currency: note.currency,
      gave: 0,
      received: 0,
      spent: 0,
      net: 0,
    };

    if (note.direction === "GAVE") row.gave += note.amountCents;
    else if (note.direction === "RECEIVED") row.received += note.amountCents;
    else row.spent += note.amountCents;

    row.net = row.gave - row.received;
    byCurrency.set(note.currency, row);
  }

  // Busiest first, then alphabetically, so the order never wobbles between
  // two currencies that happen to see the same amount of use.
  return [...byCurrency.values()].sort(
    (a, b) => turnover(b) - turnover(a) || a.currency.localeCompare(b.currency),
  );
}

/**
 * Split notes into one bundle per person, keeping the order they arrived in —
 * callers hand these over newest-first, so the person you dealt with most
 * recently ends up at the top.
 *
 * Notes that name nobody are left out; they belong to the running total at the
 * top of the page, not to anybody's section.
 */
export function groupNotesByPerson<T extends NoteLike & { aboutUserId: string | null }>(
  notes: readonly T[],
): { aboutUserId: string; notes: T[]; totals: NoteTotals[] }[] {
  const byPerson = new Map<string, T[]>();

  for (const note of notes) {
    if (!note.aboutUserId) continue;
    const bucket = byPerson.get(note.aboutUserId);
    if (bucket) bucket.push(note);
    else byPerson.set(note.aboutUserId, [note]);
  }

  return [...byPerson.entries()].map(([aboutUserId, group]) => ({
    aboutUserId,
    notes: group,
    totals: summariseNotes(group),
  }));
}

function turnover(row: NoteTotals): number {
  return row.gave + row.received + row.spent;
}
