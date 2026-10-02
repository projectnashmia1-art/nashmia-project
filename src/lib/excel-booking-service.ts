import * as XLSX from "xlsx";
import { supabase, isSupabaseConfigured } from "./supabase";
import {
  normalizeBookingStatus,
  type FullBookingRecord,
  saveLocalBookings,
  getLocalBookings,
} from "./supabase-services";

export interface ParsedBookingField {
  fieldKey: string;
  fieldLabel: string;
  rawValue: unknown;
  sanitizedValue: string | number | null;
  displayValue: string;
  isValid: boolean;
  validationError?: string;
}

export type RowChangeStatus =
  "Will Update" | "Keep Existing" | "Unchanged" | "Unmatched" | "Invalid";

export interface RowChangeItem {
  id: string;
  rowNumber: number;
  bookingId: string | null;
  movementNumber: string | null;
  bookingReference: string | null;
  field: string;
  fieldLabel: string;
  previousValue: string;
  newValue: string;
  status: RowChangeStatus;
  patchField: string;
  patchValue: unknown;
  notes?: string;
  errorMessage?: string;
}

export interface ExcelPreviewSummary {
  totalRows: number;
  matchedCount: number;
  rowsWithChangesCount: number;
  unchangedCount: number;
  unmatchedCount: number;
  invalidCount: number;
}

export interface ExcelUploadPreviewResult {
  summary: ExcelPreviewSummary;
  changes: RowChangeItem[];
  unmatchedRows: Array<{
    rowNumber: number;
    reference: string;
    details: Record<string, string>;
  }>;
  invalidRows: Array<{
    rowNumber: number;
    reason: string;
  }>;
  errors: string[];
}

export interface ExcelUploadExecutionResult {
  totalProcessed: number;
  totalUpdated: number;
  totalUnchanged: number;
  totalSkippedOrInvalid: number;
  updatedBookingIds: string[];
  errors: string[];
}

/**
 * Normalizes Excel date representations (serial numbers or strings) to ISO date strings.
 */
export function parseExcelDate(val: unknown): { iso: string; display: string } | null {
  if (val === null || val === undefined || val === "") return null;

  // 1. Number (Excel serial date)
  if (typeof val === "number" && !isNaN(val)) {
    try {
      // Excel epoch begins Dec 30, 1899
      const parsedDate = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (
        !isNaN(parsedDate.getTime()) &&
        parsedDate.getFullYear() > 1990 &&
        parsedDate.getFullYear() < 2100
      ) {
        const iso = parsedDate.toISOString();
        const display = parsedDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        return { iso, display };
      }
    } catch {
      // Fall through
    }
  }

  // 2. String representation
  const str = String(val).trim();
  if (!str) return null;

  // Check for common formats: "15 Oct", "15 Oct 2026", "2026-10-15", "15/10/2026", "10/15/2026"
  const currentYear = new Date().getFullYear();

  // "15 Oct" or "15-Oct" without year
  const dayMonthMatch = str.match(/^(\d{1,2})[-/\s]+([A-Za-z]{3,9})$/i);
  if (dayMonthMatch) {
    const day = parseInt(dayMonthMatch[1], 10);
    const monthStr = dayMonthMatch[2];
    const candidate = new Date(`${day} ${monthStr} ${currentYear} 00:00:00 UTC`);
    if (!isNaN(candidate.getTime())) {
      return {
        iso: candidate.toISOString(),
        display: candidate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
    }
  }

  // Try direct standard Date parse
  const directDate = new Date(str);
  if (
    !isNaN(directDate.getTime()) &&
    directDate.getFullYear() > 1990 &&
    directDate.getFullYear() < 2100
  ) {
    return {
      iso: directDate.toISOString(),
      display: directDate.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    };
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) {
      return {
        iso: d.toISOString(),
        display: d.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
      };
    }
  }

  return null;
}

/**
 * Format date values consistently for display comparison
 */
export function formatDisplayDate(val?: string | null): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

/**
 * Normalizes column header keys to standardized property identifiers
 */
export function normalizeHeaderKey(rawHeader: string): string {
  const clean = rawHeader
    .toLowerCase()
    .replace(/[_\-\s#.:/]/g, "")
    .trim();

  if (
    [
      "movementnumber",
      "movementno",
      "movement",
      "movno",
      "movnum",
      "shipmentnumber",
      "shipmentno",
      "shipment",
    ].includes(clean)
  ) {
    return "movement_number";
  }
  if (
    [
      "bookingreference",
      "bookingref",
      "bookingno",
      "bookingnum",
      "reference",
      "ref",
      "bkgref",
      "bkgno",
    ].includes(clean)
  ) {
    return "booking_reference";
  }
  if (
    ["containernumber", "containerno", "cntrnumber", "cntrno", "container", "cntr"].includes(clean)
  ) {
    return "container_number";
  }
  if (
    [
      "eta",
      "estimatedtimeofarrival",
      "estarrival",
      "arrivaldate",
      "portarrivaldate",
      "portarrival",
    ].includes(clean)
  ) {
    return "eta";
  }
  if (
    [
      "etd",
      "estimatedtimeofdeparture",
      "estdeparture",
      "departuredate",
      "loadingdate",
      "etddate",
    ].includes(clean)
  ) {
    return "etd";
  }
  if (
    ["vesselname", "vessel", "mothervessel", "ship", "shipname", "vesselvoyage"].includes(clean)
  ) {
    return "vessel_name";
  }
  if (["voyagenumber", "voyageno", "voyage", "voyno", "voy"].includes(clean)) {
    return "voyage_number";
  }
  if (["status", "bookingstatus", "stage", "lifecyclestatus", "currentstatus"].includes(clean)) {
    return "status";
  }
  if (["currentlocation", "location", "lastlocation", "currentport", "facility"].includes(clean)) {
    return "current_location";
  }
  if (["portarrival", "portarrivaldate", "arrivalatport", "berthdate"].includes(clean)) {
    return "port_arrival_date";
  }
  if (["pol", "portofloading", "originport", "loadport", "origin"].includes(clean)) {
    return "pol";
  }
  if (
    ["pod", "portofdischarge", "destinationport", "dischargeport", "destination"].includes(clean)
  ) {
    return "pod";
  }
  if (["notes", "remarks", "comments", "specialinstructions"].includes(clean)) {
    return "notes";
  }
  return clean;
}

export const SUPPORTED_UPDATE_FIELDS: Record<
  string,
  { label: string; dbField: string; type: "date" | "string" | "status" }
> = {
  eta: { label: "ETA", dbField: "eta", type: "date" },
  etd: { label: "ETD", dbField: "etd", type: "date" },
  vessel_name: { label: "Vessel Name", dbField: "vessel_name", type: "string" },
  voyage_number: { label: "Voyage Number", dbField: "voyage_number", type: "string" },
  status: { label: "Booking Status", dbField: "status", type: "status" },
  container_number: { label: "Container Number", dbField: "container_number", type: "string" },
  current_location: { label: "Current Location", dbField: "location", type: "string" },
  port_arrival_date: { label: "Port Arrival Date", dbField: "eta", type: "date" },
  pol: { label: "POL (Origin)", dbField: "origin", type: "string" },
  pod: { label: "POD (Destination)", dbField: "destination", type: "string" },
  notes: { label: "Operational Notes", dbField: "notes", type: "string" },
};

/**
 * Securely parses an Excel file (XLSX, XLS, CSV) and compares rows with existing bookings
 */
export async function parseAndPreviewExcelBookings(
  fileBuffer: ArrayBuffer | Uint8Array,
  existingBookings: FullBookingRecord[],
): Promise<ExcelUploadPreviewResult> {
  const workbook = XLSX.read(fileBuffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("The uploaded Excel workbook contains no valid sheets.");
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(worksheet, {
    defval: null,
    raw: false,
    dateNF: "yyyy-mm-dd",
  });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("The selected Excel sheet does not contain any data rows.");
  }

  // Build high-efficiency lookup indexes for existing bookings:
  // 1. Movement number index (case-insensitive)
  const byMovementNumber = new Map<string, FullBookingRecord>();
  // 2. Booking reference index (case-insensitive)
  const byBookingReference = new Map<string, FullBookingRecord>();
  // 3. Container number secondary index (case-insensitive)
  const byContainerNumber = new Map<string, FullBookingRecord>();

  for (const b of existingBookings) {
    if (b.movement_number) {
      byMovementNumber.set(b.movement_number.trim().toUpperCase(), b);
    }
    if (b.booking_reference) {
      byBookingReference.set(b.booking_reference.trim().toUpperCase(), b);
    }
    if ((b as { reference?: string }).reference) {
      byBookingReference.set(
        String((b as { reference?: string }).reference)
          .trim()
          .toUpperCase(),
        b,
      );
    }
    if (b.id) {
      byBookingReference.set(b.id.trim().toUpperCase(), b);
    }
    if (b.containers && Array.isArray(b.containers)) {
      for (const cntr of b.containers) {
        if (cntr.container_number) {
          byContainerNumber.set(cntr.container_number.trim().toUpperCase(), b);
        }
      }
    }
  }

  const changes: RowChangeItem[] = [];
  const unmatchedRows: ExcelUploadPreviewResult["unmatchedRows"] = [];
  const invalidRows: ExcelUploadPreviewResult["invalidRows"] = [];
  const errors: string[] = [];

  let matchedBookingsCount = 0;
  const matchedBookingIdSet = new Set<string>();

  rawRows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 2; // 1-based index (Header is row 1)

    // Map raw row keys to normalized fields
    const normalizedRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const normKey = normalizeHeaderKey(key);
      normalizedRow[normKey] = value;
    }

    const rawMovNum = normalizedRow.movement_number
      ? String(normalizedRow.movement_number).trim()
      : null;
    const rawBkgRef = normalizedRow.booking_reference
      ? String(normalizedRow.booking_reference).trim()
      : null;
    const rawCntrNum = normalizedRow.container_number
      ? String(normalizedRow.container_number).trim()
      : null;

    // Must have at least one identifier to attempt matching
    if (!rawMovNum && !rawBkgRef && !rawCntrNum) {
      invalidRows.push({
        rowNumber,
        reason:
          "Row lacks an identifiable Movement Number, Booking Reference, or Container Number.",
      });
      return;
    }

    // Match priority: 1. Movement Number -> 2. Booking Reference -> 3. Secondary: Container Number
    let matchedBooking: FullBookingRecord | null = null;
    if (rawMovNum && byMovementNumber.has(rawMovNum.toUpperCase())) {
      matchedBooking = byMovementNumber.get(rawMovNum.toUpperCase())!;
    } else if (rawBkgRef && byBookingReference.has(rawBkgRef.toUpperCase())) {
      matchedBooking = byBookingReference.get(rawBkgRef.toUpperCase())!;
    } else if (rawCntrNum && byContainerNumber.has(rawCntrNum.toUpperCase())) {
      matchedBooking = byContainerNumber.get(rawCntrNum.toUpperCase())!;
    }

    const displayRef =
      rawMovNum || rawBkgRef || (rawCntrNum ? `Container: ${rawCntrNum}` : `Row #${rowNumber}`);

    if (!matchedBooking) {
      // Unmatched record — do NOT create automatically
      const rowDetails: Record<string, string> = {};
      for (const [k, v] of Object.entries(normalizedRow)) {
        if (v !== null && v !== undefined && String(v).trim()) {
          rowDetails[k] = String(v).trim();
        }
      }
      unmatchedRows.push({
        rowNumber,
        reference: displayRef,
        details: rowDetails,
      });

      changes.push({
        id: `unmatched-${rowNumber}`,
        rowNumber,
        bookingId: null,
        movementNumber: rawMovNum,
        bookingReference: rawBkgRef || displayRef,
        field: "booking_record",
        fieldLabel: "Record Identifier",
        previousValue: "Non-existent",
        newValue: displayRef,
        status: "Unmatched",
        patchField: "id",
        patchValue: null,
        notes: "No existing movement found. Will not be created automatically.",
      });
      return;
    }

    // Matched an existing booking!
    matchedBookingIdSet.add(matchedBooking.id);

    // Evaluate each supported update field
    for (const [fieldKey, fieldConfig] of Object.entries(SUPPORTED_UPDATE_FIELDS)) {
      if (!(fieldKey in normalizedRow)) continue;

      const rawVal = normalizedRow[fieldKey];
      const isCellEmpty = rawVal === null || rawVal === undefined || String(rawVal).trim() === "";

      // 1. Current value in DB
      let currentDbVal: unknown = null;
      let currentDisplay = "—";

      if (fieldKey === "container_number") {
        const primaryCntr = matchedBooking.containers?.[0]?.container_number;
        currentDbVal = primaryCntr || null;
        currentDisplay = primaryCntr || "—";
      } else if (fieldKey === "pol") {
        currentDbVal = matchedBooking.origin;
        currentDisplay = matchedBooking.origin || "—";
      } else if (fieldKey === "pod") {
        currentDbVal = matchedBooking.destination;
        currentDisplay = matchedBooking.destination || "—";
      } else if (fieldKey === "current_location") {
        currentDbVal = matchedBooking.notes || null;
        currentDisplay = matchedBooking.notes || "—";
      } else {
        currentDbVal = (matchedBooking as Record<string, unknown>)[fieldConfig.dbField];
        if (fieldConfig.type === "date") {
          currentDisplay = formatDisplayDate(currentDbVal as string | null);
        } else {
          currentDisplay = currentDbVal ? String(currentDbVal) : "—";
        }
      }

      // If Excel cell is empty, null, or blank: DO NOT OVERWRITE EXISTING DB VALUE
      if (isCellEmpty) {
        changes.push({
          id: `row-${rowNumber}-${fieldKey}`,
          rowNumber,
          bookingId: matchedBooking.id,
          movementNumber: matchedBooking.movement_number || rawMovNum,
          bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
          field: fieldKey,
          fieldLabel: fieldConfig.label,
          previousValue: currentDisplay,
          newValue: "Empty",
          status: "Keep Existing",
          patchField: fieldConfig.dbField,
          patchValue: null,
          notes: "Empty cell in Excel. Existing database value preserved.",
        });
        continue;
      }

      // Value exists in Excel, validate and compare
      if (fieldConfig.type === "date") {
        const parsed = parseExcelDate(rawVal);
        if (!parsed) {
          changes.push({
            id: `row-${rowNumber}-${fieldKey}`,
            rowNumber,
            bookingId: matchedBooking.id,
            movementNumber: matchedBooking.movement_number || rawMovNum,
            bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
            field: fieldKey,
            fieldLabel: fieldConfig.label,
            previousValue: currentDisplay,
            newValue: String(rawVal),
            status: "Invalid",
            patchField: fieldConfig.dbField,
            patchValue: null,
            errorMessage: `Invalid date format: "${rawVal}". Preserving existing value.`,
          });
          continue;
        }

        const isUnchanged =
          currentDbVal &&
          (formatDisplayDate(currentDbVal as string) === parsed.display ||
            (typeof currentDbVal === "string" &&
              currentDbVal.startsWith(parsed.iso.split("T")[0])));

        if (isUnchanged) {
          changes.push({
            id: `row-${rowNumber}-${fieldKey}`,
            rowNumber,
            bookingId: matchedBooking.id,
            movementNumber: matchedBooking.movement_number || rawMovNum,
            bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
            field: fieldKey,
            fieldLabel: fieldConfig.label,
            previousValue: currentDisplay,
            newValue: parsed.display,
            status: "Unchanged",
            patchField: fieldConfig.dbField,
            patchValue: parsed.iso,
          });
        } else {
          changes.push({
            id: `row-${rowNumber}-${fieldKey}`,
            rowNumber,
            bookingId: matchedBooking.id,
            movementNumber: matchedBooking.movement_number || rawMovNum,
            bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
            field: fieldKey,
            fieldLabel: fieldConfig.label,
            previousValue: currentDisplay,
            newValue: parsed.display,
            status: "Will Update",
            patchField: fieldConfig.dbField,
            patchValue: parsed.iso,
          });
        }
      } else if (fieldConfig.type === "status") {
        const normalizedStatus = normalizeBookingStatus(String(rawVal));
        const currentNorm = normalizeBookingStatus(currentDbVal as string);

        if (normalizedStatus.toLowerCase() === currentNorm.toLowerCase()) {
          changes.push({
            id: `row-${rowNumber}-${fieldKey}`,
            rowNumber,
            bookingId: matchedBooking.id,
            movementNumber: matchedBooking.movement_number || rawMovNum,
            bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
            field: fieldKey,
            fieldLabel: fieldConfig.label,
            previousValue: currentDisplay,
            newValue: normalizedStatus,
            status: "Unchanged",
            patchField: fieldConfig.dbField,
            patchValue: normalizedStatus,
          });
        } else {
          changes.push({
            id: `row-${rowNumber}-${fieldKey}`,
            rowNumber,
            bookingId: matchedBooking.id,
            movementNumber: matchedBooking.movement_number || rawMovNum,
            bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
            field: fieldKey,
            fieldLabel: fieldConfig.label,
            previousValue: currentDisplay,
            newValue: normalizedStatus,
            status: "Will Update",
            patchField: fieldConfig.dbField,
            patchValue: normalizedStatus,
          });
        }
      } else {
        // String comparison
        const newStr = String(rawVal).trim();
        const currentStr = currentDbVal ? String(currentDbVal).trim() : "";

        if (newStr.toLowerCase() === currentStr.toLowerCase()) {
          changes.push({
            id: `row-${rowNumber}-${fieldKey}`,
            rowNumber,
            bookingId: matchedBooking.id,
            movementNumber: matchedBooking.movement_number || rawMovNum,
            bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
            field: fieldKey,
            fieldLabel: fieldConfig.label,
            previousValue: currentDisplay,
            newValue: newStr,
            status: "Unchanged",
            patchField: fieldConfig.dbField,
            patchValue: newStr,
          });
        } else {
          changes.push({
            id: `row-${rowNumber}-${fieldKey}`,
            rowNumber,
            bookingId: matchedBooking.id,
            movementNumber: matchedBooking.movement_number || rawMovNum,
            bookingReference: matchedBooking.booking_reference || rawBkgRef || displayRef,
            field: fieldKey,
            fieldLabel: fieldConfig.label,
            previousValue: currentDisplay,
            newValue: newStr,
            status: "Will Update",
            patchField: fieldConfig.dbField,
            patchValue: newStr,
          });
        }
      }
    }
  });

  matchedBookingsCount = matchedBookingIdSet.size;

  const rowsWithChangesCount = changes.filter((c) => c.status === "Will Update").length;
  const unchangedCount = changes.filter((c) => c.status === "Unchanged").length;
  const invalidCount = invalidRows.length + changes.filter((c) => c.status === "Invalid").length;

  return {
    summary: {
      totalRows: rawRows.length,
      matchedCount: matchedBookingsCount,
      rowsWithChangesCount,
      unchangedCount,
      unmatchedCount: unmatchedRows.length,
      invalidCount,
    },
    changes,
    unmatchedRows,
    invalidRows,
    errors,
  };
}

/**
 * Applies confirmed changes to Supabase database, writes audit logs, and creates timeline events.
 */
export async function executeExcelBookingUpdates(
  confirmedChanges: RowChangeItem[],
  userId?: string | null,
  onProgress?: (processed: number, total: number, stepText: string) => void,
): Promise<ExcelUploadExecutionResult> {
  const eligibleChanges = confirmedChanges.filter((c) => c.status === "Will Update" && c.bookingId);

  if (eligibleChanges.length === 0) {
    return {
      totalProcessed: 0,
      totalUpdated: 0,
      totalUnchanged: confirmedChanges.filter((c) => c.status === "Unchanged").length,
      totalSkippedOrInvalid: confirmedChanges.filter(
        (c) => c.status === "Keep Existing" || c.status === "Invalid" || c.status === "Unmatched",
      ).length,
      updatedBookingIds: [],
      errors: [],
    };
  }

  // Group changes by bookingId
  const changesByBooking = new Map<string, RowChangeItem[]>();
  for (const item of eligibleChanges) {
    if (!item.bookingId) continue;
    const existing = changesByBooking.get(item.bookingId) || [];
    existing.push(item);
    changesByBooking.set(item.bookingId, existing);
  }

  const updatedBookingIds: string[] = [];
  const errors: string[] = [];
  let processedCount = 0;
  const totalBookingsToUpdate = changesByBooking.size;

  onProgress?.(0, totalBookingsToUpdate, "Preparing database updates...");

  for (const [bookingId, items] of changesByBooking.entries()) {
    processedCount++;
    const bookingRef = items[0]?.bookingReference || items[0]?.movementNumber || bookingId;
    onProgress?.(
      processedCount,
      totalBookingsToUpdate,
      `Updating booking ${bookingRef} (${processedCount} of ${totalBookingsToUpdate})...`,
    );

    try {
      const patch: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      const changeAuditList: Array<{ field: string; previousValue: string; newValue: string }> = [];
      let containerNumberUpdate: string | null = null;

      for (const item of items) {
        if (item.field === "container_number") {
          containerNumberUpdate = String(item.patchValue);
        } else {
          patch[item.patchField] = item.patchValue;
        }

        // If status is updated to confirmed, reflect in confirmation status
        if (item.field === "status") {
          const st = String(item.patchValue).toLowerCase();
          if (st.includes("confirm") || st.includes("approved")) {
            patch.confirmation_status = "CONFIRMED";
            patch.confirmed_at = new Date().toISOString();
          }
        }

        changeAuditList.push({
          field: item.fieldLabel,
          previousValue: item.previousValue,
          newValue: item.newValue,
        });
      }

      // 1. Update booking record in Supabase
      if (isSupabaseConfigured) {
        const { error: updateError } = await supabase
          .from("bookings")
          .update(patch)
          .eq("id", bookingId);

        if (updateError) {
          throw new Error(`Failed to update booking ${bookingRef}: ${updateError.message}`);
        }

        // 2. If container number was modified, update or insert into booking_containers
        if (containerNumberUpdate) {
          try {
            const { data: existingContainers } = await supabase
              .from("booking_containers")
              .select("id")
              .eq("booking_id", bookingId)
              .limit(1);

            if (existingContainers && existingContainers.length > 0) {
              await supabase
                .from("booking_containers")
                .update({
                  container_number: containerNumberUpdate,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", existingContainers[0].id);
            } else {
              await supabase.from("booking_containers").insert({
                booking_id: bookingId,
                container_number: containerNumberUpdate,
                container_type: "Dry",
                container_size: "40ft High Cube",
                weight_unit: "kg",
                status: "Assigned",
              });
            }
          } catch (cntrErr) {
            console.warn("[Excel Update] Container record sync notice:", cntrErr);
          }
        }

        // 3. Write Audit Log entry
        try {
          await supabase.from("audit_logs").insert({
            user_id: userId || null,
            action: "EXCEL_BOOKING_UPDATE",
            entity_type: "booking",
            entity_id: bookingId,
            changes: changeAuditList,
            new_data: patch,
          });
        } catch (auditErr) {
          console.warn("[Excel Update] Audit log notice:", auditErr);
        }

        // 4. Create timeline event in booking_events
        try {
          const changeSummary = changeAuditList.map((c) => `${c.field}: ${c.newValue}`).join(", ");
          await supabase.from("booking_events").insert({
            booking_id: bookingId,
            event_type: "EXCEL_UPDATE",
            title: "Excel Lifecycle Update",
            description: `Automated Excel update applied: ${changeSummary}`,
            occurred_at: new Date().toISOString(),
            created_by: userId || "Excel Import Engine",
            payload: {
              source: "excel_upload",
              changes: changeAuditList,
            },
          });
        } catch (eventErr) {
          console.warn("[Excel Update] Booking event notice:", eventErr);
        }
      }

      // Also update local cache for instant zero-lag reactivity
      const localBookings = getLocalBookings();
      const updatedLocal = localBookings.map((b) => {
        if (
          b.id === bookingId ||
          b.movement_number === bookingRef ||
          b.booking_reference === bookingRef
        ) {
          return {
            ...b,
            ...patch,
            updated_at: new Date().toISOString(),
          } as FullBookingRecord;
        }
        return b;
      });
      saveLocalBookings(updatedLocal);

      updatedBookingIds.push(bookingId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      console.error("[Excel Update Error]", msg);
    }

    // Small yield to keep browser thread fluid
    await new Promise((resolve) => setTimeout(resolve, 15));
  }

  // Dispatch global reactivity events to update table and dashboard KPIs seamlessly
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_bookings_updated", {
        detail: { updated: true, count: updatedBookingIds.length },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("supabase_realtime_bookings_change", {
        detail: { updated: true, count: updatedBookingIds.length },
      }),
    );
  }

  const unchangedTotal = confirmedChanges.filter((c) => c.status === "Unchanged").length;
  const skippedTotal = confirmedChanges.filter(
    (c) => c.status === "Keep Existing" || c.status === "Invalid" || c.status === "Unmatched",
  ).length;

  return {
    totalProcessed: confirmedChanges.length,
    totalUpdated: updatedBookingIds.length,
    totalUnchanged: unchangedTotal,
    totalSkippedOrInvalid: skippedTotal,
    updatedBookingIds,
    errors,
  };
}
