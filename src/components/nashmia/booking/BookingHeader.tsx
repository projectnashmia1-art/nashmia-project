import { ArrowLeft, Check, Menu, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

interface BookingHeaderProps {
  onBack?: () => void;
  onOpenMobileMenu?: () => void;
  isSaved?: boolean;
}

export function BookingHeader({ onBack, onOpenMobileMenu, isSaved = true }: BookingHeaderProps) {
  return (
    <header className="space-y-4">
      {/* Top navigation row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Toggle navigation menu"
              className="mr-1 grid size-8 place-items-center rounded-[10px] border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-50 lg:hidden"
            >
              <Menu className="size-4" />
            </button>
          )}
          <Link
            to="/"
            onClick={onBack}
            className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-[#E8F1F3] hover:text-slate-900"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Movements</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-medium text-slate-400">Movements</span>
          <span className="text-slate-300">/</span>
          <span className="text-xs font-semibold text-slate-800">New Booking</span>
        </div>

        {/* Live Auto-Save Status */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-[0_2px_8px_rgba(15,23,42,0.03),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-md">
          <span className="flex size-2 items-center justify-center">
            <span className="absolute size-2 animate-ping rounded-full bg-[#6A80A9]/30 opacity-75" />
            <span className="relative size-1.5 rounded-full bg-[#6A80A9]" />
          </span>
          <span className="font-semibold text-slate-900">Draft</span>
          <span className="text-slate-300">•</span>
          <span className="flex items-center gap-1 text-slate-500">
            {isSaved ? (
              <>
                <Check className="size-3 text-[#6A80A9]" />
                <span>Auto-saved</span>
              </>
            ) : (
              <span>Saving...</span>
            )}
          </span>
        </div>
      </div>

      {/* Main Title & Subtitle */}
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-black sm:text-3xl lg:text-4xl">
              New Booking Request
            </h1>
            <span className="hidden items-center gap-1 rounded-full border border-[#C7D5BF]/80 bg-[#C7D5BF]/25 px-2.5 py-0.5 text-[11px] font-semibold text-[#2D3C26] sm:inline-flex">
              <Sparkles className="size-3 text-[#2D3C26]" />
              Automated Lifecycle
            </span>
          </div>
          <p className="text-sm text-slate-500 sm:text-base">
            Create a movement and prepare the booking request for your forwarder.
          </p>
        </div>
      </div>
    </header>
  );
}
