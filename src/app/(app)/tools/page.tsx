import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { requireUser } from "@/lib/session";
import { isOwner } from "@/lib/owner";

export const metadata = { title: "Tools" };

/**
 * Personal utilities. Gated to OWNER_EMAIL and 404s for everybody else, so the
 * section does not even advertise its existence on a deployment somebody else
 * is running.
 */
export default async function ToolsPage() {
  const user = await requireUser();
  if (!isOwner(user)) notFound();

  return (
    <>
      <PageHeader title="Tools" subtitle="Personal automations that live in this app." />

      <div className="grid max-w-xl gap-3">
        <Link href="/tools/shopwise" className="card flex items-center gap-4 p-4 hover:bg-[var(--surface-raised)]">
          <span className="text-3xl">🎁</span>
          <span className="min-w-0">
            <span className="block font-semibold">Amex Shopwise gift card</span>
            <span className="block text-sm muted">
              Buy the monthly ₹1,000 Amazon Pay gift card. You only send the OTP.
            </span>
          </span>
        </Link>
      </div>
    </>
  );
}
