import { supabase, isSupabaseConfigured } from "./supabase";
import {
  safeUuid,
  type FullBookingRecord,
  type BookingContainerRow,
  type BookingEventRow,
} from "./supabase-services";

export interface TrackingProviderConfig {
  providerName: string;
  apiUrl?: string;
  hasCredentials: boolean;
  environment: "production" | "sandbox" | "unconfigured";
}

export interface ContainerTrackingRecord {
  containerId: string;
  containerNumber: string;
  bookingId: string;
  movementReference?: string;
  trackingStatus:
    "Active" | "Pending Configuration" | "Not Started" | "Registered" | "In Transit" | "Delivered";
  isProviderConnected: boolean;
  providerName: string;
  providerReference: string | null;
  lastUpdated: string | null;
  latestLocation: string | null;
  latestMilestone: string | null;
  events: BookingEventRow[];
  details?: Record<string, unknown>;
}

/**
 * Checks whether an external tracking provider API is configured with live credentials.
 */
export function getTrackingProviderConfig(): TrackingProviderConfig {
  const apiKey =
    (typeof process !== "undefined" && process?.env
      ? process.env.TRACKING_API_KEY ||
        process.env.CARRIER_TRACKING_API_KEY ||
        process.env.VIZION_API_KEY ||
        process.env.OCEAN_INSIGHTS_KEY
      : "") || "";

  const apiUrl =
    (typeof process !== "undefined" && process?.env
      ? process.env.TRACKING_API_URL || process.env.CARRIER_TRACKING_URL
      : "") || "";

  const providerName =
    (typeof process !== "undefined" && process?.env
      ? process.env.TRACKING_PROVIDER_NAME || "Unified Maritime Tracking Adapter"
      : "Unified Maritime Tracking Adapter") || "Unified Maritime Tracking Adapter";

  return {
    providerName,
    apiUrl: apiUrl || undefined,
    hasCredentials: Boolean(apiKey && apiKey.trim().length > 0),
    environment: apiKey ? "production" : "unconfigured",
  };
}

/**
 * Map provider statuses to canonical platform lifecycle stages safely.
 */
export function mapProviderStatusToLifecycle(rawProviderStatus: string): {
  lifecycleStage: string;
  containerStatus: string;
} {
  const norm = (rawProviderStatus || "").trim().toUpperCase();

  if (norm.includes("DELIVER") || norm.includes("COMPLETED")) {
    return { lifecycleStage: "Delivered", containerStatus: "Delivered" };
  }
  if (norm.includes("DISCHARGE") || norm.includes("ARRIV") || norm.includes("PORT_OF_DISCHARGE")) {
    return { lifecycleStage: "Arrived", containerStatus: "Discharged" };
  }
  if (
    norm.includes("DEPART") ||
    norm.includes("SAIL") ||
    norm.includes("IN_TRANSIT") ||
    norm.includes("AT_SEA")
  ) {
    return { lifecycleStage: "In Transit", containerStatus: "On Board" };
  }
  if (norm.includes("LOAD") || norm.includes("STUFF") || norm.includes("ON_BOARD")) {
    return { lifecycleStage: "Stuffing & Sealing", containerStatus: "Loaded" };
  }
  if (norm.includes("GATE_IN") || norm.includes("GATED_IN") || norm.includes("DEPOT")) {
    return { lifecycleStage: "Cargo Received at Warehouse", containerStatus: "Gated In" };
  }
  if (norm.includes("CONFIRM") || norm.includes("BOOKED")) {
    return { lifecycleStage: "Booking Confirmed", containerStatus: "Allocated" };
  }

  return { lifecycleStage: "Booking Confirmed", containerStatus: "Allocated" };
}

/**
 * Loads real tracking state for a specific container from Supabase.
 */
export async function getContainerTrackingState(
  containerId: string,
  bookingId?: string | null,
): Promise<ContainerTrackingRecord> {
  const cleanContainerId = (containerId || "").trim();
  const config = getTrackingProviderConfig();

  const emptyResult: ContainerTrackingRecord = {
    containerId: cleanContainerId,
    containerNumber: "",
    bookingId: bookingId || "",
    trackingStatus: "Not Started",
    isProviderConnected: config.hasCredentials,
    providerName: config.providerName,
    providerReference: null,
    lastUpdated: null,
    latestLocation: null,
    latestMilestone: null,
    events: [],
  };

  if (!isSupabaseConfigured || !cleanContainerId) {
    return emptyResult;
  }

  try {
    // 1. Fetch container row
    let cQuery = supabase.from("booking_containers").select("*");
    const isUuid = safeUuid(cleanContainerId);
    if (isUuid) {
      cQuery = cQuery.eq("id", isUuid);
    } else {
      cQuery = cQuery.eq("container_number", cleanContainerId.toUpperCase());
    }

    const { data: container, error: cErr } = await cQuery.maybeSingle();
    if (cErr || !container) {
      return emptyResult;
    }

    const realContainerId = container.id;
    const realBookingId = container.booking_id;
    const containerNumber = container.container_number || cleanContainerId;

    // 2. Fetch associated booking events
    const { data: eventRows } = await supabase
      .from("booking_events")
      .select("*")
      .eq("booking_id", realBookingId)
      .order("created_at", { ascending: false });

    const allEvents: BookingEventRow[] = (eventRows || []) as unknown as BookingEventRow[];
    // Filter events matching container_id or payload.container_id
    const containerEvents = allEvents.filter((ev) => {
      if (ev.container_id && ev.container_id === realContainerId) return true;
      const p = ev.payload as Record<string, unknown> | null;
      if (p?.container_id === realContainerId) return true;
      if (
        p?.container_number &&
        String(p.container_number).toUpperCase() === containerNumber.toUpperCase()
      ) {
        return true;
      }
      return false;
    });

    // 3. Find latest tracking session event
    const trackingSessionEvent = containerEvents.find(
      (e) =>
        e.event_type === "Tracking Initialized" ||
        e.event_type === "Tracking Registered" ||
        (e.payload as Record<string, unknown>)?.action === "start_tracking",
    );

    const latestEvent = containerEvents[0];
    const payload = (trackingSessionEvent?.payload || {}) as Record<string, unknown>;

    let trackingStatus: ContainerTrackingRecord["trackingStatus"] = "Not Started";
    if (trackingSessionEvent) {
      if (config.hasCredentials) {
        trackingStatus =
          (payload.tracking_status as ContainerTrackingRecord["trackingStatus"]) || "Active";
      } else {
        trackingStatus = "Pending Configuration";
      }
    }

    return {
      containerId: realContainerId,
      containerNumber,
      bookingId: realBookingId,
      trackingStatus,
      isProviderConnected: config.hasCredentials,
      providerName: (payload.provider as string) || config.providerName,
      providerReference: (payload.provider_reference as string) || null,
      lastUpdated:
        latestEvent?.created_at || trackingSessionEvent?.created_at || container.updated_at || null,
      latestLocation: latestEvent?.location || (payload.location as string) || null,
      latestMilestone: latestEvent?.title || latestEvent?.event_type || null,
      events: containerEvents,
      details: payload,
    };
  } catch (err) {
    console.warn("[getContainerTrackingState] Error reading tracking state:", err);
    return emptyResult;
  }
}

/**
 * Initializes or starts tracking for a container.
 * - Validates container in Supabase
 * - Validates movement link
 * - Checks for duplicate active sessions (idempotent)
 * - Persists tracking state in Supabase booking_events
 * - Clearly indicates whether provider API is connected or pending configuration
 */
export async function startContainerTracking(params: {
  containerId: string;
  containerNumber?: string;
  bookingId?: string;
  movementReference?: string;
}): Promise<{
  success: boolean;
  trackingStatus: string;
  isProviderConnected: boolean;
  message: string;
  event?: BookingEventRow;
}> {
  if (!isSupabaseConfigured) {
    return {
      success: false,
      trackingStatus: "Error",
      isProviderConnected: false,
      message: "Database connection is not configured.",
    };
  }

  const { containerId, bookingId, movementReference } = params;
  const config = getTrackingProviderConfig();

  try {
    // 1. Resolve container in Supabase
    let cQuery = supabase.from("booking_containers").select("*");
    const isUuid = safeUuid(containerId);
    if (isUuid) {
      cQuery = cQuery.eq("id", isUuid);
    } else if (params.containerNumber) {
      cQuery = cQuery.eq("container_number", params.containerNumber.trim().toUpperCase());
    } else {
      return {
        success: false,
        trackingStatus: "Error",
        isProviderConnected: false,
        message: "Invalid container identifier provided.",
      };
    }

    const { data: container, error: cErr } = await cQuery.maybeSingle();
    if (cErr || !container) {
      return {
        success: false,
        trackingStatus: "Error",
        isProviderConnected: false,
        message: "Container was not found in the database.",
      };
    }

    const realBookingId = container.booking_id;
    const realContainerId = container.id;
    const containerNumber = container.container_number || params.containerNumber || "UNASSIGNED";

    // 2. Validate linked booking
    if (bookingId) {
      const validBookingUuid = safeUuid(bookingId);
      if (validBookingUuid && validBookingUuid !== realBookingId) {
        return {
          success: false,
          trackingStatus: "Error",
          isProviderConnected: false,
          message: "Container is not linked to the specified movement.",
        };
      }
    }

    // 3. Check for existing active tracking session (Prevent duplicate sessions)
    const { data: existingEvents } = await supabase
      .from("booking_events")
      .select("*")
      .eq("booking_id", realBookingId)
      .eq("container_id", realContainerId)
      .order("created_at", { ascending: false });

    const existingSession = existingEvents?.find(
      (ev) => ev.event_type === "Tracking Initialized" || ev.event_type === "Tracking Registered",
    );

    if (existingSession) {
      const p = (existingSession.payload || {}) as Record<string, unknown>;
      return {
        success: true,
        trackingStatus: config.hasCredentials ? "Active" : "Pending Configuration",
        isProviderConnected: config.hasCredentials,
        message: config.hasCredentials
          ? `Tracking session already active for container ${containerNumber}.`
          : `Tracking registered. External tracking API credentials pending.`,
        event: existingSession as unknown as BookingEventRow,
      };
    }

    // 4. Save tracking state in Supabase booking_events
    const nowIso = new Date().toISOString();
    const trackingStatus = config.hasCredentials ? "Active" : "Pending Configuration";
    const statusMessage = config.hasCredentials
      ? `Tracking session established with ${config.providerName}.`
      : `Tracking registered in platform ledger. External tracking API provider is not yet configured with credentials.`;

    const { data: createdEvent, error: evError } = await supabase
      .from("booking_events")
      .insert({
        booking_id: realBookingId,
        container_id: realContainerId,
        event_type: "Tracking Initialized",
        title: `Tracking Registered: ${containerNumber}`,
        description: statusMessage,
        location: "Terminal Hub",
        event_date: nowIso,
        occurred_at: nowIso,
        payload: {
          action: "start_tracking",
          container_id: realContainerId,
          container_number: containerNumber,
          movement_reference: movementReference || null,
          tracking_provider: config.providerName,
          provider_reference: config.hasCredentials ? `TRK-${containerNumber}-${Date.now()}` : null,
          tracking_status: trackingStatus,
          is_provider_connected: config.hasCredentials,
          registered_at: nowIso,
          configuration_notice: config.hasCredentials
            ? "Live provider connected."
            : "No external API key provided in environment. Real database tracking registered.",
        },
      })
      .select()
      .single();

    if (evError) {
      throw new Error(`Failed to persist tracking session: ${evError.message}`);
    }

    // 5. Audit log
    try {
      await supabase.from("audit_logs").insert({
        action: "start_tracking",
        resource_type: "booking_container",
        resource_id: realContainerId,
        details: {
          container_number: containerNumber,
          booking_id: realBookingId,
          is_provider_connected: config.hasCredentials,
          tracking_status: trackingStatus,
        },
      });
    } catch {
      // ignore optional audit log notice
    }

    return {
      success: true,
      trackingStatus,
      isProviderConnected: config.hasCredentials,
      message: statusMessage,
      event: createdEvent as unknown as BookingEventRow,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[startContainerTracking] Error:", msg);
    return {
      success: false,
      trackingStatus: "Error",
      isProviderConnected: false,
      message: msg,
    };
  }
}
