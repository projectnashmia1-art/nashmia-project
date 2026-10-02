import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  DollarSign,
  Edit2,
  ExternalLink,
  MoreVertical,
  Plus,
  Send,
  Share2,
  Star,
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

interface ForwardersMobileCardsProps {
  forwarders: ForwarderAccount[];
  onSelectForwarder: (forwarder: ForwarderAccount) => void;
  onEditForwarder: (forwarder: ForwarderAccount) => void;
  onToggleArchive?: (forwarderId: string) => void;
  onSendTestEmail?: (forwarder: ForwarderAccount) => void;
}

const AVATAR_GRADIENTS = [
  "from-sky-400 via-teal-400 to-cyan-500",
  "from-indigo-400 via-sky-400 to-teal-400",
  "from-amber-400 via-orange-400 to-rose-400",
  "from-teal-400 via-emerald-400 to-cyan-500",
  "from-blue-500 via-indigo-400 to-sky-400",
];

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
    SG: "🇸🇬",
  };
  return flags[countryCode] || "🌐";
}

export function ForwardersMobileCards({
  forwarders,
  onSelectForwarder,
  onEditForwarder,
  onToggleArchive,
  onSendTestEmail,
}: ForwardersMobileCardsProps) {
  const [bookmarkedMap, setBookmarkedMap] = useState<Record<string, boolean>>({});

  const toggleBookmark = (forwarder: ForwarderAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextState = !bookmarkedMap[forwarder.id];
    setBookmarkedMap((prev) => ({ ...prev, [forwarder.id]: nextState }));
    toast.success(
      nextState ? `Saved ${forwarder.name} to favorites` : `Removed ${forwarder.name} from saved`,
    );
  };

  const handleShare = (forwarder: ForwarderAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(window.location.href);
    toast.success(`Share link copied for ${forwarder.name}`);
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
      {forwarders.map((fwd, index) => {
        const initials = getAvatarInitials(fwd.name);
        const isArchived = fwd.status === "Archived";
        const isBookmarked = !!bookmarkedMap[fwd.id];
        const flag = getCountryFlag(fwd.countryCode);
        const avatarGradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

        return (
          <div
            key={fwd.id}
            onClick={() => onSelectForwarder(fwd)}
            style={{
              background: "linear-gradient(180deg, #FFFFFF 0%, #F5FBFC 45%, #D4F0F6 100%)",
            }}
            className={cn(
              "group relative flex min-h-[350px] flex-col justify-between overflow-hidden rounded-[30px] border border-white/90 p-5.5 shadow-[0_16px_36px_-10px_rgba(15,163,177,0.16)] transition-all active:scale-[0.99]",
              isArchived && "opacity-75 grayscale-[20%]",
            )}
          >
            {/* Top Bar: Avatar + Share & Options */}
            <div>
              <div className="flex items-start justify-between">
                <div className="relative">
                  <div
                    className={cn(
                      "size-15 rounded-full border-2 border-white bg-gradient-to-br p-0.5 shadow-[0_4px_14px_rgba(15,163,177,0.2)] flex items-center justify-center",
                      avatarGradient,
                    )}
                  >
                    <div className="size-full rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-bold text-[17px]">
                      {initials}
                    </div>
                  </div>
                  <span
                    className="absolute -bottom-1 -right-1 flex size-5.5 items-center justify-center rounded-full bg-white text-[11px] shadow-xs border border-slate-100"
                    title={fwd.country}
                  >
                    {flag}
                  </span>
                </div>

                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => handleShare(fwd, e)}
                    className="grid size-8 place-items-center rounded-full text-slate-400 hover:text-slate-800 hover:bg-white/80"
                  >
                    <Share2 className="size-4" />
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Actions for ${fwd.name}`}
                        className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-white/80 hover:text-slate-800"
                      >
                        <MoreVertical className="size-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 rounded-[18px] border border-white/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-2xl"
                    >
                      <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {fwd.name}
                      </DropdownMenuLabel>
                      <DropdownMenuItem
                        onClick={() => onSelectForwarder(fwd)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <ExternalLink className="size-4 text-[#0FA3B1]" />
                        <span>View Details</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEditForwarder(fwd)}
                        className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                      >
                        <Edit2 className="size-4 text-slate-500" />
                        <span>Edit Forwarder</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          to="/new-booking"
                          search={{ bookingAgentId: fwd.id }}
                          className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                        >
                          <Plus className="size-4 text-[#0FA3B1]" />
                          <span>New Booking</span>
                        </Link>
                      </DropdownMenuItem>
                      {onSendTestEmail && (
                        <DropdownMenuItem
                          onClick={() => onSendTestEmail(fwd)}
                          className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                        >
                          <Send className="size-4 text-slate-500" />
                          <span>Send Test Email</span>
                        </DropdownMenuItem>
                      )}
                      {onToggleArchive && (
                        <>
                          <DropdownMenuSeparator className="my-1 bg-slate-100" />
                          <DropdownMenuItem
                            onClick={() => onToggleArchive(fwd.id)}
                            className="flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100"
                          >
                            {fwd.status === "Active" ? (
                              <>
                                <Archive className="size-4 text-amber-600" />
                                <span>Archive Forwarder</span>
                              </>
                            ) : (
                              <>
                                <ArchiveRestore className="size-4 text-emerald-600" />
                                <span>Restore Forwarder</span>
                              </>
                            )}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Title & tags */}
              <div className="mt-3.5">
                <h3 className="text-[19px] font-bold text-slate-900 tracking-tight leading-snug">
                  {fwd.name}
                </h3>
                <p className="text-[13px] font-medium text-slate-500 mt-0.5 truncate">
                  {fwd.badge} · {fwd.contactPerson}
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full bg-white/90 border border-slate-200/60 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-700 shadow-2xs">
                    {fwd.countryCode} · {fwd.country}
                  </span>
                  <span className="rounded-full bg-white/90 border border-slate-200/60 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-700 shadow-2xs">
                    {fwd.shippingLines.slice(0, 2).join(", ")}
                  </span>
                  <span className="rounded-full bg-white/90 border border-slate-200/60 px-2 py-0.5 text-[10px] font-mono font-semibold text-slate-500 shadow-2xs">
                    {fwd.code}
                  </span>
                </div>
              </div>

              {/* 3 Metric Columns */}
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-200/50 pt-3.5">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 text-[14px] font-bold text-slate-900 leading-tight">
                    <Star className="size-3 fill-slate-900 text-slate-900" />
                    <span>4.9</span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 mt-0.5">Rating</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-bold text-slate-900 leading-tight">
                    {fwd.activeBookings} Active
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 mt-0.5">Pipeline</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] font-bold text-slate-900 leading-tight">
                    {fwd.rateCards.length} Rates
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 mt-0.5">Rate Cards</span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectForwarder(fwd)}
                className="flex-1 rounded-full bg-white/95 text-slate-900 font-semibold text-[13px] py-2.5 px-4 shadow-2xs border border-white/90 text-center"
              >
                Get in touch
              </button>

              <button
                type="button"
                onClick={(e) => toggleBookmark(fwd, e)}
                className={cn(
                  "size-10 rounded-full flex items-center justify-center shadow-2xs border border-white/90 shrink-0 transition-all",
                  isBookmarked
                    ? "bg-[#0FA3B1] text-white border-[#0FA3B1]"
                    : "bg-white text-slate-800",
                )}
              >
                <Bookmark className={cn("size-4 stroke-[2]", isBookmarked && "fill-white")} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
