import { MessageSquarePlus, Sparkles } from "lucide-react";
import { PRESET_INSTRUCTIONS } from "@/lib/booking-data";

interface SpecialInstructionsSectionProps {
  instructions: string;
  onChangeInstructions: (text: string) => void;
}

export function SpecialInstructionsSection({
  instructions,
  onChangeInstructions,
}: SpecialInstructionsSectionProps) {
  const handleAddPreset = (preset: string) => {
    if (!instructions.trim()) {
      onChangeInstructions(preset);
    } else if (!instructions.includes(preset)) {
      onChangeInstructions(`${instructions.trim()}\n• ${preset}`);
    }
  };

  return (
    <section
      id="section-instructions"
      className="glass-card rounded-[24px] p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#6A80A9]/10 text-xs font-bold text-[#6A80A9]">
              05
            </span>
            <h2 className="text-xl font-bold tracking-tight text-black sm:text-2xl">
              Special Instructions
            </h2>
          </div>
          <p className="text-xs text-slate-500 sm:text-sm">
            Anything the booking agent should know?
          </p>
        </div>
        <span className="hidden rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-[11px] font-medium text-slate-500 sm:inline-block">
          Forwarder Direct
        </span>
      </div>

      {/* Large Premium Textarea */}
      <div className="relative">
        <textarea
          rows={4}
          value={instructions}
          onChange={(e) => onChangeInstructions(e.target.value)}
          placeholder="Add special instructions for this booking (e.g. Please confirm availability before vessel cut-off)..."
          className="w-full rounded-[20px] border border-slate-200/90 bg-white/90 p-4.5 text-sm leading-relaxed text-black placeholder:text-slate-400 shadow-sm transition-all focus:border-[#6A80A9] focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30"
        />
      </div>

      {/* Recommended Standard Operations Presets */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <Sparkles className="size-3 text-[#6A80A9]" />
          <span>Operational Standard Clauses (Click to insert):</span>
        </div>

        <div className="flex flex-wrap gap-2">
          {PRESET_INSTRUCTIONS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleAddPreset(preset)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition-all hover:border-[#6A80A9]/60 hover:bg-[#E8F1F3]/60 hover:text-black"
            >
              <MessageSquarePlus className="size-3 text-[#6A80A9] shrink-0" />
              <span>{preset}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
