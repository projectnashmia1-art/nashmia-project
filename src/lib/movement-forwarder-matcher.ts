import type { SupabaseClient } from "@supabase/supabase-js";
import { safeUuid } from "./supabase-services";
import { extractMovementNumber } from "./movement-lifecycle";
import { matchIncomingEmailToForwarderRequest } from "./multi-forwarder-service";

export type MatchStatus = "MATCHED" | "NEEDS_REVIEW" | "UNMATCHED" | "PENDING";
export type MatchedBy = "THREAD_ID" | "MOVEMENT_NUMBER" | "MANUAL" | "NONE";

export interface MovementMatchResult {
  matchStatus: "MATCHED" | "NEEDS_REVIEW";
  matchedBy: MatchedBy;
  bookingId: string | null;
  movementId: string | null;
  movementNumber: string | null;
  forwarderId: string | null;
  forwarderName: string | null;
  forwarderEmail: string | null;
  senderEmail: string;
  isForwarderValidated: boolean;
  matchReason: string;
  details?: Record<string, unknown>;
}

export interface MatchEmailInput {
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  subject?: string | null;
  body?: string | null;
  snippet?: string | null;
  senderEmail: string;
  senderName?: string | null;
  emailMessageId?: string | null;
  userId?: string | null;
}

/**
 * Extract domain from an email or URL string (e.g., 'operations@apexmaritime.com' -> 'apexmaritime.com')
 */
function extractDomain(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const clean = input.trim().toLowerCase();
    if (clean.includes("@")) {
      return clean.split("@")[1].trim();
    }
    // Handle URL or raw hostname
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

  // Check 0: If matched by verified Gmail Thread ID, this reply is directly in the booking conversation thread
  if (options?.matchedBy === "THREAD_ID") {
    return {
      isValid: true,
      reason: `Sender ${cleanSender} replied directly inside the verified booking conversation thread.`,
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
    // If no forwarder record is linked yet but movement was explicitly referenced in the subject/body
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

  // If corporate domain matches and is not a generic public provider
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
 * Core Matching Engine for Incoming Forwarder Replies:
 *
 * 1. FIRST: Try matching by gmail_thread_id -> original booking email -> booking -> movement
 * 2. If thread matching is unavailable: Extract exact Movement Number (e.g. MOV-2026-00125) and match against booking
 * 3. Then verify: incoming sender email belongs to Forwarder associated with booking
 * 4. Determine status:
 *    - If movement found + forwarder validated -> MATCHED
 *    - If movement found + forwarder NOT validated -> NEEDS_REVIEW
 *    - If movement not found -> NEEDS_REVIEW
 * 5. Does NOT confirm the booking/movement automatically.
 */
export async function executeMovementForwarderMatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: MatchEmailInput,
): Promise<MovementMatchResult> {
  const { gmailThreadId, subject, body, snippet, senderEmail } = input;
  const cleanSender = (senderEmail || "").trim().toLowerCase();

  let matchedBookingId: string | null = null;
  let matchedMovementId: string | null = null;
  let matchedMovementNumber: string | null = null;
  let matchedForwarderId: string | null = null;
  let matchedBy: MatchedBy = "NONE";
  let matchDiscoveryMethod = "";

  // --------------------------------------------------------------------------
  // STEP 0: Check Multi-Forwarder Request System
  // Uniquely connects to: Booking ID + Forwarder ID + Gmail Thread ID + Gmail Message ID
  // with Movement Number / Booking Reference as additional fallback.
  // CRITICAL: Guarantees replies from different forwarders are NEVER mixed together!
  // --------------------------------------------------------------------------
  const multiFwdMatch = matchIncomingEmailToForwarderRequest({
    gmailThreadId,
    gmailMessageId: input.gmailMessageId,
    senderEmail: cleanSender,
    senderName: input.senderName,
    subject,
    body,
    snippet,
  });

  if (multiFwdMatch.matched && multiFwdMatch.request) {
    const req = multiFwdMatch.request;
    return {
      matchStatus: "MATCHED",
      matchedBy: multiFwdMatch.matchedBy === "GMAIL_THREAD_ID" ? "THREAD_ID" : "MOVEMENT_NUMBER",
      bookingId: req.bookingId,
      movementId: req.bookingId,
      movementNumber: req.movementNumber || req.bookingReference,
      forwarderId: req.forwarderId,
      forwarderName: req.forwarderName,
      forwarderEmail: req.forwarderEmail,
      senderEmail: cleanSender,
      isForwarderValidated: true,
      matchReason: multiFwdMatch.reason,
      details: {
        forwarderRequestId: req.id,
        matchedBy: multiFwdMatch.matchedBy,
        confidence: multiFwdMatch.confidence,
        trackingCompositeKey: req.trackingCompositeKey,
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 1: Try matching by gmail_thread_id -> original booking email -> booking
  // --------------------------------------------------------------------------
  if (gmailThreadId) {
    // Check existing email_threads
    const { data: threadRecord } = await supabase
      .from("email_threads")
      .select("id, booking_id")
      .eq("gmail_thread_id", gmailThreadId)
      .maybeSingle();

    if (threadRecord?.booking_id) {
      matchedBookingId = threadRecord.booking_id;
      matchedMovementId = threadRecord.booking_id;
      // Fetch booking details
      const { data: bRec } = await supabase
        .from("bookings")
        .select("id, booking_reference, reference, forwarder_id")
        .eq("id", matchedBookingId)
        .maybeSingle();

      if (bRec) {
        matchedMovementNumber = bRec.booking_reference || bRec.reference || null;
        matchedForwarderId = bRec.forwarder_id || null;
      }
      matchedBy = "THREAD_ID";
      matchDiscoveryMethod = `Gmail Thread ID [${gmailThreadId}] linked to booking in email_threads`;
    } else {
      // Fallback within Step 1: Check existing messages with this gmail_thread_id
      const { data: msgRecord } = await supabase
        .from("email_messages")
        .select("booking_id, movement_id, movement_number")
        .eq("gmail_thread_id", gmailThreadId)
        .not("booking_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (msgRecord?.booking_id) {
        matchedBookingId = msgRecord.booking_id;
        matchedMovementId = msgRecord.movement_id || msgRecord.booking_id;
        matchedMovementNumber = msgRecord.movement_number || null;
        matchedBy = "THREAD_ID";
        matchDiscoveryMethod = `Gmail Thread ID [${gmailThreadId}] linked to booking in email_messages`;
      }
    }
  }

  // --------------------------------------------------------------------------
  // STEP 2: If thread matching is unavailable, extract Movement Number / Booking Reference as fallback
  // --------------------------------------------------------------------------
  if (!matchedBookingId) {
    const extractedNumber =
      extractMovementNumber(subject) ||
      extractMovementNumber(body) ||
      extractMovementNumber(snippet);

    if (extractedNumber) {
      matchedMovementNumber = extractedNumber;

      // Match against existing booking record
      const { data: bookingRecord } = await supabase
        .from("bookings")
        .select("id, booking_reference, reference, forwarder_id")
        .or(`booking_reference.eq.${extractedNumber},reference.eq.${extractedNumber}`)
        .limit(1)
        .maybeSingle();

      if (bookingRecord) {
        matchedBookingId = bookingRecord.id;
        matchedMovementId = bookingRecord.id;
        matchedMovementNumber =
          bookingRecord.booking_reference || bookingRecord.reference || extractedNumber;
        matchedForwarderId = bookingRecord.forwarder_id || null;
        matchedBy = "MOVEMENT_NUMBER";
        matchDiscoveryMethod = `Movement Number / Booking Reference [${extractedNumber}] extracted from message content`;
      }
    }

    // Additional Fallback: scan recent active bookings to match reference inside content
    if (!matchedBookingId) {
      const { data: candidateBookings } = await supabase
        .from("bookings")
        .select("id, booking_reference, reference, forwarder_id")
        .order("created_at", { ascending: false })
        .limit(50);

      const fullContent = `${subject || ""} ${body || ""} ${snippet || ""}`.toLowerCase();
      for (const cand of candidateBookings || []) {
        const bRef = (cand.booking_reference || "").toLowerCase();
        const ref = (cand.reference || "").toLowerCase();
        if ((bRef && fullContent.includes(bRef)) || (ref && fullContent.includes(ref))) {
          matchedBookingId = cand.id;
          matchedMovementId = cand.id;
          matchedMovementNumber = cand.booking_reference || cand.reference || "BOOKING";
          matchedForwarderId = cand.forwarder_id || null;
          matchedBy = "MOVEMENT_NUMBER";
          matchDiscoveryMethod = `Booking Reference [${matchedMovementNumber}] found in email content scan`;
          break;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // CASE A: Movement Number cannot be found
  // --------------------------------------------------------------------------
  if (!matchedBookingId) {
    return {
      matchStatus: "NEEDS_REVIEW",
      matchedBy: "NONE",
      bookingId: null,
      movementId: null,
      movementNumber: matchedMovementNumber || null,
      forwarderId: null,
      forwarderName: null,
      forwarderEmail: null,
      senderEmail: cleanSender,
      isForwarderValidated: false,
      matchReason:
        "Movement Number could not be detected in email subject/body, and no active Gmail thread match was found.",
      details: {
        checkedThreadId: gmailThreadId || null,
        checkedSender: cleanSender,
      },
    };
  }

  // --------------------------------------------------------------------------
  // STEP 3: Retrieve and verify Forwarder associated with the matched booking
  // --------------------------------------------------------------------------
  // Retrieve booking details to get forwarder_id and movement number if not already present
  const { data: bookingDetails } = await supabase
    .from("bookings")
    .select("id, booking_reference, reference, status, forwarder_id")
    .eq("id", matchedBookingId)
    .maybeSingle();

  if (bookingDetails?.forwarder_id && !matchedForwarderId) {
    matchedForwarderId = bookingDetails.forwarder_id;
  }
  if (bookingDetails?.booking_reference && !matchedMovementNumber) {
    matchedMovementNumber = bookingDetails.booking_reference;
  }

  // Fetch forwarder record directly
  let forwarderData: {
    id: string;
    company_name?: string | null;
    email?: string | null;
    contact_person?: string | null;
    website?: string | null;
    notes?: string | null;
  } | null = null;

  if (matchedForwarderId) {
    const { data: fRecord } = await supabase
      .from("forwarders")
      .select("id, company_name, email, contact_person, website, notes")
      .eq("id", matchedForwarderId)
      .maybeSingle();
    forwarderData = fRecord || null;
  }

  // Check if outbound emails for this booking were dispatched to this sender
  let matchedOutboundRecipient: string | null = null;
  if (matchedBookingId) {
    const { data: outMsgs } = await supabase
      .from("email_messages")
      .select("recipient_email")
      .eq("booking_id", matchedBookingId)
      .eq("direction", "outbound")
      .limit(10);

    const found = outMsgs?.find(
      (m) => m.recipient_email && m.recipient_email.trim().toLowerCase() === cleanSender,
    );
    if (found?.recipient_email) {
      matchedOutboundRecipient = found.recipient_email;
    }
  }

  // Validate sender email against the forwarder
  const forwarderValidation = validateForwarderSenderEmail(cleanSender, forwarderData, {
    matchedBy,
    outboundRecipient: matchedOutboundRecipient,
  });

  // --------------------------------------------------------------------------
  // CASE B: Movement found but Forwarder cannot be validated -> NEEDS_REVIEW
  // --------------------------------------------------------------------------
  if (!forwarderValidation.isValid) {
    return {
      matchStatus: "NEEDS_REVIEW",
      matchedBy,
      bookingId: matchedBookingId,
      movementId: matchedMovementId,
      movementNumber: matchedMovementNumber,
      forwarderId: matchedForwarderId,
      forwarderName: forwarderData?.company_name || null,
      forwarderEmail: forwarderData?.email || null,
      senderEmail: cleanSender,
      isForwarderValidated: false,
      matchReason: `Movement ${matchedMovementNumber} identified via ${matchedBy}, but sender verification failed: ${forwarderValidation.reason}`,
      details: {
        discoveryMethod: matchDiscoveryMethod,
        validationReason: forwarderValidation.reason,
      },
    };
  }

  // --------------------------------------------------------------------------
  // CASE C: Both Movement and Forwarder are confidently matched -> MATCHED
  // --------------------------------------------------------------------------
  return {
    matchStatus: "MATCHED",
    matchedBy,
    bookingId: matchedBookingId,
    movementId: matchedMovementId,
    movementNumber: matchedMovementNumber,
    forwarderId: matchedForwarderId,
    forwarderName: forwarderData?.company_name || null,
    forwarderEmail: forwarderData?.email || null,
    senderEmail: cleanSender,
    isForwarderValidated: true,
    matchReason: `Confidently matched Movement ${matchedMovementNumber} (${matchDiscoveryMethod}) and verified Forwarder ${forwarderData?.company_name || "Partner"}.`,
    details: {
      discoveryMethod: matchDiscoveryMethod,
      validationReason: forwarderValidation.reason,
    },
  };
}

/**
 * Saves or updates match records in Supabase (email_messages and email_matches).
 * Strictly preserves the booking status (does NOT auto-confirm).
 */
export async function saveMovementMatch(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  emailMessageId: string,
  matchResult: MovementMatchResult,
): Promise<{ success: boolean; error?: string }> {
  try {
    const validMessageUuid = safeUuid(emailMessageId);
    if (!validMessageUuid) {
      return { success: false, error: "Invalid email message UUID" };
    }

    const nowIso = new Date().toISOString();

    // 1. Fetch current message raw_headers to merge
    const { data: curMsg } = await supabase
      .from("email_messages")
      .select("id, raw_headers")
      .eq("id", validMessageUuid)
      .maybeSingle();

    const existingHeaders = (curMsg?.raw_headers as Record<string, unknown>) || {};
    const updatedHeaders = {
      ...existingHeaders,
      booking_id: safeUuid(matchResult.bookingId) || existingHeaders.booking_id || null,
      movement_id: safeUuid(matchResult.movementId) || existingHeaders.movement_id || null,
      movement_number: matchResult.movementNumber || existingHeaders.movement_number || null,
      forwarder_id: safeUuid(matchResult.forwarderId) || existingHeaders.forwarder_id || null,
      match_status: matchResult.matchStatus,
      match_reason: matchResult.matchReason,
      matched_by: matchResult.matchedBy,
      matched_at: nowIso,
      match_details: {
        isForwarderValidated: matchResult.isForwarderValidated,
        forwarderName: matchResult.forwarderName,
        forwarderEmail: matchResult.forwarderEmail,
        senderEmail: matchResult.senderEmail,
        ...(matchResult.details || {}),
      },
    };

    // Update email_messages record
    await supabase
      .from("email_messages")
      .update({
        raw_headers: updatedHeaders,
      })
      .eq("id", validMessageUuid);

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[MovementForwarderMatcher] Error saving match:", errorMsg);
    return { success: false, error: errorMsg };
  }
}

export const matchIncomingEmailToMovementAndForwarder = executeMovementForwarderMatch;
