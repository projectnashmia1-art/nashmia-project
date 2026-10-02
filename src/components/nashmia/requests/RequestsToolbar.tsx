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
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import type { RequestStatus, RequestPriority, RequestsFilterState } from "@/types/requests";

interface RequestsToolbarProps {
  filters: RequestsFilterState;
  onFilterChange: (updates: Partial<RequestsFilterState>) => void;
  statusCounts: Record<string, number>;
  totalFiltered: number;
}

const STATUS_TABS: { label: string; value: RequestStatus | "All" }[] = [
  { label: "All Requests", value: "All" },
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
          <LifecycleDropdownSelect
            value={filters.priority}
            onChange={(val) => onFilterChange({ priority: val as RequestPriority | "All" })}
            options={[
              { value: "All", label: "All Priorities" },
              { value: "Urgent", label: "🔴 Urgent Priority" },
              { value: "High", label: "🟠 High Priority" },
              { value: "Normal", label: "🟢 Normal Priority" },
              { value: "Flexible", label: "⚪ Flexible" },
            ]}
            placeholder="All Priorities"
            activeColor="teal"
            triggerClassName="h-10 min-w-[140px]"
          />

          {/* Carrier Filter */}
          <LifecycleDropdownSelect
            value={filters.carrier}
            onChange={(val) => onFilterChange({ carrier: val })}
            options={[
              { value: "", label: "All Shipping Lines" },
              { value: "MSC", label: "MSC Mediterranean" },
              { value: "Maersk", label: "Maersk Line" },
              { value: "CMA CGM", label: "CMA CGM" },
              { value: "Hapag-Lloyd", label: "Hapag-Lloyd" },
              { value: "ONE", label: "ONE Express" },
            ]}
            placeholder="All Shipping Lines"
            activeColor="teal"
            triggerClassName="h-10 min-w-[155px]"
          />

          {/* Sort By */}
          <LifecycleDropdownSelect
            value={filters.sortBy}
            onChange={(val) => onFilterChange({ sortBy: val as RequestsFilterState["sortBy"] })}
            options={[
              { value: "date-desc", label: "Newest First" },
              { value: "date-asc", label: "Oldest First" },
              { value: "priority-desc", label: "Highest Priority" },
              { value: "rate-desc", label: "Highest Freight Rate" },
              { value: "buyer-asc", label: "Buyer Name (A-Z)" },
            ]}
            placeholder="Sort By"
            icon={<ArrowUpDown className="size-3.5" />}
            activeColor="teal"
            triggerClassName="h-10 min-w-[140px]"
          />

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
            tab.value === "All" ? statusCounts["All"] || 0 : statusCounts[tab.value] || 0;
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
