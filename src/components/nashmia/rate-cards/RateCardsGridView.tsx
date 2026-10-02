import React from "react";
import {
  Building2,
  MapPin,
  DollarSign,
  Edit2,
  Trash2,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FullRateCardRecord } from "@/types/rate-card.types";

interface RateCardsGridViewProps {
  rateCards: FullRateCardRecord[];
  onViewDetails: (card: FullRateCardRecord) => void;
  onEdit: (card: FullRateCardRecord) => void;
  onDelete: (id: string, name: string) => void;
  onAddRateCard: () => void;
}

export function RateCardsGridView({
  rateCards,
  onViewDetails,
  onEdit,
  onDelete,
  onAddRateCard,
}: RateCardsGridViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Quick Add Card */}
      <button
        type="button"
        onClick={onAddRateCard}
        className="group relative flex min-h-[260px] w-full flex-col justify-between overflow-hidden rounded-[28px] border border-dashed border-[#6A80A9]/30 bg-white/70 p-6 text-left shadow-xs backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#6A80A9] hover:bg-white hover:shadow-[0_20px_45px_rgba(106,128,169,0.12)] cursor-pointer"
      >
        <div>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#E8F1F3] text-[#6A80A9] shadow-2xs group-hover:scale-105 transition-transform">
            <Plus className="size-6 stroke-[2.5]" />
          </div>
          <h3 className="mt-4 text-[18px] font-bold text-slate-900 group-hover:text-[#6A80A9] transition-colors">
            + Add Rate Card
          </h3>
          <p className="mt-1 text-xs text-slate-500 leading-relaxed">
            Register forwarder pricing for a pickup location or loading point.
          </p>
        </div>

        <div className="mt-4 rounded-xl bg-black py-2.5 px-4 text-center text-xs font-bold text-white shadow-xs group-hover:bg-slate-800 transition-colors">
          Create Rate Entry
        </div>
      </button>

      {/* Rate Card Items */}
      {rateCards.map((card) => {
        const forwarderName =
          card.forwarders?.company_name ||
          card.forwarders?.contact_person ||
          "Unassigned Forwarder";
        const forwarderCode = card.forwarders?.code;
        const forwarderBadge = card.forwarders?.badge || "Booking Agent";
        const pickupLocation = card.load_point || card.origin || "Pickup Point";
        const rateVal = card.base_rate || card.rate || 0;
        const currency = card.currency || "USD";

        return (
          <div
            key={card.id}
            onClick={() => onViewDetails(card)}
            style={{
              background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 60%, #EDF2F7 100%)",
            }}
            className="group relative flex min-h-[260px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-[28px] border border-white/90 p-6 shadow-[0_12px_36px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_rgba(106,128,169,0.15)]"
          >
            {/* Top: Pickup Point & Actions */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid size-10 shrink-0 place-items-center rounded-2xl border border-[#6A80A9]/20 bg-[#E8F1F3] text-[#6A80A9] shadow-2xs">
                    <MapPin className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Pickup Point
                    </span>
                    <h3 className="text-[16px] font-bold text-slate-900 truncate group-hover:text-[#6A80A9] transition-colors">
                      {pickupLocation}
                    </h3>
                  </div>
                </div>

                {/* Edit & Delete */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onEdit(card)}
                    className="grid size-7.5 place-items-center rounded-lg border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-100 hover:text-black transition-colors"
                    title="Edit rate"
                  >
                    <Edit2 className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(card.id, `${pickupLocation} - ${forwarderName}`)}
                    className="grid size-7.5 place-items-center rounded-lg border border-slate-200/80 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                    title="Delete rate"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* Forwarder Badge */}
              <div className="mt-4 flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/90 p-3 shadow-2xs">
                <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#6A80A9]">
                  <Building2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Forwarder Partner
                  </p>
                  <p className="text-[13px] font-bold text-slate-900 truncate">{forwarderName}</p>
                </div>
                {forwarderCode && (
                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600 shrink-0">
                    {forwarderCode}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom: Big Freight Rate */}
            <div className="mt-4 flex items-end justify-between border-t border-slate-200/60 pt-3">
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400 block">
                  Freight Rate
                </span>
                <span className="font-mono text-[22px] font-extrabold text-slate-900 leading-tight">
                  {currency === "USD"
                    ? "$"
                    : currency === "GBP"
                      ? "£"
                      : currency === "EUR"
                        ? "€"
                        : `${currency} `}
                  {rateVal.toLocaleString()}
                </span>
              </div>

              <span className="rounded-full bg-[#E8F1F3] px-2.5 py-1 text-[11px] font-bold text-[#6A80A9] border border-[#6A80A9]/20">
                {currency} / Container
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
