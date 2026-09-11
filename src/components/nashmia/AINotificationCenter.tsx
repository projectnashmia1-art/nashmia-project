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
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { showPillToast } from "@/lib/pill-toast";
import { useNotifications, type NotificationItem } from "@/lib/notifications-context";
import { cn } from "@/lib/utils";

interface AINotificationCenterProps {
  onClose?: () => void;
}

type DateTabType = "all" | "today" | "thisWeek" | "earlier";
type FilterType = "all" | "replies" | "requests" | "milestones" | "unread";

export const AINotificationCenter: React.FC<AINotificationCenterProps> = ({ onClose }) => {
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
    simulateBookingReply,
    simulateBookingRequest,
  } = useNotifications();

  const [activeDateTab, setActiveDateTab] = useState<DateTabType>("all");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSimulateInput, setShowSimulateInput] = useState(false);
  const [simMode, setSimMode] = useState<"reply" | "request">("reply");
  const [simRef, setSimRef] = useState("BK-2026-0814");
  const [simSender, setSimSender] = useState("Maersk Freight Customer Desk");
  const [simMessage, setSimMessage] = useState(
    "Booking request confirmed. Container release order CRO-99182 allocated for Karachi to Jebel Ali voyage.",
  );

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

  const handleExecuteSimulate = (e: React.FormEvent) => {
    e.preventDefault();
    if (simMode === "reply") {
      simulateBookingReply(
        simRef || "BK-2026-0814",
        simSender || "Maersk Customer Booking Desk",
        simMessage ||
          "Booking space confirmed. Container release order CRO-99182 allocated for voyage.",
      );
    } else {
      simulateBookingRequest(
        simRef || "BK-2026-0925",
        simSender || "Hapag-Lloyd Ocean Desk",
        "Karachi (PKKHI) → Hamburg (DEHAM)",
      );
    }
    setShowSimulateInput(false);
  };

  return (
    <div
      id="ai-notification-center"
      className="w-[410px] sm:w-[460px] max-w-[95vw] rounded-[24px] bg-white p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.18),0_0_1px_1px_rgba(0,0,0,0.06)] border border-slate-100/90 text-left font-sans transition-all select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="relative grid size-8.5 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-[#0FA3B1] ring-2 ring-white" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15.5px] font-bold tracking-tight text-slate-900">
                Notification Center
              </h2>
              {unreadCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#0FA3B1]/10 px-2 py-0.5 text-[11px] font-bold text-[#0FA3B1]">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[11px] font-medium text-slate-400">
              Live Booking Requests, Forwarder Replies & Milestones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => refreshNotifications()}
            disabled={isSyncing}
            title="Sync live notifications with email services and database"
            className="grid size-8 place-items-center rounded-lg border border-slate-200/80 bg-white text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            <RotateCw className={cn("size-3.5", isSyncing && "animate-spin text-[#0FA3B1]")} />
          </button>
          <button
            type="button"
            onClick={markAllAsRead}
            title="Mark all as read"
            className="rounded-lg border border-slate-200/80 bg-white px-2.5 py-1 text-[11.5px] font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900"
          >
            Read All
          </button>
        </div>
      </div>

      {/* Date Period Tabs */}
      <div className="mt-3 flex items-center rounded-xl bg-slate-100/90 p-1">
        <button
          type="button"
          onClick={() => setActiveDateTab("all")}
          className={cn(
            "flex-1 rounded-lg py-1 text-[12px] font-semibold transition-all flex items-center justify-center gap-1",
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
            "flex-1 rounded-lg py-1 text-[12px] font-semibold transition-all flex items-center justify-center gap-1",
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
            "flex-1 rounded-lg py-1 text-[12px] font-semibold transition-all flex items-center justify-center gap-1",
            activeDateTab === "thisWeek"
              ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
              : "text-slate-500 hover:text-slate-800",
          )}
        >
          <span>This Week</span>
          {thisWeekCount > 0 && (
            <span className="text-[10px] text-slate-400">({thisWeekCount})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveDateTab("earlier")}
          className={cn(
            "flex-1 rounded-lg py-1 text-[12px] font-semibold transition-all flex items-center justify-center gap-1",
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
      <div className="mt-2.5 relative">
        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by ref (e.g. BK-2026), forwarder, or keyword..."
          className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-slate-200/90 bg-slate-50/50 text-[12px] text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
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
      <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
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
      </div>

      {/* Simulator Test Action Bar */}
      <div className="mt-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-2.5 transition-all">
        {!showSimulateInput ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Zap className="size-3.5 text-amber-500 shrink-0" />
              <span className="text-[11.5px] font-medium text-slate-700 truncate">
                Workflow Simulator:
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSimMode("reply");
                  setSimRef("BK-2026-0814");
                  setSimSender("Maersk Freight Customer Desk");
                  setSimMessage(
                    "Booking space confirmed. Container release order CRO-99182 allocated for Karachi to Jebel Ali voyage.",
                  );
                  setShowSimulateInput(true);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-2xs hover:bg-emerald-50 transition-all"
              >
                + Reply
              </button>
              <button
                type="button"
                onClick={() => {
                  setSimMode("request");
                  setSimRef("BK-2026-0925");
                  setSimSender("Hapag-Lloyd Ocean Desk");
                  setSimMessage(
                    "Booking request dispatched for 3x 40HC containers (Karachi to Hamburg). Vessel allocation requested.",
                  );
                  setShowSimulateInput(true);
                }}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-[#0FA3B1]/30 px-2 py-0.5 text-[11px] font-semibold text-[#0FA3B1] shadow-2xs hover:bg-[#0FA3B1]/10 transition-all"
              >
                + Sent Request
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleExecuteSimulate} className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11.5px] font-bold text-slate-800">
                {simMode === "reply"
                  ? "Simulate Forwarder Reply"
                  : "Simulate Outbound Request Dispatch"}
              </span>
              <button
                type="button"
                onClick={() => setShowSimulateInput(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <input
                type="text"
                value={simRef}
                onChange={(e) => setSimRef(e.target.value)}
                placeholder="Booking Ref (e.g. BK-2026-0814)"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] text-slate-900"
              />
              <input
                type="text"
                value={simSender}
                onChange={(e) => setSimSender(e.target.value)}
                placeholder={
                  simMode === "reply" ? "Sender (e.g. Maersk Desk)" : "Recipient (e.g. Hapag Line)"
                }
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] text-slate-900"
              />
            </div>
            <textarea
              rows={2}
              value={simMessage}
              onChange={(e) => setSimMessage(e.target.value)}
              placeholder="Message details..."
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] text-slate-900 resize-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setShowSimulateInput(false)}
                className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-bold text-white shadow-xs",
                  simMode === "reply"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-[#0FA3B1] hover:bg-[#0c828e]",
                )}
              >
                {simMode === "reply" ? "Simulate Inbound Reply" : "Simulate Outbound Request"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Notifications Scroll Area */}
      <div className="mt-3 divide-y divide-slate-100 max-h-[340px] overflow-y-auto pr-1">
        {filteredItems.length === 0 ? (
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
                  "group relative flex cursor-pointer items-start gap-3 py-3 px-2 rounded-xl transition-all hover:bg-slate-50 active:scale-[0.99]",
                  item.unread && "bg-[#0FA3B1]/4 hover:bg-[#0FA3B1]/8",
                )}
              >
                {/* Left Icon */}
                <div
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl border bg-white shadow-2xs transition-all",
                    isConfirmed
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
                    <div className="flex items-center gap-1.5 truncate">
                      {item.unread && (
                        <span className="size-1.5 shrink-0 rounded-full bg-[#0FA3B1]" />
                      )}
                      <span className="truncate text-[13px] font-bold text-slate-900">
                        {item.title}
                      </span>
                    </div>
                    <span className="shrink-0 text-[11px] font-normal text-slate-400">
                      {item.time}
                    </span>
                  </div>

                  {/* Description / Snippet */}
                  <p className="mt-0.5 text-[12px] leading-relaxed text-slate-600 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Badges / Tags */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {displayRef && (
                      <span
                        className={cn(
                          "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tracking-tight shadow-2xs",
                          isConfirmed
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80"
                            : "bg-slate-100 text-slate-700 border border-slate-200/60",
                        )}
                      >
                        {displayRef}
                      </span>
                    )}
                    {isConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50/80 px-1.5 py-0.5 rounded-md border border-emerald-200/60">
                        <CheckCircle2 className="size-3" />
                        Confirmed
                      </span>
                    )}
                    {isReply && !isConfirmed && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                        <MessageSquareReply className="size-3" />
                        Reply Received
                      </span>
                    )}
                    {isRequest && (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-[#0FA3B1] bg-[#0FA3B1]/10 px-1.5 py-0.5 rounded-md">
                        <Send className="size-3" />
                        Booking Request Sent
                      </span>
                    )}
                    <span className="text-[10.5px] text-slate-400 group-hover:text-slate-700 inline-flex items-center gap-0.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity font-medium">
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
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1 rounded transition-all shrink-0"
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
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11.5px]">
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
