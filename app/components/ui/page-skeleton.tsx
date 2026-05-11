import { Skeleton } from "~/components/ui/skeleton";
import { TableSkeleton } from "./table-skeleton";

interface PageSkeletonProps {
  columns: number;
  rows?: number;
}

export function PageSkeleton({ columns, rows = 5 }: PageSkeletonProps) {
  return (
    <div className="animate-fade-in">
      {/* Title area */}
      <div className="mb-5">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56 mt-2" />
      </div>

      {/* Search / action bar */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-16 rounded-md" />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
        <TableSkeleton columns={columns} rows={rows} />
      </div>
    </div>
  );
}
