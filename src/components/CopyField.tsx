"use client";

import { useState } from "react";

/** A read-only link with a one-tap copy button — how invites get shared. */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard blocked (insecure origin / permissions) — fall back to select.
      const input = document.getElementById(`copy-${label ?? "link"}`) as HTMLInputElement | null;
      input?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex gap-2">
        <input
          id={`copy-${label ?? "link"}`}
          className="field font-mono text-xs"
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" onClick={copy} className="btn btn-secondary">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
