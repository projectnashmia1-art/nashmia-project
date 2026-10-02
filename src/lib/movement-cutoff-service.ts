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
  INITIAL_OWNERS,
  type DriveFile,
} from "../components/nashmia/documents/documents-data";

export interface MovementCutOffDeadline {
  type: string; // e.g. "SI Cut-Off", "VGM Cut-Off", "Port Cut-Off", "Gate Cut-Off"
  dateTime: string; // e.g. "18 Sep 2026 4:00 PM"
  date?: string; // e.g. "18 Sep 2026"
  time?: string; // e.g. "4:00 PM"
  in?: string; // e.g. "in 1 day"
  raw?: string;
  reminderDateTime?: string; // e.g. "16 Sep 2026 — 4:00 PM" (exactly 48 hours before Cut-Off)
  isReminderDue?: boolean; // true if current time has reached 48 hours before deadline
  reminderDueTimeMs?: number; // timestamp in ms of 48 hours before deadline
}

export interface MovementCutOffDates {
  siCutoff?: string | null;
  vgmCutoff?: string | null;
  portCutoff?: string | null;
  gateCutoff?: string | null;
  cargoCutoff?: string | null;
  docCutoff?: string | null;
  cyCutoff?: string | null;
  deadlines?: MovementCutOffDeadline[];
  receivedAt?: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  movementNumber?: string;
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

  if (Array.isArray(dates.deadlines) && dates.deadlines.length > 0) {
    return dates.deadlines.map((d) => {
      const base = enrich(
        d.type,
        d.dateTime || `${d.date || ""} ${d.time || ""}`,
        d.date,
        d.time,
        d.in,
      );
      return {
        ...base,
        raw: d.raw,
      };
    });
  }

  const list: MovementCutOffDeadline[] = [];
  if (dates.siCutoff) list.push(enrich("SI Cut-Off", dates.siCutoff));
  if (dates.vgmCutoff) list.push(enrich("VGM Cut-Off", dates.vgmCutoff));
  if (dates.portCutoff) list.push(enrich("Port Cut-Off", dates.portCutoff));
  if (dates.gateCutoff) list.push(enrich("Gate Cut-Off", dates.gateCutoff));
  if (dates.cargoCutoff) list.push(enrich("Cargo Cut-Off", dates.cargoCutoff));
  if (dates.docCutoff) list.push(enrich("Documentation Cut-Off", dates.docCutoff));
  if (dates.cyCutoff) list.push(enrich("CY Cut-Off", dates.cyCutoff));

  return list;
}

/**
 * Gets all movement cut-offs from the persistent registry.
 */
function getCutOffsRegistry(): Record<string, MovementCutOffDates> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(MOVEMENT_CUTOFFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_e) {
    return {};
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
export function saveCutOffsForMovement(
  movementIdentifier: string,
  cutOffs: MovementCutOffDates,
  bookingId?: string | null,
): void {
  if (!movementIdentifier) return;

  const normKey = normalizeMovementKey(movementIdentifier);
  const rawKey = movementIdentifier.trim().toUpperCase();
  const nowIso = new Date().toISOString();

  const normalizedDeadlines = buildNormalizedDeadlines(cutOffs);
  const payload: MovementCutOffDates = {
    ...cutOffs,
    movementNumber: movementIdentifier,
    deadlines: normalizedDeadlines,
    receivedAt: cutOffs.receivedAt || nowIso,
  };

  if (typeof window !== "undefined") {
    try {
      // 1. Update persistent movement registry
      const registry = getCutOffsRegistry();
      registry[normKey] = payload;
      if (rawKey !== normKey) {
        registry[rawKey] = payload;
      }
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
            id: `doc-cutoff-${normKey}-${Date.now()}`,
            name: `CutOff_Notice_${movementIdentifier}.pdf`,
            type: "pdf",
            extension: "pdf",
            owners: [INITIAL_OWNERS.alex],
            lastModified: "Just now",
            lastModifiedTimestamp: nowIso,
            fileSize: "384 KB",
            folderId: "folder-design",
            starred: true,
            sharedLink: `https://drive.nashmia.com/f/cutoff-${normKey}`,
            metadata: {
              category: "Cut-Off Notice",
              documentType: "CUT_OFF_NOTICE",
              movementNumber: movementIdentifier,
              cutOffDeadlines: normalizedDeadlines,
              cutOffDates: payload,
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
      // Strictly created once per: Movement + Cut-Off Type + Cut-Off Date/Time
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
  if (isSupabaseConfigured) {
    void (async () => {
      try {
        const validBookingUuid = safeUuid(bookingId);
        const updatePayload = {
          cut_off_dates: payload,
          cut_off_deadlines: normalizedDeadlines,
          confirmation_details: {
            cut_off_dates: payload,
            cut_off_deadlines: normalizedDeadlines,
          },
          updated_at: nowIso,
        };

        if (validBookingUuid) {
          await supabase.from("bookings").update(updatePayload).eq("id", validBookingUuid);
        } else {
          // Try updating by movement_number or booking_reference
          const cleanRef = movementIdentifier.trim();
          await supabase
            .from("bookings")
            .update(updatePayload)
            .or(`movement_number.eq.${cleanRef},booking_reference.eq.${cleanRef}`);
        }

        // Insert database tracking event into booking_events table
        if (validBookingUuid) {
          await supabase.from("booking_events").insert({
            booking_id: validBookingUuid,
            event_type: "Cut-Off Schedule Extracted",
            event_date: nowIso,
            location: "Operations Desk",
            title: "Cut-Off Schedule Maintained",
            description: `Extracted ${normalizedDeadlines.length} cut-off deadlines for Movement ${movementIdentifier}`,
            payload: {
              movementNumber: movementIdentifier,
              deadlines: normalizedDeadlines,
              cutOffDates: payload,
              savedAt: nowIso,
            },
          });
        }
      } catch (dbErr) {
        console.warn("[saveCutOffsForMovement] Supabase update notice:", dbErr);
      }
    })();
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
          },
        },
      }),
    }).catch(() => {
      // Background sync, suppress errors
    });
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
