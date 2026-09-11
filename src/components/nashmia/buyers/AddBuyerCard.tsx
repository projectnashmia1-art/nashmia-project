import { Plus, UserPlus } from "lucide-react";

interface AddBuyerCardProps {
  onClick: () => void;
}

export function AddBuyerCard({ onClick }: AddBuyerCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[290px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-[#0FA3B1] hover:bg-[#E8F5F6]/30 hover:shadow-[0_12px_30px_-6px_rgba(15,163,177,0.12)] active:translate-y-0"
    >
      <div className="grid size-14 place-items-center rounded-2xl border border-[#C7E8E8] bg-white text-[#0FA3B1] shadow-sm transition-all duration-200 group-hover:scale-110 group-hover:bg-[#0FA3B1] group-hover:text-white">
        <UserPlus className="size-6 transition-transform duration-200 group-hover:scale-105" />
      </div>

      <h3 className="mt-4 text-[17px] font-bold text-slate-900 tracking-tight group-hover:text-[#0FA3B1] transition-colors">
        + Register New Buyer
      </h3>
      <p className="mt-1.5 max-w-[220px] text-[12.5px] text-slate-500 leading-relaxed">
        Add consignee profiles, export/import tax IDs, and assign port routing.
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-2xs transition-all group-hover:border-[#0FA3B1]/40 group-hover:text-[#0FA3B1]">
        <Plus className="size-3.5" />
        <span>Create Account</span>
      </span>
    </button>
  );
}
