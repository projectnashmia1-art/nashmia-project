/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - ORCHESTRATION PIPELINE
 *
 * Coordinates modular field extractors (Rate, Currency, Schedule ETD/ETA, Equipment,
 * Charges, Sailing) to process raw email content deterministically with zero AI/LLM calls.
 * Produces structured records, field-level traceability, and validation audit metadata.
 */

import { cleanEmailContent, type CleanedEmailResult } from "../email-cleaning-service";
import { getActiveOverridesForForwarder, type PatternOverride } from "../pattern-override-service";
import { extractMovementNumbers } from "../movement-forwarder-matcher";
import {
  type RawEmailInput,
  type ModularExtractionResult,
  type FieldTraceability,
  type ConfidenceLevel,
  createNotProvidedField,
} from "./types";
import { extractRateDeterministic } from "./rate-extractor";
import { extractCurrencyDeterministic } from "./currency-extractor";
import { extractScheduleDeterministic } from "./schedule-extractor";
import { extractContainerDeterministic } from "./container-extractor";
import { extractChargesDeterministic } from "./charges-extractor";
import { extractSailingDeterministic } from "./sailing-extractor";

/**
 * Main engine processing function: processes raw email content into structured quotation fields.
 */
export function processRawEmailContent(input: RawEmailInput): ModularExtractionResult {
  const timestamp = new Date().toISOString();
  const traceability: Record<string, FieldTraceability> = {};
  const reviewReasons: string[] = [];

  // 1. Clean raw email content (strip HTML, quoted replies, signatures, disclaimer footers)
  const cleaned: CleanedEmailResult = cleanEmailContent(input.body || input.snippet || "", {
    stripHtml: true,
  });
  const lines = cleaned.cleanedLines;
  const fullText = cleaned.cleanedBody;
  const subject = input.subject || "";

  // 2. Active Pattern Overrides (for forwarder-specific adjustments)
  const overrides: PatternOverride[] = getActiveOverridesForForwarder(input.forwarderId);

  // 3. Movement Number Extraction
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

  // 4. Forwarder Request ID
  let forwarderRequestId: string | null = null;
  const reqMatch = `${subject} ${fullText}`.match(/\b(MFR-[0-9a-fA-F-]+|REQ-[0-9a-zA-Z-]+)\b/);
  if (reqMatch) {
    forwarderRequestId = reqMatch[1];
    traceability.forwarderRequestId = {
      field: "forwarderRequestId",
      value: forwarderRequestId,
      rawValue: forwarderRequestId,
      sourceText: `Forwarder request identifier '${forwarderRequestId}'`,
      lineNumber: 1,
      confidence: "HIGH",
      confidenceReason: "Matched forwarder request tracking ID pattern.",
      extractionMethod: "KEYWORD_REGEX",
      matchingKeyword: "Request ID",
      validationStatus: "VALID",
    };
  } else if (input.knownForwarderRequestId) {
    forwarderRequestId = input.knownForwarderRequestId;
    traceability.forwarderRequestId = {
      field: "forwarderRequestId",
      value: forwarderRequestId,
      rawValue: forwarderRequestId,
      sourceText: "Supplied via known request identifier",
      lineNumber: null,
      confidence: "HIGH",
      confidenceReason: "Matched via request tracking composite key.",
      extractionMethod: "HEADER",
      matchingKeyword: "Request Tracking",
      validationStatus: "VALID",
    };
  } else {
    traceability.forwarderRequestId = createNotProvidedField("forwarderRequestId");
  }

  // 5. Modular Extraction: Rate Extractor
  const rateResult = extractRateDeterministic({
    lines,
    knownContainerType: input.knownContainerType,
  });
  traceability.rate = rateResult.rateField.traceability;
  reviewReasons.push(...rateResult.reviewReasons);
  let hasConflicts = rateResult.hasConflicts;

  // Check pattern overrides for rate
  for (const ov of overrides) {
    if (ov.field === "rate" && ov.regexPattern) {
      try {
        const customReg = new RegExp(ov.regexPattern, "i");
        const customMatch = fullText.match(customReg);
        if (customMatch && customMatch[1]) {
          const customVal = parseFloat(customMatch[1].replace(/,/g, ""));
          if (!isNaN(customVal)) {
            rateResult.rateField.value = customVal;
            traceability.rate = {
              field: "rate",
              value: customVal,
              rawValue: customMatch[0],
              sourceText: `Matched custom rule '${ov.name}': ${customMatch[0]}`,
              lineNumber: null,
              confidence: "HIGH",
              confidenceReason: `Applied approved pattern override: ${ov.name}`,
              extractionMethod: "PATTERN_OVERRIDE",
              matchingKeyword: ov.name,
              validationStatus: "VALID",
            };
          }
        }
      } catch (regErr) {
        console.warn(`[ModularExtractionEngine] Invalid regex in override '${ov.name}':`, regErr);
      }
    }
  }

  // 6. Modular Extraction: Currency Extractor
  const currencyResult = extractCurrencyDeterministic({
    lines,
    rateValue: rateResult.rateField.value,
  });
  traceability.currency = currencyResult.currencyField.traceability;
  reviewReasons.push(...currencyResult.reviewReasons);

  // 7. Modular Extraction: Container Extractor
  const containerResult = extractContainerDeterministic({
    lines,
    knownContainerType: input.knownContainerType,
  });
  traceability.containerType = containerResult.containerTypeField.traceability;
  traceability.containerQuantity = containerResult.containerQuantityField.traceability;
  traceability.freeDays = containerResult.freeDaysField.traceability;

  // 8. Modular Extraction: Schedule Extractor (ETD, ETA, Transit Time)
  const scheduleResult = extractScheduleDeterministic({
    lines,
  });
  traceability.etd = scheduleResult.etdField.traceability;
  traceability.eta = scheduleResult.etaField.traceability;
  traceability.transitTime = scheduleResult.transitTimeField.traceability;
  reviewReasons.push(...scheduleResult.reviewReasons);
  if (scheduleResult.hasConflicts) {
    hasConflicts = true;
  }

  // 9. Modular Extraction: Charges & Surcharges Extractor
  const chargesResult = extractChargesDeterministic({
    lines,
    baseRate: rateResult.rateField.value,
  });
  traceability.freightCharges = chargesResult.freightChargesField.traceability;
  traceability.thc = chargesResult.thcField.traceability;
  traceability.documentationCharges = chargesResult.documentationChargesField.traceability;
  traceability.localCharges = chargesResult.localChargesField.traceability;
  traceability.additionalCharges = chargesResult.additionalChargesField.traceability;
  traceability.totalCost = chargesResult.totalCostField.traceability;
  traceability.rateValidity = chargesResult.rateValidityField.traceability;

  // 10. Modular Extraction: Sailing & Carrier Extractor
  const sailingResult = extractSailingDeterministic({
    lines,
    subject,
  });
  traceability.carrier = sailingResult.carrierField.traceability;
  traceability.vesselName = sailingResult.vesselNameField.traceability;
  traceability.voyageNumber = sailingResult.voyageNumberField.traceability;

  // 11. Notes & Special Terms
  let notes: string | null = null;
  const termsLines = lines.filter(
    (l) =>
      /subject\s+to|validity|terms|space\s+is|transit|payment|demurrage/i.test(l.text) &&
      !l.text.toLowerCase().includes("signature"),
  );
  if (termsLines.length > 0) {
    notes = termsLines
      .slice(0, 3)
      .map((l) => l.text)
      .join(" | ");
    traceability.notes = {
      field: "notes",
      value: notes,
      rawValue: notes,
      sourceText: notes,
      lineNumber: termsLines[0]?.originalLineNumber || 1,
      confidence: "MEDIUM",
      confidenceReason: "Extracted commercial conditions and operational notes.",
      extractionMethod: "KEYWORD_REGEX",
      matchingKeyword: "terms",
      validationStatus: "VALID",
    };
  } else {
    traceability.notes = createNotProvidedField("notes");
  }

  // 12. Forwarder Metadata
  traceability.forwarderName = input.senderName
    ? {
        field: "forwarderName",
        value: input.senderName,
        rawValue: input.senderName,
        sourceText: `Header From: ${input.senderName}`,
        lineNumber: 1,
        confidence: "HIGH",
        confidenceReason: "Extracted from verified email sender display name.",
        extractionMethod: "HEADER",
        matchingKeyword: "From",
        validationStatus: "VALID",
      }
    : createNotProvidedField("forwarderName");

  traceability.senderEmail = input.senderEmail
    ? {
        field: "senderEmail",
        value: input.senderEmail,
        rawValue: input.senderEmail,
        sourceText: input.senderEmail,
        lineNumber: 1,
        confidence: "HIGH",
        confidenceReason: "Extracted from verified email header address.",
        extractionMethod: "HEADER",
        matchingKeyword: "From Email",
        validationStatus: "VALID",
      }
    : createNotProvidedField("senderEmail");

  // 13. Ports of Loading and Discharge
  traceability.portOfLoading = createNotProvidedField("portOfLoading");
  traceability.portOfDischarge = createNotProvidedField("portOfDischarge");

  for (const lineObj of lines) {
    const text = lineObj.text;
    const polMatch = text.match(
      /(?:pol|origin|port\s+of\s+loading)\s*[:=-]?\s*([A-Za-z\s]+?)(?:$|\n|,|\.)/i,
    );
    if (polMatch) {
      traceability.portOfLoading = {
        field: "portOfLoading",
        value: polMatch[1].trim(),
        rawValue: polMatch[0],
        sourceText: polMatch[0],
        lineNumber: lineObj.originalLineNumber,
        confidence: "HIGH",
        confidenceReason: "Matched port of loading declaration.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "POL",
        validationStatus: "VALID",
      };
      break;
    }
  }

  for (const lineObj of lines) {
    const text = lineObj.text;
    const podMatch = text.match(
      /(?:pod|destination|port\s+of\s+discharge)\s*[:=-]?\s*([A-Za-z\s]+?)(?:$|\n|,|\.)/i,
    );
    if (podMatch) {
      traceability.portOfDischarge = {
        field: "portOfDischarge",
        value: podMatch[1].trim(),
        rawValue: podMatch[0],
        sourceText: podMatch[0],
        lineNumber: lineObj.originalLineNumber,
        confidence: "HIGH",
        confidenceReason: "Matched port of discharge declaration.",
        extractionMethod: "KEYWORD_REGEX",
        matchingKeyword: "POD",
        validationStatus: "VALID",
      };
      break;
    }
  }

  traceability.rateValidity = chargesResult.rateValidityField.traceability;
  traceability.expiryDate = chargesResult.rateValidityField.traceability;

  // 14. Confidence Score Calculation
  const keyFieldWeights = [
    { field: "rate", weight: 0.35 },
    { field: "currency", weight: 0.15 },
    { field: "containerType", weight: 0.15 },
    { field: "etd", weight: 0.15 },
    { field: "eta", weight: 0.1 },
    { field: "freeDays", weight: 0.05 },
    { field: "transitTime", weight: 0.05 },
  ];

  let weightedSum = 0;
  for (const fw of keyFieldWeights) {
    const tf = traceability[fw.field];
    if (tf && tf.value !== null && tf.validationStatus === "VALID") {
      weightedSum +=
        fw.weight * (tf.confidence === "HIGH" ? 1.0 : tf.confidence === "MEDIUM" ? 0.8 : 0.5);
    }
  }

  // Deduct penalty if conflicts exist or rate is suspicious
  if (hasConflicts) weightedSum = Math.max(0.2, weightedSum - 0.3);
  if (traceability.rate?.validationStatus === "SUSPICIOUS")
    weightedSum = Math.max(0.2, weightedSum - 0.25);
  if (traceability.currency?.value === null && traceability.rate?.value !== null) {
    weightedSum = Math.max(0.2, weightedSum - 0.3);
  }

  const confidenceScore = sailingResult.isDeclined ? 0.95 : Math.round(weightedSum * 100) / 100;
  const overallConfidence: ConfidenceLevel =
    confidenceScore >= 0.8 ? "HIGH" : confidenceScore >= 0.5 ? "MEDIUM" : "LOW";

  // Needs Review logic: An explicit decline is a valid definitive forwarder response and does not trigger review unless conflicts exist
  const needsReview = sailingResult.isDeclined
    ? false
    : hasConflicts ||
      reviewReasons.length > 0 ||
      overallConfidence === "LOW" ||
      traceability.rate?.validationStatus === "CONFLICT" ||
      traceability.rate?.validationStatus === "SUSPICIOUS" ||
      (traceability.rate?.value !== null && traceability.currency?.value === null);

  return {
    movementNumber,
    forwarderRequestId,
    forwarderName: (traceability.forwarderName?.value as string) || null,
    senderEmail: (traceability.senderEmail?.value as string) || null,
    rate: rateResult.rateField.value,
    currency: currencyResult.currencyField.value,
    containerType: containerResult.containerTypeField.value,
    containerQuantity: containerResult.containerQuantityField.value,
    availability: sailingResult.isDeclined ? "Space Not Available" : "Available",
    etd: scheduleResult.etdField.value,
    eta: scheduleResult.etaField.value,
    transitTime: scheduleResult.transitTimeField.value,
    freightCharges: chargesResult.freightChargesField.value,
    documentationCharges: chargesResult.documentationChargesField.value,
    localCharges: chargesResult.localChargesField.value,
    thc: chargesResult.thcField.value,
    additionalCharges: chargesResult.additionalChargesField.value,
    totalCost: chargesResult.totalCostField.value,
    freeDays: containerResult.freeDaysField.value,
    carrier: sailingResult.carrierField.value,
    vesselName: sailingResult.vesselNameField.value,
    voyageNumber: sailingResult.voyageNumberField.value,
    portOfLoading: (traceability.portOfLoading?.value as string) || null,
    portOfDischarge: (traceability.portOfDischarge?.value as string) || null,
    rateValidity: chargesResult.rateValidityField.value,
    expiryDate: chargesResult.rateValidityField.value,
    notes,
    containerRates: rateResult.containerRates,
    receivedTimestamp: input.receivedAt || timestamp,
    originalGmailMessageId: input.gmailMessageId || null,
    originalGmailThreadId: input.gmailThreadId || null,
    overallConfidence,
    confidenceScore,
    isDeclined: sailingResult.isDeclined,
    isConfirmed: sailingResult.isConfirmed,
    hasConflicts,
    needsReview,
    reviewReasons,
    extractionMethod: "RULE_BASED_DETERMINISTIC",
    traceability,
    cleanedEmail: cleaned,
    timestamp,
  };
}
