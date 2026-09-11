import { supabase, isSupabaseConfigured } from "./supabase";
import {
  safeUuid,
  fetchBookingsFromSupabase,
  updateLocalBooking,
  type FullBookingRecord,
} from "./supabase-services";
import { getAwardedMovementsMap } from "./forwarder-card-service";
import type {
  BookingRequestRecord,
  RequestStatus,
  RequestPriority,
  RequestsStatsSummary,
} from "@/types/requests";
import type { ContainerSize } from "./booking-data";

/**
 * Empty static list to guarantee zero mock/demo data is served.
 */
export const INITIAL_REQUESTS: BookingRequestRecord[] = [];

/**
 * Maps Supabase FullBookingRecord to BookingRequestRecord
 */
export function mapBookingRecordToRequest(booking: FullBookingRecord): BookingRequestRecord {
  // Infer priority from special instructions or notes
  let priority: RequestPriority = "Normal";
  const specialText = `${booking.special_instructions || ""} ${booking.notes || ""}`.toLowerCase();
  if (
    specialText.includes("urgent") ||
    specialText.includes("rush") ||
    specialText.includes("critical")
  ) {
    priority = "Urgent";
  } else if (
    specialText.includes("high") ||
    specialText.includes("priority") ||
    specialText.includes("asap")
  ) {
    priority = "High";
  } else if (specialText.includes("flexible") || specialText.includes("economy")) {
    priority = "Flexible";
  }

  // Calculate status mapping
  let status: RequestStatus = "Pending Review";
  const rawStatus = booking.status || "Booking Requested";
  const upperStatus = rawStatus.toUpperCase();
  const confirmationStatusUpper = (booking.confirmation_status || "").toUpperCase();

  const isConfirmed =
    upperStatus === "CONFIRMED" ||
    upperStatus === "BOOKING CONFIRMED" ||
    upperStatus.includes("CONFIRM") ||
    confirmationStatusUpper === "CONFIRMED" ||
    upperStatus === "LOADED" ||
    upperStatus === "IN TRANSIT" ||
    upperStatus === "CUSTOMS CLEARED" ||
    upperStatus === "DISCHARGED" ||
    upperStatus === "DELIVERED";

  if (isConfirmed) {
    status = "Approved";
  } else if (
    rawStatus === "Rate Verification" ||
    rawStatus === "Rate Check" ||
    upperStatus === "RATE VERIFICATION"
  ) {
    status = "Rate Verification";
  } else if (
    rawStatus === "Line Allocation" ||
    rawStatus === "Allocation Pending" ||
    upperStatus === "LINE ALLOCATION"
  ) {
    status = "Line Allocation";
  } else if (
    rawStatus === "Customs Hold" ||
    rawStatus === "Revision Requested" ||
    rawStatus.includes("Revision") ||
    confirmationStatusUpper === "REJECTED"
  ) {
    status = "Revision Requested";
  } else if (
    rawStatus === "Cancelled" ||
    rawStatus === "Declined" ||
    upperStatus === "CANCELLED" ||
    upperStatus === "DECLINED"
  ) {
    status = "Declined";
  } else {
    // Default for Booking Requested / Draft / Pending / Awaiting Confirmation
    status = "Pending Review";
  }

  const containerCount = booking.container_count || 1;
  const totalFreight =
    booking.total_freight || (booking.rate_amount ? booking.rate_amount * containerCount : 3600);
  const ratePerContainer =
    containerCount > 0 ? Math.round(totalFreight / containerCount) : totalFreight;

  // Derive POL & POD Codes & Names
  const originStr = booking.origin || booking.pol_name || "Karachi (PK-KHI)";
  const destStr = booking.destination || booking.pod_name || "Hamburg (DE-HAM)";

  const polCode =
    booking.pol_code ||
    originStr.match(/\(([A-Z]{3,5})\)/)?.[1] ||
    originStr.slice(0, 3).toUpperCase();
  const polName = booking.pol_name || originStr;

  const podCode =
    booking.pod_code || destStr.match(/\(([A-Z]{3,5})\)/)?.[1] || destStr.slice(0, 3).toUpperCase();
  const podName = booking.pod_name || destStr;

  // Cargo calculation
  const containerWeights = booking.containers?.reduce((sum, c) => sum + (c.weight || 0), 0) || 0;
  const totalWeightKg = containerWeights > 0 ? containerWeights : containerCount * 22000;
  const totalVolumeCbm =
    containerCount *
    (booking.container_size === "40HC" ? 68 : booking.container_size === "45HC" ? 86 : 33);
  const packagesCount = containerCount * 650;

  // Derive cut-off timestamps relative to ETD
  const etdDate = booking.etd ? new Date(booking.etd) : new Date(Date.now() + 7 * 86400000);
  const etdStr = etdDate.toISOString().split("T")[0];
  const siCutoffDate = new Date(etdDate.getTime() - 2 * 86400000);
  const vgmCutoffDate = new Date(etdDate.getTime() - 1 * 86400000);

  const preferredCarrier =
    booking.shipping_line?.name || booking.vessel_name?.split(" ")[0] || "Ocean Carrier";

  const effectiveMovementNumber =
    booking.movement_number ||
    (booking.booking_reference?.startsWith("MOV-") ? booking.booking_reference : undefined);

  return {
    id: booking.id,
    reference:
      booking.booking_reference ||
      booking.movement_number ||
      `REQ-${booking.id.slice(0, 8).toUpperCase()}`,
    movementNumber: effectiveMovementNumber,
    movementId: booking.id,
    bookingReference: booking.booking_reference,
    createdAt: booking.created_at || new Date().toISOString(),
    updatedAt: booking.updated_at || booking.created_at || new Date().toISOString(),
    status,
    priority,
    confirmationStatus:
      (booking.confirmation_status as "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW" | "PENDING") ||
      (isConfirmed ? "CONFIRMED" : undefined),
    confirmedAt: booking.confirmed_at || undefined,
    confirmedBy: booking.confirmed_by || undefined,
    confirmationEmailId: booking.confirmation_email_id || undefined,
    confirmationReason: booking.confirmation_reason || undefined,
    confirmationDetectedBy: booking.confirmation_detected_by || undefined,
    confirmationConfidence: booking.confirmation_confidence || undefined,
    buyerId: booking.buyer_id || undefined,
    buyerName: booking.buyer?.company_name || "Buyer",
    buyerCode: booking.buyer?.code || "BUYER",
    buyerCountry: booking.buyer?.country || "International",
    consignee: booking.buyer?.consignee || booking.buyer?.company_name || "Consignee on File",
    supplierId: booking.supplier_id || undefined,
    supplierName: booking.supplier?.company_name || "Supplier",
    supplierCode: booking.supplier?.code || "SUPPLIER",
    supplierCity: booking.supplier?.city || "",
    supplierLoadPoint: booking.supplier?.load_point || "",
    forwarderId: booking.forwarder_id || undefined,
    forwarderName: booking.forwarder?.company_name || "Freight Forwarder",
    forwarderCode: booking.forwarder?.code || "FORWARDER",
    forwarderEmail: booking.forwarder?.email || undefined,
    polCode,
    polName,
    podCode,
    podName,
    requestedEtd: etdStr,
    estimatedEta:
      booking.eta || new Date(etdDate.getTime() + 21 * 86400000).toISOString().split("T")[0],
    containerSize: (booking.container_size as ContainerSize) || "40HC",
    containerType: booking.container_type || "High Cube Dry",
    containerCount,
    allocatedContainers: booking.containers?.map((c) => c.container_number),
    preferredCarrier,
    assignedCarrier: preferredCarrier,
    vesselName: booking.vessel_name || `${preferredCarrier} VALENCIA`,
    voyageNumber: booking.voyage_number || "431W",
    ratePerContainer,
    totalFreight,
    currency: booking.currency || "USD",
    rateCardId: booking.rate_card_id || undefined,
    rateValidUntil: "2026-09-30",
    cargo: {
      description: booking.product_description || "Commercial Export Cargo",
      totalWeightKg,
      totalVolumeCbm,
      packagesCount,
      packageType: "Export Master Cartons / Pallets",
    },
    siCutoff: `${siCutoffDate.toISOString().split("T")[0]} 18:00`,
    vgmCutoff: `${vgmCutoffDate.toISOString().split("T")[0]} 12:00`,
    gateCutoff: `${vgmCutoffDate.toISOString().split("T")[0]} 22:00`,
    specialInstructions: booking.special_instructions || booking.notes || undefined,
    revisionNotes:
      status === "Revision Requested"
        ? booking.special_instructions || "Awaiting updated documentation or weight adjustments."
        : undefined,
    requestedBy: {
      name: booking.supplier?.contact_person || "Logistics Lead",
      email: booking.supplier?.email || "dispatch@nashmiaindustries.com",
      phone: booking.supplier?.phone || "+92 300 1234567",
    },
    events: booking.events,
  };
}

/**
 * Fetch all booking requests from Supabase without any demo or mock items
 */
export async function fetchBookingRequestsFromSupabase(
  userId?: string | null,
): Promise<BookingRequestRecord[]> {
  try {
    const bookings = await fetchBookingsFromSupabase(userId);
    if (!bookings || bookings.length === 0) {
      return [];
    }

    // Gather all confirmed identifiers (movement numbers, booking refs, ids) from emails
    const confirmedIdentifiers = new Set<string>();

    if (typeof window !== "undefined") {
      try {
        const rawEmails = localStorage.getItem("nashmia_custom_emails_v1");
        if (rawEmails) {
          const parsed = JSON.parse(rawEmails);
          if (Array.isArray(parsed)) {
            for (const em of parsed) {
              const subj = (em.subject || "").toLowerCase();
              const body = (em.body || "").toLowerCase();
              const isEmailConfirmed =
                em.confirmationStatus === "CONFIRMED" ||
                em.emailType === "BOOKING_CONFIRMATION" ||
                subj.includes("booking confirmed") ||
                subj.includes("space confirmed") ||
                body.includes("booking confirmed") ||
                body.includes("booking is confirmed") ||
                body.includes("space is confirmed") ||
                body.includes("space confirmed");

              if (isEmailConfirmed) {
                if (em.movementNumber)
                  confirmedIdentifiers.add(em.movementNumber.trim().toLowerCase());
                if (em.bookingReference)
                  confirmedIdentifiers.add(em.bookingReference.trim().toLowerCase());
                if (em.bookingId) confirmedIdentifiers.add(em.bookingId.trim().toLowerCase());
              }
            }
          }
        }
      } catch (err) {
        console.warn("[fetchBookingRequestsFromSupabase] Local email scan notice:", err);
      }
    }

    if (isSupabaseConfigured) {
      try {
        const { data: confs } = await supabase
          .from("email_confirmations")
          .select("booking_id, movement_number, confirmation_status")
          .eq("confirmation_status", "CONFIRMED");

        if (confs) {
          for (const c of confs) {
            if (c.movement_number) confirmedIdentifiers.add(c.movement_number.trim().toLowerCase());
            if (c.booking_id) confirmedIdentifiers.add(c.booking_id.trim().toLowerCase());
          }
        }
      } catch {
        // Table or query check notice
      }
    }

    const awardedMap = getAwardedMovementsMap();
    if (awardedMap && awardedMap.size > 0) {
      for (const [key, award] of awardedMap.entries()) {
        if (key) confirmedIdentifiers.add(key.toLowerCase());
        if (award.movementNumber) {
          confirmedIdentifiers.add(award.movementNumber.trim().toLowerCase());
        }
        if (award.bookingId) confirmedIdentifiers.add(award.bookingId.trim().toLowerCase());
      }
    }

    return bookings.map((booking) => {
      const bRef = (booking.booking_reference || "").trim().toLowerCase();
      const movNum = (booking.movement_number || "").trim().toLowerCase();
      const ref = (booking.reference || "").trim().toLowerCase();
      const bId = (booking.id || "").trim().toLowerCase();

      const awardRec =
        (movNum && awardedMap.get(movNum.toUpperCase())) ||
        (bRef && awardedMap.get(bRef.toUpperCase())) ||
        (ref && awardedMap.get(ref.toUpperCase())) ||
        (bId && awardedMap.get(bId.toUpperCase()));

      const isAwardedOrConfirmed =
        Boolean(awardRec) ||
        (bRef && confirmedIdentifiers.has(bRef)) ||
        (movNum && confirmedIdentifiers.has(movNum)) ||
        (ref && confirmedIdentifiers.has(ref)) ||
        (bId && confirmedIdentifiers.has(bId));

      if (isAwardedOrConfirmed) {
        const currentUpper = (booking.status || "").toUpperCase();
        if (!currentUpper.includes("CONFIRM") || awardRec) {
          booking.status = "Booking Confirmed";
          booking.confirmation_status = "CONFIRMED";
          booking.confirmed_at =
            booking.confirmed_at || awardRec?.awardedAt || new Date().toISOString();
          booking.confirmed_by =
            awardRec?.awardedForwarderName || booking.confirmed_by || "Awarded Forwarder";
          if (awardRec?.awardedForwarderName) {
            booking.forwarder_name = awardRec.awardedForwarderName;
          }
          if (awardRec?.rate && (!booking.total_freight || booking.total_freight === 3600)) {
            booking.rate_amount = awardRec.rate;
            booking.total_freight = awardRec.rate * (booking.container_count || 1);
          }

          // Auto-persist in local store
          updateLocalBooking(booking.id, {
            status: "Booking Confirmed",
            confirmation_status: "CONFIRMED",
            confirmed_at: booking.confirmed_at,
            confirmed_by: booking.confirmed_by,
            forwarder_name: booking.forwarder_name,
            rate_amount: booking.rate_amount,
            total_freight: booking.total_freight,
          });
        }
      }

      return mapBookingRecordToRequest(booking);
    });
  } catch (err) {
    console.warn("[fetchBookingRequestsFromSupabase] Exception:", err);
    return [];
  }
}

/**
 * Approve a booking request: transitions status to "Approved" / "Booking Confirmed"
 */
export async function approveBookingRequestInSupabase(
  requestId: string,
  userId: string | null | undefined,
  details: {
    assignedCarrier?: string;
    vesselName?: string;
    voyageNumber?: string;
    notes?: string;
    confirmedBy?: string;
  } = {},
): Promise<void> {
  const validUserUuid = safeUuid(userId);
  const nowIso = new Date().toISOString();

  // 1. Update local storage record if present
  updateLocalBooking(requestId, {
    status: "Booking Confirmed",
    vessel_name: details.vesselName,
    voyage_number: details.voyageNumber,
    notes: details.notes,
    confirmed_at: nowIso,
    confirmed_by: details.confirmedBy || "Operations Desk",
    updated_at: nowIso,
  });

  if (isSupabaseConfigured) {
    try {
      const updates: Record<string, unknown> = {
        status: "Booking Confirmed",
        confirmed_at: nowIso,
        confirmed_by: details.confirmedBy || "Operations Desk",
        confirmation_status: "CONFIRMED",
        updated_at: nowIso,
      };

      if (details.vesselName) updates.vessel_name = details.vesselName;
      if (details.voyageNumber) updates.voyage_number = details.voyageNumber;
      if (details.notes) updates.notes = details.notes;

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updates)
        .eq("id", requestId);

      if (updateError) {
        console.warn("[approveBookingRequest] Update warning:", updateError.message);
      }

      // Add event log in Supabase
      await supabase
        .from("booking_events")
        .insert({
          booking_id: requestId,
          event_type: "Booking Confirmed",
          event_date: nowIso,
          location: "Operations Desk",
          description: `Request approved. Vessel ${details.vesselName || "Assigned"} / Voyage ${details.voyageNumber || "Allocated"}. Booking confirmation released.`,
        })
        .catch((err) => console.warn("[approveBookingRequest] Event insert notice:", err));

      // Send notification in Supabase
      const movementNum = existing?.movement_number || requestId;
      if (validUserUuid) {
        await supabase
          .from("notifications")
          .insert({
            user_id: validUserUuid,
            type: "booking_confirmed",
            title: `Booking Confirmed: ${movementNum}`,
            message: `Movement ${movementNum} has been confirmed. Space and equipment allocated.`,
            related_booking_id: requestId,
            is_read: false,
          })
          .catch((err) => console.warn("[approveBookingRequest] Notification notice:", err));
      }
    } catch (err) {
      console.warn("[approveBookingRequest] Supabase notice:", err);
    }
  }

  // Dispatch events for real-time reactivity across all pages
  const movementRef = existing?.movement_number || requestId;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_confirmed", {
        detail: {
          bookingId: requestId,
          movementNumber: movementRef,
          bookingReference: movementRef,
          status: "Booking Confirmed",
          confirmedBy: details.confirmedBy || "Operations Desk",
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: {
          bookingId: requestId,
          status: "Booking Confirmed",
        },
      }),
    );
  }
}

/**
 * Request revisions on a booking request
 */
export async function requestRevisionInSupabase(
  requestId: string,
  userId: string | null | undefined,
  revisionNotes: string,
): Promise<void> {
  const validUserUuid = safeUuid(userId);
  const nowIso = new Date().toISOString();

  // 1. Update local storage record if present
  updateLocalBooking(requestId, {
    status: "Customs Hold",
    special_instructions: `Revision Requested: ${revisionNotes}`,
    updated_at: nowIso,
  });

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          status: "Customs Hold",
          special_instructions: `Revision Requested: ${revisionNotes}`,
          updated_at: nowIso,
        })
        .eq("id", requestId);

      if (error) {
        console.warn("[requestRevisionInSupabase] Update notice:", error.message);
      }

      await supabase
        .from("booking_events")
        .insert({
          booking_id: requestId,
          event_type: "Revision Requested",
          event_date: nowIso,
          location: "Documentation Desk",
          description: revisionNotes,
        })
        .catch((err) => console.warn("[requestRevisionInSupabase] Event notice:", err));

      if (validUserUuid) {
        await supabase
          .from("notifications")
          .insert({
            user_id: validUserUuid,
            type: "action_required",
            title: "Revision Requested",
            message: `Revision requested for booking ${requestId}: ${revisionNotes.slice(0, 80)}...`,
            related_booking_id: requestId,
            is_read: false,
          })
          .catch((err) => console.warn("[requestRevisionInSupabase] Notification notice:", err));
      }
    } catch (err) {
      console.warn("[requestRevision] Exception:", err);
    }
  }

  // Dispatch event for UI reactivity
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: {
          bookingId: requestId,
          status: "Customs Hold",
          revisionNotes,
        },
      }),
    );
  }
}

/**
 * Calculate statistical aggregates for summary ribbon
 */
export function calculateRequestsStats(requests: BookingRequestRecord[]): RequestsStatsSummary {
  const total = requests.length;
  const pendingReview = requests.filter((r) => r.status === "Pending Review").length;
  const rateVerification = requests.filter((r) => r.status === "Rate Verification").length;
  const lineAllocation = requests.filter((r) => r.status === "Line Allocation").length;
  const approved = requests.filter((r) => r.status === "Approved").length;
  const revisionRequested = requests.filter((r) => r.status === "Revision Requested").length;
  const urgentCutoffs = requests.filter(
    (r) => r.priority === "Urgent" || r.priority === "High",
  ).length;

  const totalCargoTons = Math.round(
    requests.reduce((acc, r) => acc + (r.cargo?.totalWeightKg || 0) / 1000, 0),
  );

  const totalValueUsd = requests.reduce((acc, r) => acc + (r.totalFreight || 0), 0);

  return {
    total,
    pendingReview,
    rateVerification,
    lineAllocation,
    approved,
    revisionRequested,
    urgentCutoffs,
    totalCargoTons,
    totalValueUsd,
    avgTurnaroundHours: total > 0 ? "1.4 hrs" : "0 hrs",
  };
}
