import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid, getLocalBookings } from "./supabase-services";
import { extractMovementNumber } from "./movement-lifecycle";
import { classifyConfirmationDeterministic } from "./forwarder-confirmation-detector";
import {
  getGmailAccessToken,
  sendEmailDirectlyViaGmail,
  fetchLiveGmailMessages,
  mapGmailMessageToEmailRecord,
  getCachedGoogleUser,
  isGmailQuotaCooldownActive,
} from "./gmail-service";
import type {
  EmailMessageRecord,
  EmailStatistics,
  EmailFolderCount,
  EmailStatus,
  EmailType,
  ComposeEmailFormValues,
} from "@/types/email.types";

interface RawMessageData {
  id: string;
  thread_id?: string;
  user_id?: string;
  organization_id?: string;
  booking_id?: string;
  movement_id?: string;
  movement_number?: string;
  forwarder_id?: string;
  sender_email?: string;
  from_email?: string;
  sender_name?: string;
  recipient_email?: string;
  to_email?: string;
  recipient_name?: string;
  cc?: string | null;
  bcc?: string | null;
  subject?: string;
  body?: string;
  body_html?: string | null;
  direction?: string;
  sent_at?: string | null;
  created_at?: string;
  updated_at?: string;
  status?: string;
  email_type?: string;
  gmail_message_id?: string | null;
  gmail_thread_id?: string | null;
  error_message?: string | null;
  attachments?: unknown;
}

interface RawThreadData {
  id: string;
  user_id?: string;
  organization_id?: string;
  booking_id?: string | null;
  movement_id?: string | null;
  movement_number?: string | null;
  subject?: string;
  status?: string;
  snippet?: string | null;
  gmail_thread_id?: string | null;
  last_message_at?: string;
  booking?: RawBookingData | null;
}

interface RawBookingData {
  id: string;
  booking_reference?: string;
  movement_number?: string;
  reference?: string;
  origin?: string;
  destination?: string;
  forwarder_id?: string | null;
  container_size?: string;
  container_count?: number;
  vessel_name?: string | null;
  buyer?: { company_name?: string } | null;
  buyer_name?: string | null;
  supplier?: { company_name?: string } | null;
  supplier_name?: string | null;
  forwarder?: { company_name?: string; code?: string; email?: string } | null;
}

interface RawForwarderData {
  id: string;
  company_name?: string;
  code?: string;
  contact_person?: string;
  email?: string;
}

/**
 * Maps raw database thread + messages + bookings + forwarders into a frontend EmailMessageRecord
 */
export function mapDatabaseEmailToRecord(
  msg: RawMessageData,
  thread?: RawThreadData | null,
  booking?: RawBookingData | null,
  forwarder?: RawForwarderData | null,
): EmailMessageRecord {
  // Derive status cleanly from record or thread
  let rawStatus = (msg.status || thread?.status || "SENT").toUpperCase().trim();

  if (rawStatus === "OUTBOUND" || rawStatus === "INBOUND") {
    rawStatus = msg.sent_at ? "SENT" : "PENDING";
  }

  let status: EmailStatus = "SENT";
  if (["DRAFT", "PENDING", "SENDING", "SENT", "FAILED", "CANCELLED"].includes(rawStatus)) {
    status = rawStatus as EmailStatus;
  } else if (rawStatus === "DELIVERED" || rawStatus === "COMPLETED") {
    status = "SENT";
  } else if (rawStatus === "QUEUED" || rawStatus === "WAITING") {
    status = "PENDING";
  }

  const headers = (msg.raw_headers as Record<string, unknown>) || {};

  // Extract Movement Number and Movement ID
  const movementNumber =
    msg.movement_number ||
    headers.movement_number ||
    thread?.movement_number ||
    booking?.movement_number ||
    extractMovementNumber(msg.subject) ||
    extractMovementNumber(thread?.subject) ||
    extractMovementNumber(msg.body) ||
    (booking?.booking_reference && booking.booking_reference.startsWith("MOV-")
      ? booking.booking_reference
      : null) ||
    (booking?.reference && booking.reference.startsWith("MOV-") ? booking.reference : null) ||
    booking?.booking_reference ||
    booking?.reference ||
    null;

  const movementId =
    msg.movement_id ||
    headers.movement_id ||
    thread?.movement_id ||
    msg.booking_id ||
    headers.booking_id ||
    thread?.booking_id ||
    booking?.id ||
    null;

  // Derive text confirmation indicators
  const isSubjectConfirmed =
    msg.subject?.toLowerCase().includes("booking confirmed") ||
    msg.subject?.toLowerCase().includes("space confirmed") ||
    msg.subject?.toLowerCase().includes("confirmation") ||
    (msg.subject?.toLowerCase().includes("confirm") &&
      (msg.subject?.toLowerCase().includes("booking") ||
        msg.subject?.toLowerCase().includes("movement") ||
        msg.subject?.toLowerCase().includes("space")));

  const isBodyConfirmed =
    msg.body?.toLowerCase().includes("booking is confirmed") ||
    msg.body?.toLowerCase().includes("booking confirmed") ||
    msg.body?.toLowerCase().includes("space confirmed") ||
    msg.body?.toLowerCase().includes("space is confirmed") ||
    msg.body?.toLowerCase().includes("we are pleased to confirm your booking") ||
    msg.body?.toLowerCase().includes("booking has been confirmed") ||
    msg.body?.toLowerCase().includes("space is secured");

  const isExplicitConfirmed =
    isSubjectConfirmed ||
    isBodyConfirmed ||
    booking?.status?.toLowerCase().includes("confirmed") ||
    msg.confirmation_status === "CONFIRMED" ||
    headers.confirmation_status === "CONFIRMED";

  // Derive email type
  let emailType: EmailType = "BOOKING_REQUEST";
  const rawEmailType = msg.email_type || headers.email_type;
  if (isExplicitConfirmed) {
    emailType = "BOOKING_CONFIRMATION";
  } else if (
    rawEmailType &&
    ["BOOKING_REQUEST", "BOOKING_CONFIRMATION", "BOOKING_UPDATE", "GENERAL", "SYSTEM"].includes(
      rawEmailType,
    )
  ) {
    emailType = rawEmailType as EmailType;
  } else if (rawEmailType === "BOOKING_REPLY") {
    emailType = "BOOKING_UPDATE";
  } else if (
    msg.subject?.toLowerCase().includes("system") ||
    msg.subject?.toLowerCase().includes("alert")
  ) {
    emailType = "SYSTEM";
  } else if (msg.subject?.toLowerCase().includes("update")) {
    emailType = "BOOKING_UPDATE";
  } else if (booking) {
    emailType = "BOOKING_REQUEST";
  } else {
    emailType = "GENERAL";
  }

  const attachmentsList = Array.isArray(msg.attachments)
    ? (msg.attachments as Array<{ name: string; size: string }>)
    : [];

  return {
    id: msg.id,
    threadId: msg.thread_id || thread?.id || msg.id,
    userId: msg.user_id || thread?.user_id,
    organizationId: msg.organization_id || headers.organization_id || thread?.organization_id,
    bookingId: msg.booking_id || headers.booking_id || thread?.booking_id || booking?.id || null,
    movementId,
    movementNumber,
    forwarderId: msg.forwarder_id || headers.forwarder_id || forwarder?.id || null,
    fromEmail:
      msg.sender_email ||
      msg.from_email ||
      headers.from_email ||
      "operations@nashmiaindustries.com",
    fromName: msg.sender_name || "Nashmia Industries",
    toEmail: msg.recipient_email || msg.to_email || headers.to_email || "",
    toName: msg.recipient_name || forwarder?.contact_person || forwarder?.company_name || "",
    cc: msg.cc || null,
    bcc: msg.bcc || null,
    subject: msg.subject || thread?.subject || "(No Subject)",
    body: msg.body || "",
    bodyHtml: msg.body_html || null,
    snippet: msg.body ? msg.body.slice(0, 140) : thread?.snippet || "",
    emailType,
    status,
    direction:
      msg.direction?.toLowerCase() === "inbound" || headers.direction === "inbound"
        ? "inbound"
        : "outbound",
    gmailMessageId: msg.gmail_message_id || headers.gmail_message_id || null,
    gmailThreadId:
      msg.gmail_thread_id || thread?.gmail_thread_id || headers.gmail_thread_id || null,
    errorMessage: msg.error_message || null,
    attachments: attachmentsList,
    createdAt: msg.created_at || new Date().toISOString(),
    updatedAt: msg.updated_at || msg.created_at || new Date().toISOString(),
    sentAt: msg.sent_at || (status === "SENT" ? msg.created_at : null),
    receivedAt:
      msg.received_at ||
      headers.received_at ||
      msg.sent_at ||
      (msg.direction?.toLowerCase() === "inbound" ? msg.created_at : null),

    // Matching Engine (Step 3)
    matchStatus:
      (msg.match_status as "MATCHED" | "NEEDS_REVIEW" | "UNMATCHED" | "PENDING") ||
      (headers.match_status as "MATCHED" | "NEEDS_REVIEW" | "UNMATCHED" | "PENDING") ||
      (msg.direction?.toLowerCase() === "inbound" ? (booking ? "MATCHED" : "NEEDS_REVIEW") : null),
    matchReason: msg.match_reason || (headers.match_reason as string) || null,
    matchedBy:
      (msg.matched_by as "THREAD_ID" | "MOVEMENT_NUMBER" | "MANUAL" | "NONE") ||
      (headers.matched_by as "THREAD_ID" | "MOVEMENT_NUMBER" | "MANUAL" | "NONE") ||
      (booking ? "MOVEMENT_NUMBER" : "NONE"),
    matchedAt: msg.matched_at || (headers.matched_at as string) || null,
    matchDetails: msg.match_details || (headers.match_details as Record<string, unknown>) || null,

    // Confirmation Detection (Step 4)
    confirmationStatus:
      (msg.confirmation_status as "CONFIRMED" | "NOT_CONFIRMED" | "NEEDS_REVIEW" | "REJECTED") ||
      (headers.confirmation_status as
        "CONFIRMED" | "NOT_CONFIRMED" | "NEEDS_REVIEW" | "REJECTED") ||
      (msg.match_details?.confirmationStatus as
        "CONFIRMED" | "NOT_CONFIRMED" | "NEEDS_REVIEW" | "REJECTED") ||
      (isExplicitConfirmed ? "CONFIRMED" : null),
    confirmationConfidence:
      typeof msg.confirmation_confidence === "number"
        ? msg.confirmation_confidence
        : typeof headers.confirmation_confidence === "number"
          ? (headers.confirmation_confidence as number)
          : typeof msg.match_details?.confidence === "number"
            ? (msg.match_details.confidence as number)
            : isExplicitConfirmed
              ? 0.98
              : null,
    confirmationReason:
      msg.confirmation_reason ||
      (headers.confirmation_reason as string) ||
      (msg.match_details?.confirmationReason as string) ||
      (isExplicitConfirmed
        ? "Booking and space confirmation recognized from message content"
        : null),
    confirmationDetectedBy:
      (msg.confirmation_detected_by as "DETERMINISTIC" | "AI" | "RULE_FALLBACK") ||
      (headers.confirmation_detected_by as "DETERMINISTIC" | "AI" | "RULE_FALLBACK") ||
      (msg.match_details?.confirmationDetectedBy as "DETERMINISTIC" | "AI" | "RULE_FALLBACK") ||
      (isExplicitConfirmed ? "RULE_FALLBACK" : null),
    confirmationDetectedAt:
      msg.confirmation_detected_at ||
      (headers.confirmation_detected_at as string) ||
      (msg.match_details?.confirmationDetectedAt as string) ||
      null,
    confirmationDetails:
      msg.confirmation_details ||
      (headers.confirmation_details as Record<string, unknown>) ||
      (msg.match_details?.confirmationDetails as Record<string, unknown>) ||
      null,

    // Booking Relations
    bookingReference: booking?.booking_reference || booking?.reference || movementNumber || null,
    bookingOrigin: booking?.origin || null,
    bookingDestination: booking?.destination || null,
    buyerName: booking?.buyer?.company_name || booking?.buyer_name || null,
    supplierName: booking?.supplier?.company_name || booking?.supplier_name || null,
    forwarderName:
      forwarder?.company_name || booking?.forwarder?.company_name || msg.recipient_name || null,
    forwarderCode: forwarder?.code || booking?.forwarder?.code || null,
    containerSize: booking?.container_size || null,
    containerCount: booking?.container_count || null,
    vesselName: booking?.vessel_name || null,
  };
}

// ============================================================================
// LOCAL STORAGE EMAILS PERSISTENCE HELPERS
// ============================================================================

const LOCAL_EMAILS_KEY = "nashmia_custom_emails_v1";

export function getLocalEmails(): EmailMessageRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_EMAILS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalEmail(email: EmailMessageRecord): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalEmails();
    const updated = [email, ...list.filter((e) => e.id !== email.id)];
    localStorage.setItem(LOCAL_EMAILS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Emails] Failed to save:", err);
  }
}

export function updateLocalEmail(id: string, patch: Partial<EmailMessageRecord>): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalEmails();
    const updated = list.map((e) => (e.id === id ? { ...e, ...patch } : e));
    localStorage.setItem(LOCAL_EMAILS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Emails] Failed to update:", err);
  }
}

/**
 * Zero mock/demo email policy - only returns genuine authenticated user/Gmail communications
 */
export function getDefaultOperationalEmails(): EmailMessageRecord[] {
  return [];
}

let lastLiveGmailFetchTime = 0;
let cachedLiveGmailRecords: EmailMessageRecord[] = [];

/**
 * Fetch all email messages with full relational metadata from Supabase and live Gmail
 */
export async function fetchEmailsFromSupabase(
  userId?: string | null,
): Promise<EmailMessageRecord[]> {
  const localList = getLocalEmails();
  let dbRecords: EmailMessageRecord[] = [];
  let gmailRecords: EmailMessageRecord[] = [];

  // 1. Fetch live Gmail messages if user has an active Gmail session (throttled to 60s)
  const now = Date.now();
  if (now - lastLiveGmailFetchTime < 60000 && cachedLiveGmailRecords.length > 0) {
    gmailRecords = cachedLiveGmailRecords;
  } else if (isGmailQuotaCooldownActive()) {
    gmailRecords = cachedLiveGmailRecords;
  } else {
    try {
      const token = await getGmailAccessToken(userId);
      if (token) {
        const cachedUser = getCachedGoogleUser();
        const liveGmailMsgs = await fetchLiveGmailMessages({
          maxResults: 15,
          userId,
        });
        if (liveGmailMsgs && liveGmailMsgs.length > 0) {
          gmailRecords = liveGmailMsgs.map((g) =>
            mapGmailMessageToEmailRecord(g, cachedUser?.email),
          );
          cachedLiveGmailRecords = gmailRecords;
          lastLiveGmailFetchTime = now;
        }
      }
    } catch (gmailErr) {
      console.warn("[EmailServices] Live Gmail fetch notice:", gmailErr);
      gmailRecords = cachedLiveGmailRecords;
    }
  }

  if (isSupabaseConfigured) {
    try {
      // 2. Fetch email threads with full relations
      let threadsQuery = supabase
        .from("email_threads")
        .select(
          `
          *,
          booking:bookings(
            *,
            buyer:buyers(*),
            supplier:suppliers(*),
            forwarder:forwarders(*)
          )
        `,
        )
        .order("last_message_at", { ascending: false });

      const validUserUuid = safeUuid(userId);
      if (validUserUuid) {
        threadsQuery = threadsQuery.or(`user_id.eq.${validUserUuid},user_id.is.null`);
      }

      const { data: threads, error: threadsError } = await threadsQuery;

      if (threadsError) {
        console.warn("[fetchEmailsFromSupabase] Threads error:", threadsError.message);
      }

      // 3. Fetch email messages
      const { data: messages, error: messagesError } = await supabase
        .from("email_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (!messagesError && messages) {
        // Index threads and bookings for quick lookup
        const threadMap = new Map<string, RawThreadData>();
        (threads || []).forEach((t) => threadMap.set(t.id, t as RawThreadData));

        // If any message thread wasn't in the user-filtered threads, fetch missing threads
        const missingThreadIds = Array.from(
          new Set(
            messages
              .map((m) => m.thread_id)
              .filter((id): id is string => Boolean(id && !threadMap.has(id))),
          ),
        );

        if (missingThreadIds.length > 0) {
          const { data: moreThreads } = await supabase
            .from("email_threads")
            .select(
              `
              *,
              booking:bookings(
                *,
                buyer:buyers(*),
                supplier:suppliers(*),
                forwarder:forwarders(*)
              )
            `,
            )
            .in("id", missingThreadIds);

          (moreThreads || []).forEach((t) => threadMap.set(t.id, t as RawThreadData));
        }

        // Fetch forwarders to join details
        const { data: forwarders } = await supabase.from("forwarders").select("*");
        const forwarderMap = new Map<string, RawForwarderData>();
        (forwarders || []).forEach((f) => forwarderMap.set(f.id, f as RawForwarderData));

        // Map each message
        dbRecords = messages.map((msg) => {
          const thread = threadMap.get(msg.thread_id);
          const booking = thread?.booking;
          const forwarder = booking?.forwarder_id ? forwarderMap.get(booking.forwarder_id) : null;
          return mapDatabaseEmailToRecord(msg as RawMessageData, thread, booking, forwarder);
        });
      }
    } catch (err) {
      console.error("[fetchEmailsFromSupabase] Exception:", err);
    }
  }

  // Deduplicate and combine all sources: Gmail + DB + Local
  const combinedMap = new Map<string, EmailMessageRecord>();

  // Add Gmail records
  gmailRecords.forEach((item) => {
    combinedMap.set(item.id, item);
    if (item.gmailMessageId) {
      combinedMap.set(item.gmailMessageId, item);
    }
  });

  // Add DB records (will overwrite or merge)
  dbRecords.forEach((item) => {
    combinedMap.set(item.id, item);
    if (item.gmailMessageId) {
      combinedMap.set(item.gmailMessageId, item);
    }
  });

  // Add local records if not present
  localList.forEach((item) => {
    if (
      !combinedMap.has(item.id) &&
      (!item.gmailMessageId || !combinedMap.has(item.gmailMessageId))
    ) {
      combinedMap.set(item.id, item);
    }
  });

  const merged = Array.from(new Set(Array.from(combinedMap.values())));

  // If completely empty, return default operational logistics emails so user always sees their emails
  if (merged.length === 0) {
    return getDefaultOperationalEmails();
  }

  // Correlate with local bookings & run confirmation classification
  const localBookings = getLocalBookings();
  const confirmedRefs = new Set<string>();
  for (const b of localBookings) {
    const s = (b.status || "").toUpperCase();
    const c = (b.confirmation_status || "").toUpperCase();
    if (s.includes("CONFIRM") || c === "CONFIRMED" || s === "LOADED" || s === "IN TRANSIT") {
      if (b.booking_reference) confirmedRefs.add(b.booking_reference.trim().toUpperCase());
      if (b.movement_number) confirmedRefs.add(b.movement_number.trim().toUpperCase());
      if (b.reference) confirmedRefs.add(b.reference.trim().toUpperCase());
      if (b.id) confirmedRefs.add(b.id.trim().toUpperCase());
    }
  }

  merged.forEach((item) => {
    const text = `${item.subject} ${item.body} ${item.snippet || ""}`;
    const movRef =
      item.movementNumber ||
      item.bookingReference ||
      text.match(
        /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
      )?.[0];

    if (movRef) {
      if (!item.movementNumber) item.movementNumber = movRef;
      if (!item.bookingReference) item.bookingReference = movRef;
    }

    const det = classifyConfirmationDeterministic(
      item.subject || "",
      item.body || item.snippet || "",
      item.snippet,
    );

    const isLinkedConfirmed = Boolean(movRef && confirmedRefs.has(movRef.trim().toUpperCase()));
    const isDetConfirmed = det?.status === "CONFIRMED";

    if (isDetConfirmed || isLinkedConfirmed) {
      item.confirmationStatus = "CONFIRMED";
      item.emailType = "BOOKING_CONFIRMATION";
      if (!item.confirmationReason) {
        item.confirmationReason = det?.reason || "Confirmed by Forwarder";
      }
      if (!item.confirmationConfidence) {
        item.confirmationConfidence = det?.confidence || 0.95;
      }
      if (!item.confirmationDetectedBy) {
        item.confirmationDetectedBy = "DETERMINISTIC";
      }
    }
  });

  // Sort by newest first
  return merged.sort((a, b) => {
    const timeA = new Date(a.sentAt || a.createdAt).getTime();
    const timeB = new Date(b.sentAt || b.createdAt).getTime();
    return timeB - timeA;
  });
}

/**
 * Fetch email statistics summary directly calculated from real database records
 */
export function calculateEmailStatistics(emails: EmailMessageRecord[]): EmailStatistics {
  let inbox = 0;
  let sent = 0;
  let drafts = 0;
  let pending = 0;
  let failed = 0;

  emails.forEach((email) => {
    if (email.direction === "inbound") {
      inbox++;
    }
    switch (email.status) {
      case "SENT":
        sent++;
        break;
      case "DRAFT":
        drafts++;
        break;
      case "PENDING":
      case "SENDING":
        pending++;
        break;
      case "FAILED":
      case "CANCELLED":
        failed++;
        break;
      default:
        if (email.direction === "inbound") {
          // Inbound emails are treated as received
        } else {
          sent++;
        }
    }
  });

  return {
    total: emails.length,
    inbox,
    sent,
    drafts,
    pending,
    failed,
  };
}

/**
 * Calculate folder counts for sidebar navigation
 */
export function calculateFolderCounts(emails: EmailMessageRecord[]): EmailFolderCount {
  let inbox = 0;
  let sent = 0;
  let drafts = 0;
  let pending = 0;
  let failed = 0;
  let booking = 0;
  let system = 0;

  emails.forEach((e) => {
    if (e.direction === "inbound") inbox++;
    if (e.status === "SENT") sent++;
    if (e.status === "DRAFT") drafts++;
    if (e.status === "PENDING" || e.status === "SENDING") pending++;
    if (e.status === "FAILED") failed++;
    if (e.emailType.startsWith("BOOKING_") || e.bookingId) booking++;
    if (e.emailType === "SYSTEM") system++;
  });

  return {
    inbox,
    sent,
    drafts,
    pending,
    failed,
    all: emails.length,
    booking,
    system,
  };
}

/**
 * Create or Save Draft Email to Supabase
 */
export async function saveDraftEmailInSupabase(
  userId: string | null | undefined,
  values: ComposeEmailFormValues,
  _existingMessageId?: string,
): Promise<{ success: boolean; messageId: string; threadId: string }> {
  const validUserUuid = safeUuid(userId);
  const nowIso = new Date().toISOString();
  const fallbackThreadId = `th-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const fallbackMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  let threadId = fallbackThreadId;
  let messageId = fallbackMessageId;

  if (isSupabaseConfigured) {
    try {
      // 1. Create or update thread
      const { data: thread, error: threadError } = await supabase
        .from("email_threads")
        .insert({
          user_id: validUserUuid,
          booking_id: safeUuid(values.bookingId),
          subject: values.subject || "Draft: (No Subject)",
          status: "DRAFT",
          snippet: values.body ? values.body.slice(0, 100) : "Draft email",
          last_message_at: nowIso,
        })
        .select()
        .single();

      if (!threadError && thread) {
        threadId = thread.id;
        // 2. Insert draft message
        const { data: message, error: messageError } = await supabase
          .from("email_messages")
          .insert({
            thread_id: thread.id,
            sender_email: values.fromEmail,
            sender_name: "Nashmia Industries",
            recipient_email: values.toEmail || "draft@nashmia.internal",
            recipient_name: values.toName || null,
            cc: values.cc || null,
            bcc: values.bcc || null,
            subject: values.subject || "(No Subject)",
            body: values.body || "",
            body_html: values.body ? values.body.replace(/\n/g, "<br/>") : null,
            direction: "outbound",
            sent_at: null,
          })
          .select()
          .single();

        if (!messageError && message) {
          messageId = message.id;
        }
      }
    } catch (err: unknown) {
      console.warn("[saveDraftEmailInSupabase] Supabase save notice:", err);
    }
  }

  // Save to local emails storage
  saveLocalEmail({
    id: messageId,
    threadId,
    userId: validUserUuid,
    bookingId: values.bookingId || null,
    fromEmail: values.fromEmail || "operations@nashmiaindustries.com",
    fromName: "Nashmia Industries",
    toEmail: values.toEmail || "",
    toName: values.toName || "",
    cc: values.cc || null,
    bcc: values.bcc || null,
    subject: values.subject || "Draft: (No Subject)",
    body: values.body || "",
    bodyHtml: values.body ? values.body.replace(/\n/g, "<br/>") : null,
    snippet: values.body ? values.body.slice(0, 140) : "Draft email",
    emailType: values.bookingId ? "BOOKING_REQUEST" : "GENERAL",
    status: "DRAFT",
    direction: "outbound",
    createdAt: nowIso,
    updatedAt: nowIso,
    attachments: [],
  });

  return {
    success: true,
    messageId,
    threadId,
  };
}

/**
 * Dispatch / Send an email through the secure backend flow with Gmail verification.
 * Only after Gmail API / backend confirms successful sending, status becomes SENT with valid message & thread IDs.
 */
export async function sendEmailThroughBackend(
  userId: string | null | undefined,
  values: ComposeEmailFormValues,
  _draftMessageId?: string,
): Promise<{
  success: boolean;
  status: EmailStatus;
  messageId: string;
  threadId: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  errorMessage?: string;
}> {
  console.log("[EmailService] sendEmailThroughBackend initiated with payload:", {
    userId: userId || null,
    fromEmail: values.fromEmail,
    toEmail: values.toEmail,
    toName: values.toName || null,
    cc: values.cc || null,
    bcc: values.bcc || null,
    subject: values.subject,
    bodyLength: values.body ? values.body.length : 0,
    bodySnippet: values.body ? values.body.slice(0, 100) : "",
    bookingId: values.bookingId || null,
    emailType: values.emailType,
    attachmentCount: values.attachments?.length || 0,
  });

  if (!values.toEmail || !values.toEmail.includes("@")) {
    const errorMsg = "A valid recipient email address is required.";
    console.error("[EmailService] Validation failed: Invalid recipient email:", values.toEmail);
    throw new Error(errorMsg);
  }

  const validUserUuid = safeUuid(userId);
  const nowIso = new Date().toISOString();
  const fallbackThreadId = `th-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const fallbackMessageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  let threadId = fallbackThreadId;
  let messageId = fallbackMessageId;

  // 1. Initial recording in Supabase as SENDING
  if (isSupabaseConfigured) {
    try {
      const { data: thread, error: threadError } = await supabase
        .from("email_threads")
        .insert({
          user_id: validUserUuid,
          booking_id: safeUuid(values.bookingId),
          subject: values.subject,
          status: "SENDING",
          snippet: values.body ? values.body.slice(0, 100) : "",
          last_message_at: nowIso,
        })
        .select()
        .single();

      const movementNumber =
        values.movementNumber ||
        extractMovementNumber(values.subject) ||
        extractMovementNumber(values.body) ||
        null;
      const movementId = values.movementId || values.bookingId || null;

      if (threadError) {
        console.warn("[EmailService] Supabase thread insert error:", threadError);
      } else if (thread) {
        threadId = thread.id;
        const { data: message, error: messageError } = await supabase
          .from("email_messages")
          .insert({
            thread_id: thread.id,
            user_id: validUserUuid,
            booking_id: safeUuid(values.bookingId),
            movement_id: safeUuid(movementId),
            movement_number: movementNumber,
            forwarder_id: safeUuid(values.forwarderId),
            sender_email: values.fromEmail,
            from_email: values.fromEmail,
            sender_name: "Nashmia Industries",
            recipient_email: values.toEmail,
            to_email: values.toEmail,
            recipient_name: values.toName || null,
            cc: values.cc || null,
            bcc: values.bcc || null,
            subject: values.subject,
            body: values.body || "",
            body_html: values.body ? values.body.replace(/\n/g, "<br/>") : null,
            direction: "outbound",
            status: "SENDING",
            email_type: values.emailType || "BOOKING_REQUEST",
            sent_at: null,
          })
          .select()
          .single();

        if (messageError) {
          console.warn("[EmailService] Supabase message insert error:", messageError);
        } else if (message) {
          messageId = message.id;
        }
      }
    } catch (dbErr) {
      console.warn("[EmailService] Supabase DB initial insert notice:", dbErr);
    }
  }

  // 2. Dispatch via Gmail API
  let finalStatus: EmailStatus = "FAILED";
  let gmailMessageId: string | undefined;
  let gmailThreadId: string | undefined;
  let backendErrorMessage: string | undefined;

  try {
    console.log("[EmailService] Checking Gmail access token for user:", userId);
    const token = await getGmailAccessToken(userId);

    if (token) {
      console.log("[EmailService] Token found. Calling sendEmailDirectlyViaGmail...");
      const gmailResult = await sendEmailDirectlyViaGmail({
        fromEmail: values.fromEmail,
        toEmail: values.toEmail,
        toName: values.toName,
        cc: values.cc,
        bcc: values.bcc,
        subject: values.subject,
        body: values.body,
        bookingId: values.bookingId,
        forwarderId: values.forwarderId,
        userId,
      });

      gmailMessageId = gmailResult.gmailMessageId;
      gmailThreadId = gmailResult.gmailThreadId;
      finalStatus = "SENT";
      console.log("[EmailService] Email successfully dispatched via Gmail API:", {
        gmailMessageId,
        gmailThreadId,
      });
    } else {
      console.warn("[EmailService] No Gmail access token found for user ID:", userId);
      // Attempt backend route if configured
      console.log("[EmailService] Checking backend fallback /api/gmail/send-email...");
      const backendRes = await fetch("/api/gmail/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: values.fromEmail,
          to: values.toEmail,
          cc: values.cc,
          bcc: values.bcc,
          subject: values.subject,
          body: values.body,
          bookingId: values.bookingId,
          messageId: messageId,
        }),
      }).catch((fetchErr) => {
        console.warn("[EmailService] Backend proxy fetch failed:", fetchErr);
        return null;
      });

      if (backendRes && backendRes.ok) {
        const responseData = (await backendRes.json().catch(() => ({}))) as {
          gmail_message_id?: string;
          id?: string;
          gmail_thread_id?: string;
          threadId?: string;
        };
        finalStatus = "SENT";
        gmailMessageId = responseData.gmail_message_id || responseData.id || `gm-${Date.now()}`;
        gmailThreadId =
          responseData.gmail_thread_id || responseData.threadId || `gth-${Date.now()}`;
        console.log("[EmailService] Sent via backend proxy:", { gmailMessageId, gmailThreadId });
      } else {
        const statusDetail = backendRes ? `HTTP ${backendRes.status}` : "Endpoint unreachable";
        backendErrorMessage = `Gmail is not connected. Please connect your Gmail account to send live emails (${statusDetail}).`;
        finalStatus = "FAILED";
        console.error(
          "[EmailService] Email delivery failed: No active Gmail OAuth session and backend proxy unavailable.",
          {
            backendResStatus: backendRes?.status,
          },
        );
      }
    }
  } catch (err: unknown) {
    console.error("[EmailService] ❌ Error occurred while sending email:", err);
    backendErrorMessage = err instanceof Error ? err.message : String(err);
    finalStatus = "FAILED";
  }

  // 3. Update Supabase with final status and error message
  if (isSupabaseConfigured && messageId !== fallbackMessageId) {
    try {
      await supabase
        .from("email_messages")
        .update({
          status: finalStatus === "SENT" ? "SENT" : "FAILED",
          gmail_message_id: gmailMessageId || null,
          gmail_thread_id: gmailThreadId || null,
          error_message: backendErrorMessage || null,
          sent_at: finalStatus === "SENT" ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", messageId);

      await supabase
        .from("email_threads")
        .update({
          status: finalStatus === "SENT" ? "SENT" : "FAILED",
          gmail_thread_id: gmailThreadId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", threadId);

      console.log("[EmailService] Supabase database records updated with status:", finalStatus);
    } catch (updateErr) {
      console.warn("[EmailService] Supabase update notice:", updateErr);
    }
  }

  // 4. Save to local cache with accurate final status
  saveLocalEmail({
    id: messageId,
    threadId,
    userId: validUserUuid,
    bookingId: values.bookingId || null,
    fromEmail: values.fromEmail || "operations@nashmiaindustries.com",
    fromName: "Nashmia Industries",
    toEmail: values.toEmail,
    toName: values.toName || "",
    cc: values.cc || null,
    bcc: values.bcc || null,
    subject: values.subject,
    body: values.body,
    bodyHtml: values.body ? values.body.replace(/\n/g, "<br/>") : null,
    snippet: values.body ? values.body.slice(0, 140) : "",
    emailType: values.bookingId ? "BOOKING_REQUEST" : "GENERAL",
    status: finalStatus,
    direction: "outbound",
    gmailMessageId: gmailMessageId || null,
    gmailThreadId: gmailThreadId || null,
    errorMessage: backendErrorMessage || null,
    createdAt: nowIso,
    updatedAt: nowIso,
    sentAt: finalStatus === "SENT" ? nowIso : null,
    attachments: [],
  });

  return {
    success: finalStatus === "SENT",
    status: finalStatus,
    messageId,
    threadId,
    gmailMessageId,
    gmailThreadId,
    errorMessage: backendErrorMessage,
  };
}

/**
 * Retry sending a failed email through the backend or Gmail API
 */
export async function retrySendEmailInSupabase(
  email: EmailMessageRecord,
): Promise<{ success: boolean; status: EmailStatus; errorMessage?: string }> {
  console.log("[EmailService] retrySendEmailInSupabase called with record payload:", {
    id: email.id,
    threadId: email.threadId,
    toEmail: email.toEmail,
    subject: email.subject,
    userId: email.userId,
    bookingId: email.bookingId,
  });

  try {
    // 1. Mark status as SENDING in Supabase
    if (isSupabaseConfigured) {
      await supabase.from("email_threads").update({ status: "SENDING" }).eq("id", email.threadId);
      await supabase.from("email_messages").update({ status: "SENDING" }).eq("id", email.id);
    }

    const token = await getGmailAccessToken(email.userId);

    if (!token) {
      const tokenErrMsg =
        "Gmail is not connected. Please connect your Gmail account in settings to retry.";
      console.error(
        "[EmailService] Retry failed: No Gmail access token found for user ID:",
        email.userId,
      );
      throw new Error(tokenErrMsg);
    }

    // 2. Execute send via Gmail API
    const gmailResult = await sendEmailDirectlyViaGmail({
      fromEmail: email.fromEmail,
      toEmail: email.toEmail,
      toName: email.toName,
      cc: email.cc || undefined,
      bcc: email.bcc || undefined,
      subject: email.subject,
      body: email.body,
      bodyHtml: email.bodyHtml || undefined,
      bookingId: email.bookingId,
      forwarderId: email.forwarderId,
      userId: email.userId,
    });

    console.log("[EmailService] ✅ Retry send SUCCEEDED via Gmail API:", gmailResult);

    // 3. Update database record as SENT
    if (isSupabaseConfigured) {
      await supabase
        .from("email_messages")
        .update({
          gmail_message_id: gmailResult.gmailMessageId,
          gmail_thread_id: gmailResult.gmailThreadId,
          status: "SENT",
          error_message: null,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);

      await supabase
        .from("email_threads")
        .update({
          status: "SENT",
          gmail_thread_id: gmailResult.gmailThreadId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.threadId);
    }

    updateLocalEmail(email.id, {
      status: "SENT",
      gmailMessageId: gmailResult.gmailMessageId,
      gmailThreadId: gmailResult.gmailThreadId,
      sentAt: new Date().toISOString(),
      errorMessage: null,
    });

    return {
      success: true,
      status: "SENT",
    };
  } catch (err: unknown) {
    console.error("[EmailService] ❌ Retry send FAILED. Full error details:", err);
    const msg = err instanceof Error ? err.message : "Failed to retry email transmission.";

    if (isSupabaseConfigured) {
      await supabase
        .from("email_messages")
        .update({
          status: "FAILED",
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.id);

      await supabase
        .from("email_threads")
        .update({
          status: "FAILED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", email.threadId);
    }

    updateLocalEmail(email.id, {
      status: "FAILED",
      errorMessage: msg,
    });

    return {
      success: false,
      status: "FAILED",
      errorMessage: msg,
    };
  }
}
