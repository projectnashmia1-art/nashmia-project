import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  Bookmark,
  Edit2,
  ExternalLink,
  Mail,
  MoreHorizontal,
  Plus,
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

// Consistent portrait avatar gradient or imagery
const AVATAR_GRADIENTS = [
  "from-sky-400 via-teal-400 to-cyan-500",
  "from-indigo-400 via-sky-400 to-teal-400",
  "from-amber-400 via-orange-400 to-rose-400",
  "from-teal-400 via-emerald-400 to-cyan-500",
  "from-blue-500 via-indigo-400 to-sky-400",
];

export function BuyerCard({ buyer, onSelect, onEdit, onToggleArchive, index }: BuyerCardProps) {
  const [isBookmarked, setIsBookmarked] = useState(false);
  const initials = getAvatarInitials(buyer.name);
  const isInactive = buyer.status === "Inactive" || buyer.status === "Archived";
  const flag = getCountryFlag(buyer.countryCode);
  const avatarGradient = AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl);
    toast.success(`Share link copied for ${buyer.name}`, {
      description: `${buyer.company} · ${buyer.code}`,
    });
  };

  const handleBookmarkToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBookmarked(!isBookmarked);
    toast.success(
      isBookmarked ? `Removed ${buyer.name} from saved` : `Saved ${buyer.name} to favorites`,
    );
  };

  return (
    <div
      onClick={() => onSelect(buyer)}
      style={{
        animationDelay: `${index * 30}ms`,
        background: "linear-gradient(180deg, #FFFFFF 0%, #F5FBFC 45%, #D4F0F6 100%)",
      }}
      className={cn(
        "group relative flex min-h-[380px] w-full cursor-pointer flex-col justify-between overflow-hidden rounded-[32px] sm:rounded-[36px] border border-white/90 p-6 sm:p-7 shadow-[0_20px_45px_-12px_rgba(15,163,177,0.16),0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_55px_-12px_rgba(15,163,177,0.22)] active:translate-y-0",
        isInactive && "opacity-75 grayscale-[20%]",
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
                "size-16 sm:size-17 rounded-full border-2 border-white bg-gradient-to-br p-0.5 shadow-[0_6px_18px_rgba(15,163,177,0.2)] flex items-center justify-center transition-transform duration-300 group-hover:scale-105",
                avatarGradient,
              )}
            >
              <div className="size-full rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white font-bold text-[18px] tracking-tight">
                {initials}
              </div>
            </div>
            <span
              className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full bg-white text-xs shadow-xs border border-slate-100"
              title={buyer.country}
            >
              {flag}
            </span>
          </div>

          {/* Top Right: Share & Dropdown Menu */}
          <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleShare}
              title="Share Buyer Profile"
              className="grid size-9 place-items-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-white/80 transition-colors"
            >
              <Share2 className="size-4.5 stroke-[1.8]" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Actions for ${buyer.name}`}
                  className="grid size-9 place-items-center rounded-full text-slate-400 hover:text-slate-900 hover:bg-white/80 transition-colors focus:outline-none"
                >
                  <MoreHorizontal className="size-4 stroke-[1.8]" />
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

        {/* IDENTITY SECTION: Big Name, Role/Company, Tag Pills */}
        <div className="mt-4">
          <h3 className="text-[21px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug">
            {buyer.name}
          </h3>
          <p className="text-[13.5px] font-medium text-slate-500 mt-0.5 truncate">
            {buyer.company}
          </p>

          {/* Tag Pills (like Figma / UX Design in uploaded image) */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/90 border border-slate-200/60 px-3 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
              {buyer.countryCode} · {buyer.country}
            </span>
            <span className="rounded-full bg-white/90 border border-slate-200/60 px-3 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs">
              {buyer.preferredPort || buyer.city || "Direct Routing"}
            </span>
            <span className="rounded-full bg-white/90 border border-slate-200/60 px-2.5 py-0.5 text-[10.5px] font-mono font-semibold text-slate-500 shadow-2xs">
              {buyer.code}
            </span>
          </div>
        </div>

        {/* 3-COLUMN METRICS SECTION (Exact same hierarchy as uploaded design) */}
        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-200/50 pt-4">
          {/* Col 1: Rating */}
          <div className="flex flex-col">
            <span className="flex items-center gap-1 text-[15px] font-bold text-slate-900 leading-tight">
              <Star className="size-3.5 fill-slate-900 text-slate-900" />
              <span>4.9</span>
            </span>
            <span className="text-[11.5px] font-medium text-slate-400 mt-0.5">Rating</span>
          </div>

          {/* Col 2: Pipeline / Earned */}
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-slate-900 leading-tight">
              {buyer.activeMovements} Active
            </span>
            <span className="text-[11.5px] font-medium text-slate-400 mt-0.5">Pipeline</span>
          </div>

          {/* Col 3: Volume / Rate */}
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-slate-900 leading-tight">
              {buyer.totalMovements} cgo
            </span>
            <span className="text-[11.5px] font-medium text-slate-400 mt-0.5">Total Vol</span>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BUTTONS: Wide Pill "Get in touch" + Circular Bookmark Button */}
      <div className="mt-6 flex items-center gap-2.5">
        {/* Main wide pill button */}
        <button
          type="button"
          onClick={() => onSelect(buyer)}
          className="flex-1 rounded-full bg-white/95 hover:bg-white text-slate-900 font-semibold text-[13.5px] py-3 px-5 shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-white/90 transition-all duration-200 hover:shadow-[0_8px_24px_rgba(15,163,177,0.14)] active:scale-[0.98] text-center"
        >
          Get in touch
        </button>

        {/* Circular Bookmark Button */}
        <button
          type="button"
          onClick={handleBookmarkToggle}
          title={isBookmarked ? "Remove bookmark" : "Save bookmark"}
          className={cn(
            "size-11 sm:size-12 rounded-full flex items-center justify-center shadow-[0_4px_16px_rgba(0,0,0,0.04)] border border-white/90 shrink-0 transition-all duration-200 hover:scale-105 active:scale-95",
            isBookmarked
              ? "bg-[#0FA3B1] text-white border-[#0FA3B1] shadow-[0_4px_14px_rgba(15,163,177,0.3)]"
              : "bg-white hover:bg-slate-50 text-slate-800",
          )}
        >
          <Bookmark className={cn("size-4.5 stroke-[2]", isBookmarked && "fill-white")} />
        </button>
      </div>
    </div>
  );
}
