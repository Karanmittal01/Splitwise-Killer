import { prisma } from "./db";
import { appUrl, inviteLink, verifyLink } from "./people";

/**
 * Optional email delivery.
 *
 * The app is fully usable without it — every invite also produces a link you
 * can copy and send over WhatsApp/SMS yourself, which is what keeps the whole
 * thing free. If RESEND_API_KEY and RESEND_FROM are set we additionally send a
 * proper email. No SDK needed; it is one HTTPS call.
 */
export const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

async function send(to: string, subject: string, html: string): Promise<boolean> {
  if (!emailConfigured) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to, subject, html }),
    });
    if (!response.ok) {
      // Surface the reason in the server logs — a rejected send is almost
      // always an unverified sending domain or a bad API key, and silence
      // makes that impossible to diagnose.
      console.error(
        `Invite email to ${to} was rejected (${response.status}): ${await response.text()}`,
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("Invite email could not be sent:", error);
    return false;
  }
}

function shell(body: string): string {
  return `<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f8f7;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e6ebe9">
    <div style="font-size:20px;font-weight:700;color:#12b886;margin-bottom:16px">Splitwise Killer</div>
    ${body}
    <p style="color:#8a9a94;font-size:12px;margin-top:24px">Sent by Splitwise Killer · ${appUrl()}</p>
  </div>
</div>`;
}

export async function sendInviteEmail(params: {
  to: string;
  token: string;
  inviterId: string;
  groupId?: string | null;
}): Promise<boolean> {
  if (!emailConfigured) return false;

  const [inviter, group] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.inviterId }, select: { name: true, email: true } }),
    params.groupId
      ? prisma.group.findUnique({ where: { id: params.groupId }, select: { name: true } })
      : Promise.resolve(null),
  ]);

  const who = inviter?.name ?? inviter?.email ?? "Someone";
  const where = group ? ` to the group “${group.name}”` : "";
  const link = inviteLink(params.token);

  return send(
    params.to,
    `${who} added you${where} on Splitwise Killer`,
    shell(`<p style="font-size:15px;color:#26332e;line-height:1.6">
        <strong>${who}</strong> added you${where} and there may already be expenses waiting for you.
      </p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#12b886;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Sign in and see your balance</a>
      </p>
      <p style="color:#8a9a94;font-size:13px">Or paste this link into your browser:<br>${link}</p>`),
  );
}

/**
 * Confirm that somebody signing up with a password really owns the address.
 *
 * Only sent when the address already has expenses waiting on it — see
 * signUpAction. Somebody else's balances are on the other side of this link, so
 * it is the one thing standing between typing a friend's email and reading
 * their ledger.
 */
export async function sendVerificationEmail(params: {
  to: string;
  token: string;
}): Promise<boolean> {
  if (!emailConfigured) return false;

  const link = verifyLink(params.token);

  return send(
    params.to,
    "Confirm your email for Splitwise Killer",
    shell(`<p style="font-size:15px;color:#26332e;line-height:1.6">
        Somebody has already been splitting bills with this email address, so
        there are balances waiting for you. Confirm the address is yours and
        they're all yours.
      </p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#12b886;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">Confirm my email</a>
      </p>
      <p style="color:#8a9a94;font-size:13px">Or paste this link into your browser:<br>${link}</p>
      <p style="color:#8a9a94;font-size:13px">The link works for 24 hours. If you didn't try to sign up, ignore this email — nothing changes until it's opened.</p>`),
  );
}

/** Where contact-form messages are emailed, when email is configured. */
export const ownerEmail = process.env.OWNER_EMAIL ?? null;

/** Donation link shown on the contact page — a UPI link, Ko-fi, anything. */
export const donateUrl = process.env.DONATE_URL ?? null;

export async function sendFeedbackEmail(params: {
  name: string;
  email: string | null;
  message: string;
}): Promise<boolean> {
  if (!emailConfigured || !ownerEmail) return false;

  return send(
    ownerEmail,
    `Splitwise Killer feedback from ${params.name}`,
    shell(`<p style="font-size:15px;color:#26332e;line-height:1.6">
        <strong>${escapeHtml(params.name)}</strong>${
          params.email ? ` (${escapeHtml(params.email)})` : ""
        } wrote:
      </p>
      <p style="white-space:pre-wrap;background:#f6f8f7;border-radius:12px;padding:14px;color:#26332e">${escapeHtml(
        params.message,
      )}</p>`),
  );
}

/** Messages are written by people; never let them inject markup into the email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
