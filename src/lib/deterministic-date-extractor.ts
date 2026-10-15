/**
 * Deterministic Rule-Based Date Extraction Engine
 *
 * Conforms strictly to specifications:
 * - Extract dates from labels such as:
 *   * ETD
 *   * sailing date
 *   * departure
 *   * ETA
 *   * arrival date
 *   * valid until
 *   * validity
 *   * rate validity
 *   * cutoff
 *   * cut-off
 *
 * - Convert dates to YYYY-MM-DD only when the date is unambiguous.
 * - If the date is ambiguous, preserve the original text and mark it for review.
 *
 * 100% Deterministic, Regex and Rule Based, Zero AI.
 */

export type DateLabelCategory =
  | "etd"
  | "sailing_date"
  | "departure"
  | "eta"
  | "arrival_date"
  | "valid_until"
  | "validity"
  | "rate_validity"
  | "cutoff"
  | "cut_off";

export type DateTargetField = "etd" | "eta" | "validity" | "cutoff";

export interface ExtractedDateItem {
  category: DateLabelCategory;
  categoryLabel: string;
  targetField: DateTargetField;
  originalLabel: string;
  original_label: string;
  originalText: string;
  original_text: string;
  rawText: string;
  raw_text: string;
  isoDate: string | null;
  iso_date: string | null;
  date: string | null;
  formattedDisplay: string;
  formatted_display: string;
  isAmbiguous: boolean;
  is_ambiguous: boolean;
  needsReview: boolean;
  needs_review: boolean;
  status: "unambiguous" | "ambiguous" | "invalid";
  reason: string;
  warnings: string[];
  originalSourceLine: string;
  original_source_line: string;
  lineNumber: number;
}

export interface DateExtractionResult {
  dates: ExtractedDateItem[];
  dateMap: Record<DateTargetField, ExtractedDateItem | null>;
  etd: string | null;
  eta: string | null;
  validityDate: string | null;
  cutoffDate: string | null;
  hasAmbiguousDate: boolean;
  has_ambiguous_date: boolean;
  needsReview: boolean;
  needs_review: boolean;
  warnings: string[];
  reviewReasons: string[];
}

export const DATE_LABEL_MAPPINGS: Record<
  DateLabelCategory,
  { label: string; targetField: DateTargetField; regex: RegExp }
> = {
  etd: {
    label: "ETD",
    targetField: "etd",
    regex: /(?:^|[^a-zA-Z0-9])(?:etd|est\.?\s*departure|estimated\s*(?:time\s*of\s*)?departure)\b/i,
  },
  sailing_date: {
    label: "Sailing Date",
    targetField: "etd",
    regex: /(?:^|[^a-zA-Z0-9])(?:sailing\s*date|sailing|sail\s*date|sails?\s*(?:on|date)?)\b/i,
  },
  departure: {
    label: "Departure",
    targetField: "etd",
    regex: /(?:^|[^a-zA-Z0-9])(?:departure\s*date|departure|departs?\s*(?:on|date)?)\b/i,
  },
  eta: {
    label: "ETA",
    targetField: "eta",
    regex: /(?:^|[^a-zA-Z0-9])(?:eta|est\.?\s*arrival|estimated\s*(?:time\s*of\s*)?arrival)\b/i,
  },
  arrival_date: {
    label: "Arrival Date",
    targetField: "eta",
    regex: /(?:^|[^a-zA-Z0-9])(?:arrival\s*date|arrival|arrives?\s*(?:on|date)?|should\s*land)\b/i,
  },
  valid_until: {
    label: "Valid Until",
    targetField: "validity",
    regex:
      /(?:^|[^a-zA-Z0-9])(?:valid\s*(?:until|till|through|to)|validity\s*(?:date|until|till|through|to))\b/i,
  },
  validity: {
    label: "Validity",
    targetField: "validity",
    regex:
      /(?:^|[^a-zA-Z0-9])(?:validity|offer\s*validity|quote\s*validity|expiry\s*date|expires?\s*(?:on)?)\b/i,
  },
  rate_validity: {
    label: "Rate Validity",
    targetField: "validity",
    regex:
      /(?:^|[^a-zA-Z0-9])(?:rate\s*validity|price\s*validity|rates?\s*valid\s*(?:until|till|to)?)\b/i,
  },
  cutoff: {
    label: "Cutoff",
    targetField: "cutoff",
    regex:
      /(?:^|[^a-zA-Z0-9])(?:cutoff|si\s*cutoff|vgm\s*cutoff|doc\s*cutoff|port\s*cutoff|cargo\s*cutoff|closing\s*date|closing)\b/i,
  },
  cut_off: {
    label: "Cut-Off",
    targetField: "cutoff",
    regex:
      /(?:^|[^a-zA-Z0-9])(?:cut[\s-_]off|si\s*cut[\s-_]off|vgm\s*cut[\s-_]off|doc\s*cut[\s-_]off|port\s*cut[\s-_]off|cargo\s*cut[\s-_]off)\b/i,
  },
};

const MONTH_MAP: Record<string, { num: number; name: string }> = {
  jan: { num: 1, name: "January" },
  january: { num: 1, name: "January" },
  feb: { num: 2, name: "February" },
  february: { num: 2, name: "February" },
  mar: { num: 3, name: "March" },
  march: { num: 3, name: "March" },
  apr: { num: 4, name: "April" },
  april: { num: 4, name: "April" },
  may: { num: 5, name: "May" },
  jun: { num: 6, name: "June" },
  june: { num: 6, name: "June" },
  jul: { num: 7, name: "July" },
  july: { num: 7, name: "July" },
  aug: { num: 8, name: "August" },
  august: { num: 8, name: "August" },
  sep: { num: 9, name: "September" },
  sept: { num: 9, name: "September" },
  september: { num: 9, name: "September" },
  oct: { num: 10, name: "October" },
  october: { num: 10, name: "October" },
  nov: { num: 11, name: "November" },
  november: { num: 11, name: "November" },
  dec: { num: 12, name: "December" },
  december: { num: 12, name: "December" },
};

export interface UnambiguousDateParseResult {
  isoDate: string | null;
  isAmbiguous: boolean;
  status: "unambiguous" | "ambiguous" | "invalid";
  reason: string;
}

/**
 * Formats YYYY-MM-DD string safely with 2-digit pad
 */
export function formatIsoDate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, "0");
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Validates days in a month (including leap years)
 */
export function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  const daysInMonth = new Date(year, month, 0).getDate();
  return day <= daysInMonth;
}

/**
 * Parse a raw date text string into YYYY-MM-DD if unambiguous.
 *
 * Rules:
 * - Unambiguous:
 *   1. Standard ISO: YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-10-15, 2026/10/15)
 *   2. Named Month formats (e.g. "15 Oct 2026", "15-Oct-2026", "October 15, 2026", "Oct 15th")
 *   3. Numeric dates where Day > 12 (e.g. "15/04/2026" must be 15-Apr-2026, "04/25/2026" must be 25-Apr-2026)
 * - Ambiguous:
 *   1. Numeric dates where both month & day <= 12 and not ISO format (e.g. "04/05/2026", "05-04-2026", "4/5/2026")
 *   2. Relative expressions (e.g. "mid Oct", "next Friday", "in 2 weeks")
 */
export function parseDateDeterministic(
  rawText: string,
  referenceYear = 2026,
): UnambiguousDateParseResult {
  if (!rawText || !rawText.trim()) {
    return {
      isoDate: null,
      isAmbiguous: false,
      status: "invalid",
      reason: "Date string is empty.",
    };
  }

  const clean = rawText.trim();

  // Check 1: Explicit ISO Format YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const isoMatch = clean.match(/^([12]\d{3})[-/.](0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(year, month, day)) {
      return {
        isoDate: formatIsoDate(year, month, day),
        isAmbiguous: false,
        status: "unambiguous",
        reason: "Matched unambiguous ISO format YYYY-MM-DD.",
      };
    }
  }

  // Check 2: Named Month Pattern A: "15 Oct 2026", "15-Oct-2026", "15/Oct/2026", "15th October 2026", "15 Oct"
  const dayNamedMonthMatch = clean.match(
    /\b(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?[\s\-_/]+([A-Za-z]{3,9})(?:[\s\-_/]+([12]\d{3}|\d{2}))?\b/i,
  );
  if (dayNamedMonthMatch) {
    const rawMonth = dayNamedMonthMatch[2].toLowerCase();
    const monthInfo = MONTH_MAP[rawMonth] || MONTH_MAP[rawMonth.slice(0, 3)];
    if (monthInfo) {
      const day = parseInt(dayNamedMonthMatch[1], 10);
      let year = referenceYear;
      if (dayNamedMonthMatch[3]) {
        const yVal = parseInt(dayNamedMonthMatch[3], 10);
        year = yVal < 100 ? 2000 + yVal : yVal;
      }
      if (isValidCalendarDate(year, monthInfo.num, day)) {
        return {
          isoDate: formatIsoDate(year, monthInfo.num, day),
          isAmbiguous: false,
          status: "unambiguous",
          reason: `Matched unambiguous named month format (${day} ${monthInfo.name} ${year}).`,
        };
      }
    }
  }

  // Check 3: Named Month Pattern B: "October 15, 2026", "Oct 15 2026", "Oct-15-2026", "Oct 15th", "Oct 15"
  const monthNamedDayMatch = clean.match(
    /\b([A-Za-z]{3,9})[\s\-_/]+(0?[1-9]|[12]\d|3[01])(?:st|nd|rd|th)?(?:,?\s*[\s\-_/]+([12]\d{3}|\d{2}))?\b/i,
  );
  if (monthNamedDayMatch) {
    const rawMonth = monthNamedDayMatch[1].toLowerCase();
    const monthInfo = MONTH_MAP[rawMonth] || MONTH_MAP[rawMonth.slice(0, 3)];
    if (monthInfo) {
      const day = parseInt(monthNamedDayMatch[2], 10);
      let year = referenceYear;
      if (monthNamedDayMatch[3]) {
        const yVal = parseInt(monthNamedDayMatch[3], 10);
        year = yVal < 100 ? 2000 + yVal : yVal;
      }
      if (isValidCalendarDate(year, monthInfo.num, day)) {
        return {
          isoDate: formatIsoDate(year, monthInfo.num, day),
          isAmbiguous: false,
          status: "unambiguous",
          reason: `Matched unambiguous named month format (${monthInfo.name} ${day}, ${year}).`,
        };
      }
    }
  }

  // Check 4: Pure numeric formats: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, MM-DD-YYYY
  const numericSlashMatch = clean.match(
    /\b(0?[1-9]|[12]\d|3[01])\s*[-/.]\s*(0?[1-9]|[12]\d|3[01])\s*[-/.]\s*([12]\d{3}|\d{2})\b/,
  );
  if (numericSlashMatch) {
    const p1 = parseInt(numericSlashMatch[1], 10);
    const p2 = parseInt(numericSlashMatch[2], 10);
    const rawYear = parseInt(numericSlashMatch[3], 10);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;

    // Case 4A: p1 > 12 and p2 <= 12 -> p1 MUST be day, p2 MUST be month (DD/MM/YYYY)
    if (p1 > 12 && p2 <= 12) {
      if (isValidCalendarDate(year, p2, p1)) {
        return {
          isoDate: formatIsoDate(year, p2, p1),
          isAmbiguous: false,
          status: "unambiguous",
          reason: `Unambiguous DD/MM/YYYY numeric date (${p1} is > 12, so day is ${p1} and month is ${p2}).`,
        };
      }
    }

    // Case 4B: p1 <= 12 and p2 > 12 -> p1 MUST be month, p2 MUST be day (MM/DD/YYYY)
    if (p1 <= 12 && p2 > 12) {
      if (isValidCalendarDate(year, p1, p2)) {
        return {
          isoDate: formatIsoDate(year, p1, p2),
          isAmbiguous: false,
          status: "unambiguous",
          reason: `Unambiguous MM/DD/YYYY numeric date (${p2} is > 12, so month is ${p1} and day is ${p2}).`,
        };
      }
    }

    // Case 4C: Both p1 <= 12 and p2 <= 12 -> AMBIGUOUS!
    // Example: "04/05/2026" could be 04-May or 05-Apr
    if (p1 <= 12 && p2 <= 12) {
      return {
        isoDate: null,
        isAmbiguous: true,
        status: "ambiguous",
        reason: `Date '${clean}' is ambiguous (could be ${String(p1).padStart(2, "0")}/${String(
          p2,
        ).padStart(2, "0")} or ${String(p2).padStart(2, "0")}/${String(p1).padStart(
          2,
          "0",
        )}). Preserved original text for human review.`,
      };
    }
  }

  // Check 5: Fuzzy or relative expressions (e.g. "mid Oct", "next Friday", "in 2 weeks", "prompt")
  if (
    /(?:mid\s+[a-z]+|next\s+[a-z]+|end\s+of|in\s+\d+\s+days?|prompt|tba|tbd|pending)/i.test(clean)
  ) {
    return {
      isoDate: null,
      isAmbiguous: true,
      status: "ambiguous",
      reason: `Relative/fuzzy date expression '${clean}' cannot be converted to YYYY-MM-DD without ambiguity. Preserved original text for human review.`,
    };
  }

  // Fallback: Ambiguous / Unknown format
  return {
    isoDate: null,
    isAmbiguous: true,
    status: "ambiguous",
    reason: `Date format '${clean}' is ambiguous. Preserved original text for human review.`,
  };
}

/**
 * Extracts and categorizes all dates from email text or lines based on requested labels.
 */
export function extractDatesFromText(text: string, referenceYear = 2026): DateExtractionResult {
  const lines = (text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const foundItems: ExtractedDateItem[] = [];
  const warnings: string[] = [];
  const reviewReasons: string[] = [];

  const dateMap: Record<DateTargetField, ExtractedDateItem | null> = {
    etd: null,
    eta: null,
    validity: null,
    cutoff: null,
  };

  const categories = Object.keys(DATE_LABEL_MAPPINGS) as DateLabelCategory[];

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    for (const cat of categories) {
      const config = DATE_LABEL_MAPPINGS[cat];

      if (config.regex.test(line)) {
        // Extract the value following the label or pattern
        // Example: "ETD: 15-Oct-2026", "Sailing Date - October 15, 2026", "Valid until: 2026-11-30"
        const labelExtractionPattern = new RegExp(
          `(?:${config.regex.source.replace(/^(\(\?:)?\^\|\[\^a-zA-Z0-9\]\)?/g, "")})\\s*[:=-]?\\s*([^;\\n\\r|,]+?)(?:$|\\n|\\r|,|;|\\(|\\b(?:per|vessel|transit|validity|thc|total)\\b)`,
          "i",
        );

        const match = line.match(labelExtractionPattern);
        const rawDateCandidate = match ? match[1].trim() : line.trim();

        // Clean out trailing noise words
        const cleanedCandidate = rawDateCandidate
          .replace(/^(?:is|on|dated|estimated|approx\.?)\s+/i, "")
          .replace(/[.;]+$/, "")
          .trim();

        if (cleanedCandidate && cleanedCandidate.length >= 2) {
          const parsed = parseDateDeterministic(cleanedCandidate, referenceYear);

          const item: ExtractedDateItem = {
            category: cat,
            categoryLabel: config.label,
            targetField: config.targetField,
            originalLabel: config.label,
            original_label: config.label,
            originalText: cleanedCandidate,
            original_text: cleanedCandidate,
            rawText: cleanedCandidate,
            raw_text: cleanedCandidate,
            isoDate: parsed.isoDate,
            iso_date: parsed.isoDate,
            date: parsed.isoDate || cleanedCandidate,
            formattedDisplay: parsed.isoDate || cleanedCandidate,
            formatted_display: parsed.isoDate || cleanedCandidate,
            isAmbiguous: parsed.isAmbiguous,
            is_ambiguous: parsed.isAmbiguous,
            needsReview: parsed.isAmbiguous || parsed.status !== "unambiguous",
            needs_review: parsed.isAmbiguous || parsed.status !== "unambiguous",
            status: parsed.status,
            reason: parsed.reason,
            warnings: parsed.isAmbiguous ? [parsed.reason] : [],
            originalSourceLine: line,
            original_source_line: line,
            lineNumber: lineNum,
          };

          foundItems.push(item);

          if (parsed.isAmbiguous) {
            warnings.push(`[${config.label}] ${parsed.reason}`);
            reviewReasons.push(`[${config.label}] ${parsed.reason}`);
          }

          // Store in target field map if not already present or if this is unambiguous
          if (
            !dateMap[config.targetField] ||
            (!dateMap[config.targetField]?.isoDate && parsed.isoDate)
          ) {
            dateMap[config.targetField] = item;
          }
        }
      }
    }
  });

  const hasAmbiguousDate = foundItems.some((d) => d.isAmbiguous);
  const needsReview = hasAmbiguousDate;

  return {
    dates: foundItems,
    dateMap,
    etd: dateMap.etd?.isoDate ?? (dateMap.etd?.originalText || null),
    eta: dateMap.eta?.isoDate ?? (dateMap.eta?.originalText || null),
    validityDate: dateMap.validity?.isoDate ?? (dateMap.validity?.originalText || null),
    cutoffDate: dateMap.cutoff?.isoDate ?? (dateMap.cutoff?.originalText || null),
    hasAmbiguousDate,
    has_ambiguous_date: hasAmbiguousDate,
    needsReview,
    needs_review: needsReview,
    warnings,
    reviewReasons,
  };
}
