import {
  ArrowRight,
  Bookmark,
  Calendar,
  Check,
  Container,
  Copy,
  Hash,
  Lock,
  Receipt,
  Route,
  Ship,
  Sparkles,
  User,
  Warehouse,
} from "lucide-react";
import { useState } from "react";
import type {
  BuyerAccount,
  SupplierVendor,
  Port,
  ShippingLine,
  BookingAgent,
  RateCard,
  ContainerSize,
} from "@/lib/booking-data";
import { cn } from "@/lib/utils";

interface BookingSummaryCardProps {
  reference: string;
  buyer: BuyerAccount | null;
  supplier: SupplierVendor | null;
  pol: Port | null;
  pod: Port | null;
  shippingLine: ShippingLine | null;
  bookingAgent: BookingAgent | null;
  selectedBookingAgents?: BookingAgent[];
  containerSize: ContainerSize;
  quantity: number;
  loadingDate: string;
  matchedRate: RateCard | null;
  onSubmit: () => void;
  onSaveDraft: () => void;
  isSubmitting?: boolean;
}

export function BookingSummaryCard({
  reference,
  buyer,
  supplier,
  pol,
  pod,
  shippingLine,
  bookingAgent,
  selectedBookingAgents,
  containerSize,
  quantity,
  loadingDate,
  matchedRate,
  onSubmit,
  onSaveDraft,
  isSubmitting = false,
}: BookingSummaryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyRef = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalFreight = matchedRate ? matchedRate.ratePerContainer * quantity : null;

  // Format loading date or range nicely (e.g. "10–20 Aug 2026" or "18 Aug 2026")
  const formattedDate = (() => {
    if (!loadingDate) return "18 Aug 2026";
    if (loadingDate.includes(" to ") || loadingDate.includes(" - ")) {
      const [start, end] = loadingDate.includes(" to ")
        ? loadingDate.split(" to ")
        : loadingDate.split(" - ");
      const d1 = new Date(start?.trim());
      const d2 = new Date(end?.trim());
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
          return `${d1.getDate()}–${d2.getDate()} ${d1.toLocaleString("en-GB", { month: "short" })} ${d1.getFullYear()}`;
        }
        return `${d1.getDate()} ${d1.toLocaleString("en-GB", { month: "short" })} – ${d2.getDate()} ${d2.toLocaleString("en-GB", { month: "short" })} ${d2.getFullYear()}`;
      }
      return loadingDate;
    }
    const d = new Date(loadingDate);
    return isNaN(d.getTime())
      ? loadingDate
      : d.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
  })();

  return (
    <aside className="sticky top-6 rounded-[24px] border border-white/90 bg-gradient-to-b from-white/95 via-white/85 to-[#E8F1F3]/40 p-6 shadow-[0_20px_50px_rgba(15,23,42,0.06),inset_0_1px_2px_rgba(255,255,255,1)] backdrop-blur-2xl transition-all duration-300">
      {/* Header */}
      <div className="border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight text-black">Booking Summary</h3>
          <span className="inline-flex items-center gap-1 rounded-full border border-[#6A80A9]/30 bg-[#6A80A9]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#6A80A9]">
            <Sparkles className="size-2.5" />
            Live Preview
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Review before creating the movement.</p>
      </div>

      {/* GENERATED MOVEMENT REFERENCE */}
      <div className="mt-4 rounded-[18px] border border-slate-200/70 bg-white/80 p-3.5 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            <Lock className="size-3 text-slate-400" />
            <span>Movement Reference</span>
          </div>
          <button
            type="button"
            onClick={handleCopyRef}
            className="flex items-center gap-1 text-[10px] font-medium text-[#6A80A9] hover:underline"
          >
            {copied ? (
              <>
                <Check className="size-3 text-emerald-600" />
                <span className="text-emerald-600">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-xl font-black tracking-tight text-black sm:text-2xl font-mono">
            {reference}
          </span>
          <span className="text-[10px] font-medium text-slate-400">Automatically generated</span>
        </div>
      </div>

      {/* SUMMARY ATTRIBUTES LIST */}
      <div className="mt-5 space-y-3 text-xs">
        {/* Buyer */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <User className="size-3.5 text-slate-400" />
            Buyer
          </span>
          <span className="font-semibold text-black">{buyer ? buyer.name : "—"}</span>
        </div>

        {/* Supplier */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Warehouse className="size-3.5 text-slate-400" />
            Supplier
          </span>
          <span className="font-semibold text-black">{supplier ? supplier.name : "—"}</span>
        </div>

        {/* Load Point */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Container className="size-3.5 text-slate-400" />
            Load Point
          </span>
          <span className="font-semibold text-black text-right truncate max-w-[150px]">
            {supplier ? supplier.loadPoint : "—"}
          </span>
        </div>

        {/* Route */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Route className="size-3.5 text-slate-400" />
            Route
          </span>
          <span className="font-semibold text-black">
            {pol && pod ? `${pol.name} → ${pod.name}` : pol ? `${pol.code} → —` : "—"}
          </span>
        </div>

        {/* Shipping Line */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Ship className="size-3.5 text-slate-400" />
            Shipping Line
          </span>
          <span className="font-semibold text-black">{shippingLine ? shippingLine.name : "—"}</span>
        </div>

        {/* Forwarder */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Receipt className="size-3.5 text-slate-400" />
            Forwarder{selectedBookingAgents && selectedBookingAgents.length > 1 ? "s" : ""}
          </span>
          <span
            className="font-semibold text-black text-right max-w-[180px] truncate"
            title={
              selectedBookingAgents && selectedBookingAgents.length > 1
                ? selectedBookingAgents.map((a) => a.name).join(", ")
                : bookingAgent?.name || ""
            }
          >
            {selectedBookingAgents && selectedBookingAgents.length > 1
              ? `${selectedBookingAgents.length} Forwarders (${selectedBookingAgents.map((a) => a.name).join(", ")})`
              : bookingAgent
                ? bookingAgent.name
                : "—"}
          </span>
        </div>

        {/* Container */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Container className="size-3.5 text-slate-400" />
            Equipment
          </span>
          <span className="font-semibold text-black">
            {containerSize} × {quantity}
          </span>
        </div>

        {/* Loading Date */}
        <div className="flex items-center justify-between py-1 border-b border-slate-100/80">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Calendar className="size-3.5 text-slate-400" />
            Loading Date
          </span>
          <span className="font-semibold text-black">{formattedDate}</span>
        </div>
      </div>

      {/* RATE SUMMARY SECTION */}
      <div className="mt-5 rounded-[18px] border border-[#C7D5BF]/90 bg-gradient-to-br from-[#C7D5BF]/20 via-white/90 to-[#E8F1F3]/30 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#2D3C26]">
            Agreed Total Freight
          </span>
          <span className="rounded-full bg-[#2D3C26]/10 px-2 py-0.5 text-[9px] font-bold text-[#2D3C26]">
            Monthly rate card
          </span>
        </div>

        <div className="mt-2 flex items-baseline justify-between">
          <div>
            <span className="text-2xl font-black tracking-tight text-black sm:text-3xl">
              {totalFreight ? `$${totalFreight.toLocaleString()}` : "Rate Pending"}
            </span>
            {matchedRate && (
              <p className="text-[11px] text-slate-600">
                ${matchedRate.ratePerContainer.toLocaleString()} × {quantity} container
                {quantity > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ACTION CTAs */}
      <div className="mt-6 space-y-2.5">
        {/* CREATE BOOKING PRIMARY BUTTON */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          className="group relative flex h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-black font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-900 hover:shadow-xl active:translate-y-0 disabled:opacity-50"
        >
          <span>Create Booking</span>
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
        </button>

        {/* SAVE AS DRAFT SECONDARY BUTTON */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          className="flex h-[46px] w-full items-center justify-center gap-1.5 rounded-[14px] border border-slate-200/90 bg-white/80 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:bg-white hover:border-slate-300"
        >
          <Bookmark className="size-3.5 text-slate-500" />
          <span>Save as Draft</span>
        </button>
      </div>

      {/* Security note */}
      <p className="mt-3 text-center text-[10px] text-slate-400">
        Creates a formal electronic booking request in the Nashmia Movement Registry.
      </p>
    </aside>
  );
}
