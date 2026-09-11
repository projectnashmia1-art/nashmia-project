import { Building2, Download, Menu, Plus, Sparkles, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface BuyersHeaderProps {
  onOpenMobileMenu?: () => void;
  onAddBuyer: () => void;
  totalBuyersCount?: number;
}

export function BuyersHeader({
  onOpenMobileMenu,
  onAddBuyer,
  totalBuyersCount,
}: BuyersHeaderProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      {/* Left side: Eyebrow + Large Title + Subtitle */}
      <div className="flex items-start gap-3.5">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Toggle navigation menu"
            className="mt-1 grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-sm transition-all hover:bg-slate-50 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5F6] border border-[#C7E8E8] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0FA3B1]">
              <Users className="size-3" />
              Consignee Directory
            </span>
            {totalBuyersCount !== undefined && (
              <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {totalBuyersCount} Registered
              </span>
            )}
          </div>
          <h1 className="text-[30px] font-bold tracking-tight text-slate-900 sm:text-[36px] lg:text-[38px] leading-tight">
            Buyers & Accounts
          </h1>
          <p className="max-w-2xl text-[14px] text-slate-500 leading-relaxed">
            Manage your global consignees, commercial accounts, and container shipment allocations.
          </p>
        </div>
      </div>

      {/* Right side: Action Buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/new-booking"
          className="flex h-[46px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[13.5px] font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900"
        >
          <Building2 className="size-4 text-slate-400" />
          <span>New Booking</span>
        </Link>

        <button
          type="button"
          onClick={onAddBuyer}
          className="group relative flex h-[46px] items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-5 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(15,163,177,0.3)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
        >
          <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
          <span>+ Add Buyer</span>
        </button>
      </div>
    </header>
  );
}
