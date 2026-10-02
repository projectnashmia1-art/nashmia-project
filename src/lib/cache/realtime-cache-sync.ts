import type { QueryClient } from "@tanstack/react-query";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { FullBookingRecord } from "@/lib/supabase-services";
import type { BookingRequestRecord } from "@/types/requests";
import { mapBookingRecordToRequest } from "@/lib/requests-data";
import { saveCutOffsForMovement, type MovementCutOffDates } from "@/lib/movement-cutoff-service";

/**
 * Normalizes an identifier string for case-insensitive matching
 */
function normalizeId(id: unknown): string {
  if (typeof id !== "string") return "";
  return id.trim().toLowerCase();
}

/**
 * Check if a booking matches any identifier
 */
function matchesBooking(
  booking: {
    id?: string | null;
    movement_number?: string | null;
    booking_reference?: string | null;
    reference?: string | null;
  },
  identifiers: string[],
): boolean {
  const bId = normalizeId(booking.id);
  const bMov = normalizeId(booking.movement_number);
  const bRef = normalizeId(booking.booking_reference);
  const bReference = normalizeId(booking.reference);

  return identifiers.some(
    (target) =>
      target && (target === bId || target === bMov || target === bRef || target === bReference),
  );
}

/**
 * Check if a request matches any identifier
 */
function matchesRequest(request: BookingRequestRecord, identifiers: string[]): boolean {
  const rId = normalizeId(request.id);
  const rMov = normalizeId(request.movementNumber);
  const rRef = normalizeId(request.reference);
  const rBkRef = normalizeId(request.bookingReference);

  return identifiers.some(
    (target) =>
      target && (target === rId || target === rMov || target === rRef || target === rBkRef),
  );
}

/**
 * Surgically update cache when a `bookings` table realtime event is received.
 * Updates only the affected booking record in query cache without full refetches.
 */
export function applyBookingRealtimeUpdate(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  const { eventType, new: newRow, old: oldRow } = payload;
  const targetRow = (newRow || oldRow || {}) as Record<string, unknown>;

  const id = normalizeId(targetRow.id);
  const movementNumber = normalizeId(targetRow.movement_number);
  const bookingReference = normalizeId(targetRow.booking_reference);
  const reference = normalizeId(targetRow.reference);

  const targetIdentifiers = [id, movementNumber, bookingReference, reference].filter(Boolean);
  if (targetIdentifiers.length === 0) return;

  const isConfirmed =
    String(targetRow.confirmation_status || "").toUpperCase() === "CONFIRMED" ||
    String(targetRow.status || "")
      .toLowerCase()
      .includes("confirm") ||
    String(targetRow.status || "").toLowerCase() === "approved";

  // 1. Surgically update all ["dashboard-bookings"] caches
  queryClient.setQueriesData<FullBookingRecord[]>({ queryKey: ["dashboard-bookings"] }, (prev) => {
    if (!prev) return prev;

    if (eventType === "DELETE") {
      return prev.filter((b) => !matchesBooking(b, targetIdentifiers));
    }

    if (eventType === "INSERT") {
      const exists = prev.some((b) => matchesBooking(b, targetIdentifiers));
      if (exists) return prev;
      const newRecord = targetRow as unknown as FullBookingRecord;
      return [newRecord, ...prev];
    }

    if (eventType === "UPDATE") {
      return prev.map((b) => {
        if (!matchesBooking(b, targetIdentifiers)) return b;

        const rawTargetStatus = targetRow.status ? String(targetRow.status) : b.status;
        const normalizedTargetLower = rawTargetStatus ? rawTargetStatus.toLowerCase() : "";
        const isAdvancedStage =
          normalizedTargetLower.includes("transit") ||
          normalizedTargetLower.includes("loaded") ||
          normalizedTargetLower.includes("stuff") ||
          normalizedTargetLower.includes("seal") ||
          normalizedTargetLower.includes("custom") ||
          normalizedTargetLower.includes("cleared") ||
          normalizedTargetLower.includes("shipped") ||
          normalizedTargetLower.includes("dispatch") ||
          normalizedTargetLower.includes("gate") ||
          normalizedTargetLower.includes("arriv") ||
          normalizedTargetLower.includes("deliver");

        const effectiveStatus = isAdvancedStage
          ? rawTargetStatus
          : isConfirmed
            ? "Booking Confirmed"
            : rawTargetStatus;
        const effectiveConfStatus =
          isConfirmed || isAdvancedStage
            ? "CONFIRMED"
            : targetRow.confirmation_status
              ? (targetRow.confirmation_status as FullBookingRecord["confirmation_status"])
              : b.confirmation_status;

        return {
          ...b,
          ...targetRow,
          status: effectiveStatus,
          confirmation_status: effectiveConfStatus,
          confirmed_at: targetRow.confirmed_at
            ? String(targetRow.confirmed_at)
            : isConfirmed
              ? b.confirmed_at || new Date().toISOString()
              : b.confirmed_at,
          confirmed_by: targetRow.confirmed_by
            ? String(targetRow.confirmed_by)
            : isConfirmed
              ? b.confirmed_by || "Forwarder"
              : b.confirmed_by,
          forwarder_name: targetRow.forwarder_name
            ? String(targetRow.forwarder_name)
            : b.forwarder_name,
          vessel_name: targetRow.vessel_name ? String(targetRow.vessel_name) : b.vessel_name,
          voyage_number: targetRow.voyage_number
            ? String(targetRow.voyage_number)
            : b.voyage_number,
          si_cutoff: targetRow.si_cutoff ? String(targetRow.si_cutoff) : b.si_cutoff,
          vgm_cutoff: targetRow.vgm_cutoff ? String(targetRow.vgm_cutoff) : b.vgm_cutoff,
          gate_cutoff: targetRow.gate_cutoff ? String(targetRow.gate_cutoff) : b.gate_cutoff,
          updated_at: targetRow.updated_at
            ? String(targetRow.updated_at)
            : new Date().toISOString(),
        } as FullBookingRecord;
      });
    }

    return prev;
  });

  // 2. Surgically update all ["dashboard-requests"] caches
  queryClient.setQueriesData<BookingRequestRecord[]>(
    { queryKey: ["dashboard-requests"] },
    (prev) => {
      if (!prev) return prev;

      if (eventType === "DELETE") {
        return prev.filter((r) => !matchesRequest(r, targetIdentifiers));
      }

      const mapped = mapBookingRecordToRequest(targetRow as unknown as FullBookingRecord);

      if (eventType === "INSERT") {
        const exists = prev.some((r) => matchesRequest(r, targetIdentifiers));
        if (exists) return prev;
        return [mapped, ...prev];
      }

      if (eventType === "UPDATE") {
        return prev.map((r) => {
          if (!matchesRequest(r, targetIdentifiers)) return r;

          let status = r.status;
          const rawStatus = (targetRow.status ? String(targetRow.status) : "").trim();
          const upper = rawStatus.toUpperCase();

          if (isConfirmed) {
            status = "Booking Confirmed";
          } else if (upper.includes("REVIEW") || upper.includes("REQUESTED")) {
            status = "Pending Review";
          } else if (upper.includes("ALLOCATION") || upper.includes("RATE")) {
            status = "Rate Verification";
          } else if (upper.includes("CANCEL") || upper.includes("REJECT")) {
            status = "Cancelled";
          } else if (rawStatus) {
            status = rawStatus as BookingRequestRecord["status"];
          }

          const confDetails = (targetRow.confirmation_details as Record<string, unknown>) || {};
          const cutOffs = (targetRow.cut_off_dates || confDetails.cut_off_dates) as
            MovementCutOffDates | undefined;

          const effectiveSi =
            targetRow.si_cutoff ||
            cutOffs?.siCutOffDate ||
            (confDetails.si_cutoff as string) ||
            r.siCutoff;
          const effectiveVgm =
            targetRow.vgm_cutoff ||
            cutOffs?.vgmCutOffDate ||
            (confDetails.vgm_cutoff as string) ||
            r.vgmCutoff;
          const effectiveGate =
            targetRow.gate_cutoff ||
            cutOffs?.gateCutOffDate ||
            (confDetails.gate_cutoff as string) ||
            r.gateCutoff;

          return {
            ...r,
            status,
            confirmationStatus: isConfirmed
              ? "CONFIRMED"
              : targetRow.confirmation_status
                ? String(targetRow.confirmation_status)
                : r.confirmationStatus,
            forwarderName: targetRow.forwarder_name
              ? String(targetRow.forwarder_name)
              : targetRow.confirmed_by
                ? String(targetRow.confirmed_by)
                : r.forwarderName,
            confirmedBy: targetRow.confirmed_by ? String(targetRow.confirmed_by) : r.confirmedBy,
            confirmedAt: targetRow.confirmed_at ? String(targetRow.confirmed_at) : r.confirmedAt,
            preferredCarrier: targetRow.shipping_line_name
              ? String(targetRow.shipping_line_name)
              : r.preferredCarrier,
            vesselName: targetRow.vessel_name ? String(targetRow.vessel_name) : r.vesselName,
            voyageNumber: targetRow.voyage_number
              ? String(targetRow.voyage_number)
              : r.voyageNumber,
            ratePerContainer:
              typeof targetRow.rate_amount === "number"
                ? targetRow.rate_amount
                : r.ratePerContainer,
            totalFreight:
              typeof targetRow.total_freight === "number"
                ? targetRow.total_freight
                : r.totalFreight,
            siCutoff: effectiveSi,
            vgmCutoff: effectiveVgm,
            gateCutoff: effectiveGate,
            updatedAt: targetRow.updated_at
              ? String(targetRow.updated_at)
              : new Date().toISOString(),
          };
        });
      }

      return prev;
    },
  );

  // 3. Surgically update all ["booking-requests"] caches
  queryClient.setQueriesData<BookingRequestRecord[]>({ queryKey: ["booking-requests"] }, (prev) => {
    if (!prev) return prev;

    if (eventType === "DELETE") {
      return prev.filter((r) => !matchesRequest(r, targetIdentifiers));
    }

    const mapped = mapBookingRecordToRequest(targetRow as unknown as FullBookingRecord);

    if (eventType === "INSERT") {
      const exists = prev.some((r) => matchesRequest(r, targetIdentifiers));
      if (exists) return prev;
      return [mapped, ...prev];
    }

    if (eventType === "UPDATE") {
      return prev.map((r) => {
        if (!matchesRequest(r, targetIdentifiers)) return r;

        let status = r.status;
        const rawStatus = (targetRow.status ? String(targetRow.status) : "").trim();
        const upper = rawStatus.toUpperCase();

        if (isConfirmed) {
          status = "Booking Confirmed";
        } else if (upper.includes("REVIEW") || upper.includes("REQUESTED")) {
          status = "Pending Review";
        } else if (upper.includes("ALLOCATION") || upper.includes("RATE")) {
          status = "Rate Verification";
        } else if (upper.includes("CANCEL") || upper.includes("REJECT")) {
          status = "Cancelled";
        } else if (rawStatus) {
          status = rawStatus as BookingRequestRecord["status"];
        }

        const confDetails = (targetRow.confirmation_details as Record<string, unknown>) || {};
        const cutOffs = (targetRow.cut_off_dates || confDetails.cut_off_dates) as
          MovementCutOffDates | undefined;

        const effectiveSi =
          targetRow.si_cutoff ||
          cutOffs?.siCutOffDate ||
          (confDetails.si_cutoff as string) ||
          r.siCutoff;
        const effectiveVgm =
          targetRow.vgm_cutoff ||
          cutOffs?.vgmCutOffDate ||
          (confDetails.vgm_cutoff as string) ||
          r.vgmCutoff;
        const effectiveGate =
          targetRow.gate_cutoff ||
          cutOffs?.gateCutOffDate ||
          (confDetails.gate_cutoff as string) ||
          r.gateCutoff;

        return {
          ...r,
          status,
          confirmationStatus: isConfirmed
            ? "CONFIRMED"
            : targetRow.confirmation_status
              ? String(targetRow.confirmation_status)
              : r.confirmationStatus,
          forwarderName: targetRow.forwarder_name
            ? String(targetRow.forwarder_name)
            : targetRow.confirmed_by
              ? String(targetRow.confirmed_by)
              : r.forwarderName,
          confirmedBy: targetRow.confirmed_by ? String(targetRow.confirmed_by) : r.confirmedBy,
          confirmedAt: targetRow.confirmed_at ? String(targetRow.confirmed_at) : r.confirmedAt,
          preferredCarrier: targetRow.shipping_line_name
            ? String(targetRow.shipping_line_name)
            : r.preferredCarrier,
          vesselName: targetRow.vessel_name ? String(targetRow.vessel_name) : r.vesselName,
          voyageNumber: targetRow.voyage_number ? String(targetRow.voyage_number) : r.voyageNumber,
          ratePerContainer:
            typeof targetRow.rate_amount === "number" ? targetRow.rate_amount : r.ratePerContainer,
          totalFreight:
            typeof targetRow.total_freight === "number" ? targetRow.total_freight : r.totalFreight,
          siCutoff: effectiveSi,
          vgmCutoff: effectiveVgm,
          gateCutoff: effectiveGate,
          updatedAt: targetRow.updated_at ? String(targetRow.updated_at) : new Date().toISOString(),
        };
      });
    }

    return prev;
  });

  // If cut-off dates are present in the targetRow, update the movement cut-off registry
  const rowConf = (targetRow.confirmation_details as Record<string, unknown>) || {};
  const rowCutOffs = (targetRow.cut_off_dates || rowConf.cut_off_dates) as MovementCutOffDates;
  const effectiveMovRef = String(
    targetRow.movement_number ||
      targetRow.booking_reference ||
      targetRow.reference ||
      targetRow.id ||
      "",
  ).trim();

  if (rowCutOffs && effectiveMovRef) {
    try {
      saveCutOffsForMovement(effectiveMovRef, rowCutOffs, String(targetRow.id || ""));
    } catch (cutoffErr) {
      console.warn("[applyBookingRealtimeUpdate] Notice syncing cut-offs:", cutoffErr);
    }
  }

  // Trigger query invalidation for all booking-related queries
  void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["bookings"] });
  void queryClient.invalidateQueries({ queryKey: ["movements"] });

  // Dispatch lightweight cross-component notifications
  if (typeof window !== "undefined") {
    const detailPayload = {
      id: targetRow.id,
      bookingId: targetRow.id || targetRow.movement_number,
      movementNumber: targetRow.movement_number,
      bookingReference: targetRow.booking_reference,
      status: isConfirmed ? "Booking Confirmed" : targetRow.status,
      confirmationStatus: isConfirmed ? "CONFIRMED" : targetRow.confirmation_status || "PENDING",
      forwarderName: targetRow.forwarder_name || targetRow.confirmed_by,
      confirmedBy: targetRow.confirmed_by || targetRow.forwarder_name,
      confirmedAt: targetRow.confirmed_at || new Date().toISOString(),
      vesselName: targetRow.vessel_name,
      voyageNumber: targetRow.voyage_number,
      booking: targetRow,
    };

    window.dispatchEvent(new CustomEvent("nashmia_bookings_updated", { detail: detailPayload }));
    window.dispatchEvent(
      new CustomEvent("supabase_realtime_bookings_change", { detail: detailPayload }),
    );

    if (isConfirmed) {
      window.dispatchEvent(new CustomEvent("nashmia_booking_confirmed", { detail: detailPayload }));
    } else {
      window.dispatchEvent(
        new CustomEvent("nashmia_booking_status_updated", { detail: detailPayload }),
      );
    }
  }
}

/**
 * Surgically update cache when a `forwarder_requests` table realtime event is received.
 */
export function applyForwarderRequestRealtimeUpdate(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  const { new: newRow, old: oldRow } = payload;
  const targetRow = (newRow || oldRow || {}) as Record<string, unknown>;
  const bookingId = normalizeId(targetRow.booking_id);

  if (bookingId) {
    void queryClient.invalidateQueries({ queryKey: ["forwarder-requests", bookingId] });
  }
  void queryClient.invalidateQueries({ queryKey: ["forwarder-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: {
          bookingId: targetRow.booking_id,
          movementNumber: targetRow.movement_number,
          requestId: targetRow.id || targetRow.request_id,
          status: targetRow.status,
          awardStatus: targetRow.award_status,
          timestamp: Date.now(),
        },
      }),
    );
  }
}

/**
 * Surgically update cache when a `quotations` table realtime event is received.
 * Updates affected booking and forwarder requests without refetching the entire application.
 */
export function applyQuotationRealtimeUpdate(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  const { new: newRow, old: oldRow } = payload;
  const targetRow = (newRow || oldRow || {}) as Record<string, unknown>;
  const bookingId = normalizeId(targetRow.booking_id);

  if (bookingId) {
    void queryClient.invalidateQueries({ queryKey: ["forwarder-requests", bookingId] });
    void queryClient.invalidateQueries({ queryKey: ["quotations", bookingId] });
  }
  void queryClient.invalidateQueries({ queryKey: ["forwarder-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: {
          bookingId: targetRow.booking_id,
          movementNumber: targetRow.movement_number,
          quotationId: targetRow.id,
          forwarderId: targetRow.forwarder_id,
          rate: targetRow.rate,
          currency: targetRow.currency,
          timestamp: Date.now(),
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_forwarder_offer_received", {
        detail: {
          bookingId: targetRow.booking_id,
          movementNumber: targetRow.movement_number,
          quotationId: targetRow.id,
          forwarderId: targetRow.forwarder_id,
          rate: targetRow.rate,
          currency: targetRow.currency,
          offer: targetRow,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_quotation_persisted", {
        detail: {
          quotationId: targetRow.id,
          bookingId: targetRow.booking_id,
          forwarderRequestId: targetRow.forwarder_request_id,
          rate: targetRow.rate,
        },
      }),
    );
  }
}

/**
 * Backward-compatible stub for offer realtime events (synced with quotations)
 */
export function applyOfferRealtimeUpdate(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  applyQuotationRealtimeUpdate(queryClient, payload);
}

/**
 * Surgically update cache when a `booking_events` table realtime event is received.
 */
export function applyBookingEventRealtimeUpdate(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  const { eventType, new: newRow } = payload;
  if (eventType !== "INSERT" || !newRow) return;

  const bookingId = normalizeId(newRow.booking_id);
  if (!bookingId) return;

  // Update specific booking-events query if mounted
  queryClient.setQueriesData<unknown[]>({ queryKey: ["booking-events", bookingId] }, (prev) => {
    if (!prev) return [newRow];
    return [...prev, newRow];
  });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_event_added", {
        detail: { bookingId, event: newRow },
      }),
    );
  }
}

/**
 * Surgically update cache when an `email_messages` table realtime event is received.
 */
export function applyEmailMessageRealtimeUpdate(
  queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  const { new: newRow } = payload;

  // Immediately invalidate Emails list and metrics query keys
  void queryClient.invalidateQueries({ queryKey: ["emails"] });
  void queryClient.invalidateQueries({ queryKey: ["email-threads"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  void queryClient.invalidateQueries({ queryKey: ["documents"] });

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_emails_updated", {
        detail: { payload: newRow },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("supabase_realtime_bookings_change", {
        detail: { payload: newRow },
      }),
    );
  }

  if (!newRow) return;

  const m = newRow as Record<string, unknown>;
  const rawHeaders = (m.raw_headers || {}) as Record<string, unknown>;
  const movNum = String(m.movement_number || rawHeaders.movement_number || "").trim();
  const bId = String(m.booking_id || rawHeaders.booking_id || "").trim();
  const fromEmail = String(m.sender_email || m.from || "").trim();

  const targetIdentifiers = [movNum, bId].filter(Boolean);
  if (targetIdentifiers.length === 0) return;

  // Check if this incoming message confirms the booking
  const confStatus = String(rawHeaders.confirmation_status || "").toUpperCase();
  const respClass = String(rawHeaders.response_classification || "").toUpperCase();
  const isConfirmation = confStatus === "CONFIRMED" || respClass === "CONFIRMED";

  if (isConfirmation) {
    const forwarderName = String(
      rawHeaders.forwarder_name || m.sender_name || fromEmail.split("@")[0] || "Forwarder",
    );

    queryClient.setQueriesData<BookingRequestRecord[]>(
      { queryKey: ["booking-requests"] },
      (prev) => {
        if (!prev) return prev;
        return prev.map((r) => {
          if (!matchesRequest(r, targetIdentifiers)) return r;
          return {
            ...r,
            status: "Booking Confirmed",
            confirmationStatus: "CONFIRMED",
            forwarderName,
            confirmedBy: forwarderName,
            confirmedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
      },
    );

    queryClient.setQueriesData<FullBookingRecord[]>(
      { queryKey: ["dashboard-bookings"] },
      (prev) => {
        if (!prev) return prev;
        return prev.map((b) => {
          if (!matchesBooking(b, targetIdentifiers)) return b;
          return {
            ...b,
            status: "Booking Confirmed",
            confirmation_status: "CONFIRMED",
            forwarder_name: forwarderName,
            confirmed_by: forwarderName,
            confirmed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as FullBookingRecord;
        });
      },
    );

    if (typeof window !== "undefined") {
      const detailPayload = {
        bookingId: movNum,
        movementNumber: movNum,
        bookingReference: movNum,
        status: "Booking Confirmed",
        confirmationStatus: "CONFIRMED",
        forwarderName,
        confirmedBy: forwarderName,
      };
      window.dispatchEvent(new CustomEvent("nashmia_booking_confirmed", { detail: detailPayload }));
      window.dispatchEvent(new CustomEvent("nashmia_bookings_updated", { detail: detailPayload }));
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nashmia_email_matched", { detail: { payload: newRow } }));
  }
}

/**
 * Surgically update cache when a `notifications` table realtime event is received.
 */
export function applyNotificationRealtimeUpdate(
  _queryClient: QueryClient,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): void {
  if (typeof window === "undefined") return;

  const { eventType, new: newRow, old: oldRow } = payload;
  if (eventType === "INSERT" && newRow) {
    window.dispatchEvent(new CustomEvent("nashmia_notification_inserted", { detail: newRow }));
  } else if (eventType === "UPDATE" && newRow) {
    window.dispatchEvent(new CustomEvent("nashmia_notification_updated", { detail: newRow }));
  } else if (eventType === "DELETE" && oldRow) {
    window.dispatchEvent(new CustomEvent("nashmia_notification_deleted", { detail: oldRow }));
  }
}
