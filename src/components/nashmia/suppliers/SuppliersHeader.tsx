import { Menu, Plus, Warehouse } from "lucide-react";

interface SuppliersHeaderProps {
  onOpenMobileMenu?: () => void;
  onAddSupplier: () => void;
}

export function SuppliersHeader({ onOpenMobileMenu, onAddSupplier }: SuppliersHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      {/* Left side: Eyebrow + Title + Subtitle */}
      <div className="flex items-start gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Toggle navigation menu"
            className="mt-1 grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:bg-slate-50 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}

        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md border border-[#C7E8E8] bg-[#E8F5F6] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0FA3B1]">
              <Warehouse className="size-3" />
              Vendor Network
            </span>
          </div>
          <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900 leading-tight">
            Suppliers & Pickup Points
          </h1>
          <p className="max-w-2xl text-[13.5px] text-slate-500 font-normal">
            Manage origin suppliers, certified factories, and primary cargo loading locations.
          </p>
        </div>
      </div>

      {/* Right side: Primary Register Button */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onAddSupplier}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="size-4" />
          <span>Register Supplier</span>
        </button>
      </div>
    </header>
  );
}
