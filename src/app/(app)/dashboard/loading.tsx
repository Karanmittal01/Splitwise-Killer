import { RowsSkeleton, Skeleton } from "@/components/Skeleton";

/**
 * The dashboard's own loading shape.
 *
 * This is the screen you land on when the app opens from the home screen, so
 * it is worth matching what actually arrives: greeting, the three balance
 * tiles, the people list, then groups. Filling in a layout that is already the
 * right shape reads as fast; swapping one arrangement for a different one reads
 * as a flicker.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-rise">
      <div className="mb-5 space-y-2">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-64" />
      </div>

      <Skeleton className="mb-6 h-11 w-44 rounded-xl" />

      {/* The three totals, in one card the way they render. */}
      <div className="card mb-8 grid gap-px overflow-hidden bg-[var(--surface-border)] sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-2 bg-[var(--surface-card)] px-5 py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))}
      </div>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <RowsSkeleton rows={3} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="card flex items-center gap-3 p-4">
              <Skeleton className="h-11 w-11 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
