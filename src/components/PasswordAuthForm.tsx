"use client";

import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "./form";
import { signInAction, signUpAction } from "@/server/actions/auth";
import { idleState } from "@/server/actions/types";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";

type Mode = "signin" | "signup";

/**
 * Email and password, for people who would rather not use Google.
 *
 * Signing in and signing up are the same small form with one extra field, so
 * they live behind a two-way switch rather than on two separate pages — there's
 * nothing more annoying than filling in a form only to find it was the wrong
 * one.
 */
export function PasswordAuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signIn] = useActionState(signInAction, idleState);
  const [signUpState, signUp] = useActionState(signUpAction, idleState);

  const signingUp = mode === "signup";
  const state = signingUp ? signUpState : signInState;

  return (
    <div>
      <div
        role="tablist"
        aria-label="How to sign in"
        className="flex gap-1 rounded-2xl bg-[var(--surface-raised)] p-1"
      >
        <Tab active={!signingUp} onClick={() => setMode("signin")}>
          Sign in
        </Tab>
        <Tab active={signingUp} onClick={() => setMode("signup")}>
          Create account
        </Tab>
      </div>

      {/* Keyed so switching tabs starts from empty fields rather than half of
          the other form's answers. */}
      <form key={mode} action={signingUp ? signUp : signIn} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />

        {signingUp && (
          <div>
            <label className="label" htmlFor="pw-name">
              Your name
            </label>
            <input
              id="pw-name"
              name="name"
              className="field"
              autoComplete="name"
              maxLength={60}
              placeholder="Karan Mittal"
              required
            />
          </div>
        )}

        <div>
          <label className="label" htmlFor="pw-email">
            Email
          </label>
          <input
            id="pw-email"
            name="email"
            type="email"
            className="field"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <PasswordField signingUp={signingUp} />

        <FormMessage state={state} />

        <SubmitButton
          className="btn btn-primary w-full py-3"
          pendingLabel={signingUp ? "Creating your account…" : "Signing in…"}
        >
          {signingUp ? "Create account" : "Sign in"}
        </SubmitButton>
      </form>
    </div>
  );
}

function PasswordField({ signingUp }: { signingUp: boolean }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="label" htmlFor="pw-password">
        Password
      </label>
      <div className="relative">
        <input
          id="pw-password"
          name="password"
          type={visible ? "text" : "password"}
          className="field pr-16"
          autoComplete={signingUp ? "new-password" : "current-password"}
          minLength={signingUp ? MIN_PASSWORD_LENGTH : undefined}
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
      {signingUp && (
        <p className="mt-1.5 text-xs muted">
          At least {MIN_PASSWORD_LENGTH} characters. A few ordinary words beat one clever word.
        </p>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
        active
          ? "bg-[var(--surface-card)] text-[var(--text-strong)] shadow-sm"
          : "muted hover:text-[var(--text-strong)]"
      }`}
    >
      {children}
    </button>
  );
}
