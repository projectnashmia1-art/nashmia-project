import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  Plus,
  Check,
  Search,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CURRENCY_OPTIONS, type RateCardFormValues } from "@/lib/rate-cards-data";
import { ResultSuccessView } from "@/components/nashmia/common/ResultSuccessView";
import type { FullRateCardRecord } from "@/types/rate-card.types";

interface RateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: RateCardFormValues, editingId?: string) => Promise<void>;
  editingCard?: FullRateCardRecord | null;
  forwarders: { id: string; name: string; code?: string; contact?: string; email?: string }[];
  shippingLines?: { id: string; name: string; code: string }[];
  isSubmitting?: boolean;
}

export function RateCardModal({
  isOpen,
  onClose,
  onSave,
  editingCard,
  forwarders,
  isSubmitting = false,
}: RateCardModalProps) {
  // 3 Core Fields
  const [forwarderId, setForwarderId] = useState("");
  const [pickupPoint, setPickupPoint] = useState("");
  const [rate, setRate] = useState<string>("2450");
  const [currency, setCurrency] = useState<string>("USD");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Search & Dropdown state
  const [forwarderSearch, setForwarderSearch] = useState("");
  const [forwarderDropdownOpen, setForwarderDropdownOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedData, setSavedData] = useState<{
    forwarderName: string;
    pickupPoint: string;
    rateText: string;
  } | null>(null);

  // Initialize or reset form when editingCard changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (editingCard) {
      setForwarderId(editingCard.forwarder_id || "");
      setPickupPoint(editingCard.load_point || editingCard.origin || "");
      setRate(String(editingCard.base_rate || editingCard.rate || "2450"));
      setCurrency(editingCard.currency || "USD");
      setStatus(editingCard.status === "Inactive" ? "Inactive" : "Active");
      setIsSuccess(false);
      setSavedData(null);
    } else {
      setForwarderId(forwarders[0]?.id || "");
      setPickupPoint("");
      setRate("2450");
      setCurrency("USD");
      setStatus("Active");
      setIsSuccess(false);
      setSavedData(null);
    }
    setErrors({});
    setForwarderSearch("");
    setForwarderDropdownOpen(false);
  }, [isOpen, editingCard, forwarders]);

  // Selected forwarder object
  const selectedForwarderObj = useMemo(() => {
    return forwarders.find((f) => f.id === forwarderId) || null;
  }, [forwarders, forwarderId]);

  // Filtered forwarders for searchable dropdown
  const filteredForwarders = useMemo(() => {
    if (!forwarderSearch.trim()) return forwarders;
    const clean = forwarderSearch.toLowerCase();
    return forwarders.filter(
      (f) =>
        f.name.toLowerCase().includes(clean) ||
        (f.code && f.code.toLowerCase().includes(clean)) ||
        (f.contact && f.contact.toLowerCase().includes(clean)) ||
        (f.email && f.email.toLowerCase().includes(clean)),
    );
  }, [forwarders, forwarderSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!forwarderId) {
      newErrors.forwarderId = "Please select a forwarder";
    }
    if (!pickupPoint.trim()) {
      newErrors.pickupPoint = "Pickup point location is required";
    }
    const numRate = Number(rate);
    if (isNaN(numRate) || numRate <= 0) {
      newErrors.rate = "Please enter a valid rate amount";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      const today = new Date().toISOString().split("T")[0];
      const nextYear = new Date(Date.now() + 365 * 86400000).toISOString().split("T")[0];
      const fwdName = selectedForwarderObj?.name || "Forwarder";

      await onSave(
        {
          forwarderId,
          cardName: `${pickupPoint.trim()} Rate (${fwdName})`,
          origin: pickupPoint.trim(),
          destination: "Karachi (KHI)",
          loadPoint: pickupPoint.trim(),
          polName: pickupPoint.trim(),
          containerSize: "40HC",
          containerType: "High Cube",
          quantity: 1,
          baseRate: numRate,
          currency: currency.toUpperCase(),
          additionalCharges: [],
          validFrom: editingCard?.valid_from || today,
          validUntil: editingCard?.valid_until || nextYear,
          status,
          notes: `Pickup Point: ${pickupPoint.trim()}`,
        },
        editingCard?.id,
      );

      setSavedData({
        forwarderName: fwdName,
        pickupPoint: pickupPoint.trim(),
        rateText: `${currency.toUpperCase()} ${numRate.toLocaleString()}`,
      });
      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to save rate card");
    }
  };

  const handleDismiss = () => {
    onClose();
    setTimeout(() => {
      setIsSuccess(false);
      setSavedData(null);
    }, 200);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "w-[95vw] max-w-[95vw] sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-100 bg-white shadow-2xl focus:outline-none",
          isSuccess && "sm:max-w-[420px]",
        )}
      >
        {isSuccess ? (
          <div className="p-4 sm:p-6 overflow-y-auto max-h-[88vh]">
            <ResultSuccessView
              type="success"
              title={editingCard ? "Rate Card Updated" : "Rate Card Saved"}
              message={`The rate card for ${savedData?.forwarderName} at pickup point "${savedData?.pickupPoint}" (${savedData?.rateText}) has been saved and is ready for booking requests.`}
              entityName={savedData?.forwarderName}
              entitySubtitle={savedData?.pickupPoint}
              actionText="OKAY"
              onAction={handleDismiss}
              onClose={handleDismiss}
            />
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col h-full max-h-[90vh] overflow-hidden"
          >
            {/* Minimal Circular Close Button */}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-700 active:scale-95 cursor-pointer shadow-2xs"
            >
              <X className="size-4 stroke-[2.5]" />
            </button>

            {/* Clean Minimal Header (Matching Supplier Modal) */}
            <DialogHeader className="p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 shrink-0 bg-white space-y-1.5 text-left pr-10">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5F6] px-3 py-1 text-[11px] font-bold text-[#0FA3B1] w-fit">
                <span className="size-1.5 rounded-full bg-[#0FA3B1]" />
                {editingCard ? "Edit Rate Card" : "Ocean Rate Card"}
              </div>
              <DialogTitle className="text-xl sm:text-[22px] font-extrabold tracking-tight text-[#0D1F3C]">
                {editingCard ? "Update Rate Card" : "Add Rate Card"}
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-[13px] font-medium text-slate-500">
                {editingCard
                  ? "Modify forwarder freight tariff, contracted pickup point, and currency."
                  : "Set up forwarder freight tariff for origin pickup load points."}
              </DialogDescription>
            </DialogHeader>

            {/* SCROLLABLE FORM INPUTS */}
            <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 [scrollbar-width:thin]">
              {/* FIELD 1: FORWARDER */}
              <div className="space-y-1 relative">
                <label className="text-[12px] font-semibold text-slate-600">
                  Forwarder Partner <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setForwarderDropdownOpen((v) => !v)}
                    className={cn(
                      "flex h-11 w-full items-center justify-between rounded-xl border bg-slate-50/60 px-3.5 text-left text-sm sm:text-[13px] font-medium text-slate-900 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none cursor-pointer",
                      errors.forwarderId ? "border-rose-400 bg-rose-50/30" : "border-slate-200",
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Building2 className="size-4 text-[#0FA3B1] shrink-0" />
                      <span className="truncate">
                        {selectedForwarderObj
                          ? `${selectedForwarderObj.name} ${selectedForwarderObj.code ? `(${selectedForwarderObj.code})` : ""}`
                          : "Select Forwarder..."}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn(
                        "size-4 text-slate-400 shrink-0 transition-transform",
                        forwarderDropdownOpen && "rotate-180 text-slate-700",
                      )}
                    />
                  </button>

                  {forwarderDropdownOpen && (
                    <div className="absolute top-full left-0 z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95">
                      <div className="relative mb-2">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={forwarderSearch}
                          onChange={(e) => setForwarderSearch(e.target.value)}
                          placeholder="Search forwarder name or code..."
                          className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8.5 pr-3 text-xs font-medium text-slate-900 focus:bg-white focus:border-[#009EE2] focus:outline-none"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1 [scrollbar-width:thin]">
                        {filteredForwarders.length === 0 ? (
                          <div className="p-3 text-center text-xs text-slate-400">
                            No forwarders found
                          </div>
                        ) : (
                          filteredForwarders.map((fwd) => {
                            const isSelected = fwd.id === forwarderId;
                            return (
                              <button
                                key={fwd.id}
                                type="button"
                                onClick={() => {
                                  setForwarderId(fwd.id);
                                  setForwarderDropdownOpen(false);
                                  if (errors.forwarderId)
                                    setErrors((prev) => ({ ...prev, forwarderId: "" }));
                                }}
                                className={cn(
                                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors cursor-pointer",
                                  isSelected
                                    ? "bg-[#E8F5F6] font-bold text-[#0FA3B1]"
                                    : "hover:bg-slate-50 text-slate-800",
                                )}
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-bold truncate">{fwd.name}</p>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {fwd.code || "Agent"} {fwd.email ? `• ${fwd.email}` : ""}
                                  </p>
                                </div>
                                {isSelected && <Check className="size-4 text-[#0FA3B1] shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
                {errors.forwarderId && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{errors.forwarderId}</span>
                  </p>
                )}
              </div>

              {/* FIELD 2: PICKUP POINT */}
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-slate-600">
                  Pickup Point / Facility Location <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={pickupPoint}
                    onChange={(e) => {
                      setPickupPoint(e.target.value);
                      if (errors.pickupPoint) setErrors((prev) => ({ ...prev, pickupPoint: "" }));
                    }}
                    placeholder="e.g. Felixstowe Cargo Hub, Gate 4"
                    className={cn(
                      "h-11 w-full rounded-xl border bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-medium text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none",
                      errors.pickupPoint ? "border-rose-400 bg-rose-50/30" : "border-slate-200",
                    )}
                  />
                </div>
                {errors.pickupPoint && (
                  <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>{errors.pickupPoint}</span>
                  </p>
                )}
              </div>

              {/* FIELD 3: FREIGHT RATE & CURRENCY */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Ocean Freight Rate (40HC) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={rate}
                    onChange={(e) => {
                      setRate(e.target.value);
                      if (errors.rate) setErrors((prev) => ({ ...prev, rate: "" }));
                    }}
                    placeholder="e.g. 2450"
                    className={cn(
                      "h-11 w-full rounded-xl border bg-slate-50/60 px-3.5 text-sm sm:text-[13px] font-semibold text-slate-900 placeholder:text-slate-400 transition-all duration-150 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none",
                      errors.rate ? "border-rose-400 bg-rose-50/30" : "border-slate-200",
                    )}
                  />
                  {errors.rate && (
                    <p className="flex items-center gap-1 text-[11px] font-medium text-rose-500 pt-0.5">
                      <AlertCircle className="size-3 shrink-0" />
                      <span>{errors.rate}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[12px] font-semibold text-slate-600">
                    Currency
                  </label>
                  <div className="relative">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 pr-8 text-sm sm:text-[13px] font-bold text-slate-900 hover:bg-white focus:bg-white focus:border-[#009EE2] focus:ring-4 focus:ring-[#009EE2]/10 focus:outline-none cursor-pointer"
                    >
                      {CURRENCY_OPTIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.value} ({c.symbol})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* FIELD 4: STATUS SWITCH */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                <div>
                  <p className="text-[12px] font-bold text-slate-800">Rate Card Status</p>
                  <p className="text-[11px] text-slate-500">
                    Active rate cards are automatically matched during booking generation
                  </p>
                </div>
                <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-full self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setStatus("Active")}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer",
                      status === "Active"
                        ? "bg-white text-emerald-700 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus("Inactive")}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11.5px] font-bold transition-all cursor-pointer",
                      status === "Inactive"
                        ? "bg-white text-slate-800 shadow-2xs"
                        : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    Inactive
                  </button>
                </div>
              </div>
            </div>

            {/* STICKY ACTION FOOTER */}
            <div className="p-4 sm:p-5 sm:py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="h-10 px-4 rounded-full text-[13px] font-semibold text-slate-500 hover:bg-slate-200/60 hover:text-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#009EE2] hover:bg-[#0089c7] px-5 sm:px-6 text-[13px] font-bold text-white shadow-md shadow-[#009EE2]/20 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
                <span>{editingCard ? "Save Changes" : "Save Rate Card"}</span>
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
