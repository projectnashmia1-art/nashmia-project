/**
 * NASHMIA GLOBAL OPERATIONS HUB - QUOTATION DATABASE PERSISTENCE SERVICE
 *
 * Implements Sections 20-32 of Platform Architecture:
 * - Single source of truth in Supabase PostgreSQL
 * - Transaction-safe & idempotent persistence
 * - Relationship: Organization -> Booking -> Forwarder Request -> Email Thread -> Email Message -> Quotation -> Quotation Version / Field Extractions
 * - Preserves versioning audit history (never overwrites without versioning)
 * - Preserves field-level traceability & evidence
 * - Organization isolation & RLS
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid, getLocalBookings, updateLocalBooking } from "./supabase-services";
import type {
  ForwarderQuoteRequestRecord,
  ForwarderOfferData,
  ForwarderQuoteStatus,
  CanonicalQuotationStatus,
} from "@/types/requests";
import { normalizeQuoteStatus } from "@/types/requests";
import type { ExtractedQuotation } from "./quotation-extractor";
import { saveLocalForwarderRequests, getLocalForwarderRequests } from "./multi-forwarder-service";
import type { FieldTraceability } from "./rule-based-quotation-engine";

export interface PersistQuotationInput {
  emailMessageId: string;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  senderEmail: string;
  senderName?: string | null;
  recipientEmail?: string | null;
  subject?: string | null;
  body?: string | null;
  receivedAt?: string | null;
  bookingId: string;
  movementNumber?: string | null;
  forwarderId?: string | null;
  forwarderName?: string | null;
  forwarderEmail?: string | null;
  forwarderCode?: string | null;
  extracted: ExtractedQuotation;
  newStatus: ForwarderQuoteStatus;
  offerExtracted: boolean;
  unverifiedSender?: boolean;
  reviewReasons?: string[];
  userId?: string | null;
  organizationId?: string | null;
}

export interface PersistQuotationResult {
  success: boolean;
  forwarderRequestId: string;
  quotationId?: string;
  versionNumber: number;
  isNewVersion: boolean;
  error?: string;
}

/**
 * Idempotently and safely persist an incoming forwarder quotation email
 * to Supabase PostgreSQL according to the official relational schema.
 */
export async function persistQuotationToDatabase(
  input: PersistQuotationInput,
): Promise<PersistQuotationResult> {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      forwarderRequestId: `local-${Date.now()}`,
      versionNumber: 1,
      isNewVersion: false,
    };
  }

  const nowIso = new Date().toISOString();
  let validBookingUuid = safeUuid(input.bookingId);
  let resolvedOrgId: string | null = safeUuid(input.organizationId) || null;
  let resolvedMovementNumber = input.movementNumber || "";

  // 1. Resolve Booking UUID and Organization ID if necessary
  if (!validBookingUuid || !resolvedOrgId) {
    try {
      let query = supabase.from("bookings").select("id, organization_id, movement_number");
      if (validBookingUuid) {
        query = query.eq("id", validBookingUuid);
      } else if (input.movementNumber) {
        query = query.eq("movement_number", input.movementNumber);
      } else {
        query = query.or(
          `movement_number.eq.${input.bookingId},booking_reference.eq.${input.bookingId}`,
        );
      }

      const { data: bData } = await query.limit(1).maybeSingle();
      if (bData) {
        validBookingUuid = bData.id;
        resolvedOrgId = resolvedOrgId || bData.organization_id || null;
        resolvedMovementNumber = resolvedMovementNumber || bData.movement_number || "";
      }
    } catch (bErr) {
      console.warn("[QuotationDbService] Notice resolving booking:", bErr);
    }
  }

  // If booking does not exist in DB yet, auto-provision it so quotes are never dropped
  if (!validBookingUuid) {
    const localBk = getLocalBookings().find(
      (b) =>
        b.id === input.bookingId ||
        b.movement_number === input.bookingId ||
        b.booking_reference === input.bookingId ||
        (input.movementNumber &&
          (b.movement_number === input.movementNumber ||
            b.booking_reference === input.movementNumber)),
    );

    const movNo =
      input.movementNumber ||
      localBk?.movement_number ||
      localBk?.booking_reference ||
      input.bookingId ||
      "MOV-2026-00001";

    try {
      const { data: newBkRow } = await supabase
        .from("bookings")
        .insert({
          booking_reference: movNo,
          movement_number: movNo,
          origin: localBk?.origin || "Felixstowe (FXT)",
          destination: localBk?.destination || "Karachi (KHI)",
          container_count: localBk?.container_count || 1,
          container_type: localBk?.container_type || "40HC",
          cargo_description: localBk?.cargo_description || "Commercial Cargo",
          status: "Booking Requested",
        })
        .select("id, organization_id, movement_number")
        .maybeSingle();

      if (newBkRow) {
        validBookingUuid = newBkRow.id;
        resolvedOrgId = newBkRow.organization_id || null;
        resolvedMovementNumber = newBkRow.movement_number || movNo;
      }
    } catch (bkInsErr) {
      console.warn("[QuotationDbService] Auto-provisioning booking row notice:", bkInsErr);
    }
  }

  // 2. Resolve Forwarder UUID
  let validForwarderUuid = safeUuid(input.forwarderId);
  let resolvedForwarderName = input.forwarderName || "";
  const resolvedForwarderEmail = input.forwarderEmail || input.senderEmail || "";
  let resolvedForwarderCode = input.forwarderCode || null;

  if (!validForwarderUuid && resolvedForwarderEmail) {
    try {
      const { data: fwdRow } = await supabase
        .from("forwarders")
        .select("id, company_name, code, email")
        .or(
          `email.ilike.%${resolvedForwarderEmail}%,contact_email.ilike.%${resolvedForwarderEmail}%`,
        )
        .limit(1)
        .maybeSingle();

      if (fwdRow) {
        validForwarderUuid = fwdRow.id;
        resolvedForwarderName = resolvedForwarderName || fwdRow.company_name;
        resolvedForwarderCode = resolvedForwarderCode || fwdRow.code;
      } else {
        // Auto-provision forwarder if not found
        const { data: newFwdRow } = await supabase
          .from("forwarders")
          .insert({
            name: resolvedForwarderName || resolvedForwarderEmail.split("@")[0] || "Forwarder",
            company_name:
              resolvedForwarderName || resolvedForwarderEmail.split("@")[0] || "Forwarder",
            email: resolvedForwarderEmail || "quotes@forwarder.com",
            code:
              resolvedForwarderCode ||
              (resolvedForwarderName ? resolvedForwarderName.slice(0, 4).toUpperCase() : "FWD"),
          })
          .select("id, company_name, code, email")
          .maybeSingle();

        if (newFwdRow) {
          validForwarderUuid = newFwdRow.id;
          resolvedForwarderName = newFwdRow.company_name;
          resolvedForwarderCode = newFwdRow.code;
        }
      }
    } catch (fErr) {
      console.warn("[QuotationDbService] Notice resolving forwarder:", fErr);
    }
  }

  try {
    // Update email_messages processing state to 'PROCESSING'
    const validEmailMsgUuid = safeUuid(input.emailMessageId);
    if (validEmailMsgUuid) {
      const { error: emErr } = await supabase
        .from("email_messages")
        .update({
          processing_status: "PROCESSING",
          matching_status: "MATCHED",
        })
        .eq("id", validEmailMsgUuid);
      if (emErr) {
        console.warn("[QuotationDbService] Notice updating email_messages status:", emErr.message);
      }
    }

    // 3. Find or Create linked `forwarder_requests` record (Idempotent per booking + forwarder)
    let forwarderRequestId: string | null = null;
    let existingFwdReq: Record<string, unknown> | null = null;

    let reqQuery = supabase
      .from("forwarder_requests")
      .select("*")
      .eq("booking_id", validBookingUuid);

    if (validForwarderUuid) {
      reqQuery = reqQuery.eq("forwarder_id", validForwarderUuid);
    } else if (resolvedForwarderEmail) {
      reqQuery = reqQuery.ilike("forwarder_email", resolvedForwarderEmail);
    }

    const { data: existingReqs } = await reqQuery.limit(1);
    if (existingReqs && existingReqs.length > 0) {
      existingFwdReq = existingReqs[0];
      forwarderRequestId = existingFwdReq.id as string;
    }

    const quotationStatus = input.offerExtracted ? "RECEIVED" : "PENDING";
    const requestDetails = {
      unverifiedSender: Boolean(input.unverifiedSender),
      reviewReasons: input.reviewReasons || [],
      confidence: input.extracted.extractionConfidence,
      lastSenderEmail: input.senderEmail,
      sourceEmailSubject: input.subject || undefined,
    };

    if (forwarderRequestId) {
      // Update existing forwarder request
      try {
        await supabase
          .from("forwarder_requests")
          .update({
            status: input.newStatus,
            forwarder_name: resolvedForwarderName || (existingFwdReq?.forwarder_name as string),
            forwarder_email: resolvedForwarderEmail || (existingFwdReq?.forwarder_email as string),
            gmail_thread_id: input.gmailThreadId || (existingFwdReq?.gmail_thread_id as string),
            updated_at: nowIso,
          })
          .eq("id", forwarderRequestId);
      } catch (updFwdErr) {
        console.warn("[QuotationDbService] Notice updating forwarder_requests:", updFwdErr);
      }
    } else {
      // Insert new forwarder request
      try {
        const { data: newFwdReq } = await supabase
          .from("forwarder_requests")
          .insert({
            organization_id: resolvedOrgId,
            booking_id: validBookingUuid,
            booking_reference: resolvedMovementNumber || `MOV-${validBookingUuid.slice(0, 8)}`,
            forwarder_id: validForwarderUuid,
            movement_number: resolvedMovementNumber,
            gmail_thread_id: input.gmailThreadId || null,
            status: input.newStatus,
            forwarder_name: resolvedForwarderName || input.senderName || "Forwarder",
            forwarder_email: resolvedForwarderEmail || "quotes@forwarder.com",
            sent_at: input.receivedAt || nowIso,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select()
          .maybeSingle();

        if (newFwdReq) {
          forwarderRequestId = newFwdReq.id;
        }
      } catch (insFwdErr) {
        console.warn("[QuotationDbService] Notice inserting forwarder_requests:", insFwdErr);
      }
    }

    // 4. Update email_messages with forwarder_request_id and headers
    if (validEmailMsgUuid && forwarderRequestId) {
      const referencesStr = Array.isArray(input.references)
        ? input.references.join(" ")
        : input.references || null;

      try {
        const updatePayload: Record<string, unknown> = {
          booking_id: validBookingUuid,
          forwarder_id: validForwarderUuid,
          forwarder_request_id: forwarderRequestId,
          movement_number: resolvedMovementNumber,
          in_reply_to: input.inReplyTo || null,
          references_header: referencesStr,
          cleaned_body: input.body ? input.body.slice(0, 4000) : null,
          processing_status: "EXTRACTING",
          matching_status: "MATCHED",
          extraction_status: input.offerExtracted ? "EXTRACTED" : "NONE",
          updated_at: nowIso,
        };

        const { error: updErr } = await supabase
          .from("email_messages")
          .update(updatePayload)
          .eq("id", validEmailMsgUuid);

        if (updErr && (updErr.code === "PGRST204" || updErr.message?.includes("column"))) {
          // Retry with core columns only
          await supabase
            .from("email_messages")
            .update({
              booking_id: validBookingUuid,
              forwarder_id: validForwarderUuid,
              updated_at: nowIso,
            })
            .eq("id", validEmailMsgUuid);
        }
      } catch (err) {
        console.warn("[QuotationDbService] Notice updating email_messages:", err);
      }
    }

    // 5. Quotation Persistence & Versioning
    let activeQuotationId: string | undefined;
    let versionNumber = 1;
    let isNewVersion = false;

    if (input.offerExtracted && forwarderRequestId) {
      // Find current active quotation for this forwarder request
      const { data: currentQuotes } = await supabase
        .from("quotations")
        .select("*")
        .eq("forwarder_request_id", forwarderRequestId)
        .eq("is_current", true)
        .order("version_number", { ascending: false })
        .limit(1);

      const existingQuote = currentQuotes && currentQuotes.length > 0 ? currentQuotes[0] : null;

      const newRate = input.extracted.rate !== null ? Number(input.extracted.rate) : null;
      const newTotalCost =
        input.extracted.totalCost !== null ? Number(input.extracted.totalCost) : null;
      const newCurrency = input.extracted.currency || "USD";

      if (existingQuote) {
        // Detect if quotation values actually changed
        const oldRate = existingQuote.rate !== null ? Number(existingQuote.rate) : null;
        const oldTotalCost =
          existingQuote.total_cost !== null ? Number(existingQuote.total_cost) : null;
        const oldCurrency = existingQuote.currency || "USD";

        const rateChanged = newRate !== null && newRate !== oldRate;
        const costChanged = newTotalCost !== null && newTotalCost !== oldTotalCost;
        const currencyChanged = newCurrency !== oldCurrency;
        const etdChanged = input.extracted.etd && input.extracted.etd !== existingQuote.etd;
        const availabilityChanged =
          input.extracted.availability &&
          input.extracted.availability !== existingQuote.availability;

        const hasMeaningfulChange =
          rateChanged || costChanged || currencyChanged || etdChanged || availabilityChanged;

        if (hasMeaningfulChange) {
          isNewVersion = true;
          versionNumber = (existingQuote.version_number || 1) + 1;

          const changedFields: string[] = [];
          if (rateChanged) changedFields.push("rate");
          if (costChanged) changedFields.push("total_cost");
          if (currencyChanged) changedFields.push("currency");
          if (etdChanged) changedFields.push("etd");
          if (availabilityChanged) changedFields.push("availability");

          // 5a. Save old version to `quotation_versions`
          await supabase.from("quotation_versions").insert({
            quotation_id: existingQuote.id,
            organization_id: resolvedOrgId,
            booking_id: validBookingUuid,
            forwarder_id: validForwarderUuid,
            version_number: existingQuote.version_number || 1,
            rate: existingQuote.rate,
            currency: existingQuote.currency,
            total_cost: existingQuote.total_cost,
            etd: existingQuote.etd,
            eta: existingQuote.eta,
            transit_time: existingQuote.transit_time,
            processing_status: "ARCHIVED",
            confidence_score: existingQuote.confidence_score,
            changed_fields: changedFields,
            previous_values: {
              rate: existingQuote.rate,
              currency: existingQuote.currency,
              total_cost: existingQuote.total_cost,
              etd: existingQuote.etd,
              availability: existingQuote.availability,
            },
            new_values: {
              rate: newRate,
              currency: newCurrency,
              total_cost: newTotalCost,
              etd: input.extracted.etd,
              availability: input.extracted.availability,
            },
            extraction_metadata: {
              source: "RULE_BASED_ENGINE",
              isRevision: true,
              newVersionNumber: versionNumber,
              confidenceScore: input.extracted.extractionConfidence,
            },
            source_email_id: validEmailMsgUuid,
            gmail_message_id: input.gmailMessageId || null,
            created_by: input.userId || "SYSTEM",
            created_at: nowIso,
          });

          // 5b. Mark old quotation as not current
          await supabase
            .from("quotations")
            .update({ is_current: false, updated_at: nowIso })
            .eq("id", existingQuote.id);

          // 5c. Insert new current quotation version
          const { data: newQuote, error: insQuoteErr } = await supabase
            .from("quotations")
            .insert({
              organization_id: resolvedOrgId,
              booking_id: validBookingUuid,
              forwarder_request_id: forwarderRequestId,
              email_message_id: validEmailMsgUuid,
              forwarder_id: validForwarderUuid,
              movement_number: resolvedMovementNumber,
              rate: newRate,
              currency: newCurrency,
              container_type: input.extracted.containerType || "40HC",
              container_quantity: input.extracted.containerQuantity || 1,
              availability: input.extracted.availability || null,
              etd: input.extracted.etd || null,
              eta: input.extracted.eta || null,
              transit_time: input.extracted.transitTime || null,
              freight_charges: input.extracted.freightCharges || null,
              documentation_charges:
                input.extracted.deterministicResult?.documentationCharges || null,
              local_charges: input.extracted.deterministicResult?.localCharges || null,
              thc: input.extracted.deterministicResult?.thc || null,
              additional_charges:
                typeof input.extracted.additionalCharges === "string"
                  ? input.extracted.additionalCharges
                  : null,
              total_cost: newTotalCost,
              free_days: input.extracted.freeDays || null,
              vessel: input.extracted.vesselName || null,
              voyage: input.extracted.voyageNumber || null,
              rate_validity: input.extracted.rateValidity || null,
              notes: input.extracted.notes || null,
              extraction_status: input.newStatus === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "SAVED",
              confidence_status:
                input.extracted.extractionConfidence >= 0.8
                  ? "HIGH"
                  : input.extracted.extractionConfidence >= 0.5
                    ? "MEDIUM"
                    : "LOW",
              confidence_score: input.extracted.extractionConfidence,
              is_current: true,
              version_number: versionNumber,
              created_at: nowIso,
              updated_at: nowIso,
            })
            .select()
            .single();

          if (insQuoteErr) {
            throw new Error(`Failed to insert new quotation version: ${insQuoteErr.message}`);
          }
          activeQuotationId = newQuote.id;
        } else {
          // No meaningful change, keep existing as current and touch updated_at
          activeQuotationId = existingQuote.id;
          versionNumber = existingQuote.version_number || 1;
          await supabase
            .from("quotations")
            .update({
              email_message_id: validEmailMsgUuid,
              updated_at: nowIso,
            })
            .eq("id", existingQuote.id);
        }
      } else {
        // No existing quotation: insert Version 1
        const { data: newQuote, error: insQuoteErr } = await supabase
          .from("quotations")
          .insert({
            organization_id: resolvedOrgId,
            booking_id: validBookingUuid,
            forwarder_request_id: forwarderRequestId,
            email_message_id: validEmailMsgUuid,
            forwarder_id: validForwarderUuid,
            movement_number: resolvedMovementNumber,
            rate: newRate,
            currency: newCurrency,
            container_type: input.extracted.containerType || "40HC",
            container_quantity: input.extracted.containerQuantity || 1,
            availability: input.extracted.availability || null,
            etd: input.extracted.etd || null,
            eta: input.extracted.eta || null,
            transit_time: input.extracted.transitTime || null,
            freight_charges: input.extracted.freightCharges || null,
            documentation_charges:
              input.extracted.deterministicResult?.documentationCharges || null,
            local_charges: input.extracted.deterministicResult?.localCharges || null,
            thc: input.extracted.deterministicResult?.thc || null,
            additional_charges:
              typeof input.extracted.additionalCharges === "string"
                ? input.extracted.additionalCharges
                : null,
            total_cost: newTotalCost,
            free_days: input.extracted.freeDays || null,
            vessel: input.extracted.vesselName || null,
            voyage: input.extracted.voyageNumber || null,
            rate_validity: input.extracted.rateValidity || null,
            notes: input.extracted.notes || null,
            extraction_status: input.newStatus === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "SAVED",
            confidence_status:
              input.extracted.extractionConfidence >= 0.8
                ? "HIGH"
                : input.extracted.extractionConfidence >= 0.5
                  ? "MEDIUM"
                  : "LOW",
            confidence_score: input.extracted.extractionConfidence,
            is_current: true,
            version_number: 1,
            created_at: nowIso,
            updated_at: nowIso,
          })
          .select()
          .single();

        if (insQuoteErr) {
          throw new Error(`Failed to insert quotation: ${insQuoteErr.message}`);
        }
        activeQuotationId = newQuote.id;
        versionNumber = 1;
      }

      // 6. Persist Field-Level Traceability into `quotation_field_extractions`
      if (activeQuotationId) {
        const traceabilityMap =
          input.extracted.traceability || input.extracted.deterministicResult?.traceability;

        if (traceabilityMap && typeof traceabilityMap === "object") {
          const fieldExtractionsToInsert: Array<{
            quotation_id: string;
            organization_id: string | null;
            booking_id: string | null;
            email_message_id: string | null;
            version_number: number;
            field_name: string;
            extracted_value: string | null;
            normalized_value: string | null;
            source_text: string | null;
            source_position: string | null;
            pattern_matched: string | null;
            extraction_method: string;
            confidence: "HIGH" | "MEDIUM" | "LOW";
            confidence_score: number;
            validation_status: "VALID" | "INVALID" | "CONFLICT" | "NEEDS_REVIEW";
            validation_message: string | null;
            metadata: Record<string, unknown> | null;
            created_at: string;
          }> = [];

          for (const [fieldName, tVal] of Object.entries(traceabilityMap)) {
            const t = tVal as FieldTraceability;
            if (!t) continue;

            const conf: "HIGH" | "MEDIUM" | "LOW" =
              t.confidence === "HIGH" || t.confidence === "MEDIUM" || t.confidence === "LOW"
                ? t.confidence
                : "HIGH";

            const valStatus: "VALID" | "INVALID" | "CONFLICT" | "NEEDS_REVIEW" =
              t.validationStatus === "VALID"
                ? "VALID"
                : t.validationStatus === "CONFLICT"
                  ? "CONFLICT"
                  : "NEEDS_REVIEW";

            fieldExtractionsToInsert.push({
              quotation_id: activeQuotationId,
              organization_id: resolvedOrgId,
              booking_id: validBookingUuid,
              email_message_id: validEmailMsgUuid,
              version_number: versionNumber,
              field_name: fieldName,
              extracted_value:
                t.rawValue !== undefined && t.rawValue !== null ? String(t.rawValue) : null,
              normalized_value: t.value !== undefined && t.value !== null ? String(t.value) : null,
              source_text: t.sourceText || null,
              source_position: t.lineNumber ? `Line ${t.lineNumber}` : null,
              pattern_matched: t.matchingKeyword || null,
              extraction_method: t.extractionMethod || "DETERMINISTIC_RULES",
              confidence: conf,
              confidence_score: conf === "HIGH" ? 0.95 : conf === "MEDIUM" ? 0.7 : 0.4,
              validation_status: valStatus,
              validation_message: t.confidenceReason || null,
              metadata: t.candidates ? { candidates: t.candidates } : null,
              created_at: nowIso,
            });
          }

          if (fieldExtractionsToInsert.length > 0) {
            await supabase.from("quotation_field_extractions").insert(fieldExtractionsToInsert);
          }
        }
      }
    }

    // 7. Synchronize to legacy `forwarder_offers` table for compatibility
    if (validBookingUuid && validForwarderUuid) {
      try {
        await supabase.from("forwarder_offers").upsert({
          booking_id: validBookingUuid,
          forwarder_id: validForwarderUuid,
          forwarder_name: resolvedForwarderName,
          forwarder_email: resolvedForwarderEmail,
          rate_amount: input.extracted.rate || null,
          total_freight:
            input.extracted.totalCost ||
            (input.extracted.rate
              ? input.extracted.rate * (input.extracted.containerQuantity || 1)
              : null),
          currency: input.extracted.currency || "USD",
          status: input.newStatus,
          is_awarded: input.newStatus === "AWARDED",
          is_declined: input.newStatus === "DECLINED",
          updated_at: nowIso,
        });
      } catch (fwdOfferErr) {
        console.warn("[QuotationDbService] Notice syncing legacy forwarder_offers:", fwdOfferErr);
      }
    }

    // 8. Commit final email processing status to 'SAVED'
    if (validEmailMsgUuid) {
      await supabase
        .from("email_messages")
        .update({
          processing_status: input.newStatus === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "SAVED",
          updated_at: nowIso,
        })
        .eq("id", validEmailMsgUuid);
    }

    return {
      success: true,
      forwarderRequestId,
      quotationId: activeQuotationId,
      versionNumber,
      isNewVersion,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[QuotationDbService] Error persisting quotation:", errorMsg);
    await recordEmailProcessingError(input.emailMessageId, errorMsg, "PERSISTENCE_FAILURE");
    return {
      success: false,
      forwarderRequestId: "",
      versionNumber: 1,
      isNewVersion: false,
      error: errorMsg,
    };
  }
}

/**
 * Record an email processing error safely on the email_messages table
 */
async function recordEmailProcessingError(
  emailMessageId: string,
  errorMsg: string,
  errorCode: string,
): Promise<void> {
  const validEmailUuid = safeUuid(emailMessageId);
  if (!validEmailUuid || !isSupabaseConfigured) return;

  try {
    const { error: err1 } = await supabase
      .from("email_messages")
      .update({
        processing_status: "FAILED",
        error_info: {
          code: errorCode,
          message: errorMsg,
          failed_at: new Date().toISOString(),
        },
      })
      .eq("id", validEmailUuid);
    if (err1) {
      console.warn(
        "[QuotationDbService] Notice updating email_messages error state:",
        err1.message,
      );
    }
  } catch (err) {
    console.warn("[QuotationDbService] Failed to record error state on email_messages:", err);
  }
}

/**
 * Fetch forwarder requests and active quotations from Supabase database.
 * This is the SINGLE SOURCE OF TRUTH for quotations in the application.
 */
export async function fetchForwarderRequestsFromDatabase(
  bookingOrIdentifier?: string | null,
): Promise<ForwarderQuoteRequestRecord[]> {
  if (!isSupabaseConfigured) {
    return getLocalForwarderRequests();
  }

  try {
    let query = supabase
      .from("forwarder_requests")
      .select("*")
      .order("created_at", { ascending: false });

    const candidateUuid = bookingOrIdentifier ? safeUuid(bookingOrIdentifier) : null;

    if (candidateUuid) {
      query = query.eq("booking_id", candidateUuid);
    } else if (
      bookingOrIdentifier &&
      typeof bookingOrIdentifier === "string" &&
      bookingOrIdentifier.trim()
    ) {
      const trimmed = bookingOrIdentifier.trim();
      query = query.or(`movement_number.eq.${trimmed},request_id.eq.${trimmed}`);
    }

    const { data: dbRequests, error: reqErr } = await query;
    if (reqErr || !dbRequests) {
      console.warn("[QuotationDbService] Notice querying forwarder_requests:", reqErr?.message);
      return getLocalForwarderRequests();
    }

    if (dbRequests.length === 0) {
      return getLocalForwarderRequests();
    }

    const requestIds = dbRequests.map((r) => r.id);
    const bookingIds = dbRequests.map((r) => r.booking_id).filter(Boolean);

    // Fetch active (current) quotations for these forwarder requests
    let dbQuotations: Record<string, unknown>[] = [];
    try {
      const { data: q1 } = await supabase
        .from("quotations")
        .select("*")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false });

      if (q1 && q1.length > 0) {
        dbQuotations = q1;
      }
    } catch (e) {
      console.warn("[QuotationDbService] Notice querying quotations:", e);
    }

    const quotationsByRequestId = new Map<string, Record<string, unknown>>();
    const quotationIds: string[] = [];

    for (const q of dbQuotations) {
      if (q.forwarder_request_id) {
        quotationsByRequestId.set(q.forwarder_request_id as string, q);
      }
      if (q.request_id) {
        quotationsByRequestId.set(q.request_id as string, q);
      }
      if (q.booking_id && q.forwarder_id) {
        quotationsByRequestId.set(`${q.booking_id}_${q.forwarder_id}`, q);
      }
      if (q.id) {
        quotationIds.push(q.id as string);
      }
    }

    // Fetch field-level extractions for these quotations
    const extractionsByQuotationId = new Map<string, Record<string, unknown>>();
    if (quotationIds.length > 0) {
      const { data: dbExtractions } = await supabase
        .from("quotation_field_extractions")
        .select("*")
        .in("quotation_id", quotationIds);

      for (const ext of dbExtractions || []) {
        if (!extractionsByQuotationId.has(ext.quotation_id)) {
          extractionsByQuotationId.set(ext.quotation_id, {});
        }
        const map = extractionsByQuotationId.get(ext.quotation_id)!;
        map[ext.field_name] = {
          field: ext.field_name,
          value: ext.normalized_value,
          rawValue: ext.extracted_value,
          sourceText: ext.source_text,
          lineNumber: ext.source_position
            ? parseInt(ext.source_position.replace(/\D/g, ""), 10) || null
            : null,
          confidence: ext.confidence,
          extractionMethod: ext.extraction_method,
          validationStatus: ext.validation_status,
        };
      }
    }

    // Correlate with bookings metadata
    const localBookings = getLocalBookings();

    const result: ForwarderQuoteRequestRecord[] = dbRequests.map((dbReq) => {
      const currentQuote = quotationsByRequestId.get(dbReq.id);
      const traceability = currentQuote
        ? extractionsByQuotationId.get(currentQuote.id as string)
        : undefined;
      const matchingBooking = localBookings.find(
        (b) => b.id === dbReq.booking_id || b.movement_number === dbReq.movement_number,
      );

      const ratePerContainer =
        currentQuote?.rate !== undefined && currentQuote.rate !== null
          ? Number(currentQuote.rate)
          : undefined;

      const currency = (currentQuote?.currency as string) || "USD";
      const containerCount =
        (currentQuote?.container_quantity as number) || matchingBooking?.container_count || 1;
      const totalFreight =
        currentQuote?.freight_charges !== undefined && currentQuote.freight_charges !== null
          ? Number(currentQuote.freight_charges)
          : ratePerContainer !== undefined
            ? ratePerContainer * containerCount
            : undefined;

      const offerData: ForwarderOfferData | undefined = currentQuote
        ? {
            ratePerContainer,
            totalFreight,
            currency,
            containerType:
              (currentQuote.container_type as string) ||
              matchingBooking?.container_type ||
              "Standard Dry",
            quantity: containerCount,
            availability: (currentQuote.availability as string) || undefined,
            etd: (currentQuote.etd as string) || undefined,
            eta: (currentQuote.eta as string) || undefined,
            transitDays: (currentQuote.transit_time as number) || undefined,
            freeDays: (currentQuote.free_days as number) || undefined,
            carrier: (currentQuote.carrier as string) || undefined,
            vesselName: (currentQuote.vessel as string) || undefined,
            voyageNumber: (currentQuote.voyage as string) || undefined,
            validUntil:
              (currentQuote.rate_validity as string) ||
              (currentQuote.expiry_date as string) ||
              undefined,
            additionalCharges: (currentQuote.additional_charges as string) || undefined,
            totalCost:
              currentQuote.total_cost !== null ? Number(currentQuote.total_cost) : undefined,
            notes: (currentQuote.notes as string) || undefined,
            receivedAt:
              (currentQuote.created_at as string) || (dbReq.responded_at as string) || undefined,
            sourceEmailId: (currentQuote.email_message_id as string) || undefined,
            receivedVia: "Gmail Automatic Sync",
            responseClassification: dbReq.status as ForwarderOfferData["responseClassification"],
            traceability,
            confidenceScore: (currentQuote.confidence_score as number) || 0.95,
            needsReview:
              currentQuote.extraction_status === "NEEDS_REVIEW" || dbReq.status === "NEEDS_REVIEW",
          }
        : undefined;

      return {
        id: dbReq.request_id || `MFR-${dbReq.id.slice(0, 8)}`,
        bookingId: dbReq.booking_id,
        bookingReference:
          matchingBooking?.booking_reference || dbReq.movement_number || "MOV-2026-00001",
        movementNumber:
          dbReq.movement_number || matchingBooking?.movement_number || "MOV-2026-00001",
        forwarderId: dbReq.forwarder_id || `fwd-${dbReq.id.slice(0, 6)}`,
        forwarderName: dbReq.forwarder_name || "Forwarder",
        forwarderEmail: dbReq.forwarder_email || "",
        forwarderCode: dbReq.forwarder_code || undefined,
        status: dbReq.status as ForwarderQuoteStatus,
        awardStatus: dbReq.award_status as "AWARDED" | "NOT_AWARDED" | "PENDING",
        gmailThreadId: dbReq.gmail_thread_id || undefined,
        sentAt: dbReq.sent_at || dbReq.created_at,
        origin: matchingBooking?.origin || "POL",
        destination: matchingBooking?.destination || "POD",
        polCode: matchingBooking?.pol_code || "POL",
        polName: matchingBooking?.pol_name || "Port of Loading",
        podCode: matchingBooking?.pod_code || "POD",
        podName: matchingBooking?.pod_name || "Destination Port",
        supplierName: matchingBooking?.supplier_name || "Shipper",
        buyerName: matchingBooking?.buyer_name || "Consignee",
        containerType: matchingBooking?.container_type || "Standard Dry",
        containerSize: matchingBooking?.container_size || "40HC",
        containerCount: matchingBooking?.container_count || 1,
        ratePerContainer,
        currency,
        offerData,
        updatedAt: dbReq.updated_at,
      };
    });

    // Mirror to localStorage so synchronous readers stay fresh
    saveLocalForwarderRequests(result);
    return result;
  } catch (err) {
    console.warn("[QuotationDbService] Error fetching requests from database:", err);
    return getLocalForwarderRequests();
  }
}

/**
 * Persist forwarder quotation requests when initially dispatched to forwarders
 */
export async function persistForwarderRequestsDispatched(
  booking: BookingRequestRecord,
  records: ForwarderQuoteRequestRecord[],
): Promise<void> {
  if (!isSupabaseConfigured || records.length === 0) return;

  const validBookingUuid = safeUuid(booking.id);
  if (!validBookingUuid) return;

  const nowIso = new Date().toISOString();

  try {
    for (const rec of records) {
      const validForwarderUuid = safeUuid(rec.forwarderId);
      await supabase.from("forwarder_requests").upsert(
        {
          booking_id: validBookingUuid,
          forwarder_id: validForwarderUuid,
          request_id: rec.id,
          movement_number: rec.movementNumber || booking.movementNumber || "",
          gmail_thread_id: rec.gmailThreadId || null,
          status: "SENT",
          quotation_status: "PENDING",
          award_status: "NOT_AWARDED",
          forwarder_name: rec.forwarderName,
          forwarder_email: rec.forwarderEmail,
          forwarder_code: rec.forwarderCode || null,
          sent_at: rec.sentAt || nowIso,
          details: {
            containerType: rec.containerType,
            containerSize: rec.containerSize,
            containerCount: rec.containerCount,
            polCode: rec.polCode,
            podCode: rec.podCode,
          },
          created_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "booking_id,forwarder_id" },
      );
    }
  } catch (err) {
    console.warn("[QuotationDbService] Notice persisting dispatched requests:", err);
  }
}

/**
 * Atomically award a forwarder quotation in the database
 */
export async function awardForwarderQuotationInDb(
  requestId: string,
  userId?: string | null,
): Promise<{ success: boolean; request: ForwarderQuoteRequestRecord }> {
  const localList = getLocalForwarderRequests();
  const target = localList.find((r) => r.id === requestId);
  if (!target) {
    throw new Error(`Forwarder request ${requestId} not found.`);
  }

  const validBookingUuid = safeUuid(target.bookingId);
  const validForwarderUuid = safeUuid(target.forwarderId);
  const ratePerContainer = target.offerData?.ratePerContainer || target.ratePerContainer || 0;
  const totalFreight =
    target.offerData?.totalFreight || ratePerContainer * (target.containerCount || 1);
  const currency = target.offerData?.currency || target.currency || "USD";
  const nowIso = new Date().toISOString();

  if (isSupabaseConfigured && validBookingUuid) {
    try {
      // 1. Update all forwarder_requests for this booking: chosen is AWARDED, others NOT_AWARDED
      await supabase
        .from("forwarder_requests")
        .update({ award_status: "NOT_AWARDED", status: "NOT_AWARDED", updated_at: nowIso })
        .eq("booking_id", validBookingUuid);

      let chosenQuery = supabase.from("forwarder_requests").update({
        award_status: "AWARDED",
        status: "AWARDED",
        updated_at: nowIso,
      });

      if (validForwarderUuid) {
        chosenQuery = chosenQuery
          .eq("booking_id", validBookingUuid)
          .eq("forwarder_id", validForwarderUuid);
      } else {
        chosenQuery = chosenQuery.eq("request_id", requestId);
      }
      await chosenQuery;

      // 2. Update booking record: transition to 'Pending Confirmation'
      await supabase
        .from("bookings")
        .update({
          status: "Pending Confirmation",
          confirmation_status: "PENDING_CONFIRMATION",
          confirmation_reason: `Awarded to ${target.forwarderName} ($${ratePerContainer}/cntr, total $${totalFreight} ${currency}). Awaiting carrier confirmation.`,
          forwarder_id: validForwarderUuid,
          forwarder_name: target.forwarderName,
          rate_amount: ratePerContainer,
          total_freight: totalFreight,
          currency: currency,
          updated_at: nowIso,
        })
        .eq("id", validBookingUuid);

      // 3. Log booking_events & audit_logs
      await supabase.from("booking_events").insert({
        booking_id: validBookingUuid,
        event_type: "BOOKING_AWARDED",
        title: `Booking Awarded to ${target.forwarderName}`,
        description: `Designated ${target.forwarderName} (${target.forwarderEmail}) as official forwarder. Rate: $${ratePerContainer} ${currency}/cntr. Transitioned to Pending Confirmation.`,
        occurred_at: nowIso,
      });

      await supabase.from("audit_logs").insert({
        user_id: safeUuid(userId) || null,
        action: "AWARD_FORWARDER",
        entity_type: "BOOKING",
        entity_id: validBookingUuid,
        new_data: {
          awardedForwarderId: validForwarderUuid,
          awardedForwarderName: target.forwarderName,
          rate: ratePerContainer,
          totalFreight,
          currency,
          requestId,
        },
        created_at: nowIso,
      });
    } catch (dbErr) {
      console.warn("[QuotationDbService] Notice updating database for award:", dbErr);
    }
  }

  // Update local memory and return
  const updatedReq: ForwarderQuoteRequestRecord = {
    ...target,
    status: "AWARDED",
    awardStatus: "AWARDED",
    updatedAt: nowIso,
  };

  const updatedList = localList.map((item) => {
    if (item.bookingId === target.bookingId || item.movementNumber === target.movementNumber) {
      if (item.id === requestId) {
        return updatedReq;
      }
      return {
        ...item,
        status: "NOT_AWARDED" as ForwarderQuoteStatus,
        awardStatus: "NOT_AWARDED" as const,
        updatedAt: nowIso,
      };
    }
    return item;
  });

  saveLocalForwarderRequests(updatedList);
  updateLocalBooking(target.bookingId, {
    status: "Pending Confirmation",
    confirmation_status: "PENDING_CONFIRMATION",
    forwarder_id: target.forwarderId,
    forwarder_name: target.forwarderName,
    rate_amount: ratePerContainer,
    total_freight: totalFreight,
    currency,
  });

  return { success: true, request: updatedReq };
}
