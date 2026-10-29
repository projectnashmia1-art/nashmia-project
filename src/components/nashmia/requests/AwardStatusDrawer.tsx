import { memo, useState, useEffect, useCallback, useMemo } from "react";
import {
  X,
  Trophy,
  Ship,
  Calendar,
  DollarSign,
  Clock,
  Sparkles,
  Users,
  CheckCircle2,
  Mail,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Anchor,
  Bot,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { showPillToast } from "@/lib/pill-toast";
import {
  fetchForwarderRequestsForBooking,
  awardForwarderOffer,
  updateForwarderQuotation,
} from "@/lib/multi-forwarder-service";
import { AwardForwarderModal } from "./AwardForwarderModal";
import type { BookingRequestRecord, ForwarderQuoteRequestRecord } from "@/types/requests";

interface AwardStatusDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRequestRecord | null;
  onOpenFullQuotations?: (booking: BookingRequestRecord) => void;
  onAwarded?: () => void;
}

export const AwardStatusDrawer = memo(function AwardStatusDrawer({
  isOpen,
  onClose,
  booking,
  onOpenFullQuotations,
  onAwarded,
}: AwardStatusDrawerProps) {
  const { userId } = useAuth();
  const [forwarderRequests, setForwarderRequests] = useState<ForwarderQuoteRequestRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [awardModalTarget, setAwardModalTarget] = useState<ForwarderQuoteRequestRecord | null>(
    null,
  );

  const loadRequests = useCallback(async () => {
    if (!booking) return;
    setIsLoading(true);
    try {
      const list = await fetchForwarderRequestsForBooking(booking);
      setForwarderRequests(list);
    } catch (err) {
      console.warn("[AwardStatusDrawer] Error fetching forwarder requests:", err);
    } finally {
      setIsLoading(false);
    }
  }, [booking]);

  useEffect(() => {
    if (isOpen && booking) {
      void loadRequests();
    }
  }, [isOpen, booking, loadRequests]);

  // Real-time synchronization
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => {
      void loadRequests();
    };
    window.addEventListener("nashmia_multi_forwarder_updated", handleUpdate);
    window.addEventListener("nashmia_forwarder_offer_received", handleUpdate);
    window.addEventListener("nashmia_booking_awarded", handleUpdate);
    window.addEventListener("nashmia_emails_updated", handleUpdate);

    return () => {
      window.removeEventListener("nashmia_multi_forwarder_updated", handleUpdate);
      window.removeEventListener("nashmia_forwarder_offer_received", handleUpdate);
      window.removeEventListener("nashmia_booking_awarded", handleUpdate);
      window.removeEventListener("nashmia_emails_updated", handleUpdate);
    };
  }, [isOpen, loadRequests]);

  // Quotes with valid rate or offer
  const quotesWithOffers = useMemo(() => {
    return forwarderRequests.filter((r) => {
      const rate = r.offerData?.ratePerContainer || r.ratePerContainer;
      const total = r.offerData?.totalFreight || r.totalFreight;
      return (
        r.status === "OFFER_RECEIVED" ||
        r.status === "AWARDED" ||
        r.status === "ACCEPTED" ||
        (rate !== undefined && rate !== null && rate > 0) ||
        (total !== undefined && total !== null && total > 0)
      );
    });
  }, [forwarderRequests]);

  // Best / Lowest Rate Quotation
  const bestQuote = useMemo(() => {
    if (quotesWithOffers.length === 0) return null;
    const sorted = [...quotesWithOffers].sort((a, b) => {
      const rateA = a.offerData?.ratePerContainer || a.ratePerContainer || 999999;
      const rateB = b.offerData?.ratePerContainer || b.ratePerContainer || 999999;
      return rateA - rateB;
    });
    return sorted[0];
  }, [quotesWithOffers]);

  // Check awarded forwarder
  const awardedQuote = useMemo(() => {
    return forwarderRequests.find((r) => r.status === "AWARDED" || r.status === "ACCEPTED");
  }, [forwarderRequests]);



  const handleConfirmAward = async (requestId: string) => {
    try {
      await awardForwarderOffer(requestId, userId);
      showPillToast.success(
        "Forwarder designated and awarded for this booking.",
        "Forwarder Awarded",
      );
      void loadRequests();
      onAwarded?.();
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Failed to award forwarder",
        "Notice",
      );
    }
  };

  if (!isOpen || !booking) return null;

  const movementNo = booking.movementNumber || booking.bookingReference || booking.reference;
  const isAwarded = Boolean(awardedQuote || booking.status === "Line Allocation");

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200"
      />

      {/* Drawer Container (Smooth Slide-In Right) */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full sm:max-w-md flex-col bg-white border-l border-slate-200 shadow-2xl overflow-hidden animate-in slide-in-from-right duration-250 ease-out"
        role="dialog"
        aria-label="Award Status & Quick Rates Drawer"
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 grid place-items-center">
              <Trophy className="size-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-cyan-300 bg-cyan-950/90 border border-cyan-700/60 rounded px-1.5 py-0.5">
                  {movementNo}
                </span>
                <span className="text-[11px] text-slate-300 font-medium">Award Desk</span>
              </div>
              <h3 className="text-[15px] font-bold text-white tracking-tight mt-0.5">
                Award Status & Fast Quotes
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 grid place-items-center transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* 1. Primary Award Status Banner */}
          <div
            className={`rounded-2xl border p-4 space-y-2.5 transition-all ${
              isAwarded
                ? "border-cyan-300 bg-gradient-to-br from-cyan-50/90 via-teal-50/50 to-white text-cyan-950"
                : quotesWithOffers.length > 0
                  ? "border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-sky-50/40 to-white text-slate-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Current Award State
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  isAwarded
                    ? "bg-cyan-100 text-cyan-900 border-cyan-300"
                    : quotesWithOffers.length > 0
                      ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                      : "bg-slate-200 text-slate-700 border-slate-300"
                }`}
              >
                {isAwarded ? (
                  <>
                    <Trophy className="size-3 text-cyan-700" />
                    AWARDED
                  </>
                ) : quotesWithOffers.length > 0 ? (
                  <>
                    <Sparkles className="size-3 text-emerald-600" />
                    AWAITING AWARD DECISION
                  </>
                ) : (
                  "AWAITING QUOTATIONS"
                )}
              </span>
            </div>

            {isAwarded ? (
              <div>
                <h4 className="text-sm font-extrabold text-cyan-950">
                  {awardedQuote?.forwarderName || booking.forwarderName || "Winning Forwarder"}
                </h4>
                <p className="text-[11.5px] text-cyan-800 mt-0.5">
                  Designated as official forwarder for this booking. Space & carrier scheduling in
                  progress.
                </p>
              </div>
            ) : quotesWithOffers.length > 0 ? (
              <div>
                <h4 className="text-sm font-extrabold text-slate-900">
                  {quotesWithOffers.length} Quotation{quotesWithOffers.length > 1 ? "s" : ""}{" "}
                  Received via Email
                </h4>
                <p className="text-[11.5px] text-slate-600 mt-0.5">
                  Forwarders responded to your RFQ emails. Review rate and ETD below to award.
                </p>
              </div>
            ) : (
              <div>
                <h4 className="text-sm font-bold text-slate-800">
                  No Forwarder Quotes Received Yet
                </h4>
                <p className="text-[11.5px] text-slate-500 mt-0.5">
                  Inquiries sent via Gmail. As soon as a forwarder replies with Rate & ETD, it will
                  automatically populate here.
                </p>
              </div>
            )}
          </div>

          {/* 2. Best / Quick Rate & ETD Highlight Card */}
          {bestQuote && (
            <div className="rounded-2xl border border-[#0FA3B1]/30 bg-gradient-to-br from-sky-50 via-teal-50/50 to-white p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0FA3B1] uppercase tracking-wider">
                  <TrendingDown className="size-3.5" /> Best Competitive Rate
                </span>
                <span className="font-mono text-[10.5px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-200 px-2 py-0.5 rounded-md">
                  Lowest Offer
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-[14px] font-extrabold text-slate-900">
                    {bestQuote.forwarderName}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-medium flex-wrap">
                    <span>{bestQuote.offerData?.carrier || "Direct Line"}</span>
                    <span>•</span>
                    <span>{bestQuote.offerData?.transitDays || 24}d Transit</span>
                    <span>•</span>
                    <span>{bestQuote.offerData?.freeDays || 14}d Free</span>
                  </div>
                </div>

                {/* Chota Sa Rate & ETD */}
                <div className="text-right shrink-0">
                  <div className="text-base font-extrabold text-slate-900 font-mono leading-none">
                    $
                    {(
                      bestQuote.offerData?.ratePerContainer ||
                      bestQuote.ratePerContainer ||
                      0
                    ).toLocaleString()}
                    <span className="text-[10px] font-normal text-slate-500 font-sans ml-1">
                      /cntr
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-100/80 border border-teal-200 text-teal-900 font-mono text-[11px] font-bold mt-1.5">
                    <Calendar className="size-3 text-teal-700" />
                    ETD: {bestQuote.offerData?.etd || booking.requestedEtd || "Prompt"}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              {!isAwarded && (
                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setAwardModalTarget(bestQuote)}
                    className="h-7.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1 shadow-2xs cursor-pointer"
                  >
                    <CheckCircle2 className="size-3" />
                    <span>Award This Rate</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 3. All Forwarder Rate & ETD List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-slate-700">
              <span className="font-bold text-[12px] flex items-center gap-1.5">
                <Users className="size-3.5 text-[#0FA3B1]" />
                All Contacted Forwarders ({forwarderRequests.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  disabled={isLoading}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RefreshCw
                    className={`size-3 ${isLoading ? "animate-spin text-[#0FA3B1]" : ""}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {forwarderRequests.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center text-slate-500 text-xs">
                No RFQs dispatched yet for this booking.
              </div>
            ) : (
              <div className="space-y-2">
                {forwarderRequests.map((fwd) => {
                  const rate = fwd.offerData?.ratePerContainer || fwd.ratePerContainer;
                  const etd = fwd.offerData?.etd;
                  const isThisAwarded = fwd.status === "AWARDED" || fwd.status === "ACCEPTED";

                  return (
                    <div
                      key={fwd.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isThisAwarded
                          ? "border-cyan-300 bg-cyan-50/60 shadow-2xs"
                          : rate
                            ? "border-slate-200/90 bg-white hover:border-[#0FA3B1]/40 shadow-2xs"
                            : "border-slate-200/70 bg-slate-50/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 truncate text-xs">
                              {fwd.forwarderName}
                            </span>
                            {isThisAwarded && (
                              <span className="rounded bg-cyan-100 text-cyan-900 border border-cyan-300 px-1.5 py-0.2 text-[9.5px] font-bold">
                                AWARDED
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] text-slate-500 truncate block">
                            {fwd.forwarderEmail}
                          </span>
                        </div>

                        {/* Rate & ETD Snippet */}
                        <div className="text-right shrink-0">
                          {rate ? (
                            <div>
                              <span className="font-bold font-mono text-slate-900 text-[13px]">
                                ${rate.toLocaleString()}{" "}
                                <span className="text-[10px] font-normal text-slate-500 font-sans">
                                  {fwd.offerData?.currency || "USD"}
                                </span>
                              </span>
                              <div className="text-[10.5px] font-semibold text-teal-800 font-mono mt-0.5">
                                ETD: {etd || booking.requestedEtd || "Prompt"}
                              </div>
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                              Awaiting Email
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Small Bottom Controls */}
                      {rate && !isThisAwarded && !isAwarded && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => setAwardModalTarget(fwd)}
                            className="h-6.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                          >
                            Award
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: Full Comparison Modal Opener */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-2 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onClose();
              onOpenFullQuotations?.(booking);
            }}
            className="flex-1 h-9 bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
          >
            <Users className="size-3.5" />
            <span>Open Full Quotation Comparison Modal</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 px-3 border-slate-200 text-slate-700 hover:bg-white text-xs cursor-pointer"
          >
            Close
          </Button>
        </div>
      </aside>

      {/* Atomic Award Forwarder Modal */}
      {awardModalTarget && (
        <AwardForwarderModal
          isOpen={Boolean(awardModalTarget)}
          onClose={() => setAwardModalTarget(null)}
          bookingRequest={booking}
          forwarderRequest={awardModalTarget}
          onConfirmAward={handleConfirmAward}
        />
      )}
    </>
  );
});
