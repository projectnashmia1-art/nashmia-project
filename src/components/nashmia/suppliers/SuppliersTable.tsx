import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  Check,
  Container,
  Copy,
  Edit2,
  ExternalLink,
  Eye,
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
import { SuppliersMobileCards } from "./SuppliersMobileCards";

interface SuppliersTableProps {
  suppliers: SupplierAccountFull[];
  onSelectSupplier: (supplier: SupplierAccountFull) => void;
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

export function SuppliersTable({
  suppliers,
  onSelectSupplier,
  onEditSupplier,
  onToggleArchive,
}: SuppliersTableProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(`${label}-${text}`);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div>
      {/* Mobile Cards (Visible below md) */}
      <div className="md:hidden">
        <SuppliersMobileCards
          suppliers={suppliers}
          onSelectSupplier={onSelectSupplier}
          onEditSupplier={onEditSupplier}
          onToggleArchive={onToggleArchive}
        />
      </div>

      {/* Desktop Table (Visible md and up) */}
      <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 pl-6 pr-4">Supplier Account</th>
                <th className="px-4 py-3.5">Country & City</th>
                <th className="px-4 py-3.5">Pickup Loading Point</th>
                <th className="px-4 py-3.5">Primary Contact</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Phone</th>
                <th className="px-4 py-3.5 text-center">Active Units</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((supplier) => {
                const initials = getAvatarInitials(supplier.name);
                const flag = getCountryFlag(supplier.countryCode);
                const isInactive = supplier.status === "Inactive" || supplier.status === "Archived";
                const isEmailCopied = copiedField === `Email-${supplier.email}`;
                const isPhoneCopied = copiedField === `Phone-${supplier.phone}`;

                return (
                  <tr
                    key={supplier.id}
                    onClick={() => onSelectSupplier(supplier)}
                    className={cn(
                      "group cursor-pointer transition-colors duration-150 hover:bg-slate-50/80",
                      isInactive && "opacity-75 bg-slate-50/40",
                    )}
                  >
                    {/* 1. Supplier Name & Avatar */}
                    <td className="py-3.5 pl-6 pr-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#C7E8E8] bg-[#E8F5F6] text-xs font-bold text-[#0FA3B1] shadow-2xs group-hover:scale-105 transition-transform">
                            {initials}
                          </div>
                          <span
                            className="absolute -bottom-1 -right-1 text-[10px] drop-shadow-2xs"
                            title={supplier.country}
                          >
                            {flag}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-[13.5px] text-slate-900 group-hover:text-[#0FA3B1] transition-colors truncate">
                              {supplier.name}
                            </p>
                            <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-slate-500">
                              {supplier.code}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                            {supplier.companyName || supplier.subtitle || "Pickup Vendor"}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* 2. Country */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                        <span>{flag}</span>
                        <span>{supplier.country}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">{supplier.city}</p>
                    </td>

                    {/* 3. LOAD POINT */}
                    <td className="px-4 py-3.5">
                      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 shadow-2xs">
                        <MapPin className="size-3.5 text-[#0FA3B1] shrink-0" />
                        <div>
                          <div className="font-bold text-slate-900 text-[12.5px] leading-tight">
                            {supplier.loadPoint}
                          </div>
                          <div className="text-[10.5px] text-slate-500 font-medium">
                            {supplier.loadPointType} · {supplier.loadPointCity || supplier.city}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 4. Contact Person */}
                    <td className="px-4 py-3.5">
                      <p className="text-[13px] font-semibold text-slate-900">
                        {supplier.contactPerson}
                      </p>
                      {supplier.contactRole && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {supplier.contactRole}
                        </p>
                      )}
                    </td>

                    {/* 5. Email */}
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={(e) => copyToClipboard(supplier.email, "Email", e)}
                        title="Click to copy email"
                        className="group/btn inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <Mail className="size-3.5 text-slate-400 group-hover/btn:text-[#0FA3B1]" />
                        <span className="max-w-[140px] truncate">{supplier.email}</span>
                        {isEmailCopied ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3 opacity-0 group-hover/btn:opacity-100 text-slate-400 transition-opacity" />
                        )}
                      </button>
                    </td>

                    {/* 6. Phone */}
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={(e) => copyToClipboard(supplier.phone, "Phone", e)}
                        title="Click to copy phone"
                        className="group/btn inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <Phone className="size-3.5 text-slate-400 group-hover/btn:text-[#0FA3B1]" />
                        <span className="whitespace-nowrap">{supplier.phone}</span>
                        {isPhoneCopied ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3 opacity-0 group-hover/btn:opacity-100 text-slate-400 transition-opacity" />
                        )}
                      </button>
                    </td>

                    {/* 7. Active Containers */}
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
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
                        <span>{supplier.activeContainers}</span>
                      </span>
                    </td>

                    {/* 8. Status */}
                    <td className="px-4 py-3.5 text-center">
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
                        {supplier.status}
                      </span>
                    </td>

                    {/* 9. Actions Dropdown */}
                    <td
                      onClick={(e) => e.stopPropagation()}
                      className="py-3.5 pl-4 pr-6 text-right"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
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
                            onClick={() => onSelectSupplier(supplier)}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="size-3.5 text-[#0FA3B1]" />
                            <span>View Details</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onEditSupplier(supplier)}
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
                              <span>New Booking</span>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
