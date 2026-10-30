import { memo } from "react";

export const AppShellSkeleton = memo(function AppShellSkeleton() {
  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full bg-white select-none">
      {/* Fixed Desktop Sidebar Skeleton */}
      <aside
        aria-hidden="true"
        className="fixed inset-y-0 left-0 z-30 hidden h-screen h-[100dvh] flex-col p-2 lg:flex w-[260px]"
      >
        <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] border border-slate-200/80 bg-white/95 p-3.5 shadow-[0_4px_24px_rgba(0,0,0,0.03)] backdrop-blur-md">
          {/* Brand Mark Skeleton */}
          <div className="flex h-12 items-center gap-3 border-b border-slate-100 pb-3">
            <div className="size-8.5 rounded-xl bg-slate-900/10 animate-pulse" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3.5 w-24 rounded-md bg-slate-200 animate-pulse" />
              <div className="h-2.5 w-16 rounded-md bg-slate-100 animate-pulse" />
            </div>
          </div>

          {/* Navigation Section 1 */}
          <div className="mt-5 space-y-2">
            <div className="h-2.5 w-14 rounded bg-slate-200/70 animate-pulse mb-3" />
            <div className="flex h-10 items-center gap-2.5 rounded-2xl bg-slate-100/80 px-2 animate-pulse">
              <div className="size-7 rounded-full bg-slate-200" />
              <div className="h-3 w-20 rounded bg-slate-200" />
            </div>
          </div>

          {/* Navigation Section 2 */}
          <div className="mt-6 space-y-2">
            <div className="h-2.5 w-16 rounded bg-slate-200/70 animate-pulse mb-3" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="flex h-10 items-center gap-2.5 rounded-2xl px-2 opacity-60"
              >
                <div className="size-7 rounded-full bg-slate-200 animate-pulse" />
                <div
                  className="h-3 rounded bg-slate-200 animate-pulse"
                  style={{ width: `${60 + (i % 3) * 20}px` }}
                />
              </div>
            ))}
          </div>

          {/* Bottom User Area */}
          <div className="mt-auto border-t border-slate-100 pt-3">
            <div className="flex items-center gap-2.5 rounded-2xl border border-slate-200/70 bg-white p-2">
              <div className="size-8 rounded-full bg-slate-900/15 animate-pulse" />
              <div className="space-y-1 flex-1">
                <div className="h-3 w-20 rounded bg-slate-200 animate-pulse" />
                <div className="h-2 w-12 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area Skeleton */}
      <main className="relative z-0 min-h-screen min-h-[100dvh] w-full px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:pb-12 lg:pl-[260px] lg:pr-8">
        <div className="mx-auto w-full max-w-[1600px] space-y-6">
          {/* Header Skeleton */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="h-7 w-56 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-3.5 w-80 rounded-md bg-slate-100 animate-pulse" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-28 rounded-xl bg-slate-100 animate-pulse" />
              <div className="size-9 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          </div>

          {/* KPI Cards Skeleton Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-28 rounded-[22px] border border-slate-200/80 bg-white p-4 shadow-2xs space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
                  <div className="size-4 rounded-full bg-slate-100 animate-pulse" />
                </div>
                <div className="h-7 w-14 rounded-md bg-slate-200 animate-pulse" />
                <div className="h-2 w-20 rounded bg-slate-100 animate-pulse" />
              </div>
            ))}
          </div>

          {/* Mid Section Skeleton Grid */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2 h-72 rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1.5">
                  <div className="h-5 w-40 rounded-md bg-slate-200 animate-pulse" />
                  <div className="h-3 w-64 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="h-6 w-20 rounded-full bg-slate-100 animate-pulse" />
              </div>
              <div className="grid grid-cols-6 gap-2 pt-4">
                {[1, 2, 3, 4, 5, 6].map((k) => (
                  <div key={k} className="h-32 rounded-xl bg-slate-50 border border-slate-100 p-3 space-y-2">
                    <div className="h-3 w-12 rounded bg-slate-200 animate-pulse" />
                    <div className="h-5 w-8 rounded bg-slate-200 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
            <div className="h-72 rounded-[26px] border border-slate-200/80 bg-white p-6 shadow-2xs space-y-3">
              <div className="h-5 w-32 rounded-md bg-slate-200 animate-pulse" />
              <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
              <div className="space-y-2 pt-3">
                {[1, 2, 3].map((k) => (
                  <div key={k} className="h-12 rounded-xl bg-slate-50 border border-slate-100 animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
});
