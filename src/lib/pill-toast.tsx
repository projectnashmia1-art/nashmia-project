import React from "react";
import { toast } from "sonner";
import {
  MessageSquare,
  AlarmClock,
  Settings,
  Bell,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./utils";

export type PillToastType =
  "comment" | "reminder" | "build" | "mention" | "success" | "error" | "info" | "ai";

interface PillToastOptions {
  title: string;
  description?: React.ReactNode;
  type?: PillToastType;
  duration?: number;
  icon?: LucideIcon;
  bookingReference?: string;
}

const TYPE_CONFIG: Record<
  PillToastType,
  {
    icon: LucideIcon;
    iconBg: string;
    iconBorder: string;
    iconColor: string;
    defaultTitle: string;
  }
> = {
  comment: {
    icon: MessageSquare,
    iconBg: "bg-blue-50/90",
    iconBorder: "border-blue-200/80 shadow-[inset_0_1px_2px_rgba(59,130,246,0.1)]",
    iconColor: "text-blue-500",
    defaultTitle: "New comment",
  },
  reminder: {
    icon: AlarmClock,
    iconBg: "bg-orange-50/90",
    iconBorder: "border-orange-200/80 shadow-[inset_0_1px_2px_rgba(249,115,22,0.1)]",
    iconColor: "text-orange-500",
    defaultTitle: "Reminder",
  },
  build: {
    icon: Settings,
    iconBg: "bg-purple-50/90",
    iconBorder: "border-purple-200/80 shadow-[inset_0_1px_2px_rgba(168,85,247,0.1)]",
    iconColor: "text-purple-500",
    defaultTitle: "Build Complete",
  },
  mention: {
    icon: Bell,
    iconBg: "bg-amber-50/90",
    iconBorder: "border-amber-200/80 shadow-[inset_0_1px_2px_rgba(245,158,11,0.1)]",
    iconColor: "text-amber-500",
    defaultTitle: "Mention",
  },
  success: {
    icon: CheckCircle2,
    iconBg: "bg-emerald-50/90",
    iconBorder: "border-emerald-200/80 shadow-[inset_0_1px_2px_rgba(16,185,129,0.1)]",
    iconColor: "text-emerald-600",
    defaultTitle: "Booking Confirmed",
  },
  error: {
    icon: AlertCircle,
    iconBg: "bg-rose-50/90",
    iconBorder: "border-rose-200/80 shadow-[inset_0_1px_2px_rgba(244,63,94,0.1)]",
    iconColor: "text-rose-500",
    defaultTitle: "Notice",
  },
  info: {
    icon: Info,
    iconBg: "bg-sky-50/90",
    iconBorder: "border-sky-200/80 shadow-[inset_0_1px_2px_rgba(14,165,233,0.1)]",
    iconColor: "text-sky-500",
    defaultTitle: "Information",
  },
  ai: {
    icon: Sparkles,
    iconBg: "bg-teal-50/90",
    iconBorder: "border-teal-200/80 shadow-[inset_0_1px_2px_rgba(15,163,177,0.1)]",
    iconColor: "text-[#0FA3B1]",
    defaultTitle: "AI Update",
  },
};

export function PillToastCard({
  title,
  description,
  type = "info",
  customIcon,
  bookingReference,
  onDismiss,
}: {
  title: string;
  description?: React.ReactNode;
  type?: PillToastType;
  customIcon?: LucideIcon;
  bookingReference?: string;
  onDismiss?: () => void;
}) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const IconComponent = customIcon || config.icon;

  const detectedRef =
    bookingReference ||
    (typeof title === "string"
      ? title.match(
          /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+|BKG-[A-Z0-9-]+)\b/i,
        )?.[0]
      : undefined) ||
    (typeof description === "string"
      ? description.match(
          /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+|BKG-[A-Z0-9-]+)\b/i,
        )?.[0]
      : undefined);

  let displayTitle = title || config.defaultTitle;
  if (typeof title === "string" && detectedRef && title.includes(detectedRef)) {
    const cleaned = title.replace(`: ${detectedRef}`, "").replace(` ${detectedRef}`, "").trim();
    if (cleaned) {
      displayTitle = cleaned;
    }
  }

  return (
    <div
      role="alert"
      onClick={onDismiss}
      className={cn(
        "group relative flex cursor-pointer items-center gap-3.5 rounded-full bg-white/95 py-2.5 pl-3 pr-8",
        "border border-slate-100/90 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.15),0_2px_8px_-2px_rgba(0,0,0,0.06)]",
        "backdrop-blur-md transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.98]",
        "min-w-[300px] max-w-[460px] select-none",
      )}
    >
      {/* Round Pastel Icon */}
      <div
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full border text-base transition-transform group-hover:scale-105",
          config.iconBg,
          config.iconBorder,
          config.iconColor,
        )}
      >
        <IconComponent className="size-5 stroke-[1.8]" />
      </div>

      {/* Text block */}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5 text-left">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="truncate text-[14px] font-bold tracking-tight text-slate-800 leading-tight">
            {displayTitle}
          </span>
          {detectedRef && (
            <span className="inline-flex shrink-0 items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200/80 shadow-2xs font-mono">
              {detectedRef}
            </span>
          )}
        </div>
        {description && (
          <span className="truncate text-[12.5px] font-normal text-slate-500 leading-tight mt-0.5">
            {description}
          </span>
        )}
      </div>
    </div>
  );
}

const recentPillToasts = new Map<string, number>();

export function showPillToast({
  title,
  description,
  type = "info",
  duration = 4000,
  icon,
  bookingReference,
}: PillToastOptions) {
  // Built-in deduplication: suppress duplicate toasts within 4 seconds
  const descString = typeof description === "string" ? description : "";
  const dedupeKey = `${type}:${title}:${descString}:${bookingReference || ""}`.toLowerCase();
  const now = Date.now();
  const lastShown = recentPillToasts.get(dedupeKey);
  if (lastShown && now - lastShown < 4000) {
    return "";
  }
  recentPillToasts.set(dedupeKey, now);

  // Clean old entries after 30 seconds
  if (recentPillToasts.size > 50) {
    for (const [k, time] of recentPillToasts.entries()) {
      if (now - time > 30000) {
        recentPillToasts.delete(k);
      }
    }
  }

  return toast.custom(
    (id) => (
      <PillToastCard
        title={title}
        description={description}
        type={type}
        customIcon={icon}
        bookingReference={bookingReference}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration },
  );
}

// Preset helpers matching the design exactly
showPillToast.comment = (
  description: React.ReactNode,
  title = "New comment",
  bookingReference?: string,
) => showPillToast({ title, description, type: "comment", bookingReference });

showPillToast.reminder = (
  description: React.ReactNode,
  title = "Reminder",
  bookingReference?: string,
) => showPillToast({ title, description, type: "reminder", bookingReference });

showPillToast.build = (
  description: React.ReactNode,
  title = "Build Complete",
  bookingReference?: string,
) => showPillToast({ title, description, type: "build", bookingReference });

showPillToast.mention = (
  description: React.ReactNode,
  title = "Mention",
  bookingReference?: string,
) => showPillToast({ title, description, type: "mention", bookingReference });

showPillToast.success = (
  description: React.ReactNode,
  title = "Booking Confirmed",
  bookingReference?: string,
) => showPillToast({ title, description, type: "success", bookingReference });

showPillToast.error = (description: React.ReactNode, title = "Notice", bookingReference?: string) =>
  showPillToast({ title, description, type: "error", bookingReference });

showPillToast.info = (
  description: React.ReactNode,
  title = "Information",
  bookingReference?: string,
) => showPillToast({ title, description, type: "info", bookingReference });

showPillToast.ai = (
  description: React.ReactNode,
  title = "AI Assistant",
  bookingReference?: string,
) => showPillToast({ title, description, type: "ai", bookingReference });
