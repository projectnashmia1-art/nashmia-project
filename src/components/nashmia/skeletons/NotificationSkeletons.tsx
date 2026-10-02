import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function NotificationsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-slate-100 skeleton-container">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 py-3 px-2 rounded-xl">
          <Skeleton className="size-9 rounded-xl bg-slate-200/80 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-36 bg-slate-200/80" />
              <Skeleton className="h-3 w-12 bg-slate-100" />
            </div>
            <Skeleton className="h-3 w-48 bg-slate-100" />
            <Skeleton className="h-3.5 w-20 rounded bg-slate-200/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
