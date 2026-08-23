import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-5 text-center">
      <div>
        <p className="text-5xl">🧾</p>
        <h1 className="mt-4 text-2xl font-bold">We couldn&apos;t find that</h1>
        <p className="mt-2 text-sm muted">
          The page may have been deleted, or you might not have access to it.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-6">
          Back to your dashboard
        </Link>
      </div>
    </div>
  );
}
