import { memo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ClipboardList,
  Plus,
  RefreshCw,
  Download,
  Menu,
  Sparkles,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RequestsHeaderProps {
  onOpenMobileMenu?: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  onExportCsv?: () => void;
  onOpenMultiForwarderModal?: () => void;
  totalRequests: number;
  pendingCount: number;
}

export const RequestsHeader = memo(function RequestsHeader({
  onOpenMobileMenu,
  onRefresh,
  isRefreshing = false,
  onExportCsv,
  onOpenMultiForwarderModal,
  totalRequests,
  pendingCount,
}: RequestsHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-slate-200/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
      {/* Title & Context */}
      <div className="flex items-start gap-3">
        {onOpenMobileMenu && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onOpenMobileMenu}
            className="size-9 shrink-0 border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
            aria-label="Open mobile navigation"
          >
            <Menu className="size-5" />
          </Button>
        )}

        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl border border-[#0FA3B1]/25 bg-gradient-to-br from-[#E8F5F6] to-[#D4EFF2] text-[#0FA3B1] shadow-sm">
            <ClipboardList className="size-5" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight text-slate-900 sm:text-[24px]">
                Booking Requests
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-emerald-700">
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
                Live Desk
              </span>
              {pendingCount > 0 && (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-bold text-amber-800">
                  {pendingCount} Awaiting Review
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Review freight bookings, verify carrier rates, allocate equipment, and confirm export
              schedules.
            </p>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-9 gap-1.5 border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        >
          <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-[#0FA3B1]" : ""}`} />
          <span className="hidden sm:inline">Refresh</span>
        </Button>

        {onExportCsv && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExportCsv}
            className="h-9 gap-1.5 border-slate-200/90 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          >
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        )}

        {onOpenMultiForwarderModal && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenMultiForwarderModal}
            className="h-9 gap-1.5 border-[#0FA3B1]/30 bg-[#E8F5F6]/40 text-[#0FA3B1] hover:bg-[#E8F5F6] font-semibold"
          >
            <Users className="size-3.5" />
            <span>Request Quotes</span>
          </Button>
        )}

        <Button
          asChild
          size="sm"
          className="h-9 gap-1.5 bg-[#0FA3B1] px-4 font-semibold text-white shadow-sm hover:bg-[#0D919E] active:scale-[0.98]"
        >
          <Link to="/new-booking">
            <Plus className="size-4" />
            <span>New Booking</span>
          </Link>
        </Button>
      </div>
    </header>
  );
});
