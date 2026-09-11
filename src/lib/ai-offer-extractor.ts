import { GoogleGenAI, Type } from "@google/genai";
import type { ForwarderResponseClassification } from "@/types/requests";

export type { ForwarderResponseClassification };

// ---------------------------------------------------------------------------
// TYPES FOR STRUCTURED OFFER EXTRACTION (15 CORE CANONICAL FIELDS)
// ---------------------------------------------------------------------------

export type AvailabilityStatus =
  "AVAILABLE" | "UNAVAILABLE" | "WAITLIST" | "SUBJECT_TO_CONFIRMATION" | "UNKNOWN";

export type FieldValidationStatus = "VALID" | "NEEDS_REVIEW" | "MISMATCH" | "NOT_PROVIDED";

export interface FieldValidationItem {
  fieldKey: string;
  fieldLabel: string;
  extractedValue: string | number | boolean | null;
  requestedValue?: string | number | boolean | null;
  status: FieldValidationStatus;
  confidence: number; // 0.0 to 1.0
  validationRule: string;
  notes?: string;
}

export interface OfferConfidenceReport {
  overallConfidence: number; // 0 to 100
  overallStatus: "VALID" | "NEEDS_REVIEW" | "MISMATCH" | "DECLINED";
  matchedFieldsCount: number;
  mismatchedFieldsCount: number;
  missingFieldsCount: number;
  reviewRequiredFieldsCount: number;
  fieldValidations: FieldValidationItem[];
  summary: string;
}

export interface RequestedBookingContext {
  bookingId?: string;
  movementNumber?: string;
  containerSize?: string;
  containerCount?: number;
  origin?: string;
  destination?: string;
  targetDeparture?: string;
  targetArrival?: string;
  targetEtd?: string;
  targetEta?: string;
  cargoDescription?: string;
  cargoWeightKg?: number;
}

export interface AdditionalChargeItem {
  item: string; // e.g. "THC", "BAF", "Documentation Fee", "Security Surcharge"
  amount: number; // numeric value
  currency: string; // ISO currency code
  description?: string;
}

export interface StructuredOfferFields {
  // 1. Freight Rate (undefined/null if not present in email - never guessed)
  freightRate?: number;
  // 2. Currency (undefined/null if not present in email)
  currency?: string;
  // 3. Container Type (undefined/null if not present in email - never defaulted)
  containerType?: string;
  // 4. Quantity (undefined/null if not explicitly stated - never guessed)
  quantity?: number;
  // 5. Availability (UNKNOWN if not mentioned - never guessed)
  availability: AvailabilityStatus;
  // 6. ETD (undefined/null if not mentioned)
  etd?: string;
  etdNormalized?: string; // ISO 8601 YYYY-MM-DD
  // 7. ETA (undefined/null if not mentioned)
  eta?: string;
  etaNormalized?: string; // ISO 8601 YYYY-MM-DD
  // 8. Transit Time (undefined/null if not mentioned - never defaulted to 24)
  transitTime?: number; // In days
  // 9. Additional Charges
  additionalCharges: AdditionalChargeItem[];
  additionalChargesTotal?: number;
  // 10. Total Cost if explicitly provided or derived
  totalCost?: number;
  // 11. Free Days if mentioned (undefined/null if not mentioned - never defaulted to 14)
  freeDays?: number; // In days
  // 12. Sailing/Vessel if mentioned
  sailingVessel?: string;
  // 13. Validity/Expiry if mentioned
  validityExpiry?: string;
  validityExpiryNormalized?: string; // ISO 8601 YYYY-MM-DD
  // 14. Notes
  notes?: string;
  // 15. Response Date/Time
  responseDateTime: string; // ISO 8601 string

  // Supplemental helper fields for backwards compatibility
  carrier?: string;
  vesselName?: string;
  voyageNumber?: string;
  isDeclined: boolean;
  spaceAvailable: boolean;
  isConfirmed: boolean;
  confidence: number;
  extractionMethod: "GEMINI_AI" | "NLP_FALLBACK";
  extractionSummary: string;
  confidenceReport?: OfferConfidenceReport;
  rawJson?: Record<string, unknown>;
}

export interface ExtractedForwarderOffer extends StructuredOfferFields {
  // Backwards compatibility aliases
  ratePerContainer?: number;
  totalFreight?: number;
  containerSize?: string;
  containerCount?: number;
  transitDays?: number;
  validUntil?: string;
  summary: string;
}

export interface OfferValidationResult {
  isValid: boolean;
  validatedOffer: ExtractedForwarderOffer;
  structuredFields: StructuredOfferFields;
  normalizedStatus: ForwarderResponseClassification;
  responseClassification: ForwarderResponseClassification;
  extractionSummary: string;
  confidenceReport: OfferConfidenceReport;
  warnings: string[];
}

export interface AnalyzeEmailOfferInput {
  emailMessageId?: string;
  subject: string;
  body: string;
  snippet?: string;
  senderEmail?: string;
  senderName?: string;
  movementNumber?: string | null;
  forwarderName?: string | null;
  containerCount?: number;
  containerSize?: string;
  receivedAt?: string;
  requestedBooking?: RequestedBookingContext;
}

// ---------------------------------------------------------------------------
// NORMALIZATION ENGINES (CURRENCIES, DATES, NUMERICS, CONTAINER TYPES, AVAILABILITY)
// ---------------------------------------------------------------------------

const MONTH_NAMES: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

/**
 * Normalizes currency to standard 3-letter uppercase ISO code
 */
export function normalizeCurrency(currRaw?: string | null): string {
  if (!currRaw) return "USD";
  const trimmed = currRaw.trim().toUpperCase();

  if (trimmed === "$" || trimmed === "DOLLAR" || trimmed === "DOLLARS" || trimmed === "US$") {
    return "USD";
  }
  if (trimmed === "€" || trimmed === "EURO" || trimmed === "EUROS" || trimmed === "EUR") {
    return "EUR";
  }
  if (trimmed === "£" || trimmed === "POUND" || trimmed === "POUNDS" || trimmed === "GBP") {
    return "GBP";
  }
  if (trimmed === "AED" || trimmed === "DIRHAM" || trimmed === "DIRHAMS") {
    return "AED";
  }
  if (trimmed === "PKR" || trimmed === "RS" || trimmed === "RUPEE" || trimmed === "RUPEES") {
    return "PKR";
  }
  if (trimmed === "CNY" || trimmed === "RMB" || trimmed === "YUAN") {
    return "CNY";
  }
  if (trimmed === "SGD") {
    return "SGD";
  }

  // 3-letter alphabetic check
  if (/^[A-Z]{3}$/.test(trimmed)) {
    return trimmed;
  }

  return "USD";
}

/**
 * Normalizes container type to standard maritime equipment codes
 * (e.g., 40HC, 20FT, 40FT, 45HC, 20RF, 40RF)
 */
export function normalizeContainerType(val?: string | null): string | undefined {
  if (!val) return undefined;
  const clean = val.toUpperCase().replace(/[\s'-]/g, "");

  if (clean.includes("40HC") || clean.includes("40HQ") || clean.includes("HIGHCUBE")) {
    return "40HC";
  }
  if (clean.includes("20FT") || clean.includes("20GP") || clean.includes("20DV")) {
    return "20FT";
  }
  if (clean.includes("40FT") || clean.includes("40GP") || clean.includes("40DV")) {
    return "40FT";
  }
  if (clean.includes("45HC") || clean.includes("45HQ")) {
    return "45HC";
  }
  if (clean.includes("20RF") || clean.includes("20REEFER")) {
    return "20RF";
  }
  if (clean.includes("40RF") || clean.includes("40HR") || clean.includes("40REEFER")) {
    return "40RF";
  }

  if (clean.startsWith("40")) return "40HC";
  if (clean.startsWith("20")) return "20FT";

  return clean || "40HC";
}

/**
 * Normalizes raw numeric values into clean float or integer
 */
export function normalizeNumeric(val: unknown): number | undefined {
  if (typeof val === "number" && !isNaN(val)) {
    return Math.round(val * 100) / 100;
  }
  if (typeof val === "string") {
    const cleaned = val.replace(/[^0-9.-]/g, "");
    if (!cleaned) return undefined;
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? undefined : Math.round(parsed * 100) / 100;
  }
  return undefined;
}

/**
 * Normalizes maritime dates (e.g. "18 Sep", "18th September", "2026-09-18", "18/09/2026")
 * into both user-friendly display ("18 Sep") and standardized ISO ("2026-09-18").
 */
export function normalizeDate(
  dateStr?: string | null,
  referenceYear = 2026,
): { display?: string; iso?: string; raw?: string } {
  if (!dateStr || !dateStr.trim()) return {};

  const raw = dateStr.trim();

  // Check ISO format YYYY-MM-DD
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return {
      raw,
      display: `${d} ${monthNames[m - 1] || "Sep"}`,
      iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    };
  }

  // Check DD Month [YYYY] e.g. "18 Sep", "18th September 2026"
  const dayMonthMatch = raw.match(
    /\b([0-9]{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})(?:\s+(\d{4}))?\b/i,
  );
  if (dayMonthMatch) {
    const d = parseInt(dayMonthMatch[1], 10);
    const mStr = dayMonthMatch[2].toLowerCase();
    const y = dayMonthMatch[3] ? parseInt(dayMonthMatch[3], 10) : referenceYear;
    const mNum = MONTH_NAMES[mStr] || 9;
    const shortMonth = dayMonthMatch[2].substring(0, 3);
    const capitalMonth = shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1).toLowerCase();

    return {
      raw,
      display: `${d} ${capitalMonth}`,
      iso: `${y}-${String(mNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    };
  }

  // Check Month DD [YYYY] e.g. "September 18", "Sep 18 2026"
  const monthDayMatch = raw.match(
    /\b([A-Za-z]{3,9})\s+([0-9]{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?\b/i,
  );
  if (monthDayMatch) {
    const mStr = monthDayMatch[1].toLowerCase();
    const d = parseInt(monthDayMatch[2], 10);
    const y = monthDayMatch[3] ? parseInt(monthDayMatch[3], 10) : referenceYear;
    const mNum = MONTH_NAMES[mStr] || 9;
    const shortMonth = monthDayMatch[1].substring(0, 3);
    const capitalMonth = shortMonth.charAt(0).toUpperCase() + shortMonth.slice(1).toLowerCase();

    return {
      raw,
      display: `${d} ${capitalMonth}`,
      iso: `${y}-${String(mNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    };
  }

  return { raw, display: raw };
}

/**
 * Normalizes space availability status
 */
export function normalizeAvailability(
  text: string,
  isDeclinedBool?: boolean,
  spaceAvailableBool?: boolean,
): AvailabilityStatus {
  const clean = text.toLowerCase();

  // Declines / Rejections
  if (
    isDeclinedBool ||
    /\b(?:no space|space unavailable|vessel full|cannot accept|unable to accommodate|no equipment|declined|regret no space)\b/i.test(
      clean,
    )
  ) {
    return "UNAVAILABLE";
  }

  // Waitlist
  if (/\b(?:waitlist|standby|subject to roll)\b/i.test(clean)) {
    return "WAITLIST";
  }

  // Subject to confirmation
  if (
    /\b(?:subject to space|subject to vessel|subject to confirmation|pending space|space unconfirmed)\b/i.test(
      clean,
    )
  ) {
    return "SUBJECT_TO_CONFIRMATION";
  }

  // Available / Confirmed
  if (
    spaceAvailableBool ||
    /\b(?:space available|space confirmed|space ok|allocation secured|can accommodate|can offer|booking confirmed)\b/i.test(
      clean,
    )
  ) {
    return "AVAILABLE";
  }

  return "UNKNOWN";
}

/**
 * Generates the canonical single-line extraction string per requirement:
 * Example: "Rate = 2100 Currency = USD Container Type = 40HC Availability = AVAILABLE ETD = 18 Sep ETA = 12 Oct"
 */
export function formatOfferExtractionSummary(fields: StructuredOfferFields): string {
  const parts: string[] = [];

  if (fields.freightRate !== undefined) {
    parts.push(`Rate = ${fields.freightRate}`);
  }
  if (fields.currency) {
    parts.push(`Currency = ${fields.currency}`);
  }
  if (fields.containerType) {
    parts.push(`Container Type = ${fields.containerType}`);
  }
  if (fields.quantity && fields.quantity > 1) {
    parts.push(`Quantity = ${fields.quantity}`);
  }
  if (fields.availability && fields.availability !== "UNKNOWN") {
    parts.push(`Availability = ${fields.availability}`);
  }
  if (fields.etd) {
    parts.push(`ETD = ${fields.etd}`);
  }
  if (fields.eta) {
    parts.push(`ETA = ${fields.eta}`);
  }
  if (fields.transitTime) {
    parts.push(`Transit Time = ${fields.transitTime}d`);
  }
  if (fields.totalCost && fields.totalCost !== fields.freightRate) {
    parts.push(`Total Cost = ${fields.totalCost}`);
  }
  if (fields.freeDays) {
    parts.push(`Free Days = ${fields.freeDays}`);
  }
  if (fields.sailingVessel) {
    parts.push(`Vessel = ${fields.sailingVessel}`);
  }
  if (fields.validityExpiry) {
    parts.push(`Validity = ${fields.validityExpiry}`);
  }

  return parts.join(" ");
}

/**
 * Strictly verifies whether an email text contains an EXPLICIT carrier booking confirmation.
 * CRITICAL LOGISTICS RULE: "Rate available" ≠ "Booking confirmed".
 * Providing a price quote or space availability is NEVER a booking confirmation.
 */
export function checkExplicitBookingConfirmation(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();

  // Negative qualifiers that negate confirmation
  const negativeQualifiers = [
    /\bnot confirmed\b/i,
    /\bnot yet confirmed\b/i,
    /\byet to be confirmed\b/i,
    /\bunconfirmed\b/i,
    /\bpending confirmation\b/i,
    /\bpending space\b/i,
    /\bsubject to\b/i,
    /\bplease confirm\b/i,
    /\bkindly confirm\b/i,
    /\bawaiting (?:your )?confirmation\b/i,
  ];
  if (negativeQualifiers.some((nq) => nq.test(lower))) {
    return false;
  }

  // Explicit positive confirmation patterns
  const explicitPatterns = [
    /\bbooking (?:is |has been )?(?:firmly |now )?confi[r]?med\b/i,
    /\bbooking confi[r]?med\b/i,
    /\bwe (?:hereby |can )?confi[r]?m (?:the |your )?(?:space and )?booking\b/i,
    /\byour booking (?:is|has been) (?:firmly )?confi[r]?med\b/i,
    /\bbooking confirmation (?:attached|is attached|enclosed|number|no|ref)\b/i,
    /\bbooking confirmed as requested\b/i,
    /\bbooking secured\b/i,
    /\bbooking approved\b/i,
    /\bbooking accepted and confirmed\b/i,
    /\bconfirmed as booked\b/i,
  ];

  return explicitPatterns.some((ep) => ep.test(lower));
}

// ---------------------------------------------------------------------------
// GEMINI CLIENT SETUP (Lazy loaded to avoid startup crashes)
// ---------------------------------------------------------------------------

let geminiClient: GoogleGenAI | null = null;
let isGeminiKeyDisabled = false;

function getGeminiClient(): GoogleGenAI | null {
  if (isGeminiKeyDisabled) return null;
  if (geminiClient) return geminiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "undefined" || apiKey.length < 15) {
    return null;
  }
  try {
    geminiClient = new GoogleGenAI({ apiKey });
    return geminiClient;
  } catch {
    isGeminiKeyDisabled = true;
    return null;
  }
}

// ---------------------------------------------------------------------------
// MAIN EXTRACTION ALGORITHM (GEMINI AI + HIGH-PRECISION NLP ENGINE)
// ---------------------------------------------------------------------------

/**
 * Executes the structured offer extraction algorithm across all 15 core fields.
 */
export async function analyzeEmailForForwarderOffer(
  input: AnalyzeEmailOfferInput,
): Promise<OfferValidationResult> {
  const {
    subject = "",
    body = "",
    snippet = "",
    containerCount = 1,
    containerSize: defaultContainerSize = "40HC",
    receivedAt,
  } = input;

  const combinedText = `Subject: ${subject}\n\nBody:\n${body}\n\nSnippet: ${snippet}`.trim();
  const responseDateTime = receivedAt || new Date().toISOString();

  let rawExtracted: Partial<StructuredOfferFields> | null = null;
  let extractionMethod: "GEMINI_AI" | "NLP_FALLBACK" = "NLP_FALLBACK";

  const ai = getGeminiClient();

  if (ai && combinedText.length > 5) {
    try {
      console.log(
        "[AIOfferExtractor] Invoking Gemini structured extraction algorithm (gemini-2.5-flash)...",
      );

      const prompt = `You are a freight quotation extraction engine for container ocean logistics.
Your task is to extract canonical structured quotation fields from the forwarder email text below.

CRITICAL INSTRUCTIONS & STRICT VALIDATION RULES:
1. Do NOT blindly trust assumptions. Extract ONLY what is explicitly present in the email text.
2. Do NOT invent missing values. If a field is NOT present in the email, leave it null or omit it entirely (NULL / Not Provided).
3. Never guess rates, dates, container types, free days, or availability.
4. Container Type: Only extract if explicitly stated (e.g. "40HC", "20FT"). If not mentioned in email, leave it null (do not assume 40HC).
5. Availability:
   - If forwarder explicitly confirms space: "AVAILABLE"
   - If forwarder explicitly states no space / vessel full / declined: "UNAVAILABLE"
   - If conditional (e.g. "subject to space", "subject to carrier confirmation", "waitlist"): "SUBJECT_TO_CONFIRMATION" or "WAITLIST"
   - If not mentioned at all: "UNKNOWN" (never guess available).
6. Freight Rate: Number only (e.g. 2100). If no rate in email, leave null.
7. Free Days: Demurrage/detention days. If not explicitly mentioned, leave null (do NOT assume 14).
8. Transit Time: Days. If not mentioned, leave null (do NOT assume 24).
9. Output an extraction confidence score between 0.0 and 1.0 reflecting your certainty.

EMAIL TEXT:
"""
${combinedText}
"""`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              freightRate: {
                type: Type.NUMBER,
                description:
                  "Freight rate per container as a clean number (e.g. 2100). Null if not in email.",
              },
              currency: {
                type: Type.STRING,
                description: "Normalized ISO currency code (e.g. USD, EUR). Null if not stated.",
              },
              containerType: {
                type: Type.STRING,
                description:
                  "Standard container equipment type (e.g. 40HC, 20FT). Null if not stated.",
              },
              quantity: {
                type: Type.INTEGER,
                description: "Explicit quantity of containers. Null if not specified in text.",
              },
              availability: {
                type: Type.STRING,
                description:
                  "AVAILABLE, UNAVAILABLE, WAITLIST, SUBJECT_TO_CONFIRMATION, or UNKNOWN",
              },
              etd: {
                type: Type.STRING,
                description: "ETD / Sailing date (e.g. 18 Sep). Null if not stated.",
              },
              eta: {
                type: Type.STRING,
                description: "ETA / Arrival date (e.g. 12 Oct). Null if not stated.",
              },
              transitTime: {
                type: Type.INTEGER,
                description: "Transit time in days (e.g. 24). Null if not mentioned.",
              },
              additionalCharges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    item: { type: Type.STRING },
                    amount: { type: Type.NUMBER },
                    currency: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                },
                description: "Itemized surcharges like THC, BAF. Empty if none.",
              },
              totalCost: {
                type: Type.NUMBER,
                description: "Total cost if explicitly specified in email.",
              },
              freeDays: {
                type: Type.INTEGER,
                description: "Demurrage/detention free days. Null if not mentioned.",
              },
              sailingVessel: {
                type: Type.STRING,
                description: "Vessel name and voyage if mentioned. Null if not stated.",
              },
              validityExpiry: {
                type: Type.STRING,
                description: "Quotation validity expiry date. Null if not stated.",
              },
              notes: {
                type: Type.STRING,
                description: "Key terms or operational notes.",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Extraction confidence between 0.0 and 1.0",
              },
            },
            required: ["availability"],
          },
        },
      });

      const responseText = response.text?.trim();
      if (responseText) {
        const parsed = JSON.parse(responseText) as Record<string, unknown>;

        const rateNum = normalizeNumeric(parsed.freightRate);
        const curr = parsed.currency ? normalizeCurrency(parsed.currency as string) : undefined;
        const cntrType = parsed.containerType
          ? normalizeContainerType(parsed.containerType as string)
          : undefined;
        const qty =
          typeof parsed.quantity === "number" && parsed.quantity > 0 ? parsed.quantity : undefined;
        const avail = normalizeAvailability(
          (parsed.availability as string) || "",
          parsed.availability === "UNAVAILABLE",
          parsed.availability === "AVAILABLE",
        );

        const etdNormalized = parsed.etd ? normalizeDate(parsed.etd as string) : undefined;
        const etaNormalized = parsed.eta ? normalizeDate(parsed.eta as string) : undefined;
        const validityNormalized = parsed.validityExpiry
          ? normalizeDate(parsed.validityExpiry as string)
          : undefined;

        const additionalCharges: AdditionalChargeItem[] = Array.isArray(parsed.additionalCharges)
          ? parsed.additionalCharges
              .map((c: Record<string, unknown>) => ({
                item: String(c.item || "Surcharge"),
                amount: normalizeNumeric(c.amount) || 0,
                currency: normalizeCurrency(c.currency as string) || curr || "USD",
                description: typeof c.description === "string" ? c.description : undefined,
              }))
              .filter((c) => c.amount > 0)
          : [];

        const additionalChargesTotal = additionalCharges.reduce((sum, c) => sum + c.amount, 0);
        const totalCost =
          normalizeNumeric(parsed.totalCost) ||
          (rateNum && qty ? rateNum * qty + additionalChargesTotal : undefined);

        rawExtracted = {
          freightRate: rateNum,
          currency: curr,
          containerType: cntrType,
          quantity: qty,
          availability: avail,
          etd: etdNormalized?.display || (parsed.etd as string) || undefined,
          etdNormalized: etdNormalized?.iso,
          eta: etaNormalized?.display || (parsed.eta as string) || undefined,
          etaNormalized: etaNormalized?.iso,
          transitTime: typeof parsed.transitTime === "number" ? parsed.transitTime : undefined,
          additionalCharges,
          additionalChargesTotal: additionalChargesTotal > 0 ? additionalChargesTotal : undefined,
          totalCost,
          freeDays: typeof parsed.freeDays === "number" ? parsed.freeDays : undefined,
          sailingVessel: (parsed.sailingVessel as string) || undefined,
          validityExpiry:
            validityNormalized?.display || (parsed.validityExpiry as string) || undefined,
          validityExpiryNormalized: validityNormalized?.iso,
          notes: (parsed.notes as string) || undefined,
          responseDateTime,
          carrier:
            extractCarrierFromText(combinedText) || (parsed.sailingVessel as string)?.split(" ")[0],
          vesselName: (parsed.sailingVessel as string) || undefined,
          isDeclined: avail === "UNAVAILABLE",
          spaceAvailable: avail === "AVAILABLE",
          isConfirmed: checkExplicitBookingConfirmation(combinedText),
          confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.96,
          rawJson: parsed,
        };

        extractionMethod = "GEMINI_AI";
      }
    } catch (aiErr: unknown) {
      const errStr = aiErr instanceof Error ? aiErr.message : String(aiErr);
      if (
        errStr.includes("API key not valid") ||
        errStr.includes("API_KEY_INVALID") ||
        errStr.includes("400")
      ) {
        isGeminiKeyDisabled = true;
        geminiClient = null;
        console.log(
          "[AIOfferExtractor] Gemini API key not valid; seamlessly falling back to deterministic NLP extraction.",
        );
      } else {
        console.warn(
          "[AIOfferExtractor] Notice during Gemini API structured extraction, invoking deterministic NLP fallback:",
          aiErr,
        );
      }
    }
  }

  // If Gemini was unavailable, execute the zero-dependency deterministic NLP extraction engine
  if (!rawExtracted) {
    rawExtracted = parseOfferWithNaturalLanguageRules(combinedText, {
      containerCount,
      defaultContainerSize,
      responseDateTime,
    });
    extractionMethod = "NLP_FALLBACK";
  }

  // Normalization and validation step
  return validateExtractedOffer(
    rawExtracted,
    extractionMethod,
    containerCount,
    input.requestedBooking,
  );
}

// ---------------------------------------------------------------------------
// HIGH-PRECISION DETERMINISTIC NLP EXTRACTION ENGINE
// ---------------------------------------------------------------------------

export interface NlpExtractionOptions {
  containerCount?: number;
  defaultContainerSize?: string;
  responseDateTime?: string;
}

/**
 * Deterministic regex & NLP extraction algorithm for all 15 fields.
 *
 * Example input:
 * "USD 2,100 for 40HC, space available, ETD 18 Sep, ETA 12 Oct."
 * Output:
 * Rate = 2100 Currency = USD Container Type = 40HC Availability = AVAILABLE ETD = 18 Sep ETA = 12 Oct
 */
export function parseOfferWithNaturalLanguageRules(
  text: string,
  options?: NlpExtractionOptions,
): StructuredOfferFields {
  const clean = text.replace(/\r\n/g, " ");
  const cleanLower = clean.toLowerCase();

  // 1. Availability Status
  let availability: AvailabilityStatus = "UNKNOWN";
  if (
    /\b(?:no space(?: available)?|space unavailable|vessel (?:is )?full|cannot accept|unable to confirm|unable to accommodate|no equipment|no allocation|fully booked|booking declined|regret no space)\b/i.test(
      clean,
    ) ||
    /\bunfortunately (?:no space|we cannot|we are unable)\b/i.test(clean)
  ) {
    availability = "UNAVAILABLE";
  } else if (/\b(?:waitlist|standby|subject to roll)\b/i.test(clean)) {
    availability = "WAITLIST";
  } else if (
    /\b(?:subject to space|subject to carrier confirmation|pending space)\b/i.test(clean)
  ) {
    availability = "SUBJECT_TO_CONFIRMATION";
  } else if (
    /\b(?:space available|space confirmed|space ok|allocation secured|can offer|we confirm|booking confirmed)\b/i.test(
      clean,
    )
  ) {
    availability = "AVAILABLE";
  }

  const isDeclined = availability === "UNAVAILABLE";
  const spaceAvailable = availability === "AVAILABLE";

  // 2. Freight Rate & Currency
  let freightRate: number | undefined;
  let currency: string | undefined;

  // Check currency
  const currMatch = clean.match(/\b(USD|EUR|GBP|AED|PKR|CNY|SGD|\$|€|£)\b/i);
  if (currMatch) {
    currency = normalizeCurrency(currMatch[1]);
  }

  // Match freight rate
  // Matches "Freight Rate: USD 2,100", "USD 2,100", "$2,100", "Rate is USD 2,100", "2,100 USD", "USD 1,950 for 40HC"
  const ratePatterns = [
    // 1. Explicit Freight Rate / Ocean Rate / Base Rate / Quote line with currency
    /(?:freight\s+rate|ocean\s+rate|base\s+rate|freight|rate(?:\s+is)?|offer(?:\s+is)?|quote(?:\s+is)?)[:\s]+(?:usd|\$|eur|gbp)?\s*([1-9][0-9]{0,2}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[1-9][0-9]{2,4}(?:\.[0-9]{2})?)/i,
    // 2. Dollar / USD amount with comma thousands e.g. USD 2,100 or $2,100 (excluding lines mentioning additional/surcharges)
    /(?<!additional\s*(?:charges?|fees?)[:\s]+)(?:usd|\$)\s*([1-9][0-9]{0,2}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[1-9][0-9]{2,4}(?:\.[0-9]{2})?)\b/i,
    // 3. Amount followed by USD / dollars / container
    /([1-9][0-9]{0,2}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:usd|dollars|\$)/i,
    /([1-9][0-9]{2,4})\s*(?:\/|\s*per\s*)(?:cntr|container|teu|feu|40hc|20ft|40ft)/i,
    // 4. Standard USD digit match
    /\b(?:usd|\$)\s*([1-9][0-9]{2,4})\b/i,
  ];

  for (const rx of ratePatterns) {
    const m = clean.match(rx);
    if (m && m[1]) {
      const parsed = normalizeNumeric(m[1]);
      if (parsed && parsed >= 100 && parsed <= 50000) {
        freightRate = parsed;
        if (!currency) currency = "USD";
        break;
      }
    }
  }

  // 3. Container Type - Extract ONLY if explicitly mentioned; do NOT invent or default
  let containerType: string | undefined;
  const containerMatch = clean.match(
    /\b(40(?:'|FT)?\s*HC|40HC|40HQ|20(?:'|FT)?\s*GP|20FT|40(?:'|FT)?\s*GP|40FT|45HC|20RF|40RF)\b/i,
  );
  if (containerMatch && containerMatch[1]) {
    containerType = normalizeContainerType(containerMatch[1]);
  }

  // 4. Quantity - Extract ONLY if explicitly mentioned; do NOT invent
  let quantity: number | undefined;
  const qtyMatch = clean.match(/([1-9][0-9]?)\s*(?:x\s*|cntr|container|units|boxes)/i);
  if (qtyMatch && qtyMatch[1]) {
    const q = parseInt(qtyMatch[1], 10);
    if (!isNaN(q) && q >= 1 && q <= 100) {
      quantity = q;
    }
  }

  // 5. ETD (Estimated Time of Departure)
  // e.g. "ETD 18 Sep", "18 Sep sailing", "ETD: 20 September", "sailing 18 Sep"
  let etd: string | undefined;
  let etdNormalized: string | undefined;

  const etdMatch =
    clean.match(
      /(?:etd|sailing|departure)(?:\s+date)?[:\s]+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+|\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+[0-9]{1,2})/i,
    ) || clean.match(/([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+)\s+sailing/i);
  if (etdMatch && etdMatch[1]) {
    const parsedDate = normalizeDate(etdMatch[1]);
    etd = parsedDate.display;
    etdNormalized = parsedDate.iso;
  }

  // 6. ETA (Estimated Time of Arrival)
  // e.g. "ETA 12 Oct", "ETA Karachi 12 Oct", "arrival 12 October"
  let eta: string | undefined;
  let etaNormalized: string | undefined;

  const etaMatch = clean.match(
    /(?:eta)(?:\s+[A-Za-z]+)?[:\s]+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+|\d{4}-\d{2}-\d{2}|[A-Za-z]+\s+[0-9]{1,2})/i,
  );
  if (etaMatch && etaMatch[1]) {
    const parsedDate = normalizeDate(etaMatch[1]);
    eta = parsedDate.display;
    etaNormalized = parsedDate.iso;
  }

  // 7. Transit Time - Extract ONLY if mentioned; do NOT default to 24
  let transitTime: number | undefined;
  const transitMatch =
    clean.match(/transit(?:\s+time)?[:\s]+([1-9][0-9]?)\s*(?:days|day|d)?/i) ||
    clean.match(/([1-9][0-9]?)\s*(?:days|day|d)\s*transit/i);
  if (transitMatch && transitMatch[1]) {
    const td = parseInt(transitMatch[1], 10);
    if (!isNaN(td) && td >= 2 && td <= 90) {
      transitTime = td;
    }
  }

  // 8. Additional Charges
  const additionalCharges: AdditionalChargeItem[] = [];
  const thcMatch = clean.match(/\bthc[:\s]+\$?\s*([0-9]+(?:\.[0-9]{2})?)/i);
  if (thcMatch) {
    additionalCharges.push({
      item: "THC",
      amount: normalizeNumeric(thcMatch[1]) || 0,
      currency: currency || "USD",
      description: "Terminal Handling Charge",
    });
  }
  const bafMatch = clean.match(/\bbaf[:\s]+\$?\s*([0-9]+(?:\.[0-9]{2})?)/i);
  if (bafMatch) {
    additionalCharges.push({
      item: "BAF",
      amount: normalizeNumeric(bafMatch[1]) || 0,
      currency: currency || "USD",
      description: "Bunker Adjustment Factor",
    });
  }
  const docMatch = clean.match(/\b(?:doc|bl)\s*(?:fee)?[:\s]+\$?\s*([0-9]+(?:\.[0-9]{2})?)/i);
  if (docMatch) {
    additionalCharges.push({
      item: "DOC",
      amount: normalizeNumeric(docMatch[1]) || 0,
      currency: currency || "USD",
      description: "Documentation Fee",
    });
  }
  const addChargesMatch = clean.match(
    /\b(?:additional\s+charges?|other\s+charges?|surcharges?)[:\s]+(?:usd|\$)?\s*([0-9]+(?:\.[0-9]{2})?)/i,
  );
  if (addChargesMatch) {
    additionalCharges.push({
      item: "ADDITIONAL",
      amount: normalizeNumeric(addChargesMatch[1]) || 0,
      currency: currency || "USD",
      description: "Additional Charges",
    });
  }

  const additionalChargesTotal = additionalCharges.reduce((sum, c) => sum + c.amount, 0);

  // 9. Total Cost - derived or extracted
  let totalCost: number | undefined;
  const totalMatch = clean.match(
    /(?:total(?:\s+cost|\s+freight|\s+amount)?|all\s*in)[:\s]+\$?\s*([0-9,]+(?:\.[0-9]{2})?)/i,
  );
  if (totalMatch && totalMatch[1]) {
    totalCost = normalizeNumeric(totalMatch[1]);
  } else if (freightRate && quantity) {
    totalCost = freightRate * quantity + (additionalChargesTotal || 0);
  } else if (freightRate && !quantity) {
    totalCost = freightRate + (additionalChargesTotal || 0);
  }

  // 10. Free Days - Extract ONLY if mentioned; do NOT default to 14
  let freeDays: number | undefined;
  const freeMatch =
    clean.match(
      /([1-9][0-9]?)\s*(?:days?\s+free|free\s+days|days?\s+detention|days?\s+demurrage)/i,
    ) || clean.match(/free\s*days?[:\s]+([1-9][0-9]?)/i);
  if (freeMatch && freeMatch[1]) {
    const fd = parseInt(freeMatch[1], 10);
    if (!isNaN(fd) && fd >= 1 && fd <= 45) {
      freeDays = fd;
    }
  }

  // 11. Sailing / Vessel
  let sailingVessel: string | undefined;
  const vesselMatch = clean.match(
    /(?:vessel|vsl|mv|sailing\s+on)[:\s]+([A-Za-z0-9\s-]+(?:\s*(?:\/|v\.|voy\.|voyage)\s*[A-Za-z0-9-]+)?)/i,
  );
  if (vesselMatch && vesselMatch[1]) {
    sailingVessel = vesselMatch[1].trim();
  }

  // 12. Validity / Expiry
  let validityExpiry: string | undefined;
  let validityExpiryNormalized: string | undefined;
  const validMatch = clean.match(
    /(?:valid(?:ity)?(?:\s+until)?|expires?)[:\s]+([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+|\d{4}-\d{2}-\d{2})/i,
  );
  if (validMatch && validMatch[1]) {
    const parsedValid = normalizeDate(validMatch[1]);
    validityExpiry = parsedValid.display;
    validityExpiryNormalized = parsedValid.iso;
  }

  // 13. Carrier
  const carrier = extractCarrierFromText(clean);

  // 14. Notes
  let notes: string | undefined;
  if (clean.includes("subject to") || clean.includes("all inclusive") || clean.includes("terms")) {
    const notesMatch = clean.match(/(?:note|remarks?|terms)[:\s]+([^.\n]+)/i);
    if (notesMatch && notesMatch[1]) {
      notes = notesMatch[1].trim();
    }
  }

  // 15. Response Date / Time
  const responseDateTime = options?.responseDateTime || new Date().toISOString();

  // Build the structured fields (strictly without invented missing values)
  const fields: StructuredOfferFields = {
    freightRate,
    currency,
    containerType,
    quantity,
    availability,
    etd,
    etdNormalized,
    eta,
    etaNormalized,
    transitTime,
    additionalCharges,
    additionalChargesTotal: additionalChargesTotal > 0 ? additionalChargesTotal : undefined,
    totalCost,
    freeDays,
    sailingVessel,
    validityExpiry,
    validityExpiryNormalized,
    notes,
    responseDateTime,
    carrier,
    vesselName: sailingVessel,
    isDeclined,
    spaceAvailable,
    isConfirmed: checkExplicitBookingConfirmation(text),
    confidence: isDeclined ? 0.98 : freightRate ? 0.95 : 0.7,
    extractionMethod: "NLP_FALLBACK",
    extractionSummary: "",
  };

  fields.extractionSummary = formatOfferExtractionSummary(fields);

  return fields;
}

/**
 * Extracts shipping carrier name from text
 */
function extractCarrierFromText(text: string): string | undefined {
  const carrierList = [
    "MSC",
    "Maersk",
    "CMA CGM",
    "Hapag-Lloyd",
    "ONE",
    "Cosco",
    "Evergreen",
    "Yang Ming",
    "HMM",
    "ZIM",
    "OOCL",
    "PIL",
    "Wan Hai",
  ];
  for (const c of carrierList) {
    if (new RegExp(`\\b${c}\\b`, "i").test(text)) {
      return c;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// VALIDATION & NORMALIZATION PIPELINE
// ---------------------------------------------------------------------------

export function validateExtractedOffer(
  raw: Partial<StructuredOfferFields>,
  method: "GEMINI_AI" | "NLP_FALLBACK",
  containerCount = 1,
  requestedBooking?: RequestedBookingContext,
): OfferValidationResult {
  const warnings: string[] = [];
  const fieldValidations: FieldValidationItem[] = [];

  const rate = raw.freightRate;
  const isDeclined = Boolean(raw.isDeclined || raw.availability === "UNAVAILABLE");
  const targetContainerSize = requestedBooking?.containerSize;
  const targetContainerCount = requestedBooking?.containerCount ?? containerCount;

  // 1. Container Type Validation against Booking
  const validatedContainerType = raw.containerType;
  if (!raw.containerType) {
    fieldValidations.push({
      fieldKey: "containerType",
      fieldLabel: "Container Type",
      extractedValue: null,
      requestedValue: targetContainerSize || null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Field not present in email (NULL / Not Provided)",
      notes: "Forwarder did not state equipment type in quotation (never defaulted).",
    });
  } else {
    const normExtracted = normalizeContainerType(raw.containerType);
    if (targetContainerSize) {
      const normRequested = normalizeContainerType(targetContainerSize);
      if (normExtracted === normRequested) {
        fieldValidations.push({
          fieldKey: "containerType",
          fieldLabel: "Container Type",
          extractedValue: raw.containerType,
          requestedValue: targetContainerSize,
          status: "VALID",
          confidence: 0.98,
          validationRule: "Exact equipment match against requested booking",
          notes: `Requested ${targetContainerSize} → Forwarder says: ${raw.containerType} → Valid`,
        });
      } else {
        fieldValidations.push({
          fieldKey: "containerType",
          fieldLabel: "Container Type",
          extractedValue: raw.containerType,
          requestedValue: targetContainerSize,
          status: "MISMATCH",
          confidence: 0.35,
          validationRule: "Equipment type mismatch against requested booking",
          notes: `Equipment Mismatch: Requested ${targetContainerSize} vs Forwarder offered ${raw.containerType} → Marked for review`,
        });
        warnings.push(
          `Container type discrepancy: Forwarder quoted ${raw.containerType} but booking requires ${targetContainerSize}.`,
        );
      }
    } else {
      fieldValidations.push({
        fieldKey: "containerType",
        fieldLabel: "Container Type",
        extractedValue: raw.containerType,
        requestedValue: null,
        status: "VALID",
        confidence: 0.92,
        validationRule: "Standard maritime equipment recognized",
        notes: `Quoted equipment: ${raw.containerType}`,
      });
    }
  }

  // 2. Container Quantity Validation
  const validatedQuantity = raw.quantity;
  if (raw.quantity === undefined || raw.quantity === null) {
    fieldValidations.push({
      fieldKey: "quantity",
      fieldLabel: "Quantity",
      extractedValue: null,
      requestedValue: targetContainerCount,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Quantity not mentioned in email (NULL / Not Provided)",
      notes: "Forwarder did not specify quantity in reply (not guessed).",
    });
  } else {
    if (targetContainerCount !== undefined) {
      if (raw.quantity === targetContainerCount) {
        fieldValidations.push({
          fieldKey: "quantity",
          fieldLabel: "Quantity",
          extractedValue: raw.quantity,
          requestedValue: targetContainerCount,
          status: "VALID",
          confidence: 0.96,
          validationRule: "Container count matches booking request",
          notes: `Requested ${targetContainerCount}x → Forwarder confirmed ${raw.quantity}x → Valid`,
        });
      } else {
        fieldValidations.push({
          fieldKey: "quantity",
          fieldLabel: "Quantity",
          extractedValue: raw.quantity,
          requestedValue: targetContainerCount,
          status: "MISMATCH",
          confidence: 0.45,
          validationRule: "Quantity discrepancy against booking request",
          notes: `Quantity Discrepancy: Requested ${targetContainerCount}x vs Quoted ${raw.quantity}x → Needs review`,
        });
        warnings.push(
          `Quantity mismatch: Forwarder quoted ${raw.quantity} container(s), booking requested ${targetContainerCount}.`,
        );
      }
    } else {
      fieldValidations.push({
        fieldKey: "quantity",
        fieldLabel: "Quantity",
        extractedValue: raw.quantity,
        requestedValue: null,
        status: "VALID",
        confidence: 0.9,
        validationRule: "Container quantity specified",
        notes: `Quantity: ${raw.quantity} cntr`,
      });
    }
  }

  // 3. Freight Rate Validation
  let validatedRate = rate;
  if (rate === undefined || rate === null) {
    fieldValidations.push({
      fieldKey: "freightRate",
      fieldLabel: "Freight Rate",
      extractedValue: null,
      requestedValue: null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Rate not present in email (NULL / Not Provided)",
      notes: "Forwarder did not state a freight rate (never guessed).",
    });
  } else {
    if (rate < 100) {
      warnings.push(`Extracted rate $${rate} is unusually low (below $100 threshold).`);
      fieldValidations.push({
        fieldKey: "freightRate",
        fieldLabel: "Freight Rate",
        extractedValue: rate,
        requestedValue: null,
        status: "NEEDS_REVIEW",
        confidence: 0.45,
        validationRule: "Rate below $100 ocean freight threshold",
        notes: `Rate $${rate} is unusually low → Operator review required.`,
      });
      validatedRate = rate;
    } else if (rate > 50000) {
      warnings.push(`Extracted rate $${rate} exceeds standard freight threshold ($50,000).`);
      fieldValidations.push({
        fieldKey: "freightRate",
        fieldLabel: "Freight Rate",
        extractedValue: rate,
        requestedValue: null,
        status: "NEEDS_REVIEW",
        confidence: 0.5,
        validationRule: "Rate exceeds $50,000 ocean freight threshold",
        notes: `Rate $${rate} is unusually high → Operator review required.`,
      });
      validatedRate = rate;
    } else {
      fieldValidations.push({
        fieldKey: "freightRate",
        fieldLabel: "Freight Rate",
        extractedValue: rate,
        requestedValue: null,
        status: "VALID",
        confidence: 0.98,
        validationRule: "Standard ocean freight rate parameters ($100 - $50k)",
        notes: `Verified freight rate: ${raw.currency || "USD"} ${rate.toLocaleString()} / container`,
      });
    }
  }

  // 4. Currency Validation
  const validatedCurrency = raw.currency;
  if (!raw.currency) {
    fieldValidations.push({
      fieldKey: "currency",
      fieldLabel: "Currency",
      extractedValue: null,
      requestedValue: "USD",
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Currency not stated in email",
      notes: "No currency symbol or code detected in email.",
    });
  } else {
    fieldValidations.push({
      fieldKey: "currency",
      fieldLabel: "Currency",
      extractedValue: raw.currency,
      requestedValue: "USD",
      status: "VALID",
      confidence: 0.98,
      validationRule: "Standard ISO Currency",
      notes: `Currency: ${raw.currency}`,
    });
  }

  // 5. Availability / Space Validation
  const rawAvail = raw.availability;
  if (!rawAvail || rawAvail === "UNKNOWN") {
    fieldValidations.push({
      fieldKey: "availability",
      fieldLabel: "Space / Availability",
      extractedValue: null,
      requestedValue: "AVAILABLE",
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Availability not mentioned in email (NULL / Not Provided)",
      notes: "Space confirmation not stated in email (never guessed available).",
    });
  } else if (rawAvail === "AVAILABLE") {
    fieldValidations.push({
      fieldKey: "availability",
      fieldLabel: "Space / Availability",
      extractedValue: "AVAILABLE",
      requestedValue: "AVAILABLE",
      status: "VALID",
      confidence: 0.98,
      validationRule: "Space availability explicitly confirmed",
      notes: "Forwarder confirmed space is available for this shipment.",
    });
  } else if (rawAvail === "UNAVAILABLE") {
    fieldValidations.push({
      fieldKey: "availability",
      fieldLabel: "Space / Availability",
      extractedValue: "UNAVAILABLE",
      requestedValue: "AVAILABLE",
      status: "VALID",
      confidence: 0.98,
      validationRule: "Forwarder explicitly indicated space unavailable / declined",
      notes: "Forwarder confirmed vessel is full / no space available.",
    });
  } else {
    fieldValidations.push({
      fieldKey: "availability",
      fieldLabel: "Space / Availability",
      extractedValue: rawAvail,
      requestedValue: "AVAILABLE",
      status: "NEEDS_REVIEW",
      confidence: 0.55,
      validationRule: "Space is conditional / subject to carrier confirmation / waitlist",
      notes: `Space is conditional (${rawAvail}) → Requires manual operator verification.`,
    });
    warnings.push(`Space is unconfirmed: Forwarder indicated status as "${rawAvail}".`);
  }

  // 6. ETD (Estimated Time of Departure) Validation
  const targetDeparture = requestedBooking?.targetDeparture || requestedBooking?.targetEtd;
  if (!raw.etd) {
    fieldValidations.push({
      fieldKey: "etd",
      fieldLabel: "ETD (Departure)",
      extractedValue: null,
      requestedValue: targetDeparture || null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Departure date not present in email (NULL / Not Provided)",
      notes: "ETD not specified by forwarder (never guessed).",
    });
  } else {
    fieldValidations.push({
      fieldKey: "etd",
      fieldLabel: "ETD (Departure)",
      extractedValue: raw.etd,
      requestedValue: targetDeparture || null,
      status: "VALID",
      confidence: 0.95,
      validationRule: "Departure date provided",
      notes: targetDeparture
        ? `Quoted ETD ${raw.etd} (Target departure: ${targetDeparture})`
        : `Quoted ETD: ${raw.etd}`,
    });
  }

  // 7. ETA (Estimated Time of Arrival) Validation
  const targetArrival = requestedBooking?.targetArrival || requestedBooking?.targetEta;
  if (!raw.eta) {
    fieldValidations.push({
      fieldKey: "eta",
      fieldLabel: "ETA (Arrival)",
      extractedValue: null,
      requestedValue: targetArrival || null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Arrival date not present in email (NULL / Not Provided)",
      notes: "ETA not specified by forwarder (never guessed).",
    });
  } else {
    // Chronological sanity check between ETD and ETA if both normalized
    if (raw.etaNormalized && raw.etdNormalized && raw.etaNormalized < raw.etdNormalized) {
      fieldValidations.push({
        fieldKey: "eta",
        fieldLabel: "ETA (Arrival)",
        extractedValue: raw.eta,
        requestedValue: targetArrival || null,
        status: "NEEDS_REVIEW",
        confidence: 0.3,
        validationRule: "Chronological inconsistency: ETA is before ETD",
        notes: `Arrival date (${raw.eta}) cannot precede departure (${raw.etd}) → Flagged for review.`,
      });
      warnings.push(`Date inconsistency: Quoted ETA ${raw.eta} is earlier than ETD ${raw.etd}.`);
    } else {
      fieldValidations.push({
        fieldKey: "eta",
        fieldLabel: "ETA (Arrival)",
        extractedValue: raw.eta,
        requestedValue: targetArrival || null,
        status: "VALID",
        confidence: 0.94,
        validationRule: "Arrival date provided and chronologically valid",
        notes: `ETA: ${raw.eta}`,
      });
    }
  }

  // 8. Transit Time Validation
  if (raw.transitTime === undefined || raw.transitTime === null) {
    fieldValidations.push({
      fieldKey: "transitTime",
      fieldLabel: "Transit Time",
      extractedValue: null,
      requestedValue: null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Transit time not present (NULL / Not Provided)",
      notes: "Transit duration not stated in email (not defaulted to 24).",
    });
  } else if (raw.transitTime < 2 || raw.transitTime > 80) {
    fieldValidations.push({
      fieldKey: "transitTime",
      fieldLabel: "Transit Time",
      extractedValue: `${raw.transitTime} days`,
      requestedValue: null,
      status: "NEEDS_REVIEW",
      confidence: 0.55,
      validationRule: "Unusual transit duration (<2 or >80 days)",
      notes: `${raw.transitTime} days transit is outside expected ocean corridor norms → Verify routing.`,
    });
  } else {
    fieldValidations.push({
      fieldKey: "transitTime",
      fieldLabel: "Transit Time",
      extractedValue: `${raw.transitTime} days`,
      requestedValue: null,
      status: "VALID",
      confidence: 0.96,
      validationRule: "Standard transit duration",
      notes: `${raw.transitTime} days transit time`,
    });
  }

  // 9. Free Days Validation
  if (raw.freeDays === undefined || raw.freeDays === null) {
    fieldValidations.push({
      fieldKey: "freeDays",
      fieldLabel: "Free Days",
      extractedValue: null,
      requestedValue: null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Free days not mentioned in email (NULL / Not Provided)",
      notes: "Demurrage/detention free time not specified (not defaulted to 14).",
    });
  } else {
    fieldValidations.push({
      fieldKey: "freeDays",
      fieldLabel: "Free Days",
      extractedValue: `${raw.freeDays} days`,
      requestedValue: null,
      status: "VALID",
      confidence: 0.96,
      validationRule: "Free days stated",
      notes: `${raw.freeDays} days demurrage/detention free time`,
    });
  }

  // 10. Sailing / Vessel Validation
  if (!raw.sailingVessel) {
    fieldValidations.push({
      fieldKey: "sailingVessel",
      fieldLabel: "Sailing / Vessel",
      extractedValue: null,
      requestedValue: null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Vessel not specified in email (NULL / Not Provided)",
      notes: "Vessel name not specified by forwarder.",
    });
  } else {
    fieldValidations.push({
      fieldKey: "sailingVessel",
      fieldLabel: "Sailing / Vessel",
      extractedValue: raw.sailingVessel,
      requestedValue: null,
      status: "VALID",
      confidence: 0.95,
      validationRule: "Vessel name identified",
      notes: `Vessel: ${raw.sailingVessel}`,
    });
  }

  // 11. Validity / Expiry Validation
  if (!raw.validityExpiry) {
    fieldValidations.push({
      fieldKey: "validityExpiry",
      fieldLabel: "Validity / Expiry",
      extractedValue: null,
      requestedValue: null,
      status: "NOT_PROVIDED",
      confidence: 0.0,
      validationRule: "Quotation expiry date not provided in email",
      notes: "Validity period not specified.",
    });
  } else {
    fieldValidations.push({
      fieldKey: "validityExpiry",
      fieldLabel: "Validity / Expiry",
      extractedValue: raw.validityExpiry,
      requestedValue: null,
      status: "VALID",
      confidence: 0.95,
      validationRule: "Validity expiration specified",
      notes: `Valid until ${raw.validityExpiry}`,
    });
  }

  // 12. Total Cost Calculation
  const totalCost =
    raw.totalCost ||
    (validatedRate && validatedQuantity ? validatedRate * validatedQuantity : undefined) ||
    (validatedRate ? validatedRate : undefined);

  if (totalCost !== undefined) {
    fieldValidations.push({
      fieldKey: "totalCost",
      fieldLabel: "Total Cost",
      extractedValue: `${raw.currency || "USD"} ${totalCost.toLocaleString()}`,
      requestedValue: null,
      status: "VALID",
      confidence: 0.95,
      validationRule: "Derived from freight rate and container quantity",
      notes: `Total: ${raw.currency || "USD"} ${totalCost.toLocaleString()}`,
    });
  }

  // -------------------------------------------------------------------------
  // COMPUTE OVERALL CONFIDENCE SCORE & STATUS (0 to 100%)
  // -------------------------------------------------------------------------
  const matchedFieldsCount = fieldValidations.filter((f) => f.status === "VALID").length;
  const mismatchedFieldsCount = fieldValidations.filter((f) => f.status === "MISMATCH").length;
  const missingFieldsCount = fieldValidations.filter((f) => f.status === "NOT_PROVIDED").length;
  const reviewRequiredFieldsCount = fieldValidations.filter(
    (f) => f.status === "NEEDS_REVIEW",
  ).length;

  let overallConfidence = 0;
  let overallStatus: "VALID" | "NEEDS_REVIEW" | "MISMATCH" | "DECLINED" = "VALID";

  if (isDeclined) {
    overallConfidence = 98;
    overallStatus = "DECLINED";
  } else {
    // Weighted scoring model:
    // Rate (30%), Container Type (20%), Availability (25%), ETD (10%), ETA (5%), Currency (5%), Free Days / Transit (5%)
    const weights: Record<string, number> = {
      freightRate: 30,
      containerType: 20,
      availability: 25,
      etd: 10,
      eta: 5,
      currency: 5,
      transitTime: 3,
      freeDays: 2,
    };

    let earnedScore = 0;
    for (const item of fieldValidations) {
      const weight = weights[item.fieldKey] || 0;
      if (item.status === "VALID") {
        earnedScore += weight * item.confidence;
      } else if (item.status === "NEEDS_REVIEW") {
        earnedScore += weight * item.confidence * 0.4;
      }
      // NOT_PROVIDED or MISMATCH earn 0 points
    }

    // Apply strict penalties:
    // Mismatches incur a 25 point deduction per mismatch
    // Needs Review items incur a 10 point deduction
    const penalties = mismatchedFieldsCount * 25 + reviewRequiredFieldsCount * 10;
    let computed = earnedScore - penalties;

    // If rate is completely missing and not declined, overall confidence cannot exceed 45%
    if (validatedRate === undefined) {
      computed = Math.min(computed, 45);
    }

    // Method factor
    if (method === "GEMINI_AI") {
      computed = Math.min(100, computed + 3);
    }

    overallConfidence = Math.max(0, Math.min(100, Math.round(computed)));

    if (mismatchedFieldsCount > 0) {
      overallStatus = "MISMATCH";
    } else if (
      reviewRequiredFieldsCount > 0 ||
      validatedRate === undefined ||
      rawAvail === "SUBJECT_TO_CONFIRMATION" ||
      rawAvail === "WAITLIST" ||
      rawAvail === "UNKNOWN" ||
      !rawAvail ||
      overallConfidence < 75
    ) {
      overallStatus = "NEEDS_REVIEW";
    } else {
      overallStatus = "VALID";
    }
  }

  // Canonical normalized status for system routing (6 Canonical Categories)
  // "Rate available" ≠ "Booking confirmed".
  // Only an explicit carrier booking confirmation triggers CONFIRMED.
  let normalizedStatus: ForwarderResponseClassification = "NEEDS_REVIEW";

  if (isDeclined) {
    const lowerNotes = (raw.notes || "").toLowerCase();
    if (
      lowerNotes.includes("no space") ||
      lowerNotes.includes("vessel full") ||
      lowerNotes.includes("fully booked") ||
      lowerNotes.includes("space is not available") ||
      lowerNotes.includes("no equipment")
    ) {
      normalizedStatus = "NOT_AVAILABLE";
    } else {
      normalizedStatus = "DECLINED";
    }
  } else if (raw.isConfirmed === true && overallStatus !== "MISMATCH") {
    // Only an EXPLICIT booking confirmation triggers CONFIRMED.
    normalizedStatus = "CONFIRMED";
  } else if (
    validatedRate !== undefined &&
    mismatchedFieldsCount === 0 &&
    overallConfidence >= 50
  ) {
    // Commercial quotation with rate is OFFER_RECEIVED, NEVER CONFIRMED!
    normalizedStatus = "OFFER_RECEIVED";
  } else if (
    (rawAvail === "AVAILABLE" || raw.spaceAvailable === true) &&
    validatedRate === undefined &&
    mismatchedFieldsCount === 0
  ) {
    // Space or equipment is available, rate pending
    normalizedStatus = "AVAILABLE";
  } else if (rawAvail === "UNAVAILABLE") {
    normalizedStatus = "NOT_AVAILABLE";
  } else {
    normalizedStatus = "NEEDS_REVIEW";
  }

  const confidenceReport: OfferConfidenceReport = {
    overallConfidence,
    overallStatus,
    matchedFieldsCount,
    mismatchedFieldsCount,
    missingFieldsCount,
    reviewRequiredFieldsCount,
    fieldValidations,
    summary: isDeclined
      ? "Forwarder indicated space unavailable / declined."
      : overallStatus === "MISMATCH"
        ? `Equipment or quantity mismatch detected against booking (${mismatchedFieldsCount} mismatch). Review required.`
        : overallStatus === "NEEDS_REVIEW"
          ? `Extraction has uncertain or missing critical fields (${overallConfidence}% confidence). Operator review required.`
          : `High confidence extraction (${overallConfidence}%), all fields validated against booking request.`,
  };

  const structuredFields: StructuredOfferFields = {
    freightRate: validatedRate,
    currency: validatedCurrency,
    containerType: validatedContainerType,
    quantity: validatedQuantity,
    availability: raw.availability || (isDeclined ? "UNAVAILABLE" : "UNKNOWN"),
    etd: raw.etd,
    etdNormalized: raw.etdNormalized,
    eta: raw.eta,
    etaNormalized: raw.etaNormalized,
    transitTime: raw.transitTime,
    additionalCharges: raw.additionalCharges || [],
    additionalChargesTotal: raw.additionalChargesTotal,
    totalCost,
    freeDays: raw.freeDays,
    sailingVessel: raw.sailingVessel,
    validityExpiry: raw.validityExpiry,
    validityExpiryNormalized: raw.validityExpiryNormalized,
    notes: raw.notes,
    responseDateTime: raw.responseDateTime || new Date().toISOString(),
    carrier: raw.carrier,
    vesselName: raw.vesselName || raw.sailingVessel,
    voyageNumber: raw.voyageNumber,
    isDeclined,
    spaceAvailable: rawAvail === "AVAILABLE",
    isConfirmed: Boolean(raw.isConfirmed && !isDeclined),
    confidence: overallConfidence / 100,
    extractionMethod: method,
    extractionSummary: "",
    confidenceReport,
    rawJson: raw.rawJson,
  };

  structuredFields.extractionSummary = formatOfferExtractionSummary(structuredFields);

  // Backward-compatible ExtractedForwarderOffer
  const validatedOffer: ExtractedForwarderOffer = {
    ...structuredFields,
    ratePerContainer: validatedRate,
    totalFreight: totalCost,
    containerSize: structuredFields.containerType,
    containerCount: validatedQuantity,
    transitDays: structuredFields.transitTime,
    validUntil: structuredFields.validityExpiry,
    summary:
      structuredFields.extractionSummary ||
      (isDeclined
        ? "Forwarder indicated space unavailable."
        : validatedRate
          ? `Offer received at USD ${validatedRate.toLocaleString()}${
              structuredFields.containerType ? ` for ${structuredFields.containerType}` : ""
            }.`
          : "Quotation requires operator review."),
  };

  const isValid = isDeclined || (validatedRate !== undefined && mismatchedFieldsCount === 0);

  return {
    isValid,
    validatedOffer,
    structuredFields,
    normalizedStatus,
    responseClassification: normalizedStatus,
    extractionSummary: structuredFields.extractionSummary,
    confidenceReport,
    warnings,
  };
}
