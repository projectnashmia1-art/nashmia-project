import React, { useState } from "react";
import {
  Clock,
  Tag,
  AlertTriangle,
  XCircle,
  Trophy,
  MinusCircle,
  CheckCheck,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  CanonicalQuotationStatus,
  ForwarderQuoteStatus,
  normalizeQuoteStatus,
  ALL_QUOTATION_STATUSES,
} from "@/types/requests";

export interface QuotationStatusMeta {
  label: CanonicalQuotationStatus;
  displayLabel: string;
  badgeClasses: string;
  dotClasses: string;
  icon: React.ElementType;
  description: string;
}

export const QUOTATION_STATUS_CONFIG: Record<CanonicalQuotationStatus, QuotationStatusMeta> = {
  PENDING: {
    label: "PENDING",
    displayLabel: "PENDING",
    badgeClasses: "bg-slate-100 text-slate-700 border-slate-300",
    dotClasses: "bg-slate-400 animate-pulse",
    icon: Clock,
    description: "Quote requested from forwarder; awaiting commercial rate reply.",
  },
  OFFER_RECEIVED: {
    label: "OFFER_RECEIVED",
    displayLabel: "OFFER_RECEIVED",
    badgeClasses: "bg-emerald-50 text-emerald-800 border-emerald-300",
    dotClasses: "bg-emerald-500",
    icon: Tag,
    description:
      "Commercial freight quotation received. Receiving an offer does NOT confirm the booking.",
  },
  NEEDS_REVIEW: {
    label: "NEEDS_REVIEW",
    displayLabel: "NEEDS_REVIEW",
    badgeClasses: "bg-amber-50 text-amber-800 border-amber-300",
    dotClasses: "bg-amber-500",
    icon: AlertTriangle,
    description: "Quotation terms, rates, validity, or exclusions require manual operator review.",
  },
  NOT_AVAILABLE: {
    label: "NOT_AVAILABLE",
    displayLabel: "NOT_AVAILABLE",
    badgeClasses: "bg-rose-50 text-rose-800 border-rose-300",
    dotClasses: "bg-rose-500",
    icon: XCircle,
    description: "Forwarder reported no vessel capacity, equipment deficit, or declined request.",
  },
  AWARDED: {
    label: "AWARDED",
    displayLabel: "AWARDED",
    badgeClasses: "bg-cyan-50 text-cyan-900 border-cyan-300 font-bold",
    dotClasses: "bg-cyan-600",
    icon: Trophy,
    description: "Quotation officially awarded. Movement transitions to Pending Confirmation.",
  },
  NOT_AWARDED: {
    label: "NOT_AWARDED",
    displayLabel: "NOT_AWARDED",
    badgeClasses: "bg-zinc-100 text-zinc-600 border-zinc-300",
    dotClasses: "bg-zinc-400",
    icon: MinusCircle,
    description: "Competing forwarder quote not selected for this movement.",
  },
  CONFIRMED: {
    label: "CONFIRMED",
    displayLabel: "CONFIRMED",
    badgeClasses: "bg-emerald-600 text-white border-emerald-600 shadow-xs font-bold",
    dotClasses: "bg-white",
    icon: CheckCheck,
    description: "Carrier space booking officially verified and confirmed.",
  },
};

interface QuotationStatusBadgeProps {
  status: ForwarderQuoteStatus | string;
  size?: "xs" | "sm" | "md";
  showIcon?: boolean;
  className?: string;
  allowChange?: boolean;
  onStatusChange?: (newStatus: CanonicalQuotationStatus) => void | Promise<void>;
  disabled?: boolean;
}

export const QuotationStatusBadge: React.FC<QuotationStatusBadgeProps> = ({
  status,
  size = "sm",
  showIcon = true,
  className = "",
  allowChange = false,
  onStatusChange,
  disabled = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const canonical = normalizeQuoteStatus(status);
  const meta = QUOTATION_STATUS_CONFIG[canonical] || QUOTATION_STATUS_CONFIG.PENDING;
  const IconComponent = meta.icon;

  const sizeClasses = {
    xs: "text-[9.5px] px-1.5 py-0.2 gap-1",
    sm: "text-[10.5px] px-2 py-0.5 gap-1.5",
    md: "text-[11.5px] px-2.5 py-1 gap-1.5",
  }[size];

  const iconSizes = {
    xs: "size-2.5",
    sm: "size-3",
    md: "size-3.5",
  }[size];

  if (!allowChange || !onStatusChange) {
    return (
      <span
        className={`inline-flex items-center rounded-full border font-semibold tracking-wide transition-colors ${meta.badgeClasses} ${sizeClasses} ${className}`}
        title={meta.description}
      >
        {showIcon && <IconComponent className={`${iconSizes} shrink-0`} />}
        <span>{meta.displayLabel}</span>
      </span>
    );
  }

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setDropdownOpen((prev) => !prev)}
        className={`inline-flex items-center rounded-full border font-semibold tracking-wide transition-all cursor-pointer hover:shadow-xs focus:outline-none focus:ring-1 focus:ring-[#0FA3B1] ${meta.badgeClasses} ${sizeClasses} ${className}`}
        title={`${meta.description} (Click to change quotation status)`}
      >
        {showIcon && <IconComponent className={`${iconSizes} shrink-0`} />}
        <span>{meta.displayLabel}</span>
        <ChevronDown className="size-2.5 ml-0.5 opacity-60" />
      </button>

      {dropdownOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
          <div className="absolute left-0 mt-1 w-52 rounded-xl bg-white border border-slate-200 shadow-xl z-40 p-1.5 animate-in fade-in zoom-in-95 duration-100 text-left">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
              Set Quotation Status
            </div>
            <div className="space-y-0.5 max-h-60 overflow-y-auto">
              {ALL_QUOTATION_STATUSES.map((st) => {
                const optMeta = QUOTATION_STATUS_CONFIG[st];
                const OptIcon = optMeta.icon;
                const isSelected = st === canonical;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={async () => {
                      setDropdownOpen(false);
                      if (st !== canonical) {
                        await onStatusChange(st);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-[#0FA3B1]/10 text-[#0FA3B1]"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <OptIcon className="size-3.5 shrink-0 opacity-80" />
                      <span>{optMeta.displayLabel}</span>
                    </div>
                    {isSelected && <Check className="size-3 text-[#0FA3B1]" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 pt-1 border-t border-slate-100 px-2 py-0.5 text-[9.5px] text-slate-400 leading-tight">
              Rule: Receiving a quotation does not confirm the booking.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
