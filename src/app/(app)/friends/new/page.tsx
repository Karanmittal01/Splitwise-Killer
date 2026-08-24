import Link from "next/link";
import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { ImportContacts } from "@/components/ImportContacts";
import { SubmitButton } from "@/components/form";
import { requireUser } from "@/lib/session";
import { addFriendAction } from "@/server/actions/friends";

export const metadata = { title: "Add a friend" };

/**
 * Every way of getting somebody onto your friends list, on one page.
 *
 * It stays put after a successful add and clears itself instead, because
 * adding three people in a row is the common case — the list is one tap away
 * when you're done.
 */
export default async function NewFriendPage() {
  await requireUser();

  return (
    <>
      <PageHeader
        title="Add a friend"
        subtitle="They don't need an account yet — their share waits for them."
        back={{ href: "/friends", label: "Friends" }}
      />

      <div className="flex max-w-xl flex-col gap-5">
        <ActionForm
          action={addFriendAction}
          className="card flex flex-col gap-4 p-4"
          messagePosition="above"
          resetOnSuccess
        >
          <h2 className="font-semibold">By email or mobile number</h2>

          <div>
            <label className="label" htmlFor="handle">
              Email or mobile number
            </label>
            <input
              id="handle"
              name="handle"
              className="field"
              placeholder="riya@gmail.com or +91 98765 43210"
              autoComplete="off"
              required
            />
            <p className="mt-1.5 text-xs muted">
              A number works on its own — you&apos;ll get a link to send them over WhatsApp or SMS.
            </p>
          </div>

          <div>
            <label className="label" htmlFor="name">
              Nickname (optional)
            </label>
            <input
              id="name"
              name="name"
              className="field"
              placeholder="Riya"
              maxLength={60}
              autoComplete="off"
            />
            <p className="mt-1.5 text-xs muted">
              Only you see this. You can change it any time from their page.
            </p>
          </div>

          <div className="flex gap-3">
            <SubmitButton className="btn btn-primary flex-1 py-3" pendingLabel="Adding…">
              Add friend
            </SubmitButton>
            <Link href="/friends" className="btn btn-secondary py-3">
              Done
            </Link>
          </div>
        </ActionForm>

        {/* Brings its own card and heading. */}
        <ImportContacts />

        <p className="px-1 text-xs muted">
          Nobody is told anything until you add an expense with them. Adding somebody by email
          sends them an invite link; by number, you send it yourself.
        </p>
      </div>
    </>
  );
}
