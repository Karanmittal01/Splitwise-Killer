import { HeaderSkeleton, RowsSkeleton, Skeleton } from "@/components/Skeleton";

/**
 * Shown the moment a link is tapped, for every page in the app shell.
 * The sidebar and tab bar live in the layout, so they stay put — only this
 * region swaps, which is what makes navigation feel instant.
 */
export default function Loading() {
  return (
    <div className="animate-rise">
      <HeaderSkeleton />
      <Skeleton className="mb-6 h-20 w-full" />
      <Skeleton className="mb-3 h-5 w-32" />
      <RowsSkeleton rows={4} />
    </div>
  );
}
