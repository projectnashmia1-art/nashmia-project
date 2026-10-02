import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { supabase, isSupabaseConfigured } from "./supabase";
import { useAuth } from "./auth-context";
import { useGmail } from "./use-gmail";
import { showPillToast } from "./pill-toast";
import { fetchEmailsFromSupabase, saveLocalEmail } from "./email-services";
import { INITIAL_REQUESTS } from "./requests-data";
import { getLocalBookings } from "./supabase-services";
import { extractMovementNumber } from "./movement-lifecycle";
import {
  generateAllCutOffReminders,
  scheduleCutOffReminders,
  hasCutOffReminderToastBeenShown,
  markCutOffReminderToastShown,
} from "./movement-cutoff-service";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { EmailMessageRecord } from "@/types/email.types";

export type NotificationType =
  | "booking_request"
  | "booking_reply"
  | "booking_update"
  | "tracking_event"
  | "general_email"
  | "cutoff_reminder"
  | "system";

export interface NotificationItem {
  id: string;
  icon:
    | "lightbulb"
    | "trend"
    | "wrench"
    | "sparkles"
    | "check"
    | "shield"
    | "mail"
    | "package"
    | "reply"
    | "alert";
  title: string;
  time: string;
  timestamp: number;
  description: React.ReactNode;
  rawDescription?: string;
  unread?: boolean;
  category: "today" | "thisWeek" | "earlier";
  type: NotificationType;
  linkUrl?: string;
  bookingReference?: string;
  senderName?: string;
  senderEmail?: string;
  recipientName?: string;
  recipientEmail?: string;
  cutoffDetails?: {
    movementNumber: string;
    cutoffType: string;
    cutoffDateTime: string;
    reminderDateTime: string;
  };
}

export function formatNotificationRelativeTime(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "Just now";
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
}

export function categorizeNotificationDate(
  dateInput: string | number | Date,
): "today" | "thisWeek" | "earlier" {
  const date = new Date(dateInput);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours <= 24) return "today";
  if (diffHours <= 24 * 7) return "thisWeek";
  return "earlier";
}

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  isMounted: boolean;
  isSyncing: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  deleteNotification: (id: string) => void;
  refreshNotifications: () => Promise<void>;
  simulateBookingReply: (
    bookingRef?: string,
    customSender?: string,
    customSnippet?: string,
  ) => void;
  simulateBookingRequest: (bookingRef?: string, forwarderName?: string, route?: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const STORAGE_KEY = "nashmia_notification_center_items_v4";
const CLEARED_AT_KEY = "nashmia_notifications_cleared_at_v4";
const DISMISSED_IDS_KEY = "nashmia_notifications_dismissed_ids_v4";
const READ_IDS_KEY = "nashmia_notifications_read_ids_v4";
const CONFIRMATION_ALERTED_KEY = "nashmia_alerted_confirmations_v2";

export function getNotificationSignature(item: NotificationItem): string {
  if (item.bookingReference) {
    const cleanRef = item.bookingReference.trim().toUpperCase();
    if (item.type === "booking_confirmed") {
      return `confirmed:${cleanRef}`;
    }
    if (item.type === "cutoff_reminder") {
      return `cutoff:${cleanRef}:${item.cutoffDetails?.cutoffType || ""}`;
    }
    if (item.type === "booking_reply") {
      return `reply:${cleanRef}`;
    }
    if (item.type === "booking_request") {
      return `request:${cleanRef}`;
    }
  }
  return item.id;
}

const globalToastThrottleMap = new Map<string, number>();

export function shouldShowToast(signature: string, maxAgeMs = 20000): boolean {
  if (!signature) return false;
  const now = Date.now();
  const lastTime = globalToastThrottleMap.get(signature);
  if (lastTime && now - lastTime < maxAgeMs) {
    return false;
  }
  globalToastThrottleMap.set(signature, now);
  if (globalToastThrottleMap.size > 200) {
    for (const [k, v] of globalToastThrottleMap.entries()) {
      if (now - v > 60000) globalToastThrottleMap.delete(k);
    }
  }
  return true;
}

export function getClearedAt(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(CLEARED_AT_KEY);
    return raw ? parseInt(raw, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setClearedAt(timestamp: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLEARED_AT_KEY, String(timestamp));
  } catch {
    // Storage fallback
  }
}

export function getDismissedIds(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined") return set;
  try {
    const raw = localStorage.getItem(DISMISSED_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach((id) => set.add(String(id)));
    }
  } catch {
    // Storage fallback
  }
  return set;
}

export function addDismissedId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getDismissedIds();
    set.add(id);
    localStorage.setItem(DISMISSED_IDS_KEY, JSON.stringify(Array.from(set).slice(-200)));
  } catch {
    // Storage fallback
  }
}

export function getReadIds(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined") return set;
  try {
    const raw = localStorage.getItem(READ_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach((id) => set.add(String(id)));
    }
  } catch {
    // Storage fallback
  }
  return set;
}

export function addReadId(id: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getReadIds();
    set.add(id);
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(set).slice(-300)));
  } catch {
    // Storage fallback
  }
}

export function markAllIdsRead(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    const set = getReadIds();
    ids.forEach((id) => set.add(id));
    localStorage.setItem(READ_IDS_KEY, JSON.stringify(Array.from(set).slice(-300)));
  } catch {
    // Storage fallback
  }
}

// Global persistent deduplication tracker for confirmation toasts and notifications
function getAlertedConfirmationKeys(): Set<string> {
  const set = new Set<string>();
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(CONFIRMATION_ALERTED_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          arr.forEach((k) => set.add(String(k).trim().toUpperCase()));
        }
      }
    } catch {
      // Storage parsing fallback
    }
  }
  return set;
}

const alertedConfirmationKeys = getAlertedConfirmationKeys();

function shouldThrottleConfirmationToast(refKey: string | undefined): boolean {
  if (!refKey) return true;
  const cleanKey = refKey.trim().toUpperCase();
  if (!cleanKey || cleanKey === "CONFIRMED" || cleanKey === "BOOKING" || cleanKey === "NASH-BKG") {
    return true;
  }

  if (alertedConfirmationKeys.has(cleanKey)) {
    return true; // Already alerted for this movement / notif ID — never spam again
  }

  alertedConfirmationKeys.add(cleanKey);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        CONFIRMATION_ALERTED_KEY,
        JSON.stringify(Array.from(alertedConfirmationKeys).slice(-150)),
      );
    } catch {
      // Ignore storage limit
    }
  }
  return false;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useAuth();
  const gmail = useGmail();
  const seenGmailIdsRef = useRef<Set<string>>(new Set());
  const isFirstGmailLoadRef = useRef(true);
  const gmailLiveMessagesRef = useRef(gmail?.liveMessages);
  gmailLiveMessagesRef.current = gmail?.liveMessages;

  // Hydrate from localStorage only after component mounts in browser (SSR-safe)
  useEffect(() => {
    setIsMounted(true);
    try {
      const clearedAt = getClearedAt();
      const dismissed = getDismissedIds();
      const readIds = getReadIds();
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as NotificationItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const filtered = parsed
            .filter((p) => p.timestamp > clearedAt && !dismissed.has(p.id))
            .map((p) => (readIds.has(p.id) ? { ...p, unread: false } : p));
          setNotifications(filtered);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Save to localStorage whenever notifications change (only when mounted)
  useEffect(() => {
    if (!isMounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
    } catch {
      // Storage limits fallback
    }
  }, [notifications, isMounted]);

  // Unread count computation (0 during SSR/pre-mount to ensure flawless hydration)
  const unreadCount = useMemo(() => {
    if (!isMounted) return 0;
    return notifications.filter((n) => n.unread).length;
  }, [notifications, isMounted]);

  // Deduplicated safe addition helper
  const addItemDeduplicated = useCallback((item: NotificationItem) => {
    const clearedAt = getClearedAt();
    const dismissed = getDismissedIds();
    const readIds = getReadIds();

    if (item.timestamp <= clearedAt || dismissed.has(item.id)) {
      return;
    }

    const isRead = readIds.has(item.id) || item.unread === false;

    setNotifications((prev) => {
      const itemSig = getNotificationSignature(item);
      const existingIndex = prev.findIndex(
        (p) => getNotificationSignature(p) === itemSig || p.id === item.id,
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          ...item,
          unread: !isRead && (existing.unread || item.unread),
        };
        return updated.sort((a, b) => b.timestamp - a.timestamp);
      }

      return [{ ...item, unread: !isRead && item.unread }, ...prev].slice(0, 50);
    });
  }, []);

  // Comprehensive fetch from all sources (Email Service, Supabase Bookings, Initial Requests, and Gmail)
  const refreshNotifications = useCallback(async () => {
    setIsSyncing(true);
    const generatedItems: NotificationItem[] = [];
    const clearedAt = getClearedAt();
    const dismissedIds = getDismissedIds();
    const readIds = getReadIds();

    try {
      // 1. Fetch persistent notifications from Supabase 'notifications' table
      if (isSupabaseConfigured) {
        try {
          const { data: dbNotifications, error: dbNotifErr } = await supabase
            .from("notifications")
            .select(
              "id, user_id, type, title, message, booking_id, related_booking_id, link, is_read, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(30);

          if (!dbNotifErr && dbNotifications) {
            dbNotifications.forEach((n) => {
              const dateVal = n.created_at || new Date();
              const timestamp = new Date(dateVal).getTime();
              const notifId = `db-notif-${n.id}`;

              if (timestamp <= clearedAt || dismissedIds.has(notifId)) return;

              const cat = categorizeNotificationDate(dateVal);
              const timeStr = formatNotificationRelativeTime(dateVal);
              const isConfirmed =
                n.title?.toLowerCase().includes("confirmed") ||
                n.message?.toLowerCase().includes("confirmed") ||
                n.type === "booking_confirmed";

              const refMatch = `${n.title || ""} ${n.message || ""}`.match(
                /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
              );
              const bookingRef = refMatch ? refMatch[1].toUpperCase() : undefined;

              const notifTitle = isConfirmed
                ? bookingRef
                  ? `Booking Confirmed: ${bookingRef}`
                  : n.title || "Booking Confirmed"
                : n.title || "Notification";

              generatedItems.push({
                id: notifId,
                icon: isConfirmed ? "check" : n.type === "booking_reply" ? "reply" : "sparkles",
                title: notifTitle,
                time: timeStr,
                timestamp,
                description: n.message,
                rawDescription: n.message,
                unread: n.is_read === false && !readIds.has(notifId),
                category: cat,
                type: isConfirmed ? "booking_confirmed" : (n.type as NotificationType) || "system",
                bookingReference: bookingRef,
                linkUrl: n.link || "/requests",
              });
            });
          }
        } catch (dbNotifError) {
          console.warn("[NotificationsContext] Notice loading db notifications:", dbNotifError);
        }
      }

      // 2. Fetch email records (only inbound replies/confirmations requiring attention)
      const emails: EmailMessageRecord[] = await fetchEmailsFromSupabase(user?.id);

      emails.forEach((em) => {
        const dateVal = em.sentAt || em.createdAt || new Date();
        const timestamp = new Date(dateVal).getTime();
        const notifId = `email-reply-${em.id}`;

        if (timestamp <= clearedAt || dismissedIds.has(notifId)) return;

        const isReply =
          em.direction === "inbound" ||
          em.subject?.toLowerCase().startsWith("re:") ||
          em.emailType === "BOOKING_CONFIRMATION";

        // Only include inbound replies or confirmations to avoid spamming notification center
        if (!isReply) return;

        const cat = categorizeNotificationDate(dateVal);
        const timeStr = formatNotificationRelativeTime(dateVal);
        const subject = em.subject || "(No Subject)";
        const sender = em.fromName || em.fromEmail || "Forwarder Desk";
        const snippet = em.snippet || (em.body ? em.body.slice(0, 100) : subject);

        // Extract or derive booking ref
        const matched = `${subject} ${snippet}`.match(
          /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|GD-[A-Z0-9-]+)\b/i,
        );
        const bookingRef = em.bookingReference || (matched ? matched[0].toUpperCase() : undefined);

        generatedItems.push({
          id: notifId,
          icon: "reply",
          title: `Reply Received: ${bookingRef ? bookingRef + " - " : ""}${subject.replace(/^Re:\s*/i, "").slice(0, 36)}`,
          time: timeStr,
          timestamp,
          description: `From ${sender}: "${snippet}"`,
          rawDescription: `From ${sender}: "${snippet}"`,
          unread: !readIds.has(notifId) && cat === "today" && em.status !== "READ",
          category: cat,
          type: "booking_reply",
          bookingReference: bookingRef,
          senderName: sender,
          senderEmail: em.fromEmail,
          linkUrl: `/emails?search=${encodeURIComponent(bookingRef || subject)}`,
        });
      });

      // 3. Tracking milestones (only recent updates since clearedAt)
      if (isSupabaseConfigured) {
        const { data: events } = await supabase
          .from("booking_events")
          .select("id, booking_id, title, description, event_type, created_at")
          .order("created_at", { ascending: false })
          .limit(8);

        (events || []).forEach((ev) => {
          const dateVal = ev.created_at || new Date();
          const timestamp = new Date(dateVal).getTime();
          const notifId = `event-${ev.id}`;

          if (timestamp <= clearedAt || dismissedIds.has(notifId)) return;

          const cat = categorizeNotificationDate(dateVal);
          const timeStr = formatNotificationRelativeTime(dateVal);

          generatedItems.push({
            id: notifId,
            icon: "sparkles",
            title: ev.title || "Tracking Milestone Update",
            time: timeStr,
            timestamp,
            description: ev.description || "Container tracking update synchronized.",
            rawDescription: ev.description || "Container tracking update synchronized.",
            unread: !readIds.has(notifId) && cat === "today",
            category: cat,
            type: "tracking_event",
            linkUrl: `/movements`,
          });
        });
      }

      // 4. Incorporate live Gmail Messages if connected (only replies)
      const liveGmail = gmailLiveMessagesRef.current || [];
      liveGmail.forEach((msg) => {
        const timestamp = new Date(msg.date || Date.now()).getTime();
        const notifId = `gmail-msg-${msg.id}`;

        if (timestamp <= clearedAt || dismissedIds.has(notifId)) return;

        const isReply =
          msg.subject.toLowerCase().startsWith("re:") ||
          msg.snippet.toLowerCase().includes("booking") ||
          msg.labelIds.includes("INBOX");

        if (!isReply) return;

        const cat = categorizeNotificationDate(msg.date || new Date());
        const timeStr = formatNotificationRelativeTime(msg.date || new Date());

        const refMatch = `${msg.subject} ${msg.snippet}`.match(
          /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
        );
        const bookingRef = refMatch ? refMatch[1].toUpperCase() : undefined;

        generatedItems.push({
          id: notifId,
          icon: "reply",
          title: `Gmail Reply: ${bookingRef ? bookingRef + " - " : ""}${msg.subject.replace(/^Re:\s*/i, "").slice(0, 32)}`,
          time: timeStr,
          timestamp,
          description: `From ${msg.from.split("<")[0].trim()}: "${msg.snippet.slice(0, 90)}"`,
          rawDescription: `From ${msg.from.split("<")[0].trim()}: "${msg.snippet.slice(0, 90)}"`,
          unread: !readIds.has(notifId) && cat === "today",
          category: cat,
          type: "booking_reply",
          bookingReference: bookingRef,
          senderName: msg.from.split("<")[0].trim(),
          linkUrl: `/emails?search=${encodeURIComponent(bookingRef || msg.subject)}`,
        });
      });

      // 5. Generate Cut-Off 48-Hour Reminder notifications
      try {
        const cutoffReminders = generateAllCutOffReminders();
        cutoffReminders.forEach((rem) => {
          if (rem.timestamp > clearedAt && !dismissedIds.has(rem.id)) {
            generatedItems.push({
              ...rem,
              unread: !readIds.has(rem.id) && rem.unread,
            });
          }
        });
      } catch (cutoffErr) {
        console.warn("[NotificationsContext] Notice loading cut-off reminders:", cutoffErr);
      }

      // Deduplicate strictly by getNotificationSignature and preserve read state
      setNotifications((prev) => {
        const signatureMap = new Map<string, NotificationItem>();

        // Include existing items that are not cleared or dismissed
        prev.forEach((p) => {
          if (p.timestamp > clearedAt && !dismissedIds.has(p.id)) {
            const sig = getNotificationSignature(p);
            signatureMap.set(sig, p);
          }
        });

        // Upsert newly generated items
        generatedItems.forEach((item) => {
          if (item.timestamp > clearedAt && !dismissedIds.has(item.id)) {
            const sig = getNotificationSignature(item);
            const existing = signatureMap.get(sig);
            if (existing) {
              signatureMap.set(sig, {
                ...item,
                unread: !readIds.has(item.id) && (existing.unread || item.unread),
              });
            } else {
              signatureMap.set(sig, {
                ...item,
                unread: !readIds.has(item.id) && item.unread,
              });
            }
          }
        });

        return Array.from(signatureMap.values())
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);
      });
    } catch (err) {
      console.warn("[NotificationsContext] Refresh warning:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [user?.id]);

  // Initial load: deferred so the UI shell and dashboard data load instantly without contention
  useEffect(() => {
    const timer = setTimeout(() => {
      void refreshNotifications();
    }, 2000);
    return () => clearTimeout(timer);
  }, [refreshNotifications]);

  // Listen to cross-component custom events for live dispatch & updates
  useEffect(() => {
    const handleEmailSentEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        id?: string;
        bookingReference?: string;
        toEmail?: string;
        toName?: string;
        subject?: string;
        snippet?: string;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      const now = Date.now();
      const ref = detail.bookingReference || "BK-REQUEST";
      const sentItem: NotificationItem = {
        id: `email-sent-event-${detail.id || now}`,
        icon: "mail",
        title: `Booking Request Sent: ${ref}`,
        time: "Just now",
        timestamp: now,
        description: `Dispatched to ${detail.toName || detail.toEmail || "Carrier Desk"}: "${detail.snippet || detail.subject || "Ocean freight allocation requested."}"`,
        rawDescription: `Dispatched to ${detail.toName || detail.toEmail || "Carrier Desk"}: "${detail.snippet || detail.subject || "Ocean freight allocation requested."}"`,
        unread: true,
        category: "today",
        type: "booking_request",
        bookingReference: ref,
        recipientName: detail.toName || detail.toEmail,
        recipientEmail: detail.toEmail,
        linkUrl: `/emails?search=${encodeURIComponent(ref)}`,
      };

      addItemDeduplicated(sentItem);
    };

    const handleBookingConfirmedEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        bookingId?: string;
        movementNumber?: string;
        bookingReference?: string;
        reference?: string;
        status?: string;
        forwarderName?: string;
        confirmedBy?: string;
      }>;
      const detail = customEvent.detail;
      if (!detail) return;

      // STRICT VALIDATION: Resolve authentic Movement Reference Number
      let resolvedRef = detail.movementNumber || detail.bookingReference || detail.reference || "";

      // If missing, or generic fallback, look up in local bookings database
      if (
        !resolvedRef ||
        resolvedRef.toLowerCase() === "booking" ||
        resolvedRef.startsWith("Booking #")
      ) {
        if (detail.bookingId) {
          const allBookings = getLocalBookings();
          const found = allBookings.find(
            (b) =>
              b.id === detail.bookingId ||
              b.movement_number === detail.bookingId ||
              b.booking_reference === detail.bookingId ||
              b.reference === detail.bookingId,
          );
          if (found) {
            resolvedRef = found.movement_number || found.booking_reference || found.reference || "";
          }
        }
      }

      if (!resolvedRef && detail.bookingId) {
        resolvedRef = detail.bookingId;
      }

      if (!resolvedRef) {
        resolvedRef = "MOV-2026-00001";
      }

      const movementRef = resolvedRef;
      const notifTitle = `Booking Confirmed: ${movementRef}`;
      const forwarderParty = detail.confirmedBy || detail.forwarderName;
      const notifMsg = forwarderParty
        ? `Movement ${movementRef} has been confirmed by ${forwarderParty}.`
        : `Movement ${movementRef} has been confirmed by the forwarder.`;
      const notifId = `booking-confirmed-${detail.movementNumber || detail.bookingId || movementRef}`;

      const confirmedItem: NotificationItem = {
        id: notifId,
        icon: "check",
        title: notifTitle,
        time: "Just now",
        timestamp: Date.now(),
        description: notifMsg,
        rawDescription: notifMsg,
        unread: true,
        category: "today",
        type: "booking_confirmed",
        bookingReference: movementRef,
        linkUrl: "/requests",
      };

      addItemDeduplicated(confirmedItem);
    };

    const handleNotificationInserted = (e: Event) => {
      const customEvent = e as CustomEvent<{
        id?: string;
        title?: string;
        message?: string;
        type?: string;
        is_read?: boolean;
        link?: string;
        created_at?: string;
      }>;
      const n = customEvent.detail;
      if (!n) return;

      const dateVal = n.created_at || new Date();
      const cat = categorizeNotificationDate(dateVal);
      const timeStr = formatNotificationRelativeTime(dateVal);
      const isConfirmed =
        n.title?.toLowerCase().includes("confirmed") ||
        n.message?.toLowerCase().includes("confirmed") ||
        n.type === "booking_confirmed";

      const refMatch = `${n.title || ""} ${n.message || ""}`.match(
        /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
      );
      const bookingRef = refMatch ? refMatch[1].toUpperCase() : undefined;

      const notifTitle = isConfirmed
        ? bookingRef
          ? `Booking Confirmed: ${bookingRef}`
          : n.title || "Booking Confirmed"
        : n.title || "Notification";
      const notifMsg =
        n.message ||
        (bookingRef
          ? `Movement ${bookingRef} has been confirmed by the forwarder.`
          : "Movement confirmed by forwarder.");

      const newItem: NotificationItem = {
        id: `db-notif-${n.id || Date.now()}`,
        icon: isConfirmed ? "check" : n.type === "booking_reply" ? "reply" : "sparkles",
        title: notifTitle,
        time: timeStr || "Just now",
        timestamp: Date.now(),
        description: notifMsg,
        rawDescription: notifMsg,
        unread: n.is_read !== true,
        category: cat,
        type: isConfirmed ? "booking_confirmed" : (n.type as NotificationType) || "system",
        bookingReference: bookingRef,
        linkUrl: n.link || "/requests",
      };

      addItemDeduplicated(newItem);
    };

    const handleNotificationUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; is_read?: boolean }>;
      const updated = customEvent.detail;
      if (!updated?.id) return;

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === `db-notif-${updated.id}`
            ? { ...item, unread: updated.is_read === false }
            : item,
        ),
      );
    };

    const handleNotificationDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string }>;
      const deleted = customEvent.detail;
      if (!deleted?.id) return;

      setNotifications((prev) => prev.filter((item) => item.id !== `db-notif-${deleted.id}`));
    };

    const handleCutOffReminderTriggered = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationItem>;
      const notif = customEvent.detail;
      if (!notif) return;

      addItemDeduplicated(notif);
    };

    window.addEventListener("nashmia:email-sent", handleEmailSentEvent);
    window.addEventListener("nashmia_booking_confirmed", handleBookingConfirmedEvent);
    window.addEventListener("nashmia_cutoff_reminder_triggered", handleCutOffReminderTriggered);
    window.addEventListener("nashmia_notification_inserted", handleNotificationInserted);
    window.addEventListener("nashmia_notification_updated", handleNotificationUpdated);
    window.addEventListener("nashmia_notification_deleted", handleNotificationDeleted);

    // Schedule automatic background dispatch when any upcoming deadline hits exactly 48 hours
    const cancelScheduler = scheduleCutOffReminders();

    return () => {
      window.removeEventListener("nashmia:email-sent", handleEmailSentEvent);
      window.removeEventListener("nashmia_booking_confirmed", handleBookingConfirmedEvent);
      window.removeEventListener(
        "nashmia_cutoff_reminder_triggered",
        handleCutOffReminderTriggered,
      );
      window.removeEventListener("nashmia_notification_inserted", handleNotificationInserted);
      window.removeEventListener("nashmia_notification_updated", handleNotificationUpdated);
      window.removeEventListener("nashmia_notification_deleted", handleNotificationDeleted);
      cancelScheduler();
    };
  }, [addItemDeduplicated]);

  // Supabase Real-Time Subscriptions for Bookings, Notifications, Emails & Events
  // Deferred slightly so WebSocket connection does not contend with initial HTTP assets and critical data
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    const timer = setTimeout(() => {
      channel = supabase
        .channel("nashmia_live_operations_notifications_v4")
        // 1. Persistent Notifications Table (Realtime INSERT)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const n = payload.new as {
              id?: string;
              title?: string;
              message?: string;
              type?: string;
              is_read?: boolean;
              link?: string;
              created_at?: string;
            };

            const dateVal = n.created_at || new Date();
            const cat = categorizeNotificationDate(dateVal);
            const timeStr = formatNotificationRelativeTime(dateVal);
            const isConfirmed =
              n.title?.toLowerCase().includes("confirmed") ||
              n.message?.toLowerCase().includes("confirmed") ||
              n.type === "booking_confirmed";

            const refMatch = `${n.title || ""} ${n.message || ""}`.match(
              /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
            );
            const bookingRef = refMatch ? refMatch[1].toUpperCase() : undefined;

            const notifTitle = isConfirmed
              ? bookingRef
                ? `Booking Confirmed: ${bookingRef}`
                : n.title || "Booking Confirmed"
              : n.title || "Notification";
            const notifMsg =
              n.message ||
              (bookingRef
                ? `Movement ${bookingRef} has been confirmed by the forwarder.`
                : "Movement confirmed by forwarder.");

            const newItem: NotificationItem = {
              id: `db-notif-${n.id || Date.now()}`,
              icon: isConfirmed ? "check" : n.type === "booking_reply" ? "reply" : "sparkles",
              title: notifTitle,
              time: timeStr || "Just now",
              timestamp: Date.now(),
              description: notifMsg,
              rawDescription: notifMsg,
              unread: n.is_read !== true,
              category: cat,
              type: isConfirmed ? "booking_confirmed" : (n.type as NotificationType) || "system",
              bookingReference: bookingRef,
              linkUrl: n.link || "/requests",
            };

            addItemDeduplicated(newItem);
          },
        )
        // 2. Persistent Notifications Table (Realtime UPDATE)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const updated = payload.new as {
              id?: string;
              is_read?: boolean;
            };
            if (!updated.id) return;

            setNotifications((prev) =>
              prev.map((item) =>
                item.id === `db-notif-${updated.id}`
                  ? { ...item, unread: updated.is_read === false }
                  : item,
              ),
            );
          },
        )
        // 3. Persistent Notifications Table (Realtime DELETE)
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "notifications" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const deleted = payload.old as { id?: string };
            if (!deleted.id) return;

            setNotifications((prev) => prev.filter((item) => item.id !== `db-notif-${deleted.id}`));
          },
        )
        // 4. Bookings Status Updates (Specifically when changed to CONFIRMED)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "bookings" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const updated = payload.new as {
              id?: string;
              booking_reference?: string;
              movement_number?: string;
              status?: string;
            };
            const old = payload.old as { status?: string };

            const isConfirmed =
              updated.status?.toUpperCase() === "CONFIRMED" ||
              updated.status?.toLowerCase().includes("confirmed");
            const wasNotConfirmed =
              !old?.status ||
              (old.status.toUpperCase() !== "CONFIRMED" &&
                !old.status.toLowerCase().includes("confirmed"));

            if (isConfirmed && wasNotConfirmed) {
              let movementRef = updated.movement_number || updated.booking_reference || "";

              if (!movementRef && updated.id) {
                const allBookings = getLocalBookings();
                const found = allBookings.find((b) => b.id === updated.id);
                if (found) {
                  movementRef =
                    found.movement_number || found.booking_reference || found.reference || "";
                }
              }

              if (!movementRef && updated.id && !updated.id.includes("-")) {
                movementRef = updated.id;
              }

              if (!movementRef || movementRef.toLowerCase() === "booking") return;
              const notifTitle = `Booking Confirmed: ${movementRef}`;
              const notifMsg = `Movement ${movementRef} has been confirmed by the forwarder.`;

              const notifItem: NotificationItem = {
                id: `booking-confirmed-${updated.id || movementRef}`,
                icon: "check",
                title: notifTitle,
                time: "Just now",
                timestamp: Date.now(),
                description: notifMsg,
                rawDescription: notifMsg,
                unread: true,
                category: "today",
                type: "booking_confirmed",
                bookingReference: movementRef,
                linkUrl: "/requests",
              };

              addItemDeduplicated(notifItem);
            }
          },
        )
        // 5. New Booking Created
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "bookings" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const newBooking = payload.new as {
              id?: string;
              booking_reference?: string;
              customer_name?: string;
              origin_port?: string;
              destination_port?: string;
            };

            const ref = newBooking.booking_reference || "NASH-BKG";
            const client = newBooking.customer_name || "Customer";
            const route = `${newBooking.origin_port || "Karachi"} → ${newBooking.destination_port || "Destination"}`;

            const newItem: NotificationItem = {
              id: `booking-${newBooking.id || Date.now()}`,
              icon: "check",
              title: `Booking Request Created: ${ref}`,
              time: "Just now",
              timestamp: Date.now(),
              description: `New booking for ${client} (${route}) registered in operations.`,
              rawDescription: `New booking for ${client} (${route}) registered in operations.`,
              unread: true,
              category: "today",
              type: "booking_request",
              bookingReference: ref,
              linkUrl: "/requests",
            };

            addItemDeduplicated(newItem);
          },
        )
        // 5b. Forwarder Offers (Offers received & Awarded alerts)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "forwarder_offers" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const offer = (payload.new || {}) as Record<string, unknown>;
            if (!offer || !offer.id) return;

            const fName = (offer.forwarder_name as string) || "Forwarder";
            const movRef = (offer.movement_number as string) || "";
            const status = String(offer.status || "").toUpperCase();

            if (status === "AWARDED") {
              const title = movRef ? `Offer Awarded: ${movRef}` : "Offer Awarded";
              const desc = `Booking ${movRef || ""} awarded to ${fName} ($${offer.rate_per_container || 0}/cntr).`;
              const notifItem: NotificationItem = {
                id: `offer-awarded-${offer.id}`,
                icon: "check",
                title,
                time: "Just now",
                timestamp: Date.now(),
                description: desc,
                rawDescription: desc,
                unread: true,
                category: "today",
                type: "booking_request",
                bookingReference: movRef,
                linkUrl: "/requests",
              };
              addItemDeduplicated(notifItem);
            } else if (status === "RESPONDED" || offer.space_available) {
              const title = movRef ? `Offer Received: ${movRef}` : "Forwarder Offer Received";
              const desc = `${fName} submitted quote: $${offer.rate_per_container || 0}/cntr${offer.carrier ? ` on ${offer.carrier}` : ""}.`;
              const notifItem: NotificationItem = {
                id: `offer-received-${offer.id}`,
                icon: "tag",
                title,
                time: "Just now",
                timestamp: Date.now(),
                description: desc,
                rawDescription: desc,
                unread: true,
                category: "today",
                type: "quote_received",
                bookingReference: movRef,
                linkUrl: "/requests",
              };
              addItemDeduplicated(notifItem);
            }
          },
        )
        // 6. New Email Message (Outbound Request or Inbound Reply)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "email_messages" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const em = payload.new as {
              id?: string;
              subject?: string;
              body?: string;
              snippet?: string;
              direction?: string;
              sender_name?: string;
              sender_email?: string;
              recipient_name?: string;
              recipient_email?: string;
              email_type?: string;
            };

            const isReply =
              em.direction === "inbound" ||
              em.subject?.toLowerCase().startsWith("re:") ||
              em.email_type === "BOOKING_CONFIRMATION";

            const subject = em.subject || "(No Subject)";
            const sender = em.sender_name || em.sender_email || "Forwarder/Buyer";
            const snippet = em.snippet || (em.body ? em.body.slice(0, 100) : subject);

            const rawHeaders =
              ((payload.new as Record<string, unknown>).raw_headers as Record<string, unknown>) ||
              {};

            // Authentic movement number resolution
            let bookingRef =
              (em.movement_number as string) ||
              (rawHeaders.movement_number as string) ||
              (rawHeaders.movementNumber as string) ||
              extractMovementNumber(subject) ||
              extractMovementNumber(snippet) ||
              extractMovementNumber(em.body);

            if (em.booking_id || bookingRef) {
              const allBookings = getLocalBookings();
              const found = allBookings.find(
                (b) =>
                  (em.booking_id && b.id === em.booking_id) ||
                  (bookingRef &&
                    (b.movement_number === bookingRef ||
                      b.booking_reference === bookingRef ||
                      b.reference === bookingRef)),
              );
              if (found && found.movement_number) {
                bookingRef = found.movement_number;
              }
            }

            const isConfirmedReply =
              (rawHeaders.confirmation_status as string) === "CONFIRMED" ||
              subject.toLowerCase().includes("booking confirmed") ||
              snippet.toLowerCase().includes("booking confirmed") ||
              (em.body && em.body.toLowerCase().includes("booking confirmed"));

            if (isReply && isConfirmedReply) {
              const confirmedTitle = bookingRef
                ? `Booking Confirmed: ${bookingRef}`
                : "Booking Confirmed";
              const confirmedMsg = bookingRef
                ? `Movement ${bookingRef} confirmed by forwarder.`
                : `Movement confirmed by forwarder.`;

              const confirmedItem: NotificationItem = {
                id: `booking-confirmed-${bookingRef || em.id}`,
                icon: "check",
                title: confirmedTitle,
                time: "Just now",
                timestamp: Date.now(),
                description: confirmedMsg,
                rawDescription: confirmedMsg,
                unread: true,
                category: "today",
                type: "booking_confirmed",
                bookingReference: bookingRef,
                senderName: sender,
                senderEmail: em.sender_email,
                linkUrl: `/movements`,
              };

              addItemDeduplicated(confirmedItem);
            } else if (isReply) {
              const replyItem: NotificationItem = {
                id: `email-reply-${em.id || Date.now()}`,
                icon: "reply",
                title: `Booking Reply Received: ${bookingRef ? bookingRef : subject.slice(0, 30)}`,
                time: "Just now",
                timestamp: Date.now(),
                description: `From ${sender}: "${snippet}"`,
                rawDescription: `From ${sender}: "${snippet}"`,
                unread: true,
                category: "today",
                type: "booking_reply",
                bookingReference: bookingRef,
                senderName: sender,
                senderEmail: em.sender_email,
                linkUrl: `/emails?search=${encodeURIComponent(bookingRef || subject)}`,
              };

              addItemDeduplicated(replyItem);
            } else {
              const sentItem: NotificationItem = {
                id: `email-sent-${em.id || Date.now()}`,
                icon: "mail",
                title: `Booking Request Sent: ${bookingRef || subject.slice(0, 30)}`,
                time: "Just now",
                timestamp: Date.now(),
                description: `Dispatched to ${em.recipient_name || em.recipient_email}: "${snippet}"`,
                rawDescription: `Dispatched to ${em.recipient_name || em.recipient_email}: "${snippet}"`,
                unread: false,
                category: "today",
                type: "booking_request",
                bookingReference: bookingRef,
                linkUrl: `/emails?search=${encodeURIComponent(bookingRef || subject)}`,
              };

              addItemDeduplicated(sentItem);
            }
          },
        )
        // 7. Milestone / Tracking Updates
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "booking_events" },
          (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            const ev = payload.new as {
              id?: string;
              title?: string;
              description?: string;
            };

            const newItem: NotificationItem = {
              id: `event-${ev.id || Date.now()}`,
              icon: "sparkles",
              title: ev.title || "Tracking Milestone Update",
              time: "Just now",
              timestamp: Date.now(),
              description: ev.description || "Container tracking update synchronized.",
              rawDescription: ev.description || "Container tracking update synchronized.",
              unread: true,
              category: "today",
              type: "tracking_event",
              linkUrl: "/requests",
            };

            addItemDeduplicated(newItem);
          },
        )
        .subscribe();
    }, 1200);

    return () => {
      clearTimeout(timer);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [addItemDeduplicated]);

  // Listen to new Gmail incoming emails
  useEffect(() => {
    const liveGmail = gmail?.liveMessages || [];
    if (liveGmail.length === 0) return;

    if (isFirstGmailLoadRef.current) {
      isFirstGmailLoadRef.current = false;
      liveGmail.forEach((m) => seenGmailIdsRef.current.add(m.id));
      return;
    }

    const latest = liveGmail[0];
    if (latest && !seenGmailIdsRef.current.has(latest.id)) {
      seenGmailIdsRef.current.add(latest.id);

      const isReply =
        latest.subject.toLowerCase().startsWith("re:") ||
        latest.snippet.toLowerCase().includes("booking");

      const senderName = latest.from.split("<")[0].trim() || "Forwarder";
      const subject = latest.subject || "(No Subject)";

      const refMatch = `${subject} ${latest.snippet}`.match(
        /\b(BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
      );
      const bookingRef = refMatch ? refMatch[1].toUpperCase() : undefined;

      const isConfirmedReply =
        isReply &&
        (subject.toLowerCase().includes("booking confirmed") ||
          latest.snippet.toLowerCase().includes("booking confirmed") ||
          (latest.body && latest.body.toLowerCase().includes("booking confirmed")));

      const notifItem: NotificationItem = {
        id: `gmail-live-${latest.id}`,
        icon: isConfirmedReply ? "check" : isReply ? "reply" : "mail",
        title: isConfirmedReply
          ? `Booking Confirmed: ${bookingRef || subject.slice(0, 30)}`
          : isReply
            ? `Booking Reply: ${bookingRef ? bookingRef + " - " : ""}${subject.replace(/^Re:\s*/i, "").slice(0, 30)}`
            : `Email: ${subject.slice(0, 30)}`,
        time: "Just now",
        timestamp: Date.now(),
        description: `From ${senderName}: "${latest.snippet.slice(0, 80)}"`,
        rawDescription: `From ${senderName}: "${latest.snippet.slice(0, 80)}"`,
        unread: true,
        category: "today",
        type: isConfirmedReply ? "booking_confirmed" : isReply ? "booking_reply" : "general_email",
        bookingReference: bookingRef,
        senderName,
        linkUrl: `/emails?search=${encodeURIComponent(bookingRef || subject)}`,
      };

      addItemDeduplicated(notifItem);
    }
  }, [gmail?.liveMessages, addItemDeduplicated]);

  const markAsRead = useCallback((id: string) => {
    addReadId(id);
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, unread: false } : item)),
    );

    if (isSupabaseConfigured && id.startsWith("db-notif-")) {
      const dbId = id.replace("db-notif-", "");
      void supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", dbId)
        .then(() => {});
    }
  }, []);

  const markAllAsRead = useCallback(() => {
    markAllIdsRead(notifications.map((n) => n.id));
    setNotifications((prev) => prev.map((item) => ({ ...item, unread: false })));

    if (isSupabaseConfigured) {
      void supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("is_read", false)
        .then(() => {});
    }
    showPillToast.info("All notifications marked as read.", "Notification Center");
  }, [notifications]);

  const clearAll = useCallback(() => {
    const now = Date.now();
    setClearedAt(now);

    // Add all current notification IDs to dismissed registry
    notifications.forEach((n) => addDismissedId(n.id));

    setNotifications([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    if (isSupabaseConfigured) {
      void supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("is_read", false)
        .then(() => {});
    }
    showPillToast.info("All notifications cleared.", "Notification Center");
  }, [notifications]);

  const deleteNotification = useCallback((id: string) => {
    addDismissedId(id);
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    if (isSupabaseConfigured && id.startsWith("db-notif-")) {
      const dbId = id.replace("db-notif-", "");
      void supabase
        .from("notifications")
        .delete()
        .eq("id", dbId)
        .then(() => {});
    }
  }, []);

  // Simulator helper 1: instantly generates a realistic forwarder reply to a booking request
  const simulateBookingReply = useCallback(
    (
      bookingRef?: string,
      customSender: string = "Maersk Customer Booking Desk",
      customSnippet: string = "Booking space confirmed. Container release order CRO-99182 allocated for Karachi to Jebel Ali voyage.",
    ) => {
      const localBookings = getLocalBookings();
      const defaultMov =
        localBookings[0]?.movement_number ||
        localBookings[0]?.booking_reference ||
        localBookings[0]?.reference ||
        "MOV-2026-00001";
      const actualRef =
        bookingRef && bookingRef !== "BK-2026-0814" && bookingRef !== "BK-2026-0925"
          ? bookingRef
          : defaultMov;

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const msgId = `sim-reply-${now}`;

      const isConfirmed =
        customSnippet.toLowerCase().includes("confirmed") ||
        customSnippet.toLowerCase().includes("space confirmed");

      const notifTitle = isConfirmed
        ? `Booking Confirmed: ${actualRef}`
        : `Booking Reply: ${actualRef}`;

      const notifMsg = `From ${customSender}: "${customSnippet.slice(0, 60)}"`;

      const replyItem: NotificationItem = {
        id: msgId,
        icon: isConfirmed ? "check" : "reply",
        title: notifTitle,
        time: "Just now",
        timestamp: now,
        description: `From ${customSender}: "${customSnippet}"`,
        rawDescription: `From ${customSender}: "${customSnippet}"`,
        unread: true,
        category: "today",
        type: isConfirmed ? "booking_confirmed" : "booking_reply",
        bookingReference: bookingRef,
        senderName: customSender,
        senderEmail: "bookings@maerskline-logistics.com",
        linkUrl: `/emails?search=${encodeURIComponent(bookingRef)}`,
      };

      // Persist to local emails so it appears in /emails as well!
      saveLocalEmail({
        id: msgId,
        threadId: `th-${msgId}`,
        fromEmail: "bookings@maerskline-logistics.com",
        fromName: customSender,
        toEmail: "operations@nashmiaindustries.com",
        toName: "Nashmia Operations",
        subject: `Re: Ocean Freight Space Confirmation - ${bookingRef}`,
        body: `Dear Nashmia Industries Logistics Team,\n\n${customSnippet}\n\nVessel: CMA CGM Palais\nPort Cut-off: 03-Sep-2026\nEquipment: Ready at Karachi Port Terminal.\n\nBest regards,\n${customSender}`,
        bodyHtml: null,
        snippet: customSnippet,
        emailType: "BOOKING_CONFIRMATION",
        status: "SENT",
        direction: "inbound",
        bookingReference: bookingRef,
        createdAt: nowIso,
        updatedAt: nowIso,
        sentAt: nowIso,
        attachments: [{ name: `Booking_Confirmation_${bookingRef}.pdf`, size: "380 KB" }],
      });

      // Also record to Supabase if connected
      if (isSupabaseConfigured) {
        (async () => {
          try {
            // Find or create a thread
            const { data: existingThread } = await supabase
              .from("email_threads")
              .select("id")
              .limit(1)
              .maybeSingle();

            let targetThreadId = existingThread?.id;
            if (!targetThreadId) {
              const { data: p } = await supabase
                .from("profiles")
                .select("id")
                .limit(1)
                .maybeSingle();
              if (p?.id) {
                const { data: newT } = await supabase
                  .from("email_threads")
                  .insert({
                    user_id: p.id,
                    subject: `Re: Booking Request - ${bookingRef}`,
                    status: "Active",
                    snippet: customSnippet.slice(0, 120),
                  })
                  .select("id")
                  .maybeSingle();
                targetThreadId = newT?.id;
              }
            }

            if (targetThreadId) {
              await supabase.from("email_messages").insert({
                thread_id: targetThreadId,
                subject: `Re: Booking Request - ${bookingRef} Space Confirmation`,
                body: `Dear Nashmia Operations,\n\n${customSnippet}\n\nVessel schedule has been locked.\n\nBest regards,\n${customSender}`,
                sender_name: customSender,
                sender_email: "bookings@maerskline-logistics.com",
                recipient_email: "operations@nashmiaindustries.com",
                direction: "Inbound",
                sent_at: nowIso,
                raw_headers: {
                  booking_reference: bookingRef,
                  snippet: customSnippet,
                  recipient_name: "Nashmia Operations",
                  status: "SENT",
                  email_type: "BOOKING_CONFIRMATION",
                },
              });
            }
          } catch (e) {
            console.warn("[NotificationsContext] Notice during email_messages sync:", e);
          }
        })();
      }

      if (isConfirmed) {
        showPillToast.success(notifMsg, notifTitle, bookingRef);
      } else {
        showPillToast.comment(notifMsg, notifTitle, bookingRef);
      }

      setNotifications((prev) => [replyItem, ...prev.filter((n) => n.id !== replyItem.id)]);
    },
    [],
  );

  // Simulator helper 2: instantly generates a realistic outbound booking request dispatch
  const simulateBookingRequest = useCallback(
    (
      bookingRef?: string,
      forwarderName: string = "Hapag-Lloyd Ocean Desk",
      route: string = "Karachi (PKKHI) → Hamburg (DEHAM)",
    ) => {
      const localBookings = getLocalBookings();
      const defaultMov =
        localBookings[0]?.movement_number ||
        localBookings[0]?.booking_reference ||
        localBookings[0]?.reference ||
        "MOV-2026-00001";
      const actualRef =
        bookingRef && bookingRef !== "BK-2026-0814" && bookingRef !== "BK-2026-0925"
          ? bookingRef
          : defaultMov;

      const now = Date.now();
      const nowIso = new Date(now).toISOString();
      const msgId = `sim-req-${now}`;
      const snippet = `Booking request dispatched for 3x 40HC containers (${route}). Vessel allocation requested.`;

      const requestItem: NotificationItem = {
        id: msgId,
        icon: "mail",
        title: `Booking Request Sent: ${actualRef}`,
        time: "Just now",
        timestamp: now,
        description: `Dispatched to ${forwarderName}: "${snippet}"`,
        rawDescription: `Dispatched to ${forwarderName}: "${snippet}"`,
        unread: true,
        category: "today",
        type: "booking_request",
        bookingReference: actualRef,
        recipientName: forwarderName,
        recipientEmail: "freight@hapag-lloyd-desk.com",
        linkUrl: `/emails?search=${encodeURIComponent(actualRef)}`,
      };

      // Persist to local emails
      saveLocalEmail({
        id: msgId,
        threadId: `th-${msgId}`,
        fromEmail: "operations@nashmiaindustries.com",
        fromName: "Nashmia Operations Desk",
        toEmail: "freight@hapag-lloyd-desk.com",
        toName: forwarderName,
        subject: `Booking Request ${bookingRef} | ${route}`,
        body: `Dear ${forwarderName},\n\nPlease book ocean freight allocation for ${bookingRef}.\nRoute: ${route}\nCargo: 100% Organic Cotton Garments\nEquipment: 3x 40HC\n\nKindly confirm booking confirmation and shipping instructions cutoff.\n\nBest regards,\nNashmia Operations`,
        bodyHtml: null,
        snippet,
        emailType: "BOOKING_REQUEST",
        status: "SENT",
        direction: "outbound",
        bookingReference: bookingRef,
        createdAt: nowIso,
        updatedAt: nowIso,
        sentAt: nowIso,
        attachments: [{ name: `Booking_Summary_${bookingRef}.pdf`, size: "295 KB" }],
      });

      showPillToast.build(
        `Dispatched to ${forwarderName} (${route})`,
        `Booking Request Sent (${bookingRef})`,
      );

      setNotifications((prev) => [requestItem, ...prev.filter((n) => n.id !== requestItem.id)]);
    },
    [],
  );

  const contextValue = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      isMounted,
      isSyncing,
      markAsRead,
      markAllAsRead,
      clearAll,
      deleteNotification,
      refreshNotifications,
      simulateBookingReply,
      simulateBookingRequest,
    }),
    [
      notifications,
      unreadCount,
      isMounted,
      isSyncing,
      markAsRead,
      markAllAsRead,
      clearAll,
      deleteNotification,
      refreshNotifications,
      simulateBookingReply,
      simulateBookingRequest,
    ],
  );

  return (
    <NotificationsContext.Provider value={contextValue}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}
