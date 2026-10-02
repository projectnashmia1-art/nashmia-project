import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentsFoldersSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 skeleton-container">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-2.5 flex flex-col justify-between h-[100px]"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="size-9 rounded-xl bg-slate-200/80" />
            <Skeleton className="size-5 rounded bg-slate-100" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-24 bg-slate-200/80" />
            <Skeleton className="h-2.5 w-14 bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocumentsTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs skeleton-container">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-24 bg-slate-200/70" />
              </th>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-20 bg-slate-200/70" />
              </th>
              <th className="px-5 py-3.5">
                <Skeleton className="h-3.5 w-24 bg-slate-200/70" />
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
                    <Skeleton className="h-3.5 w-36 bg-slate-200/80" />
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-3.5 w-20 bg-slate-100" />
                </td>
                <td className="px-5 py-3.5">
                  <Skeleton className="h-3.5 w-24 bg-slate-100" />
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

export function DocumentsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 skeleton-container">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-2.5"
        >
          <Skeleton className="h-28 w-full rounded-xl bg-slate-200/70" />
          <div className="space-y-1">
            <Skeleton className="h-3.5 w-28 bg-slate-200/80" />
            <div className="flex justify-between">
              <Skeleton className="h-2.5 w-14 bg-slate-100" />
              <Skeleton className="h-2.5 w-16 bg-slate-100" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
