"use client";

import { useRef, useState, useTransition } from "react";
import { importContactsAction, type ImportCandidate } from "@/server/actions/friends";
import { parseVCards } from "@/lib/vcard";

type Row = { key: string; name: string; handle: string; selected: boolean };

/**
 * Pull people in from the phone rather than typing addresses by hand.
 *
 * Two routes, because no single one works everywhere: Chrome on Android has
 * the Contact Picker API, which never uploads the address book — the person
 * chooses individual contacts in a native sheet. Everywhere else, exporting a
 * .vcf and reading it in the browser does the same job. Either way the parsing
 * happens on the device and only the people ticked here are sent.
 */
export function ImportContacts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickerSupported =
    typeof navigator !== "undefined" &&
    "contacts" in navigator &&
    typeof (navigator as Navigator & { contacts?: { select?: unknown } }).contacts?.select ===
      "function";

  function addRows(incoming: { name: string; handles: string[] }[]) {
    const next: Row[] = [];
    for (const contact of incoming) {
      for (const handle of contact.handles) {
        const clean = handle.trim();
        if (!clean) continue;
        const key = `${contact.name}|${clean}`;
        if (next.some((row) => row.key === key)) continue;
        next.push({ key, name: contact.name, handle: clean, selected: true });
      }
    }
    if (next.length === 0) {
      setError("No email addresses or phone numbers were found in that.");
      return;
    }
    setError(null);
    setMessage(null);
    setRows(next);
  }

  async function pickFromPhone() {
    try {
      const api = (
        navigator as Navigator & {
          contacts: {
            select: (
              props: string[],
              options?: { multiple?: boolean },
            ) => Promise<{ name?: string[]; email?: string[]; tel?: string[] }[]>;
          };
        }
      ).contacts;

      const picked = await api.select(["name", "email", "tel"], { multiple: true });
      addRows(
        picked.map((contact) => ({
          name: contact.name?.[0] ?? "",
          handles: [...(contact.email ?? []), ...(contact.tel ?? [])],
        })),
      );
    } catch {
      setError("Your phone didn't share any contacts.");
    }
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = parseVCards(await file.text());
      addRows(parsed.map((c) => ({ name: c.name, handles: [...c.emails, ...c.phones] })));
    } catch {
      setError("That file couldn't be read. It should be a .vcf contacts export.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function submit() {
    const chosen: ImportCandidate[] = rows
      .filter((row) => row.selected)
      .map((row) => ({ name: row.name, handle: row.handle }));
    if (chosen.length === 0) return;

    startTransition(async () => {
      const result = await importContactsAction(chosen);
      const parts: string[] = [];
      if (result.added) parts.push(`${result.added} added`);
      if (result.existing) parts.push(`${result.existing} already on your list`);
      if (result.failed.length) parts.push(`${result.failed.length} skipped`);
      setMessage(parts.join(" · ") || "Nothing to add.");
      setRows([]);
    });
  }

  const selectedCount = rows.filter((row) => row.selected).length;

  return (
    <div className="card p-4">
      <h2 className="mb-1 font-semibold">Import from your contacts</h2>
      <p className="mb-3 text-xs muted">
        Nothing is uploaded until you tick the people you want.
      </p>

      <div className="flex flex-wrap gap-2">
        {pickerSupported && (
          <button type="button" onClick={pickFromPhone} className="btn btn-secondary text-sm">
            📇 Choose from phone
          </button>
        )}
        <label htmlFor="vcf-input" className="btn btn-secondary cursor-pointer text-sm">
          ⬆ Upload contacts file
        </label>
        <input
          ref={fileRef}
          id="vcf-input"
          type="file"
          accept=".vcf,text/vcard,text/x-vcard"
          onChange={onFile}
          className="hidden"
        />
      </div>

      {!pickerSupported && (
        <p className="mt-2 text-xs muted">
          On iPhone: Contacts → select a contact → Share Contact → Save to Files, then upload it
          here. Android exports the whole book from Contacts → Settings → Export.
        </p>
      )}

      {error && <p className="mt-3 text-sm text-[var(--negative)]">{error}</p>}
      {message && <p className="mt-3 text-sm positive">{message}</p>}

      {rows.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm muted">
              {selectedCount} of {rows.length} selected
            </p>
            <button
              type="button"
              className="text-sm text-[var(--brand)] hover:underline"
              onClick={() =>
                setRows((current) => {
                  const turnOn = current.some((row) => !row.selected);
                  return current.map((row) => ({ ...row, selected: turnOn }));
                })
              }
            >
              Toggle all
            </button>
          </div>

          <div className="divide-row max-h-72 overflow-y-auto rounded-xl border border-[var(--surface-border)]">
            {rows.map((row) => (
              <label
                key={row.key}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--surface-raised)]"
              >
                <input
                  type="checkbox"
                  checked={row.selected}
                  onChange={() =>
                    setRows((current) =>
                      current.map((item) =>
                        item.key === row.key ? { ...item, selected: !item.selected } : item,
                      ),
                    )
                  }
                  className="h-4 w-4 shrink-0 accent-[var(--color-mint-600)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{row.name || row.handle}</span>
                  <span className="block truncate text-xs muted">{row.handle}</span>
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={pending || selectedCount === 0}
            className="btn btn-primary mt-3 w-full"
          >
            {pending ? "Adding…" : `Add ${selectedCount} ${selectedCount === 1 ? "person" : "people"}`}
          </button>
        </div>
      )}
    </div>
  );
}
