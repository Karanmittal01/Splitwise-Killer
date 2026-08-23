"use client";

import { useState } from "react";
import { CURRENCIES, currencyInfo } from "@/lib/currencies";

/**
 * A currency picker that takes almost no width.
 *
 * The closed control shows only the symbol (₹, $, €) so the amount beside it
 * gets the room it deserves on a phone. The real <select> sits invisibly on
 * top, so tapping it still opens the native picker with full names — nothing
 * is lost, it just stops eating half the row.
 */
export function CurrencySelect({
  value,
  defaultValue,
  onChange,
  name,
  id = "currency",
}: {
  value?: string;
  defaultValue?: string;
  onChange?: (code: string) => void;
  name?: string;
  id?: string;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "INR");
  const current = value ?? internal;
  const { symbol } = currencyInfo(current);

  return (
    <div>
      <label className="label" htmlFor={id}>
        Currency
      </label>
      <div className="relative focus-within:ring-3 focus-within:ring-[var(--color-mint-400)]/25 rounded-xl">
        <select
          id={id}
          name={name}
          value={value}
          defaultValue={value === undefined ? internal : undefined}
          onChange={(e) => {
            setInternal(e.target.value);
            onChange?.(e.target.value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Currency"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} {c.code} — {c.name}
            </option>
          ))}
        </select>
        <div
          className="field flex items-center justify-center gap-1 text-lg font-semibold"
          aria-hidden="true"
        >
          {symbol}
          <span className="text-[10px] muted">▾</span>
        </div>
      </div>
    </div>
  );
}
