import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function DirectorySummaryStripSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 skeleton-container">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs flex items-center justify-between"
        >
          <div className="space-y-1">
            <Skeleton className="h-3 w-20 bg-slate-100" />
            <Skeleton className="h-7 w-16 bg-slate-200/80" />
          </div>
          <Skeleton className="size-9 rounded-xl bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function DirectoryCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 skeleton-container">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs space-y-3.5 flex flex-col justify-between"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-xl bg-slate-200/80 shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32 bg-slate-200/80" />
                  <Skeleton className="h-3 w-20 bg-slate-100" />
                </div>
              </div>
              <Skeleton className="h-5 w-14 rounded-full bg-slate-200/60" />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16 bg-slate-100" />
                <Skeleton className="h-3 w-24 bg-slate-100" />
              </div>
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-14 bg-slate-100" />
                <Skeleton className="h-3 w-20 bg-slate-100" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-3">
            <Skeleton className="h-8 w-24 rounded-xl bg-slate-200/60" />
            <Skeleton className="size-8 rounded-lg bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DirectoryTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs skeleton-container">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-28 bg-slate-200/70" />
              </th>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-24 bg-slate-200/70" />
              </th>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-24 bg-slate-200/70" />
              </th>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-20 bg-slate-200/70" />
              </th>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-16 bg-slate-200/70" />
              </th>
              <th className="px-5 py-3.5 text-right">
                <Skeleton className="h-3.5 w-14 ml-auto bg-slate-200/70" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-8 rounded-lg bg-slate-200/80 shrink-0" />
                    <Skeleton className="h-4 w-32 bg-slate-200/80" />
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-3.5 w-28 bg-slate-200/70" />
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-3.5 w-24 bg-slate-100" />
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-5 w-18 rounded-full bg-slate-200/60" />
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-3.5 w-16 bg-slate-100" />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Skeleton className="size-7 rounded-lg ml-auto bg-slate-100" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
