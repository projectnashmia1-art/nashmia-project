import { memo } from "react";
import { Boxes, Clock, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { RequestsStatsSummary } from "@/types/requests";

interface RequestsMetricsProps {
  stats: RequestsStatsSummary;
  onFilterStatus?: (status: string) => void;
  activeStatusFilter?: string;
}

export const RequestsMetrics = memo(function RequestsMetrics({
  stats,
  onFilterStatus,
  activeStatusFilter = "All",
}: RequestsMetricsProps) {
  const isTotalSelected = activeStatusFilter === "All" || !activeStatusFilter;
  const isPendingSelected = activeStatusFilter === "Pending Review";
  const isRateSelected = activeStatusFilter === "Rate Verification";
  const isUrgentSelected = activeStatusFilter === "Urgent";
  const isApprovedSelected = activeStatusFilter === "Approved";

  return (
    <div className="relative w-full min-w-0 max-w-full">
      {/* Soft warm ambient blur glow behind the widgets */}
      <div className="pointer-events-none absolute -top-8 inset-x-0 mx-auto h-72 w-full max-w-full sm:max-w-5xl bg-gradient-to-r from-amber-400/20 via-orange-300/15 to-teal-400/15 blur-3xl opacity-65 -z-10" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-4.5">
        {/* ========================================================================= */}
        {/* 1. CARD 1: Total Requests (White Card with Step Arch Sparkline)           */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onFilterStatus?.("All")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-5.5 border text-left transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer ${
            isTotalSelected
              ? "border-[#0FA3B1] ring-2 ring-[#0FA3B1]/25 shadow-[0_14px_34px_-8px_rgba(15,163,177,0.18)]"
              : "border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
          }`}
        >
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <Boxes className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Total
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Requests
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + rhythmic bracket pulse step wave */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {stats.total}
            </span>
            {/* Rhythmic bracket step arch sparkline */}
            <div className="pb-1.5">
              <svg className="w-16 h-4 overflow-visible" viewBox="0 0 64 16" fill="none">
                <path
                  d="M 2 13 C 4 13 5 6 8 6 C 11 6 12 13 14 13 H 18 C 20 13 21 6 24 6 C 27 6 28 13 30 13 H 34 C 36 13 37 6 40 6 C 43 6 44 13 46 13 H 50 C 52 13 53 6 56 6 C 59 6 60 13 62 13"
                  stroke="#0f172a"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </button>

        {/* ========================================================================= */}
        {/* 2. CARD 2: Pending Review (Warm Copper/Amber Glass Hero with Sine Wave)   */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onFilterStatus?.("Pending Review")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] p-5 sm:p-5.5 border text-left transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer ${
            isPendingSelected
              ? "border-amber-300 ring-2 ring-amber-400/40 shadow-[0_20px_42px_-10px_rgba(110,65,25,0.5)]"
              : "border-amber-400/20 shadow-[0_16px_36px_-10px_rgba(110,65,25,0.3)] hover:shadow-[0_20px_42px_-10px_rgba(110,65,25,0.4)]"
          }`}
          style={{
            background: `
              radial-gradient(circle at 85% 15%, rgba(165, 105, 45, 0.85) 0%, transparent 60%),
              radial-gradient(circle at 20% 80%, rgba(125, 75, 30, 0.5) 0%, transparent 60%),
              linear-gradient(135deg, #44311e 0%, #684824 52%, #382515 100%)
            `,
          }}
        >
          {/* Specular edge */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

          {/* Top: Translucent Golden Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-amber-200/30 bg-white/5 backdrop-blur-xs flex items-center justify-center text-amber-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
              <Clock className="size-5 stroke-[1.8] text-amber-100" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-amber-100/95">
                Pending
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-amber-100/95">
                Review
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + unit and golden sine wave sparkline */}
          <div className="mt-4 flex items-end justify-between">
            <div className="flex items-baseline">
              <span className="text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-none">
                {stats.pendingReview}
              </span>
              <span className="text-[14px] font-normal text-amber-200/80 ml-1">reqs</span>
            </div>

            {/* Golden sine wave sparkline with vertex dots */}
            <div className="pb-1">
              <svg className="w-16 h-5 overflow-visible" viewBox="0 0 64 22" fill="none">
                <path
                  d="M 2 15 C 10 15 14 5 22 5 C 30 5 34 18 42 18 C 50 18 54 8 62 8"
                  stroke="rgba(253, 230, 138, 0.75)"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="22" cy="5" r="2" fill="rgba(253, 230, 138, 0.95)" />
                <circle cx="42" cy="18" r="2" fill="rgba(253, 230, 138, 0.95)" />
                <circle cx="62" cy="8" r="2" fill="rgba(253, 230, 138, 0.95)" />
              </svg>
            </div>
          </div>
        </button>

        {/* ========================================================================= */}
        {/* 3. CARD 3: Rate Verification (White Card with 5-bar Equalizer)            */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onFilterStatus?.("Rate Verification")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-5.5 border text-left transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer ${
            isRateSelected
              ? "border-[#0FA3B1] ring-2 ring-[#0FA3B1]/25 shadow-[0_14px_34px_-8px_rgba(15,163,177,0.18)]"
              : "border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
          }`}
        >
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <Receipt className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Rate
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Verification
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + 5 vertical equalizer bars */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {stats.rateVerification}
            </span>
            {/* 5-bar vertical sparkline */}
            <div className="flex items-end gap-1.5 h-6 pb-0.5">
              <span className="w-1.5 h-2 rounded-full bg-slate-900/90" />
              <span className="w-1.5 h-3.5 rounded-full bg-slate-900/90" />
              <span className="w-1.5 h-6 rounded-full bg-slate-900" />
              <span className="w-1.5 h-5 rounded-full bg-slate-900" />
              <span className="w-1.5 h-2.5 rounded-full bg-slate-900/80" />
            </div>
          </div>
        </button>

        {/* ========================================================================= */}
        {/* 4. CARD 4: Urgent Cut-Offs (White Card with 3x5 Dot Matrix)               */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onFilterStatus?.("Urgent")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-5.5 border text-left transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer ${
            isUrgentSelected
              ? "border-[#0FA3B1] ring-2 ring-[#0FA3B1]/25 shadow-[0_14px_34px_-8px_rgba(15,163,177,0.18)]"
              : "border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
          }`}
        >
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0 relative">
              <AlertTriangle className="size-5 stroke-[1.8] text-rose-600" />
              {stats.urgentCutoffs > 0 && (
                <span className="absolute top-0 right-0 size-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Urgent
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Cut-Offs
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + 3x5 dot matrix pattern */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {stats.urgentCutoffs}
            </span>
            {/* 3x5 dot matrix pattern */}
            <div className="grid grid-rows-3 grid-flow-col gap-x-1.5 gap-y-1 pb-1">
              <span className="size-1 rounded-full bg-slate-300" />
              <span className="size-1.5 rounded-full bg-rose-600" />
              <span className="size-1 rounded-full bg-slate-300" />

              <span className="size-1 rounded-full bg-slate-200" />
              <span className="size-1 rounded-full bg-slate-400" />
              <span className="size-1 rounded-full bg-slate-200" />

              <span className="size-1.5 rounded-full bg-rose-600" />
              <span className="size-1.5 rounded-full bg-slate-900" />
              <span className="size-1 rounded-full bg-slate-300" />

              <span className="size-1 rounded-full bg-slate-200" />
              <span className="size-1 rounded-full bg-slate-400" />
              <span className="size-1 rounded-full bg-slate-200" />

              <span className="size-1 rounded-full bg-slate-300" />
              <span className="size-1.5 rounded-full bg-slate-900" />
              <span className="size-1 rounded-full bg-slate-300" />
            </div>
          </div>
        </button>

        {/* ========================================================================= */}
        {/* 5. CARD 5: Approved & Confirmed (White Card with Pulse Arch Sparkline)    */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onFilterStatus?.("Approved")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-5.5 border text-left transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer ${
            isApprovedSelected
              ? "border-[#0FA3B1] ring-2 ring-[#0FA3B1]/25 shadow-[0_14px_34px_-8px_rgba(15,163,177,0.18)]"
              : "border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
          }`}
        >
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <CheckCircle2 className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Approved
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Confirmed
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + Pulse Arch sparkline */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {stats.approved}
            </span>
            {/* Arch pulse with node dot */}
            <div className="pb-1">
              <svg className="w-16 h-5 overflow-visible" viewBox="0 0 64 22" fill="none">
                <path
                  d="M 2 17 C 14 17 20 5 32 5 C 44 5 50 17 62 17"
                  stroke="#0f172a"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="32" cy="5" r="2.5" fill="#0f172a" />
              </svg>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
});
