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
  Eye,
  Globe,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BuyerAccountFull } from "@/lib/buyers-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface BuyersListViewProps {
  buyers: BuyerAccountFull[];
  onSelectBuyer: (buyer: BuyerAccountFull) => void;
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

export function BuyersListView({
  buyers,
  onSelectBuyer,
  onEditBuyer,
  onToggleArchive,
}: BuyersListViewProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedField(`${label}-${text}`);
    toast.success(`Copied ${label}`, { description: text, duration: 2000 });
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <th className="py-3.5 pl-6 pr-4">Buyer Account</th>
              <th className="px-4 py-3.5">Company Entity</th>
              <th className="px-4 py-3.5">Country & Port</th>
              <th className="px-4 py-3.5">Primary Contact</th>
              <th className="px-4 py-3.5">Email</th>
              <th className="px-4 py-3.5">Phone / WhatsApp</th>
              <th className="px-4 py-3.5 text-center">Active Units</th>
              <th className="px-4 py-3.5 text-center">Status</th>
              <th className="py-3.5 pl-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {buyers.map((buyer) => {
              const initials = getAvatarInitials(buyer.name);
              const flag = getCountryFlag(buyer.countryCode);
              const isEmailCopied = copiedField === `Email-${buyer.email}`;
              const isPhoneCopied = copiedField === `Phone-${buyer.phone}`;

              return (
                <tr
                  key={buyer.id}
                  onClick={() => onSelectBuyer(buyer)}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-slate-50/80"
                >
                  {/* Buyer Avatar & Name */}
                  <td className="py-3.5 pl-6 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="grid size-9 shrink-0 place-items-center rounded-xl border border-[#C7E8E8] bg-[#E8F5F6] text-xs font-bold text-[#0FA3B1] shadow-2xs group-hover:scale-105 transition-transform">
                          {initials}
                        </div>
                        <span
                          className="absolute -bottom-1 -right-1 text-[10px] drop-shadow-2xs"
                          title={buyer.country}
                        >
                          {flag}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-[13.5px] text-slate-900 group-hover:text-[#0FA3B1] transition-colors truncate">
                            {buyer.name}
                          </p>
                          <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-slate-500">
                            {buyer.code}
                          </span>
                        </div>
                        <p className="text-[11.5px] text-slate-400 truncate mt-0.5">
                          {buyer.company}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                      <Building2 className="size-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[160px]">{buyer.company}</span>
                    </div>
                    {buyer.taxId && (
                      <p className="font-mono text-[10.5px] text-slate-400 truncate mt-0.5">
                        {buyer.taxId}
                      </p>
                    )}
                  </td>

                  {/* Country */}
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
                      <span>{flag}</span>
                      <span>{buyer.country}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {buyer.preferredPort || "Main Port"}
                    </p>
                  </td>

                  {/* Contact Person */}
                  <td className="px-4 py-3.5">
                    <p className="text-[13px] font-semibold text-slate-900">
                      {buyer.contactPerson}
                    </p>
                    {buyer.contactRole && (
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {buyer.contactRole}
                      </p>
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(buyer.email, "Email", e)}
                      title="Click to copy email"
                      className="group/btn inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <Mail className="size-3.5 text-slate-400 group-hover/btn:text-[#0FA3B1]" />
                      <span className="max-w-[140px] truncate">{buyer.email}</span>
                      {isEmailCopied ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3 opacity-0 group-hover/btn:opacity-100 text-slate-400 transition-opacity" />
                      )}
                    </button>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(buyer.phone, "Phone", e)}
                      title="Click to copy phone"
                      className="group/btn inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-mono text-[12px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                    >
                      <Phone className="size-3.5 text-slate-400 group-hover/btn:text-[#0FA3B1]" />
                      <span className="whitespace-nowrap">{buyer.phone}</span>
                      {isPhoneCopied ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3 opacity-0 group-hover/btn:opacity-100 text-slate-400 transition-opacity" />
                      )}
                    </button>
                  </td>

                  {/* Active Movements */}
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors",
                        buyer.activeMovements > 0
                          ? "bg-slate-100 text-slate-900 border border-slate-200"
                          : "text-slate-400",
                      )}
                    >
                      <Container
                        className={cn(
                          "size-3.5",
                          buyer.activeMovements > 0 ? "text-[#0FA3B1]" : "text-slate-300",
                        )}
                      />
                      <span>{buyer.activeMovements}</span>
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border",
                        buyer.status === "Active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-100 text-slate-600",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          buyer.status === "Active"
                            ? "bg-emerald-500 animate-pulse"
                            : "bg-slate-400",
                        )}
                      />
                      {buyer.status}
                    </span>
                  </td>

                  {/* Actions Dropdown */}
                  <td onClick={(e) => e.stopPropagation()} className="py-3.5 pl-4 pr-6 text-right">
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
                          {buyer.name}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => onSelectBuyer(buyer)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Eye className="size-3.5 text-[#0FA3B1]" />
                          <span>View Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onEditBuyer(buyer)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          <Edit2 className="size-3.5 text-slate-500" />
                          <span>Edit Buyer</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link
                            to="/new-booking"
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Plus className="size-3.5 text-emerald-600" />
                            <span>New Booking</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="my-1 bg-slate-100" />
                        <DropdownMenuItem
                          onClick={() => onToggleArchive(buyer.id)}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          {buyer.status === "Active" ? (
                            <>
                              <Archive className="size-3.5 text-amber-600" />
                              <span>Archive Buyer</span>
                            </>
                          ) : (
                            <>
                              <ArchiveRestore className="size-3.5 text-emerald-600" />
                              <span>Restore Buyer</span>
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
  );
}
