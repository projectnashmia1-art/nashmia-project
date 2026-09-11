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
  Ship,
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
import {
  FORWARDER_COUNTRY_OPTIONS,
  FORWARDER_SHIPPING_LINES_OPTIONS,
  FORWARDER_SORT_OPTIONS,
} from "@/lib/forwarders-data";
import { cn } from "@/lib/utils";

interface ForwardersToolbarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  selectedShippingLine: string;
  onShippingLineChange: (val: string) => void;
  selectedStatus: string;
  onStatusChange: (val: string) => void;
  selectedCountry: string;
  onCountryChange: (val: string) => void;
  sortBy: string;
  onSortChange: (val: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onResetFilters: () => void;
}

export function ForwardersToolbar({
  searchQuery,
  onSearchChange,
  selectedShippingLine,
  onShippingLineChange,
  selectedStatus,
  onStatusChange,
  selectedCountry,
  onCountryChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onResetFilters,
}: ForwardersToolbarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasActiveFilters =
    searchQuery !== "" ||
    selectedShippingLine !== "all" ||
    selectedStatus !== "all" ||
    selectedCountry !== "all" ||
    sortBy !== "name-asc";

  // Global ⌘K / Ctrl+K keyboard shortcut
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

  const currentSortLabel = FORWARDER_SORT_OPTIONS.find((s) => s.value === sortBy)?.label || "Sort";

  return (
    <div className="relative rounded-[18px] border border-white/85 bg-white/72 p-3 shadow-[0_16px_44px_rgba(15,23,42,0.04)] backdrop-blur-[24px] transition-all duration-300">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        {/* LEFT: Spotlight Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search forwarders, contacts or email..."
            className="h-[46px] w-full rounded-[14px] border border-slate-200/70 bg-white/60 pl-11 pr-20 text-[14px] text-black placeholder:text-slate-400 transition-all duration-200 focus:border-[#6A80A9]/50 focus:bg-[#E8F1F3]/40 focus:shadow-[0_0_0_3px_rgba(106,128,169,0.12)] focus:outline-none"
          />

          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search input"
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
              >
                <X className="size-3.5" />
              </button>
            ) : (
              <kbd className="pointer-events-none hidden items-center gap-0.5 rounded-[7px] border border-slate-200/80 bg-white/80 px-2 py-1 font-mono text-[11px] font-medium text-slate-400 shadow-2xs sm:inline-flex">
                ⌘ K
              </kbd>
            )}
          </div>
        </div>

        {/* RIGHT: Filters & Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shipping Line Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-[42px] items-center gap-2 rounded-[13px] border px-3.5 text-[13px] font-medium transition-all duration-200",
                  selectedShippingLine !== "all"
                    ? "border-[#6A80A9]/40 bg-[#6A80A9]/15 text-[#3D5276] shadow-xs"
                    : "border-slate-200/70 bg-white/60 text-slate-700 hover:bg-white hover:text-black",
                )}
              >
                <Ship className="size-3.5 text-[#6A80A9]" />
                <span className="max-w-[130px] truncate">
                  {selectedShippingLine === "all" ? "Shipping Line" : selectedShippingLine}
                </span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Filter by Carrier Line
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onShippingLineChange("all")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>All Shipping Lines</span>
                {selectedShippingLine === "all" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <div className="max-h-56 overflow-y-auto">
                {FORWARDER_SHIPPING_LINES_OPTIONS.filter((sl) => sl !== "All Shipping Lines").map(
                  (sl) => (
                    <DropdownMenuItem
                      key={sl}
                      onClick={() => onShippingLineChange(sl)}
                      className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                    >
                      <span>{sl}</span>
                      {selectedShippingLine === sl && <Check className="size-4 text-[#6A80A9]" />}
                    </DropdownMenuItem>
                  ),
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-[42px] items-center gap-2 rounded-[13px] border px-3.5 text-[13px] font-medium transition-all duration-200",
                  selectedStatus !== "all"
                    ? "border-[#6A80A9]/30 bg-[#6A80A9]/10 text-[#6A80A9] shadow-xs"
                    : "border-slate-200/70 bg-white/60 text-slate-700 hover:bg-white hover:text-black",
                )}
              >
                <Filter className="size-3.5 text-slate-400" />
                <span>{selectedStatus === "all" ? "Status" : selectedStatus}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Filter by Status
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onStatusChange("all")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>All Statuses</span>
                {selectedStatus === "all" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <DropdownMenuItem
                onClick={() => onStatusChange("Active")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span>Active</span>
                </div>
                {selectedStatus === "Active" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onStatusChange("Inactive")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
              >
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-slate-400" />
                  <span>Inactive</span>
                </div>
                {selectedStatus === "Inactive" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Country Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-[42px] items-center gap-2 rounded-[13px] border px-3.5 text-[13px] font-medium transition-all duration-200",
                  selectedCountry !== "all"
                    ? "border-[#6A80A9]/30 bg-[#6A80A9]/10 text-[#6A80A9] shadow-xs"
                    : "border-slate-200/70 bg-white/60 text-slate-700 hover:bg-white hover:text-black",
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
              className="w-56 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Filter by Country
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => onCountryChange("all")}
                className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
              >
                <span>All Countries</span>
                {selectedCountry === "all" && <Check className="size-4 text-[#6A80A9]" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1 bg-slate-100" />
              <div className="max-h-52 overflow-y-auto">
                {FORWARDER_COUNTRY_OPTIONS.filter((c) => c !== "All Countries").map((c) => (
                  <DropdownMenuItem
                    key={c}
                    onClick={() => onCountryChange(c)}
                    className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                  >
                    <span>{c}</span>
                    {selectedCountry === c && <Check className="size-4 text-[#6A80A9]" />}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-[42px] items-center gap-2 rounded-[13px] border border-slate-200/70 bg-white/60 px-3.5 text-[13px] font-medium text-slate-700 transition-all duration-200 hover:bg-white hover:text-black"
              >
                <ArrowUpDown className="size-3.5 text-slate-400" />
                <span>{currentSortLabel}</span>
                <ChevronDown className="size-3.5 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-56 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
            >
              <DropdownMenuLabel className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Sort Forwarders By
              </DropdownMenuLabel>
              {FORWARDER_SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className="flex cursor-pointer items-center justify-between rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                >
                  <span>{opt.label}</span>
                  {sortBy === opt.value && <Check className="size-4 text-[#6A80A9]" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View Toggle: Grid View (Default) vs List View */}
          <div className="flex items-center rounded-[13px] border border-slate-200/70 bg-white/60 p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => onViewModeChange("grid")}
              className={cn(
                "flex size-[34px] items-center justify-center rounded-[9px] transition-all",
                viewMode === "grid"
                  ? "bg-[#6A80A9] text-white shadow-2xs"
                  : "text-slate-400 hover:text-black",
              )}
              title="Grid View (Default)"
            >
              <LayoutGrid className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("list")}
              className={cn(
                "flex size-[34px] items-center justify-center rounded-[9px] transition-all",
                viewMode === "list"
                  ? "bg-[#6A80A9] text-white shadow-2xs"
                  : "text-slate-400 hover:text-black",
              )}
              title="List View"
            >
              <List className="size-4" />
            </button>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex h-[42px] items-center gap-1.5 rounded-[13px] border border-slate-200/60 bg-white px-3 text-[12.5px] font-medium text-slate-600 shadow-2xs transition-all hover:bg-slate-50 hover:text-slate-900"
            >
              <RotateCcw className="size-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
