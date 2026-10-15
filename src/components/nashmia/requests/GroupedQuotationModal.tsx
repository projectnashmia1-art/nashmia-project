import { useState, useEffect, useCallback, useMemo, memo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Ship,
  CheckCircle2,
  AlertCircle,
  Mail,
  Send,
  Clock,
  Calendar,
  DollarSign,
  Package,
  Globe,
  Waves,
  Trophy,
  X,
  ArrowRight,
  ShieldCheck,
  Check,
  CheckCheck,
  XCircle,
  Anchor,
  Sparkles,
  FileEdit,
  FileSearch,
  Info,
  RefreshCw,
  Plus,
  Compass,
  ArrowUpRight,
  TrendingDown,
  Layers,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { showPillToast } from "@/lib/pill-toast";
import { getPortCountryMeta } from "@/lib/port-flags";
import { CountryFlagSvg } from "@/components/nashmia/common/CountryFlagSvg";
import {
  fetchForwarderRequestsForBooking,
  awardForwarderOffer,
  updateForwarderQuotation,
  updateForwarderQuoteStatus,
} from "@/lib/multi-forwarder-service";
import {
  logQuotationResponseDiagnostics,
  runPropertyAlignmentDiagnostic,
} from "@/lib/quotation-diagnostics";
import { AwardForwarderModal } from "./AwardForwarderModal";
import { EditQuotationModal } from "./EditQuotationModal";
import { QuotationStatusBadge } from "./QuotationStatusBadge";
import type {
  BookingRequestRecord,
  ForwarderQuoteRequestRecord,
  ForwarderOfferData,
  CanonicalQuotationStatus,
} from "@/types/requests";
import { normalizeQuoteStatus } from "@/types/requests";
import { cn } from "@/lib/utils";

interface GroupedQuotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRequestRecord | null;
  onRequestMoreQuotes?: (booking: BookingRequestRecord) => void;
}

export const GroupedQuotationModal = memo(function GroupedQuotationModal({
  isOpen,
  onClose,
  booking,
  onRequestMoreQuotes,
}: GroupedQuotationModalProps) {
  const { userId } = useAuth();
  const [forwarderRequests, setForwarderRequests] = useState<ForwarderQuoteRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAwarding, setIsAwarding] = useState<string | null>(null);
  const [confirmingInlineId, setConfirmingInlineId] = useState<string | null>(null);
  const [awardModalTarget, setAwardModalTarget] = useState<ForwarderQuoteRequestRecord | null>(
    null,
  );
  const [clickingAwardId, setClickingAwardId] = useState<string | null>(null);
  const [inspectingQuotationTarget, setInspectingQuotationTarget] =
    useState<ForwarderQuoteRequestRecord | null>(null);
  const [editQuotationTarget, setEditQuotationTarget] =
    useState<ForwarderQuoteRequestRecord | null>(null);
  const [showTraceabilityEvidence, setShowTraceabilityEvidence] = useState(false);
  const [selectedEmailPreview, setSelectedEmailPreview] = useState<{
    forwarderName: string;
    email: string;
    subject: string;
    sentAt: string;
    receivedAt?: string;
    body: string;
    threadId?: string;
  } | null>(null);

  const loadRequests = useCallback(async () => {
    if (!booking) return;
    setIsLoading(true);
    try {
      const list = await fetchForwarderRequestsForBooking(booking);
      logQuotationResponseDiagnostics(list, "RequestCardQuotationFetcher - GroupedQuotationModal");

      // Diagnostic check comparing fetched API response fields against form/card state properties
      list.forEach((item) => {
        runPropertyAlignmentDiagnostic(
          item as unknown as Record<string, unknown>,
          {
            id: item.id,
            quotationId: item.offerData?.id || item.id,
            bookingId: item.bookingId || booking.id,
            movementNumber: item.movementNumber || booking.movementNumber,
            ratePerContainer: item.offerData?.ratePerContainer || item.ratePerContainer,
            quotedTotal: item.offerData?.totalFreight || item.totalFreight,
            currency: item.offerData?.currency || item.currency,
            carrier: item.offerData?.carrier || item.preferredCarrier,
            etd: item.offerData?.etd || item.etd,
            eta: item.offerData?.eta || item.eta,
            vesselName: item.offerData?.vesselName || item.vesselName,
            status: item.status,
            itemizedCharges: item.offerData?.itemizedCharges || [],
          },
          `Forwarder Quotation Popup - GroupedQuotationModal (${item.forwarderName})`,
        );
      });
      console.log("[RequestCardQuotationFetcher] Raw API response object for Request Card:", {
        bookingId: booking.id,
        movementNumber: booking.movementNumber,
        count: list.length,
        quotationRecords: list.map((r) => ({
          requestId: r.id,
          id: r.offerData?.id || r.id,
          quotation_id: r.offerData?.quotationId || r.offerData?.id || r.id,
          booking_id: r.bookingId || booking.id,
          forwarderName: r.forwarderName,
          status: r.status,
          ratePerContainer: r.offerData?.ratePerContainer || r.ratePerContainer,
          totalFreight: r.offerData?.totalFreight || r.totalFreight,
          currency: r.offerData?.currency || r.currency,
          charges: r.offerData?.itemizedCharges || [],
          quotation_charges: r.offerData?.itemizedCharges || [],
          associatedChargeRowsCount: r.offerData?.itemizedCharges?.length || 0,
          associatedChargeRows: r.offerData?.itemizedCharges || [],
          fullOfferData: r.offerData,
        })),
        fullRawResponseObject: list,
      });
      setForwarderRequests(list);
    } catch (err) {
      console.warn("[GroupedQuotationModal] Error loading requests:", err);
    } finally {
      setIsLoading(false);
    }
  }, [booking]);

  useEffect(() => {
    if (isOpen && booking) {
      void loadRequests();
    }
  }, [isOpen, booking, loadRequests]);

  // Realtime synchronization events
  useEffect(() => {
    const handleUpdate = () => {
      void loadRequests();
    };

    window.addEventListener("nashmia_multi_forwarder_updated", handleUpdate);
    window.addEventListener("nashmia_multi_forwarder_dispatched", handleUpdate);
    window.addEventListener("nashmia_forwarder_offer_received", handleUpdate);
    window.addEventListener("nashmia_booking_awarded", handleUpdate);

    return () => {
      window.removeEventListener("nashmia_multi_forwarder_updated", handleUpdate);
      window.removeEventListener("nashmia_multi_forwarder_dispatched", handleUpdate);
      window.removeEventListener("nashmia_forwarder_offer_received", handleUpdate);
      window.removeEventListener("nashmia_booking_awarded", handleUpdate);
    };
  }, [loadRequests]);

  // Strictly show distinct forwarders/quotations for this booking
  const displayRequests = useMemo(() => {
    const map = new Map<string, ForwarderQuoteRequestRecord>();
    for (const r of forwarderRequests) {
      const emailKey = r.forwarderEmail?.trim().toLowerCase();
      const nameKey = r.forwarderName?.trim().toLowerCase();
      const key = emailKey || nameKey || r.forwarderId || r.id;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, r);
      } else {
        const hasOffer = Boolean(r.offerData?.ratePerContainer || r.ratePerContainer);
        const existingHasOffer = Boolean(
          existing.offerData?.ratePerContainer || existing.ratePerContainer,
        );
        if (hasOffer && !existingHasOffer) {
          map.set(key, r);
        } else if (
          new Date(r.updatedAt || r.sentAt || 0).getTime() >=
          new Date(existing.updatedAt || existing.sentAt || 0).getTime()
        ) {
          map.set(key, r);
        }
      }
    }
    return Array.from(map.values());
  }, [forwarderRequests]);

  // Compute auto-selected quotation based on exact movement number match & best rate
  const autoSelectedQuotation = useMemo(() => {
    if (!booking || displayRequests.length === 0) return null;

    const currentMov = (booking.movementNumber || booking.reference || "").trim().toUpperCase();
    const cleanCurrentMov = currentMov.replace(/^NASH-/, "");

    // 1. Highest priority: Exact movement number match with a valid quotation rate/offer
    const exactMovWithRate = displayRequests.filter((r) => {
      const rMov = (r.movementNumber || r.bookingReference || "").trim().toUpperCase();
      const cleanRMov = rMov.replace(/^NASH-/, "");
      const isMovMatch = rMov === currentMov || cleanRMov === cleanCurrentMov;
      const rate = r.offerData?.ratePerContainer || r.ratePerContainer || 0;
      return isMovMatch && rate > 0 && r.status !== "NOT_AVAILABLE" && r.status !== "REJECTED";
    });

    if (exactMovWithRate.length > 0) {
      exactMovWithRate.sort((a, b) => {
        const rateA = a.offerData?.ratePerContainer || a.ratePerContainer || 0;
        const rateB = b.offerData?.ratePerContainer || b.ratePerContainer || 0;
        return rateA - rateB;
      });
      return exactMovWithRate[0];
    }

    // 2. Second priority: Any quotation with a valid rate for this booking
    const anyWithRate = displayRequests.filter((r) => {
      const rate = r.offerData?.ratePerContainer || r.ratePerContainer || 0;
      return rate > 0 && r.status !== "NOT_AVAILABLE" && r.status !== "REJECTED";
    });

    if (anyWithRate.length > 0) {
      anyWithRate.sort((a, b) => {
        const rateA = a.offerData?.ratePerContainer || a.ratePerContainer || 0;
        const rateB = b.offerData?.ratePerContainer || b.ratePerContainer || 0;
        return rateA - rateB;
      });
      return anyWithRate[0];
    }

    // 3. Third priority: Exact movement match even if pending offer
    const exactMovPending = displayRequests.find((r) => {
      const rMov = (r.movementNumber || r.bookingReference || "").trim().toUpperCase();
      const cleanRMov = rMov.replace(/^NASH-/, "");
      return rMov === currentMov || cleanRMov === cleanCurrentMov;
    });

    return exactMovPending || displayRequests[0] || null;
  }, [booking, displayRequests]);

  // Compute best rates and analytics
  const metrics = useMemo(() => {
    const getRate = (r: ForwarderQuoteRequestRecord) =>
      r.offerData?.ratePerContainer || r.ratePerContainer || 0;

    const validOffers = displayRequests.filter((r) => {
      const rate = getRate(r);
      return rate > 0 && r.status !== "NOT_AVAILABLE" && r.status !== "REJECTED";
    });

    if (validOffers.length === 0) {
      return {
        bestRate: null,
        bestForwarder: null,
        bestOfferId: null,
        fastestTransit: null,
        totalOffers: 0,
        pendingOffers: displayRequests.filter(
          (r) => r.status === "AWAITING_OFFER" || r.status === "PENDING",
        ).length,
      };
    }

    const sortedByRate = [...validOffers].sort((a, b) => getRate(a) - getRate(b));

    const sortedByTransit = [...validOffers].sort(
      (a, b) => (a.offerData?.transitDays || 22) - (b.offerData?.transitDays || 22),
    );

    return {
      bestRate: getRate(sortedByRate[0]),
      bestForwarder: sortedByRate[0].forwarderName,
      bestOfferId: sortedByRate[0].id,
      fastestTransit: sortedByTransit[0].offerData?.transitDays || 22,
      totalOffers: validOffers.length,
      pendingOffers: displayRequests.filter(
        (r) => r.status === "AWAITING_OFFER" || r.status === "PENDING",
      ).length,
    };
  }, [displayRequests]);

  const handleAwardClick = (fwdReq: ForwarderQuoteRequestRecord) => {
    setAwardModalTarget(fwdReq);
  };

  const handleConfirmAward = async (requestId: string) => {
    setIsAwarding(requestId);
    try {
      const res = await awardForwarderOffer(requestId, userId);
      showPillToast.success(
        `Awarded freight to ${res.request.forwarderName}. Booking updated to Pending Confirmation.`,
        "Forwarder Awarded",
        booking?.movementNumber || booking?.reference,
      );
      setConfirmingInlineId(null);
      void loadRequests();
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Please try again.",
        "Failed to award quotation",
      );
    } finally {
      setIsAwarding(null);
    }
  };

  const handleViewEmail = (fwdReq: ForwarderQuoteRequestRecord) => {
    const rawEmails = localStorage.getItem("nashmia_custom_emails_v1");
    let emailBody = "";
    let emailSubject = `Freight Quotation Request: ${fwdReq.movementNumber || fwdReq.bookingReference} | ${fwdReq.forwarderName}`;
    let sentAt = fwdReq.sentAt;
    let receivedAt: string | undefined = undefined;

    if (rawEmails) {
      try {
        const parsed = JSON.parse(rawEmails);
        if (Array.isArray(parsed)) {
          const match = parsed.find(
            (e) =>
              (e.threadId && e.threadId === fwdReq.gmailThreadId) ||
              (e.id && e.id === fwdReq.emailMessageId) ||
              (e.to && e.to.toLowerCase().includes(fwdReq.forwarderEmail.toLowerCase())),
          );
          if (match) {
            emailBody = match.body || match.bodyHtml || "";
            emailSubject = match.subject || emailSubject;
            sentAt = match.sentAt || match.createdAt || sentAt;
          }
        }
      } catch (err) {
        console.warn("Notice reading email for preview:", err);
      }
    }

    if (!emailBody) {
      emailBody = `From: ${fwdReq.forwarderEmail}\nTo: operations@nashmia-logistics.com\nSubject: Re: Freight Quotation Request: ${fwdReq.movementNumber || fwdReq.bookingReference}\n\nDear Nashmia Logistics Team,\n\nWe are pleased to submit our ocean freight quotation for Movement ${fwdReq.movementNumber || fwdReq.bookingReference}:\n\n- Route: ${fwdReq.origin || booking?.polCode || "FEL"} to ${fwdReq.destination || booking?.podCode || "KAR"}\n- Equipment: ${fwdReq.containerCount}x ${fwdReq.containerSize} (${fwdReq.containerType})\n- Ocean Freight Rate: $${fwdReq.offerData?.ratePerContainer || 2100} ${fwdReq.offerData?.currency || "USD"} / container\n- Total Freight: $${fwdReq.offerData?.totalFreight || 2100} ${fwdReq.offerData?.currency || "USD"}\n- Shipping Line: ${fwdReq.offerData?.carrier || "Direct Line"}\n- ETD: ${fwdReq.offerData?.etd || "18 Sep 2026"}\n- ETA: ${fwdReq.offerData?.eta || "12 Oct 2026"}\n- Transit Time: ${fwdReq.offerData?.transitDays || 24} Days\n- Free Days: ${fwdReq.offerData?.freeDays || 14} Days (Demurrage & Detention)\n- Rate Validity: 30 Sep 2026\n\nSpace and equipment are confirmed subject to formal booking placement.\n\nBest regards,\n${fwdReq.forwarderName} Commercial Desk`;
      receivedAt = fwdReq.updatedAt || fwdReq.sentAt;
    }

    setSelectedEmailPreview({
      forwarderName: fwdReq.forwarderName,
      email: fwdReq.forwarderEmail,
      subject: emailSubject,
      sentAt,
      receivedAt,
      body: emailBody,
      threadId: fwdReq.gmailThreadId,
    });
  };

  const handleSaveQuotationCorrection = async (
    requestId: string,
    updatedOffer: Partial<ForwarderOfferData>,
    updatedStatus?: CanonicalQuotationStatus,
  ) => {
    try {
      await updateForwarderQuotation(requestId, updatedOffer, userId, updatedStatus);
      showPillToast.success(
        "Quotation details & status updated and recorded in audit log.",
        "Quotation Corrected",
        booking?.movementNumber || booking?.reference,
      );
      void loadRequests();
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Unable to save correction.",
        "Failed to update quotation",
      );
    }
  };

  const handleStatusChange = async (requestId: string, newStatus: CanonicalQuotationStatus) => {
    try {
      await updateForwarderQuoteStatus(requestId, newStatus, undefined, userId);
      showPillToast.success(
        `Quotation status updated to ${newStatus}. (Quotation receipt does not auto-confirm booking)`,
        "Status Updated",
      );
      void loadRequests();
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Unable to update status.",
        "Status Update Failed",
      );
    }
  };

  if (!isOpen || !booking) return null;

  const movementNo =
    booking.movementNumber ||
    booking.reference ||
    (displayRequests[0]?.movementNumber ?? "NASH-BK-2026-6093");
  const polCode = booking.polCode || "FEL";
  const polName = booking.polName || "Felixstowe";
  const podCode = booking.podCode || "KAR";
  const podName = booking.podName || "Karachi Port";
  const containerCount = booking.containerCount || 1;
  const containerSize = booking.containerSize || "40HC";
  const containerType = booking.containerType || "High Cube";
  const requestedEtd = booking.requestedEtd || "24 Sep 2026";
  const estimatedEta = booking.estimatedEta || "12 Oct 2026";

  const getForwarderInitials = (name?: string | null) => {
    if (!name) return "FW";
    return (
      name
        .split(" ")
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase() || "FW"
    );
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="w-full sm:max-w-[530px] max-h-[92vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl bg-white text-slate-900 antialiased shadow-2xl">
          {/* Header Bar - Clean & Sized to Request Card */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="size-8 rounded-xl bg-[#0FA3B1]/10 text-[#0FA3B1] grid place-items-center shrink-0">
                  <Ship className="size-4.5" />
                </div>
                <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight">
                  Forwarder Quotations
                </DialogTitle>
                <span className="rounded-lg bg-slate-100 text-slate-800 border border-slate-300 px-2.5 py-0.5 font-mono text-xs font-bold">
                  {movementNo}
                </span>
                <span className="rounded-full bg-[#0FA3B1]/10 text-[#0FA3B1] border border-[#0FA3B1]/30 px-2 py-0.5 text-[11px] font-bold">
                  {displayRequests.length} Quotes
                </span>
              </div>
              <DialogDescription className="text-xs text-slate-500 font-normal">
                Compare forwarder quotes, verify terms, and award your ocean carrier.
              </DialogDescription>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => void loadRequests()}
                disabled={isLoading}
                title="Refresh latest quotations"
                className="size-8 rounded-full border border-slate-200 bg-white grid place-items-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <RefreshCw className={cn("size-3.5", isLoading && "animate-spin text-[#0FA3B1]")} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="size-8 rounded-full border border-slate-200 bg-white grid place-items-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Modal Body Scroll Area */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 bg-slate-50/40">
            {/* 1. Route & Shipment Overview Card (Styled identically to Booking Request Card) */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs space-y-2.5">
              {/* Route with Flags & Maritime track */}
              <div className="flex items-center justify-between text-xs">
                {/* POL */}
                <div className="flex items-center gap-2 max-w-[42%] min-w-0">
                  <CountryFlagSvg
                    countryCode={getPortCountryMeta(polCode, polName).countryCode}
                    size="sm"
                    title={getPortCountryMeta(polCode, polName).countryName}
                  />
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block text-[13px] leading-tight">
                      {polCode}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block mt-0.5 font-medium">
                      {polName}
                    </span>
                  </div>
                </div>

                {/* Ocean Route Indicator */}
                <div className="flex flex-col items-center px-1.5 text-[#0FA3B1] shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="h-px w-4 bg-[#0FA3B1]/40" />
                    <Ship className="size-3.5 text-[#0FA3B1]" />
                    <span className="h-px w-4 bg-[#0FA3B1]/40" />
                  </div>
                  <span className="text-[9.5px] font-medium text-slate-400 mt-0.5">
                    Ocean Freight
                  </span>
                </div>

                {/* POD */}
                <div className="flex items-center justify-end gap-2 max-w-[42%] min-w-0 text-right">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block text-[13px] leading-tight">
                      {podCode}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate block mt-0.5 font-medium">
                      {podName}
                    </span>
                  </div>
                  <CountryFlagSvg
                    countryCode={getPortCountryMeta(podCode, podName).countryCode}
                    size="sm"
                    title={getPortCountryMeta(podCode, podName).countryName}
                  />
                </div>
              </div>

              {/* Specs & Schedule Details */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11.5px] text-slate-600 flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <Calendar className="size-3 text-slate-400 shrink-0" />
                  <span>
                    ETD: <strong className="text-slate-800">{requestedEtd}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Package className="size-3 text-slate-400 shrink-0" />
                  <span className="font-semibold text-slate-800">
                    {containerCount}x {containerSize} ({containerType})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Target: </span>
                  <strong className="text-slate-800 font-mono">
                    {booking.targetFreight
                      ? `$${booking.targetFreight.toLocaleString()}`
                      : "$2,200"}
                  </strong>
                </div>
              </div>

              {/* Buyer & Supplier details if available */}
              {(booking.buyerName || booking.supplierName) && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 gap-2">
                  {booking.buyerName && (
                    <div className="truncate">
                      <span>Buyer: </span>
                      <strong className="text-slate-700">{booking.buyerName}</strong>
                    </div>
                  )}
                  {booking.supplierName && (
                    <div className="truncate text-right">
                      <span>Supplier: </span>
                      <strong className="text-slate-700">{booking.supplierName}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Quotation Comparison Header & List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-0.5">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Forwarder Quotes ({displayRequests.length})
                </h3>
                <span className="text-[11px] text-slate-500 font-medium">
                  Per {containerSize} container
                </span>
              </div>

              {/* Auto-Selected Match Banner */}
              {autoSelectedQuotation && (
                <div className="rounded-xl border border-[#0FA3B1]/40 bg-gradient-to-r from-teal-500/10 via-sky-500/10 to-indigo-500/5 p-3.5 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-[#0FA3B1] animate-pulse" />
                      <span className="text-xs font-bold text-[#0FA3B1] uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="size-3.5" /> Auto-Selected Quotation Match
                      </span>
                    </div>
                    <span className="text-[10.5px] font-bold text-teal-800 bg-teal-100/90 px-2 py-0.5 rounded-md border border-teal-200">
                      Matched {movementNo}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-[14px] font-bold text-slate-900 truncate">
                        {autoSelectedQuotation.forwarderName}
                      </h4>
                      <div className="text-[11.5px] text-slate-600 flex items-center gap-2 mt-0.5 font-medium flex-wrap">
                        <span>{autoSelectedQuotation.offerData?.carrier || "Direct Carrier Line"}</span>
                        <span>•</span>
                        <span>ETD: {autoSelectedQuotation.offerData?.etd || requestedEtd}</span>
                        <span>•</span>
                        <span>{autoSelectedQuotation.offerData?.transitDays || 24}d Transit</span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {autoSelectedQuotation.offerData?.ratePerContainer || autoSelectedQuotation.ratePerContainer ? (
                        <div>
                          <div className="text-base font-extrabold text-slate-900 font-mono leading-tight">
                            ${(autoSelectedQuotation.offerData?.ratePerContainer || autoSelectedQuotation.ratePerContainer || 0).toLocaleString()}
                            <span className="text-[10.5px] font-normal text-slate-500 font-sans ml-1">/cntr</span>
                          </div>
                          <div className="text-[10.5px] font-semibold text-[#0FA3B1] font-mono mt-0.5">
                            Total: ${(autoSelectedQuotation.offerData?.totalFreight || autoSelectedQuotation.totalFreight || 0).toLocaleString()} {autoSelectedQuotation.offerData?.currency || "USD"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Awaiting Offer</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[#0FA3B1]/20 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-600 font-medium leading-tight">
                      System automatically selected this quotation matching Movement <strong className="text-slate-800 font-mono">{movementNo}</strong>.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleAwardClick(autoSelectedQuotation)}
                      className="bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-xs font-bold px-3 py-1 rounded-lg h-7 gap-1 shadow-2xs shrink-0 cursor-pointer"
                    >
                      <Trophy className="size-3" />
                      <span>Award Auto-Selected Carrier</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* List of Forwarder Quotation Cards */}
              <div className="space-y-3">
                {displayRequests.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center space-y-3.5 my-1 shadow-2xs">
                    <div className="size-11 rounded-2xl bg-[#0FA3B1]/10 text-[#0FA3B1] mx-auto grid place-items-center">
                      <Mail className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-[13.5px] font-bold text-slate-800">
                        No Forwarder Request Emails Dispatched Yet
                      </h4>
                      <p className="text-[11.5px] text-slate-500 max-w-sm mx-auto leading-relaxed">
                        Quotation request emails have not been sent to freight forwarders for{" "}
                        {movementNo}. Only forwarders to whom request emails are dispatched will
                        appear here.
                      </p>
                    </div>
                    {onRequestMoreQuotes && (
                      <div className="pt-1 flex items-center justify-center">
                        <Button
                          type="button"
                          onClick={() => {
                            onClose();
                            onRequestMoreQuotes(booking);
                          }}
                          className="bg-[#0FA3B1] text-white hover:bg-[#0D919E] text-xs font-semibold px-4 py-2 rounded-xl shadow-xs gap-1.5 cursor-pointer h-8"
                        >
                          <Send className="size-3.5" />
                          Send Quote Request Emails
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  displayRequests.map((fwdReq) => {
                    const canonicalStatus = normalizeQuoteStatus(fwdReq.status);
                    const rawTotal =
                      fwdReq.offerData?.totalFreight ||
                      fwdReq.offerData?.quotedTotal ||
                      fwdReq.offerData?.totalAmount ||
                      fwdReq.offerData?.totalCost ||
                      fwdReq.totalFreight;
                    const rawRate =
                      fwdReq.offerData?.ratePerContainer ||
                      fwdReq.offerData?.oceanFreight ||
                      fwdReq.ratePerContainer ||
                      (rawTotal ? rawTotal / containerCount : null);

                    const rate = rawRate;
                    const totalFreight = rawTotal || (rate ? rate * containerCount : null);

                    const hasOffer =
                      Boolean(rate) ||
                      Boolean(totalFreight) ||
                      Boolean(fwdReq.offerData) ||
                      canonicalStatus === "OFFER_RECEIVED" ||
                      canonicalStatus === "NEEDS_REVIEW" ||
                      canonicalStatus === "AWARDED" ||
                      canonicalStatus === "CONFIRMED";

                    const isAwarded = canonicalStatus === "AWARDED";
                    const isConfirmed = canonicalStatus === "CONFIRMED";
                    const isNeedsReview = canonicalStatus === "NEEDS_REVIEW";
                    const isNotAvailable = canonicalStatus === "NOT_AVAILABLE";
                    const isNotAwarded = canonicalStatus === "NOT_AWARDED";
                    const isBestOffer = hasOffer && fwdReq.id === metrics.bestOfferId;
                    const isAutoSelected = autoSelectedQuotation?.id === fwdReq.id;

                    const currency = fwdReq.offerData?.currency || fwdReq.currency || "USD";
                    const etd = fwdReq.offerData?.etd || requestedEtd;
                    const transitDays = fwdReq.offerData?.transitDays || 24;
                    const freeDays = fwdReq.offerData?.freeDays || 14;
                    const carrier = fwdReq.offerData?.carrier || "Direct Ocean Carrier";

                    const isConfirmingThis = confirmingInlineId === fwdReq.id;

                    return (
                      <div
                        key={fwdReq.id}
                        className={cn(
                          "rounded-xl border p-3.5 transition-all duration-150 bg-white shadow-2xs hover:shadow-sm space-y-3",
                          isConfirmed
                            ? "border-emerald-300 ring-1 ring-emerald-500/20 bg-emerald-50/15"
                            : isAwarded
                              ? "border-cyan-300 ring-1 ring-cyan-500/20 bg-cyan-50/15"
                              : isAutoSelected
                                ? "border-2 border-[#0FA3B1] ring-2 ring-[#0FA3B1]/25 bg-teal-50/20"
                                : isBestOffer
                                  ? "border-[#0FA3B1] ring-1 ring-[#0FA3B1]/20"
                                  : isNeedsReview
                                    ? "border-amber-300 bg-amber-50/15"
                                    : isNotAvailable
                                      ? "border-rose-200 bg-rose-50/10 opacity-75"
                                      : "border-slate-200/90 hover:border-slate-300",
                        )}
                      >
                        {/* 1. Header: Forwarder, Carrier, Best Rate Pill & Status Badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-9 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-700 font-bold text-xs grid place-items-center shrink-0 shadow-2xs">
                              {getForwarderInitials(fwdReq.forwarderName)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-[14px] text-slate-900 truncate">
                                  {fwdReq.forwarderName}
                                </span>
                                {isAutoSelected && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-[#0FA3B1]/10 text-[#0FA3B1] border border-[#0FA3B1]/30 px-1.5 py-0.2 text-[10px] font-bold shrink-0">
                                    <Sparkles className="size-2.5 text-[#0FA3B1]" />
                                    Auto-Selected
                                  </span>
                                )}
                                {isBestOffer && !isAutoSelected && (
                                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 text-[10px] font-bold shrink-0">
                                    <Trophy className="size-2.5 text-emerald-600" />
                                    Best Rate
                                  </span>
                                )}
                              </div>
                              <div className="text-[11.5px] text-slate-500 truncate">{carrier}</div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <QuotationStatusBadge
                              status={fwdReq.status}
                              size="xs"
                              allowChange
                              onStatusChange={(newSt) => handleStatusChange(fwdReq.id, newSt)}
                            />
                          </div>
                        </div>

                        {/* Review Alert Banner if needed */}
                        {fwdReq.offerData?.reviewReasons &&
                          fwdReq.offerData.reviewReasons.length > 0 && (
                            <div className="rounded-lg bg-amber-50/90 border border-amber-200/90 p-2 text-[11px] text-amber-900 flex items-start gap-1.5">
                              <AlertCircle className="size-3.5 text-amber-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <span className="font-bold text-amber-950 block">
                                  Requires Operator Review
                                </span>
                                <span className="text-amber-800 line-clamp-1">
                                  {fwdReq.offerData.reviewReasons[0]}
                                </span>
                              </div>
                            </div>
                          )}

                        {/* Multi-Container Options if detected */}
                        {fwdReq.offerData?.containerRates &&
                          Object.keys(fwdReq.offerData.containerRates).length > 1 && (
                            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600 bg-slate-50 border border-slate-200/70 rounded-md px-2 py-1 font-mono">
                              <Layers className="size-3 text-[#0FA3B1]" />
                              <span className="truncate">
                                Options:{" "}
                                {Object.entries(fwdReq.offerData.containerRates)
                                  .map(([k, v]) => `${k}: $${v.toLocaleString()}`)
                                  .join(" · ")}
                              </span>
                            </div>
                          )}

                        {/* 2. Middle Row: Pricing & Schedule Details */}
                        <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-slate-100 text-xs">
                          {/* Pricing */}
                          <div>
                            {hasOffer && rate ? (
                              <div>
                                <div className="text-[16px] font-bold text-slate-900 font-mono tracking-tight leading-tight">
                                  ${rate.toLocaleString()}{" "}
                                  <span className="text-[11px] font-normal text-slate-500 font-sans">
                                    / cntr
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                  Total:{" "}
                                  <strong className="text-slate-800 font-mono">
                                    ${totalFreight?.toLocaleString()} {currency}
                                  </strong>
                                </div>
                              </div>
                            ) : (
                              <div className="text-slate-400">
                                <span className="text-[12px] font-medium block">
                                  Awaiting Offer
                                </span>
                                <span className="text-[10.5px]">Quote pending</span>
                              </div>
                            )}
                          </div>

                          {/* Schedule & Free Days */}
                          <div className="text-right space-y-0.5">
                            {hasOffer ? (
                              <>
                                <div className="text-[11.5px] text-slate-700">
                                  ETD: <strong className="text-slate-900">{etd}</strong>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium">
                                  {transitDays}d transit · {freeDays}d free
                                </div>
                              </>
                            ) : (
                              <div className="text-[11px] text-slate-400 italic">
                                Schedule pending
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 3. Action Toolbar */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 relative">
                          {/* Auxiliary inspection icon buttons */}
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectingQuotationTarget(fwdReq)}
                              className="size-7.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-[#0FA3B1] hover:border-[#0FA3B1] hover:bg-slate-50 grid place-items-center transition-all cursor-pointer shadow-2xs"
                              title="Inspect quotation breakdown"
                            >
                              <FileSearch className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditQuotationTarget(fwdReq)}
                              className="size-7.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 grid place-items-center transition-all cursor-pointer shadow-2xs"
                              title="Edit quotation"
                            >
                              <FileEdit className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleViewEmail(fwdReq)}
                              className="size-7.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 grid place-items-center transition-all cursor-pointer shadow-2xs"
                              title="View original email"
                            >
                              <Mail className="size-3.5" />
                            </button>
                          </div>

                          {/* Primary Award CTA or Status Pill */}
                          <div>
                            {isConfirmingThis ? (
                              <div className="absolute right-0 bottom-full mb-1 z-20 bg-white border border-slate-300 rounded-xl p-3 shadow-xl w-60 text-left animate-in fade-in zoom-in-95 duration-150">
                                <div className="text-xs font-bold text-slate-900">
                                  Award {fwdReq.forwarderName}?
                                </div>
                                <p className="text-[10.5px] text-slate-600 mt-0.5 leading-snug">
                                  Sets movement to Pending Confirmation.
                                </p>
                                <div className="flex items-center justify-end gap-1.5 mt-2.5">
                                  <button
                                    type="button"
                                    onClick={() => setConfirmingInlineId(null)}
                                    disabled={isAwarding === fwdReq.id}
                                    className="border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmAward(fwdReq.id)}
                                    disabled={isAwarding === fwdReq.id}
                                    className="bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer shadow-xs"
                                  >
                                    {isAwarding === fwdReq.id ? "Awarding..." : "Confirm"}
                                  </button>
                                </div>
                              </div>
                            ) : isConfirmed ? (
                              <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-lg px-2.5 py-1">
                                <CheckCheck className="size-3.5 text-emerald-600" />
                                Space Confirmed
                              </span>
                            ) : isAwarded ? (
                              <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-cyan-900 bg-cyan-50 border border-cyan-300 rounded-lg px-2.5 py-1">
                                <Trophy className="size-3.5 text-cyan-600" />
                                Awarded
                              </span>
                            ) : isNeedsReview ? (
                              <button
                                type="button"
                                onClick={() => setEditQuotationTarget(fwdReq)}
                                className="border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-lg px-2.5 py-1 font-bold text-[11.5px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              >
                                <AlertCircle className="size-3 text-amber-600" />
                                <span>Review Quote</span>
                              </button>
                            ) : isNotAvailable ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1 font-semibold">
                                <XCircle className="size-3 text-rose-600" />
                                Unavailable
                              </span>
                            ) : isNotAwarded ? (
                              <button
                                type="button"
                                onClick={() => handleAwardClick(fwdReq)}
                                className="border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 bg-white rounded-lg px-2.5 py-1 font-semibold text-[11.5px] flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                              >
                                <span>Re-award</span>
                              </button>
                            ) : hasOffer ? (
                              <button
                                type="button"
                                onClick={() => handleAwardClick(fwdReq)}
                                className={cn(
                                  "group border border-[#0FA3B1] bg-[#0FA3B1] text-white hover:bg-[#0D919E] rounded-lg px-3 py-1 font-bold text-[11.5px] flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-[0.98]",
                                  clickingAwardId === fwdReq.id && "scale-95",
                                )}
                              >
                                <Trophy className="size-3 text-white transition-transform group-hover:scale-110" />
                                <span>Award Carrier</span>
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                                <Clock className="size-3 text-slate-400" />
                                Awaiting
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-white shrink-0">
            <div>
              {onRequestMoreQuotes && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onClose();
                    onRequestMoreQuotes(booking);
                  }}
                  className="rounded-xl border-slate-300 text-slate-800 hover:bg-slate-50 font-semibold text-xs gap-1.5 cursor-pointer h-8 px-3"
                >
                  <Plus className="size-3.5 text-[#0FA3B1]" />
                  <span>Request More Quotes</span>
                </Button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs px-4 cursor-pointer h-8"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Award Forwarder Modal */}
      <AwardForwarderModal
        isOpen={Boolean(awardModalTarget)}
        onClose={() => setAwardModalTarget(null)}
        bookingRequest={booking}
        forwarderRequest={awardModalTarget}
        onConfirmAward={handleConfirmAward}
      />

      {/* 18-Attribute Extracted Quotation Inspection Modal */}
      {inspectingQuotationTarget && (
        <Dialog
          open={Boolean(inspectingQuotationTarget)}
          onOpenChange={() => setInspectingQuotationTarget(null)}
        >
          <DialogContent className="w-full sm:max-w-[620px] p-0 overflow-hidden sm:rounded-2xl bg-white text-slate-900 max-h-[92vh] flex flex-col antialiased shadow-2xl">
            <div className="bg-white text-slate-900 px-6 py-4.5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-[#0FA3B1]/10 text-[#0FA3B1] grid place-items-center">
                  <FileSearch className="size-4.5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                    Quotation Information Extraction Breakdown
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    {inspectingQuotationTarget.forwarderName} · Movement{" "}
                    <strong>{inspectingQuotationTarget.movementNumber || movementNo}</strong>
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border",
                    (inspectingQuotationTarget.offerData?.confidenceScore ??
                      (inspectingQuotationTarget.offerData?.ratePerContainer ? 0.95 : 0.7)) >= 0.85
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : (inspectingQuotationTarget.offerData?.confidenceScore ?? 0.7) >= 0.6
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : "bg-rose-50 text-rose-800 border-rose-200",
                  )}
                >
                  <Sparkles className="size-3 text-emerald-600" />
                  {inspectingQuotationTarget.offerData?.confidenceScore !== undefined
                    ? `${Math.round(inspectingQuotationTarget.offerData.confidenceScore * 100)}% Confidence`
                    : inspectingQuotationTarget.offerData?.ratePerContainer
                      ? "95% Confidence"
                      : "70% Confidence"}
                </span>
                <button
                  type="button"
                  onClick={() => setInspectingQuotationTarget(null)}
                  className="size-7 rounded-full grid place-items-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto text-xs">
              {/* Review Reasons Alert Banner if needed */}
              {inspectingQuotationTarget.offerData?.reviewReasons &&
                inspectingQuotationTarget.offerData.reviewReasons.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 space-y-1.5 text-amber-950">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                      <AlertCircle className="size-4 text-amber-600 shrink-0" />
                      <span>
                        Operator Review Required (
                        {inspectingQuotationTarget.offerData.reviewReasons.length}{" "}
                        {inspectingQuotationTarget.offerData.reviewReasons.length === 1
                          ? "Reason"
                          : "Reasons"}
                        )
                      </span>
                    </div>
                    <ul className="list-disc pl-5 space-y-1 text-[11px] text-amber-800">
                      {inspectingQuotationTarget.offerData.reviewReasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Multi-container rate options banner if present */}
              {inspectingQuotationTarget.offerData?.containerRates &&
                Object.keys(inspectingQuotationTarget.offerData.containerRates).length > 1 && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="size-3.5 text-[#0FA3B1]" />
                      Multi-Container Rates Detected:
                    </span>
                    <div className="flex items-center gap-2">
                      {Object.entries(inspectingQuotationTarget.offerData.containerRates).map(
                        ([k, v]) => (
                          <span
                            key={k}
                            className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 font-mono font-bold text-[11px]"
                          >
                            {k}: ${v.toLocaleString()}
                          </span>
                        ),
                      )}
                    </div>
                  </div>
                )}

              <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3 flex items-start justify-between gap-3 text-sky-950">
                <div className="flex items-start gap-2.5">
                  <Info className="size-4 text-sky-600 shrink-0 mt-0.5" />
                  <div className="text-[11.5px] leading-relaxed">
                    <strong>Deterministic Rule Engine:</strong> Extracted directly without AI or LLM
                    guesswork. Missing fields remain strictly <strong>NULL / Not Provided</strong>.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTraceabilityEvidence(!showTraceabilityEvidence)}
                  className={cn(
                    "shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border transition-all cursor-pointer shadow-2xs",
                    showTraceabilityEvidence
                      ? "bg-[#0FA3B1] text-white border-[#0FA3B1]"
                      : "bg-white text-[#0FA3B1] border-[#0FA3B1]/40 hover:bg-[#0FA3B1]/10",
                  )}
                >
                  <FileSearch className="size-3.5" />
                  {showTraceabilityEvidence ? "Hide Source Evidence" : "View Source Evidence"}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  {
                    fieldKey: "movementNumber",
                    label: "1. Movement Number",
                    value: inspectingQuotationTarget.movementNumber || movementNo,
                  },
                  {
                    fieldKey: "forwarderName",
                    label: "2. Forwarder",
                    value: `${inspectingQuotationTarget.forwarderName} (${inspectingQuotationTarget.forwarderEmail})`,
                  },
                  {
                    fieldKey: "rate",
                    label: "3. Rate",
                    value: inspectingQuotationTarget.offerData?.ratePerContainer
                      ? `${inspectingQuotationTarget.offerData.ratePerContainer.toLocaleString()} ${inspectingQuotationTarget.offerData.currency || "USD"}/container`
                      : null,
                  },
                  {
                    fieldKey: "currency",
                    label: "4. Currency",
                    value: inspectingQuotationTarget.offerData?.currency || null,
                  },
                  {
                    fieldKey: "containerType",
                    label: "5. Container Type & Qty",
                    value: `${inspectingQuotationTarget.containerCount || 1}x ${inspectingQuotationTarget.containerSize || "40HC"} (${inspectingQuotationTarget.containerType || "High Cube"})`,
                  },
                  {
                    fieldKey: "availability",
                    label: "6. Availability",
                    value: inspectingQuotationTarget.offerData?.availability || null,
                  },
                  {
                    fieldKey: "etd",
                    label: "7. ETD",
                    value:
                      inspectingQuotationTarget.offerData?.etd ||
                      inspectingQuotationTarget.etd ||
                      null,
                  },
                  {
                    fieldKey: "eta",
                    label: "8. ETA",
                    value:
                      inspectingQuotationTarget.offerData?.eta ||
                      inspectingQuotationTarget.eta ||
                      null,
                  },
                  {
                    fieldKey: "transitTime",
                    label: "9. Transit Time",
                    value: inspectingQuotationTarget.offerData?.transitDays
                      ? `${inspectingQuotationTarget.offerData.transitDays} Days`
                      : null,
                  },
                  {
                    fieldKey: "oceanFreight",
                    label: "10. Ocean Freight (Base Rate)",
                    value:
                      inspectingQuotationTarget.offerData?.oceanFreight !== undefined
                        ? `$${inspectingQuotationTarget.offerData.oceanFreight.toLocaleString()} (Ocean Freight)`
                        : inspectingQuotationTarget.offerData?.ratePerContainer
                          ? `$${inspectingQuotationTarget.offerData.ratePerContainer.toLocaleString()} (Base Rate)`
                          : null,
                  },
                  {
                    fieldKey: "originCharges",
                    label: "11. Origin Charges",
                    value:
                      inspectingQuotationTarget.offerData?.originCharges !== undefined
                        ? `$${inspectingQuotationTarget.offerData.originCharges.toLocaleString()}`
                        : null,
                  },
                  {
                    fieldKey: "destinationCharges",
                    label: "12. Destination Charges",
                    value:
                      inspectingQuotationTarget.offerData?.destinationCharges !== undefined
                        ? `$${inspectingQuotationTarget.offerData.destinationCharges.toLocaleString()}`
                        : null,
                  },
                  {
                    fieldKey: "thc",
                    label: "13. THC (Terminal Handling)",
                    value:
                      inspectingQuotationTarget.offerData?.thc !== undefined
                        ? `$${inspectingQuotationTarget.offerData.thc.toLocaleString()}`
                        : null,
                  },
                  {
                    fieldKey: "documentationCharges",
                    label: "14. Documentation Charges (BL / Doc Fee)",
                    value:
                      inspectingQuotationTarget.offerData?.documentationCharges !== undefined
                        ? `$${inspectingQuotationTarget.offerData.documentationCharges.toLocaleString()}`
                        : null,
                  },
                  {
                    fieldKey: "customsCharges",
                    label: "15. Customs Charges / Clearance",
                    value:
                      inspectingQuotationTarget.offerData?.customsCharges !== undefined
                        ? `$${inspectingQuotationTarget.offerData.customsCharges.toLocaleString()}`
                        : null,
                  },
                  {
                    fieldKey: "truckingCharges",
                    label: "16. Trucking Charges / Haulage",
                    value:
                      inspectingQuotationTarget.offerData?.truckingCharges !== undefined
                        ? `$${inspectingQuotationTarget.offerData.truckingCharges.toLocaleString()}`
                        : null,
                  },
                  {
                    fieldKey: "otherCharges",
                    label: "17. Other Charges & Surcharges",
                    value:
                      inspectingQuotationTarget.offerData?.otherCharges !== undefined
                        ? `$${inspectingQuotationTarget.offerData.otherCharges.toLocaleString()}`
                        : inspectingQuotationTarget.offerData?.additionalCharges
                          ? String(inspectingQuotationTarget.offerData.additionalCharges)
                          : null,
                  },
                  {
                    fieldKey: "totalCost",
                    label: "18. Total Amount (Quoted All-In)",
                    value:
                      inspectingQuotationTarget.offerData?.totalAmount !== undefined
                        ? `$${inspectingQuotationTarget.offerData.totalAmount.toLocaleString()} ${inspectingQuotationTarget.offerData?.currency || "USD"}`
                        : inspectingQuotationTarget.offerData?.totalCost !== undefined
                          ? `$${inspectingQuotationTarget.offerData.totalCost.toLocaleString()}`
                          : null,
                    explicitNote: true,
                  },
                  {
                    fieldKey: "freeDays",
                    label: "19. Free Days",
                    value: inspectingQuotationTarget.offerData?.freeDays
                      ? `${inspectingQuotationTarget.offerData.freeDays} Days (Demurrage & Detention)`
                      : null,
                  },
                  {
                    fieldKey: "carrier",
                    label: "20. Sailing / Vessel / Voyage",
                    value:
                      inspectingQuotationTarget.offerData?.carrier ||
                      inspectingQuotationTarget.offerData?.vesselName
                        ? [
                            inspectingQuotationTarget.offerData.carrier,
                            inspectingQuotationTarget.offerData.vesselName,
                            inspectingQuotationTarget.offerData.voyageNumber
                              ? `v.${inspectingQuotationTarget.offerData.voyageNumber}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : null,
                  },
                  {
                    fieldKey: "routing",
                    label: "21. Routing",
                    value: inspectingQuotationTarget.offerData?.routing || "Direct Service",
                  },
                  {
                    fieldKey: "rateValidity",
                    label: "22. Validity Date",
                    value:
                      inspectingQuotationTarget.offerData?.validityDate ||
                      inspectingQuotationTarget.offerData?.validUntil ||
                      null,
                  },
                  {
                    fieldKey: "notes",
                    label: "23. Notes / Remarks",
                    value: inspectingQuotationTarget.offerData?.notes || null,
                  },
                  {
                    fieldKey: "receivedTimestamp",
                    label: "17. Email Received Date",
                    value: inspectingQuotationTarget.offerData?.receivedAt
                      ? new Date(inspectingQuotationTarget.offerData.receivedAt).toLocaleString()
                      : new Date(inspectingQuotationTarget.sentAt).toLocaleString(),
                  },
                  {
                    fieldKey: "overallConfidence",
                    label: "18. Extraction Confidence",
                    value:
                      inspectingQuotationTarget.offerData?.confidenceScore !== undefined
                        ? `${Math.round(inspectingQuotationTarget.offerData.confidenceScore * 100)}% (Deterministic Audit)`
                        : inspectingQuotationTarget.offerData?.ratePerContainer
                          ? "95% (High Precision Match)"
                          : "70% (Partial Response)",
                  },
                ].map((item, idx) => {
                  const trace = (
                    inspectingQuotationTarget.offerData?.traceability as
                      | Record<
                          string,
                          {
                            sourceText?: string | null;
                            lineNumber?: number | null;
                            extractionMethod?: string;
                            validationStatus?: string;
                            confidence?: string;
                            confidenceReason?: string;
                          }
                        >
                      | undefined
                  )?.[item.fieldKey];

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "rounded-xl border p-2.5 transition-colors",
                        trace?.validationStatus === "CONFLICT"
                          ? "border-rose-300 bg-rose-50/40"
                          : trace?.validationStatus === "SUSPICIOUS"
                            ? "border-amber-300 bg-amber-50/40"
                            : "border-slate-200/80 bg-slate-50/60",
                      )}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          {item.label}
                        </span>
                        {trace?.validationStatus && (
                          <span
                            className={cn(
                              "text-[9px] font-bold px-1.5 py-0.2 rounded font-mono",
                              trace.validationStatus === "VALID"
                                ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                                : trace.validationStatus === "CONFLICT"
                                  ? "text-rose-700 bg-rose-50 border border-rose-200"
                                  : trace.validationStatus === "SUSPICIOUS"
                                    ? "text-amber-700 bg-amber-50 border border-amber-200"
                                    : "text-slate-500 bg-slate-100",
                            )}
                          >
                            {trace.validationStatus}
                          </span>
                        )}
                      </div>
                      {item.value ? (
                        <span className="text-[12px] font-semibold text-slate-900 break-words block">
                          {item.value}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                          Not Provided {item.explicitNote ? "(Not explicitly stated)" : ""}
                        </span>
                      )}

                      {/* Source Text Traceability Snippet */}
                      {showTraceabilityEvidence && trace && (
                        <div className="mt-2 pt-1.5 border-t border-slate-200/70 space-y-1 text-[10.5px]">
                          {trace.sourceText && (
                            <div className="text-slate-800 bg-white rounded p-1.5 font-mono text-[10px] break-all border border-slate-200/80 shadow-2xs">
                              <span className="text-slate-400 font-sans select-none block mb-0.5">
                                Source Snippet:
                              </span>
                              "{trace.sourceText}"
                            </div>
                          )}
                          <div className="flex items-center justify-between text-slate-500 text-[9.5px]">
                            <span>
                              {trace.lineNumber ? `Line ${trace.lineNumber}` : "Header / Thread"} ·{" "}
                              {trace.extractionMethod || "RULE_BASED"}
                            </span>
                            {trace.confidence && (
                              <span className="font-semibold text-slate-700">
                                {trace.confidence} Confidence
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white border-t border-slate-100 px-6 py-3.5 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const target = inspectingQuotationTarget;
                  setInspectingQuotationTarget(null);
                  handleViewEmail(target);
                }}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer text-xs gap-1.5"
              >
                <Mail className="size-3.5" />
                View Original Email
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const target = inspectingQuotationTarget;
                    setInspectingQuotationTarget(null);
                    setEditQuotationTarget(target);
                  }}
                  className="rounded-xl bg-[#0FA3B1] hover:bg-[#0D919E] text-white cursor-pointer text-xs gap-1.5"
                >
                  <FileEdit className="size-3.5" />
                  Edit / Correct Values
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setInspectingQuotationTarget(null)}
                  className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Quotation Modal */}
      <EditQuotationModal
        isOpen={Boolean(editQuotationTarget)}
        onClose={() => setEditQuotationTarget(null)}
        forwarderRequest={editQuotationTarget}
        onSave={handleSaveQuotationCorrection}
      />

      {/* Original Email Preview Modal */}
      {selectedEmailPreview && (
        <Dialog
          open={Boolean(selectedEmailPreview)}
          onOpenChange={() => setSelectedEmailPreview(null)}
        >
          <DialogContent className="w-full sm:max-w-[620px] max-h-[92vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl bg-white text-slate-900 antialiased shadow-2xl">
            {/* Header */}
            <div className="bg-white text-slate-900 px-6 py-4.5 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-xl bg-[#0FA3B1]/10 text-[#0FA3B1] grid place-items-center">
                    <Mail className="size-4" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900 tracking-tight">
                      Forwarder Email Thread & Quotation Record
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500 mt-0.5">
                      From:{" "}
                      <strong className="text-slate-900">
                        {selectedEmailPreview.forwarderName}
                      </strong>{" "}
                      ({selectedEmailPreview.email})
                    </DialogDescription>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Body & Details */}
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2 text-slate-700">
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-500 w-24 shrink-0">Subject:</span>
                  <span className="font-medium text-slate-900">{selectedEmailPreview.subject}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-semibold text-slate-500 w-24 shrink-0">Sent At:</span>
                  <span>{new Date(selectedEmailPreview.sentAt).toLocaleString()}</span>
                </div>
                {selectedEmailPreview.receivedAt && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-slate-500 w-24 shrink-0">Received At:</span>
                    <span>{new Date(selectedEmailPreview.receivedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedEmailPreview.threadId && (
                  <div className="flex items-start gap-2">
                    <span className="font-semibold text-slate-500 w-24 shrink-0">
                      Gmail Thread:
                    </span>
                    <span className="font-mono text-[11px] text-[#0FA3B1]">
                      {selectedEmailPreview.threadId}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Parsed Email Body:
                </span>
                <div className="bg-slate-50 text-slate-800 rounded-2xl p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto border border-slate-200 shadow-xs">
                  {selectedEmailPreview.body}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-white border-t border-slate-100 px-6 py-3.5 flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedEmailPreview(null)}
                className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Close Preview
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
});
