import { memo } from "react";
import {
  Ship,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Mail,
  MoreVertical,
  Calendar,
  DollarSign,
  Package,
  Weight,
  MapPin,
  ExternalLink,
  ChevronRight,
  Users,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingRequestRecord, RequestStatus, RequestPriority } from "@/types/requests";
import type { ForwarderOfferCardItem } from "@/lib/forwarder-card-service";

interface RequestsCardGridProps {
  requests: BookingRequestRecord[];
  forwarderCards?: ForwarderOfferCardItem[];
  onSelectRequest: (request: BookingRequestRecord) => void;
  onApproveRequest: (request: BookingRequestRecord) => void;
  onRequestRevision: (request: BookingRequestRecord) => void;
  onComposeEmail?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onViewForwarderOffers?: (bookingId?: string) => void;
  onCompareForwarderOffers?: (request: BookingRequestRecord) => void;
}

function getStatusBadge(status: RequestStatus) {
  switch (status) {
    case "Pending Review":
      return {
        label: "Pending Review",
        classes: "border-amber-200 bg-amber-50 text-amber-800",
        dot: "bg-amber-500",
      };
    case "Rate Verification":
      return {
        label: "Rate Check",
        classes: "border-indigo-200 bg-indigo-50 text-indigo-800",
        dot: "bg-indigo-500",
      };
    case "Line Allocation":
      return {
        label: "Line Allocation",
        classes: "border-cyan-200 bg-cyan-50 text-cyan-800",
        dot: "bg-cyan-500",
      };
    case "Approved":
      return {
        label: "CONFIRMED",
        classes: "border-emerald-200 bg-emerald-50 text-emerald-800",
        dot: "bg-emerald-500",
      };
    case "Revision Requested":
      return {
        label: "Revision Required",
        classes: "border-rose-200 bg-rose-50 text-rose-800",
        dot: "bg-rose-500",
      };
    case "Declined":
      return {
        label: "Declined",
        classes: "border-slate-200 bg-slate-100 text-slate-700",
        dot: "bg-slate-400",
      };
    default:
      return {
        label: status,
        classes: "border-slate-200 bg-slate-50 text-slate-700",
        dot: "bg-slate-400",
      };
  }
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
  forwarderCards = [],
  onSelectRequest,
  onApproveRequest,
  onRequestRevision,
  onComposeEmail,
  onRequestQuotes,
  onViewForwarderOffers,
  onCompareForwarderOffers,
}: RequestsCardGridProps) {
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
        const statusMeta = getStatusBadge(req.status);
        const priorityMeta = getPriorityBadge(req.priority);

        return (
          <div
            key={req.id}
            className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] transition-all duration-200 hover:border-[#0FA3B1]/50 hover:shadow-[0_8px_24px_-4px_rgba(15,163,177,0.12)]"
          >
            <div>
              {/* Top Header Bar */}
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-bold tracking-tight text-slate-900">
                    {req.reference}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10.5px] uppercase ${priorityMeta.classes}`}
                  >
                    {priorityMeta.label}
                  </span>
                </div>

                <div
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold ${statusMeta.classes}`}
                >
                  <span className={`size-1.5 rounded-full ${statusMeta.dot}`} />
                  <span>{statusMeta.label}</span>
                </div>
              </div>

              {/* Route & Cargo Specs */}
              <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
                {/* Port Route */}
                <div className="flex items-center justify-between text-[13px]">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900">{req.polCode}</span>
                    <p className="line-clamp-1 text-[11.5px] text-slate-500">{req.polName}</p>
                  </div>

                  <div className="flex flex-col items-center px-3 text-[#0FA3B1]">
                    <div className="flex items-center gap-1">
                      <span className="h-px w-6 bg-[#0FA3B1]/40" />
                      <Ship className="size-3.5" />
                      <span className="h-px w-6 bg-[#0FA3B1]/40" />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500">Ocean Freight</span>
                  </div>

                  <div className="min-w-0 text-right">
                    <span className="font-bold text-slate-900">{req.podCode}</span>
                    <p className="line-clamp-1 text-[11.5px] text-slate-500">{req.podName}</p>
                  </div>
                </div>

                {/* ETD / ETA schedule */}
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/60 pt-2 text-[11.5px] text-slate-600">
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

              {/* Parties: Shipper -> Consignee */}
              <div className="mt-3.5 space-y-2 text-[12.5px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11.5px] font-medium text-slate-400">Shipper:</span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-800">{req.supplierName}</span>
                    {req.supplierCity && (
                      <p className="text-[11px] text-slate-500">{req.supplierCity}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11.5px] font-medium text-slate-400">Consignee:</span>
                  <div className="text-right">
                    <span className="font-semibold text-slate-800">{req.buyerName}</span>
                    <p className="text-[11px] text-slate-500">{req.buyerCountry}</p>
                  </div>
                </div>

                {/* Cargo Details */}
                <div className="flex items-start justify-between gap-2 pt-1 border-t border-slate-100">
                  <span className="text-[11.5px] font-medium text-slate-400">Cargo:</span>
                  <div className="text-right">
                    <span className="font-medium text-slate-800 line-clamp-1">
                      {req.cargo.description}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {req.containerCount}x {req.containerSize} ({req.containerType}) ·{" "}
                      {Math.round(req.cargo.totalWeightKg / 1000)}t
                    </p>
                  </div>
                </div>
              </div>

              {/* Carrier & Rate Banner */}
              <div className="mt-3.5 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-800 border border-slate-200">
                    {req.preferredCarrier}
                  </span>
                  {req.vesselName && (
                    <span className="text-[11px] text-slate-500 font-mono">{req.vesselName}</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[13.5px] font-bold text-slate-900">
                    ${req.totalFreight.toLocaleString()}{" "}
                    <span className="text-[10.5px] font-normal text-slate-500">{req.currency}</span>
                  </span>
                </div>
              </div>

              {/* Forwarder Offers Indicator (if quotes received) */}
              {(() => {
                const offers = forwarderCards.filter(
                  (c) => c.bookingId === req.id || c.movementNumber === req.reference,
                );
                if (offers.length === 0) return null;
                const lowestRate = Math.min(
                  ...offers.map((o) => o.ratePerContainer || 999999).filter((r) => r < 999999),
                );
                return (
                  <button
                    type="button"
                    onClick={() =>
                      onCompareForwarderOffers
                        ? onCompareForwarderOffers(req)
                        : onViewForwarderOffers?.(req.id)
                    }
                    className="mt-2.5 flex w-full items-center justify-between rounded-lg border border-teal-200 bg-[#E8F5F6]/50 px-2.5 py-1.5 text-[11.5px] text-[#0D919E] hover:bg-[#E8F5F6] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      <Scale className="size-3.5 text-[#0FA3B1]" />
                      <span>
                        Compare {offers.length} Forwarder Offer{offers.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    {lowestRate < 999999 && (
                      <span className="font-bold text-slate-800">
                        From ${lowestRate.toLocaleString()} USD
                      </span>
                    )}
                  </button>
                );
              })()}

              {/* Gate Cut-Off notice */}
              {req.gateCutoff && (
                <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-amber-700">
                  <Clock className="size-3.5 text-amber-500" />
                  <span>
                    Gate Cut-off: <strong>{req.gateCutoff}</strong>
                  </span>
                </div>
              )}
              {/* Awarded Forwarder Confirmation Info */}
              {req.status === "Approved" && req.confirmedBy && (
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-1.5 text-[11.5px] text-emerald-950">
                  <span className="font-medium text-emerald-800">Assigned Forwarder:</span>
                  <span className="font-bold text-emerald-900">{req.confirmedBy}</span>
                </div>
              )}
            </div>

            {/* Bottom Actions Bar */}
            <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
              {req.status === "Approved" ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold shadow-2xs">
                  <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">Approved & Confirmed</span>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => onApproveRequest(req)}
                  className="flex-1 h-8.5 gap-1 bg-[#0FA3B1] text-xs font-semibold text-white hover:bg-[#0D919E]"
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve & Confirm
                </Button>
              )}

              {req.status !== "Revision Requested" && req.status !== "Approved" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestRevision(req)}
                  className="h-8.5 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
                  title="Request changes from shipper"
                >
                  <FileEdit className="size-3.5" />
                  Revision
                </Button>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onSelectRequest(req)}
                className="h-8.5 px-2.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
                title="View complete dossier"
              >
                Details
                <ChevronRight className="size-3.5 ml-0.5" />
              </Button>

              {onRequestQuotes && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRequestQuotes(req)}
                  className="h-8.5 px-2 text-xs text-[#0FA3B1] border-[#0FA3B1]/30 bg-[#E8F5F6]/30 hover:bg-[#E8F5F6] font-medium"
                  title="Request quotes from multiple forwarders"
                >
                  <Users className="size-3.5 mr-1" />
                  Quotes
                </Button>
              )}

              {onComposeEmail && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onComposeEmail(req)}
                  className="size-8.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  title="Send email regarding this request"
                >
                  <Mail className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
