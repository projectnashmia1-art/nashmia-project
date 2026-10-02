import { ChevronLeft } from "lucide-react";

export function ShipmentTrackingSkeleton() {
  return (
    <div className="relative flex flex-col min-h-full w-full bg-[#F5F7FA] text-slate-800 antialiased font-sans animate-pulse">
      <div className="flex flex-col lg:flex-row flex-1 w-full min-h-0">
        {/* ================= LEFT SIDEBAR SKELETON ================= */}
        <aside className="w-full lg:w-[350px] xl:w-[370px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200/90 bg-white p-5 lg:p-6 lg:min-h-full flex flex-col justify-start z-10">
          {/* POD Card Skeleton */}
          <div className="rounded-[18px] border border-slate-200/80 p-3.5 sm:p-4 bg-white shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-slate-200 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 w-10 bg-slate-200 rounded" />
                <div className="h-4 w-28 bg-slate-200 rounded" />
                <div className="h-3 w-20 bg-slate-100 rounded" />
              </div>
            </div>
          </div>

          {/* Alerts bar skeleton */}
          <div className="mt-3 h-10 w-full rounded-xl bg-slate-100" />
          <div className="mt-2 h-2.5 w-24 bg-slate-100 rounded" />

          {/* Timeline Nodes Skeleton */}
          <div className="mt-6 space-y-6 relative pl-2">
            {/* Node 1 */}
            <div className="flex items-start gap-3.5">
              <div className="size-8 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2 flex-1 pt-1">
                <div className="h-3.5 w-24 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Node 2 */}
            <div className="flex items-start gap-3.5">
              <div className="size-8 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2.5 flex-1 pt-1">
                <div className="h-3.5 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-44 bg-slate-100 rounded" />
                <div className="h-3 w-40 bg-slate-100 rounded" />
                <div className="h-3 w-36 bg-slate-100 rounded" />
              </div>
            </div>

            {/* Node 3 */}
            <div className="flex items-center gap-3.5">
              <div className="size-8 rounded-full bg-slate-200 shrink-0" />
              <div className="h-3 w-40 bg-slate-100 rounded italic" />
            </div>

            {/* Node 4 */}
            <div className="flex items-start gap-3.5">
              <div className="size-8 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2 flex-1 pt-1">
                <div className="h-3.5 w-28 bg-slate-200 rounded" />
                <div className="h-3 w-36 bg-slate-100 rounded" />
              </div>
            </div>

            {/* Node 5 */}
            <div className="flex items-start gap-3.5">
              <div className="size-8 rounded-full bg-slate-200 shrink-0" />
              <div className="space-y-2 flex-1 pt-1">
                <div className="h-3.5 w-28 bg-slate-200 rounded" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
            </div>
          </div>
        </aside>

        {/* ================= RIGHT MAIN AREA SKELETON ================= */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#F5F7FA]">
          {/* Map Skeleton Canvas */}
          <div className="relative w-full h-[280px] sm:h-[340px] md:h-[380px] bg-slate-200/80 overflow-hidden flex items-center justify-center">
            {/* Shimmer wave */}
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-shimmer" />

            {/* Floating Back Button Skeleton */}
            <div className="absolute top-4 left-4 z-20">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3.5 py-1.5 shadow-sm border border-slate-200/90">
                <ChevronLeft className="size-3.5 text-slate-400" />
                <div className="h-3 w-32 bg-slate-200 rounded" />
              </div>
            </div>

            {/* Simulated vessel badge */}
            <div className="rounded-full bg-white/90 px-4 py-2 shadow-md border border-slate-200 flex items-center gap-2">
              <div className="size-3 rounded-full bg-slate-300" />
              <div className="h-3.5 w-40 bg-slate-300 rounded" />
            </div>
          </div>

          {/* Shipment Header Skeleton */}
          <div className="px-5 sm:px-8 pt-6 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-6 rounded-full bg-slate-200" />
                <div className="h-7 w-48 sm:w-64 bg-slate-200 rounded-lg" />
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-slate-200" />
                <div className="h-8 w-20 rounded-full bg-slate-200" />
                <div className="h-8 w-24 rounded-full bg-slate-200" />
              </div>
            </div>

            {/* Tabs Skeleton */}
            <div className="mt-6 flex items-center gap-8 border-b border-slate-200 pb-3">
              <div className="h-4 w-24 bg-slate-300 rounded" />
              <div className="h-4 w-36 bg-slate-200 rounded" />
            </div>
          </div>

          {/* Body Content Skeleton */}
          <div className="p-5 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Transportation Card Skeleton */}
              <div className="lg:col-span-8 bg-white rounded-[20px] p-6 border border-slate-200/80 shadow-2xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="h-5 w-40 bg-slate-200 rounded" />
                  <div className="h-7 w-52 bg-slate-100 rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="h-3 w-20 bg-slate-200 rounded" />
                      <div className="h-4 w-36 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Details Card Skeleton */}
              <div className="lg:col-span-4 bg-white rounded-[20px] p-6 border border-slate-200/80 shadow-2xs space-y-5">
                <div className="h-5 w-32 bg-slate-200 rounded pb-2 border-b border-slate-100" />
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="h-3 w-24 bg-slate-200 rounded" />
                      <div className="h-4 w-32 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
