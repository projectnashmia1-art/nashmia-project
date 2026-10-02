import React from "react";
import { CheckCircle2, Clock, File, Ship } from "lucide-react";

interface DocumentsSummaryStripProps {
  totalCount: number;
  cutoffCount: number;
  blCount: number;
  otherCount: number;
  activeFilter?: "all" | "cutoff" | "bl" | "other";
  onSelectFilter?: (filter: "all" | "cutoff" | "bl" | "other") => void;
}

export function DocumentsSummaryStrip({
  totalCount,
  cutoffCount,
  blCount,
  otherCount,
  activeFilter = "all",
  onSelectFilter,
}: DocumentsSummaryStripProps) {
  return (
    <div className="relative w-full min-w-0 max-w-full">
      {/* Soft warm ambient blur glow behind the widgets matching the Suppliers design */}
      <div className="pointer-events-none absolute -top-8 inset-x-0 mx-auto h-72 w-full max-w-full sm:max-w-4xl bg-gradient-to-r from-amber-400/20 via-orange-300/15 to-teal-400/15 blur-3xl opacity-65 -z-10" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4.5">
        {/* ========================================================================= */}
        {/* 1. CARD 1: Total Documents (White Card with 5-bar vertical sparkline)    */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onSelectFilter?.(activeFilter === "all" ? "all" : "all")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer text-left w-full ${
            activeFilter === "all"
              ? "border-slate-300 ring-2 ring-slate-900/10 shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
              : "border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
          }`}
        >
          {/* Top: Circular outline icon + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <CheckCircle2 className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Total
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Documents
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + 5 vertical equalizer bars */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {totalCount}
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
        {/* 2. CARD 2: Cut-Off Notices (Warm Copper/Amber Glass with Sine Sparkline)  */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onSelectFilter?.(activeFilter === "cutoff" ? "all" : "cutoff")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] p-5 sm:p-6 border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer text-left w-full ${
            activeFilter === "cutoff"
              ? "border-amber-300/70 ring-2 ring-amber-300/40 shadow-[0_20px_42px_-10px_rgba(110,65,25,0.45)]"
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
                Cut-Off
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-amber-100/95">
                Notices
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + unit and golden sine wave sparkline */}
          <div className="mt-4 flex items-end justify-between">
            <div className="flex items-baseline">
              <span className="text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-none">
                {cutoffCount}
              </span>
              <span className="text-[14px] font-normal text-amber-200/80 ml-1">docs</span>
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
        {/* 3. CARD 3: Bills of Lading (White Card with Pulse Bracket Wave)           */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onSelectFilter?.(activeFilter === "bl" ? "all" : "bl")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer text-left w-full ${
            activeFilter === "bl"
              ? "border-slate-300 ring-2 ring-slate-900/10 shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
              : "border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
          }`}
        >
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <Ship className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Bills of
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Lading
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + rhythmic bracket pulse step wave */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {blCount}
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
        {/* 4. CARD 4: Other Documents (White Card with 3x5 Dot Matrix)               */}
        {/* ========================================================================= */}
        <button
          type="button"
          onClick={() => onSelectFilter?.(activeFilter === "other" ? "all" : "other")}
          className={`group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px] sm:min-h-[155px] cursor-pointer text-left w-full ${
            activeFilter === "other"
              ? "border-slate-300 ring-2 ring-slate-900/10 shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
              : "border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)]"
          }`}
        >
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <File className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Other
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Documents
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + 3x5 dot matrix pattern */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {otherCount}
            </span>
            {/* 3x5 dot matrix pattern */}
            <div className="grid grid-rows-3 grid-flow-col gap-x-1.5 gap-y-1 pb-1">
              <span className="size-1 rounded-full bg-slate-300" />
              <span className="size-1.5 rounded-full bg-slate-900" />
              <span className="size-1 rounded-full bg-slate-300" />

              <span className="size-1 rounded-full bg-slate-200" />
              <span className="size-1 rounded-full bg-slate-400" />
              <span className="size-1 rounded-full bg-slate-200" />

              <span className="size-1.5 rounded-full bg-slate-900" />
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
      </div>
    </div>
  );
}
