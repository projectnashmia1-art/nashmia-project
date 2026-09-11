import { useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Ship,
} from "lucide-react";
import { ForwarderAccount } from "@/lib/forwarders-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface ForwardersMobileCardsProps {
  forwarders: ForwarderAccount[];
  onSelectForwarder: (forwarder: ForwarderAccount) => void;
  onEditForwarder: (forwarder: ForwarderAccount) => void;
}

function getAvatarInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ForwardersMobileCards({
  forwarders,
  onSelectForwarder,
  onEditForwarder,
}: ForwardersMobileCardsProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (e: React.MouseEvent, text: string, id: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="grid grid-cols-1 gap-3.5 sm:hidden">
      {forwarders.map((fwd) => {
        const initials = getAvatarInitials(fwd.name);

        return (
          <div
            key={fwd.id}
            onClick={() => onSelectForwarder(fwd)}
            className="rounded-[20px] border border-white/85 bg-white/80 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition-all active:scale-[0.99] space-y-3.5"
          >
            {/* Card Header: Avatar, Name, Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[#6A80A9]/20 bg-[#E8F1F3] text-[14px] font-bold text-[#6A80A9]">
                  {initials}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[16px] text-[#000000] truncate">{fwd.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="rounded-md bg-[#E8F1F3] px-1.5 py-0.5 text-[10.5px] font-medium text-[#6A80A9]">
                      {fwd.badge}
                    </span>
                    <span className="text-[11px] text-slate-400">·</span>
                    <span className="font-mono text-[11px] text-slate-500">{fwd.country}</span>
                  </div>
                </div>
              </div>

              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0",
                  fwd.status === "Active"
                    ? "bg-[#C7D5BF]/40 text-[#2B3B24] border border-[#C7D5BF]/70"
                    : "bg-slate-100 text-slate-500 border border-slate-200",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    fwd.status === "Active" ? "bg-[#3D5A32]" : "bg-slate-400",
                  )}
                />
                <span>{fwd.status}</span>
              </span>
            </div>

            {/* Contact Information & WhatsApp */}
            <div className="rounded-[14px] border border-slate-100 bg-[#E8F1F3]/30 p-3 space-y-2 text-[12.5px]">
              <div className="flex items-center justify-between text-slate-700">
                <span className="text-slate-400 font-medium">Contact:</span>
                <span className="font-semibold text-black">{fwd.contactPerson}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Email:</span>
                <div className="flex items-center gap-1.5">
                  <span className="max-w-[170px] truncate text-slate-700 font-medium">
                    {fwd.email}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => copyToClipboard(e, fwd.email, `m-email-${fwd.id}`, "Email")}
                    className="text-slate-400 hover:text-black"
                  >
                    {copiedId === `m-email-${fwd.id}` ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">WhatsApp:</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-emerald-700 font-medium">{fwd.whatsapp}</span>
                  <button
                    type="button"
                    onClick={(e) => copyToClipboard(e, fwd.whatsapp, `m-wa-${fwd.id}`, "WhatsApp")}
                    className="text-slate-400 hover:text-black"
                  >
                    {copiedId === `m-wa-${fwd.id}` ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Connected Shipping Lines */}
            <div className="flex flex-wrap items-center gap-1">
              {fwd.shippingLines.map((sl) => (
                <span
                  key={sl}
                  className="inline-flex items-center gap-1 rounded-md border border-[#6A80A9]/20 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                >
                  <Ship className="size-2.5 text-[#6A80A9]" />
                  <span>{sl}</span>
                </span>
              ))}
            </div>

            {/* Actions Bar */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-100/90">
              <span className="text-[12px] font-mono font-bold text-[#6A80A9]">
                {fwd.activeBookings} Active Bookings
              </span>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <Link
                  to="/new-booking"
                  search={{ bookingAgentId: fwd.id }}
                  className="flex h-8 items-center gap-1 rounded-lg bg-[#000000] px-3 text-[12px] font-medium text-white shadow-2xs"
                >
                  <Plus className="size-3" />
                  <span>Book</span>
                </Link>

                <button
                  type="button"
                  onClick={() => onSelectForwarder(fwd)}
                  className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[12px] font-medium text-slate-700"
                >
                  <span>Details</span>
                  <ChevronRight className="size-3" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
