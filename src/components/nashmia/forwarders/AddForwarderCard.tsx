import { Plus, Send } from "lucide-react";

interface AddForwarderCardProps {
  onAddForwarder: () => void;
}

export function AddForwarderCard({ onAddForwarder }: AddForwarderCardProps) {
  return (
    <button
      type="button"
      onClick={onAddForwarder}
      className="group relative flex h-[256px] w-full flex-col items-center justify-center rounded-[20px] border border-dashed border-[#6A80A9]/30 bg-white/70 p-6 text-center shadow-[0_10px_35px_rgba(0,0,0,0.03)] backdrop-blur-[24px] transition-all duration-300 hover:-translate-y-1 hover:border-[#6A80A9]/60 hover:bg-[#E8F1F3]/50 hover:shadow-[0_14px_40px_rgba(106,128,169,0.08)] active:scale-[0.99]"
    >
      {/* Plus Icon Container */}
      <div className="grid size-12 place-items-center rounded-[16px] border border-[#6A80A9]/20 bg-[#E8F1F3] text-[#6A80A9] shadow-2xs transition-all duration-300 group-hover:scale-110 group-hover:bg-[#6A80A9] group-hover:text-white">
        <Plus className="size-6 stroke-[2.5]" />
      </div>

      <h3 className="mt-3.5 text-[16.5px] font-bold tracking-tight text-[#000000] group-hover:text-[#6A80A9] transition-colors">
        + Add Forwarder
      </h3>

      <p className="mt-1 max-w-[220px] text-[12.5px] text-slate-500 leading-snug">
        Add a booking agent to your directory and configure shipping line agreements.
      </p>

      <div className="mt-4 flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11.5px] font-semibold text-[#6A80A9] shadow-2xs border border-[#6A80A9]/20 group-hover:bg-white">
        <Send className="size-3" />
        <span>New Booking Agent</span>
      </div>
    </button>
  );
}
