import React from "react";
import { X } from "lucide-react";
import { ResultModalIllustration } from "./ResultModalIllustration";

export interface ResultSuccessViewProps {
  type?: "success" | "error";
  title?: string;
  message?: string;
  entityName?: string;
  entitySubtitle?: string;
  actionText?: string;
  onAction: () => void;
  onClose: () => void;
}

export function ResultSuccessView({
  type = "success",
  title,
  message,
  entityName,
  entitySubtitle,
  actionText,
  onAction,
  onClose,
}: ResultSuccessViewProps) {
  const isSuccess = type === "success";

  const defaultTitle = isSuccess ? "Success!" : "Sorry :(";
  const defaultMessage = isSuccess
    ? "Thank you for waiting. Your data has been approved."
    : "Your request couldn't be processed by the system.";
  const defaultActionText = isSuccess ? "OKAY" : "TRY AGAIN";

  return (
    <div className="relative w-full text-center px-4 py-3 sm:px-6 animate-in fade-in-50 zoom-in-95 duration-200">
      {/* Floating Circular Close Button in Top Right matching reference */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close dialog"
        className="absolute -top-1 -right-1 sm:top-0 sm:right-0 z-20 flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-700 active:scale-95 cursor-pointer shadow-2xs"
      >
        <X className="size-4 stroke-[2.5]" />
      </button>

      {/* Top Graphic Illustration */}
      <div className="flex justify-center pt-2 pb-1">
        <ResultModalIllustration type={type} className="w-36 h-36" />
      </div>

      {/* Title */}
      <h3
        className={`text-[26px] font-black tracking-tight leading-tight ${
          isSuccess ? "text-[#0D1F3C]" : "text-[#D97706]"
        }`}
      >
        {title || defaultTitle}
      </h3>

      {/* Description */}
      <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-relaxed text-slate-500 font-medium">
        {message || defaultMessage}
      </p>

      {/* Entity Summary Badge (if provided) */}
      {entityName && (
        <div className="mt-3.5 inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-slate-50/80 px-3.5 py-1 text-[12px] font-semibold text-slate-700 shadow-2xs">
          <span className="size-1.5 rounded-full bg-[#00A3FF]" />
          <span className="truncate max-w-[200px]">{entityName}</span>
          {entitySubtitle && <span className="text-slate-400 font-normal">({entitySubtitle})</span>}
        </div>
      )}

      {/* Main Action Pill Button matching reference */}
      <div className="mt-6 pt-1">
        <button
          type="button"
          onClick={onAction}
          className={`w-full py-3.5 px-6 rounded-full font-extrabold text-[14px] uppercase tracking-wider text-white shadow-md transition-all duration-150 cursor-pointer active:scale-[0.98] ${
            isSuccess
              ? "bg-[#009EE2] hover:bg-[#0089c7] shadow-[#009EE2]/25"
              : "bg-[#F59E0B] hover:bg-[#d97706] shadow-[#F59E0B]/25"
          }`}
        >
          {actionText || defaultActionText}
        </button>
      </div>
    </div>
  );
}
