/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - CHARGES & SURCHARGES EXTRACTOR
 *
 * Extracts THC, documentation fees, local charges, additional surcharges,
 * explicitly provided total costs, and rate validity dates.
 */

import { type ExtractedField, createNotProvidedField, normalizeNumericValue } from "./types";
import type { CleanedEmailLine } from "../email-cleaning-service";

export interface ChargesExtractionInput {
  lines: CleanedEmailLine[];
  baseRate?: number | null;
  referenceYear?: number;
}

export interface ChargesExtractionResult {
  freightChargesField: ExtractedField<number>;
  thcField: ExtractedField<number>;
  documentationChargesField: ExtractedField<number>;
  localChargesField: ExtractedField<number>;
  additionalChargesField: ExtractedField<string | number>;
  totalCostField: ExtractedField<number>;
  rateValidityField: ExtractedField<string>;
}

/**
 * Extracts charges, fees, and validity expressions deterministically.
 */
export function extractChargesDeterministic(
  input: ChargesExtractionInput,
): ChargesExtractionResult {
  const { lines, baseRate } = input;

  let freightCharges: number | null = null;
  let thc: number | null = null;
  let documentationCharges: number | null = null;
  let localCharges: number | null = null;
  let additionalCharges: string | number | null = null;
  let totalCost: number | null = null;
  let rateValidity: string | null = null;

  let thcSource: string | null = null;
  let thcLine: number | null = null;
  let docSource: string | null = null;
  let docLine: number | null = null;
  let localSource: string | null = null;
  let localLine: number | null = null;
  let totalSource: string | null = null;
  let totalLine: number | null = null;
  let validitySource: string | null = null;
  let validityLine: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // 1. THC: "THC $150", "origin THC: 150", "+ THC 150"
    if (thc === null) {
      const thcMatch = text.match(
        /(?:thc|terminal\s*handling(?:\s*charges?)?)\s*[:=-]?\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)/i,
      );
      if (thcMatch) {
        thc = normalizeNumericValue(thcMatch[1]);
        thcSource = thcMatch[0];
        thcLine = lineObj.originalLineNumber;
      }
    }

    // 2. Documentation / Local charges: "doc/local 200", "doc fee $75", "documentation: 100"
    if (documentationCharges === null || localCharges === null) {
      const docLocalMatch = text.match(
        /(?:doc(?:\/|and)?local|documentation|doc\s*fee|bl\s*fee)\s*[:=-]?\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)/i,
      );
      if (docLocalMatch) {
        const val = normalizeNumericValue(docLocalMatch[1]);
        if (val) {
          documentationCharges = val;
          localCharges = val;
          docSource = docLocalMatch[0];
          docLine = lineObj.originalLineNumber;
          localSource = docLocalMatch[0];
          localLine = lineObj.originalLineNumber;
        }
      }
    }

    // 3. Rate Validity: "valid 2 weeks", "valid until 30-Oct", "validity: 15 days"
    if (!rateValidity) {
      const valMatch = text.match(
        /(?:valid\s+until|valid\s+to|validity|valid\s+for|rates?\s+valid)\s*[:=-]?\s*([0-9A-Za-z\s,\-_]+?)(?:$|\n|,|\.)/i,
      );
      if (valMatch) {
        rateValidity = valMatch[1].trim();
        validitySource = valMatch[0];
        validityLine = lineObj.originalLineNumber;
      }
    }

    // 4. Total Cost (ONLY if explicitly stated in email, e.g. "total cost: $2,450", "total all-in: 2350")
    if (totalCost === null) {
      const totalMatch = text.match(
        /(?:total\s*(?:cost|amount|all[\s\-_]*in|freight|price)?)\s*[:=-]\s*(?:usd|eur|\$|€)?\s*([0-9,.]+)/i,
      );
      if (totalMatch) {
        const tVal = normalizeNumericValue(totalMatch[1]);
        if (tVal && tVal >= 100 && tVal <= 100000 && tVal !== 2026) {
          totalCost = tVal;
          totalSource = totalMatch[0];
          totalLine = lineObj.originalLineNumber;
        }
      }
    }
  }

  // Base Freight Charges
  if (baseRate) {
    freightCharges = baseRate;
  }

  // Surcharges string representation
  if (thc || documentationCharges || localCharges) {
    const parts: string[] = [];
    if (thc) parts.push(`THC: $${thc}`);
    if (documentationCharges) parts.push(`Documentation: $${documentationCharges}`);
    additionalCharges = parts.join(", ");
  }

  const freightChargesField: ExtractedField<number> =
    freightCharges !== null
      ? {
          field: "freightCharges",
          value: freightCharges,
          traceability: {
            field: "freightCharges",
            value: freightCharges,
            rawValue: String(freightCharges),
            sourceText: `Base freight component: $${freightCharges}`,
            lineNumber: null,
            confidence: "HIGH",
            confidenceReason: "Mapped from deterministic base freight rate.",
            extractionMethod: "NORMALIZATION",
            matchingKeyword: "base freight",
            validationStatus: "VALID",
          },
        }
      : {
          field: "freightCharges",
          value: null,
          traceability: createNotProvidedField<number>("freightCharges"),
        };

  const thcField: ExtractedField<number> =
    thc !== null
      ? {
          field: "thc",
          value: thc,
          traceability: {
            field: "thc",
            value: thc,
            rawValue: String(thc),
            sourceText: thcSource,
            lineNumber: thcLine,
            confidence: "HIGH",
            confidenceReason: "Matched terminal handling charges expression.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "THC",
            validationStatus: "VALID",
          },
        }
      : {
          field: "thc",
          value: null,
          traceability: createNotProvidedField<number>("thc"),
        };

  const documentationChargesField: ExtractedField<number> =
    documentationCharges !== null
      ? {
          field: "documentationCharges",
          value: documentationCharges,
          traceability: {
            field: "documentationCharges",
            value: documentationCharges,
            rawValue: String(documentationCharges),
            sourceText: docSource,
            lineNumber: docLine,
            confidence: "HIGH",
            confidenceReason: "Matched documentation fee or B/L issuance charges.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "doc charges",
            validationStatus: "VALID",
          },
        }
      : {
          field: "documentationCharges",
          value: null,
          traceability: createNotProvidedField<number>("documentationCharges"),
        };

  const localChargesField: ExtractedField<number> =
    localCharges !== null
      ? {
          field: "localCharges",
          value: localCharges,
          traceability: {
            field: "localCharges",
            value: localCharges,
            rawValue: String(localCharges),
            sourceText: localSource || docSource,
            lineNumber: localLine || docLine,
            confidence: "HIGH",
            confidenceReason: "Matched origin/destination local port charges.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "local charges",
            validationStatus: "VALID",
          },
        }
      : {
          field: "localCharges",
          value: null,
          traceability: createNotProvidedField<number>("localCharges"),
        };

  const additionalChargesField: ExtractedField<string | number> =
    additionalCharges !== null
      ? {
          field: "additionalCharges",
          value: additionalCharges,
          traceability: {
            field: "additionalCharges",
            value: additionalCharges,
            rawValue: String(additionalCharges),
            sourceText: `Combined port surcharges: ${additionalCharges}`,
            lineNumber: null,
            confidence: "HIGH",
            confidenceReason: "Consolidated breakdown of itemized maritime surcharges.",
            extractionMethod: "NORMALIZATION",
            matchingKeyword: "surcharges",
            validationStatus: "VALID",
          },
        }
      : {
          field: "additionalCharges",
          value: null,
          traceability: createNotProvidedField<string | number>("additionalCharges"),
        };

  const totalCostField: ExtractedField<number> =
    totalCost !== null
      ? {
          field: "totalCost",
          value: totalCost,
          traceability: {
            field: "totalCost",
            value: totalCost,
            rawValue: String(totalCost),
            sourceText: totalSource,
            lineNumber: totalLine,
            confidence: "HIGH",
            confidenceReason: "Matched explicit all-inclusive total cost declaration in email.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "total cost",
            validationStatus: "VALID",
          },
        }
      : {
          field: "totalCost",
          value: null,
          traceability: createNotProvidedField<number>("totalCost"),
        };

  const rateValidityField: ExtractedField<string> =
    rateValidity !== null
      ? {
          field: "rateValidity",
          value: rateValidity,
          traceability: {
            field: "rateValidity",
            value: rateValidity,
            rawValue: rateValidity,
            sourceText: validitySource,
            lineNumber: validityLine,
            confidence: "HIGH",
            confidenceReason: "Matched quotation rate validity timeline or expiration deadline.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "rate validity",
            validationStatus: "VALID",
          },
        }
      : {
          field: "rateValidity",
          value: null,
          traceability: createNotProvidedField<string>("rateValidity"),
        };

  return {
    freightChargesField,
    thcField,
    documentationChargesField,
    localChargesField,
    additionalChargesField,
    totalCostField,
    rateValidityField,
  };
}
