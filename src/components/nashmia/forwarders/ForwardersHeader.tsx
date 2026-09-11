import { Menu, Plus } from "lucide-react";

interface ForwardersHeaderProps {
  onOpenMobileMenu?: () => void;
  onAddForwarder: () => void;
}

export function ForwardersHeader({ onOpenMobileMenu, onAddForwarder }: ForwardersHeaderProps) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      {/* Left side: Eyebrow + Large Title + Subtitle */}
      <div className="flex items-start gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Toggle navigation menu"
            className="mt-1 grid size-11 shrink-0 place-items-center rounded-[14px] border border-slate-200/80 bg-white/80 text-black shadow-2xs backdrop-blur-md transition-all hover:bg-white lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}

        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6A80A9]">
            DIRECTORY
          </p>
          <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-[#000000] sm:text-[38px] lg:text-[40px] leading-tight">
            Forwarders
          </h1>
          <p className="max-w-2xl text-[14px] text-slate-500 leading-relaxed">
            Manage booking agents, contacts and communication details.
          </p>
        </div>
      </div>

      {/* Right side: Black Premium + Add Forwarder Button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onAddForwarder}
          className="group relative flex h-[50px] items-center gap-2.5 rounded-[14px] bg-[#000000] px-6 text-[14px] font-medium text-[#FFFFFF] shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_36px_rgba(0,0,0,0.26)] active:translate-y-0 active:scale-[0.99]"
        >
          <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
          <span>+ Add Forwarder</span>
        </button>
      </div>
    </header>
  );
}
