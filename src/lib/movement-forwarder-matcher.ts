import type { SupabaseClient } from "@supabase/supabase-js";
import { safeUuid, safeInsertNotification } from "./supabase-services";
import { extractMovementNumber } from "./movement-lifecycle";
import {
  matchIncomingEmailToForwarderRequest,
  getLocalForwarderRequests,
} from "./multi-forwarder-service";
import type { IncomingAttachmentInput } from "./document-attachment-service";
import {
  extractBookingNumbersFromText,
  extractBookingNumberStrictOrder,
  normalizeBookingNumber,
} from "./forwarder-quotation-processor";

export type MatchStatus = "MATCHED" | "NEEDS_REVIEW" | "UNMATCHED" | "PENDING";

export type MatchedBy =
  | "GMAIL_THREAD_ID"
  | "IN_REPLY_TO_REFERENCES"
  | "MOVEMENT_NUMBER"
  | "PER_FORWARDER_REQUEST_ID"
  | "SENDER_LINKED_FORWARDER"
  | "BOOKING_ATTRIBUTES"
  | "MOVEMENT_NUMBER_OR_REQUEST_ID"
  | "BOOKING_REFERENCE"
  | "FORWARDER_AND_BOOKING_DETAILS"
  | "AI_FALLBACK_MATCH"
  | "THREAD_ID"
  | "MANUAL"
  | "NONE";

export interface PriorityStepEvaluation {
  step: number;
  priorityName: string;
  evaluated: boolean;
  matched: boolean;
  confidence: number;
  details: string;
}

export interface MovementMatchResult {
  matchStatus: "MATCHED" | "NEEDS_REVIEW";
  matchedBy: MatchedBy;
  matchingPriorityStep: number; // 1 | 2 | 3 | 4 | 5 | 6 | 0
  confidence: number;
  bookingId: string | null;
  movementId: string | null;
  movementNumber: string | null;
  bookingReference?: string | null;
  forwarderId: string | null;
  forwarderName: string | null;
  forwarderEmail: string | null;
  senderEmail: string;
  isForwarderValidated: boolean;
  matchReason: string;
  priorityStepEvaluations: PriorityStepEvaluation[];
  details?: Record<string, unknown>;
}

export interface MatchEmailInput {
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  messageId?: string | null;
  headers?: Array<{ name: string; value: string }> | Record<string, unknown> | null;
  rawHeaders?: Record<string, unknown> | null;
  subject?: string | null;
  body?: string | null;
  snippet?: string | null;
  senderEmail: string;
  senderName?: string | null;
  emailMessageId?: string | null;
  userId?: string | null;
  attachments?: IncomingAttachmentInput[];
  attachmentTexts?: string[];
  candidateBookingId?: string | null;
  candidateMovementNumber?: string | null;
}

/**
 * Extract domain from an email or URL string (e.g., 'operations@apexmaritime.com' -> 'apexmaritime.com')
 */
export function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const clean = input.trim().toLowerCase();
    if (clean.includes("@")) {
      return clean.split("@")[1].trim();
    }
    const host = clean
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
    return host || null;
  } catch {
    return null;
  }
}

const COMMON_PUBLIC_MAIL_PROVIDERS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "mail.com",
  "zoho.com",
  "proton.me",
  "protonmail.com",
]);

/**
 * Validates whether the incoming sender email belongs to the forwarder associated with the booking
 */
export function validateForwarderSenderEmail(
  senderEmail: string,
  forwarder: {
    id: string;
    company_name?: string | null;
    email?: string | null;
    contact_person?: string | null;
    website?: string | null;
    notes?: string | null;
  } | null,
  options?: {
    matchedBy?: MatchedBy;
    outboundRecipient?: string | null;
  },
): { isValid: boolean; reason: string } {
  const cleanSender = (senderEmail || "").trim().toLowerCase();
  if (!cleanSender) {
    return {
      isValid: false,
      reason: "Sender email address is empty.",
    };
  }

  // Check 0: If matched by verified Gmail Thread ID or In-Reply-To headers
  if (
    options?.matchedBy === "GMAIL_THREAD_ID" ||
    options?.matchedBy === "THREAD_ID" ||
    options?.matchedBy === "IN_REPLY_TO_REFERENCES"
  ) {
    return {
      isValid: true,
      reason: `Sender ${cleanSender} replied directly inside the verified booking conversation thread or referenced message.`,
    };
  }

  // Check 0b: If sender matches the recipient of the previous outbound dispatch message
  if (options?.outboundRecipient) {
    const cleanRecipient = options.outboundRecipient.trim().toLowerCase();
    if (
      cleanRecipient === cleanSender ||
      cleanRecipient.includes(cleanSender) ||
      cleanSender.includes(cleanRecipient)
    ) {
      return {
        isValid: true,
        reason: `Sender ${cleanSender} matches the recipient of the outbound booking dispatch email.`,
      };
    }
  }

  if (!forwarder) {
    return {
      isValid: true,
      reason: `Inbound partner response referencing specific movement identifier.`,
    };
  }

  const forwarderPrimaryEmail = (forwarder.email || "").trim().toLowerCase();
  const forwarderName = forwarder.company_name || "Assigned Forwarder";

  // Check 1: Exact email match
  if (forwarderPrimaryEmail && cleanSender === forwarderPrimaryEmail) {
    return {
      isValid: true,
      reason: `Sender ${cleanSender} exactly matches primary forwarder contact (${forwarderName}).`,
    };
  }

  // Check 2: Domain matching (e.g., '@maersk.com', '@dhl.com', '@apexmaritime.com')
  const senderDomain = extractDomain(cleanSender);
  const forwarderEmailDomain = extractDomain(forwarderPrimaryEmail);
  const forwarderWebDomain = extractDomain(forwarder.website);

  if (senderDomain && !COMMON_PUBLIC_MAIL_PROVIDERS.has(senderDomain)) {
    if (forwarderEmailDomain && senderDomain === forwarderEmailDomain) {
      return {
        isValid: true,
        reason: `Sender domain '@${senderDomain}' matches forwarder corporate domain for ${forwarderName}.`,
      };
    }
    if (
      forwarderWebDomain &&
      (senderDomain === forwarderWebDomain || senderDomain.endsWith(`.${forwarderWebDomain}`))
    ) {
      return {
        isValid: true,
        reason: `Sender domain '@${senderDomain}' matches forwarder website domain (${forwarderWebDomain}).`,
      };
    }
  }

  // Check 3: Check notes or metadata for authorized alternative emails if present
  if (forwarder.notes && forwarder.notes.toLowerCase().includes(cleanSender)) {
    return {
      isValid: true,
      reason: `Sender ${cleanSender} is listed as an authorized contact for ${forwarderName}.`,
    };
  }

  // Check 4: If forwarder has an email or website, but the sender didn't match any of the above:
  if (forwarderPrimaryEmail || forwarderWebDomain) {
    return {
      isValid: false,
      reason: `Sender ${cleanSender} does not match assigned forwarder (${forwarderName}: ${forwarderPrimaryEmail || forwarderWebDomain}).`,
    };
  }

  // Check 5: If forwarder record exists without email/domain details, accept for movement context
  return {
    isValid: true,
    reason: `Sender ${cleanSender} associated with movement assigned to ${forwarderName}.`,
  };
}

/**
 * Extracts and cleans Message-ID references from In-Reply-To and References headers
 */
export function extractMessageReferences(input: {
  inReplyTo?: string | null;
  references?: string | string[] | null;
  headers?: Array<{ name: string; value: string }> | Record<string, unknown> | null;
  rawHeaders?: Record<string, unknown> | null;
}): string[] {
  const refSet = new Set<string>();

  const addTokens = (val?: string | null) => {
    if (!val || typeof val !== "string") return;
    // Match tokens in format <id@host> or plain alphanumeric IDs
    const angleMatches = val.match(/<([^>]+)>/g);
    if (angleMatches) {
      for (const m of angleMatches) {
        const cleaned = m.replace(/[<>]/g, "").trim();
        if (cleaned.length >= 3) refSet.add(cleaned);
      }
    }
    // Also add plain token words if any
    const parts = val.split(/[\s,]+/);
    for (const p of parts) {
      const cleaned = p.replace(/[<>]/g, "").trim();
      if (
        cleaned.length >= 5 &&
        (cleaned.includes("@") || cleaned.includes("-") || cleaned.length > 8)
      ) {
        refSet.add(cleaned);
      }
    }
  };

  addTokens(input.inReplyTo);

  if (Array.isArray(input.references)) {
    for (const r of input.references) {
      addTokens(r);
    }
  } else if (typeof input.references === "string") {
    addTokens(input.references);
  }

  if (Array.isArray(input.headers)) {
    for (const h of input.headers) {
      const name = (h.name || "").toLowerCase();
      if (name === "in-reply-to" || name === "references" || name === "message-id") {
        addTokens(h.value);
      }
    }
  } else if (input.headers && typeof input.headers === "object") {
    const obj = input.headers as Record<string, unknown>;
    addTokens(obj["in-reply-to"] as string);
    addTokens(obj["references"] as string);
    addTokens(obj["message-id"] as string);
  }

  if (input.rawHeaders && typeof input.rawHeaders === "object") {
    const raw = input.rawHeaders;
    addTokens(raw.in_reply_to as string);
    addTokens(raw.inReplyTo as string);
    addTokens(raw.references as string);
    addTokens(raw.message_id as string);
  }

  return Array.from(refSet);
}

/**
 * Extracts potential Booking References from textual content
 */
export function extractBookingReferences(text: string): string[] {
  if (!text) return [];
  const refs = new Set<string>();

  // 1. Explicit labels: Booking Ref: BKG-2026-0012, Booking #: 98765432, BKG# MSKU12345
  const explicitMatches = text.matchAll(
    /(?:booking\s*(?:ref|reference|no|number|#)?|bkg\s*(?:ref|no|#)|carrier\s*bkg)\s*[:#\s]*([a-z0-9/-]{5,28})/gi,
  );
  for (const m of explicitMatches) {
    const val = m[1]?.trim().toUpperCase();
    if (
      val &&
      val.length >= 5 &&
      !["THE", "FOR", "OUR", "YOUR", "THIS", "CONFIRMED"].includes(val)
    ) {
      refs.add(val);
    }
  }

  // 2. Carrier booking prefixes: BKG-..., BK-..., MSKU..., COSU..., CMAU..., MAEU..., ONEY..., HLCU...
  const carrierMatches = text.matchAll(
    /\b(?:BKG[-_]?[0-9]{4,12}|BK[-_]?[0-9]{4,12}|(?:MSKU|COSU|CMAU|MAEU|ONEY|HLCU|EGLV|SUDU)[0-9]{6,12})\b/gi,
  );
  for (const m of carrierMatches) {
    const val = m[0]?.trim().toUpperCase();
    if (val) refs.add(val);
  }

  // 3. Bill of Lading numbers: B/L No: ..., BL# ...
  const blMatches = text.matchAll(
    /(?:bill\s*of\s*lading|b\/l|draft\s*b\/l|bl)\s*(?:no\.?|#|ref\.?)?\s*[:#\s]*([a-z0-9/-]{6,24})/gi,
  );
  for (const m of blMatches) {
    const val = m[1]?.trim().toUpperCase();
    if (val && val.length >= 6) {
      refs.add(val);
    }
  }

  return Array.from(refs);
}

/**
 * Audit Record Model for Email Matching (Preserving original email, IDs, sender, timestamp and matching result)
 */
export interface EmailMatchAuditRecord {
  id: string;
  emailMessageId?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  senderEmail: string;
  senderName?: string | null;
  subject?: string | null;
  matchStatus: "MATCHED" | "NEEDS_REVIEW";
  matchedBy: MatchedBy;
  matchingPriorityStep: number;
  confidence: number;
  bookingId: string | null;
  movementNumber: string | null;
  forwarderId: string | null;
  forwarderName: string | null;
  matchReason: string;
  priorityStepEvaluations: PriorityStepEvaluation[];
  receivedAt: string;
  timestamp: string;
}

export function saveEmailMatchAuditRecord(audit: EmailMatchAuditRecord): void {
  if (typeof window === "undefined") return;
  try {
    const KEY = "nashmia_email_matching_audit_v1";
    const existing = JSON.parse(localStorage.getItem(KEY) || "[]") as EmailMatchAuditRecord[];
    const filtered = existing.filter(
      (a) =>
        (!audit.gmailMessageId || a.gmailMessageId !== audit.gmailMessageId) &&
        (!audit.emailMessageId || a.emailMessageId !== audit.emailMessageId),
    );
    filtered.unshift(audit);
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, 150)));
  } catch (err) {
    console.warn("[MovementMatcher] Notice saving match audit record to storage:", err);
  }
}

/**
 * Extracts potential Movement/Booking Numbers from textual content using configurable regular expressions
 * Supports: BK-2026-000145, BK/2026/000145, BOOKING-2026-000145, REF: BK-2026-000145, MOV-, etc.
 */
export function extractMovementNumbers(text: string): string[] {
  if (!text) return [];
  const ids = new Set<string>();

  // 1. Direct Nashmia movement pattern match across all occurrences in text
  const allNashMatches = text.matchAll(
    /(?:^|[^A-Za-z0-9])(NASH[-_](?:BK[-_]|MOV[-_])?[0-9]{4}[-_][0-9]{3,8})(?:$|[^A-Za-z0-9])/gi,
  );
  for (const nm of allNashMatches) {
    if (nm[1]) {
      ids.add(nm[1].toUpperCase().replace(/_/g, "-"));
    }
  }

  // 2. Configurable booking number regexes
  const configuredMatches = extractBookingNumbersFromText(text);
  for (const cm of configuredMatches) {
    ids.add(cm.toUpperCase());
    const normalized = normalizeBookingNumber(cm);
    if (normalized) ids.add(normalized);
  }

  // 3. Standard movement number parser
  const stdMov = extractMovementNumber(text);
  if (stdMov) {
    ids.add(stdMov.toUpperCase());
  }

  return Array.from(ids);
}

/**
 * Extracts unique per-forwarder Request IDs from textual content (Priority 4)
 * Format examples: MFR-abc123-fwd456, REQ-FWD-2026-001, FWR-2026-0012, REQ-GLOBAL
 */
export function extractPerForwarderRequestIds(text: string): string[] {
  if (!text) return [];
  const ids = new Set<string>();

  const reqMatches = text.matchAll(
    /\b(?:MFR[-_][A-Za-z0-9_-]{4,32}|REQ[-_]FWD[-_][A-Za-z0-9_-]{3,24}|FWR[-_][0-9]{4}[-_]?[0-9]+|FWR[-_]?[0-9]{3,8}|REQ[-_][A-Z0-9_-]{3,24})\b/gi,
  );
  for (const m of reqMatches) {
    ids.add(m[0].trim().toUpperCase());
  }

  return Array.from(ids);
}

/**
 * Extracts potential Request IDs or Movement Numbers from textual content (backward-compatible)
 */
export function extractMovementOrRequestIds(text: string): string[] {
  const movs = extractMovementNumbers(text);
  const reqs = extractPerForwarderRequestIds(text);
  return Array.from(new Set([...movs, ...reqs]));
}

/**
 * Priority 6: Fallback AI Matching Engine using Gemini
 */
async function matchMovementWithAiFallback(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: MatchEmailInput,
  candidateBookings: Array<{
    id: string;
    movement_number?: string | null;
    booking_reference?: string | null;
    reference?: string | null;
    forwarder_id?: string | null;
    origin?: string | null;
    destination?: string | null;
    vessel_name?: string | null;
    voyage_number?: string | null;
    etd?: string | null;
    eta?: string | null;
    container_type?: string | null;
    container_size?: string | null;
    status?: string | null;
    forwarder_name?: string | null;
  }>,
): Promise<{
  matched: boolean;
  bookingId: string | null;
  movementNumber: string | null;
  confidence: number;
  reason: string;
}> {
  if (candidateBookings.length === 0) {
    return {
      matched: false,
      bookingId: null,
      movementNumber: null,
      confidence: 0,
      reason: "No active candidate bookings available to evaluate.",
    };
  }

  const subject = (input.subject || "").toLowerCase();
  const body = (input.body || input.snippet || "").toLowerCase();
  const fullText = `${subject} ${body}`;

  // Evaluate candidate bookings deterministically using port pair, vessel, and booking references
  const matchedCandidates = candidateBookings.filter((b) => {
    let score = 0;
    if (b.movement_number && fullText.includes(b.movement_number.toLowerCase())) score += 50;
    if (b.booking_reference && fullText.includes(b.booking_reference.toLowerCase())) score += 40;
    if (b.origin && fullText.includes(b.origin.toLowerCase())) score += 15;
    if (b.destination && fullText.includes(b.destination.toLowerCase())) score += 15;
    if (b.vessel_name && fullText.includes(b.vessel_name.toLowerCase())) score += 20;
    return score >= 60;
  });

  if (matchedCandidates.length === 1) {
    const winner = matchedCandidates[0];
    return {
      matched: true,
      bookingId: winner.id,
      movementNumber: winner.movement_number || winner.booking_reference || null,
      confidence: 0.88,
      reason:
        "Deterministically correlated booking based on route, vessel, and booking identifiers.",
    };
  }

  return {
    matched: false,
    bookingId: null,
    movementNumber: null,
    confidence: 0,
    reason:
      matchedCandidates.length > 1
        ? "Multiple bookings matched attributes ambiguously. Marked for manual review."
        : "No unambiguous deterministic match found across candidate bookings.",
  };
}

/**
 * CORE IDENTIFICATION ENGINE FOR MOVEMENTS & BOOKINGS
 *
 * Implements the mandatory strict 6-Priority Hierarchy:
 * 1. Gmail Thread ID
 * 2. In-Reply-To / References headers
 * 3. Movement Number / Request ID
 * 4. Booking Reference
 * 5. Forwarder + booking details
 * 6. AI matching only as a fallback
 *
 * If the system cannot confidently identify the Movement, it does NOT attach
 * the document automatically, and marks it as NEEDS_REVIEW instead.
 */
export async function identifyMovementForIncomingEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: MatchEmailInput,
): Promise<MovementMatchResult> {
  const {
    gmailThreadId,
    gmailMessageId,
    subject = "",
    body = "",
    snippet = "",
    senderEmail,
    senderName,
    attachments = [],
  } = input;

  const cleanSender = (senderEmail || "").trim().toLowerCase();
  const priorityStepEvaluations: PriorityStepEvaluation[] = [];

  // Aggregate all textual signals across email and attachments
  const attachmentNames = attachments.map((a) => a.filename || a.name || "").join(" ");
  const attachmentContentCombined = (input.attachmentTexts || []).join(" ");
  const fullText = `${subject || ""} \n ${body || ""} \n ${snippet || ""} \n ${attachmentNames} \n ${attachmentContentCombined}`;

  // --------------------------------------------------------------------------
  // PRIORITY 1: Gmail Thread ID
  // --------------------------------------------------------------------------
  let p1Matched = false;
  let p1BookingId: string | null = null;
  let p1MovementNumber: string | null = null;
  let p1ForwarderId: string | null = null;
  let p1Details = "";

  if (gmailThreadId) {
    // 1.1 Check Multi-Forwarder Request tracking system
    const multiFwdMatch = matchIncomingEmailToForwarderRequest({
      gmailThreadId,
      gmailMessageId,
      senderEmail: cleanSender,
      senderName,
      subject,
      body,
      snippet,
    });

    if (
      multiFwdMatch.matched &&
      multiFwdMatch.request &&
      multiFwdMatch.matchedBy === "GMAIL_THREAD_ID"
    ) {
      p1Matched = true;
      p1BookingId = multiFwdMatch.request.bookingId;
      p1MovementNumber =
        multiFwdMatch.request.movementNumber || multiFwdMatch.request.bookingReference;
      p1ForwarderId = multiFwdMatch.request.forwarderId;
      p1Details = `Matched via Multi-Forwarder tracking key [${multiFwdMatch.request.trackingCompositeKey}] for Thread ${gmailThreadId}`;
    }

    // 1.2 Check email_threads in Supabase
    if (!p1Matched) {
      const { data: threadRecord } = await supabase
        .from("email_threads")
        .select("id, booking_id")
        .eq("gmail_thread_id", gmailThreadId)
        .maybeSingle();

      if (threadRecord?.booking_id) {
        p1Matched = true;
        p1BookingId = threadRecord.booking_id;
        p1Details = `Gmail Thread ID [${gmailThreadId}] linked in email_threads table`;
      } else if (threadRecord?.id) {
        // 1.3 Query email_messages via thread_id foreign key
        try {
          const { data: msgRecord } = await supabase
            .from("email_messages")
            .select("booking_id, movement_number, forwarder_id")
            .eq("thread_id", threadRecord.id)
            .not("booking_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (msgRecord?.booking_id) {
            p1Matched = true;
            p1BookingId = msgRecord.booking_id;
            p1MovementNumber = msgRecord.movement_number || null;
            p1ForwarderId = msgRecord.forwarder_id || null;
            p1Details = `Gmail Thread ID [${gmailThreadId}] linked via thread_id to prior booking`;
          }
        } catch (e) {
          console.warn("[Matcher] Notice checking email_messages by thread_id:", e);
        }
      }
    }
  }

  priorityStepEvaluations.push({
    step: 1,
    priorityName: "Gmail Thread ID",
    evaluated: Boolean(gmailThreadId),
    matched: p1Matched,
    confidence: p1Matched ? 1.0 : 0.0,
    details: p1Matched
      ? p1Details
      : gmailThreadId
        ? "Thread ID not associated with an existing booking"
        : "No Gmail Thread ID provided",
  });

  if (p1Matched && p1BookingId) {
    return resolveConfidentMatchResult(supabase, {
      matchedBy: "GMAIL_THREAD_ID",
      matchingPriorityStep: 1,
      confidence: 1.0,
      bookingId: p1BookingId,
      movementNumber: p1MovementNumber,
      forwarderId: p1ForwarderId,
      senderEmail: cleanSender,
      senderName: input.senderName,
      matchReason: `Confidently matched via Priority 1 (Gmail Thread ID): ${p1Details}.`,
      priorityStepEvaluations,
    });
  }

  // --------------------------------------------------------------------------
  // PRIORITY 2: In-Reply-To / References headers
  // --------------------------------------------------------------------------
  let p2Matched = false;
  let p2BookingId: string | null = null;
  let p2MovementNumber: string | null = null;
  let p2ForwarderId: string | null = null;
  let p2Details = "";

  const referencedMessageIds = extractMessageReferences({
    inReplyTo: input.inReplyTo,
    references: input.references,
    headers: input.headers,
    rawHeaders: input.rawHeaders,
  });

  if (referencedMessageIds.length > 0) {
    // Search email_messages table for any message whose gmail_message_id, message_id or raw_headers match
    const { data: matchedRefMsgs } = await supabase
      .from("email_messages")
      .select(
        "id, booking_id, movement_id, movement_number, forwarder_id, gmail_message_id, message_id",
      )
      .or(
        `gmail_message_id.in.(${referencedMessageIds.map((id) => `"${id}"`).join(",")}),message_id.in.(${referencedMessageIds
          .map((id) => `"${id}"`)
          .join(",")})`,
      )
      .not("booking_id", "is", null)
      .limit(5);

    if (matchedRefMsgs && matchedRefMsgs.length > 0) {
      const refMsg = matchedRefMsgs[0];
      if (refMsg.booking_id) {
        p2Matched = true;
        p2BookingId = refMsg.booking_id;
        p2MovementNumber = refMsg.movement_number || null;
        p2ForwarderId = refMsg.forwarder_id || null;
        p2Details = `In-Reply-To / References header matched prior message ID [${refMsg.gmail_message_id || refMsg.message_id}] linked to booking ${refMsg.booking_id}`;
      }
    }
  }

  priorityStepEvaluations.push({
    step: 2,
    priorityName: "In-Reply-To / References headers",
    evaluated: referencedMessageIds.length > 0,
    matched: p2Matched,
    confidence: p2Matched ? 0.98 : 0.0,
    details: p2Matched
      ? p2Details
      : referencedMessageIds.length > 0
        ? `Evaluated ${referencedMessageIds.length} reference headers, but none were linked to an existing booking.`
        : "No In-Reply-To or References headers found in email.",
  });

  if (p2Matched && p2BookingId) {
    return resolveConfidentMatchResult(supabase, {
      matchedBy: "IN_REPLY_TO_REFERENCES",
      matchingPriorityStep: 2,
      confidence: 0.98,
      bookingId: p2BookingId,
      movementNumber: p2MovementNumber,
      forwarderId: p2ForwarderId,
      senderEmail: cleanSender,
      senderName: input.senderName,
      matchReason: `Confidently matched via Priority 2 (In-Reply-To / References): ${p2Details}.`,
      priorityStepEvaluations,
    });
  }

  // --------------------------------------------------------------------------
  // PRIORITY 3: Movement Number in subject / body
  // --------------------------------------------------------------------------
  let p3Matched = false;
  let p3BookingId: string | null = null;
  let p3MovementNumber: string | null = null;
  let p3ForwarderId: string | null = null;
  let p3Details = "";
  let p3Ambiguous = false;

  const orderResult = extractBookingNumberStrictOrder({
    subject,
    body,
    attachments: input.attachments,
    attachmentFilenames: input.attachments
      ?.map((a) => a.name || a.filename)
      .filter(Boolean) as string[],
    inReplyTo: input.inReplyTo,
    references: input.references,
  });

  const extractedMovementNumbers =
    orderResult.detectedBookingNumbers.length > 0
      ? orderResult.detectedBookingNumbers
      : extractMovementNumbers(fullText);

  if (orderResult.isAmbiguous) {
    p3Ambiguous = true;
    p3Details = orderResult.reason;
  } else if (extractedMovementNumbers.length > 0) {
    const matchedCandidateMap = new Map<
      string,
      { bookingId: string; movementNumber: string; forwarderId?: string }
    >();

    for (const movId of extractedMovementNumbers) {
      const normId = normalizeBookingNumber(movId) || movId;
      const slashId = movId.includes("-") ? movId.replace(/-/g, "/") : movId;

      // 3.1 Check multi-forwarder request register
      const localRequests = getLocalForwarderRequests();
      const matchedLocal = localRequests.find((r) => {
        const rMovNorm = normalizeBookingNumber(r.movementNumber || "");
        const rRefNorm = normalizeBookingNumber(r.bookingReference || "");
        return (
          rMovNorm === normId ||
          rRefNorm === normId ||
          r.movementNumber?.toUpperCase() === movId.toUpperCase() ||
          r.movementNumber?.toUpperCase() === slashId.toUpperCase()
        );
      });

      if (matchedLocal?.bookingId) {
        matchedCandidateMap.set(matchedLocal.bookingId, {
          bookingId: matchedLocal.bookingId,
          movementNumber: matchedLocal.movementNumber || normId,
          forwarderId: matchedLocal.forwarderId,
        });
      }

      // 3.2 Query bookings table (checking both hyphenated and slashed variants)
      const { data: bookingRows } = await supabase
        .from("bookings")
        .select("id, movement_number, booking_reference, reference, forwarder_id")
        .or(
          `movement_number.ilike.%${normId}%,booking_reference.ilike.%${normId}%,movement_number.ilike.%${slashId}%,booking_reference.ilike.%${slashId}%`,
        )
        .limit(5);

      if (bookingRows && bookingRows.length > 0) {
        for (const row of bookingRows) {
          matchedCandidateMap.set(row.id, {
            bookingId: row.id,
            movementNumber: row.movement_number || row.booking_reference || normId,
            forwarderId: row.forwarder_id || undefined,
          });
        }
      }
    }

    if (matchedCandidateMap.size === 1) {
      const single = Array.from(matchedCandidateMap.values())[0];
      p3Matched = true;
      p3BookingId = single.bookingId;
      p3MovementNumber = single.movementNumber;
      p3ForwarderId = single.forwarderId || null;
      p3Details = `Exact match for Booking/Movement Number [${p3MovementNumber}] in ${orderResult.foundIn || "subject/body"}`;
    } else if (matchedCandidateMap.size > 1) {
      p3Ambiguous = true;
      p3Details = `Ambiguous: Multiple bookings (${Array.from(matchedCandidateMap.keys()).join(", ")}) match movement numbers [${extractedMovementNumbers.join(", ")}]. Must NOT auto-assign.`;
    }
  }

  priorityStepEvaluations.push({
    step: 3,
    priorityName: "Movement Number in subject/body",
    evaluated: extractedMovementNumbers.length > 0,
    matched: p3Matched,
    confidence: p3Matched ? 0.96 : 0.0,
    details: p3Matched
      ? p3Details
      : p3Ambiguous
        ? p3Details
        : extractedMovementNumbers.length > 0
          ? `Found movement numbers [${extractedMovementNumbers.join(", ")}], but no active booking record exists.`
          : "No Movement Number patterns found in email subject or body.",
  });

  if (p3Matched && p3BookingId && !p3Ambiguous) {
    return resolveConfidentMatchResult(supabase, {
      matchedBy: "MOVEMENT_NUMBER",
      matchingPriorityStep: 3,
      confidence: 0.96,
      bookingId: p3BookingId,
      movementNumber: p3MovementNumber,
      forwarderId: p3ForwarderId,
      senderEmail: cleanSender,
      senderName: input.senderName,
      matchReason: `Confidently matched via Priority 3 (Movement Number in subject/body): ${p3Details}.`,
      priorityStepEvaluations,
    });
  }

  // --------------------------------------------------------------------------
  // PRIORITY 4: Unique per-forwarder Request ID
  // --------------------------------------------------------------------------
  let p4Matched = false;
  let p4BookingId: string | null = null;
  let p4MovementNumber: string | null = null;
  let p4ForwarderId: string | null = null;
  let p4Details = "";
  let p4Ambiguous = false;

  const extractedRequestIds = extractPerForwarderRequestIds(fullText);

  // Check headers / rawHeaders for direct request ID tags
  const headerReqId =
    (input.rawHeaders?.forwarder_request_id as string) ||
    (input.rawHeaders?.request_id as string) ||
    null;
  if (headerReqId && !extractedRequestIds.includes(headerReqId.toUpperCase())) {
    extractedRequestIds.push(headerReqId.toUpperCase());
  }

  if (extractedRequestIds.length > 0) {
    const matchedReqMap = new Map<
      string,
      { bookingId: string; movementNumber?: string; forwarderId?: string; reqId: string }
    >();

    for (const reqId of extractedRequestIds) {
      // 4.1 Check multi-forwarder request cache
      const localRequests = getLocalForwarderRequests();
      const matchedLocal = localRequests.find(
        (r) =>
          r.id.toUpperCase() === reqId.toUpperCase() ||
          (r.requestId && r.requestId.toUpperCase() === reqId.toUpperCase()),
      );

      if (matchedLocal?.bookingId) {
        matchedReqMap.set(matchedLocal.bookingId, {
          bookingId: matchedLocal.bookingId,
          movementNumber: matchedLocal.movementNumber,
          forwarderId: matchedLocal.forwarderId,
          reqId: matchedLocal.id,
        });
      }

      // 4.2 Query email_messages raw_headers for linked request_id
      try {
        const { data: rawMsgMatches } = await supabase
          .from("email_messages")
          .select("booking_id, movement_number, forwarder_id")
          .filter("raw_headers->>request_id", "eq", reqId)
          .limit(3);

        if (rawMsgMatches && rawMsgMatches.length > 0) {
          for (const rm of rawMsgMatches) {
            if (rm.booking_id) {
              matchedReqMap.set(rm.booking_id, {
                bookingId: rm.booking_id,
                movementNumber: rm.movement_number || undefined,
                forwarderId: rm.forwarder_id || undefined,
                reqId,
              });
            }
          }
        }
      } catch {
        // Continue if raw_headers filter unsupported
      }
    }

    if (matchedReqMap.size === 1) {
      const single = Array.from(matchedReqMap.values())[0];
      p4Matched = true;
      p4BookingId = single.bookingId;
      p4MovementNumber = single.movementNumber || null;
      p4ForwarderId = single.forwarderId || null;
      p4Details = `Unique per-forwarder Request ID [${single.reqId}] matched linked request record`;
    } else if (matchedReqMap.size > 1) {
      p4Ambiguous = true;
      p4Details = `Ambiguous: Multiple bookings matched unique request IDs [${extractedRequestIds.join(", ")}]. Must NOT auto-assign.`;
    }
  }

  priorityStepEvaluations.push({
    step: 4,
    priorityName: "Unique per-forwarder Request ID",
    evaluated: extractedRequestIds.length > 0,
    matched: p4Matched,
    confidence: p4Matched ? 0.98 : 0.0,
    details: p4Matched
      ? p4Details
      : p4Ambiguous
        ? p4Details
        : extractedRequestIds.length > 0
          ? `Found request IDs [${extractedRequestIds.join(", ")}], but no active forwarder quote record exists.`
          : "No unique per-forwarder Request ID patterns in email.",
  });

  if (p4Matched && p4BookingId && !p4Ambiguous) {
    return resolveConfidentMatchResult(supabase, {
      matchedBy: "PER_FORWARDER_REQUEST_ID",
      matchingPriorityStep: 4,
      confidence: 0.98,
      bookingId: p4BookingId,
      movementNumber: p4MovementNumber,
      forwarderId: p4ForwarderId,
      senderEmail: cleanSender,
      senderName: input.senderName,
      matchReason: `Confidently matched via Priority 4 (Unique per-forwarder Request ID): ${p4Details}.`,
      priorityStepEvaluations,
    });
  }

  // --------------------------------------------------------------------------
  // PRIORITY 5: Sender email and linked forwarder
  // --------------------------------------------------------------------------
  let p5Matched = false;
  let p5BookingId: string | null = null;
  let p5MovementNumber: string | null = null;
  let p5ForwarderId: string | null = null;
  let p5Details = "";
  let p5Ambiguous = false;

  // 5.1 Identify forwarder from sender email
  let matchedForwarder: { id: string; name: string; email: string } | null = null;

  // Check Supabase forwarders table
  const { data: dbForwarders } = await supabase
    .from("forwarders")
    .select("id, company_name, email, website");

  const sDomain = extractDomain(cleanSender);
  for (const f of dbForwarders || []) {
    const fEmail = (f.email || "").toLowerCase().trim();
    const fDomain = extractDomain(f.website || fEmail);
    if (fEmail && cleanSender === fEmail) {
      matchedForwarder = { id: f.id, name: f.company_name, email: fEmail };
      break;
    }
    if (sDomain && fDomain && sDomain === fDomain && !COMMON_PUBLIC_MAIL_PROVIDERS.has(sDomain)) {
      matchedForwarder = { id: f.id, name: f.company_name, email: fEmail || cleanSender };
      break;
    }
  }

  // Fallback to local forwarder requests
  if (!matchedForwarder) {
    const localReqs = getLocalForwarderRequests();
    const fLocal = localReqs.find((r) => {
      const rEmail = (r.forwarderEmail || "").toLowerCase().trim();
      const rDomain = extractDomain(rEmail);
      return (
        rEmail === cleanSender ||
        (sDomain && rDomain && sDomain === rDomain && !COMMON_PUBLIC_MAIL_PROVIDERS.has(sDomain))
      );
    });
    if (fLocal) {
      matchedForwarder = {
        id: fLocal.forwarderId,
        name: fLocal.forwarderName,
        email: fLocal.forwarderEmail,
      };
    }
  }

  if (matchedForwarder) {
    // 5.2 Find active bookings or quote requests awaiting response from this forwarder
    const localReqs = getLocalForwarderRequests();
    const pendingQuotesForForwarder = localReqs.filter(
      (r) =>
        (r.forwarderId === matchedForwarder?.id ||
          r.forwarderEmail.toLowerCase() === matchedForwarder?.email.toLowerCase()) &&
        (r.status === "AWAITING_OFFER" ||
          r.status === "PENDING" ||
          r.status === "SENT" ||
          r.status === "OFFER_RECEIVED"),
    );

    // Also check bookings table where this forwarder is assigned
    const { data: candidateBookingsForForwarder } = await supabase
      .from("bookings")
      .select("id, movement_number, booking_reference, reference, forwarder_id, status")
      .eq("forwarder_id", matchedForwarder.id)
      .not("status", "in", '("Delivered","Cancelled")')
      .limit(10);

    const distinctBookingIds = new Set<string>();
    for (const pq of pendingQuotesForForwarder) {
      if (pq.bookingId) distinctBookingIds.add(pq.bookingId);
    }
    for (const cb of candidateBookingsForForwarder || []) {
      if (cb.id) distinctBookingIds.add(cb.id);
    }

    if (distinctBookingIds.size === 1) {
      const bId = Array.from(distinctBookingIds)[0];
      const matchLocal = pendingQuotesForForwarder.find((r) => r.bookingId === bId);
      const matchDb = candidateBookingsForForwarder?.find((b) => b.id === bId);

      p5Matched = true;
      p5BookingId = bId;
      p5MovementNumber =
        matchLocal?.movementNumber ||
        matchDb?.movement_number ||
        matchDb?.booking_reference ||
        null;
      p5ForwarderId = matchedForwarder.id;
      p5Details = `Sender matches forwarder ${matchedForwarder.name} with exactly 1 active pending booking`;
    } else if (distinctBookingIds.size > 1) {
      p5Ambiguous = true;
      p5Details = `Sender matches forwarder ${matchedForwarder.name}, but this forwarder has ${distinctBookingIds.size} active bookings. Ambiguous match - MUST NOT auto-assign.`;
    } else {
      p5Details = `Sender matches forwarder ${matchedForwarder.name}, but no active pending booking was found for them.`;
    }
  }

  priorityStepEvaluations.push({
    step: 5,
    priorityName: "Sender email and linked forwarder",
    evaluated: Boolean(cleanSender),
    matched: p5Matched,
    confidence: p5Matched ? 0.88 : 0.0,
    details: p5Matched
      ? p5Details
      : p5Ambiguous
        ? p5Details
        : matchedForwarder
          ? p5Details
          : "Sender email domain does not match any registered forwarder.",
  });

  if (p5Matched && p5BookingId && !p5Ambiguous) {
    return resolveConfidentMatchResult(supabase, {
      matchedBy: "SENDER_LINKED_FORWARDER",
      matchingPriorityStep: 5,
      confidence: 0.88,
      bookingId: p5BookingId,
      movementNumber: p5MovementNumber,
      forwarderId: p5ForwarderId,
      senderEmail: cleanSender,
      senderName: input.senderName,
      matchReason: `Confidently matched via Priority 5 (Sender email & linked forwarder): ${p5Details}.`,
      priorityStepEvaluations,
    });
  }

  // --------------------------------------------------------------------------
  // PRIORITY 6: Booking attributes (buyer, load point, destination, container details)
  // --------------------------------------------------------------------------
  let p6Matched = false;
  let p6BookingId: string | null = null;
  let p6MovementNumber: string | null = null;
  let p6ForwarderId: string | null = null;
  let p6Confidence = 0;
  let p6Details = "";

  // Query candidate active bookings for attribute correlation
  const { data: rawCandidates } = await supabase
    .from("bookings")
    .select(
      `
      id,
      movement_number,
      booking_reference,
      reference,
      forwarder_id,
      origin,
      destination,
      vessel_name,
      voyage_number,
      etd,
      eta,
      container_type,
      container_size,
      status
    `,
    )
    .not("status", "eq", "Cancelled")
    .not("status", "eq", "Delivered")
    .order("created_at", { ascending: false })
    .limit(40);

  const forwarderMap = new Map<string, { name: string; email: string; website?: string }>();
  for (const f of dbForwarders || []) {
    forwarderMap.set(f.id, {
      name: f.company_name || "",
      email: (f.email || "").toLowerCase(),
      website: f.website || "",
    });
  }

  const enrichedCandidates = (rawCandidates || []).map((c) => ({
    ...c,
    forwarder_name: c.forwarder_id ? forwarderMap.get(c.forwarder_id)?.name || null : null,
    forwarder_email: c.forwarder_id ? forwarderMap.get(c.forwarder_id)?.email || null : null,
    forwarder_website: c.forwarder_id ? forwarderMap.get(c.forwarder_id)?.website || null : null,
  }));

  const lowerContent = fullText.toLowerCase();

  // Extract container numbers from text (ISO 6346: 4 letters + 7 digits)
  const containerNumbers = Array.from(fullText.matchAll(/\b([A-Z]{4}[0-9]{7})\b/g)).map((m) =>
    m[1].toUpperCase(),
  );

  interface ScoredCandidate {
    candidate: (typeof enrichedCandidates)[0];
    score: number;
    matchedSignals: string[];
  }

  const scoredCandidates: ScoredCandidate[] = [];

  for (const cand of enrichedCandidates) {
    let score = 0;
    const signals: string[] = [];

    // 1. Forwarder association
    const fEmail = (cand.forwarder_email || "").toLowerCase();
    const fDomain = extractDomain(cand.forwarder_website || fEmail);
    if (fEmail && cleanSender === fEmail) {
      score += 25;
      signals.push(`Forwarder email (${cand.forwarder_name})`);
    } else if (
      sDomain &&
      fDomain &&
      sDomain === fDomain &&
      !COMMON_PUBLIC_MAIL_PROVIDERS.has(sDomain)
    ) {
      score += 20;
      signals.push(`Forwarder domain (@${sDomain})`);
    }

    // 2. Container numbers match
    if (containerNumbers.length > 0) {
      const { data: bContainers } = await supabase
        .from("booking_containers")
        .select("container_number")
        .eq("booking_id", cand.id);

      const dbContainerNums = (bContainers || [])
        .map((bc) => (bc.container_number || "").toUpperCase())
        .filter(Boolean);

      const hasContainerMatch = containerNumbers.some((cn) => dbContainerNums.includes(cn));
      if (hasContainerMatch) {
        score += 45;
        signals.push(`Container number [${containerNumbers.join(", ")}]`);
      }
    }

    // 3. Port Pair (Origin / POL & Destination / POD)
    const origin = (cand.origin || "").toLowerCase().trim();
    const dest = (cand.destination || "").toLowerCase().trim();
    let portMatches = 0;
    if (origin && origin.length >= 3 && lowerContent.includes(origin)) {
      portMatches++;
      signals.push(`POL/Load point (${cand.origin})`);
    }
    if (dest && dest.length >= 3 && lowerContent.includes(dest)) {
      portMatches++;
      signals.push(`POD/Destination (${cand.destination})`);
    }
    if (portMatches === 2) {
      score += 35;
    } else if (portMatches === 1) {
      score += 15;
    }

    // 4. Vessel & Voyage
    const vName = (cand.vessel_name || "").toLowerCase().trim();
    const vVoyage = (cand.voyage_number || "").toLowerCase().trim();
    if (vName && vName.length >= 4 && lowerContent.includes(vName)) {
      score += 20;
      signals.push(`Vessel (${cand.vessel_name})`);
      if (vVoyage && vVoyage.length >= 2 && lowerContent.includes(vVoyage)) {
        score += 15;
        signals.push(`Voyage (${cand.voyage_number})`);
      }
    }

    // 5. ETD / Sailing date
    if (cand.etd && lowerContent.includes(cand.etd.slice(0, 10))) {
      score += 15;
      signals.push(`ETD date (${cand.etd})`);
    }

    if (score >= 40) {
      scoredCandidates.push({ candidate: cand, score, matchedSignals: signals });
    }
  }

  scoredCandidates.sort((a, b) => b.score - a.score);

  // Unambiguous winner: Top score >= 60 and margin >= 20 points above second candidate
  if (scoredCandidates.length > 0) {
    const top = scoredCandidates[0];
    const second = scoredCandidates[1];
    const scoreLead = second ? top.score - second.score : top.score;

    if (top.score >= 60 && scoreLead >= 20) {
      p6Matched = true;
      p6BookingId = top.candidate.id;
      p6MovementNumber =
        top.candidate.movement_number || top.candidate.booking_reference || "Movement";
      p6ForwarderId = top.candidate.forwarder_id || null;
      p6Confidence = Math.min(0.88, top.score / 100);
      p6Details = `Operational booking attributes (score ${top.score}): ${top.matchedSignals.join(", ")}`;
    }
  }

  priorityStepEvaluations.push({
    step: 6,
    priorityName: "Booking attributes (buyer, load point, destination, containers)",
    evaluated: true,
    matched: p6Matched,
    confidence: p6Matched ? p6Confidence : 0.0,
    details: p6Matched
      ? p6Details
      : scoredCandidates.length > 0
        ? `Found ${scoredCandidates.length} candidate bookings, but top candidate did not meet decisive confidence threshold (top score: ${scoredCandidates[0].score}, margin: ${scoredCandidates[1] ? scoredCandidates[0].score - scoredCandidates[1].score : scoredCandidates[0].score}). Requires manual review.`
        : "No operational booking attributes (ports, containers, vessels) matched candidate bookings.",
  });

  if (p6Matched && p6BookingId) {
    return resolveConfidentMatchResult(supabase, {
      matchedBy: "BOOKING_ATTRIBUTES",
      matchingPriorityStep: 6,
      confidence: p6Confidence,
      bookingId: p6BookingId,
      movementNumber: p6MovementNumber,
      forwarderId: p6ForwarderId,
      senderEmail: cleanSender,
      senderName: input.senderName,
      matchReason: `Confidently matched via Priority 6 (Booking Attributes): ${p6Details}.`,
      priorityStepEvaluations,
    });
  }

  // --------------------------------------------------------------------------
  // FALLTHROUGH: UNABLE TO CONFIDENTLY IDENTIFY MOVEMENT -> MUST RETURN NEEDS_REVIEW
  // Never automatically assign an email when multiple bookings match or confidence is low!
  // --------------------------------------------------------------------------
  const unconfidentReason =
    "Movement/Booking could not be confidently identified across all 6 matching priorities (Gmail Thread ID, In-Reply-To/References, Movement Number in subject/body, Unique per-forwarder Request ID, Sender email and linked forwarder, and Booking attributes). Marked for manual review (NEEDS_REVIEW).";

  return {
    matchStatus: "NEEDS_REVIEW",
    matchedBy: "NONE",
    matchingPriorityStep: 0,
    confidence: 0.0,
    bookingId: null,
    movementId: null,
    movementNumber: null,
    forwarderId: null,
    forwarderName: null,
    forwarderEmail: null,
    senderEmail: cleanSender,
    isForwarderValidated: false,
    matchReason: unconfidentReason,
    priorityStepEvaluations,
    details: {
      evaluatedPriorities: priorityStepEvaluations,
      sender: cleanSender,
      subject,
    },
  };
}

/**
 * Helper to resolve forwarder data and format the confident MATCHED result
 */
async function resolveConfidentMatchResult(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  params: {
    matchedBy: MatchedBy;
    matchingPriorityStep: number;
    confidence: number;
    bookingId: string;
    movementNumber: string | null;
    forwarderId: string | null;
    senderEmail: string;
    senderName?: string | null;
    matchReason: string;
    priorityStepEvaluations: PriorityStepEvaluation[];
  },
): Promise<MovementMatchResult> {
  const {
    matchedBy,
    matchingPriorityStep,
    confidence,
    bookingId,
    senderEmail,
    senderName,
    matchReason,
    priorityStepEvaluations,
  } = params;

  let finalMovementNumber = params.movementNumber;
  let finalForwarderId = params.forwarderId;
  let finalBookingRef: string | null = null;

  // Fetch booking details if missing
  const { data: bRec } = await supabase
    .from("bookings")
    .select("id, movement_number, booking_reference, reference, forwarder_id")
    .eq("id", bookingId)
    .maybeSingle();

  if (bRec) {
    finalBookingRef = bRec.booking_reference || bRec.reference || null;
    if (!finalMovementNumber) {
      finalMovementNumber =
        bRec.movement_number || bRec.booking_reference || bRec.reference || "Movement";
    }
    if (!finalForwarderId) {
      finalForwarderId = bRec.forwarder_id || null;
    }
  }

  // Fetch forwarder record
  let forwarderName: string | null = null;
  let forwarderEmail: string | null = null;
  let forwarderData: {
    id: string;
    company_name?: string | null;
    email?: string | null;
    contact_person?: string | null;
    website?: string | null;
    notes?: string | null;
  } | null = null;

  if (finalForwarderId) {
    const { data: fRec } = await supabase
      .from("forwarders")
      .select("id, company_name, email, contact_person, website, notes")
      .eq("id", finalForwarderId)
      .maybeSingle();

    if (fRec) {
      forwarderData = fRec;
      forwarderName = fRec.company_name || fRec.contact_person || null;
      forwarderEmail = fRec.email || null;
    }
  }

  // Fallback: If not resolved yet, search forwarders table by sender email
  if (!forwarderName && senderEmail) {
    const cleanSender = senderEmail.trim().toLowerCase();
    const { data: fRecByEmail } = await supabase
      .from("forwarders")
      .select("id, company_name, email, contact_person, website, notes")
      .or(`email.ilike.%${cleanSender}%,contact_email.ilike.%${cleanSender}%`)
      .limit(1)
      .maybeSingle();

    if (fRecByEmail) {
      forwarderData = fRecByEmail;
      finalForwarderId = fRecByEmail.id;
      forwarderName = fRecByEmail.company_name || fRecByEmail.contact_person || null;
      forwarderEmail = fRecByEmail.email || cleanSender;
    }
  }

  // Fallback 2: Check forwarder_requests table for this movement
  if (!forwarderName && finalMovementNumber && senderEmail) {
    const { data: fwdReqs } = await supabase
      .from("forwarder_requests")
      .select("forwarder_id, forwarder_name, forwarder_email")
      .or(`movement_number.eq.${finalMovementNumber},booking_reference.eq.${finalMovementNumber}`)
      .ilike("forwarder_email", senderEmail)
      .limit(1);

    if (fwdReqs && fwdReqs.length > 0 && fwdReqs[0].forwarder_name) {
      forwarderName = fwdReqs[0].forwarder_name;
      finalForwarderId = fwdReqs[0].forwarder_id || finalForwarderId;
      forwarderEmail = fwdReqs[0].forwarder_email || senderEmail;
    }
  }

  // Fallback 3: Use sender display name or formatted email username
  if (!forwarderName && (senderName || senderEmail)) {
    const emailUser = (senderEmail || "").split("@")[0] || "Forwarder";
    forwarderName =
      senderName?.trim() || emailUser.charAt(0).toUpperCase() + emailUser.slice(1);
    forwarderEmail = senderEmail;
  }

  // Validate forwarder sender email
  const fwdValidation = validateForwarderSenderEmail(senderEmail, forwarderData, {
    matchedBy,
  });

  return {
    matchStatus: "MATCHED",
    matchedBy,
    matchingPriorityStep,
    confidence,
    bookingId,
    movementId: bookingId,
    movementNumber: finalMovementNumber,
    bookingReference: finalBookingRef,
    forwarderId: finalForwarderId,
    forwarderName,
    forwarderEmail,
    senderEmail,
    isForwarderValidated: fwdValidation.isValid,
    matchReason,
    priorityStepEvaluations,
    details: {
      forwarderValidationReason: fwdValidation.reason,
      priorityStep: matchingPriorityStep,
    },
  };
}

/**
 * Backward-compatible entry point
 */
export async function executeMovementForwarderMatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: MatchEmailInput,
): Promise<MovementMatchResult> {
  return identifyMovementForIncomingEmail(supabase, input);
}

export const matchIncomingEmailToMovementAndForwarder = identifyMovementForIncomingEmail;
