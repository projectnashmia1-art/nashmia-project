import { useState, useEffect, memo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FileEdit,
  Check,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Receipt,
  Mail,
  Paperclip,
} from "lucide-react";
import type {
  ForwarderQuoteRequestRecord,
  ForwarderOfferData,
  CanonicalQuotationStatus,
} from "@/types/requests";
import { normalizeQuoteStatus, ALL_QUOTATION_STATUSES } from "@/types/requests";
import { QuotationStatusBadge, QUOTATION_STATUS_CONFIG } from "./QuotationStatusBadge";
import { recordQuotationAuditEvent } from "@/lib/quotation-audit-logger";
import { runPropertyAlignmentDiagnostic } from "@/lib/quotation-diagnostics";

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
  const [vesselName, setVesselName] = useState<string>("");
  const [voyageNumber, setVoyageNumber] = useState<string>("");
  const [quotationReference, setQuotationReference] = useState<string>("");
  const [containerType, setContainerType] = useState<string>("40HC");
  const [containerCount, setContainerCount] = useState<string>("1");

  // Itemized Charge Breakdown fields
  const [showBreakdown, setShowBreakdown] = useState<boolean>(true);
  const [oceanFreight, setOceanFreight] = useState<string>("");
  const [thc, setThc] = useState<string>("");
  const [originCharges, setOriginCharges] = useState<string>("");
  const [destinationCharges, setDestinationCharges] = useState<string>("");
  const [documentationCharges, setDocumentationCharges] = useState<string>("");
  const [customsCharges, setCustomsCharges] = useState<string>("");
  const [truckingCharges, setTruckingCharges] = useState<string>("");
  const [otherCharges, setOtherCharges] = useState<string>("");
  const [quotedTotal, setQuotedTotal] = useState<string>("");

  const [status, setStatus] = useState<CanonicalQuotationStatus>("OFFER_RECEIVED");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!forwarderRequest) return;
    const offer = forwarderRequest.offerData;

    setRatePerContainer(
      offer?.ratePerContainer !== undefined && offer.ratePerContainer !== null
        ? String(offer.ratePerContainer)
        : offer?.oceanFreight !== undefined && offer.oceanFreight !== null
          ? String(offer.oceanFreight)
          : forwarderRequest.ratePerContainer
            ? String(forwarderRequest.ratePerContainer)
            : "",
    );

    setCurrency(offer?.currency || forwarderRequest.currency || "USD");
    setCarrier(offer?.carrier || forwarderRequest.preferredCarrier || "MSC");
    setAvailability(offer?.availability || "Available on first cut-off");
    setEtd(offer?.etd || offer?.sailingDate || forwarderRequest.etd || "");
    setEta(offer?.eta || forwarderRequest.eta || "");
    setTransitDays(offer?.transitDays ? String(offer.transitDays) : "24");
    setFreeDays(offer?.freeDays ? String(offer.freeDays) : "14");
    setValidUntil(offer?.validUntil || offer?.validityDate || "30 Sep 2026");
    setNotes(offer?.notes || "");
    setVesselName(offer?.vesselName || forwarderRequest.vesselName || "");
    setVoyageNumber(offer?.voyageNumber || forwarderRequest.voyageNumber || "");
    setContainerType(offer?.containerType || forwarderRequest.containerType || "40HC");
    setContainerCount(String(offer?.quantity || forwarderRequest.containerCount || 1));

    // Breakdown charges pre-fill
    setOceanFreight(
      offer?.oceanFreight !== undefined && offer.oceanFreight !== null
        ? String(offer.oceanFreight)
        : "",
    );
    setThc(offer?.thc !== undefined && offer.thc !== null ? String(offer.thc) : "");
    setOriginCharges(
      offer?.originCharges !== undefined && offer.originCharges !== null
        ? String(offer.originCharges)
        : "",
    );
    setDestinationCharges(
      offer?.destinationCharges !== undefined && offer.destinationCharges !== null
        ? String(offer.destinationCharges)
        : "",
    );
    setDocumentationCharges(
      offer?.documentationCharges !== undefined && offer.documentationCharges !== null
        ? String(offer.documentationCharges)
        : "",
    );
    setCustomsCharges(
      offer?.customsCharges !== undefined && offer.customsCharges !== null
        ? String(offer.customsCharges)
        : "",
    );
    setTruckingCharges(
      offer?.truckingCharges !== undefined && offer.truckingCharges !== null
        ? String(offer.truckingCharges)
        : "",
    );
    setOtherCharges(
      offer?.otherCharges !== undefined && offer.otherCharges !== null
        ? String(offer.otherCharges)
        : "",
    );

    // Totals
    const qTot =
      offer?.totalAmount !== undefined && offer.totalAmount !== null
        ? String(offer.totalAmount)
        : offer?.totalCost !== undefined && offer.totalCost !== null
          ? String(offer.totalCost)
          : "";
    setQuotedTotal(qTot);

    setQuotationReference(
      (offer?.traceability as Record<string, unknown>)?.quotationReference
        ? String((offer?.traceability as Record<string, unknown>)?.quotationReference)
        : `REF-${forwarderRequest.movementNumber || forwarderRequest.bookingReference}`,
    );

    setStatus(normalizeQuoteStatus(forwarderRequest.status));

    // Run Property Alignment Diagnostic check comparing fetched API response against form state
    runPropertyAlignmentDiagnostic(
      forwarderRequest as unknown as Record<string, unknown>,
      {
        id: forwarderRequest.id,
        quotationId: offer?.quotationId || offer?.id || forwarderRequest.id,
        bookingId: forwarderRequest.bookingId,
        movementNumber: forwarderRequest.movementNumber,
        ratePerContainer: offer?.ratePerContainer || forwarderRequest.ratePerContainer,
        oceanFreight: offer?.oceanFreight || offer?.ratePerContainer,
        quotedTotal: qTot,
        currency: offer?.currency || forwarderRequest.currency,
        carrier: offer?.carrier || forwarderRequest.preferredCarrier,
        etd: offer?.etd || forwarderRequest.etd,
        eta: offer?.eta || forwarderRequest.eta,
        transitDays: offer?.transitDays,
        freeDays: offer?.freeDays,
        vesselName: offer?.vesselName || forwarderRequest.vesselName,
        quotationReference: (offer?.traceability as Record<string, unknown>)?.quotationReference,
        status: forwarderRequest.status,
        itemizedCharges: offer?.itemizedCharges || [],
      },
      "Forwarder Quotation Popup - EditQuotationModal",
    );
  }, [forwarderRequest]);

  if (!isOpen || !forwarderRequest) return null;

  const offer = forwarderRequest.offerData;
  const reviewReasons = offer?.reviewReasons || [];
  const needsReview = offer?.needsReview || reviewReasons.length > 0;
  const isRuleParsed =
    offer?.receivedVia?.includes("Forwarder Quotation Email") ||
    offer?.receivedVia?.includes("Email Reply") ||
    offer?.receivedVia?.includes("Rule-Based");

  // Calculate sum of itemized charges for live cross-check
  const numRate = parseFloat(ratePerContainer) || 0;
  const numThc = parseFloat(thc) || 0;
  const numOrigin = parseFloat(originCharges) || 0;
  const numDest = parseFloat(destinationCharges) || 0;
  const numDoc = parseFloat(documentationCharges) || 0;
  const numCustoms = parseFloat(customsCharges) || 0;
  const numTrucking = parseFloat(truckingCharges) || 0;
  const numOther = parseFloat(otherCharges) || 0;

  const calculatedSum =
    numRate + numThc + numOrigin + numDest + numDoc + numCustoms + numTrucking + numOther;
  const parsedQuotedTotal = parseFloat(quotedTotal);
  const hasTotalDiscrepancy =
    !isNaN(parsedQuotedTotal) &&
    calculatedSum > 0 &&
    Math.abs(parsedQuotedTotal - calculatedSum) > 0.01;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedRate = parseFloat(ratePerContainer);
      const cntrCount = parseInt(containerCount, 10) || forwarderRequest.containerCount || 1;
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
        vesselName: vesselName || undefined,
        voyageNumber: voyageNumber || undefined,
        containerType,
        quantity: cntrCount,
        oceanFreight: !isNaN(parseFloat(oceanFreight))
          ? parseFloat(oceanFreight)
          : parsedRate || undefined,
        thc: !isNaN(parseFloat(thc)) ? parseFloat(thc) : undefined,
        originCharges: !isNaN(parseFloat(originCharges)) ? parseFloat(originCharges) : undefined,
        destinationCharges: !isNaN(parseFloat(destinationCharges))
          ? parseFloat(destinationCharges)
          : undefined,
        documentationCharges: !isNaN(parseFloat(documentationCharges))
          ? parseFloat(documentationCharges)
          : undefined,
        customsCharges: !isNaN(parseFloat(customsCharges)) ? parseFloat(customsCharges) : undefined,
        truckingCharges: !isNaN(parseFloat(truckingCharges))
          ? parseFloat(truckingCharges)
          : undefined,
        otherCharges: !isNaN(parseFloat(otherCharges)) ? parseFloat(otherCharges) : undefined,
        totalAmount: !isNaN(parsedQuotedTotal) ? parsedQuotedTotal : calculatedSum || totalFreight,
        totalCost: !isNaN(parsedQuotedTotal) ? parsedQuotedTotal : calculatedSum || totalFreight,
        sailingDate: etd || undefined,
        validityDate: validUntil || undefined,
        manuallyCorrected: true,
        correctedAt: new Date().toISOString(),
        needsReview: false, // Marked reviewed on manual confirmation
        reviewReasons: [],
      };

      await onSave(forwarderRequest.id, payload, status);

      // Audit log: track manual quotation field and status edits
      void recordQuotationAuditEvent({
        eventType: "QUOTATION_UPDATED",
        movementNumber: forwarderRequest.movementNumber,
        bookingId: forwarderRequest.movementNumber || forwarderRequest.bookingReference,
        forwarderId: forwarderRequest.forwarderId,
        forwarderName: forwarderRequest.forwarderName,
        summary: `Quotation updated manually: status=${status}, rate=${payload.ratePerContainer || "N/A"}`,
        details: {
          previousStatus: forwarderRequest.status,
          newStatus: status,
          updatedFields: Object.keys(payload),
          manuallyCorrected: true,
        },
      });

      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="w-full sm:max-w-[650px] p-0 overflow-hidden sm:rounded-2xl bg-white max-h-[92vh] flex flex-col text-slate-900 antialiased shadow-2xl">
        {/* Header */}
        <div className="bg-white text-slate-900 px-6 py-4.5 border-b border-slate-200 relative">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-[#0FA3B1]/10 text-[#0FA3B1] grid place-items-center shadow-xs shrink-0">
              <FileEdit className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 border border-slate-200 rounded-md px-1.5 py-0.5">
                  {forwarderRequest.movementNumber || forwarderRequest.bookingReference}
                </span>
                <span className="text-xs text-slate-500 font-medium">Quotation Review & Edit</span>
                {isRuleParsed && (
                  <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md px-1.5 py-0.2">
                    Source: Parsed from forwarder email • Parser: Rule-based
                  </span>
                )}
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                {needsReview ? "Review Forwarder Quotation" : "Edit Forwarder Quotation"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5 font-normal truncate">
                Forwarder:{" "}
                <strong className="text-slate-900 font-semibold">
                  {forwarderRequest.forwarderName}
                </strong>
                {" • "}
                <span className="text-slate-500">{forwarderRequest.forwarderEmail}</span>
                {forwarderRequest.origin && forwarderRequest.destination && (
                  <span>
                    {" • Route: "}
                    {forwarderRequest.origin} ({forwarderRequest.polCode}) →{" "}
                    {forwarderRequest.destination} ({forwarderRequest.podCode})
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4.5 text-xs">
          {/* Review Warnings Alert (Displayed if rule-based anomalies detected) */}
          {needsReview && reviewReasons.length > 0 && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 space-y-2 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                <AlertTriangle className="size-4 text-amber-600 shrink-0" />
                <span>Operator Attention Required (Rule Parser Anomalies)</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11.5px] text-amber-800/90 pl-1">
                {reviewReasons.map((reason, i) => (
                  <li key={i} className="leading-relaxed">
                    {reason}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700 italic pt-0.5">
                Values flagged above have been set to blank or null. Please review and enter/confirm
                the accurate values manually.
              </p>
            </div>
          )}

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

          {/* Commercials: Primary Rate & Currency */}
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
                onChange={(e) => {
                  setRatePerContainer(e.target.value);
                  if (!oceanFreight) setOceanFreight(e.target.value);
                }}
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
                className="h-9.5 font-mono rounded-xl font-bold"
                placeholder="USD"
                required
              />
            </div>
          </div>

          {/* Itemized Charges Breakdown (Collapsible / Structured Table) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
            <button
              type="button"
              onClick={() => setShowBreakdown((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs font-bold text-slate-800 hover:text-[#0FA3B1] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Receipt className="size-4 text-[#0FA3B1]" />
                <span>Itemized Charge Breakdown & Totals</span>
              </div>
              {showBreakdown ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </button>

            {showBreakdown && (
              <div className="space-y-3 pt-1 border-t border-slate-200/60 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label
                      htmlFor="oceanFreight"
                      className="text-[11px] text-slate-600 font-medium"
                    >
                      Ocean Freight
                    </Label>
                    <Input
                      id="oceanFreight"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={oceanFreight}
                      onChange={(e) => setOceanFreight(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="thc" className="text-[11px] text-slate-600 font-medium">
                      THC (Terminal)
                    </Label>
                    <Input
                      id="thc"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={thc}
                      onChange={(e) => setThc(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="originCharges"
                      className="text-[11px] text-slate-600 font-medium"
                    >
                      Origin Charges
                    </Label>
                    <Input
                      id="originCharges"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={originCharges}
                      onChange={(e) => setOriginCharges(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="destCharges" className="text-[11px] text-slate-600 font-medium">
                      Dest. Charges
                    </Label>
                    <Input
                      id="destCharges"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={destinationCharges}
                      onChange={(e) => setDestinationCharges(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="docCharges" className="text-[11px] text-slate-600 font-medium">
                      Documentation
                    </Label>
                    <Input
                      id="docCharges"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={documentationCharges}
                      onChange={(e) => setDocumentationCharges(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="customsCharges"
                      className="text-[11px] text-slate-600 font-medium"
                    >
                      Customs / Clearance
                    </Label>
                    <Input
                      id="customsCharges"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={customsCharges}
                      onChange={(e) => setCustomsCharges(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="truckingCharges"
                      className="text-[11px] text-slate-600 font-medium"
                    >
                      Trucking / Haulage
                    </Label>
                    <Input
                      id="truckingCharges"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={truckingCharges}
                      onChange={(e) => setTruckingCharges(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="otherCharges"
                      className="text-[11px] text-slate-600 font-medium"
                    >
                      Other Surcharges
                    </Label>
                    <Input
                      id="otherCharges"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={otherCharges}
                      onChange={(e) => setOtherCharges(e.target.value)}
                      className="h-8.5 rounded-lg text-xs"
                    />
                  </div>
                </div>

                {/* Totals Comparison Strip */}
                <div className="bg-white rounded-xl border border-slate-200 p-2.5 flex items-center justify-between flex-wrap gap-2 text-[11.5px]">
                  <div>
                    <span className="text-slate-500">Calculated Sum: </span>
                    <strong className="font-mono text-slate-900 font-bold">
                      {currency}{" "}
                      {calculatedSum.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="quotedTotal" className="text-slate-500 text-[11px]">
                      Quoted Total:
                    </Label>
                    <Input
                      id="quotedTotal"
                      type="number"
                      step="0.01"
                      placeholder="Quoted Total"
                      value={quotedTotal}
                      onChange={(e) => setQuotedTotal(e.target.value)}
                      className="h-7.5 w-28 text-xs font-mono font-bold text-slate-900 rounded-lg"
                    />
                  </div>
                </div>

                {hasTotalDiscrepancy && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200 flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-600" />
                    <span>
                      Discrepancy detected: Explicit quoted total ({currency} {parsedQuotedTotal})
                      does not equal sum of itemized charges ({currency} {calculatedSum}).
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carrier & Equipment */}
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

          {/* Vessel & Voyage */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="vessel" className="text-xs font-semibold text-slate-700">
                Vessel Name
              </Label>
              <Input
                id="vessel"
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                className="h-9.5 rounded-xl"
                placeholder="e.g., MSC PALOMA"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="voyage" className="text-xs font-semibold text-slate-700">
                Voyage Number
              </Label>
              <Input
                id="voyage"
                value={voyageNumber}
                onChange={(e) => setVoyageNumber(e.target.value)}
                className="h-9.5 rounded-xl"
                placeholder="e.g., 264E"
              />
            </div>
          </div>

          {/* Equipment Size & Quantity */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="containerType" className="text-xs font-semibold text-slate-700">
                Container Type / Size
              </Label>
              <Input
                id="containerType"
                value={containerType}
                onChange={(e) => setContainerType(e.target.value)}
                className="h-9.5 rounded-xl"
                placeholder="40HC / 20FT"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="containerCount" className="text-xs font-semibold text-slate-700">
                Container Quantity
              </Label>
              <Input
                id="containerCount"
                type="number"
                min="1"
                value={containerCount}
                onChange={(e) => setContainerCount(e.target.value)}
                className="h-9.5 rounded-xl"
              />
            </div>
          </div>

          {/* Schedule: ETD, ETA, Transit, Free Days, Validity */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="etd" className="text-xs font-semibold text-slate-700">
                Proposed ETD / Sailing Date
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
                Estimated ETA / Arrival Date
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

          {/* Quotation Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="qref" className="text-xs font-semibold text-slate-700">
                Quotation Reference
              </Label>
              <Input
                id="qref"
                value={quotationReference}
                onChange={(e) => setQuotationReference(e.target.value)}
                className="h-9.5 rounded-xl font-mono"
                placeholder="e.g. Q-APEX-2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-xs font-semibold text-slate-700">
                Remarks / Surcharges
              </Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Direct vessel sailing, standard demurrage applies"
                className="h-9.5 text-xs rounded-xl"
              />
            </div>
          </div>

          {/* Original Email / Evidence Snippet */}
          {offer?.originalEmailBody && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 text-slate-700 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 text-[11px]">
                <Mail className="size-3.5 text-slate-500" />
                <span>Source Email Excerpt (Evidence)</span>
              </div>
              <p className="font-mono text-[10.5px] text-slate-600 whitespace-pre-wrap bg-white p-2 rounded-lg border border-slate-200/80 max-h-24 overflow-y-auto">
                {offer.originalEmailBody}
              </p>
            </div>
          )}

          <div className="rounded-2xl bg-[#0FA3B1]/10 border border-[#0FA3B1]/20 p-3 flex items-center gap-2.5 text-slate-800 text-xs">
            <ShieldCheck className="size-4 text-[#0FA3B1] shrink-0" />
            <span>
              All status updates, rule extractions, and manual adjustments are tracked with audit
              logs in the timeline.
            </span>
          </div>

          {/* Footer Controls */}
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
                  <span>Save & Confirm Quotation</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
});
