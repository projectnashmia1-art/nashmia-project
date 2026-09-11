import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BookingProgressProps {
  currentStep: number;
  onSelectStep?: (stepIndex: number) => void;
}

const STEPS = [
  { number: "01", label: "Booking Details", id: "parties" },
  { number: "02", label: "Route & Shipping", id: "route" },
  { number: "03", label: "Container & Cargo", id: "cargo" },
  { number: "04", label: "Review & Rate", id: "review" },
];

export function BookingProgress({ currentStep, onSelectStep }: BookingProgressProps) {
  return (
    <div className="overflow-x-auto pb-1 pt-2 scrollbar-none">
      <div className="min-w-[580px] rounded-[20px] border border-white/80 bg-white/70 p-3 shadow-[0_8px_30px_rgba(15,23,42,0.03),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-xl">
        <div className="relative flex items-center justify-between px-3 sm:px-6">
          {/* Background Connector Line */}
          <div className="absolute left-8 right-8 top-5 h-[2px] -translate-y-1/2 bg-[#E8F1F3]" />

          {/* Active Connector Progress Line */}
          <div
            className="absolute left-8 top-5 h-[2px] -translate-y-1/2 bg-gradient-to-r from-[#C7D5BF] via-[#6A80A9] to-[#6A80A9] transition-all duration-500 ease-out"
            style={{
              width: `calc(${(Math.min(currentStep, STEPS.length - 1) / (STEPS.length - 1)) * 100}% - 40px)`,
            }}
          />

          {STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;
            const isUpcoming = index > currentStep;

            return (
              <button
                key={step.number}
                type="button"
                onClick={() => onSelectStep?.(index)}
                className="group relative z-10 flex flex-col items-center gap-1.5 focus:outline-none"
              >
                {/* Step Circle Indicator */}
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full border text-xs font-semibold transition-all duration-300",
                    isCompleted &&
                      "border-[#C7D5BF] bg-[#C7D5BF] text-[#2D3C26] shadow-[0_2px_8px_rgba(199,213,191,0.4)]",
                    isCurrent &&
                      "scale-110 border-[#6A80A9] bg-[#6A80A9] text-white shadow-[0_4px_14px_rgba(106,128,169,0.35)] ring-4 ring-[#6A80A9]/15",
                    isUpcoming &&
                      "border-slate-200/80 bg-[#E8F1F3] text-slate-500 group-hover:border-slate-300 group-hover:bg-[#dbe7ea]",
                  )}
                >
                  {isCompleted ? (
                    <Check className="size-4 stroke-[2.5]" />
                  ) : (
                    <span>{step.number}</span>
                  )}
                </div>

                {/* Step Label */}
                <span
                  className={cn(
                    "text-xs font-medium tracking-tight transition-colors whitespace-nowrap",
                    isCurrent && "font-semibold text-black",
                    isCompleted && "text-slate-700",
                    isUpcoming && "text-slate-400 group-hover:text-slate-600",
                  )}
                >
                  {step.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
