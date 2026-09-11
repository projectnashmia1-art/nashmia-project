import { useEffect, useRef } from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Filter,
  Globe2,
  LayoutGrid,
  List,
  MapPin,
  RotateCcw,
  Search,
  Warehouse,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LOAD_POINT_TYPE_OPTIONS,
  SUPPLIER_COUNTRY_OPTIONS,
  SUPPLIER_SORT_OPTIONS,
} from "@/lib/suppliers-data";
import { cn } from "@/lib/utils";

interface SuppliersToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedCountry: string;
  onCountryChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (val: string) => void;
  selectedLoadPoint: string;
  onLoadPointChange: (val: string) => void;
  sortBy: string;
  onSortChange: (val: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onResetFilters: () => void;
}

export function SuppliersToolbar({
  searchQuery,
  onSearchChange,
  selectedCountry,
  onCountryChange,
  selectedStatus,
  onStatusChange,
  selectedLoadPoint,
  onLoadPointChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onResetFilters,
}: SuppliersToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedCountry !== "all" ||
    selectedStatus !== "all" ||
    selectedLoadPoint !== "all" ||
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

  const currentSortLabel = SUPPLIER_SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Sort";

  // Quick filter presets
  const quickFilters = [
    {
      label: "All Suppliers",
      active: selectedCountry === "all" && selectedStatus === "all" && selectedLoadPoint === "all",
      onClick: () => {
        onCountryChange("all");
        onStatusChange("all");
        onLoadPointChange("all");
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
      label: "Warehouses Only",
      active: selectedLoadPoint === "Warehouse",
      onClick: () => onLoadPointChange(selectedLoadPoint === "Warehouse" ? "all" : "Warehouse"),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-slate-200/90 bg-white p-3 shadow-2xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* LEFT: Large Spotlight Search */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by supplier name, code, contact person, city, or loading point..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-10 pr-20 text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all focus:border-[#0FA3B1] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/15"
            />

            <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  aria-label="Clear search input"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none hidden items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400 shadow-2xs sm:inline-flex">
                  ⌘ K
                </kbd>
              )}
            </div>
          </div>

          {/* RIGHT: Dropdown Filters & Grid/List Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Load Point Type Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    selectedLoadPoint !== "all"
                      ? "border-[#0FA3B1] bg-[#E8F5F6] text-[#0FA3B1]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <Warehouse className="size-3.5 text-[#0FA3B1]" />
                  <span className="max-w-[130px] truncate">
                    {selectedLoadPoint === "all" ? "Load Point" : selectedLoadPoint}
                  </span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Filter by Loading Type
                </DropdownMenuLabel>
                {LOAD_POINT_TYPE_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onLoadPointChange(opt.value)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <span>{opt.label}</span>
                    {selectedLoadPoint === opt.value && (
                      <Check className="size-3.5 text-[#0FA3B1]" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Country Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    selectedCountry !== "all"
                      ? "border-[#0FA3B1] bg-[#E8F5F6] text-[#0FA3B1]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <Globe2 className="size-3.5 text-slate-500" />
                  <span className="max-w-[120px] truncate">
                    {selectedCountry === "all" ? "Country" : selectedCountry}
                  </span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Filter by Country
                </DropdownMenuLabel>
                <DropdownMenuItem
                  key="all"
                  onClick={() => onCountryChange("all")}
                  className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <span>All Countries</span>
                  {selectedCountry === "all" && <Check className="size-3.5 text-[#0FA3B1]" />}
                </DropdownMenuItem>
                {SUPPLIER_COUNTRY_OPTIONS.filter((c) => c !== "All Countries").map((country) => (
                  <DropdownMenuItem
                    key={country}
                    onClick={() => onCountryChange(country)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <span>{country}</span>
                    {selectedCountry === country && <Check className="size-3.5 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[13px] font-semibold transition-colors",
                    selectedStatus !== "all"
                      ? "border-[#0FA3B1] bg-[#E8F5F6] text-[#0FA3B1]"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <Filter className="size-3.5 text-slate-500" />
                  <span>{selectedStatus === "all" ? "Status" : selectedStatus}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Account Status
                </DropdownMenuLabel>
                {[
                  { label: "All Statuses", value: "all" },
                  { label: "Active Only", value: "Active" },
                  { label: "Inactive", value: "Inactive" },
                  { label: "Archived", value: "Archived" },
                ].map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onStatusChange(opt.value)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <span>{opt.label}</span>
                    {selectedStatus === opt.value && <Check className="size-3.5 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <ArrowUpDown className="size-3.5 text-slate-500" />
                  <span className="hidden sm:inline">{currentSortLabel}</span>
                  <ChevronDown className="size-3.5 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Sort Directory
                </DropdownMenuLabel>
                {SUPPLIER_SORT_OPTIONS.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onSortChange(opt.value)}
                    className="flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <span>{opt.label}</span>
                    {sortBy === opt.value && <Check className="size-3.5 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reset Button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={onResetFilters}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="size-3.5 text-slate-400" />
                <span className="hidden md:inline">Reset</span>
              </button>
            )}

            {/* View Mode Toggle: Grid vs List */}
            <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5">
              <button
                type="button"
                onClick={() => onViewModeChange("grid")}
                aria-label="Grid View"
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-all",
                  viewMode === "grid"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-400 hover:text-slate-700",
                )}
                title="Grid view"
              >
                <LayoutGrid className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("list")}
                aria-label="List View"
                className={cn(
                  "flex size-9 items-center justify-center rounded-lg transition-all",
                  viewMode === "list"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-400 hover:text-slate-700",
                )}
                title="Table list view"
              >
                <List className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filter Pill Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400 pr-1">
          Quick Filters:
        </span>
        {quickFilters.map((pill) => (
          <button
            key={pill.label}
            type="button"
            onClick={pill.onClick}
            className={cn(
              "inline-flex h-7 items-center rounded-lg border px-3 text-xs font-semibold transition-all",
              pill.active
                ? "border-[#0FA3B1] bg-[#0FA3B1] text-white shadow-2xs"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
            )}
          >
            {pill.label}
          </button>
        ))}
      </div>
    </div>
  );
}
