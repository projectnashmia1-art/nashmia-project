/**
 * MODULAR RULE-BASED EXTRACTION ENGINE - SCHEDULE EXTRACTOR (ETD, ETA, TRANSIT TIME)
 *
 * Extracts sailing departure (ETD) and destination arrival (ETA) dates using
 * deterministic regex patterns, date normalization, and temporal integrity checks.
 */

import { type ExtractedField, createNotProvidedField } from "./types";
import type { CleanedEmailLine } from "../email-cleaning-service";

export interface ScheduleExtractionInput {
  lines: CleanedEmailLine[];
  referenceYear?: number;
  referenceMonth?: string;
}

export interface ScheduleExtractionResult {
  etdField: ExtractedField<string>;
  etaField: ExtractedField<string>;
  transitTimeField: ExtractedField<number>;
  hasConflicts: boolean;
  reviewReasons: string[];
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
 * Extracts ETD, ETA, and transit time deterministically from raw email lines.
 */
export function extractScheduleDeterministic(
  input: ScheduleExtractionInput,
): ScheduleExtractionResult {
  const { lines, referenceYear = 2026, referenceMonth = "Oct" } = input;
  const reviewReasons: string[] = [];
  let hasConflicts = false;

  let etd: string | null = null;
  let eta: string | null = null;
  let etdSourceText: string | null = null;
  let etaSourceText: string | null = null;
  let etdLineNumber: number | null = null;
  let etaLineNumber: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;

    // Compound pattern: "vessel sails 12 Oct, should land around the 25th"
    const compoundMatch = text.match(
      /(?:vessel\s+sails?|sailing|etd|departs?)\s+([A-Za-z0-9\s,\-_]+?)(?:,\s*(?:should\s+land|eta|arrives?)\s+([A-Za-z0-9\s,\-_]+))?(?:$|\n|\.)/i,
    );
    if (compoundMatch) {
      const rawEtd = compoundMatch[1].trim();
      const rawEta = compoundMatch[2] ? compoundMatch[2].trim() : null;

      etd = normalizeDateString(rawEtd, referenceYear, referenceMonth);
      etdSourceText = rawEtd;
      etdLineNumber = lineObj.originalLineNumber;

      if (rawEta) {
        eta = normalizeDateString(rawEta, referenceYear, referenceMonth);
        etaSourceText = rawEta;
        etaLineNumber = lineObj.originalLineNumber;
      }
      break;
    }

    // Standalone ETD pattern: "ETD: 15-Oct", "Sailing Date: Oct 20"
    if (!etd) {
      const etdMatch = text.match(
        /(?:etd|sailing\s+date|departs?|departure|sails?\s+on|estimated\s+departure)\s*[:=-]?\s*([0-9A-Za-z\s,\-_]+?)(?:$|\n|,|\.)/i,
      );
      if (etdMatch) {
        etd = normalizeDateString(etdMatch[1].trim(), referenceYear, referenceMonth);
        etdSourceText = etdMatch[0];
        etdLineNumber = lineObj.originalLineNumber;
      }
    }

    // Standalone ETA pattern: "ETA: 28-Oct", "Arrival Date: Nov 2"
    if (!eta) {
      const etaMatch = text.match(
        /(?:eta|arrival\s+date|arrives?|estimated\s+arrival|landing\s+date|discharge\s+date)\s*[:=-]?\s*([0-9A-Za-z\s,\-_]+?)(?:$|\n|,|\.)/i,
      );
      if (etaMatch) {
        eta = normalizeDateString(etaMatch[1].trim(), referenceYear, referenceMonth);
        etaSourceText = etaMatch[0];
        etaLineNumber = lineObj.originalLineNumber;
      }
    }
  }

  // 3. Transit Time Extraction: "transit 22 days", "transit time: 24 days", "T/T 18d", "21d transit time", "21 days transit"
  let transitTime: number | null = null;
  let ttSourceText: string | null = null;
  let ttLineNumber: number | null = null;

  for (const lineObj of lines) {
    const text = lineObj.text;
    const ttMatch =
      text.match(
        /(?:transit\s*time|transit|t\/t)\s*[:=-]?\s*(?:approx\s*)?(\d+)\s*(?:days?|d)\b/i,
      ) || text.match(/\b(\d+)\s*(?:days?|d)\s+(?:transit\s*time|transit|t\/t)\b/i);
    if (ttMatch) {
      transitTime = parseInt(ttMatch[1], 10);
      ttSourceText = ttMatch[0];
      ttLineNumber = lineObj.originalLineNumber;
      break;
    }
  }

  // Build ETD & ETA Fields
  const etdField: ExtractedField<string> = etd
    ? {
        field: "etd",
        value: etd,
        traceability: {
          field: "etd",
          value: etd,
          rawValue: etdSourceText,
          sourceText: etdSourceText,
          lineNumber: etdLineNumber,
          confidence: "HIGH",
          confidenceReason:
            "Matched explicit vessel departure/sailing schedule keyword and date pattern.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "ETD / Sailing Date",
          validationStatus: "VALID",
        },
      }
    : {
        field: "etd",
        value: null,
        traceability: createNotProvidedField<string>("etd"),
      };

  const etaField: ExtractedField<string> = eta
    ? {
        field: "eta",
        value: eta,
        traceability: {
          field: "eta",
          value: eta,
          rawValue: etaSourceText,
          sourceText: etaSourceText,
          lineNumber: etaLineNumber,
          confidence: "HIGH",
          confidenceReason:
            "Matched explicit vessel destination arrival/landing schedule keyword and date pattern.",
          extractionMethod: "KEYWORD_REGEX",
          matchingKeyword: "ETA / Arrival Date",
          validationStatus: "VALID",
        },
      }
    : {
        field: "eta",
        value: null,
        traceability: createNotProvidedField<string>("eta"),
      };

  const transitTimeField: ExtractedField<number> =
    transitTime !== null
      ? {
          field: "transitTime",
          value: transitTime,
          traceability: {
            field: "transitTime",
            value: transitTime,
            rawValue: String(transitTime),
            sourceText: ttSourceText,
            lineNumber: ttLineNumber,
            confidence: "HIGH",
            confidenceReason: "Matched maritime transit duration expression in days.",
            extractionMethod: "KEYWORD_REGEX",
            matchingKeyword: "transit time",
            validationStatus: "VALID",
          },
        }
      : {
          field: "transitTime",
          value: null,
          traceability: createNotProvidedField<number>("transitTime"),
        };

  // Cross-Field Temporal Validation: ETD must strictly precede ETA!
  if (etd && eta) {
    const etdDate = new Date(etd);
    const etaDate = new Date(eta);
    if (!isNaN(etdDate.getTime()) && !isNaN(etaDate.getTime())) {
      if (etaDate.getTime() < etdDate.getTime()) {
        hasConflicts = true;
        etdField.traceability.validationStatus = "CONFLICT";
        etaField.traceability.validationStatus = "CONFLICT";
        const conflictReason = `Temporal schedule conflict: Estimated arrival ETA (${eta}) precedes vessel departure ETD (${etd}). Destination arrival precedes departure. Flagged for review.`;
        reviewReasons.push(conflictReason);
        etdField.reviewReasons = [conflictReason];
        etaField.reviewReasons = [conflictReason];
      }
    }
  }

  return {
    etdField,
    etaField,
    transitTimeField,
    hasConflicts,
    reviewReasons,
  };
}
