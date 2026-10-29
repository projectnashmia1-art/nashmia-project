import { memo, useMemo } from "react";
import {
  Ship,
  CheckCircle2,
  FileEdit,
  Mail,
  ChevronRight,
  Clock,
  Users,
  Sparkles,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getPortCountryMeta } from "@/lib/port-flags";
import { CountryFlagSvg } from "@/components/nashmia/common/CountryFlagSvg";
import {
  getLocalForwarderRequests,
  getBookingForwarderSummary,
  type BookingForwarderSummary,
} from "@/lib/multi-forwarder-service";
import type { BookingRequestRecord, ForwarderQuoteRequestRecord } from "@/types/requests";

interface RequestsTableViewProps {
  requests: BookingRequestRecord[];
  forwarderRequests?: ForwarderQuoteRequestRecord[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelectRequest: (request: BookingRequestRecord) => void;
  onApproveRequest: (request: BookingRequestRecord) => void;
  onRequestRevision: (request: BookingRequestRecord) => void;
  onComposeEmail?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onViewQuotations?: (request: BookingRequestRecord) => void;
  onOpenAwardDrawer?: (request: BookingRequestRecord) => void;
  onConfirmBooking?: (request: BookingRequestRecord) => void;
}

// ---------------------------------------------------------------------------
// Memoized Desktop Table Row
// ---------------------------------------------------------------------------
interface RequestTableRowItemProps {
  req: BookingRequestRecord;
  isSelected: boolean;
  fwdSummary: BookingForwarderSummary;
  onToggleSelect: (id: string) => void;
  onSelectRequest: (request: BookingRequestRecord) => void;
  onOpenAwardDrawer?: (request: BookingRequestRecord) => void;
  onViewQuotations?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onConfirmBooking?: (request: BookingRequestRecord) => void;
}

const RequestTableRowItem = memo(function RequestTableRowItem({
  req,
  isSelected,
  fwdSummary,
  onToggleSelect,
  onSelectRequest,
  onOpenAwardDrawer,
  onViewQuotations,
  onRequestQuotes,
  onConfirmBooking,
}: RequestTableRowItemProps) {
  const isConfirmed =
    req.status === "Approved" ||
    req.status === "Confirmed" ||
    req.status === "Booking Confirmed" ||
    req.confirmationStatus === "CONFIRMED" ||
    Boolean(req.isMovementConfirmed) ||
    Boolean(req.confirmedAt) ||
    fwdSummary.overallStatus === "CONFIRMED";

  const isAwarded =
    !isConfirmed && (req.status === "Line Allocation" || fwdSummary.overallStatus === "AWARDED");

  const isOffers =
    !isConfirmed &&
    !isAwarded &&
    (fwdSummary.overallStatus === "OFFERS_RECEIVED" || req.status === "Rate Verification");

  const polMeta = getPortCountryMeta(req.polCode, req.polName);
  const podMeta = getPortCountryMeta(req.podCode, req.podName);

  return (
    <tr
      className={`transition-colors ${
        isConfirmed
          ? "bg-emerald-50/30 hover:bg-emerald-50/60"
          : isSelected
            ? "bg-[#F0F9FA] hover:bg-[#E8F5F6]"
            : "hover:bg-slate-50/80"
      }`}
    >
      {/* Select Checkbox */}
      <td className="px-4 py-3.5">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(req.id)}
          className="rounded border-slate-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
          aria-label={`Select request ${req.reference}`}
        />
      </td>

      {/* 1. Movement Number */}
      <td className="px-4 py-3.5">
        <button
          type="button"
          onClick={() => onSelectRequest(req)}
          className="text-left font-mono font-bold text-[#0FA3B1] hover:underline block"
        >
          {req.movementNumber || req.reference}
        </button>
        <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
          {req.bookingReference && req.bookingReference !== req.movementNumber && (
            <span className="font-mono text-[11px] text-slate-500">{req.bookingReference}</span>
          )}
          <span
            className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
              req.priority === "Urgent"
                ? "bg-rose-100 text-rose-800"
                : req.priority === "High"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
            }`}
          >
            {req.priority}
          </span>
        </div>
      </td>

      {/* 2. Buyer */}
      <td className="px-4 py-3.5 max-w-[170px]">
        <p className="font-semibold text-slate-900 line-clamp-1">{req.buyerName}</p>
        <p className="text-[11px] text-slate-400 line-clamp-1">Consignee</p>
      </td>

      {/* 3. Supplier / Load Point */}
      <td className="px-4 py-3.5 max-w-[210px]">
        <p className="font-medium text-slate-900 line-clamp-1">{req.supplierName}</p>
        <p
          className="text-[11.5px] text-slate-500 line-clamp-1"
          title={`${req.supplierLoadPoint || req.supplierCity || req.polName}`}
        >
          Load Point:{" "}
          <span className="font-medium text-slate-700">
            {req.supplierLoadPoint || req.supplierCity || req.polName}
          </span>
        </p>
      </td>

      {/* 4. Origin & Destination */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <CountryFlagSvg countryCode={polMeta.countryCode} size="xs" title={polMeta.countryName} />
          <span className="font-bold text-slate-900">{req.polCode}</span>
          <span className="text-slate-400">→</span>
          <CountryFlagSvg countryCode={podMeta.countryCode} size="xs" title={podMeta.countryName} />
          <span className="font-bold text-slate-900">{req.podCode}</span>
        </div>
        <p
          className="text-[11px] text-slate-500 line-clamp-1 max-w-[200px]"
          title={`${req.polName} to ${req.podName}`}
        >
          {req.polName || req.polCode} · ETD {req.requestedEtd}
        </p>
      </td>

      {/* 5. Container Type & Quantity */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <p className="font-bold text-slate-900">
          {req.containerCount}x {req.containerSize}
        </p>
        <p className="text-[11.5px] text-slate-500">{req.containerType || "High Cube Dry"}</p>
      </td>

      {/* 6, 7, 8. Forwarder Quotations: Total, Received, Pending */}
      <td className="px-4 py-3.5 text-center whitespace-nowrap">
        <div className="inline-flex flex-col items-center">
          <span className="inline-flex items-center gap-1 font-semibold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            <Users className="size-3 text-[#0FA3B1]" />
            {fwdSummary.totalForwarders} Forwarders
          </span>
          <div className="mt-1 flex items-center gap-1.5 text-[10.5px]">
            <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
              {fwdSummary.quotationsReceived} Received
            </span>
            <span className="text-amber-700 font-medium bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
              {fwdSummary.pendingReplies} Pending
            </span>
          </div>
        </div>
      </td>

      {/* 9. Overall Booking Status */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        {(() => {
          if (isConfirmed) {
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 shadow-2xs">
                <CheckCircle2 className="size-3 text-emerald-600" />
                CONFIRMED RECEIPT
              </span>
            );
          }

          if (req.confirmationStatus === "PENDING" || isAwarded) {
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-800">
                <span className="size-1.5 rounded-full bg-cyan-500" />
                PENDING CONFIRMATION
              </span>
            );
          }

          if (isOffers) {
            return (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                <Sparkles className="size-3 text-indigo-600" />
                OFFERS RECEIVED
              </span>
            );
          }

          return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
              {req.status}
            </span>
          );
        })()}
      </td>

      {/* 10. Award Status */}
      <td className="px-4 py-3.5 whitespace-nowrap">
        <button
          type="button"
          onClick={() => {
            if (onOpenAwardDrawer) {
              onOpenAwardDrawer(req);
            } else if (onViewQuotations) {
              onViewQuotations(req);
            }
          }}
          className="cursor-pointer hover:opacity-85 transition-opacity text-left"
          title="Open Award Status & Rates Drawer"
        >
          {isAwarded && (fwdSummary.awardedForwarder || req.forwarderName) ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-0.5 text-[11px] font-bold text-cyan-900 shadow-2xs">
              AWARDED ({fwdSummary.awardedForwarder || req.forwarderName})
            </span>
          ) : fwdSummary.quotationsReceived > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 shadow-2xs">
              <span>{fwdSummary.quotationsReceived} Quotes</span>
              {fwdSummary.bestRate && (
                <span className="font-mono text-[10.5px] text-slate-700">
                  (${fwdSummary.bestRate.toLocaleString()})
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
              Awaiting Quotes
            </span>
          )}
        </button>
      </td>

      {/* 11. View Quotations & Confirm Action */}
      <td className="px-4 py-3.5 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1.5">
          {isConfirmed ? (
            <Button
              type="button"
              size="sm"
              onClick={() => (onConfirmBooking ? onConfirmBooking(req) : onSelectRequest(req))}
              className="h-7.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-[11.5px] font-bold gap-1 shadow-2xs cursor-pointer"
              title="Booking is confirmed. Click to view or update confirmation details."
            >
              <CheckCircle2 className="size-3" />
              Confirmed
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => onConfirmBooking?.(req)}
              className="h-7.5 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 text-[11.5px] font-bold gap-1 shadow-2xs cursor-pointer"
              title="Confirm booking and update movement"
            >
              <CheckCircle2 className="size-3" />
              Confirm
            </Button>
          )}

          {(onViewQuotations || onRequestQuotes) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (onViewQuotations ? onViewQuotations(req) : onRequestQuotes?.(req))}
              className="h-7.5 border-slate-200 hover:bg-slate-50 text-slate-700 px-2.5 text-[11.5px] font-semibold gap-1 shadow-2xs cursor-pointer"
            >
              <Users className="size-3 text-[#0FA3B1]" />
              Quotes ({fwdSummary.quotationsReceived})
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectRequest(req)}
            className="h-7.5 border-slate-200 px-2 text-[11.5px] text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            Details
          </Button>
        </div>
      </td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// Memoized Mobile Card
// ---------------------------------------------------------------------------
interface RequestMobileCardItemProps {
  req: BookingRequestRecord;
  isSelected: boolean;
  fwdSummary: BookingForwarderSummary;
  onToggleSelect: (id: string) => void;
  onSelectRequest: (request: BookingRequestRecord) => void;
  onViewQuotations?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
}

const RequestMobileCardItem = memo(function RequestMobileCardItem({
  req,
  isSelected,
  fwdSummary,
  onToggleSelect,
  onSelectRequest,
  onViewQuotations,
  onRequestQuotes,
}: RequestMobileCardItemProps) {
  const isConfirmed =
    req.status === "Approved" ||
    req.status === "Confirmed" ||
    req.status === "Booking Confirmed" ||
    req.confirmationStatus === "CONFIRMED" ||
    Boolean(req.isMovementConfirmed) ||
    Boolean(req.isConfirmed) ||
    Boolean(req.confirmedAt) ||
    fwdSummary.overallStatus === "CONFIRMED";

  const isAwarded =
    !isConfirmed && (req.status === "Line Allocation" || fwdSummary.overallStatus === "AWARDED");

  const polMeta = getPortCountryMeta(req.polCode, req.polName);
  const podMeta = getPortCountryMeta(req.podCode, req.podName);

  return (
    <div
      onClick={() => onSelectRequest(req)}
      className={`p-4 space-y-3 cursor-pointer transition-colors active:bg-slate-50 ${
        isConfirmed
          ? "bg-emerald-50/40 border-l-4 border-l-emerald-500"
          : isSelected
            ? "bg-[#F0F9FA]"
            : ""
      }`}
    >
      {/* Header row: Checkbox + Ref + Priority + Status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect(req.id);
            }}
            className="rounded border-slate-300 text-[#0FA3B1] focus:ring-[#0FA3B1] size-4 shrink-0"
            aria-label={`Select request ${req.reference}`}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-sm text-[#0FA3B1]">
                {req.movementNumber || req.reference}
              </span>
              {req.bookingReference && req.bookingReference !== req.movementNumber && (
                <span className="font-mono text-xs text-slate-400">{req.bookingReference}</span>
              )}
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  req.priority === "Urgent"
                    ? "bg-rose-100 text-rose-800"
                    : req.priority === "High"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {req.priority}
              </span>
            </div>
          </div>
        </div>

        {/* Forwarder Status Badge */}
        {isConfirmed ? (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
            <CheckCircle2 className="size-3 text-emerald-600" />
            CONFIRMED RECEIPT
          </span>
        ) : (
          <span className="shrink-0 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {fwdSummary.overallStatus !== "NO_FORWARDERS"
              ? fwdSummary.overallStatus.replace("_", " ")
              : req.status}
          </span>
        )}
      </div>

      {/* Route & Parties */}
      <div className="rounded-xl bg-white p-3 space-y-2 border border-slate-200/90 shadow-2xs">
        <div className="flex items-center justify-between font-semibold text-xs text-slate-800">
          <div className="flex items-center gap-1.5">
            <CountryFlagSvg
              countryCode={polMeta.countryCode}
              size="xs"
              title={polMeta.countryName}
            />
            <span className="font-bold text-slate-900">{req.polCode}</span>
            <span className="text-slate-400">→</span>
            <CountryFlagSvg
              countryCode={podMeta.countryCode}
              size="xs"
              title={podMeta.countryName}
            />
            <span className="font-bold text-slate-900">{req.podCode}</span>
          </div>
          <span className="text-[11px] font-normal text-slate-500">ETD {req.requestedEtd}</span>
        </div>
        <div className="text-xs text-slate-600 space-y-1 pt-1.5 border-t border-slate-100">
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-400">Buyer:</span>
            <span className="font-semibold text-slate-900 truncate">{req.buyerName}</span>
          </div>
          <div className="flex items-start justify-between gap-2">
            <span className="text-slate-400">Supplier / Load Point:</span>
            <span
              className="font-medium text-slate-700 truncate"
              title={`${req.supplierName} (${req.supplierLoadPoint || req.supplierCity || req.polName})`}
            >
              {req.supplierName}
              <span className="text-slate-400 font-normal ml-1">
                · {req.supplierLoadPoint || req.supplierCity || req.polName}
              </span>
            </span>
          </div>
          <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="text-slate-400">Container Type & Qty:</span>
            <span className="font-semibold text-slate-900">
              {req.containerCount}x {req.containerSize}{" "}
              <span className="text-slate-500 font-normal">({req.containerType})</span>
            </span>
          </div>
        </div>
      </div>

      {/* Multi-Forwarder Quick Stats (Mobile) */}
      <div className="flex items-center justify-between text-xs rounded-lg bg-white p-2.5 border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Users className="size-3.5 text-[#0FA3B1]" />
          <span>
            <strong>{fwdSummary.totalForwarders}</strong> Forwarders
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
            {fwdSummary.quotationsReceived} Received
          </span>
          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
            {fwdSummary.pendingReplies} Pending
          </span>
        </div>
      </div>

      {/* Award Status (Mobile) */}
      <div className="text-[11.5px] px-2.5 py-1.5 rounded-lg border bg-white border-slate-200 shadow-2xs flex items-center justify-between">
        <span className="text-slate-500 font-medium">Award Status:</span>
        {isAwarded && (fwdSummary.awardedForwarder || req.forwarderName) ? (
          <span className="font-bold text-cyan-900">
            AWARDED ({fwdSummary.awardedForwarder || req.forwarderName})
          </span>
        ) : (
          <span className="text-slate-700 font-medium">
            {fwdSummary.quotationsReceived > 0 ? "Awaiting Decision" : "Awaiting Quotations"}
          </span>
        )}
      </div>

      {/* Mobile Actions */}
      <div
        className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {(onViewQuotations || onRequestQuotes) && (
          <Button
            type="button"
            size="sm"
            onClick={() => (onViewQuotations ? onViewQuotations(req) : onRequestQuotes?.(req))}
            className="h-8 bg-[#0FA3B1] hover:bg-[#0D919E] px-3 text-xs font-semibold text-white gap-1"
          >
            <Users className="size-3.5" />
            View Quotations ({fwdSummary.quotationsReceived})
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onSelectRequest(req)}
          className="h-8 border-slate-200 px-3 text-xs text-slate-700 hover:bg-slate-50"
        >
          Details
        </Button>
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Main RequestsTableView Component
// ---------------------------------------------------------------------------
export const RequestsTableView = memo(function RequestsTableView({
  requests,
  forwarderRequests,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onSelectRequest,
  onApproveRequest,
  onRequestRevision,
  onComposeEmail,
  onRequestQuotes,
  onViewQuotations,
  onOpenAwardDrawer,
  onConfirmBooking,
}: RequestsTableViewProps) {
  const isAllSelected = requests.length > 0 && selectedIds.length === requests.length;
  const localList = useMemo(() => getLocalForwarderRequests(), []);
  const allForwarderRequests =
    forwarderRequests && forwarderRequests.length > 0 ? forwarderRequests : localList;

  // Pre-index forwarder summaries in O(N) once per data update for instant O(1) lookups per row
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

  // Fast set lookup for selectedIds
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
        <p className="text-[14px] font-medium text-slate-500">
          No requests match current table filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      {/* Mobile Cards (Visible below md) */}
      <div className="md:hidden divide-y divide-slate-100">
        {requests.map((req) => (
          <RequestMobileCardItem
            key={req.id}
            req={req}
            isSelected={selectedSet.has(req.id)}
            fwdSummary={forwarderSummaryMap.get(req.id) || defaultSummary}
            onToggleSelect={onToggleSelect}
            onSelectRequest={onSelectRequest}
            onViewQuotations={onViewQuotations}
            onRequestQuotes={onRequestQuotes}
          />
        ))}
      </div>

      {/* Desktop Table (Visible md and up) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
                  aria-label="Select all requests"
                />
              </th>
              <th className="px-4 py-3">Movement Number</th>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Supplier / Load Point</th>
              <th className="px-4 py-3">Origin → Destination</th>
              <th className="px-4 py-3">Container Type & Qty</th>
              <th className="px-4 py-3 text-center">Forwarder Quotes</th>
              <th className="px-4 py-3">Overall Booking Status</th>
              <th className="px-4 py-3">Award Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((req) => (
              <RequestTableRowItem
                key={req.id}
                req={req}
                isSelected={selectedSet.has(req.id)}
                fwdSummary={forwarderSummaryMap.get(req.id) || defaultSummary}
                onToggleSelect={onToggleSelect}
                onSelectRequest={onSelectRequest}
                onOpenAwardDrawer={onOpenAwardDrawer}
                onViewQuotations={onViewQuotations}
                onRequestQuotes={onRequestQuotes}
                onConfirmBooking={onConfirmBooking}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});
