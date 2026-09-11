import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  Clock,
  Container,
  Copy,
  DollarSign,
  Edit2,
  ExternalLink,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Ship,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ForwarderAccount } from "@/lib/forwarders-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface ForwarderDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forwarder: ForwarderAccount | null;
  onEditForwarder: (forwarder: ForwarderAccount) => void;
  onToggleArchive: (forwarderId: string) => void;
  onOpenTestEmail: (forwarder: ForwarderAccount) => void;
}

function getAvatarInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ForwarderDetailDrawer({
  open,
  onOpenChange,
  forwarder,
  onEditForwarder,
  onToggleArchive,
  onOpenTestEmail,
}: ForwarderDetailDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!forwarder) return null;

  const initials = getAvatarInitials(forwarder.name);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleManageRateCards = () => {
    toast.info("Rate Cards Management", {
      description: `Active agreed rates for ${forwarder.name} are synchronized with live ocean booking requests.`,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[620px] p-0 border-l border-white/80 bg-white/95 backdrop-blur-2xl shadow-[0_24px_80px_rgba(15,23,42,0.18)] overflow-hidden flex flex-col"
      >
        {/* HEADER SECTION */}
        <div className="relative border-b border-slate-100/90 bg-gradient-to-b from-[#E8F1F3]/50 via-[#E8F1F3]/20 to-transparent p-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              {/* Circular Initials Avatar (48px) */}
              <div className="grid size-12 shrink-0 place-items-center rounded-full border border-[#6A80A9]/25 bg-[#E8F1F3] text-[16px] font-bold text-[#6A80A9] shadow-2xs">
                {initials}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-[22px] font-bold tracking-[-0.02em] text-[#000000] truncate">
                    {forwarder.name}
                  </SheetTitle>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight shrink-0",
                      forwarder.status === "Active"
                        ? "bg-[#C7D5BF]/45 text-[#2B3B24] border border-[#C7D5BF]/70"
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
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="rounded-md bg-[#E8F1F3] px-2 py-0.5 text-[11px] font-semibold text-[#6A80A9]">
                    {forwarder.badge}
                  </span>
                  <span className="text-[12px] text-slate-500 font-mono">
                    ID: {forwarder.code} · {forwarder.country}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PRIMARY ACTIONS: Create Booking, Edit, Send Test Email */}
          <div className="mt-5 flex items-center gap-2.5">
            <Link
              to="/new-booking"
              search={{ bookingAgentId: forwarder.id }}
              onClick={() => onOpenChange(false)}
              className="flex-1 flex h-[48px] items-center justify-center gap-2 rounded-[14px] bg-[#000000] px-5 text-[13.5px] font-semibold text-white shadow-[0_10px_25px_rgba(0,0,0,0.18)] transition-all hover:bg-slate-900 hover:scale-[1.01] active:scale-[0.99]"
            >
              <Plus className="size-4" />
              <span>Create Booking</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                onOpenTestEmail(forwarder);
                toast.success("✓ Test Email Ready", {
                  description: `Test dispatch prepared for ${forwarder.email}`,
                });
              }}
              className="flex h-[48px] items-center gap-2 rounded-[14px] border border-[#6A80A9]/30 bg-white px-4 text-[13px] font-semibold text-[#6A80A9] hover:bg-[#E8F1F3]/50 transition-colors shadow-2xs"
            >
              <Send className="size-3.5" />
              <span>Send Test Email</span>
            </button>

            <button
              type="button"
              onClick={() => onEditForwarder(forwarder)}
              className="grid size-[48px] shrink-0 place-items-center rounded-[14px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-black transition-colors shadow-2xs"
              title="Edit Forwarder"
            >
              <Edit2 className="size-4" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. CONTACT INFORMATION */}
          <div className="space-y-3">
            <h3 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Contact Information
            </h3>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="rounded-[14px] border border-slate-200/70 bg-white/70 p-3.5 shadow-2xs">
                <p className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">
                  Contact Person
                </p>
                <p className="font-semibold text-[#000000] text-[14px] mt-0.5">
                  {forwarder.contactPerson}
                </p>
                {forwarder.contactRole && (
                  <p className="text-[11.5px] text-slate-500">{forwarder.contactRole}</p>
                )}
              </div>

              <div className="rounded-[14px] border border-slate-200/70 bg-white/70 p-3.5 shadow-2xs">
                <p className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">
                  Country
                </p>
                <p className="font-semibold text-[#000000] text-[14px] mt-0.5">
                  {forwarder.country} ({forwarder.countryCode})
                </p>
              </div>

              <div className="rounded-[14px] border border-slate-200/70 bg-white/70 p-3.5 shadow-2xs sm:col-span-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">
                    Email Address
                  </p>
                  <p className="font-medium text-[#000000] text-[13.5px] truncate mt-0.5">
                    {forwarder.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(forwarder.email, "Email")}
                  className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  {copiedField === "Email" ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>

              <div className="rounded-[14px] border border-slate-200/70 bg-white/70 p-3.5 shadow-2xs sm:col-span-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[10.5px] font-medium text-slate-400 uppercase tracking-wider">
                    WhatsApp
                  </p>
                  <p className="font-mono text-[13.5px] font-medium text-emerald-700 mt-0.5">
                    {forwarder.whatsapp}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(forwarder.whatsapp, "WhatsApp")}
                  className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  {copiedField === "WhatsApp" ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Operational Notes */}
            {forwarder.notes && (
              <div className="rounded-[14px] border border-[#6A80A9]/20 bg-[#E8F1F3]/40 p-3.5 text-[12.5px] text-slate-700 space-y-1">
                <p className="font-semibold text-slate-900 flex items-center gap-1.5">
                  <Clock className="size-3.5 text-[#6A80A9]" />
                  <span>Operational Notes</span>
                </p>
                <p className="text-slate-600 leading-relaxed">{forwarder.notes}</p>
              </div>
            )}
          </div>

          {/* 2. CONNECTED SHIPPING LINES */}
          <div className="space-y-2.5">
            <h3 className="text-[11.5px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Connected Shipping Lines
            </h3>

            <div className="flex flex-wrap gap-2">
              {forwarder.shippingLines.map((line) => (
                <div
                  key={line}
                  className="flex items-center gap-2 rounded-[12px] border border-slate-200/80 bg-white px-3 py-2 shadow-2xs"
                >
                  <div className="grid size-6 place-items-center rounded-md bg-[#E8F1F3] text-[#6A80A9]">
                    <Ship className="size-3" />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[#000000] leading-none">{line}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Connected Line</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. RATE CARDS (COMPACT HORIZONTAL CARDS) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold tracking-tight text-[#000000]">Rate Cards</h3>
                <p className="text-[12px] text-slate-500">
                  Active agreed rates for this forwarder.
                </p>
              </div>

              <button
                type="button"
                onClick={handleManageRateCards}
                className="inline-flex items-center gap-1 rounded-[10px] border border-[#6A80A9]/30 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#6A80A9] shadow-2xs hover:bg-[#E8F1F3]/60 transition-colors"
              >
                <span>Manage Rate Cards</span>
                <ArrowRight className="size-3" />
              </button>
            </div>

            {forwarder.rateCards.length === 0 ? (
              <p className="text-[12px] text-slate-400 italic py-2">
                No active rate cards registered for this forwarder.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {forwarder.rateCards.map((rc) => (
                  <div
                    key={rc.id}
                    className="rounded-[16px] border border-[#6A80A9]/20 bg-white p-3.5 shadow-2xs space-y-2 hover:border-[#6A80A9]/40 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[13.5px] text-[#000000]">{rc.lane}</span>
                      <span className="font-mono font-bold text-[12px] rounded-md bg-[#E8F1F3] px-1.5 py-0.5 text-[#6A80A9]">
                        {rc.containerSize}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                      <div>
                        <span className="font-mono text-[18px] font-bold text-slate-900">
                          ${rc.rate.toLocaleString()}
                        </span>
                        <span className="ml-1 text-[11px] font-bold text-slate-500 font-mono">
                          {rc.currency}
                        </span>
                      </div>

                      <span className="inline-flex items-center gap-1 rounded-full bg-[#C7D5BF]/40 px-2 py-0.5 text-[10px] font-bold text-[#2B3B24] border border-[#C7D5BF]/60">
                        <span className="size-1 rounded-full bg-[#3D5A32]" />
                        <span>{rc.status}</span>
                      </span>
                    </div>

                    <div className="text-[10.5px] text-slate-400">
                      Effective:{" "}
                      <strong className="text-slate-600 font-medium">{rc.effectiveFrom}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. ACTIVE BOOKINGS & RECENT MOVEMENT CARDS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold tracking-tight text-[#000000]">
                  Active Bookings
                </h3>
                <p className="text-[12px] text-slate-500">
                  Current ocean shipments placed with {forwarder.name}.
                </p>
              </div>
              <span className="font-mono text-[24px] font-bold text-[#6A80A9]">
                {forwarder.activeBookings}
              </span>
            </div>

            {forwarder.recentMovements.length === 0 ? (
              <div className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                <Container className="mx-auto size-6 text-slate-300" />
                <p className="mt-2 text-[13px] font-medium text-slate-600">No active movements</p>
                <p className="text-[11.5px] text-slate-400 mt-0.5">
                  Bookings placed with this agent will display live stages here.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {forwarder.recentMovements.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-[16px] border border-slate-200/80 bg-white/90 p-4 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[13px] text-[#000000]">
                          {m.ref}
                        </span>
                        <span className="text-[11px] text-slate-400">·</span>
                        <span className="text-[12px] font-medium text-slate-700">
                          Buyer: <strong className="text-black">{m.buyerName}</strong>
                        </span>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                          m.stage === "In Transit"
                            ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                            : m.stage === "Delivered"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : "bg-amber-50 text-amber-700 border border-amber-200/60",
                        )}
                      >
                        ● {m.stage}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[12px] text-slate-600 pt-1 border-t border-slate-100">
                      <div>
                        Route: <span className="font-semibold text-slate-900">{m.route}</span>
                      </div>
                      <div className="font-mono text-[11.5px] text-[#6A80A9] font-bold">
                        Container: {m.containerSize} × {m.containersCount}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 bg-slate-50/80 -mx-4 -mb-4 px-4 py-2 rounded-b-[15px]">
                      <span>
                        Vessel: <strong className="text-slate-800">{m.vessel}</strong>
                      </span>
                      <span>
                        ETD: <strong className="text-slate-800">{m.etd}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-100 bg-slate-50/70 p-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onToggleArchive(forwarder.id)}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-600 hover:text-black transition-colors"
          >
            {forwarder.status === "Active" ? (
              <>
                <Archive className="size-3.5 text-amber-600" />
                <span>Archive Forwarder</span>
              </>
            ) : (
              <>
                <ArchiveRestore className="size-3.5 text-emerald-600" />
                <span>Activate Forwarder</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-[10px] border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
