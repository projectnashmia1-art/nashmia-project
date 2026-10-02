import type { ForwarderResponseClassification } from "@/types/requests";

export type { ForwarderResponseClassification };
export type ConfirmationStatus = "CONFIRMED" | "NOT_CONFIRMED" | "NEEDS_REVIEW" | "REJECTED";

export interface ConfirmationDetectionInput {
  emailMessageId?: string;
  subject: string;
  body: string;
  snippet?: string;
  senderEmail?: string;
  senderName?: string;
  movementNumber?: string | null;
  forwarderName?: string | null;
  matchStatus?: "MATCHED" | "NEEDS_REVIEW" | "UNMATCHED" | "PENDING" | null;
}

export interface ConfirmationDetectionResult {
  confirmationStatus: ConfirmationStatus;
  classification: ForwarderResponseClassification;
  confidence: number;
  reason: string;
  detectedBy: "DETERMINISTIC" | "AI" | "RULE_FALLBACK";
  emailMessageId?: string;
  details?: {
    matchedKeywords?: string[];
    analysis?: string;
    hasNegativeQualifiers?: boolean;
    extractedReference?: string | null;
  };
}

/**
 * Strips quoted reply history, email headers, and formatting artifacts.
 */
function cleanEmailBody(body: string, snippet?: string): string {
  const raw = (body || snippet || "").trim();
  if (!raw) return "";

  // Strip lines starting with > (quoted replies)
  const lines = raw.split(/\r?\n/);
  const filteredLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) continue;
    if (
      /^on\s.+wrote:?$/i.test(trimmed) ||
      /^from:\s.+/i.test(trimmed) ||
      /^-----original message-----/i.test(trimmed) ||
      /^---------------------------/i.test(trimmed)
    ) {
      break;
    }
    filteredLines.push(line);
  }

  return filteredLines.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Deterministic rules for classifying forwarder responses into the 6 canonical categories:
 * OFFER_RECEIVED | AVAILABLE | NOT_AVAILABLE | DECLINED | NEEDS_REVIEW | CONFIRMED
 *
 * CRITICAL LOGISTICS SAFEGUARDS:
 * 1. "Rate available" ≠ "Booking confirmed".
 * 2. Do NOT mark a booking as CONFIRMED merely because a forwarder provided a rate.
 * 3. Only an explicit booking confirmation triggers CONFIRMED status.
 */
export function classifyConfirmationDeterministic(
  subject: string,
  body: string,
  snippet?: string,
): {
  status: ConfirmationStatus;
  classification: ForwarderResponseClassification;
  confidence: number;
  reason: string;
  keywords: string[];
} | null {
  const cleanedText = cleanEmailBody(body, snippet);
  const fullText = `${subject} ${cleanedText}`.toLowerCase();

  // --------------------------------------------------------------------------
  // 1. REJECTION & DECLINED PATTERNS (Highest Priority)
  // --------------------------------------------------------------------------
  const declinePatterns: { regex: RegExp; phrase: string }[] = [
    { regex: /\bdeclined\b/i, phrase: "declined" },
    { regex: /\bbooking (?:is )?declined\b/i, phrase: "booking declined" },
    { regex: /\bbooking (?:is )?rejected\b/i, phrase: "booking rejected" },
    { regex: /\bcannot accept (?:this )?booking\b/i, phrase: "cannot accept this booking" },
    { regex: /\bcan not accept (?:this )?booking\b/i, phrase: "cannot accept this booking" },
    { regex: /\bunable to accept\b/i, phrase: "unable to accept" },
    { regex: /\bunable to accommodate\b/i, phrase: "unable to accommodate" },
    { regex: /\bwe decline\b/i, phrase: "we decline" },
    { regex: /\bservice (?:is )?(?:suspended|cancelled|canceled)\b/i, phrase: "service cancelled" },
  ];

  const matchedDecline = declinePatterns.find((p) => p.regex.test(fullText));
  if (matchedDecline) {
    return {
      status: "REJECTED",
      classification: "DECLINED",
      confidence: 0.98,
      reason: `Forwarder explicitly declined or rejected the request ("${matchedDecline.phrase}").`,
      keywords: [matchedDecline.phrase],
    };
  }

  // --------------------------------------------------------------------------
  // 2. SPACE UNAVAILABLE PATTERNS (NOT_AVAILABLE)
  // --------------------------------------------------------------------------
  const notAvailablePatterns: { regex: RegExp; phrase: string }[] = [
    { regex: /\bno space\b/i, phrase: "no space" },
    { regex: /\bspace (?:is )?unavailable\b/i, phrase: "space unavailable" },
    { regex: /\bspace is not available\b/i, phrase: "space is not available" },
    { regex: /\bvessel (?:is )?fully booked\b/i, phrase: "vessel fully booked" },
    { regex: /\bvessel (?:is )?full\b/i, phrase: "vessel is full" },
    { regex: /\bno equipment (?:available)?\b/i, phrase: "no equipment available" },
    { regex: /\bunable to confirm space\b/i, phrase: "unable to confirm space" },
    { regex: /\bcannot confirm space\b/i, phrase: "cannot confirm space" },
    { regex: /\broll(?:ed)? over to next\b/i, phrase: "rolled over" },
    { regex: /\broll(?:ed)? over\b/i, phrase: "rolled over" },
  ];

  const matchedNotAvailable = notAvailablePatterns.find((p) => p.regex.test(fullText));
  if (matchedNotAvailable) {
    return {
      status: "REJECTED",
      classification: "NOT_AVAILABLE",
      confidence: 0.96,
      reason: `Forwarder indicated vessel is full or space/equipment is unavailable ("${matchedNotAvailable.phrase}").`,
      keywords: [matchedNotAvailable.phrase],
    };
  }

  // --------------------------------------------------------------------------
  // 3. CHECK NEGATIVE / CONDITIONAL QUALIFIERS
  // Guard against false positive confirmations
  // --------------------------------------------------------------------------
  const negativeQualifiers = [
    /\bnot confirmed\b/i,
    /\byet to be confirmed\b/i,
    /\bnot yet confirmed\b/i,
    /\bunconfirmed\b/i,
    /\bpending confirmation\b/i,
    /\bpending space\b/i,
    /\bwaiting (?:for )?confirmation\b/i,
    /\baquiring confirmation\b/i,
    /\bprior to confirmation\b/i,
    /\bbefore confirmation\b/i,
    /\bunable to confirm\b/i,
    /\bcannot confirm\b/i,
    /\bcan not confirm\b/i,
    /\bsubject to (?:carrier|line|space|allocation|vessel|feeder) (?:confirmation|approval)\b/i,
    /\bsubject to availability\b/i,
    /\bplease confirm\b/i,
    /\bkindly confirm\b/i,
    /\bawaiting (?:your )?confirmation\b/i,
  ];

  const hasNegativeQualifier = negativeQualifiers.some((nq) => nq.test(fullText));

  // --------------------------------------------------------------------------
  // 4. POSITIVE EXPLICIT BOOKING CONFIRMATION (CONFIRMED)
  // CRITICAL: Only an explicit booking confirmation triggers CONFIRMED.
  // Quoting a rate or saying space is open is NOT a booking confirmation.
  // --------------------------------------------------------------------------
  if (!hasNegativeQualifier) {
    const explicitConfirmationPatterns: { regex: RegExp; phrase: string }[] = [
      {
        regex: /\bbooking (?:is |has been )?(?:firmly |now )?confi[r]?med\b/i,
        phrase: "booking confirmed",
      },
      { regex: /\bbooking confi[r]?med\b/i, phrase: "booking confirmed" },
      {
        regex: /\bwe (?:hereby |can )?confi[r]?m (?:the |your )?(?:space and )?booking\b/i,
        phrase: "we confirm the booking",
      },
      {
        regex: /\byour booking (?:is|has been) (?:firmly )?confi[r]?med\b/i,
        phrase: "your booking is confirmed",
      },
      {
        regex: /\bbooking confirmation (?:attached|is attached|enclosed|number|no|ref)\b/i,
        phrase: "booking confirmation attached",
      },
      { regex: /\bbooking confirmed as requested\b/i, phrase: "booking confirmed as requested" },
      { regex: /\bbooking secured\b/i, phrase: "booking secured" },
      { regex: /\bbooking approved\b/i, phrase: "booking approved" },
      { regex: /\bbooking accepted and confirmed\b/i, phrase: "booking accepted and confirmed" },
      {
        regex: /\bbooking ref(?:erence)?[:\s]+[A-Z0-9-]+\s*(?:is )?confi[r]?med\b/i,
        phrase: "booking reference confirmed",
      },
      { regex: /\bconfirmed as booked\b/i, phrase: "confirmed as booked" },
    ];

    const matchedConfirmation = explicitConfirmationPatterns.find((p) => p.regex.test(fullText));
    if (matchedConfirmation) {
      return {
        status: "CONFIRMED",
        classification: "CONFIRMED",
        confidence: 0.98,
        reason: `Forwarder explicitly confirmed booking/movement ("${matchedConfirmation.phrase}").`,
        keywords: [matchedConfirmation.phrase],
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. COMMERCIAL QUOTATION / RATE OFFER (OFFER_RECEIVED)
  // CRITICAL RULE: "Rate available" ≠ "Booking confirmed".
  // A forwarder offering a rate or quoting price is an OFFER, NOT a confirmation.
  // --------------------------------------------------------------------------
  const rateOfferPatterns: { regex: RegExp; phrase: string }[] = [
    { regex: /\b(?:usd|\$|eur|gbp)\s*[\d,]+(?:\.\d{2})?\b/i, phrase: "freight rate amount" },
    { regex: /\b[\d,]+\s*(?:usd|\$|eur)\b/i, phrase: "currency amount" },
    { regex: /\b(?:our|the)?\s*(?:ocean|freight)?\s*rate\s*(?:is|:)/i, phrase: "rate quote" },
    { regex: /\bwe (?:can )?offer\b/i, phrase: "rate offer" },
    { regex: /\bquotation\b/i, phrase: "quotation" },
    { regex: /\ball inclusive\b/i, phrase: "all inclusive rate" },
    { regex: /\bper (?:container|40hc|20ft|teu|feu|unit|box)\b/i, phrase: "per container" },
  ];

  const matchedRate = rateOfferPatterns.find((p) => p.regex.test(fullText));
  if (matchedRate) {
    return {
      status: "NOT_CONFIRMED",
      classification: "OFFER_RECEIVED",
      confidence: 0.95,
      reason: `Forwarder provided a commercial rate quotation ("${matchedRate.phrase}"). Note: "Rate available" ≠ "Booking confirmed". Explicit booking confirmation required.`,
      keywords: [matchedRate.phrase],
    };
  }

  // --------------------------------------------------------------------------
  // 6. SPACE AVAILABLE WITHOUT RATE (AVAILABLE)
  // Space is open, but no freight rate is provided yet and booking is not confirmed.
  // --------------------------------------------------------------------------
  const spaceAvailablePatterns: { regex: RegExp; phrase: string }[] = [
    { regex: /\bspace (?:is )?available\b/i, phrase: "space available" },
    { regex: /\bwe have space\b/i, phrase: "we have space" },
    { regex: /\ballocation (?:is )?open\b/i, phrase: "allocation open" },
    { regex: /\bspace and equipment available\b/i, phrase: "space and equipment available" },
    { regex: /\bequipment (?:is )?available\b/i, phrase: "equipment available" },
    { regex: /\bopen for booking\b/i, phrase: "open for booking" },
  ];

  const matchedSpace = spaceAvailablePatterns.find((p) => p.regex.test(fullText));
  if (matchedSpace) {
    return {
      status: "NOT_CONFIRMED",
      classification: "AVAILABLE",
      confidence: 0.92,
      reason: `Forwarder confirmed space or equipment is available ("${matchedSpace.phrase}"). Note: "Space available" ≠ "Booking confirmed". Awaiting commercial quote.`,
      keywords: [matchedSpace.phrase],
    };
  }

  // --------------------------------------------------------------------------
  // 7. IN-PROGRESS / ACKNOWLEDGEMENT PATTERNS (NEEDS_REVIEW)
  // --------------------------------------------------------------------------
  const nonConfirmationPatterns: { regex: RegExp; phrase: string }[] = [
    { regex: /\breceived\b/i, phrase: "received" },
    { regex: /\bwell received\b/i, phrase: "well received" },
    { regex: /\bnoted with thanks\b/i, phrase: "noted with thanks" },
    { regex: /\bwe will check\b/i, phrase: "we will check" },
    { regex: /\bchecking availability\b/i, phrase: "checking availability" },
    { regex: /\bchecking with (?:carrier|line|vessel|feeder)\b/i, phrase: "checking with carrier" },
    { regex: /\bchecking space\b/i, phrase: "checking space" },
    { regex: /\bwaiting for approval\b/i, phrase: "waiting for approval" },
    { regex: /\bwaiting for allocation\b/i, phrase: "waiting for allocation" },
    { regex: /\bsubject to availability\b/i, phrase: "subject to availability" },
    { regex: /\bsubject to space\b/i, phrase: "subject to space" },
    { regex: /\bsubject to (?:carrier|line) confirmation\b/i, phrase: "subject to confirmation" },
    { regex: /\bpending space\b/i, phrase: "pending space" },
    { regex: /\bpending approval\b/i, phrase: "pending approval" },
    { regex: /\bpending confirmation\b/i, phrase: "pending confirmation" },
    { regex: /\bworking on this\b/i, phrase: "working on this" },
    { regex: /\bwill revert (?:shortly|soon|later|tomorrow)\b/i, phrase: "will revert shortly" },
    { regex: /\bunder processing\b/i, phrase: "under processing" },
    { regex: /\bin process\b/i, phrase: "in process" },
    { regex: /\bwill update you\b/i, phrase: "will update you" },
    { regex: /\backnowledged\b/i, phrase: "acknowledged" },
  ];

  const matchedNonConfirmation = nonConfirmationPatterns.find((p) => p.regex.test(fullText));
  if (matchedNonConfirmation) {
    return {
      status: "NOT_CONFIRMED",
      classification: "NEEDS_REVIEW",
      confidence: 0.9,
      reason: `Forwarder acknowledged message or stated pending check/availability ("${matchedNonConfirmation.phrase}").`,
      keywords: [matchedNonConfirmation.phrase],
    };
  }

  // --------------------------------------------------------------------------
  // 8. AMBIGUOUS / QUESTIONS / MODIFICATIONS (NEEDS_REVIEW)
  // --------------------------------------------------------------------------
  const reviewPatterns: { regex: RegExp; phrase: string }[] = [
    {
      regex: /\bcan you (?:please )?(?:advise|provide|confirm|send)\b/i,
      phrase: "clarification request",
    },
    { regex: /\bplease advise\b/i, phrase: "please advise" },
    { regex: /\bis it possible to\b/i, phrase: "inquiry" },
    { regex: /\balternate (?:port|vessel|sailing|date)\b/i, phrase: "alternate proposal" },
    { regex: /\brate (?:change|increase|revision|adjustment)\b/i, phrase: "rate revision" },
    { regex: /\bconditional\b/i, phrase: "conditional terms" },
    { regex: /\?\s*$/m, phrase: "question marks" },
  ];

  const matchedReview = reviewPatterns.find((p) => p.regex.test(fullText));
  if (matchedReview) {
    return {
      status: "NEEDS_REVIEW",
      classification: "NEEDS_REVIEW",
      confidence: 0.85,
      reason: `Forwarder message contains questions, modification proposals, or conditional remarks requiring operator review.`,
      keywords: [matchedReview.phrase],
    };
  }

  // No clear deterministic match
  return null;
}

/**
 * AI-Assisted Classification using Gemini 3.8 Flash.
 *
 * CRITICAL ARCHITECTURAL SAFETY RULES:
 * 1. AI ONLY performs pure text classification.
 * 2. AI returns strictly { confirmation_status, classification, confidence, reason }.
 * 3. AI has NO database access, NO tool calling, and does NOT update Supabase.
 * 4. "Rate available" ≠ "Booking confirmed". Only explicit booking confirmation triggers CONFIRMED.
 */
function isValidGeminiApiKey(key: string | undefined): boolean {
  if (!key || typeof key !== "string") return false;
  const trimmed = key.trim();
  // Valid Google AI Studio Gemini API keys start with AIza
  return trimmed.startsWith("AIza") && trimmed.length >= 20;
}

/**
 * AI fallback classification using Google GenAI SDK (server-side only).
 * Invoked only when deterministic rules cannot classify with high certainty.
 */
const confirmationAiCache = new Map<
  string,
  {
    status: ConfirmationStatus;
    classification: ForwarderResponseClassification;
    confidence: number;
    reason: string;
  }
>();

export async function detectForwarderConfirmation(
  input: ConfirmationDetectionInput,
): Promise<ConfirmationDetectionResult> {
  const subject = input.subject || "";
  const body = input.body || "";
  const snippet = input.snippet || "";

  // 1. Run deterministic rules
  const deterministicResult = classifyConfirmationDeterministic(subject, body, snippet);

  if (deterministicResult) {
    return {
      confirmationStatus: deterministicResult.status,
      classification: deterministicResult.classification,
      confidence: deterministicResult.confidence,
      reason: deterministicResult.reason,
      detectedBy: "DETERMINISTIC",
      emailMessageId: input.emailMessageId,
      details: {
        matchedKeywords: deterministicResult.keywords,
        analysis: "Deterministically verified via logistics phrase matching engine.",
      },
    };
  }

  return {
    confirmationStatus: "NEEDS_REVIEW",
    classification: "NEEDS_REVIEW",
    confidence: 0.5,
    reason:
      "Email content does not match standard confirmation phrases and requires operator review.",
    detectedBy: "DETERMINISTIC",
    emailMessageId: input.emailMessageId,
  };
}
