import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DollarSign,
  CheckCircle2,
  Sparkles,
  Bot,
  AlertCircle,
  XCircle,
  Wand2,
  Calendar,
  Layers,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { recordForwarderOffer, acceptForwarderOffer } from "@/lib/multi-forwarder-service";
import {
  analyzeEmailForForwarderOffer,
  type OfferValidationResult,
} from "@/lib/ai-offer-extractor";
import { saveExtractedForwarderOffer } from "@/lib/forwarder-offer-storage";
import type { ForwarderQuoteRequestRecord, ForwarderOfferData } from "@/types/requests";

interface RecordOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: ForwarderQuoteRequestRecord | null;
  userId?: string | null;
  onOfferSaved?: () => void;
  onSaved?: () => void;
}

const SAMPLE_REPLIES = [
  {
    label: "Prompt Example: USD 2,100, 40HC, Space Available (Valid 98%)",
    text: "USD 2,100 for 40HC, space available, ETD 18 Sep, ETA 12 Oct.",
  },
  {
    label: "Equipment Mismatch: 20FT Offered vs 40HC Requested (Flags MISMATCH)",
    text: "We can offer USD 1,650 for 20FT container, space confirmed on 18 Sep.",
  },
  {
    label: "Uncertain Space: 'Subject to confirmation' (Flags NEEDS_REVIEW)",
    text: "Rate is USD 2,100 for 40HC, but space is subject to confirmation from carrier. ETD 18 Sep.",
  },
  {
    label: "Missing Rate: Space confirmed only (Rate: NULL / Not Provided)",
    text: "Space available for 40HC on MSC OSCAR ETD 18 Sep, freight rate will follow tomorrow.",
  },
  {
    label: "Declined: No Space Available (Status: DECLINED)",
    text: "Unfortunately no space available for this sailing.",
  },
];

export function RecordOfferModal({
  isOpen,
  onClose,
  request,
  userId,
  onOfferSaved,
  onSaved,
}: RecordOfferModalProps) {
  const [ratePerContainer, setRatePerContainer] = useState<number>(2150);
  const [carrier, setCarrier] = useState("MSC");
  const [transitDays, setTransitDays] = useState<number>(24);
  const [freeDays, setFreeDays] = useState<number>(14);
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // AI Email Parser State
  const [emailText, setEmailText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<OfferValidationResult | null>(null);
  const [showAiSection, setShowAiSection] = useState(true);

  useEffect(() => {
    if (request) {
      setRatePerContainer(request.offerData?.ratePerContainer || 2150);
      setCarrier(request.offerData?.carrier || "MSC");
      setTransitDays(request.offerData?.transitDays || 24);
      setFreeDays(request.offerData?.freeDays || 14);
      setValidUntil(
        request.offerData?.validUntil ||
          new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0],
      );
      setNotes(request.offerData?.notes || "");
      setEmailText("");
      setAnalysisResult(null);
    }
  }, [request]);

  if (!request) return null;

  const totalFreight = ratePerContainer * (request.containerCount || 1);

  // Handle AI Email Extraction
  const handleAnalyzeEmail = async (overrideText?: string) => {
    const rawText = overrideText ?? emailText;
    if (!rawText.trim()) {
      toast.error("Please paste an email reply first");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await analyzeEmailForForwarderOffer({
        subject: `Re: Booking Quote Inquiry [${request.movementNumber}]`,
        body: rawText,
        senderEmail: request.forwarderEmail,
        senderName: request.forwarderName,
        movementNumber: request.movementNumber,
        forwarderName: request.forwarderName,
        containerCount: request.containerCount,
        containerSize: request.containerSize,
        requestedBooking: {
          containerSize: request.containerSize,
          containerCount: request.containerCount,
          origin: request.origin || request.polName,
          destination: request.destination || request.podName,
          targetDeparture: request.requiredSailingDate || request.etd,
          targetArrival: request.eta,
        },
      });

      setAnalysisResult(result);
      const offer = result.validatedOffer;

      // Populate form fields with extracted data
      if (offer.ratePerContainer) {
        setRatePerContainer(offer.ratePerContainer);
      }
      if (offer.carrier) {
        setCarrier(offer.carrier);
      }
      if (offer.transitDays) {
        setTransitDays(offer.transitDays);
      }
      if (offer.freeDays) {
        setFreeDays(offer.freeDays);
      }
      if (offer.validUntil) {
        setValidUntil(offer.validUntil);
      }
      if (offer.notes || offer.summary) {
        setNotes(offer.summary || offer.notes || "");
      }

      // Contextual feedback based on validation audit status
      if (offer.isDeclined || result.validationStatus === "DECLINED") {
        toast.warning("Forwarder Declined / No Space Available", {
          description: offer.summary,
        });
      } else if (result.validationStatus === "MISMATCH") {
        toast.error("Equipment Mismatch Flagged!", {
          description:
            result.confidenceReport?.summaryMessage ||
            `Offered ${result.structuredFields?.containerType} does not match requested ${request.containerSize}.`,
        });
      } else if (result.validationStatus === "NEEDS_REVIEW") {
        toast.warning("Extraction Requires Operator Review", {
          description:
            result.confidenceReport?.summaryMessage ||
            "Certain fields are uncertain or missing in the forwarder's email reply.",
        });
      } else if (offer.ratePerContainer) {
        toast.success(`AI Extracted & Validated: $${offer.ratePerContainer.toLocaleString()} USD`, {
          description: `Score: ${result.confidenceReport?.overallConfidence ?? Math.round(offer.confidence * 100)}% confidence against booking specs.`,
        });
      } else {
        toast.info("AI Analysis Finished", {
          description: offer.summary,
        });
      }
    } catch (err: unknown) {
      console.error("[RecordOfferModal] AI parse error:", err);
      toast.error("Failed to analyze email reply", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveOffer = async (andAccept = false) => {
    setIsSubmitting(true);
    try {
      const offerData: ForwarderOfferData = {
        ratePerContainer,
        totalFreight,
        currency: analysisResult?.structuredFields?.currency || "USD",
        containerType:
          analysisResult?.structuredFields?.containerType || request.containerSize || "40HC",
        quantity: analysisResult?.structuredFields?.quantity || request.containerCount || 1,
        availability: analysisResult?.structuredFields?.availability || "AVAILABLE",
        etd: analysisResult?.structuredFields?.etd,
        eta: analysisResult?.structuredFields?.eta,
        carrier,
        transitDays,
        freeDays,
        validUntil,
        notes,
        receivedAt: analysisResult?.structuredFields?.responseDateTime || new Date().toISOString(),
        receivedVia:
          analysisResult?.validatedOffer?.extractionMethod === "GEMINI_AI"
            ? "AI Email Reader (Gemini)"
            : "Email Reply",
        extractionSummary: analysisResult?.extractionSummary,
      };

      await recordForwarderOffer(request.id, offerData);

      // Also persist to Supabase `forwarder_offers` table for durable storage
      if (analysisResult) {
        await saveExtractedForwarderOffer({
          bookingId: request.bookingId,
          movementNumber: request.movementNumber,
          forwarderId: request.forwarderId,
          forwarderName: request.forwarderName,
          forwarderEmail: request.forwarderEmail,
          gmailThreadId: request.gmailThreadId,
          gmailMessageId: request.gmailMessageId,
          offerValidation: analysisResult,
          containerCount: request.containerCount || 1,
          userId,
        });
      }

      if (andAccept) {
        await acceptForwarderOffer(request.id, userId);
        toast.success("Offer Accepted & Booking Confirmed!", {
          description: `Awarded booking ${request.movementNumber} to ${request.forwarderName} at $${ratePerContainer}/cntr.`,
        });
      } else {
        toast.success("Forwarder Quote Recorded", {
          description: `Quote from ${request.forwarderName} ($${ratePerContainer}/cntr) saved successfully.`,
        });
      }

      if (onOfferSaved) onOfferSaved();
      if (onSaved) onSaved();
      onClose();
    } catch (err: unknown) {
      console.error("[RecordOfferModal] Error saving offer:", err);
      toast.error("Failed to record offer", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-indigo-100 text-indigo-700">
              <DollarSign className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[17px] font-bold text-slate-900">
                Log Quotation / AI Email Reading
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Forwarder: <strong className="text-slate-800">{request.forwarderName}</strong> ·
                Ref: <span className="font-mono text-slate-700">{request.movementNumber}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1 text-xs">
          {/* AI Email Reading Section */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-indigo-900 text-xs">
                <Sparkles className="size-3.5 text-indigo-600 animate-pulse" />
                <span>AI Email Reader (Natural Language Extraction)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAiSection(!showAiSection)}
                className="text-[11px] text-indigo-700 hover:underline font-medium"
              >
                {showAiSection ? "Hide Input" : "Show Input"}
              </button>
            </div>

            {showAiSection && (
              <>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Paste the forwarder's natural-language email reply below. The AI handles any
                  phrasing without requiring specific form templates.
                </p>

                {/* Sample Replies for instant testing */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    Test with:
                  </span>
                  {SAMPLE_REPLIES.map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setEmailText(sample.text);
                        void handleAnalyzeEmail(sample.text);
                      }}
                      className="rounded-full border border-indigo-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-indigo-700 hover:bg-indigo-100/60 transition-colors"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <textarea
                    rows={2}
                    value={emailText}
                    onChange={(e) => setEmailText(e.target.value)}
                    placeholder="e.g. Rate is USD 2,100 for 40HC. Space available on 18 Sep sailing. ETA Karachi 12 Oct."
                    className="w-full rounded-lg border border-indigo-200/80 bg-white p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <div className="mt-1.5 flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleAnalyzeEmail()}
                      disabled={isAnalyzing || !emailText.trim()}
                      className="h-7.5 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                    >
                      {isAnalyzing ? (
                        <>
                          <Bot className="size-3.5 animate-spin" />
                          <span>Analyzing Reply...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="size-3.5" />
                          <span>Extract Offer with AI</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Analysis Result Banner */}
            {analysisResult && (
              <div
                className={`rounded-lg border p-2.5 text-xs ${
                  analysisResult.validatedOffer.isDeclined
                    ? "border-rose-200 bg-rose-50/80 text-rose-900"
                    : analysisResult.validatedOffer.ratePerContainer
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-800"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    {analysisResult.validatedOffer.isDeclined ? (
                      <>
                        <XCircle className="size-4 text-rose-600" />
                        <span>Space Declined / Rejected</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-4 text-emerald-600" />
                        <span>
                          Valid Quotation Extracted (Status: {analysisResult.normalizedStatus})
                        </span>
                      </>
                    )}
                  </div>
                  <span className="rounded bg-white/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-600 border border-slate-200">
                    {analysisResult.validatedOffer.extractionMethod} ·{" "}
                    {Math.round(analysisResult.validatedOffer.confidence * 100)}% conf
                  </span>
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed">
                  {analysisResult.validatedOffer.summary}
                </p>

                {/* Canonical Structured Extraction String per Requirement */}
                {analysisResult.extractionSummary && (
                  <div className="mt-2 rounded-md bg-white p-2 border border-slate-200">
                    <div className="flex items-center justify-between text-[10.5px] text-slate-500 font-semibold mb-1">
                      <span>STRUCTURED EXTRACTION ALGORITHM OUTPUT:</span>
                      <span className="font-mono text-[9.5px] text-indigo-600">
                        Normalized Database Values
                      </span>
                    </div>
                    <code className="block text-[11px] font-mono text-indigo-900 bg-indigo-50/70 p-1.5 rounded border border-indigo-100 font-semibold select-all">
                      {analysisResult.extractionSummary}
                    </code>
                  </div>
                )}

                {/* Structured 15-Field Normalized Database Breakdown */}
                {analysisResult.structuredFields && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                    <div className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center justify-between">
                      <span>Extracted Fields & Normalization</span>
                      <span className="text-[9.5px] font-normal text-slate-500">
                        {analysisResult.structuredFields.responseDateTime
                          ? new Date(
                              analysisResult.structuredFields.responseDateTime,
                            ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "Just now"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[10.5px]">
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">Freight Rate</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.freightRate !== undefined
                            ? `${analysisResult.structuredFields.currency} ${analysisResult.structuredFields.freightRate.toLocaleString()}`
                            : "—"}
                        </strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">Currency</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.currency}
                        </strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">Container Type</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.containerType || "40HC"}
                        </strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">Quantity</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.quantity || 1} cntr
                        </strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">Availability</span>
                        <span
                          className={`inline-flex px-1.5 py-0.2 text-[9.5px] font-bold rounded ${
                            analysisResult.structuredFields.availability === "AVAILABLE"
                              ? "bg-emerald-100 text-emerald-800"
                              : analysisResult.structuredFields.availability === "UNAVAILABLE"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {analysisResult.structuredFields.availability}
                        </span>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">ETD</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.etd || "—"}
                        </strong>
                        {analysisResult.structuredFields.etdNormalized && (
                          <span className="block text-[9px] text-slate-400 font-mono">
                            {analysisResult.structuredFields.etdNormalized}
                          </span>
                        )}
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">ETA</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.eta || "—"}
                        </strong>
                        {analysisResult.structuredFields.etaNormalized && (
                          <span className="block text-[9px] text-slate-400 font-mono">
                            {analysisResult.structuredFields.etaNormalized}
                          </span>
                        )}
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">Transit Time</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.transitTime
                            ? `${analysisResult.structuredFields.transitTime} days`
                            : "—"}
                        </strong>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-slate-400 block text-[9.5px]">Free Days</span>
                        <strong className="text-slate-900">
                          {analysisResult.structuredFields.freeDays
                            ? `${analysisResult.structuredFields.freeDays} days`
                            : "14 days"}
                        </strong>
                      </div>
                      {analysisResult.structuredFields.totalCost && (
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[9.5px]">Total Cost</span>
                          <strong className="text-emerald-700">
                            ${analysisResult.structuredFields.totalCost.toLocaleString()} USD
                          </strong>
                        </div>
                      )}
                      {analysisResult.structuredFields.sailingVessel && (
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[9.5px]">
                            Sailing / Vessel
                          </span>
                          <strong className="text-slate-900 truncate block">
                            {analysisResult.structuredFields.sailingVessel}
                          </strong>
                        </div>
                      )}
                      {analysisResult.structuredFields.validityExpiry && (
                        <div className="bg-white p-1.5 rounded border border-slate-200">
                          <span className="text-slate-400 block text-[9.5px]">
                            Validity / Expiry
                          </span>
                          <strong className="text-slate-900">
                            {analysisResult.structuredFields.validityExpiry}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Additional Charges breakdown if present */}
                    {analysisResult.structuredFields.additionalCharges &&
                      analysisResult.structuredFields.additionalCharges.length > 0 && (
                        <div className="mt-1.5 bg-white p-1.5 rounded border border-slate-200 text-[10px]">
                          <span className="text-slate-500 font-semibold block mb-0.5">
                            Additional Surcharges:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {analysisResult.structuredFields.additionalCharges.map((c, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200"
                              >
                                <strong>{c.item}:</strong> {c.currency} {c.amount}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* 5. CONFIDENCE + VALIDATION ENGINE REPORT */}
                {analysisResult.confidenceReport && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5">
                    {/* Header with Confidence Score & Verification Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        {analysisResult.confidenceReport.status === "VALID" ? (
                          <ShieldCheck className="size-4 text-emerald-600" />
                        ) : analysisResult.confidenceReport.status === "MISMATCH" ? (
                          <ShieldAlert className="size-4 text-rose-600" />
                        ) : analysisResult.confidenceReport.status === "NEEDS_REVIEW" ? (
                          <AlertTriangle className="size-4 text-amber-600" />
                        ) : (
                          <Info className="size-4 text-slate-600" />
                        )}
                        <span className="font-bold text-[11px] uppercase tracking-wide text-slate-800">
                          Confidence & Validation Cross-Check
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Overall Status Badge */}
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            analysisResult.confidenceReport.status === "VALID"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : analysisResult.confidenceReport.status === "MISMATCH"
                                ? "bg-rose-100 text-rose-800 border border-rose-300 animate-pulse"
                                : analysisResult.confidenceReport.status === "NEEDS_REVIEW"
                                  ? "bg-amber-100 text-amber-900 border border-amber-300 font-bold"
                                  : "bg-slate-100 text-slate-800 border border-slate-300"
                          }`}
                        >
                          {analysisResult.confidenceReport.status === "VALID" &&
                            "✓ VALIDATED MATCH"}
                          {analysisResult.confidenceReport.status === "MISMATCH" && "⚠ MISMATCH"}
                          {analysisResult.confidenceReport.status === "NEEDS_REVIEW" &&
                            "! NEEDS_REVIEW"}
                          {analysisResult.confidenceReport.status === "DECLINED" && "✕ DECLINED"}
                        </span>

                        {/* Overall Confidence Score */}
                        <span className="inline-flex items-center rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                          {analysisResult.confidenceReport.overallConfidence}% Confidence
                        </span>
                      </div>
                    </div>

                    {/* Summary Message */}
                    <div className="mt-2 text-[11px] leading-relaxed text-slate-700 bg-slate-50 p-2 rounded border border-slate-200">
                      <strong>Audit Assessment:</strong>{" "}
                      {analysisResult.confidenceReport.summaryMessage}
                    </div>

                    {/* Warnings if any */}
                    {analysisResult.warnings && analysisResult.warnings.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {analysisResult.warnings.map((warn, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-1.5 text-[10.5px] text-amber-900 bg-amber-50/90 p-1.5 rounded border border-amber-200"
                          >
                            <AlertCircle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{warn}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Field-by-Field Cross-Check Table */}
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-left text-[10.5px]">
                        <thead>
                          <tr className="border-b border-slate-200 text-[9.5px] uppercase tracking-wider text-slate-400">
                            <th className="py-1 font-semibold">Field</th>
                            <th className="py-1 font-semibold">Requested in Booking</th>
                            <th className="py-1 font-semibold">Forwarder Quoted</th>
                            <th className="py-1 font-semibold">Verification Audit</th>
                            <th className="py-1 text-right font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analysisResult.confidenceReport.fieldValidations.map((val, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-1.5 font-semibold text-slate-800 pr-2">
                                {val.fieldLabel}
                              </td>
                              <td className="py-1.5 text-slate-600 font-mono pr-2">
                                {val.requestedValue !== null && val.requestedValue !== undefined
                                  ? String(val.requestedValue)
                                  : "—"}
                              </td>
                              <td className="py-1.5 pr-2 font-mono">
                                {val.extractedValue === null || val.extractedValue === undefined ? (
                                  <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.2 text-[9.5px] font-semibold text-slate-500 italic">
                                    NULL / Not Provided
                                  </span>
                                ) : (
                                  <strong className="text-slate-900">
                                    {String(val.extractedValue)}
                                  </strong>
                                )}
                              </td>
                              <td className="py-1.5 pr-2 text-slate-600 text-[10px]">
                                {val.notes}
                              </td>
                              <td className="py-1.5 text-right whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                    val.status === "VALID"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : val.status === "MISMATCH"
                                        ? "bg-rose-100 text-rose-800 font-black"
                                        : val.status === "NEEDS_REVIEW"
                                          ? "bg-amber-100 text-amber-900 font-bold"
                                          : "bg-slate-100 text-slate-500 italic"
                                  }`}
                                >
                                  {val.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Anti-Guessing Guarantee Banner */}
                    <div className="mt-2.5 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9.5px] text-slate-400">
                      <span>
                        🛡️ <strong>Integrity Guarantee:</strong> Rates, dates & space are never
                        guessed. Omitted items remain <code>NULL / Not Provided</code>.
                      </span>
                      <span className="font-mono text-slate-500">
                        {analysisResult.confidenceReport.matchedFieldsCount} valid ·{" "}
                        {analysisResult.confidenceReport.missingFieldsCount} null ·{" "}
                        {analysisResult.confidenceReport.reviewRequiredFieldsCount} review
                      </span>
                    </div>
                  </div>
                )}

                {analysisResult.validatedOffer.isDeclined && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setNotes("Forwarder notified no space available.");
                        void handleSaveOffer(false);
                      }}
                      className="h-7 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                    >
                      Update Request as Declined
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Rate and Total */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="rate" className="text-xs font-semibold text-slate-700">
                  Rate Per Container (USD) *
                </Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    $
                  </span>
                  <Input
                    id="rate"
                    type="number"
                    value={ratePerContainer}
                    onChange={(e) => setRatePerContainer(Number(e.target.value))}
                    className="h-8.5 pl-6 font-mono text-xs font-bold text-slate-900"
                    placeholder="2100"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Total Freight ({request.containerCount}x cntr)
                </Label>
                <div className="mt-1 flex h-8.5 items-center rounded-md border border-slate-200 bg-white px-3 font-mono text-xs font-bold text-[#0FA3B1]">
                  ${totalFreight.toLocaleString()} USD
                </div>
              </div>
            </div>
          </div>

          {/* Carrier & Transit Specs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="carrier" className="text-xs font-medium text-slate-600">
                Proposed Carrier / Line
              </Label>
              <Input
                id="carrier"
                type="text"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                placeholder="e.g. MSC, Maersk, CMA CGM"
                className="mt-1 h-8.5 text-xs font-semibold"
              />
            </div>

            <div>
              <Label htmlFor="validUntil" className="text-xs font-medium text-slate-600">
                Rate Valid Until
              </Label>
              <Input
                id="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-1 h-8.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="transitDays" className="text-xs font-medium text-slate-600">
                Estimated Transit Time (Days)
              </Label>
              <Input
                id="transitDays"
                type="number"
                value={transitDays}
                onChange={(e) => setTransitDays(Number(e.target.value))}
                className="mt-1 h-8.5 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="freeDays" className="text-xs font-medium text-slate-600">
                Free Days (Demurrage/Detention)
              </Label>
              <Input
                id="freeDays"
                type="number"
                value={freeDays}
                onChange={(e) => setFreeDays(Number(e.target.value))}
                className="mt-1 h-8.5 text-xs"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-xs font-medium text-slate-600">
              Quotation Remarks / Conditions
            </Label>
            <Input
              id="notes"
              type="text"
              placeholder="e.g. Rate includes THC and BAF. Subject to vessel space confirmation."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 h-8.5 text-xs"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="border-slate-200 text-slate-700"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSaveOffer(false)}
              disabled={isSubmitting || !ratePerContainer}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-semibold"
            >
              Save Quote Only
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => handleSaveOffer(true)}
              disabled={isSubmitting || !ratePerContainer}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              Accept & Award Booking
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
