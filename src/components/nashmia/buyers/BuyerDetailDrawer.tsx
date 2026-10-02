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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [activeTab, setActiveTab] = useState<"overview" | "company" | "movements">("overview");

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[760px] lg:max-w-[840px] p-0 overflow-hidden rounded-[24px] sm:rounded-[28px] border border-slate-200 bg-white shadow-2xl max-h-[90vh] flex flex-col">
        {/* TOP HEADER SECTION */}
        <div className="relative border-b border-slate-200 bg-gradient-to-r from-blue-50/50 via-white to-slate-50 p-5 sm:p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              {/* Large Avatar with Flag */}
              <div className="relative shrink-0">
                <div className="grid size-14 sm:size-16 place-items-center rounded-2xl border border-[#C7E8E8] bg-white text-[19px] font-bold text-[#0FA3B1] shadow-sm">
                  {initials}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 text-base drop-shadow-xs bg-white rounded-full p-0.5 border border-slate-100"
                  title={buyer.country}
                >
                  {flag}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="truncate text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                    {buyer.name}
                  </DialogTitle>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border shrink-0",
                      buyer.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-600",
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

                <DialogDescription className="text-[13px] text-slate-500 font-medium truncate mt-0.5">
                  {buyer.company}
                </DialogDescription>

                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 shadow-2xs">
                    {buyer.code}
                  </span>
                  <span className="text-[11.5px] text-slate-400">
                    {buyer.country} · {buyer.preferredPort || "Global Corridor"}
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS BAR */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
              <Link
                to="/new-booking"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none inline-flex h-9.5 items-center justify-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-4 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="size-3.5" />
                <span>Create Booking</span>
              </Link>

              <button
                type="button"
                onClick={() => onEditBuyer(buyer)}
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Edit Buyer"
              >
                <Edit2 className="size-3.5 text-slate-400" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </div>
          </div>

          {/* TABS */}
          <div className="flex items-center gap-2 mt-5 -mb-4 border-b border-transparent">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "pb-2 text-xs font-semibold px-3 border-b-2 transition-all",
                activeTab === "overview"
                  ? "border-[#0FA3B1] text-[#0FA3B1]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              Overview &amp; Metrics
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("company")}
              className={cn(
                "pb-2 text-xs font-semibold px-3 border-b-2 transition-all",
                activeTab === "company"
                  ? "border-[#0FA3B1] text-[#0FA3B1]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              Company &amp; Contact
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("movements")}
              className={cn(
                "pb-2 text-xs font-semibold px-3 border-b-2 transition-all flex items-center gap-1.5",
                activeTab === "movements"
                  ? "border-[#0FA3B1] text-[#0FA3B1]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              <span>Allocated Movements</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                {movements.length}
              </span>
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* MOVEMENT OVERVIEW KPI SECTION */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Active
                  </span>
                  <p className="mt-1 text-[22px] font-bold tracking-tight text-slate-900">
                    {buyer.activeMovements}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Movements
                  </span>
                  <p className="mt-1 text-[22px] font-bold tracking-tight text-slate-900">
                    {buyer.totalMovements}
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-blue-600 uppercase tracking-wider">
                    In Transit
                  </span>
                  <p className="mt-1 text-[22px] font-bold tracking-tight text-blue-700">
                    {buyer.inTransitMovements}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-emerald-600 uppercase tracking-wider">
                    Delivered
                  </span>
                  <p className="mt-1 text-[22px] font-bold tracking-tight text-emerald-700">
                    {buyer.deliveredMovements}
                  </p>
                </div>
              </div>

              {/* QUICK SNAPSHOT */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5 space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Primary Profile Snapshot
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-xl bg-white p-3.5 border border-slate-200/90 shadow-2xs">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Primary Contact
                    </p>
                    <p className="text-[14px] font-bold text-slate-900 mt-0.5">
                      {buyer.contactPerson}
                    </p>
                    <p className="text-xs text-slate-500">{buyer.contactRole || "Cargo Buyer"}</p>
                  </div>

                  <div className="rounded-xl bg-white p-3.5 border border-slate-200/90 shadow-2xs">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Preferred Port of Discharge
                    </p>
                    <p className="text-[14px] font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                      <Anchor className="size-3.5 text-[#0FA3B1]" />
                      <span>{buyer.preferredPort || "Global Corridor"}</span>
                    </p>
                    <p className="text-xs text-slate-500">{buyer.country}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "company" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Legal Entity & Tax ID */}
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50/60 p-4 border border-slate-200/90 shadow-2xs">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white border border-[#C7E8E8] text-[#0FA3B1] shadow-2xs">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Legal Entity
                    </p>
                    <p className="text-[14px] font-bold text-slate-900 truncate">{buyer.company}</p>
                    {buyer.taxId && (
                      <p className="font-mono text-xs font-semibold text-slate-600 truncate mt-0.5">
                        Tax ID: {buyer.taxId}
                      </p>
                    )}
                  </div>
                </div>

                {/* Country & Port */}
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50/60 p-4 border border-slate-200/90 shadow-2xs">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white border border-cyan-200 text-cyan-600 shadow-2xs">
                    <Globe className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Country &amp; Port
                    </p>
                    <p className="text-[14px] font-bold text-slate-900 truncate flex items-center gap-1.5">
                      <span>{flag}</span>
                      <span>{buyer.country}</span>
                    </p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {buyer.preferredPort || "Global Corridor"}
                    </p>
                  </div>
                </div>

                {/* Contact Person */}
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50/60 p-4 border border-slate-200/90 shadow-2xs">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white border border-indigo-200 text-indigo-600 shadow-2xs">
                    <User className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Primary Contact
                    </p>
                    <p className="text-[14px] font-bold text-slate-900">{buyer.contactPerson}</p>
                    {buyer.contactRole && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{buyer.contactRole}</p>
                    )}
                  </div>
                </div>

                {/* Address */}
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50/60 p-4 border border-slate-200/90 shadow-2xs">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white border border-amber-200 text-amber-600 shadow-2xs">
                    <MapPin className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Delivery Address
                    </p>
                    <p className="text-xs text-slate-700 line-clamp-2 mt-0.5 font-medium">
                      {buyer.address || "Standard Port Delivery"}
                    </p>
                  </div>
                </div>

                {/* Email Address */}
                <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs sm:col-span-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 border border-blue-200 text-blue-600">
                      <Mail className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Email Address
                      </p>
                      <p className="text-[13.5px] font-semibold text-slate-900 truncate">
                        {buyer.email}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buyer.email, "Email")}
                    className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    {copiedField === "Email" ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>

                {/* Phone Number */}
                <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs sm:col-span-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
                      <Phone className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Phone / WhatsApp
                      </p>
                      <p className="font-mono text-[13.5px] font-semibold text-slate-900 truncate">
                        {buyer.phone}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buyer.phone, "Phone")}
                    className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                  >
                    {copiedField === "Phone" ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "movements" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900 tracking-tight">
                    Allocated Container Movements
                  </h4>
                  <p className="text-xs text-slate-500">
                    Live and historic shipments assigned to {buyer.name}
                  </p>
                </div>

                <Link
                  to="/new-booking"
                  onClick={() => onOpenChange(false)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0FA3B1] hover:underline"
                >
                  <span>Book Movement</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {movements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <Container className="mx-auto size-8 text-slate-400" />
                  <p className="mt-2 text-[13.5px] font-bold text-slate-800">
                    No Movements Recorded
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Create a new booking to allocate containers to {buyer.name}.
                  </p>
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
                        className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs transition-all duration-200 hover:border-slate-300 hover:shadow-sm"
                      >
                        {/* Header: Ref, Route, Container, Status */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[13px] font-bold text-slate-900">
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
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50/90 p-4 px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onToggleArchive(buyer.id)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
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

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
