import { CheckCircle2, DollarSign, Send, Ship } from "lucide-react";

interface ForwardersSummaryStripProps {
  totalCount?: number;
  activeCount?: number;
  activeBookingsCount?: number;
  shippingLinesCount?: number;
}

export function ForwardersSummaryStrip({
  totalCount = 18,
  activeCount = 16,
  activeBookingsCount = 42,
  shippingLinesCount = 7,
}: ForwardersSummaryStripProps) {
  return (
    <div className="relative overflow-hidden rounded-[18px] border border-white/85 bg-white/72 shadow-[0_10px_32px_rgba(15,23,42,0.035)] backdrop-blur-[24px]">
      <div className="grid grid-cols-2 divide-y divide-slate-100/90 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {/* Metric 1: Total Forwarders */}
        <div className="flex items-center gap-3.5 px-5 py-3.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-[12px] border border-slate-200/70 bg-[#E8F1F3]/60 text-[#6A80A9] shadow-2xs">
            <Send className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Total Forwarders
            </p>
            <p className="font-mono text-[20px] font-bold tracking-tight text-[#000000] leading-none mt-0.5">
              {totalCount}
            </p>
          </div>
        </div>

        {/* Metric 2: Active */}
        <div className="flex items-center gap-3.5 px-5 py-3.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-[12px] border border-[#C7D5BF]/80 bg-[#C7D5BF]/30 text-[#3D5A32] shadow-2xs">
            <CheckCircle2 className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Active
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[20px] font-bold tracking-tight text-[#000000] leading-none">
                {activeCount}
              </span>
              <span className="size-2 rounded-full bg-[#3D5A32]/80" />
            </div>
          </div>
        </div>

        {/* Metric 3: Active Bookings */}
        <div className="flex items-center gap-3.5 px-5 py-3.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-[12px] border border-[#6A80A9]/25 bg-[#E8F1F3]/80 text-[#6A80A9] shadow-2xs">
            <DollarSign className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Active Bookings
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono text-[20px] font-bold tracking-tight text-[#6A80A9] leading-none">
                {activeBookingsCount}
              </span>
              <span className="text-[11px] font-medium text-slate-400">live</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Connected Shipping Lines */}
        <div className="flex items-center gap-3.5 px-5 py-3.5">
          <div className="grid size-9 shrink-0 place-items-center rounded-[12px] border border-slate-200/70 bg-[#E8F1F3]/60 text-[#6A80A9] shadow-2xs">
            <Ship className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Connected Shipping Lines
            </p>
            <p className="font-mono text-[20px] font-bold tracking-tight text-[#000000] leading-none mt-0.5">
              {shippingLinesCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
