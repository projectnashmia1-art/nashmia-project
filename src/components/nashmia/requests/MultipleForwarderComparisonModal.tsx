import { useState, useMemo } from "react";
import {
  Scale,
  X,
  Ship,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
  Award,
  ShieldCheck,
  TrendingDown,
  Zap,
  Check,
  ChevronRight,
  Info,
  RefreshCw,
  SlidersHorizontal,
  Table as TableIcon,
  LayoutGrid,
  FileText,
  AlertTriangle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  formatShortDate,
  formatRelativeTime,
  awardForwarderOfferCard,
  type ForwarderOfferCardItem,
} from "@/lib/forwarder-card-service";
import {
  calculateForwarderRecommendations,
  type ForwarderRecommendationResult,
} from "@/lib/forwarder-recommendation-service";
import type { BookingRequestRecord } from "@/types/requests";

interface MultipleForwarderComparisonModalProps {
  booking: BookingRequestRecord | null;
  offers: ForwarderOfferCardItem[];
  allBookings?: BookingRequestRecord[];
  isOpen: boolean;
  onClose: () => void;
  onSelectBooking?: (booking: BookingRequestRecord) => void;
  onAwardOffer?: (offer: ForwarderOfferCardItem) => Promise<void> | void;
  onRefresh?: () => void;
  userId?: string | null;
}

type SortOption = "score-desc" | "price-asc" | "transit-asc" | "etd-asc" | "response-asc";
type AvailabilityFilter = "all" | "available-only" | "pending-only";

export function MultipleForwarderComparisonModal({
  booking,
  offers,
  allBookings = [],
  isOpen,
  onClose,
  onSelectBooking,
  onAwardOffer,
  onRefresh,
  userId,
}: MultipleForwarderComparisonModalProps) {
  const [smartRecommendationEnabled, setSmartRecommendationEnabled] = useState<boolean>(true);
  const [expandedScoreCardId, setExpandedScoreCardId] = useState<string | null>(null);
  const [showFormulaExplainer, setShowFormulaExplainer] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortOption>("score-desc");
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [confirmingAwardOffer, setConfirmingAwardOffer] = useState<ForwarderOfferCardItem | null>(
    null,
  );
  const [isAwarding, setIsAwarding] = useState(false);

  // Filter offers for the active booking if booking is provided
  const bookingOffers = useMemo(() => {
    if (!booking) return offers;
    const ref = (booking.reference || "").toLowerCase();
    const id = (booking.id || "").toLowerCase();

    const matched = offers.filter(
      (o) =>
        (o.bookingId && o.bookingId.toLowerCase() === id) ||
        (o.movementNumber && o.movementNumber.toLowerCase() === ref) ||
        o.id === id ||
        o.id === ref,
    );

    // If no direct matches but offers exist, return offers that share the movement
    return matched.length > 0 ? matched : offers;
  }, [booking, offers]);

  // Identify Best Options across available offers
  const metrics = useMemo(() => {
    const validOffers = bookingOffers.filter((o) => !o.isDeclined);
    const availableOffers = validOffers.filter((o) =>
      o.availability.toLowerCase().includes("available"),
    );

    // 1. Lowest Price
    let lowestPriceOffer: ForwarderOfferCardItem | null = null;
    let minPrice = Infinity;
    for (const o of availableOffers.length > 0 ? availableOffers : validOffers) {
      const price = o.ratePerContainer || (o.totalFreight ? o.totalFreight / o.containerCount : 0);
      if (price > 0 && price < minPrice) {
        minPrice = price;
        lowestPriceOffer = o;
      }
    }

    // 2. Fastest Transit
    let fastestTransitOffer: ForwarderOfferCardItem | null = null;
    let minTransit = Infinity;
    for (const o of availableOffers.length > 0 ? availableOffers : validOffers) {
      if (o.transitDays && o.transitDays > 0 && o.transitDays < minTransit) {
        minTransit = o.transitDays;
        fastestTransitOffer = o;
      }
    }

    // 3. Earliest ETD
    let earliestEtdOffer: ForwarderOfferCardItem | null = null;
    let minEtdTime = Infinity;
    for (const o of availableOffers.length > 0 ? availableOffers : validOffers) {
      if (o.etd && !["Prompt", "Standard transit"].includes(o.etd)) {
        const t = new Date(o.etd).getTime();
        if (!isNaN(t) && t < minEtdTime) {
          minEtdTime = t;
          earliestEtdOffer = o;
        }
      }
    }

    // 4. Fastest Response Turnaround
    let fastestResponseOffer: ForwarderOfferCardItem | null = null;
    let minResponseMin = Infinity;
    for (const o of validOffers) {
      if (
        o.responseTimeMinutes &&
        o.responseTimeMinutes > 0 &&
        o.responseTimeMinutes < minResponseMin
      ) {
        minResponseMin = o.responseTimeMinutes;
        fastestResponseOffer = o;
      }
    }

    const respondedCount = bookingOffers.filter(
      (o) => o.status === "RESPONDED" || o.status === "AWARDED",
    ).length;
    const pendingCount = bookingOffers.filter((o) => o.status === "REQUESTED").length;
    const declinedCount = bookingOffers.filter(
      (o) => o.status === "DECLINED" || o.isDeclined,
    ).length;

    return {
      lowestPriceOfferId: lowestPriceOffer?.id,
      lowestPriceValue: minPrice < Infinity ? minPrice : null,
      fastestTransitOfferId: fastestTransitOffer?.id,
      fastestTransitDays: minTransit < Infinity ? minTransit : null,
      earliestEtdOfferId: earliestEtdOffer?.id,
      earliestEtdFormatted: earliestEtdOffer ? formatShortDate(earliestEtdOffer.etd) : null,
      fastestResponseOfferId: fastestResponseOffer?.id,
      fastestResponseFormatted: fastestResponseOffer?.responseTimeFormatted,
      totalCount: bookingOffers.length,
      respondedCount,
      pendingCount,
      declinedCount,
    };
  }, [bookingOffers]);

  // Compute Multi-Factor Smart Recommendations (Advisory Only — Never Auto-Awarded)
  const recommendations = useMemo(() => {
    return calculateForwarderRecommendations(bookingOffers, booking);
  }, [bookingOffers, booking]);

  // Extract Spotlight Category Winners (Best Price, Fastest, Best Availability, Best Overall)
  const spotlightRecommendations = useMemo(() => {
    let bestOverall: ForwarderOfferCardItem | null = null;
    let bestPrice: ForwarderOfferCardItem | null = null;
    let fastest: ForwarderOfferCardItem | null = null;
    let bestAvailability: ForwarderOfferCardItem | null = null;

    bookingOffers.forEach((o) => {
      const rec = recommendations.get(o.id);
      if (!rec) return;
      if (rec.isBestOverall) bestOverall = o;
      if (rec.isBestPrice) bestPrice = o;
      if (rec.isFastest) fastest = o;
      if (rec.isBestAvailability) bestAvailability = o;
    });

    // Fallbacks if not explicitly flagged
    if (!bestOverall && bookingOffers.length > 0) {
      const sortedByScore = [...bookingOffers].sort(
        (a, b) => (recommendations.get(b.id)?.score || 0) - (recommendations.get(a.id)?.score || 0),
      );
      bestOverall = sortedByScore[0] || null;
    }

    return {
      bestOverall,
      bestPrice,
      fastest,
      bestAvailability,
    };
  }, [bookingOffers, recommendations]);

  // Filter and Sort Offers
  const sortedOffers = useMemo(() => {
    let list = [...bookingOffers];

    // Filter by availability
    if (availabilityFilter === "available-only") {
      list = list.filter(
        (o) => o.availability.toLowerCase().includes("available") && !o.isDeclined,
      );
    } else if (availabilityFilter === "pending-only") {
      list = list.filter((o) => o.status === "REQUESTED");
    }

    // Sort
    list.sort((a, b) => {
      // Awarded always stays on top if already awarded
      if (a.isAwarded && !b.isAwarded) return -1;
      if (!a.isAwarded && b.isAwarded) return 1;

      // Responded before pending
      const aHasRate = Boolean(a.ratePerContainer);
      const bHasRate = Boolean(b.ratePerContainer);
      if (aHasRate && !bHasRate) return -1;
      if (!aHasRate && bHasRate) return 1;

      if (sortBy === "score-desc") {
        const scoreA = recommendations.get(a.id)?.score ?? -1;
        const scoreB = recommendations.get(b.id)?.score ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
      }

      if (sortBy === "price-asc") {
        const priceA = a.ratePerContainer || 999999;
        const priceB = b.ratePerContainer || 999999;
        return priceA - priceB;
      }

      if (sortBy === "transit-asc") {
        const transitA = a.transitDays || 999;
        const transitB = b.transitDays || 999;
        return transitA - transitB;
      }

      if (sortBy === "etd-asc") {
        const timeA = a.etd ? new Date(a.etd).getTime() || 9999999999999 : 9999999999999;
        const timeB = b.etd ? new Date(b.etd).getTime() || 9999999999999 : 9999999999999;
        return timeA - timeB;
      }

      if (sortBy === "response-asc") {
        const respA = a.responseTimeMinutes || 99999;
        const respB = b.responseTimeMinutes || 99999;
        return respA - respB;
      }

      return 0;
    });

    return list;
  }, [bookingOffers, sortBy, availabilityFilter, recommendations]);

  if (!isOpen) return null;

  // Handle explicit award confirmation
  const handleConfirmAward = async () => {
    if (!confirmingAwardOffer) return;
    setIsAwarding(true);
    try {
      if (onAwardOffer) {
        await onAwardOffer(confirmingAwardOffer);
      } else {
        const res = await awardForwarderOfferCard(confirmingAwardOffer, userId);
        toast.success("Forwarder Awarded & Booking Confirmed!", {
          description: res.message,
        });
      }
      setConfirmingAwardOffer(null);
      onRefresh?.();
    } catch (err: unknown) {
      toast.error("Failed to award forwarder", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setIsAwarding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="relative flex max-h-[92vh] w-full max-w-6xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comparison-title"
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-teal-200 bg-[#E8F5F6] text-[#0FA3B1]">
              <Scale className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="comparison-title" className="text-lg font-bold text-slate-900">
                  Multiple Forwarder Comparison
                </h2>
                <span className="rounded-md bg-teal-50 px-2 py-0.5 font-mono text-[11.5px] font-bold text-[#0D919E] border border-teal-200">
                  {booking?.reference || bookingOffers[0]?.movementNumber || "Booking Quotations"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Compare price, availability, transit time, and sailing schedules side-by-side.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Booking Quick Selector if multiple bookings exist */}
            {allBookings.length > 1 && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600">
                <span className="text-slate-400 font-medium">Switch Booking:</span>
                <select
                  value={booking?.id || ""}
                  onChange={(e) => {
                    const found = allBookings.find((b) => b.id === e.target.value);
                    if (found && onSelectBooking) {
                      onSelectBooking(found);
                    }
                  }}
                  aria-label="Select booking to compare"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#0FA3B1] focus:outline-hidden"
                >
                  {allBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.reference} ({b.polCode} → {b.podCode})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRefresh}
                className="h-8 gap-1.5 border-slate-200 text-xs text-slate-600 hover:bg-white"
              >
                <RefreshCw className="size-3.5" />
                <span>Refresh</span>
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="size-8 rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
            >
              <X className="size-4.5" />
            </Button>
          </div>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Booking Context Ribbon */}
          {booking && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6 text-xs">
                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                    Movement Ref
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-900">
                    {booking.reference}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                    Routing (POL → POD)
                  </span>
                  <div className="flex items-center gap-1 font-bold text-slate-800">
                    <span>{booking.polCode}</span>
                    <ArrowRight className="size-3 text-slate-400" />
                    <span>{booking.podCode}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                    Cargo & Equipment
                  </span>
                  <span className="font-semibold text-slate-800">
                    {booking.containerCount}x {booking.containerSize} (
                    {booking.cargo.totalWeightKg.toLocaleString()} kg)
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                    Shipper / Supplier
                  </span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {booking.supplierName}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                    Requested ETD
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatShortDate(booking.requestedEtd)}
                  </span>
                </div>

                <div>
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                    Buyer / Consignee
                  </span>
                  <span className="font-semibold text-slate-800 truncate block">
                    {booking.buyerName}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* SMART RECOMMENDATION — OPTIONAL (Multi-Factor Scoring Engine) */}
          <div className="rounded-2xl border border-teal-200/80 bg-linear-to-b from-[#E8F5F6]/40 via-white to-amber-50/20 p-4.5 shadow-xs">
            {/* Engine Header & Toggles */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-200/70">
              <div className="flex items-start gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-linear-to-br from-[#0FA3B1] to-[#0D919E] text-white shadow-xs">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">
                      Smart Recommendation — Optional
                    </h3>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800 uppercase tracking-wider">
                      Advisory Only
                    </span>
                  </div>
                  <p className="text-[11.5px] text-slate-600 mt-0.5 max-w-2xl leading-relaxed">
                    Evaluates forwarder quotations across 7 criteria: <strong>Price</strong>,{" "}
                    <strong>Availability</strong>, <strong>Required sailing date</strong>,{" "}
                    <strong>ETA</strong>, <strong>Transit time</strong>,{" "}
                    <strong>Additional charges</strong>, and <strong>Response time</strong>.
                  </p>
                </div>
              </div>

              {/* Action Toggles */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFormulaExplainer(!showFormulaExplainer)}
                  className="h-8 gap-1 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <HelpCircle className="size-3.5 text-slate-400" />
                  <span>{showFormulaExplainer ? "Hide Scoring Weights" : "Scoring Weights"}</span>
                  {showFormulaExplainer ? (
                    <ChevronUp className="size-3 text-slate-400" />
                  ) : (
                    <ChevronDown className="size-3 text-slate-400" />
                  )}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const next = !smartRecommendationEnabled;
                    setSmartRecommendationEnabled(next);
                    if (next && sortBy !== "score-desc") {
                      setSortBy("score-desc");
                    }
                  }}
                  className={`h-8 gap-1.5 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                    smartRecommendationEnabled
                      ? "bg-[#0FA3B1] text-white hover:bg-[#0D919E]"
                      : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  <span>
                    {smartRecommendationEnabled ? "Recommendations: ON" : "Recommendations: OFF"}
                  </span>
                </Button>
              </div>
            </div>

            {/* Strict Policy Disclaimer: Recommendations Only, Never Automatically Award */}
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-[11.5px] text-amber-900 leading-relaxed">
              <ShieldCheck className="size-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong>Advisory Policy & Non-Automation Guarantee:</strong> These calculated scores
                are <em>recommendations only</em> to assist authorized operators in evaluating
                options.{" "}
                <span className="font-semibold underline decoration-amber-400 decoration-1 underline-offset-2">
                  The system will NEVER automatically award a forwarder based on the score.
                </span>{" "}
                The final booking award decision must remain with the authorized user via manual
                confirmation.
              </div>
            </div>

            {/* Expandable Scoring Weights Explainer */}
            {showFormulaExplainer && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs animate-in fade-in-50 duration-150">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Algorithmic Scoring Matrix (Weighted Sum: 100 Points Total)
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    Normalized against best benchmark in booking pool
                  </span>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 text-[11px]">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center">
                    <span className="font-bold text-emerald-700 block">25% Price</span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      Base freight rate per container
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center">
                    <span className="font-bold text-[#0FA3B1] block">20% Availability</span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      Confirmed space & equipment
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center">
                    <span className="font-bold text-indigo-700 block">15% Sailing Date</span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      Requested departure match
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center">
                    <span className="font-bold text-purple-700 block">10% ETA</span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      Port arrival timeline
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center">
                    <span className="font-bold text-sky-700 block">10% Transit Time</span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      Shortest ocean voyage
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center">
                    <span className="font-bold text-amber-700 block">10% Surcharges</span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      Additional landed fees
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-2 text-center">
                    <span className="font-bold text-slate-700 block">10% Response</span>
                    <span className="text-slate-500 text-[10px] block mt-0.5">
                      Turnaround speed
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 4 Spotlight Recommendation Cards: Best Overall, Best Price, Fastest, Best Availability */}
            {smartRecommendationEnabled && (
              <div className="mt-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                {/* 1. Best Overall */}
                <div className="rounded-xl border border-amber-200/90 bg-linear-to-b from-amber-50/50 to-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-900 border border-amber-200">
                      🏆 Best Overall
                    </span>
                    {spotlightRecommendations.bestOverall && (
                      <span className="font-mono text-xs font-bold text-amber-800">
                        {recommendations.get(spotlightRecommendations.bestOverall.id)?.score || 0}
                        /100 · {recommendations.get(spotlightRecommendations.bestOverall.id)?.grade}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {spotlightRecommendations.bestOverall?.forwarderName || "Pending Evaluation"}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {spotlightRecommendations.bestOverall
                        ? recommendations.get(spotlightRecommendations.bestOverall.id)
                            ?.summaryText ||
                          "Top composite rating across price, space, and target schedule."
                        : "Requires quotation data from forwarders"}
                    </p>
                  </div>
                  {spotlightRecommendations.bestOverall && (
                    <div className="mt-2 pt-2 border-t border-amber-100/80 flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-semibold text-slate-900">
                        $
                        {spotlightRecommendations.bestOverall.ratePerContainer?.toLocaleString() ||
                          "—"}{" "}
                        USD
                      </span>
                      <span>
                        {spotlightRecommendations.bestOverall.transitDays
                          ? `${spotlightRecommendations.bestOverall.transitDays}d transit`
                          : "Standard"}
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. Best Price */}
                <div className="rounded-xl border border-emerald-200/90 bg-linear-to-b from-emerald-50/50 to-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-bold text-emerald-900 border border-emerald-200">
                      🏷️ Best Price
                    </span>
                    {spotlightRecommendations.bestPrice && (
                      <span className="font-mono text-xs font-bold text-emerald-800">
                        {recommendations.get(spotlightRecommendations.bestPrice.id)?.score || 0}/100
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {spotlightRecommendations.bestPrice?.forwarderName || "Pending Quotes"}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      Lowest total landed freight rate with transparent surcharge disclosure.
                    </p>
                  </div>
                  {spotlightRecommendations.bestPrice && (
                    <div className="mt-2 pt-2 border-t border-emerald-100/80 flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-bold text-emerald-700 text-xs">
                        ${spotlightRecommendations.bestPrice.ratePerContainer?.toLocaleString()} USD
                      </span>
                      <span>
                        {spotlightRecommendations.bestPrice.additionalChargesTotal
                          ? `+$${spotlightRecommendations.bestPrice.additionalChargesTotal} fees`
                          : "All-inclusive"}
                      </span>
                    </div>
                  )}
                </div>

                {/* 3. Fastest */}
                <div className="rounded-xl border border-sky-200/90 bg-linear-to-b from-sky-50/50 to-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10.5px] font-bold text-sky-900 border border-sky-200">
                      ⚡ Fastest
                    </span>
                    {spotlightRecommendations.fastest && (
                      <span className="font-mono text-xs font-bold text-sky-800">
                        {recommendations.get(spotlightRecommendations.fastest.id)?.score || 0}/100
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {spotlightRecommendations.fastest?.forwarderName || "Standard Transit"}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      Shortest ocean transit duration and earliest port of discharge ETA.
                    </p>
                  </div>
                  {spotlightRecommendations.fastest && (
                    <div className="mt-2 pt-2 border-t border-sky-100/80 flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-bold text-sky-700 text-xs">
                        {spotlightRecommendations.fastest.transitDays} Days
                      </span>
                      <span>ETA: {formatShortDate(spotlightRecommendations.fastest.eta)}</span>
                    </div>
                  )}
                </div>

                {/* 4. Best Availability */}
                <div className="rounded-xl border border-teal-200/90 bg-linear-to-b from-teal-50/50 to-white p-3 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10.5px] font-bold text-teal-900 border border-teal-200">
                      ✅ Best Availability
                    </span>
                    {spotlightRecommendations.bestAvailability && (
                      <span className="font-mono text-xs font-bold text-teal-800">
                        {recommendations.get(spotlightRecommendations.bestAvailability.id)?.score ||
                          0}
                        /100
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <h4 className="font-bold text-slate-900 text-sm truncate">
                      {spotlightRecommendations.bestAvailability?.forwarderName || "Space Pending"}
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      Confirmed container equipment and vessel space ready for immediate allocation.
                    </p>
                  </div>
                  {spotlightRecommendations.bestAvailability && (
                    <div className="mt-2 pt-2 border-t border-teal-100/80 flex items-center justify-between text-[11px] text-slate-600">
                      <span className="font-bold text-teal-700 text-xs">
                        {spotlightRecommendations.bestAvailability.availability}
                      </span>
                      <span>
                        ETD: {formatShortDate(spotlightRecommendations.bestAvailability.etd)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Controls Bar: Sort, Filter, View Mode */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Availability filter */}
              <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter("all")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    availabilityFilter === "all"
                      ? "bg-white text-slate-900 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All ({metrics.totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAvailabilityFilter("available-only")}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    availabilityFilter === "available-only"
                      ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Available Space ({metrics.respondedCount})
                </button>
                {metrics.pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setAvailabilityFilter("pending-only")}
                    className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                      availabilityFilter === "pending-only"
                        ? "bg-white text-amber-800 shadow-2xs font-semibold"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Pending ({metrics.pendingCount})
                  </button>
                )}
              </div>

              {/* Sort by dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <SlidersHorizontal className="size-3.5 text-slate-400" />
                <span className="font-medium text-slate-500">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label="Sort offers by"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 shadow-2xs focus:border-[#0FA3B1] focus:outline-hidden"
                >
                  <option value="score-desc">Recommendation Score: Highest First</option>
                  <option value="price-asc">Price: Lowest to Highest</option>
                  <option value="transit-asc">Transit: Fastest First</option>
                  <option value="etd-asc">ETD: Earliest Departure</option>
                  <option value="response-asc">Response: Quickest First</option>
                </select>
              </div>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-all ${
                  viewMode === "cards"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span>Side-by-Side Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-white text-slate-900 shadow-2xs font-semibold"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <TableIcon className="size-3.5" />
                <span>Comparison Matrix</span>
              </button>
            </div>
          </div>

          {/* Main Comparison Area */}
          {sortedOffers.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
              <Ship className="size-8 text-slate-400" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">
                No Forwarder Offers Match Filter
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Adjust your availability filter to view all contacted forwarders.
              </p>
            </div>
          ) : viewMode === "cards" ? (
            /* Cards View */
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedOffers.map((offer) => {
                const rec = recommendations.get(offer.id);
                const isLowestPrice = offer.id === metrics.lowestPriceOfferId && !offer.isDeclined;
                const isFastestTransit =
                  offer.id === metrics.fastestTransitOfferId && !offer.isDeclined;
                const isEarliestEtd = offer.id === metrics.earliestEtdOfferId && !offer.isDeclined;
                const hasRate = Boolean(offer.ratePerContainer);
                const isAwarded = offer.isAwarded || offer.status === "AWARDED";
                const isDeclined = offer.isDeclined || offer.status === "DECLINED";

                return (
                  <div
                    key={offer.id}
                    className={`relative flex flex-col justify-between rounded-xl border bg-white p-4.5 shadow-2xs transition-all ${
                      isAwarded
                        ? "border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/10"
                        : rec?.isBestOverall && smartRecommendationEnabled
                          ? "border-teal-400 ring-1 ring-teal-300"
                          : isLowestPrice
                            ? "border-emerald-300 ring-1 ring-emerald-300"
                            : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    {/* Top Highlight Ribbons */}
                    <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
                      {isAwarded && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          <CheckCircle2 className="size-3" />
                          Awarded & Confirmed
                        </span>
                      )}

                      {/* Smart Recommendation Badges (Optional) */}
                      {smartRecommendationEnabled &&
                        rec &&
                        !isAwarded &&
                        rec.badges.map((b) => (
                          <span
                            key={b.type}
                            title={`${b.label}: ${b.description}`}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${b.bgClass} ${b.colorClass} border ${b.borderClass}`}
                          >
                            <span>{b.icon}</span>
                            <span>{b.label}</span>
                          </span>
                        ))}

                      {/* Standard fallbacks if recommendations toggled off */}
                      {!smartRecommendationEnabled && isLowestPrice && !isAwarded && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                          <TrendingDown className="size-3 text-emerald-600" />
                          Best Price
                        </span>
                      )}
                      {!smartRecommendationEnabled && isFastestTransit && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                          <Zap className="size-3 text-sky-600" />
                          Fastest Transit
                        </span>
                      )}
                      {!smartRecommendationEnabled && isEarliestEtd && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                          <Calendar className="size-3 text-indigo-600" />
                          Earliest ETD
                        </span>
                      )}
                    </div>

                    {/* Forwarder Header */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 leading-tight">
                            {offer.forwarderName}
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500 font-medium">
                            {offer.status === "REQUESTED" ? (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Requested • Awaiting Response
                              </span>
                            ) : isDeclined ? (
                              <span className="text-rose-700">Responded • Declined</span>
                            ) : isAwarded ? (
                              <span className="text-emerald-700 font-semibold">
                                Awarded • Confirmed
                              </span>
                            ) : (
                              <span className="text-teal-700">
                                Responded • {offer.statusSubtext || offer.availability}
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Availability Pill */}
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase ${
                            offer.availability.toLowerCase().includes("available") && !isDeclined
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : isDeclined
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {offer.availability}
                        </span>
                      </div>

                      {/* Smart Recommendation Score & Breakdown Widget (Optional) */}
                      {smartRecommendationEnabled && rec && (
                        <div className="mt-3 rounded-xl border border-teal-100 bg-teal-50/30 p-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="size-3.5 text-[#0FA3B1]" />
                              <span className="text-xs font-bold text-slate-800">Score:</span>
                              <span className="font-mono text-xs font-extrabold text-[#0FA3B1]">
                                {rec.score}/100
                              </span>
                              <span className="rounded bg-teal-100 px-1 py-0.2 text-[9.5px] font-bold text-teal-800">
                                Grade {rec.grade}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedScoreCardId(
                                  expandedScoreCardId === offer.id ? null : offer.id,
                                )
                              }
                              className="text-[11px] font-semibold text-[#0FA3B1] hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                              <span>
                                {expandedScoreCardId === offer.id
                                  ? "Hide Factors"
                                  : "Score Factors"}
                              </span>
                              {expandedScoreCardId === offer.id ? (
                                <ChevronUp className="size-3" />
                              ) : (
                                <ChevronDown className="size-3" />
                              )}
                            </button>
                          </div>

                          {/* Mini score bar */}
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/70">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                rec.score >= 80
                                  ? "bg-[#0FA3B1]"
                                  : rec.score >= 60
                                    ? "bg-amber-500"
                                    : "bg-slate-400"
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, rec.score))}%` }}
                            />
                          </div>

                          <p className="mt-1 text-[10.5px] text-slate-600 italic">
                            {rec.summaryText}
                          </p>

                          {/* Expandable 7-Factor Score Breakdown */}
                          {expandedScoreCardId === offer.id && (
                            <div className="mt-2.5 pt-2 border-t border-teal-100/80 space-y-1.5 animate-in fade-in-50 duration-150">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Weighted Criteria Breakdown:
                              </div>
                              <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[11px]">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Price (25%):</span>
                                  <span className="font-semibold text-slate-800">
                                    {rec.breakdown.priceScore}/100
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Availability (20%):</span>
                                  <span className="font-semibold text-slate-800">
                                    {rec.breakdown.availabilityScore}/100
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Sailing Date (15%):</span>
                                  <span className="font-semibold text-slate-800">
                                    {rec.breakdown.sailingDateScore}/100
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">ETA (10%):</span>
                                  <span className="font-semibold text-slate-800">
                                    {rec.breakdown.etaScore}/100
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Transit Time (10%):</span>
                                  <span className="font-semibold text-slate-800">
                                    {rec.breakdown.transitTimeScore}/100
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Surcharges (10%):</span>
                                  <span className="font-semibold text-slate-800">
                                    {rec.breakdown.additionalChargesScore}/100
                                  </span>
                                </div>
                                <div className="flex justify-between col-span-2">
                                  <span className="text-slate-500">Response Speed (10%):</span>
                                  <span className="font-semibold text-slate-800">
                                    {rec.breakdown.responseTimeScore}/100
                                  </span>
                                </div>
                              </div>

                              {/* Strengths & Cautions */}
                              {(rec.strengths.length > 0 || rec.cautions.length > 0) && (
                                <div className="mt-2 pt-1.5 border-t border-teal-100/60 flex flex-wrap gap-1 text-[10px]">
                                  {rec.strengths.map((s, idx) => (
                                    <span
                                      key={`str-${idx}`}
                                      className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-800 border border-emerald-200/60"
                                    >
                                      ✓ {s}
                                    </span>
                                  ))}
                                  {rec.cautions.map((c, idx) => (
                                    <span
                                      key={`cau-${idx}`}
                                      className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 border border-amber-200/60"
                                    >
                                      ! {c}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Main Commercial Block: Price & Equipment */}
                      <div className="mt-4 rounded-xl bg-slate-50 p-3 border border-slate-100">
                        <div className="flex items-baseline justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Freight Rate
                          </span>
                          <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-slate-700 border border-slate-200">
                            {offer.containerSize || "40HC"}
                          </span>
                        </div>

                        <div className="mt-1 flex items-baseline gap-1.5">
                          {hasRate ? (
                            <>
                              <span className="text-2xl font-black text-slate-900 tracking-tight">
                                ${offer.ratePerContainer?.toLocaleString()}
                              </span>
                              <span className="text-xs font-semibold text-slate-500">
                                {offer.currency || "USD"}
                              </span>
                              {offer.totalFreight &&
                                offer.totalFreight !== offer.ratePerContainer && (
                                  <span className="ml-auto text-xs text-slate-500 font-medium">
                                    Total: ${offer.totalFreight.toLocaleString()}
                                  </span>
                                )}
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-slate-400 italic">
                              Quotation Pending
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Schedule & Transit Details */}
                      <div className="mt-3.5 space-y-2 border-t border-slate-100 pt-3 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">ETD (Departure):</span>
                          <span className="font-bold text-slate-800">
                            {formatShortDate(offer.etd)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">ETA (Arrival):</span>
                          <span className="font-bold text-slate-800">
                            {formatShortDate(offer.eta)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span className="text-slate-400">Transit Duration:</span>
                          <span className="font-bold text-slate-800">
                            {offer.transitDays ? `${offer.transitDays} Days` : "Standard Transit"}
                          </span>
                        </div>

                        {offer.carrier && (
                          <div className="flex items-center justify-between text-slate-600">
                            <span className="text-slate-400">Carrier / Vessel:</span>
                            <span className="font-medium text-slate-800 truncate max-w-[150px]">
                              {offer.carrier} {offer.vesselName ? `(${offer.vesselName})` : ""}
                            </span>
                          </div>
                        )}

                        {/* Additional Charges / Surcharges Breakdown */}
                        <div className="rounded-lg bg-slate-50/80 p-2.5 border border-slate-100/80">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                            <span>Additional Charges:</span>
                            <span>
                              {offer.additionalChargesTotal
                                ? `+$${offer.additionalChargesTotal.toLocaleString()} USD`
                                : "All-Inclusive"}
                            </span>
                          </div>
                          {offer.additionalCharges && offer.additionalCharges.length > 0 ? (
                            <div className="mt-1 space-y-0.5 text-[10.5px] text-slate-500">
                              {offer.additionalCharges.map((ch, i) => (
                                <div key={i} className="flex items-center justify-between">
                                  <span>{ch.item}</span>
                                  <span>
                                    ${ch.amount} {ch.currency}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-0.5 text-[10.5px] text-slate-500">
                              {offer.freeDays
                                ? `${offer.freeDays} Free Days Demurrage included`
                                : "Standard port storage & free time"}
                            </p>
                          )}
                        </div>

                        {/* Response Time */}
                        <div className="flex items-center justify-between text-[11.5px] text-slate-500 pt-1">
                          <span className="text-slate-400">Response Time:</span>
                          <span className="font-medium text-slate-700">
                            {offer.responseTimeFormatted ||
                              formatRelativeTime(offer.responseTimestamp)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action: Manual User Award Decision */}
                    <div className="mt-5 border-t border-slate-100 pt-3">
                      {isAwarded ? (
                        <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 py-2 text-xs font-bold text-emerald-800 border border-emerald-200">
                          <Check className="size-4" />
                          <span>Officially Awarded</span>
                        </div>
                      ) : isDeclined ? (
                        <div className="rounded-lg bg-slate-50 py-2 text-center text-xs font-medium text-slate-400">
                          Space Declined
                        </div>
                      ) : !hasRate ? (
                        <div className="rounded-lg bg-amber-50 py-2 text-center text-xs font-medium text-amber-800 border border-amber-200">
                          Awaiting Quotation Reply
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setConfirmingAwardOffer(offer)}
                          className="w-full h-9 gap-1.5 bg-[#0FA3B1] text-xs font-bold text-white hover:bg-[#0D919E] shadow-xs"
                        >
                          <Award className="size-3.5" />
                          <span>Award Booking</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Comparison Matrix Table View */
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
                    <th className="p-3.5 min-w-[180px] bg-slate-100/70 border-r border-slate-200">
                      Comparison Metric
                    </th>
                    {sortedOffers.map((offer) => {
                      const isAwarded = offer.isAwarded || offer.status === "AWARDED";
                      return (
                        <th
                          key={offer.id}
                          className={`p-3.5 min-w-[200px] border-r border-slate-200 last:border-r-0 ${
                            isAwarded ? "bg-emerald-50/60 text-emerald-950" : ""
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-900">
                              {offer.forwarderName}
                            </span>
                            {isAwarded && (
                              <Badge className="bg-emerald-600 text-[10px] text-white">
                                Awarded
                              </Badge>
                            )}
                          </div>
                          <span className="text-[11px] font-normal text-slate-500">
                            {offer.movementNumber}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {/* Row 0: SMART RECOMMENDATION SCORE & BADGES (OPTIONAL) */}
                  {smartRecommendationEnabled && (
                    <tr className="bg-teal-50/40 font-medium">
                      <td className="p-3.5 font-bold text-teal-950 bg-teal-100/50 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-[#0FA3B1]" />
                          <span>Smart Recommendation</span>
                        </div>
                        <span className="text-[10px] text-teal-700 font-normal block mt-0.5">
                          Multi-factor composite score
                        </span>
                      </td>
                      {sortedOffers.map((offer) => {
                        const rec = recommendations.get(offer.id);
                        if (!rec) {
                          return (
                            <td
                              key={offer.id}
                              className="p-3.5 border-r border-slate-200 last:border-r-0 text-slate-400 italic text-[11px]"
                            >
                              Pending
                            </td>
                          );
                        }

                        return (
                          <td
                            key={offer.id}
                            className={`p-3.5 border-r border-slate-200 last:border-r-0 ${
                              rec.isBestOverall
                                ? "bg-teal-50/80 ring-1 ring-inset ring-teal-300"
                                : ""
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-extrabold text-[#0FA3B1]">
                                  {rec.score}/100
                                </span>
                                <span className="rounded bg-teal-100 px-1 py-0.2 text-[9.5px] font-bold text-teal-800">
                                  Grade {rec.grade}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                {rec.badges.map((b) => (
                                  <span
                                    key={b.type}
                                    className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9.5px] font-bold ${b.bgClass} ${b.colorClass} border ${b.borderClass}`}
                                  >
                                    <span>{b.icon}</span>
                                    <span>{b.label}</span>
                                  </span>
                                ))}
                              </div>

                              <p className="text-[10px] text-slate-600 line-clamp-2 italic">
                                {rec.summaryText}
                              </p>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}

                  {/* Row 1: PRICE */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="size-3.5 text-emerald-600" />
                        <span>PRICE (Ocean Freight)</span>
                      </div>
                    </td>
                    {sortedOffers.map((offer) => {
                      const isLowest = offer.id === metrics.lowestPriceOfferId && !offer.isDeclined;
                      return (
                        <td
                          key={offer.id}
                          className={`p-3.5 border-r border-slate-200 last:border-r-0 ${
                            isLowest ? "bg-emerald-50/50 font-bold text-emerald-900" : ""
                          }`}
                        >
                          {offer.ratePerContainer ? (
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-black text-slate-900">
                                ${offer.ratePerContainer.toLocaleString()}
                              </span>
                              <span className="text-[11px] text-slate-500">{offer.currency}</span>
                              {isLowest && (
                                <span className="ml-1.5 rounded-sm bg-emerald-200/60 px-1 py-0.5 text-[10px] font-bold text-emerald-800">
                                  BEST
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Pending</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 2: AVAILABILITY */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Ship className="size-3.5 text-[#0FA3B1]" />
                        <span>AVAILABILITY</span>
                      </div>
                    </td>
                    {sortedOffers.map((offer) => (
                      <td
                        key={offer.id}
                        className="p-3.5 border-r border-slate-200 last:border-r-0"
                      >
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            offer.availability.toLowerCase().includes("available") &&
                            !offer.isDeclined
                              ? "bg-emerald-100 text-emerald-800"
                              : offer.isDeclined
                                ? "bg-rose-100 text-rose-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {offer.availability}
                        </span>
                      </td>
                    ))}
                  </tr>

                  {/* Row 3: ETD */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-indigo-600" />
                        <span>ETD (Departure Date)</span>
                      </div>
                    </td>
                    {sortedOffers.map((offer) => {
                      const isEarliest =
                        offer.id === metrics.earliestEtdOfferId && !offer.isDeclined;
                      return (
                        <td
                          key={offer.id}
                          className={`p-3.5 border-r border-slate-200 last:border-r-0 ${
                            isEarliest ? "bg-indigo-50/40 font-bold" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">
                              {formatShortDate(offer.etd)}
                            </span>
                            {isEarliest && (
                              <span className="rounded-sm bg-indigo-100 px-1 py-0.2 text-[9.5px] font-bold text-indigo-800">
                                EARLIEST
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 4: ETA */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-slate-500" />
                        <span>ETA (Arrival Date)</span>
                      </div>
                    </td>
                    {sortedOffers.map((offer) => (
                      <td
                        key={offer.id}
                        className="p-3.5 border-r border-slate-200 last:border-r-0 font-medium"
                      >
                        {formatShortDate(offer.eta)}
                      </td>
                    ))}
                  </tr>

                  {/* Row 5: TRANSIT TIME */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Zap className="size-3.5 text-sky-600" />
                        <span>TRANSIT TIME</span>
                      </div>
                    </td>
                    {sortedOffers.map((offer) => {
                      const isFastest =
                        offer.id === metrics.fastestTransitOfferId && !offer.isDeclined;
                      return (
                        <td
                          key={offer.id}
                          className={`p-3.5 border-r border-slate-200 last:border-r-0 ${
                            isFastest ? "bg-sky-50/40 font-bold text-sky-950" : ""
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900">
                              {offer.transitDays ? `${offer.transitDays} Days` : "Standard"}
                            </span>
                            {isFastest && (
                              <span className="rounded-sm bg-sky-100 px-1 py-0.2 text-[9.5px] font-bold text-sky-800">
                                FASTEST
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 6: ADDITIONAL CHARGES */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <FileText className="size-3.5 text-amber-600" />
                        <span>ADDITIONAL CHARGES</span>
                      </div>
                    </td>
                    {sortedOffers.map((offer) => (
                      <td
                        key={offer.id}
                        className="p-3.5 border-r border-slate-200 last:border-r-0"
                      >
                        {offer.additionalCharges && offer.additionalCharges.length > 0 ? (
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-900 block">
                              Total: +${offer.additionalChargesTotal?.toLocaleString()} USD
                            </span>
                            <span className="text-[10.5px] text-slate-500">
                              {offer.additionalCharges
                                .map((c) => `${c.item} ($${c.amount})`)
                                .join(", ")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">
                            All-Inclusive {offer.freeDays ? `· ${offer.freeDays} Free Days` : ""}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 7: RESPONSE TIME */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3.5 text-slate-500" />
                        <span>RESPONSE TIME</span>
                      </div>
                    </td>
                    {sortedOffers.map((offer) => (
                      <td
                        key={offer.id}
                        className="p-3.5 border-r border-slate-200 last:border-r-0 text-slate-700"
                      >
                        {offer.responseTimeFormatted || formatRelativeTime(offer.responseTimestamp)}
                      </td>
                    ))}
                  </tr>

                  {/* Row 8: Carrier & Vessel */}
                  <tr className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-50/60 border-r border-slate-200">
                      Carrier Line & Vessel
                    </td>
                    {sortedOffers.map((offer) => (
                      <td
                        key={offer.id}
                        className="p-3.5 border-r border-slate-200 last:border-r-0 font-medium text-slate-800"
                      >
                        {offer.carrier || "Not specified"}{" "}
                        {offer.vesselName ? `(${offer.vesselName})` : ""}
                      </td>
                    ))}
                  </tr>

                  {/* Row 9: FINAL DECISION ACTION */}
                  <tr className="bg-slate-50 font-medium">
                    <td className="p-3.5 font-bold text-slate-900 bg-slate-100/70 border-r border-slate-200">
                      Authorized Award Action
                    </td>
                    {sortedOffers.map((offer) => {
                      const isAwarded = offer.isAwarded || offer.status === "AWARDED";
                      const isDeclined = offer.isDeclined || offer.status === "DECLINED";
                      const hasRate = Boolean(offer.ratePerContainer);

                      return (
                        <td
                          key={offer.id}
                          className="p-3.5 border-r border-slate-200 last:border-r-0"
                        >
                          {isAwarded ? (
                            <div className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                              <CheckCircle2 className="size-4" />
                              <span>Awarded</span>
                            </div>
                          ) : isDeclined ? (
                            <span className="text-xs text-slate-400">Declined</span>
                          ) : !hasRate ? (
                            <span className="text-xs text-amber-700 font-medium">
                              Awaiting Quote
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => setConfirmingAwardOffer(offer)}
                              className="h-8 gap-1 bg-[#0FA3B1] text-xs font-bold text-white hover:bg-[#0D919E]"
                            >
                              <Award className="size-3.5" />
                              <span>Award</span>
                            </Button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="size-3.5 text-slate-400" />
            <span>
              Comparing {sortedOffers.length} forwarder quotations for booking{" "}
              {booking?.reference || "request"}.
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 border-slate-300 text-slate-700 hover:bg-white"
          >
            Close Comparison
          </Button>
        </div>
      </div>

      {/* Explicit User Confirmation Dialog for Awarding (CRITICAL REQUIREMENT) */}
      {confirmingAwardOffer && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                <Award className="size-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Forwarder Award</h3>
                <p className="text-xs text-slate-500">Manual Authorization Required</p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3.5 text-xs space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500">Booking:</span>
                <span className="font-mono font-bold text-slate-900">
                  {confirmingAwardOffer.movementNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Selected Forwarder:</span>
                <span className="font-bold text-slate-900">
                  {confirmingAwardOffer.forwarderName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ocean Freight Rate:</span>
                <span className="font-bold text-emerald-800">
                  ${confirmingAwardOffer.ratePerContainer?.toLocaleString()}{" "}
                  {confirmingAwardOffer.currency} / {confirmingAwardOffer.containerSize}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sailing Schedule:</span>
                <span className="font-semibold text-slate-800">
                  ETD {formatShortDate(confirmingAwardOffer.etd)} → ETA{" "}
                  {formatShortDate(confirmingAwardOffer.eta)}
                </span>
              </div>
              {confirmingAwardOffer.carrier && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Carrier Line:</span>
                  <span className="font-semibold text-slate-800">
                    {confirmingAwardOffer.carrier}
                  </span>
                </div>
              )}

              {smartRecommendationEnabled &&
                (() => {
                  const rec = recommendations.get(confirmingAwardOffer.id);
                  if (!rec) return null;
                  return (
                    <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-slate-500 flex items-center gap-1">
                        <Sparkles className="size-3 text-[#0FA3B1]" />
                        <span>Smart Recommendation:</span>
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[#0FA3B1]">{rec.score}/100</span>
                        <span className="rounded bg-teal-100 px-1 py-0.2 text-[9.5px] font-bold text-teal-800">
                          Grade {rec.grade}
                        </span>
                      </div>
                    </div>
                  );
                })()}
            </div>

            <div className="rounded-lg bg-amber-50/70 p-3 text-[11.5px] text-amber-800 border border-amber-200/60 leading-relaxed">
              <AlertTriangle className="size-3.5 text-amber-600 inline mr-1 -mt-0.5" />
              <strong>Manual Authorization Policy:</strong> Under system governance, recommendations
              never automate booking decisions. Confirming this action will manually award this
              forwarder, lock in this quotation, mark the booking as <em>Approved & Confirmed</em>,
              and allocate container space.
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isAwarding}
                onClick={() => setConfirmingAwardOffer(null)}
                className="border-slate-300 text-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isAwarding}
                onClick={handleConfirmAward}
                className="bg-[#0FA3B1] font-bold text-white hover:bg-[#0D919E]"
              >
                {isAwarding ? "Awarding..." : "Confirm & Award Booking"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
