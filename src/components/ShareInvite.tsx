"use client";

import { useEffect, useState, useTransition } from "react";
import { resendInviteEmailAction } from "@/server/actions/invites";
import { idleState } from "@/server/actions/types";

/**
 * Getting an invite to somebody, in one compact row of icons.
 *
 * There is no SMS gateway behind this on purpose: sending SMS costs money
 * everywhere, and in India it also needs DLT registration. So WhatsApp, the SMS
 * composer and the share sheet all hand the message to an app the phone already
 * has, addressed to their number.
 *
 * Email is different: the server can already send it, so the envelope button
 * sends it outright rather than opening a draft for you to write. It only falls
 * back to a mailto: link when there is no mail server configured.
 */
export function ShareInvite({
  link,
  name,
  phone,
  email,
  compact = false,
  targetUserId,
  canSendEmail = false,
}: {
  link: string;
  name: string;
  /** E.164, e.g. +919876543210 — lets WhatsApp open their chat directly. */
  phone?: string | null;
  email?: string | null;
  /** Hide the label row when the surrounding card already explains itself. */
  compact?: boolean;
  /** Who the invite is for. Required for the server to send the email. */
  targetUserId?: string;
  /** True when this server has mail configured, so ✉ can send it directly. */
  canSendEmail?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const message = `Hi ${name}, I'm using Splitwise Killer to keep track of what we owe each other. Open this to see your share: ${link}`;
  const digits = phone?.replace(/\D/g, "") ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard blocked — fall back to prompting, which always works.
      window.prompt("Copy this invite link", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function sendEmail() {
    if (!targetUserId) return;
    setSendError(null);
    setSent(null);
    startSending(async () => {
      const payload = new FormData();
      payload.append("targetUserId", targetUserId);
      const result = await resendInviteEmailAction(idleState, payload);
      if (result.error) {
        setSendError(result.error);
        return;
      }
      setSent(result.message ?? "Invite emailed.");
    });
  }

  async function share() {
    try {
      await navigator.share({ title: "Splitwise Killer", text: message });
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {!compact && <span className="mr-1 text-xs muted">Invite:</span>}

      <IconLink
        href={
          digits
            ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
            : `https://wa.me/?text=${encodeURIComponent(message)}`
        }
        label={digits ? `WhatsApp ${phone}` : "Share on WhatsApp"}
        external
      >
        <WhatsAppMark />
      </IconLink>

      <IconLink
        href={`sms:${phone ?? ""}?&body=${encodeURIComponent(message)}`}
        label="Send as a text message"
      >
        💬
      </IconLink>

      {email &&
        (canSendEmail && targetUserId ? (
          <IconButton
            onClick={sendEmail}
            label={`Email the invite to ${email}`}
            disabled={sending}
          >
            {sending ? "…" : sent ? "✓" : "✉️"}
          </IconButton>
        ) : (
          <IconLink
            href={`mailto:${email}?subject=${encodeURIComponent(
              "Splitwise Killer",
            )}&body=${encodeURIComponent(message)}`}
            label={`Email ${email}`}
          >
            ✉️
          </IconLink>
        ))}

      {canShare && (
        <IconButton onClick={share} label="Share…">
          ↗
        </IconButton>
      )}

      <IconButton onClick={copy} label="Copy invite link">
        {copied ? "✓" : "🔗"}
      </IconButton>

      {copied && <span className="text-xs positive">Copied</span>}
      {/* role="status" so the outcome of a send is announced, not just shown —
          it is the only feedback that an email actually left. */}
      {sent && (
        <span role="status" className="text-xs positive">
          {sent}
        </span>
      )}
      {sendError && (
        <span role="status" className="text-xs text-[var(--negative)]">
          {sendError}
        </span>
      )}
    </div>
  );
}

const ICON_CLASS =
  "grid h-9 w-9 place-items-center rounded-full border border-[var(--surface-border)] bg-[var(--surface-card)] text-sm transition-colors hover:bg-[var(--surface-raised)]";

function IconLink({
  href,
  label,
  children,
  external = false,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      title={label}
      aria-label={label}
      className={ICON_CLASS}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
    >
      {children}
    </a>
  );
}

function IconButton({
  onClick,
  label,
  children,
  disabled = false,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={`${ICON_CLASS} disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

function WhatsAppMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.43 12.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
    </svg>
  );
}
