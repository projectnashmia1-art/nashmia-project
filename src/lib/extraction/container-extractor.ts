/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - CONTAINER & EQUIPMENT EXTRACTOR
 *
 * Extracts container types, sizes, quantities, and demurrage/detention free days
 * from raw maritime text using deterministic pattern matching.
 */

import { type ExtractedField, createNotProvidedField } from "./types";
import type { CleanedEmailLine } from "../email-cleaning-service";

export interface ContainerExtractionInput {
  lines: CleanedEmailLine[];
  knownContainerType?: string | null;
}

export interface ContainerExtractionResult {
  containerTypeField: ExtractedField<string>;
  containerQuantityField: ExtractedField<number>;
  freeDaysField: ExtractedField<number>;
}

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

export function normalizeContainerType(raw: string): string {
  if (!raw) return "40HC";
  const s = raw.trim().toUpperCase();
  if (s.includes("20")) return "20FT";
  if (s.includes("45")) return "45HC";
  if (s.includes("REEFER") || s.includes("RF")) return "40RF";
  if (s.includes("OPEN") || s.includes("OT")) return "40OT";
  return "40HC";
}

/**
 * Extracts container specifications and free days deterministically.
 */
export function extractContainerDeterministic(
  input: ContainerExtractionInput,
): ContainerExtractionResult {
  const { lines, knownContainerType } = input;

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

  // Fallback to known container type from booking if present
  if (!containerType && knownContainerType) {
    containerType = normalizeContainerType(knownContainerType);
    cntrSourceText = `From booking context: ${knownContainerType}`;
  }

  // Free Days extraction: "14 free days", "free time: 14 days", "14 days free"
  let freeDays: number | null = null;
  let fdSourceText: string | null = null;
  let fdLineNumber: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;
    const fdMatch = text.match(
      /(?:(\d+)\s*(?:days?\s+free|free\s*days?)|free\s*time\s*[:=-]?\s*(\d+)\s*days?)/i,
    );
    if (fdMatch) {
      freeDays = parseInt(fdMatch[1] || fdMatch[2], 10);
      fdSourceText = fdMatch[0];
      fdLineNumber = lineObj.originalLineNumber;
      break;
    }
  }

  const containerTypeField: ExtractedField<string> = containerType
    ? {
        field: "containerType",
        value: containerType,
        traceability: {
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
        },
      }
    : {
        field: "containerType",
        value: null,
        traceability: createNotProvidedField<string>("containerType"),
      };

  const containerQuantityField: ExtractedField<number> =
    containerQuantity !== null
      ? {
          field: "containerQuantity",
          value: containerQuantity,
          traceability: {
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
          },
        }
      : {
          field: "containerQuantity",
          value: null,
          traceability: createNotProvidedField<number>("containerQuantity"),
        };

  const freeDaysField: ExtractedField<number> =
    freeDays !== null
      ? {
          field: "freeDays",
          value: freeDays,
          traceability: {
            field: "freeDays",
            value: freeDays,
            rawValue: String(freeDays),
            sourceText: fdSourceText,
            lineNumber: fdLineNumber,
            confidence: "HIGH",
            confidenceReason: "Matched combined demurrage & detention free time allowance.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "free days",
            validationStatus: "VALID",
          },
        }
      : {
          field: "freeDays",
          value: null,
          traceability: createNotProvidedField<number>("freeDays"),
        };

  return {
    containerTypeField,
    containerQuantityField,
    freeDaysField,
  };
}
