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
  Globe,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  User,
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

interface BuyersTableProps {
  buyers: BuyerAccountFull[];
  onSelectBuyer: (buyer: BuyerAccountFull) => void;
  onEditBuyer: (buyer: BuyerAccountFull) => void;
  onToggleArchive: (buyerId: string) => void;
}

// Generate consistent soft tones for avatars
const AVATAR_TONES = [
  { bg: "bg-[#6A80A9]/12", text: "text-[#6A80A9]", border: "border-[#6A80A9]/25" },
  { bg: "bg-[#C7D5BF]/25", text: "text-[#4A5D3F]", border: "border-[#C7D5BF]/50" },
  { bg: "bg-indigo-500/12", text: "text-indigo-600", border: "border-indigo-500/25" },
  { bg: "bg-amber-500/12", text: "text-amber-700", border: "border-amber-500/25" },
  { bg: "bg-teal-500/12", text: "text-teal-700", border: "border-teal-500/25" },
  { bg: "bg-cyan-500/12", text: "text-cyan-700", border: "border-cyan-500/25" },
];

function getAvatarInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getToneForId(id: string) {
  const charCode = id.charCodeAt(id.length - 1) || 0;
  return AVATAR_TONES[charCode % AVATAR_TONES.length];
}

export function BuyersTable({
  buyers,
  onSelectBuyer,
  onEditBuyer,
  onToggleArchive,
}: BuyersTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/70 shadow-[0_16px_40px_rgba(15,23,42,0.04)] backdrop-blur-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          {/* Table Header */}
          <thead className="border-b border-slate-200/60 bg-white/40 text-[12px] font-semibold uppercase tracking-wider text-slate-400">
            <tr>
              <th scope="col" className="py-4 pl-6 pr-4">
                Buyer & Account
              </th>
              <th scope="col" className="px-4 py-4">
                Company
              </th>
              <th scope="col" className="px-4 py-4">
                Country
              </th>
              <th scope="col" className="px-4 py-4">
                Contact Person
              </th>
              <th scope="col" className="px-4 py-4">
                Email
              </th>
              <th scope="col" className="px-4 py-4">
                Phone
              </th>
              <th scope="col" className="px-4 py-4 text-center">
                Active Containers
              </th>
              <th scope="col" className="px-4 py-4">
                Status
              </th>
              <th scope="col" className="py-4 pl-4 pr-6 text-right">
                Actions
              </th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-100">
            {buyers.map((buyer) => {
              const tone = getToneForId(buyer.id);
              const initials = getAvatarInitials(buyer.name);
              const isArchived = buyer.status === "Archived";

              return (
                <tr
                  key={buyer.id}
                  onClick={() => onSelectBuyer(buyer)}
                  className={cn(
                    "group cursor-pointer transition-all duration-150 ease-glass hover:bg-[#E8F1F3]/40",
                    isArchived && "opacity-70 bg-slate-50/40",
                  )}
                >
                  {/* Buyer Avatar & Name */}
                  <td className="py-4 pl-6 pr-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-[13px] border text-xs font-bold tracking-tight shadow-xs transition-transform duration-200 group-hover:scale-105",
                          tone.bg,
                          tone.text,
                          tone.border,
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-black tracking-[-0.01em]">
                            {buyer.name}
                          </span>
                          <span className="rounded-[6px] border border-slate-200/80 bg-white/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500">
                            {buyer.code}
                          </span>
                        </div>
                        <p className="truncate text-xs text-slate-400">{buyer.company}</p>
                      </div>
                    </div>
                  </td>

                  {/* Company */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-[13px] text-slate-700">
                      <Building2 className="size-3.5 text-slate-400" />
                      <span className="max-w-[160px] truncate">{buyer.company}</span>
                    </div>
                  </td>

                  {/* Country */}
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
                      <Globe className="size-3.5 text-slate-400" />
                      <span>{buyer.country}</span>
                    </div>
                  </td>

                  {/* Contact Person */}
                  <td className="px-4 py-4">
                    <div className="text-[13px]">
                      <p className="font-medium text-slate-900">{buyer.contactPerson}</p>
                      {buyer.contactRole && (
                        <p className="text-xs text-slate-400">{buyer.contactRole}</p>
                      )}
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(buyer.email, "Email", e)}
                      title="Click to copy email"
                      className="group/email inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-white hover:text-[#6A80A9]"
                    >
                      <Mail className="size-3.5 text-slate-400 group-hover/email:text-[#6A80A9]" />
                      <span className="max-w-[150px] truncate">{buyer.email}</span>
                      {copiedId === buyer.email ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3 opacity-0 group-hover/email:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={(e) => copyToClipboard(buyer.phone, "Phone", e)}
                      title="Click to copy phone"
                      className="group/phone inline-flex items-center gap-1.5 rounded-[8px] px-2 py-1 font-mono text-xs text-slate-600 transition-colors hover:bg-white hover:text-[#6A80A9]"
                    >
                      <Phone className="size-3 text-slate-400 group-hover/phone:text-[#6A80A9]" />
                      <span className="whitespace-nowrap">{buyer.phone}</span>
                      {copiedId === buyer.phone ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3 opacity-0 group-hover/phone:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </td>

                  {/* Active Containers (Visually Subtle) */}
                  <td className="px-4 py-4 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                        buyer.activeContainers > 0
                          ? "border border-slate-200/80 bg-white text-slate-800 shadow-2xs"
                          : "border border-transparent text-slate-400",
                      )}
                    >
                      <Container
                        className={cn(
                          "size-3.5",
                          buyer.activeContainers > 0 ? "text-[#6A80A9]" : "text-slate-300",
                        )}
                      />
                      <span>
                        {buyer.activeContainers} {buyer.activeContainers === 1 ? "unit" : "units"}
                      </span>
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white/80 px-2.5 py-1 text-xs font-medium">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          buyer.status === "Active"
                            ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            : "bg-slate-400",
                        )}
                      />
                      <span
                        className={
                          buyer.status === "Active"
                            ? "text-slate-900 font-medium"
                            : "text-slate-500"
                        }
                      >
                        {buyer.status}
                      </span>
                    </div>
                  </td>

                  {/* Actions Dropdown */}
                  <td className="py-4 pl-4 pr-6 text-right">
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-end"
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Actions for ${buyer.name}`}
                            className="grid size-8 place-items-center rounded-[10px] border border-transparent text-slate-400 transition-all hover:border-slate-200 hover:bg-white hover:text-slate-800 focus:outline-none"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.1)] backdrop-blur-2xl"
                        >
                          <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                            {buyer.name}
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => onSelectBuyer(buyer)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <Eye className="size-4 text-[#6A80A9]" />
                            <span>View Details</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => onEditBuyer(buyer)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                          >
                            <Edit2 className="size-4 text-slate-500" />
                            <span>Edit Buyer</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem asChild>
                            <Link
                              to="/new-booking"
                              className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                            >
                              <Plus className="size-4 text-[#C7D5BF]" />
                              <span>New Booking</span>
                            </Link>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-1 bg-slate-100" />

                          <DropdownMenuItem
                            onClick={() => onToggleArchive(buyer.id)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-600 hover:bg-slate-100"
                          >
                            {buyer.status === "Active" ? (
                              <>
                                <Archive className="size-4 text-amber-600" />
                                <span>Archive Buyer</span>
                              </>
                            ) : (
                              <>
                                <ArchiveRestore className="size-4 text-emerald-600" />
                                <span>Restore Buyer</span>
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
