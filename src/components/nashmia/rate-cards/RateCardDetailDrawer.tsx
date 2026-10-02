import React from "react";
import {
  X,
  Building2,
  MapPin,
  DollarSign,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  Receipt,
  Share2,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import type { FullRateCardRecord } from "@/types/rate-card.types";

interface RateCardDetailDrawerProps {
  card: FullRateCardRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (card: FullRateCardRecord) => void;
  onDelete: (id: string, name: string) => void;
}

export function RateCardDetailDrawer({
  card,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: RateCardDetailDrawerProps) {
  if (!isOpen || !card) return null;

  const forwarderName =
    card.forwarders?.company_name || card.forwarders?.contact_person || "Unassigned Forwarder";
  const forwarderCode = card.forwarders?.code;
  const forwarderBadge = card.forwarders?.badge || "Booking Agent";
  const pickupLocation = card.load_point || card.origin || "Pickup Point";
  const rateVal = card.base_rate || card.rate || 0;
  const currency = card.currency || "USD";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="glass-card-strong relative flex max-h-[92vh] w-full max-w-lg flex-col rounded-[28px] border border-white/90 bg-white p-0 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        {/* Header */}
        <div className="relative border-b border-slate-100/90 bg-gradient-to-r from-slate-50/90 via-white to-[#E8F1F3]/40 p-5 sm:p-6 pb-4 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl border border-[#6A80A9]/25 bg-white text-[#6A80A9] shadow-sm">
                <Receipt className="size-6" />
              </div>
              <div>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#6A80A9]/10 px-2.5 py-0.5 text-[10.5px] font-bold text-[#6A80A9]">
                  RATE CARD DETAILS
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">
                  {pickupLocation}
                </h2>
                <p className="text-xs text-slate-500 font-medium">{forwarderName}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Content Body: 3 Core Highlights */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 scrollbar-thin">
          {/* Rate Banner */}
          <div className="rounded-2xl border border-[#6A80A9]/20 bg-[#E8F1F3]/40 p-5 text-center shadow-2xs">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Agreed Freight Rate
            </span>
            <div className="mt-1 flex items-baseline justify-center gap-1.5">
              <span className="font-mono text-[34px] font-extrabold text-slate-900">
                {currency === "USD"
                  ? "$"
                  : currency === "GBP"
                    ? "£"
                    : currency === "EUR"
                      ? "€"
                      : `${currency} `}
                {rateVal.toLocaleString()}
              </span>
              <span className="font-mono text-sm font-bold text-[#6A80A9]">
                {currency} / Container
              </span>
            </div>
          </div>

          {/* 1. Pickup Point Info */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <MapPin className="size-4 text-[#6A80A9]" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Pickup Point / Loading Point
              </span>
            </div>
            <p className="text-base font-bold text-slate-900 pl-6">{pickupLocation}</p>
          </div>

          {/* 2. Forwarder Info */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1.5">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-[#6A80A9]" />
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Freight Forwarder
              </span>
            </div>
            <div className="pl-6">
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-slate-900">{forwarderName}</span>
                {forwarderCode && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                    {forwarderCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{forwarderBadge}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              onDelete(card.id, `${pickupLocation} - ${forwarderName}`);
              onClose();
            }}
            className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <Trash2 className="size-3.5" />
            <span>Delete Rate</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onEdit(card);
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Edit2 className="size-3.5" />
              <span>Edit</span>
            </button>

            <Link
              to="/new-booking"
              search={{ bookingAgentId: card.forwarder_id }}
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Use In Booking</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
