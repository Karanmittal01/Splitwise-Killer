import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { ActionForm } from "@/components/ActionForm";
import { Avatar } from "@/components/Avatar";
import { CopyField } from "@/components/CopyField";
import { SubmitButton } from "@/components/form";
import { CURRENCIES } from "@/lib/currencies";
import { prisma } from "@/lib/db";
import { appUrl, inviteLink } from "@/lib/people";
import { getGroupOrThrow } from "@/lib/queries";
import { displayName, requireUser } from "@/lib/session";
import { emailConfigured } from "@/lib/notify";
import {
  addGroupMemberAction,
  deleteGroupAction,
  removeGroupMemberAction,
  resetInviteLinkAction,
  updateGroupAction,
} from "@/server/actions/groups";

export const metadata = { title: "Group settings" };

const TYPES = [
  { id: "TRIP", label: "Trip" },
  { id: "HOME", label: "Home" },
  { id: "COUPLE", label: "Couple" },
  { id: "FRIENDS", label: "Friends" },
  { id: "OTHER", label: "Other" },
];

export default async function GroupSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const group = await getGroupOrThrow(id, user.id);
  if (!group) notFound();

  // Pending invites so you can re-share a link somebody lost.
  const invites = await prisma.invitation.findMany({
    where: { groupId: group.id, acceptedAt: null },
    select: { id: true, token: true, email: true, phone: true, targetUserId: true },
  });
  const inviteByUser = new Map(invites.map((i) => [i.targetUserId, i]));

  return (
    <>
      <PageHeader
        title="Group settings"
        subtitle={group.name}
        back={{ href: `/groups/${group.id}`, label: group.name }}
      />

      <div className="flex max-w-2xl flex-col gap-6">
        {/* Details */}
        <ActionForm action={updateGroupAction} className="card flex flex-col gap-4 p-4">
          <input type="hidden" name="groupId" value={group.id} />
          <h2 className="font-semibold">Details</h2>

          <div className="flex gap-3">
            <div className="w-20 shrink-0">
              <label className="label" htmlFor="emoji">
                Icon
              </label>
              <input
                id="emoji"
                name="emoji"
                className="field text-center text-xl"
                defaultValue={group.emoji}
                maxLength={8}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label className="label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                name="name"
                className="field"
                defaultValue={group.name}
                maxLength={80}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="type">
                Type
              </label>
              <select id="type" name="type" className="field" defaultValue={group.type}>
                {TYPES.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="currency">
                Default currency
              </label>
              <select
                id="currency"
                name="currency"
                className="field"
                defaultValue={group.currency}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-xl bg-[var(--surface-raised)] p-3">
            <input
              type="checkbox"
              name="simplifyDebts"
              defaultChecked={group.simplifyDebts}
              className="mt-0.5 h-4 w-4 accent-[var(--color-mint-600)]"
            />
            <span className="text-sm">
              <span className="font-semibold">Simplify debts</span>
              <span className="block muted">
                Combine everyone&apos;s IOUs into the fewest possible payments. Nobody&apos;s net
                position changes — there are just fewer transfers to make.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-xl bg-[var(--surface-raised)] p-3">
            <input
              type="checkbox"
              name="archived"
              defaultChecked={group.archived}
              className="mt-0.5 h-4 w-4 accent-[var(--color-mint-600)]"
            />
            <span className="text-sm">
              <span className="font-semibold">Archive this group</span>
              <span className="block muted">
                Hides it from your lists but keeps every expense and balance intact.
              </span>
            </span>
          </label>

          <div>
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </ActionForm>

        {/* Members */}
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Members</h2>

          <div className="divide-row mb-4">
            {group.members.map((membership) => {
              const member = membership.user;
              const invite = inviteByUser.get(member.id);
              return (
                <div key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar id={member.id} name={displayName(member)} image={member.image} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {displayName(member, user.id, member.id)}
                    </p>
                    <p className="truncate text-xs muted">
                      {member.email ?? member.phone ?? "no contact details"}
                      {member.isPlaceholder && " · invited, not signed in yet"}
                    </p>
                  </div>

                  <ActionForm
                    action={removeGroupMemberAction}
                    confirm={
                      member.id === user.id
                        ? "Leave this group?"
                        : `Remove ${displayName(member)} from the group?`
                    }
                    messagePosition="below"
                  >
                    <input type="hidden" name="groupId" value={group.id} />
                    <input type="hidden" name="memberId" value={member.id} />
                    <SubmitButton className="btn btn-ghost text-xs" pendingLabel="…">
                      {member.id === user.id ? "Leave" : "Remove"}
                    </SubmitButton>
                  </ActionForm>

                  {invite && (
                    <div className="w-full">
                      <CopyField
                        label={`Invite link for ${displayName(member)}`}
                        value={inviteLink(invite.token)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <ActionForm action={addGroupMemberAction} className="border-t border-[var(--surface-border)] pt-4">
            <input type="hidden" name="groupId" value={group.id} />
            <label className="label" htmlFor="person">
              Add someone
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="person"
                name="person"
                className="field max-w-sm flex-1"
                placeholder="email@example.com or +91 98765 43210"
                required
              />
              <SubmitButton className="btn btn-secondary" pendingLabel="Adding…">
                Add
              </SubmitButton>
            </div>
            <p className="mt-2 text-xs muted">
              {emailConfigured
                ? "We'll email them an invite link automatically."
                : "You'll get a link to send them — email delivery is optional and switched off."}
            </p>
          </ActionForm>
        </section>

        {/* Shareable link */}
        <section className="card p-4">
          <h2 className="mb-1 font-semibold">Invite by link</h2>
          <p className="mb-3 text-sm muted">
            Anyone with this link can join the group after signing in. Share it in your group chat.
          </p>
          <CopyField label="Group link" value={`${appUrl()}/join/group/${group.inviteToken}`} />

          <ActionForm
            action={resetInviteLinkAction}
            className="mt-3"
            confirm="Generate a new link? The current one stops working."
          >
            <input type="hidden" name="groupId" value={group.id} />
            <SubmitButton className="btn btn-ghost text-xs" pendingLabel="Resetting…">
              Reset link
            </SubmitButton>
          </ActionForm>
        </section>

        {/* Danger zone */}
        <section className="card border-[var(--color-coral-300)] p-4">
          <h2 className="font-semibold text-[var(--negative)]">Delete this group</h2>
          <p className="mt-1 mb-3 text-sm muted">
            Every expense, balance and comment in {group.name} is removed for everybody. This
            cannot be undone.
          </p>
          <ActionForm
            action={deleteGroupAction}
            className="flex flex-wrap gap-2"
            confirm={`Permanently delete "${group.name}"?`}
          >
            <input type="hidden" name="groupId" value={group.id} />
            <input
              name="confirm"
              className="field max-w-40"
              placeholder="Type DELETE"
              aria-label="Type DELETE to confirm"
            />
            <SubmitButton className="btn btn-danger" pendingLabel="Deleting…">
              Delete group
            </SubmitButton>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
