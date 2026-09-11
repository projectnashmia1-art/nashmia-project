import { memo } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  Calendar,
  Ship,
  Sparkles,
  MapPin,
  Tag,
  ArrowRight,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatShortDate,
  formatRelativeTime,
  type ForwarderOfferCardItem,
} from "@/lib/forwarder-card-service";
import type { ForwarderRecommendationResult } from "@/lib/forwarder-recommendation-service";

interface ForwarderOfferCardProps {
  card: ForwarderOfferCardItem;
  onViewDetails: (card: ForwarderOfferCardItem) => void;
  onAward: (card: ForwarderOfferCardItem) => void;
  onCompare?: (card: ForwarderOfferCardItem) => void;
  isAwarding?: boolean;
  recommendation?: ForwarderRecommendationResult;
}

export const ForwarderOfferCard = memo(function ForwarderOfferCard({
  card,
  onViewDetails,
  onAward,
  onCompare,
  isAwarding = false,
  recommendation,
}: ForwarderOfferCardProps) {
  const isAwarded = card.isAwarded || card.status === "AWARDED";
  const isNotAwarded = card.status === "NOT_AWARDED";
  const isDeclined = card.isDeclined || card.status === "DECLINED";
  const hasRate = card.ratePerContainer !== undefined && card.ratePerContainer !== null;

  // Format ETD and ETA
  const etdFormatted = card.etd ? formatShortDate(card.etd) : "Not specified";
  const etaFormatted = card.eta ? formatShortDate(card.eta) : "Not specified";

  // Transit days string
  const transitString =
    card.transitDays !== undefined && card.transitDays !== null
      ? `${card.transitDays} days`
      : "Not specified";

  // Relative response time string
  const relativeResponse = formatRelativeTime(card.responseTimestamp);

  // Status subtitle styling
  let statusBadgeColor = "text-slate-600 bg-slate-100 border-slate-200";
  let statusDot = "bg-slate-400";
  let statusLine = `${card.status === "REQUESTED" ? "Requested" : "Responded"} • ${card.statusSubtext}`;

  if (isAwarded) {
    statusBadgeColor = "text-emerald-800 bg-emerald-50 border-emerald-200";
    statusDot = "bg-emerald-500";
    statusLine = card.isConfirmed ? "Awarded • Confirmed" : "Awarded • Official Forwarder";
  } else if (isNotAwarded) {
    statusBadgeColor = "text-slate-600 bg-slate-100 border-slate-200";
    statusDot = "bg-slate-400";
    statusLine = "Not Awarded";
  } else if (isDeclined) {
    statusBadgeColor = "text-rose-800 bg-rose-50 border-rose-200";
    statusDot = "bg-rose-400";
    statusLine = "Responded • Declined";
  } else if (card.statusSubtext === "Available") {
    statusBadgeColor = "text-emerald-800 bg-emerald-50 border-emerald-200";
    statusDot = "bg-emerald-500";
    statusLine = "Responded • Available";
  } else if (card.statusSubtext === "Needs Review") {
    statusBadgeColor = "text-amber-800 bg-amber-50 border-amber-200";
    statusDot = "bg-amber-500";
    statusLine = "Responded • Needs Review";
  } else if (card.status === "REQUESTED") {
    statusBadgeColor = "text-indigo-800 bg-indigo-50 border-indigo-200";
    statusDot = "bg-indigo-500";
    statusLine = "Requested • Awaiting Response";
  }

  return (
    <div
      id={`forwarder-card-${card.id}`}
      className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-xs transition-all duration-200 hover:shadow-md ${
        isAwarded
          ? "border-emerald-300 ring-1 ring-emerald-200 bg-emerald-50/10"
          : "border-slate-200/90 hover:border-slate-300"
      }`}
    >
      <div>
        {/* Recommendation Badge (Optional Advisory) */}
        {recommendation && recommendation.badges.length > 0 && !isAwarded && (
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {recommendation.badges.map((b) => (
              <span
                key={b.type}
                title={`${b.label}: ${b.description} (Advisory recommendation only)`}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${b.bgClass} ${b.colorClass} border ${b.borderClass}`}
              >
                <span>{b.icon}</span>
                <span>{b.label}</span>
                <span className="opacity-75 text-[9.5px]">({recommendation.score}/100)</span>
              </span>
            ))}
          </div>
        )}

        {/* Top Header: Forwarder Name & Optional Movement Tag */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[17px] font-bold tracking-tight text-slate-900 line-clamp-1">
              {card.forwarderName}
            </h3>
            {/* Status Line: Responded • Available */}
            <div className="mt-1 flex items-center gap-1.5">
              <span className={`inline-block size-2 rounded-full ${statusDot}`} />
              <span className="text-[12.5px] font-medium text-slate-600">{statusLine}</span>
            </div>
          </div>

          {/* Movement Number Badge & Quick Compare */}
          {card.movementNumber && (
            <div className="flex items-center gap-1">
              <span className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600">
                {card.movementNumber}
              </span>
              {onCompare && (
                <button
                  type="button"
                  title={`Compare all offers for ${card.movementNumber}`}
                  onClick={() => onCompare(card)}
                  className="rounded-md p-1 text-slate-400 hover:bg-[#E8F5F6] hover:text-[#0FA3B1] transition-colors cursor-pointer"
                >
                  <Scale className="size-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Route / Ports Context (if available) */}
        {(card.polCode || card.podCode) && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-slate-500">
            <MapPin className="size-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">{card.polCode || "POL"}</span>
            <ArrowRight className="size-3 text-slate-400" />
            <span className="font-semibold text-slate-700">{card.podCode || "POD"}</span>
            {card.carrier && (
              <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
                {card.carrier}
              </span>
            )}
          </div>
        )}

        {/* Primary Rate Display: $2,100 USD */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          {hasRate ? (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[26px] font-extrabold tracking-tight text-slate-900">
                ${card.ratePerContainer?.toLocaleString()}
              </span>
              <span className="text-[13px] font-semibold text-slate-500">{card.currency}</span>
              {card.containerCount > 1 && (
                <span className="ml-auto text-[11px] text-slate-400">
                  Total: $
                  {(
                    card.totalFreight || (card.ratePerContainer || 0) * card.containerCount
                  ).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-[20px] font-semibold text-slate-400 italic">
                {card.status === "REQUESTED" ? "Pending Rate Quote" : "Rate Not Provided"}
              </span>
            </div>
          )}
        </div>

        {/* Container Size & Specifications */}
        <div className="mt-1 text-[13px] font-bold text-[#0FA3B1]">
          {card.containerCount > 1 ? `${card.containerCount}x ` : ""}
          {card.containerSize}
          {card.containerType ? ` (${card.containerType})` : ""}
        </div>

        {/* Schedule & Transit Details: ETD, ETA, Transit */}
        <div className="mt-3 space-y-1.5 text-[12.5px] text-slate-600">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">ETD:</span>
            <span className="font-semibold text-slate-800">{etdFormatted}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">ETA:</span>
            <span className="font-semibold text-slate-800">{etaFormatted}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">Transit:</span>
            <span className="font-semibold text-slate-800">{transitString}</span>
          </div>
        </div>

        {/* Operational Status: Availability & Relative Response Time */}
        <div className="mt-4 rounded-xl bg-slate-50 p-2.5 space-y-1 text-[12px] border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Availability:</span>
            <span
              className={`font-semibold ${
                card.availability.toLowerCase().includes("available") && !isDeclined
                  ? "text-emerald-700"
                  : isDeclined
                    ? "text-rose-700"
                    : "text-slate-700"
              }`}
            >
              {card.availability}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-500">Response:</span>
            <span className="font-medium text-slate-700">{relativeResponse}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons: [ View Details ] [ Award ] */}
      <div className="mt-5 flex items-center gap-2 pt-3 border-t border-slate-100">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onViewDetails(card)}
          className="flex-1 h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
        >
          <Eye className="size-3.5 mr-1.5 text-slate-400" />
          View Details
        </Button>

        {isAwarded ? (
          <Button
            type="button"
            size="sm"
            disabled
            className="flex-1 h-9 rounded-xl bg-emerald-600 text-xs font-semibold text-white cursor-default gap-1.5 opacity-95"
          >
            <CheckCircle2 className="size-3.5" />
            {card.isConfirmed ? "Awarded • Confirmed" : "Awarded"}
          </Button>
        ) : isNotAwarded ? (
          <Button
            type="button"
            size="sm"
            disabled
            title="Only the awarded forwarder can confirm this booking."
            className="flex-1 h-9 rounded-xl bg-slate-100 text-xs font-medium text-slate-400 border border-slate-200 cursor-not-allowed gap-1.5"
          >
            Not Awarded
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => onAward(card)}
            disabled={isAwarding || isDeclined}
            className={`flex-1 h-9 rounded-xl text-xs font-semibold text-white shadow-xs transition-all gap-1.5 ${
              isDeclined
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-[#0FA3B1] hover:bg-[#0D919E]"
            }`}
          >
            <CheckCircle2 className="size-3.5" />
            {isAwarding ? "Awarding..." : "Award"}
          </Button>
        )}
      </div>
    </div>
  );
});
