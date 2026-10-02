import { CheckCircle2, Container, Globe2, Users } from "lucide-react";

interface BuyersSummaryStripProps {
  totalBuyers: number;
  activeBuyers: number;
  withActiveMovements: number;
  totalCountries: number;
}

export function BuyersSummaryStrip({
  totalBuyers,
  activeBuyers,
  withActiveMovements,
  totalCountries,
}: BuyersSummaryStripProps) {
  return (
    <div className="relative w-full min-w-0 max-w-full">
      {/* Soft warm ambient blur glow behind the widgets matching the uploaded design */}
      <div className="pointer-events-none absolute -top-8 inset-x-0 mx-auto h-72 w-full max-w-full sm:max-w-4xl bg-gradient-to-r from-amber-400/20 via-orange-300/15 to-teal-400/15 blur-3xl opacity-65 -z-10" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-4.5">
        {/* ========================================================================= */}
        {/* 1. CARD 1: Payment History Style -> Active Accounts                       */}
        {/* ========================================================================= */}
        <div className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)] flex flex-col justify-between min-h-[145px] sm:min-h-[155px]">
          {/* Top: Circular outline icon + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <CheckCircle2 className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Active
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Accounts
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + 5 vertical equalizer bars */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {activeBuyers}
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
        </div>

        {/* ========================================================================= */}
        {/* 3. CARD 2: Credit Age Style -> Active Movements (Warm Copper/Amber Glass)  */}
        {/* ========================================================================= */}
        <div
          className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] p-5 sm:p-6 border border-amber-400/20 shadow-[0_16px_36px_-10px_rgba(110,65,25,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_-10px_rgba(110,65,25,0.4)] flex flex-col justify-between min-h-[145px] sm:min-h-[155px]"
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
              <Container className="size-5 stroke-[1.8] text-amber-100" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-amber-100/95">
                Active
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-amber-100/95">
                Movements
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + unit and golden sine wave sparkline */}
          <div className="mt-4 flex items-end justify-between">
            <div className="flex items-baseline">
              <span className="text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-none">
                {withActiveMovements}
              </span>
              <span className="text-[14px] font-normal text-amber-200/80 ml-1">mvts</span>
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
        </div>

        {/* ========================================================================= */}
        {/* 4. CARD 3: Total Accounts Style -> Total Buyers                           */}
        {/* ========================================================================= */}
        <div className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)] flex flex-col justify-between min-h-[145px] sm:min-h-[155px]">
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <Users className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Total
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Buyers
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + rhythmic bracket pulse step wave */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {totalBuyers}
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
        </div>

        {/* ========================================================================= */}
        {/* 5. CARD 4: Hard Inquiries Style -> Global Corridors                       */}
        {/* ========================================================================= */}
        <div className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)] flex flex-col justify-between min-h-[145px] sm:min-h-[155px]">
          {/* Top: Icon circle + Two-line title */}
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <Globe2 className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Global
              </span>
              <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                Corridors
              </span>
            </div>
          </div>

          {/* Bottom: Big metric + 3x5 dot matrix pattern */}
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {totalCountries}
            </span>
            {/* 3x5 dot matrix pattern matching the image */}
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
        </div>
      </div>
    </div>
  );
}
