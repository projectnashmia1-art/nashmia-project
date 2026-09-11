import React, { useState } from "react";
import {
  Award,
  ShieldCheck,
  Calendar,
  Ship,
  Clock,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  Container,
  Anchor,
  FileCheck,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { formatShortDate, type ForwarderOfferCardItem } from "@/lib/forwarder-card-service";

export interface AwardConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  card: ForwarderOfferCardItem | null;
  onConfirmAward: (
    card: ForwarderOfferCardItem,
    options?: { confirmImmediatelyIfExplicit?: boolean; confirmationNotes?: string },
  ) => Promise<void>;
  isAwarding?: boolean;
}

export const AwardConfirmationModal: React.FC<AwardConfirmationModalProps> = ({
  isOpen,
  onClose,
  card,
  onConfirmAward,
  isAwarding = false,
}) => {
  const { profile, user } = useAuth();
  const [confirmExplicit, setConfirmExplicit] = useState(true);
  const [notes, setNotes] = useState("");

  if (!isOpen || !card) return null;

  const rate = card.ratePerContainer || 0;
  const count = card.containerCount || 1;
  const total = card.totalFreight || rate * count;
  const currency = card.currency || "USD";
  const forwarderName = card.forwarderName || "Forwarder";
  const movementRef = card.movementNumber || "MOV-REQ";
  const userDisplayName =
    profile?.full_name || user?.email?.split("@")[0] || "Authorized Operations Specialist";

  const handleConfirm = async () => {
    await onConfirmAward(card, {
      confirmImmediatelyIfExplicit: true,
      confirmationNotes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={() => !isAwarding && onClose()}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-slate-50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 shadow-2xs">
              <Award className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Award Booking to Forwarder</h2>
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700"
                >
                  Official Assignment
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Movement <span className="font-semibold text-slate-700">{movementRef}</span> •
                Manual Operations Authorization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isAwarding}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-5 text-slate-700">
          {/* Forwarder Name & Header summary */}
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900">{forwarderName}</span>
                {card.forwarderEmail && (
                  <span className="text-xs text-slate-500">({card.forwarderEmail})</span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                {card.carrier && (
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <Ship className="size-3.5 text-slate-400" /> Carrier: {card.carrier}
                  </span>
                )}
                {card.vesselName && (
                  <span className="inline-flex items-center gap-1">
                    <Anchor className="size-3.5 text-slate-400" /> {card.vesselName}{" "}
                    {card.voyageNumber ? `(${card.voyageNumber})` : ""}
                  </span>
                )}
                {card.responseTimeFormatted && (
                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Clock className="size-3.5 text-slate-400" /> Responded:{" "}
                    {card.responseTimeFormatted}
                  </span>
                )}
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Commercials
              </span>
              <div className="text-2xl font-black tracking-tight text-emerald-700">
                {currency} {rate.toLocaleString()}
                <span className="text-xs font-normal text-slate-500">
                  {" "}
                  / {card.containerSize || "40HC"}
                </span>
              </div>
              <div className="text-xs font-medium text-slate-600">
                Total Freight: {currency} {total.toLocaleString()} ({count} container
                {count > 1 ? "s" : ""})
              </div>
            </div>
          </div>

          {/* Actual Offer Breakdown Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Availability */}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[11px] font-medium uppercase text-slate-400">Availability</span>
              <div className="mt-1 flex items-center gap-1.5 font-semibold text-slate-800">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span className="truncate text-xs">{card.availability || "Space Available"}</span>
              </div>
            </div>

            {/* Sailing Dates (ETD / ETA) */}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[11px] font-medium uppercase text-slate-400">ETD / ETA</span>
              <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-800">
                <Calendar className="size-4 shrink-0 text-slate-400" />
                <span className="truncate">
                  {formatShortDate(card.etd)} → {formatShortDate(card.eta)}
                </span>
              </div>
            </div>

            {/* Transit Days */}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[11px] font-medium uppercase text-slate-400">Transit Time</span>
              <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-800">
                <Clock className="size-4 shrink-0 text-slate-400" />
                <span>{card.transitDays ? `${card.transitDays} days` : "Standard"}</span>
              </div>
            </div>

            {/* Free Days */}
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <span className="text-[11px] font-medium uppercase text-slate-400">Free Days</span>
              <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-slate-800">
                <FileCheck className="size-4 shrink-0 text-slate-400" />
                <span>{card.freeDays || 14} days (D&D)</span>
              </div>
            </div>
          </div>

          {/* Additional Charges breakdown if present */}
          {card.additionalCharges && card.additionalCharges.length > 0 && (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3.5">
              <span className="text-xs font-bold text-amber-900">
                Additional Surcharges & Fees ({card.additionalCharges.length})
              </span>
              <div className="mt-2 space-y-1.5">
                {card.additionalCharges.map((chg, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-amber-950">
                    <span>{chg.chargeName || chg.description}</span>
                    <span className="font-semibold">
                      {chg.currency || currency} {Number(chg.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Critical Governance Policy Box */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-700" />
              <div className="space-y-1.5">
                <span className="font-bold text-blue-950">System Award & Confirmation Rules</span>
                <ul className="space-y-1 list-disc pl-4 text-blue-900">
                  <li>
                    <strong>Official Forwarder:</strong> {forwarderName} will become the designated
                    partner on booking {movementRef}.
                  </li>
                  <li>
                    <strong>Automatic Approval & Confirmation:</strong> On <em>All Requests</em>,
                    the booking card with reference{" "}
                    <span className="font-semibold text-blue-950 font-mono">{movementRef}</span>{" "}
                    will automatically transition to <strong>Approved & Confirmed</strong>.
                  </li>
                  <li>
                    <strong>Competing Offers Removed:</strong> All competing forwarder quotes with
                    reference{" "}
                    <span className="font-semibold text-blue-950 font-mono">{movementRef}</span>{" "}
                    will automatically be removed from the forwarder offers list.
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Immediate Confirmation Option if offer confirmed */}
          {card.isConfirmed && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <div>
                <strong>Explicit Space Confirmation Detected:</strong> {forwarderName}&apos;s
                quotation email already provided official space allocation. Awarding will
                automatically transition this movement to <strong>CONFIRMED</strong> immediately.
              </div>
            </div>
          )}

          {/* Authorizing User Badge */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
            <span>Authorizing User:</span>
            <span className="font-semibold text-slate-700">{userDisplayName}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/90 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isAwarding}
            className="border-slate-300 text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isAwarding}
            className="bg-emerald-600 px-6 font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
          >
            {isAwarding ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Awarding & Updating...
              </>
            ) : (
              <>
                <Award className="mr-2 size-4" />
                Confirm Award to {forwarderName}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
