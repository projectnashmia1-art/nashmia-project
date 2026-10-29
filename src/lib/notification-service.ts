/**
 * Unified Logistics Notification Engine
 *
 * Coordinates creation, database persistence, deduplication, and broadcasting
 * of operational events across the logistics platform.
 *
 * Supported Event Types:
 * 1. BOOKING_REQUEST_CREATED
 * 2. QUOTATION_RECEIVED
 * 3. BOOKING_CONFIRMED
 * 4. OFFER_AWARDED
 * 5. MOVEMENT_STATUS_CHANGED
 * 6. ETA_UPDATED
 * 7. CUTOFF_REMINDER
 * 8. DOCUMENT_UPLOADED
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid } from "./supabase-services";
import { showPillToast } from "./pill-toast";

export type LogisticsEventType =
  | "BOOKING_REQUEST_CREATED"
  | "QUOTATION_RECEIVED"
  | "BOOKING_CONFIRMED"
  | "OFFER_AWARDED"
  | "MOVEMENT_STATUS_CHANGED"
  | "MOVEMENT_DETAILS_UPDATED"
  | "ETA_UPDATED"
  | "CUTOFF_REMINDER"
  | "CUTOFF_UPDATED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_LINKED"
  | "DOCUMENT_UPDATED";

export interface CreateNotificationParams {
  eventType: LogisticsEventType;
  movementNumber?: string | null;
  bookingReference?: string | null;
  bookingId?: string | null;
  forwarderName?: string | null;
  customerName?: string | null;
  activity?: string | null;
  details?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  updatedBy?: string | null;
  title?: string | null;
  message?: string | null;
  userId?: string | null;
  linkUrl?: string | null;
  cutoffType?: string | null;
  cutoffDeadline?: string | null;
  documentName?: string | null;
  documentType?: string | null;
  statusText?: string | null;
  etaDate?: string | null;
  rateText?: string | null;
  metadata?: Record<string, unknown>;
}

// In-memory deduplication window (prevents duplicate rapid inserts within 15 seconds)
const recentNotificationMap = new Map<string, number>();

function isDuplicateRecentEvent(signature: string, windowMs = 15000): boolean {
  const now = Date.now();
  const lastTime = recentNotificationMap.get(signature);
  if (lastTime && now - lastTime < windowMs) {
    return true;
  }
  recentNotificationMap.set(signature, now);

  // Prune map if large
  if (recentNotificationMap.size > 200) {
    for (const [key, timestamp] of recentNotificationMap.entries()) {
      if (now - timestamp > 60000) {
        recentNotificationMap.delete(key);
      }
    }
  }
  return false;
}

/**
 * Resolves a valid user ID for PostgreSQL foreign key constraint.
 * Fallbacks to current authenticated user or system profile.
 */
let cachedFallbackUserId: string | null = null;

async function resolveValidUserId(explicitUserId?: string | null): Promise<string | null> {
  const validExplicit = safeUuid(explicitUserId);
  if (validExplicit) return validExplicit;

  if (cachedFallbackUserId) return cachedFallbackUserId;

  if (!isSupabaseConfigured) return null;

  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      cachedFallbackUserId = authData.user.id;
      return cachedFallbackUserId;
    }
  } catch {
    // Non-blocking
  }

  try {
    const { data: profile } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
    if (profile?.id) {
      cachedFallbackUserId = profile.id;
      return cachedFallbackUserId;
    }
  } catch {
    // Non-blocking
  }

  return null;
}

/**
 * Formats a canonical movement reference
 */
export function formatMovementRef(ref?: string | null): string {
  if (!ref) return "";
  const clean = ref.trim().toUpperCase();
  if (clean === "BOOKING" || clean === "UNDEFINED" || clean === "NULL") return "";
  return clean;
}

/**
 * Maps logistics event to PostgreSQL allowed notification enum types:
 * ('info', 'success', 'warning', 'error', 'cutoff_warning', 'booking_status', 'email_received', 'system')
 */
function mapEventToDbType(eventType: LogisticsEventType): string {
  switch (eventType) {
    case "BOOKING_CONFIRMED":
    case "OFFER_AWARDED":
    case "BOOKING_REQUEST_CREATED":
    case "MOVEMENT_STATUS_CHANGED":
    case "MOVEMENT_DETAILS_UPDATED":
    case "ETA_UPDATED":
      return "booking_status";
    case "CUTOFF_REMINDER":
    case "CUTOFF_UPDATED":
      return "cutoff_warning";
    case "QUOTATION_RECEIVED":
      return "email_received";
    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_LINKED":
    case "DOCUMENT_UPDATED":
      return "info";
    default:
      return "system";
  }
}

/**
 * Creates, persists, and broadcasts a logistics notification
 */
export async function createLogisticsNotification(
  params: CreateNotificationParams,
): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const movementRef =
      formatMovementRef(params.movementNumber) || formatMovementRef(params.bookingReference) || "";

    // Deduplication signature
    const signatureKey = `${params.eventType}:${movementRef}:${params.forwarderName || ""}:${params.documentName || ""}`;
    if (isDuplicateRecentEvent(signatureKey)) {
      console.log(`[NotificationEngine] Skipped duplicate event within window: ${signatureKey}`);
      return { success: true };
    }

    // Resolve human-readable titles and messages
    let title = params.title;
    let message = params.message;
    let link = params.linkUrl;

    switch (params.eventType) {
      case "BOOKING_REQUEST_CREATED":
        title =
          title || (movementRef ? `Booking Request: ${movementRef}` : "Booking Request Created");
        message =
          message ||
          (params.customerName
            ? `New booking request initialized for ${params.customerName}${movementRef ? ` (${movementRef})` : ""}.`
            : `Booking request ${movementRef} registered in operations.`);
        link =
          link ||
          (movementRef
            ? `/requests?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/requests");
        break;

      case "QUOTATION_RECEIVED":
        title = title || (movementRef ? `Quote Received: ${movementRef}` : "Quotation Received");
        message =
          message ||
          (params.forwarderName
            ? `${params.forwarderName} submitted rates${params.rateText ? ` (${params.rateText})` : ""} for movement ${movementRef}.`
            : `New quotation received for movement ${movementRef}.`);
        link =
          link ||
          (movementRef
            ? `/requests?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/requests");
        break;

      case "BOOKING_CONFIRMED":
        title = title || (movementRef ? `Booking Confirmed: ${movementRef}` : "Booking Confirmed");
        message =
          message ||
          (params.forwarderName
            ? `Movement ${movementRef} space confirmed by ${params.forwarderName}.`
            : `Movement ${movementRef} space allocation confirmed.`);
        link =
          link ||
          (movementRef
            ? `/movements?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/movements");
        break;

      case "OFFER_AWARDED":
        title = title || (movementRef ? `Forwarder Awarded: ${movementRef}` : "Forwarder Awarded");
        message =
          message ||
          (params.forwarderName
            ? `Booking ${movementRef} awarded to ${params.forwarderName}. Space reservation locked.`
            : `Booking ${movementRef} successfully awarded.`);
        link =
          link ||
          (movementRef
            ? `/requests?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/requests");
        break;

      case "MOVEMENT_STATUS_CHANGED":
        title = title || (movementRef ? `Status Update: ${movementRef}` : "Movement Status Update");
        message =
          message ||
          `Movement ${movementRef} status transitioned to "${params.statusText || "Updated"}".`;
        link =
          link ||
          (movementRef
            ? `/movements?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/movements");
        break;

      case "ETA_UPDATED":
        title = title || (movementRef ? `ETA Update: ${movementRef}` : "Vessel Schedule Update");
        message =
          message ||
          `Vessel arrival date for movement ${movementRef} updated to ${params.etaDate || "new schedule"}.`;
        link =
          link ||
          (movementRef
            ? `/movements?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/movements");
        break;

      case "CUTOFF_REMINDER":
        title =
          title ||
          (movementRef ? `Cut-Off Reminder (48h): ${movementRef}` : "Cut-Off Reminder (48h)");
        message =
          message ||
          `${params.cutoffType || "Terminal / Documentation"} deadline for ${movementRef} is approaching (${params.cutoffDeadline || "within 48 hours"}).`;
        link =
          link ||
          (movementRef
            ? `/movements?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/movements");
        break;

      case "DOCUMENT_UPLOADED":
      case "DOCUMENT_LINKED":
      case "DOCUMENT_UPDATED":
        title =
          title ||
          (movementRef
            ? `${movementRef} — Document ${params.eventType === "DOCUMENT_UPDATED" ? "Updated" : "Linked"}`
            : "Document Linked");
        message =
          message ||
          `Document "${params.documentName || params.documentType || "File"}" ${params.eventType === "DOCUMENT_UPDATED" ? "updated" : "linked"} successfully${params.updatedBy ? ` by ${params.updatedBy}` : ""}.`;
        link =
          link ||
          (movementRef
            ? `/movements?ref=${encodeURIComponent(movementRef)}&openDrawer=true&tab=documents`
            : "/documents");
        break;

      case "MOVEMENT_DETAILS_UPDATED":
        title =
          title || (movementRef ? `${movementRef} — Details Updated` : "Movement Details Updated");
        message =
          message ||
          (params.details
            ? `${params.details}${params.updatedBy ? ` · by ${params.updatedBy}` : ""}`
            : `Movement ${movementRef} details updated.`);
        link =
          link ||
          (movementRef
            ? `/movements?ref=${encodeURIComponent(movementRef)}&openDrawer=true`
            : "/movements");
        break;

      case "CUTOFF_UPDATED":
        title = title || (movementRef ? `${movementRef} — Cut-off Updated` : "Cut-off Updated");
        message =
          message ||
          `${params.cutoffType || "Deadline"} for ${movementRef} updated to ${params.cutoffDeadline || "new schedule"}${params.updatedBy ? ` by ${params.updatedBy}` : ""}.`;
        link =
          link ||
          (movementRef
            ? `/movements?ref=${encodeURIComponent(movementRef)}&openDrawer=true&tab=cutoffs`
            : "/movements");
        break;
    }

    const dbType = mapEventToDbType(params.eventType);
    const targetUserId = await resolveValidUserId(params.userId);

    // Resolve foreign key booking UUID if valid
    let cleanBookingId: string | null = null;
    if (params.bookingId) {
      cleanBookingId = safeUuid(params.bookingId);
    }

    let insertedId: string | undefined;

    // 1. Insert into Supabase 'notifications' table
    if (isSupabaseConfigured && targetUserId) {
      try {
        const { data: inserted, error: insertErr } = await supabase
          .from("notifications")
          .insert({
            user_id: targetUserId,
            type: dbType,
            title,
            message,
            booking_id: cleanBookingId || undefined,
            related_booking_id: cleanBookingId || undefined,
            link,
            is_read: false,
          })
          .select("id, created_at")
          .maybeSingle();

        if (insertErr) {
          console.warn("[NotificationEngine] Supabase insert warning:", insertErr.message);
        } else if (inserted?.id) {
          insertedId = inserted.id;
        }
      } catch (dbErr) {
        console.warn("[NotificationEngine] Database insert error:", dbErr);
      }
    }

    // 2. Dispatch local browser event so current session updates without waiting for network WebSocket
    if (typeof window !== "undefined") {
      const payloadDetail = {
        id: insertedId || `local-${Date.now()}`,
        eventType: params.eventType,
        title,
        message,
        bookingReference: movementRef,
        movementNumber: movementRef,
        linkUrl: link,
        forwarderName: params.forwarderName,
        timestamp: Date.now(),
        type: params.eventType.toLowerCase(),
        is_read: false,
      };

      window.dispatchEvent(
        new CustomEvent("nashmia_notification_inserted", { detail: payloadDetail }),
      );

      // Trigger pill toast alert for the local user
      triggerEventToast(params.eventType, title, message, movementRef);
    }

    return { success: true, id: insertedId };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[NotificationEngine] Error creating notification:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Triggers clean, branded in-app pill toasts according to event severity
 */
function triggerEventToast(
  eventType: LogisticsEventType,
  title: string,
  message: string,
  movementRef?: string,
) {
  switch (eventType) {
    case "BOOKING_CONFIRMED":
    case "OFFER_AWARDED":
      showPillToast.success(message, title, movementRef);
      break;
    case "CUTOFF_REMINDER":
      showPillToast.warning(message, title, movementRef);
      break;
    case "QUOTATION_RECEIVED":
      showPillToast.comment(message, title, movementRef);
      break;
    case "BOOKING_REQUEST_CREATED":
    case "DOCUMENT_UPLOADED":
    case "ETA_UPDATED":
    case "MOVEMENT_STATUS_CHANGED":
    default:
      showPillToast.info(message, title, movementRef);
  }
}

export interface NotifyMovementParams {
  movementNumber: string;
  bookingId?: string | null;
  activity: string;
  details: string;
  previousValue?: string | null;
  newValue?: string | null;
  documentName?: string | null;
  documentType?: string | null;
  updatedBy?: string | null;
  eventType?: LogisticsEventType;
  userId?: string | null;
}

/**
 * Universal movement activity notification helper.
 * Formats canonical title: "NASH-BK-2026-6093 — <Activity>"
 * Formats clear details with Previous → New values and document names.
 * Persists in Supabase notifications table, dispatches locally, and triggers toasts.
 */
export async function notifyMovementActivity(params: NotifyMovementParams) {
  const movRef = formatMovementRef(params.movementNumber);
  if (!movRef) return { success: false, error: "Missing movement number" };

  const eventType: LogisticsEventType =
    params.eventType ||
    (params.documentName
      ? "DOCUMENT_LINKED"
      : params.activity.toLowerCase().includes("stage")
        ? "MOVEMENT_STATUS_CHANGED"
        : params.activity.toLowerCase().includes("cut-off") ||
            params.activity.toLowerCase().includes("cutoff")
          ? "CUTOFF_UPDATED"
          : "MOVEMENT_DETAILS_UPDATED");

  const title = `${movRef} — ${params.activity}`;

  let changeDetail = params.details;
  if (params.previousValue && params.newValue && !changeDetail.includes("→")) {
    changeDetail += ` (${params.previousValue} → ${params.newValue})`;
  }

  const message = `${changeDetail}${params.documentName ? ` [${params.documentName}]` : ""}${
    params.updatedBy ? ` · by ${params.updatedBy}` : ""
  }`;

  const link = `/movements?ref=${encodeURIComponent(movRef)}&openDrawer=true${
    params.documentName ? "&tab=documents" : ""
  }`;

  return createLogisticsNotification({
    eventType,
    movementNumber: movRef,
    bookingReference: movRef,
    bookingId: params.bookingId,
    title,
    message,
    details: changeDetail,
    previousValue: params.previousValue,
    newValue: params.newValue,
    documentName: params.documentName,
    documentType: params.documentType,
    updatedBy: params.updatedBy,
    userId: params.userId,
    linkUrl: link,
  });
}

export const createOperationalNotification = createLogisticsNotification;
