import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6 skeleton-container">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-[20px] border border-slate-100/90 bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between h-[132px]"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="size-8 rounded-xl bg-slate-100" />
            <Skeleton className="h-4 w-12 rounded-full bg-slate-100" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16 bg-slate-100" />
            <Skeleton className="h-6 w-20 bg-slate-200/80" />
          </div>
          <Skeleton className="h-2.5 w-24 bg-slate-100/80" />
        </div>
      ))}
    </div>
  );
}

export function LifecycleSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-slate-100/90 bg-white p-5 sm:p-6 shadow-xs space-y-5 skeleton-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-44 bg-slate-200/80" />
          <Skeleton className="h-3.5 w-56 bg-slate-100" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-xl bg-slate-100" />
          <Skeleton className="h-8 w-20 rounded-xl bg-slate-100" />
        </div>
      </div>

      {/* Lifecycle Stage Steps */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-100 bg-slate-50/50 p-3 sm:p-3.5 space-y-2.5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="size-6 rounded-full bg-slate-200/80" />
              <Skeleton className="h-3.5 w-5 rounded-full bg-slate-200/60" />
            </div>
            <Skeleton className="h-3 w-full bg-slate-200/70" />
            <Skeleton className="h-1.5 w-full rounded-full bg-slate-200/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecentMovementsSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-slate-100/90 bg-white p-5 sm:p-6 shadow-xs space-y-4 skeleton-container">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <Skeleton className="h-5 w-44 bg-slate-200/80" />
          <Skeleton className="h-3.5 w-56 bg-slate-100" />
        </div>
        <Skeleton className="h-8 w-24 rounded-xl bg-slate-100" />
      </div>

      {/* Streamlined Table Rows */}
      <div className="overflow-x-auto">
        <div className="min-w-[760px] divide-y divide-slate-100">
          <div className="grid grid-cols-12 gap-3 pb-2.5 text-xs font-semibold">
            <Skeleton className="col-span-2 h-3.5 w-16 bg-slate-100" />
            <Skeleton className="col-span-3 h-3.5 w-24 bg-slate-100" />
            <Skeleton className="col-span-2 h-3.5 w-16 bg-slate-100" />
            <Skeleton className="col-span-2 h-3.5 w-20 bg-slate-100" />
            <Skeleton className="col-span-2 h-3.5 w-16 bg-slate-100" />
            <Skeleton className="col-span-1 h-3.5 w-8 ml-auto bg-slate-100" />
          </div>

          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="grid grid-cols-12 gap-3 py-3 items-center">
              <Skeleton className="col-span-2 h-4 w-20 rounded bg-slate-200/80" />
              <Skeleton className="col-span-3 h-4 w-28 bg-slate-200/70" />
              <Skeleton className="col-span-2 h-4 w-16 bg-slate-100" />
              <Skeleton className="col-span-2 h-4 w-20 bg-slate-100" />
              <Skeleton className="col-span-2 h-5 w-20 rounded-full bg-slate-200/70" />
              <Skeleton className="col-span-1 size-6 rounded-lg ml-auto bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NeedsAttentionSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-slate-100/90 bg-white p-5 sm:p-6 shadow-xs space-y-3 skeleton-container">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32 bg-slate-200/80" />
        <Skeleton className="h-4 w-6 rounded-full bg-slate-100" />
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-3"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-7 rounded-lg bg-slate-200/70" />
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-32 bg-slate-200/70" />
                <Skeleton className="h-2.5 w-20 bg-slate-100" />
              </div>
            </div>
            <Skeleton className="h-6 w-16 rounded-lg bg-slate-200/60" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UpcomingCutoffsSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-slate-100/90 bg-white p-5 sm:p-6 shadow-xs space-y-3 skeleton-container">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-36 bg-slate-200/80" />
        <Skeleton className="h-4 w-10 bg-slate-100" />
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 bg-slate-200/80" />
              <Skeleton className="h-4 w-12 rounded-full bg-slate-200/60" />
            </div>
            <Skeleton className="h-2.5 w-28 bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
