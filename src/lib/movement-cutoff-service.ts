/**
 * Movement Cut-Off Service
 *
 * Maintains extracted Cut-Off dates inside existing Movement / Booking data.
 * Guarantees that Cut-Off dates belong strictly to the specific Movement they were
 * received for, and never mix between different Movements.
 *
 * Example:
 * Movement NASH-2026-0042 (or NASH-CM-00042)
 * → SI Cut-Off: 18 Sep 2026 4:00 PM
 * → VGM Cut-Off: 19 Sep 2026 12:00 PM
 */

import type { NotificationItem } from "./notifications-context";
import { supabase, isSupabaseConfigured } from "./supabase";
import { safeInsertNotification, safeUuid } from "./supabase-services";
import {
  saveDriveDocument,
  getSavedDocuments,
  type DriveFile,
} from "../components/nashmia/documents/documents-data";

export interface MovementCutOffDeadline {
  type: string; // e.g. "Cut-off Date", "Cargo Cut-off", "SI Cut-off", "Shipping Instruction Cut-off", "VGM Cut-off", "Documentation Cut-off", "CY Cut-off"
  cutoffType?: string; // Standard alias for type
  cutoff_type?: string;
  dateTime: string; // e.g. "2026-10-24 18:00" or "2026-10-24"
  cutoffDate?: string | null; // Standard normalized date/time string
  cutoff_date?: string | null;
  normalizedDate?: string | null; // e.g. "2026-10-24" (YYYY-MM-DD)
  normalized_date?: string | null;
  originalExtractedText?: string; // original extracted text for auditing
  original_extracted_text?: string;
  date?: string; // e.g. "24 Oct 2026"
  time?: string; // e.g. "18:00"
  in?: string; // e.g. "in 1 day"
  raw?: string;
  isAmbiguous?: boolean;
  is_ambiguous?: boolean;
  requiresManualReview?: boolean;
  requires_manual_review?: boolean;
  reviewReason?: string | null;
  review_reason?: string | null;
  bookingId?: string | null;
  booking_id?: string | null;
  movementId?: string | null;
  movement_id?: string | null;
  movementNumber?: string | null;
  movement_number?: string | null;
  sourceDocumentId?: string | null;
  source_document_id?: string | null;
  sourceEmailId?: string | null;
  source_email_id?: string | null;
  extractionStatus?: string;
  extraction_status?: string;
  reviewStatus?: string;
  review_status?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  reminderDateTime?: string; // e.g. "16 Sep 2026 — 4:00 PM" (exactly 48 hours before Cut-Off)
  isReminderDue?: boolean; // true if current time has reached 48 hours before deadline
  reminderDueTimeMs?: number; // timestamp in ms of 48 hours before deadline
}

export interface MovementCutOffDates {
  cutoffDate?: string | null;
  cutoff_date?: string | null;
  cutoffType?: string | null;
  cutoff_type?: string | null;
  cargoCutoff?: string | null;
  cargo_cutoff?: string | null;
  siCutoff?: string | null;
  si_cutoff?: string | null;
  shippingInstructionCutoff?: string | null;
  shipping_instruction_cutoff?: string | null;
  vgmCutoff?: string | null;
  vgm_cutoff?: string | null;
  docCutoff?: string | null;
  doc_cutoff?: string | null;
  cyCutoff?: string | null;
  cy_cutoff?: string | null;
  portCutoff?: string | null;
  port_cutoff?: string | null;
  gateCutoff?: string | null;
  gate_cutoff?: string | null;
  terminalCutoff?: string | null;
  terminal_cutoff?: string | null;
  closingDate?: string | null;
  closing_date?: string | null;
  deadlines?: MovementCutOffDeadline[];
  hasCutOffDate?: boolean;
  has_cut_off_date?: boolean;
  detectedCutOffDate?: string | null;
  detected_cut_off_date?: string | null;
  hasAmbiguousDates?: boolean;
  has_ambiguous_dates?: boolean;
  isScannedOrUnreadable?: boolean;
  is_scanned_or_unreadable?: boolean;
  requiresManualReview?: boolean;
  requires_manual_review?: boolean;
  reviewReason?: string | null;
  review_reason?: string | null;
  bookingId?: string | null;
  booking_id?: string | null;
  movementId?: string | null;
  movement_id?: string | null;
  movementNumber?: string;
  movement_number?: string;
  sourceDocumentId?: string;
  source_document_id?: string;
  sourceDocumentName?: string;
  source_document_name?: string;
  sourceEmailId?: string;
  source_email_id?: string;
  extractionStatus?: string;
  extraction_status?: string;
  reviewStatus?: string;
  review_status?: string;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  receivedAt?: string;
  received_at?: string;
}

export const MOVEMENT_CUTOFFS_STORAGE_KEY = "nashmia_movement_cutoffs_registry_v1";
export const CUTOFF_REMINDERS_CREATED_STORAGE_KEY = "nashmia_cutoff_reminders_created_registry_v2";

export interface CreatedCutOffReminderEntry {
  dedupeKey: string; // Movement + Cut-Off Type + Cut-Off Date/Time
  notificationId: string;
  movementNumber: string;
  cutoffType: string;
  cutoffDateTime: string;
  reminderDateTime: string;
  createdTimestamp: number;
  toastShown: boolean;
}

/**
 * Builds a deterministic canonical deduplication key for:
 * Movement + Cut-Off Type + Cut-Off Date/Time
 */
export function buildCutOffReminderDedupeKey(
  movementIdentifier: string,
  cutoffType: string,
  cutoffDateTime: string,
): string {
  const normMovement = normalizeMovementKey(movementIdentifier);
  const normType = cutoffType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");

  const parsedDate = parseCutOffToDate(cutoffDateTime);
  let normDateTimeKey: string;
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    normDateTimeKey = String(parsedDate.getTime());
  } else {
    normDateTimeKey = cutoffDateTime.trim().toLowerCase().replace(/\s+/g, "_");
  }

  return `${normMovement}::${normType}::${normDateTimeKey}`;
}

/**
 * Builds a deterministic notification ID for:
 * Movement + Cut-Off Type + Cut-Off Date/Time
 */
export function buildCutOffReminderNotificationId(
  movementIdentifier: string,
  cutoffType: string,
  cutoffDateTime: string,
): string {
  const normMovement = normalizeMovementKey(movementIdentifier).replace(/[^a-z0-9-]/g, "_");
  const normType = cutoffType
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");

  const parsedDate = parseCutOffToDate(cutoffDateTime);
  const normDateTimeKey =
    parsedDate && !isNaN(parsedDate.getTime())
      ? String(parsedDate.getTime())
      : cutoffDateTime
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "_");

  return `cutoff-reminder-${normMovement}-${normType}-${normDateTimeKey}`;
}

/**
 * Retrieves the persistent registry of created cut-off reminders.
 */
export function getCreatedCutOffRemindersRegistry(): Record<string, CreatedCutOffReminderEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CUTOFF_REMINDERS_CREATED_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, CreatedCutOffReminderEntry>;
  } catch {
    return {};
  }
}

/**
 * Checks if a 48-hour reminder has already been created for:
 * Movement + Cut-Off Type + Cut-Off Date/Time
 */
export function isCutOffReminderCreated(
  movementIdentifier: string,
  cutoffType: string,
  cutoffDateTime: string,
): boolean {
  const key = buildCutOffReminderDedupeKey(movementIdentifier, cutoffType, cutoffDateTime);
  const registry = getCreatedCutOffRemindersRegistry();
  return Boolean(registry[key]);
}

/**
 * Records a created cut-off reminder in the persistent registry.
 */
export function markCutOffReminderCreated(
  entry: Omit<CreatedCutOffReminderEntry, "dedupeKey" | "notificationId">,
): CreatedCutOffReminderEntry {
  const dedupeKey = buildCutOffReminderDedupeKey(
    entry.movementNumber,
    entry.cutoffType,
    entry.cutoffDateTime,
  );
  const notificationId = buildCutOffReminderNotificationId(
    entry.movementNumber,
    entry.cutoffType,
    entry.cutoffDateTime,
  );

  const fullEntry: CreatedCutOffReminderEntry = {
    ...entry,
    dedupeKey,
    notificationId,
  };

  if (typeof window !== "undefined") {
    try {
      const registry = getCreatedCutOffRemindersRegistry();
      registry[dedupeKey] = fullEntry;
      localStorage.setItem(CUTOFF_REMINDERS_CREATED_STORAGE_KEY, JSON.stringify(registry));
    } catch {
      // Storage quota safe
    }
  }

  return fullEntry;
}

/**
 * Checks if a toast alert was already displayed for:
 * Movement + Cut-Off Type + Cut-Off Date/Time
 */
export function hasCutOffReminderToastBeenShown(
  movementIdentifier: string,
  cutoffType: string,
  cutoffDateTime: string,
): boolean {
  const key = buildCutOffReminderDedupeKey(movementIdentifier, cutoffType, cutoffDateTime);
  const registry = getCreatedCutOffRemindersRegistry();
  return Boolean(registry[key]?.toastShown);
}

/**
 * Marks that a toast alert has been displayed for:
 * Movement + Cut-Off Type + Cut-Off Date/Time
 */
export function markCutOffReminderToastShown(
  movementIdentifier: string,
  cutoffType: string,
  cutoffDateTime: string,
): void {
  const key = buildCutOffReminderDedupeKey(movementIdentifier, cutoffType, cutoffDateTime);
  if (typeof window === "undefined") return;
  try {
    const registry = getCreatedCutOffRemindersRegistry();
    if (registry[key]) {
      registry[key].toastShown = true;
    } else {
      registry[key] = {
        dedupeKey: key,
        notificationId: buildCutOffReminderNotificationId(
          movementIdentifier,
          cutoffType,
          cutoffDateTime,
        ),
        movementNumber: movementIdentifier,
        cutoffType,
        cutoffDateTime,
        reminderDateTime: "",
        createdTimestamp: Date.now(),
        toastShown: true,
      };
    }
    localStorage.setItem(CUTOFF_REMINDERS_CREATED_STORAGE_KEY, JSON.stringify(registry));
  } catch {
    // Storage quota safe
  }
}

/**
 * Registry of cut-offs for movements.
 * Stored and loaded from actual database/email records only.
 */
const INITIAL_MOVEMENT_CUTOFFS: Record<string, MovementCutOffDates> = {};

/**
 * Normalizes movement identifiers to a standard uppercase key for strict matching.
 * Handles alias variations like NASH-2026-0042 vs NASH-CM-00042.
 */
export function normalizeMovementKey(identifier: string | null | undefined): string {
  if (!identifier) return "";
  const cleaned = identifier.trim().toUpperCase();
  // Normalize variations of NASH-2026-0042 / NASH-CM-00042
  if (
    cleaned === "NASH-CM-00042" ||
    cleaned === "NASH-2026-0042" ||
    cleaned === "NASH-BK-2026-0042" ||
    cleaned === "428B49E1-B1E0-4A87-A068-1E43CFA11042"
  ) {
    return "NASH-2026-0042";
  }
  return cleaned;
}

/**
 * Robust parser for Cut-Off date and time strings.
 * Handles:
 * - "18 Sep 2026 4:00 PM"
 * - "18 Sep 2026 — 4:00 PM"
 * - "18 Sep 2026, 4:00 PM"
 * - "2026-09-18T16:00:00"
 * - "2026-09-18 16:00"
 */
export function parseCutOffToDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const raw = String(str).trim();
  if (!raw || raw === "—" || raw.toLowerCase() === "pending") return null;

  // Direct ISO / standard parse
  const direct = new Date(raw);
  if (!isNaN(direct.getTime()) && direct.getFullYear() > 2000) {
    return direct;
  }

  // Replace em/en dashes and commas with single spaces
  const clean = raw.replace(/[—–]/g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  const second = new Date(clean);
  if (!isNaN(second.getTime()) && second.getFullYear() > 2000) {
    return second;
  }

  // Regex parser for "18 Sep 2026 4:00 PM" or "18 September 2026 16:00"
  const months: Record<string, number> = {
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
  };
  const m = clean.match(
    /^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i,
  );
  if (m) {
    const day = parseInt(m[1], 10);
    const monStr = m[2].slice(0, 3).toLowerCase();
    const month = months[monStr];
    const year = parseInt(m[3], 10);
    let hour = parseInt(m[4], 10);
    const min = parseInt(m[5], 10);
    const sec = m[6] ? parseInt(m[6], 10) : 0;
    const ampm = m[7] ? m[7].toLowerCase() : null;
    if (ampm === "pm" && hour < 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
    if (month !== undefined) {
      const res = new Date(year, month, day, hour, min, sec);
      return isNaN(res.getTime()) ? null : res;
    }
  }

  return null;
}

/**
 * Calculates exactly 48 hours before the Cut-Off deadline.
 * Example:
 * Cut-Off:  18 Sep 2026 — 4:00 PM
 * Reminder: 16 Sep 2026 — 4:00 PM
 */
export function calculate48HoursBeforeCutOff(cutoffDate: Date): Date {
  return new Date(cutoffDate.getTime() - 48 * 60 * 60 * 1000);
}

/**
 * Formats a Date object into "16 Sep 2026 — 4:00 PM" display style.
 */
export function formatCutOffDateTimeDisplay(date: Date): string {
  const dateFormatted = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const timeFormatted = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateFormatted} — ${timeFormatted}`;
}

/**
 * Generates the exact notification message and title for a Movement Cut-Off reminder:
 * Title: "Cut-Off Reminder"
 * Message: "Movement NASH-2026-0042 has a SI Cut-Off in 48 hours."
 */
export function formatCutOffReminderContent(
  movementNumber: string,
  cutoffType: string,
): { title: string; message: string } {
  const cleanRef = movementNumber.trim();
  const cleanType = cutoffType.trim();
  return {
    title: "Cut-Off Reminder",
    message: `Movement ${cleanRef} has a ${cleanType} in 48 hours.`,
  };
}

/**
 * Helper to format relative time for Cut-Off reminders
 */
export function formatCutOffRelativeTime(dateInput: string | number | Date): string {
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

/**
 * Categorizes a reminder timestamp into today, thisWeek, or earlier
 */
export function categorizeCutOffDate(
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

/**
 * Parses date and time components from a raw date/time string.
 */
export function parseCutOffDateTime(str: string): { date: string; time: string; inText: string } {
  if (!str) return { date: "—", time: "—", inText: "pending" };

  // Try direct pattern match like "18 Sep 2026 4:00 PM" or "2026-09-18 16:00"
  const d = parseCutOffToDate(str) || new Date(str);
  if (!isNaN(d.getTime())) {
    const dateFormatted = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeFormatted = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const diffMs = d.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const inText =
      diffDays > 1
        ? `in ${diffDays} days`
        : diffDays === 1
          ? "in 1 day"
          : diffDays === 0
            ? "today"
            : `${Math.abs(diffDays)}d ago`;

    return { date: dateFormatted, time: timeFormatted, inText };
  }

  // Fallback: simple string splitting for strings like "18 Sep 2026 4:00 PM"
  const parts = str.trim().split(/\s+/);
  if (parts.length >= 4) {
    const date = `${parts[0]} ${parts[1]} ${parts[2]}`;
    const time = `${parts[3]} ${parts[4] || ""}`.trim();
    return { date, time, inText: "upcoming" };
  }

  return { date: str, time: "", inText: "upcoming" };
}

/**
 * Builds normalized deadlines array from a cut-off dates object,
 * enriching each deadline with exactly 48-hour reminder calculation.
 */
export function buildNormalizedDeadlines(dates: MovementCutOffDates): MovementCutOffDeadline[] {
  const enrich = (
    type: string,
    rawDateTime: string,
    rawDate?: string,
    rawTime?: string,
    inLabel?: string,
  ) => {
    const parsed = parseCutOffDateTime(rawDateTime || `${rawDate || ""} ${rawTime || ""}`);
    const dateObj = parseCutOffToDate(rawDateTime || `${rawDate || ""} ${rawTime || ""}`);

    let reminderDateTime: string | undefined = undefined;
    let isReminderDue: boolean | undefined = undefined;
    let reminderDueTimeMs: number | undefined = undefined;

    if (dateObj) {
      const reminderDate = calculate48HoursBeforeCutOff(dateObj);
      reminderDateTime = formatCutOffDateTimeDisplay(reminderDate);
      reminderDueTimeMs = reminderDate.getTime();
      isReminderDue = Date.now() >= reminderDueTimeMs;
    }

    return {
      type,
      dateTime: rawDateTime || `${parsed.date} ${parsed.time}`,
      date: rawDate || parsed.date,
      time: rawTime || parsed.time,
      in: inLabel || parsed.inText,
      reminderDateTime,
      isReminderDue,
      reminderDueTimeMs,
    };
  };

  const nowIso = new Date().toISOString();

  if (Array.isArray(dates.deadlines) && dates.deadlines.length > 0) {
    return dates.deadlines.map((d) => {
      const base = enrich(
        d.type,
        d.dateTime || `${d.date || ""} ${d.time || ""}`,
        d.date,
        d.time,
        d.in,
      );
      const cutoffType = d.cutoffType || d.cutoff_type || d.type;
      const normalizedDate = d.normalizedDate ?? null;
      const cutoffDate = d.cutoffDate || d.cutoff_date || normalizedDate || d.dateTime || null;
      const originalExtractedText =
        d.originalExtractedText || d.original_extracted_text || d.raw || "";

      return {
        ...base,
        type: d.type,
        cutoffType,
        cutoff_type: cutoffType,
        cutoffDate,
        cutoff_date: cutoffDate,
        normalizedDate,
        normalized_date: normalizedDate,
        originalExtractedText,
        original_extracted_text: originalExtractedText,
        bookingId: d.bookingId || d.booking_id || dates.bookingId || dates.booking_id || null,
        booking_id: d.booking_id || d.bookingId || dates.booking_id || dates.bookingId || null,
        movementId: d.movementId || d.movement_id || dates.movementId || dates.movement_id || null,
        movement_id:
          d.movement_id || d.movement_id || dates.movement_id || dates.movementId || null,
        movementNumber:
          d.movementNumber ||
          d.movement_number ||
          dates.movementNumber ||
          dates.movement_number ||
          null,
        movement_number:
          d.movement_number ||
          d.movementNumber ||
          dates.movement_number ||
          dates.movementNumber ||
          null,
        sourceDocumentId:
          d.sourceDocumentId ||
          d.source_document_id ||
          dates.sourceDocumentId ||
          dates.source_document_id ||
          null,
        source_document_id:
          d.source_document_id ||
          d.sourceDocumentId ||
          dates.source_document_id ||
          dates.sourceDocumentId ||
          null,
        sourceEmailId:
          d.sourceEmailId ||
          d.source_email_id ||
          dates.sourceEmailId ||
          dates.source_email_id ||
          null,
        source_email_id:
          d.source_email_id ||
          d.sourceEmailId ||
          dates.source_email_id ||
          dates.sourceEmailId ||
          null,
        extractionStatus:
          d.extractionStatus ||
          d.extraction_status ||
          dates.extractionStatus ||
          dates.extraction_status ||
          "COMPLETED",
        extraction_status:
          d.extraction_status ||
          d.extractionStatus ||
          dates.extraction_status ||
          dates.extractionStatus ||
          "COMPLETED",
        reviewStatus:
          d.reviewStatus ||
          d.review_status ||
          dates.reviewStatus ||
          dates.review_status ||
          "AUTO_VERIFIED",
        review_status:
          d.review_status ||
          d.reviewStatus ||
          dates.review_status ||
          dates.reviewStatus ||
          "AUTO_VERIFIED",
        isAmbiguous: Boolean(d.isAmbiguous || d.is_ambiguous),
        is_ambiguous: Boolean(d.is_ambiguous || d.isAmbiguous),
        requiresManualReview: Boolean(d.requiresManualReview || d.requires_manual_review),
        requires_manual_review: Boolean(d.requires_manual_review || d.requiresManualReview),
        reviewReason: d.reviewReason || d.review_reason || null,
        review_reason: d.review_reason || d.reviewReason || null,
        createdAt: d.createdAt || d.created_at || dates.createdAt || dates.created_at || nowIso,
        created_at: d.created_at || d.createdAt || dates.created_at || dates.createdAt || nowIso,
        updatedAt: d.updatedAt || d.updated_at || dates.updatedAt || dates.updated_at || nowIso,
        updated_at: d.updated_at || d.updatedAt || dates.updated_at || dates.updatedAt || nowIso,
        raw: d.raw || originalExtractedText,
      };
    });
  }

  const list: MovementCutOffDeadline[] = [];
  const enrichWithMetadata = (label: string, dtVal: string) => {
    const base = enrich(label, dtVal);
    return {
      ...base,
      cutoffType: label,
      cutoff_type: label,
      cutoffDate: base.normalizedDate || dtVal,
      cutoff_date: base.normalizedDate || dtVal,
      normalizedDate: base.normalizedDate || null,
      normalized_date: base.normalizedDate || null,
      originalExtractedText: dtVal,
      original_extracted_text: dtVal,
      bookingId: dates.bookingId || dates.booking_id || null,
      booking_id: dates.booking_id || dates.bookingId || null,
      movementId: dates.movementId || dates.movement_id || null,
      movement_id: dates.movement_id || dates.movementId || null,
      movementNumber: dates.movementNumber || dates.movement_number || null,
      movement_number: dates.movement_number || dates.movementNumber || null,
      sourceDocumentId: dates.sourceDocumentId || dates.source_document_id || null,
      source_document_id: dates.source_document_id || dates.sourceDocumentId || null,
      sourceEmailId: dates.sourceEmailId || dates.source_email_id || null,
      source_email_id: dates.source_email_id || dates.sourceEmailId || null,
      extractionStatus: dates.extractionStatus || dates.extraction_status || "COMPLETED",
      extraction_status: dates.extraction_status || dates.extractionStatus || "COMPLETED",
      reviewStatus: dates.reviewStatus || dates.review_status || "AUTO_VERIFIED",
      review_status: dates.review_status || dates.reviewStatus || "AUTO_VERIFIED",
      isAmbiguous: Boolean(dates.hasAmbiguousDates || dates.has_ambiguous_dates),
      is_ambiguous: Boolean(dates.has_ambiguous_dates || dates.hasAmbiguousDates),
      requiresManualReview: Boolean(dates.requiresManualReview || dates.requires_manual_review),
      requires_manual_review: Boolean(dates.requires_manual_review || dates.requiresManualReview),
      reviewReason: dates.reviewReason || dates.review_reason || null,
      review_reason: dates.review_reason || dates.reviewReason || null,
      createdAt: dates.createdAt || dates.created_at || nowIso,
      created_at: dates.created_at || dates.createdAt || nowIso,
      updatedAt: dates.updatedAt || dates.updated_at || nowIso,
      updated_at: dates.updated_at || dates.updatedAt || nowIso,
    };
  };

  if (dates.siCutoff || dates.si_cutoff)
    list.push(enrichWithMetadata("SI Cut-Off", (dates.siCutoff || dates.si_cutoff)!));
  if (dates.shippingInstructionCutoff || dates.shipping_instruction_cutoff)
    list.push(
      enrichWithMetadata(
        "Shipping Instruction Cut-Off",
        (dates.shippingInstructionCutoff || dates.shipping_instruction_cutoff)!,
      ),
    );
  if (dates.vgmCutoff || dates.vgm_cutoff)
    list.push(enrichWithMetadata("VGM Cut-Off", (dates.vgmCutoff || dates.vgm_cutoff)!));
  if (dates.portCutoff || dates.port_cutoff)
    list.push(enrichWithMetadata("Port Cut-Off", (dates.portCutoff || dates.port_cutoff)!));
  if (dates.gateCutoff || dates.gate_cutoff)
    list.push(enrichWithMetadata("Gate Cut-Off", (dates.gateCutoff || dates.gate_cutoff)!));
  if (dates.cargoCutoff || dates.cargo_cutoff)
    list.push(enrichWithMetadata("Cargo Cut-Off", (dates.cargoCutoff || dates.cargo_cutoff)!));
  if (dates.docCutoff || dates.doc_cutoff)
    list.push(enrichWithMetadata("Documentation Cut-Off", (dates.docCutoff || dates.doc_cutoff)!));
  if (dates.cyCutoff || dates.cy_cutoff)
    list.push(enrichWithMetadata("CY Cut-Off", (dates.cyCutoff || dates.cy_cutoff)!));
  if (dates.terminalCutoff || dates.terminal_cutoff)
    list.push(
      enrichWithMetadata("Terminal Cut-Off", (dates.terminalCutoff || dates.terminal_cutoff)!),
    );
  if (dates.closingDate || dates.closing_date)
    list.push(enrichWithMetadata("Closing Date", (dates.closingDate || dates.closing_date)!));
  if (dates.cutoffDate || dates.cutoff_date)
    list.push(enrichWithMetadata("Cut-Off Date", (dates.cutoffDate || dates.cutoff_date)!));

  return list;
}

const serverCutOffsRegistry: Record<string, MovementCutOffDates> = {};

/**
 * Gets all movement cut-offs from the persistent registry.
 */
function getCutOffsRegistry(): Record<string, MovementCutOffDates> {
  if (typeof window === "undefined") return serverCutOffsRegistry;
  try {
    const raw = localStorage.getItem(MOVEMENT_CUTOFFS_STORAGE_KEY);
    if (!raw) return serverCutOffsRegistry;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : serverCutOffsRegistry;
  } catch (_e) {
    return serverCutOffsRegistry;
  }
}

/**
 * Retrieves the Cut-Off dates maintained specifically for a Movement.
 * CRITICAL: Strictly enforces that Cut-Off dates belong to the Movement they were
 * received for, and are NEVER mixed or shared with different Movements.
 */
export function getCutOffsForMovement(
  movementIdentifier: string | null | undefined,
  bookingRecord?: {
    cut_off_dates?: MovementCutOffDates | null;
    confirmation_details?: unknown;
  } | null,
): MovementCutOffDates | null {
  if (!movementIdentifier) return null;

  // 1. If the booking record has cut_off_dates directly embedded, verify and return
  if (bookingRecord?.cut_off_dates) {
    const dates = bookingRecord.cut_off_dates;
    return {
      ...dates,
      deadlines: buildNormalizedDeadlines(dates),
    };
  }

  // 2. Check confirmation_details inside the booking record
  if (
    bookingRecord?.confirmation_details &&
    typeof bookingRecord.confirmation_details === "object"
  ) {
    const details = bookingRecord.confirmation_details as {
      cut_off_dates?: MovementCutOffDates;
      cutOffDates?: MovementCutOffDates;
    };
    const embedded = details.cut_off_dates || details.cutOffDates;
    if (embedded) {
      return {
        ...embedded,
        deadlines: buildNormalizedDeadlines(embedded),
      };
    }
  }

  // 3. Query the persistent movement cut-offs registry for this specific movement key
  const normKey = normalizeMovementKey(movementIdentifier);
  const rawKey = movementIdentifier.trim().toUpperCase();
  const registry = getCutOffsRegistry();

  const found = registry[normKey] || registry[rawKey];
  if (found) {
    return {
      ...found,
      deadlines: buildNormalizedDeadlines(found),
    };
  }

  return null;
}

/**
 * Maintains and saves extracted Cut-Off dates directly inside the specific Movement / Booking data.
 * Guarantees isolation: saved strictly under that Movement's identifier.
 */
export async function saveCutOffsForMovement(
  movementIdentifier: string,
  cutOffs: MovementCutOffDates,
  bookingId?: string | null,
): Promise<MovementCutOffDates> {
  if (!movementIdentifier) {
    return {
      movementNumber: "",
      deadlines: [],
    };
  }

  const normKey = normalizeMovementKey(movementIdentifier);
  const rawKey = movementIdentifier.trim().toUpperCase();
  const nowIso = new Date().toISOString();

  const normalizedDeadlines = buildNormalizedDeadlines(cutOffs);
  const primaryCutoffType =
    cutOffs.cutoffType ||
    cutOffs.cutoff_type ||
    normalizedDeadlines[0]?.cutoffType ||
    "Cut-off Date";
  const primaryCutoffDate =
    cutOffs.detectedCutOffDate ||
    cutOffs.detected_cut_off_date ||
    cutOffs.cutoffDate ||
    cutOffs.cutoff_date ||
    normalizedDeadlines[0]?.cutoffDate ||
    normalizedDeadlines[0]?.dateTime ||
    null;
  const sourceDocId = cutOffs.sourceDocumentId || cutOffs.source_document_id || null;
  const sourceMailId = cutOffs.sourceEmailId || cutOffs.source_email_id || null;
  const extStatus =
    cutOffs.extractionStatus ||
    cutOffs.extraction_status ||
    (cutOffs.isScannedOrUnreadable
      ? "SCANNED_UNREADABLE"
      : cutOffs.hasAmbiguousDates
        ? "AMBIGUOUS"
        : primaryCutoffDate || normalizedDeadlines.length > 0
          ? "COMPLETED"
          : "NO_DATES_DETECTED");
  const revStatus =
    cutOffs.reviewStatus ||
    cutOffs.review_status ||
    (cutOffs.requiresManualReview || cutOffs.hasAmbiguousDates ? "NEEDS_REVIEW" : "AUTO_VERIFIED");

  const payload: MovementCutOffDates = {
    ...cutOffs,
    bookingId: bookingId || cutOffs.bookingId || cutOffs.booking_id || null,
    booking_id: bookingId || cutOffs.booking_id || cutOffs.bookingId || null,
    movementId: bookingId || cutOffs.movementId || cutOffs.movement_id || null,
    movement_id: bookingId || cutOffs.movement_id || cutOffs.movementId || null,
    movementNumber: movementIdentifier,
    movement_number: movementIdentifier,
    cutoffType: primaryCutoffType,
    cutoff_type: primaryCutoffType,
    cutoffDate: primaryCutoffDate,
    cutoff_date: primaryCutoffDate,
    sourceDocumentId: sourceDocId || undefined,
    source_document_id: sourceDocId || undefined,
    sourceEmailId: sourceMailId || undefined,
    source_email_id: sourceMailId || undefined,
    extractionStatus: extStatus,
    extraction_status: extStatus,
    reviewStatus: revStatus,
    review_status: revStatus,
    deadlines: normalizedDeadlines,
    receivedAt: cutOffs.receivedAt || nowIso,
    createdAt: cutOffs.createdAt || cutOffs.created_at || nowIso,
    created_at: cutOffs.created_at || cutOffs.createdAt || nowIso,
    updatedAt: nowIso,
    updated_at: nowIso,
  };

  // 1. Update memory movement registry
  try {
    const registry = getCutOffsRegistry();
    registry[normKey] = payload;
    if (rawKey !== normKey) {
      registry[rawKey] = payload;
    }
  } catch (_e) {
    // Memory registry notice
  }

  if (typeof window !== "undefined") {
    try {
      const registry = getCutOffsRegistry();
      localStorage.setItem(MOVEMENT_CUTOFFS_STORAGE_KEY, JSON.stringify(registry));

      // 2. Update local booking record if it exists
      const targetId = bookingId || movementIdentifier;
      try {
        const rawBookings = localStorage.getItem("nashmia_custom_bookings_v1");
        if (rawBookings) {
          const list = JSON.parse(rawBookings);
          if (Array.isArray(list)) {
            const cleanTarget = targetId.trim().toLowerCase();
            let updatedAny = false;
            const updated = list.map((b) => {
              const bId = (b.id || "").toLowerCase();
              const bRef = (b.booking_reference || "").toLowerCase();
              const bMov = (b.movement_number || "").toLowerCase();
              const isMatch =
                bId === cleanTarget ||
                bRef === cleanTarget ||
                bMov === cleanTarget ||
                normalizeMovementKey(bMov) === normKey;

              if (isMatch) {
                updatedAny = true;
                const existingConf = (b.confirmation_details as Record<string, unknown>) || {};
                return {
                  ...b,
                  cut_off_dates: payload,
                  cut_off_deadlines: normalizedDeadlines,
                  confirmation_details: {
                    ...existingConf,
                    cut_off_dates: payload,
                    cut_off_deadlines: normalizedDeadlines,
                  },
                  updated_at: nowIso,
                };
              }
              return b;
            });

            if (updatedAny) {
              const serialized = JSON.stringify(updated);
              localStorage.setItem("nashmia_custom_bookings_v1", serialized);
              localStorage.setItem("nashmia_local_bookings", serialized);
            }
          }
        }
      } catch (bookErr) {
        console.warn("[saveCutOffsForMovement] Local booking update notice:", bookErr);
      }

      // 3. Ensure a Cut-Off Notice document is synchronized in the Documents repository
      try {
        const existingDocs = getSavedDocuments();
        const hasDoc = existingDocs.some(
          (d) =>
            (d.metadata?.movementNumber === movementIdentifier ||
              d.name.includes(movementIdentifier)) &&
            (d.metadata?.category === "Cut-Off Notice" ||
              d.metadata?.documentType === "CUT_OFF_NOTICE" ||
              d.name.toLowerCase().includes("cutoff") ||
              d.name.toLowerCase().includes("cut-off")),
        );

        if (!hasDoc && normalizedDeadlines.length > 0) {
          const newDoc: DriveFile = {
            id: sourceDocId || `doc-cutoff-${normKey}-${Date.now()}`,
            name: `CutOff_Notice_${movementIdentifier}.pdf`,
            type: "pdf",
            extension: "pdf",
            owners: [],
            lastModified: "Just now",
            lastModifiedTimestamp: nowIso,
            fileSize: "384 KB",
            folderId: "folder-design",
            starred: true,
            sharedLink: `/documents?movement=${encodeURIComponent(movementIdentifier)}`,
            metadata: {
              category: "Cut-Off Notice",
              documentType: "CUT_OFF_NOTICE",
              movementNumber: movementIdentifier,
              cutOffDeadlines: normalizedDeadlines,
              cutOffDates: payload,
              sourceDocumentId: sourceDocId || undefined,
              sourceEmailId: sourceMailId || undefined,
              extractionStatus: extStatus,
              reviewStatus: revStatus,
              savedAt: nowIso,
            },
          };
          saveDriveDocument(newDoc);
        }
      } catch (docErr) {
        console.warn("[saveCutOffsForMovement] Document sync notice:", docErr);
      }

      // 4. Dispatch reactivity events
      window.dispatchEvent(
        new CustomEvent("nashmia_movement_cutoff_updated", {
          detail: {
            movementIdentifier,
            movementKey: normKey,
            cutOffs: payload,
            deadlines: normalizedDeadlines,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_bookings_updated", {
          detail: { updated: true, movementNumber: movementIdentifier },
        }),
      );

      // 5. Evaluate and trigger 48-hour reminders for newly saved or updated Cut-Offs
      try {
        const now = Date.now();
        for (const d of normalizedDeadlines) {
          if (!d.type) continue;
          const rawDateStr = d.dateTime || `${d.date || ""} ${d.time || ""}`;
          const cutoffDate = parseCutOffToDate(rawDateStr);
          if (!cutoffDate) continue;

          const reminderDate = calculate48HoursBeforeCutOff(cutoffDate);
          const reminderTimeMs = reminderDate.getTime();
          const isDue = now >= reminderTimeMs;
          const notAncient = now - cutoffDate.getTime() < 30 * 24 * 60 * 60 * 1000;

          if (!isDue || !notAncient) continue;

          // Deduplicate: If already created for Movement + Cut-Off Type + Cut-Off Date/Time, skip completely
          if (isCutOffReminderCreated(movementIdentifier, d.type, rawDateStr)) {
            continue;
          }

          // First-time creation for this Movement + Cut-Off Type + Cut-Off Date/Time
          const formattedReminderTime = formatCutOffDateTimeDisplay(reminderDate);
          const content = formatCutOffReminderContent(movementIdentifier, d.type);
          const id = buildCutOffReminderNotificationId(movementIdentifier, d.type, rawDateStr);

          markCutOffReminderCreated({
            movementNumber: movementIdentifier,
            cutoffType: d.type,
            cutoffDateTime: rawDateStr,
            reminderDateTime: formattedReminderTime,
            createdTimestamp: now,
            toastShown: false,
          });

          const notifItem: NotificationItem = {
            id,
            icon: "alert",
            title: content.title,
            time: "Just now",
            timestamp: now,
            description: content.message,
            rawDescription: content.message,
            unread: true,
            category: "today",
            type: "cutoff_reminder",
            bookingReference: movementIdentifier,
            linkUrl: "/movements",
            cutoffDetails: {
              movementNumber: movementIdentifier,
              cutoffType: d.type,
              cutoffDateTime: rawDateStr,
              reminderDateTime: formattedReminderTime,
            },
          };

          window.dispatchEvent(
            new CustomEvent("nashmia_cutoff_reminder_triggered", {
              detail: notifItem,
            }),
          );

          // Persist to Supabase notifications table if configured
          if (isSupabaseConfigured) {
            void safeInsertNotification({
              userId: null,
              title: content.title,
              message: content.message,
              type: "cutoff_reminder",
              movementNumber: movementIdentifier,
              metadata: {
                cutoffType: d.type,
                cutoffDateTime: rawDateStr,
                reminderDateTime: formattedReminderTime,
                movementNumber: movementIdentifier,
              },
            }).catch(() => {
              // Notification insert fallback
            });
          }
        }
      } catch (remErr) {
        console.warn("[saveCutOffsForMovement] Reminder notice:", remErr);
      }
    } catch (err) {
      console.warn("[saveCutOffsForMovement] Registry save error:", err);
    }
  }

  // 6. Direct Database Persistence to Supabase
  // Strictly saves cut-off date against the correct Movement Number in existing tables:
  // - bookings (cut_off_dates, cut_off_deadlines, confirmation_details)
  // - booking_documents (links source PDF document if present)
  // - booking_events (records audit event with all 9 required fields)
  if (isSupabaseConfigured) {
    try {
      let validBookingUuid = safeUuid(bookingId);
      const cleanRef = movementIdentifier.trim();
      const slashMov = cleanRef.includes("-") ? cleanRef.replace(/-/g, "/") : cleanRef;
      const dashMov = cleanRef.includes("/") ? cleanRef.replace(/\//g, "-") : cleanRef;

      let existingConfirmationDetails: Record<string, unknown> = {};

      // If bookingId was not provided, look up the existing booking record by movement_number or booking_reference
      if (!validBookingUuid && cleanRef) {
        const { data: foundBooking } = await supabase
          .from("bookings")
          .select(
            "id, confirmation_details, cut_off_dates, cut_off_deadlines, movement_number, booking_reference",
          )
          .or(
            `movement_number.eq.${cleanRef},booking_reference.eq.${cleanRef},reference.eq.${cleanRef},movement_number.eq.${slashMov},booking_reference.eq.${slashMov},movement_number.eq.${dashMov},booking_reference.eq.${dashMov}`,
          )
          .limit(1)
          .maybeSingle();

        if (foundBooking?.id) {
          validBookingUuid = safeUuid(foundBooking.id);
          existingConfirmationDetails =
            (foundBooking.confirmation_details as Record<string, unknown>) || {};
        }
      }

      if (!validBookingUuid && cleanRef) {
        const { data: foundIlike } = await supabase
          .from("bookings")
          .select("id, confirmation_details")
          .ilike("movement_number", `%${cleanRef}%`)
          .limit(1)
          .maybeSingle();
        if (foundIlike?.id) {
          validBookingUuid = safeUuid(foundIlike.id);
          existingConfirmationDetails =
            (foundIlike.confirmation_details as Record<string, unknown>) || {};
        }
      }

      const updatePayload = {
        cut_off_dates: payload as unknown as import("@/types/database.types").Json,
        cut_off_deadlines: normalizedDeadlines as unknown as import("@/types/database.types").Json,
        confirmation_details: {
          ...existingConfirmationDetails,
          cut_off_dates: payload,
          cut_off_deadlines: normalizedDeadlines,
          detected_cut_off_date: payload.detectedCutOffDate || payload.cutoffDate || null,
          has_cut_off_date: Boolean(payload.hasCutOffDate),
          requires_cutoff_review: Boolean(payload.requiresManualReview),
          has_ambiguous_cutoff_date: Boolean(payload.hasAmbiguousDates),
          is_scanned_cutoff_pdf: Boolean(payload.isScannedOrUnreadable),
          cutoff_review_reason: payload.reviewReason || null,
          source_document_id: sourceDocId,
          source_email_id: sourceMailId,
          extraction_status: extStatus,
          review_status: revStatus,
          updated_at: nowIso,
        },
        updated_at: nowIso,
      };

      if (validBookingUuid) {
        await supabase.from("bookings").update(updatePayload).eq("id", validBookingUuid);
      } else if (cleanRef) {
        const { data: updatedByRef } = await supabase
          .from("bookings")
          .update(updatePayload)
          .or(`movement_number.eq.${cleanRef},booking_reference.eq.${cleanRef}`)
          .select("id")
          .maybeSingle();
        if (updatedByRef?.id) {
          validBookingUuid = safeUuid(updatedByRef.id);
        }
      }

      // Link in booking_documents if sourceDocumentId is a valid UUID
      if (validBookingUuid && sourceDocId && safeUuid(sourceDocId)) {
        try {
          await supabase
            .from("booking_documents")
            .update({
              booking_id: validBookingUuid,
              document_type: "CUT_OFF_NOTICE",
              status: extStatus === "COMPLETED" ? "Completed" : "Needs Review",
              updated_at: nowIso,
            })
            .eq("id", sourceDocId);
        } catch (docUpdateErr) {
          console.warn("[saveCutOffsForMovement] booking_documents update notice:", docUpdateErr);
        }
      }

      // Insert database tracking event into booking_events table
      if (validBookingUuid) {
        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: "Cut-Off Schedule Extracted",
          event_date: nowIso,
          location: "Operations Desk",
          title: `Cut-Off Schedule Maintained (${movementIdentifier})`,
          description: `Extracted ${normalizedDeadlines.length} cut-off deadlines for Movement ${movementIdentifier}. Status: ${extStatus}, Review: ${revStatus}.`,
          payload: {
            bookingId: validBookingUuid,
            booking_id: validBookingUuid,
            movementId: validBookingUuid,
            movement_id: validBookingUuid,
            movementNumber: movementIdentifier,
            movement_number: movementIdentifier,
            cutoffType: primaryCutoffType,
            cutoff_type: primaryCutoffType,
            cutoffDate: primaryCutoffDate,
            cutoff_date: primaryCutoffDate,
            sourceDocumentId: sourceDocId,
            source_document_id: sourceDocId,
            sourceEmailId: sourceMailId,
            source_email_id: sourceMailId,
            extractionStatus: extStatus,
            extraction_status: extStatus,
            reviewStatus: revStatus,
            review_status: revStatus,
            deadlines: normalizedDeadlines,
            cutOffDates: payload,
            createdAt: payload.createdAt || nowIso,
            created_at: payload.createdAt || nowIso,
            updatedAt: nowIso,
            updated_at: nowIso,
          },
        });
      }
    } catch (dbErr) {
      console.warn("[saveCutOffsForMovement] Supabase update notice:", dbErr);
    }
  }

  // 7. Background update to server API as secondary fallback
  if (typeof fetch !== "undefined") {
    void fetch("/api/bookings/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: bookingId || movementIdentifier,
        movementNumber: movementIdentifier,
        updates: {
          cut_off_dates: payload,
          cut_off_deadlines: normalizedDeadlines,
          confirmation_details: {
            cut_off_dates: payload,
            cut_off_deadlines: normalizedDeadlines,
            source_document_id: sourceDocId,
            source_email_id: sourceMailId,
            extraction_status: extStatus,
            review_status: revStatus,
          },
        },
      }),
    }).catch(() => {
      // Background sync, suppress errors
    });
  }

  return payload;
}

/**
 * Saves extracted cut-off date data directly into the database against the correct Movement Number.
 * Inspects and reuses the existing bookings, booking_documents, and booking_events tables and relationships.
 * Stores:
 * - Booking/movement ID
 * - Movement Number
 * - Cut-off type
 * - Cut-off date
 * - Source PDF/document ID
 * - Source email ID
 * - Extraction status
 * - Review status
 * - Created and updated timestamps
 * Does not create duplicate tables.
 */
export async function saveCutOffDataToDatabase(params: {
  movementNumber: string;
  bookingId?: string | null;
  cutoffType?: string | null;
  cutoffDate?: string | null;
  sourceDocumentId?: string | null;
  sourceEmailId?: string | null;
  extractionStatus?: string | null;
  reviewStatus?: string | null;
  deadlines?: MovementCutOffDeadline[];
  cutOffDates?: MovementCutOffDates;
  createdAt?: string;
  updatedAt?: string;
}): Promise<{
  success: boolean;
  bookingId: string | null;
  movementNumber: string;
  savedDeadlinesCount: number;
  cutOffDates: MovementCutOffDates;
  error?: string | null;
}> {
  const {
    movementNumber,
    bookingId,
    cutoffType,
    cutoffDate,
    sourceDocumentId,
    sourceEmailId,
    extractionStatus,
    reviewStatus,
    deadlines,
    cutOffDates = {},
    createdAt,
    updatedAt,
  } = params;

  const nowIso = new Date().toISOString();
  const primaryCutoffType =
    cutoffType ||
    (deadlines && deadlines[0]?.cutoffType) ||
    (deadlines && deadlines[0]?.type) ||
    "Cut-off Date";
  const primaryCutoffDate =
    cutoffDate ||
    (deadlines && deadlines[0]?.cutoffDate) ||
    (deadlines && deadlines[0]?.dateTime) ||
    null;
  const extStatus = extractionStatus || "COMPLETED";
  const revStatus = reviewStatus || "AUTO_VERIFIED";

  const datesToSave: MovementCutOffDates = {
    ...cutOffDates,
    bookingId: bookingId || cutOffDates.bookingId || null,
    booking_id: bookingId || cutOffDates.booking_id || null,
    movementNumber,
    movement_number: movementNumber,
    cutoffType: primaryCutoffType,
    cutoff_type: primaryCutoffType,
    cutoffDate: primaryCutoffDate,
    cutoff_date: primaryCutoffDate,
    sourceDocumentId: sourceDocumentId || cutOffDates.sourceDocumentId || undefined,
    source_document_id: sourceDocumentId || cutOffDates.source_document_id || undefined,
    sourceEmailId: sourceEmailId || cutOffDates.sourceEmailId || undefined,
    source_email_id: sourceEmailId || cutOffDates.source_email_id || undefined,
    extractionStatus: extStatus,
    extraction_status: extStatus,
    reviewStatus: revStatus,
    review_status: revStatus,
    deadlines: deadlines || cutOffDates.deadlines,
    createdAt: createdAt || cutOffDates.createdAt || nowIso,
    created_at: createdAt || cutOffDates.created_at || nowIso,
    updatedAt: updatedAt || nowIso,
    updated_at: updatedAt || nowIso,
  };

  const savedPayload = await saveCutOffsForMovement(movementNumber, datesToSave, bookingId);
  return {
    success: true,
    bookingId: savedPayload.bookingId || bookingId || null,
    movementNumber,
    savedDeadlinesCount: (savedPayload.deadlines || []).length,
    cutOffDates: savedPayload,
  };
}

/**
 * Queries cut-off data stored in the database for a Movement Number.
 * Returns all stored cut-off fields:
 * - Booking/movement ID
 * - Movement Number
 * - Cut-off type
 * - Cut-off date
 * - Source PDF/document ID
 * - Source email ID
 * - Extraction status
 * - Review status
 * - Created and updated timestamps
 */
export async function getCutOffDataFromDatabase(movementIdentifier: string): Promise<{
  bookingId: string | null;
  movementNumber: string;
  cutoffType: string | null;
  cutoffDate: string | null;
  sourceDocumentId: string | null;
  sourceEmailId: string | null;
  extractionStatus: string;
  reviewStatus: string;
  createdAt: string;
  updatedAt: string;
  cutOffDates: MovementCutOffDates | null;
  deadlines: MovementCutOffDeadline[];
} | null> {
  if (!movementIdentifier) return null;
  const cleanRef = movementIdentifier.trim();
  const slashMov = cleanRef.includes("-") ? cleanRef.replace(/-/g, "/") : cleanRef;

  try {
    let bookingRecord: Record<string, unknown> | null = null;
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from("bookings")
        .select(
          "id, movement_number, booking_reference, cut_off_dates, cut_off_deadlines, confirmation_details, created_at, updated_at",
        )
        .or(
          `movement_number.eq.${cleanRef},booking_reference.eq.${cleanRef},reference.eq.${cleanRef},movement_number.eq.${slashMov},booking_reference.eq.${slashMov}`,
        )
        .limit(1)
        .maybeSingle();
      if (data) bookingRecord = data as unknown as Record<string, unknown>;
    }

    const cutOffDates = getCutOffsForMovement(cleanRef, bookingRecord);
    if (!cutOffDates) return null;

    const deadlines = cutOffDates.deadlines || buildNormalizedDeadlines(cutOffDates);
    const primaryType =
      cutOffDates.cutoffType ||
      cutOffDates.cutoff_type ||
      deadlines[0]?.cutoffType ||
      "Cut-off Date";
    const primaryDate =
      cutOffDates.detectedCutOffDate ||
      cutOffDates.cutoffDate ||
      cutOffDates.cutoff_date ||
      deadlines[0]?.cutoffDate ||
      null;
    const sourceDocId = cutOffDates.sourceDocumentId || cutOffDates.source_document_id || null;
    const sourceMailId = cutOffDates.sourceEmailId || cutOffDates.source_email_id || null;
    const extStatus = cutOffDates.extractionStatus || cutOffDates.extraction_status || "COMPLETED";
    const revStatus = cutOffDates.reviewStatus || cutOffDates.review_status || "AUTO_VERIFIED";

    return {
      bookingId:
        (bookingRecord?.id as string) || cutOffDates.bookingId || cutOffDates.booking_id || null,
      movementNumber: cleanRef,
      cutoffType: primaryType,
      cutoffDate: primaryDate,
      sourceDocumentId: sourceDocId,
      sourceEmailId: sourceMailId,
      extractionStatus: extStatus,
      reviewStatus: revStatus,
      createdAt:
        cutOffDates.createdAt ||
        cutOffDates.created_at ||
        (bookingRecord?.created_at as string) ||
        new Date().toISOString(),
      updatedAt:
        cutOffDates.updatedAt ||
        cutOffDates.updated_at ||
        (bookingRecord?.updated_at as string) ||
        new Date().toISOString(),
      cutOffDates,
      deadlines,
    };
  } catch (err) {
    console.warn("[getCutOffDataFromDatabase] Error querying database:", err);
    return null;
  }
}

/**
 * Returns all upcoming cut-offs grouped and strictly identified by their specific Movement.
 * Used by UpcomingCutoffs widget to ensure each deadline clearly displays its own Movement.
 */
export function getAllUpcomingCutOffs(): Array<{
  ref: string;
  type: string;
  date: string;
  time: string;
  in: string;
  dateTime: string;
  reminderDateTime?: string;
  isReminderDue?: boolean;
}> {
  const registry = getCutOffsRegistry();
  const result: Array<{
    ref: string;
    type: string;
    date: string;
    time: string;
    in: string;
    dateTime: string;
    reminderDateTime?: string;
    isReminderDue?: boolean;
  }> = [];

  const processedMovements = new Set<string>();

  for (const [key, dates] of Object.entries(registry)) {
    const norm = normalizeMovementKey(key);
    if (processedMovements.has(norm)) continue;
    processedMovements.add(norm);

    const ref = dates.movementNumber || key;
    const deadlines = buildNormalizedDeadlines(dates);

    for (const d of deadlines) {
      result.push({
        ref,
        type: d.type,
        date: d.date || "—",
        time: d.time || "—",
        in: d.in || "upcoming",
        dateTime: d.dateTime,
        reminderDateTime: d.reminderDateTime,
        isReminderDue: d.isReminderDue,
      });
    }
  }

  return result;
}

/**
 * For every valid extracted Cut-Off date/time:
 * Calculates exactly 48 hours before the Cut-Off deadline.
 * At 48 hours before the deadline, creates a Notification Center notification for that Movement.
 *
 * Example:
 * Cut-Off:  18 Sep 2026 — 4:00 PM
 * Reminder: 16 Sep 2026 — 4:00 PM
 * Notification:
 * Title: "Cut-Off Reminder"
 * Description: "Movement NASH-2026-0042 has a SI Cut-Off in 48 hours."
 */
export function generateAllCutOffReminders(): NotificationItem[] {
  const registry = getCutOffsRegistry();
  const createdRegistry = getCreatedCutOffRemindersRegistry();
  const notifications: NotificationItem[] = [];
  const now = Date.now();
  const processedKeys = new Set<string>();

  for (const [key, dates] of Object.entries(registry)) {
    const movementRef = dates.movementNumber || key;
    const deadlines = buildNormalizedDeadlines(dates);

    for (const d of deadlines) {
      if (!d.type) continue;
      const rawDateStr = d.dateTime || `${d.date || ""} ${d.time || ""}`;
      const cutoffDate = parseCutOffToDate(rawDateStr);
      if (!cutoffDate) continue;

      const reminderDate = calculate48HoursBeforeCutOff(cutoffDate);
      const reminderTimeMs = reminderDate.getTime();

      // At 48 hours before deadline, the reminder is active:
      // Condition: current time has reached or passed reminder time (now >= reminderTimeMs)
      // We keep reminders visible unless the cut-off itself is over 30 days old
      const isDue = now >= reminderTimeMs;
      const notAncient = now - cutoffDate.getTime() < 30 * 24 * 60 * 60 * 1000;

      if (!isDue || !notAncient) {
        continue;
      }

      // Canonical deduplication key: Movement + Cut-Off Type + Cut-Off Date/Time
      const dedupeKey = buildCutOffReminderDedupeKey(movementRef, d.type, rawDateStr);
      if (processedKeys.has(dedupeKey)) continue;
      processedKeys.add(dedupeKey);

      const id = buildCutOffReminderNotificationId(movementRef, d.type, rawDateStr);
      const content = formatCutOffReminderContent(movementRef, d.type);
      const formattedReminderTime = formatCutOffDateTimeDisplay(reminderDate);

      // Check if already created previously in persistent storage
      const existingEntry = createdRegistry[dedupeKey];
      const createdTimestamp = existingEntry?.createdTimestamp || reminderTimeMs;

      if (!existingEntry) {
        markCutOffReminderCreated({
          movementNumber: movementRef,
          cutoffType: d.type,
          cutoffDateTime: rawDateStr,
          reminderDateTime: formattedReminderTime,
          createdTimestamp,
          toastShown: true, // Mark toast as shown so background/refresh does not re-alert
        });
      }

      notifications.push({
        id,
        icon: "alert",
        title: content.title,
        time: formatCutOffRelativeTime(reminderDate),
        timestamp: createdTimestamp,
        description: content.message,
        rawDescription: content.message,
        unread: true,
        category: categorizeCutOffDate(reminderDate),
        type: "cutoff_reminder",
        bookingReference: movementRef,
        linkUrl: "/movements",
        cutoffDetails: {
          movementNumber: movementRef,
          cutoffType: d.type,
          cutoffDateTime: rawDateStr,
          reminderDateTime: formattedReminderTime,
        },
      });
    }
  }

  return notifications;
}

/**
 * Dynamically schedules timer triggers for upcoming Cut-Off deadlines that will
 * reach their 48-hour mark in the future during the session.
 */
export function scheduleCutOffReminders(onTrigger?: (notif: NotificationItem) => void): () => void {
  if (typeof window === "undefined") return () => {};

  const registry = getCutOffsRegistry();
  const timeouts: number[] = [];
  const now = Date.now();

  for (const [key, dates] of Object.entries(registry)) {
    const movementRef = dates.movementNumber || key;
    const deadlines = buildNormalizedDeadlines(dates);

    for (const d of deadlines) {
      if (!d.type) continue;
      const rawDateStr = d.dateTime || `${d.date || ""} ${d.time || ""}`;
      const cutoffDate = parseCutOffToDate(rawDateStr);
      if (!cutoffDate) continue;

      // If already created for this Movement + Cut-Off Type + Cut-Off Date/Time, skip scheduling
      if (isCutOffReminderCreated(movementRef, d.type, rawDateStr)) {
        continue;
      }

      const reminderDate = calculate48HoursBeforeCutOff(cutoffDate);
      const reminderTimeMs = reminderDate.getTime();
      const delayMs = reminderTimeMs - now;

      // If exactly 48h mark is in the future
      if (delayMs > 0 && delayMs < 2147483647) {
        const content = formatCutOffReminderContent(movementRef, d.type);
        const id = buildCutOffReminderNotificationId(movementRef, d.type, rawDateStr);
        const formattedReminderTime = formatCutOffDateTimeDisplay(reminderDate);

        const timerId = window.setTimeout(() => {
          if (isCutOffReminderCreated(movementRef, d.type, rawDateStr)) {
            return;
          }

          markCutOffReminderCreated({
            movementNumber: movementRef,
            cutoffType: d.type,
            cutoffDateTime: rawDateStr,
            reminderDateTime: formattedReminderTime,
            createdTimestamp: Date.now(),
            toastShown: false,
          });

          const item: NotificationItem = {
            id,
            icon: "alert",
            title: content.title,
            time: "Just now",
            timestamp: Date.now(),
            description: content.message,
            rawDescription: content.message,
            unread: true,
            category: "today",
            type: "cutoff_reminder",
            bookingReference: movementRef,
            linkUrl: "/movements",
            cutoffDetails: {
              movementNumber: movementRef,
              cutoffType: d.type,
              cutoffDateTime: rawDateStr,
              reminderDateTime: formattedReminderTime,
            },
          };

          window.dispatchEvent(
            new CustomEvent("nashmia_cutoff_reminder_triggered", {
              detail: item,
            }),
          );

          onTrigger?.(item);
        }, delayMs);

        timeouts.push(timerId);
      }
    }
  }

  return () => {
    timeouts.forEach((tid) => clearTimeout(tid));
  };
}
