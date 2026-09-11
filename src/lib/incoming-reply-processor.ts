import { SupabaseClient } from "@supabase/supabase-js";
import { executeMovementForwarderMatch, MovementMatchResult } from "./movement-forwarder-matcher";
import {
  detectForwarderConfirmation,
  ConfirmationDetectionResult,
} from "./forwarder-confirmation-detector";
import {
  processAutomaticMovementConfirmation,
  MovementConfirmationResult,
} from "./movement-confirmation-engine";
import { safeUuid } from "./supabase-services";
import { analyzeEmailForForwarderOffer, type OfferValidationResult } from "./ai-offer-extractor";
import { getLocalForwarderRequests } from "./multi-forwarder-service";
import type { ForwarderResponseClassification } from "@/types/requests";
import {
  saveExtractedForwarderOffer,
  type SaveForwarderOfferResult,
} from "./forwarder-offer-storage";

export interface ProcessIncomingReplyInput {
  emailMessageId: string;
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  subject?: string | null;
  body?: string | null;
  snippet?: string | null;
  senderEmail: string;
  senderName?: string | null;
  recipientEmail?: string | null;
  direction?: string | null;
  userId?: string | null;
}

export interface ProcessIncomingReplyResult {
  success: boolean;
  emailMessageId: string;
  matchResult: MovementMatchResult;
  confirmationResult: ConfirmationDetectionResult;
  confirmationEngineResult: MovementConfirmationResult | null;
  extractedOffer: OfferValidationResult | null;
  savedOfferResult: SaveForwarderOfferResult | null;
  classification: ForwarderResponseClassification;
  isConfirmed: boolean;
  actionTaken: string;
  movementNumber: string | null;
  bookingId: string | null;
  message: string;
}

/**
 * Processes an incoming forwarder email reply AFTER it has been saved to email_messages.
 *
 * Full Pipeline:
 * Forwarder Email Reply
 *         ↓
 * Gmail Incoming Sync
 *         ↓
 * Save email to existing email_messages
 *         ↓
 * Identify Gmail Thread
 *         ↓
 * Identify Forwarder
 *         ↓
 * Identify Booking / Movement
 *         ↓
 * Analyze Email (AI / Document Understanding)
 *         ↓
 * Extract Offer Information
 *         ↓
 * Validate Extracted Data
 *         ↓
 * Save Offer to Supabase
 *         ↓
 * Update Existing Requests Page
 */
export async function processIncomingEmailReply(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: ProcessIncomingReplyInput,
): Promise<ProcessIncomingReplyResult> {
  const {
    emailMessageId,
    gmailThreadId,
    gmailMessageId,
    subject = "",
    body = "",
    snippet = "",
    senderEmail,
    senderName,
    userId,
  } = input;

  const nowIso = new Date().toISOString();

  console.log(
    `[ReplyProcessor] 🚀 Processing incoming reply for email_messages ID: ${emailMessageId}`,
  );

  // Step 1: Identify Gmail Thread, Forwarder, and Booking / Movement
  const matchResult = await executeMovementForwarderMatch(supabase, {
    gmailThreadId,
    gmailMessageId,
    subject,
    body,
    snippet,
    senderEmail,
    senderName,
    emailMessageId,
    userId,
  });

  console.log(`[ReplyProcessor] Match result:`, {
    status: matchResult.matchStatus,
    by: matchResult.matchedBy,
    bookingId: matchResult.bookingId,
    movementNumber: matchResult.movementNumber,
    isForwarderValidated: matchResult.isForwarderValidated,
  });

  // Step 2: Intelligent Email Reading (AI / Document Understanding)
  // Understands natural-language forwarder replies without requiring a rigid format:
  // e.g., "Rate is USD 2,100 for 40HC. Space available on 18 Sep sailing. ETA Karachi 12 Oct."
  // or "We can offer USD 1,950 all inclusive. ETD 20 September, transit 24 days."
  // or "Unfortunately no space available for this sailing."
  let offerValidation: OfferValidationResult | null = null;
  let savedOfferResult: SaveForwarderOfferResult | null = null;

  try {
    // Look up requested booking specifications for strict validation against booking
    const localRequests = getLocalForwarderRequests();
    const matchedReq = localRequests.find(
      (r) =>
        (matchResult.movementNumber &&
          r.movementNumber.toUpperCase().trim() ===
            matchResult.movementNumber.toUpperCase().trim()) ||
        (matchResult.bookingId && r.bookingId === matchResult.bookingId),
    );

    const requestedBooking = matchedReq
      ? {
          containerSize: matchedReq.containerSize,
          containerCount: matchedReq.containerCount,
          origin: matchedReq.origin,
          destination: matchedReq.destination,
          targetDeparture: matchedReq.requiredSailingDate || matchedReq.etd,
          targetArrival: matchedReq.eta,
        }
      : undefined;

    offerValidation = await analyzeEmailForForwarderOffer({
      emailMessageId,
      subject: subject || "",
      body: body || "",
      snippet: snippet || "",
      senderEmail,
      senderName: senderName || matchResult.forwarderName,
      movementNumber: matchResult.movementNumber,
      forwarderName: matchResult.forwarderName,
      containerCount: matchedReq?.containerCount,
      containerSize: matchedReq?.containerSize,
      requestedBooking,
    });

    console.log(`[ReplyProcessor] 🤖 AI Offer Analysis:`, {
      method: offerValidation.validatedOffer.extractionMethod,
      rate: offerValidation.validatedOffer.ratePerContainer,
      spaceAvailable: offerValidation.validatedOffer.spaceAvailable,
      isDeclined: offerValidation.validatedOffer.isDeclined,
      status: offerValidation.normalizedStatus,
      summary: offerValidation.validatedOffer.summary,
    });

    // Step 3: Save Offer to Supabase & Update Existing Requests Page
    savedOfferResult = await saveExtractedForwarderOffer({
      bookingId: matchResult.bookingId,
      movementNumber: matchResult.movementNumber,
      forwarderId: matchResult.forwarderId,
      forwarderName: matchResult.forwarderName,
      forwarderEmail: matchResult.forwarderEmail || senderEmail,
      emailMessageId,
      gmailThreadId,
      gmailMessageId,
      offerValidation,
      userId,
    });
  } catch (extractErr) {
    console.warn("[ReplyProcessor] Notice during AI offer extraction/saving:", extractErr);
  }

  // Step 4: Detect forwarder confirmation (e.g., "Booking confirmed")
  const confirmationResult = await detectForwarderConfirmation({
    emailMessageId,
    subject: subject || "",
    body: body || "",
    snippet: snippet || "",
    senderEmail,
    senderName,
    movementNumber: matchResult.movementNumber,
    forwarderName: matchResult.forwarderName,
    matchStatus: matchResult.matchStatus,
  });

  console.log(`[ReplyProcessor] Confirmation detection:`, {
    status: confirmationResult.confirmationStatus,
    confidence: confirmationResult.confidence,
    reason: confirmationResult.reason,
    detectedBy: confirmationResult.detectedBy,
  });

  // Step 5: Update email_messages record raw_headers with matching, offer & confirmation info
  const validMsgUuid = safeUuid(emailMessageId);
  if (validMsgUuid) {
    try {
      const { data: curMsg } = await supabase
        .from("email_messages")
        .select("raw_headers")
        .eq("id", validMsgUuid)
        .maybeSingle();

      const existingHeaders = (curMsg?.raw_headers as Record<string, unknown>) || {};
      const updatedHeaders = {
        ...existingHeaders,
        booking_id: safeUuid(matchResult.bookingId) || existingHeaders.booking_id || null,
        movement_id: safeUuid(matchResult.movementId) || existingHeaders.movement_id || null,
        forwarder_id: safeUuid(matchResult.forwarderId) || existingHeaders.forwarder_id || null,
        movement_number: matchResult.movementNumber || existingHeaders.movement_number || null,
        match_status: matchResult.matchStatus,
        match_reason: matchResult.matchReason,
        matched_by: matchResult.matchedBy,
        matched_at: nowIso,
        confirmation_status: confirmationResult.confirmationStatus,
        confirmation_confidence: confirmationResult.confidence,
        confirmation_reason: confirmationResult.reason,
        confirmation_detected_by: confirmationResult.detectedBy,
        confirmation_details: confirmationResult.details || null,
        forwarder_validated: matchResult.isForwarderValidated,
        offer_extracted: Boolean(offerValidation?.isValid),
        offer_status: offerValidation?.normalizedStatus || null,
        response_classification:
          confirmationResult.classification || offerValidation?.normalizedStatus || null,
        extracted_offer_summary: offerValidation?.validatedOffer.summary || null,
      };

      await supabase
        .from("email_messages")
        .update({
          booking_id: safeUuid(matchResult.bookingId),
          movement_id: safeUuid(matchResult.movementId),
          movement_number: matchResult.movementNumber,
          forwarder_id: safeUuid(matchResult.forwarderId),
          raw_headers: updatedHeaders,
          updated_at: nowIso,
        })
        .eq("id", validMsgUuid);
    } catch (updateErr) {
      console.warn("[ReplyProcessor] Notice updating email_messages:", updateErr);
    }

    // Record audit entries in email_matches and email_confirmations
    try {
      await supabase.from("email_matches").upsert(
        {
          email_message_id: validMsgUuid,
          booking_id: safeUuid(matchResult.bookingId),
          movement_id: safeUuid(matchResult.movementId),
          forwarder_id: safeUuid(matchResult.forwarderId),
          movement_number: matchResult.movementNumber,
          sender_email: senderEmail,
          match_status: matchResult.matchStatus,
          matched_by: matchResult.matchedBy,
          match_reason: matchResult.matchReason,
          metadata: {
            isForwarderValidated: matchResult.isForwarderValidated,
            forwarderName: matchResult.forwarderName,
            forwarderEmail: matchResult.forwarderEmail,
            confirmationStatus: confirmationResult.confirmationStatus,
            classification: confirmationResult.classification,
            confidence: confirmationResult.confidence,
            offerStatus: offerValidation?.normalizedStatus,
            ratePerContainer: offerValidation?.validatedOffer.ratePerContainer,
            spaceAvailable: offerValidation?.validatedOffer.spaceAvailable,
            summary: offerValidation?.validatedOffer.summary,
            ...(matchResult.details || {}),
          },
          updated_at: nowIso,
        },
        { onConflict: "email_message_id" },
      );
    } catch (mErr) {
      console.warn("[ReplyProcessor] Notice saving email_matches audit:", mErr);
    }

    try {
      await supabase.from("email_confirmations").upsert(
        {
          email_message_id: validMsgUuid,
          booking_id: safeUuid(matchResult.bookingId),
          movement_id: safeUuid(matchResult.movementId),
          forwarder_id: safeUuid(matchResult.forwarderId),
          movement_number: matchResult.movementNumber,
          confirmation_status: confirmationResult.confirmationStatus,
          confidence: confirmationResult.confidence,
          reason: confirmationResult.reason,
          detected_by: confirmationResult.detectedBy,
          raw_subject: subject,
          raw_snippet: snippet || body.slice(0, 140),
          details: {
            ...confirmationResult.details,
            classification: confirmationResult.classification,
          },
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "email_message_id" },
      );
    } catch (cErr) {
      console.warn("[ReplyProcessor] Notice saving email_confirmations audit:", cErr);
    }
  }

  // -------------------------------------------------------------------------
  // RESPONSE CLASSIFICATION (6 Canonical Categories)
  // OFFER_RECEIVED | AVAILABLE | NOT_AVAILABLE | DECLINED | NEEDS_REVIEW | CONFIRMED
  // "Rate available" ≠ "Booking confirmed".
  // Only an explicit carrier booking confirmation triggers CONFIRMED.
  // -------------------------------------------------------------------------
  let unifiedClassification: ForwarderResponseClassification = "NEEDS_REVIEW";

  if (confirmationResult.classification === "CONFIRMED") {
    unifiedClassification = "CONFIRMED";
  } else if (offerValidation?.normalizedStatus === "CONFIRMED") {
    unifiedClassification = "CONFIRMED";
  } else if (offerValidation?.normalizedStatus === "OFFER_RECEIVED") {
    unifiedClassification = "OFFER_RECEIVED";
  } else if (
    offerValidation?.normalizedStatus === "AVAILABLE" ||
    confirmationResult.classification === "AVAILABLE"
  ) {
    unifiedClassification = "AVAILABLE";
  } else if (
    offerValidation?.normalizedStatus === "NOT_AVAILABLE" ||
    confirmationResult.classification === "NOT_AVAILABLE"
  ) {
    unifiedClassification = "NOT_AVAILABLE";
  } else if (
    offerValidation?.normalizedStatus === "DECLINED" ||
    confirmationResult.classification === "DECLINED"
  ) {
    unifiedClassification = "DECLINED";
  } else if (confirmationResult.classification === "OFFER_RECEIVED") {
    unifiedClassification = "OFFER_RECEIVED";
  } else {
    unifiedClassification = "NEEDS_REVIEW";
  }

  // Step 6: If confirmation detected and forwarder validated -> Confirm Booking/Movement!
  // CRITICAL: Only explicit carrier confirmation triggers the booking confirmation workflow.
  let confirmationEngineResult: MovementConfirmationResult | null = null;
  const isConfirmed = unifiedClassification === "CONFIRMED";

  if (matchResult.bookingId || matchResult.movementNumber) {
    try {
      confirmationEngineResult = await processAutomaticMovementConfirmation({
        bookingId: safeUuid(matchResult.bookingId),
        movementId: safeUuid(matchResult.movementId),
        movementNumber: matchResult.movementNumber,
        forwarderId: safeUuid(matchResult.forwarderId),
        forwarderName: matchResult.forwarderName,
        emailMessageId: validMsgUuid || emailMessageId,
        gmailMessageId: gmailMessageId || null,
        gmailThreadId: gmailThreadId || null,
        senderEmail,
        senderName: senderName || null,
        direction: "inbound",
        matchStatus: matchResult.matchStatus,
        matchedBy: matchResult.matchedBy,
        isForwarderValidated: matchResult.isForwarderValidated,
        confirmationStatus: confirmationResult.confirmationStatus,
        confidence: confirmationResult.confidence,
        reason: confirmationResult.reason,
        detectedBy: confirmationResult.detectedBy,
        details: confirmationResult.details,
        userId,
      });

      console.log(`[ReplyProcessor] Confirmation Engine executed:`, {
        actionTaken: confirmationEngineResult?.actionTaken,
        newStatus: confirmationEngineResult?.newStatus,
      });
    } catch (confEngineErr) {
      console.error("[ReplyProcessor] Error in movement confirmation engine:", confEngineErr);
    }
  }

  let actionTaken =
    confirmationEngineResult?.actionTaken || (isConfirmed ? "CONFIRMED" : "PROCESSED");

  if (unifiedClassification === "DECLINED") {
    actionTaken = "DECLINED";
  } else if (unifiedClassification === "NOT_AVAILABLE") {
    actionTaken = "NOT_AVAILABLE";
  } else if (unifiedClassification === "OFFER_RECEIVED") {
    actionTaken = "OFFER_EXTRACTED";
  } else if (unifiedClassification === "AVAILABLE") {
    actionTaken = "SPACE_AVAILABLE";
  } else if (unifiedClassification === "NEEDS_REVIEW") {
    actionTaken = "NEEDS_REVIEW";
  }

  return {
    success: true,
    emailMessageId,
    matchResult,
    confirmationResult,
    confirmationEngineResult,
    extractedOffer: offerValidation,
    savedOfferResult,
    classification: unifiedClassification,
    isConfirmed,
    actionTaken,
    movementNumber: matchResult.movementNumber,
    bookingId: matchResult.bookingId,
    message:
      confirmationEngineResult?.message ||
      offerValidation?.validatedOffer.summary ||
      `Processed reply for ${matchResult.movementNumber || "message"}. Status: ${unifiedClassification}`,
  };
}
