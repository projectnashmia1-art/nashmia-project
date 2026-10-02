import React from "react";
import {
  Building2,
  MapPin,
  DollarSign,
  Edit2,
  Trash2,
  Plus,
  Receipt,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FullRateCardRecord } from "@/types/rate-card.types";

interface RateCardsTableProps {
  rateCards: FullRateCardRecord[];
  onViewDetails: (card: FullRateCardRecord) => void;
  onEdit: (card: FullRateCardRecord) => void;
  onDelete: (id: string, name: string) => void;
  onAddRateCard: () => void;
}

export function RateCardsTable({
  rateCards,
  onViewDetails,
  onEdit,
  onDelete,
  onAddRateCard,
}: RateCardsTableProps) {
  if (rateCards.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#6A80A9]/10 text-[#6A80A9] mb-3.5 shadow-2xs">
          <Receipt className="size-7 stroke-[1.8]" />
        </div>
        <h3 className="text-base font-bold text-slate-900">No Rate Cards Found</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
          No forwarder rates registered for this pickup location yet. Add a rate card with pickup
          point, forwarder, and agreed price.
        </p>
        <button
          type="button"
          onClick={onAddRateCard}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-black hover:bg-slate-800 px-5 py-2.5 text-xs font-bold text-white shadow-xs transition-all active:scale-95 cursor-pointer"
        >
          <Plus className="size-3.5" />
          <span>+ Add Rate Card</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-white/85 bg-white/80 shadow-[0_12px_36px_rgba(15,23,42,0.035)] backdrop-blur-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100/90 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              <th className="py-4 pl-6 pr-4">Pickup Point</th>
              <th className="py-4 px-4">Forwarder</th>
              <th className="py-4 px-4">Freight Rate</th>
              <th className="py-4 pl-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 text-[13.5px]">
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
                <tr
                  key={card.id}
                  onClick={() => onViewDetails(card)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-[#E8F1F3]/40"
                >
                  {/* 1. PICKUP POINT */}
                  <td className="py-4 pl-6 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-[#6A80A9]/20 bg-[#E8F1F3] text-[#6A80A9] shadow-2xs group-hover:scale-105 transition-all">
                        <MapPin className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 text-[14.5px] group-hover:text-[#6A80A9] transition-colors truncate">
                          {pickupLocation}
                        </p>
                        <p className="text-[11.5px] text-slate-400 mt-0.5 flex items-center gap-1">
                          <span>Dispatch Location</span>
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* 2. FORWARDER */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 font-bold text-xs">
                        <Building2 className="size-4 text-[#6A80A9]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-[13.5px] truncate">
                            {forwarderName}
                          </span>
                          {forwarderCode && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-600">
                              {forwarderCode}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {forwarderBadge}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* 3. FREIGHT RATE */}
                  <td className="py-4 px-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[19px] font-extrabold text-slate-900">
                        {currency === "USD"
                          ? "$"
                          : currency === "GBP"
                            ? "£"
                            : currency === "EUR"
                              ? "€"
                              : `${currency} `}
                        {rateVal.toLocaleString()}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-slate-400">
                        {currency} / bkg
                      </span>
                    </div>
                  </td>

                  {/* 4. ACTIONS */}
                  <td className="py-4 pl-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => onEdit(card)}
                        className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-black transition-all cursor-pointer shadow-2xs"
                        title="Edit rate"
                      >
                        <Edit2 className="size-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onDelete(card.id, `${pickupLocation} - ${forwarderName}`)}
                        className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-200 transition-all cursor-pointer shadow-2xs"
                        title="Delete rate"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
