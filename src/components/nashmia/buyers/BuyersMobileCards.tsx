import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Building2,
  Check,
  Container,
  Copy,
  Edit2,
  Eye,
  Globe,
  Mail,
  MoreVertical,
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

interface BuyersMobileCardsProps {
  buyers: BuyerAccountFull[];
  onSelectBuyer: (buyer: BuyerAccountFull) => void;
  onEditBuyer: (buyer: BuyerAccountFull) => void;
  onToggleArchive: (buyerId: string) => void;
}

const AVATAR_TONES = [
  { bg: "bg-[#6A80A9]/12", text: "text-[#6A80A9]", border: "border-[#6A80A9]/25" },
  { bg: "bg-[#C7D5BF]/25", text: "text-[#4A5D3F]", border: "border-[#C7D5BF]/50" },
  { bg: "bg-indigo-500/12", text: "text-indigo-600", border: "border-indigo-500/25" },
  { bg: "bg-amber-500/12", text: "text-amber-700", border: "border-amber-500/25" },
  { bg: "bg-teal-500/12", text: "text-teal-700", border: "border-teal-500/25" },
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

export function BuyersMobileCards({
  buyers,
  onSelectBuyer,
  onEditBuyer,
  onToggleArchive,
}: BuyersMobileCardsProps) {
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
    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:hidden">
      {buyers.map((buyer) => {
        const tone = getToneForId(buyer.id);
        const initials = getAvatarInitials(buyer.name);
        const isArchived = buyer.status === "Archived";

        return (
          <div
            key={buyer.id}
            onClick={() => onSelectBuyer(buyer)}
            className={cn(
              "group relative flex flex-col justify-between rounded-[20px] border border-white/80 bg-white/80 p-4.5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-2xl transition-all duration-200 active:scale-[0.99]",
              isArchived && "opacity-75 bg-slate-50/70",
            )}
          >
            {/* Top Bar: Avatar + Names + Status & Actions */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-[14px] border text-[13px] font-bold tracking-tight shadow-xs",
                      tone.bg,
                      tone.text,
                      tone.border,
                    )}
                  >
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-semibold text-black tracking-[-0.01em] text-[15px]">
                        {buyer.name}
                      </h3>
                      <span className="rounded-[6px] border border-slate-200/80 bg-white/80 px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500">
                        {buyer.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{buyer.company}</p>
                  </div>
                </div>

                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-2.5 py-1 text-[11px] font-medium">
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        buyer.status === "Active" ? "bg-emerald-500" : "bg-slate-400",
                      )}
                    />
                    <span>{buyer.status}</span>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${buyer.name}`}
                        className="grid size-9 place-items-center rounded-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-2xl"
                    >
                      <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {buyer.name}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onSelectBuyer(buyer)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Eye className="size-4 text-[#6A80A9]" />
                        <span>View Details</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEditBuyer(buyer)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                      >
                        <Edit2 className="size-4 text-slate-500" />
                        <span>Edit Buyer</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          to="/new-booking"
                          className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="size-4 text-[#C7D5BF]" />
                          <span>New Booking</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-1 bg-slate-100" />
                      <DropdownMenuItem
                        onClick={() => onToggleArchive(buyer.id)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100"
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
              </div>

              {/* Information Grid */}
              <div className="mt-4 space-y-2 text-xs text-slate-600">
                <div className="flex items-center justify-between border-b border-slate-100/80 pb-2">
                  <span className="text-slate-400">Country</span>
                  <span className="font-medium text-slate-800 flex items-center gap-1">
                    <Globe className="size-3 text-slate-400" />
                    {buyer.country}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100/80 pb-2">
                  <span className="text-slate-400">Contact</span>
                  <span className="font-medium text-slate-800">{buyer.contactPerson}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100/80 pb-2">
                  <span className="text-slate-400">Email</span>
                  <button
                    type="button"
                    onClick={(e) => copyToClipboard(buyer.email, "Email", e)}
                    className="flex items-center gap-1 font-medium text-slate-700 hover:text-[#6A80A9]"
                  >
                    <Mail className="size-3 text-slate-400" />
                    <span className="max-w-[170px] truncate">{buyer.email}</span>
                  </button>
                </div>

                <div className="flex items-center justify-between pb-1">
                  <span className="text-slate-400">Phone</span>
                  <button
                    type="button"
                    onClick={(e) => copyToClipboard(buyer.phone, "Phone", e)}
                    className="flex items-center gap-1 font-mono text-slate-700 hover:text-[#6A80A9]"
                  >
                    <Phone className="size-3 text-slate-400" />
                    <span>{buyer.phone}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Meta: Container count & Tap hint */}
            <div className="mt-3.5 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-700">
                <Container className="size-3.5 text-[#6A80A9]" />
                <span>
                  {buyer.activeContainers} Active{" "}
                  {buyer.activeContainers === 1 ? "Container" : "Containers"}
                </span>
              </span>

              <span className="text-[11px] font-medium text-[#6A80A9] group-hover:underline">
                View Movements →
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
