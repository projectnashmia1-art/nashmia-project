import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid } from "./supabase-services";
import type { ExtractedForwarderOffer, OfferValidationResult } from "./ai-offer-extractor";
import type { ForwarderResponseClassification } from "@/types/requests";
import { isSameForwarderIdentity, isSameMovementReference } from "./forwarder-card-service";
import {
  getLocalForwarderRequests,
  saveLocalForwarderRequests,
  type ForwarderQuoteRequestRecord,
  type ForwarderOfferData,
  type ForwarderQuoteStatus,
} from "./multi-forwarder-service";

export interface SaveForwarderOfferParams {
  bookingId?: string | null;
  movementNumber?: string | null;
  forwarderId?: string | null;
  forwarderName?: string | null;
  forwarderEmail?: string | null;
  emailMessageId?: string | null;
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  offerValidation: OfferValidationResult;
  containerCount?: number;
  userId?: string | null;
}

export interface SaveForwarderOfferResult {
  success: boolean;
  offerId: string | null;
  status: ForwarderResponseClassification;
  ratePerContainer?: number;
  totalFreight?: number;
  currency: string;
  summary: string;
  savedToDatabase: boolean;
  savedToStorage: boolean;
  error?: string;
}

/**
 * Persists an AI-extracted & validated forwarder offer to:
 * 1. Supabase `forwarder_offers` table (durable cloud storage)
 * 2. Supabase `email_messages.raw_headers` (with offer metadata)
 * 3. Supabase `booking_events` (immutable timeline audit)
 * 4. MultiForwarder desk quote records (localStorage & state)
 * 5. Dispatches `nashmia_forwarder_offer_received` & `nashmia_multi_forwarder_updated`
 */
export async function saveExtractedForwarderOffer(
  params: SaveForwarderOfferParams,
): Promise<SaveForwarderOfferResult> {
  const {
    bookingId,
    movementNumber,
    forwarderId,
    forwarderName,
    forwarderEmail,
    emailMessageId,
    gmailThreadId,
    gmailMessageId,
    offerValidation,
    containerCount = 1,
  } = params;

  const { validatedOffer, normalizedStatus } = offerValidation;
  const nowIso = new Date().toISOString();
  let savedOfferId: string | null = null;
  let savedToDatabase = false;

  const validBookingUuid = safeUuid(bookingId);
  const validForwarderUuid = safeUuid(forwarderId);

  const rate = validatedOffer.ratePerContainer;
  const totalFreight = validatedOffer.totalFreight || (rate ? rate * containerCount : undefined);

  // 1. Save to Supabase `forwarder_offers` table
  if (isSupabaseConfigured) {
    try {
      const offerRecord = {
        booking_id: validBookingUuid,
        movement_number: movementNumber || null,
        forwarder_id: validForwarderUuid,
        forwarder_name: forwarderName || "Forwarder",
        forwarder_email: forwarderEmail || null,
        email_message_id: emailMessageId || null,
        gmail_thread_id: gmailThreadId || null,
        gmail_message_id: gmailMessageId || null,
        rate_per_container: rate || null,
        total_freight: totalFreight || null,
        currency: validatedOffer.currency || "USD",
        container_size: validatedOffer.containerSize || "40HC",
        container_count: containerCount,
        space_available: validatedOffer.spaceAvailable,
        is_declined: validatedOffer.isDeclined,
        is_confirmed: validatedOffer.isConfirmed,
        status: normalizedStatus,
        etd: validatedOffer.etd || null,
        eta: validatedOffer.eta || null,
        transit_days: validatedOffer.transitDays || null,
        free_days: validatedOffer.freeDays || 14,
        carrier: validatedOffer.carrier || null,
        vessel_name: validatedOffer.vesselName || null,
        voyage_number: validatedOffer.voyageNumber || null,
        valid_until: validatedOffer.validUntil || null,
        notes: validatedOffer.notes || null,
        summary: validatedOffer.summary,
        confidence: validatedOffer.confidence,
        extraction_method: validatedOffer.extractionMethod,
        raw_extracted_json: {
          ...(validatedOffer.rawJson || {}),
          structuredFields: offerValidation.structuredFields,
          extractionSummary: offerValidation.extractionSummary,
        },
        received_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      };

      const { data: insertedOffer, error: insErr } = await supabase
        .from("forwarder_offers")
        .insert(offerRecord)
        .select("id")
        .maybeSingle();

      if (!insErr && insertedOffer) {
        savedOfferId = insertedOffer.id;
        savedToDatabase = true;
        console.log(
          `[ForwarderOfferStorage] ✅ Saved offer to forwarder_offers (id: ${savedOfferId}, status: ${normalizedStatus})`,
        );
      } else if (insErr) {
        console.warn(
          "[ForwarderOfferStorage] Notice inserting into forwarder_offers:",
          insErr.message,
        );
      }
    } catch (dbErr) {
      console.warn("[ForwarderOfferStorage] Supabase forwarder_offers error:", dbErr);
    }

    // 2. Update `email_messages` with extracted offer metadata
    if (emailMessageId) {
      try {
        const { data: existingMsg } = await supabase
          .from("email_messages")
          .select("raw_headers")
          .eq("id", emailMessageId)
          .maybeSingle();

        const currentHeaders = (existingMsg?.raw_headers as Record<string, unknown>) || {};
        const updatedHeaders = {
          ...currentHeaders,
          offer_extracted: true,
          offer_status: normalizedStatus,
          extracted_offer: {
            ratePerContainer: rate,
            totalFreight,
            currency: validatedOffer.currency,
            carrier: validatedOffer.carrier,
            spaceAvailable: validatedOffer.spaceAvailable,
            isDeclined: validatedOffer.isDeclined,
            etd: validatedOffer.etd,
            eta: validatedOffer.eta,
            transitDays: validatedOffer.transitDays,
            summary: validatedOffer.summary,
            confidence: validatedOffer.confidence,
            method: validatedOffer.extractionMethod,
          },
        };

        await supabase
          .from("email_messages")
          .update({ raw_headers: updatedHeaders })
          .eq("id", emailMessageId);
      } catch (headerErr) {
        console.warn("[ForwarderOfferStorage] Notice updating email_messages headers:", headerErr);
      }
    }

    // 3. Create timeline audit in `booking_events`
    if (validBookingUuid) {
      try {
        let eventType = "Quotation Received";
        let title = `Forwarder Offer from ${forwarderName || "Carrier"}`;
        let description = validatedOffer.summary;

        if (normalizedStatus === "DECLINED") {
          eventType = "Forwarder Space Rejection";
          title = `${forwarderName || "Forwarder"} Declined / No Space`;
          description = `Forwarder notified that no vessel space is available for ${movementNumber || "this booking"}.`;
        } else if (rate) {
          title = `Quotation Received from ${forwarderName || "Carrier"}`;
          description = `Rate: $${rate.toLocaleString()} ${validatedOffer.currency}/container${
            totalFreight ? ` (Total: $${totalFreight.toLocaleString()})` : ""
          }${validatedOffer.carrier ? ` via ${validatedOffer.carrier}` : ""}${
            validatedOffer.transitDays ? ` · ${validatedOffer.transitDays}d transit` : ""
          }. Extracted via ${validatedOffer.extractionMethod}.`;
        }

        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: eventType,
          title,
          description,
          occurred_at: nowIso,
          location: "AI Email Reader",
          payload: {
            rate_per_container: rate,
            total_freight: totalFreight,
            currency: validatedOffer.currency,
            status: normalizedStatus,
            extraction_method: validatedOffer.extractionMethod,
            confidence: validatedOffer.confidence,
          },
        });
      } catch (evtErr) {
        console.warn("[ForwarderOfferStorage] Notice inserting booking event:", evtErr);
      }
    }
  }

  // 4. Update multi-forwarder desk requests in storage (localStorage + state)
  let savedToStorage = false;
  try {
    const list = getLocalForwarderRequests();
    let targetIdx = -1;

    // Match by Gmail Thread ID, Message ID, or Movement + Forwarder
    if (gmailThreadId) {
      targetIdx = list.findIndex((r) => r.gmailThreadId === gmailThreadId);
    }
    if (targetIdx === -1 && gmailMessageId) {
      targetIdx = list.findIndex((r) => r.gmailMessageId === gmailMessageId);
    }
    if (
      targetIdx === -1 &&
      (movementNumber || bookingId) &&
      (forwarderName || forwarderEmail || forwarderId)
    ) {
      targetIdx = list.findIndex((r) => {
        const sameFwd = isSameForwarderIdentity(
          r.forwarderName,
          r.forwarderEmail,
          r.forwarderId,
          forwarderName,
          forwarderEmail,
          forwarderId,
        );
        if (!sameFwd) return false;

        return isSameMovementReference(
          { movementNumber: r.movementNumber, bookingId: r.bookingId },
          { movementNumber, bookingId },
        );
      });
    }

    if (targetIdx !== -1) {
      const matchedReq = list[targetIdx];
      let newReqStatus: ForwarderQuoteStatus = matchedReq.status;

      if (normalizedStatus === "DECLINED") {
        newReqStatus = "DECLINED";
      } else if (normalizedStatus === "NOT_AVAILABLE") {
        newReqStatus = "NOT_AVAILABLE";
      } else if (normalizedStatus === "CONFIRMED") {
        newReqStatus = "CONFIRMED";
      } else if (normalizedStatus === "OFFER_RECEIVED") {
        newReqStatus = "OFFER_RECEIVED";
      } else if (normalizedStatus === "AVAILABLE") {
        newReqStatus = "AVAILABLE";
      } else if (normalizedStatus === "NEEDS_REVIEW") {
        newReqStatus = "NEEDS_REVIEW";
      }

      const offerData: ForwarderOfferData = {
        ratePerContainer: rate ?? matchedReq.offerData?.ratePerContainer,
        totalFreight:
          totalFreight ??
          (rate && matchedReq.containerCount
            ? rate * matchedReq.containerCount
            : matchedReq.offerData?.totalFreight),
        carrier: validatedOffer.carrier || matchedReq.offerData?.carrier,
        transitDays: validatedOffer.transitDays ?? matchedReq.offerData?.transitDays,
        freeDays: validatedOffer.freeDays ?? matchedReq.offerData?.freeDays,
        currency: validatedOffer.currency || matchedReq.offerData?.currency || "USD",
        receivedAt: nowIso,
        sourceEmailId: gmailMessageId || emailMessageId || undefined,
        receivedVia:
          validatedOffer.extractionMethod === "GEMINI_AI"
            ? "AI Email Reader (Gemini)"
            : "Email Reply",
        notes: validatedOffer.summary,
      };

      const updatedRecord: ForwarderQuoteRequestRecord = {
        ...matchedReq,
        status: newReqStatus,
        offerData,
        updatedAt: nowIso,
      };

      list[targetIdx] = updatedRecord;
      saveLocalForwarderRequests(list);
      savedToStorage = true;

      // Dispatch UI update events
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nashmia_forwarder_offer_received", {
            detail: {
              requestId: updatedRecord.id,
              bookingId: updatedRecord.bookingId,
              movementNumber: updatedRecord.movementNumber,
              forwarderId: updatedRecord.forwarderId,
              forwarderName: updatedRecord.forwarderName,
              offer: offerData,
              status: newReqStatus,
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("nashmia_multi_forwarder_updated", {
            detail: { updatedRequestId: updatedRecord.id, bookingId: updatedRecord.bookingId },
          }),
        );
      }
    }
  } catch (storageErr) {
    console.warn("[ForwarderOfferStorage] Storage update notice:", storageErr);
  }

  return {
    success: true,
    offerId: savedOfferId,
    status: normalizedStatus,
    ratePerContainer: rate,
    totalFreight,
    currency: validatedOffer.currency || "USD",
    summary: validatedOffer.summary,
    savedToDatabase,
    savedToStorage,
  };
}
