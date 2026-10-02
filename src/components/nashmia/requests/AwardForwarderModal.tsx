import { useState, memo, useId } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  AlertCircle,
  Ship,
  DollarSign,
  Clock,
  Calendar,
  ShieldCheck,
  Building2,
  ArrowRight,
  Loader2,
  Anchor,
  Sparkles,
  Container,
  Receipt,
  FileCheck2,
  Layers,
  MapPin,
  Check,
} from "lucide-react";
import type { BookingRequestRecord, ForwarderQuoteRequestRecord } from "@/types/requests";
import { getPortCountryMeta } from "@/lib/port-flags";
import { CountryFlagSvg } from "@/components/nashmia/common/CountryFlagSvg";

interface AwardForwarderModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookingRequest: BookingRequestRecord | null;
  forwarderRequest: ForwarderQuoteRequestRecord | null;
  onConfirmAward: (requestId: string) => Promise<void>;
}

export const AwardForwarderModal = memo(function AwardForwarderModal({
  isOpen,
  onClose,
  bookingRequest,
  forwarderRequest,
  onConfirmAward,
}: AwardForwarderModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAcknowledged, setIsAcknowledged] = useState(false);
  const checkboxId = useId();

  if (!isOpen || !forwarderRequest) return null;

  // Commercial values
  const ratePerContainer =
    forwarderRequest.offerData?.ratePerContainer || forwarderRequest.ratePerContainer || 0;
  const containerCount =
    forwarderRequest.offerData?.quantity ||
    forwarderRequest.containerCount ||
    bookingRequest?.containerCount ||
    1;
  const containerSize = forwarderRequest.containerSize || bookingRequest?.containerSize || "40HC";
  const containerType =
    forwarderRequest.offerData?.containerType ||
    forwarderRequest.containerType ||
    bookingRequest?.containerType ||
    "Standard Dry";

  const totalFreight =
    forwarderRequest.offerData?.totalFreight ||
    (ratePerContainer ? ratePerContainer * containerCount : 0);

  const currency =
    forwarderRequest.offerData?.currency ||
    forwarderRequest.currency ||
    bookingRequest?.currency ||
    "USD";

  const carrier =
    forwarderRequest.offerData?.carrier ||
    forwarderRequest.preferredCarrier ||
    bookingRequest?.preferredCarrier ||
    "Direct Carrier Line";

  const transitDays = forwarderRequest.offerData?.transitDays || 24;
  const freeDays = forwarderRequest.offerData?.freeDays || 14;

  // Routing & Dates
  const originPort =
    forwarderRequest.polName ||
    forwarderRequest.origin ||
    bookingRequest?.polName ||
    bookingRequest?.polCode ||
    "Port of Loading (POL)";
  const polCode = forwarderRequest.polCode || bookingRequest?.polCode || "POL";

  const destinationPort =
    forwarderRequest.podName ||
    forwarderRequest.destination ||
    bookingRequest?.podName ||
    bookingRequest?.podCode ||
    "Destination Port (POD)";
  const podCode = forwarderRequest.podCode || bookingRequest?.podCode || "POD";

  const etdDate =
    forwarderRequest.offerData?.etd ||
    forwarderRequest.etd ||
    forwarderRequest.requiredSailingDate ||
    bookingRequest?.requestedEtd ||
    "Prompt / Target Sailing";

  const etaDate =
    forwarderRequest.offerData?.eta ||
    forwarderRequest.eta ||
    bookingRequest?.estimatedEta ||
    `ETA (~${transitDays}d)`;

  // Additional Charges
  const rawAdditional = forwarderRequest.offerData?.additionalCharges;
  const hasSpecificAdditional =
    rawAdditional !== undefined &&
    rawAdditional !== null &&
    rawAdditional !== "" &&
    rawAdditional !== 0;

  const additionalChargesDisplay = hasSpecificAdditional
    ? typeof rawAdditional === "number"
      ? `$${rawAdditional.toLocaleString()} ${currency}`
      : String(rawAdditional)
    : "All-Inclusive (Origin THC, Documentation & ISPS Surcharges Included)";

  const movementNo =
    forwarderRequest.movementNumber ||
    bookingRequest?.movementNumber ||
    forwarderRequest.bookingReference ||
    bookingRequest?.reference ||
    "MOV-2026-0001";

  const isAlreadyAwarded = forwarderRequest.status === "AWARDED";

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirmAward(forwarderRequest.id);
      setIsAcknowledged(false);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[600px] w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden border border-slate-200 shadow-2xl rounded-2xl bg-white text-slate-900 antialiased">
        {/* Header - Crisp and Authoritative */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white px-6 py-4.5 border-b border-slate-800 relative shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 grid place-items-center shadow-inner shrink-0">
              <ShieldCheck className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-emerald-300 bg-emerald-950/80 border border-emerald-700/60 rounded-md px-1.5 py-0.5">
                  {movementNo}
                </span>
                <span className="text-xs text-slate-300 font-medium">Forwarder Award Protocol</span>
              </div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight mt-0.5">
                Confirm & Designate Winning Forwarder
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Review rate, equipment, schedule, and surcharges before atomic designation.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[calc(92vh-140px)]">
          {/* Selected Forwarder Banner */}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 p-4 space-y-3 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Selected Forwarding Partner
                  </span>
                  {forwarderRequest.forwarderCode && (
                    <span className="font-mono text-[10px] font-semibold text-slate-500">
                      [{forwarderRequest.forwarderCode}]
                    </span>
                  )}
                </div>
                <h4 className="text-base font-extrabold text-slate-900 mt-1 truncate">
                  {forwarderRequest.forwarderName}
                </h4>
                <p className="text-xs text-slate-600 truncate mt-0.5">
                  {forwarderRequest.forwarderEmail}{" "}
                  {forwarderRequest.forwarderContactPerson && (
                    <span className="text-slate-400">
                      · Attn: {forwarderRequest.forwarderContactPerson}
                    </span>
                  )}
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800 flex items-center gap-1 shadow-2xs shrink-0">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                {isAlreadyAwarded ? "Currently Awarded" : "Winning Quote"}
              </span>
            </div>

            {/* Core Commercial Quotation Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-emerald-200/60 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wide">
                  Rate / Container
                </span>
                <span className="font-bold text-slate-900 text-sm font-mono tabular-nums block mt-0.5">
                  ${ratePerContainer.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {currency} base freight
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wide">
                  Total Ocean Freight
                </span>
                <span className="font-bold text-[#0FA3B1] text-sm font-mono tabular-nums block mt-0.5">
                  ${totalFreight.toLocaleString()}
                </span>
                <span className="text-[10px] text-[#0FA3B1] font-medium">
                  {containerCount}x container{containerCount > 1 ? "s" : ""}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wide">
                  Carrier Line
                </span>
                <span
                  className="font-semibold text-slate-900 truncate block mt-0.5"
                  title={carrier}
                >
                  {carrier}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {transitDays} days transit
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] text-slate-400 font-semibold block uppercase tracking-wide">
                  Free Days (Dem/Det)
                </span>
                <span className="font-bold text-emerald-700 block mt-0.5">{freeDays} Days</span>
                <span className="text-[10px] text-slate-500 font-medium">At destination POD</span>
              </div>
            </div>
          </div>

          {/* Detailed Quotation Specifications: Equipment, Schedule & Surcharges */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="size-3.5 text-slate-500" />
              <span>Quotation & Booking Specifics</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {/* Equipment & Container Type */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-start gap-2.5">
                <div className="size-8 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 grid place-items-center shrink-0 mt-0.5">
                  <Container className="size-4" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Equipment & Container Type
                  </span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">
                    {containerCount}x {containerSize} {containerType}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    Cargo:{" "}
                    {forwarderRequest.cargoDescription ||
                      bookingRequest?.cargo?.description ||
                      "General Merchandise"}
                  </span>
                </div>
              </div>

              {/* Routing & Schedule (ETD / ETA) */}
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-start gap-2.5">
                <div className="size-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 grid place-items-center shrink-0 mt-0.5">
                  <Calendar className="size-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Schedule (ETD → ETA)
                  </span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5 flex items-center gap-1 truncate">
                    <span>ETD: {etdDate}</span>
                    <ArrowRight className="size-3 text-slate-400 shrink-0" />
                    <span>ETA: {etaDate}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 truncate flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <CountryFlagSvg
                        countryCode={getPortCountryMeta(polCode, originPort).countryCode}
                        size="xs"
                        title={getPortCountryMeta(polCode, originPort).countryName}
                      />
                      <span>{polCode}</span>
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                      <CountryFlagSvg
                        countryCode={getPortCountryMeta(podCode, destinationPort).countryCode}
                        size="xs"
                        title={getPortCountryMeta(podCode, destinationPort).countryName}
                      />
                      <span>{podCode}</span>
                    </span>
                    <span className="text-slate-400">
                      ({originPort} to {destinationPort})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Charges / Surcharges Section */}
            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex items-start gap-2.5">
              <div className="size-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 grid place-items-center shrink-0 mt-0.5">
                <Receipt className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Additional Charges & Local Fees
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                    Verified
                  </span>
                </div>
                <div className="font-semibold text-slate-800 text-xs mt-0.5">
                  {additionalChargesDisplay}
                </div>
                {forwarderRequest.offerData?.notes && (
                  <p className="text-[10px] text-slate-500 italic mt-0.5">
                    Forwarder note: &ldquo;{forwarderRequest.offerData.notes}&rdquo;
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Workflow Transition Notice (Atomicity and State Guarantee) */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2 text-amber-900">
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="size-4 text-amber-600 shrink-0" />
              <span>Atomic Workflow Changes Applied Upon Confirmation</span>
            </div>
            <ul className="text-xs text-amber-800 list-disc pl-5 space-y-1 leading-relaxed">
              <li>
                <strong>{forwarderRequest.forwarderName}</strong> will be set to{" "}
                <span className="font-bold text-emerald-800 uppercase">Awarded</span> and designated
                as the official forwarder.
              </li>
              <li>
                All other linked forwarder quotes under Movement{" "}
                <span className="font-mono font-bold text-slate-900">{movementNo}</span> will be set
                to <strong className="text-slate-800">NOT_AWARDED</strong>.
              </li>
              <li>
                The main booking status transitions to{" "}
                <strong className="text-amber-900">
                  Pending Confirmation (PENDING_CONFIRMATION)
                </strong>{" "}
                until formal carrier booking space is verified.
              </li>
              <li>
                A system audit event <span className="font-mono font-bold">BOOKING_AWARDED</span>{" "}
                will be permanently logged.
              </li>
            </ul>
          </div>

          {/* Explicit User Confirmation Checkbox */}
          <div className="rounded-xl border border-slate-200 bg-white p-3 flex items-start gap-2.5">
            <input
              type="checkbox"
              id={checkboxId}
              checked={isAcknowledged}
              onChange={(e) => setIsAcknowledged(e.target.checked)}
              className="size-4 mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <label
              htmlFor={checkboxId}
              className="text-xs text-slate-700 font-medium leading-tight cursor-pointer select-none"
            >
              I explicitly confirm awarding Movement{" "}
              <strong className="font-mono">{movementNo}</strong> to{" "}
              <strong>{forwarderRequest.forwarderName}</strong> at{" "}
              <strong>
                ${ratePerContainer.toLocaleString()} {currency}
              </strong>
              /container (Total: ${totalFreight.toLocaleString()} {currency}).
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 shrink-0">
          <span className="text-[11px] text-slate-400">
            Explicit manual operator award required
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-semibold h-9 rounded-xl px-4 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || !isAcknowledged}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold h-9 px-5 gap-1.5 rounded-xl cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Applying Award...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4 text-white shrink-0" />
                  <span>Confirm & Award Forwarder</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
