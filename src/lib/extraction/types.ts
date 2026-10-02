/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - TYPES & INTERFACES
 *
 * Provides deterministic, auditable, zero-AI data structures for
 * processing raw email content to identify Rate, Currency, ETD, ETA,
 * equipment, charges, and schedule metadata.
 */

import type { CleanedEmailResult } from "../email-cleaning-service";

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

export interface ExtractedField<T> {
  field: string;
  value: T | null;
  traceability: FieldTraceability<T>;
  reviewReasons?: string[];
  candidates?: Array<FieldCandidate<T>>;
}

export interface RawEmailInput {
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

export interface ModularExtractionResult {
  // Key Commercial & Schedule Fields
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
  totalCost: number | null;
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

  // Metadata & Audit
  overallConfidence: ConfidenceLevel;
  confidenceScore: number;
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

export type DeterministicQuotationResult = ModularExtractionResult;
export type QuotationEngineInput = RawEmailInput;

export function createNotProvidedField<T>(fieldName: string): FieldTraceability<T> {
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

export function normalizeNumericValue(valStr: string): number | null {
  if (!valStr) return null;
  let clean = valStr.trim();
  clean = clean.replace(/^(?:usd|eur|gbp|aed|pkr|\$|€|£)\s*/i, "");
  clean = clean.replace(/\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)$/i, "");

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
