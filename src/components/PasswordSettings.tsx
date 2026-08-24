"use client";

import { useState } from "react";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./form";
import { setPasswordAction } from "@/server/actions/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

/**
 * Set a password, or change the one you have.
 *
 * Someone who joined through Google has no password yet, so the card stays
 * folded away behind a single button until they ask for it — settings pages get
 * long, and a form nobody is looking for shouldn't take up room.
 */
export function PasswordSettings({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="card p-4">
      <h2 className="mb-1 font-semibold">Password</h2>
      <p className="mb-3 text-sm muted">
        {hasPassword
          ? "You can sign in with your email and password, or with Google."
          : "You sign in with Google. Add a password and you'll be able to sign in with your email too — useful on a phone that isn't signed into your Google account."}
      </p>

      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-secondary">
          {hasPassword ? "Change password" : "Set a password"}
        </button>
      ) : (
        <ActionForm action={setPasswordAction} className="flex flex-col gap-3">
          {hasPassword && (
            <Field
              id="currentPassword"
              name="currentPassword"
              label="Current password"
              autoComplete="current-password"
            />
          )}

          <Field
            id="password"
            name="password"
            label={hasPassword ? "New password" : "Password"}
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          />

          <Field
            id="confirmPassword"
            name="confirmPassword"
            label="Repeat it"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
          />

          <div className="flex gap-2">
            <SubmitButton pendingLabel="Saving…">
              {hasPassword ? "Change password" : "Set password"}
            </SubmitButton>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </ActionForm>
      )}
    </section>
  );
}

function Field({
  id,
  name,
  label,
  autoComplete,
  minLength,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          className="field pr-16"
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-xs font-semibold muted hover:text-[var(--text-strong)]"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {hint && <p className="mt-1.5 text-xs muted">{hint}</p>}
    </div>
  );
}
