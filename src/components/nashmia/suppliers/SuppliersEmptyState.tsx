import { Plus, RotateCcw, Search, Warehouse } from "lucide-react";

interface SuppliersEmptyStateProps {
  isSearchEmpty: boolean;
  onResetFilters: () => void;
  onAddSupplier: () => void;
}

export function SuppliersEmptyState({
  isSearchEmpty,
  onResetFilters,
  onAddSupplier,
}: SuppliersEmptyStateProps) {
  if (isSearchEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white px-6 py-16 text-center shadow-2xs">
        <div className="grid size-14 place-items-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 shadow-2xs">
          <Search className="size-7 stroke-[1.75]" />
        </div>

        <h3 className="mt-4 text-[19px] font-bold text-slate-900 tracking-tight">
          No matching suppliers found
        </h3>
        <p className="mt-1.5 max-w-md text-[13.5px] text-slate-500 leading-relaxed">
          We couldn't find any pickup vendors or loading locations matching your search query or
          active filter selection.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.99]"
          >
            <RotateCcw className="size-3.5 text-slate-400" />
            <span>Clear Filters & Reset</span>
          </button>
          <button
            type="button"
            onClick={onAddSupplier}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-5 text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-3.5" />
            <span>Register Supplier</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/90 bg-white px-6 py-20 text-center shadow-2xs">
      <div className="grid size-16 place-items-center rounded-2xl border border-[#C7E8E8] bg-[#E8F5F6] text-[#0FA3B1] shadow-2xs">
        <Warehouse className="size-8 stroke-[1.75]" />
      </div>

      <h3 className="mt-5 text-[22px] font-bold text-slate-900 tracking-tight">
        No registered suppliers yet
      </h3>
      <p className="mt-1.5 max-w-md text-[13.5px] text-slate-500 leading-relaxed">
        Register your first origin vendor to configure default factory load points, manage contact
        roles, and streamline container movement bookings.
      </p>

      <div className="mt-6">
        <button
          type="button"
          onClick={onAddSupplier}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-6 text-[13.5px] font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="size-4" />
          <span>Register First Supplier</span>
        </button>
      </div>
    </div>
  );
}
