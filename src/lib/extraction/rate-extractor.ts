/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - RATE EXTRACTOR
 *
 * Extracts ocean freight rates using deterministic regex & keyword patterns.
 * Handles single rates, multi-container rates, currency coupling,
 * safety bounds validation, and ambiguity/conflict detection.
 */

import {
  type ExtractedField,
  type FieldCandidate,
  type ConfidenceLevel,
  createNotProvidedField,
  normalizeNumericValue,
} from "./types";
import type { CleanedEmailLine } from "../email-cleaning-service";

export interface RateExtractionInput {
  lines: CleanedEmailLine[];
  knownContainerType?: string | null;
  detectedCurrency?: string | null;
}

export interface RateExtractionResult {
  rateField: ExtractedField<number>;
  containerRates: Record<string, number>;
  hasConflicts: boolean;
  reviewReasons: string[];
}

// Deterministic Freight Rate Patterns
const RATE_PATTERNS = [
  // 1. Direct rate/price/quote keywords: "Rate 2000", "Rate: 3000", "Price: $1800", "Quote 2500", "Rate - 2100"
  /(?:^|\b)(?:rate|price|quote|offer|cost|freight|charges?|ocean\s*rate)\s*[:=-]?\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)\b/i,

  // 2. Explicit conversational phrases: "our price is around 1,200 usd", "rate is $2,100", "price of 1500"
  /(?:our\s+price\s+is\s+(?:around\s+|approx\s+)?|rate\s+is\s+|price\s+is\s+|quoted\s+at\s+|freight\s+is\s+)(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)?/i,

  // 3. Abbreviated / Commercial forms: "Fr8 $1000", "O/F: $1,800", "Base freight: 2100"
  /(?:fr8|o\/f|ocean\s*freight|base\s*freight|sea\s*freight|freight\s*rate)\s*[:=-]?\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)?/i,

  // 4. Per container expressions: "$1,200 / cntr", "2100 usd / 40hc", "1800 per box"
  /(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*([0-9,.]+)\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)?\s*(?:\/|\s+per\s+)(?:cntr|container|box|unit|feu|teu|40hc|20ft|40ft)/i,

  // 5. Rate with preceding currency: "$2,100", "USD 1850", "EUR 1600"
  /(?:\$|€|£|usd|eur|gbp|aed|pkr)\s*([0-9,.]+)(?:\s*(?:net|all\s*in|plus|all-in))?/i,

  // 6. Rate with trailing currency: "2100 USD", "1850 $"
  /\b([0-9,.]+)\s*(?:usd|eur|gbp|aed|pkr|\$|€|£)(?:\s*(?:net|all\s*in|plus|all-in))?/i,
];

function normalizeContainerType(raw: string): string {
  if (!raw) return "40HC";
  const s = raw.trim().toUpperCase();
  if (s.includes("20")) return "20FT";
  if (s.includes("45")) return "45HC";
  if (s.includes("REEFER") || s.includes("RF")) return "40RF";
  if (s.includes("OPEN") || s.includes("OT")) return "40OT";
  return "40HC";
}

/**
 * Extracts ocean freight rates from cleaned email lines deterministically.
 */
export function extractRateDeterministic(input: RateExtractionInput): RateExtractionResult {
  const { lines, knownContainerType } = input;
  const rateCandidates: FieldCandidate<number>[] = [];
  const reviewReasons: string[] = [];
  let hasConflicts = false;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Detect explicit multi-quote/or alternatives: "$1200 or $1500", "between $1200 and $1500"
    const altMatch = text.match(
      /(?:\$|usd)?\s*([0-9,.]+)\s*(?:or|to|-|\/)\s*(?:\$|usd)?\s*([0-9,.]+)/i,
    );
    if (altMatch && !text.toLowerCase().includes("free days")) {
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
        if (val && val >= 10 && val <= 100000 && val !== 2026 && val !== 2025) {
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
      }
    }
  }

  let finalRate: number | null = null;
  let finalTraceability = createNotProvidedField<number>("rate");

  const targetContainerType = knownContainerType
    ? normalizeContainerType(knownContainerType)
    : null;

  if (Object.keys(containerRates).length > 0) {
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

    finalRate = selectedRate;
    finalTraceability = {
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
    finalRate = cand.value;
    finalTraceability = {
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
    const priorityCandidates = rateCandidates.filter((c) =>
      /(?:our\s+price\s+is|rate\s+is|ocean\s+freight|fr8)/i.test(c.sourceText),
    );

    if (priorityCandidates.length === 1) {
      const best = priorityCandidates[0];
      finalRate = best.value;
      finalTraceability = {
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
      hasConflicts = true;
      const first = rateCandidates[0];
      finalRate = first.value;
      reviewReasons.push(
        `Multiple conflicting rate figures found ($${rateCandidates.map((c) => c.value).join(", ")}). Manual review required.`,
      );
      finalTraceability = {
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
  }

  // Validate Rate Bounds ($100 to $50,000)
  if (finalRate !== null) {
    if (finalRate < 100 || finalRate > 50000) {
      finalTraceability.validationStatus = "SUSPICIOUS";
      reviewReasons.push(
        `Ocean freight rate ($${finalRate.toLocaleString()}) falls outside standard maritime bounds ($100-$50,000). Manual verification required.`,
      );
    }
  }

  return {
    rateField: {
      field: "rate",
      value: finalRate,
      traceability: finalTraceability,
      reviewReasons,
      candidates: rateCandidates,
    },
    containerRates,
    hasConflicts,
    reviewReasons,
  };
}
