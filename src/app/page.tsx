import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { BrandMark } from "@/components/BrandMark";

const FEATURES = [
  {
    icon: "⚖️",
    title: "Split any way you like",
    body: "Equally, by exact amounts, percentages, shares or adjustments — and more than one person can pay for the same bill.",
  },
  {
    icon: "👥",
    title: "Groups that make sense",
    body: "Trips, flats, couples or one-off nights out. Each group keeps its own running balance and history.",
  },
  {
    icon: "🪄",
    title: "Simplify debts",
    body: "Turn a tangle of IOUs into the fewest possible payments, so nobody has to send three separate transfers.",
  },
  {
    icon: "✉️",
    title: "Invite by email or phone",
    body: "Add someone before they even have an account. Their share is waiting the moment they sign in with Google.",
  },
  {
    icon: "🌍",
    title: "Multi-currency",
    body: "Log a Bangkok dinner in baht and rent in rupees. Balances stay honest — no invented exchange rates.",
  },
  {
    icon: "🔁",
    title: "Recurring bills",
    body: "Rent, wifi and subscriptions post themselves on schedule so you never re-type the same expense.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 md:py-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrandMark size={36} />
          <span className="text-lg font-bold tracking-tight">Splitwise Killer</span>
        </div>
        <Link href="/login" className="btn btn-secondary">
          Sign in
        </Link>
      </header>

      <section className="animate-rise py-14 md:py-20">
        <p className="chip mb-4">Free · open source · your own server</p>
        <h1 className="max-w-3xl text-4xl leading-[1.1] font-bold tracking-tight md:text-6xl">
          Share expenses.
          <br />
          <span className="text-[var(--brand)]">Keep the friendship.</span>
        </h1>
        <p className="mt-5 max-w-xl text-lg muted">
          Track what everyone owes on trips, flats and dinners. Add people by email or mobile
          number, split a bill however you want, and settle up in a tap.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/login" className="btn btn-primary px-6 py-3 text-base">
            Continue with Google
          </Link>
          <a href="#features" className="btn btn-secondary px-6 py-3 text-base">
            See what it does
          </a>
        </div>
      </section>

      <section id="features" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card p-5">
            <span className="text-2xl">{feature.icon}</span>
            <h3 className="mt-3 font-semibold">{feature.title}</h3>
            <p className="mt-1.5 text-sm muted">{feature.body}</p>
          </div>
        ))}
      </section>

      <section className="card mt-10 flex flex-col items-center gap-4 px-6 py-12 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Ready when you are</h2>
        <p className="max-w-md text-sm muted">
          Sign in with the Google account you already use. Nothing to install, nothing to pay for.
        </p>
        <Link href="/login" className="btn btn-primary px-6 py-3 text-base">
          Get started
        </Link>
      </section>

      <footer className="py-10 text-center text-sm muted">
        Built to be self-hosted. Your data stays in your own database.
      </footer>
    </div>
  );
}
