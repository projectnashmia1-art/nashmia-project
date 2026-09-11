import { useState } from "react";
import {
  Anchor,
  Archive,
  ArchiveRestore,
  ArrowRight,
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

interface BuyerCardProps {
  buyer: BuyerAccountFull;
  onSelect: (buyer: BuyerAccountFull) => void;
  onEdit: (buyer: BuyerAccountFull) => void;
  onToggleArchive: (buyerId: string) => void;
  index: number;
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

export function BuyerCard({ buyer, onSelect, onEdit, onToggleArchive, index }: BuyerCardProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const initials = getAvatarInitials(buyer.name);
  const isInactive = buyer.status === "Inactive" || buyer.status === "Archived";
  const flag = getCountryFlag(buyer.countryCode);

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
      onClick={() => onSelect(buyer)}
      style={{ animationDelay: `${index * 30}ms` }}
      className={cn(
        "group relative flex min-h-[290px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03),0_8px_20px_-6px_rgba(0,0,0,0.04)] transition-all duration-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08)] active:translate-y-0",
        isInactive && "bg-slate-50/75 opacity-75",
      )}
    >
      {/* Top Accent Gradient Line on hover */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#0FA3B1] via-[#45DFEB] to-[#0FA3B1] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      {/* TOP SECTION: Avatar, Name, Company, Code & Actions */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar with flag indicator */}
            <div className="relative">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl border border-[#C7E8E8] bg-[#E8F5F6] text-[13.5px] font-bold text-[#0FA3B1] shadow-2xs transition-transform duration-200 group-hover:scale-105">
                {initials}
              </div>
              <span
                className="absolute -bottom-1 -right-1 text-xs drop-shadow-sm"
                title={buyer.country}
              >
                {flag}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[16px] font-bold tracking-tight text-slate-900 leading-snug group-hover:text-[#0FA3B1] transition-colors">
                  {buyer.name}
                </h3>
                <span className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-slate-500">
                  {buyer.code}
                </span>
              </div>
              <p className="truncate text-[12.5px] text-slate-500 font-medium">{buyer.company}</p>
            </div>
          </div>

          {/* Top Right: Three-dot action menu */}
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for ${buyer.name}`}
                  className="grid size-8 place-items-center rounded-lg border border-transparent text-slate-400 transition-colors hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {buyer.name}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onSelect(buyer)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                >
                  <ExternalLink className="size-3.5 text-slate-400" />
                  <span>View Full Dossier</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onEdit(buyer)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                >
                  <Edit2 className="size-3.5 text-slate-400" />
                  <span>Edit Account</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/new-booking"
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-[#0FA3B1] hover:bg-[#E8F5F6]"
                  >
                    <Plus className="size-3.5 text-[#0FA3B1]" />
                    <span>Create Booking</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => onToggleArchive(buyer.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100"
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
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* STATUS & PORT BADGE ROW */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Status Badge */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
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
            <span>{buyer.status}</span>
          </span>

          {/* Preferred Port / Location */}
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
            <Anchor className="size-3 text-slate-400" />
            <span className="truncate max-w-[150px]">{buyer.preferredPort || buyer.country}</span>
          </span>
        </div>

        {/* CONTACT PERSON & FAST COPY ACTIONS */}
        <div className="mt-3.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-semibold text-slate-800 truncate">
              {buyer.contactPerson}
              {buyer.contactRole && (
                <span className="ml-1.5 text-[11.5px] font-normal text-slate-400">
                  · {buyer.contactRole}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center justify-between text-[11.5px] text-slate-500">
            <div className="flex items-center gap-1.5 truncate">
              <Mail className="size-3 text-slate-400 shrink-0" />
              <span className="truncate">{buyer.email}</span>
            </div>
            <button
              type="button"
              onClick={(e) => copyToClipboard(buyer.email, "Email", e)}
              title="Copy Email"
              className="ml-1 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-800 shrink-0 transition-colors"
            >
              {copiedField === "Email" ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Copy className="size-3 opacity-60" />
              )}
            </button>
          </div>
        </div>

        {/* MOVEMENT PROGRESS & STATS */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5">
              <Container className="size-3.5 text-[#0FA3B1]" />
              <span>
                {buyer.activeMovements} Active{" "}
                <span className="font-normal text-slate-400">({buyer.totalMovements} Total)</span>
              </span>
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-500">
              {buyer.deltaThisMonth}
            </span>
          </div>

          {/* Micro Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0FA3B1] to-[#45DFEB] transition-all duration-300"
              style={{ width: `${Math.max(buyer.progressPercent, 6)}%` }}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="mt-4 border-t border-slate-100 pt-3 flex items-center justify-between gap-2">
        <Link
          to="/new-booking"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
        >
          <Plus className="size-3 text-[#0FA3B1]" />
          <span>New Booking</span>
        </Link>

        <div className="flex items-center gap-1 text-[12.5px] font-semibold text-slate-700 transition-colors group-hover:text-[#0FA3B1] shrink-0">
          <span>View Dossier</span>
          <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
}
