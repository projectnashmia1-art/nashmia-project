/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - SAILING & CARRIER EXTRACTOR
 *
 * Extracts ocean carriers, vessel names, voyage numbers, decline indicators,
 * and confirmation statements from raw email lines.
 */

import { type ExtractedField, createNotProvidedField } from "./types";
import type { CleanedEmailLine } from "../email-cleaning-service";

export interface SailingExtractionInput {
  lines: CleanedEmailLine[];
  subject?: string;
}

export interface SailingExtractionResult {
  carrierField: ExtractedField<string>;
  vesselNameField: ExtractedField<string>;
  voyageNumberField: ExtractedField<string>;
  isDeclined: boolean;
  isConfirmed: boolean;
}

const CARRIERS = [
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
 * Extracts vessel, voyage, carrier, and decline/confirmation indicators.
 */
export function extractSailingDeterministic(
  input: SailingExtractionInput,
): SailingExtractionResult {
  const { lines, subject = "" } = input;

  let carrier: string | null = null;
  let vesselName: string | null = null;
  let voyageNumber: string | null = null;
  let carrierSource: string | null = null;
  let carrierLine: number | null = null;
  let vesselSource: string | null = null;
  let vesselLine: number | null = null;
  let isDeclined = false;
  let isConfirmed = false;

  const fullText = lines.map((l) => l.text).join(" ");
  const combined = `${subject} ${fullText}`.toLowerCase();

  // 1. Decline detection: "fully booked", "no space", "declined", "cannot offer"
  if (
    combined.includes("fully booked") ||
    combined.includes("no space") ||
    combined.includes("cannot accept") ||
    combined.includes("unable to quote") ||
    combined.includes("we regret") ||
    combined.includes("decline to quote") ||
    combined.includes("no equipment")
  ) {
    isDeclined = true;
  }

  // 2. Confirmation detection: "booking confirmed", "space is confirmed"
  if (
    combined.includes("booking confirmed") ||
    combined.includes("booking has been confirmed") ||
    combined.includes("space confirmed") ||
    combined.includes("allocation confirmed")
  ) {
    isConfirmed = true;
  }

  // 3. Carrier Line matching
  for (const lineObj of lines) {
    const text = lineObj.text;
    for (const c of CARRIERS) {
      const pat = new RegExp(`\\b${c.replace("-", "[\\s-]?")}\\b`, "i");
      if (pat.test(text)) {
        carrier = c;
        carrierSource = c;
        carrierLine = lineObj.originalLineNumber;
        break;
      }
    }
    if (carrier) break;
  }

  // 4. Vessel and Voyage extraction: "Vessel: MSC EMMA / 2411E", "Vessel MSC ISABELLA v.042W"
  for (const lineObj of lines) {
    const text = lineObj.text;
    const vMatch = text.match(
      /(?:vessel|ship|feeder|ocean\s*vessel)\s*[:=-]?\s*([A-Za-z0-9\s.\-_]+?)(?:\s+(?:v\.|voy\.|voyage|v)?\s*([0-9A-Za-z]+))?(?:$|\n|,|\.)/i,
    );
    if (vMatch) {
      vesselName = vMatch[1].trim();
      vesselSource = vMatch[0];
      vesselLine = lineObj.originalLineNumber;
      if (vMatch[2]) {
        voyageNumber = vMatch[2].trim();
      }
      break;
    }
  }

  const carrierField: ExtractedField<string> = carrier
    ? {
        field: "carrier",
        value: carrier,
        traceability: {
          field: "carrier",
          value: carrier,
          rawValue: carrierSource,
          sourceText: carrierSource,
          lineNumber: carrierLine,
          confidence: "HIGH",
          confidenceReason: "Matched verified ocean container carrier line code.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: carrier,
          validationStatus: "VALID",
        },
      }
    : {
        field: "carrier",
        value: null,
        traceability: createNotProvidedField<string>("carrier"),
      };

  const vesselNameField: ExtractedField<string> = vesselName
    ? {
        field: "vesselName",
        value: vesselName,
        traceability: {
          field: "vesselName",
          value: vesselName,
          rawValue: vesselSource,
          sourceText: vesselSource,
          lineNumber: vesselLine,
          confidence: "HIGH",
          confidenceReason: "Matched maritime vessel naming pattern.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "vessel",
          validationStatus: "VALID",
        },
      }
    : {
        field: "vesselName",
        value: null,
        traceability: createNotProvidedField<string>("vesselName"),
      };

  const voyageNumberField: ExtractedField<string> = voyageNumber
    ? {
        field: "voyageNumber",
        value: voyageNumber,
        traceability: {
          field: "voyageNumber",
          value: voyageNumber,
          rawValue: voyageNumber,
          sourceText: `Voyage ${voyageNumber}`,
          lineNumber: vesselLine,
          confidence: "HIGH",
          confidenceReason: "Matched maritime voyage schedule identifier.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "voyage",
          validationStatus: "VALID",
        },
      }
    : {
        field: "voyageNumber",
        value: null,
        traceability: createNotProvidedField<string>("voyageNumber"),
      };

  return {
    carrierField,
    vesselNameField,
    voyageNumberField,
    isDeclined,
    isConfirmed,
  };
}
