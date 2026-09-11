import { Plus, RotateCcw, Search, Send } from "lucide-react";

interface ForwardersEmptyStateProps {
  isSearchEmpty?: boolean;
  onResetFilters: () => void;
  onAddForwarder: () => void;
}

export function ForwardersEmptyState({
  isSearchEmpty = false,
  onResetFilters,
  onAddForwarder,
}: ForwardersEmptyStateProps) {
  if (isSearchEmpty) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[24px] border border-white/80 bg-white/70 px-6 py-16 text-center shadow-[0_12px_36px_rgba(15,23,42,0.03)] backdrop-blur-xl">
        <div className="grid size-16 place-items-center rounded-2xl border border-slate-200/80 bg-[#E8F1F3]/80 text-[#6A80A9] shadow-sm">
          <Search className="size-7" />
        </div>
        <h3 className="mt-4 text-[18px] font-semibold text-[#000000]">No Forwarders Found</h3>
        <p className="mt-1.5 max-w-md text-[13.5px] text-slate-500">
          No booking agents match your current search criteria or active filters.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-[12px] border border-slate-200/80 bg-white px-4 text-[13px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <RotateCcw className="size-3.5" />
          <span>Clear Filters</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-[24px] border border-white/80 bg-white/70 px-6 py-20 text-center shadow-[0_12px_36px_rgba(15,23,42,0.03)] backdrop-blur-xl">
      <div className="grid size-18 place-items-center rounded-2xl border border-[#6A80A9]/20 bg-[#E8F1F3] text-[#6A80A9] shadow-sm">
        <Send className="size-8" />
      </div>
      <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.02em] text-[#000000]">
        No Forwarders Yet
      </h3>
      <p className="mt-1.5 max-w-md text-[14px] text-slate-500 leading-relaxed">
        Add your booking agents to start managing booking requests and agreed rates.
      </p>
      <button
        type="button"
        onClick={onAddForwarder}
        className="mt-6 flex h-[48px] items-center gap-2 rounded-[14px] bg-[#000000] px-6 text-[14px] font-medium text-white shadow-[0_8px_20px_rgba(0,0,0,0.14)] hover:bg-slate-900 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <Plus className="size-4" />
        <span>+ Add Forwarder</span>
      </button>
    </div>
  );
}
