/**
 * Centralized, Secure Audit Logger for Rule-Based Email Quotation Pipeline
 * Conforms to Section 17 of the specification.
 * Zero secret or token exposure. Fully auditable operational events.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid } from "./supabase-services";

export type QuotationAuditEventType =
  | "EMAIL_RECEIVED"
  | "EMAIL_CLEANED"
  | "EMAIL_MATCHED"
  | "EMAIL_UNMATCHED"
  | "EXTRACTION_STARTED"
  | "EXTRACTION_COMPLETED"
  | "EXTRACTION_NEEDS_REVIEW"
  | "QUOTATION_SAVED"
  | "QUOTATION_UPDATED"
  | "BOOKING_AWARDED"
  | "CONFIRMATION_DETECTED"
  | "BOOKING_CONFIRMED"
  | "PROCESSING_FAILED";

export interface QuotationAuditPayload {
  eventType: QuotationAuditEventType;
  movementNumber?: string | null;
  bookingId?: string | null;
  forwarderId?: string | null;
  forwarderName?: string | null;
  senderEmail?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
  userId?: string | null;
}

export interface StoredAuditEvent extends QuotationAuditPayload {
  id: string;
  timestamp: string;
}

const STORAGE_KEY = "nashmia_quotation_audit_events_v1";
const MAX_LOCAL_EVENTS = 200;

// Keys that must NEVER be persisted or logged in audit events
const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "accessToken",
  "refreshToken",
  "token",
  "secret",
  "client_secret",
  "clientSecret",
  "password",
  "authorization",
  "auth_token",
  "service_role_key",
  "serviceRoleKey",
]);

/**
 * Recursively scrubs sensitive credentials, tokens and authorization headers
 */
export function sanitizeAuditData(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeAuditData(item));
  }

  const cleanObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (
      SENSITIVE_KEYS.has(key) ||
      key.toLowerCase().includes("token") ||
      key.toLowerCase().includes("secret")
    ) {
      cleanObj[key] = "[REDACTED_CREDENTIAL]";
    } else if (typeof value === "object" && value !== null) {
      cleanObj[key] = sanitizeAuditData(value);
    } else {
      cleanObj[key] = value;
    }
  }
  return cleanObj;
}

/**
 * Records an auditable event safely into Supabase audit_logs/booking_events
 * and updates local circular buffer for instant UI observability.
 */
export async function recordQuotationAuditEvent(
  payload: QuotationAuditPayload,
): Promise<StoredAuditEvent> {
  const nowIso = new Date().toISOString();
  const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const sanitizedDetails = payload.details
    ? (sanitizeAuditData(payload.details) as Record<string, unknown>)
    : {};

  const event: StoredAuditEvent = {
    ...payload,
    details: sanitizedDetails,
    id,
    timestamp: nowIso,
  };

  // 1. In-memory / LocalStorage buffer
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: StoredAuditEvent[] = raw ? JSON.parse(raw) : [];
      list.unshift(event);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_LOCAL_EVENTS)));

      window.dispatchEvent(new CustomEvent("nashmia_quotation_audit_event", { detail: event }));
    } catch (e) {
      console.warn("[QuotationAuditLogger] Notice saving event to local storage:", e);
    }
  }

  // Console observability (Safe structured logging)
  console.log(
    `[QuotationAudit] [${event.eventType}] ${event.movementNumber || event.bookingId || "System"}: ${event.summary}`,
    {
      sender: event.senderEmail,
      forwarder: event.forwarderName,
      messageId: event.gmailMessageId,
    },
  );

  // 2. Persist to Supabase audit_logs
  if (isSupabaseConfigured) {
    try {
      const validBookingUuid = safeUuid(payload.bookingId);
      const validUserUuid = safeUuid(payload.userId);

      await supabase.from("audit_logs").insert({
        action: payload.eventType,
        entity_type: "quotation_email",
        entity_id: validBookingUuid || payload.movementNumber || payload.gmailMessageId || null,
        user_id: validUserUuid || null,
        new_data: {
          summary: payload.summary,
          movementNumber: payload.movementNumber || null,
          forwarderName: payload.forwarderName || null,
          forwarderId: payload.forwarderId || null,
          senderEmail: payload.senderEmail || null,
          gmailMessageId: payload.gmailMessageId || null,
          gmailThreadId: payload.gmailThreadId || null,
          ...sanitizedDetails,
        },
      });

      // If tied to a booking, also log in booking_events for timeline display
      if (validBookingUuid) {
        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: payload.eventType,
          event_date: nowIso,
          location: "Email Quotation Engine",
          description: `${payload.summary} (${payload.forwarderName || payload.senderEmail || "System"})`,
        });
      }
    } catch (err) {
      console.warn("[QuotationAuditLogger] Notice persisting to Supabase:", err);
    }
  }

  return event;
}

/**
 * Retrieves audit history for a movement or all recent quotation events
 */
export function getStoredQuotationAuditEvents(movementNumber?: string | null): StoredAuditEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: StoredAuditEvent[] = JSON.parse(raw);
    if (!movementNumber) return list;
    const cleanMov = movementNumber.trim().toUpperCase();
    return list.filter((e) => e.movementNumber && e.movementNumber.toUpperCase() === cleanMov);
  } catch {
    return [];
  }
}
