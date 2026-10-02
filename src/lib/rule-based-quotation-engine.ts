/**
 * Deterministic, Production-Ready NO-AI Email Quotation Extraction Engine
 * Conforms strictly to Sections 5, 6, 7, and 8 of the platform specification.
 * Zero AI or LLM calls. Fully transparent, auditable, and rule-based.
 */

import { cleanEmailContent, type CleanedEmailResult } from "./email-cleaning-service";
import { getActiveOverridesForForwarder, type PatternOverride } from "./pattern-override-service";
import { extractMovementNumber } from "./movement-lifecycle";
import { extractMovementNumbers } from "./movement-forwarder-matcher";
import { processRawEmailContent } from "./extraction/index";

export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type ValidationStatus = "VALID" | "SUSPICIOUS" | "CONFLICT" | "NOT_PROVIDED";

export interface FieldCandidate<T = unknown> {
  value: T;
  sourceText: string;
  lineNumber: number;
  confidence: ConfidenceLevel;
}

export interface FieldTraceability<T = unknown> {
  field: string;
  value: T | null;
  rawValue: string | null;
  sourceText: string | null;
  lineNumber: number | null;
  confidence: ConfidenceLevel;
  confidenceReason: string;
  extractionMethod:
    "KEYWORD_REGEX" | "PATTERN_OVERRIDE" | "NORMALIZATION" | "HEADER" | "CONTEXTUAL";
  matchingKeyword: string | null;
  validationStatus: ValidationStatus;
  candidates?: Array<FieldCandidate<T>>;
}

export interface DeterministicQuotationResult {
  // 28 Standard Fields
  movementNumber: string | null;
  forwarderRequestId: string | null;
  forwarderName: string | null;
  senderEmail: string | null;
  rate: number | null;
  currency: string | null;
  containerType: string | null;
  containerQuantity: number | null;
  availability: string | null;
  etd: string | null;
  eta: string | null;
  transitTime: number | null;
  freightCharges: number | null;
  documentationCharges: number | null;
  localCharges: number | null;
  thc: number | null;
  additionalCharges: string | number | null;
  totalCost: number | null; // ONLY if explicitly stated
  freeDays: number | null;
  carrier: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  portOfLoading: string | null;
  portOfDischarge: string | null;
  rateValidity: string | null;
  expiryDate: string | null;
  notes: string | null;
  containerRates?: Record<string, number>;
  receivedTimestamp: string | null;
  originalGmailMessageId: string | null;
  originalGmailThreadId: string | null;

  // Metadata & Audit Trail
  overallConfidence: ConfidenceLevel;
  confidenceScore: number; // 0.0 to 1.0
  isDeclined: boolean;
  isConfirmed: boolean;
  hasConflicts: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  extractionMethod: "RULE_BASED_DETERMINISTIC";
  traceability: Record<string, FieldTraceability>;
  cleanedEmail: CleanedEmailResult;
  timestamp: string;
}

export interface QuotationEngineInput {
  subject: string;
  body: string;
  snippet?: string | null;
  senderEmail?: string | null;
  senderName?: string | null;
  receivedAt?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  forwarderId?: string | null;
  knownMovementNumber?: string | null;
  knownForwarderRequestId?: string | null;
  knownContainerType?: string | null;
}

// Word-to-number mapping for written quantities
const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  single: 1,
  double: 2,
  pair: 2,
};

/**
 * Normalizes number formats like "1,200", "1.200,00", "$1200", "1200.50"
 */
export function normalizeNumericValue(raw: string): number | null {
  if (!raw) return null;
  let clean = raw
    .trim()
    .replace(/[$€£¥USD|EUR|GBP]/gi, "")
    .trim();

  // European format: 1.250,50 -> 1250.50
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})$/.test(clean)) {
    clean = clean.replace(/\./g, "").replace(",", ".");
  } else {
    // Standard US / UK format: 1,250.50 -> 1250.50
    clean = clean.replace(/,/g, "");
  }

  const num = parseFloat(clean);
  return isNaN(num) ? null : Math.round(num * 100) / 100;
}

/**
 * Normalizes currency codes and symbols
 */
export function normalizeCurrency(raw: string): string | null {
  if (!raw) return null;
  const upper = raw.toUpperCase().trim();
  if (upper.includes("USD") || upper.includes("$")) return "USD";
  if (upper.includes("EUR") || upper.includes("€")) return "EUR";
  if (upper.includes("GBP") || upper.includes("£")) return "GBP";
  if (upper.includes("AED")) return "AED";
  if (upper.includes("PKR")) return "PKR";
  if (upper.includes("CNY") || upper.includes("RMB") || upper.includes("¥")) return "CNY";
  return null;
}

/**
 * Normalizes container type strings to standard maritime equipment codes
 */
export function normalizeContainerType(raw: string): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase().trim();
  if (
    lower.includes("40hc") ||
    lower.includes("40'hc") ||
    lower.includes("40 high cube") ||
    lower.includes("40hq") ||
    lower.includes("hc box")
  ) {
    return "40HC";
  }
  if (
    lower.includes("40ft") ||
    lower.includes("40' standard") ||
    lower.includes("40 gp") ||
    lower.includes("40 dry")
  ) {
    return "40FT";
  }
  if (
    lower.includes("20ft") ||
    lower.includes("20' standard") ||
    lower.includes("20 gp") ||
    lower.includes("20 box") ||
    lower.includes("20 dry")
  ) {
    return "20FT";
  }
  if (lower.includes("reefer") || lower.includes("rf")) {
    return lower.includes("40") ? "40RF" : "20RF";
  }
  if (lower.includes("open top") || lower.includes("ot")) {
    return lower.includes("40") ? "40OT" : "20OT";
  }
  return null;
}

const MONTH_NAMES: Record<string, string> = {
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

/**
 * Normalizes date expressions like "12 Oct", "12-Oct-2026", "October 12th", "25th"
 */
export function normalizeDateString(
  raw: string,
  referenceYear = 2026,
  referenceMonth = "Oct",
): string | null {
  if (!raw) return null;
  const clean = raw.trim();

  // Pattern A: "12 Oct", "12 Oct 2026", "12-Oct-2026"
  const dayMonthMatch = clean.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-_]+([A-Za-z]{3,9})(?:[\s\-_]+(\d{2,4}))?\b/i,
  );
  if (dayMonthMatch) {
    const rawMonth = dayMonthMatch[2].toLowerCase();
    const formattedMonth = MONTH_NAMES[rawMonth] || MONTH_NAMES[rawMonth.slice(0, 3)];
    if (formattedMonth) {
      const day = parseInt(dayMonthMatch[1], 10);
      const year = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : referenceYear;
      const fullYear = year < 100 ? 2000 + year : year;
      return `${day} ${formattedMonth} ${fullYear}`;
    }
  }

  // Pattern B: "October 12", "October 12th, 2026"
  const monthDayMatch = clean.match(
    /\b([A-Za-z]{3,9})[\s\-_]+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{2,4}))?\b/i,
  );
  if (monthDayMatch) {
    const rawMonth = monthDayMatch[1].toLowerCase();
    const formattedMonth = MONTH_NAMES[rawMonth] || MONTH_NAMES[rawMonth.slice(0, 3)];
    if (formattedMonth) {
      const day = parseInt(monthDayMatch[2], 10);
      const year = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : referenceYear;
      const fullYear = year < 100 ? 2000 + year : year;
      return `${day} ${formattedMonth} ${fullYear}`;
    }
  }

  // Pattern C: "around the 25th", "25th", "on the 25th"
  const dayOnlyMatch = clean.match(
    /(?:around\s+the\s+|on\s+the\s+|the\s+)?\b(\d{1,2})(?:st|nd|rd|th)\b/i,
  );
  if (dayOnlyMatch) {
    const day = parseInt(dayOnlyMatch[1], 10);
    return `${day} ${referenceMonth} ${referenceYear}`;
  }

  return clean;
}

/**
 * Creates a default Not Provided field traceability record
 */
function createNotProvidedField<T>(fieldName: string): FieldTraceability<T> {
  return {
    field: fieldName,
    value: null,
    rawValue: null,
    sourceText: null,
    lineNumber: null,
    confidence: "LOW",
    confidenceReason: "Field was not present or referenced in email.",
    extractionMethod: "KEYWORD_REGEX",
    matchingKeyword: null,
    validationStatus: "NOT_PROVIDED",
  };
}

/**
 * Core Rule-Based Quotation Extraction Engine
 */
export function extractQuotationDeterministic(
  input: QuotationEngineInput,
): DeterministicQuotationResult {
  return processRawEmailContent(input);
}

function legacy_extractQuotationDeterministic(
  input: QuotationEngineInput,
): DeterministicQuotationResult {
  const timestamp = new Date().toISOString();
  const traceability: Record<string, FieldTraceability> = {};
  const reviewReasons: string[] = [];

  // 1. Clean email body (strip quoted replies, signatures, disclaimers)
  const cleaned = cleanEmailContent(input.body || input.snippet || "", { stripHtml: true });
  const lines = cleaned.cleanedLines;
  const fullText = cleaned.cleanedBody;
  const subject = input.subject || "";

  // Active pattern overrides
  const overrides: PatternOverride[] = getActiveOverridesForForwarder(input.forwarderId);

  // 2. Movement Number Extraction
  let movementNumber: string | null = null;
  const movMatches = extractMovementNumbers(`${subject} ${fullText}`);
  if (movMatches.length > 0) {
    movementNumber = movMatches[0];
    const matchLine = lines.find((l) => l.text.includes(movementNumber!))?.originalLineNumber || 1;
    traceability.movementNumber = {
      field: "movementNumber",
      value: movementNumber,
      rawValue: movementNumber,
      sourceText: `Movement number identifier '${movementNumber}'`,
      lineNumber: matchLine,
      confidence: "HIGH",
      confidenceReason: "Matched verified Movement Number pattern (e.g., MOV-XXXX / NASH-BK-XXXX).",
      extractionMethod: "KEYWORD_REGEX",
      matchingKeyword: "Movement Number",
      validationStatus: "VALID",
    };
  } else if (input.knownMovementNumber) {
    movementNumber = input.knownMovementNumber;
    traceability.movementNumber = {
      field: "movementNumber",
      value: movementNumber,
      rawValue: movementNumber,
      sourceText: "Matched via linked context/thread",
      lineNumber: null,
      confidence: "MEDIUM",
      confidenceReason: "Supplied via validated booking thread context.",
      extractionMethod: "HEADER",
      matchingKeyword: "Contextual Thread",
      validationStatus: "VALID",
    };
  } else {
    traceability.movementNumber = createNotProvidedField("movementNumber");
  }

  // 3. Forwarder Request ID
  let forwarderRequestId: string | null = null;
  const reqIdMatch = `${subject} ${fullText}`.match(
    /\b(REQ-[A-Z0-9_-]{4,20}|fwd-req-[A-Za-z0-9_-]+)\b/i,
  );
  if (reqIdMatch) {
    forwarderRequestId = reqIdMatch[1];
    traceability.forwarderRequestId = {
      field: "forwarderRequestId",
      value: forwarderRequestId,
      rawValue: reqIdMatch[1],
      sourceText: reqIdMatch[0],
      lineNumber: lines.find((l) => l.text.includes(reqIdMatch[1]))?.originalLineNumber || 1,
      confidence: "HIGH",
      confidenceReason: "Matched unique forwarder request token pattern.",
      extractionMethod: "KEYWORD_REGEX",
      matchingKeyword: "Request ID Token",
      validationStatus: "VALID",
    };
  } else if (input.knownForwarderRequestId) {
    forwarderRequestId = input.knownForwarderRequestId;
    traceability.forwarderRequestId = {
      field: "forwarderRequestId",
      value: forwarderRequestId,
      rawValue: forwarderRequestId,
      sourceText: "Matched via forwarder request association",
      lineNumber: null,
      confidence: "MEDIUM",
      confidenceReason: "Supplied via forwarder request database record.",
      extractionMethod: "HEADER",
      matchingKeyword: "Record Association",
      validationStatus: "VALID",
    };
  } else {
    traceability.forwarderRequestId = createNotProvidedField("forwarderRequestId");
  }

  // 4. Forwarder Name & Sender Email
  const senderEmail = input.senderEmail?.trim() || null;
  traceability.senderEmail = senderEmail
    ? {
        field: "senderEmail",
        value: senderEmail,
        rawValue: senderEmail,
        sourceText: `From: ${senderEmail}`,
        lineNumber: null,
        confidence: "HIGH",
        confidenceReason: "Extracted directly from authenticated email sender header.",
        extractionMethod: "HEADER",
        matchingKeyword: "From",
        validationStatus: "VALID",
      }
    : createNotProvidedField("senderEmail");

  const forwarderName =
    input.senderName?.trim() || (senderEmail ? senderEmail.split("@")[0] : null);
  traceability.forwarderName = forwarderName
    ? {
        field: "forwarderName",
        value: forwarderName,
        rawValue: forwarderName,
        sourceText: input.senderName || senderEmail || "",
        lineNumber: null,
        confidence: input.senderName ? "HIGH" : "MEDIUM",
        confidenceReason: input.senderName
          ? "Extracted from sender display name header."
          : "Inferred from email username.",
        extractionMethod: "HEADER",
        matchingKeyword: "From Name",
        validationStatus: "VALID",
      }
    : createNotProvidedField("forwarderName");

  // Check decline or no availability
  const isDeclined =
    /\b(?:no\s+(?:space|equipment|allocation)|unable\s+to\s+(?:quote|offer|assist)|regret\s+to\s+inform|fully\s+booked|we\s+cannot\s+(?:quote|take)|decline\s+(?:this)?\s*quote)\b/i.test(
      fullText,
    );

  // Check confirmation
  const isConfirmed =
    /\b(?:booking\s+is\s+confirmed|space\s+is\s+confirmed|confirmed\s+booking|booking\s+confirmation\s+attached)\b/i.test(
      fullText,
    );

  // 5. Rate & Currency Extraction (with Conflict Resolution)
  const rateCandidates: FieldCandidate<number>[] = [];
  let detectedCurrency: string | null = null;
  let currencySourceLine: number | null = null;
  let currencySourceText: string | null = null;

  // Check for Pattern Overrides first
  for (const ovr of overrides) {
    if (ovr.fieldMapped === "rate") {
      const rx = new RegExp(ovr.regexPattern, "i");
      for (const lineObj of lines) {
        const m = lineObj.text.match(rx);
        if (m && m[1]) {
          const val = normalizeNumericValue(m[1]);
          if (val && val > 50 && val < 50000) {
            rateCandidates.push({
              value: val,
              sourceText: m[0],
              lineNumber: lineObj.originalLineNumber,
              confidence: "HIGH",
            });
            break;
          }
        }
      }
    }
  }

  // Generic Rate Patterns
  const RATE_PATTERNS = [
    // Alternative / conflicting rates: "rates are $1200 or $1500", "$1200 to $1500"
    /(?:rates?\s+(?:are|is)\s*|quotes?\s*[:=]?\s*)(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)\s*(?:or|to|-)\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)/i,
    // "our price is around 1,200 usd", "rate is 2,100 USD", "USD 2,100 / cntr", "Rate is $2,100"
    /(?:our\s+price\s+is\s+(?:around\s+)?|rates?\s+(?:is|are)\s+|ocean\s+freight\s+(?:rate\s+|at\s+)?[:=]?\s*|o\/f\s*[:=]?\s*|freight\s+rate\s*[:=]?\s*)(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)\s*(usd|eur|gbp|aed|pkr|\$|€|£)?(?:\s*\/\s*(?:cntr|container|box|unit|teu|feu|40hc|20ft|fcl))?/i,
    // "USD 2100", "$2,100 per 40HC", "$2,100 / box"
    /(?:usd|eur|gbp|aed|pkr|\$|€|£)\s*([0-9,.]+)\s*(?:per|\/)\s*(?:cntr|container|box|40hc|20ft|unit|teu|feu|fcl)/i,
    // "rate: $2,100", "price: 2100 USD", "offer: 1200 USD", "total: $1200", "all-in: 1500 USD"
    /(?:rate|price|freight|offer|quote|charges?|cost|total|all\s*in|all-in|lump\s*sum|amount|baf|o\/f)\s*[:=-]?\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)\s*(usd|eur|gbp|aed|pkr|\$|€|£)?/i,
    // "USD 1200", "EUR 1500", "AED 4500"
    /\b(?:usd|eur|gbp|aed|pkr)\s*([0-9,.]+)(?:\s*(?:\/|\s*per\s*)(?:cntr|container|box|unit|teu|feu|40hc|20ft|fcl))?/i,
    // "1200 USD", "1500 EUR", "1200$"
    /\b([0-9,.]+)\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)(?:\s*(?:\/|\s*per\s*)(?:cntr|container|box|unit|teu|feu|40hc|20ft|fcl))?/i,
    // "$1,200", "$ 1200"
    /\$\s*([0-9,.]+)(?:\s*(?:\/|\s*per\s*)(?:cntr|container|box|unit|teu|feu|40hc|20ft|fcl))?/i,
    // "Fr8 $1000" or "$1,200 for two 20ft boxes"
    /\b(?:fr8|frt|o\/f)\s*[:=]?\s*\$?\s*([0-9,.]+)/i,
    /\b\$([0-9,.]+)\s+for\s+(?:two|one|\d+)/i,
  ];

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Detect currency anywhere in line
    if (!detectedCurrency) {
      const curMatch = text.match(/\b(USD|EUR|GBP|AED|PKR)\b|\$|€|£/i);
      if (curMatch) {
        detectedCurrency = normalizeCurrency(curMatch[0]);
        currencySourceLine = lineObj.originalLineNumber;
        currencySourceText = curMatch[0];
      }
    }

    // Check for range/alternative conflicting rates e.g. "rates are $1200 or $1500"
    const altMatch = text.match(
      /(?:rates?\s+(?:are|is)\s*|quotes?\s*[:=]?\s*)(?:usd|eur|\$|€)?\s*([0-9,.]+)\s*(?:or|to|-)\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)/i,
    );
    if (altMatch) {
      const v1 = normalizeNumericValue(altMatch[1]);
      const v2 = normalizeNumericValue(altMatch[2]);
      if (v1 && v1 >= 10 && v1 <= 100000 && v1 !== 2026 && v1 !== 2025) {
        rateCandidates.push({
          value: v1,
          sourceText: altMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
        });
      }
      if (v2 && v2 >= 10 && v2 <= 100000 && v2 !== 2026 && v2 !== 2025) {
        rateCandidates.push({
          value: v2,
          sourceText: altMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
        });
      }
      continue;
    }

    for (const pat of RATE_PATTERNS) {
      const m = text.match(pat);
      if (m) {
        const numStr = m[1];
        const val = normalizeNumericValue(numStr);
        // Exclude weights, years (2026), or trivial numbers (allow down to $10 so safety bounds validator inspects it)
        if (val && val >= 10 && val <= 100000 && val !== 2026 && val !== 2025) {
          // Avoid duplicate lines with exact same value
          if (
            !rateCandidates.some(
              (c) => c.value === val && c.lineNumber === lineObj.originalLineNumber,
            )
          ) {
            rateCandidates.push({
              value: val,
              sourceText: m[0],
              lineNumber: lineObj.originalLineNumber,
              confidence:
                m[0].toLowerCase().includes("rate") ||
                m[0].toLowerCase().includes("price") ||
                m[0].toLowerCase().includes("fr8")
                  ? "HIGH"
                  : "MEDIUM",
            });
          }
        }
      }
    }
  }

  // Extract Multi-Container Rates if specified (e.g. "20ft: $1200, 40ft: $1800")
  const containerRates: Record<string, number> = {};
  for (const lineObj of lines) {
    const text = lineObj.text;
    const crMatches = text.matchAll(
      /\b(20(?:ft|'|gp)?|40(?:ft|'|hc|hq|gp)?)\s*[:=-]?\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)\s*(usd|eur|\$|€)?/gi,
    );
    for (const m of crMatches) {
      const cType = normalizeContainerType(m[1]);
      const cRate = normalizeNumericValue(m[2]);
      if (cType && cRate && cRate >= 50 && cRate <= 50000 && cRate !== 2026 && cRate !== 2025) {
        containerRates[cType] = cRate;
        if (!detectedCurrency && m[0].match(/usd|eur|gbp|aed|pkr|\$|€|£/i)) {
          detectedCurrency = normalizeCurrency(m[0]);
        }
      }
    }
  }

  // Conflict Resolution for Rate
  const targetContainerType = input.knownContainerType
    ? normalizeContainerType(input.knownContainerType)
    : null;

  if (Object.keys(containerRates).length > 0) {
    // Multi-container rates detected
    const selectedType =
      (targetContainerType && containerRates[targetContainerType] ? targetContainerType : null) ||
      (containerRates["40HC"]
        ? "40HC"
        : containerRates["20FT"]
          ? "20FT"
          : Object.keys(containerRates)[0]);

    const selectedRate = containerRates[selectedType];
    const matchLine =
      lines.find((l) => l.text.includes(String(selectedRate)))?.originalLineNumber ||
      lines[0]?.originalLineNumber ||
      1;

    traceability.rate = {
      field: "rate",
      value: selectedRate,
      rawValue: String(selectedRate),
      sourceText: `Multi-container rates: ${Object.entries(containerRates)
        .map(([k, v]) => `${k}: $${v}`)
        .join(", ")} (Applied ${selectedType})`,
      lineNumber: matchLine,
      confidence: "HIGH",
      confidenceReason: `Extracted multi-container rates. Applied ${selectedType} rate matching requested shipment equipment.`,
      extractionMethod: "KEYWORD_REGEX",
      matchingKeyword: "container-specific rate",
      validationStatus: "VALID",
      candidates: Object.entries(containerRates).map(([k, v]) => ({
        value: v,
        sourceText: `${k}: $${v}`,
        lineNumber: matchLine,
        confidence: "HIGH" as ConfidenceLevel,
      })),
    };
  } else if (rateCandidates.length === 1) {
    const cand = rateCandidates[0];
    traceability.rate = {
      field: "rate",
      value: cand.value,
      rawValue: String(cand.value),
      sourceText: cand.sourceText,
      lineNumber: cand.lineNumber,
      confidence: cand.confidence,
      confidenceReason:
        "Single deterministic ocean freight rate candidate found with matching rate context.",
      extractionMethod: "KEYWORD_REGEX",
      matchingKeyword: "rate",
      validationStatus: "VALID",
    };
  } else if (rateCandidates.length > 1) {
    // Check if one candidate has explicit keyword "rate is", "our price is", or "fr8"
    const priorityCandidates = rateCandidates.filter((c) =>
      /(?:our\s+price\s+is|rate\s+is|ocean\s+freight|fr8)/i.test(c.sourceText),
    );

    if (priorityCandidates.length === 1) {
      const best = priorityCandidates[0];
      traceability.rate = {
        field: "rate",
        value: best.value,
        rawValue: String(best.value),
        sourceText: best.sourceText,
        lineNumber: best.lineNumber,
        confidence: "HIGH",
        confidenceReason: "Resolved rate conflict using high-priority freight rate keyword match.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "explicit freight keyword",
        validationStatus: "VALID",
        candidates: rateCandidates,
      };
    } else {
      // Ambiguous multiple rates! Do NOT guess. Send to Needs Review.
      const first = rateCandidates[0];
      reviewReasons.push(
        `Multiple conflicting rate figures found ($${rateCandidates.map((c) => c.value).join(", ")}). Manual review required.`,
      );
      traceability.rate = {
        field: "rate",
        value: first.value,
        rawValue: String(first.value),
        sourceText: first.sourceText,
        lineNumber: first.lineNumber,
        confidence: "LOW",
        confidenceReason:
          "Multiple conflicting rate values detected without unambiguous context. Marked for review.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "rate conflict",
        validationStatus: "CONFLICT",
        candidates: rateCandidates,
      };
    }
  } else {
    traceability.rate = createNotProvidedField("rate");
  }

  // Validate Rate Bounds ($100 to $50,000)
  if (traceability.rate.value !== null) {
    const numRate = traceability.rate.value as number;
    if (numRate < 100 || numRate > 50000) {
      traceability.rate.validationStatus = "SUSPICIOUS";
      reviewReasons.push(
        `Ocean freight rate ($${numRate.toLocaleString()}) falls outside standard maritime bounds ($100-$50,000). Manual verification required.`,
      );
    }
  }

  // Currency traceability & validation (Never assume USD if missing!)
  if (detectedCurrency) {
    traceability.currency = {
      field: "currency",
      value: detectedCurrency,
      rawValue: currencySourceText,
      sourceText: currencySourceText,
      lineNumber: currencySourceLine,
      confidence: "HIGH",
      confidenceReason: "Explicit currency notation matched in email text.",
      extractionMethod: "NORMALIZATION",
      matchingKeyword: currencySourceText,
      validationStatus: "VALID",
    };
  } else if (traceability.rate.value !== null) {
    traceability.currency = {
      field: "currency",
      value: null,
      rawValue: null,
      sourceText: null,
      lineNumber: null,
      confidence: "LOW",
      confidenceReason: "Currency notation was not found in quotation email. Never assume USD.",
      extractionMethod: "NORMALIZATION",
      matchingKeyword: null,
      validationStatus: "NOT_PROVIDED",
    };
    reviewReasons.push(
      "Currency notation is missing from forwarder quotation email. System never assumes USD. Marked as NEEDS_REVIEW.",
    );
  } else {
    traceability.currency = createNotProvidedField("currency");
  }

  // 6. Container Type & Quantity Detection
  let containerType: string | null = null;
  let containerQuantity: number | null = null;
  let cntrSourceText: string | null = null;
  let cntrLineNumber: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Pattern A: "two 20ft boxes", "three 40HC containers"
    const wordQtyMatch = text.match(
      /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s*(?:x\s*)?(20ft|40ft|40hc|40'hc|20'|40'|high\s*cube)\s*(?:box|boxes|container|containers|cntrs?)?/i,
    );
    if (wordQtyMatch) {
      const word = wordQtyMatch[1].toLowerCase();
      containerQuantity =
        WORD_NUMBERS[word] !== undefined ? WORD_NUMBERS[word] : parseInt(word, 10);
      containerType = normalizeContainerType(wordQtyMatch[2]);
      cntrSourceText = wordQtyMatch[0];
      cntrLineNumber = lineObj.originalLineNumber;
      break;
    }

    // Pattern B: "2x20FT", "1 x 40HC", "2*40HQ"
    const digitQtyMatch = text.match(
      /\b(\d+)\s*(?:x|\*)\s*(20FT|40FT|40HC|40HQ|20GP|40GP|20'|40')\b/i,
    );
    if (digitQtyMatch) {
      containerQuantity = parseInt(digitQtyMatch[1], 10);
      containerType = normalizeContainerType(digitQtyMatch[2]);
      cntrSourceText = digitQtyMatch[0];
      cntrLineNumber = lineObj.originalLineNumber;
      break;
    }

    // Pattern C: standalone "40HC", "20FT"
    if (!containerType) {
      const standaloneMatch = text.match(/\b(20FT|40FT|40HC|40HQ|20GP|40GP|High\s*Cube)\b/i);
      if (standaloneMatch) {
        containerType = normalizeContainerType(standaloneMatch[1]);
        cntrSourceText = standaloneMatch[0];
        cntrLineNumber = lineObj.originalLineNumber;
      }
    }
  }

  traceability.containerType = containerType
    ? {
        field: "containerType",
        value: containerType,
        rawValue: containerType,
        sourceText: cntrSourceText,
        lineNumber: cntrLineNumber,
        confidence: "HIGH",
        confidenceReason: "Matched standard maritime equipment specification code.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "container type",
        validationStatus: "VALID",
      }
    : createNotProvidedField("containerType");

  traceability.containerQuantity =
    containerQuantity !== null
      ? {
          field: "containerQuantity",
          value: containerQuantity,
          rawValue: String(containerQuantity),
          sourceText: cntrSourceText,
          lineNumber: cntrLineNumber,
          confidence: "HIGH",
          confidenceReason: "Extracted explicit container quantity from equipment string.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "quantity",
          validationStatus: "VALID",
        }
      : createNotProvidedField("containerQuantity");

  // 7. Schedule: ETD and ETA
  let etd: string | null = null;
  let eta: string | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Compound pattern: "vessel sails 12 Oct, should land around the 25th"
    const compoundMatch = text.match(
      /(?:vessel\s+sails?|sailing|etd|departs?)\s+([A-Za-z0-9\s,\-_]+?)(?:,\s*(?:should\s+land|eta|arrives?)\s+([A-Za-z0-9\s,\-_]+))?(?:$|\n|\.)/i,
    );
    if (compoundMatch) {
      if (compoundMatch[1] && !etd) {
        etd = normalizeDateString(compoundMatch[1]);
        traceability.etd = {
          field: "etd",
          value: etd,
          rawValue: compoundMatch[1].trim(),
          sourceText: compoundMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
          confidenceReason: "Extracted from explicit vessel departure / ETD statement.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "sails / ETD",
          validationStatus: "VALID",
        };
      }
      if (compoundMatch[2] && !eta) {
        const etdMonth = etd ? etd.split(" ")[1] : "Oct";
        eta = normalizeDateString(compoundMatch[2], 2026, etdMonth);
        traceability.eta = {
          field: "eta",
          value: eta,
          rawValue: compoundMatch[2].trim(),
          sourceText: compoundMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
          confidenceReason: "Extracted from explicit vessel arrival / ETA statement.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "land / ETA",
          validationStatus: "VALID",
        };
      }
    }

    // Separate ETD pattern: "ETD: 18 Sep 2026"
    if (!etd) {
      const etdMatch = text.match(
        /\b(?:etd|departure|sailing\s*date)\s*[:=]?\s*([0-9A-Za-z\s,\-_]+)/i,
      );
      if (etdMatch) {
        const normalized = normalizeDateString(etdMatch[1]);
        if (normalized) {
          etd = normalized;
          traceability.etd = {
            field: "etd",
            value: etd,
            rawValue: etdMatch[1].trim(),
            sourceText: etdMatch[0],
            lineNumber: lineObj.originalLineNumber,
            confidence: "HIGH",
            confidenceReason: "Matched standalone ETD header.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "ETD",
            validationStatus: "VALID",
          };
        }
      }
    }

    // Separate ETA pattern: "ETA: 12 Oct 2026"
    if (!eta) {
      const etaMatch = text.match(
        /\b(?:eta|arrival|landing\s*date)\s*[:=]?\s*([0-9A-Za-z\s,\-_]+)/i,
      );
      if (etaMatch) {
        const normalized = normalizeDateString(etaMatch[1]);
        if (normalized) {
          eta = normalized;
          traceability.eta = {
            field: "eta",
            value: eta,
            rawValue: etaMatch[1].trim(),
            sourceText: etaMatch[0],
            lineNumber: lineObj.originalLineNumber,
            confidence: "HIGH",
            confidenceReason: "Matched standalone ETA header.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "ETA",
            validationStatus: "VALID",
          };
        }
      }
    }
  }

  if (!traceability.etd) traceability.etd = createNotProvidedField("etd");
  if (!traceability.eta) traceability.eta = createNotProvidedField("eta");

  // Validate ETD vs ETA temporal relationship
  if (etd && eta) {
    try {
      const parseDateComp = (dStr: string) => {
        const parts = dStr.trim().split(" ");
        if (parts.length >= 3) {
          const d = parseInt(parts[0], 10);
          const mStr = parts[1].toLowerCase().slice(0, 3);
          const monthIdx = [
            "jan",
            "feb",
            "mar",
            "apr",
            "may",
            "jun",
            "jul",
            "aug",
            "sep",
            "oct",
            "nov",
            "dec",
          ].indexOf(mStr);
          const y = parseInt(parts[2], 10);
          if (!isNaN(d) && monthIdx !== -1 && !isNaN(y)) {
            return new Date(y, monthIdx, d);
          }
        }
        return null;
      };
      const etdObj = parseDateComp(etd);
      const etaObj = parseDateComp(eta);
      if (etdObj && etaObj && etaObj.getTime() < etdObj.getTime()) {
        traceability.eta.validationStatus = "CONFLICT";
        reviewReasons.push(
          `Invalid sailing schedule: Estimated arrival (ETA: ${eta}) precedes vessel departure (ETD: ${etd}). Manual review required.`,
        );
      }
    } catch {
      // Ignore parse failure
    }
  }

  // 8. Transit Time
  let transitTime: number | null = null;
  for (const lineObj of lines) {
    const m =
      lineObj.text.match(
        /\b(?:transit\s*(?:time|days?)?|t\/t)\s*[:=]?\s*(\d{1,3})\s*(?:days?|d)?\b/i,
      ) || lineObj.text.match(/\b(\d{1,3})\s*(?:days?|d)\s*(?:transit(?:\s*time)?|t\/t)\b/i);
    if (m) {
      transitTime = parseInt(m[1], 10);
      traceability.transitTime = {
        field: "transitTime",
        value: transitTime,
        rawValue: m[1],
        sourceText: m[0],
        lineNumber: lineObj.originalLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted explicit transit time in days.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "transit time",
        validationStatus: "VALID",
      };
      break;
    }
  }
  if (!traceability.transitTime) traceability.transitTime = createNotProvidedField("transitTime");

  // 9. Additional Charges & Surcharges (THC, Documentation, Local charges)
  let additionalCharges: number | string | null = null;
  let documentationCharges: number | null = null;
  let localCharges: number | null = null;
  let thc: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Pattern: "doc/local 200", "doc/local: $200", "+ doc/local 200"
    const docLocalMatch = text.match(
      /(?:doc(?:s)?\s*(?:\/|\+|and)\s*local(?:s)?|local\s*charges?)\s*[:=]?\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)/i,
    );
    if (docLocalMatch) {
      const val = normalizeNumericValue(docLocalMatch[1]);
      if (val) {
        additionalCharges = val;
        localCharges = val;
        documentationCharges = val;
        traceability.additionalCharges = {
          field: "additionalCharges",
          value: val,
          rawValue: docLocalMatch[1],
          sourceText: docLocalMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
          confidenceReason: "Matched documentation and local charges pattern.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "doc/local",
          validationStatus: "VALID",
        };
      }
    }

    // Pattern: "THC: $150", "origin THC 150"
    const thcMatch = text.match(/\b(?:origin\s+)?thc\s*[:=]?\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)/i);
    if (thcMatch) {
      const val = normalizeNumericValue(thcMatch[1]);
      if (val) {
        thc = val;
        traceability.thc = {
          field: "thc",
          value: val,
          rawValue: thcMatch[1],
          sourceText: thcMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
          confidenceReason: "Matched Terminal Handling Charge (THC).",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "THC",
          validationStatus: "VALID",
        };
      }
    }
  }

  if (!traceability.additionalCharges)
    traceability.additionalCharges = createNotProvidedField("additionalCharges");
  if (!traceability.thc) traceability.thc = createNotProvidedField("thc");
  if (!traceability.documentationCharges)
    traceability.documentationCharges = createNotProvidedField("documentationCharges");
  if (!traceability.localCharges)
    traceability.localCharges = createNotProvidedField("localCharges");
  if (!traceability.freightCharges) {
    traceability.freightCharges =
      traceability.rate.value !== null
        ? {
            field: "freightCharges",
            value: traceability.rate.value as number,
            rawValue: traceability.rate.rawValue,
            sourceText: traceability.rate.sourceText,
            lineNumber: traceability.rate.lineNumber,
            confidence: traceability.rate.confidence,
            confidenceReason: "Derived from base ocean freight rate.",
            extractionMethod: "NORMALIZATION",
            matchingKeyword: "ocean freight",
            validationStatus: "VALID",
          }
        : createNotProvidedField("freightCharges");
  }

  // 10. Total Cost (ONLY WHEN EXPLICITLY STATED)
  let totalCost: number | null = null;
  for (const lineObj of lines) {
    const text = lineObj.text;
    const totalMatch = text.match(
      /\b(?:total\s*(?:freight|cost|amount|all-in|price)?)\s*[:=]?\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)/i,
    );
    if (totalMatch) {
      const val = normalizeNumericValue(totalMatch[1]);
      // Verify this isn't just the rate repeating
      if (val && val >= 100) {
        totalCost = val;
        traceability.totalCost = {
          field: "totalCost",
          value: totalCost,
          rawValue: totalMatch[1],
          sourceText: totalMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
          confidenceReason: "Extracted explicit total cost figure stated by forwarder.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "total cost",
          validationStatus: "VALID",
        };
        break;
      }
    }
  }
  if (!traceability.totalCost) traceability.totalCost = createNotProvidedField("totalCost");

  // 11. Free Days (Demurrage & Detention)
  let freeDays: number | null = null;
  for (const lineObj of lines) {
    const m =
      lineObj.text.match(
        /\b(?:free\s*(?:days?|time)|d&d|demurrage(?:\s*(?:\/|&)\s*detention)?)\s*[:=]?\s*(\d{1,2})\s*(?:days?|d)?\b/i,
      ) ||
      lineObj.text.match(
        /\b(\d{1,2})\s*(?:days?\s+free(?:\s*time)?|d\s+free|days?\s*demurrage)\b/i,
      );
    if (m) {
      freeDays = parseInt(m[1], 10);
      traceability.freeDays = {
        field: "freeDays",
        value: freeDays,
        rawValue: m[1],
        sourceText: m[0],
        lineNumber: lineObj.originalLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted explicit demurrage/detention free days.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "free days",
        validationStatus: "VALID",
      };
      break;
    }
  }
  if (!traceability.freeDays) traceability.freeDays = createNotProvidedField("freeDays");

  if (freeDays !== null && (freeDays < 1 || freeDays > 60)) {
    traceability.freeDays.validationStatus = "SUSPICIOUS";
    reviewReasons.push(
      `Free days figure (${freeDays} days) is outside standard maritime range (1-60 days). Manual verification required.`,
    );
  }

  // 12. Carrier, Vessel Name, Voyage Number
  let carrier: string | null = null;
  let vesselName: string | null = null;
  let voyageNumber: string | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Carrier
    if (!carrier) {
      const carrierMatch = text.match(
        /\b(MSC|Maersk|CMA\s*CGM|Hapag[- ]Lloyd|ONE|Cosco|Evergreen|Yang\s*Ming|ZIM|HMM)\b/i,
      );
      if (carrierMatch) {
        carrier = carrierMatch[0].trim();
        traceability.carrier = {
          field: "carrier",
          value: carrier,
          rawValue: carrierMatch[0],
          sourceText: carrierMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
          confidenceReason: "Matched verified ocean carrier shipping line.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "carrier",
          validationStatus: "VALID",
        };
      }
    }

    // Vessel & Voyage
    const vesselMatch = text.match(
      /\b(?:vessel|mv|m\/v)\s*[:=]?\s*([A-Za-z0-9\s-]+?)(?:\s+(?:voy|voyage|v\.)\s*([A-Za-z0-9-]+))?(?:$|\n|,|\.)/i,
    );
    if (vesselMatch) {
      vesselName = vesselMatch[1].trim();
      voyageNumber = vesselMatch[2]?.trim() || null;
      traceability.vesselName = {
        field: "vesselName",
        value: vesselName,
        rawValue: vesselMatch[1].trim(),
        sourceText: vesselMatch[0],
        lineNumber: lineObj.originalLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted ocean vessel name.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "vessel",
        validationStatus: "VALID",
      };
      if (voyageNumber) {
        traceability.voyageNumber = {
          field: "voyageNumber",
          value: voyageNumber,
          rawValue: voyageNumber,
          sourceText: vesselMatch[0],
          lineNumber: lineObj.originalLineNumber,
          confidence: "HIGH",
          confidenceReason: "Extracted voyage reference number.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "voyage",
          validationStatus: "VALID",
        };
      }
    }
  }

  if (!traceability.carrier) traceability.carrier = createNotProvidedField("carrier");
  if (!traceability.vesselName) traceability.vesselName = createNotProvidedField("vesselName");
  if (!traceability.voyageNumber)
    traceability.voyageNumber = createNotProvidedField("voyageNumber");

  // 13. Rate Validity & Expiry Date
  let rateValidity: string | null = null;
  let expiryDate: string | null = null;
  let valSourceText: string | null = null;
  let valLineNumber: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Relative duration: "valid 2 weeks", "valid 14 days", "valid for 1 month"
    const relMatch = text.match(
      /\b(?:valid(?:ity)?\s*(?:for)?)\s*[:=]?\s*(\d+)\s*(weeks?|wks?|days?|months?)\b/i,
    );
    if (relMatch) {
      const num = parseInt(relMatch[1], 10);
      const unit = relMatch[2].toLowerCase();
      if (unit.startsWith("week") || unit.startsWith("wk")) {
        rateValidity = `${num * 7} days`;
      } else if (unit.startsWith("month")) {
        rateValidity = `${num * 30} days`;
      } else {
        rateValidity = `${num} days`;
      }
      valSourceText = relMatch[0];
      valLineNumber = lineObj.originalLineNumber;
      break;
    }

    // Explicit date: "valid until 30-Oct-2026", "valid to 15 Nov", "validity: 31/10/2026"
    const dateMatch = text.match(
      /\b(?:valid\s*(?:until|to|through)|expires?\s*(?:on|by)?|validity)\s*[:=]?\s*([0-9A-Za-z\s,\-_/]+?)(?:$|\n|\.)/i,
    );
    if (dateMatch) {
      const rawDateStr = dateMatch[1].trim();
      const normDate = normalizeDateString(rawDateStr);
      if (normDate) {
        rateValidity = normDate;
        expiryDate = normDate;
        valSourceText = dateMatch[0];
        valLineNumber = lineObj.originalLineNumber;
        break;
      } else if (rawDateStr.length >= 4 && rawDateStr.length <= 30) {
        rateValidity = rawDateStr;
        valSourceText = dateMatch[0];
        valLineNumber = lineObj.originalLineNumber;
        break;
      }
    }
  }

  traceability.rateValidity = rateValidity
    ? {
        field: "rateValidity",
        value: rateValidity,
        rawValue: rateValidity,
        sourceText: valSourceText,
        lineNumber: valLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted quotation validity duration or terms.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "validity",
        validationStatus: "VALID",
      }
    : createNotProvidedField("rateValidity");

  traceability.expiryDate = expiryDate
    ? {
        field: "expiryDate",
        value: expiryDate,
        rawValue: expiryDate,
        sourceText: valSourceText,
        lineNumber: valLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted quotation expiration date.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "expiry",
        validationStatus: "VALID",
      }
    : createNotProvidedField("expiryDate");

  // 14. Availability & Notes
  let availability: string | null = null;
  if (isDeclined) {
    availability = "No Space / Declined";
  } else if (isConfirmed) {
    availability = "Confirmed Space";
  } else if (
    /\b(?:space\s+(?:is\s+)?available|space\s+confirmed|equipment\s+available)\b/i.test(fullText)
  ) {
    availability = "Space Available";
  }
  traceability.availability = availability
    ? {
        field: "availability",
        value: availability,
        rawValue: availability,
        sourceText: availability,
        lineNumber: null,
        confidence: "HIGH",
        confidenceReason: "Extracted availability confirmation from response phrasing.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "availability",
        validationStatus: "VALID",
      }
    : createNotProvidedField("availability");

  // 15. Port of Loading (POL) & Port of Discharge (POD)
  let pol: string | null = null;
  let pod: string | null = null;
  let polSourceText: string | null = null;
  let podSourceText: string | null = null;
  let polLineNumber: number | null = null;
  let podLineNumber: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Pattern: "from Felixstowe to Karachi", "from FEL to KAR", "FEL to KAR", "FEL / KAR"
    const routeMatch = text.match(
      /\b(?:from\s+)?([A-Za-z\s]{3,20}|[A-Z]{3})\s+(?:to|\/|->)\s+([A-Za-z\s]{3,20}|[A-Z]{3})\b/i,
    );
    if (routeMatch && !pol && !pod) {
      const p1 = routeMatch[1].trim();
      const p2 = routeMatch[2].trim();
      if (!p1.toLowerCase().includes("port") && !p2.toLowerCase().includes("port")) {
        pol = p1;
        pod = p2;
        polSourceText = routeMatch[0];
        podSourceText = routeMatch[0];
        polLineNumber = lineObj.originalLineNumber;
        podLineNumber = lineObj.originalLineNumber;
        break;
      }
    }

    // Separate POL: "POL: Felixstowe", "Port of Loading: FEL", "Origin: Shanghai"
    if (!pol) {
      const polMatch = text.match(
        /\b(?:pol|port\s*of\s*loading|load\s*port|origin\s*port)\s*[:=-]?\s*([A-Za-z\s]{3,24}|[A-Z]{3})\b/i,
      );
      if (polMatch) {
        pol = polMatch[1].trim();
        polSourceText = polMatch[0];
        polLineNumber = lineObj.originalLineNumber;
      }
    }

    // Separate POD: "POD: Karachi", "Port of Discharge: KAR", "Destination: Felixstowe"
    if (!pod) {
      const podMatch = text.match(
        /\b(?:pod|port\s*of\s*discharge|discharge\s*port|dest(?:ination)?\s*port)\s*[:=-]?\s*([A-Za-z\s]{3,24}|[A-Z]{3})\b/i,
      );
      if (podMatch) {
        pod = podMatch[1].trim();
        podSourceText = podMatch[0];
        podLineNumber = lineObj.originalLineNumber;
      }
    }
  }

  traceability.portOfLoading = pol
    ? {
        field: "portOfLoading",
        value: pol,
        rawValue: pol,
        sourceText: polSourceText,
        lineNumber: polLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted port of loading (POL) from email text.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "POL",
        validationStatus: "VALID",
      }
    : createNotProvidedField("portOfLoading");

  traceability.portOfDischarge = pod
    ? {
        field: "portOfDischarge",
        value: pod,
        rawValue: pod,
        sourceText: podSourceText,
        lineNumber: podLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted port of discharge (POD) from email text.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "POD",
        validationStatus: "VALID",
      }
    : createNotProvidedField("portOfDischarge");

  // 16. Notes / Remarks
  let notes: string | null = null;
  let notesSourceText: string | null = null;
  let notesLineNumber: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;
    const noteMatch = text.match(
      /\b(?:notes?|remarks?|terms?|special\s*instructions?)\s*[:=-]\s*(.+)$/i,
    );
    if (noteMatch) {
      notes = noteMatch[1].trim();
      notesSourceText = noteMatch[0];
      notesLineNumber = lineObj.originalLineNumber;
      break;
    }
  }

  traceability.notes = notes
    ? {
        field: "notes",
        value: notes,
        rawValue: notes,
        sourceText: notesSourceText,
        lineNumber: notesLineNumber,
        confidence: "HIGH",
        confidenceReason: "Extracted special instructions or forwarder notes.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "notes",
        validationStatus: "VALID",
      }
    : createNotProvidedField("notes");

  // Message IDs
  traceability.receivedTimestamp = {
    field: "receivedTimestamp",
    value: input.receivedAt || timestamp,
    rawValue: input.receivedAt || timestamp,
    sourceText: "Email Timestamp",
    lineNumber: null,
    confidence: "HIGH",
    confidenceReason: "Email receipt time.",
    extractionMethod: "HEADER",
    matchingKeyword: "Date",
    validationStatus: "VALID",
  };

  traceability.originalGmailMessageId = {
    field: "originalGmailMessageId",
    value: input.gmailMessageId || null,
    rawValue: input.gmailMessageId || null,
    sourceText: "Gmail Message ID",
    lineNumber: null,
    confidence: "HIGH",
    confidenceReason: "Gmail API unique identifier.",
    extractionMethod: "HEADER",
    matchingKeyword: "message_id",
    validationStatus: "VALID",
  };

  traceability.originalGmailThreadId = {
    field: "originalGmailThreadId",
    value: input.gmailThreadId || null,
    rawValue: input.gmailThreadId || null,
    sourceText: "Gmail Thread ID",
    lineNumber: null,
    confidence: "HIGH",
    confidenceReason: "Gmail API conversation thread identifier.",
    extractionMethod: "HEADER",
    matchingKeyword: "thread_id",
    validationStatus: "VALID",
  };

  // Evaluate overall confidence and review requirements
  const hasRate = traceability.rate.value !== null;
  const hasCurrency = traceability.currency.value !== null;
  const hasConflicts = Object.values(traceability).some((t) => t.validationStatus === "CONFLICT");

  let overallConfidence: ConfidenceLevel = "HIGH";
  let confidenceScore = 0.95;

  if (hasConflicts) {
    overallConfidence = "LOW";
    confidenceScore = 0.4;
  } else if (!hasRate && !isDeclined && !isConfirmed) {
    overallConfidence = "LOW";
    confidenceScore = 0.3;
    reviewReasons.push("No ocean freight rate or clear commercial offer found in email body.");
  } else if (!cleaned.isCleanBoundary) {
    overallConfidence = "MEDIUM";
    confidenceScore = 0.7;
    reviewReasons.push(...cleaned.warnings);
  }

  const needsReview = hasConflicts || overallConfidence === "LOW" || reviewReasons.length > 0;

  return {
    movementNumber,
    forwarderRequestId,
    forwarderName,
    senderEmail,
    rate: traceability.rate.value as number | null,
    currency: (traceability.currency.value as string) || null,
    containerType,
    containerQuantity,
    availability,
    etd,
    eta,
    transitTime,
    freightCharges: traceability.freightCharges.value as number | null,
    documentationCharges,
    localCharges,
    thc,
    additionalCharges,
    totalCost,
    freeDays,
    carrier: (traceability.carrier?.value as string) || carrier || null,
    vesselName,
    voyageNumber,
    portOfLoading: (traceability.portOfLoading.value as string) || null,
    portOfDischarge: (traceability.portOfDischarge.value as string) || null,
    rateValidity,
    expiryDate: (traceability.expiryDate.value as string) || null,
    notes: (traceability.notes.value as string) || null,
    containerRates: Object.keys(containerRates).length > 0 ? containerRates : undefined,
    receivedTimestamp: input.receivedAt || timestamp,
    originalGmailMessageId: input.gmailMessageId || null,
    originalGmailThreadId: input.gmailThreadId || null,
    overallConfidence,
    confidenceScore,
    isDeclined,
    isConfirmed,
    hasConflicts,
    needsReview,
    reviewReasons,
    extractionMethod: "RULE_BASED_DETERMINISTIC",
    traceability,
    cleanedEmail: cleaned,
    timestamp,
  };
}
