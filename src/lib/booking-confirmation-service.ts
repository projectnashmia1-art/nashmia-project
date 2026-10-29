import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { safeUuid } from "@/lib/supabase-services";
import { sendEmailThroughBackend } from "@/lib/email-services";
import { fetchForwarderRequestsFromDatabase } from "@/lib/quotation-database-service";
import { toDbBookingStatus, toDbMovementStatus } from "@/lib/movement-lifecycle";
import { createLogisticsNotification } from "@/lib/notification-service";
import type { BookingRequestRecord, ForwarderQuoteRequestRecord } from "@/types/requests";

export interface ConfirmBookingInput {
  bookingId: string;
  movementNumber: string;
  forwarderId: string;
  forwarderName: string;
  forwarderEmail: string;
  finalRate: number;
  currency: string;
  etd: string;
  eta: string;
  pickupDate: string;
  pickupAddress: string;
  polName: string;
  polCode?: string;
  podName: string;
  podCode?: string;
  shippingLine: string;
  vesselName?: string;
  voyageNumber?: string;
  containerCount: number;
  containerSize: string;
  containerType: string;
  containerNumbers?: string[];
  specialInstructions?: string;
  sendConfirmationEmail: boolean;
  userId?: string | null;
  quotationId?: string | null;
  forwarderRequestId?: string | null;
}

export interface ConfirmBookingResult {
  success: boolean;
  bookingId: string;
  movementNumber: string;
  emailStatus: "SENT" | "SKIPPED" | "FAILED";
  emailMessageId?: string;
  emailError?: string;
  updatedBooking: Record<string, unknown>;
}

/**
 * Validates and safely executes the complete Booking Confirmation and Movement Update workflow
 * directly into Supabase without creating duplicate bookings or movement numbers.
 */
export async function confirmBookingAndMovementInDatabase(
  input: ConfirmBookingInput,
): Promise<ConfirmBookingResult> {
  const {
    bookingId,
    movementNumber,
    forwarderId,
    forwarderName,
    forwarderEmail,
    finalRate,
    currency = "USD",
    etd,
    eta,
    pickupDate,
    pickupAddress,
    polName,
    podName,
    shippingLine,
    vesselName,
    voyageNumber,
    containerCount = 1,
    containerSize = "40HC",
    containerType = "Standard Dry",
    specialInstructions = "",
    sendConfirmationEmail = true,
    userId,
    quotationId,
    forwarderRequestId,
  } = input;

  // 1. Strict Validation
  if (!bookingId) {
    throw new Error("Missing required Booking ID for confirmation.");
  }
  if (!forwarderId && !forwarderName) {
    throw new Error("Please select a forwarder for booking confirmation.");
  }
  if (typeof finalRate !== "number" || isNaN(finalRate) || finalRate <= 0) {
    throw new Error("Please enter a valid final freight rate greater than zero.");
  }

  const nowIso = new Date().toISOString();
  const totalFreight = finalRate * (containerCount > 0 ? containerCount : 1);

  // 2. Fetch existing booking from Supabase to preserve existing JSON metadata
  let existingBooking: Record<string, unknown> | null = null;
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .maybeSingle();

      if (!error && data) {
        existingBooking = data as Record<string, unknown>;
      }
    } catch (err) {
      console.warn("[ConfirmBookingService] Notice fetching existing booking:", err);
    }
  }

  const existingConf = (existingBooking?.confirmation_details as Record<string, unknown>) || {};

  // Safely resolve valid forwarder UUID to avoid PostgreSQL 22P02 invalid input syntax for type uuid
  let validForwarderUuid =
    safeUuid(forwarderId) || safeUuid(existingBooking?.forwarder_id as string);
  if (!validForwarderUuid && forwarderName && isSupabaseConfigured) {
    try {
      const { data: fwdRow } = await supabase
        .from("forwarders")
        .select("id")
        .or(`company_name.ilike.%${forwarderName}%,name.ilike.%${forwarderName}%`)
        .limit(1)
        .maybeSingle();
      if (fwdRow?.id) {
        validForwarderUuid = safeUuid(fwdRow.id);
      }
    } catch {
      // non-blocking
    }
  }

  // Build comprehensive confirmation_details payload
  const confirmationDetailsPayload = {
    ...existingConf,
    confirmed_forwarder_id: validForwarderUuid || forwarderId || null,
    confirmed_forwarder_name: forwarderName,
    confirmed_forwarder_email: forwarderEmail,
    forwarder_name: forwarderName,
    forwarderName: forwarderName,
    agreed_rate: finalRate,
    currency,
    total_freight: totalFreight,
    etd,
    eta,
    pickup_date: pickupDate,
    pickup_address: pickupAddress,
    pol_name: polName,
    pod_name: podName,
    shipping_line: shippingLine,
    carrier: shippingLine,
    vessel_name: vesselName || null,
    voyage_number: voyageNumber || null,
    container_count: containerCount,
    container_size: containerSize,
    container_type: containerType,
    special_instructions: specialInstructions,
    confirmed_at: nowIso,
    confirmed_by: userId || "Operations Desk",
    quotation_id: quotationId || null,
    forwarder_request_id: forwarderRequestId || null,
    email_send_requested: sendConfirmationEmail,
    email_status: sendConfirmationEmail ? "PENDING" : "SKIPPED",
  };

  const bookingUpdateData = {
    status: toDbBookingStatus("Confirmed"), // Exactly "Confirmed" - satisfies PostgreSQL check constraint bookings_status_check
    movement_status: toDbMovementStatus("Confirmed"), // Exactly "CONFIRMED"
    is_movement_confirmed: true,
    confirmation_status: "CONFIRMED",
    forwarder_id: validForwarderUuid || null,
    rate_amount: finalRate,
    total_freight: totalFreight,
    currency,
    etd: etd || existingBooking?.etd || null,
    eta: eta || existingBooking?.eta || null,
    loading_date: pickupDate || existingBooking?.loading_date || null,
    pol_name: polName || existingBooking?.pol_name || null,
    pod_name: podName || existingBooking?.pod_name || null,
    vessel_name: vesselName || shippingLine || existingBooking?.vessel_name || null,
    voyage_number: voyageNumber || existingBooking?.voyage_number || null,
    container_count: containerCount,
    container_size: containerSize,
    container_type: containerType,
    special_instructions: specialInstructions || existingBooking?.special_instructions || null,
    confirmed_at: nowIso,
    confirmed_by: userId || "Operations Desk",
    confirmation_details: confirmationDetailsPayload,
    updated_at: nowIso,
  };

  // 3. Update Existing Booking Record in Supabase
  let updatedBookingRecord: Record<string, unknown> = {
    ...existingBooking,
    ...bookingUpdateData,
    id: bookingId,
    movement_number: movementNumber || existingBooking?.movement_number,
    forwarder_name: forwarderName,
    forwarderName: forwarderName,
    forwarder: { name: forwarderName, company_name: forwarderName },
    awardedForwarderName: forwarderName,
    confirmation_details: confirmationDetailsPayload,
  };

  if (isSupabaseConfigured) {
    const { data: updatedData, error: updateErr } = await supabase
      .from("bookings")
      .update(bookingUpdateData)
      .eq("id", bookingId)
      .select()
      .maybeSingle();

    if (updateErr) {
      console.error("[ConfirmBookingService] Error updating booking in Supabase:", updateErr);
      throw new Error(`Failed to update booking in database: ${updateErr.message}`);
    }

    if (updatedData) {
      updatedBookingRecord = updatedData as Record<string, unknown>;
    }
  }

  // 4. Update Forwarder Requests & Competing Quotations
  if (isSupabaseConfigured) {
    try {
      // Update the winning forwarder request to AWARDED and CONFIRMED
      const safeFwdReqId = safeUuid(forwarderRequestId);
      const safeQuotId = safeUuid(quotationId);
      const safeBookingId = safeUuid(bookingId);

      if (safeFwdReqId) {
        await supabase
          .from("forwarder_requests")
          .update({
            award_status: "AWARDED",
            status: "CONFIRMED",
            updated_at: nowIso,
          })
          .eq("id", safeFwdReqId);
      } else if (safeBookingId && validForwarderUuid) {
        await supabase
          .from("forwarder_requests")
          .update({
            award_status: "AWARDED",
            status: "CONFIRMED",
            updated_at: nowIso,
          })
          .eq("booking_id", safeBookingId)
          .eq("forwarder_id", validForwarderUuid);
      }

      // Update Quotation if exists
      if (safeQuotId) {
        await supabase
          .from("quotations")
          .update({
            quotation_status: "AWARDED",
            rate: finalRate,
            quoted_total: totalFreight,
            currency,
            updated_at: nowIso,
          })
          .eq("id", safeQuotId);
      } else if (safeFwdReqId) {
        await supabase
          .from("quotations")
          .update({
            quotation_status: "AWARDED",
            rate: finalRate,
            quoted_total: totalFreight,
            currency,
            updated_at: nowIso,
          })
          .eq("forwarder_request_id", safeFwdReqId);
      }
    } catch (fwdErr) {
      console.warn(
        "[ConfirmBookingService] Notice updating forwarder_requests/quotations:",
        fwdErr,
      );
    }
  }

  // 5. Create Audit Event in booking_events
  if (isSupabaseConfigured) {
    try {
      await supabase.from("booking_events").insert({
        booking_id: bookingId,
        event_type: "Booking Confirmed",
        event_date: nowIso,
        location: polName || "Port of Loading",
        title: `Booking & Movement Confirmed (${movementNumber})`,
        description: `Booking confirmed with forwarder ${forwarderName} at agreed rate ${currency} ${finalRate.toLocaleString()} / container (Total: ${currency} ${totalFreight.toLocaleString()}). Vessel: ${vesselName || shippingLine || "Direct Line"}, ETD: ${etd || "Prompt"}, ETA: ${eta || "Scheduled"}. Pickup Date: ${pickupDate || "As agreed"}, Address: ${pickupAddress || "Not specified"}.`,
        payload: {
          forwarderId,
          forwarderName,
          forwarderEmail,
          finalRate,
          currency,
          totalFreight,
          etd,
          eta,
          pickupDate,
          pickupAddress,
          shippingLine,
          vesselName,
          voyageNumber,
          containerCount,
          containerSize,
          containerType,
          confirmedAt: nowIso,
          confirmedBy: userId || "Operations Desk",
        },
      });
    } catch (eventErr) {
      console.warn("[ConfirmBookingService] Notice creating booking_event:", eventErr);
    }
  }

  // 6. Send Confirmation Email to Forwarder (if requested)
  let emailStatus: "SENT" | "SKIPPED" | "FAILED" = "SKIPPED";
  let emailMessageId: string | undefined = undefined;
  let emailError: string | undefined = undefined;

  if (sendConfirmationEmail && forwarderEmail && forwarderEmail.includes("@")) {
    try {
      const emailSubject = `Booking Confirmation - Movement ${movementNumber} | ${forwarderName}`;
      const emailBody = `Dear ${forwarderName} Team,

We are pleased to formally confirm Booking and Movement ${movementNumber} with your company as our freight forwarding partner.

Confirmed Commercial & Operational Details:
--------------------------------------------------
• Movement Number: ${movementNumber}
• Forwarder: ${forwarderName}
• Agreed Freight Rate: $${finalRate.toLocaleString()} ${currency} / container
• Total Agreed Freight: $${totalFreight.toLocaleString()} ${currency}
• Route: ${polName} (${input.polCode || "POL"}) → ${podName} (${input.podCode || "POD"})
• Equipment: ${containerCount}x ${containerSize} (${containerType})
• Shipping Line / Carrier: ${shippingLine || "Direct Carrier"}
• Vessel / Voyage: ${vesselName || "TBN"} / ${voyageNumber || "TBN"}
• Estimated Departure (ETD): ${etd || "As scheduled"}
• Estimated Arrival (ETA): ${eta || "As scheduled"}
• Cargo Pickup Date: ${pickupDate || "As scheduled"}
• Pickup Address / Facility: ${pickupAddress || "Standard designated loading facility"}

Special Booking Instructions:
${specialInstructions ? specialInstructions : "Please proceed with equipment release and booking placement. Advise container yard gate opening and cut-off schedule upon confirmation."}

Please acknowledge receipt of this confirmation and issue the official Booking Note / Shipping Instructions at your earliest convenience.

Best regards,
Operations Department
Nashmia Logistics Management`;

      const sendResult = await sendEmailThroughBackend({
        userId,
        toEmail: forwarderEmail,
        toName: forwarderName,
        subject: emailSubject,
        body: emailBody,
        bookingId,
        movementNumber,
        forwarderId,
        emailType: "booking_confirmation",
      });

      if (sendResult.success) {
        emailStatus = "SENT";
        emailMessageId = sendResult.messageId || sendResult.gmailMessageId;
      } else {
        emailStatus = "FAILED";
        emailError = sendResult.errorMessage || "Email transmission could not be completed.";
      }
    } catch (err: unknown) {
      emailStatus = "FAILED";
      emailError = err instanceof Error ? err.message : String(err);
      console.warn("[ConfirmBookingService] Email sending error:", err);
    }

    // Update confirmation_details with final email status
    if (isSupabaseConfigured) {
      try {
        await supabase
          .from("bookings")
          .update({
            confirmation_details: {
              ...confirmationDetailsPayload,
              email_status: emailStatus,
              email_message_id: emailMessageId || null,
              email_error: emailError || null,
            },
          })
          .eq("id", bookingId);
      } catch {
        // non-blocking
      }
    }
  }

  // 7. Synchronize local storage backups for offline and instant resilience
  if (typeof window !== "undefined") {
    try {
      const rawCustom = localStorage.getItem("nashmia_custom_bookings_v1");
      if (rawCustom) {
        const parsed = JSON.parse(rawCustom);
        if (Array.isArray(parsed)) {
          const updated = parsed.map((b) =>
            b.id === bookingId || b.movement_number === movementNumber
              ? { ...b, ...bookingUpdateData }
              : b,
          );
          localStorage.setItem("nashmia_custom_bookings_v1", JSON.stringify(updated));
        }
      }

      // Also update forwarder requests in local storage
      const rawFwd = localStorage.getItem("nashmia_forwarder_requests_v1");
      if (rawFwd) {
        const parsedFwd = JSON.parse(rawFwd);
        if (Array.isArray(parsedFwd)) {
          const updatedFwd = parsedFwd.map((r) => {
            if (
              r.id === forwarderRequestId ||
              (r.bookingId === bookingId && r.forwarderId === forwarderId)
            ) {
              return { ...r, awardStatus: "AWARDED", status: "CONFIRMED" };
            }
            return r;
          });
          localStorage.setItem("nashmia_forwarder_requests_v1", JSON.stringify(updatedFwd));
        }
      }
    } catch (storageErr) {
      console.warn("[ConfirmBookingService] Notice updating localStorage:", storageErr);
    }

    // 8. Persist Real-Time Logistics Notification to Supabase & Trigger Event
    void createLogisticsNotification({
      eventType: "BOOKING_CONFIRMED",
      movementNumber,
      bookingReference: movementNumber,
      bookingId,
      forwarderName,
      rateText: `$${finalRate.toLocaleString()} ${currency}`,
      userId,
      linkUrl: `/movements?ref=${encodeURIComponent(movementNumber)}&openDrawer=true`,
    });

    // 9. Dispatch Real-time Window Events for Instant UI Reactivity
    try {
      window.dispatchEvent(
        new CustomEvent("nashmia_movement_confirmed", {
          detail: {
            bookingId,
            movementNumber,
            forwarderId,
            forwarderName,
            updatedBooking: updatedBookingRecord,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_booking_confirmed", {
          detail: {
            bookingId,
            movementNumber,
            status: "Booking Confirmed",
            forwarderName,
            updatedBooking: updatedBookingRecord,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_bookings_updated", {
          detail: {
            updated: true,
            id: bookingId,
            movementNumber,
            booking: updatedBookingRecord,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("supabase_realtime_bookings_change", {
          detail: {
            updated: true,
            id: bookingId,
            movementNumber,
            booking: updatedBookingRecord,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_multi_forwarder_updated", {
          detail: {
            bookingId,
            movementNumber,
            updatedRequestId: forwarderRequestId,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_request_status_updated", {
          detail: {
            bookingId,
            movementNumber,
            status: "Confirmed",
          },
        }),
      );
    } catch (evtErr) {
      console.warn("[ConfirmBookingService] Notice dispatching events:", evtErr);
    }
  }

  // 9. Sync backend server if running
  try {
    fetch("/api/bookings")
      .then(() => {})
      .catch(() => {});
  } catch {
    // non-blocking
  }

  return {
    success: true,
    bookingId,
    movementNumber,
    emailStatus,
    emailMessageId,
    emailError,
    updatedBooking: updatedBookingRecord,
  };
}
