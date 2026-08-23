import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/form";
import { donateUrl, ownerEmail } from "@/lib/notify";
import { displayName, requireUser } from "@/lib/session";
import { sendFeedbackAction } from "@/server/actions/feedback";

export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const user = await requireUser();

  return (
    <>
      <PageHeader
        title="Contact & feedback"
        subtitle="Found a bug, missing a feature, or just want to say hello?"
      />

      <div className="flex max-w-xl flex-col gap-6">
        <ActionForm action={sendFeedbackAction} className="card flex flex-col gap-4 p-4">
          <h2 className="font-semibold">Send a message</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">
                Your name
              </label>
              <input
                id="name"
                name="name"
                className="field"
                defaultValue={displayName(user)}
                maxLength={80}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="email">
                Reply-to email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                className="field"
                defaultValue={user.email ?? ""}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              className="field min-h-32"
              placeholder="What's on your mind?"
              maxLength={4000}
              required
            />
          </div>

          <div>
            <SubmitButton pendingLabel="Sending…">Send message</SubmitButton>
          </div>
        </ActionForm>

        {ownerEmail && (
          <section className="card p-4">
            <h2 className="mb-1 font-semibold">Prefer email?</h2>
            <p className="text-sm muted">
              Write to{" "}
              <a className="text-[var(--brand)] hover:underline" href={`mailto:${ownerEmail}`}>
                {ownerEmail}
              </a>
              .
            </p>
          </section>
        )}

        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Support this app</h2>
          <p className="mb-3 text-sm muted">
            Splitwise Killer is free, with no ads and nothing sold on. Running it costs a little in
            hosting — if it saves you an argument or two, a contribution is very welcome.
          </p>
          {donateUrl ? (
            <a href={donateUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              ❤️ Donate
            </a>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--surface-border)] p-3 text-xs muted">
              No donation link is set up yet. Add a <code>DONATE_URL</code> environment variable —
              a UPI link, Ko-fi, Buy Me a Coffee, anything — and a button appears here.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
