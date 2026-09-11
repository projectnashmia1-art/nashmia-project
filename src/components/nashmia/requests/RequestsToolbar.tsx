import { memo } from "react";
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Table as TableIcon,
  Kanban,
  X,
  Filter,
  ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { RequestStatus, RequestPriority, RequestsFilterState } from "@/types/requests";

interface RequestsToolbarProps {
  filters: RequestsFilterState;
  onFilterChange: (updates: Partial<RequestsFilterState>) => void;
  statusCounts: Record<string, number>;
  totalFiltered: number;
  forwarderOffersCount?: number;
}

const STATUS_TABS: { label: string; value: RequestStatus | "All" | "Forwarder Offers" }[] = [
  { label: "All Requests", value: "All" },
  { label: "Forwarder Offers", value: "Forwarder Offers" },
  { label: "Pending Review", value: "Pending Review" },
  { label: "Rate Verification", value: "Rate Verification" },
  { label: "Line Allocation", value: "Line Allocation" },
  { label: "Approved", value: "Approved" },
  { label: "Needs Revision", value: "Revision Requested" },
];

export const RequestsToolbar = memo(function RequestsToolbar({
  filters,
  onFilterChange,
  statusCounts,
  totalFiltered,
  forwarderOffersCount = 0,
}: RequestsToolbarProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.status !== "All" ||
    filters.priority !== "All" ||
    filters.carrier !== "" ||
    filters.pol !== "" ||
    filters.pod !== "";

  const handleResetFilters = () => {
    onFilterChange({
      search: "",
      status: "All",
      priority: "All",
      carrier: "",
      pol: "",
      pod: "",
    });
  };

  return (
    <div className="flex flex-col gap-3.5">
      {/* Top row: Search, Filter dropdowns, View switch */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search ref #, buyer, supplier, port, cargo, HS code..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            className="h-10 pl-9.5 pr-8 text-[13.5px] border-slate-200 bg-white placeholder:text-slate-400 focus-visible:ring-[#0FA3B1]"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => onFilterChange({ search: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filters & View switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Priority filter */}
          <select
            value={filters.priority}
            onChange={(e) =>
              onFilterChange({ priority: e.target.value as RequestPriority | "All" })
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
          >
            <option value="All">All Priorities</option>
            <option value="Urgent">🔴 Urgent Priority</option>
            <option value="High">🟠 High Priority</option>
            <option value="Normal">🟢 Normal Priority</option>
            <option value="Flexible">⚪ Flexible</option>
          </select>

          {/* Carrier Filter */}
          <select
            value={filters.carrier}
            onChange={(e) => onFilterChange({ carrier: e.target.value })}
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
          >
            <option value="">All Shipping Lines</option>
            <option value="MSC">MSC Mediterranean Shipping</option>
            <option value="Maersk">Maersk Line</option>
            <option value="CMA CGM">CMA CGM</option>
            <option value="Hapag-Lloyd">Hapag-Lloyd</option>
            <option value="ONE">ONE (Ocean Network Express)</option>
          </select>

          {/* Sort By */}
          <select
            value={filters.sortBy}
            onChange={(e) =>
              onFilterChange({ sortBy: e.target.value as RequestsFilterState["sortBy"] })
            }
            className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-sm focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="priority-desc">Highest Priority</option>
            <option value="rate-desc">Highest Freight Rate</option>
            <option value="buyer-asc">Buyer Name (A-Z)</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="h-10 px-2.5 text-[12.5px] text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <X className="mr-1 size-3.5" />
              Reset
            </Button>
          )}

          {/* View Switcher Toggle */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1">
            <button
              type="button"
              onClick={() => onFilterChange({ viewMode: "grid" })}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition-all ${
                filters.viewMode === "grid"
                  ? "bg-white text-[#0FA3B1] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Card Grid View"
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Cards</span>
            </button>
            <button
              type="button"
              onClick={() => onFilterChange({ viewMode: "table" })}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition-all ${
                filters.viewMode === "table"
                  ? "bg-white text-[#0FA3B1] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Dense Table View"
            >
              <TableIcon className="size-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => onFilterChange({ viewMode: "kanban" })}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition-all ${
                filters.viewMode === "kanban"
                  ? "bg-white text-[#0FA3B1] shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="Stage Kanban View"
            >
              <Kanban className="size-3.5" />
              <span className="hidden sm:inline">Stages</span>
            </button>
          </div>
        </div>
      </div>

      {/* Status Filter Tabs / Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {STATUS_TABS.map((tab) => {
          const count =
            tab.value === "All"
              ? statusCounts["All"] || 0
              : tab.value === "Forwarder Offers"
                ? forwarderOffersCount
                : statusCounts[tab.value] || 0;
          const isActive = filters.status === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onFilterChange({ status: tab.value })}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-1.5 text-[13px] font-semibold transition-all ${
                isActive
                  ? "bg-[#0FA3B1] text-white shadow-xs"
                  : "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] font-bold ${
                  isActive ? "bg-white/25 text-white" : "bg-white text-slate-700 shadow-xs"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        <div className="ml-auto hidden items-center text-[12.5px] text-slate-500 md:flex">
          Showing <span className="mx-1 font-bold text-slate-800">{totalFiltered}</span> requests
        </div>
      </div>
    </div>
  );
});
