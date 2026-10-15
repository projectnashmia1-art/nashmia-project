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
  Edit2,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Plus,
  Ship,
  Sparkles,
  User,
  Warehouse,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SupplierAccountFull, SupplierMovementRecord } from "@/lib/suppliers-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface SupplierDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: SupplierAccountFull | null;
  movements: SupplierMovementRecord[];
  onEditSupplier: (supplier: SupplierAccountFull) => void;
  onToggleArchive: (supplierId: string) => void;
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
    NL: "🇳🇱",
    US: "🇺🇸",
    AE: "🇦🇪",
    CN: "🇨🇳",
  };
  return flags[countryCode] || "🌐";
}

export function SupplierDetailDrawer({
  open,
  onOpenChange,
  supplier,
  movements,
  onEditSupplier,
  onToggleArchive,
}: SupplierDetailDrawerProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "movements" | "logistics">("overview");

  if (!supplier) return null;

  const initials = getAvatarInitials(supplier.name);
  const flag = getCountryFlag(supplier.countryCode);
  const isInactive = supplier.status === "Inactive" || supplier.status === "Archived";

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(`${label}-${text}`);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[760px] lg:max-w-[820px] p-0 overflow-hidden sm:rounded-[28px] bg-white shadow-2xl max-h-[92vh] flex flex-col">
        {/* TOP HEADER SECTION */}
        <div className="relative border-b border-slate-200 bg-gradient-to-r from-[#E8F5F6]/70 via-white to-slate-50 p-5 sm:p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="relative shrink-0">
                <div className="grid size-14 sm:size-16 place-items-center rounded-2xl border border-[#C7E8E8] bg-white text-[19px] font-bold text-[#0FA3B1] shadow-sm">
                  {initials}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 text-base drop-shadow-xs bg-white rounded-full p-0.5 border border-slate-100"
                  title={supplier.country}
                >
                  {flag}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {supplier.name}
                  </DialogTitle>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                      supplier.status === "Active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-600",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        supplier.status === "Active"
                          ? "bg-emerald-500 animate-pulse"
                          : "bg-slate-400",
                      )}
                    />
                    <span>{supplier.status}</span>
                  </span>
                </div>

                <DialogDescription className="text-[13px] text-slate-500 mt-0.5 font-medium">
                  {supplier.companyName || supplier.subtitle || "Pickup Vendor & Manufacturer"}
                </DialogDescription>

                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="rounded-lg bg-white border border-slate-200 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700 shadow-2xs">
                    {supplier.code}
                  </span>
                  <span className="text-[11.5px] text-slate-400">
                    {supplier.city}, {supplier.country}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11.5px] text-slate-400">Created {supplier.createdAt}</span>
                </div>
              </div>
            </div>

            {/* HEADER ACTIONS */}
            <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
              <Link
                to="/new-booking"
                search={{ supplierId: supplier.id }}
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none inline-flex h-9.5 items-center justify-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-4 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                <Plus className="size-3.5" />
                <span>Create Booking</span>
              </Link>

              <button
                type="button"
                onClick={() => onEditSupplier(supplier)}
                className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Edit Supplier"
              >
                <Edit2 className="size-3.5 text-slate-500" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </div>
          </div>

          {/* NAVIGATION TABS */}
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
              Overview & Contact
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logistics")}
              className={cn(
                "pb-2 text-xs font-semibold px-3 border-b-2 transition-all",
                activeTab === "logistics"
                  ? "border-[#0FA3B1] text-[#0FA3B1]"
                  : "border-transparent text-slate-500 hover:text-slate-800",
              )}
            >
              Loading Facility & Logistics
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
              <span>Movements</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-bold text-slate-600">
                {movements.length}
              </span>
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-5">
              {/* STATS STRIP */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Active Shipments
                  </span>
                  <p className="mt-1 text-[22px] font-bold text-slate-900 leading-tight">
                    {supplier.activeContainers || 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Total Movements
                  </span>
                  <p className="mt-1 text-[22px] font-bold text-slate-900 leading-tight">
                    {movements.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Load Point Type
                  </span>
                  <p className="mt-1 text-[13.5px] font-bold text-[#0FA3B1] truncate leading-snug">
                    {supplier.loadPointType}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-2xs">
                  <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                    Account Status
                  </span>
                  <p className="mt-1 text-[13.5px] font-bold text-emerald-700 truncate leading-snug">
                    {supplier.status}
                  </p>
                </div>
              </div>

              {/* CONTACT DETAILS */}
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Primary Contact & Communications
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Contact Person
                    </p>
                    <p className="font-bold text-slate-900 text-[14.5px]">
                      {supplier.contactPerson}
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      {supplier.contactRole || "Lead Cargo Representative"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 space-y-1">
                    <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                      Facility Location
                    </p>
                    <p className="font-bold text-slate-900 text-[14.5px] flex items-center gap-1.5">
                      <span>{flag}</span>
                      <span>
                        {supplier.city}, {supplier.country}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 font-mono">Code: {supplier.code}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2 flex items-center justify-between shadow-2xs">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Email Address
                      </p>
                      <p className="font-semibold text-slate-900 text-[14px] truncate mt-0.5">
                        {supplier.email}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(supplier.email, "Email")}
                      className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                    >
                      {copiedField === `Email-${supplier.email}` ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2 flex items-center justify-between shadow-2xs">
                    <div className="min-w-0">
                      <p className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                        Phone / WhatsApp
                      </p>
                      <p className="font-mono font-semibold text-slate-900 text-[14px] mt-0.5">
                        {supplier.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(supplier.phone, "Phone")}
                      className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors shrink-0"
                    >
                      {copiedField === `Phone-${supplier.phone}` ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "logistics" && (
            <div className="space-y-5">
              {/* PRIMARY LOADING POINT */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0FA3B1]">
                    <MapPin className="size-4" />
                    <span>Primary Loading Point</span>
                  </span>
                  <span className="rounded-full bg-white border border-slate-200 px-3 py-0.5 text-xs font-bold text-slate-700 shadow-2xs">
                    {supplier.loadPointType}
                  </span>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-[#0FA3B1] shadow-2xs border border-slate-200">
                    <Warehouse className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[17px] font-bold text-slate-900 leading-tight">
                      {supplier.loadPoint}
                    </h4>
                    <p className="text-[13px] text-slate-600 mt-1">{supplier.address}</p>
                    {supplier.operatingHours && (
                      <p className="text-[12px] text-slate-500 flex items-center gap-1.5 mt-2">
                        <Clock className="size-3.5 text-slate-400" />
                        <span>
                          Operating Hours: <strong>{supplier.operatingHours}</strong>
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                {supplier.pickupInstructions && (
                  <div className="rounded-xl bg-white p-3.5 text-[12.5px] text-slate-700 border border-slate-200 shadow-2xs">
                    <span className="font-bold text-slate-900">
                      Dispatch &amp; Loading Instructions:{" "}
                    </span>
                    {supplier.pickupInstructions}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "movements" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900">
                    Active &amp; Recorded Shipments
                  </h4>
                  <p className="text-xs text-slate-500">
                    Live movement history linked to this supplier
                  </p>
                </div>
                <Link
                  to="/new-booking"
                  search={{ supplierId: supplier.id }}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0FA3B1] hover:underline"
                >
                  <span>New Booking</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>

              {movements.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                  <Container className="mx-auto size-8 text-slate-300" />
                  <p className="mt-2 text-[13.5px] font-bold text-slate-800">
                    No movements recorded yet
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Bookings created with this pickup vendor will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {movements.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[13.5px] text-slate-900">
                            {m.ref}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            → {m.buyerName}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                            m.status === "In Transit"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : m.status === "Delivered"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200",
                          )}
                        >
                          ● {m.status}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
                        <div>
                          <span className="font-semibold text-slate-900">{m.polName}</span>
                          {" → "}
                          <span className="font-semibold text-slate-900">{m.podName}</span>
                        </div>
                        <div className="font-mono text-xs text-[#0FA3B1] font-bold">
                          {m.containerSize} × {m.containersCount}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11.5px] text-slate-500 pt-1.5 bg-slate-50 -mx-4 -mb-4 px-4 py-2 rounded-b-2xl border-t border-slate-100">
                        <span>
                          ETD: <strong className="text-slate-800">{m.etd}</strong>
                        </span>
                        <span>
                          ETA: <strong className="text-slate-800">{m.eta}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50/90 p-4 px-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onToggleArchive(supplier.id)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            {supplier.status === "Active" ? (
              <>
                <Archive className="size-3.5 text-amber-600" />
                <span>Archive Supplier</span>
              </>
            ) : (
              <>
                <ArchiveRestore className="size-3.5 text-emerald-600" />
                <span>Activate Supplier</span>
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
