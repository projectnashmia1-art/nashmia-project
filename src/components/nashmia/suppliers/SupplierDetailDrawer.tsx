import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[580px] p-0 border-l border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col"
      >
        {/* TOP HEADER SECTION */}
        <div className="border-b border-slate-100 bg-slate-50/60 p-6 pb-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[#C7E8E8] bg-[#E8F5F6] text-[18px] font-bold text-[#0FA3B1] shadow-2xs">
                  {initials}
                </div>
                <span
                  className="absolute -bottom-1 -right-1 text-sm drop-shadow-2xs"
                  title={supplier.country}
                >
                  {flag}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <SheetTitle className="text-xl font-bold text-slate-900">
                    {supplier.name}
                  </SheetTitle>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
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
                <p className="text-[13px] text-slate-500 mt-0.5">
                  {supplier.companyName || supplier.subtitle || "Pickup Vendor"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-600">
                    {supplier.code}
                  </span>
                  <span className="text-[11.5px] text-slate-400">Created {supplier.createdAt}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PRIMARY ACTION BUTTONS */}
          <div className="mt-5 flex items-center gap-2.5">
            <Link
              to="/new-booking"
              search={{ supplierId: supplier.id }}
              onClick={() => onOpenChange(false)}
              className="flex-1 flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-5 text-[13.5px] font-semibold text-white shadow-[0_2px_10px_rgba(15,163,177,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              <Plus className="size-4" />
              <span>Create Booking</span>
            </Link>

            <button
              type="button"
              onClick={() => onEditSupplier(supplier)}
              className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title="Edit Supplier"
            >
              <Edit2 className="size-4" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1. PICKUP LOCATION / LOAD POINT DETAIL */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#0FA3B1]">
                <MapPin className="size-3.5" />
                <span>Primary Loading Point</span>
              </span>
              <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs">
                {supplier.loadPointType}
              </span>
            </div>

            <div className="flex items-start gap-3 pt-1">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#0FA3B1] shadow-2xs border border-slate-200">
                <Warehouse className="size-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-[16px] font-bold text-slate-900 leading-tight">
                  {supplier.loadPoint}
                </h4>
                <p className="text-[12.5px] text-slate-600 mt-1">{supplier.address}</p>
                {supplier.operatingHours && (
                  <p className="text-[11.5px] text-slate-500 flex items-center gap-1 mt-1">
                    <Clock className="size-3 text-slate-400" />
                    <span>Operating Hours: {supplier.operatingHours}</span>
                  </p>
                )}
              </div>
            </div>

            {supplier.pickupInstructions && (
              <div className="mt-2 rounded-xl bg-white p-3 text-[12px] text-slate-600 border border-slate-200">
                <span className="font-bold text-slate-900">Dispatch Instructions: </span>
                {supplier.pickupInstructions}
              </div>
            )}
          </div>

          {/* 2. SUPPLIER INFORMATION GRID */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Vendor Information
            </h3>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Country & Port
                </p>
                <div className="flex items-center gap-1.5 font-bold text-slate-900 text-[14px] mt-0.5">
                  <span>{flag}</span>
                  <span>{supplier.country}</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{supplier.city}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Contact Person
                </p>
                <p className="font-bold text-slate-900 text-[14px] mt-0.5">
                  {supplier.contactPerson}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {supplier.contactRole || "Cargo Representative"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:col-span-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Email Address
                  </p>
                  <p className="font-semibold text-slate-900 text-[13.5px] truncate mt-0.5">
                    {supplier.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(supplier.email, "Email")}
                  className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  {copiedField === `Email-${supplier.email}` ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:col-span-2 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Phone / WhatsApp
                  </p>
                  <p className="font-mono font-semibold text-slate-900 text-[13.5px] mt-0.5">
                    {supplier.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(supplier.phone, "Phone")}
                  className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
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

          {/* 3. RECENT MOVEMENTS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Active & Recent Movements
              </h3>
              <span className="text-[11.5px] font-semibold text-slate-600 font-mono">
                {supplier.activeContainers} Active Containers
              </span>
            </div>

            {movements.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                <Container className="mx-auto size-6 text-slate-300" />
                <p className="mt-2 text-[13px] font-semibold text-slate-700">
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
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[13px] text-slate-900">
                          {m.ref}
                        </span>
                        <span className="text-xs text-slate-500">→ {m.buyerName}</span>
                      </div>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold border",
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

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 bg-slate-50 -mx-4 -mb-4 px-4 py-2 rounded-b-xl border-t border-slate-100">
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
        </div>

        {/* DRAWER FOOTER */}
        <div className="border-t border-slate-200 bg-slate-50/75 p-4 flex items-center justify-between">
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
            className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
