import { useState, useEffect, useCallback, memo } from "react";
import {
  X,
  Ship,
  MapPin,
  Calendar,
  DollarSign,
  Package,
  Weight,
  Clock,
  CheckCircle2,
  FileEdit,
  Mail,
  User,
  Phone,
  Building2,
  Share2,
  ShieldCheck,
  FileText,
  AlertTriangle,
  Users,
  Plus,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { showPillToast } from "@/lib/pill-toast";
import { Button } from "@/components/ui/button";
import { getPortCountryMeta } from "@/lib/port-flags";
import { CountryFlagSvg } from "@/components/nashmia/common/CountryFlagSvg";
import { useAuth } from "@/lib/auth-context";
import {
  fetchForwarderRequestsForBooking,
  awardForwarderOffer,
  updateForwarderQuotation,
  updateForwarderQuoteStatus,
} from "@/lib/multi-forwarder-service";
import { logQuotationResponseDiagnostics } from "@/lib/quotation-diagnostics";
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

interface RequestDetailDrawerProps {
  request: BookingRequestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove: (request: BookingRequestRecord) => void;
  onRequestRevision: (request: BookingRequestRecord) => void;
  onComposeEmail?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onViewQuotations?: (request: BookingRequestRecord) => void;
  onOpenAwardDrawer?: (request: BookingRequestRecord) => void;
  onConfirmBooking?: (request: BookingRequestRecord) => void;
}

export const RequestDetailDrawer = memo(function RequestDetailDrawer({
  request,
  isOpen,
  onClose,
  onApprove,
  onRequestRevision,
  onComposeEmail,
  onRequestQuotes,
  onViewQuotations,
  onOpenAwardDrawer,
  onConfirmBooking,
}: RequestDetailDrawerProps) {
  const { userId } = useAuth();
  const [forwarderRequests, setForwarderRequests] = useState<ForwarderQuoteRequestRecord[]>([]);
  const [isAwarding, setIsAwarding] = useState<string | null>(null);
  const [awardModalTarget, setAwardModalTarget] = useState<ForwarderQuoteRequestRecord | null>(
    null,
  );
  const [editQuotationTarget, setEditQuotationTarget] =
    useState<ForwarderQuoteRequestRecord | null>(null);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);

  const loadForwarderRequests = useCallback(async () => {
    if (!request) return;
    try {
      const list = await fetchForwarderRequestsForBooking(request);
      logQuotationResponseDiagnostics(list, "RequestCardQuotationFetcher - RequestDetailDrawer");
      setForwarderRequests(list);
    } catch (err) {
      console.warn("[RequestDetailDrawer] Error loading forwarder requests:", err);
    }
  }, [request]);

  useEffect(() => {
    if (isOpen && request) {
      void loadForwarderRequests();
    }
  }, [isOpen, request, loadForwarderRequests]);

  // Listen for realtime multi-forwarder updates
  useEffect(() => {
    const handleUpdate = () => {
      void loadForwarderRequests();
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
  }, [loadForwarderRequests]);

  const handleAwardForwarder = async (requestId: string) => {
    setIsAwarding(requestId);
    try {
      const res = await awardForwarderOffer(requestId, userId);
      showPillToast.success(
        `Designated ${res.request.forwarderName} as official forwarder. Status: Pending Confirmation.`,
        "Forwarder Quotation Awarded!",
        request?.reference || request?.movementNumber,
      );
      void loadForwarderRequests();
    } catch (err: unknown) {
      console.error("[RequestDetailDrawer] Error awarding forwarder:", err);
      showPillToast.error(
        err instanceof Error ? err.message : "Please try again.",
        "Failed to award forwarder",
      );
    } finally {
      setIsAwarding(null);
    }
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
        request?.reference || request?.movementNumber,
      );
      void loadForwarderRequests();
    } catch (err: unknown) {
      console.error("[RequestDetailDrawer] Error saving quotation correction:", err);
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
      void loadForwarderRequests();
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Unable to update status.",
        "Status Update Failed",
      );
    }
  };

  if (!isOpen || !request) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200"
      />

      {/* Drawer Container */}
      <aside
        className="fixed inset-x-0 bottom-0 top-auto sm:inset-y-0 sm:right-0 sm:top-0 sm:bottom-0 sm:left-auto z-50 flex w-full sm:max-w-2xl max-h-[92vh] sm:max-h-none flex-col rounded-t-[28px] sm:rounded-none border-t sm:border-t-0 sm:border-l border-slate-200 bg-white shadow-2xl overflow-hidden transition-all duration-240 ease-[cubic-bezier(0.16,1,0.3,1)] animate-in slide-in-from-bottom sm:slide-in-from-right outline-none"
        role="dialog"
        aria-label="Request details"
      >
        {/* Mobile Tactile Drag Handle */}
        <div
          data-swipe-handle="true"
          className="mx-auto pt-2 pb-1 flex h-6 w-full max-w-[140px] cursor-grab touch-none items-center justify-center sm:hidden select-none shrink-0 bg-white"
          aria-label="Drag down to dismiss"
        >
          <div className="h-1.5 w-12 rounded-full bg-slate-300" />
        </div>

        {/* Top Sticky Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-[#0FA3B1]/20 bg-[#E8F5F6] text-[#0FA3B1]">
              <Ship className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-[18px] font-bold text-slate-900">
                  {request.reference}
                </h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                    request.priority === "Urgent"
                      ? "bg-rose-100 text-rose-800"
                      : request.priority === "High"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {request.priority}
                </span>
              </div>
              <p className="text-[12.5px] text-slate-500">
                Created on {new Date(request.createdAt).toLocaleDateString()} · Status:{" "}
                <strong className="text-slate-800">{request.status}</strong>
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="size-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close drawer"
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-[13.5px]">
          {/* Status & Priority Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
            <div>
              <span className="text-[11.5px] font-semibold text-slate-500 uppercase tracking-wider">
                Current Operational State
              </span>
              <p className="mt-0.5 text-[15px] font-bold text-slate-900">{request.status}</p>
            </div>

            <div className="flex items-center gap-2">
              {request.status !== "Approved" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApprove(request)}
                  className="bg-[#0FA3B1] font-semibold text-white hover:bg-[#0D919E]"
                >
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Approve Request
                </Button>
              )}
              {request.status !== "Revision Requested" && request.status !== "Approved" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestRevision(request)}
                  className="border-amber-300 text-amber-900 hover:bg-amber-50"
                >
                  <FileEdit className="mr-1.5 size-3.5" />
                  Request Revision
                </Button>
              )}
            </div>
          </div>

          {/* Step 6 — Booking Detail Automated Confirmation Banner */}
          {(request.status === "Approved" ||
            request.confirmationStatus === "CONFIRMED" ||
            Boolean(request.confirmedBy)) && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4.5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                  <CheckCircle2 className="size-3.5" />✓ Confirmed
                </span>
                <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-md">
                  Audit Log: AUTO_CONFIRMED_FROM_EMAIL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-xs">
                <div className="bg-white p-3 rounded-xl border border-emerald-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Movement:
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-[13px] block truncate">
                    {request.movementNumber || request.bookingReference || request.reference}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Confirmed By:
                  </span>
                  <span className="font-bold text-emerald-700 flex items-center gap-1 text-[13px]">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    {request.confirmedBy || "System"}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200/60 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Confirmed At:
                  </span>
                  <span className="font-semibold text-slate-900 text-[12px] block">
                    {request.confirmedAt
                      ? new Date(request.confirmedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : new Date(request.updatedAt).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200/60 space-y-1 flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Confirmation Email:
                  </span>
                  <Link
                    to="/emails"
                    search={{
                      movement: request.movementNumber || request.reference,
                      emailId: request.confirmationEmailId || undefined,
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-xs font-bold transition-all shadow-xs text-center justify-center w-full"
                  >
                    <Mail className="size-3.5" />
                    <span>View Email</span>
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Revision notice if any */}
          {request.revisionNotes && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-amber-900">
              <div className="flex items-center gap-2 font-bold text-[13px]">
                <AlertTriangle className="size-4 text-amber-600" />
                <span>Revision Requested by Operations:</span>
              </div>
              <p className="mt-1 text-[12.5px] text-amber-800">{request.revisionNotes}</p>
            </div>
          )}

          {/* Parties Section */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
              <Building2 className="size-4 text-[#0FA3B1]" />
              Shipping Parties
            </h3>

            <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Shipper */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Shipper / Supplier
                </span>
                <p className="mt-1 font-bold text-slate-900">{request.supplierName}</p>
                <p className="text-[12px] text-slate-600">{request.supplierLoadPoint}</p>
                <p className="text-[11.5px] text-slate-500">{request.supplierCity}, Pakistan</p>
                <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-slate-600">
                  <User className="size-3 text-slate-400" />
                  <span>{request.requestedBy.name}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-slate-600">
                  <Mail className="size-3 text-slate-400" />
                  <span>{request.requestedBy.email}</span>
                </div>
              </div>

              {/* Consignee */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Consignee / Buyer
                </span>
                <p className="mt-1 font-bold text-slate-900">{request.buyerName}</p>
                <p className="text-[12px] text-slate-600">{request.consignee}</p>
                <p className="text-[11.5px] text-slate-500">{request.buyerCountry}</p>
                <div className="mt-2 text-[11.5px] text-slate-600">
                  <span>
                    Buyer Code: <strong>{request.buyerCode}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Route & Vessel Schedule */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
              <Ship className="size-4 text-[#0FA3B1]" />
              Routing & Carrier Assignment
            </h3>

            <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between">
                  <span>POL (Loading)</span>
                  <CountryFlagSvg
                    countryCode={getPortCountryMeta(request.polCode, request.polName).countryCode}
                    size="sm"
                    title={getPortCountryMeta(request.polCode, request.polName).countryName}
                  />
                </span>
                <p className="mt-0.5 text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{request.polCode}</span>
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-1" title={request.polName}>
                  {request.polName}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center justify-between">
                  <span>POD (Discharge)</span>
                  <CountryFlagSvg
                    countryCode={getPortCountryMeta(request.podCode, request.podName).countryCode}
                    size="sm"
                    title={getPortCountryMeta(request.podCode, request.podName).countryName}
                  />
                </span>
                <p className="mt-0.5 text-[15px] font-bold text-slate-900 flex items-center gap-1.5">
                  <span>{request.podCode}</span>
                </p>
                <p className="text-[11px] text-slate-500 line-clamp-1" title={request.podName}>
                  {request.podName}
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase">Target ETD</span>
                <p className="mt-0.5 text-[14px] font-bold text-slate-900">
                  {request.requestedEtd}
                </p>
                <p className="text-[11px] text-slate-500">Departure</p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase">
                  Estimated ETA
                </span>
                <p className="mt-0.5 text-[14px] font-bold text-slate-900">
                  {request.estimatedEta || "TBD"}
                </p>
                <p className="text-[11px] text-slate-500">Arrival</p>
              </div>
            </div>

            {/* Carrier & Vessel specs */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#E8F5F6]/50 p-3 text-[12.5px] text-[#0A6C77]">
              <div>
                <span>
                  Assigned Carrier: <strong>{request.preferredCarrier}</strong>
                </span>
                {request.vesselName && (
                  <span className="ml-2">
                    · Vessel:{" "}
                    <strong>
                      {request.vesselName} / {request.voyageNumber || "V.01"}
                    </strong>
                  </span>
                )}
              </div>
              <div className="font-semibold text-slate-800">Forwarder: {request.forwarderName}</div>
            </div>
          </div>

          {/* Multi-Forwarder Quote Desk Section */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
                  <Users className="size-4 text-[#0FA3B1]" />
                  Multi-Forwarder Quote Desk
                  <span className="rounded-full bg-[#E8F5F6] px-2 py-0.5 text-[11px] font-bold text-[#0FA3B1]">
                    {forwarderRequests.length} Contacted
                  </span>
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Independent RFQ emails dispatched via Gmail. Separate threads & rate tracking per
                  forwarder.
                </p>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {onOpenAwardDrawer && request && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenAwardDrawer(request)}
                    className="h-8 gap-1.5 border-cyan-300 bg-cyan-50/60 text-cyan-900 hover:bg-cyan-100 text-xs font-semibold cursor-pointer"
                  >
                    <Trophy className="size-3.5 text-cyan-700" />
                    <span>Award Status & Rates</span>
                  </Button>
                )}
                {onViewQuotations && forwarderRequests.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onViewQuotations(request)}
                    className="h-8 gap-1.5 border-[#0FA3B1]/40 text-[#0FA3B1] hover:bg-[#E8F5F6] text-xs font-semibold cursor-pointer"
                  >
                    <Users className="size-3.5" />
                    <span>Compare Quotations</span>
                  </Button>
                )}
                {onRequestQuotes && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onRequestQuotes(request)}
                    className="h-8 gap-1.5 bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    <span>Request Quotes</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Forwarder Requests List */}
            {forwarderRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center">
                <p className="text-xs text-slate-600 font-medium">
                  No forwarders contacted yet for this booking request.
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click "Request Quotes" to send individualized inquiry emails to multiple
                  forwarders.
                </p>
                {onRequestQuotes && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRequestQuotes(request)}
                    className="mt-2.5 h-8 border-[#0FA3B1]/30 text-[#0FA3B1] hover:bg-[#E8F5F6] text-xs font-semibold"
                  >
                    <Send className="size-3 mr-1.5" /> Select Forwarders & Send RFQs
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {forwarderRequests.map((fwdReq) => {
                  const hasOffer =
                    fwdReq.status === "OFFER_RECEIVED" || fwdReq.status === "ACCEPTED";
                  const isAccepted = fwdReq.status === "ACCEPTED";

                  return (
                    <div
                      key={fwdReq.id}
                      className={`rounded-xl border p-3.5 transition-all ${
                        isAccepted
                          ? "border-emerald-300 bg-emerald-50/50"
                          : hasOffer
                            ? "border-indigo-200 bg-indigo-50/30"
                            : "border-slate-200 bg-slate-50/60"
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[13.5px] text-slate-900">
                              {fwdReq.forwarderName}
                            </span>
                            {fwdReq.forwarderBadge && (
                              <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-700">
                                {fwdReq.forwarderBadge}
                              </span>
                            )}
                            <QuotationStatusBadge
                              status={fwdReq.status}
                              size="xs"
                              allowChange
                              onStatusChange={(st) => handleStatusChange(fwdReq.id, st)}
                            />
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11.5px] text-slate-500">
                            <span>To: {fwdReq.forwarderEmail}</span>
                            {fwdReq.gmailThreadId && (
                              <Link
                                to="/emails"
                                search={{ threadId: fwdReq.gmailThreadId }}
                                className="inline-flex items-center gap-1 text-[#0FA3B1] hover:underline font-mono"
                              >
                                <Mail className="size-3" />
                                Thread: {fwdReq.gmailThreadId.slice(0, 12)}...
                              </Link>
                            )}
                            {fwdReq.trackingCompositeKey && (
                              <span
                                className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                title={`Unique composite key: ${fwdReq.trackingCompositeKey}`}
                              >
                                <ShieldCheck className="size-3 text-emerald-600" />
                                Isolated Tracking
                              </span>
                            )}
                            <span>
                              Sent:{" "}
                              {new Date(fwdReq.sentAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {hasOffer && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setEditQuotationTarget(fwdReq)}
                              className="h-7 px-2 text-xs border-slate-200 text-slate-700 hover:bg-slate-100 gap-1"
                              title="Review and correct extracted quotation details"
                            >
                              <FileEdit className="size-3 text-slate-500" />
                              <span>Edit Quote</span>
                            </Button>
                          )}
                          {!isAccepted && hasOffer && fwdReq.status !== "NOT_AWARDED" && (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setAwardModalTarget(fwdReq)}
                              disabled={isAwarding === fwdReq.id}
                              className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1 shadow-xs"
                            >
                              <CheckCircle2 className="size-3" />
                              <span>Award Forwarder</span>
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Offer details banner if submitted */}
                      {hasOffer && fwdReq.offerData && (
                        <div className="mt-2.5 rounded-lg bg-white border border-indigo-100 p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Rate / Container
                            </span>
                            <span className="font-bold text-slate-900 text-[13px]">
                              ${fwdReq.offerData.ratePerContainer?.toLocaleString()}{" "}
                              {fwdReq.offerData.currency || "USD"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Total Freight
                            </span>
                            <span className="font-bold text-[#0FA3B1] text-[13px]">
                              ${fwdReq.offerData.totalFreight?.toLocaleString()}{" "}
                              {fwdReq.offerData.currency || "USD"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Carrier / Line
                            </span>
                            <span className="font-semibold text-slate-800">
                              {fwdReq.offerData.carrier || "MSC"}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase block">
                              Transit / Free Days
                            </span>
                            <span className="font-semibold text-slate-800">
                              {fwdReq.offerData.transitDays || 24}d ·{" "}
                              {fwdReq.offerData.freeDays || 14}d free
                            </span>
                          </div>
                          {(fwdReq.offerData.etd || fwdReq.offerData.eta) && (
                            <div className="col-span-2 sm:col-span-4 flex items-center gap-3 text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-700">
                              {fwdReq.offerData.etd && (
                                <span>
                                  <strong>ETD:</strong> {fwdReq.offerData.etd}
                                </span>
                              )}
                              {fwdReq.offerData.eta && (
                                <span>
                                  <strong>ETA:</strong> {fwdReq.offerData.eta}
                                </span>
                              )}
                              {fwdReq.offerData.availability && (
                                <span className="ml-auto font-medium text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  {fwdReq.offerData.availability}
                                </span>
                              )}
                            </div>
                          )}
                          {fwdReq.offerData.extractionSummary && (
                            <div className="col-span-2 sm:col-span-4 bg-indigo-50/60 border border-indigo-100/80 rounded px-2 py-1 text-[10.5px]">
                              <span className="text-[9.5px] font-bold uppercase tracking-wider text-indigo-800 block mb-0.5">
                                Extracted Offer:
                              </span>
                              <code className="font-mono text-indigo-950 text-[10px] font-semibold">
                                {fwdReq.offerData.extractionSummary}
                              </code>
                            </div>
                          )}
                          {fwdReq.offerData.notes && (
                            <div className="col-span-2 sm:col-span-4 text-[11px] text-slate-600 border-t border-slate-100 pt-1.5 mt-0.5 flex flex-wrap items-center justify-between gap-1">
                              <span>
                                <strong>Terms & Notes:</strong> {fwdReq.offerData.notes}
                              </span>
                              {fwdReq.offerData.manuallyCorrected && (
                                <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-semibold">
                                  Manually Adjusted
                                </span>
                              )}
                            </div>
                          )}
                          {fwdReq.offerData.receivedVia && (
                            <div className="col-span-2 sm:col-span-4 flex justify-end">
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                {fwdReq.offerData.receivedVia.includes("AI") && (
                                  <Sparkles className="size-2.5" />
                                )}
                                {fwdReq.offerData.receivedVia}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cargo & Equipment Specs */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
              <Package className="size-4 text-[#0FA3B1]" />
              Cargo & Equipment Manifest
            </h3>

            <div className="mt-3.5 space-y-3">
              <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                <span className="text-slate-500">Cargo Description:</span>
                <span className="font-semibold text-slate-900 text-right max-w-sm">
                  {request.cargo.description}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-1">
                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Equipment</span>
                  <p className="text-[13.5px] font-bold text-slate-900">
                    {request.containerCount}x {request.containerSize}
                  </p>
                  <p className="text-[11px] text-slate-500">{request.containerType}</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">
                    Total Weight
                  </span>
                  <p className="text-[13.5px] font-bold text-slate-900">
                    {(request.cargo.totalWeightKg / 1000).toFixed(1)} MT
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {request.cargo.totalWeightKg.toLocaleString()} kg
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Volume</span>
                  <p className="text-[13.5px] font-bold text-slate-900">
                    {request.cargo.totalVolumeCbm || 68} CBM
                  </p>
                  <p className="text-[11px] text-slate-500">Net volume</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-2.5">
                  <span className="text-[11px] text-slate-400 font-bold uppercase">Packaging</span>
                  <p className="text-[13.5px] font-bold text-slate-900">
                    {request.cargo.packagesCount || 400} pkgs
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {request.cargo.packageType || "Cartons"}
                  </p>
                </div>
              </div>

              {request.cargo.temperatureRequired && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-2.5 text-[12.5px] text-cyan-900">
                  <strong>Reefer Settings:</strong> {request.cargo.temperatureRequired}
                </div>
              )}

              {request.specialInstructions && (
                <div className="rounded-xl bg-slate-50 p-3 text-[12.5px] text-slate-700">
                  <span className="font-bold text-slate-900">Special Instructions:</span>{" "}
                  {request.specialInstructions}
                </div>
              )}
            </div>
          </div>

          {/* Commercials & Freight Rate */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
              <DollarSign className="size-4 text-[#0FA3B1]" />
              Commercials & Freight Invoice Breakdown
            </h3>

            <div className="mt-3.5 space-y-2 text-[13px]">
              <div className="flex justify-between text-slate-600">
                <span>
                  Ocean Freight ({request.containerCount}x @ ${request.ratePerContainer})
                </span>
                <span className="font-mono font-semibold text-slate-900">
                  ${(request.containerCount * request.ratePerContainer).toLocaleString()}{" "}
                  {request.currency}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Terminal Handling Charges (THC)</span>
                <span className="font-mono text-slate-700">Included in freight</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>VGM & Documentation Fee</span>
                <span className="font-mono text-slate-700">Included in contract</span>
              </div>

              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-[15px] font-bold text-slate-900">
                <span>Total Freight Amount:</span>
                <span className="font-mono text-[#0FA3B1]">
                  ${request.totalFreight.toLocaleString()} {request.currency}
                </span>
              </div>
            </div>
          </div>

          {/* Operational Cut-Offs */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
            <h3 className="flex items-center gap-2 text-[14px] font-bold text-slate-900">
              <Clock className="size-4 text-[#0FA3B1]" />
              Critical Cut-Off Schedule
            </h3>

            <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-[12px]">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <span className="font-bold text-slate-500">Shipping Instruction (SI):</span>
                <p className="mt-1 font-semibold text-slate-800">{request.siCutoff || "TBD"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <span className="font-bold text-slate-500">VGM Cut-Off:</span>
                <p className="mt-1 font-semibold text-slate-800">{request.vgmCutoff || "TBD"}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <span className="font-bold text-amber-700">Port Gate Cut-Off:</span>
                <p className="mt-1 font-bold text-amber-900">{request.gateCutoff || "TBD"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2">
            {onComposeEmail && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onComposeEmail(request)}
                className="border-slate-200 text-slate-700 hover:bg-white"
              >
                <Mail className="mr-1.5 size-3.5" />
                Email Parties
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="border-slate-200 text-slate-700 hover:bg-white"
            >
              Close
            </Button>

            {onConfirmBooking && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  onClose();
                  onConfirmBooking(request);
                }}
                className="bg-emerald-600 font-bold text-white hover:bg-emerald-700 shadow-2xs"
              >
                <CheckCircle2 className="mr-1.5 size-4" />
                {request.status === "Approved" ||
                request.status === "Confirmed" ||
                request.status === "Booking Confirmed" ||
                request.confirmationStatus === "CONFIRMED"
                  ? "Update Confirmation"
                  : "Confirm Booking"}
              </Button>
            )}

            {request.status !== "Approved" &&
              request.status !== "Confirmed" &&
              request.status !== "Booking Confirmed" &&
              request.confirmationStatus !== "CONFIRMED" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApprove(request)}
                  className="bg-[#0FA3B1] font-semibold text-white hover:bg-[#0D919E]"
                >
                  <CheckCircle2 className="mr-1.5 size-4" />
                  Approve & Release Booking
                </Button>
              )}
          </div>
        </div>
        {/* Award Forwarder Modal */}
        <AwardForwarderModal
          isOpen={Boolean(awardModalTarget)}
          onClose={() => setAwardModalTarget(null)}
          bookingRequest={request}
          forwarderRequest={awardModalTarget}
          onConfirmAward={handleAwardForwarder}
        />

        {/* Edit Quotation Modal */}
        <EditQuotationModal
          isOpen={Boolean(editQuotationTarget)}
          onClose={() => setEditQuotationTarget(null)}
          forwarderRequest={editQuotationTarget}
          onSave={handleSaveQuotationCorrection}
        />
      </aside>
    </>
  );
});
