import { memo, useMemo } from "react";
import {
  Ship,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Mail,
  Calendar,
  DollarSign,
  Package,
  Weight,
  MapPin,
  ExternalLink,
  ChevronRight,
  Users,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortFlagDisplay } from "@/components/nashmia/common/PortFlagDisplay";
import {
  getLocalForwarderRequests,
  getBookingForwarderSummary,
} from "@/lib/multi-forwarder-service";
import type { BookingRequestRecord, RequestStatus, RequestPriority } from "@/types/requests";

interface RequestsCardGridProps {
  requests: BookingRequestRecord[];
  forwarderRequests?: ForwarderQuoteRequestRecord[];
  onSelectRequest: (request: BookingRequestRecord) => void;
  onApproveRequest: (request: BookingRequestRecord) => void;
  onRequestRevision: (request: BookingRequestRecord) => void;
  onComposeEmail?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onViewQuotations?: (request: BookingRequestRecord) => void;
}

function getPriorityBadge(priority: RequestPriority) {
  switch (priority) {
    case "Urgent":
      return {
        label: "URGENT",
        classes: "border-rose-300 bg-rose-500 text-white font-bold animate-pulse",
      };
    case "High":
      return {
        label: "High Priority",
        classes: "border-amber-200 bg-amber-100 text-amber-900 font-semibold",
      };
    case "Normal":
      return {
        label: "Normal",
        classes: "border-slate-200 bg-slate-100 text-slate-700 font-medium",
      };
    case "Flexible":
      return {
        label: "Flexible Schedule",
        classes: "border-teal-200 bg-teal-50 text-teal-800 font-medium",
      };
  }
}

export const RequestsCardGrid = memo(function RequestsCardGrid({
  requests,
  forwarderRequests,
  onSelectRequest,
  onApproveRequest,
  onRequestRevision,
  onComposeEmail,
  onRequestQuotes,
  onViewQuotations,
}: RequestsCardGridProps) {
  const allForwarderRequests = useMemo(() => {
    const fromProps = forwarderRequests || [];
    const fromLocal = getLocalForwarderRequests();
    const map = new Map<string, ForwarderQuoteRequestRecord>();
    for (const r of fromLocal) {
      if (r?.id) map.set(r.id, r);
    }
    for (const r of fromProps) {
      if (r?.id) map.set(r.id, r);
    }
    return Array.from(map.values());
  }, [forwarderRequests]);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
        <div className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
          <Ship className="size-6" />
        </div>
        <h3 className="mt-4 text-[16px] font-bold text-slate-900">No Booking Requests Found</h3>
        <p className="mt-1.5 max-w-md text-[13px] text-slate-500">
          Try adjusting your search query, status tabs, priority filters, or shipping line
          selections.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4.5 md:grid-cols-2 xl:grid-cols-3">
      {requests.map((req) => {
        const priorityMeta = getPriorityBadge(req.priority);
        const fwdSummary = getBookingForwarderSummary(
          req.movementNumber || req.bookingReference || req.id,
          allForwarderRequests,
        );

        const isConfirmed = req.status === "Approved" || req.confirmationStatus === "CONFIRMED";
        const isAwarded =
          !isConfirmed &&
          (req.status === "Line Allocation" || fwdSummary.overallStatus === "AWARDED");
        const isOffers =
          !isConfirmed &&
          !isAwarded &&
          (fwdSummary.overallStatus === "OFFERS_RECEIVED" || req.status === "Rate Verification");

        return (
          <div
            key={req.id}
            className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-[#0FA3B1]/50 hover:shadow-[0_8px_24px_-4px_rgba(15,163,177,0.12)]"
          >
            <div>
              {/* Top Header Bar */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13.5px] font-bold tracking-tight text-slate-900">
                    {req.movementNumber || req.reference}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10.5px] uppercase ${priorityMeta.classes}`}
                  >
                    {priorityMeta.label}
                  </span>
                </div>

                {isConfirmed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    CONFIRMED
                  </span>
                ) : isAwarded ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800">
                    <span className="size-1.5 rounded-full bg-cyan-500" />
                    AWARDED
                  </span>
                ) : isOffers ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                    <Sparkles className="size-3 text-indigo-600" />
                    OFFERS RECEIVED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                    {req.status}
                  </span>
                )}
              </div>

              {/* Route & Cargo Specs */}
              <div className="mt-3.5 rounded-xl border border-slate-200/90 bg-white p-3 shadow-2xs">
                {/* Port Route */}
                <div className="flex items-center justify-between text-[13px]">
                  <PortFlagDisplay
                    portCode={req.polCode}
                    portName={req.polName}
                    align="left"
                    size="md"
                    className="max-w-[42%]"
                  />

                  <div className="flex flex-col items-center px-2 text-[#0FA3B1] shrink-0">
                    <div className="flex items-center gap-1">
                      <span className="h-px w-5 bg-[#0FA3B1]/40" />
                      <Ship className="size-3.5" />
                      <span className="h-px w-5 bg-[#0FA3B1]/40" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">Ocean Freight</span>
                  </div>

                  <PortFlagDisplay
                    portCode={req.podCode}
                    portName={req.podName}
                    align="right"
                    size="md"
                    className="max-w-[42%]"
                  />
                </div>

                {/* ETD schedule */}
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11.5px] text-slate-600">
                  <div className="flex items-center gap-1">
                    <Calendar className="size-3 text-slate-400" />
                    <span>
                      ETD: <strong className="text-slate-800">{req.requestedEtd}</strong>
                    </span>
                  </div>
                  {req.estimatedEta && (
                    <div>
                      <span>
                        ETA: <strong className="text-slate-800">{req.estimatedEta}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Parties & Cargo Details */}
              <div className="mt-3.5 space-y-1.5 text-[12.5px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11.5px] font-medium text-slate-400">Buyer:</span>
                  <span className="font-semibold text-slate-800 text-right truncate">
                    {req.buyerName}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11.5px] font-medium text-slate-400">
                    Supplier / Load Point:
                  </span>
                  <span
                    className="font-medium text-slate-700 text-right truncate"
                    title={`${req.supplierName} (${req.supplierLoadPoint || req.supplierCity || req.polName})`}
                  >
                    {req.supplierName}
                    <span className="text-slate-400 font-normal ml-1">
                      · {req.supplierLoadPoint || req.supplierCity || req.polName}
                    </span>
                  </span>
                </div>
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-[11.5px] font-medium text-slate-400">
                    Container Type & Qty:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {req.containerCount}x {req.containerSize}{" "}
                    <span className="font-normal text-slate-500">({req.containerType})</span>
                  </span>
                </div>
              </div>

              {/* Multi-Forwarder Intelligence Banner */}
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                    <Users className="size-3.5 text-[#0FA3B1]" />
                    <span>{fwdSummary.totalForwarders} Forwarders</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                      {fwdSummary.quotationsReceived} Received
                    </span>
                    <span className="text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                      {fwdSummary.pendingReplies} Pending
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-xs">
                  <span className="text-slate-500 text-[11px]">
                    {fwdSummary.bestRate ? "Best Quotation Rate:" : "Target Freight:"}
                  </span>
                  <div className="text-right">
                    <span className="font-bold text-slate-900 text-[13px]">
                      ${(fwdSummary.bestRate || req.totalFreight).toLocaleString()}{" "}
                      <span className="text-[10.5px] font-normal text-slate-500">
                        {fwdSummary.bestRateCurrency || req.currency}
                      </span>
                    </span>
                    {fwdSummary.bestRateForwarder && (
                      <span className="block text-[10px] text-emerald-700 font-medium">
                        via {fwdSummary.bestRateForwarder}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Award Status Banner */}
              <div className="mt-2.5">
                {isAwarded && (fwdSummary.awardedForwarder || req.forwarderName) ? (
                  <div className="flex items-center justify-between rounded-lg border border-cyan-200/80 bg-cyan-50/70 px-2.5 py-1.5 text-[11.5px] text-cyan-950">
                    <span className="font-medium text-cyan-800">Award Status:</span>
                    <span className="font-bold text-cyan-900 flex items-center gap-1">
                      <Trophy className="size-3 text-cyan-700" />
                      AWARDED ({fwdSummary.awardedForwarder || req.forwarderName})
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11.5px] text-slate-600 shadow-2xs">
                    <span className="font-medium text-slate-500">Award Status:</span>
                    <span className="font-medium text-slate-700">
                      {fwdSummary.quotationsReceived > 0
                        ? "Awaiting Award Decision"
                        : "Awaiting Quotations"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
              {(onViewQuotations || onRequestQuotes) && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    onViewQuotations ? onViewQuotations(req) : onRequestQuotes?.(req)
                  }
                  className="flex-1 h-8.5 gap-1.5 bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-xs font-bold shadow-2xs cursor-pointer"
                >
                  <Users className="size-3.5" />
                  <span>View Quotations ({fwdSummary.quotationsReceived})</span>
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelectRequest(req)}
                className="h-8.5 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                title="View full booking details"
              >
                Details
                <ChevronRight className="size-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
});
