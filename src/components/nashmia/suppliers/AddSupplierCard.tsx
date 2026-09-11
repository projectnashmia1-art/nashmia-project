import { Plus } from "lucide-react";

interface AddSupplierCardProps {
  onClick: () => void;
}

export function AddSupplierCard({ onClick }: AddSupplierCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[290px] w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white p-6 text-center shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0FA3B1] hover:bg-[#E8F5F6]/20 hover:shadow-md"
    >
      {/* Plus Icon container */}
      <div className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-700 shadow-2xs transition-all duration-200 group-hover:scale-105 group-hover:border-[#0FA3B1] group-hover:bg-[#0FA3B1] group-hover:text-white">
        <Plus className="size-5 transition-transform duration-200 group-hover:rotate-90" />
      </div>

      <h3 className="mt-4 text-[15px] font-bold text-slate-900 tracking-tight">Add New Supplier</h3>
      <p className="mt-1 max-w-[220px] text-xs text-slate-500 leading-normal">
        Register an origin pickup vendor and define default cargo loading points
      </p>

      <span className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors group-hover:border-[#0FA3B1]/40 group-hover:bg-white group-hover:text-[#0FA3B1]">
        <Plus className="size-3" />
        <span>New Vendor</span>
      </span>
    </button>
  );
}
