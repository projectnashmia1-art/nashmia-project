import { useState } from "react";
import {
  Box,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Minus,
  Package,
  Plus,
  Sparkles,
} from "lucide-react";
import { CONTAINER_SPECS, type ContainerSize } from "@/lib/booking-data";
import { cn } from "@/lib/utils";
import { NashmiaCustomDatePicker } from "./NashmiaCustomDatePicker";

interface ContainerCargoSectionProps {
  containerSize: ContainerSize;
  onSelectSize?: (size: ContainerSize) => void;
  onSelectContainerSize?: (size: ContainerSize) => void;
  quantity: number;
  onChangeQuantity: (qty: number) => void;
  productDescription: string;
  onChangeProductDescription: (desc: string) => void;
  loadingDate: string;
  onChangeLoadingDate: (date: string) => void;
  errors?: {
    size?: string;
    quantity?: string;
    productDescription?: string;
    loadingDate?: string;
  };
}

const COMMON_COMMODITIES = [
  "Used Clothing & Textiles",
  "Cotton Yarn & Fabrics",
  "Surgical Instruments",
  "Leather Goods & Footwear",
  "Sports Goods & Accessories",
  "Industrial Hardware",
];

export function ContainerCargoSection({
  containerSize,
  onSelectSize,
  onSelectContainerSize,
  quantity,
  onChangeQuantity,
  productDescription,
  onChangeProductDescription,
  loadingDate,
  onChangeLoadingDate,
  errors,
}: ContainerCargoSectionProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleSelectSize = (size: ContainerSize) => {
    if (typeof onSelectSize === "function") {
      onSelectSize(size);
    }
    if (typeof onSelectContainerSize === "function") {
      onSelectContainerSize(size);
    }
  };

  // Suggested loading dates
  const suggestedDates = [
    { label: "Today (18 Aug 2026)", value: "2026-08-18", display: "18 Aug 2026" },
    { label: "In 3 Days (21 Aug 2026)", value: "2026-08-21", display: "21 Aug 2026" },
    { label: "Next Week (25 Aug 2026)", value: "2026-08-25", display: "25 Aug 2026" },
    { label: "End of Month (31 Aug 2026)", value: "2026-08-31", display: "31 Aug 2026" },
  ];

  return (
    <section
      id="section-cargo"
      className="glass-card rounded-[24px] p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#6A80A9]/10 text-xs font-bold text-[#6A80A9]">
              04
            </span>
            <h2 className="text-xl font-bold tracking-tight text-black sm:text-2xl">
              Container & Cargo
            </h2>
          </div>
          <p className="text-xs text-slate-500 sm:text-sm">
            Add the equipment and cargo details for this movement.
          </p>
        </div>
        <span className="hidden rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-[11px] font-medium text-slate-500 sm:inline-block">
          Equipment Specs
        </span>
      </div>

      {/* CONTAINER SIZE SELECTABLE CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Container Equipment Size <span className="text-rose-500">*</span>
          </label>
          <span className="text-[11px] text-slate-400">Standard ISO Freight Containers</span>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {(["20FT", "40FT", "40HC"] as ContainerSize[]).map((size) => {
            const spec = CONTAINER_SPECS[size];
            const isSelected = containerSize === size;

            return (
              <button
                key={size}
                type="button"
                onClick={() => handleSelectSize(size)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-[20px] p-4 text-left transition-all duration-200 focus:outline-none",
                  isSelected
                    ? "border-2 border-[#6A80A9] bg-gradient-to-b from-[#6A80A9]/12 via-[#6A80A9]/6 to-white/90 shadow-[0_8px_24px_rgba(106,128,169,0.15),inset_0_1px_1px_rgba(255,255,255,1)]"
                    : "border border-slate-200/80 bg-white/70 hover:border-slate-300 hover:bg-white",
                )}
              >
                {/* Header with Icon & Check */}
                <div className="flex items-center justify-between">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl transition-colors",
                      isSelected ? "bg-[#6A80A9] text-white" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    <Box className="size-5" />
                  </div>
                  {isSelected && (
                    <span className="flex size-5 items-center justify-center rounded-full bg-[#6A80A9] text-white">
                      <Check className="size-3 stroke-[2.5]" />
                    </span>
                  )}
                </div>

                {/* Size Name and Spec */}
                <div className="mt-3 space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-black">{spec.label}</span>
                    <span className="text-xs font-semibold text-[#6A80A9]">{spec.sublabel}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">{spec.description}</p>
                </div>

                {/* Bottom Badges */}
                <div className="mt-3 flex items-center gap-2 border-t border-slate-100/80 pt-2 text-[10px] text-slate-400">
                  <span className="font-medium text-slate-600">{spec.cbm}</span>
                  <span>•</span>
                  <span>Max {spec.maxPayload}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* THREE-COLUMN ROW: CONTAINER COUNT, CARGO DESCRIPTION, LOADING DATE */}
      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-12">
        {/* CONTAINER COUNT SELECTOR (3 cols) */}
        <div className="space-y-2 md:col-span-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Container Count <span className="text-rose-500">*</span>
          </label>
          <div className="flex items-center justify-between rounded-[16px] border border-slate-200/90 bg-white/90 p-2 shadow-sm">
            <button
              type="button"
              onClick={() => onChangeQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
              className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition-all hover:bg-slate-200 disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="size-4" />
            </button>
            <div className="text-center">
              <span className="text-xl font-bold text-black">{quantity}</span>
              <p className="text-[10px] uppercase tracking-wider text-slate-400">
                {quantity === 1 ? "Unit" : "Units"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onChangeQuantity(quantity + 1)}
              className="flex size-10 items-center justify-center rounded-xl bg-black text-white transition-all hover:bg-slate-800"
              aria-label="Increase quantity"
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        {/* LOADING DATE PICKER (4 cols) */}
        <div className="space-y-2 md:col-span-4">
          <NashmiaCustomDatePicker
            label="Loading Date"
            required
            value={loadingDate}
            onChange={onChangeLoadingDate}
            error={errors?.loadingDate}
          />
        </div>

        {/* COMMODITY / PRODUCT DESCRIPTION (4 cols) */}
        <div className="space-y-2 md:col-span-4">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Product / Contents <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={productDescription}
              onChange={(e) => onChangeProductDescription(e.target.value)}
              placeholder="Describe the cargo (e.g. Used clothing)..."
              className={cn(
                "w-full rounded-[16px] border bg-white/90 px-4 py-3.5 text-sm text-black placeholder:text-slate-400 transition-all focus:border-[#6A80A9] focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30",
                errors?.productDescription && !productDescription
                  ? "border-rose-400 bg-rose-50/30"
                  : "border-slate-200/90",
              )}
            />
          </div>
          {errors?.productDescription && !productDescription && (
            <p className="text-[11px] font-medium text-rose-500">{errors.productDescription}</p>
          )}
        </div>
      </div>

      {/* QUICK COMMODITY PRESET CHIPS */}
      <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100/80 pt-3">
        <span className="text-[11px] font-medium text-slate-400">Cargo Presets:</span>
        {COMMON_COMMODITIES.slice(0, 4).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChangeProductDescription(c)}
            className="rounded-full border border-slate-200/80 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-[#6A80A9]/50 hover:bg-[#E8F1F3]/50 hover:text-black"
          >
            + {c}
          </button>
        ))}
      </div>
    </section>
  );
}
