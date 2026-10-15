/**
 * NASHMIA GLOBAL OPERATIONS HUB - QUOTATION & INCOMING EMAIL REST API ROUTER
 *
 * Implements the 10 core endpoints using existing API style, CORS, and authentication:
 *
 * 1.  GET  /api/bookings/:bookingId/quotations
 * 2.  GET  /api/quotations/:quotationId
 * 3.  POST /api/quotations/:quotationId/confirm
 * 4.  POST /api/quotations/:quotationId/reject
 * 5.  POST /api/quotations/:quotationId/mark-duplicate
 * 6.  POST /api/quotations/:quotationId/reprocess
 * 7.  POST /api/incoming-emails/:emailId/process
 * 8.  GET  /api/incoming-emails/unmatched
 * 9.  GET  /api/incoming-emails/needs-review
 * 10. POST /api/incoming-emails/:emailId/link-booking
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid, getLocalBookings, updateLocalBooking } from "./supabase-services";
import {
  processForwarderQuotationEmail,
  validateExtractedQuotation,
  type ProcessForwarderQuotationEmailInput,
  type DeterministicQuotationFields,
} from "./forwarder-quotation-processor";
import {
  persistIncomingEmailRecord,
  persistQuotationRecord,
  persistQuotationCharges,
  inMemoryQuotations,
  inMemoryIncomingEmails,
  setInMemoryQuotation,
  setInMemoryIncomingEmail,
  type IncomingEmailRecord,
  type QuotationRecord,
  type QuotationChargeRecord,
} from "./quotation-schema-persistence";
import { getLocalForwarderRequests, saveLocalForwarderRequests } from "./multi-forwarder-service";
import { recordQuotationAuditEvent } from "./quotation-audit-logger";
import type { ForwarderQuoteRequestRecord, ForwarderOfferData } from "@/types/requests";

export {
  inMemoryQuotations,
  inMemoryIncomingEmails,
  setInMemoryQuotation,
  setInMemoryIncomingEmail,
};

export const apiCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 500, extra?: Record<string, unknown>): Response {
  return jsonResponse({ success: false, error: message, ...(extra || {}) }, status);
}

/**
 * Main router function for Quotations and Incoming Emails API
 * Returns Response if handled, or null if the URL does not match these routes.
 */
export async function handleQuotationsApiRequest(
  request: Request,
  url: URL,
): Promise<Response | null> {
  const method = request.method.toUpperCase();
  const pathname = url.pathname;

  // Caller Context & RBAC
  const userRole = (request.headers.get("x-user-role") || "operator").toLowerCase().trim();
  const callerForwarderId = request.headers.get("x-forwarder-id")?.trim();

  // Handle OPTIONS for any matching route
  if (
    method === "OPTIONS" &&
    (pathname.startsWith("/api/quotations") ||
      pathname.startsWith("/api/incoming-emails") ||
      (pathname.startsWith("/api/bookings/") && pathname.endsWith("/quotations")))
  ) {
    return new Response(null, { status: 204, headers: apiCorsHeaders });
  }

  // --------------------------------------------------------------------------
  // 1. GET /api/bookings/:bookingId/quotations
  // --------------------------------------------------------------------------
  const bookingsQuotationsMatch = pathname.match(/^\/api\/bookings\/([^/]+)\/quotations\/?$/);
  if (bookingsQuotationsMatch && method === "GET") {
    try {
      const rawBookingId = decodeURIComponent(bookingsQuotationsMatch[1]).trim();
      const validUuid = safeUuid(rawBookingId);

      let quotations: Array<Record<string, unknown>> = [];

      if (isSupabaseConfigured) {
        // Resolve booking UUID if rawBookingId is movement number or reference
        let bookingUuid = validUuid;
        let movementNumber = rawBookingId;

        if (!bookingUuid) {
          const { data: bData } = await supabase
            .from("bookings")
            .select("id, movement_number")
            .or(`movement_number.eq.${rawBookingId},booking_reference.eq.${rawBookingId}`)
            .limit(1)
            .maybeSingle();

          if (bData) {
            bookingUuid = bData.id;
            movementNumber = bData.movement_number || movementNumber;
          }
        }

        let query = supabase.from("quotations").select("*");
        if (bookingUuid && movementNumber && movementNumber !== bookingUuid) {
          query = query.or(`booking_id.eq.${bookingUuid},movement_number.eq.${movementNumber}`);
        } else if (bookingUuid) {
          query = query.eq("booking_id", bookingUuid);
        } else {
          query = query.eq("movement_number", rawBookingId);
        }

        const { data: qData, error: qErr } = await query.order("created_at", { ascending: false });

        if (!qErr && qData && qData.length > 0) {
          const quoteIds = qData.map((q) => q.id);
          const { data: chargesData } = await supabase
            .from("quotation_charges")
            .select("*")
            .in("quotation_id", quoteIds);

          const chargesByQuoteId = new Map<string, QuotationChargeRecord[]>();
          if (chargesData) {
            for (const ch of chargesData) {
              const existing = chargesByQuoteId.get(ch.quotation_id) || [];
              existing.push(ch as unknown as QuotationChargeRecord);
              chargesByQuoteId.set(ch.quotation_id, existing);
            }
          }

          quotations = qData.map((q) => {
            const chargeList = chargesByQuoteId.get(q.id) || [];
            return {
              ...q,
              id: q.id,
              quotation_id: q.id,
              booking_id: q.booking_id,
              charges: chargeList,
              quotation_charges: chargeList,
            };
          });
        }
      }

      // Check fallback/in-memory records if database returned nothing
      if (quotations.length === 0) {
        const memMatches = Array.from(inMemoryQuotations.values()).filter(
          (q) =>
            q.booking_id === rawBookingId ||
            q.booking_id.toLowerCase() === rawBookingId.toLowerCase(),
        );
        if (memMatches.length > 0) {
          quotations = memMatches;
        } else {
          // Check local forwarder requests
          const localFwds = getLocalForwarderRequests();
          const matchedFwds = localFwds.filter(
            (f) =>
              f.movementNumber === rawBookingId ||
              f.bookingReference === rawBookingId ||
              f.id === rawBookingId,
          );

          quotations = matchedFwds
            .filter((f) => Boolean(f.offer || f.ratePerContainer))
            .map((f) => ({
              id: f.id,
              booking_id: rawBookingId,
              forwarder_id: f.forwarderId,
              forwarder_name: f.forwarderName,
              quotation_reference: f.quotationReference || f.offer?.quotationReference || null,
              quotation_status: f.status,
              revision_number: f.revisionNumber || 1,
              currency: f.currency || f.offer?.currency || "USD",
              quoted_total: f.totalFreight || f.offer?.totalFreight || null,
              calculated_total: f.totalFreight || f.offer?.totalFreight || null,
              ocean_freight: f.ratePerContainer || f.offer?.ratePerContainer || null,
              pol: f.polName || null,
              pod: f.podName || null,
              sailing_date: f.etd || f.offer?.etd || null,
              arrival_date: f.eta || f.offer?.eta || null,
              vessel_name: f.vesselName || f.offer?.vesselName || null,
              free_days: f.freeDays || f.offer?.freeDays || null,
              remarks: f.notes || f.offer?.notes || null,
              requires_human_review: f.status === "NEEDS_REVIEW",
              review_reason: null,
              charges: (f.offer?.itemizedCharges || []).map((c, idx) => ({
                id: `charge-${f.id}-${idx}`,
                quotation_id: f.id,
                charge_code: c.charge_code || "OTHER",
                charge_name_normalized: c.charge_name || "Charge",
                charge_name_original: c.charge_name || "Charge",
                amount: c.amount,
                currency: c.currency || f.currency || "USD",
                status: "confirmed",
              })),
            }));
        }
      }

      // Forwarder Data Isolation: A forwarder can only view their own quotations
      if (userRole === "forwarder") {
        if (!callerForwarderId) {
          quotations = [];
        } else {
          quotations = quotations.filter((q) => {
            const qFwd = String(q.forwarder_id || q.forwarder_name || "").toLowerCase();
            const target = callerForwarderId.toLowerCase();
            return qFwd === target || qFwd.includes(target) || target.includes(qFwd);
          });
        }
      }

      console.log("[QuotationAPI][GET /api/bookings/:bookingId/quotations] Returning API response object:", {
        bookingId: rawBookingId,
        count: quotations.length,
        quotations: quotations.map((q) => ({
          id: q.id,
          quotation_id: q.quotation_id || q.id,
          booking_id: q.booking_id || rawBookingId,
          charges_count: Array.isArray(q.charges) ? q.charges.length : 0,
          charges: q.charges || [],
          quotation_charges: q.quotation_charges || q.charges || [],
        })),
        rawQuotations: quotations,
      });

      return jsonResponse({
        success: true,
        bookingId: rawBookingId,
        quotations,
        count: quotations.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 2. GET /api/quotations/:quotationId
  // --------------------------------------------------------------------------
  const singleQuotationMatch = pathname.match(/^\/api\/quotations\/([^/]+)\/?$/);
  if (
    singleQuotationMatch &&
    method === "GET" &&
    singleQuotationMatch[1] !== "extract" // Exclude /api/quotations/extract
  ) {
    try {
      const rawQuoteId = decodeURIComponent(singleQuotationMatch[1]).trim();
      let quotation: Record<string, unknown> | null = null;

      if (isSupabaseConfigured) {
        const { data: qData } = await supabase
          .from("quotations")
          .select("*")
          .or(
            `id.eq.${rawQuoteId},quotation_reference.eq.${rawQuoteId},quotation_request_id.eq.${rawQuoteId},forwarder_request_id.eq.${rawQuoteId}`,
          )
          .limit(1)
          .maybeSingle();

        if (qData) {
          const { data: chargesData } = await supabase
            .from("quotation_charges")
            .select("*")
            .eq("quotation_id", qData.id);

          quotation = {
            ...qData,
            charges: chargesData || [],
          };
        }
      }

      if (!quotation && inMemoryQuotations.has(rawQuoteId)) {
        quotation = inMemoryQuotations.get(rawQuoteId) as unknown as Record<string, unknown>;
      }

      if (!quotation) {
        for (const [key, q] of inMemoryQuotations.entries()) {
          if (
            key === rawQuoteId ||
            q.id === rawQuoteId ||
            q.quotation_request_id === rawQuoteId ||
            q.quotation_reference === rawQuoteId ||
            q.booking_id === rawQuoteId
          ) {
            quotation = q as unknown as Record<string, unknown>;
            break;
          }
        }
      }

      if (!quotation) {
        const localFwds = getLocalForwarderRequests();
        const f = localFwds.find(
          (item) =>
            item.id === rawQuoteId ||
            item.quotationReference === rawQuoteId ||
            item.offer?.quotationReference === rawQuoteId ||
            item.bookingId === rawQuoteId ||
            item.movementNumber === rawQuoteId,
        );
        if (f) {
          quotation = {
            id: f.id,
            booking_id: f.movementNumber || f.bookingReference || f.bookingId || "",
            forwarder_id: f.forwarderId,
            forwarder_name: f.forwarderName,
            quotation_reference: f.quotationReference || f.offer?.quotationReference || null,
            quotation_status: f.status,
            revision_number: f.revisionNumber || 1,
            currency: f.currency || f.offer?.currency || "USD",
            ocean_freight: f.offer?.oceanFreight || f.ratePerContainer || null,
            origin_charges: f.offer?.originCharges || null,
            destination_charges: f.offer?.destinationCharges || null,
            thc: f.offer?.thc || null,
            documentation_charges: f.offer?.documentationCharges || null,
            customs_charges: f.offer?.customsCharges || null,
            trucking_charges: f.offer?.truckingCharges || null,
            other_charges: f.offer?.otherCharges || null,
            quoted_total: f.offer?.quotedTotal || f.totalFreight || null,
            calculated_total: f.offer?.calculatedTotal || f.totalFreight || null,
            carrier: f.offer?.carrier || f.preferredCarrier || null,
            container_type: f.offer?.containerType || f.containerType || "40HC",
            container_quantity: f.offer?.quantity || f.containerCount || 1,
            pol: f.polName || null,
            pod: f.podName || null,
            sailing_date: f.offer?.etd || f.etd || null,
            arrival_date: f.offer?.eta || f.eta || null,
            transit_time_days: f.offer?.transitDays || f.transitDays || null,
            vessel_name: f.offer?.vesselName || f.vesselName || null,
            voyage_number: f.offer?.voyageNumber || f.voyageNumber || null,
            free_days: f.offer?.freeDays || f.freeDays || null,
            valid_until: f.offer?.validUntil || null,
            remarks: f.offer?.notes || f.notes || null,
            requires_human_review: f.status === "NEEDS_REVIEW",
            review_reason: f.offer?.reviewReasons?.join("; ") || null,
            charges: (f.offer?.itemizedCharges || []).map((c, idx) => ({
              id: `charge-${f.id}-${idx}`,
              quotation_id: f.id,
              charge_code: c.charge_code || "OTHER",
              charge_name_normalized: c.charge_name || "Charge",
              amount: c.amount,
              currency: c.currency || f.currency || "USD",
              status: "confirmed",
            })),
          };
        }
      }

      console.log("[QuotationAPI] GET /api/quotations/:quotationId result:", {
        requestedQuotationId: rawQuoteId,
        status: quotation ? 200 : 404,
        returnedQuotation: quotation
          ? {
              id: quotation.id,
              booking_id: quotation.booking_id,
              forwarder_id: quotation.forwarder_id,
              quoted_total: quotation.quoted_total,
              ocean_freight: quotation.ocean_freight,
              currency: quotation.currency,
            }
          : null,
        returnedChargesCount:
          quotation && Array.isArray(quotation.charges) ? quotation.charges.length : 0,
      });

      if (!quotation) {
        return errorResponse("Quotation not found", 404);
      }

      // Forwarder Data Isolation: Forwarder cannot view another forwarder's quotation
      if (userRole === "forwarder") {
        const qFwd = String(quotation.forwarder_id || quotation.forwarder_name || "").toLowerCase();
        const target = (callerForwarderId || "").toLowerCase();
        const isMatch =
          Boolean(callerForwarderId) &&
          (qFwd === target || qFwd.includes(target) || target.includes(qFwd));
        if (!isMatch) {
          return errorResponse(
            "Access denied: forwarders are restricted from viewing competing quotations.",
            403,
          );
        }
      }

      return jsonResponse({
        success: true,
        quotation,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 3. POST /api/quotations/:quotationId/confirm
  // --------------------------------------------------------------------------
  const confirmQuotationMatch = pathname.match(/^\/api\/quotations\/([^/]+)\/confirm\/?$/);
  if (confirmQuotationMatch && method === "POST") {
    try {
      if (userRole === "forwarder") {
        return errorResponse(
          "Access denied: Forwarders cannot confirm quotations. Operator or Admin role required.",
          403,
        );
      }

      const rawQuoteId = decodeURIComponent(confirmQuotationMatch[1]).trim();
      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        confirmedBy?: string;
        notes?: string;
      };

      const nowIso = new Date().toISOString();
      let bookingIdToUpdate: string | null = null;
      let forwarderNameToLog: string | null = null;

      if (isSupabaseConfigured) {
        const { data: qData } = await supabase
          .from("quotations")
          .update({
            quotation_status: "confirmed",
            requires_human_review: false,
            updated_at: nowIso,
          })
          .eq("id", rawQuoteId)
          .select("id, booking_id, forwarder_id")
          .maybeSingle();

        if (qData) {
          bookingIdToUpdate = qData.booking_id;
        }

        // Also update forwarder_quote_requests
        await supabase
          .from("forwarder_quote_requests")
          .update({
            status: "CONFIRMED",
            updated_at: nowIso,
          })
          .or(`id.eq.${rawQuoteId},quotation_id.eq.${rawQuoteId}`);

        if (bookingIdToUpdate) {
          await supabase
            .from("bookings")
            .update({
              status: "Approved",
              confirmation_status: "CONFIRMED",
              confirmed_at: nowIso,
              confirmed_by: body.confirmedBy || "Operations Desk",
              updated_at: nowIso,
            })
            .or(`id.eq.${bookingIdToUpdate},movement_number.eq.${bookingIdToUpdate}`);
        }
      }

      // Update in-memory fallback
      if (inMemoryQuotations.has(rawQuoteId)) {
        const existing = inMemoryQuotations.get(rawQuoteId)!;
        existing.quotation_status = "confirmed";
        existing.requires_human_review = false;
        existing.updated_at = nowIso;
        bookingIdToUpdate = existing.booking_id;
      }

      // Update local storage forwarder requests
      const localFwds = getLocalForwarderRequests();
      const updatedFwds = localFwds.map((f) => {
        if (f.id === rawQuoteId) {
          forwarderNameToLog = f.forwarderName;
          bookingIdToUpdate = bookingIdToUpdate || f.movementNumber || f.bookingReference || null;
          return {
            ...f,
            status: "CONFIRMED" as const,
            confirmedAt: nowIso,
            confirmedBy: body.confirmedBy || "Operations Desk",
          };
        }
        return f;
      });
      saveLocalForwarderRequests(updatedFwds);

      // Record audit event
      await recordQuotationAuditEvent({
        eventType: "BOOKING_CONFIRMED",
        movementNumber: bookingIdToUpdate,
        bookingId: bookingIdToUpdate,
        forwarderName: forwarderNameToLog,
        summary: `Quotation ${rawQuoteId} confirmed via API`,
        details: { quotationId: rawQuoteId, confirmedBy: body.confirmedBy || "API" },
        userId: body.userId || null,
      });

      return jsonResponse({
        success: true,
        quotationId: rawQuoteId,
        status: "confirmed",
        confirmedAt: nowIso,
        message: "Quotation confirmed successfully",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 4. POST /api/quotations/:quotationId/reject
  // --------------------------------------------------------------------------
  const rejectQuotationMatch = pathname.match(/^\/api\/quotations\/([^/]+)\/reject\/?$/);
  if (rejectQuotationMatch && method === "POST") {
    try {
      if (userRole === "forwarder") {
        return errorResponse(
          "Access denied: Forwarders cannot reject quotations. Operator or Admin role required.",
          403,
        );
      }

      const rawQuoteId = decodeURIComponent(rejectQuotationMatch[1]).trim();
      const body = (await request.json().catch(() => ({}))) as {
        reason?: string;
        userId?: string;
      };

      const nowIso = new Date().toISOString();
      const reasonText = body.reason || "Rejected by operator";

      if (isSupabaseConfigured) {
        await supabase
          .from("quotations")
          .update({
            quotation_status: "rejected",
            remarks: reasonText,
            requires_human_review: false,
            updated_at: nowIso,
          })
          .eq("id", rawQuoteId);

        await supabase
          .from("forwarder_quote_requests")
          .update({
            status: "DECLINED",
            updated_at: nowIso,
          })
          .or(`id.eq.${rawQuoteId},quotation_id.eq.${rawQuoteId}`);
      }

      if (inMemoryQuotations.has(rawQuoteId)) {
        const existing = inMemoryQuotations.get(rawQuoteId)!;
        existing.quotation_status = "rejected";
        existing.remarks = reasonText;
        existing.requires_human_review = false;
        existing.updated_at = nowIso;
      }

      const localFwds = getLocalForwarderRequests();
      const updatedFwds = localFwds.map((f) => {
        if (f.id === rawQuoteId) {
          return {
            ...f,
            status: "DECLINED" as const,
            notes: `${f.notes ? f.notes + " | " : ""}${reasonText}`,
          };
        }
        return f;
      });
      saveLocalForwarderRequests(updatedFwds);

      await recordQuotationAuditEvent({
        eventType: "QUOTATION_UPDATED",
        summary: `Quotation ${rawQuoteId} rejected: ${reasonText}`,
        details: { quotationId: rawQuoteId, reason: reasonText },
        userId: body.userId || null,
      });

      return jsonResponse({
        success: true,
        quotationId: rawQuoteId,
        status: "rejected",
        reason: reasonText,
        message: "Quotation rejected",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 5. POST /api/quotations/:quotationId/mark-duplicate
  // --------------------------------------------------------------------------
  const duplicateQuotationMatch = pathname.match(/^\/api\/quotations\/([^/]+)\/mark-duplicate\/?$/);
  if (duplicateQuotationMatch && method === "POST") {
    try {
      const rawQuoteId = decodeURIComponent(duplicateQuotationMatch[1]).trim();
      const body = (await request.json().catch(() => ({}))) as {
        originalQuotationId?: string;
        reason?: string;
        userId?: string;
      };

      const nowIso = new Date().toISOString();
      const reasonText =
        body.reason ||
        `Duplicate of quotation ${body.originalQuotationId || "previously processed"}`;

      if (isSupabaseConfigured) {
        await supabase
          .from("quotations")
          .update({
            quotation_status: "duplicate",
            requires_human_review: false,
            review_reason: reasonText,
            updated_at: nowIso,
          })
          .eq("id", rawQuoteId);

        await supabase
          .from("forwarder_quote_requests")
          .update({
            status: "NOT_AVAILABLE",
            updated_at: nowIso,
          })
          .eq("id", rawQuoteId);
      }

      if (inMemoryQuotations.has(rawQuoteId)) {
        const existing = inMemoryQuotations.get(rawQuoteId)!;
        existing.quotation_status = "duplicate";
        existing.requires_human_review = false;
        existing.review_reason = reasonText;
        existing.updated_at = nowIso;
      }

      await recordQuotationAuditEvent({
        eventType: "QUOTATION_UPDATED",
        summary: `Quotation ${rawQuoteId} marked as duplicate`,
        details: {
          quotationId: rawQuoteId,
          originalQuotationId: body.originalQuotationId,
          reason: reasonText,
        },
        userId: body.userId || null,
      });

      return jsonResponse({
        success: true,
        quotationId: rawQuoteId,
        status: "duplicate",
        originalQuotationId: body.originalQuotationId || null,
        message: "Quotation marked as duplicate",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 6. POST /api/quotations/:quotationId/reprocess
  // --------------------------------------------------------------------------
  const reprocessQuotationMatch = pathname.match(/^\/api\/quotations\/([^/]+)\/reprocess\/?$/);
  if (reprocessQuotationMatch && method === "POST") {
    try {
      const rawQuoteId = decodeURIComponent(reprocessQuotationMatch[1]).trim();
      const body = (await request.json().catch(() => ({}))) as {
        rawEmail?: string;
        subject?: string;
        body?: string;
        userId?: string;
      };

      // 1. Fetch current quotation record
      let existingQuote: QuotationRecord | null = null;
      let existingEmail: IncomingEmailRecord | null = null;

      if (isSupabaseConfigured) {
        const { data: qData } = await supabase
          .from("quotations")
          .select("*")
          .eq("id", rawQuoteId)
          .maybeSingle();
        if (qData) existingQuote = qData as QuotationRecord;

        if (existingQuote?.incoming_email_id) {
          const { data: eData } = await supabase
            .from("incoming_emails")
            .select("*")
            .eq("id", existingQuote.incoming_email_id)
            .maybeSingle();
          if (eData) existingEmail = eData as IncomingEmailRecord;
        }
      }

      if (!existingQuote && inMemoryQuotations.has(rawQuoteId)) {
        existingQuote = inMemoryQuotations.get(rawQuoteId)!;
      }

      const emailSubject =
        body.subject ||
        existingEmail?.subject ||
        `Quotation ${existingQuote?.quotation_reference || rawQuoteId}`;
      const emailBody =
        body.body ||
        body.rawEmail ||
        existingEmail?.body_text ||
        existingQuote?.remarks ||
        `Rate: ${existingQuote?.currency || "USD"} ${existingQuote?.quoted_total || 1200}`;

      // 2. Re-process through deterministic pipeline
      const processResult = await processForwarderQuotationEmail(supabase, {
        emailMessageId: existingEmail?.message_id || `reprocess-${Date.now()}`,
        subject: emailSubject,
        body: emailBody,
        senderEmail: existingEmail?.from_email || "operations@forwarder.com",
        senderName: existingEmail?.from_name || null,
        userId: body.userId || null,
      });

      // 3. Update the existing quotation record with newly reprocessed values
      const nowIso = new Date().toISOString();
      const updatedStatus = processResult.validation.needsReview
        ? "needs_review"
        : processResult.status.toLowerCase();

      if (isSupabaseConfigured && existingQuote) {
        await supabase
          .from("quotations")
          .update({
            quotation_status: updatedStatus,
            quoted_total: processResult.quotationFields.quotedTotal,
            calculated_total: processResult.quotationFields.calculatedTotal,
            currency: processResult.quotationFields.currency,
            pol: processResult.quotationFields.pol,
            pod: processResult.quotationFields.pod,
            sailing_date: processResult.quotationFields.sailingDate,
            valid_until: processResult.quotationFields.validityDate,
            vessel_name: processResult.quotationFields.vesselName,
            transit_time_days: processResult.quotationFields.transitTime,
            free_days: processResult.quotationFields.freeDays,
            requires_human_review: processResult.validation.needsReview,
            review_reason: processResult.validation.reviewReasons[0] || null,
            updated_at: nowIso,
          })
          .eq("id", existingQuote.id);
      }

      await recordQuotationAuditEvent({
        eventType: "QUOTATION_UPDATED",
        summary: `Quotation ${rawQuoteId} reprocessed via deterministic engine`,
        details: {
          quotationId: rawQuoteId,
          validation: processResult.validation,
        },
        userId: body.userId || null,
      });

      return jsonResponse({
        success: true,
        quotationId: rawQuoteId,
        reprocessed: true,
        status: updatedStatus,
        quotationFields: processResult.quotationFields,
        validation: processResult.validation,
        message: "Quotation reprocessed successfully",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 7. POST /api/incoming-emails/:emailId/process
  // --------------------------------------------------------------------------
  const processEmailMatch = pathname.match(/^\/api\/incoming-emails\/([^/]+)\/process\/?$/);
  if (processEmailMatch && method === "POST") {
    try {
      const rawEmailId = decodeURIComponent(processEmailMatch[1]).trim();
      const body = (await request.json().catch(() => ({}))) as {
        subject?: string;
        body?: string;
        senderEmail?: string;
        senderName?: string;
        messageId?: string;
        userId?: string;
      };

      // 1. Fetch email from database or memory
      let emailRecord: IncomingEmailRecord | null = null;
      if (isSupabaseConfigured) {
        const { data: eData } = await supabase
          .from("incoming_emails")
          .select("*")
          .or(`id.eq.${rawEmailId},message_id.eq.${rawEmailId}`)
          .limit(1)
          .maybeSingle();

        if (eData) emailRecord = eData as IncomingEmailRecord;
      }

      if (!emailRecord && inMemoryIncomingEmails.has(rawEmailId)) {
        emailRecord = inMemoryIncomingEmails.get(rawEmailId)!;
      }

      const emailMessageId = body.messageId || emailRecord?.message_id || rawEmailId;

      // 2. Check Idempotency via message_id
      if (isSupabaseConfigured) {
        const { data: existingProcessed } = await supabase
          .from("incoming_emails")
          .select("id, processing_status, message_id")
          .eq("message_id", emailMessageId)
          .eq("processing_status", "processed")
          .maybeSingle();

        if (existingProcessed && existingProcessed.id !== rawEmailId) {
          return jsonResponse({
            success: true,
            status: "already_processed",
            messageId: emailMessageId,
            message: "Email message_id was already processed; duplicate quotation not created.",
          });
        }
      }

      // 3. Run deterministic quotation processing pipeline
      const processResult = await processForwarderQuotationEmail(supabase, {
        emailMessageId,
        subject: body.subject || emailRecord?.subject || "",
        body: body.body || emailRecord?.body_text || "",
        senderEmail: body.senderEmail || emailRecord?.from_email || "forwarder@logistics.com",
        senderName: body.senderName || emailRecord?.from_name || null,
        userId: body.userId || null,
      });

      // 4. Update incoming_emails processing status
      const finalStatus = processResult.validation.needsReview
        ? "needs_review"
        : processResult.bookingNumber
          ? "processed"
          : "unmatched";

      if (isSupabaseConfigured && emailRecord) {
        await supabase
          .from("incoming_emails")
          .update({
            processing_status: finalStatus,
            detected_booking_numbers: processResult.detectedBookingNumbers,
            detected_forwarder_id: processResult.forwarderId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", emailRecord.id);
      }

      return jsonResponse({
        success: true,
        status: finalStatus,
        emailId: rawEmailId,
        bookingNumber: processResult.bookingNumber,
        detectedBookingNumbers: processResult.detectedBookingNumbers,
        bookingId: processResult.bookingId,
        forwarderId: processResult.forwarderId,
        forwarderName: processResult.forwarderName,
        quotationFields: processResult.quotationFields,
        validation: processResult.validation,
        message: processResult.message,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 8. GET /api/incoming-emails/unmatched
  // --------------------------------------------------------------------------
  if (pathname === "/api/incoming-emails/unmatched" && method === "GET") {
    try {
      const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
      const offsetParam = parseInt(url.searchParams.get("offset") || "0", 10);
      const safeLimit = isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 200);
      const safeOffset = isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0);

      let emails: IncomingEmailRecord[] = [];

      if (isSupabaseConfigured) {
        const { data: eData } = await supabase
          .from("incoming_emails")
          .select("*")
          .or("processing_status.eq.unmatched,processing_status.eq.UNMATCHED")
          .order("received_at", { ascending: false })
          .range(safeOffset, safeOffset + safeLimit - 1);

        if (eData) emails = eData as IncomingEmailRecord[];
      }

      if (emails.length === 0) {
        emails = Array.from(inMemoryIncomingEmails.values()).filter(
          (e) => e.processing_status === "unmatched",
        );
      }

      return jsonResponse({
        success: true,
        emails,
        count: emails.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 9. GET /api/incoming-emails/needs-review
  // --------------------------------------------------------------------------
  if (pathname === "/api/incoming-emails/needs-review" && method === "GET") {
    try {
      const limitParam = parseInt(url.searchParams.get("limit") || "50", 10);
      const offsetParam = parseInt(url.searchParams.get("offset") || "0", 10);
      const safeLimit = isNaN(limitParam) ? 50 : Math.min(Math.max(limitParam, 1), 200);
      const safeOffset = isNaN(offsetParam) ? 0 : Math.max(offsetParam, 0);

      let emails: IncomingEmailRecord[] = [];

      if (isSupabaseConfigured) {
        const { data: eData } = await supabase
          .from("incoming_emails")
          .select("*")
          .or("processing_status.eq.needs_review,processing_status.eq.NEEDS_REVIEW")
          .order("received_at", { ascending: false })
          .range(safeOffset, safeOffset + safeLimit - 1);

        if (eData) emails = eData as IncomingEmailRecord[];
      }

      if (emails.length === 0) {
        emails = Array.from(inMemoryIncomingEmails.values()).filter(
          (e) => e.processing_status === "needs_review",
        );
      }

      return jsonResponse({
        success: true,
        emails,
        count: emails.length,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // --------------------------------------------------------------------------
  // 10. POST /api/incoming-emails/:emailId/link-booking
  // --------------------------------------------------------------------------
  const linkBookingMatch = pathname.match(/^\/api\/incoming-emails\/([^/]+)\/link-booking\/?$/);
  if (linkBookingMatch && method === "POST") {
    try {
      const rawEmailId = decodeURIComponent(linkBookingMatch[1]).trim();
      const body = (await request.json().catch(() => ({}))) as {
        bookingId: string;
        forwarderId?: string;
        userId?: string;
      };

      if (!body.bookingId) {
        return errorResponse("Missing required parameter: bookingId", 400);
      }

      const targetBookingId = body.bookingId.trim();
      const nowIso = new Date().toISOString();

      // 1. Fetch email record
      let emailRecord: IncomingEmailRecord | null = null;
      if (isSupabaseConfigured) {
        const { data: eData } = await supabase
          .from("incoming_emails")
          .select("*")
          .eq("id", rawEmailId)
          .maybeSingle();

        if (eData) emailRecord = eData as IncomingEmailRecord;
      }

      if (!emailRecord && inMemoryIncomingEmails.has(rawEmailId)) {
        emailRecord = inMemoryIncomingEmails.get(rawEmailId)!;
      }

      // 2. Update incoming email with linked booking number
      if (isSupabaseConfigured && emailRecord) {
        await supabase
          .from("incoming_emails")
          .update({
            detected_booking_numbers: [targetBookingId],
            detected_forwarder_id: body.forwarderId || emailRecord.detected_forwarder_id,
            processing_status: "processed",
            updated_at: nowIso,
          })
          .eq("id", emailRecord.id);
      }

      // 3. Process email with explicit booking target
      const processResult = await processForwarderQuotationEmail(supabase, {
        emailMessageId: emailRecord?.message_id || `linked-${Date.now()}`,
        subject: emailRecord?.subject || `Quotation for ${targetBookingId}`,
        body: `${emailRecord?.body_text || ""}\n\nBooking: ${targetBookingId}`,
        senderEmail: emailRecord?.from_email || "forwarder@logistics.com",
        senderName: emailRecord?.from_name || null,
        userId: body.userId || null,
      });

      await recordQuotationAuditEvent({
        eventType: "EMAIL_MATCHED",
        movementNumber: targetBookingId,
        bookingId: targetBookingId,
        forwarderId: body.forwarderId || processResult.forwarderId,
        summary: `Email ${rawEmailId} manually linked to booking ${targetBookingId}`,
        details: {
          emailId: rawEmailId,
          bookingId: targetBookingId,
          validation: processResult.validation,
        },
        userId: body.userId || null,
      });

      return jsonResponse({
        success: true,
        emailId: rawEmailId,
        bookingId: targetBookingId,
        linked: true,
        quotationFields: processResult.quotationFields,
        validation: processResult.validation,
        message: `Email successfully linked to booking ${targetBookingId}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return errorResponse(msg);
    }
  }

  // Not matched by this router
  return null;
}
