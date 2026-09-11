import type { ForwarderOfferCardItem } from "./forwarder-card-service";
import type { BookingRequestRecord } from "@/types/requests";

export type RecommendationBadgeType =
  "BEST_OVERALL" | "BEST_PRICE" | "FASTEST" | "BEST_AVAILABILITY" | "BEST_SCHEDULE";

export interface RecommendationBadgeInfo {
  type: RecommendationBadgeType;
  label: string;
  shortLabel: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  description: string;
}

export interface RecommendationScoreBreakdown {
  priceScore: number; // 0 - 100
  availabilityScore: number; // 0 - 100
  sailingDateScore: number; // 0 - 100 (match with required sailing date)
  etaScore: number; // 0 - 100 (port arrival timing)
  transitTimeScore: number; // 0 - 100 (speed in days)
  additionalChargesScore: number; // 0 - 100 (transparency / minimal fees)
  responseTimeScore: number; // 0 - 100 (speed of response)
  totalWeightedScore: number; // 0 - 100
}

export interface ForwarderRecommendationResult {
  cardId: string;
  forwarderName: string;
  score: number; // 0 - 100
  grade: "A+" | "A" | "B+" | "B" | "C" | "D";
  badges: RecommendationBadgeInfo[];
  breakdown: RecommendationScoreBreakdown;
  strengths: string[];
  cautions: string[];
  summaryText: string;
  isBestOverall: boolean;
  isBestPrice: boolean;
  isFastest: boolean;
  isBestAvailability: boolean;
}

export interface RecommendationWeights {
  price: number; // default 0.25
  availability: number; // default 0.20
  sailingDate: number; // default 0.15
  eta: number; // default 0.10
  transitTime: number; // default 0.10
  additionalCharges: number; // default 0.10
  responseTime: number; // default 0.10
}

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  price: 0.25,
  availability: 0.2,
  sailingDate: 0.15,
  eta: 0.1,
  transitTime: 0.1,
  additionalCharges: 0.1,
  responseTime: 0.1,
};

export const RECOMMENDATION_BADGE_CONFIG: Record<RecommendationBadgeType, RecommendationBadgeInfo> =
  {
    BEST_OVERALL: {
      type: "BEST_OVERALL",
      label: "Best Overall",
      shortLabel: "Top Pick",
      icon: "🏆",
      colorClass: "text-amber-800",
      bgClass: "bg-amber-50",
      borderClass: "border-amber-300",
      description:
        "Highest balanced score across price, availability, transit, and schedule alignment.",
    },
    BEST_PRICE: {
      type: "BEST_PRICE",
      label: "Best Price",
      shortLabel: "Lowest Cost",
      icon: "🏷️",
      colorClass: "text-emerald-800",
      bgClass: "bg-emerald-50",
      borderClass: "border-emerald-300",
      description: "Lowest total ocean freight including declared additional charges.",
    },
    FASTEST: {
      type: "FASTEST",
      label: "Fastest",
      shortLabel: "Quick Transit",
      icon: "⚡",
      colorClass: "text-sky-800",
      bgClass: "bg-sky-50",
      borderClass: "border-sky-300",
      description: "Shortest transit duration and earliest estimated port arrival.",
    },
    BEST_AVAILABILITY: {
      type: "BEST_AVAILABILITY",
      label: "Best Availability",
      shortLabel: "Guaranteed Space",
      icon: "✅",
      colorClass: "text-teal-800",
      bgClass: "bg-teal-50",
      borderClass: "border-teal-300",
      description: "Immediate confirmed equipment and vessel allocation with zero waitlist.",
    },
    BEST_SCHEDULE: {
      type: "BEST_SCHEDULE",
      label: "Best Schedule",
      shortLabel: "Exact Date",
      icon: "📅",
      colorClass: "text-indigo-800",
      bgClass: "bg-indigo-50",
      borderClass: "border-indigo-300",
      description: "Closest departure match to requested sailing date with optimal cut-off buffer.",
    },
  };

/**
 * Calculate the difference in calendar days between two dates
 */
function getDaysDiff(date1Str?: string, date2Str?: string): number | null {
  if (!date1Str || !date2Str) return null;
  const d1 = new Date(date1Str);
  const d2 = new Date(date2Str);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return null;
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Parses timestamp or date string to epoch millis safely
 */
function safeEpoch(dateStr?: string): number | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr).getTime();
  return isNaN(parsed) ? null : parsed;
}

/**
 * Calculate Recommendation Scores for a set of Forwarder Offers
 *
 * Rules:
 * 1. Scoring is strictly advisory / recommendation only.
 * 2. Never automatically awards quotes based on scores.
 * 3. Considers: Price, Availability, Required sailing date, ETA, Transit time, Additional charges, Response time.
 */
export function calculateForwarderRecommendations(
  offers: ForwarderOfferCardItem[],
  booking?: BookingRequestRecord | null,
  customWeights: RecommendationWeights = DEFAULT_RECOMMENDATION_WEIGHTS,
): Map<string, ForwarderRecommendationResult> {
  const results = new Map<string, ForwarderRecommendationResult>();
  if (!offers || offers.length === 0) return results;

  // 1. Gather baseline benchmarks across all candidate offers
  const validOffers = offers.filter((o) => !o.isDeclined && o.status !== "DECLINED");
  const candidateOffers = validOffers.length > 0 ? validOffers : offers;

  // Minimum & Maximum Price (including additional charges if present)
  const priceList: number[] = [];
  const transitList: number[] = [];
  const etaList: number[] = [];
  const additionalChargesList: number[] = [];
  const responseTimeList: number[] = [];

  candidateOffers.forEach((o) => {
    const baseRate =
      o.ratePerContainer ||
      (o.totalFreight && o.containerCount ? o.totalFreight / o.containerCount : 0);
    const addl = o.additionalChargesTotal || 0;
    const totalCost = baseRate > 0 ? baseRate + addl : 0;
    if (totalCost > 0) priceList.push(totalCost);

    if (o.transitDays && o.transitDays > 0) transitList.push(o.transitDays);

    const etaEpoch = safeEpoch(o.eta);
    if (etaEpoch) etaList.push(etaEpoch);

    additionalChargesList.push(addl);

    if (o.responseTimeMinutes && o.responseTimeMinutes > 0) {
      responseTimeList.push(o.responseTimeMinutes);
    }
  });

  const minPrice = priceList.length > 0 ? Math.min(...priceList) : 2000;
  const maxPrice = priceList.length > 0 ? Math.max(...priceList) : 3000;
  const minTransit = transitList.length > 0 ? Math.min(...transitList) : 20;
  const maxTransit = transitList.length > 0 ? Math.max(...transitList) : 35;
  const minEta = etaList.length > 0 ? Math.min(...etaList) : null;
  const maxEta = etaList.length > 0 ? Math.max(...etaList) : null;
  const minResponseTime = responseTimeList.length > 0 ? Math.min(...responseTimeList) : 15;

  const requiredSailingDate =
    booking?.requestedEtd || (booking as unknown as { etd?: string })?.etd || null;

  // 2. Compute individual factor scores for each offer
  const scoredItems: Array<{
    card: ForwarderOfferCardItem;
    breakdown: RecommendationScoreBreakdown;
    effectivePrice: number;
    strengths: string[];
    cautions: string[];
  }> = [];

  candidateOffers.forEach((card) => {
    const strengths: string[] = [];
    const cautions: string[] = [];

    // Factor A: Price Score (0 - 100)
    const baseRate =
      card.ratePerContainer ||
      (card.totalFreight && card.containerCount ? card.totalFreight / card.containerCount : 0);
    const addlCharges = card.additionalChargesTotal || 0;
    const effectivePrice = baseRate > 0 ? baseRate + addlCharges : 0;

    let priceScore = 0;
    if (effectivePrice <= 0) {
      priceScore = 20; // pending quote
      cautions.push("Rate quotation pending");
    } else if (minPrice === maxPrice) {
      priceScore = 95;
      strengths.push(`Competitive rate ($${effectivePrice.toLocaleString()} ${card.currency})`);
    } else {
      // Relative price difference
      const priceGapRatio = (effectivePrice - minPrice) / Math.max(1, maxPrice - minPrice);
      priceScore = Math.max(30, Math.min(100, Math.round(100 - priceGapRatio * 60)));
      if (effectivePrice === minPrice) {
        strengths.push(`Lowest total cost ($${effectivePrice.toLocaleString()} ${card.currency})`);
      } else if (priceGapRatio <= 0.15) {
        strengths.push(
          `Close to lowest market rate ($${effectivePrice.toLocaleString()} ${card.currency})`,
        );
      } else {
        cautions.push(`$${(effectivePrice - minPrice).toLocaleString()} higher than lowest offer`);
      }
    }

    // Factor B: Availability Score (0 - 100)
    let availabilityScore = 50;
    const availText = (card.availability || card.statusSubtext || "").toLowerCase();
    if (card.isDeclined || card.status === "DECLINED") {
      availabilityScore = 0;
      cautions.push("Forwarder declined or unavailable");
    } else if (availText.includes("confirmed") || availText === "available") {
      availabilityScore = 100;
      strengths.push("Confirmed space and container availability");
    } else if (availText.includes("subject to space") || availText.includes("reconfirm")) {
      availabilityScore = 75;
      cautions.push("Availability subject to equipment / vessel confirmation");
    } else if (availText.includes("waitlist")) {
      availabilityScore = 40;
      cautions.push("Waitlisted space; allocation not guaranteed");
    } else if (card.status === "REQUESTED") {
      availabilityScore = 35;
      cautions.push("Awaiting forwarder response");
    } else {
      availabilityScore = 65;
    }

    // Factor C: Required Sailing Date Match Score (0 - 100)
    let sailingDateScore = 75; // neutral if no target provided
    if (requiredSailingDate && card.etd) {
      const daysDiff = getDaysDiff(card.etd, requiredSailingDate);
      if (daysDiff !== null) {
        if (daysDiff === 0) {
          sailingDateScore = 100;
          strengths.push("Exact match with required sailing date");
        } else if (daysDiff <= 2) {
          sailingDateScore = 90;
          strengths.push(
            `Departs within ${daysDiff} day${daysDiff > 1 ? "s" : ""} of target schedule`,
          );
        } else if (daysDiff <= 5) {
          sailingDateScore = 70;
          cautions.push(`${daysDiff} days deviation from required sailing date`);
        } else if (daysDiff <= 10) {
          sailingDateScore = 45;
          cautions.push(`${daysDiff} days difference from required sailing date`);
        } else {
          sailingDateScore = 25;
          cautions.push(`Significant departure date difference (${daysDiff} days)`);
        }
      }
    } else if (card.etd) {
      sailingDateScore = 80;
    }

    // Factor D: ETA Arrival Timing Score (0 - 100)
    let etaScore = 70;
    const etaEpoch = safeEpoch(card.eta);
    if (etaEpoch && minEta && maxEta) {
      if (minEta === maxEta) {
        etaScore = 90;
      } else {
        const etaRatio = (etaEpoch - minEta) / Math.max(1, maxEta - minEta);
        etaScore = Math.max(30, Math.min(100, Math.round(100 - etaRatio * 55)));
        if (etaEpoch === minEta) {
          strengths.push("Earliest arrival at port of destination");
        }
      }
    }

    // Factor E: Transit Time Score (0 - 100)
    let transitTimeScore = 70;
    if (card.transitDays && card.transitDays > 0) {
      if (minTransit === maxTransit) {
        transitTimeScore = 90;
      } else {
        const transitRatio = (card.transitDays - minTransit) / Math.max(1, maxTransit - minTransit);
        transitTimeScore = Math.max(30, Math.min(100, Math.round(100 - transitRatio * 55)));
        if (card.transitDays === minTransit) {
          strengths.push(`Fastest ocean transit (${card.transitDays} days)`);
        } else if (card.transitDays <= minTransit + 3) {
          strengths.push(`Competitive transit time (${card.transitDays} days)`);
        } else {
          cautions.push(`Transit is ${card.transitDays - minTransit} days longer than fastest`);
        }
      }
    }

    // Factor F: Additional Charges Transparency & Amount (0 - 100)
    let additionalChargesScore = 90;
    if (addlCharges === 0) {
      additionalChargesScore = 100;
      strengths.push("Zero additional surcharges reported");
    } else if (baseRate > 0) {
      const surchargeRatio = addlCharges / baseRate;
      if (surchargeRatio <= 0.05) {
        additionalChargesScore = 90;
        strengths.push(`Minimal additional surcharges ($${addlCharges.toLocaleString()})`);
      } else if (surchargeRatio <= 0.15) {
        additionalChargesScore = 75;
        cautions.push(`$${addlCharges.toLocaleString()} additional surcharges noted`);
      } else {
        additionalChargesScore = 50;
        cautions.push(`Significant additional charges ($${addlCharges.toLocaleString()})`);
      }
    }

    // Factor G: Response Time Turnaround (0 - 100)
    let responseTimeScore = 70;
    if (card.responseTimeMinutes && card.responseTimeMinutes > 0) {
      const respMin = card.responseTimeMinutes;
      if (respMin <= 15) {
        responseTimeScore = 100;
        strengths.push(`Rapid quote response (${card.responseTimeFormatted || `${respMin}m`})`);
      } else if (respMin <= 60) {
        responseTimeScore = 90;
        strengths.push(`Fast response turnaround (${card.responseTimeFormatted || `${respMin}m`})`);
      } else if (respMin <= 240) {
        responseTimeScore = 80;
      } else if (respMin <= 1440) {
        responseTimeScore = 65;
      } else {
        responseTimeScore = 45;
        cautions.push("Slower quote response time (>24h)");
      }
    } else if (card.status === "RESPONDED" || card.status === "AWARDED") {
      responseTimeScore = 75;
    } else {
      responseTimeScore = 30;
      cautions.push("Quote response pending");
    }

    // Weighted Total Score Calculation (0 - 100)
    const weights = customWeights;
    const totalWeightedScore = Math.round(
      priceScore * weights.price +
        availabilityScore * weights.availability +
        sailingDateScore * weights.sailingDate +
        etaScore * weights.eta +
        transitTimeScore * weights.transitTime +
        additionalChargesScore * weights.additionalCharges +
        responseTimeScore * weights.responseTime,
    );

    const breakdown: RecommendationScoreBreakdown = {
      priceScore,
      availabilityScore,
      sailingDateScore,
      etaScore,
      transitTimeScore,
      additionalChargesScore,
      responseTimeScore,
      totalWeightedScore,
    };

    scoredItems.push({
      card,
      breakdown,
      effectivePrice,
      strengths,
      cautions,
    });
  });

  // 3. Determine Category Winners (Best Price, Fastest, Best Availability, Best Overall)
  let bestOverallId: string | null = null;
  let highestScore = -1;

  let bestPriceId: string | null = null;
  let lowestEffectiveCost = Infinity;

  let fastestId: string | null = null;
  let shortestTransit = Infinity;

  let bestAvailabilityId: string | null = null;
  let highestAvailScore = -1;

  let bestScheduleId: string | null = null;
  let highestScheduleScore = -1;

  scoredItems.forEach((item) => {
    // Only non-declined, non-zero rate offers can win Best Overall or Best Price
    const isEligible = !item.card.isDeclined && item.card.status !== "DECLINED";

    // Best Overall
    if (isEligible && item.breakdown.totalWeightedScore > highestScore) {
      highestScore = item.breakdown.totalWeightedScore;
      bestOverallId = item.card.id;
    }

    // Best Price
    if (isEligible && item.effectivePrice > 0 && item.effectivePrice < lowestEffectiveCost) {
      lowestEffectiveCost = item.effectivePrice;
      bestPriceId = item.card.id;
    }

    // Fastest
    const transit = item.card.transitDays || Infinity;
    if (isEligible && transit > 0 && transit < shortestTransit) {
      shortestTransit = transit;
      fastestId = item.card.id;
    }

    // Best Availability
    if (isEligible && item.breakdown.availabilityScore > highestAvailScore) {
      highestAvailScore = item.breakdown.availabilityScore;
      bestAvailabilityId = item.card.id;
    }

    // Best Schedule Alignment
    if (isEligible && item.breakdown.sailingDateScore > highestScheduleScore) {
      highestScheduleScore = item.breakdown.sailingDateScore;
      bestScheduleId = item.card.id;
    }
  });

  // 4. Construct Final Recommendation Objects
  scoredItems.forEach((item) => {
    const id = item.card.id;
    const badges: RecommendationBadgeInfo[] = [];

    const isBestOverall = id === bestOverallId && highestScore >= 70;
    const isBestPrice = id === bestPriceId;
    const isFastest = id === fastestId;
    const isBestAvailability = id === bestAvailabilityId && highestAvailScore >= 90;
    const isBestSchedule = id === bestScheduleId && highestScheduleScore >= 90;

    if (isBestOverall) {
      badges.push(RECOMMENDATION_BADGE_CONFIG.BEST_OVERALL);
    }
    if (isBestPrice) {
      badges.push(RECOMMENDATION_BADGE_CONFIG.BEST_PRICE);
    }
    if (isFastest) {
      badges.push(RECOMMENDATION_BADGE_CONFIG.FASTEST);
    }
    if (isBestAvailability && !isBestOverall) {
      badges.push(RECOMMENDATION_BADGE_CONFIG.BEST_AVAILABILITY);
    }
    if (isBestSchedule && !isBestOverall && !badges.some((b) => b.type === "BEST_SCHEDULE")) {
      badges.push(RECOMMENDATION_BADGE_CONFIG.BEST_SCHEDULE);
    }

    // Assign Grade
    const s = item.breakdown.totalWeightedScore;
    let grade: "A+" | "A" | "B+" | "B" | "C" | "D" = "C";
    if (s >= 93) grade = "A+";
    else if (s >= 85) grade = "A";
    else if (s >= 78) grade = "B+";
    else if (s >= 70) grade = "B";
    else if (s >= 55) grade = "C";
    else grade = "D";

    // Summary Text
    let summaryText = "";
    if (isBestOverall) {
      summaryText = `Top recommendation overall (${s}/100) based on balanced price, confirmed space, and reliable schedule.`;
    } else if (isBestPrice) {
      summaryText = `Most economical option with lowest landed freight rate ($${item.effectivePrice.toLocaleString()}).`;
    } else if (isFastest) {
      summaryText = `Fastest transit option (${item.card.transitDays} days) for time-sensitive cargo.`;
    } else if (isBestAvailability) {
      summaryText =
        "Guaranteed container and vessel space ready for immediate booking confirmation.";
    } else if (s >= 75) {
      summaryText = `Competitive candidate with solid ratings across transit and schedule availability.`;
    } else {
      summaryText = `Candidate offer under evaluation with potential trade-offs in rate or scheduling.`;
    }

    results.set(id, {
      cardId: id,
      forwarderName: item.card.forwarderName,
      score: s,
      grade,
      badges,
      breakdown: item.breakdown,
      strengths: item.strengths,
      cautions: item.cautions,
      summaryText,
      isBestOverall,
      isBestPrice,
      isFastest,
      isBestAvailability,
    });
  });

  return results;
}
