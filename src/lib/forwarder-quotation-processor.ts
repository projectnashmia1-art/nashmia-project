/**
 * Deterministic Rule-Based Forwarder Quotation Email Processing Module
 *
 * Conforms strictly to specifications:
 * - 100% deterministic, transparent, and auditable
 * - Zero AI, LLM, Gemini API, OpenAI API, Claude API, or external machine learning
 * - Configurable regular expressions supporting BK-2026-000145, BK/2026/000145, BOOKING-2026-000145, REF: BK-2026-000145
 * - Search order: 1. Email subject, 2. Email body, 3. Attachment filename, 4. Quotation reference
 * - Unmatched handling if 0 booking numbers found (save email, do not attach automatically)
 * - Needs Review handling if >1 booking numbers found (save all detected, do not auto-select booking)
 * - Extracts 16 key quotation fields using deterministic rules and keywords
 * - Validates extracted values deterministically
 * - Updates Booking Request Card without automatically approving or awarding
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { supabase as defaultSupabase } from "./supabase";
import { safeUuid, getLocalBookings, getLocalForwarders } from "./supabase-services";
import {
  matchSenderWithForwarderMaster,
  extractCleanDomain,
  GENERIC_PUBLIC_EMAIL_DOMAINS,
  type ForwarderMasterRecord,
  type ForwarderMatchResult,
} from "./forwarder-matching-service";
import {
  extractChargesAndTotals,
  extractExplicitCurrency,
  type ExtractedChargeItem,
  type TotalCalculationResult,
  type ChargeCategory,
  type ChargeUnit,
  type ChargeAmountStatus,
  CHARGE_KEYWORD_MAPPINGS,
  EXPLICIT_CURRENCIES,
  UNAMBIGUOUS_CURRENCY_SYMBOLS,
} from "./deterministic-charge-extractor";
import {
  extractDatesFromText,
  parseDateDeterministic,
  formatIsoDate,
  DATE_LABEL_MAPPINGS,
  type ExtractedDateItem,
  type DateExtractionResult,
  type DateLabelCategory,
  type DateTargetField,
} from "./deterministic-date-extractor";
import {
  classifyQuotationMessage,
  QUOTATION_CLASSIFICATION_RULES,
  type QuotationMessageCategory,
  type QuotationClassificationResult,
} from "./deterministic-quotation-classifier";
import {
  persistProcessedQuotationBundle,
  persistIncomingEmailRecord,
  persistQuotationRequestRecord,
  persistQuotationRecord,
  persistQuotationCharges,
  type IncomingEmailRecord,
  type QuotationRequestRecord,
  type QuotationRecord,
  type QuotationChargeRecord,
} from "./quotation-schema-persistence";

export {
  classifyQuotationMessage,
  QUOTATION_CLASSIFICATION_RULES,
  type QuotationMessageCategory,
  type QuotationClassificationResult,
  persistProcessedQuotationBundle,
  persistIncomingEmailRecord,
  persistQuotationRequestRecord,
  persistQuotationRecord,
  persistQuotationCharges,
  type IncomingEmailRecord,
  type QuotationRequestRecord,
  type QuotationRecord,
  type QuotationChargeRecord,
};
import { getLocalForwarderRequests, saveLocalForwarderRequests } from "./multi-forwarder-service";
import { persistQuotationToDatabase } from "./quotation-database-service";
import { recordQuotationAuditEvent } from "./quotation-audit-logger";
import { createLogisticsNotification } from "./notification-service";
import type {
  ForwarderQuoteRequestRecord,
  ForwarderOfferData,
  ForwarderQuoteStatus,
} from "@/types/requests";
import type { IncomingAttachmentInput } from "./document-attachment-service";

// ============================================================================
// 1. CONFIGURABLE REGULAR EXPRESSIONS FOR BOOKING NUMBERS
// ============================================================================

export interface BookingNumberRegexConfig {
  name: string;
  pattern: RegExp;
  description: string;
  extractGroup: number;
}

export const CONFIGURABLE_BOOKING_NUMBER_PATTERNS: BookingNumberRegexConfig[] = [
  // 1. Direct Nashmia movement pattern: "NASH-2026-000145", "NASH-BK-2026-000145"
  {
    name: "NASH_DIRECT",
    pattern:
      /(?:^|[^A-Za-z0-9-_/])(NASH[-_](?:BK[-_]|MOV[-_])?[0-9]{4}[-_][0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "Direct Nashmia Movement Number format (e.g. NASH-2026-000145)",
    extractGroup: 1,
  },
  // 2. Prefixed reference: "REF: BK-2026-000145", "REF. BK/2026/000145", "REF # BK-2026-000145", "REFERENCE: BK-2026-000145"
  {
    name: "REF_PREFIXED",
    pattern:
      /(?:^|[^A-Za-z0-9-_/])(?:REF|REFERENCE|RE|OUR\s*REF|YOUR\s*REF)[\s.:#*-]+((?:BK|BOOKING|MOV|MOVEMENT|NASH[-_]BK|REQ|BKG)[-_/][0-9]{4}[-_/][0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "Prefixed reference (e.g. REF: BK-2026-000145)",
    extractGroup: 1,
  },
  // 2. System prefixes: "NASH-BK-2026-000145", "REQ-2026-000145", "BKG-2026-000145"
  {
    name: "NASH_REQ_STANDARD",
    pattern:
      /(?:^|[^A-Za-z0-9-_/])((?:[A-Z0-9]{2,10}-(?:REQ|BK|MOV|BKG)|NASH[-_]BK|REQ|BKG)[-_/][0-9]{4}[-_/][0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "System prefix format (e.g. NASH-BK-2026-000145)",
    extractGroup: 1,
  },
  // 3. MOVEMENT with hyphen or slash: "MOVEMENT-2026-000145"
  {
    name: "MOVEMENT_FULL",
    pattern: /(?:^|[^A-Za-z0-9-_/])(MOVEMENT[-_/][0-9]{4}[-_/][0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "Full MOVEMENT format (e.g. MOVEMENT-2026-000145)",
    extractGroup: 1,
  },
  // 4. MOV with hyphen or slash: "MOV-2026-000145", "MOV/2026/000145"
  {
    name: "MOV_STANDARD",
    pattern: /(?:^|[^A-Za-z0-9-_/])(MOV[-_/][0-9]{4}[-_/][0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "Standard MOV format (e.g. MOV-2026-000145)",
    extractGroup: 1,
  },
  // 5. BOOKING with hyphen or slash: "BOOKING-2026-000145", "BOOKING/2026/000145"
  {
    name: "BOOKING_FULL",
    pattern: /(?:^|[^A-Za-z0-9-_/])(BOOKING[-_/][0-9]{4}[-_/][0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "Full BOOKING prefix format (e.g. BOOKING-2026-000145)",
    extractGroup: 1,
  },
  // 6. Standard BK with hyphen: "BK-2026-000145"
  {
    name: "BK_HYPHEN",
    pattern: /(?:^|[^A-Za-z0-9-_/])(BK-[0-9]{4}-[0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "Standard BK hyphen format (e.g. BK-2026-000145)",
    extractGroup: 1,
  },
  // 7. Standard BK with slash: "BK/2026/000145"
  {
    name: "BK_SLASH",
    pattern: /(?:^|[^A-Za-z0-9-_/])(BK\/[0-9]{4}\/[0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "Standard BK slash format (e.g. BK/2026/000145)",
    extractGroup: 1,
  },
  // 8. General flexible booking number fallback (e.g. [A-Z]{2,10}-[0-9]{4}-[0-9]+)
  {
    name: "GENERAL_BOOKING",
    pattern: /(?:^|[^A-Za-z0-9-_/])([A-Z]{2,10}[-_/][0-9]{4}[-_/][0-9]{3,8})(?:$|[^A-Za-z0-9-_/])/i,
    description: "General 4-digit-year booking code",
    extractGroup: 1,
  },
];

/**
 * Normalizes any booking number to a standardized canonical format (e.g. "BK/2026/000145" -> "BK-2026-000145")
 * This allows proper comparison without treating different slash/hyphen notations as distinct bookings.
 */
export function normalizeBookingNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let clean = raw.trim().toUpperCase();

  // Strip prefixes like "REF:", "REFERENCE:", "REF #", "BOOKING:", "BOOKING #", "BKG #", etc.
  clean = clean.replace(/^(?:BOOKING|BKG|REF|REFERENCE|RE|OUR\s*REF|YOUR\s*REF)[\s.:#*-]+/i, "");

  // Convert slashes or underscores between tokens into hyphens
  clean = clean.replace(/[/_]/g, "-");

  // Standardize multiple hyphens
  clean = clean.replace(/-+/g, "-");

  return clean.trim();
}

/**
 * Extracts all matching booking numbers from a specific text using configurable regex rules.
 */
export function extractBookingNumbersFromText(
  text: string | null | undefined,
  patterns: BookingNumberRegexConfig[] = CONFIGURABLE_BOOKING_NUMBER_PATTERNS,
): string[] {
  if (!text) return [];
  const found = new Set<string>();

  for (const cfg of patterns) {
    const globalPattern = new RegExp(cfg.pattern.source, "gi");
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) {
      const extracted = (match[cfg.extractGroup || 1] || match[0]).trim();
      if (extracted) {
        found.add(extracted.toUpperCase());
      }
    }
  }

  const rawList = Array.from(found);
  // Prune redundant sub-tokens where a shorter code is a suffix/submatch of a longer recognized booking (e.g., BK-2026-8726 vs NASH-BK-2026-8726)
  const pruned = rawList.filter(
    (item, i) =>
      !rawList.some(
        (other, j) =>
          i !== j &&
          other.length > item.length &&
          (other.endsWith(item) || other.includes(`-${item}`) || other.includes(`/${item}`)),
      ),
  );

  return pruned;
}

// ============================================================================
// 2. ORDERED BOOKING NUMBER EXTRACTION (Subject -> Body -> Attachment -> Reference)
// ============================================================================

export interface OrderedBookingNumberResult {
  detectedBookingNumbers: string[];
  canonicalBookingNumber: string | null;
  foundIn: "SUBJECT" | "BODY" | "ATTACHMENT" | "REFERENCE" | null;
  sources: {
    subject: string[];
    body: string[];
    attachments: string[];
    reference: string[];
  };
  isAmbiguous: boolean;
  status: "MATCHED" | "UNMATCHED" | "NEEDS_REVIEW";
  reason: string;
}

export interface OrderedSearchInput {
  subject?: string | null;
  body?: string | null;
  attachmentFilenames?: string[] | null;
  attachments?: IncomingAttachmentInput[] | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  quotationReference?: string | null;
}

/**
 * Searches booking numbers strictly in order:
 * 1. Email subject
 * 2. Email body
 * 3. Attachment filename
 * 4. Quotation reference
 *
 * Rules:
 * - If no booking number is found: mark as unmatched, do not attach automatically.
 * - If more than one booking number is found: save all detected, mark as needs_review, do not select automatically.
 */
export function extractBookingNumberStrictOrder(
  input: OrderedSearchInput,
): OrderedBookingNumberResult {
  const sources = {
    subject: [] as string[],
    body: [] as string[],
    attachments: [] as string[],
    reference: [] as string[],
  };

  // Step 1: Email subject
  if (input.subject) {
    sources.subject = extractBookingNumbersFromText(input.subject);
  }

  // Step 2: Email body
  if (input.body) {
    sources.body = extractBookingNumbersFromText(input.body);
  }

  // Step 3: Attachment filenames
  const attachmentNames: string[] = [];
  if (Array.isArray(input.attachmentFilenames)) {
    attachmentNames.push(...input.attachmentFilenames);
  }
  if (Array.isArray(input.attachments)) {
    for (const att of input.attachments) {
      if (att.name) attachmentNames.push(att.name);
      if (att.filename) attachmentNames.push(att.filename);
    }
  }
  if (attachmentNames.length > 0) {
    sources.attachments = extractBookingNumbersFromText(attachmentNames.join(" "));
  }

  // Step 4: Quotation reference (In-Reply-To, References headers, reference tags)
  const refTexts: string[] = [];
  if (input.inReplyTo) refTexts.push(input.inReplyTo);
  if (Array.isArray(input.references)) {
    refTexts.push(...input.references);
  } else if (typeof input.references === "string") {
    refTexts.push(input.references);
  }
  if (input.quotationReference) refTexts.push(input.quotationReference);
  if (refTexts.length > 0) {
    sources.reference = extractBookingNumbersFromText(refTexts.join(" "));
  }

  // Gather all unique canonical booking numbers
  const canonicalMap = new Map<string, string>(); // canonical -> original first seen
  const allFoundOriginals: string[] = [];

  const registerMatches = (matches: string[]) => {
    for (const m of matches) {
      allFoundOriginals.push(m);
      const canon = normalizeBookingNumber(m);
      if (canon && !canonicalMap.has(canon)) {
        canonicalMap.set(canon, m);
      }
    }
  };

  // Register in prioritized order
  registerMatches(sources.subject);
  registerMatches(sources.body);
  registerMatches(sources.attachments);
  registerMatches(sources.reference);

  const distinctCanonical = Array.from(canonicalMap.keys());

  // Determine where the first match was detected
  let foundIn: "SUBJECT" | "BODY" | "ATTACHMENT" | "REFERENCE" | null = null;
  if (sources.subject.length > 0) foundIn = "SUBJECT";
  else if (sources.body.length > 0) foundIn = "BODY";
  else if (sources.attachments.length > 0) foundIn = "ATTACHMENT";
  else if (sources.reference.length > 0) foundIn = "REFERENCE";

  // Case A: No booking number found
  if (distinctCanonical.length === 0) {
    return {
      detectedBookingNumbers: [],
      canonicalBookingNumber: null,
      foundIn: null,
      sources,
      isAmbiguous: false,
      status: "UNMATCHED",
      reason:
        "No booking number found in email subject, body, attachment filenames, or quotation reference headers.",
    };
  }

  // Case B: More than one booking number found
  if (distinctCanonical.length > 1) {
    return {
      detectedBookingNumbers: distinctCanonical,
      canonicalBookingNumber: null, // DO NOT select automatically!
      foundIn,
      sources,
      isAmbiguous: true,
      status: "NEEDS_REVIEW",
      reason: `Multiple distinct booking numbers detected in email: [${distinctCanonical.join(
        ", ",
      )}]. Marked as needs_review without automatic booking assignment.`,
    };
  }

  // Case C: Exactly one booking number found
  const singleCanonical = distinctCanonical[0];
  return {
    detectedBookingNumbers: distinctCanonical,
    canonicalBookingNumber: singleCanonical,
    foundIn,
    sources,
    isAmbiguous: false,
    status: "MATCHED",
    reason: `Single booking number '${singleCanonical}' found in ${foundIn}.`,
  };
}

// ============================================================================
// 2.5 FORWARDER MATCHING ENGINE (Exact Email, Contact Email, Registered Domain)
// ============================================================================

export type { ForwarderMasterRecord, ForwarderMatchResult } from "./forwarder-matching-service";
export {
  GENERIC_PUBLIC_EMAIL_DOMAINS,
  extractCleanDomain,
  extractEmailsFromText,
  getForwarderRegisteredDomains,
  matchSenderWithForwarderMaster,
} from "./forwarder-matching-service";

// ============================================================================
// 3. DETERMINISTIC QUOTATION FIELD EXTRACTION (16 Commercial & Route Fields)
// ============================================================================

export interface DeterministicQuotationFields {
  // 1. Ocean Freight
  oceanFreight: number | null;
  // 2. Origin Charges
  originCharges: number | null;
  // 3. Destination Charges
  destinationCharges: number | null;
  // 4. THC (Terminal Handling Charge)
  thc: number | null;
  // 5. Documentation Charges
  documentationCharges: number | null;
  // 6. Customs Charges
  customsCharges: number | null;
  // 7. Trucking Charges
  truckingCharges: number | null;
  // 8. Other Charges
  otherCharges: number | null;
  // 9. Currency
  currency: string | null;
  // 10. Total Amount
  totalAmount: number | null;
  quotedTotal: number | null;
  quoted_total: number | null;
  calculatedTotal: number | null;
  calculated_total: number | null;
  hasDiscrepancy: boolean;
  discrepancyDifference: number | null;
  hasRange: boolean;
  hasMissingCurrency: boolean;
  hasMissingAmount: boolean;
  hasMultipleCurrencies?: boolean;
  hasUnreadableAttachments?: boolean;
  unreadableAttachmentReasons?: string[];
  hasUnsupportedText?: boolean;
  unsupportedTextReasons?: string[];
  hasBookingDetailsMismatch?: boolean;
  itemizedCharges: ExtractedChargeItem[];
  charges: ExtractedChargeItem[];
  chargeExtractionWarnings: string[];
  // 11. Transit Time
  transitTime: number | null;
  // 12. Sailing Date / ETD
  sailingDate: string | null;
  etd?: string | null;
  eta?: string | null;
  cutoffDate?: string | null;
  hasAmbiguousDate?: boolean;
  extractedDates?: ExtractedDateItem[];
  dateExtractionWarnings?: string[];
  // 13. Validity Date
  validityDate: string | null;
  // 14. Free Days
  freeDays: number | null;
  // 15. Vessel Name
  vesselName: string | null;
  // 16. Routing
  routing: string | null;

  // Additional operational metadata
  carrier: string | null;
  containerType: string | null;
  containerQuantity: number | null;
  notes: string | null;
  isDeclined: boolean;
  isConfirmed: boolean;
  classification?: QuotationClassificationResult;
  quotationCategory?: QuotationMessageCategory;
  fieldTraceability: Record<string, { value: unknown; sourceText: string; line: number }>;
}

function parseNumericAmount(str: string): number | null {
  if (!str) return null;
  let clean = str.trim();
  clean = clean.replace(/^(?:USD|EUR|GBP|AED|PKR|INR|\$|€|£)\s*/i, "");
  clean = clean.replace(/\s*(?:USD|EUR|GBP|AED|PKR|INR|\$|€|£)$/i, "");

  if (clean.includes(",") && clean.includes(".")) {
    const commaIdx = clean.lastIndexOf(",");
    const dotIdx = clean.lastIndexOf(".");
    if (dotIdx > commaIdx) {
      clean = clean.replace(/,/g, "");
    } else {
      clean = clean.replace(/\./g, "").replace(/,/g, ".");
    }
  } else if (clean.includes(",")) {
    const parts = clean.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      clean = clean.replace(",", ".");
    } else {
      clean = clean.replace(/,/g, "");
    }
  }

  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

const MONTH_MAP: Record<string, string> = {
  jan: "Jan",
  january: "Jan",
  feb: "Feb",
  february: "Feb",
  mar: "Mar",
  march: "Mar",
  apr: "Apr",
  april: "Apr",
  may: "May",
  jun: "Jun",
  june: "Jun",
  jul: "Jul",
  july: "Jul",
  aug: "Aug",
  august: "Aug",
  sep: "Sep",
  sept: "Sep",
  september: "Sep",
  oct: "Oct",
  october: "Oct",
  nov: "Nov",
  november: "Nov",
  dec: "Dec",
  december: "Dec",
};

function normalizeDateString(raw: string, fallbackYear = 2026): string | null {
  if (!raw) return null;
  const clean = raw.trim();

  // Pattern: "15 Oct", "15-Oct-2026", "15/10/2026"
  const dmyMatch = clean.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-_/]+([A-Za-z]{3,9})(?:[\s\-_/]+(\d{2,4}))?\b/i,
  );
  if (dmyMatch) {
    const rawMonth = dmyMatch[2].toLowerCase();
    const month = MONTH_MAP[rawMonth] || MONTH_MAP[rawMonth.slice(0, 3)];
    if (month) {
      const day = parseInt(dmyMatch[1], 10);
      const yr = dmyMatch[3] ? parseInt(dmyMatch[3], 10) : fallbackYear;
      const fullYr = yr < 100 ? 2000 + yr : yr;
      return `${day} ${month} ${fullYr}`;
    }
  }

  // Pattern: "October 15", "October 15, 2026"
  const mdyMatch = clean.match(
    /\b([A-Za-z]{3,9})[\s\-_]+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{2,4}))?\b/i,
  );
  if (mdyMatch) {
    const rawMonth = mdyMatch[1].toLowerCase();
    const month = MONTH_MAP[rawMonth] || MONTH_MAP[rawMonth.slice(0, 3)];
    if (month) {
      const day = parseInt(mdyMatch[2], 10);
      const yr = mdyMatch[3] ? parseInt(mdyMatch[3], 10) : fallbackYear;
      const fullYr = yr < 100 ? 2000 + yr : yr;
      return `${day} ${month} ${fullYr}`;
    }
  }

  // Numeric ISO or slash: "2026-10-15", "15/10/2026"
  const isoMatch = clean.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
  }

  return clean;
}

const OCEAN_CARRIERS = [
  "MAERSK",
  "MSC",
  "CMA CGM",
  "COSCO",
  "HAPAG-LLOYD",
  "HAPAG",
  "ONE",
  "EVERGREEN",
  "YANG MING",
  "HMM",
  "ZIM",
  "PIL",
  "WAN HAI",
  "OOCL",
];

/**
 * Deterministically extracts the 16 standard forwarder quotation fields
 * using keyword-anchored regular expressions. Zero AI or LLM.
 */
export function extractQuotationFieldsDeterministic(
  subject: string,
  body: string,
): DeterministicQuotationFields {
  const combined = `${subject || ""}\n${body || ""}`;
  const lines = combined
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const trace: Record<string, { value: unknown; sourceText: string; line: number }> = {};

  // Execute deterministic quotation classification
  const classification = classifyQuotationMessage(subject, body);
  trace.classification = {
    value: classification.category,
    sourceText: classification.matchedKeywords.join(", ") || "none",
    line: 1,
  };

  // Decline check (from explicit keywords or classification)
  let isDeclined = classification.isNoQuote;
  const lowerCombined = combined.toLowerCase();
  if (
    lowerCombined.includes("fully booked") ||
    lowerCombined.includes("no space") ||
    lowerCombined.includes("cannot accept") ||
    lowerCombined.includes("unable to quote") ||
    lowerCombined.includes("we regret") ||
    lowerCombined.includes("decline to quote") ||
    lowerCombined.includes("no equipment")
  ) {
    isDeclined = true;
  }

  // Confirmation check
  let isConfirmed = false;
  if (
    lowerCombined.includes("booking confirmed") ||
    lowerCombined.includes("booking has been confirmed") ||
    lowerCombined.includes("space confirmed") ||
    lowerCombined.includes("allocation confirmed")
  ) {
    isConfirmed = true;
  }

  // Carrier check
  let carrier: string | null = null;
  for (const c of OCEAN_CARRIERS) {
    const pat = new RegExp(`\\b${c.replace("-", "[\\s-]?")}\\b`, "i");
    if (pat.test(combined)) {
      carrier = c;
      break;
    }
  }

  // Container Type & Quantity detection
  let containerType: string | null = null;
  let containerQuantity: number | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    const lineNum = idx + 1;
    if (!containerType) {
      const cntrMatch = line.match(/\b(20(?:GP|DV|FT)?|40(?:GP|DV|HC|HQ|FT)?|45(?:HC|HQ|FT)?)\b/i);
      if (cntrMatch) {
        containerType = cntrMatch[1].toUpperCase();
        trace.containerType = { value: containerType, sourceText: cntrMatch[0], line: lineNum };
      }
    }
    if (containerQuantity === null) {
      const qtyMatch =
        line.match(/\b(\d+)\s*(?:x\s*)?(?:containers?|cntrs?|boxes|units)\b/i) ||
        line.match(/[x*]\s*(\d+)/i);
      if (qtyMatch) {
        const q = parseInt(qtyMatch[1], 10);
        if (!isNaN(q) && q > 0 && q <= 500) {
          containerQuantity = q;
          trace.containerQuantity = { value: q, sourceText: qtyMatch[0], line: lineNum };
        }
      }
    }
  }

  // Execute deterministic charge, currency, amount & totals extraction
  const chargesResult = extractChargesAndTotals(combined, {
    containerCount: containerQuantity,
  });

  const oceanFreight = chargesResult.chargeMap.ocean_freight?.amount ?? null;
  const originCharges = chargesResult.chargeMap.origin_charges?.amount ?? null;
  const destinationCharges = chargesResult.chargeMap.destination_charges?.amount ?? null;
  const thc = chargesResult.chargeMap.terminal_handling?.amount ?? null;
  const documentationCharges = chargesResult.chargeMap.documentation?.amount ?? null;
  const customsCharges = chargesResult.chargeMap.customs?.amount ?? null;
  const truckingCharges = chargesResult.chargeMap.trucking?.amount ?? null;
  const otherCharges = chargesResult.chargeMap.other?.amount ?? null;

  const currency = chargesResult.currency;
  const quotedTotal = chargesResult.quotedTotal;
  const calculatedTotal = chargesResult.calculatedTotal;
  const totalAmount = quotedTotal !== null ? quotedTotal : calculatedTotal;

  // Add charge traceability
  for (const c of chargesResult.charges) {
    trace[c.category] = {
      value: c.amount,
      sourceText: c.originalSourceLine,
      line: c.lineNumber,
    };
  }

  if (quotedTotal !== null) {
    trace.quotedTotal = {
      value: quotedTotal,
      sourceText: `Quoted Total: ${quotedTotal} ${currency || ""}`,
      line: 1,
    };
  }
  if (calculatedTotal !== null) {
    trace.calculatedTotal = {
      value: calculatedTotal,
      sourceText: `Calculated Total: ${calculatedTotal} ${currency || ""}`,
      line: 1,
    };
  }

  // Execute deterministic date extraction for ETD, Sailing Date, Departure, ETA, Arrival Date, Valid Until, Validity, Rate Validity, Cutoff, Cut-Off
  const datesResult = extractDatesFromText(combined);
  const etd = datesResult.etd;
  const eta = datesResult.eta;
  const validityDateExtracted = datesResult.validityDate;
  const cutoffDate = datesResult.cutoffDate;

  // Add date traceability
  for (const d of datesResult.dates) {
    trace[`date_${d.category}`] = {
      value: d.isoDate || d.originalText,
      sourceText: d.originalSourceLine,
      line: d.lineNumber,
    };
  }

  // Schedule & Route Fields
  let transitTime: number | null = null;
  let sailingDate: string | null = etd || null;
  let validityDate: string | null = validityDateExtracted || null;
  let freeDays: number | null = null;
  let vesselName: string | null = null;
  let routing: string | null = null;
  let notes: string | null = null;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 11. Transit Time
    if (transitTime === null) {
      const ttMatch =
        line.match(
          /(?:transit\s*time|transit|t\/t)\s*[:=-]?\s*(?:approx\s*)?(\d+)\s*(?:days?|d)\b/i,
        ) || line.match(/\b(\d+)\s*(?:days?|d)\s+(?:transit\s*time|transit|t\/t)\b/i);
      if (ttMatch) {
        const days = parseInt(ttMatch[1], 10);
        if (days >= 1 && days <= 120) {
          transitTime = days;
          trace.transitTime = { value: days, sourceText: ttMatch[0], line: lineNum };
        }
      }
    }

    // 12. Sailing Date fallback (if not extracted by date engine)
    if (!sailingDate) {
      const sailMatch = line.match(
        /(?:sailing\s*date|etd|departure\s*date|estimated\s*sailing|sails?\s*(?:on|date)?)\s*[:=-]?\s*([0-9A-Za-z\s,\-_/]+?)(?:$|\n|,|\.)/i,
      );
      if (sailMatch) {
        const norm = normalizeDateString(sailMatch[1].trim());
        if (norm) {
          sailingDate = norm;
          trace.sailingDate = { value: norm, sourceText: sailMatch[0], line: lineNum };
        }
      }
    }

    // 13. Validity Date fallback (if not extracted by date engine)
    if (!validityDate) {
      const valMatch = line.match(
        /(?:valid(?:ity)?(?:\s*date|\s*until|\s*to|\s*through)?|rate\s*validity|expiry\s*date|expires?\s*(?:on)?)\s*[:=-]?\s*([0-9A-Za-z\s,\-_/]+?)(?:$|\n|,|\.)/i,
      );
      if (valMatch) {
        validityDate = valMatch[1].trim();
        trace.validityDate = { value: validityDate, sourceText: valMatch[0], line: lineNum };
      }
    }

    // 14. Free Days
    if (freeDays === null) {
      const fdMatch =
        line.match(
          /(?:free\s*days?|demurrage\s*(?:&|and)?\s*detention|d[\s/&]*d|free\s*time)\s*[:=-]?\s*(?:approx\s*)?(\d+)\s*(?:days?|d)?\b/i,
        ) || line.match(/\b(\d+)\s*(?:days?|d)\s+(?:free|detention|demurrage)\b/i);
      if (fdMatch) {
        const fDays = parseInt(fdMatch[1], 10);
        if (fDays >= 1 && fDays <= 60) {
          freeDays = fDays;
          trace.freeDays = { value: fDays, sourceText: fdMatch[0], line: lineNum };
        }
      }
    }

    // 15. Vessel Name
    if (!vesselName) {
      const vMatch = line.match(
        /(?:vessel(?:\s*name)?|ocean\s*vessel|mother\s*vessel|feeder(?:\s*vessel)?|vsl\b)\s*[:=-]?\s*([A-Za-z0-9\s.\-_]+?)(?:\s+(?:v\.|voy\.|voyage|v)?\s*([0-9A-Za-z]+))?(?:$|\n|,|\.)/i,
      );
      if (vMatch && vMatch[1].trim().length >= 3) {
        vesselName = vMatch[1].trim();
        trace.vesselName = { value: vesselName, sourceText: vMatch[0], line: lineNum };
      }
    }

    // 16. Routing
    if (!routing) {
      const routeMatch = line.match(
        /(?:routing|route)\s*[:=-]?\s*([A-Za-z0-9\s,\-_>→/]+?)(?:$|\n|\.)/i,
      );
      if (routeMatch && routeMatch[1].trim().length >= 3) {
        routing = routeMatch[1].trim();
        trace.routing = { value: routing, sourceText: routeMatch[0], line: lineNum };
      } else if (/\b(direct(?:\s*(?:call|service|shipment))?)\b/i.test(line)) {
        routing = "Direct Service";
        trace.routing = { value: routing, sourceText: line, line: lineNum };
      } else if (
        /(?:transshipment(?:\s*via)?|t\/s\s*(?:at|via)?)\s*[:=-]?\s*([A-Za-z\s]+)/i.test(line)
      ) {
        const tsMatch = line.match(
          /(?:transshipment(?:\s*via)?|t\/s\s*(?:at|via)?)\s*[:=-]?\s*([A-Za-z\s]+)/i,
        );
        routing = tsMatch ? `Transshipment via ${tsMatch[1].trim()}` : "Transshipment";
        trace.routing = { value: routing, sourceText: line, line: lineNum };
      }
    }
  });

  // Extract commercial conditions as notes
  const termsLines = lines.filter(
    (l) =>
      /subject\s+to|validity|terms|space\s+is|payment|demurrage|equipment\s*available/i.test(l) &&
      !l.toLowerCase().includes("signature") &&
      !l.toLowerCase().includes("regards"),
  );
  if (termsLines.length > 0) {
    notes = termsLines.slice(0, 3).join(" | ");
    trace.notes = { value: notes, sourceText: notes, line: 1 };
  }

  return {
    oceanFreight,
    originCharges,
    destinationCharges,
    thc,
    documentationCharges,
    customsCharges,
    truckingCharges,
    otherCharges,
    currency,
    totalAmount,
    quotedTotal,
    quoted_total: quotedTotal,
    calculatedTotal,
    calculated_total: calculatedTotal,
    hasDiscrepancy: chargesResult.hasDiscrepancy,
    discrepancyDifference: chargesResult.totals.discrepancyDifference,
    hasRange: chargesResult.hasRange,
    hasMissingCurrency: chargesResult.hasMissingCurrency,
    hasMissingAmount: chargesResult.hasMissingAmount,
    hasMultipleCurrencies: chargesResult.hasMultipleCurrencies,
    hasUnsupportedText:
      classification.category === "unknown" &&
      chargesResult.charges.length === 0 &&
      quotedTotal === null &&
      calculatedTotal === null,
    itemizedCharges: chargesResult.charges,
    charges: chargesResult.charges,
    chargeExtractionWarnings: chargesResult.warnings,
    transitTime,
    sailingDate,
    etd,
    eta,
    validityDate,
    cutoffDate,
    hasAmbiguousDate: datesResult.hasAmbiguousDate,
    extractedDates: datesResult.dates,
    dateExtractionWarnings: datesResult.warnings,
    freeDays,
    vesselName,
    routing,
    carrier,
    containerType,
    containerQuantity,
    notes,
    isDeclined,
    isConfirmed,
    classification,
    quotationCategory: classification.category,
    fieldTraceability: trace,
  };
}

// ============================================================================
// 4. DETERMINISTIC VALIDATION & REVIEW LOGIC
// ============================================================================

export type DeterministicQuotationStatus =
  | "confirmed"
  | "amount_missing"
  | "currency_missing"
  | "range"
  | "ambiguous"
  | "conflict"
  | "unreadable"
  | "unmatched"
  | "needs_review";

export interface QuotationValidationContext {
  isSenderVerified?: boolean;
  isForwarderUnknown?: boolean;
  forwarderMatchReason?: string;
  hasMultipleBookingNumbers?: boolean;
  detectedBookingNumbers?: string[];
  isBookingNumberMissing?: boolean;
  isBookingMatched?: boolean;
  bookingDetailsMismatch?: boolean;
  bookingMismatchReason?: string;
  hasUnreadableAttachments?: boolean;
  unreadableAttachmentReason?: string;
  isRevision?: boolean;
  hasUnsupportedText?: boolean;
  unsupportedTextReason?: string;
  hasMultipleCurrencies?: boolean;
}

export interface QuotationValidationResult {
  isValid: boolean;
  needsReview: boolean;
  status: "OFFER_RECEIVED" | "NEEDS_REVIEW" | "DECLINED" | "UNMATCHED";
  deterministicStatus: DeterministicQuotationStatus;
  deterministicStatuses: DeterministicQuotationStatus[];
  reviewReasons: string[];
  discrepancies: string[];
  triggeredConditions: {
    bookingNumberMissing: boolean;
    multipleBookingNumbers: boolean;
    forwarderUnknown: boolean;
    currencyMissing: boolean;
    chargeAmountMissing: boolean;
    amountIsRange: boolean;
    multipleCurrencies: boolean;
    totalConflict: boolean;
    attachmentUnreadable: boolean;
    dateAmbiguous: boolean;
    revisedQuotation: boolean;
    bookingDetailsMismatch: boolean;
    unsupportedText: boolean;
  };
}

/**
 * Deterministically validates the extracted quotation values against
 * all 13 Human Review Conditions without using AI confidence scores.
 *
 * Mark quotation as needs_review when:
 * 1. Booking number is missing
 * 2. Multiple booking numbers are found
 * 3. Forwarder is unknown
 * 4. Currency is missing
 * 5. Charge amount is missing
 * 6. Amount is a range
 * 7. Multiple currencies exist
 * 8. Quoted total conflicts with calculated total
 * 9. Attachment is unreadable
 * 10. Date is ambiguous
 * 11. Revised quotation is detected
 * 12. Booking details do not match
 * 13. Parser finds unsupported or unclear text
 *
 * Deterministic Statuses:
 * - confirmed
 * - amount_missing
 * - currency_missing
 * - range
 * - ambiguous
 * - conflict
 * - unreadable
 * - unmatched
 * - needs_review
 */
export function validateExtractedQuotation(
  fields: DeterministicQuotationFields,
  context?: QuotationValidationContext,
): QuotationValidationResult {
  const reviewReasons: string[] = [];
  const discrepancies: string[] = [];
  const statuses = new Set<DeterministicQuotationStatus>();

  const triggered = {
    bookingNumberMissing: false,
    multipleBookingNumbers: false,
    forwarderUnknown: false,
    currencyMissing: false,
    chargeAmountMissing: false,
    amountIsRange: false,
    multipleCurrencies: false,
    totalConflict: false,
    attachmentUnreadable: false,
    dateAmbiguous: false,
    revisedQuotation: false,
    bookingDetailsMismatch: false,
    unsupportedText: false,
  };

  // Rule 0: Decline handling
  if (fields.isDeclined) {
    return {
      isValid: true,
      needsReview: false,
      status: "DECLINED",
      deterministicStatus: "confirmed",
      deterministicStatuses: ["confirmed"],
      reviewReasons: [],
      discrepancies: [],
      triggeredConditions: triggered,
    };
  }

  // Condition 1: Booking number is missing
  if (
    context?.isBookingNumberMissing === true ||
    (context?.detectedBookingNumbers !== undefined && context.detectedBookingNumbers.length === 0)
  ) {
    triggered.bookingNumberMissing = true;
    reviewReasons.push("Booking number is missing in email subject, body, and attachments.");
    statuses.add("unmatched");
  }

  // Condition 2: Multiple booking numbers are found
  if (
    context?.hasMultipleBookingNumbers === true ||
    (context?.detectedBookingNumbers && context.detectedBookingNumbers.length > 1)
  ) {
    triggered.multipleBookingNumbers = true;
    reviewReasons.push(
      `Multiple booking numbers detected: [${(context.detectedBookingNumbers || []).join(
        ", ",
      )}]. Email marked for human review without automated assignment.`,
    );
    statuses.add("ambiguous");
  }

  // Condition 3: Forwarder is unknown
  if (context?.isForwarderUnknown === true) {
    triggered.forwarderUnknown = true;
    reviewReasons.push(
      context.forwarderMatchReason ||
        "Sender email does not match any registered forwarder in the master (exact email, contact email, registered domain). Marked as Unknown Forwarder and routed for human review.",
    );
    statuses.add("unmatched");
  } else if (context?.isSenderVerified === false) {
    triggered.forwarderUnknown = true;
    reviewReasons.push(
      "Sender email could not be verified against the registered forwarder master.",
    );
    statuses.add("unmatched");
  }

  // Condition 4: Currency is missing
  if (!fields.currency || fields.hasMissingCurrency === true) {
    triggered.currencyMissing = true;
    reviewReasons.push("Quotation currency is missing or unverified.");
    statuses.add("currency_missing");
  }

  // Condition 5: Charge amount is missing
  const effectiveRate =
    fields.oceanFreight || fields.totalAmount || fields.quotedTotal || fields.calculatedTotal;
  if (fields.hasMissingAmount === true || !effectiveRate || effectiveRate <= 0) {
    triggered.chargeAmountMissing = true;
    reviewReasons.push("Ocean freight rate or itemized charge amount is missing or <= 0.");
    statuses.add("amount_missing");
  }

  // Condition 6: Amount is a range
  if (fields.hasRange === true) {
    triggered.amountIsRange = true;
    reviewReasons.push(
      "One or more charge items contains a price range. Cannot choose arbitrary value without human review.",
    );
    statuses.add("range");
  }

  // Condition 7: Multiple currencies exist
  if (fields.hasMultipleCurrencies === true || context?.hasMultipleCurrencies === true) {
    triggered.multipleCurrencies = true;
    reviewReasons.push(
      "Multiple conflicting currencies detected across quotation charges. Total cannot be computed across mixed currencies.",
    );
    statuses.add("conflict");
  }

  // Condition 8: Quoted total conflicts with calculated total
  if (fields.hasDiscrepancy === true || fields.totalConflict === true) {
    triggered.totalConflict = true;
    const diffMsg = `Discrepancy detected: Quoted total (${fields.quotedTotal || fields.totalAmount || "N/A"} ${
      fields.currency || ""
    }) differs from calculated itemized charges sum (${fields.calculatedTotal || "N/A"} ${
      fields.currency || ""
    }) by ${fields.discrepancyDifference ?? ""}.`;
    discrepancies.push(diffMsg);
    reviewReasons.push(diffMsg);
    statuses.add("conflict");
  } else if (fields.totalAmount && fields.oceanFreight) {
    const itemizedSum =
      (fields.oceanFreight || 0) +
      (fields.originCharges || 0) +
      (fields.destinationCharges || 0) +
      (fields.thc || 0) +
      (fields.documentationCharges || 0) +
      (fields.customsCharges || 0) +
      (fields.truckingCharges || 0) +
      (fields.otherCharges || 0);

    const diff = Math.abs(itemizedSum - fields.totalAmount);
    const hasAnyOtherCharge = Boolean(
      fields.originCharges ||
      fields.destinationCharges ||
      fields.thc ||
      fields.documentationCharges ||
      fields.customsCharges ||
      fields.truckingCharges ||
      fields.otherCharges,
    );
    if (hasAnyOtherCharge && diff > 5) {
      triggered.totalConflict = true;
      const msg = `Sum of itemized charges ($${itemizedSum.toLocaleString()}) does not match explicitly stated total amount ($${fields.totalAmount.toLocaleString()}) (difference: $${diff.toFixed(
        2,
      )}).`;
      discrepancies.push(msg);
      reviewReasons.push(msg);
      statuses.add("conflict");
    }
  }

  // Condition 9: Attachment is unreadable
  if (
    context?.hasUnreadableAttachments === true ||
    fields.hasUnreadableAttachments === true ||
    fields.attachmentUnreadable === true ||
    context?.attachmentUnreadable === true
  ) {
    triggered.attachmentUnreadable = true;
    reviewReasons.push(
      context?.unreadableAttachmentReason ||
        (fields.unreadableAttachmentReasons && fields.unreadableAttachmentReasons[0]) ||
        "Attachment is unreadable or image/scanned without extractable text stream. Preserved for operator manual entry.",
    );
    statuses.add("unreadable");
  }

  // Condition 10: Date is ambiguous
  if (
    fields.hasAmbiguousDate === true ||
    (fields.dateExtractionWarnings && fields.dateExtractionWarnings.length > 0)
  ) {
    triggered.dateAmbiguous = true;
    const dateWarnings = fields.dateExtractionWarnings || [];
    if (dateWarnings.length > 0) {
      for (const dw of dateWarnings) {
        reviewReasons.push(dw);
      }
    } else {
      reviewReasons.push(
        "One or more extracted dates is ambiguous (e.g. DD/MM vs MM/DD numeric format). Marked for review.",
      );
    }
    statuses.add("ambiguous");
  }

  // Condition 11: Revised quotation is detected
  if (
    context?.isRevision === true ||
    fields.quotationCategory === "revision" ||
    fields.classification?.isRevision === true
  ) {
    triggered.revisedQuotation = true;
    reviewReasons.push(
      "Revised quotation detected (amendment / updated rate offer). Preserved prior quotation history and routed for human review.",
    );
    statuses.add("needs_review");
  }

  // Condition 12: Booking details do not match
  if (
    context?.isBookingMatched === false ||
    context?.bookingDetailsMismatch === true ||
    fields.hasBookingDetailsMismatch === true
  ) {
    triggered.bookingDetailsMismatch = true;
    reviewReasons.push(
      context?.bookingMismatchReason ||
        "Extracted booking number or quotation details do not match any active booking in system.",
    );
    statuses.add("unmatched");
  }

  // Condition 13: Parser finds unsupported or unclear text
  if (
    context?.hasUnsupportedText === true ||
    fields.hasUnsupportedText === true ||
    (fields.classification?.category === "unknown" && !effectiveRate)
  ) {
    triggered.unsupportedText = true;
    reviewReasons.push(
      context?.unsupportedTextReason ||
        (fields.unsupportedTextReasons && fields.unsupportedTextReasons[0]) ||
        "Parser finds unsupported or unclear text in quotation message. Manual operator review required.",
    );
    statuses.add("ambiguous");
    statuses.add("needs_review");
  }

  const needsReview = reviewReasons.length > 0;
  const status: "OFFER_RECEIVED" | "NEEDS_REVIEW" = needsReview ? "NEEDS_REVIEW" : "OFFER_RECEIVED";

  let primaryStatus: DeterministicQuotationStatus = "confirmed";
  if (needsReview) {
    statuses.add("needs_review");
    // Priority order for primary deterministic status
    if (triggered.chargeAmountMissing) {
      primaryStatus = "amount_missing";
    } else if (triggered.currencyMissing) {
      primaryStatus = "currency_missing";
    } else if (triggered.amountIsRange) {
      primaryStatus = "range";
    } else if (triggered.totalConflict || triggered.multipleCurrencies) {
      primaryStatus = "conflict";
    } else if (triggered.attachmentUnreadable) {
      primaryStatus = "unreadable";
    } else if (triggered.dateAmbiguous || triggered.multipleBookingNumbers) {
      primaryStatus = "ambiguous";
    } else if (
      triggered.bookingNumberMissing ||
      triggered.forwarderUnknown ||
      triggered.bookingDetailsMismatch
    ) {
      primaryStatus = "unmatched";
    } else {
      primaryStatus = "needs_review";
    }
  } else {
    statuses.add("confirmed");
  }

  return {
    isValid: !needsReview,
    needsReview,
    status,
    deterministicStatus: primaryStatus,
    deterministicStatuses: Array.from(statuses),
    reviewReasons,
    discrepancies,
    triggeredConditions: triggered,
  };
}

// ============================================================================
// 5. END-TO-END RULE-BASED FORWARDER QUOTATION PROCESSING PIPELINE
// ============================================================================

export interface ProcessForwarderQuotationEmailInput {
  emailMessageId: string;
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  subject?: string | null;
  body?: string | null;
  snippet?: string | null;
  senderEmail: string;
  senderName?: string | null;
  attachments?: IncomingAttachmentInput[];
  attachmentFilenames?: string[];
  userId?: string | null;
}

export interface ProcessForwarderQuotationEmailResult {
  success: boolean;
  emailMessageId: string;
  bookingNumber: string | null;
  detectedBookingNumbers: string[];
  bookingId: string | null;
  forwarderId: string | null;
  forwarderName: string | null;
  status: ForwarderQuoteStatus;
  quotationFields: DeterministicQuotationFields;
  validation: QuotationValidationResult;
  updatedForwarderRequest: ForwarderQuoteRequestRecord | null;
  message: string;
}

/**
 * End-to-End Processing Engine:
 *
 * Incoming Email
 *        ↓
 * Save Original Email
 *        ↓
 * Extract Booking Number Using Regex (Subject -> Body -> Attachment -> References)
 *        ↓
 * Match Existing Booking
 *        ↓
 * Match Forwarder Using Sender Email
 *        ↓
 * Extract Quotation Fields Using Rules and Keywords (16 Fields)
 *        ↓
 * Validate Extracted Values
 *        ↓
 * Save Quotation
 *        ↓
 * Update Booking Request Card
 *        ↓
 * Send to Human Review if Data Is Missing or Ambiguous
 *
 * DO NOT automatically approve or select a quotation.
 */
export async function processForwarderQuotationEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseOrInput: SupabaseClient<any, any, any> | ProcessForwarderQuotationEmailInput,
  maybeInput?: ProcessForwarderQuotationEmailInput,
): Promise<ProcessForwarderQuotationEmailResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: SupabaseClient<any, any, any>;
  let input: ProcessForwarderQuotationEmailInput;

  if (maybeInput) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase = supabaseOrInput as SupabaseClient<any, any, any>;
    input = maybeInput;
  } else {
    supabase = defaultSupabase;
    input = supabaseOrInput as ProcessForwarderQuotationEmailInput;
  }

  const {
    emailMessageId,
    gmailThreadId,
    gmailMessageId,
    inReplyTo,
    references,
    subject = "",
    body = "",
    snippet = "",
    senderEmail,
    senderName,
    attachments = [],
    attachmentFilenames = [],
    userId,
  } = input;

  const nowIso = new Date().toISOString();
  console.log(
    `[QuotationProcessor] 📨 Processing incoming forwarder quotation email: ${emailMessageId}`,
  );

  // Step 1: Save / Ensure original email is tracked
  const validMsgUuid = safeUuid(emailMessageId);

  // Step 2: Extract Booking Number using Regex in strict order:
  // 1. Email subject
  // 2. Email body
  // 3. Attachment filename
  // 4. Quotation reference
  const orderResult = extractBookingNumberStrictOrder({
    subject,
    body: body || snippet,
    attachmentFilenames,
    attachments,
    inReplyTo,
    references,
  });

  console.log(`[QuotationProcessor] Booking number extraction result:`, {
    status: orderResult.status,
    canonical: orderResult.canonicalBookingNumber,
    allDetected: orderResult.detectedBookingNumbers,
    foundIn: orderResult.foundIn,
  });

  // Step 2a: If no booking number found -> save email, mark unmatched, do not attach automatically
  if (orderResult.status === "UNMATCHED" || !orderResult.canonicalBookingNumber) {
    if (validMsgUuid) {
      try {
        await supabase
          .from("email_messages")
          .update({
            booking_id: null,
            movement_number: null,
            raw_headers: {
              match_status: "UNMATCHED",
              match_reason: orderResult.reason,
              detected_booking_numbers: orderResult.detectedBookingNumbers,
              processed_at: nowIso,
            },
          })
          .eq("id", validMsgUuid);
      } catch (err) {
        console.warn("[QuotationProcessor] Notice updating unmatched email_messages:", err);
      }
    }

    return {
      success: true,
      emailMessageId,
      bookingNumber: null,
      detectedBookingNumbers: orderResult.detectedBookingNumbers,
      bookingId: null,
      forwarderId: null,
      forwarderName: null,
      status: orderResult.isAmbiguous ? "NEEDS_REVIEW" : ("UNMATCHED" as ForwarderQuoteStatus),
      quotationFields: extractQuotationFieldsDeterministic(subject || "", body || snippet || ""),
      validation: {
        isValid: false,
        needsReview: orderResult.isAmbiguous,
        status: orderResult.isAmbiguous ? "NEEDS_REVIEW" : "UNMATCHED",
        reviewReasons: [orderResult.reason],
        discrepancies: [],
      },
      updatedForwarderRequest: null,
      message: orderResult.reason,
    };
  }

  const detectedBookingNumber = orderResult.canonicalBookingNumber;

  // Step 3: Match Existing Booking in Database / Local Storage
  let matchedBooking: {
    id: string;
    movement_number?: string;
    booking_reference?: string;
    reference?: string;
    origin?: string;
    destination?: string;
    pol_code?: string;
    pod_code?: string;
    container_type?: string;
    container_size?: string;
    container_count?: number;
    supplier_name?: string;
    buyer_name?: string;
  } | null = null;

  // Try matching against local bookings
  const localBookings = getLocalBookings();
  const foundLocal = localBookings.find((b) => {
    const bMov = normalizeBookingNumber(b.movement_number || "");
    const bRef = normalizeBookingNumber(b.booking_reference || b.reference || "");
    const bId = (b.id || "").toLowerCase();
    const target = detectedBookingNumber.toLowerCase();
    return bMov?.toLowerCase() === target || bRef?.toLowerCase() === target || bId === target;
  });

  if (foundLocal) {
    matchedBooking = {
      id: foundLocal.id,
      movement_number: foundLocal.movement_number,
      booking_reference: foundLocal.booking_reference || foundLocal.reference,
      origin: foundLocal.origin,
      destination: foundLocal.destination,
      pol_code: foundLocal.pol_code,
      pod_code: foundLocal.pod_code,
      container_type: foundLocal.container_type,
      container_size: foundLocal.container_size,
      container_count: foundLocal.container_count,
      supplier_name: foundLocal.supplier_name,
      buyer_name: foundLocal.buyer_name,
    };
  } else {
    // Query Supabase bookings table
    try {
      const { data: dbBookings } = await supabase
        .from("bookings")
        .select(
          "id, movement_number, booking_reference, reference, origin, destination, pol_code, pod_code, container_type, container_size, container_count, supplier_name, buyer_name",
        )
        .or(
          `movement_number.ilike.%${detectedBookingNumber}%,booking_reference.ilike.%${detectedBookingNumber}%`,
        )
        .limit(3);

      if (dbBookings && dbBookings.length > 0) {
        matchedBooking = dbBookings[0];
      }
    } catch (dbErr) {
      console.warn("[QuotationProcessor] Notice querying database bookings:", dbErr);
    }
  }

  // Step 4: Match Forwarder using sender email with Forwarder Master
  // Rules:
  // - Match sender email with existing forwarder master using:
  //   1. Exact sender email
  //   2. Forwarder contact email
  //   3. Sender domain, only if domain is registered in the forwarder master (and non-public)
  // - If no forwarder matches:
  //   * Save the email
  //   * Mark forwarder as unknown ("Unknown Forwarder", forwarderId: null)
  //   * Send it to human review (status: NEEDS_REVIEW)
  //   * DO NOT trust the sender display name alone!
  const cleanSender = (senderEmail || "").trim().toLowerCase();

  // Assemble comprehensive forwarder master list from local storage and Supabase database
  const localForwarders = getLocalForwarders();
  const forwarderMasterList: ForwarderMasterRecord[] = localForwarders.map((f) => ({
    id: f.id,
    name: f.name,
    company_name: f.company_name || f.name,
    email: f.email,
    contactEmail: f.contactEmail,
    contactPerson: f.contactPerson,
    notes: f.notes,
  }));

  try {
    const { data: dbForwarders } = await supabase
      .from("forwarders")
      .select("id, name, company_name, email, contact_email, contact_person, notes, website")
      .limit(100);

    if (dbForwarders && dbForwarders.length > 0) {
      const existingIds = new Set(forwarderMasterList.map((f) => f.id));
      for (const d of dbForwarders) {
        if (!existingIds.has(d.id)) {
          forwarderMasterList.push({
            id: d.id,
            name: d.name || d.company_name,
            company_name: d.company_name || d.name,
            email: d.email,
            contactEmail: d.contact_email,
            contactPerson: d.contact_person,
            website: d.website,
            notes: d.notes,
          });
        }
      }
    }
  } catch (fwdErr) {
    console.warn("[QuotationProcessor] Notice querying database forwarders:", fwdErr);
  }

  // Execute deterministic Forwarder Master Matching (no display name trust)
  const forwarderMatch = matchSenderWithForwarderMaster(cleanSender, forwarderMasterList, {
    senderDisplayName: senderName,
  });

  const matchedForwarderId = forwarderMatch.forwarderId;
  const matchedForwarderName = forwarderMatch.forwarderName;
  const matchedForwarderEmail = forwarderMatch.forwarderEmail || cleanSender;
  const isSenderVerified = forwarderMatch.isMatched;
  const isForwarderUnknown = forwarderMatch.isForwarderUnknown;

  console.log(`[QuotationProcessor] Forwarder match result:`, {
    sender: cleanSender,
    matched: isSenderVerified,
    forwarderId: matchedForwarderId,
    forwarderName: matchedForwarderName,
    matchedBy: forwarderMatch.matchedBy,
    isUnknown: isForwarderUnknown,
    reason: forwarderMatch.reason,
  });

  // Check existing RFQ records for this booking and verified forwarder
  const localRequests = getLocalForwarderRequests();
  let existingReqForBooking: ForwarderQuoteRequestRecord | undefined;
  if (isSenderVerified && matchedForwarderId) {
    existingReqForBooking = localRequests.find((r) => {
      const matchesBooking =
        (matchedBooking && r.bookingId === matchedBooking.id) ||
        (r.movementNumber && normalizeBookingNumber(r.movementNumber) === detectedBookingNumber);
      return matchesBooking && r.forwarderId === matchedForwarderId;
    });
  }

  // Step 5: Extract Quotation Fields Using Rules and Keywords (16 Fields)
  const quotationFields = extractQuotationFieldsDeterministic(subject || "", body || snippet || "");

  // Step 6: Validate Extracted Values (Zero AI!)
  const validation = validateExtractedQuotation(quotationFields, {
    isSenderVerified,
    isForwarderUnknown,
    forwarderMatchReason: forwarderMatch.reason,
    hasMultipleBookingNumbers: orderResult.isAmbiguous,
    detectedBookingNumbers: orderResult.detectedBookingNumbers,
    isBookingMatched: Boolean(matchedBooking),
  });

  // DO NOT automatically approve or award a quotation!
  const finalStatus: ForwarderQuoteStatus = validation.status;

  // Step 7: Save Quotation & Update Booking Request Card
  const bookingId = matchedBooking?.id || `bk-${detectedBookingNumber}`;
  const movementNo = matchedBooking?.movement_number || detectedBookingNumber;

  const newOfferData: ForwarderOfferData = {
    ratePerContainer:
      quotationFields.oceanFreight ||
      quotationFields.totalAmount ||
      quotationFields.quotedTotal ||
      undefined,
    totalFreight:
      quotationFields.quotedTotal ||
      quotationFields.totalAmount ||
      quotationFields.calculatedTotal ||
      quotationFields.oceanFreight ||
      undefined,
    currency: quotationFields.currency || "USD",
    containerType: quotationFields.containerType || matchedBooking?.container_type || "40HC",
    quantity: quotationFields.containerQuantity || matchedBooking?.container_count || 1,
    availability: quotationFields.isDeclined ? "Space Not Available" : "Space Available",
    etd: quotationFields.sailingDate || undefined,
    eta: undefined,
    transitDays: quotationFields.transitTime || undefined,
    freeDays: quotationFields.freeDays || undefined,
    carrier: quotationFields.carrier || "Ocean Carrier",
    vesselName: quotationFields.vesselName || undefined,
    validUntil: quotationFields.validityDate || undefined,
    additionalCharges: quotationFields.otherCharges
      ? `$${quotationFields.otherCharges} surcharges`
      : undefined,
    totalCost:
      quotationFields.quotedTotal ||
      quotationFields.totalAmount ||
      quotationFields.calculatedTotal ||
      undefined,
    notes: quotationFields.notes || undefined,
    receivedAt: nowIso,
    sourceEmailId: emailMessageId,
    originalEmailSubject: subject,
    originalEmailBody: body ? body.slice(0, 1000) : undefined,
    receivedVia: "Forwarder Quotation Email Module",
    traceability: quotationFields.fieldTraceability as Record<string, unknown>,
    reviewReasons: validation.reviewReasons,
    deterministicStatus: validation.deterministicStatus,
    deterministicStatuses: validation.deterministicStatuses,
    needsReview: validation.needsReview,
    unverifiedSender: !isSenderVerified,
    forwarderUnknown: isForwarderUnknown,
    forwarderMatchReason: forwarderMatch.reason,
    quotedTotal: quotationFields.quotedTotal || undefined,
    calculatedTotal: quotationFields.calculatedTotal || undefined,
    hasDiscrepancy: quotationFields.hasDiscrepancy,
    hasRange: quotationFields.hasRange,
    hasMissingCurrency: quotationFields.hasMissingCurrency,
    hasMissingAmount: quotationFields.hasMissingAmount,
    itemizedCharges: quotationFields.itemizedCharges as unknown as Record<string, unknown>[],
  };

  // Build / update ForwarderQuoteRequestRecord
  const targetReqId =
    existingReqForBooking?.id || `MFR-${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const updatedRequest: ForwarderQuoteRequestRecord = {
    id: targetReqId,
    bookingId,
    bookingReference: movementNo,
    movementNumber: movementNo,
    forwarderId: matchedForwarderId || "fwd-unknown",
    forwarderName:
      matchedForwarderName ||
      existingReqForBooking?.forwarderName ||
      input.senderName?.trim() ||
      (matchedForwarderEmail ? matchedForwarderEmail.split("@")[0] : "Freight Forwarder"),
    forwarderEmail: matchedForwarderEmail,
    status: finalStatus,
    gmailThreadId: gmailThreadId || undefined,
    gmailMessageId: gmailMessageId || undefined,
    sentAt: existingReqForBooking?.sentAt || nowIso,
    origin: matchedBooking?.origin || "POL",
    destination: matchedBooking?.destination || "POD",
    polCode: matchedBooking?.pol_code || "POL",
    polName: matchedBooking?.origin || "Port of Loading",
    podCode: matchedBooking?.pod_code || "POD",
    podName: matchedBooking?.destination || "Destination Port",
    supplierName: matchedBooking?.supplier_name || "Shipper",
    buyerName: matchedBooking?.buyer_name || "Consignee",
    containerType: matchedBooking?.container_type || "40HC",
    containerSize: (matchedBooking?.container_size as "20FT" | "40FT" | "40HC" | "45HC") || "40HC",
    containerCount: matchedBooking?.container_count || 1,
    cargoDescription: "Commercial Cargo",
    ratePerContainer: newOfferData.ratePerContainer,
    currency: newOfferData.currency,
    offerData: newOfferData,
    updatedAt: nowIso,
  };

  // Save to local storage
  const reqList = getLocalForwarderRequests();
  const reqIdx = reqList.findIndex((r) => r.id === updatedRequest.id);
  if (reqIdx !== -1) {
    reqList[reqIdx] = updatedRequest;
  } else {
    reqList.unshift(updatedRequest);
  }
  saveLocalForwarderRequests(reqList);

  // Step 8: Update email_messages and audit records
  if (validMsgUuid) {
    try {
      await supabase
        .from("email_messages")
        .update({
          booking_id: safeUuid(bookingId),
          movement_number: movementNo,
          forwarder_id: isForwarderUnknown ? null : safeUuid(matchedForwarderId),
          raw_headers: {
            match_status: validation.needsReview ? "NEEDS_REVIEW" : "MATCHED",
            matched_booking_number: detectedBookingNumber,
            forwarder_name: matchedForwarderName,
            forwarder_status: isForwarderUnknown ? "UNKNOWN" : "MATCHED",
            forwarder_unknown: isForwarderUnknown,
            forwarder_match_by: forwarderMatch.matchedBy,
            forwarder_match_reason: forwarderMatch.reason,
            quotation_status: finalStatus,
            review_reasons: validation.reviewReasons,
            extracted_fields: {
              oceanFreight: quotationFields.oceanFreight,
              originCharges: quotationFields.originCharges,
              destinationCharges: quotationFields.destinationCharges,
              thc: quotationFields.thc,
              documentationCharges: quotationFields.documentationCharges,
              customsCharges: quotationFields.customsCharges,
              truckingCharges: quotationFields.truckingCharges,
              otherCharges: quotationFields.otherCharges,
              currency: quotationFields.currency,
              totalAmount: quotationFields.totalAmount,
              quoted_total: quotationFields.quotedTotal,
              calculated_total: quotationFields.calculatedTotal,
              charges: quotationFields.itemizedCharges,
              transitTime: quotationFields.transitTime,
              sailingDate: quotationFields.sailingDate,
              validityDate: quotationFields.validityDate,
              freeDays: quotationFields.freeDays,
              vesselName: quotationFields.vesselName,
              routing: quotationFields.routing,
            },
            processed_at: nowIso,
          },
        })
        .eq("id", validMsgUuid);
    } catch (updErr) {
      console.warn("[QuotationProcessor] Notice updating email_messages:", updErr);
    }

    // Persist to database tables (forwarder_quote_requests, quotation_audit_logs)
    try {
      await persistQuotationToDatabase({
        emailMessageId,
        gmailMessageId,
        gmailThreadId,
        inReplyTo,
        references,
        senderEmail,
        senderName,
        subject,
        body,
        bookingId,
        movementNumber: movementNo,
        forwarderId: matchedForwarderId || "",
        forwarderName: matchedForwarderName || "",
        forwarderEmail: matchedForwarderEmail,
        extracted: {
          movementNumber: movementNo,
          forwarder: matchedForwarderName,
          forwarderEmail: matchedForwarderEmail,
          rate: quotationFields.oceanFreight || quotationFields.totalAmount,
          currency: quotationFields.currency,
          containerType: quotationFields.containerType,
          containerQuantity: quotationFields.containerQuantity,
          availability: quotationFields.isDeclined ? "Space Not Available" : "Space Available",
          etd: quotationFields.sailingDate,
          eta: null,
          transitTime: quotationFields.transitTime,
          freightCharges: quotationFields.oceanFreight,
          additionalCharges: quotationFields.otherCharges
            ? String(quotationFields.otherCharges)
            : null,
          totalCost: quotationFields.totalAmount,
          freeDays: quotationFields.freeDays,
          sailingVesselVoyage: quotationFields.vesselName,
          carrier: quotationFields.carrier,
          vesselName: quotationFields.vesselName,
          voyageNumber: null,
          rateValidity: quotationFields.validityDate,
          notes: quotationFields.notes,
          emailReceivedDate: nowIso,
          extractionConfidence: validation.isValid ? 0.95 : 0.65,
          isDeclined: quotationFields.isDeclined,
          isConfirmed: quotationFields.isConfirmed,
          extractionMethod: "RULE_BASED_DETERMINISTIC",
          presentFields: Object.keys(quotationFields).filter(
            (k) => (quotationFields as unknown as Record<string, unknown>)[k] !== null,
          ),
          missingFields: Object.keys(quotationFields).filter(
            (k) => (quotationFields as unknown as Record<string, unknown>)[k] === null,
          ),
        },
        newStatus: finalStatus,
        offerExtracted: Boolean(quotationFields.oceanFreight || quotationFields.totalAmount),
        unverifiedSender: !isSenderVerified,
        reviewReasons: validation.reviewReasons,
      });

      // Persist exact relational schema (incoming_emails, quotation_requests, quotations, quotation_charges)
      const bundleResult = await persistProcessedQuotationBundle({
        incomingEmailId: emailMessageId,
        gmailMessageId,
        gmailThreadId,
        senderName,
        senderEmail,
        subject: subject || "Quotation",
        body: body || "",
        detectedBookingNumbers: orderedBooking.detectedBookingNumbers,
        detectedForwarderId: matchedForwarderId,
        bookingId,
        forwarderRequestId: targetReqId,
        quotationReference: quotationFields.quotedTotal ? `Q-${detectedBookingNumber}` : null,
        quotationStatus: finalStatus,
        revisionNumber: existingReqForBooking ? 2 : 1,
        fields: quotationFields,
        requiresHumanReview: validation.needsReview,
        reviewReasons: validation.reviewReasons,
      });

      console.log("[QuotationProcessor] ✅ Database Save Verification:", {
        emailId: emailMessageId,
        messageId: gmailMessageId,
        detectedBookingNumber,
        bookingId,
        detectedForwarderId: matchedForwarderId,
        quotationId: bundleResult.quotation.id,
        forwarderRequestId: targetReqId,
        parserStatus: finalStatus,
        extractedQuotationFields: {
          currency: quotationFields.currency,
          oceanFreight: quotationFields.oceanFreight,
          originCharges: quotationFields.originCharges,
          destinationCharges: quotationFields.destinationCharges,
          thc: quotationFields.thc,
          documentationCharges: quotationFields.documentationCharges,
          customsCharges: quotationFields.customsCharges,
          truckingCharges: quotationFields.truckingCharges,
          quotedTotal: quotationFields.quotedTotal,
          calculatedTotal: quotationFields.calculatedTotal,
          transitTime: quotationFields.transitTime,
          sailingDate: quotationFields.sailingDate,
          validityDate: quotationFields.validityDate,
          freeDays: quotationFields.freeDays,
        },
        extractedChargeRowsCount: quotationFields.itemizedCharges.length,
        databaseSaveResult: {
          quotationSaved: Boolean(bundleResult.quotation.id),
          chargesSavedCount: bundleResult.charges.length,
          emailSaved: Boolean(bundleResult.incomingEmail.id),
        },
      });
    } catch (pErr) {
      console.warn("[QuotationProcessor] Notice persisting to DB:", pErr);
    }

    void recordQuotationAuditEvent({
      eventType: validation.needsReview ? "EXTRACTION_NEEDS_REVIEW" : "QUOTATION_SAVED",
      movementNumber: movementNo,
      bookingId,
      forwarderId: matchedForwarderId || "",
      forwarderName: matchedForwarderName || "",
      senderEmail,
      gmailMessageId,
      gmailThreadId,
      summary: `Deterministic Quotation Processed for ${matchedForwarderName}: ${quotationFields.currency || "USD"} ${newOfferData.ratePerContainer || "N/A"}. Status: ${finalStatus}.`,
      details: {
        bookingNumber: detectedBookingNumber,
        status: finalStatus,
        reviewReasons: validation.reviewReasons,
        discrepancies: validation.discrepancies,
        fields: quotationFields,
      },
    });

    void createLogisticsNotification({
      eventType: "QUOTATION_RECEIVED",
      movementNumber: movementNo,
      bookingReference: movementNo,
      bookingId: safeUuid(bookingId) || undefined,
      forwarderName: matchedForwarderName || senderName || "Freight Forwarder",
      rateText: quotationFields.oceanFreight
        ? `$${quotationFields.oceanFreight.toLocaleString()} ${quotationFields.currency || "USD"}`
        : undefined,
      userId,
      linkUrl: `/requests?ref=${encodeURIComponent(movementNo)}&openDrawer=true`,
    });
  }

  // Step 9: Dispatch Realtime Window Events so Booking Request Card updates immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: {
          requestId: updatedRequest.id,
          bookingId: updatedRequest.bookingId,
          movementNumber: updatedRequest.movementNumber,
          request: updatedRequest,
          status: finalStatus,
          rate: newOfferData.ratePerContainer,
          currency: newOfferData.currency,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_forwarder_offer_received", {
        detail: {
          requestId: updatedRequest.id,
          bookingId: updatedRequest.bookingId,
          movementNumber: updatedRequest.movementNumber,
          request: updatedRequest,
          offer: updatedRequest.offerData,
        },
      }),
    );
  }

  return {
    success: true,
    emailMessageId,
    bookingNumber: detectedBookingNumber,
    detectedBookingNumbers: orderResult.detectedBookingNumbers,
    bookingId,
    forwarderId: matchedForwarderId,
    forwarderName: matchedForwarderName,
    status: finalStatus,
    quotationFields,
    validation,
    updatedForwarderRequest: updatedRequest,
    message: validation.needsReview
      ? `Quotation extracted for booking ${detectedBookingNumber} (${matchedForwarderName}), but marked NEEDS_REVIEW: ${validation.reviewReasons.join("; ")}`
      : `Quotation successfully extracted and saved for booking ${detectedBookingNumber} (${matchedForwarderName}). Status: ${finalStatus}.`,
  };
}

/**
 * Backward-compatible alias for the rule-based email processing pipeline
 */
export const processIncomingForwarderEmailWithRules = processForwarderQuotationEmail;
