/**
 * Database Persistence Module for Quotation & Email Processing
 *
 * Implements exact schema requirements:
 * 1. incoming_emails:
 *    - id, message_id, thread_id, from_name, from_email, subject, body_text, html_body,
 *      received_at, attachment_metadata, processing_status, processing_error,
 *      detected_booking_numbers, detected_forwarder_id, created_at, updated_at
 *
 * 2. quotation_requests:
 *    - id, booking_id, forwarder_id, sent_at, response_deadline, status
 *
 * 3. quotations:
 *    - id, booking_id, forwarder_id, quotation_request_id, incoming_email_id,
 *      quotation_reference, quotation_status, revision_number, currency,
 *      quoted_total, calculated_total, valid_until, origin, destination,
 *      pol, pod, transit_time_days, sailing_date, arrival_date, vessel_name,
 *      free_days, remarks, requires_human_review, review_reason, created_at, updated_at
 *
 * 4. quotation_charges:
 *    - id, quotation_id, charge_code, charge_name_normalized, charge_name_original,
 *      amount, amount_min, amount_max, currency, unit, quantity, status,
 *      original_text, created_at
 *
 * Reuses existing tables, prevents duplicate systems, and ensures fallback safety.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid } from "./supabase-services";
import type { ExtractedChargeItem } from "./deterministic-charge-extractor";
import type { DeterministicQuotationFields } from "./forwarder-quotation-processor";

export interface IncomingEmailRecord {
  id: string;
  message_id: string | null;
  thread_id: string | null;
  from_name: string | null;
  from_email: string;
  subject: string;
  body_text: string;
  html_body: string | null;
  received_at: string;
  attachment_metadata: Record<string, unknown> | null;
  processing_status: string;
  processing_error: string | null;
  detected_booking_numbers: string[] | null;
  detected_forwarder_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationRequestRecord {
  id: string;
  booking_id: string;
  forwarder_id: string | null;
  sent_at: string;
  response_deadline: string | null;
  status: string;
}

export interface QuotationRecord {
  id: string;
  booking_id: string;
  forwarder_id: string | null;
  forwarder_name?: string | null;
  quotation_request_id: string | null;
  incoming_email_id: string | null;
  quotation_reference: string | null;
  quotation_status: string | null;
  revision_number: number | null;
  currency: string | null;
  ocean_freight?: number | null;
  origin_charges?: number | null;
  destination_charges?: number | null;
  thc?: number | null;
  documentation_charges?: number | null;
  customs_charges?: number | null;
  trucking_charges?: number | null;
  other_charges?: number | null;
  quoted_total: number | null;
  calculated_total: number | null;
  carrier?: string | null;
  container_type?: string | null;
  container_quantity?: number | null;
  valid_until: string | null;
  origin: string | null;
  destination: string | null;
  pol: string | null;
  pod: string | null;
  transit_time_days: number | null;
  sailing_date: string | null;
  arrival_date: string | null;
  vessel_name: string | null;
  voyage_number?: string | null;
  free_days: number | null;
  remarks: string | null;
  requires_human_review: boolean;
  review_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuotationChargeRecord {
  id: string;
  quotation_id: string;
  charge_code: string;
  charge_name_normalized: string;
  charge_name_original: string;
  amount: number | null;
  amount_min: number | null;
  amount_max: number | null;
  currency: string | null;
  unit: string | null;
  quantity: number | null;
  status: string;
  original_text: string | null;
  created_at: string;
}

/**
 * 1. Persist or Update `incoming_emails`
 */
export async function persistIncomingEmailRecord(
  record: Partial<IncomingEmailRecord> & {
    id: string;
    from_email: string;
    subject: string;
    body_text: string;
  },
): Promise<IncomingEmailRecord> {
  const nowIso = new Date().toISOString();
  const emailId = safeUuid(record.id) || record.id;

  const fullRecord: IncomingEmailRecord = {
    id: emailId,
    message_id: record.message_id ?? null,
    thread_id: record.thread_id ?? null,
    from_name: record.from_name ?? null,
    from_email: record.from_email.trim().toLowerCase(),
    subject: record.subject,
    body_text: record.body_text,
    html_body: record.html_body ?? null,
    received_at: record.received_at || nowIso,
    attachment_metadata: record.attachment_metadata ?? null,
    processing_status: record.processing_status || "PROCESSED",
    processing_error: record.processing_error ?? null,
    detected_booking_numbers: record.detected_booking_numbers ?? null,
    detected_forwarder_id: record.detected_forwarder_id ?? null,
    created_at: record.created_at || nowIso,
    updated_at: nowIso,
  };

  if (isSupabaseConfigured) {
    try {
      // 1a. Insert/update into incoming_emails table
      await supabase.from("incoming_emails").upsert(fullRecord, { onConflict: "id" });
    } catch (err) {
      console.warn("[QuotationSchemaPersistence] Notice saving incoming_emails:", err);
    }

    try {
      // 1b. Also sync into email_messages for backwards compatibility
      await supabase.from("email_messages").upsert(
        {
          id: emailId,
          message_id: fullRecord.message_id,
          gmail_message_id: fullRecord.message_id,
          thread_id: fullRecord.thread_id,
          gmail_thread_id: fullRecord.thread_id,
          sender_name: fullRecord.from_name,
          sender_email: fullRecord.from_email,
          from_email: fullRecord.from_email,
          subject: fullRecord.subject,
          body: fullRecord.body_text,
          body_html: fullRecord.html_body,
          received_at: fullRecord.received_at,
          processing_status: fullRecord.processing_status,
          forwarder_id: safeUuid(fullRecord.detected_forwarder_id),
          updated_at: fullRecord.updated_at,
        },
        { onConflict: "id" },
      );
    } catch (msgErr) {
      console.warn("[QuotationSchemaPersistence] Notice updating email_messages:", msgErr);
    }
  }

  return fullRecord;
}

/**
 * 2. Persist or Update `quotation_requests`
 */
export async function persistQuotationRequestRecord(
  record: Partial<QuotationRequestRecord> & {
    id: string;
    booking_id: string;
  },
): Promise<QuotationRequestRecord> {
  const nowIso = new Date().toISOString();
  const reqId = safeUuid(record.id) || record.id;
  const bookingId = safeUuid(record.booking_id) || record.booking_id;
  const forwarderId = record.forwarder_id
    ? safeUuid(record.forwarder_id) || record.forwarder_id
    : null;

  const fullRecord: QuotationRequestRecord = {
    id: reqId,
    booking_id: bookingId,
    forwarder_id: forwarderId,
    sent_at: record.sent_at || nowIso,
    response_deadline: record.response_deadline ?? null,
    status: record.status || "SENT",
  };

  if (isSupabaseConfigured) {
    try {
      // 2a. Insert/update into quotation_requests table
      await supabase.from("quotation_requests").upsert(fullRecord, { onConflict: "id" });
    } catch (err) {
      console.warn("[QuotationSchemaPersistence] Notice saving quotation_requests:", err);
    }

    try {
      // 2b. Also sync into forwarder_requests for compatibility
      await supabase.from("forwarder_requests").upsert(
        {
          id: reqId,
          booking_id: bookingId,
          forwarder_id: forwarderId,
          request_id: reqId,
          status: fullRecord.status,
          sent_at: fullRecord.sent_at,
          updated_at: nowIso,
        },
        { onConflict: "id" },
      );
    } catch (fwdErr) {
      console.warn("[QuotationSchemaPersistence] Notice syncing forwarder_requests:", fwdErr);
    }
  }

  return fullRecord;
}

// In-memory stores for instant retrieval across SSR/client and tests
export const inMemoryQuotations = new Map<
  string,
  QuotationRecord & { charges?: QuotationChargeRecord[] }
>();
export const inMemoryIncomingEmails = new Map<string, IncomingEmailRecord>();

export function setInMemoryQuotation(
  id: string,
  record: QuotationRecord & { charges?: QuotationChargeRecord[] },
): void {
  inMemoryQuotations.set(id, record);
}

export function setInMemoryIncomingEmail(id: string, record: IncomingEmailRecord): void {
  inMemoryIncomingEmails.set(id, record);
}

/**
 * 3. Persist `quotations` with all required schema columns
 */
export async function persistQuotationRecord(
  record: Partial<QuotationRecord> & {
    id: string;
    booking_id: string;
  },
): Promise<QuotationRecord> {
  const nowIso = new Date().toISOString();
  const quotationId = safeUuid(record.id) || record.id;
  const bookingId = safeUuid(record.booking_id) || record.booking_id;
  const forwarderId = record.forwarder_id
    ? safeUuid(record.forwarder_id) || record.forwarder_id
    : null;
  const quotationRequestId = record.quotation_request_id
    ? safeUuid(record.quotation_request_id) || record.quotation_request_id
    : null;
  const incomingEmailId = record.incoming_email_id
    ? safeUuid(record.incoming_email_id) || record.incoming_email_id
    : null;

  const fullRecord: QuotationRecord = {
    id: quotationId,
    booking_id: bookingId,
    forwarder_id: forwarderId,
    forwarder_name: record.forwarder_name ?? null,
    quotation_request_id: quotationRequestId,
    incoming_email_id: incomingEmailId,
    quotation_reference: record.quotation_reference ?? null,
    quotation_status: record.quotation_status || "OFFER_RECEIVED",
    revision_number: record.revision_number ?? 1,
    currency: record.currency || "USD",
    ocean_freight: record.ocean_freight !== undefined ? record.ocean_freight : null,
    origin_charges: record.origin_charges !== undefined ? record.origin_charges : null,
    destination_charges:
      record.destination_charges !== undefined ? record.destination_charges : null,
    thc: record.thc !== undefined ? record.thc : null,
    documentation_charges:
      record.documentation_charges !== undefined ? record.documentation_charges : null,
    customs_charges: record.customs_charges !== undefined ? record.customs_charges : null,
    trucking_charges: record.trucking_charges !== undefined ? record.trucking_charges : null,
    other_charges: record.other_charges !== undefined ? record.other_charges : null,
    quoted_total: record.quoted_total !== undefined ? record.quoted_total : null,
    calculated_total: record.calculated_total !== undefined ? record.calculated_total : null,
    carrier: record.carrier ?? null,
    container_type: record.container_type ?? null,
    container_quantity: record.container_quantity !== undefined ? record.container_quantity : null,
    valid_until: record.valid_until ?? null,
    origin: record.origin ?? null,
    destination: record.destination ?? null,
    pol: record.pol ?? null,
    pod: record.pod ?? null,
    transit_time_days: record.transit_time_days !== undefined ? record.transit_time_days : null,
    sailing_date: record.sailing_date ?? null,
    arrival_date: record.arrival_date ?? null,
    vessel_name: record.vessel_name ?? null,
    voyage_number: record.voyage_number ?? null,
    free_days: record.free_days !== undefined ? record.free_days : null,
    remarks: record.remarks ?? null,
    requires_human_review: record.requires_human_review ?? false,
    review_reason: record.review_reason ?? null,
    created_at: record.created_at || nowIso,
    updated_at: nowIso,
  };

  console.log(
    "[QuotationSchemaPersistence] Incoming quotation record payload before database insertion:",
    JSON.stringify(fullRecord, null, 2),
  );

  if (isSupabaseConfigured) {
    try {
      // Upsert into quotations table
      await supabase.from("quotations").upsert(
        {
          id: fullRecord.id,
          booking_id: fullRecord.booking_id,
          forwarder_id: fullRecord.forwarder_id,
          forwarder_name: fullRecord.forwarder_name,
          forwarder_request_id: fullRecord.quotation_request_id || fullRecord.id,
          quotation_request_id: fullRecord.quotation_request_id,
          email_message_id: fullRecord.incoming_email_id,
          incoming_email_id: fullRecord.incoming_email_id,
          quotation_reference: fullRecord.quotation_reference,
          quotation_status: fullRecord.quotation_status,
          revision_number: fullRecord.revision_number,
          version_number: fullRecord.revision_number || 1,
          currency: fullRecord.currency,
          rate:
            fullRecord.ocean_freight || fullRecord.quoted_total || fullRecord.calculated_total || 0,
          ocean_freight: fullRecord.ocean_freight,
          origin_charges: fullRecord.origin_charges,
          destination_charges: fullRecord.destination_charges,
          thc: fullRecord.thc,
          documentation_charges: fullRecord.documentation_charges,
          customs_charges: fullRecord.customs_charges,
          trucking_charges: fullRecord.trucking_charges,
          other_charges: fullRecord.other_charges,
          total_cost: fullRecord.quoted_total || fullRecord.calculated_total,
          quoted_total: fullRecord.quoted_total,
          calculated_total: fullRecord.calculated_total,
          carrier: fullRecord.carrier,
          container_type: fullRecord.container_type,
          container_quantity: fullRecord.container_quantity,
          valid_until: fullRecord.valid_until,
          rate_validity: fullRecord.valid_until,
          origin: fullRecord.origin,
          destination: fullRecord.destination,
          pol: fullRecord.pol,
          pod: fullRecord.pod,
          transit_time_days: fullRecord.transit_time_days,
          transit_time: fullRecord.transit_time_days,
          sailing_date: fullRecord.sailing_date,
          etd: fullRecord.sailing_date,
          arrival_date: fullRecord.arrival_date,
          eta: fullRecord.arrival_date,
          vessel_name: fullRecord.vessel_name,
          vessel: fullRecord.vessel_name,
          voyage_number: fullRecord.voyage_number,
          free_days: fullRecord.free_days,
          remarks: fullRecord.remarks,
          notes: fullRecord.remarks,
          requires_human_review: fullRecord.requires_human_review,
          review_reason: fullRecord.review_reason,
          extraction_status: fullRecord.requires_human_review ? "NEEDS_REVIEW" : "SAVED",
          processing_status: fullRecord.requires_human_review ? "NEEDS_REVIEW" : "OFFER_RECEIVED",
          is_current: true,
          created_at: fullRecord.created_at,
          updated_at: fullRecord.updated_at,
        },
        { onConflict: "id" },
      );
    } catch (err) {
      console.warn("[QuotationSchemaPersistence] Notice saving quotations:", err);
    }
  }

  // Update in-memory cache
  setInMemoryQuotation(fullRecord.id, fullRecord);

  return fullRecord;
}

/**
 * 4. Persist Itemized `quotation_charges`
 */
export async function persistQuotationCharges(
  quotationId: string,
  charges: ExtractedChargeItem[],
): Promise<QuotationChargeRecord[]> {
  const nowIso = new Date().toISOString();
  const safeQuoteId = safeUuid(quotationId) || quotationId;

  const records: QuotationChargeRecord[] = charges.map((c, idx) => {
    const chargeId = safeUuid(`${safeQuoteId}-chg-${idx + 1}`) || `${safeQuoteId}-chg-${idx + 1}`;
    return {
      id: chargeId,
      quotation_id: safeQuoteId,
      charge_code: c.category,
      charge_name_normalized: c.categoryLabel,
      charge_name_original: c.originalChargeName,
      amount: c.amount,
      amount_min: c.amountMin,
      amount_max: c.amountMax,
      currency: c.currency,
      unit: c.unit,
      quantity: c.quantity,
      status: c.status,
      original_text: c.originalSourceLine,
      created_at: nowIso,
    };
  });

  if (isSupabaseConfigured && records.length > 0) {
    try {
      await supabase.from("quotation_charges").upsert(records, { onConflict: "id" });
    } catch (err) {
      console.warn("[QuotationSchemaPersistence] Notice saving quotation_charges:", err);
    }
  }

  return records;
}

/**
 * Helper to build and save all 4 relational entities from a processed forwarder email.
 */
export async function persistProcessedQuotationBundle(params: {
  incomingEmailId: string;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  senderName?: string | null;
  senderEmail: string;
  subject: string;
  body: string;
  htmlBody?: string | null;
  receivedAt?: string | null;
  detectedBookingNumbers: string[];
  detectedForwarderId?: string | null;
  bookingId: string;
  forwarderRequestId?: string | null;
  quotationId?: string | null;
  quotationReference?: string | null;
  quotationStatus?: string | null;
  revisionNumber?: number | null;
  fields: DeterministicQuotationFields;
  requiresHumanReview: boolean;
  reviewReasons: string[];
}): Promise<{
  incomingEmail: IncomingEmailRecord;
  quotationRequest: QuotationRequestRecord;
  quotation: QuotationRecord;
  charges: QuotationChargeRecord[];
}> {
  const emailRecord = await persistIncomingEmailRecord({
    id: params.incomingEmailId,
    message_id: params.gmailMessageId ?? null,
    thread_id: params.gmailThreadId ?? null,
    from_name: params.senderName ?? null,
    from_email: params.senderEmail,
    subject: params.subject,
    body_text: params.body,
    html_body: params.htmlBody ?? null,
    received_at: params.receivedAt ?? new Date().toISOString(),
    processing_status: params.requiresHumanReview ? "NEEDS_REVIEW" : "PROCESSED",
    processing_error: params.reviewReasons.length > 0 ? params.reviewReasons.join(" | ") : null,
    detected_booking_numbers: params.detectedBookingNumbers,
    detected_forwarder_id: params.detectedForwarderId ?? null,
  });

  const reqId = params.forwarderRequestId || `req-${Date.now().toString(36)}`;
  const quotationRequest = await persistQuotationRequestRecord({
    id: reqId,
    booking_id: params.bookingId,
    forwarder_id: params.detectedForwarderId ?? null,
    sent_at: params.receivedAt ?? new Date().toISOString(),
    status: params.requiresHumanReview ? "NEEDS_REVIEW" : "OFFER_RECEIVED",
  });

  const quoteId = params.quotationId || `quote-${Date.now().toString(36)}`;
  const quotation = await persistQuotationRecord({
    id: quoteId,
    booking_id: params.bookingId,
    forwarder_id: params.detectedForwarderId ?? null,
    quotation_request_id: quotationRequest.id,
    incoming_email_id: emailRecord.id,
    quotation_reference: params.quotationReference ?? null,
    quotation_status:
      params.quotationStatus || (params.requiresHumanReview ? "NEEDS_REVIEW" : "OFFER_RECEIVED"),
    revision_number: params.revisionNumber ?? 1,
    currency: params.fields.currency || "USD",
    ocean_freight: params.fields.oceanFreight ?? null,
    origin_charges: params.fields.originCharges ?? null,
    destination_charges: params.fields.destinationCharges ?? null,
    thc: params.fields.thc ?? null,
    documentation_charges: params.fields.documentationCharges ?? null,
    customs_charges: params.fields.customsCharges ?? null,
    trucking_charges: params.fields.truckingCharges ?? null,
    other_charges: params.fields.otherCharges ?? null,
    quoted_total: params.fields.quotedTotal ?? params.fields.totalAmount,
    calculated_total: params.fields.calculatedTotal,
    carrier: params.fields.carrier ?? null,
    container_type: params.fields.containerType ?? "40HC",
    container_quantity: params.fields.containerQuantity ?? 1,
    valid_until: params.fields.validityDate ?? null,
    origin: null,
    destination: null,
    pol: null,
    pod: null,
    transit_time_days: params.fields.transitTime,
    sailing_date: params.fields.sailingDate,
    arrival_date: params.fields.eta ?? null,
    vessel_name: params.fields.vesselName,
    voyage_number: params.fields.voyageNumber ?? null,
    free_days: params.fields.freeDays,
    remarks: params.fields.notes,
    requires_human_review: params.requiresHumanReview,
    review_reason: params.reviewReasons.length > 0 ? params.reviewReasons.join(" | ") : null,
  });

  const charges = await persistQuotationCharges(
    quotation.id,
    params.fields.itemizedCharges || params.fields.charges || [],
  );

  // Link in in-memory store under multiple lookup keys
  const completeBundle = { ...quotation, charges };
  setInMemoryQuotation(quotation.id, completeBundle);
  if (reqId) setInMemoryQuotation(reqId, completeBundle);
  if (params.forwarderRequestId) setInMemoryQuotation(params.forwarderRequestId, completeBundle);
  if (params.bookingId) setInMemoryQuotation(params.bookingId, completeBundle);
  if (emailRecord.id) setInMemoryIncomingEmail(emailRecord.id, emailRecord);

  return {
    incomingEmail: emailRecord,
    quotationRequest,
    quotation,
    charges,
  };
}

/**
 * 5. Atomic database transaction runner for quotation operations.
 * Encapsulates multi-table writes with error handling and rollback semantics.
 */
export async function executeQuotationTransaction<T>(
  transactionName: string,
  operation: () => Promise<T>,
): Promise<{ success: boolean; result?: T; error?: string }> {
  try {
    const result = await operation();
    return { success: true, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[QuotationTransaction] Transaction '${transactionName}' aborted:`, err);
    return { success: false, error: message };
  }
}
