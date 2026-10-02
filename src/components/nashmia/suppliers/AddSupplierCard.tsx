import { Plus, UserPlus } from "lucide-react";

interface AddSupplierCardProps {
  onClick: () => void;
}

export function AddSupplierCard({ onClick }: AddSupplierCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "linear-gradient(180deg, #FFFFFF 0%, #F5FBFC 45%, #D4F0F6 100%)",
      }}
      className="group relative flex min-h-[380px] w-full flex-col justify-between overflow-hidden rounded-[32px] sm:rounded-[36px] border border-white/90 p-6 sm:p-7 text-left shadow-[0_20px_45px_-12px_rgba(15,163,177,0.16),0_4px_16px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_55px_-12px_rgba(15,163,177,0.22)] active:translate-y-0 cursor-pointer"
    >
      {/* Specular Edge Highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />

      {/* Top section: Avatar-like Add Icon */}
      <div>
        <div className="flex items-start justify-between">
          <div className="size-16 sm:size-17 rounded-full border-2 border-white bg-gradient-to-br from-[#0FA3B1] via-teal-400 to-[#45DFEB] p-0.5 shadow-[0_6px_18px_rgba(15,163,177,0.25)] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
            <div className="size-full rounded-full bg-white/20 backdrop-blur-xs flex items-center justify-center text-white">
              <UserPlus className="size-7 stroke-[2]" />
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 border border-slate-200/60 px-3 py-1 text-[11px] font-semibold text-[#0FA3B1] shadow-2xs">
            <Plus className="size-3" /> Quick Add
          </span>
        </div>

        {/* Identity & Description */}
        <div className="mt-4">
          <h3 className="text-[21px] sm:text-[22px] font-bold text-slate-900 tracking-tight leading-snug group-hover:text-[#0FA3B1] transition-colors">
            Register New Supplier
          </h3>
          <p className="text-[13.5px] font-medium text-slate-500 mt-1 leading-relaxed">
            Onboard origin pickup vendor, tax ID validation, and default loading depot.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-white/90 border border-slate-200/60 px-3 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs">
              Factory Hub
            </span>
            <span className="rounded-full bg-white/90 border border-slate-200/60 px-3 py-0.5 text-[11px] font-semibold text-slate-600 shadow-2xs">
              Pickup Depot
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="mt-6 flex items-center gap-2.5">
        <div className="flex-1 rounded-full bg-[#0FA3B1] text-white font-semibold text-[13.5px] py-3 px-5 shadow-[0_4px_16px_rgba(15,163,177,0.3)] border border-[#0FA3B1] transition-all duration-200 group-hover:bg-[#0b828e] text-center flex items-center justify-center gap-1.5">
          <Plus className="size-4" />
          <span>Add Supplier Profile</span>
        </div>
      </div>
    </button>
  );
}
