import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Ship,
  CheckCircle2,
  Clock,
  Calendar,
  DollarSign,
  MapPin,
  Building2,
  Mail,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Package,
} from "lucide-react";
import {
  formatShortDate,
  formatRelativeTime,
  type ForwarderOfferCardItem,
} from "@/lib/forwarder-card-service";

interface ForwarderOfferDetailModalProps {
  card: ForwarderOfferCardItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAward: (card: ForwarderOfferCardItem) => void;
  isAwarding?: boolean;
}

export const ForwarderOfferDetailModal = memo(function ForwarderOfferDetailModal({
  card,
  isOpen,
  onClose,
  onAward,
  isAwarding = false,
}: ForwarderOfferDetailModalProps) {
  if (!card) return null;

  const isAwarded = card.isAwarded || card.status === "AWARDED";
  const hasRate = card.ratePerContainer !== undefined && card.ratePerContainer !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl rounded-2xl p-6 sm:max-w-2xl bg-white border-slate-200">
        <DialogHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                {card.forwarderName}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-500 mt-0.5">
                Quotation & Equipment Specification for Movement {card.movementNumber}
              </DialogDescription>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                isAwarded
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : card.statusSubtext === "Available"
                    ? "bg-teal-50 text-teal-800 border-teal-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {isAwarded ? "Booking Confirmed" : card.statusSubtext}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Rate & Commercial Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 p-4 border border-slate-100">
            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                Rate / Cntr
              </span>
              <span className="text-xl font-extrabold text-slate-900">
                {hasRate ? `$${card.ratePerContainer?.toLocaleString()}` : "Pending"}
              </span>
              <span className="text-xs text-slate-500 ml-1">{card.currency}</span>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                Total Freight
              </span>
              <span className="text-xl font-extrabold text-[#0FA3B1]">
                {card.totalFreight
                  ? `$${card.totalFreight.toLocaleString()}`
                  : hasRate
                    ? `$${((card.ratePerContainer || 0) * card.containerCount).toLocaleString()}`
                    : "N/A"}
              </span>
              <span className="text-xs text-slate-500 ml-1">{card.currency}</span>
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                Equipment
              </span>
              <span className="text-base font-bold text-slate-800">
                {card.containerCount}x {card.containerSize}
              </span>
              {card.containerType && (
                <span className="text-[11px] text-slate-500 block">{card.containerType}</span>
              )}
            </div>

            <div>
              <span className="text-[11px] font-semibold uppercase text-slate-400 block">
                Availability
              </span>
              <span
                className={`text-base font-bold ${
                  card.availability.toLowerCase().includes("available")
                    ? "text-emerald-700"
                    : "text-slate-800"
                }`}
              >
                {card.availability}
              </span>
              <span className="text-[11px] text-slate-400 block">
                {formatRelativeTime(card.responseTimestamp)}
              </span>
            </div>
          </div>

          {/* Schedule & Port Routing */}
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 bg-white">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Sailing Schedule & Transit
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400 block">Estimated Departure (ETD)</span>
                <span className="font-semibold text-slate-800">{formatShortDate(card.etd)}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Estimated Arrival (ETA)</span>
                <span className="font-semibold text-slate-800">{formatShortDate(card.eta)}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Estimated Transit</span>
                <span className="font-semibold text-slate-800">
                  {card.transitDays ? `${card.transitDays} days` : "Not specified"}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Demurrage / Free Days</span>
                <span className="font-semibold text-slate-800">
                  {card.freeDays ? `${card.freeDays} days destination` : "Standard carrier terms"}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Carrier / Shipping Line</span>
                <span className="font-semibold text-slate-800">
                  {card.carrier || "Carrier allocation pending"}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block">Vessel & Voyage</span>
                <span className="font-semibold text-slate-800">
                  {card.vesselName ? `${card.vesselName} ${card.voyageNumber || ""}` : "TBN"}
                </span>
              </div>
            </div>

            {(card.polCode || card.podCode) && (
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                <MapPin className="size-4 text-[#0FA3B1]" />
                <span className="font-medium text-slate-500">Routing:</span>
                <strong className="text-slate-800">{card.polCode || "POL"}</strong>
                <ArrowRight className="size-3 text-slate-400" />
                <strong className="text-slate-800">{card.podCode || "POD"}</strong>
              </div>
            )}
          </div>

          {/* AI Extraction & Summary */}
          {card.summary && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 text-xs text-indigo-950">
              <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-1">
                <Sparkles className="size-3.5 text-indigo-600" />
                Forwarder Response Summary
              </div>
              <p className="leading-relaxed text-slate-700">{card.summary}</p>
            </div>
          )}

          {/* Contact Details */}
          {card.forwarderEmail && (
            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span>Contact: {card.forwarderEmail}</span>
              <span>Ref: {card.movementNumber}</span>
            </div>
          )}
        </div>

        <DialogFooter className="mt-2 border-t border-slate-100 pt-4 flex sm:justify-between items-center">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
            Close
          </Button>

          {isAwarded ? (
            <Button
              type="button"
              disabled
              className="rounded-xl bg-emerald-600 text-white gap-1.5 cursor-default"
            >
              <CheckCircle2 className="size-4" />
              Booking Confirmed
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                onAward(card);
                onClose();
              }}
              disabled={isAwarding || card.isDeclined}
              className="rounded-xl bg-[#0FA3B1] hover:bg-[#0D919E] text-white gap-1.5 font-semibold"
            >
              <CheckCircle2 className="size-4" />
              {isAwarding ? "Awarding..." : "Award Booking"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
