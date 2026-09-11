import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Building2,
  Check,
  Container,
  Copy,
  Edit2,
  ExternalLink,
  Mail,
  MapPin,
  MoreHorizontal,
  Phone,
  Plus,
  Warehouse,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SupplierAccountFull } from "@/lib/suppliers-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface SupplierCardProps {
  supplier: SupplierAccountFull;
  index?: number;
  onSelect: (supplier: SupplierAccountFull) => void;
  onEdit: (supplier: SupplierAccountFull) => void;
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

export function SupplierCard({
  supplier,
  index = 0,
  onSelect,
  onEdit,
  onToggleArchive,
}: SupplierCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const initials = getAvatarInitials(supplier.name);
  const flag = getCountryFlag(supplier.countryCode);
  const isInactive = supplier.status === "Inactive" || supplier.status === "Archived";

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div
      onClick={() => onSelect(supplier)}
      style={{ animationDelay: `${index * 30}ms` }}
      className={cn(
        "group relative flex min-h-[290px] cursor-pointer flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
        isInactive && "opacity-75 bg-slate-50/50",
      )}
    >
      {/* 1. TOP HEADER: Avatar, Name, Status & Dropdown */}
      <div className="space-y-3.5">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar + Name + Subtitle */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#C7E8E8] bg-[#E8F5F6] text-xs font-bold text-[#0FA3B1] shadow-2xs group-hover:scale-105 transition-transform">
                {initials}
              </div>
              <span
                className="absolute -bottom-1 -right-1 text-[11px] drop-shadow-2xs"
                title={supplier.country}
              >
                {flag}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-[14.5px] text-slate-900 tracking-tight truncate group-hover:text-[#0FA3B1] transition-colors">
                  {supplier.name}
                </h3>
                <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-slate-500">
                  {supplier.code}
                </span>
              </div>
              <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                {supplier.companyName || supplier.subtitle || "Pickup Vendor"} · {supplier.country}
              </p>
            </div>
          </div>

          {/* Top-Right: Status Pill + Actions Menu */}
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 shrink-0">
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
                  supplier.status === "Active" ? "bg-emerald-500 animate-pulse" : "bg-slate-400",
                )}
              />
              <span>{supplier.status}</span>
            </span>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Options for ${supplier.name}`}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {supplier.name}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onSelect(supplier)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <ExternalLink className="size-3.5 text-[#0FA3B1]" />
                  <span>View Details</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onEdit(supplier)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Edit2 className="size-3.5 text-slate-500" />
                  <span>Edit Supplier</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/new-booking"
                    search={{ supplierId: supplier.id }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="size-3.5 text-emerald-600" />
                    <span>Create Booking</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => onToggleArchive(supplier.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {supplier.status === "Active" ? (
                    <>
                      <Archive className="size-3.5 text-amber-600" />
                      <span>Archive Supplier</span>
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="size-3.5 text-emerald-600" />
                      <span>Restore Supplier</span>
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* 2. LOAD POINT HERO CARD */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#0FA3B1]">
              <MapPin className="size-3" />
              <span>Primary Load Point</span>
            </span>
            <span className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
              {supplier.loadPointType}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="text-[13.5px] font-bold text-slate-900 tracking-tight leading-snug truncate">
              {supplier.loadPoint}
            </p>
            <span className="text-[11.5px] font-semibold text-slate-500 shrink-0">
              {supplier.loadPointCity || supplier.city}
            </span>
          </div>
        </div>

        {/* 3. CONTACT CHIPS */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={(e) => copyToClipboard(supplier.email, "Email", e)}
            className="group/btn flex items-center justify-between rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-left text-slate-600 hover:border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Mail className="size-3 text-slate-400 group-hover/btn:text-[#0FA3B1]" />
              <span className="truncate text-[11.5px] font-medium">{supplier.email}</span>
            </div>
            {copiedField === "Email" ? (
              <Check className="size-3 text-emerald-600 shrink-0" />
            ) : (
              <Copy className="size-3 opacity-0 group-hover/btn:opacity-100 text-slate-400 shrink-0 transition-opacity" />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => copyToClipboard(supplier.phone, "Phone", e)}
            className="group/btn flex items-center justify-between rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 text-left text-slate-600 hover:border-slate-200 hover:bg-slate-50 transition-colors font-mono text-[11.5px]"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Phone className="size-3 text-slate-400 group-hover/btn:text-[#0FA3B1]" />
              <span className="truncate font-medium">{supplier.phone}</span>
            </div>
            {copiedField === "Phone" ? (
              <Check className="size-3 text-emerald-600 shrink-0" />
            ) : (
              <Copy className="size-3 opacity-0 group-hover/btn:opacity-100 text-slate-400 shrink-0 transition-opacity" />
            )}
          </button>
        </div>
      </div>

      {/* 4. FOOTER: Active Containers & View Action */}
      <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
              supplier.activeContainers > 0
                ? "bg-slate-100 text-slate-900 border border-slate-200"
                : "text-slate-400",
            )}
          >
            <Container
              className={cn(
                "size-3.5",
                supplier.activeContainers > 0 ? "text-[#0FA3B1]" : "text-slate-300",
              )}
            />
            <span>{supplier.activeContainers} Units</span>
          </span>
          <span className="text-[11px] text-slate-400 truncate">
            {supplier.containersDelta || "in pipeline"}
          </span>
        </div>

        <div className="flex items-center gap-1 text-[12.5px] font-semibold text-slate-700 group-hover:text-[#0FA3B1] transition-colors shrink-0">
          <span>Manage</span>
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
}
