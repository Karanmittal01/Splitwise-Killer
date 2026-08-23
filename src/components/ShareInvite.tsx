"use client";

import { useEffect, useState } from "react";

/**
 * Getting an invite to somebody who was added by mobile number.
 *
 * There is no SMS gateway behind this on purpose: sending SMS costs money
 * everywhere, and in India it also needs DLT registration. Instead we hand the
 * invite to apps the phone already has — WhatsApp addressed straight to their
 * number, the built-in SMS composer, or the system share sheet. Free, instant,
 * and it arrives from you rather than from a shortcode nobody recognises.
 */
export function ShareInvite({
  link,
  name,
  phone,
  label = "Invite link",
}: {
  link: string;
  name: string;
  /** E.164, e.g. +919876543210. When present we can address WhatsApp directly. */
  phone?: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const message = `Hi ${name}, I'm using Splitwise Killer to keep track of what we owe each other. Open this to see your share: ${link}`;
  const digits = phone?.replace(/\D/g, "") ?? "";
  const whatsappUrl = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  const smsUrl = phone
    ? `sms:${phone}?&body=${encodeURIComponent(message)}`
    : `sms:?&body=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = document.getElementById(`invite-${link}`) as HTMLInputElement | null;
      input?.select();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function share() {
    try {
      await navigator.share({ title: "Splitwise Killer", text: message });
    } catch {
      // The person dismissed the share sheet — nothing to do.
    }
  }

  return (
    <div>
      <span className="label">{label}</span>

      <div className="flex gap-2">
        <input
          id={`invite-${link}`}
          className="field font-mono text-xs"
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" onClick={copy} className="btn btn-secondary shrink-0">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn-secondary text-sm"
          style={{ color: "#128C7E" }}
        >
          <WhatsAppMark />
          WhatsApp
        </a>
        <a href={smsUrl} className="btn btn-secondary text-sm">
          💬 Text message
        </a>
        {canShare && (
          <button type="button" onClick={share} className="btn btn-secondary text-sm">
            ↗ Share…
          </button>
        )}
      </div>

      {phone && (
        <p className="mt-2 text-xs muted">
          WhatsApp opens a chat with {phone} directly — no need to find them in your contacts.
        </p>
      )}
    </div>
  );
}

function WhatsAppMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.96L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23a8.2 8.2 0 0 1 8.23 8.24c0 4.54-3.7 8.23-8.24 8.23z" />
    </svg>
  );
}
