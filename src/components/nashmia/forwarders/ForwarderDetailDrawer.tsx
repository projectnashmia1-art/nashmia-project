import { useState, useEffect } from "react";
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
  const [activeTab, setActiveTab] = useState<"overview" | "rates" | "bookings">("overview");

  // Lock body scroll and handle Escape key when drawer is open
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || !forwarder) return null;

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div className="glass-card-strong relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-[28px] border border-white/90 bg-white p-0 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        {/* HEADER SECTION */}
        <div className="relative border-b border-slate-100/90 bg-gradient-to-r from-slate-50/90 via-white to-[#E8F1F3]/40 p-5 sm:p-6 pb-4 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              {/* Circular Initials Avatar */}
              <div className="grid size-14 sm:size-16 shrink-0 place-items-center rounded-2xl border border-[#6A80A9]/25 bg-white text-[19px] font-bold text-[#6A80A9] shadow-sm">
                {initials}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">
                    {forwarder.name}
                  </h2>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight shrink-0",
                      forwarder.status === "Active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-slate-100 text-slate-500 border border-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        forwarder.status === "Active"
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-slate-400",
                      )}
                    />
                    <span>{forwarder.status}</span>
                  </span>
                </div>

                <p className="text-[13px] text-slate-500 font-medium truncate mt-0.5">
                  Freight Forwarder &amp; Ocean Logistics Partner
                </p>

                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 shadow-2xs">
                    {forwarder.code}
                  </span>
                  <span className="rounded-md bg-[#E8F1F3] px-2 py-0.5 text-[11px] font-bold text-[#6A80A9]">
                    {forwarder.badge}
                  </span>
                  <span className="text-[11.5px] text-slate-400">
                    {forwarder.country} ({forwarder.countryCode})
                  </span>
                </div>
              </div>
            </div>

            {/* Top Right: Actions & Close */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
              <Link
                to="/new-booking"
                search={{ bookingAgentId: forwarder.id }}
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none inline-flex h-9.5 items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-black px-4 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(0,0,0,0.15)] transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="size-3.5" />
                <span>Create Booking</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  onOpenTestEmail(forwarder);
                }}
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-[#6A80A9]/30 bg-white px-3 text-xs font-semibold text-[#6A80A9] hover:bg-[#E8F1F3]/50 transition-colors shadow-2xs cursor-pointer"
                title="Send test email"
              >
                <Send className="size-3.5" />
                <span className="hidden sm:inline">Test Email</span>
              </button>

              <button
                type="button"
                onClick={() => onEditForwarder(forwarder)}
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                title="Edit Forwarder"
              >
                <Edit2 className="size-3.5 text-slate-400" />
                <span className="hidden sm:inline">Edit</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer ml-1"
                title="Close (Esc)"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* TABS SWITCHER */}
          <div className="flex items-center gap-2 mt-5 -mb-4 border-b border-transparent">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "pb-2.5 text-xs font-bold px-3 border-b-2 transition-all cursor-pointer",
                activeTab === "overview"
                  ? "border-[#6A80A9] text-[#6A80A9]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              Overview &amp; Contact
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rates")}
              className={cn(
                "pb-2.5 text-xs font-bold px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === "rates"
                  ? "border-[#6A80A9] text-[#6A80A9]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <span>Rates &amp; Lines</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                {forwarder.rateCards.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("bookings")}
              className={cn(
                "pb-2.5 text-xs font-bold px-3 border-b-2 transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === "bookings"
                  ? "border-[#6A80A9] text-[#6A80A9]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <span>Active Bookings</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                {forwarder.activeBookings}
              </span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 scrollbar-thin">
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* STATS STRIP */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Active Bookings
                  </span>
                  <p className="mt-1 text-[22px] font-bold text-slate-900 leading-tight">
                    {forwarder.activeBookings}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Agreed Rates
                  </span>
                  <p className="mt-1 text-[22px] font-bold text-slate-900 leading-tight">
                    {forwarder.rateCards.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Shipping Lines
                  </span>
                  <p className="mt-1 text-[22px] font-bold text-[#6A80A9] leading-tight">
                    {forwarder.shippingLines.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Tier Badge
                  </span>
                  <p className="mt-1 text-[13.5px] font-bold text-slate-800 truncate leading-snug">
                    {forwarder.badge}
                  </p>
                </div>
              </div>

              {/* CONTACT INFORMATION */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Primary Contact Information
                </h4>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Contact Person
                    </p>
                    <p className="font-bold text-slate-900 text-[14.5px]">
                      {forwarder.contactPerson}
                    </p>
                    {forwarder.contactRole && (
                      <p className="text-xs text-slate-500 font-medium">{forwarder.contactRole}</p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Headquarters
                    </p>
                    <p className="font-bold text-slate-900 text-[14.5px]">
                      {forwarder.country} ({forwarder.countryCode})
                    </p>
                    <p className="text-xs text-slate-500 font-mono">Agent Code: {forwarder.code}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2 flex items-center justify-between shadow-2xs">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Email Address
                      </p>
                      <p className="font-semibold text-slate-900 text-[14px] truncate mt-0.5">
                        {forwarder.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(forwarder.email, "Email")}
                      className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                      title="Copy Email"
                    >
                      {copiedField === "Email" ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2 flex items-center justify-between shadow-2xs">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        WhatsApp / Direct Phone
                      </p>
                      <p className="font-mono font-semibold text-emerald-700 text-[14px] mt-0.5">
                        {forwarder.whatsapp}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(forwarder.whatsapp, "WhatsApp")}
                      className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
                      title="Copy WhatsApp"
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
                  <div className="rounded-2xl border border-[#6A80A9]/20 bg-[#E8F1F3]/40 p-4 text-[12.5px] text-slate-700 space-y-1 mt-3">
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Clock className="size-3.5 text-[#6A80A9]" />
                      <span>Operational Notes</span>
                    </p>
                    <p className="text-slate-600 leading-relaxed font-medium">{forwarder.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "rates" && (
            <div className="space-y-6">
              {/* CONNECTED SHIPPING LINES */}
              <div className="space-y-2.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Connected Shipping Lines &amp; Alliances
                </h4>

                <div className="flex flex-wrap gap-2.5">
                  {forwarder.shippingLines.map((line) => (
                    <div
                      key={line}
                      className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs"
                    >
                      <div className="grid size-7 place-items-center rounded-xl bg-[#E8F1F3] text-[#6A80A9]">
                        <Ship className="size-3.5" />
                      </div>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900 leading-none">{line}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Contracted Carrier</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RATE CARDS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-[14px] font-bold tracking-tight text-slate-900">
                      Contracted Ocean Rate Cards
                    </h4>
                    <p className="text-xs text-slate-500">
                      Active agreed rates and validity periods
                    </p>
                  </div>

                  <Link
                    to="/rate-cards"
                    search={{ forwarderId: forwarder.id }}
                    onClick={() => onOpenChange(false)}
                    className="inline-flex items-center gap-1 rounded-xl border border-[#6A80A9]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#6A80A9] shadow-2xs hover:bg-[#E8F1F3]/60 transition-colors"
                  >
                    <span>View Rate Directory</span>
                    <ArrowRight className="size-3" />
                  </Link>
                </div>

                {forwarder.rateCards.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3">
                    No active rate cards registered for this forwarder.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {forwarder.rateCards.map((rc) => (
                      <div
                        key={rc.id}
                        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2.5 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[14px] text-slate-900">{rc.lane}</span>
                          <span className="font-mono font-bold text-xs rounded-lg bg-[#E8F1F3] px-2 py-0.5 text-[#6A80A9]">
                            {rc.containerSize}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                          <div>
                            <span className="font-mono text-[20px] font-bold text-slate-900">
                              ${rc.rate.toLocaleString()}
                            </span>
                            <span className="ml-1 text-xs font-bold text-slate-500 font-mono">
                              {rc.currency}
                            </span>
                          </div>

                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-emerald-700 border border-emerald-200">
                            <span className="size-1 rounded-full bg-emerald-500" />
                            <span>{rc.status}</span>
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400">
                          Effective:{" "}
                          <strong className="text-slate-600 font-semibold">
                            {rc.effectiveFrom}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "bookings" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[14px] font-bold tracking-tight text-slate-900">
                    Active Bookings &amp; Shipments
                  </h4>
                  <p className="text-xs text-slate-500">
                    Ocean shipments placed with {forwarder.name}
                  </p>
                </div>
                <Link
                  to="/new-booking"
                  search={{ bookingAgentId: forwarder.id }}
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 hover:underline"
                >
                  <span>New Booking</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {forwarder.recentMovements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <Container className="mx-auto size-8 text-slate-300" />
                  <p className="mt-2 text-[13.5px] font-bold text-slate-700">No active movements</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bookings placed with this agent will display live stages here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {forwarder.recentMovements.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[13.5px] text-slate-900">
                            {m.ref}
                          </span>
                          <span className="text-xs text-slate-400">·</span>
                          <span className="text-xs font-medium text-slate-700">
                            Buyer: <strong className="text-slate-900">{m.buyerName}</strong>
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold",
                            m.stage === "In Transit"
                              ? "bg-blue-50 text-blue-700 border border-blue-200"
                              : m.stage === "Delivered"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200",
                          )}
                        >
                          ● {m.stage}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <div>
                          Route: <span className="font-semibold text-slate-900">{m.route}</span>
                        </div>
                        <div className="font-mono text-xs text-[#6A80A9] font-bold">
                          Container: {m.containerSize} × {m.containersCount}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 bg-slate-50 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl border-t border-slate-100">
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
          )}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-100 px-6 py-4 bg-slate-50/80 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => onToggleArchive(forwarder.id)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
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
            className="h-9 rounded-xl border border-slate-200 bg-white px-5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
