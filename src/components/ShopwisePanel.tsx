"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatRupees, PHASE_LABELS, expectedChargeCents } from "@/lib/tools";

type Job = {
  id: string;
  mode: string;
  status: string;
  phase: string | null;
  faceValueCents: number;
  totalCents: number | null;
  feeCents: number | null;
  orderRef: string | null;
  error: string | null;
  otpPurpose: string | null;
  otpRequestedAt: string | null;
  otpPending: boolean;
  createdAt: string;
  finishedAt: string | null;
};

type Feed = {
  jobs: Job[];
  eligibility: { allowed: boolean; reason: string; done: number };
  totalRuns: number;
};

const ACTIVE = new Set(["QUEUED", "RUNNING", "AWAITING_OTP"]);
const isActive = (job: Job | undefined) => Boolean(job && ACTIVE.has(job.status));

/**
 * The Tools panel for the gift card autobuy.
 *
 * Everything real happens on the worker; this is a remote control. It polls
 * rather than holding a socket open, because the page is usually opened on a
 * phone that will sleep, lose Wi-Fi and come back — and a poll just resumes,
 * where a dropped socket needs reconnection logic that earns nothing here.
 */
export function ShopwisePanel() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const otpInput = useRef<HTMLInputElement>(null);

  const current = feed?.jobs[0];
  const active = isActive(current);
  const awaiting = current?.status === "AWAITING_OTP";

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/tools/shopwise/jobs", { cache: "no-store" });
      if (!response.ok) throw new Error(await response.text());
      setFeed(await response.json());
    } catch {
      // A failed poll is not worth showing: the next one is two seconds away.
    }
  }, []);

  // Poll quickly while something is running, slowly when idle.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      await refresh();
      if (cancelled) return;
      timer = setTimeout(tick, isActive(feed?.jobs[0]) ? 2000 : 15000);
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `feed` is read inside the timeout to pick the interval; re-running the
    // effect on every poll would restart the loop, so the cadence is chosen from
    // the value captured at schedule time instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  useEffect(() => {
    if (awaiting) otpInput.current?.focus();
  }, [awaiting]);

  const post = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error((await response.text()) || "Something went wrong.");
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const start = (mode: "dry" | "live") => post("/api/tools/shopwise/jobs", { mode });

  const sendOtp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current) return;
    if (await post(`/api/tools/shopwise/jobs/${current.id}/otp`, { code: otp })) setOtp("");
  };

  const expected = expectedChargeCents();

  if (!feed) {
    return <p className="card p-4 text-sm muted">Loading…</p>;
  }

  return (
    <div className="flex max-w-xl flex-col gap-4">
      {/* ----------------------------------------------------------------- */}
      <section className="card p-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Amazon Pay gift card</h2>
          <span className="text-sm muted">
            {feed.eligibility.done} of {feed.totalRuns} done
          </span>
        </div>

        <dl className="mb-4 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="muted">Gift card value</dt>
            <dd>{formatRupees(expected.faceValueCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="muted">Convenience fee + GST</dt>
            <dd>{formatRupees(expected.feeCents)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>You will be charged</dt>
            <dd>{formatRupees(expected.totalCents)}</dd>
          </div>
        </dl>

        {active ? (
          <ActiveRun job={current!} onCancel={() => post(`/api/tools/shopwise/jobs/${current!.id}/cancel`)} busy={busy} />
        ) : (
          <div className="flex flex-col gap-2">
            <button
              className="btn btn-primary w-full"
              disabled={busy || !feed.eligibility.allowed}
              onClick={() => start("live")}
            >
              Buy {formatRupees(expected.faceValueCents)} gift card
            </button>
            <button className="btn w-full" disabled={busy} onClick={() => start("dry")}>
              Test run — stops before paying
            </button>
            {!feed.eligibility.allowed && (
              <p className="text-center text-xs muted">{feed.eligibility.reason}</p>
            )}
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-xl bg-[var(--color-coral-500)]/10 p-3 text-sm text-[var(--color-coral-500)]">
            {error}
          </p>
        )}
      </section>

      {/* ----------------------------------------------------------------- */}
      {awaiting && (
        <section className="card border-[var(--brand)] p-4">
          <h2 className="mb-1 font-semibold">Enter the OTP</h2>
          <p className="mb-3 text-sm muted">{current?.otpPurpose ?? "Waiting for a code."}</p>
          <form onSubmit={sendOtp} className="flex gap-2">
            <input
              ref={otpInput}
              className="field flex-1 text-center text-2xl tracking-[0.4em]"
              value={otp}
              onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{4,8}"
              placeholder="······"
              required
            />
            <button className="btn btn-primary" disabled={busy || otp.length < 4}>
              Send
            </button>
          </form>
        </section>
      )}

      {/* ----------------------------------------------------------------- */}
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">History</h2>
        {feed.jobs.length === 0 ? (
          <p className="text-sm muted">Nothing yet. Start with a test run.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {feed.jobs.map((job) => (
              <li key={job.id} className="flex items-start justify-between gap-3 border-b border-[var(--surface-border)] pb-2 last:border-0">
                <span className="min-w-0">
                  <span className="block">
                    <StatusPill status={job.status} /> {job.mode === "dry" ? "Test run" : "Purchase"}
                  </span>
                  <span className="block truncate text-xs muted">
                    {new Date(job.createdAt).toLocaleString("en-IN")}
                    {job.orderRef ? ` · ${job.orderRef}` : ""}
                  </span>
                  {job.error && <span className="block text-xs text-[var(--color-coral-500)]">{job.error}</span>}
                </span>
                <span className="shrink-0 tabular-nums">{formatRupees(job.totalCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActiveRun({ job, onCancel, busy }: { job: Job; onCancel: () => void; busy: boolean }) {
  const label =
    job.status === "QUEUED"
      ? "Waiting for the worker to pick this up"
      : job.status === "AWAITING_OTP"
        ? "Waiting for your OTP"
        : (job.phase && PHASE_LABELS[job.phase]) || "Working";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl bg-[var(--surface-raised)] p-3">
        <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--brand)]" />
        <span className="text-sm">
          {label}
          {job.totalCents ? ` · ${formatRupees(job.totalCents)}` : ""}
        </span>
      </div>
      <button className="btn w-full" onClick={onCancel} disabled={busy}>
        Cancel
      </button>
    </div>
  );
}

const PILL: Record<string, { label: string; className: string }> = {
  SUCCEEDED: { label: "Bought", className: "bg-[var(--color-mint-600)]/15 text-[var(--color-mint-600)]" },
  DRY_RUN: { label: "Test", className: "bg-[var(--surface-raised)] muted" },
  FAILED: { label: "Failed", className: "bg-[var(--color-coral-500)]/15 text-[var(--color-coral-500)]" },
  CANCELLED: { label: "Cancelled", className: "bg-[var(--surface-raised)] muted" },
  QUEUED: { label: "Queued", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  RUNNING: { label: "Running", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
  AWAITING_OTP: { label: "Needs OTP", className: "bg-[var(--brand-soft)] text-[var(--brand)]" },
};

function StatusPill({ status }: { status: string }) {
  const pill = PILL[status] ?? { label: status, className: "bg-[var(--surface-raised)] muted" };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.className}`}>
      {pill.label}
    </span>
  );
}
