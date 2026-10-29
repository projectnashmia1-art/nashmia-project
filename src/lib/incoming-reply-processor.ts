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
import type { ForwarderResponseClassification } from "@/types/requests";
import { processIncomingForwarderEmailReply } from "./multi-forwarder-service";
import {
  processIncomingEmailAttachments,
  type SaveAndLinkAttachmentResult,
  type IncomingAttachmentInput,
} from "./document-attachment-service";

export interface ProcessIncomingReplyInput {
  emailMessageId: string;
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  headers?: Array<{ name: string; value: string }> | Record<string, unknown> | null;
  rawHeaders?: Record<string, unknown> | null;
  subject?: string | null;
  body?: string | null;
  snippet?: string | null;
  senderEmail: string;
  senderName?: string | null;
  recipientEmail?: string | null;
  direction?: string | null;
  userId?: string | null;
  attachments?: IncomingAttachmentInput[];
}

export interface ProcessIncomingReplyResult {
  success: boolean;
  emailMessageId: string;
  matchResult: MovementMatchResult;
  confirmationResult: ConfirmationDetectionResult;
  confirmationEngineResult: MovementConfirmationResult | null;
  classification: ForwarderResponseClassification;
  isConfirmed: boolean;
  actionTaken: string;
  movementNumber: string | null;
  bookingId: string | null;
  message: string;
  savedAttachments?: SaveAndLinkAttachmentResult[];
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
 * Identify Gmail Thread, Forwarder & Movement
 *         ↓
 * Detect Forwarder Confirmation / Status
 *         ↓
 * Process Attachments & Update Email Headers
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
    inReplyTo,
    references,
    headers,
    rawHeaders,
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
    inReplyTo,
    references,
    headers,
    rawHeaders,
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

  // Step 2: Detect forwarder confirmation (e.g., "Booking confirmed")
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

  // Step 3: Update email_messages record raw_headers with matching & confirmation info
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
        response_classification: confirmationResult.classification || null,
      };

      const { error: updErr } = await supabase
        .from("email_messages")
        .update({
          booking_id: safeUuid(matchResult.bookingId),
          movement_number: matchResult.movementNumber,
          forwarder_id: safeUuid(matchResult.forwarderId),
          raw_headers: updatedHeaders,
        })
        .eq("id", validMsgUuid);

      if (updErr && (updErr.code === "PGRST204" || updErr.message?.includes("column"))) {
        await supabase
          .from("email_messages")
          .update({
            raw_headers: updatedHeaders,
          })
          .eq("id", validMsgUuid);
      }
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

  // Response classification
  let unifiedClassification: ForwarderResponseClassification = "NEEDS_REVIEW";
  if (confirmationResult.classification === "CONFIRMED") {
    unifiedClassification = "CONFIRMED";
  } else if (confirmationResult.classification === "AVAILABLE") {
    unifiedClassification = "AVAILABLE";
  } else if (confirmationResult.classification === "NOT_AVAILABLE") {
    unifiedClassification = "NOT_AVAILABLE";
  } else if (confirmationResult.classification === "DECLINED") {
    unifiedClassification = "DECLINED";
  } else {
    unifiedClassification = "NEEDS_REVIEW";
  }

  // Step 3.5: Forwarder Request Reply Tracking (Auto-extraction removed)
  // Maintains email thread linkage and audit record; keeps status as pending reply awaiting manual update
  try {
    await processIncomingForwarderEmailReply({
      emailMessageId: validMsgUuid || emailMessageId,
      gmailThreadId,
      gmailMessageId,
      inReplyTo,
      references,
      headers,
      rawHeaders,
      subject,
      body,
      snippet,
      senderEmail,
      senderName,
      bookingId: matchResult.bookingId,
      movementNumber: matchResult.movementNumber,
    });
  } catch (fwdReplyErr) {
    console.warn("[ReplyProcessor] Notice tracking forwarder reply:", fwdReplyErr);
  }

  // Step 4: If confirmation detected and forwarder validated -> Confirm Booking/Movement!
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
  } else if (unifiedClassification === "AVAILABLE") {
    actionTaken = "SPACE_AVAILABLE";
  } else if (unifiedClassification === "NEEDS_REVIEW") {
    actionTaken = "NEEDS_REVIEW";
  }

  // Step 5: Automatically save and link Forwarder Cut-Off & BL Attachments
  let savedAttachments: SaveAndLinkAttachmentResult[] = [];
  try {
    let attachmentsToProcess = input.attachments || [];
    if (attachmentsToProcess.length === 0 && validMsgUuid) {
      const { data: dbMsg } = await supabase
        .from("email_messages")
        .select("attachments, raw_headers")
        .eq("id", validMsgUuid)
        .maybeSingle();

      if (Array.isArray(dbMsg?.attachments) && dbMsg.attachments.length > 0) {
        attachmentsToProcess = dbMsg.attachments as IncomingAttachmentInput[];
      } else if (
        dbMsg?.raw_headers &&
        Array.isArray((dbMsg.raw_headers as Record<string, unknown>).attachments)
      ) {
        attachmentsToProcess = (dbMsg.raw_headers as Record<string, unknown>)
          .attachments as IncomingAttachmentInput[];
      }
    }

    savedAttachments = await processIncomingEmailAttachments(supabase, {
      emailMessageId: validMsgUuid || emailMessageId,
      gmailMessageId,
      gmailThreadId,
      inReplyTo,
      references,
      headers,
      rawHeaders,
      subject,
      body,
      senderEmail,
      senderName,
      bookingId: matchResult.bookingId,
      movementNumber: matchResult.movementNumber,
      movementId: matchResult.movementId,
      forwarderId: matchResult.forwarderId,
      forwarderName: matchResult.forwarderName,
      userId,
      attachments: attachmentsToProcess,
    });

    if (savedAttachments.length > 0) {
      console.log(
        `[ReplyProcessor] 📎 Processed ${savedAttachments.length} attachments: ${savedAttachments
          .filter((s) => s.saved)
          .map((s) => `[${s.category}] ${s.document?.name}`)
          .join(", ")}`,
      );
    }
  } catch (attErr) {
    console.warn("[ReplyProcessor] Notice processing Cut-Off / BL attachments:", attErr);
  }

  return {
    success: true,
    emailMessageId,
    matchResult,
    confirmationResult,
    confirmationEngineResult,
    classification: unifiedClassification,
    isConfirmed,
    actionTaken,
    movementNumber: matchResult.movementNumber,
    bookingId: matchResult.bookingId,
    message:
      confirmationEngineResult?.message ||
      `Processed reply for ${matchResult.movementNumber || "message"}. Status: ${unifiedClassification}`,
    savedAttachments,
  };
}
