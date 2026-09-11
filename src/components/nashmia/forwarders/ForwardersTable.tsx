import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  Check,
  ChevronRight,
  Copy,
  Edit2,
  ExternalLink,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Send,
  Ship,
  Sparkles,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ForwarderAccount } from "@/lib/forwarders-data";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface ForwardersTableProps {
  forwarders: ForwarderAccount[];
  onSelectForwarder: (forwarder: ForwarderAccount) => void;
  onEditForwarder: (forwarder: ForwarderAccount) => void;
  onToggleArchive: (forwarderId: string) => void;
  onSendTestEmail: (forwarder: ForwarderAccount) => void;
}

function getAvatarInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function ForwardersTable({
  forwarders,
  onSelectForwarder,
  onEditForwarder,
  onToggleArchive,
  onSendTestEmail,
}: ForwardersTableProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (e: React.MouseEvent, text: string, id: string, label: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success(`Copied ${label}`, {
      description: text,
      duration: 2000,
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="relative overflow-hidden rounded-[20px] border border-white/85 bg-white/80 shadow-[0_12px_36px_rgba(15,23,42,0.035)] backdrop-blur-2xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="border-b border-slate-100/90 bg-slate-50/40 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              <th className="py-4 pl-6 pr-4">Forwarder</th>
              <th className="py-4 px-4">Contact Person</th>
              <th className="py-4 px-4">Email</th>
              <th className="py-4 px-4">WhatsApp</th>
              <th className="py-4 px-4">Shipping Lines</th>
              <th className="py-4 px-4 text-center">Active Bookings</th>
              <th className="py-4 px-4 text-center">Status</th>
              <th className="py-4 pl-4 pr-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100/80 text-[13.5px]">
            {forwarders.map((fwd) => {
              const initials = getAvatarInitials(fwd.name);
              const isInactive = fwd.status === "Inactive" || fwd.status === "Archived";

              return (
                <tr
                  key={fwd.id}
                  onClick={() => onSelectForwarder(fwd)}
                  className={cn(
                    "group cursor-pointer transition-colors duration-150",
                    isInactive
                      ? "bg-slate-50/30 opacity-70 hover:bg-[#E8F1F3]/30 hover:opacity-100"
                      : "hover:bg-[#E8F1F3]/40",
                  )}
                >
                  {/* Column 1: Forwarder (Identity Area) */}
                  <td className="py-4 pl-6 pr-4">
                    <div className="flex items-center gap-3.5">
                      {/* Circular Initials Avatar */}
                      <div className="grid size-10 shrink-0 place-items-center rounded-full border border-[#6A80A9]/20 bg-[#E8F1F3] text-[13px] font-bold text-[#6A80A9] shadow-2xs group-hover:border-[#6A80A9]/40 group-hover:scale-105 transition-all">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#000000] text-[14.5px] group-hover:text-[#6A80A9] transition-colors truncate">
                            {fwd.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="inline-block rounded-md bg-[#E8F1F3]/80 px-1.5 py-0.5 text-[10.5px] font-medium text-[#6A80A9]">
                            {fwd.badge}
                          </span>
                          <span className="text-[11px] text-slate-400">·</span>
                          <span className="text-[11.5px] text-slate-500 font-mono">{fwd.code}</span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Column 2: Contact Person */}
                  <td className="py-4 px-4">
                    <div className="min-w-0">
                      <p className="font-medium text-[#000000]">{fwd.contactPerson}</p>
                      {fwd.contactRole && (
                        <p className="text-[11.5px] text-slate-400 truncate">{fwd.contactRole}</p>
                      )}
                    </div>
                  </td>

                  {/* Column 3: Email */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="max-w-[190px] truncate font-medium text-slate-700">
                        {fwd.email}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => copyToClipboard(e, fwd.email, `email-${fwd.id}`, "Email")}
                        className="grid size-7 place-items-center rounded-md border border-transparent text-slate-400 opacity-0 group-hover:opacity-100 hover:border-slate-200 hover:bg-white hover:text-black transition-all"
                        title="Copy email"
                      >
                        {copiedId === `email-${fwd.id}` ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Column 4: WhatsApp */}
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-mono text-[12.5px] text-slate-700">
                        <MessageCircle className="size-3 text-emerald-600" />
                        <span>{fwd.whatsapp}</span>
                      </span>
                      <button
                        type="button"
                        onClick={(e) =>
                          copyToClipboard(e, fwd.whatsapp, `wa-${fwd.id}`, "WhatsApp")
                        }
                        className="grid size-7 place-items-center rounded-md border border-transparent text-slate-400 opacity-0 group-hover:opacity-100 hover:border-slate-200 hover:bg-white hover:text-black transition-all"
                        title="Copy WhatsApp number"
                      >
                        {copiedId === `wa-${fwd.id}` ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Column 5: Connected Shipping Lines */}
                  <td className="py-4 px-4">
                    <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                      {fwd.shippingLines.map((sl) => (
                        <span
                          key={sl}
                          className="inline-flex items-center gap-1 rounded-[8px] border border-[#6A80A9]/20 bg-[#E8F1F3]/50 px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs"
                        >
                          <Ship className="size-2.5 text-[#6A80A9]" />
                          <span>{sl}</span>
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Column 6: Active Bookings */}
                  <td className="py-4 px-4 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-[#E8F1F3]/90 px-3 py-1 font-mono text-[12.5px] font-bold text-[#6A80A9] border border-[#6A80A9]/25 shadow-2xs">
                      {fwd.activeBookings} active
                    </span>
                  </td>

                  {/* Column 7: Status */}
                  <td className="py-4 px-4 text-center">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium tracking-tight",
                        fwd.status === "Active"
                          ? "bg-[#C7D5BF]/40 text-[#2B3B24] border border-[#C7D5BF]/70"
                          : "bg-slate-100 text-slate-500 border border-slate-200",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          fwd.status === "Active" ? "bg-[#3D5A32]" : "bg-slate-400",
                        )}
                      />
                      <span>{fwd.status}</span>
                    </span>
                  </td>

                  {/* Column 8: Actions */}
                  <td className="py-4 pl-4 pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {/* Create Booking Action */}
                      <Link
                        to="/new-booking"
                        search={{ bookingAgentId: fwd.id }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[#000000] px-3 text-[12px] font-medium text-white shadow-2xs transition-all hover:bg-slate-900 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <Plus className="size-3" />
                        <span>Book</span>
                      </Link>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="More actions"
                            className="grid size-8 place-items-center rounded-[9px] border border-slate-200/70 bg-white/70 text-slate-500 hover:bg-white hover:text-black hover:shadow-2xs transition-all"
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-48 rounded-[16px] border border-white/80 bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
                        >
                          <DropdownMenuItem
                            onClick={() => onSelectForwarder(fwd)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                          >
                            <ChevronRight className="size-3.5 text-[#6A80A9]" />
                            <span>View Profile</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => onEditForwarder(fwd)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                          >
                            <Edit2 className="size-3.5 text-slate-500" />
                            <span>Edit Forwarder</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => onSendTestEmail(fwd)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100"
                          >
                            <Send className="size-3.5 text-[#6A80A9]" />
                            <span>Send Test Email</span>
                          </DropdownMenuItem>

                          <DropdownMenuSeparator className="my-1 bg-slate-100" />

                          <DropdownMenuItem
                            onClick={() => onToggleArchive(fwd.id)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-[13px] text-amber-700 hover:bg-amber-50"
                          >
                            {fwd.status === "Active" ? (
                              <>
                                <Archive className="size-3.5" />
                                <span>Archive Forwarder</span>
                              </>
                            ) : (
                              <>
                                <ArchiveRestore className="size-3.5" />
                                <span>Activate Forwarder</span>
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
