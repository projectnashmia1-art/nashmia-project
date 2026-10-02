/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - CURRENCY EXTRACTOR
 *
 * Extracts explicit currency notation from raw quotation text.
 * Strictly adheres to Zero-Hallucination Policy: Never assumes USD
 * or defaults currency if it is not present in the quotation email.
 */

import { type ExtractedField, createNotProvidedField } from "./types";
import type { CleanedEmailLine } from "../email-cleaning-service";

export interface CurrencyExtractionInput {
  lines: CleanedEmailLine[];
  rateValue: number | null;
}

export interface CurrencyExtractionResult {
  currencyField: ExtractedField<string>;
  reviewReasons: string[];
}

export function normalizeCurrency(raw: string): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("usd") || s.includes("$") || s.includes("dollar")) return "USD";
  if (s.includes("eur") || s.includes("€") || s.includes("euro")) return "EUR";
  if (s.includes("gbp") || s.includes("£") || s.includes("pound")) return "GBP";
  if (s.includes("aed") || s.includes("dirham")) return "AED";
  if (s.includes("pkr") || s.includes("rs") || s.includes("rupee")) return "PKR";
  if (s.includes("sgd")) return "SGD";
  if (s.includes("cny") || s.includes("rmb") || s.includes("¥")) return "CNY";
  if (s.includes("jpy")) return "JPY";
  return null;
}

/**
 * Extracts and normalizes currency deterministically.
 */
export function extractCurrencyDeterministic(
  input: CurrencyExtractionInput,
): CurrencyExtractionResult {
  const { lines, rateValue } = input;
  const reviewReasons: string[] = [];

  let detectedCurrency: string | null = null;
  let currencySourceText: string | null = null;
  let currencySourceLine: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Pattern 1: Explicit ISO 4217 code (USD, EUR, GBP, AED, PKR, SGD, CNY)
    const isoMatch = text.match(/\b(USD|EUR|GBP|AED|PKR|SGD|CNY|JPY)\b/i);
    if (isoMatch) {
      detectedCurrency = normalizeCurrency(isoMatch[1]);
      currencySourceText = isoMatch[0];
      currencySourceLine = lineObj.originalLineNumber;
      break;
    }

    // Pattern 2: Symbol attached to or near digits ($1,200, €1500, £800)
    const symMatch = text.match(/([$€£¥])\s*[0-9]+|[0-9]+\s*([$€£¥])/);
    if (symMatch) {
      detectedCurrency = normalizeCurrency(symMatch[1] || symMatch[2]);
      currencySourceText = symMatch[0];
      currencySourceLine = lineObj.originalLineNumber;
      break;
    }
  }

  if (detectedCurrency) {
    return {
      currencyField: {
        field: "currency",
        value: detectedCurrency,
        traceability: {
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
        },
      },
      reviewReasons,
    };
  }

  // If rate was extracted but currency is missing: NEVER assume USD!
  if (rateValue !== null) {
    const reason =
      "Currency notation is missing from forwarder quotation email. System never assumes USD. Marked as NEEDS_REVIEW.";
    reviewReasons.push(reason);

    return {
      currencyField: {
        field: "currency",
        value: null,
        traceability: {
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
        },
        reviewReasons: [reason],
      },
      reviewReasons,
    };
  }

  return {
    currencyField: {
      field: "currency",
      value: null,
      traceability: createNotProvidedField<string>("currency"),
    },
    reviewReasons,
  };
}
