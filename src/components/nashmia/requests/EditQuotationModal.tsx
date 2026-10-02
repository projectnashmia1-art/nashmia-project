import { useState, useEffect, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileEdit,
  Check,
  Loader2,
  Sparkles,
  Anchor,
  ShieldCheck,
  AlertCircle,
  Info,
} from "lucide-react";
import type {
  ForwarderQuoteRequestRecord,
  ForwarderOfferData,
  CanonicalQuotationStatus,
} from "@/types/requests";
import { normalizeQuoteStatus, ALL_QUOTATION_STATUSES } from "@/types/requests";
import { QuotationStatusBadge, QUOTATION_STATUS_CONFIG } from "./QuotationStatusBadge";

interface EditQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  forwarderRequest: ForwarderQuoteRequestRecord | null;
  onSave: (
    requestId: string,
    updatedOffer: Partial<ForwarderOfferData>,
    updatedStatus?: CanonicalQuotationStatus,
  ) => Promise<void>;
}

export const EditQuotationModal = memo(function EditQuotationModal({
  isOpen,
  onClose,
  forwarderRequest,
  onSave,
}: EditQuotationModalProps) {
  const [ratePerContainer, setRatePerContainer] = useState<string>("");
  const [currency, setCurrency] = useState<string>("USD");
  const [carrier, setCarrier] = useState<string>("");
  const [availability, setAvailability] = useState<string>("");
  const [etd, setEtd] = useState<string>("");
  const [eta, setEta] = useState<string>("");
  const [transitDays, setTransitDays] = useState<string>("");
  const [freeDays, setFreeDays] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [status, setStatus] = useState<CanonicalQuotationStatus>("OFFER_RECEIVED");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!forwarderRequest) return;
    const offer = forwarderRequest.offerData;
    setRatePerContainer(
      offer?.ratePerContainer !== undefined
        ? String(offer.ratePerContainer)
        : forwarderRequest.ratePerContainer
          ? String(forwarderRequest.ratePerContainer)
          : "",
    );
    setCurrency(offer?.currency || forwarderRequest.currency || "USD");
    setCarrier(offer?.carrier || forwarderRequest.preferredCarrier || "MSC");
    setAvailability(offer?.availability || "Available on first cut-off");
    setEtd(offer?.etd || forwarderRequest.etd || "");
    setEta(offer?.eta || forwarderRequest.eta || "");
    setTransitDays(offer?.transitDays ? String(offer.transitDays) : "24");
    setFreeDays(offer?.freeDays ? String(offer.freeDays) : "14");
    setValidUntil(offer?.validUntil || "30 Sep 2026");
    setNotes(offer?.notes || "");
    setStatus(normalizeQuoteStatus(forwarderRequest.status));
  }, [forwarderRequest]);

  if (!isOpen || !forwarderRequest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedRate = parseFloat(ratePerContainer);
      const cntrCount = forwarderRequest.containerCount || 1;
      const totalFreight = !isNaN(parsedRate) ? parsedRate * cntrCount : undefined;

      const payload: Partial<ForwarderOfferData> = {
        ratePerContainer: !isNaN(parsedRate) ? parsedRate : undefined,
        totalFreight,
        currency,
        carrier,
        availability,
        etd: etd || undefined,
        eta: eta || undefined,
        transitDays: parseInt(transitDays, 10) || undefined,
        freeDays: parseInt(freeDays, 10) || undefined,
        validUntil: validUntil || undefined,
        notes: notes || undefined,
      };

      await onSave(forwarderRequest.id, payload, status);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white max-h-[90vh] flex flex-col text-slate-900 antialiased">
        {/* Header */}
        <div className="bg-white text-slate-900 px-6 py-5 border-b border-slate-200 relative">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#0FA3B1]/10 text-[#0FA3B1] grid place-items-center shadow-xs">
              <FileEdit className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5">
                  {forwarderRequest.movementNumber || forwarderRequest.bookingReference}
                </span>
                <span className="text-xs text-slate-500 font-medium">Quotation Management</span>
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                Review & Edit Forwarder Quotation
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 font-normal">
                Forwarder:{" "}
                <strong className="text-slate-900 font-semibold">
                  {forwarderRequest.forwarderName}
                </strong>
                {" • "}
                <span className="text-slate-500">{forwarderRequest.forwarderEmail}</span>
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
          {/* Status Selection Row */}
          <div className="space-y-1.5 rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="quotation-status" className="text-xs font-bold text-slate-800">
                Quotation Status
              </Label>
              <QuotationStatusBadge status={status} size="xs" />
            </div>
            <select
              id="quotation-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as CanonicalQuotationStatus)}
              className="w-full h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0FA3B1]/30 focus:border-[#0FA3B1]"
            >
              {ALL_QUOTATION_STATUSES.map((st) => (
                <option key={st} value={st}>
                  {st} — {QUOTATION_STATUS_CONFIG[st].description.split(".")[0]}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Info className="size-3 text-[#0FA3B1] shrink-0" />
              <span>
                {status === "OFFER_RECEIVED"
                  ? "Commercial rate received. Receiving a quotation does NOT automatically confirm the booking."
                  : QUOTATION_STATUS_CONFIG[status]?.description}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="rate" className="text-xs font-semibold text-slate-700">
                Ocean Rate / Container
              </Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                placeholder="2100"
                value={ratePerContainer}
                onChange={(e) => setRatePerContainer(e.target.value)}
                className="h-9.5 font-bold text-slate-900 rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="currency" className="text-xs font-semibold text-slate-700">
                Currency
              </Label>
              <Input
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                className="h-9.5 font-mono rounded-xl"
                placeholder="USD"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="carrier" className="text-xs font-semibold text-slate-700">
                Carrying Line / Carrier
              </Label>
              <Input
                id="carrier"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                className="h-9.5 font-medium rounded-xl"
                placeholder="MSC / Maersk / CMA CGM"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="avail" className="text-xs font-semibold text-slate-700">
                Space Availability
              </Label>
              <Input
                id="avail"
                value={availability}
                onChange={(e) => setAvailability(e.target.value)}
                className="h-9.5 rounded-xl"
                placeholder="Available on first cut-off"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="etd" className="text-xs font-semibold text-slate-700">
                Proposed ETD
              </Label>
              <Input
                id="etd"
                type="date"
                value={etd}
                onChange={(e) => setEtd(e.target.value)}
                className="h-9.5 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eta" className="text-xs font-semibold text-slate-700">
                Estimated ETA
              </Label>
              <Input
                id="eta"
                type="date"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="h-9.5 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="transit" className="text-xs font-semibold text-slate-700">
                Transit (Days)
              </Label>
              <Input
                id="transit"
                type="number"
                value={transitDays}
                onChange={(e) => setTransitDays(e.target.value)}
                className="h-9.5 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="freeDays" className="text-xs font-semibold text-slate-700">
                Free Days
              </Label>
              <Input
                id="freeDays"
                type="number"
                value={freeDays}
                onChange={(e) => setFreeDays(e.target.value)}
                className="h-9.5 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="validity" className="text-xs font-semibold text-slate-700">
                Rate Validity
              </Label>
              <Input
                id="validity"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-9.5 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">
              Quotation Notes / Surcharges
            </Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Direct vessel sailing, subject to standard destination terminal handling."
              className="resize-none text-xs rounded-xl"
            />
          </div>

          <div className="rounded-2xl bg-[#0FA3B1]/10 border border-[#0FA3B1]/20 p-3 flex items-center gap-2.5 text-slate-800 text-xs">
            <ShieldCheck className="size-4 text-[#0FA3B1] shrink-0" />
            <span>
              All status updates and manual adjustments are tracked with audit logs in the timeline.
            </span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-semibold h-9 rounded-xl px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-xs font-bold h-9 px-5 gap-1.5 rounded-xl shadow-xs transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="size-3.5 text-white" />
                  <span>Save Quotation</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});
