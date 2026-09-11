import { useState, useMemo, memo } from "react";
import {
  Ship,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Plus,
  ArrowUpDown,
  X,
  Scale,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ForwarderOfferCard } from "./ForwarderOfferCard";
import type { ForwarderOfferCardItem } from "@/lib/forwarder-card-service";
import {
  normalizeMovementReference,
  normalizeForwarderIdentity,
  mergeForwarderOfferCards,
  upsertForwarderCard,
} from "@/lib/forwarder-card-service";
import { calculateForwarderRecommendations } from "@/lib/forwarder-recommendation-service";

interface ForwarderOfferCardsGridProps {
  cards: ForwarderOfferCardItem[];
  isLoading?: boolean;
  onViewDetails: (card: ForwarderOfferCardItem) => void;
  onAward: (card: ForwarderOfferCardItem) => void;
  onCompare?: (card: ForwarderOfferCardItem) => void;
  onCompareBooking?: (movementNumberOrBookingId: string) => void;
  onRequestQuotes?: () => void;
  onRefresh?: () => void;
  awardingCardId?: string | null;
}

export const ForwarderOfferCardsGrid = memo(function ForwarderOfferCardsGrid({
  cards,
  isLoading = false,
  onViewDetails,
  onAward,
  onCompare,
  onCompareBooking,
  onRequestQuotes,
  onRefresh,
  awardingCardId,
}: ForwarderOfferCardsGridProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "rate-asc" | "rate-desc" | "forwarder">("newest");

  // Filtered, deduplicated, and sorted cards
  const dedupedCards = useMemo(() => {
    const map = new Map<string, ForwarderOfferCardItem>();
    for (const card of cards) {
      upsertForwarderCard(map, card);
    }
    return Array.from(map.values());
  }, [cards]);

  const filteredCards = useMemo(() => {
    return dedupedCards
      .filter((card) => {
        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase().trim();
          const matchName = card.forwarderName.toLowerCase().includes(q);
          const matchMovement = card.movementNumber.toLowerCase().includes(q);
          const matchCarrier = card.carrier?.toLowerCase().includes(q) || false;
          const matchPol = card.polCode?.toLowerCase().includes(q) || false;
          const matchPod = card.podCode?.toLowerCase().includes(q) || false;
          if (!matchName && !matchMovement && !matchCarrier && !matchPol && !matchPod) {
            return false;
          }
        }

        // Status filter
        if (statusFilter !== "All") {
          if (
            statusFilter === "Available" &&
            !card.availability.toLowerCase().includes("available")
          ) {
            return false;
          }
          if (statusFilter === "Awarded" && !card.isAwarded) {
            return false;
          }
          if (statusFilter === "Requested" && card.status !== "REQUESTED") {
            return false;
          }
          if (statusFilter === "Declined" && !card.isDeclined) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rate-asc") {
          const rateA = a.ratePerContainer ?? 999999;
          const rateB = b.ratePerContainer ?? 999999;
          return rateA - rateB;
        }
        if (sortBy === "rate-desc") {
          const rateA = a.ratePerContainer ?? 0;
          const rateB = b.ratePerContainer ?? 0;
          return rateB - rateA;
        }
        if (sortBy === "forwarder") {
          return a.forwarderName.localeCompare(b.forwarderName);
        }
        // Default newest first
        const timeA = new Date(a.responseTimestamp).getTime() || 0;
        const timeB = new Date(b.responseTimestamp).getTime() || 0;
        return timeB - timeA;
      });
  }, [dedupedCards, search, statusFilter, sortBy]);

  // Status counts based on deduplicated cards
  const availableCount = useMemo(
    () =>
      dedupedCards.filter(
        (c) => c.availability.toLowerCase().includes("available") && !c.isDeclined,
      ).length,
    [dedupedCards],
  );
  const awardedCount = useMemo(
    () => dedupedCards.filter((c) => c.isAwarded).length,
    [dedupedCards],
  );

  // Compute Smart Recommendations (Advisory Only)
  const recommendations = useMemo(
    () => calculateForwarderRecommendations(dedupedCards),
    [dedupedCards],
  );

  return (
    <div className="space-y-4">
      {/* Search & Sub-Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Search forwarder name, movement #, carrier, port..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9.5 pl-9.5 pr-8 text-[13px] border-slate-200 bg-white placeholder:text-slate-400 focus-visible:ring-[#0FA3B1] rounded-xl"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Quick Filter */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("All")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                statusFilter === "All"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({cards.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Available")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                statusFilter === "Available"
                  ? "bg-white text-emerald-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Available ({availableCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("Awarded")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-all ${
                statusFilter === "Awarded"
                  ? "bg-white text-emerald-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Awarded ({awardedCount})
            </button>
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="h-9.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-xs focus:border-[#0FA3B1] focus:outline-none"
          >
            <option value="newest">Newest Response</option>
            <option value="rate-asc">Lowest Rate First</option>
            <option value="rate-desc">Highest Rate First</option>
            <option value="forwarder">Forwarder Name (A-Z)</option>
          </select>

          {onCompareBooking && cards.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const firstMovement = cards[0]?.movementNumber || cards[0]?.bookingId;
                if (firstMovement) onCompareBooking(firstMovement);
              }}
              className="h-9.5 rounded-xl border-teal-200 bg-[#E8F5F6]/60 text-xs font-semibold text-[#0FA3B1] hover:bg-[#E8F5F6] gap-1.5 shadow-xs"
            >
              <Scale className="size-3.5" />
              <span>Compare Offers</span>
            </Button>
          )}

          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="h-9.5 px-2.5 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50"
              title="Refresh forwarder offers from Supabase"
            >
              <RefreshCw className="size-3.5" />
            </Button>
          )}

          {onRequestQuotes && (
            <Button
              type="button"
              size="sm"
              onClick={onRequestQuotes}
              className="h-9.5 rounded-xl bg-[#0FA3B1] text-xs font-semibold text-white hover:bg-[#0D919E] gap-1.5 shadow-xs"
            >
              <Plus className="size-3.5" />
              Request Quotes
            </Button>
          )}
        </div>
      </div>

      {/* Grid of Dynamic Forwarder Cards */}
      {filteredCards.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCards.map((card) => (
            <ForwarderOfferCard
              key={card.id}
              card={card}
              onViewDetails={onViewDetails}
              onAward={onAward}
              onCompare={onCompare}
              isAwarding={awardingCardId === card.id}
              recommendation={recommendations.get(card.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
          <div className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-xs">
            <Ship className="size-6 text-[#0FA3B1]" />
          </div>
          <h3 className="mt-4 text-[16px] font-bold text-slate-900">
            {cards.length === 0 ? "No Forwarder Offers Yet" : "No Offers Match Filter"}
          </h3>
          <p className="mt-1.5 max-w-md text-[13px] text-slate-500">
            {cards.length === 0
              ? "When a forwarder responds via email, their offer card is automatically created or updated here dynamically from Supabase. You can also dispatch quote requests to forwarders."
              : "Try adjusting your search query or status filter to view other forwarder offer cards."}
          </p>

          {onRequestQuotes && cards.length === 0 && (
            <Button
              type="button"
              size="sm"
              onClick={onRequestQuotes}
              className="mt-5 h-9 rounded-xl bg-[#0FA3B1] text-xs font-semibold text-white hover:bg-[#0D919E] gap-1.5 shadow-xs"
            >
              <Users className="size-3.5" />
              Request Forwarder Quotes
            </Button>
          )}
        </div>
      )}
    </div>
  );
});
