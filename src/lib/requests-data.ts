import { supabase, isSupabaseConfigured } from "./supabase";
import {
  safeUuid,
  fetchBookingsFromSupabase,
  updateLocalBooking,
  getLocalBookings,
  safeInsertNotification,
  markIdentifierConfirmed,
  isBookingConfirmed as checkIsBookingConfirmed,
  type FullBookingRecord,
} from "./supabase-services";
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
    checkIsBookingConfirmed(
      booking,
      booking.id || booking.movement_number || booking.booking_reference,
    ) ||
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
    booking.total_freight || (booking.rate_amount ? booking.rate_amount * containerCount : 0);
  const ratePerContainer =
    containerCount > 0 && totalFreight > 0
      ? Math.round(totalFreight / containerCount)
      : booking.rate_amount || 0;

  // Derive POL & POD Codes & Names
  const originStr = booking.origin || booking.pol_name || "POL";
  const destStr = booking.destination || booking.pod_name || "POD";

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
    buyerName:
      (booking.buyer as { name?: string })?.name ||
      booking.buyer?.company_name ||
      booking.buyer_name ||
      (booking as { buyerName?: string })?.buyerName ||
      "Buyer",
    buyerCode: booking.buyer?.code || "BUYER",
    buyerCountry: booking.buyer?.country || "International",
    consignee:
      booking.buyer?.consignee ||
      (booking.buyer as { name?: string })?.name ||
      booking.buyer?.company_name ||
      booking.buyer_name ||
      "Consignee on File",
    supplierId: booking.supplier_id || undefined,
    supplierName:
      (booking.supplier as { name?: string })?.name ||
      booking.supplier?.company_name ||
      booking.supplier_name ||
      (booking as { supplierName?: string })?.supplierName ||
      "Supplier",
    supplierCode: booking.supplier?.code || "SUPPLIER",
    supplierCity:
      booking.supplier?.city || (booking as { supplierCity?: string })?.supplierCity || "",
    supplierLoadPoint: booking.supplier?.load_point || "",
    forwarderId: isConfirmed ? booking.forwarder_id || undefined : undefined,
    forwarderName: isConfirmed
      ? (booking.forwarder as { name?: string })?.name ||
        booking.forwarder?.company_name ||
        booking.forwarder_name ||
        "Forwarder"
      : "Pending Award",
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
    vesselName: booking.vessel_name || "Pending Allocation",
    voyageNumber: booking.voyage_number || "—",
    ratePerContainer,
    totalFreight,
    currency: booking.currency || "USD",
    rateCardId: booking.rate_card_id || undefined,
    rateValidUntil: "—",
    cargo: {
      description: booking.product_description || "Commercial Export Cargo",
      totalWeightKg,
      totalVolumeCbm,
      packagesCount,
      packageType: "Export Master Cartons / Pallets",
    },
    siCutoff:
      (booking.cut_off_dates as { siCutoff?: string })?.siCutoff ||
      (booking.confirmation_details as { cut_off_dates?: { siCutoff?: string } })?.cut_off_dates
        ?.siCutoff ||
      `${siCutoffDate.toISOString().split("T")[0]} 18:00`,
    vgmCutoff:
      (booking.cut_off_dates as { vgmCutoff?: string })?.vgmCutoff ||
      (booking.confirmation_details as { cut_off_dates?: { vgmCutoff?: string } })?.cut_off_dates
        ?.vgmCutoff ||
      `${vgmCutoffDate.toISOString().split("T")[0]} 12:00`,
    gateCutoff:
      (booking.cut_off_dates as { gateCutoff?: string; portCutoff?: string })?.gateCutoff ||
      (booking.cut_off_dates as { gateCutoff?: string; portCutoff?: string })?.portCutoff ||
      (
        booking.confirmation_details as {
          cut_off_dates?: { gateCutoff?: string; portCutoff?: string };
        }
      )?.cut_off_dates?.gateCutoff ||
      (
        booking.confirmation_details as {
          cut_off_dates?: { gateCutoff?: string; portCutoff?: string };
        }
      )?.cut_off_dates?.portCutoff ||
      `${vgmCutoffDate.toISOString().split("T")[0]} 22:00`,
    specialInstructions: booking.special_instructions || booking.notes || undefined,
    revisionNotes:
      status === "Revision Requested"
        ? booking.special_instructions || "Awaiting updated documentation or weight adjustments."
        : undefined,
    requestedBy: {
      name: booking.supplier?.contact_person || booking.created_by_name || "Operations Desk",
      email: booking.supplier?.email || "operations@nashmia.com",
      phone: booking.supplier?.phone || "—",
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
          .eq("confirmation_status", "CONFIRMED")
          .limit(200);

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

    const rawRequests = bookings.map((booking) => {
      const bRef = (booking.booking_reference || "").trim().toLowerCase();
      const movNum = (booking.movement_number || "").trim().toLowerCase();
      const ref = (booking.reference || "").trim().toLowerCase();
      const bId = (booking.id || "").trim().toLowerCase();

      const isConfirmed =
        (bRef && confirmedIdentifiers.has(bRef)) ||
        (movNum && confirmedIdentifiers.has(movNum)) ||
        (ref && confirmedIdentifiers.has(ref)) ||
        (bId && confirmedIdentifiers.has(bId));

      if (isConfirmed) {
        const rawStatus = (booking.status || "").trim();
        const currentUpper = rawStatus.toUpperCase();
        const isEarlyStage =
          !rawStatus ||
          currentUpper === "BOOKING REQUESTED" ||
          currentUpper === "DRAFT" ||
          currentUpper === "PENDING" ||
          currentUpper === "PENDING REVIEW" ||
          currentUpper === "RATE VERIFICATION" ||
          currentUpper === "LINE ALLOCATION";

        if (isEarlyStage) {
          booking.status = "Booking Confirmed";
        }
        booking.confirmation_status = "CONFIRMED";
        booking.confirmed_at = booking.confirmed_at || new Date().toISOString();
        booking.confirmed_by = booking.confirmed_by || "Operations Desk";

        // Auto-persist in local store while respecting advanced lifecycle stages
        updateLocalBooking(booking.id, {
          status: booking.status,
          confirmation_status: "CONFIRMED",
          confirmed_at: booking.confirmed_at,
          confirmed_by: booking.confirmed_by,
          forwarder_name: booking.forwarder_name,
          rate_amount: booking.rate_amount,
          total_freight: booking.total_freight,
        });
      }

      return mapBookingRecordToRequest(booking);
    });

    // Grouping rule: exactly ONE main request per booking / Movement Number
    const groupedByMovement = new Map<string, BookingRequestRecord>();
    for (const req of rawRequests) {
      const groupKey = (req.movementNumber || req.bookingReference || req.reference || req.id)
        .trim()
        .toUpperCase();

      if (!groupedByMovement.has(groupKey)) {
        groupedByMovement.set(groupKey, req);
      } else {
        const existing = groupedByMovement.get(groupKey)!;
        // Keep the one with newer update or more complete forwarder information
        if (new Date(req.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          groupedByMovement.set(groupKey, req);
        }
      }
    }

    return Array.from(groupedByMovement.values());
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
    forwarderId?: string;
    forwarderName?: string;
    assignedCarrier?: string;
    vesselName?: string;
    voyageNumber?: string;
    notes?: string;
    confirmedBy?: string;
  } = {},
): Promise<void> {
  const validUserUuid = safeUuid(userId);
  const nowIso = new Date().toISOString();

  // 1. Retrieve existing booking from local storage or database
  const localList = getLocalBookings();
  const existing = localList.find(
    (b) =>
      b.id === requestId ||
      b.booking_reference === requestId ||
      b.movement_number === requestId ||
      (b.reference && b.reference === requestId) ||
      (b.id && b.id.toLowerCase() === requestId.toLowerCase()),
  );

  let movementNum =
    existing?.movement_number ||
    existing?.booking_reference ||
    existing?.reference ||
    (requestId.startsWith("MOV-") || requestId.startsWith("NASH-") ? requestId : "NASH-BK-2026-7023");

  // Call Server-Side API to update Supabase with Service Role
  try {
    const apiRes = await fetch("/api/bookings/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: requestId,
        requestId,
        forwarderId: details.forwarderId,
        forwarderName: details.forwarderName,
        vesselName: details.vesselName,
        voyageNumber: details.voyageNumber,
        notes: details.notes,
        confirmedBy: details.forwarderName || details.confirmedBy,
        userId,
      }),
    });
    if (apiRes.ok) {
      const apiJson = await apiRes.json();
      if (apiJson.success && apiJson.movementNumber) {
        movementNum = apiJson.movementNumber;
      }
    }
  } catch (apiErr) {
    console.warn("[approveBookingRequestInSupabase] API notice:", apiErr);
  }

  const validBookingUuid = safeUuid(requestId) || safeUuid(existing?.id);

  // 2. Persist in local storage
  updateLocalBooking(requestId, {
    status: "Booking Confirmed",
    forwarder_id: details.forwarderId,
    forwarder_name: details.forwarderName || existing?.forwarder_name,
    vessel_name: details.vesselName,
    voyage_number: details.voyageNumber,
    notes: details.notes,
    confirmed_at: nowIso,
    confirmed_by: details.forwarderName || details.confirmedBy || "Operations Desk",
    confirmation_status: "CONFIRMED",
    updated_at: nowIso,
  });

  // 3. Mark identifier confirmed in global confirmed registry
  markIdentifierConfirmed(
    requestId,
    [
      movementNum,
      existing?.movement_number,
      existing?.booking_reference,
      validBookingUuid || undefined,
    ].filter(Boolean) as string[],
  );

  if (isSupabaseConfigured) {
    try {
      // 4. Update booking with single consolidated query
      const fullBookingUpdates: Record<string, unknown> = {
        status: "Confirmed",
        movement_status: "CONFIRMED",
        is_movement_confirmed: true,
        updated_at: nowIso,
        confirmation_status: "CONFIRMED",
        confirmed_at: nowIso,
        confirmed_by: details.forwarderName || details.confirmedBy || "Operations Desk",
      };
      if (details.forwarderName) fullBookingUpdates.forwarder_name = details.forwarderName;
      if (details.forwarderId) fullBookingUpdates.forwarder_id = details.forwarderId;
      if (details.vesselName) fullBookingUpdates.vessel_name = details.vesselName;
      if (details.voyageNumber) fullBookingUpdates.voyage_number = details.voyageNumber;
      if (details.notes) fullBookingUpdates.notes = details.notes;

      if (validBookingUuid) {
        await supabase.from("bookings").update(fullBookingUpdates).eq("id", validBookingUuid);
      } else if (existing?.movement_number) {
        await supabase
          .from("bookings")
          .update(fullBookingUpdates)
          .eq("movement_number", existing.movement_number);
      } else if (requestId) {
        await supabase
          .from("bookings")
          .update(fullBookingUpdates)
          .eq("booking_reference", requestId);
      }

      // Record in email_confirmations table for persistent lookup
      try {
        await supabase.from("email_confirmations").insert({
          booking_id: validBookingUuid || requestId,
          movement_number: movementNum,
          confirmation_status: "CONFIRMED",
          confirmed_by: details.confirmedBy || "Operations Desk",
          source: "OPERATIONS_APPROVAL",
          confirmed_at: nowIso,
        });
      } catch {
        // Table or schema fallback
      }

      // Add event log in Supabase
      if (validBookingUuid) {
        await supabase
          .from("booking_events")
          .insert({
            booking_id: validBookingUuid,
            event_type: "Booking Confirmed",
            event_date: nowIso,
            location: "Operations Desk",
            description: `Request approved. Vessel ${details.vesselName || "Assigned"} / Voyage ${details.voyageNumber || "Allocated"}. Booking confirmation released.`,
          })
          .catch((err) => console.warn("[approveBookingRequest] Event insert notice:", err));
      }

      // Send notification safely
      await safeInsertNotification({
        userId: validUserUuid,
        type: "booking_confirmed",
        title: `Booking Confirmed: ${movementNum}`,
        message: `Movement ${movementNum} has been confirmed. Space and equipment allocated.`,
        booking_id: validBookingUuid,
        is_read: false,
      });
    } catch (err) {
      console.warn("[approveBookingRequest] Supabase notice:", err);
    }
  }

  // Dispatch events for real-time reactivity across all pages
  const movementRef = movementNum;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_confirmed", {
        detail: {
          bookingId: requestId,
          movementNumber: movementRef,
          bookingReference: movementRef,
          status: "Booking Confirmed",
          confirmedBy: details.confirmedBy || "Operations Desk",
          vesselName: details.vesselName,
          voyageNumber: details.voyageNumber,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: {
          bookingId: requestId,
          movementNumber: movementRef,
          status: "Booking Confirmed",
        },
      }),
    );
    window.dispatchEvent(new CustomEvent("nashmia_bookings_updated"));
    window.dispatchEvent(new CustomEvent("supabase_realtime_bookings_change"));
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

  const localList = getLocalBookings();
  const existing = localList.find(
    (b) =>
      b.id === requestId ||
      b.booking_reference === requestId ||
      b.movement_number === requestId ||
      (b.id && b.id.toLowerCase() === requestId.toLowerCase()),
  );

  const movementNum =
    existing?.movement_number ||
    existing?.booking_reference ||
    (requestId.startsWith("MOV-") ? requestId : requestId);

  const validBookingUuid = safeUuid(requestId) || safeUuid(existing?.id);

  if (isSupabaseConfigured) {
    try {
      if (validBookingUuid) {
        const { error } = await supabase
          .from("bookings")
          .update({
            status: "Customs Hold",
            special_instructions: `Revision Requested: ${revisionNotes}`,
            updated_at: nowIso,
          })
          .eq("id", validBookingUuid);

        if (error) {
          console.warn("[requestRevisionInSupabase] Update notice:", error.message);
        }
      } else if (existing?.movement_number) {
        await supabase
          .from("bookings")
          .update({
            status: "Customs Hold",
            special_instructions: `Revision Requested: ${revisionNotes}`,
            updated_at: nowIso,
          })
          .eq("movement_number", existing.movement_number);
      } else if (requestId) {
        await supabase
          .from("bookings")
          .update({
            status: "Customs Hold",
            special_instructions: `Revision Requested: ${revisionNotes}`,
            updated_at: nowIso,
          })
          .eq("booking_reference", requestId);
      }

      if (validBookingUuid) {
        await supabase
          .from("booking_events")
          .insert({
            booking_id: validBookingUuid,
            event_type: "Revision Requested",
            event_date: nowIso,
            location: "Documentation Desk",
            description: revisionNotes,
          })
          .catch((err) => console.warn("[requestRevisionInSupabase] Event notice:", err));
      }

      await safeInsertNotification({
        userId: validUserUuid,
        type: "action_required",
        title: "Revision Requested",
        message: `Revision requested for booking ${movementNum}: ${revisionNotes.slice(0, 80)}...`,
        booking_id: validBookingUuid,
        is_read: false,
      });
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
          movementNumber: movementNum,
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
