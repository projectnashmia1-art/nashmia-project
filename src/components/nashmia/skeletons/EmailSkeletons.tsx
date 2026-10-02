import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export function EmailListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 skeleton-container">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="relative rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-2.5"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full bg-slate-200/80 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-32 bg-slate-200/80" />
                <Skeleton className="h-3 w-14 bg-slate-100 shrink-0" />
              </div>
              <Skeleton className="h-3.5 w-44 bg-slate-200/70" />
            </div>
          </div>

          <Skeleton className="h-3 w-full bg-slate-100" />

          <div className="flex items-center justify-between pt-0.5">
            <Skeleton className="h-5 w-20 rounded-full bg-slate-200/60" />
            <Skeleton className="h-3.5 w-12 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmailPreviewSkeleton() {
  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden skeleton-container">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <Skeleton className="size-7 rounded-lg bg-slate-200/70" />
          <Skeleton className="size-7 rounded-lg bg-slate-200/70" />
          <Skeleton className="size-7 rounded-lg bg-slate-200/70" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-14 bg-slate-100" />
          <Skeleton className="size-7 rounded-lg bg-slate-200/70" />
        </div>
      </div>

      {/* Main Email Body Area */}
      <div className="flex-1 p-6 space-y-5 overflow-y-auto">
        {/* Subject & Status Tag */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1.5 flex-1">
            <Skeleton className="h-5 w-3/4 bg-slate-200/80" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full bg-slate-200/60" />
              <Skeleton className="h-5 w-28 rounded-full bg-slate-200/60" />
            </div>
          </div>
          <Skeleton className="h-8 w-24 rounded-xl bg-slate-200/70 shrink-0" />
        </div>

        {/* Sender Info Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 rounded-full bg-slate-200/80 shrink-0" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32 bg-slate-200/80" />
              <Skeleton className="h-3 w-40 bg-slate-100" />
            </div>
          </div>
          <Skeleton className="h-3 w-20 bg-slate-100 shrink-0" />
        </div>

        {/* Message Content Lines */}
        <div className="space-y-2.5 pt-1">
          <Skeleton className="h-3.5 w-full bg-slate-100" />
          <Skeleton className="h-3.5 w-11/12 bg-slate-100" />
          <Skeleton className="h-3.5 w-4/5 bg-slate-100" />
          <Skeleton className="h-3.5 w-full bg-slate-100" />
          <Skeleton className="h-3.5 w-3/4 bg-slate-100" />
        </div>

        {/* Attachments Placeholder */}
        <div className="border-t border-slate-100 pt-4 space-y-2.5">
          <Skeleton className="h-3.5 w-28 bg-slate-200/70" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <Skeleton className="size-9 rounded-lg bg-slate-200/70 shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-28 bg-slate-200/70" />
                <Skeleton className="h-2.5 w-16 bg-slate-100" />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <Skeleton className="size-9 rounded-lg bg-slate-200/70 shrink-0" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-24 bg-slate-200/70" />
                <Skeleton className="h-2.5 w-14 bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
