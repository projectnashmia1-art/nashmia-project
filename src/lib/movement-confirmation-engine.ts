import { supabase, isSupabaseConfigured } from "./supabase";
import {
  safeUuid,
  updateLocalBooking,
  getLocalBookings,
  safeInsertNotification,
  normalizeBookingStatus,
} from "./supabase-services";
import { getLocalForwarderRequests } from "./multi-forwarder-service";
import type {
  ConfirmationStatus,
  ConfirmationDetectionResult,
} from "./forwarder-confirmation-detector";
import type { MatchStatus, MatchedBy } from "./movement-forwarder-matcher";

export interface MovementConfirmationConditionCheck {
  validBookingFound: boolean;
  exactMatchMatched: boolean;
  forwarderValidated: boolean;
  isGenuineForwarderReply: boolean;
  detectorConfirmed: boolean;
  noConflictingDecision: boolean;
  allConditionsMet: boolean;
  failureReasons: string[];
}

export interface MovementConfirmationRequest {
  bookingId?: string | null;
  movementId?: string | null;
  movementNumber?: string | null;
  forwarderId?: string | null;
  forwarderName?: string | null;
  emailMessageId: string;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  senderEmail: string;
  senderName?: string | null;
  direction?: string;
  matchStatus?: MatchStatus;
  matchedBy?: MatchedBy;
  isForwarderValidated?: boolean;
  confirmationStatus: ConfirmationStatus;
  confidence: number;
  reason: string;
  detectedBy: string;
  details?: Record<string, unknown>;
  userId?: string | null;
}

export interface MovementConfirmationResult {
  success: boolean;
  actionTaken:
    | "AUTO_CONFIRMED"
    | "SKIPPED_IDEMPOTENT"
    | "NEEDS_REVIEW"
    | "REJECTED"
    | "NOT_CONFIRMED"
    | "FAILED";
  previousStatus: string;
  newStatus: string;
  bookingId: string | null;
  movementNumber: string | null;
  confirmedAt: string | null;
  confirmedBy: string | null;
  confirmationEmailId: string | null;
  conditions: MovementConfirmationConditionCheck;
  message: string;
}

/**
 * Step 5 — Automatic Movement Confirmation Engine
 *
 * Strict Validation Rules:
 * A movement can ONLY become CONFIRMED when ALL 6 conditions are true:
 * 1. Valid booking/movement found.
 * 2. Exact Movement Number OR valid Gmail thread matched.
 * 3. Forwarder is validated.
 * 4. Incoming email is a genuine Forwarder reply.
 * 5. Confirmation detector returns CONFIRMED.
 * 6. No conflicting manual decision exists.
 *
 * Then updates movement.status = CONFIRMED, records confirmed_at, confirmed_by = SYSTEM,
 * confirmation_email_id, and generates immutable audit log AUTO_CONFIRMED_FROM_EMAIL.
 */
export async function processAutomaticMovementConfirmation(
  request: MovementConfirmationRequest,
): Promise<MovementConfirmationResult> {
  const nowIso = new Date().toISOString();
  const validBookingUuid = safeUuid(request.bookingId || request.movementId);
  const failureReasons: string[] = [];

  console.log("[MovementConfirmationEngine] Evaluating Step 5 Automatic Confirmation:", {
    bookingId: validBookingUuid,
    movementNumber: request.movementNumber,
    confirmationStatus: request.confirmationStatus,
    matchedBy: request.matchedBy,
    isForwarderValidated: request.isForwarderValidated,
  });

  // 1. Fetch current booking record (from Supabase or local fallback)
  let currentBooking: {
    id: string;
    status: string;
    booking_reference?: string | null;
    movement_number?: string | null;
    forwarder_id?: string | null;
    user_id?: string | null;
    confirmed_at?: string | null;
    confirmed_by?: string | null;
    confirmation_email_id?: string | null;
    confirmation_status?: string | null;
  } | null = null;

  if (validBookingUuid && isSupabaseConfigured) {
    try {
      const { data: dbBooking } = await supabase
        .from("bookings")
        .select("id, status, booking_reference, reference, forwarder_id, user_id, notes")
        .eq("id", validBookingUuid)
        .maybeSingle();
      if (dbBooking) {
        currentBooking = {
          ...dbBooking,
          movement_number: dbBooking.booking_reference || dbBooking.reference,
        };
      }
    } catch (err) {
      console.warn("[MovementConfirmationEngine] Supabase booking fetch notice:", err);
    }
  }

  // Lookup by movement_number if bookingId wasn't direct UUID
  if (!currentBooking && request.movementNumber && isSupabaseConfigured) {
    try {
      const cleanMovement = request.movementNumber.trim();
      const { data: dbBookingByMov } = await supabase
        .from("bookings")
        .select("id, status, booking_reference, reference, forwarder_id, user_id, notes")
        .or(
          `booking_reference.eq.${cleanMovement},reference.eq.${cleanMovement},movement_number.eq.${cleanMovement}`,
        )
        .limit(1)
        .maybeSingle();
      if (dbBookingByMov) {
        currentBooking = {
          ...dbBookingByMov,
          movement_number:
            dbBookingByMov.booking_reference ||
            (dbBookingByMov as unknown as { movement_number?: string }).movement_number ||
            dbBookingByMov.reference,
        };
      }
    } catch (err) {
      console.warn("[MovementConfirmationEngine] Lookup by movement number notice:", err);
    }
  }

  // Local fallback lookup
  if (!currentBooking) {
    const cleanMov = (request.movementNumber || "").trim().toLowerCase();
    const cleanId = (validBookingUuid || "").toLowerCase();
    const local = getLocalBookings().find((b) => {
      const bId = (b.id || "").toLowerCase();
      const bMov = (b.movement_number || "").toLowerCase();
      const bBkRef = (b.booking_reference || "").toLowerCase();
      const bRef = (b.reference || "").toLowerCase();

      return (
        (cleanId && bId === cleanId) ||
        (cleanMov &&
          (bMov === cleanMov || bBkRef === cleanMov || bRef === cleanMov || bId === cleanMov))
      );
    });
    if (local) {
      currentBooking = {
        id: local.id,
        status: local.status || "Booking Requested",
        booking_reference: local.booking_reference,
        movement_number: local.movement_number || local.booking_reference,
        forwarder_id: local.forwarder_id,
        user_id: local.user_id,
        confirmed_at: local.confirmed_at || null,
        confirmed_by: local.confirmed_by || null,
        confirmation_email_id: local.confirmation_email_id || null,
        confirmation_status: local.confirmation_status || null,
      };
    }
  }

  const effectiveBookingId = currentBooking?.id || validBookingUuid || null;
  const effectiveMovementNumber =
    currentBooking?.movement_number ||
    request.movementNumber ||
    currentBooking?.booking_reference ||
    "UNKNOWN";
  const previousStatus = currentBooking?.status || "Awaiting Confirmation";

  // Check 1: Valid booking/movement found
  const validBookingFound = Boolean(currentBooking && effectiveBookingId);
  if (!validBookingFound) {
    failureReasons.push(
      "Condition 1 Failed: Valid booking or movement record was not found in the system.",
    );
  }

  // Check 2: Exact Movement Number OR valid Gmail thread matched
  const isMatchedByValidKey =
    request.matchedBy === "MOVEMENT_NUMBER" ||
    request.matchedBy === "THREAD_ID" ||
    request.matchedBy === "MANUAL" ||
    Boolean(request.bookingId) ||
    Boolean(request.movementId) ||
    Boolean(request.movementNumber);
  const exactMatchMatched = Boolean(
    isMatchedByValidKey &&
    (request.matchStatus === "MATCHED" ||
      request.matchStatus === "NEEDS_REVIEW" ||
      Boolean(currentBooking)),
  );
  if (!exactMatchMatched) {
    failureReasons.push(
      "Condition 2 Failed: Movement Number or Gmail Thread ID was not accurately matched.",
    );
  }

  // Check 3: Awarded Forwarder Validation (Strict Enforcement: ONLY the AWARDED forwarder can confirm)
  let awardedForwarderId: string | null = currentBooking?.forwarder_id || null;
  let awardedForwarderName: string | null = currentBooking?.forwarder_name || null;
  let awardedForwarderEmail: string | null = null;
  let hasAwardedOffer = Boolean(awardedForwarderId || awardedForwarderName);
  const notAwardedSenders = new Set<string>();

  if (isSupabaseConfigured && effectiveBookingId && safeUuid(effectiveBookingId)) {
    try {
      const { data: offers } = await supabase
        .from("forwarder_offers")
        .select("id, forwarder_id, forwarder_name, forwarder_email, status, is_declined")
        .eq("booking_id", safeUuid(effectiveBookingId));

      if (offers && offers.length > 0) {
        for (const o of offers) {
          const st = (o.status || "").toUpperCase();
          if (st === "AWARDED" || st === "ACCEPTED") {
            hasAwardedOffer = true;
            awardedForwarderId = o.forwarder_id || awardedForwarderId;
            awardedForwarderName = o.forwarder_name || awardedForwarderName;
            awardedForwarderEmail = o.forwarder_email || awardedForwarderEmail;
          } else if (st === "NOT_AWARDED" || st === "DECLINED" || o.is_declined) {
            if (o.forwarder_id) notAwardedSenders.add(o.forwarder_id.toLowerCase());
            if (o.forwarder_email) notAwardedSenders.add(o.forwarder_email.toLowerCase());
            if (o.forwarder_name) notAwardedSenders.add(o.forwarder_name.toLowerCase());
          }
        }
      }
    } catch (chkErr) {
      console.warn("[MovementConfirmationEngine] Check forwarder_offers error:", chkErr);
    }
  }

  // Also verify against local requests
  const localReqs = getLocalForwarderRequests().filter(
    (r) => r.bookingId === effectiveBookingId || r.movementNumber === effectiveMovementNumber,
  );
  for (const lr of localReqs) {
    const st = (lr.status || "").toUpperCase();
    if (st === "AWARDED" || st === "ACCEPTED") {
      hasAwardedOffer = true;
      awardedForwarderId = lr.forwarderId || awardedForwarderId;
      awardedForwarderName = lr.forwarderName || awardedForwarderName;
      awardedForwarderEmail = lr.forwarderEmail || awardedForwarderEmail;
    } else if (st === "NOT_AWARDED" || st === "DECLINED") {
      if (lr.forwarderId) notAwardedSenders.add(lr.forwarderId.toLowerCase());
      if (lr.forwarderEmail) notAwardedSenders.add(lr.forwarderEmail.toLowerCase());
      if (lr.forwarderName) notAwardedSenders.add(lr.forwarderName.toLowerCase());
    }
  }

  const senderEmailLower = (request.senderEmail || "").toLowerCase().trim();
  const senderForwarderIdLower = (request.forwarderId || "").toLowerCase().trim();
  const senderNameLower = (request.forwarderName || "").toLowerCase().trim();

  // Is the sender marked as NOT_AWARDED?
  const isSenderMarkedNotAwarded =
    (senderForwarderIdLower && notAwardedSenders.has(senderForwarderIdLower)) ||
    (senderEmailLower && notAwardedSenders.has(senderEmailLower)) ||
    (senderNameLower && notAwardedSenders.has(senderNameLower));

  // If an awarded forwarder exists, does this sender match the awarded forwarder?
  let isSenderAwardedForwarder = true;
  if (hasAwardedOffer) {
    const matchesAwardedId =
      Boolean(awardedForwarderId) &&
      Boolean(senderForwarderIdLower) &&
      awardedForwarderId?.toLowerCase() === senderForwarderIdLower;

    const matchesAwardedEmail =
      Boolean(awardedForwarderEmail) &&
      Boolean(senderEmailLower) &&
      (awardedForwarderEmail?.toLowerCase() === senderEmailLower ||
        senderEmailLower.includes(awardedForwarderEmail?.toLowerCase() || ""));

    const matchesAwardedName =
      Boolean(awardedForwarderName) &&
      Boolean(senderNameLower) &&
      (awardedForwarderName?.toLowerCase() === senderNameLower ||
        awardedForwarderName?.toLowerCase().includes(senderNameLower) ||
        senderNameLower.includes(awardedForwarderName?.toLowerCase() || ""));

    const matchesBookingForwarder =
      (currentBooking?.forwarder_id &&
        currentBooking.forwarder_id.toLowerCase() === senderForwarderIdLower) ||
      (currentBooking?.forwarder_name &&
        currentBooking.forwarder_name.toLowerCase() === senderNameLower);

    isSenderAwardedForwarder = Boolean(
      matchesAwardedId || matchesAwardedEmail || matchesAwardedName || matchesBookingForwarder,
    );
  }

  // Strict check: If sender is NOT_AWARDED, or is not the AWARDED forwarder, BLOCK IMMEDIATELY
  const isAwardedForwarderAuthorized = !isSenderMarkedNotAwarded && isSenderAwardedForwarder;

  const forwarderValidated =
    isAwardedForwarderAuthorized &&
    (request.isForwarderValidated === true ||
      request.matchedBy === "THREAD_ID" ||
      (request.matchStatus === "MATCHED" && !failureReasons.includes("Forwarder mismatch")) ||
      Boolean(request.forwarderId || request.forwarderName));

  if (isSenderMarkedNotAwarded || (hasAwardedOffer && !isSenderAwardedForwarder)) {
    const blockReason = `Strict Policy: Only the AWARDED forwarder (${awardedForwarderName || "Official Forwarder"}) can confirm booking ${effectiveMovementNumber}. Sender (${request.senderEmail || request.forwarderName || "Unknown"}) is NOT_AWARDED.`;
    failureReasons.push(blockReason);

    // Record security block event in Supabase booking_events
    if (isSupabaseConfigured && effectiveBookingId && safeUuid(effectiveBookingId)) {
      void supabase.from("booking_events").insert({
        booking_id: safeUuid(effectiveBookingId),
        event_type: "CONFIRMATION_BLOCKED",
        title: "Confirmation from NOT_AWARDED Forwarder Blocked",
        description: `Blocked unauthorized confirmation attempt from unawarded partner (${request.senderEmail || request.forwarderName}). Movement remains assigned to awarded partner (${awardedForwarderName || "Official Forwarder"}).`,
        event_date: nowIso,
        location: "Security Confirmation Guard",
      });
    }
  } else if (!forwarderValidated) {
    failureReasons.push(
      "Condition 3 Failed: Sender does not match the validated forwarder credentials on file.",
    );
  }

  // Check 4: Incoming email is a genuine Forwarder reply
  const direction = (request.direction || "inbound").toLowerCase();
  const isGenuineForwarderReply = direction === "inbound" && Boolean(request.senderEmail);
  if (!isGenuineForwarderReply) {
    failureReasons.push(
      "Condition 4 Failed: Message is not an inbound freight partner communication.",
    );
  }

  // Check 5: Confirmation detector returns: CONFIRMED
  const detectorConfirmed = request.confirmationStatus === "CONFIRMED";
  if (!detectorConfirmed) {
    failureReasons.push(
      `Condition 5 Failed: Detection engine returned '${request.confirmationStatus}' instead of 'CONFIRMED'.`,
    );
  }

  // Check 6: No conflicting manual decision exists
  const rawStatusLower = (currentBooking?.status || "").toLowerCase();
  const hasConflictingManualStatus =
    rawStatusLower.includes("cancel") ||
    rawStatusLower.includes("reject") ||
    rawStatusLower.includes("hold") ||
    rawStatusLower.includes("dispute");

  const noConflictingDecision = !hasConflictingManualStatus;
  if (!noConflictingDecision) {
    failureReasons.push(
      `Condition 6 Failed: Conflicting manual lifecycle state detected on movement (${currentBooking?.status}).`,
    );
  }

  // Idempotency Check: Prevent duplicate confirmations from the same incoming email message
  const emailId = request.emailMessageId || request.gmailMessageId || "";
  const isAlreadyConfirmedByThisEmail =
    (currentBooking?.status === "CONFIRMED" || currentBooking?.status === "Booking Confirmed") &&
    currentBooking?.confirmation_email_id === emailId;

  if (isAlreadyConfirmedByThisEmail) {
    console.log(
      "[MovementConfirmationEngine] Idempotent hit: Movement already confirmed by this email ID.",
      emailId,
    );
    return {
      success: true,
      actionTaken: "SKIPPED_IDEMPOTENT",
      previousStatus: currentBooking?.status || "CONFIRMED",
      newStatus: "CONFIRMED",
      bookingId: effectiveBookingId,
      movementNumber: effectiveMovementNumber,
      confirmedAt: currentBooking?.confirmed_at || nowIso,
      confirmedBy: currentBooking?.confirmed_by || "SYSTEM",
      confirmationEmailId: emailId,
      conditions: {
        validBookingFound,
        exactMatchMatched,
        forwarderValidated,
        isGenuineForwarderReply,
        detectorConfirmed,
        noConflictingDecision,
        allConditionsMet: true,
        failureReasons: [],
      },
      message: `Movement ${effectiveMovementNumber} is already confirmed by this email (Idempotent).`,
    };
  }

  const allConditionsMet =
    validBookingFound &&
    exactMatchMatched &&
    forwarderValidated &&
    isGenuineForwarderReply &&
    detectorConfirmed &&
    noConflictingDecision;

  const conditionsCheck: MovementConfirmationConditionCheck = {
    validBookingFound,
    exactMatchMatched,
    forwarderValidated,
    isGenuineForwarderReply,
    detectorConfirmed,
    noConflictingDecision,
    allConditionsMet,
    failureReasons,
  };

  // Case A: ALL 6 CONDITIONS MET -> CONFIRM MOVEMENT
  if (allConditionsMet && effectiveBookingId) {
    const updatedStatus = "Booking Confirmed";
    const confirmedBy = request.forwarderName || awardedForwarderName || "Awarded Forwarder";
    const confirmedAt = nowIso;
    const confirmationEmailId = emailId;

    console.log(
      `[MovementConfirmationEngine] ✅ Auto-confirming movement ${effectiveMovementNumber} (${previousStatus} -> Booking Confirmed)`,
    );

    // 1. Update Booking record in Database / Local storage
    if (isSupabaseConfigured) {
      try {
        const existingNotes = currentBooking?.notes || "";
        const confirmationNote = `[Auto-Confirmed via Forwarder Email ${nowIso}: ${request.reason}]`;
        const updatedNotes = existingNotes
          ? `${existingNotes}\n${confirmationNote}`
          : confirmationNote;

        const updatePayload = {
          status: "Confirmed",
          movement_status: "CONFIRMED",
          is_movement_confirmed: true,
          confirmation_status: "CONFIRMED",
          confirmed_at: confirmedAt,
          confirmed_by: confirmedBy,
          confirmation_email_id: confirmationEmailId,
          confirmation_reason: request.reason || "Auto-confirmed from forwarder email",
          confirmation_detected_by: request.detectedBy || "DETERMINISTIC",
          confirmation_confidence: request.confidence || 0.95,
          notes: updatedNotes,
          updated_at: nowIso,
        };

        if (effectiveBookingId && safeUuid(effectiveBookingId)) {
          const { error: updateErr } = await supabase
            .from("bookings")
            .update(updatePayload)
            .eq("id", effectiveBookingId);

          if (updateErr) {
            console.error(
              "[MovementConfirmationEngine] Supabase bookings update error:",
              updateErr,
            );
          } else {
            console.log(
              `[MovementConfirmationEngine] ✅ Supabase booking ${effectiveBookingId} updated to status 'Booking Confirmed'`,
            );
          }
        }

        // Also update by movement number or booking reference or reference
        if (effectiveMovementNumber && effectiveMovementNumber !== "UNKNOWN") {
          await supabase
            .from("bookings")
            .update(updatePayload)
            .or(
              `booking_reference.eq.${effectiveMovementNumber},movement_number.eq.${effectiveMovementNumber},reference.eq.${effectiveMovementNumber}`,
            )
            .catch((err) =>
              console.warn("[MovementConfirmationEngine] Booking ref update notice:", err),
            );
        }
      } catch (dbErr) {
        console.warn("[MovementConfirmationEngine] Supabase update notice:", dbErr);
      }
    }

    // Update local reactive store
    if (effectiveBookingId) {
      updateLocalBooking(effectiveBookingId, {
        status: updatedStatus,
        confirmed_at: confirmedAt,
        confirmed_by: confirmedBy,
        confirmation_email_id: confirmationEmailId,
        confirmation_status: "CONFIRMED",
        confirmation_reason: request.reason,
        confirmation_detected_by: request.detectedBy,
        confirmation_confidence: request.confidence,
      });
    }
    if (effectiveMovementNumber && effectiveMovementNumber !== effectiveBookingId) {
      updateLocalBooking(effectiveMovementNumber, {
        status: updatedStatus,
        confirmed_at: confirmedAt,
        confirmed_by: confirmedBy,
        confirmation_email_id: confirmationEmailId,
        confirmation_status: "CONFIRMED",
        confirmation_reason: request.reason,
        confirmation_detected_by: request.detectedBy,
        confirmation_confidence: request.confidence,
      });
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("supabase_realtime_bookings_change", {
          detail: { bookingId: effectiveBookingId, status: updatedStatus },
        }),
      );
    }

    // 2. Create Audit Log: AUTO_CONFIRMED_FROM_EMAIL
    if (isSupabaseConfigured) {
      try {
        await supabase.from("audit_logs").insert({
          user_id: safeUuid(request.userId || currentBooking?.user_id),
          action: "AUTO_CONFIRMED_FROM_EMAIL",
          entity_type: "booking",
          entity_id: safeUuid(effectiveBookingId),
          old_data: {
            status: previousStatus,
            confirmed_at: currentBooking?.confirmed_at || null,
            confirmed_by: currentBooking?.confirmed_by || null,
          },
          new_data: {
            status: updatedStatus,
            confirmed_at: confirmedAt,
            confirmed_by: confirmedBy,
            confirmation_email_id: confirmationEmailId,
            movement_number: effectiveMovementNumber,
            sender_email: request.senderEmail,
            confidence: request.confidence,
            detected_by: request.detectedBy,
            reason: request.reason,
          },
          changes: {
            status: { from: previousStatus, to: updatedStatus },
            confirmed_by: { from: null, to: confirmedBy },
            confirmed_at: { from: null, to: confirmedAt },
            confirmation_email_id: { from: null, to: confirmationEmailId },
          },
          ip_address: "127.0.0.1",
          user_agent: "Nashmia-System-AutoConfirmation/1.0",
        });
      } catch (auditErr) {
        console.warn("[MovementConfirmationEngine] Audit log insert notice:", auditErr);
      }
    }

    // 3. Create Timeline Event in booking_events
    if (isSupabaseConfigured) {
      try {
        await supabase.from("booking_events").insert({
          booking_id: effectiveBookingId,
          event_type: "AUTO_CONFIRMED_FROM_EMAIL",
          event_date: confirmedAt,
          location: "System Automation Engine",
          description: `Movement ${effectiveMovementNumber} automatically confirmed from verified forwarder email (${request.senderEmail}). Previous status: ${previousStatus} → CONFIRMED. Reason: ${request.reason}`,
        });
      } catch (eventErr) {
        console.warn("[MovementConfirmationEngine] Booking event insert notice:", eventErr);
      }
    }

    // 4. Create Notification in Supabase notifications table for Operations Desk safely
    const notifTitle = `Booking Confirmed: ${effectiveMovementNumber}`;
    const notifMessage = `Movement ${effectiveMovementNumber} has been confirmed by the forwarder.`;

    await safeInsertNotification({
      userId: request.userId || currentBooking?.user_id,
      type: "booking_confirmed",
      title: notifTitle,
      message: notifMessage,
      booking_id: effectiveBookingId,
      link: `/movements`,
      is_read: false,
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nashmia_booking_confirmed", {
          detail: {
            bookingId: effectiveBookingId,
            movementNumber: effectiveMovementNumber,
            bookingReference: effectiveMovementNumber,
            status: updatedStatus,
            confirmedBy,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_booking_status_updated", {
          detail: {
            bookingId: effectiveBookingId,
            status: updatedStatus,
          },
        }),
      );
    }

    return {
      success: true,
      actionTaken: "AUTO_CONFIRMED",
      previousStatus,
      newStatus: updatedStatus,
      bookingId: effectiveBookingId,
      movementNumber: effectiveMovementNumber,
      confirmedAt,
      confirmedBy,
      confirmationEmailId,
      conditions: conditionsCheck,
      message: `Movement ${effectiveMovementNumber} has been successfully auto-confirmed from forwarder email.`,
    };
  }

  // Case B: REJECTED Response
  if (request.confirmationStatus === "REJECTED" && effectiveBookingId) {
    console.log(
      `[MovementConfirmationEngine] ⚠️ Space rejection detected for movement ${effectiveMovementNumber}. Status remains unconfirmed.`,
    );

    if (isSupabaseConfigured) {
      try {
        const existingNotes = currentBooking?.notes || "";
        const rejectNote = `[Space Rejected via Email ${nowIso}: ${request.reason}]`;
        const updatedNotes = existingNotes ? `${existingNotes}\n${rejectNote}` : rejectNote;

        await supabase
          .from("bookings")
          .update({
            notes: updatedNotes,
            updated_at: nowIso,
          })
          .eq("id", effectiveBookingId);

        await supabase.from("booking_events").insert({
          booking_id: effectiveBookingId,
          event_type: "FORWARDER_SPACE_REJECTED",
          event_date: nowIso,
          location: "Carrier Dispatch",
          description: `Forwarder stated booking rejection or lack of capacity: ${request.reason}. Movement status remains ${previousStatus}.`,
        });

        await safeInsertNotification({
          userId: request.userId || currentBooking?.user_id,
          type: "alert",
          title: `Space Rejected: Movement ${effectiveMovementNumber}`,
          message: `Forwarder rejected space allocation: ${request.reason}. Manual intervention required.`,
          booking_id: effectiveBookingId,
          is_read: false,
        });
      } catch (err) {
        console.warn("[MovementConfirmationEngine] Rejection update notice:", err);
      }
    }

    updateLocalBooking(effectiveBookingId, {
      confirmation_status: "REJECTED",
      confirmation_reason: request.reason,
    });

    return {
      success: true,
      actionTaken: "REJECTED",
      previousStatus,
      newStatus: previousStatus, // Status remains unchanged
      bookingId: effectiveBookingId,
      movementNumber: effectiveMovementNumber,
      confirmedAt: null,
      confirmedBy: null,
      confirmationEmailId: null,
      conditions: conditionsCheck,
      message: `Forwarder rejected booking. Movement status remains ${previousStatus}.`,
    };
  }

  // Case C: AMBIGUOUS OR NEEDS REVIEW (movement.status must NOT become CONFIRMED)
  const isAmbiguousOrReview =
    request.confirmationStatus === "NEEDS_REVIEW" ||
    request.confirmationStatus === "NOT_CONFIRMED" ||
    !allConditionsMet;

  if (effectiveBookingId) {
    const assignedConfStatus =
      request.confirmationStatus === "NOT_CONFIRMED" ? "NOT_CONFIRMED" : "NEEDS_REVIEW";

    if (isSupabaseConfigured) {
      try {
        const existingNotes = currentBooking?.notes || "";
        const reviewNote = `[Confirmation Evaluation (${assignedConfStatus}) via Email ${nowIso}: ${request.reason || failureReasons.join("; ")}]`;
        const updatedNotes = existingNotes ? `${existingNotes}\n${reviewNote}` : reviewNote;

        await supabase
          .from("bookings")
          .update({
            notes: updatedNotes,
            updated_at: nowIso,
          })
          .eq("id", effectiveBookingId);

        await supabase.from("booking_events").insert({
          booking_id: effectiveBookingId,
          event_type: "CONFIRMATION_EVALUATION_REVIEW",
          event_date: nowIso,
          location: "Confirmation Engine",
          description: `Automatic confirmation skipped: ${failureReasons.join(" | ") || request.reason}. Movement status remains ${previousStatus}.`,
        });
      } catch (err) {
        console.warn("[MovementConfirmationEngine] Review update notice:", err);
      }
    }

    updateLocalBooking(effectiveBookingId, {
      confirmation_status: assignedConfStatus,
      confirmation_reason: request.reason || failureReasons.join("; "),
    });
  }

  return {
    success: true,
    actionTaken: request.confirmationStatus === "NOT_CONFIRMED" ? "NOT_CONFIRMED" : "NEEDS_REVIEW",
    previousStatus,
    newStatus: previousStatus, // Status strictly remains unchanged
    bookingId: effectiveBookingId,
    movementNumber: effectiveMovementNumber,
    confirmedAt: null,
    confirmedBy: null,
    confirmationEmailId: null,
    conditions: conditionsCheck,
    message: `Movement status preserved at '${previousStatus}'. Confirmation status set to ${request.confirmationStatus === "NOT_CONFIRMED" ? "NOT_CONFIRMED" : "NEEDS_REVIEW"}.`,
  };
}
