import { notFound } from "next/navigation";
import { PageHeader } from "@/components/AppShell";
import { ShopwisePanel } from "@/components/ShopwisePanel";
import { requireUser } from "@/lib/session";
import { isOwner } from "@/lib/owner";

export const metadata = { title: "Shopwise gift card" };

export default async function ShopwiseToolPage() {
  const user = await requireUser();
  if (!isOwner(user)) notFound();

  return (
    <>
      <PageHeader
        title="Amazon Pay gift card"
        subtitle="Tap buy, then send the two OTPs when they arrive."
        back={{ href: "/tools", label: "Tools" }}
      />
      <ShopwisePanel />
    </>
  );
}
