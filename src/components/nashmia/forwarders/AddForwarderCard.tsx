import { Plus, Ship } from "lucide-react";

interface AddForwarderCardProps {
  onAddForwarder: () => void;
}

export function AddForwarderCard({ onAddForwarder }: AddForwarderCardProps) {
  return (
    <button
      type="button"
      onClick={onAddForwarder}
      className="group relative flex min-h-[380px] w-full flex-col justify-between overflow-hidden rounded-[32px] sm:rounded-[36px] border border-dashed border-[#6A80A9]/30 bg-white/70 p-6 sm:p-7 text-left shadow-[0_12px_36px_rgba(15,23,42,0.03)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-[#6A80A9] hover:bg-white hover:shadow-[0_22px_48px_rgba(106,128,169,0.12)] active:translate-y-0 cursor-pointer"
    >
      {/* Specular Edge Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />

      {/* Top section: Avatar-like Add Icon */}
      <div>
        <div className="flex items-start justify-between">
          <div className="size-16 sm:size-17 rounded-full border-2 border-white bg-gradient-to-br from-[#6A80A9] via-[#8B9EB7] to-[#A3B8D4] p-0.5 shadow-[0_6px_18px_rgba(106,128,169,0.2)] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <div className="size-full rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <Ship className="size-7 stroke-[2]" />
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F1F3] border border-[#6A80A9]/20 px-3 py-1 text-[11px] font-bold text-[#6A80A9] shadow-2xs">
            <Plus className="size-3" /> Quick Add
          </span>
        </div>

        {/* Identity & Description */}
        <div className="mt-5">
          <h3 className="text-[21px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug group-hover:text-[#6A80A9] transition-colors">
            Register New Forwarder
          </h3>
          <p className="text-[13.5px] font-medium text-slate-500 mt-1.5 leading-relaxed">
            Add freight booking agent, contracted shipping lines, and monthly rate cards.
          </p>

          <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-50 border border-slate-200/80 px-3 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs">
              Booking Agent
            </span>
            <span className="rounded-full bg-slate-50 border border-slate-200/80 px-3 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs">
              Ocean Freight
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="mt-6 flex items-center gap-2.5">
        <div className="flex-1 rounded-2xl bg-black text-white font-bold text-[13px] py-3 px-5 shadow-md border border-black transition-all duration-200 group-hover:bg-slate-800 text-center flex items-center justify-center gap-1.5">
          <Plus className="size-4" />
          <span>+ Add Forwarder Profile</span>
        </div>
      </div>
    </button>
  );
}
