import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Check,
  Copy,
  DollarSign,
  Edit2,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Ship,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ForwarderAccount } from "@/lib/forwarders-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface ForwarderCardProps {
  forwarder: ForwarderAccount;
  onSelectForwarder: (forwarder: ForwarderAccount) => void;
  onEditForwarder: (forwarder: ForwarderAccount) => void;
  onToggleArchive: (forwarderId: string) => void;
  onSendTestEmail: (forwarder: ForwarderAccount) => void;
}

function getAvatarInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ForwarderCard({
  forwarder,
  onSelectForwarder,
  onEditForwarder,
  onToggleArchive,
  onSendTestEmail,
}: ForwarderCardProps) {
  const initials = getAvatarInitials(forwarder.name);
  const isInactive = forwarder.status === "Inactive" || forwarder.status === "Archived";

  const handleManageRateCards = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectForwarder(forwarder);
    toast.info("Rate Cards Overview", {
      description: `Viewing ${forwarder.rateCards.length} agreed monthly rate cards for ${forwarder.name}.`,
    });
  };

  return (
    <div
      onClick={() => onSelectForwarder(forwarder)}
      className={cn(
        "group relative flex h-[256px] w-full cursor-pointer flex-col justify-between rounded-[20px] border border-[#6A80A9]/15 bg-white/85 p-5 shadow-[0_10px_35px_rgba(0,0,0,0.045)] backdrop-blur-[24px] transition-all duration-300 hover:-translate-y-1 hover:border-[#6A80A9]/40 hover:shadow-[0_14px_42px_rgba(106,128,169,0.12)]",
        isInactive && "opacity-75 bg-slate-50/70 hover:opacity-100",
      )}
    >
      {/* 1. TOP ROW: Avatar + Forwarder Name + Three-dot Menu */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Circular Initials (44px) */}
            <div className="grid size-11 shrink-0 place-items-center rounded-full border border-[#6A80A9]/25 bg-[#E8F1F3] text-[14px] font-bold text-[#6A80A9] shadow-2xs group-hover:scale-105 transition-transform">
              {initials}
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[15.5px] font-bold tracking-tight text-[#000000] group-hover:text-[#6A80A9] transition-colors leading-tight">
                {forwarder.name}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11.5px] font-medium text-slate-400">{forwarder.badge}</span>
                <span className="text-[11px] text-slate-300">·</span>
                <span className="font-mono text-[11px] text-slate-500">{forwarder.country}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Status Indicator */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tracking-tight",
                forwarder.status === "Active"
                  ? "bg-[#C7D5BF]/45 text-[#2B3B24] border border-[#C7D5BF]/80"
                  : "bg-slate-100 text-slate-500 border border-slate-200",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  forwarder.status === "Active" ? "bg-[#3D5A32]" : "bg-slate-400",
                )}
              />
              <span>{forwarder.status}</span>
            </span>

            {/* Three-Dot Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Forwarder options"
                  className="grid size-7 place-items-center rounded-lg border border-slate-200/60 bg-white/70 text-slate-400 hover:bg-white hover:text-black transition-colors"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-[16px] border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                  {forwarder.name}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onSelectForwarder(forwarder)}
                  className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-100"
                >
                  <User className="size-3.5 text-[#6A80A9]" />
                  <span>View Forwarder</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onEditForwarder(forwarder)}
                  className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-100"
                >
                  <Edit2 className="size-3.5 text-slate-500" />
                  <span>Edit Forwarder</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/new-booking"
                    search={{ bookingAgentId: forwarder.id }}
                    className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="size-3.5 text-emerald-600" />
                    <span>Create Booking</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSendTestEmail(forwarder)}
                  className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-100"
                >
                  <Send className="size-3.5 text-[#6A80A9]" />
                  <span>Send Test Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleManageRateCards}
                  className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-100"
                >
                  <DollarSign className="size-3.5 text-[#6A80A9]" />
                  <span>Manage Rate Cards</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => onToggleArchive(forwarder.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px] text-amber-700 hover:bg-amber-50"
                >
                  {forwarder.status === "Active" ? (
                    <>
                      <Archive className="size-3.5" />
                      <span>Archive Forwarder</span>
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="size-3.5" />
                      <span>Activate Forwarder</span>
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 2. COMPACT HORIZONTAL CONTACT & SHIPPING LINES AREA */}
        <div className="mt-2.5 space-y-1.5 text-[11.5px]">
          {/* Contact Line */}
          <div className="flex items-center gap-1.5 text-slate-600 truncate">
            <span className="font-semibold text-slate-900 shrink-0">CONTACT:</span>
            <span className="font-medium truncate">{forwarder.contactPerson}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 truncate">{forwarder.email}</span>
          </div>

          {/* Shipping Lines Pills */}
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
              Lines:
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {forwarder.shippingLines.slice(0, 2).map((line) => (
                <span
                  key={line}
                  className="inline-flex items-center gap-0.5 rounded-[6px] bg-[#E8F1F3] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#000000]"
                >
                  <Ship className="size-2.5 text-[#6A80A9]" />
                  <span>{line}</span>
                </span>
              ))}
              {forwarder.shippingLines.length > 2 && (
                <span className="rounded-[6px] bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                  +{forwarder.shippingLines.length - 2}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. BOTTOM STATS & FOOTER */}
      <div className="pt-2 border-t border-slate-100/90">
        <div className="flex items-end justify-between">
          {/* Active Bookings & Rate Card Status */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[18px] font-bold text-[#6A80A9] leading-none">
                {forwarder.activeBookings}
              </span>
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-400">
                Active Bookings
              </span>
              {forwarder.bookingsThisMonth ? (
                <span className="text-[10.5px] font-medium text-emerald-600">
                  +{forwarder.bookingsThisMonth} this mo
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Rate Card:
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C7D5BF]/40 px-2 py-0.5 text-[10px] font-bold text-[#2B3B24] border border-[#C7D5BF]/60">
                <span className="size-1 rounded-full bg-[#3D5A32]" />
                <span>{forwarder.rateCards.length} Active Rates</span>
              </span>
            </div>
          </div>

          {/* View Forwarder Link */}
          <div className="flex items-center gap-1 text-[12px] font-semibold text-slate-700 group-hover:text-black transition-colors">
            <span>View</span>
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </div>
      </div>
    </div>
  );
}
