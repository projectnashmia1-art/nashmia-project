/**
 * Production-Ready Rule-Based Email Quotation Extraction Service
 * Fully deterministic, transparent, and auditable.
 * Zero AI or LLM API calls. Never hallucinates or invents missing values.
 */

import {
  extractQuotationDeterministic,
  type DeterministicQuotationResult,
  type FieldTraceability,
  type QuotationEngineInput,
} from "./rule-based-quotation-engine";

export interface ExtractedQuotation {
  // 1. Movement Number
  movementNumber: string | null;
  // 2. Forwarder
  forwarder: string | null;
  forwarderEmail: string | null;
  // 3. Rate (Per Container Rate)
  rate: number | null;
  // 4. Currency
  currency: string | null;
  // 5. Container Type & Quantity
  containerType: string | null;
  containerQuantity: number | null;
  // 6. Availability
  availability: string | null;
  // 7. ETD
  etd: string | null;
  // 8. ETA
  eta: string | null;
  // 9. Transit time (in days)
  transitTime: number | null;
  // 10. Freight charges (base ocean freight)
  freightCharges: number | null;
  // 11. Additional charges (origin THC, bunker, documentation, etc.)
  additionalCharges: string | number | null;
  // 12. Total cost when explicitly provided (NULL if not stated in email)
  totalCost: number | null;
  // 13. Free days (combined demurrage/detention)
  freeDays: number | null;
  // 14. Sailing / vessel / voyage
  sailingVesselVoyage: string | null;
  carrier: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  // 15. Rate validity
  rateValidity: string | null;
  // 16. Notes / special instructions / terms
  notes: string | null;
  // 17. Email received date
  emailReceivedDate: string | null;
  // 18. Extraction confidence (0.0 to 1.0)
  extractionConfidence: number;

  // Metadata & Audit
  isDeclined: boolean;
  isConfirmed: boolean;
  extractionMethod: "RULE_BASED_DETERMINISTIC";
  presentFields: string[];
  missingFields: string[];
  traceability?: Record<string, FieldTraceability>;
  deterministicResult?: DeterministicQuotationResult;
}

export type QuotationExtractionInput = QuotationEngineInput;

/**
 * Main Rule-Based Extraction Function (100% Deterministic, Zero AI)
 */
export async function extractQuotationFromEmail(
  input: QuotationExtractionInput,
): Promise<ExtractedQuotation> {
  const result = extractQuotationDeterministic(input);

  const presentFields: string[] = [];
  const missingFields: string[] = [];

  const checkField = (name: string, val: unknown) => {
    if (val !== null && val !== undefined) {
      presentFields.push(name);
    } else {
      missingFields.push(name);
    }
  };

  checkField("Movement Number", result.movementNumber);
  checkField("Forwarder", result.forwarderName);
  checkField("Rate", result.rate);
  checkField("Currency", result.currency);
  checkField("Container type and quantity", result.containerType || result.containerQuantity);
  checkField("Availability", result.availability);
  checkField("ETD", result.etd);
  checkField("ETA", result.eta);
  checkField("Transit time", result.transitTime);
  checkField("Freight charges", result.freightCharges);
  checkField("Additional charges", result.additionalCharges);
  checkField("Total cost when explicitly provided", result.totalCost);
  checkField("Free days", result.freeDays);
  checkField("Sailing/vessel/voyage", result.vesselName || result.voyageNumber);
  checkField("Rate validity", result.rateValidity);
  checkField("Notes", result.notes);
  checkField("Email received date", result.receivedTimestamp);

  const sailingVesselVoyage =
    [result.carrier, result.vesselName, result.voyageNumber].filter(Boolean).join(" ") || null;

  return {
    movementNumber: result.movementNumber,
    forwarder: result.forwarderName,
    forwarderEmail: result.senderEmail,
    rate: result.rate,
    currency: result.currency,
    containerType: result.containerType,
    containerQuantity: result.containerQuantity,
    availability: result.availability,
    etd: result.etd,
    eta: result.eta,
    transitTime: result.transitTime,
    freightCharges: result.freightCharges,
    additionalCharges: result.additionalCharges,
    totalCost: result.totalCost,
    freeDays: result.freeDays,
    sailingVesselVoyage,
    carrier: result.carrier || null,
    vesselName: result.vesselName,
    voyageNumber: result.voyageNumber,
    rateValidity: result.rateValidity,
    notes: result.notes,
    emailReceivedDate: result.receivedTimestamp,
    extractionConfidence: result.confidenceScore,
    isDeclined: result.isDeclined,
    isConfirmed: result.isConfirmed,
    extractionMethod: "RULE_BASED_DETERMINISTIC",
    presentFields,
    missingFields,
    traceability: result.traceability,
    deterministicResult: result,
  };
}

/**
 * Backward-compatible synchronous rule-based extractor
 */
export function extractQuotationRuleBased(input: QuotationExtractionInput): ExtractedQuotation {
  const result = extractQuotationDeterministic(input);

  const presentFields: string[] = [];
  const missingFields: string[] = [];

  const checkField = (name: string, val: unknown) => {
    if (val !== null && val !== undefined) {
      presentFields.push(name);
    } else {
      missingFields.push(name);
    }
  };

  checkField("Movement Number", result.movementNumber);
  checkField("Forwarder", result.forwarderName);
  checkField("Rate", result.rate);
  checkField("Currency", result.currency);
  checkField("Container type and quantity", result.containerType || result.containerQuantity);
  checkField("Availability", result.availability);
  checkField("ETD", result.etd);
  checkField("ETA", result.eta);
  checkField("Transit time", result.transitTime);
  checkField("Freight charges", result.freightCharges);
  checkField("Additional charges", result.additionalCharges);
  checkField("Total cost when explicitly provided", result.totalCost);
  checkField("Free days", result.freeDays);
  checkField("Sailing/vessel/voyage", result.vesselName || result.voyageNumber);
  checkField("Rate validity", result.rateValidity);
  checkField("Notes", result.notes);
  checkField("Email received date", result.receivedTimestamp);

  const sailingVesselVoyage =
    [result.carrier, result.vesselName, result.voyageNumber].filter(Boolean).join(" ") || null;

  return {
    movementNumber: result.movementNumber,
    forwarder: result.forwarderName,
    forwarderEmail: result.senderEmail,
    rate: result.rate,
    currency: result.currency,
    containerType: result.containerType,
    containerQuantity: result.containerQuantity,
    availability: result.availability,
    etd: result.etd,
    eta: result.eta,
    transitTime: result.transitTime,
    freightCharges: result.freightCharges,
    additionalCharges: result.additionalCharges,
    totalCost: result.totalCost,
    freeDays: result.freeDays,
    sailingVesselVoyage,
    carrier: result.carrier || null,
    vesselName: result.vesselName,
    voyageNumber: result.voyageNumber,
    rateValidity: result.rateValidity,
    notes: result.notes,
    emailReceivedDate: result.receivedTimestamp,
    extractionConfidence: result.confidenceScore,
    isDeclined: result.isDeclined,
    isConfirmed: result.isConfirmed,
    extractionMethod: "RULE_BASED_DETERMINISTIC",
    presentFields,
    missingFields,
    traceability: result.traceability,
    deterministicResult: result,
  };
}

/**
 * Backend Validation Engine
 * Strictly controls booking status changes, award actions, and confirmation actions.
 */
export interface BackendValidationResult {
  allowed: boolean;
  action: "RECORD_OFFER" | "AWARD_FORWARDER" | "CONFIRM_MOVEMENT" | "DECLINE_REQUEST";
  reason: string;
  suggestedStatus?: string;
  requiresReview?: boolean;
}

export function validateQuotationForBackendAction(
  extracted: ExtractedQuotation,
  action: "RECORD_OFFER" | "AWARD_FORWARDER" | "CONFIRM_MOVEMENT" | "DECLINE_REQUEST",
  currentBooking?: { status?: string; movementNumber?: string; forwarderId?: string } | null,
): BackendValidationResult {
  // 1. Decline Action Validation
  if (action === "DECLINE_REQUEST") {
    if (!extracted.isDeclined) {
      return {
        allowed: false,
        action,
        reason:
          "Backend validation failed: Email content does not contain clear forwarder decline signals.",
      };
    }
    return {
      allowed: true,
      action,
      suggestedStatus: "DECLINED",
      reason: "Forwarder explicitly indicated space/equipment unavailability.",
    };
  }

  // 2. Record Offer Validation
  if (action === "RECORD_OFFER") {
    if (extracted.rate === null || extracted.rate <= 0) {
      return {
        allowed: false,
        action,
        requiresReview: true,
        reason:
          "Backend validation rejected offer status: No valid numeric freight rate present in extraction.",
      };
    }
    if (!extracted.currency) {
      return {
        allowed: false,
        action,
        requiresReview: true,
        reason: "Backend validation rejected offer status: Currency is missing.",
      };
    }
    return {
      allowed: true,
      action,
      suggestedStatus: "OFFER_RECEIVED",
      reason: `Valid quotation rate detected ($${extracted.rate} ${extracted.currency}). Authorized to update forwarder quote status.`,
    };
  }

  // 3. Award Forwarder Validation
  if (action === "AWARD_FORWARDER") {
    if (extracted.rate === null || extracted.rate <= 0) {
      return {
        allowed: false,
        action,
        reason: "Cannot award forwarder: Quotation contains no valid rate.",
      };
    }
    if (currentBooking?.status === "Delivered" || currentBooking?.status === "Cancelled") {
      return {
        allowed: false,
        action,
        reason: `Cannot award booking: Current booking status is locked (${currentBooking?.status}).`,
      };
    }
    return {
      allowed: true,
      action,
      suggestedStatus: "Pending Confirmation",
      reason:
        "Backend validation approved: Award transitions booking to 'Pending Confirmation' pending carrier verification.",
    };
  }

  // 4. Confirm Movement Validation
  if (action === "CONFIRM_MOVEMENT") {
    if (!extracted.isConfirmed) {
      return {
        allowed: false,
        action,
        requiresReview: true,
        reason:
          "Backend validation rejected automatic confirmation: No explicit carrier confirmation phrasing.",
      };
    }
    if (extracted.extractionConfidence < 0.85) {
      return {
        allowed: false,
        action,
        requiresReview: true,
        reason: `Backend validation held confirmation: Extraction confidence (${extracted.extractionConfidence}) is below safety threshold 0.85.`,
      };
    }
    return {
      allowed: true,
      action,
      suggestedStatus: "Booking Confirmed",
      reason: "Backend validation approved: High-confidence carrier confirmation verified.",
    };
  }

  return {
    allowed: false,
    action,
    reason: "Unrecognized backend action.",
  };
}
