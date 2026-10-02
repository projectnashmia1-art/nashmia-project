import React, { useState, useMemo } from "react";
import {
  Bell,
  CheckCircle2,
  ExternalLink,
  Inbox,
  Lightbulb,
  Mail,
  MessageSquareReply,
  Package,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  Trash2,
  TrendingUp,
  Wrench,
  X,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { showPillToast } from "@/lib/pill-toast";
import { useNotifications, type NotificationItem } from "@/lib/notifications-context";
import { cn } from "@/lib/utils";
import { NotificationsListSkeleton } from "@/components/nashmia/skeletons/NotificationSkeletons";

interface AINotificationCenterProps {
  onClose?: () => void;
  className?: string;
  isBottomSheet?: boolean;
}

type DateTabType = "all" | "today" | "thisWeek" | "earlier";
type FilterType = "all" | "replies" | "requests" | "milestones" | "cutoffs" | "unread";

export const AINotificationCenter: React.FC<AINotificationCenterProps> = ({
  onClose,
  className,
  isBottomSheet = false,
}) => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isSyncing,
    markAsRead,
    markAllAsRead,
    clearAll,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const [activeDateTab, setActiveDateTab] = useState<DateTabType>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter items by Date Tab + Sub Filter + Search Query
  const filteredItems = useMemo(() => {
    return notifications.filter((item) => {
      // 1. Date Tab Filter
      if (activeDateTab !== "all" && item.category !== activeDateTab) {
        return false;
      }

      // 2. Category Sub-filter
      if (filterType === "replies" && item.type !== "booking_reply") return false;
      if (filterType === "requests" && item.type !== "booking_request") return false;
      if (filterType === "milestones" && item.type !== "tracking_event" && item.type !== "system")
        return false;
      if (filterType === "cutoffs" && item.type !== "cutoff_reminder") return false;
      if (filterType === "unread" && !item.unread) return false;

      // 3. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = item.title.toLowerCase().includes(query);
        const descMatch = (item.rawDescription || "").toLowerCase().includes(query);
        const refMatch = (item.bookingReference || "").toLowerCase().includes(query);
        const senderMatch = (item.senderName || "").toLowerCase().includes(query);
        const recipientMatch = (item.recipientName || "").toLowerCase().includes(query);

        if (!titleMatch && !descMatch && !refMatch && !senderMatch && !recipientMatch) {
          return false;
        }
      }

      return true;
    });
  }, [notifications, activeDateTab, filterType, searchQuery]);

  // Dynamic counts
  const totalCount = notifications.length;
  const replyCount = useMemo(
    () => notifications.filter((n) => n.type === "booking_reply").length,
    [notifications],
  );
  const requestCount = useMemo(
    () => notifications.filter((n) => n.type === "booking_request").length,
    [notifications],
  );
  const milestoneCount = useMemo(
    () => notifications.filter((n) => n.type === "tracking_event" || n.type === "system").length,
    [notifications],
  );
  const cutoffCount = useMemo(
    () => notifications.filter((n) => n.type === "cutoff_reminder").length,
    [notifications],
  );

  const todayCount = useMemo(
    () => notifications.filter((n) => n.category === "today").length,
    [notifications],
  );
  const thisWeekCount = useMemo(
    () => notifications.filter((n) => n.category === "thisWeek").length,
    [notifications],
  );
  const earlierCount = useMemo(
    () => notifications.filter((n) => n.category === "earlier").length,
    [notifications],
  );

  const renderIcon = (type: NotificationItem["icon"], itemType: NotificationItem["type"]) => {
    if (itemType === "cutoff_reminder" || type === "alert") {
      return <Timer className="size-4.5 text-amber-600 stroke-[2.2]" />;
    }
    if (itemType === "booking_reply" || type === "reply") {
      return <MessageSquareReply className="size-4.5 text-emerald-600 stroke-[2.2]" />;
    }
    if (itemType === "booking_request" || type === "mail") {
      return <Send className="size-4.5 text-[#0FA3B1] stroke-[2.2]" />;
    }
    switch (type) {
      case "sparkles":
        return <Sparkles className="size-4.5 text-purple-600 stroke-[2]" />;
      case "check":
        return <CheckCircle2 className="size-4.5 text-blue-600 stroke-[2]" />;
      case "shield":
        return <ShieldCheck className="size-4.5 text-indigo-600 stroke-[2]" />;
      case "package":
        return <Package className="size-4.5 text-amber-600 stroke-[2]" />;
      case "trend":
        return <TrendingUp className="size-4.5 text-slate-700 stroke-[2]" />;
      case "wrench":
        return <Wrench className="size-4.5 text-slate-700 stroke-[2]" />;
      default:
        return <Lightbulb className="size-4.5 text-slate-700 stroke-[2]" />;
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    markAsRead(item.id);

    if (item.type === "cutoff_reminder" && item.bookingReference) {
      onClose?.();
      navigate({
        to: "/movements",
        search: { ref: item.bookingReference } as Record<string, unknown>,
      });
      return;
    }

    if (item.linkUrl) {
      onClose?.();
      navigate({ to: item.linkUrl });
    } else if (item.bookingReference) {
      onClose?.();
      navigate({
        to: "/emails",
        search: { search: item.bookingReference } as Record<string, unknown>,
      });
    } else {
      showPillToast.info(item.rawDescription || item.title, item.title);
    }
  };

  return (
    <div
      id="ai-notification-center"
      className={cn(
        "text-left font-sans transition-all select-none w-full max-w-full overflow-hidden",
        isBottomSheet
          ? "rounded-none bg-transparent p-0 border-0 shadow-none"
          : "w-[min(460px,calc(100vw-24px))] max-w-full rounded-[24px] bg-white p-4 sm:p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18),0_0_1px_1px_rgba(0,0,0,0.06)] border border-slate-100/90",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2 w-full max-w-full">
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
          <div className="relative grid size-8 sm:size-8.5 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Bell className="size-3.5 sm:size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-2 sm:size-2.5 rounded-full bg-[#0FA3B1] ring-2 ring-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h2 className="text-[14.5px] sm:text-[15.5px] font-bold tracking-tight text-slate-900 truncate">
                Notification Center
              </h2>
              {unreadCount > 0 && (
                <span className="inline-flex shrink-0 items-center rounded-full bg-[#0FA3B1]/10 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-[#0FA3B1]">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[10.5px] sm:text-[11px] font-medium text-slate-400 truncate max-w-[210px] xs:max-w-xs sm:max-w-none">
              Live Booking Requests & Milestones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              clearAll();
            }}
            disabled={notifications.length === 0}
            title="Clear all notifications"
            className="flex items-center gap-1 rounded-lg border border-slate-200/80 bg-white px-2 py-1 text-[11px] sm:text-[11.5px] font-semibold text-slate-600 transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 disabled:cursor-not-allowed"
          >
            <Trash2 className="size-3 sm:size-3.5 text-rose-500" />
            <span className="hidden xs:inline">Clear All</span>
            <span className="xs:hidden">Clear</span>
          </button>
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            title="Mark all as read"
            className="rounded-lg border border-slate-200/80 bg-white px-2 py-1 text-[11px] sm:text-[11.5px] font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white disabled:hover:text-slate-600 disabled:cursor-not-allowed"
          >
            <span className="hidden xs:inline">Read All</span>
            <span className="xs:hidden">Read</span>
          </button>
        </div>
      </div>

      {/* Date Period Tabs */}
      <div className="mt-2.5 sm:mt-3 grid grid-cols-4 gap-1 rounded-xl bg-slate-100/90 p-1 w-full max-w-full">
        <button
          type="button"
          onClick={() => setActiveDateTab("all")}
          className={cn(
            "rounded-lg py-1 px-1 text-[11px] sm:text-[12px] font-semibold transition-all flex items-center justify-center gap-0.5 sm:gap-1 truncate",
            activeDateTab === "all"
              ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          <span>All</span>
          <span className="text-[10px] text-slate-400">({totalCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveDateTab("today")}
          className={cn(
            "rounded-lg py-1 px-1 text-[11px] sm:text-[12px] font-semibold transition-all flex items-center justify-center gap-0.5 sm:gap-1 truncate",
            activeDateTab === "today"
              ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          <span>Today</span>
          {todayCount > 0 && <span className="text-[10px] text-slate-400">({todayCount})</span>}
        </button>
        <button
          type="button"
          onClick={() => setActiveDateTab("thisWeek")}
          className={cn(
            "rounded-lg py-1 px-1 text-[11px] sm:text-[12px] font-semibold transition-all flex items-center justify-center gap-0.5 sm:gap-1 truncate",
            activeDateTab === "thisWeek"
              ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          <span>
            <span className="hidden sm:inline">This </span>Week
          </span>
          {thisWeekCount > 0 && (
            <span className="text-[10px] text-slate-400">({thisWeekCount})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveDateTab("earlier")}
          className={cn(
            "rounded-lg py-1 px-1 text-[11px] sm:text-[12px] font-semibold transition-all flex items-center justify-center gap-0.5 sm:gap-1 truncate",
            activeDateTab === "earlier"
              ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          <span>Earlier</span>
          {earlierCount > 0 && <span className="text-[10px] text-slate-400">({earlierCount})</span>}
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="mt-2.5 relative w-full max-w-full">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by ref, forwarder, or keyword..."
          className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200/90 bg-slate-50/50 text-[12px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0FA3B1] truncate"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] sm:text-xs no-scrollbar w-full max-w-full">
        <button
          type="button"
          onClick={() => setFilterType("all")}
          className={cn(
            "px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
            filterType === "all"
              ? "bg-slate-900 text-white shadow-xs"
              : "bg-slate-100/70 text-slate-600 hover:bg-slate-200/70",
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterType("replies")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
            filterType === "replies"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
          )}
        >
          <MessageSquareReply className="size-3" />
          <span>Replies ({replyCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterType("requests")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
            filterType === "requests"
              ? "bg-[#0FA3B1] text-white shadow-xs"
              : "bg-[#0FA3B1]/10 text-[#0FA3B1] hover:bg-[#0FA3B1]/20",
          )}
        >
          <Send className="size-3" />
          <span>Sent Requests ({requestCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterType("milestones")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
            filterType === "milestones"
              ? "bg-purple-600 text-white shadow-xs"
              : "bg-purple-50 text-purple-700 hover:bg-purple-100",
          )}
        >
          <Sparkles className="size-3" />
          <span>Milestones ({milestoneCount})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterType("cutoffs")}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all shrink-0",
            filterType === "cutoffs"
              ? "bg-amber-600 text-white shadow-xs"
              : "bg-amber-50 text-amber-800 hover:bg-amber-100",
          )}
        >
          <Timer className="size-3" />
          <span>Cut-Offs ({cutoffCount})</span>
        </button>
      </div>

      {/* Notifications Scroll Area */}
      <div
        className={cn(
          "mt-2.5 sm:mt-3 divide-y divide-slate-100 overflow-y-auto pr-0.5 sm:pr-1 w-full max-w-full",
          isBottomSheet ? "max-h-[50vh] sm:max-h-[55vh]" : "max-h-[340px]",
        )}
      >
        {isSyncing && notifications.length === 0 ? (
          <NotificationsListSkeleton count={4} />
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center">
            <Inbox className="size-8 mx-auto text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">No notifications found</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {searchQuery
                ? `No results matching "${searchQuery}".`
                : filterType !== "all"
                  ? `No ${filterType} available in this view.`
                  : "All operational communication is synchronized."}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isConfirmed =
              item.type === "booking_confirmed" ||
              item.title.toLowerCase().includes("confirmed") ||
              item.description.toLowerCase().includes("confirmed");
            const isReply = item.type === "booking_reply";
            const isRequest = item.type === "booking_request";
            const isCutoff = item.type === "cutoff_reminder";

            const displayRef =
              item.bookingReference ||
              `${item.title} ${item.description}`.match(
                /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
              )?.[0];

            return (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={cn(
                  "group relative flex cursor-pointer items-start gap-2.5 sm:gap-3 py-2.5 sm:py-3 px-1.5 sm:px-2 rounded-xl transition-all hover:bg-slate-50 active:scale-[0.99] w-full max-w-full min-w-0",
                  item.unread && "bg-[#0FA3B1]/4 hover:bg-[#0FA3B1]/8",
                )}
              >
                {/* Left Icon */}
                <div
                  className={cn(
                    "grid size-8 sm:size-9 shrink-0 place-items-center rounded-xl border bg-white shadow-2xs transition-all",
                    isCutoff
                      ? "border-amber-200 bg-amber-50/90 text-amber-600"
                      : isConfirmed
                        ? "border-emerald-200 bg-emerald-50/70 text-emerald-600"
                        : isReply
                          ? "border-emerald-200 bg-emerald-50/60 text-emerald-600"
                          : isRequest
                            ? "border-[#0FA3B1]/30 bg-[#0FA3B1]/5 text-[#0FA3B1]"
                            : "border-slate-200/90 text-slate-600",
                  )}
                >
                  {renderIcon(item.icon, item.type)}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {item.unread && (
                        <span className="size-1.5 shrink-0 rounded-full bg-[#0FA3B1]" />
                      )}
                      <span className="truncate text-[12.5px] sm:text-[13px] font-bold text-slate-900">
                        {item.title}
                      </span>
                    </div>
                    <span className="shrink-0 text-[10.5px] sm:text-[11px] font-normal text-slate-400">
                      {item.time}
                    </span>
                  </div>

                  {/* Description / Snippet */}
                  <p className="mt-0.5 text-[11.5px] sm:text-[12px] leading-relaxed text-slate-600 line-clamp-2 break-words">
                    {item.description}
                  </p>

                  {/* Badges / Tags */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:gap-1.5 max-w-full">
                    {displayRef && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] sm:text-[10.5px] font-bold tracking-tight shadow-2xs truncate max-w-[130px]",
                          isConfirmed
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                            : "bg-slate-100 text-slate-700 border border-slate-200/60",
                        )}
                      >
                        {displayRef}
                      </span>
                    )}
                    {isConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-semibold text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                        <CheckCircle2 className="size-2.5 sm:size-3" />
                        Confirmed
                      </span>
                    )}
                    {isReply && !isConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        <MessageSquareReply className="size-2.5 sm:size-3" />
                        Reply
                      </span>
                    )}
                    {isRequest && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-semibold text-[#0FA3B1] bg-[#0FA3B1]/10 px-1.5 py-0.5 rounded-md">
                        <Send className="size-2.5 sm:size-3" />
                        Request Sent
                      </span>
                    )}
                    {isCutoff && (
                      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[10.5px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/80">
                        <Timer className="size-2.5 sm:size-3" />
                        Deadline
                      </span>
                    )}
                    {isCutoff && item.cutoffDetails?.cutoffType && (
                      <span className="inline-flex items-center text-[10px] sm:text-[10.5px] font-medium text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded-md truncate max-w-[110px]">
                        {item.cutoffDetails.cutoffType}
                      </span>
                    )}
                    <span className="text-[10px] sm:text-[10.5px] text-slate-400 group-hover:text-slate-700 inline-flex items-center gap-0.5 ml-auto opacity-0 sm:group-hover:opacity-100 transition-opacity font-medium">
                      Open <ExternalLink className="size-2.5" />
                    </span>
                  </div>
                </div>

                {/* Dismiss item button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(item.id);
                  }}
                  className="opacity-70 sm:opacity-0 sm:group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 rounded transition-all shrink-0"
                  title="Dismiss notification"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] sm:text-[11.5px] w-full max-w-full">
        <button
          type="button"
          onClick={clearAll}
          className="text-slate-400 hover:text-rose-600 transition-colors"
        >
          Clear all
        </button>
        <button
          type="button"
          onClick={() => {
            onClose?.();
            navigate({ to: "/emails" });
          }}
          className="inline-flex items-center gap-1 font-semibold text-[#0FA3B1] hover:text-[#0c828e] transition-colors"
        >
          <Mail className="size-3.5" />
          <span>Open Email Center</span>
        </button>
      </div>
    </div>
  );
};
