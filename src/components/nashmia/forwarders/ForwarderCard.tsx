import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  DollarSign,
  Edit2,
  ExternalLink,
  MoreHorizontal,
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

interface ForwarderCardProps {
  forwarder: ForwarderAccount;
  index?: number;
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

const AVATAR_GRADIENTS = [
  "from-[#6A80A9] via-[#859ABF] to-[#4F658E]",
  "from-[#475569] via-[#64748B] to-[#334155]",
  "from-[#0284C7] via-[#38BDF8] to-[#0369A1]",
  "from-[#059669] via-[#34D399] to-[#047857]",
  "from-[#6366F1] via-[#818CF8] to-[#4F46E5]",
];

export function ForwarderCard({
  forwarder,
  index = 0,
  onSelectForwarder,
  onEditForwarder,
  onToggleArchive,
  onSendTestEmail,
}: ForwarderCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const initials = getAvatarInitials(forwarder.name);
  const flag = getCountryFlag(forwarder.countryCode);
  const isInactive = forwarder.status === "Inactive" || forwarder.status === "Archived";
  const avatarGradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    toast.success(`Share link copied for ${forwarder.name}`, {
      description: `${forwarder.badge} · ${forwarder.code}`,
    });
  };

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    toast.success(
      isBookmarked
        ? `Removed ${forwarder.name} from saved`
        : `Saved ${forwarder.name} to favorites`,
    );
  };

  const handleManageRateCards = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectForwarder(forwarder);
    toast.info("Rate Cards Overview", {
      description: `Viewing ${forwarder.rateCards.length} agreed monthly rate cards for ${forwarder.name}.`,
    });
  };

  return (
    <div
      onClick={() => onSelectForwarder(forwarder)}
      style={{
        animationDelay: `${index * 30}ms`,
        background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 55%, #EDF2F7 100%)",
      }}
      className={cn(
        "group relative flex min-h-[380px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-[32px] sm:rounded-[36px] border border-white/90 p-6 sm:p-7 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.08),0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_50px_-12px_rgba(106,128,169,0.18)] active:translate-y-0",
        isInactive && "opacity-75 grayscale-[25%]",
      )}
    >
      {/* Specular Edge Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />

      {/* TOP ROW: Circular Avatar & Share/Actions Button */}
      <div>
        <div className="flex items-start justify-between">
          {/* Circular Portrait Avatar with Flag Badge */}
          <div className="relative">
            <div
              className={cn(
                "size-16 sm:size-17 rounded-full border-2 border-white bg-gradient-to-br p-0.5 shadow-[0_6px_18px_rgba(106,128,169,0.22)] flex items-center justify-center transition-transform duration-300 group-hover:scale-105",
                avatarGradient,
              )}
            >
              <div className="size-full rounded-full bg-white/15 backdrop-blur-xs flex items-center justify-center text-white font-bold text-[18px] tracking-tight">
                {initials}
              </div>
            </div>
            <span
              className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-white text-xs shadow-xs border border-slate-100"
              title={forwarder.country}
            >
              {flag}
            </span>
          </div>

          {/* Top Right: Share & Dropdown Menu */}
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleShare}
              title="Share Forwarder Profile"
              className="grid size-9 place-items-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-colors cursor-pointer"
            >
              <Share2 className="size-4.5 stroke-[1.8]" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for ${forwarder.name}`}
                  className="grid size-9 place-items-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-white/80 transition-colors focus:outline-none cursor-pointer"
                >
                  <MoreHorizontal className="size-4 stroke-[1.8]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
              >
                <DropdownMenuLabel className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {forwarder.name}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => onSelectForwarder(forwarder)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-[#E8F1F3]/50"
                >
                  <ExternalLink className="size-3.5 text-[#6A80A9]" />
                  <span>View Details</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onEditForwarder(forwarder)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                >
                  <Edit2 className="size-3.5 text-slate-400" />
                  <span>Edit Forwarder</span>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/new-booking"
                    search={{ bookingAgentId: forwarder.id }}
                    className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-semibold text-[#6A80A9] hover:bg-[#E8F1F3]"
                  >
                    <Plus className="size-3.5 text-[#6A80A9]" />
                    <span>Create Booking</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onSendTestEmail(forwarder)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                >
                  <Send className="size-3.5 text-slate-400" />
                  <span>Send Test Email</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleManageRateCards}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                >
                  <DollarSign className="size-3.5 text-slate-400" />
                  <span>Manage Rate Cards</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-slate-100" />
                <DropdownMenuItem
                  onClick={() => onToggleArchive(forwarder.id)}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-slate-600 hover:bg-slate-100"
                >
                  {forwarder.status === "Active" ? (
                    <>
                      <Archive className="size-3.5 text-amber-600" />
                      <span>Archive Forwarder</span>
                    </>
                  ) : (
                    <>
                      <ArchiveRestore className="size-3.5 text-emerald-600" />
                      <span>Activate Forwarder</span>
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* IDENTITY SECTION: Big Name, Role/Company, Tag Pills */}
        <div className="mt-4">
          <h3 className="text-[21px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
            {forwarder.name}
          </h3>
          <p className="text-[13.5px] font-medium text-slate-500 mt-0.5 truncate">
            {forwarder.badge} · {forwarder.contactPerson}
          </p>

          {/* Tag Pills */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/95 border border-slate-200/70 px-3 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
              {forwarder.countryCode} · {forwarder.country}
            </span>
            <span className="rounded-full bg-white/95 border border-slate-200/70 px-3 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
              {forwarder.shippingLines.slice(0, 2).join(", ")}
              {forwarder.shippingLines.length > 2 ? ` +${forwarder.shippingLines.length - 2}` : ""}
            </span>
            <span className="rounded-full bg-white/95 border border-slate-200/70 px-2.5 py-0.5 text-[10.5px] font-mono font-semibold text-slate-500 shadow-2xs">
              {forwarder.code}
            </span>
          </div>
        </div>

        {/* 3-COLUMN METRICS SECTION */}
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-200/60 pt-4">
          {/* Col 1: Rating */}
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-[15px] font-bold text-slate-900 leading-tight">
              <Star className="size-3.5 fill-slate-900 text-slate-900" />
              <span>4.9</span>
            </span>
            <span className="text-[11.5px] font-medium text-slate-400 mt-0.5">Rating</span>
          </div>

          {/* Col 2: Pipeline / Active Bookings */}
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-slate-900 leading-tight">
              {forwarder.activeBookings} Active
            </span>
            <span className="text-[11.5px] font-medium text-slate-400 mt-0.5">Pipeline</span>
          </div>

          {/* Col 3: Total Rate Cards or Bookings */}
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-slate-900 leading-tight">
              {forwarder.rateCards.length} Rates
            </span>
            <span className="text-[11.5px] font-medium text-slate-400 mt-0.5">Rate Cards</span>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BUTTONS: Wide Pill "View Profile" + Circular Bookmark Button */}
      <div className="mt-6 flex items-center gap-2.5">
        {/* Main wide pill button */}
        <button
          type="button"
          onClick={() => onSelectForwarder(forwarder)}
          className="flex-1 rounded-full bg-white/95 hover:bg-white text-slate-900 font-bold text-[13.5px] py-3 px-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-slate-200/80 transition-all duration-200 hover:border-[#6A80A9]/40 hover:shadow-[0_8px_24px_rgba(106,128,169,0.12)] active:scale-[0.98] text-center cursor-pointer"
        >
          View Profile &amp; Rates
        </button>

        {/* Circular Bookmark Button */}
        <button
          type="button"
          onClick={handleBookmarkToggle}
          title={isBookmarked ? "Remove bookmark" : "Save bookmark"}
          className={cn(
            "size-11 sm:size-12 rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-slate-200/80 shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer",
            isBookmarked
              ? "bg-[#6A80A9] text-white border-[#6A80A9] shadow-[0_4px_14px_rgba(106,128,169,0.3)]"
              : "bg-white hover:bg-slate-50 text-slate-800",
          )}
        >
          <Bookmark className={cn("size-4.5 stroke-[2]", isBookmarked && "fill-white")} />
        </button>
      </div>
    </div>
  );
}
