import React from "react";
import {
  Search,
  Building2,
  MapPin,
  ArrowUpDown,
  LayoutGrid,
  List,
  RotateCcw,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface RateCardsToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedForwarder: string;
  onForwarderChange: (val: string) => void;
  forwardersList: { id: string; name: string; code?: string }[];
  sortBy: string;
  onSortChange: (val: string) => void;
  viewMode: "table" | "grid";
  onViewModeChange: (mode: "table" | "grid") => void;
  onResetFilters: () => void;
}

export function RateCardsToolbar({
  searchQuery,
  onSearchChange,
  selectedForwarder,
  onForwarderChange,
  forwardersList,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onResetFilters,
}: RateCardsToolbarProps) {
  const hasActiveFilters = searchQuery !== "" || selectedForwarder !== "all" || sortBy !== "recent";

  const selectedForwarderObj = forwardersList.find((f) => f.id === selectedForwarder);

  return (
    <div className="relative rounded-[18px] border border-white/85 bg-white/72 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.04)] backdrop-blur-[24px] transition-all duration-300">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* LEFT: Search Input for Pickup Point or Forwarder */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search pickup point or forwarder name..."
            className="h-[46px] w-full rounded-[14px] border border-slate-200/70 bg-white/60 pl-11 pr-12 text-[14px] text-black placeholder:text-slate-400 transition-all duration-200 focus:border-[#6A80A9]/50 focus:bg-[#E8F1F3]/40 focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)] focus:outline-none"
          />

          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Clear search input"
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* RIGHT: Filters & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Forwarder Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-[42px] items-center gap-2 rounded-[13px] border px-3.5 text-[13px] font-medium transition-all duration-200 cursor-pointer",
                  selectedForwarder !== "all"
                    ? "border-[#6A80A9]/40 bg-[#6A80A9]/15 text-[#3D5276] shadow-xs"
                    : "border-slate-200/70 bg-white/60 text-slate-700 hover:bg-white hover:text-black",
                )}
              >
                <Building2 className="size-3.5 text-[#6A80A9]" />
                <span className="max-w-[130px] truncate">
                  {selectedForwarder === "all"
                    ? "All Forwarders"
                    : selectedForwarderObj?.name || "Forwarder"}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-2xl backdrop-blur-2xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Filter by Forwarder
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onForwarderChange("all")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>All Forwarders</span>
                {selectedForwarder === "all" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <div className="max-h-56 overflow-y-auto scrollbar-thin">
                {forwardersList.map((fwd) => (
                  <DropdownMenuItem
                    key={fwd.id}
                    onClick={() => onForwarderChange(fwd.id)}
                    className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                  >
                    <span className="truncate">{fwd.name}</span>
                    {selectedForwarder === fwd.id && <Check className="size-4 text-[#6A80A9]" />}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-[42px] items-center gap-2 rounded-[13px] border border-slate-200/70 bg-white/60 px-3.5 text-[13px] font-medium text-slate-700 hover:bg-white hover:text-black transition-all cursor-pointer"
              >
                <ArrowUpDown className="size-3.5 text-slate-400" />
                <span>
                  {sortBy === "rate-asc"
                    ? "Rate: Low to High"
                    : sortBy === "rate-desc"
                      ? "Rate: High to Low"
                      : "Recently Added"}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-52 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-2xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Sort Rates By
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onSortChange("recent")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>Recently Added</span>
                {sortBy === "recent" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSortChange("rate-asc")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>Rate: Low to High</span>
                {sortBy === "rate-asc" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSortChange("rate-desc")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>Rate: High to Low</span>
                {sortBy === "rate-desc" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-[13px] border border-slate-200/80 bg-white px-3 text-[12px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="size-3.5 text-slate-400" />
              <span>Reset</span>
            </button>
          )}

          {/* View Mode Toggle (Table / Grid) */}
          <div className="flex h-[42px] items-center rounded-[13px] border border-slate-200/70 bg-slate-100/70 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              className={cn(
                "flex size-8 items-center justify-center rounded-[10px] transition-all cursor-pointer",
                viewMode === "table"
                  ? "bg-white text-black shadow-xs font-bold"
                  : "text-slate-400 hover:text-slate-700",
              )}
              title="Table View"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "flex size-8 items-center justify-center rounded-[10px] transition-all cursor-pointer",
                viewMode === "grid"
                  ? "bg-white text-black shadow-xs font-bold"
                  : "text-slate-400 hover:text-slate-700",
              )}
              title="Grid View"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
