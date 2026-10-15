import { useState, useMemo, useEffect } from "react";
import {
  Search,
  SlidersHorizontal,
  Paperclip,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Inbox,
  X,
} from "lucide-react";
import type { EmailMessageRecord, EmailStatus } from "@/types/email.types";
import { cn } from "@/lib/utils";
import { classifyConfirmationDeterministic } from "@/lib/forwarder-confirmation-detector";
import { getLocalBookings } from "@/lib/supabase-services";
import { EmailListSkeleton } from "@/components/nashmia/skeletons/EmailSkeletons";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";

interface EmailListPanelProps {
  emails: EmailMessageRecord[];
  selectedEmailId: string | null;
  onSelectEmail: (email: EmailMessageRecord) => void;
  isLoading: boolean;
  onOpenComposeDraft?: (email: EmailMessageRecord) => void;
  onRetryEmail?: (email: EmailMessageRecord) => void;
}

const SENDER_AVATARS: Record<string, string> = {
  "sam miller":
    "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  "lily jones":
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  smith:
    "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
  patrick:
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
};

const DEFAULT_AVATARS = [
  "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
];

export function getSenderAvatar(name?: string, email?: string): string {
  const clean = (name || email || "User").toLowerCase().trim();
  if (SENDER_AVATARS[clean]) return SENDER_AVATARS[clean];
  for (const [k, url] of Object.entries(SENDER_AVATARS)) {
    if (clean.includes(k)) return url;
  }
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[idx];
}

export function formatCardTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const now = new Date();
    const isToday =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();

    const timeFormatted = d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) {
      return `Today, ${timeFormatted}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Yesterday, ${timeFormatted}`;
    }

    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600 * 24));
    if (diffDays < 7) {
      const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
      return `${weekday}, ${timeFormatted}`;
    }

    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateStr;
  }
}

export function EmailListPanel({
  emails,
  selectedEmailId,
  onSelectEmail,
  isLoading,
  onOpenComposeDraft,
  onRetryEmail,
}: EmailListPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("ALL");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);

  // Listen for confirmation & forwarder quote events to re-check highlighting immediately
  useEffect(() => {
    const handleUpdate = () => {
      setRefreshTick((t) => t + 1);
    };

    window.addEventListener("nashmia_booking_confirmed", handleUpdate);
    window.addEventListener("nashmia_forwarder_offer_received", handleUpdate);
    window.addEventListener("nashmia_multi_forwarder_updated", handleUpdate);
    window.addEventListener("nashmia_multi_forwarder_dispatched", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("nashmia_booking_confirmed", handleUpdate);
      window.removeEventListener("nashmia_forwarder_offer_received", handleUpdate);
      window.removeEventListener("nashmia_multi_forwarder_updated", handleUpdate);
      window.removeEventListener("nashmia_multi_forwarder_dispatched", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Dynamically computed sets of confirmed references and thread IDs
  const { confirmedBookingRefs, acceptedThreadIds } = useMemo(() => {
    const refs = new Set<string>();
    const threads = new Set<string>();

    // 1. Check bookings from local state
    const bookings = getLocalBookings();
    for (const b of bookings) {
      const statusUpper = (b.status || "").toUpperCase();
      const confUpper = (b.confirmation_status || "").toUpperCase();
      if (
        statusUpper.includes("CONFIRM") ||
        statusUpper === "LOADED" ||
        statusUpper === "IN TRANSIT" ||
        confUpper === "CONFIRMED"
      ) {
        if (b.booking_reference) refs.add(b.booking_reference.trim().toUpperCase());
        if (b.movement_number) refs.add(b.movement_number.trim().toUpperCase());
        if (b.reference) refs.add(b.reference.trim().toUpperCase());
        if (b.id) refs.add(b.id.trim().toUpperCase());
      }
    }

    // 2. Check multi-forwarder requests in localStorage
    try {
      const fwdRaw = localStorage.getItem("nashmia_forwarder_requests");
      if (fwdRaw) {
        const parsed = JSON.parse(fwdRaw);
        if (Array.isArray(parsed)) {
          for (const req of parsed) {
            if (req.status === "ACCEPTED" || req.status === "OFFER_RECEIVED") {
              if (req.movementNumber) refs.add(req.movementNumber.trim().toUpperCase());
              if (req.bookingId) refs.add(req.bookingId.trim().toUpperCase());
              if (req.gmailThreadId) threads.add(req.gmailThreadId.trim());
            }
          }
        }
      }
    } catch {
      // ignore JSON parse error
    }

    // 3. Check cached bookings
    try {
      const cachedRaw = localStorage.getItem("nashmia_cached_bookings");
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        if (Array.isArray(parsed)) {
          for (const b of parsed) {
            const st = (b.status || "").toUpperCase();
            const cf = (b.confirmationStatus || b.confirmation_status || "").toUpperCase();
            if (st.includes("CONFIRM") || cf === "CONFIRMED") {
              if (b.reference) refs.add(b.reference.trim().toUpperCase());
              if (b.id) refs.add(b.id.trim().toUpperCase());
            }
          }
        }
      }
    } catch {
      // ignore
    }

    return { confirmedBookingRefs: refs, acceptedThreadIds: threads };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emails, refreshTick]);

  // Filter emails matching query and optional status/type
  const filteredList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return emails.filter((item) => {
      // Text Search across recipients, senders, subject, body, booking reference, forwarder
      if (q) {
        const matchRecipient = `${item.toEmail} ${item.toName || ""}`.toLowerCase().includes(q);
        const matchSender = `${item.fromEmail} ${item.fromName || ""}`.toLowerCase().includes(q);
        const matchSubject = item.subject.toLowerCase().includes(q);
        const matchRef = (item.bookingReference || "").toLowerCase().includes(q);
        const matchBody = item.body.toLowerCase().includes(q);
        const matchForwarder = (item.forwarderName || "").toLowerCase().includes(q);

        if (
          !matchRecipient &&
          !matchSender &&
          !matchSubject &&
          !matchRef &&
          !matchBody &&
          !matchForwarder
        ) {
          return false;
        }
      }

      if (selectedStatusFilter !== "ALL" && item.status !== selectedStatusFilter) {
        return false;
      }

      if (selectedTypeFilter !== "ALL" && item.emailType !== selectedTypeFilter) {
        return false;
      }

      return true;
    });
  }, [emails, searchQuery, selectedStatusFilter, selectedTypeFilter]);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full select-none">
      {/* 1. Search Bar at Top with Filter Icon */}
      <div className="relative mb-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-4 py-3 flex items-center gap-3 transition-shadow focus-within:shadow-sm focus-within:border-slate-300">
          <Search className="size-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent text-[14px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFilterOpen((v) => !v)}
            title="Filter options"
            className={cn(
              "p-1.5 rounded-lg transition-colors shrink-0",
              isFilterOpen || selectedStatusFilter !== "ALL" || selectedTypeFilter !== "ALL"
                ? "bg-slate-100 text-slate-900"
                : "text-slate-400 hover:text-slate-700 hover:bg-slate-50",
            )}
          >
            <SlidersHorizontal className="size-4.5" />
          </button>
        </div>

        {/* Filter Drawer */}
        {isFilterOpen && (
          <div className="absolute top-full mt-2 left-0 right-0 z-20 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-lg space-y-3 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Filter Conversations</span>
              {(selectedStatusFilter !== "ALL" || selectedTypeFilter !== "ALL") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStatusFilter("ALL");
                    setSelectedTypeFilter("ALL");
                  }}
                  className="text-blue-600 hover:underline text-[11px]"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <LifecycleDropdownSelect
                label="Status"
                value={selectedStatusFilter}
                onChange={(val) => setSelectedStatusFilter(val)}
                options={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "SENT", label: "Sent" },
                  { value: "PENDING", label: "Pending" },
                  { value: "DRAFT", label: "Drafts" },
                  { value: "FAILED", label: "Failed" },
                ]}
                placeholder="All Statuses"
                size="sm"
                activeColor="teal"
                triggerClassName="h-8.5 w-full text-xs font-medium"
              />

              <LifecycleDropdownSelect
                label="Category"
                value={selectedTypeFilter}
                onChange={(val) => setSelectedTypeFilter(val)}
                options={[
                  { value: "ALL", label: "All Categories" },
                  { value: "BOOKING_REQUEST", label: "Booking Request" },
                  { value: "BOOKING_CONFIRMATION", label: "Confirmation" },
                  { value: "GENERAL", label: "General" },
                ]}
                placeholder="All Categories"
                size="sm"
                activeColor="teal"
                triggerClassName="h-8.5 w-full text-xs font-medium"
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. Scrollable Email Conversation Cards */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-200">
        {isLoading ? (
          <EmailListSkeleton count={4} />
        ) : filteredList.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-2xl p-12 border border-slate-200/70 text-center space-y-3 shadow-xs">
            <div className="size-12 rounded-full bg-slate-100 text-slate-400 grid place-items-center mx-auto">
              <Inbox className="size-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No emails found</h3>
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {searchQuery
                ? "No email conversations match your search query."
                : "No emails recorded in this mailbox yet."}
            </p>
          </div>
        ) : (
          // Conversation Cards
          filteredList.map((item) => {
            const isSelected = selectedEmailId === item.id;
            const senderName =
              item.direction === "outbound"
                ? item.toName || item.forwarderName || item.toEmail
                : item.fromName ||
                  item.forwarderName ||
                  (item.fromEmail
                    ? item.fromEmail.split("@")[0].replace(/[._-]/g, " ")
                    : "Freight Forwarder");
            const avatarUrl = getSenderAvatar(senderName, item.fromEmail);
            const timeText = formatCardTimestamp(item.sentAt || item.createdAt);
            const previewText = item.snippet || item.body || "No preview available";

            // Determine if attachments exist
            const attachmentCount =
              item.attachments && item.attachments.length > 0
                ? item.attachments.length
                : 0;

            const movementRef =
              item.movementNumber ||
              item.bookingReference ||
              `${item.subject} ${item.body} ${item.snippet || ""}`.match(
                /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
              )?.[0];

            const detResult = classifyConfirmationDeterministic(
              item.subject || "",
              item.body || item.snippet || "",
              item.snippet,
            );

            const isDeterministicConfirmed = detResult?.status === "CONFIRMED";
            const isLinkedBookingConfirmed = Boolean(
              movementRef && confirmedBookingRefs.has(movementRef.trim().toUpperCase()),
            );

            const textLower = `${item.subject} ${item.body} ${item.snippet || ""}`.toLowerCase();
            const hasConfirmKeyword =
              textLower.includes("booking confirmed") ||
              textLower.includes("space confirmed") ||
              textLower.includes("booking is confirmed") ||
              textLower.includes("space is confirmed") ||
              textLower.includes("booking has been confirmed") ||
              textLower.includes("we confirm") ||
              textLower.includes("pleased to confirm") ||
              textLower.includes("happy to confirm") ||
              textLower.includes("allocation confirmed") ||
              textLower.includes("booking approved") ||
              textLower.includes("booking accepted") ||
              textLower.includes("space secured") ||
              textLower.includes("confirmed as booked") ||
              textLower.includes("confirmed for sailing") ||
              textLower.includes("confirmed on vessel") ||
              textLower.includes("confirmed with carrier");

            const isThreadAccepted = Boolean(
              (item.threadId && acceptedThreadIds.has(item.threadId.trim())) ||
              (item.gmailThreadId && acceptedThreadIds.has(item.gmailThreadId.trim())),
            );

            const isConfirmed =
              item.confirmationStatus === "CONFIRMED" ||
              item.emailType === "BOOKING_CONFIRMATION" ||
              isDeterministicConfirmed ||
              isLinkedBookingConfirmed ||
              isThreadAccepted ||
              hasConfirmKeyword;

            return (
              <div
                key={item.id}
                onClick={() => onSelectEmail(item)}
                className={cn(
                  "group relative rounded-2xl p-5 border transition-all duration-150 cursor-pointer shadow-xs",
                  isConfirmed
                    ? isSelected
                      ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/40 shadow-md"
                      : "border-emerald-300/90 bg-emerald-50/20 hover:bg-emerald-50/35 hover:border-emerald-400 ring-1 ring-emerald-400/20 shadow-xs"
                    : isSelected
                      ? "bg-white border-blue-400 ring-2 ring-blue-500/20 shadow-md"
                      : "bg-white border-slate-200/80 hover:border-slate-300 hover:shadow-md",
                )}
              >
                {/* Visual Left Accent Indicator for Confirmed Emails */}
                {isConfirmed && (
                  <div className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full bg-emerald-500 shadow-sm" />
                )}

                {/* Top Row: Avatar Initials, Sender Name & Time */}
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        "size-11 rounded-full grid place-items-center font-bold text-xs tracking-wider shadow-2xs border",
                        isConfirmed
                          ? "bg-emerald-100/90 text-emerald-800 border-emerald-300"
                          : "bg-slate-100 text-slate-700 border-slate-200",
                      )}
                    >
                      {senderName
                        .split(" ")
                        .map((n) => n[0])
                        .filter(Boolean)
                        .slice(0, 2)
                        .join("")
                        .toUpperCase() || "EM"}
                    </div>
                    {isConfirmed && (
                      <div className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white shadow-2xs">
                        <CheckCircle2 className="size-2.5" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="text-[15px] font-bold text-slate-900 truncate leading-tight flex items-center gap-1.5">
                        <span className="truncate">{senderName}</span>
                      </h4>
                      <span className="text-xs text-slate-400 font-medium whitespace-nowrap shrink-0">
                        {timeText}
                      </span>
                    </div>

                    {/* Confirmed Badge with Booking Reference */}
                    {isConfirmed && (
                      <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-bold shadow-2xs">
                          <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                          Booking Confirmed
                        </span>
                        {movementRef && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-white/90 border border-emerald-200 text-emerald-700 text-[10.5px] font-mono font-bold tracking-tight shadow-2xs">
                            {movementRef}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Subject Line */}
                    <p
                      className={cn(
                        "text-sm font-semibold mt-1 truncate",
                        isConfirmed ? "text-slate-900" : "text-slate-800",
                      )}
                    >
                      {item.subject}
                    </p>
                  </div>
                </div>

                {/* Body Preview Snippet */}
                <p className="text-[13px] text-slate-500 line-clamp-2 mt-2 leading-relaxed pl-14">
                  {previewText}
                </p>

                {/* Attachment Indicator */}
                {attachmentCount > 0 && (
                  <div className="pl-14 mt-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline">
                      <Paperclip className="size-3.5 rotate-45 stroke-[2.5]" />
                      <span>{attachmentCount} Attachments</span>
                    </span>
                  </div>
                )}

                {/* Contextual Action Links (Draft / Failed / Auto-Confirmed) */}
                {(item.status === "DRAFT" || item.status === "FAILED" || isConfirmed) && (
                  <div
                    className={cn(
                      "pl-14 mt-2.5 flex items-center justify-between pt-2 border-t",
                      isConfirmed ? "border-emerald-100" : "border-slate-100",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {item.status === "DRAFT" && onOpenComposeDraft && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenComposeDraft(item);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          <FileEdit className="size-3" />
                          <span>Edit Draft</span>
                        </button>
                      )}

                      {item.status === "FAILED" && onRetryEmail && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetryEmail(item);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline"
                        >
                          <RotateCcw className="size-3" />
                          <span>Retry Send</span>
                        </button>
                      )}

                      {isConfirmed && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                          <CheckCircle2 className="size-3.5 text-emerald-600" />
                          <span>Forwarder Confirmed • Space Secured</span>
                        </span>
                      )}
                    </div>

                    {isConfirmed && movementRef && (
                      <span className="text-[10px] font-mono font-bold text-emerald-600 bg-white px-1.5 py-0.5 rounded border border-emerald-200">
                        {movementRef}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
