import { memo, useMemo } from "react";
import {
  Ship,
  Clock,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Users,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortFlagDisplay } from "@/components/nashmia/common/PortFlagDisplay";
import { BookingConfirmationReceiptCard } from "@/components/nashmia/requests/BookingConfirmationReceiptCard";
import {
  getLocalForwarderRequests,
  getBookingForwarderSummary,
  type BookingForwarderSummary,
} from "@/lib/multi-forwarder-service";
import type {
  BookingRequestRecord,
  RequestPriority,
  ForwarderQuoteRequestRecord,
} from "@/types/requests";

interface RequestsCardGridProps {
  requests: BookingRequestRecord[];
  forwarderRequests?: ForwarderQuoteRequestRecord[];
  onSelectRequest: (request: BookingRequestRecord) => void;
  onApproveRequest: (request: BookingRequestRecord) => void;
  onRequestRevision: (request: BookingRequestRecord) => void;
  onComposeEmail?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onViewQuotations?: (request: BookingRequestRecord) => void;
  onOpenAwardDrawer?: (request: BookingRequestRecord) => void;
  onConfirmBooking?: (request: BookingRequestRecord) => void;
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

// ---------------------------------------------------------------------------
// Memoized Individual Request Card Item
// ---------------------------------------------------------------------------
interface RequestCardGridItemProps {
  req: BookingRequestRecord;
  fwdSummary: BookingForwarderSummary;
  allForwarderRequests: ForwarderQuoteRequestRecord[];
  onSelectRequest: (request: BookingRequestRecord) => void;
  onOpenAwardDrawer?: (request: BookingRequestRecord) => void;
  onViewQuotations?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onConfirmBooking?: (request: BookingRequestRecord) => void;
}

const RequestCardGridItem = memo(function RequestCardGridItem({
  req,
  fwdSummary,
  allForwarderRequests,
  onSelectRequest,
  onOpenAwardDrawer,
  onViewQuotations,
  onRequestQuotes,
  onConfirmBooking,
}: RequestCardGridItemProps) {
  const isConfirmed =
    req.status === "Approved" ||
    req.status === "Confirmed" ||
    req.status === "Booking Confirmed" ||
    req.confirmationStatus === "CONFIRMED" ||
    Boolean(req.isMovementConfirmed) ||
    Boolean(req.isConfirmed) ||
    Boolean(req.confirmedAt) ||
    fwdSummary.overallStatus === "CONFIRMED";

  if (isConfirmed) {
    return (
      <BookingConfirmationReceiptCard
        key={req.id}
        request={req}
        forwarderRequests={allForwarderRequests}
        onSelectRequest={onSelectRequest}
        onConfirmBooking={onConfirmBooking}
      />
    );
  }

  const priorityMeta = getPriorityBadge(req.priority);
  const isAwarded =
    !isConfirmed && (req.status === "Line Allocation" || fwdSummary.overallStatus === "AWARDED");

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-[#0FA3B1]/50 hover:shadow-[0_8px_24px_-4px_rgba(15,163,177,0.12)]">
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

          {isAwarded ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800">
              <span className="size-1.5 rounded-full bg-cyan-500" />
              AWARDED
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
            <span className="text-[11.5px] font-medium text-slate-400">Supplier / Load Point:</span>
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
            <span className="text-[11.5px] font-medium text-slate-400">Container Type & Qty:</span>
            <span className="font-semibold text-slate-900">
              {req.containerCount}x {req.containerSize}{" "}
              <span className="font-normal text-slate-500">({req.containerType})</span>
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="text-[11.5px] font-medium text-slate-400">Target Freight:</span>
            <span className="font-bold text-slate-900">
              ${req.totalFreight.toLocaleString()}{" "}
              <span className="text-[10.5px] font-normal text-slate-500">{req.currency}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
        <Button
          type="button"
          size="sm"
          onClick={() => onConfirmBooking?.(req)}
          className="flex-1 h-8.5 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-2xs cursor-pointer"
          title="Confirm booking with forwarder and update movement"
        >
          <CheckCircle2 className="size-3.5" />
          <span>Confirm</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelectRequest(req)}
          className="h-8.5 px-3 text-xs text-slate-700 border-slate-200 hover:bg-slate-50 font-semibold cursor-pointer"
          title="View full booking details"
        >
          Details
          <ChevronRight className="size-3.5 ml-0.5" />
        </Button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main RequestsCardGrid Component
// ---------------------------------------------------------------------------
export const RequestsCardGrid = memo(function RequestsCardGrid({
  requests,
  forwarderRequests,
  onSelectRequest,
  onApproveRequest,
  onRequestRevision,
  onComposeEmail,
  onRequestQuotes,
  onViewQuotations,
  onOpenAwardDrawer,
  onConfirmBooking,
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

  // Pre-index forwarder summaries in O(N) once per data change
  const forwarderSummaryMap = useMemo(() => {
    const map = new Map<string, BookingForwarderSummary>();
    for (const req of requests) {
      const summary = getBookingForwarderSummary(
        req.movementNumber || req.bookingReference || req.id,
        allForwarderRequests,
      );
      map.set(req.id, summary);
    }
    return map;
  }, [requests, allForwarderRequests]);

  const defaultSummary: BookingForwarderSummary = useMemo(
    () => ({
      movementNumber: "",
      totalForwarders: 0,
      quotationsReceived: 0,
      pendingReplies: 0,
      declinedCount: 0,
      overallStatus: "NO_FORWARDERS",
    }),
    [],
  );

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
      {requests.map((req) => (
        <RequestCardGridItem
          key={req.id}
          req={req}
          fwdSummary={forwarderSummaryMap.get(req.id) || defaultSummary}
          allForwarderRequests={allForwarderRequests}
          onSelectRequest={onSelectRequest}
          onOpenAwardDrawer={onOpenAwardDrawer}
          onViewQuotations={onViewQuotations}
          onRequestQuotes={onRequestQuotes}
          onConfirmBooking={onConfirmBooking}
        />
      ))}
    </div>
  );
});
