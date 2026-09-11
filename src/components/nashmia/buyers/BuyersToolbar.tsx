import { useEffect, useRef } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Filter,
  Globe2,
  LayoutGrid,
  List,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COUNTRY_FILTER_OPTIONS, SORT_OPTIONS } from "@/lib/buyers-data";
import { cn } from "@/lib/utils";

interface BuyersToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCountry: string;
  onCountryChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (val: string) => void;
  sortBy: string;
  onSortChange: (val: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (val: "grid" | "list") => void;
  onResetFilters: () => void;
}

export function BuyersToolbar({
  searchQuery,
  onSearchChange,
  selectedCountry,
  onCountryChange,
  selectedStatus,
  onStatusChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onResetFilters,
}: BuyersToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedCountry !== "all" ||
    selectedStatus !== "all" ||
    sortBy !== "name-asc";

  // Global ⌘K / Ctrl+K keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const currentSortLabel = SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Sort";

  // Quick preset pills
  const quickFilters = [
    {
      label: "All Accounts",
      active: selectedCountry === "all" && selectedStatus === "all",
      onClick: () => {
        onCountryChange("all");
        onStatusChange("all");
      },
    },
    {
      label: "Active Only",
      active: selectedStatus === "Active",
      onClick: () => onStatusChange(selectedStatus === "Active" ? "all" : "Active"),
    },
    {
      label: "United Kingdom",
      active: selectedCountry === "United Kingdom",
      onClick: () =>
        onCountryChange(selectedCountry === "United Kingdom" ? "all" : "United Kingdom"),
    },
    {
      label: "Pakistan",
      active: selectedCountry === "Pakistan",
      onClick: () => onCountryChange(selectedCountry === "Pakistan" ? "all" : "Pakistan"),
    },
    {
      label: "Spain",
      active: selectedCountry === "Spain",
      onClick: () => onCountryChange(selectedCountry === "Spain" ? "all" : "Spain"),
    },
    {
      label: "Germany",
      active: selectedCountry === "Germany",
      onClick: () => onCountryChange(selectedCountry === "Germany" ? "all" : "Germany"),
    },
  ];

  return (
    <div className="space-y-3">
      {/* Main Search & Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03),0_8px_20px_-6px_rgba(0,0,0,0.04)] lg:flex-row lg:items-center lg:justify-between">
        {/* LEFT: Spotlight Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by buyer name, company, contact person, or account code..."
            className="h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-11 pr-20 text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-[#0FA3B1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,163,177,0.12)] focus:outline-none"
          />

          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search input"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none hidden items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-400 shadow-2xs sm:inline-flex">
                ⌘ K
              </kbd>
            )}
          </div>
        </div>

        {/* RIGHT: Dropdowns & View Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Country Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-[42px] items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold transition-all duration-200",
                  selectedCountry !== "all"
                    ? "border-[#0FA3B1]/40 bg-[#E8F5F6] text-[#0FA3B1]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <Globe2 className="size-3.5 text-slate-400" />
                <span className="max-w-[120px] truncate">
                  {selectedCountry === "all" ? "Country" : selectedCountry}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Filter by Country
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onCountryChange("all")}
                className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>All Countries</span>
                {selectedCountry === "all" && <Check className="size-4 text-[#0FA3B1]" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <div className="max-h-56 overflow-y-auto">
                {COUNTRY_FILTER_OPTIONS.filter((c) => c !== "All Countries").map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => onCountryChange(c)}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                  >
                    <span>{c}</span>
                    {selectedCountry === c && <Check className="size-4 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-[42px] items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold transition-all duration-200",
                  selectedStatus !== "all"
                    ? "border-[#0FA3B1]/40 bg-[#E8F5F6] text-[#0FA3B1]"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                )}
              >
                <Filter className="size-3.5 text-slate-400" />
                <span>{selectedStatus === "all" ? "Status" : selectedStatus}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Filter by Status
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onStatusChange("all")}
                className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>All Statuses</span>
                {selectedStatus === "all" && <Check className="size-4 text-[#0FA3B1]" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <DropdownMenuItem
                onClick={() => onStatusChange("Active")}
                className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Active</span>
                </div>
                {selectedStatus === "Active" && <Check className="size-4 text-[#0FA3B1]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange("Inactive")}
                className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-slate-400" />
                  <span>Inactive</span>
                </div>
                {selectedStatus === "Inactive" && <Check className="size-4 text-[#0FA3B1]" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-[42px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-[13px] font-semibold text-slate-700 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
              >
                <ArrowUpDown className="size-3.5 text-slate-400" />
                <span className="hidden sm:inline">{currentSortLabel}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Sort Buyers By
              </DropdownMenuLabel>
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                >
                  <span>{opt.label}</span>
                  {sortBy === opt.value && <Check className="size-4 text-[#0FA3B1]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear Filters (if active) */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
            >
              <RotateCcw className="size-3.5" />
              <span>Clear</span>
            </button>
          )}

          {/* Divider */}
          <div className="mx-0.5 hidden h-6 w-px bg-slate-200 sm:block" />

          {/* View Control: Grid View (Default) vs List View */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50/70 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              aria-label="Switch to Grid View"
              className={cn(
                "grid size-8 place-items-center rounded-lg transition-all duration-200",
                viewMode === "grid"
                  ? "bg-[#0FA3B1] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-800",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              aria-label="Switch to List View"
              className={cn(
                "grid size-8 place-items-center rounded-lg transition-all duration-200",
                viewMode === "list"
                  ? "bg-[#0FA3B1] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-800",
              )}
            >
              <List className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="text-[11.5px] font-semibold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
          Quick Filters:
        </span>
        {quickFilters.map((qf) => (
          <button
            key={qf.label}
            type="button"
            onClick={qf.onClick}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-all shrink-0",
              qf.active
                ? "bg-[#0FA3B1] text-white shadow-sm"
                : "border border-slate-200/80 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {qf.label}
          </button>
        ))}
      </div>
    </div>
  );
}
