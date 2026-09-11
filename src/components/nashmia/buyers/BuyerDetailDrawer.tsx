import { useState } from "react";
import {
  Anchor,
  Archive,
  ArchiveRestore,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  Container,
  Copy,
  Edit2,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
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
import { BuyerAccountFull, BuyerMovementRecord } from "@/lib/buyers-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface BuyerDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyer: BuyerAccountFull | null;
  movements: BuyerMovementRecord[];
  onEditBuyer: (buyer: BuyerAccountFull) => void;
  onToggleArchive: (buyerId: string) => void;
}

function getAvatarInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getCountryFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    GB: "🇬🇧",
    PK: "🇵🇰",
    ES: "🇪🇸",
    DE: "🇩🇪",
    IT: "🇮🇹",
    FR: "🇫🇷",
    SE: "🇸🇪",
    US: "🇺🇸",
    AE: "🇦🇪",
    CN: "🇨🇳",
  };
  return flags[countryCode] || "🌐";
}

const statusBadgeStyles: Record<string, { bg: string; text: string; border: string; dot: string }> =
  {
    "In Transit": {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
      dot: "bg-blue-500",
    },
    "Booking Requested": {
      bg: "bg-amber-50",
      text: "text-amber-700",
      border: "border-amber-200",
      dot: "bg-amber-500",
    },
    "Customs Hold": {
      bg: "bg-rose-50",
      text: "text-rose-700",
      border: "border-rose-200",
      dot: "bg-rose-500",
    },
    Delivered: {
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-200",
      dot: "bg-emerald-500",
    },
    "Gate-In": {
      bg: "bg-purple-50",
      text: "text-purple-700",
      border: "border-purple-200",
      dot: "bg-purple-500",
    },
  };

export function BuyerDetailDrawer({
  open,
  onOpenChange,
  buyer,
  movements,
  onEditBuyer,
  onToggleArchive,
}: BuyerDetailDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!buyer) return null;

  const initials = getAvatarInitials(buyer.name);
  const flag = getCountryFlag(buyer.countryCode);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-[580px] border-l border-slate-200/90 bg-white p-0 shadow-2xl sm:max-w-[620px]"
      >
        <div className="flex h-full flex-col overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* TOP DRAWER STICKY HEADER */}
          <div className="sticky top-0 z-10 border-b border-slate-200/90 bg-white/95 p-6 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {/* Large Avatar with Flag */}
                <div className="relative">
                  <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[#C7E8E8] bg-[#E8F5F6] text-lg font-bold text-[#0FA3B1] shadow-sm">
                    {initials}
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 text-sm drop-shadow-sm"
                    title={buyer.country}
                  >
                    {flag}
                  </span>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-[22px] font-bold tracking-tight text-slate-900 leading-snug">
                      {buyer.name}
                    </h2>
                    <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500">
                      {buyer.code}
                    </span>
                  </div>
                  <p className="text-[13.5px] text-slate-500 font-medium truncate">
                    {buyer.company}
                  </p>
                </div>
              </div>

              {/* Status Pill */}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold shrink-0",
                  buyer.status === "Active"
                    ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border border-slate-200 bg-slate-100 text-slate-600",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    buyer.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
                  )}
                />
                {buyer.status}
              </span>
            </div>

            {/* ACTION BUTTONS BAR */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link
                to="/new-booking"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-4 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="size-3.5" />
                <span>Create Booking</span>
              </Link>

              <button
                type="button"
                onClick={() => onEditBuyer(buyer)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                <Edit2 className="size-3.5 text-slate-400" />
                <span>Edit Profile</span>
              </button>

              <button
                type="button"
                onClick={() => onToggleArchive(buyer.id)}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 shadow-2xs transition-all hover:border-slate-300 hover:bg-slate-50"
              >
                {buyer.status === "Active" ? (
                  <>
                    <Archive className="size-3.5 text-amber-600" />
                    <span>Archive Buyer</span>
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="size-3.5 text-emerald-600" />
                    <span>Activate Buyer</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* DRAWER BODY */}
          <div className="space-y-6 p-6">
            {/* MOVEMENT OVERVIEW KPI SECTION */}
            <div className="space-y-2.5">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Movement Allocations
              </h3>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Active
                  </span>
                  <p className="mt-1 text-[24px] font-bold tracking-tight text-slate-900">
                    {buyer.activeMovements}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Total
                  </span>
                  <p className="mt-1 text-[24px] font-bold tracking-tight text-slate-900">
                    {buyer.totalMovements}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider">
                    In Transit
                  </span>
                  <p className="mt-1 text-[24px] font-bold tracking-tight text-blue-700">
                    {buyer.inTransitMovements}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-4 shadow-2xs">
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">
                    Delivered
                  </span>
                  <p className="mt-1 text-[24px] font-bold tracking-tight text-emerald-700">
                    {buyer.deliveredMovements}
                  </p>
                </div>
              </div>
            </div>

            {/* BUYER INFORMATION SECTION */}
            <div className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-5 space-y-4 shadow-2xs">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Company & Contact Information
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Legal Entity & Tax ID */}
                <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#E8F5F6] border border-[#C7E8E8] text-[#0FA3B1]">
                    <Building2 className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Legal Entity
                    </p>
                    <p className="text-[13px] font-bold text-slate-900 truncate">{buyer.company}</p>
                    {buyer.taxId && (
                      <p className="font-mono text-[11px] font-medium text-slate-500 truncate mt-0.5">
                        {buyer.taxId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Country & Port */}
                <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-600">
                    <Globe className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Country & Port
                    </p>
                    <p className="text-[13px] font-bold text-slate-900 truncate">{buyer.country}</p>
                    <p className="text-[11.5px] text-slate-500 truncate mt-0.5">
                      {buyer.preferredPort || "Global Corridor"}
                    </p>
                  </div>
                </div>

                {/* Contact Person */}
                <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
                    <User className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Primary Contact
                    </p>
                    <p className="text-[13px] font-bold text-slate-900">{buyer.contactPerson}</p>
                    {buyer.contactRole && (
                      <p className="text-[11.5px] text-slate-500 truncate mt-0.5">
                        {buyer.contactRole}
                      </p>
                    )}
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex items-center justify-between rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                      <Mail className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Email
                      </p>
                      <p className="text-[12.5px] font-medium text-slate-900 truncate">
                        {buyer.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buyer.email, "Email")}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    {copiedField === "Email" ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>

                {/* Phone Number */}
                <div className="flex items-center justify-between rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                      <Phone className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Phone
                      </p>
                      <p className="font-mono text-[12px] font-medium text-slate-900 truncate">
                        {buyer.phone}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buyer.phone, "Phone")}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    {copiedField === "Phone" ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>

                {/* Address */}
                {buyer.address && (
                  <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-slate-200/80 shadow-2xs">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
                      <MapPin className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Address
                      </p>
                      <p className="text-[12px] text-slate-700 line-clamp-2 mt-0.5">
                        {buyer.address}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ALLOCATED MOVEMENTS LIST */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900 tracking-tight">
                    Allocated Container Movements
                  </h3>
                  <p className="text-[12px] text-slate-500">
                    Live and historic shipments assigned to {buyer.name}
                  </p>
                </div>

                <Link
                  to="/new-booking"
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0FA3B1] hover:underline"
                >
                  <span>Book Movement</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {movements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <Container className="mx-auto size-8 text-slate-400" />
                  <p className="mt-2 text-[13px] font-bold text-slate-800">No Movements Recorded</p>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    Create a new booking to allocate containers to {buyer.name}.
                  </p>
                  <Link
                    to="/new-booking"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-4 py-2 text-xs font-semibold text-white shadow-sm"
                  >
                    <Plus className="size-3.5" />
                    <span>Create Booking</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {movements.map((mov) => {
                    const statusStyle = statusBadgeStyles[mov.status] || {
                      bg: "bg-slate-50",
                      text: "text-slate-700",
                      border: "border-slate-200",
                      dot: "bg-slate-400",
                    };

                    return (
                      <div
                        key={mov.id}
                        className="group relative rounded-2xl border border-slate-200/90 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        {/* Header: Ref, Route, Container, Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                {mov.ref}
                              </span>
                              <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700">
                                {mov.containerSize} × {mov.containersCount}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] font-semibold text-slate-800">
                              {mov.polName} → {mov.podName}
                            </p>
                          </div>

                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                              statusStyle.bg,
                              statusStyle.text,
                              statusStyle.border,
                            )}
                          >
                            <span className={cn("size-1.5 rounded-full", statusStyle.dot)} />
                            {mov.status}
                          </span>
                        </div>

                        {/* Schedule & Freight Row */}
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                          <div className="flex items-center gap-3">
                            <span>
                              ETD: <strong className="text-slate-800">{mov.etd}</strong>
                            </span>
                            <span>
                              ETA: <strong className="text-slate-800">{mov.eta}</strong>
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Ship className="size-3.5 text-slate-400" />
                            <span className="font-medium text-slate-700">{mov.carrier}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
