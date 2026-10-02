import { supabase, isSupabaseConfigured } from "./supabase";
import { getGmailAccessToken, sendEmailDirectlyViaGmail } from "./gmail-service";
import {
  generateMovementNumber,
  extractMovementNumber,
  toDbBookingStatus,
  toDbMovementStatus,
  normalizeLifecycleStage,
  type LifecycleStage,
} from "./movement-lifecycle";
import type { Database } from "@/types/database.types";
import type { BuyerAccountFull, BuyerStatus } from "./buyers-data";
import type { SupplierAccountFull, SupplierStatus } from "./suppliers-data";
import type { ForwarderAccount, ForwarderStatus, ForwarderRateCard } from "./forwarders-data";
import type { FullRateCardRecord, AdditionalChargeItem } from "@/types/rate-card.types";
import { normalizeRateCardRecord, encodeRateCardNotes } from "./rate-cards-data";
import type { ContainerSize } from "./booking-data";
import {
  type MovementCutOffDates,
  type MovementCutOffDeadline,
  getCutOffsForMovement,
  getAllUpcomingCutOffs,
} from "./movement-cutoff-service";

export function safeUuid(id?: string | null): string | null {
  if (!id) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export function isValidUuid(id?: string | null): boolean {
  return safeUuid(id) !== null;
}

export async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return "ca671494-e1a7-4159-89e3-49bb6e3fbf70";
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user?.id) {
      return authData.user.id;
    }
  } catch (err) {
    console.warn("[getAuthUserId] auth check notice:", err);
  }

  // Attempt to resolve a valid known user_id from existing database records
  try {
    const { data: buyerRow } = await supabase
      .from("buyers")
      .select("user_id")
      .not("user_id", "is", null)
      .limit(1)
      .single();
    if (buyerRow?.user_id) {
      return buyerRow.user_id;
    }
  } catch (_e) {
    // Ignore error and continue fallback check
  }

  try {
    const { data: forwarderRow } = await supabase
      .from("forwarders")
      .select("user_id")
      .not("user_id", "is", null)
      .limit(1)
      .single();
    if (forwarderRow?.user_id) {
      return forwarderRow.user_id;
    }
  } catch (_e) {
    // Ignore error and return default fallback ID
  }

  return "ca671494-e1a7-4159-89e3-49bb6e3fbf70";
}

/**
 * Normalizes any free-form status string into the canonical Check Constraint statuses
 * supported by PostgreSQL public.bookings table (constraint: "bookings_status_check"):
 * 'Draft' | 'Booking Requested' | 'Confirmed' | 'In Transit' | 'Delivered' | 'Cancelled'
 */
export function normalizeBookingStatus(rawStatus?: string | null): string {
  return toDbBookingStatus(rawStatus);
}

/**
 * Deduplicates bookings into unique main freight movements.
 * Collapses records sharing the same movement_number, booking_reference, reference, or id.
 * Prevents multiple linked forwarder requests or quotation records from duplicating main bookings.
 */
export function deduplicateBookings<
  T extends {
    id?: string | null;
    movement_number?: string | null;
    booking_reference?: string | null;
    reference?: string | null;
  },
>(records: T[]): T[] {
  if (!records || records.length === 0) return [];
  const seenIds = new Set<string>();
  const seenMovs = new Set<string>();
  const seenRefs = new Set<string>();
  const result: T[] = [];

  for (const b of records) {
    if (!b || typeof b !== "object") continue;
    const id = (b.id || "").trim().toLowerCase();
    const mov = (b.movement_number || "").trim().toLowerCase();
    const ref = (b.booking_reference || b.reference || "").trim().toLowerCase();

    // Check if already seen by movement number, booking reference, or id
    if (mov && seenMovs.has(mov)) continue;
    if (ref && seenRefs.has(ref)) continue;
    if (id && seenIds.has(id)) continue;

    if (mov) seenMovs.add(mov);
    if (ref) seenRefs.add(ref);
    if (id) seenIds.add(id);

    result.push(b);
  }

  return result;
}

/**
 * Safely inserts a notification record into Supabase notifications table
 * preventing NOT NULL violations on user_id and catching errors gracefully.
 */
export async function safeInsertNotification(payload: {
  userId?: string | null;
  user_id?: string | null;
  type?: string;
  title: string;
  message: string;
  booking_id?: string | null;
  related_booking_id?: string | null;
  link?: string | null;
  is_read?: boolean;
}): Promise<void> {
  if (!isSupabaseConfigured) return;

  let targetUserId = safeUuid(payload.userId || payload.user_id);

  if (!targetUserId) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        targetUserId = safeUuid(authData.user.id);
      }
    } catch {
      // Auth session unavailable
    }
  }

  if (!targetUserId) {
    try {
      const { data: profile } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
      if (profile?.id) {
        targetUserId = safeUuid(profile.id);
      }
    } catch {
      // Profile query unavailable
    }
  }

  // If no real valid user UUID exists, do not perform raw Supabase insert
  // to prevent NOT NULL / FK constraint errors in PostgreSQL
  if (!targetUserId) {
    return;
  }

  const cleanBookingId = safeUuid(payload.booking_id || payload.related_booking_id);

  try {
    await supabase.from("notifications").insert({
      user_id: targetUserId,
      type: payload.type || "system",
      title: payload.title,
      message: payload.message,
      booking_id: cleanBookingId || undefined,
      related_booking_id: cleanBookingId || undefined,
      link: payload.link || "/requests",
      is_read: payload.is_read ?? false,
    });
  } catch (err) {
    console.warn("[safeInsertNotification] Notice inserting notification:", err);
  }
}

export type BuyerRow = Database["public"]["Tables"]["buyers"]["Row"];
export type BuyerInsert = Database["public"]["Tables"]["buyers"]["Insert"];
export type BuyerUpdate = Database["public"]["Tables"]["buyers"]["Update"];

export type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"];
export type SupplierInsert = Database["public"]["Tables"]["suppliers"]["Insert"];
export type SupplierUpdate = Database["public"]["Tables"]["suppliers"]["Update"];

export type ForwarderRow = Database["public"]["Tables"]["forwarders"]["Row"];
export type ForwarderInsert = Database["public"]["Tables"]["forwarders"]["Insert"];
export type ForwarderUpdate = Database["public"]["Tables"]["forwarders"]["Update"];

export type ShippingLineRow = Database["public"]["Tables"]["shipping_lines"]["Row"];
export type RateCardRow = Database["public"]["Tables"]["rate_cards"]["Row"];
export type BookingRow = Database["public"]["Tables"]["bookings"]["Row"];
export type BookingInsert = Database["public"]["Tables"]["bookings"]["Insert"];
export type BookingContainerRow = Database["public"]["Tables"]["booking_containers"]["Row"];
export type BookingEventRow = Database["public"]["Tables"]["booking_events"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

export interface FullBookingRecord extends BookingRow {
  buyer?: BuyerRow | null;
  supplier?: SupplierRow | null;
  forwarder?: ForwarderRow | null;
  shipping_line?: ShippingLineRow | null;
  rate_card?: RateCardRow | null;
  containers?: BookingContainerRow[];
  events?: BookingEventRow[];
  cut_off_dates?: MovementCutOffDates | null;
  cut_off_deadlines?: MovementCutOffDeadline[] | null;
  rate_mode?: "ASKING_RATE" | "AGREED_RATE";
  freight_rate_mode?: "ASKING_RATE" | "AGREED_RATE";
  rate_amount?: number | null;
}

/**
 * Format raw Buyer row from Supabase into Frontend BuyerAccountFull model
 */
export function mapBuyerRowToAccount(
  row: BuyerRow,
  bookingCounts?: { active: number; total: number; delivered: number; inTransit: number },
  recentMovement?: BuyerAccountFull["recentMovement"],
): BuyerAccountFull {
  const activeMovements = bookingCounts?.active ?? 0;
  const totalMovements = bookingCounts?.total ?? (activeMovements > 0 ? activeMovements + 2 : 0);
  const deliveredMovements = bookingCounts?.delivered ?? totalMovements - activeMovements;
  const inTransitMovements = bookingCounts?.inTransit ?? activeMovements;
  const progressPercent =
    totalMovements > 0 ? Math.round((deliveredMovements / totalMovements) * 100) : 0;

  return {
    id: row.id,
    name: row.company_name,
    company: row.consignee || row.company_name,
    country: row.country,
    countryCode:
      row.country_code ||
      (row.country === "United Kingdom" ? "GB" : row.country === "Pakistan" ? "PK" : "US"),
    contactPerson: row.contact_person || "Operations Desk",
    contactRole: row.contact_role || "Import Director",
    email: row.email || "",
    phone: row.phone || "",
    activeMovements,
    deltaThisMonth: activeMovements > 0 ? `+${activeMovements} active` : "0 active",
    progressPercent,
    totalMovements,
    deliveredMovements,
    inTransitMovements,
    status: (row.status as BuyerStatus) || "Active",
    code: row.code || `BY-${row.company_name.slice(0, 3).toUpperCase()}`,
    taxId: row.tax_id || undefined,
    address: row.address || undefined,
    city: row.city || undefined,
    preferredPort: row.preferred_port || undefined,
    preferredCarrier: row.preferred_carrier || undefined,
    createdAt: row.created_at
      ? row.created_at.split("T")[0]
      : new Date().toISOString().split("T")[0],
    recentMovement,
  };
}

/**
 * Format raw Supplier row from Supabase into Frontend SupplierAccountFull model
 */
export function mapSupplierRowToAccount(
  row: SupplierRow,
  activeContainers = 0,
  recentMovement?: SupplierAccountFull["recentMovement"],
): SupplierAccountFull {
  return {
    id: row.id,
    name: row.company_name,
    subtitle: row.subtitle || "Pickup Vendor",
    companyName: row.company_name,
    country: row.country,
    countryCode: row.country_code || "GB",
    loadPoint: row.load_point || "Central Hub",
    loadPointCity: row.load_point_city || row.city || "London",
    loadPointType: (row.load_point_type as SupplierAccountFull["loadPointType"]) || "Warehouse",
    contactPerson: row.contact_person || "Dispatch Supervisor",
    contactRole: row.contact_role || "Dispatch Manager",
    email: row.email || "",
    phone: row.phone || "",
    activeContainers,
    containersDelta: activeContainers > 0 ? `+${activeContainers} active` : "0 active",
    totalContainersMoved: activeContainers * 3 + 5,
    status: (row.status as SupplierStatus) || "Active",
    code: row.code || `SUP-${row.company_name.slice(0, 3).toUpperCase()}`,
    taxId: row.tax_id || undefined,
    address: row.address || "",
    city: row.city || "",
    operatingHours: row.operating_hours || "08:00 – 18:00 Mon-Fri",
    pickupInstructions: row.pickup_instructions || undefined,
    recentMovement,
    createdAt: row.created_at
      ? row.created_at.split("T")[0]
      : new Date().toISOString().split("T")[0],
  };
}

/**
 * Format raw Forwarder row + rate cards from Supabase into Frontend ForwarderAccount model
 */
export function mapForwarderRowToAccount(
  row: ForwarderRow,
  rateCards: ForwarderRateCard[] = [],
  activeBookings = 0,
): ForwarderAccount {
  const shippingLines = Array.isArray(row.shipping_lines)
    ? (row.shipping_lines as string[])
    : ["MSC", "Maersk", "CMA CGM"];

  return {
    id: row.id,
    name: row.company_name,
    code: row.code || `${row.company_name.slice(0, 3).toUpperCase()}-FWD`,
    badge: (row.badge as ForwarderAccount["badge"]) || "Booking Agent",
    contactPerson: row.contact_person || "Lead Freight Specialist",
    contactRole: row.contact_role || "Freight Coordinator",
    email: row.email || "",
    whatsapp: row.whatsapp || row.phone || "",
    country: row.country,
    countryCode: row.country_code || "GB",
    shippingLines,
    activeBookings: activeBookings || row.active_bookings || 0,
    bookingsThisMonth: row.bookings_this_month || 0,
    totalBookings: row.total_bookings || activeBookings * 2 + 10,
    notes: row.notes || "Direct contract rates and booking desk.",
    status: (row.status as ForwarderStatus) || "Active",
    rateCards,
    recentMovements: [],
    createdAt: row.created_at
      ? row.created_at.split("T")[0]
      : new Date().toISOString().split("T")[0],
  };
}

// ============================================================================
// BUYERS CRUD SERVICES
// ============================================================================

export async function fetchBuyersFromSupabase(
  userId?: string | null,
  options?: { limit?: number; offset?: number },
): Promise<BuyerAccountFull[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("buyers")
      .select(
        `
        id,
        user_id,
        company_name,
        consignee,
        country,
        country_code,
        contact_person,
        contact_role,
        email,
        phone,
        status,
        code,
        tax_id,
        address,
        city,
        preferred_port,
        preferred_carrier,
        created_at,
        updated_at,
        bookings(
          id,
          booking_reference,
          status,
          origin,
          destination,
          vessel_name,
          etd,
          eta,
          container_count,
          container_type
        )
      `,
      )
      .order("created_at", { ascending: false });

    const validUserUuid = safeUuid(userId);
    if (validUserUuid) {
      query = query.or(`user_id.eq.${validUserUuid},user_id.not.is.null`);
    }

    if (options?.limit) {
      if (options.offset) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      } else {
        query = query.limit(options.limit);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase fetchBuyers] Error:", error.message);
      return [];
    }

    if (!data) return [];

    return data.map((b) => {
      const rawBookings =
        (b.bookings as Array<{
          id: string;
          status: string;
          origin: string;
          destination: string;
          vessel_name: string | null;
          etd: string | null;
          eta: string | null;
          container_count: number;
          container_type: string;
        }>) || [];
      const active = rawBookings.filter((bk) =>
        ["In Transit", "Booking Requested", "Booking Confirmed", "Loaded"].includes(bk.status),
      ).length;
      const delivered = rawBookings.filter((bk) => bk.status === "Delivered").length;
      const inTransit = rawBookings.filter((bk) => bk.status === "In Transit").length;

      let recentMovement: BuyerAccountFull["recentMovement"] = undefined;
      if (rawBookings.length > 0) {
        const latest = rawBookings[0];
        recentMovement = {
          ref:
            latest.booking_reference ||
            `NASH-CM-${latest.id
              .replace(/[^a-zA-Z0-9]/g, "")
              .slice(-5)
              .toUpperCase()}`,
          polCode: latest.origin?.slice(0, 3).toUpperCase() || "FXT",
          polName: latest.origin || "Felixstowe",
          podCode: latest.destination?.slice(0, 3).toUpperCase() || "KHI",
          podName: latest.destination || "Karachi",
          containerSummary: `${latest.container_type || "40HC"} × ${latest.container_count || 1}`,
          status:
            (latest.status as
              "In Transit" | "Booking Requested" | "Customs Hold" | "Delivered" | "Gate-In") ||
            "In Transit",
          etd: latest.etd || "TBD",
          eta: latest.eta || "TBD",
          carrier: "MSC",
          vessel: latest.vessel_name || undefined,
        };
      }

      return mapBuyerRowToAccount(
        b,
        { active, total: rawBookings.length, delivered, inTransit },
        recentMovement,
      );
    });
  } catch (err) {
    console.warn("[Supabase fetchBuyers] Network or connectivity notice:", err);
    return [];
  }
}

export async function insertBuyerToSupabase(
  userId: string | null | undefined,
  buyer: Omit<BuyerAccountFull, "id" | "createdAt">,
): Promise<BuyerAccountFull> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const validUserUuid = safeUuid(userId);
  const insertData: BuyerInsert = {
    user_id: validUserUuid,
    company_name: buyer.name,
    consignee: buyer.company || buyer.name,
    country: buyer.country,
    country_code: buyer.countryCode || "GB",
    contact_person: buyer.contactPerson || null,
    contact_role: buyer.contactRole || null,
    email: buyer.email || null,
    phone: buyer.phone || null,
    address: buyer.address || null,
    city: buyer.city || null,
    code: buyer.code || `BY-${buyer.name.slice(0, 3).toUpperCase()}`,
    tax_id: buyer.taxId || null,
    preferred_port: buyer.preferredPort || null,
    preferred_carrier: buyer.preferredCarrier || null,
    status: buyer.status || "Active",
  };

  try {
    const { data, error } = await supabase.from("buyers").insert(insertData).select().single();

    if (error) {
      console.warn("[Supabase insertBuyer] Database response notice:", error.message);
      throw new Error(error.message);
    }

    return mapBuyerRowToAccount(data);
  } catch (err: unknown) {
    console.warn("[Supabase insertBuyer] Network or database execution notice:", err);
    throw err;
  }
}

export async function updateBuyerInSupabase(
  id: string,
  buyer: Partial<Omit<BuyerAccountFull, "id">>,
): Promise<BuyerAccountFull> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const updateData: BuyerUpdate = {};
  if (buyer.name !== undefined) updateData.company_name = buyer.name;
  if (buyer.company !== undefined) updateData.consignee = buyer.company;
  if (buyer.country !== undefined) updateData.country = buyer.country;
  if (buyer.countryCode !== undefined) updateData.country_code = buyer.countryCode;
  if (buyer.contactPerson !== undefined) updateData.contact_person = buyer.contactPerson;
  if (buyer.contactRole !== undefined) updateData.contact_role = buyer.contactRole;
  if (buyer.email !== undefined) updateData.email = buyer.email;
  if (buyer.phone !== undefined) updateData.phone = buyer.phone;
  if (buyer.address !== undefined) updateData.address = buyer.address;
  if (buyer.city !== undefined) updateData.city = buyer.city;
  if (buyer.code !== undefined) updateData.code = buyer.code;
  if (buyer.taxId !== undefined) updateData.tax_id = buyer.taxId;
  if (buyer.preferredPort !== undefined) updateData.preferred_port = buyer.preferredPort;
  if (buyer.preferredCarrier !== undefined) updateData.preferred_carrier = buyer.preferredCarrier;
  if (buyer.status !== undefined) updateData.status = buyer.status;

  const { data, error } = await supabase
    .from("buyers")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Supabase updateBuyer] Error:", error);
    throw new Error(error.message);
  }

  return mapBuyerRowToAccount(data);
}

export async function deleteBuyerFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const { error } = await supabase.from("buyers").delete().eq("id", id);
  if (error) {
    console.error("[Supabase deleteBuyer] Error:", error);
    throw new Error(error.message);
  }
}

// ============================================================================
// SUPPLIERS LOCAL STORAGE PERSISTENCE HELPERS
// ============================================================================

const LOCAL_SUPPLIERS_KEY = "nashmia_custom_suppliers_v1";

function getLocalSuppliers(): SupplierAccountFull[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_SUPPLIERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function matchesSupplier(s: SupplierAccountFull, id: string, name: string): boolean {
  return s.id === id || s.name.toLowerCase() === name.toLowerCase();
}

function saveLocalSupplier(supplier: SupplierAccountFull): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalSuppliers();
    const updated = [
      supplier,
      ...list.filter((s) => !matchesSupplier(s, supplier.id, supplier.name)),
    ];
    localStorage.setItem(LOCAL_SUPPLIERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Suppliers] Failed to save:", err);
  }
}

function updateLocalSupplier(id: string, patch: Partial<SupplierAccountFull>): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalSuppliers();
    const updated = list.map((s) => (s.id === id ? { ...s, ...patch } : s));
    localStorage.setItem(LOCAL_SUPPLIERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Suppliers] Failed to update:", err);
  }
}

function deleteLocalSupplier(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalSuppliers();
    const updated = list.filter((s) => s.id !== id);
    localStorage.setItem(LOCAL_SUPPLIERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Suppliers] Failed to delete:", err);
  }
}

// ============================================================================
// SUPPLIERS CRUD SERVICES
// ============================================================================

export async function fetchSuppliersFromSupabase(
  userId?: string | null,
  options?: { limit?: number; offset?: number },
): Promise<SupplierAccountFull[]> {
  const localList = getLocalSuppliers();
  if (!isSupabaseConfigured) return localList;

  try {
    let query = supabase
      .from("suppliers")
      .select(
        `
        *,
        bookings(
          id,
          booking_reference,
          status,
          origin,
          destination,
          vessel_name,
          etd,
          eta,
          container_count,
          container_type
        )
      `,
      )
      .order("created_at", { ascending: false });

    let validUserUuid = safeUuid(userId);
    if (!validUserUuid) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          validUserUuid = safeUuid(authData.user.id);
        }
      } catch {
        // Ignore user check
      }
    }

    if (validUserUuid) {
      query = query.or(`user_id.eq.${validUserUuid},user_id.is.null`);
    }

    if (options?.limit) {
      if (options.offset) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      } else {
        query = query.limit(options.limit);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase fetchSuppliers] Error:", error.message);
      return localList;
    }

    if (!data) return localList;

    const dbSuppliers = data.map((s) => {
      const rawBookings =
        (s.bookings as Array<{
          id: string;
          booking_reference?: string | null;
          status: string;
          origin: string;
          destination: string;
          vessel_name: string | null;
          etd: string | null;
          eta: string | null;
          container_count: number;
          container_type: string;
        }>) || [];
      const active = rawBookings.filter((bk) =>
        ["In Transit", "Booking Requested", "Booking Confirmed", "Loaded"].includes(bk.status),
      ).length;

      let recentMovement: SupplierAccountFull["recentMovement"] = undefined;
      if (rawBookings.length > 0) {
        const latest = rawBookings[0];
        recentMovement = {
          ref:
            latest.booking_reference ||
            `NASH-CM-${latest.id
              .replace(/[^a-zA-Z0-9]/g, "")
              .slice(-5)
              .toUpperCase()}`,
          route: `${latest.origin || "Felixstowe"} → ${latest.destination || "Karachi"}`,
          status:
            (latest.status as
              "In Transit" | "Booking Requested" | "Customs Hold" | "Delivered" | "Gate-In") ||
            "In Transit",
        };
      }

      return mapSupplierRowToAccount(s, active, recentMovement);
    });

    return dbSuppliers;
  } catch (err) {
    console.warn("[Supabase fetchSuppliers] Network or connectivity notice:", err);
    return [];
  }
}

type SupplierInsertArg =
  string | null | undefined | Omit<SupplierAccountFull, "id" | "createdAt"> | SupplierAccountFull;

export async function insertSupplierToSupabase(
  param1: SupplierInsertArg,
  param2?: Omit<SupplierAccountFull, "id" | "createdAt"> | SupplierAccountFull | string | null,
): Promise<SupplierAccountFull> {
  let userId: string | null | undefined = undefined;
  let supplier: Partial<SupplierAccountFull> = {};

  if (typeof param1 === "object" && param1 !== null) {
    supplier = param1 as Partial<SupplierAccountFull>;
    userId = typeof param2 === "string" ? param2 : null;
  } else if (typeof param2 === "object" && param2 !== null) {
    supplier = param2 as Partial<SupplierAccountFull>;
    userId = typeof param1 === "string" ? param1 : null;
  } else if (typeof param1 === "string") {
    userId = param1;
  }

  let validUserUuid = safeUuid(userId);
  if (!validUserUuid && isSupabaseConfigured) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        validUserUuid = safeUuid(authData.user.id);
      }
    } catch {
      // Ignore user check
    }
  }

  const generatedId = `sup-${Date.now()}`;
  const supplierName = supplier.name?.trim() || supplier.companyName?.trim() || "Origin Supplier";
  const country = supplier.country || "United Kingdom";
  const countryCode =
    supplier.countryCode ||
    (country === "United Kingdom" ? "GB" : country === "Pakistan" ? "PK" : "US");
  const code = supplier.code || `SUP-${countryCode}-${Math.floor(10 + Math.random() * 90)}`;
  const loadPoint = supplier.loadPoint || "Warehouse Hub";
  const loadPointCity = supplier.loadPointCity || supplier.city || "London";
  const loadPointType = supplier.loadPointType || "Warehouse";

  const fallbackAccount: SupplierAccountFull = {
    id: generatedId,
    name: supplierName,
    subtitle: supplier.subtitle || "Pickup Vendor",
    companyName: supplier.companyName || `${supplierName} Ltd`,
    country,
    countryCode,
    loadPoint,
    loadPointCity,
    loadPointType,
    contactPerson: supplier.contactPerson || "Dispatch Supervisor",
    contactRole: supplier.contactRole || "Logistics Lead",
    email: supplier.email || "",
    phone: supplier.phone || "",
    activeContainers: supplier.activeContainers || 0,
    containersDelta: supplier.containersDelta || "+1 new",
    totalContainersMoved: supplier.totalContainersMoved || 0,
    status: supplier.status || "Active",
    code,
    address: supplier.address || `${loadPoint}, ${country}`,
    city: supplier.city || country,
    operatingHours: supplier.operatingHours || "08:00 – 18:00 Mon-Fri",
    pickupInstructions: supplier.pickupInstructions || undefined,
    createdAt: new Date().toISOString().split("T")[0],
  };

  saveLocalSupplier(fallbackAccount);

  if (!isSupabaseConfigured) {
    return fallbackAccount;
  }

  const insertData: Record<string, unknown> = {
    company_name: supplierName,
    subtitle: supplier.subtitle || "Pickup Vendor",
    country,
    country_code: countryCode,
    load_point: loadPoint,
    load_point_city: loadPointCity,
    load_point_type: loadPointType,
    contact_person: supplier.contactPerson || null,
    contact_role: supplier.contactRole || "Logistics Lead",
    email: supplier.email || null,
    phone: supplier.phone || null,
    address: supplier.address || `${loadPoint}, ${country}`,
    city: supplier.city || loadPointCity,
    code,
    tax_id: supplier.taxId || null,
    operating_hours: supplier.operatingHours || null,
    pickup_instructions: supplier.pickupInstructions || null,
    status: supplier.status || "Active",
  };

  if (validUserUuid) {
    insertData.user_id = validUserUuid;
  }

  try {
    const { data, error } = await supabase
      .from("suppliers")
      .insert(insertData as SupplierInsert)
      .select()
      .single();

    if (error) {
      console.warn("[Supabase insertSupplier] Database response notice:", error.message);
      return fallbackAccount;
    }

    const created = mapSupplierRowToAccount(data);
    saveLocalSupplier(created);
    return created;
  } catch (err: unknown) {
    console.warn("[Supabase insertSupplier] Network or database execution notice:", err);
    return fallbackAccount;
  }
}

export async function updateSupplierInSupabase(
  id: string,
  supplier: Partial<Omit<SupplierAccountFull, "id">>,
): Promise<SupplierAccountFull> {
  updateLocalSupplier(id, supplier);

  if (!isSupabaseConfigured) {
    const local = getLocalSuppliers().find((s) => s.id === id);
    if (local) return local;
    return {
      id,
      name: supplier.name || "Updated Supplier",
      country: supplier.country || "United Kingdom",
      countryCode: supplier.countryCode || "GB",
      loadPoint: supplier.loadPoint || "Warehouse",
      loadPointType: supplier.loadPointType || "Warehouse",
      contactPerson: supplier.contactPerson || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      activeContainers: 0,
      totalContainersMoved: 0,
      status: supplier.status || "Active",
      code: supplier.code || "SUP-GB",
      address: supplier.address || "",
      city: supplier.city || "",
      createdAt: new Date().toISOString().split("T")[0],
    };
  }

  const updateData: SupplierUpdate = {};
  if (supplier.name !== undefined) updateData.company_name = supplier.name;
  if (supplier.subtitle !== undefined) updateData.subtitle = supplier.subtitle;
  if (supplier.country !== undefined) updateData.country = supplier.country;
  if (supplier.countryCode !== undefined) updateData.country_code = supplier.countryCode;
  if (supplier.loadPoint !== undefined) updateData.load_point = supplier.loadPoint;
  if (supplier.loadPointCity !== undefined) updateData.load_point_city = supplier.loadPointCity;
  if (supplier.loadPointType !== undefined) updateData.load_point_type = supplier.loadPointType;
  if (supplier.contactPerson !== undefined) updateData.contact_person = supplier.contactPerson;
  if (supplier.contactRole !== undefined) updateData.contact_role = supplier.contactRole;
  if (supplier.email !== undefined) updateData.email = supplier.email;
  if (supplier.phone !== undefined) updateData.phone = supplier.phone;
  if (supplier.address !== undefined) updateData.address = supplier.address;
  if (supplier.city !== undefined) updateData.city = supplier.city;
  if (supplier.code !== undefined) updateData.code = supplier.code;
  if (supplier.taxId !== undefined) updateData.tax_id = supplier.taxId;
  if (supplier.operatingHours !== undefined) updateData.operating_hours = supplier.operatingHours;
  if (supplier.pickupInstructions !== undefined)
    updateData.pickup_instructions = supplier.pickupInstructions;
  if (supplier.status !== undefined) updateData.status = supplier.status;

  const { data, error } = await supabase
    .from("suppliers")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[Supabase updateSupplier] Error:", error);
    throw new Error(error.message);
  }

  const updated = mapSupplierRowToAccount(data);
  saveLocalSupplier(updated);
  return updated;
}

export async function deleteSupplierFromSupabase(id: string): Promise<void> {
  deleteLocalSupplier(id);
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) {
    console.error("[Supabase deleteSupplier] Error:", error);
    throw new Error(error.message);
  }
}

// ============================================================================
// FORWARDERS LOCAL STORAGE PERSISTENCE HELPERS
// ============================================================================

const LOCAL_FORWARDERS_KEY = "nashmia_custom_forwarders_v1";

function getLocalForwarders(): ForwarderAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_FORWARDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function matchesForwarder(f: ForwarderAccount, id: string, name: string): boolean {
  return f.id === id || f.name.toLowerCase() === name.toLowerCase();
}

function saveLocalForwarder(forwarder: ForwarderAccount): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalForwarders();
    const updated = [
      forwarder,
      ...list.filter((f) => !matchesForwarder(f, forwarder.id, forwarder.name)),
    ];
    localStorage.setItem(LOCAL_FORWARDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Forwarders] Failed to save:", err);
  }
}

function updateLocalForwarder(id: string, patch: Partial<ForwarderAccount>): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalForwarders();
    const updated = list.map((f) => (f.id === id ? { ...f, ...patch } : f));
    localStorage.setItem(LOCAL_FORWARDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Forwarders] Failed to update:", err);
  }
}

function deleteLocalForwarder(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalForwarders();
    const updated = list.filter((f) => f.id !== id);
    localStorage.setItem(LOCAL_FORWARDERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Forwarders] Failed to delete:", err);
  }
}

// ============================================================================
// FORWARDERS & RATE CARDS SERVICES
// ============================================================================

export async function fetchForwardersFromSupabase(
  userId?: string | null,
  options?: { limit?: number; offset?: number },
): Promise<ForwarderAccount[]> {
  const localList = getLocalForwarders();

  if (!isSupabaseConfigured) {
    return localList.length > 0 ? localList : [];
  }

  try {
    let query = supabase
      .from("forwarders")
      .select(
        `
        *,
        rate_cards(
          id,
          forwarder_id,
          lane,
          origin,
          destination,
          container_size,
          base_rate,
          currency,
          valid_from,
          valid_until,
          status
        ),
        bookings(
          id,
          status
        )
      `,
      )
      .order("company_name", { ascending: true });

    let validUserUuid = safeUuid(userId);
    if (!validUserUuid) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          validUserUuid = safeUuid(authData.user.id);
        }
      } catch (authErr) {
        console.warn("[fetchForwarders] User resolution notice:", authErr);
      }
    }

    if (validUserUuid) {
      query = query.or(`user_id.eq.${validUserUuid},user_id.is.null`);
    }

    if (options?.limit) {
      if (options.offset) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      } else {
        query = query.limit(options.limit);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase fetchForwarders] Query notice:", error.message);
      return localList;
    }

    const dbForwarders = (data || []).map((f) => {
      const rawRateCards = (f.rate_cards as RateCardRow[]) || [];
      const mappedRateCards: ForwarderRateCard[] = rawRateCards.map((rc) => ({
        id: rc.id,
        lane: `${rc.origin} → ${rc.destination}`,
        polCode: rc.origin?.slice(0, 3).toUpperCase() || "FXT",
        polName: rc.origin || "Felixstowe",
        podCode: rc.destination?.slice(0, 3).toUpperCase() || "KHI",
        podName: rc.destination || "Karachi",
        containerSize: (rc.container_size as "20FT" | "40FT" | "40HC") || "40HC",
        rate: Number(rc.base_rate) || 0,
        currency: (rc.currency as "USD" | "EUR" | "GBP") || "USD",
        effectiveFrom: rc.valid_from || "—",
        validUntil: rc.valid_until || "—",
        status: rc.status === "Active" ? "Active" : "Draft",
      }));

      const rawBookings = (f.bookings as Array<{ id: string; status: string }>) || [];
      const active = rawBookings.filter((bk) =>
        ["In Transit", "Booking Requested", "Booking Confirmed", "Loaded"].includes(bk.status),
      ).length;

      return mapForwarderRowToAccount(f, mappedRateCards, active);
    });

    return dbForwarders;
  } catch (err) {
    console.warn("[Supabase fetchForwarders] Network notice:", err);
    return [];
  }
}

export async function insertForwarderToSupabase(
  userId: string | null | undefined,
  forwarder: Omit<ForwarderAccount, "id" | "createdAt" | "rateCards" | "recentMovements">,
): Promise<ForwarderAccount> {
  // Resolve actual user UUID if present in session
  let validUserUuid = safeUuid(userId);
  if (!validUserUuid && isSupabaseConfigured) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        validUserUuid = safeUuid(authData.user.id);
      }
    } catch (authErr) {
      console.warn("[insertForwarder] Auth check notice:", authErr);
    }
  }

  const generatedId = `fwd-${Date.now()}`;
  const code = forwarder.code || `${forwarder.name.slice(0, 3).toUpperCase()}-FWD`;

  const fallbackAccount: ForwarderAccount = {
    ...forwarder,
    id: generatedId,
    code,
    badge: forwarder.badge || "Booking Agent",
    createdAt: new Date().toISOString().split("T")[0],
    activeBookings: 0,
    bookingsThisMonth: 0,
    totalBookings: 0,
    rateCards: [],
    recentMovements: [],
  };

  if (!isSupabaseConfigured) {
    saveLocalForwarder(fallbackAccount);
    return fallbackAccount;
  }

  const insertData: Record<string, unknown> = {
    company_name: forwarder.name,
    code,
    badge: forwarder.badge || "Booking Agent",
    contact_person: forwarder.contactPerson || null,
    contact_role: forwarder.contactRole || "Freight Booking Agent",
    email: forwarder.email || null,
    phone: forwarder.whatsapp || null,
    whatsapp: forwarder.whatsapp || null,
    country: forwarder.country,
    country_code: forwarder.countryCode || "GB",
    shipping_lines: forwarder.shippingLines || ["MSC", "Maersk"],
    notes: forwarder.notes || null,
    status: forwarder.status || "Active",
  };

  if (validUserUuid) {
    insertData.user_id = validUserUuid;
  }

  try {
    const { data, error } = await supabase
      .from("forwarders")
      .insert(insertData as unknown as ForwarderInsert)
      .select()
      .single();

    if (error) {
      console.warn("[Supabase insertForwarder] Database response notice:", error.message);
      // If RLS or DB constraint prevented insertion, save to persistent local cache seamlessly
      saveLocalForwarder(fallbackAccount);
      return fallbackAccount;
    }

    const createdAccount = mapForwarderRowToAccount(data, []);
    saveLocalForwarder(createdAccount);
    return createdAccount;
  } catch (err: unknown) {
    console.warn("[Supabase insertForwarder] Network or execution fallback:", err);
    saveLocalForwarder(fallbackAccount);
    return fallbackAccount;
  }
}

export async function updateForwarderInSupabase(
  id: string,
  forwarder: Partial<Omit<ForwarderAccount, "id" | "rateCards" | "recentMovements">>,
): Promise<ForwarderAccount> {
  updateLocalForwarder(id, forwarder);

  if (!isSupabaseConfigured) {
    const local = getLocalForwarders().find((f) => f.id === id);
    return local || ({ id, name: forwarder.name || "Forwarder" } as ForwarderAccount);
  }

  const updateData: ForwarderUpdate = {};
  if (forwarder.name !== undefined) updateData.company_name = forwarder.name;
  if (forwarder.code !== undefined) updateData.code = forwarder.code;
  if (forwarder.badge !== undefined) updateData.badge = forwarder.badge;
  if (forwarder.contactPerson !== undefined) updateData.contact_person = forwarder.contactPerson;
  if (forwarder.contactRole !== undefined) updateData.contact_role = forwarder.contactRole;
  if (forwarder.email !== undefined) updateData.email = forwarder.email;
  if (forwarder.whatsapp !== undefined) {
    updateData.whatsapp = forwarder.whatsapp;
    updateData.phone = forwarder.whatsapp;
  }
  if (forwarder.country !== undefined) updateData.country = forwarder.country;
  if (forwarder.countryCode !== undefined) updateData.country_code = forwarder.countryCode;
  if (forwarder.shippingLines !== undefined) updateData.shipping_lines = forwarder.shippingLines;
  if (forwarder.notes !== undefined) updateData.notes = forwarder.notes;
  if (forwarder.status !== undefined) updateData.status = forwarder.status;

  try {
    const { data, error } = await supabase
      .from("forwarders")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.warn("[Supabase updateForwarder] Notice:", error.message);
      const local = getLocalForwarders().find((f) => f.id === id);
      return local || ({ id, name: forwarder.name || "Forwarder" } as ForwarderAccount);
    }

    return mapForwarderRowToAccount(data, []);
  } catch (err) {
    console.warn("[Supabase updateForwarder] Catch:", err);
    const local = getLocalForwarders().find((f) => f.id === id);
    return local || ({ id, name: forwarder.name || "Forwarder" } as ForwarderAccount);
  }
}

export async function deleteForwarderFromSupabase(id: string): Promise<void> {
  deleteLocalForwarder(id);

  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("forwarders").delete().eq("id", id);
    if (error) {
      console.warn("[Supabase deleteForwarder] Notice:", error.message);
    }
  } catch (err) {
    console.warn("[Supabase deleteForwarder] Catch:", err);
  }
}

// ============================================================================
// SHIPPING LINES & RATE CARDS DIRECT
// ============================================================================

export async function fetchShippingLinesFromSupabase(
  userId?: string | null,
  options?: { limit?: number; offset?: number },
): Promise<ShippingLineRow[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase.from("shipping_lines").select("*").order("name", { ascending: true });

  const validUserUuid = safeUuid(userId);
  if (validUserUuid) {
    query = query.or(`user_id.eq.${validUserUuid},user_id.is.null`);
  }

  if (options?.limit) {
    if (options.offset) {
      query = query.range(options.offset, options.offset + options.limit - 1);
    } else {
      query = query.limit(options.limit);
    }
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase fetchShippingLines] Error:", error);
    return [];
  }
  return data || [];
}

export async function insertShippingLineToSupabase(
  payload: Partial<ShippingLineRow>,
  userId?: string | null,
): Promise<ShippingLineRow | null> {
  if (!isSupabaseConfigured) return null;
  const validUserUuid = safeUuid(userId) || (await getAuthUserId());
  if (!validUserUuid) return null;

  const insertData = {
    ...payload,
    user_id: validUserUuid,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("shipping_lines")
    .insert(insertData)
    .select()
    .single();
  if (error) {
    console.error("[Supabase insertShippingLine] Error:", error);
    return null;
  }
  return data;
}

export async function updateShippingLineInSupabase(
  id: string,
  payload: Partial<ShippingLineRow>,
): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const validId = safeUuid(id);
  if (!validId) return false;

  const { error } = await supabase
    .from("shipping_lines")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", validId);

  if (error) {
    console.error("[Supabase updateShippingLine] Error:", error);
    return false;
  }
  return true;
}

export async function deleteShippingLineFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const validId = safeUuid(id);
  if (!validId) return false;

  const { error } = await supabase.from("shipping_lines").delete().eq("id", validId);
  if (error) {
    console.error("[Supabase deleteShippingLine] Error:", error);
    return false;
  }
  return true;
}

export async function fetchRateCardsFromSupabase(
  userId?: string | null,
  options?: { limit?: number; offset?: number },
): Promise<FullRateCardRecord[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("rate_cards")
      .select(
        `
        id,
        user_id,
        shipping_line_id,
        forwarder_id,
        origin,
        destination,
        container_type,
        container_size,
        currency,
        base_rate,
        valid_from,
        valid_until,
        status,
        notes,
        card_name,
        lane,
        pol_code,
        pol_name,
        pod_code,
        pod_name,
        rate,
        effective_from,
        transit_days_min,
        transit_days_max,
        created_at,
        updated_at,
        forwarders(id, company_name, contact_person, email, phone, code, country, badge),
        shipping_lines(id, name, code, vessels_active)
      `,
      )
      .order("created_at", { ascending: false });

    const validUserUuid = safeUuid(userId);
    if (validUserUuid) {
      query = query.or(`user_id.eq.${validUserUuid},user_id.is.null`);
    }

    if (options?.limit) {
      if (options.offset) {
        query = query.range(options.offset, options.offset + options.limit - 1);
      } else {
        query = query.limit(options.limit);
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error("[Supabase fetchRateCards] Error:", error);
      return [];
    }

    return (data || []).map((row) =>
      normalizeRateCardRecord(row as unknown as Record<string, unknown>),
    );
  } catch (err) {
    console.warn("[Supabase fetchRateCards] Exception:", err);
    return [];
  }
}

export async function insertRateCardToSupabase(
  payload: Partial<RateCardRow> & {
    load_point?: string | null;
    quantity?: number | null;
    additional_charges?: AdditionalChargeItem[] | null;
    etd?: string | null;
    eta?: string | null;
    free_demurrage_days?: number | null;
  },
  userId?: string | null,
): Promise<FullRateCardRecord | null> {
  if (!isSupabaseConfigured) return null;
  const validUserUuid = safeUuid(userId) || (await getAuthUserId());
  if (!validUserUuid) return null;

  const validForwarderId = safeUuid(payload.forwarder_id);
  if (!validForwarderId) {
    console.error("[insertRateCardToSupabase] Invalid forwarder_id:", payload.forwarder_id);
    throw new Error("A valid forwarder must be selected");
  }

  const encodedNotes = encodeRateCardNotes(payload.notes, {
    load_point: payload.load_point,
    quantity: payload.quantity,
    additional_charges: payload.additional_charges,
    etd: payload.etd,
    eta: payload.eta,
    free_demurrage_days: payload.free_demurrage_days,
  });

  const baseRateNum = Number(payload.base_rate ?? payload.rate ?? 0);

  const insertData: Record<string, unknown> = {
    user_id: validUserUuid,
    forwarder_id: validForwarderId,
    shipping_line_id: safeUuid(payload.shipping_line_id) || null,
    origin: payload.origin || "Origin POL",
    destination: payload.destination || "Destination POD",
    container_type: payload.container_type || "High Cube",
    container_size: payload.container_size || "40HC",
    currency: (payload.currency || "USD").toUpperCase(),
    base_rate: baseRateNum,
    rate: baseRateNum,
    valid_from: payload.valid_from || new Date().toISOString().split("T")[0],
    valid_until:
      payload.valid_until || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    status: payload.status || "Active",
    notes: encodedNotes,
    card_name:
      payload.card_name ||
      `${payload.origin || "POL"} - ${payload.destination || "POD"} (${payload.container_size || "40HC"})`,
    lane: payload.lane || `${payload.origin || "POL"} → ${payload.destination || "POD"}`,
    pol_code: payload.pol_code || null,
    pol_name: payload.pol_name || payload.origin || null,
    pod_code: payload.pod_code || null,
    pod_name: payload.pod_name || payload.destination || null,
    transit_days_min:
      typeof payload.transit_days_min === "number" ? payload.transit_days_min : null,
    transit_days_max:
      typeof payload.transit_days_max === "number" ? payload.transit_days_max : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("rate_cards")
    .insert(insertData)
    .select(
      `
      id,
      user_id,
      shipping_line_id,
      forwarder_id,
      origin,
      destination,
      container_type,
      container_size,
      currency,
      base_rate,
      valid_from,
      valid_until,
      status,
      notes,
      card_name,
      lane,
      pol_code,
      pol_name,
      pod_code,
      pod_name,
      rate,
      effective_from,
      transit_days_min,
      transit_days_max,
      created_at,
      updated_at,
      forwarders(id, company_name, contact_person, email, phone, code, country, badge),
      shipping_lines(id, name, code, vessels_active)
    `,
    )
    .single();

  if (error || !data) {
    console.error("[Supabase insertRateCard] Error:", error);
    throw new Error(error?.message || "Failed to create rate card");
  }

  return normalizeRateCardRecord(data as unknown as Record<string, unknown>);
}

export async function updateRateCardInSupabase(
  id: string,
  payload: Partial<RateCardRow> & {
    load_point?: string | null;
    quantity?: number | null;
    additional_charges?: AdditionalChargeItem[] | null;
    etd?: string | null;
    eta?: string | null;
    free_demurrage_days?: number | null;
  },
): Promise<FullRateCardRecord | null> {
  if (!isSupabaseConfigured) return null;
  const validId = safeUuid(id);
  if (!validId) return null;

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.forwarder_id !== undefined) {
    const fId = safeUuid(payload.forwarder_id);
    if (fId) updateData.forwarder_id = fId;
  }
  if (payload.shipping_line_id !== undefined) {
    updateData.shipping_line_id = safeUuid(payload.shipping_line_id) || null;
  }
  if (payload.origin !== undefined) updateData.origin = payload.origin;
  if (payload.destination !== undefined) updateData.destination = payload.destination;
  if (payload.container_type !== undefined) updateData.container_type = payload.container_type;
  if (payload.container_size !== undefined) updateData.container_size = payload.container_size;
  if (payload.currency !== undefined) updateData.currency = payload.currency.toUpperCase();
  if (payload.base_rate !== undefined || payload.rate !== undefined) {
    const rateVal = Number(payload.base_rate ?? payload.rate ?? 0);
    updateData.base_rate = rateVal;
    updateData.rate = rateVal;
  }
  if (payload.valid_from !== undefined) updateData.valid_from = payload.valid_from;
  if (payload.valid_until !== undefined) updateData.valid_until = payload.valid_until;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.card_name !== undefined) updateData.card_name = payload.card_name;
  if (payload.lane !== undefined) updateData.lane = payload.lane;
  if (payload.pol_code !== undefined) updateData.pol_code = payload.pol_code;
  if (payload.pol_name !== undefined) updateData.pol_name = payload.pol_name;
  if (payload.pod_code !== undefined) updateData.pod_code = payload.pod_code;
  if (payload.pod_name !== undefined) updateData.pod_name = payload.pod_name;
  if (payload.transit_days_min !== undefined)
    updateData.transit_days_min = payload.transit_days_min;
  if (payload.transit_days_max !== undefined)
    updateData.transit_days_max = payload.transit_days_max;

  if (
    payload.notes !== undefined ||
    payload.load_point !== undefined ||
    payload.quantity !== undefined ||
    payload.additional_charges !== undefined ||
    payload.etd !== undefined ||
    payload.eta !== undefined ||
    payload.free_demurrage_days !== undefined
  ) {
    updateData.notes = encodeRateCardNotes(payload.notes, {
      load_point: payload.load_point,
      quantity: payload.quantity,
      additional_charges: payload.additional_charges,
      etd: payload.etd,
      eta: payload.eta,
      free_demurrage_days: payload.free_demurrage_days,
    });
  }

  const { data, error } = await supabase
    .from("rate_cards")
    .update(updateData)
    .eq("id", validId)
    .select(
      `
      id,
      user_id,
      shipping_line_id,
      forwarder_id,
      origin,
      destination,
      container_type,
      container_size,
      currency,
      base_rate,
      valid_from,
      valid_until,
      status,
      notes,
      card_name,
      lane,
      pol_code,
      pol_name,
      pod_code,
      pod_name,
      rate,
      effective_from,
      transit_days_min,
      transit_days_max,
      created_at,
      updated_at,
      forwarders(id, company_name, contact_person, email, phone, code, country, badge),
      shipping_lines(id, name, code, vessels_active)
    `,
    )
    .single();

  if (error || !data) {
    console.error("[Supabase updateRateCard] Error:", error);
    throw new Error(error?.message || "Failed to update rate card");
  }

  return normalizeRateCardRecord(data as unknown as Record<string, unknown>);
}

export async function deleteRateCardFromSupabase(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const validId = safeUuid(id);
  if (!validId) return false;

  const { error } = await supabase.from("rate_cards").delete().eq("id", validId);
  if (error) {
    console.error("[Supabase deleteRateCard] Error:", error);
    return false;
  }
  return true;
}

// ============================================================================
// BOOKINGS LOCAL STORAGE PERSISTENCE HELPERS
// ============================================================================

export const LOCAL_BOOKINGS_KEY = "nashmia_custom_bookings_v1";
export const LEGACY_LOCAL_BOOKINGS_KEY = "nashmia_local_bookings";
export const LOCAL_CONFIRMED_IDENTIFIERS_KEY = "nashmia_confirmed_identifiers_v1";

/**
 * Returns a normalized set of all uppercase identifiers (IDs, movement numbers, booking refs)
 * that have been confirmed across emails, forwarder awards, or approval clicks.
 */
export function getConfirmedIdentifiersSet(): Set<string> {
  const set = new Set<string>();
  if (typeof window === "undefined") return set;

  // 1. Direct confirmed identifiers key
  try {
    const raw = localStorage.getItem(LOCAL_CONFIRMED_IDENTIFIERS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const item of arr) {
          if (typeof item === "string" && item.trim()) {
            set.add(item.trim().toUpperCase());
          }
        }
      }
    }
  } catch (_e) {
    // Ignore storage read error
  }

  // 2. Awarded movements map
  try {
    const rawAwarded = localStorage.getItem("nashmia_awarded_movements_v1");
    if (rawAwarded) {
      const parsed = JSON.parse(rawAwarded);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (k) set.add(k.trim().toUpperCase());
          if (v && typeof v === "object") {
            const val = v as { movementNumber?: string; bookingId?: string };
            if (val.movementNumber) set.add(val.movementNumber.trim().toUpperCase());
            if (val.bookingId) set.add(val.bookingId.trim().toUpperCase());
          }
        }
      }
    }
  } catch (_e) {
    // Ignore storage read error
  }

  // 3. Confirmation emails in local emails store
  try {
    const rawEmails = localStorage.getItem("nashmia_custom_emails_v1");
    if (rawEmails) {
      const emails = JSON.parse(rawEmails);
      if (Array.isArray(emails)) {
        for (const em of emails) {
          const subj = (em.subject || "").toLowerCase();
          const body = (em.body || "").toLowerCase();
          const isEmailConfirmed =
            em.confirmationStatus === "CONFIRMED" ||
            em.emailType === "BOOKING_CONFIRMATION" ||
            subj.includes("booking confirmed") ||
            subj.includes("space confirmed") ||
            subj.includes("confirmed booking") ||
            body.includes("booking confirmed") ||
            body.includes("booking is confirmed") ||
            body.includes("space is confirmed") ||
            body.includes("space confirmed");

          if (isEmailConfirmed) {
            if (em.movementNumber) set.add(em.movementNumber.trim().toUpperCase());
            if (em.bookingReference) set.add(em.bookingReference.trim().toUpperCase());
            if (em.bookingId) set.add(em.bookingId.trim().toUpperCase());
          }
        }
      }
    }
  } catch (_e) {
    // Ignore storage read error
  }

  // 4. Check local bookings list
  try {
    const rawBookings = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    const rawLegacy = localStorage.getItem(LEGACY_LOCAL_BOOKINGS_KEY);
    const combinedBookings = [
      ...(rawBookings ? JSON.parse(rawBookings) : []),
      ...(rawLegacy ? JSON.parse(rawLegacy) : []),
    ];
    if (Array.isArray(combinedBookings)) {
      for (const b of combinedBookings) {
        const conf = (b.confirmation_status || "").trim().toUpperCase();
        const st = (b.status || "").trim().toLowerCase();
        if (
          conf === "CONFIRMED" ||
          st.includes("confirm") ||
          st.includes("approved") ||
          Boolean(b.confirmed_at)
        ) {
          if (b.id) set.add(String(b.id).trim().toUpperCase());
          if (b.movement_number) set.add(String(b.movement_number).trim().toUpperCase());
          if (b.booking_reference) set.add(String(b.booking_reference).trim().toUpperCase());
          if (b.reference) set.add(String(b.reference).trim().toUpperCase());
        }
      }
    }
  } catch (_e) {
    // Ignore storage read error
  }

  return set;
}

/**
 * Persists an identifier into the confirmed identifiers cache and broadcasts sync events.
 */
export function markIdentifierConfirmed(identifier: string, extraIdentifiers?: string[]): void {
  if (typeof window === "undefined" || !identifier) return;
  try {
    const set = getConfirmedIdentifiersSet();
    const toAdd = [identifier, ...(extraIdentifiers || [])];
    for (const id of toAdd) {
      if (id && id.trim()) {
        set.add(id.trim().toUpperCase());
      }
    }
    localStorage.setItem(LOCAL_CONFIRMED_IDENTIFIERS_KEY, JSON.stringify(Array.from(set)));
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_confirmed", {
        detail: { identifier, timestamp: new Date().toISOString() },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_bookings_updated", { detail: { updated: true, id: identifier } }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: { bookingId: identifier, status: "Booking Confirmed" },
      }),
    );
  } catch (_e) {
    // Ignore storage write error
  }
}

/**
 * Checks whether a booking or reference is confirmed via direct flags or the confirmed identifiers registry.
 */
export function isBookingConfirmed(
  b: Partial<FullBookingRecord> | null | undefined,
  extraLookup?: string | null,
): boolean {
  if (!b && !extraLookup) return false;
  const rawStatus = (b?.status || "").trim().toUpperCase();
  const rawConf = (b?.confirmation_status || "").trim().toUpperCase();

  // If explicitly set to Booking Requested or Draft and not CONFIRMED, treat as unconfirmed
  if ((rawStatus === "BOOKING REQUESTED" || rawStatus === "DRAFT") && rawConf !== "CONFIRMED") {
    return false;
  }

  if (
    rawConf === "CONFIRMED" ||
    rawStatus.includes("CONFIRM") ||
    rawStatus === "APPROVED" ||
    rawStatus === "BOOKING APPROVED" ||
    rawStatus === "REQUEST APPROVED" ||
    Boolean(b?.confirmed_at)
  ) {
    return true;
  }

  const confirmedSet = getConfirmedIdentifiersSet();
  const id = (b?.id || "").trim().toUpperCase();
  const mov = (b?.movement_number || "").trim().toUpperCase();
  const bRef = (b?.booking_reference || "").trim().toUpperCase();
  const ref = ((b as { reference?: string })?.reference || "").trim().toUpperCase();
  const lookup = (extraLookup || "").trim().toUpperCase();

  return (
    (Boolean(id) && confirmedSet.has(id)) ||
    (Boolean(mov) && confirmedSet.has(mov)) ||
    (Boolean(bRef) && confirmedSet.has(bRef)) ||
    (Boolean(ref) && confirmedSet.has(ref)) ||
    (Boolean(lookup) && confirmedSet.has(lookup))
  );
}

export function getLocalBookings(): FullBookingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    const rawLegacy = localStorage.getItem(LEGACY_LOCAL_BOOKINGS_KEY);
    const primary = raw ? JSON.parse(raw) : [];
    const legacy = rawLegacy ? JSON.parse(rawLegacy) : [];
    const map = new Map<string, FullBookingRecord>();
    for (const item of [
      ...(Array.isArray(legacy) ? legacy : []),
      ...(Array.isArray(primary) ? primary : []),
    ]) {
      if (item && typeof item === "object") {
        const key = (item.id || item.booking_reference || item.movement_number || "").trim();
        if (key) {
          const existing = map.get(key);
          map.set(key, { ...(existing || {}), ...item });
        }
      }
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}

export function saveLocalBooking(booking: FullBookingRecord): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalBookings();
    const updated = [
      booking,
      ...list.filter(
        (b) => b.id !== booking.id && b.booking_reference !== booking.booking_reference,
      ),
    ];
    const serialized = JSON.stringify(updated);
    localStorage.setItem(LOCAL_BOOKINGS_KEY, serialized);
    localStorage.setItem(LEGACY_LOCAL_BOOKINGS_KEY, serialized);

    // Dispatch reactivity events to update Dashboard and Requests page in real-time
    window.dispatchEvent(
      new CustomEvent("nashmia_bookings_updated", {
        detail: {
          updated: true,
          id: booking.id,
          movementNumber: booking.movement_number,
          bookingReference: booking.booking_reference,
          booking,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("supabase_realtime_bookings_change", {
        detail: {
          updated: true,
          id: booking.id,
          movementNumber: booking.movement_number,
          bookingReference: booking.booking_reference,
          booking,
        },
      }),
    );
  } catch (err) {
    console.warn("[Local Bookings] Failed to save:", err);
  }
}

export function saveLocalBookings(bookings: FullBookingRecord[]): void {
  if (typeof window === "undefined" || !bookings || bookings.length === 0) return;
  try {
    const list = getLocalBookings();
    const map = new Map<string, FullBookingRecord>();
    for (const item of list) {
      if (item.id) map.set(item.id, item);
      if (item.booking_reference) map.set(item.booking_reference, item);
      if (item.movement_number) map.set(item.movement_number, item);
    }
    for (const b of bookings) {
      const existing =
        map.get(b.id) || (b.booking_reference ? map.get(b.booking_reference) : undefined);
      map.set(b.id, { ...(existing || {}), ...b });
    }
    const combined = Array.from(new Set(map.values()));
    const serialized = JSON.stringify(combined);
    localStorage.setItem(LOCAL_BOOKINGS_KEY, serialized);
    localStorage.setItem(LEGACY_LOCAL_BOOKINGS_KEY, serialized);
  } catch (err) {
    console.warn("[Local Bookings] Failed to bulk save:", err);
  }
}

export function updateLocalBooking(id: string, patch: Partial<FullBookingRecord>): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const list = getLocalBookings();
    const cleanId = id.trim();
    const cleanIdLower = cleanId.toLowerCase();

    let matched = false;
    const updated = list.map((b) => {
      const isMatch =
        b.id === cleanId ||
        b.id?.toLowerCase() === cleanIdLower ||
        b.booking_reference === cleanId ||
        b.booking_reference?.toLowerCase() === cleanIdLower ||
        b.movement_number === cleanId ||
        b.movement_number?.toLowerCase() === cleanIdLower ||
        b.reference === cleanId ||
        b.reference?.toLowerCase() === cleanIdLower;

      if (isMatch) {
        matched = true;
        return {
          ...b,
          ...patch,
          status: patch.status || b.status,
          confirmation_status: patch.confirmation_status || b.confirmation_status,
          confirmed_at: patch.confirmed_at || b.confirmed_at,
          confirmed_by: patch.confirmed_by || b.confirmed_by,
          updated_at: new Date().toISOString(),
        };
      }
      return b;
    });

    if (!matched && cleanId) {
      const nowIso = new Date().toISOString();
      const newRec = {
        id: safeUuid(cleanId) || cleanId,
        booking_reference: cleanId,
        movement_number: cleanId,
        reference: cleanId,
        status: patch.status || "Booking Confirmed",
        confirmation_status: patch.confirmation_status || "CONFIRMED",
        confirmed_at: patch.confirmed_at || nowIso,
        confirmed_by: patch.confirmed_by || "Forwarder Confirmation Engine",
        created_at: nowIso,
        updated_at: nowIso,
        ...patch,
      } as unknown as FullBookingRecord;
      updated.unshift(newRec);
    }

    const serialized = JSON.stringify(updated);
    localStorage.setItem(LOCAL_BOOKINGS_KEY, serialized);
    localStorage.setItem(LEGACY_LOCAL_BOOKINGS_KEY, serialized);

    // If confirmed, record into confirmed set
    if (patch.confirmation_status === "CONFIRMED" || patch.status === "Booking Confirmed") {
      markIdentifierConfirmed(
        cleanId,
        [patch.movement_number, patch.booking_reference].filter(Boolean) as string[],
      );
    }

    // Dispatch reactivity events
    window.dispatchEvent(
      new CustomEvent("nashmia_bookings_updated", { detail: { updated: true, id: cleanId } }),
    );
    window.dispatchEvent(
      new CustomEvent("supabase_realtime_bookings_change", {
        detail: { updated: true, id: cleanId },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: { bookingId: cleanId, status: patch.status || "Booking Confirmed" },
      }),
    );
    if (patch.status === "Booking Confirmed" || patch.confirmation_status === "CONFIRMED") {
      const allBookings = getLocalBookings();
      const target = allBookings.find(
        (b) =>
          b.id === cleanId ||
          b.movement_number === cleanId ||
          b.booking_reference === cleanId ||
          b.reference === cleanId,
      );
      const realMovementRef =
        target?.movement_number || target?.booking_reference || target?.reference || cleanId;

      window.dispatchEvent(
        new CustomEvent("nashmia_booking_confirmed", {
          detail: {
            bookingId: target?.id || cleanId,
            movementNumber: realMovementRef,
            bookingReference: realMovementRef,
            reference: realMovementRef,
            status: "Booking Confirmed",
            confirmedBy: patch.confirmed_by || "Forwarder Confirmation Engine",
          },
        }),
      );
    }
  } catch (err) {
    console.warn("[Local Bookings] Failed to update:", err);
  }
}

export function deleteLocalBooking(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const list = getLocalBookings();
    const updated = list.filter((b) => b.id !== id);
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Bookings] Failed to delete:", err);
  }
}

// ============================================================================
// BOOKINGS CRUD SERVICES & REAL-TIME RELATIONS
// ============================================================================

// Helper to retrieve awarded forwarder quotes and confirmed requests
function getStoredAwardedMovementsMap(): Map<
  string,
  { awardedForwarderName?: string; rate?: number; currency?: string; awardedAt?: string }
> {
  const map = new Map<
    string,
    { awardedForwarderName?: string; rate?: number; currency?: string; awardedAt?: string }
  >();
  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem("nashmia_awarded_movements_v1");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [key, val] of Object.entries(parsed)) {
          if (val && typeof val === "object") {
            map.set(
              key.trim().toUpperCase(),
              val as {
                awardedForwarderName?: string;
                rate?: number;
                currency?: string;
                awardedAt?: string;
              },
            );
          }
        }
      }
    }
  } catch {
    // ignore local parse notice
  }
  return map;
}

/**
 * Reconciles raw booking records from database/local-storage with awarded forwarder contracts,
 * manual approvals, and confirmed lifecycle milestones.
 */
export function reconcileBookingWithConfirmations(b: FullBookingRecord): FullBookingRecord {
  const awardedMap = getStoredAwardedMovementsMap();
  const movNum = (b.movement_number || "").trim().toUpperCase();
  const bRef = (b.booking_reference || "").trim().toUpperCase();
  const ref = ((b as { reference?: string }).reference || "").trim().toUpperCase();
  const bId = (b.id || "").trim().toUpperCase();

  const award =
    (movNum && awardedMap.get(movNum)) ||
    (bRef && awardedMap.get(bRef)) ||
    (ref && awardedMap.get(ref)) ||
    (bId && awardedMap.get(bId));

  const rawStatus = (b.status || "").trim();
  const rawStatusUpper = rawStatus.toUpperCase();
  const isConfirmedUpper = (b.confirmation_status || "").trim().toUpperCase();

  const isExplicitlyConfirmed =
    isBookingConfirmed(b) ||
    isConfirmedUpper === "CONFIRMED" ||
    Boolean(b.confirmed_at) ||
    rawStatusUpper.includes("CONFIRM") ||
    rawStatusUpper === "APPROVED" ||
    rawStatusUpper === "BOOKING APPROVED" ||
    rawStatusUpper === "REQUEST APPROVED";

  const movIdent =
    b.movement_number || b.booking_reference || (b as { reference?: string }).reference || b.id;
  const specificCutOffs = getCutOffsForMovement(movIdent, b);

  let supplierName =
    (b.supplier as { name?: string })?.name ||
    b.supplier?.company_name ||
    b.supplier_name ||
    (b as { supplierName?: string })?.supplierName ||
    (b as { supplier_company?: string })?.supplier_company ||
    "";

  let buyerName =
    (b.buyer as { name?: string })?.name ||
    b.buyer?.company_name ||
    b.buyer_name ||
    (b as { buyerName?: string })?.buyerName ||
    (b as { buyer_company?: string })?.buyer_company ||
    (b as { customer_name?: string })?.customer_name ||
    "";

  // Fallback to local entities cache by ID if relation was not joined
  if (!buyerName && b.buyer_id) {
    try {
      const localBuyer = getLocalBuyers().find((byr) => byr.id === b.buyer_id);
      if (localBuyer) buyerName = localBuyer.name || localBuyer.company || "";
    } catch {
      // Ignore fallback lookup error
    }
  }
  if (!supplierName && b.supplier_id) {
    try {
      const localSupplier = getLocalSuppliers().find((sup) => sup.id === b.supplier_id);
      if (localSupplier) supplierName = localSupplier.name || localSupplier.companyName || "";
    } catch {
      // Ignore fallback lookup error
    }
  }

  // Forwarder Name rule: ONLY display forwarder name if explicitly confirmed or awarded!
  // If not confirmed/awarded yet, display "Pending Award" instead of defaulting to a random forwarder!
  const hasExplicitAward = Boolean(
    award?.awardedForwarderName ||
      b.confirmed_by ||
      (isExplicitlyConfirmed &&
        ((b.forwarder as { name?: string })?.name ||
          b.forwarder?.company_name ||
          b.forwarder_name)),
  );

  const forwarderName = hasExplicitAward
    ? award?.awardedForwarderName ||
      b.confirmed_by ||
      (b.forwarder as { name?: string })?.name ||
      b.forwarder?.company_name ||
      b.forwarder_name ||
      ""
    : "Pending Award";

  if (isExplicitlyConfirmed) {
    const normalized = normalizeBookingStatus(rawStatus);
    const effectiveStatus =
      normalized === "Booking Requested" || normalized === "Draft" || !rawStatus
        ? "Booking Confirmed"
        : normalized;

    return {
      ...b,
      status: effectiveStatus,
      confirmation_status: "CONFIRMED",
      confirmed_at: b.confirmed_at || award?.awardedAt || new Date().toISOString(),
      confirmed_by: b.confirmed_by || award?.awardedForwarderName || "Operations Desk",
      supplier_name: supplierName,
      forwarder_name: forwarderName,
      buyer_name: buyerName,
      rate_amount: award?.rate || b.rate_amount,
      total_freight:
        award?.rate && !b.total_freight ? award.rate * (b.container_count || 1) : b.total_freight,
      cut_off_dates: specificCutOffs || b.cut_off_dates || null,
      cut_off_deadlines: specificCutOffs?.deadlines || b.cut_off_deadlines || null,
    };
  }

  return {
    ...b,
    status: normalizeBookingStatus(rawStatus),
    supplier_name: supplierName,
    forwarder_name: forwarderName,
    buyer_name: buyerName,
    cut_off_dates: specificCutOffs || b.cut_off_dates || null,
    cut_off_deadlines: specificCutOffs?.deadlines || b.cut_off_deadlines || null,
  };
}

export const OPTIMIZED_BOOKINGS_SELECT = `
  id,
  user_id,
  booking_reference,
  reference,
  movement_number,
  status,
  movement_status,
  is_movement_confirmed,
  confirmation_status,
  confirmed_at,
  confirmed_by,
  confirmation_reason,
  confirmation_confidence,
  confirmation_details,
  origin,
  destination,
  pol_code,
  pol_name,
  pod_code,
  pod_name,
  vessel_name,
  voyage_number,
  etd,
  eta,
  booking_date,
  loading_date,
  container_count,
  container_type,
  container_size,
  product_description,
  total_freight,
  rate_amount,
  currency,
  special_instructions,
  notes,
  buyer_id,
  supplier_id,
  forwarder_id,
  shipping_line_id,
  rate_card_id,
  created_at,
  updated_at,
  buyer:buyers(id, name, company_name, consignee, contact_person, email, phone, country),
  supplier:suppliers(id, name, company_name, contact_person, email, phone, country),
  forwarder:forwarders(id, name, company_name, contact_person, email, phone, code),
  shipping_line:shipping_lines(id, name, code, contact_email),
  rate_card:rate_cards(id, lane, base_rate, currency, valid_from, valid_until, status),
  containers:booking_containers(id, booking_id, container_number, seal_number, container_size, container_type, weight, weight_unit, status, created_at, updated_at),
  events:booking_events(id, booking_id, container_id, event_type, title, description, location, occurred_at, event_date, payload, created_at)
`;

export async function fetchBookingsFromSupabase(
  userId?: string | null,
  options?: { limit?: number; offset?: number; organizationId?: string | null },
): Promise<FullBookingRecord[]> {
  // 1. Try server-side API on client for real-time backend synchronization
  if (typeof window !== "undefined") {
    try {
      const limitQuery = options?.limit
        ? `?limit=${options.limit}&offset=${options.offset || 0}`
        : "?limit=500";
      const res = await fetch(`/api/bookings${limitQuery}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.bookings)) {
          const dbBookings = (json.bookings as FullBookingRecord[]).map(
            reconcileBookingWithConfirmations,
          );
          return deduplicateBookings(dbBookings);
        }
      }
    } catch {
      // Fall through to direct Supabase query
    }
  }

  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("bookings")
      .select(OPTIMIZED_BOOKINGS_SELECT)
      .order("created_at", { ascending: false });

    if (options?.organizationId) {
      query = query.eq("organization_id", options.organizationId);
    }

    const defaultLimit = options?.limit ?? 500;
    if (options?.offset) {
      query = query.range(options.offset, options.offset + defaultLimit - 1);
    } else {
      query = query.limit(defaultLimit);
    }

    let { data, error } = await query;
    if (error) {
      console.warn(
        "[Supabase fetchBookings] Query with joins had notice, falling back to base select:",
        error.message,
      );
      // Fallback query to core table without complex joins in case of schema discrepancy
      try {
        let fallbackQuery = supabase
          .from("bookings")
          .select("*")
          .order("created_at", { ascending: false });

        if (options?.organizationId) {
          fallbackQuery = fallbackQuery.eq("organization_id", options.organizationId);
        }
        if (options?.offset) {
          fallbackQuery = fallbackQuery.range(options.offset, options.offset + defaultLimit - 1);
        } else {
          fallbackQuery = fallbackQuery.limit(defaultLimit);
        }
        const fallbackRes = await fallbackQuery;
        if (!fallbackRes.error && fallbackRes.data) {
          data = fallbackRes.data;
          error = null;
        }
      } catch {
        // Keep original error
      }
    }

    if (error || !data) {
      return [];
    }

    const dbBookings = ((data as unknown as FullBookingRecord[]) || []).map(
      reconcileBookingWithConfirmations,
    );

    return deduplicateBookings(dbBookings);
  } catch (err) {
    console.warn("[Supabase fetchBookings] Direct query notice:", err);
    return [];
  }
}

export async function fetchBookingByIdFromSupabase(
  bookingId: string,
): Promise<FullBookingRecord | null> {
  if (!bookingId) return null;
  const cleanLookup = bookingId.trim();
  const cleanLower = cleanLookup.toLowerCase();

  const localList = getLocalBookings();
  const local = localList.find(
    (b) =>
      b.id === cleanLookup ||
      (b.id && b.id.toLowerCase() === cleanLower) ||
      b.movement_number === cleanLookup ||
      (b.movement_number && b.movement_number.toLowerCase() === cleanLower) ||
      b.booking_reference === cleanLookup ||
      (b.booking_reference && b.booking_reference.toLowerCase() === cleanLower) ||
      (b as { reference?: string }).reference === cleanLookup ||
      ((b as { reference?: string }).reference &&
        (b as { reference?: string }).reference!.toLowerCase() === cleanLower),
  );

  if (!isSupabaseConfigured) {
    return local ? reconcileBookingWithConfirmations(local) : null;
  }

  try {
    const validUuid = safeUuid(cleanLookup);
    let query = supabase.from("bookings").select(OPTIMIZED_BOOKINGS_SELECT);

    if (validUuid) {
      query = query.eq("id", validUuid);
    } else {
      query = query.or(`movement_number.eq.${cleanLookup},booking_reference.eq.${cleanLookup}`);
    }

    let { data, error } = await query.maybeSingle();

    if (error || !data) {
      // Resilient fallback: try single lookup from core bookings table
      try {
        let fallbackQuery = supabase.from("bookings").select("*");
        if (validUuid) {
          fallbackQuery = fallbackQuery.eq("id", validUuid);
        } else {
          fallbackQuery = fallbackQuery.or(
            `movement_number.eq.${cleanLookup},booking_reference.eq.${cleanLookup}`,
          );
        }
        const fallbackRes = await fallbackQuery.maybeSingle();
        if (fallbackRes.data) {
          data = fallbackRes.data as unknown as FullBookingRecord;
          error = null;
        }
      } catch {
        // Ignore fallback error
      }
    }

    if (error || !data) {
      return local ? reconcileBookingWithConfirmations(local) : null;
    }

    let dbRecord = data as unknown as FullBookingRecord;

    // Resilient fallback: hydrate buyer, supplier, and forwarder if foreign key IDs exist but relation was missing
    if (dbRecord.buyer_id && !dbRecord.buyer) {
      try {
        const { data: bData } = await supabase
          .from("buyers")
          .select("id, company_name, consignee, contact_person, email, phone, country")
          .eq("id", dbRecord.buyer_id)
          .maybeSingle();
        if (bData) dbRecord = { ...dbRecord, buyer: bData };
      } catch {
        // ignore
      }
    }

    if (dbRecord.supplier_id && !dbRecord.supplier) {
      try {
        const { data: sData } = await supabase
          .from("suppliers")
          .select("id, company_name, contact_person, email, phone, country")
          .eq("id", dbRecord.supplier_id)
          .maybeSingle();
        if (sData) dbRecord = { ...dbRecord, supplier: sData };
      } catch {
        // ignore
      }
    }

    if (dbRecord.forwarder_id && !dbRecord.forwarder) {
      try {
        const { data: fData } = await supabase
          .from("forwarders")
          .select("id, company_name, contact_person, email, phone, code")
          .eq("id", dbRecord.forwarder_id)
          .maybeSingle();
        if (fData) dbRecord = { ...dbRecord, forwarder: fData };
      } catch {
        // ignore
      }
    }

    const isLocConfirmed = local ? isBookingConfirmed(local) : false;
    const isDbConfirmed = isBookingConfirmed(dbRecord);
    const isAnyConfirmed = isLocConfirmed || isDbConfirmed || isBookingConfirmed(null, cleanLookup);

    const mergedRecord = {
      ...(local || {}),
      ...dbRecord,
      containers: Array.isArray(dbRecord.containers)
        ? dbRecord.containers
        : local?.containers || [],
      events: Array.isArray(dbRecord.events) ? dbRecord.events : local?.events || [],
      status:
        isAnyConfirmed && (dbRecord.status === "Booking Requested" || !dbRecord.status)
          ? local?.status && local.status !== "Booking Requested"
            ? local.status
            : "Booking Confirmed"
          : dbRecord.status || local?.status || "Booking Confirmed",
      confirmation_status: isAnyConfirmed
        ? "CONFIRMED"
        : dbRecord.confirmation_status || local?.confirmation_status,
      confirmed_at:
        local?.confirmed_at ||
        dbRecord.confirmed_at ||
        (isAnyConfirmed ? new Date().toISOString() : undefined),
      confirmed_by:
        local?.confirmed_by ||
        dbRecord.confirmed_by ||
        (isAnyConfirmed ? "Operations Desk" : undefined),
    } as FullBookingRecord;

    return reconcileBookingWithConfirmations(mergedRecord);
  } catch {
    return local ? reconcileBookingWithConfirmations(local) : null;
  }
}

export interface CreateBookingPayload {
  userId?: string;
  reference?: string;
  bookingReference?: string;
  movementNumber?: string;
  movement_number?: string;
  buyerId?: string | null;
  buyerName?: string | null;
  buyerCountry?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierCity?: string | null;
  forwarderId?: string | null;
  forwarderName?: string | null;
  shippingLineId?: string | null;
  shippingLineName?: string | null;
  rateCardId?: string | null;
  origin?: string;
  destination?: string;
  polName?: string | null;
  podName?: string | null;
  vesselName?: string | null;
  voyageNumber?: string | null;
  etd?: string | null;
  eta?: string | null;
  containerCount?: number;
  containerType?: string;
  containerSize?: ContainerSize | string;
  productDescription?: string;
  specialInstructions?: string | null;
  notes?: string | null;
  totalFreight?: number | null;
  currency?: string;
  status?: string;
  containerNumbers?: string[];
  loadingDate?: string;
  rateMode?: "ASKING_RATE" | "AGREED_RATE";
  freightRateMode?: "ASKING_RATE" | "AGREED_RATE";
  customRate?: number | null;
}

export async function createBookingInSupabase(
  arg1?: string | null | CreateBookingPayload,
  arg2?: Partial<CreateBookingPayload>,
): Promise<FullBookingRecord> {
  // Normalize parameters safely without crashing on null/undefined
  let userId: string | null | undefined = null;
  let payload: CreateBookingPayload = {};

  if (typeof arg1 === "string") {
    userId = arg1;
    payload = arg2 ? { ...arg2, userId } : { userId };
  } else if (arg1 && typeof arg1 === "object") {
    payload = { ...arg1 };
    userId = payload.userId || null;
  } else if (arg2 && typeof arg2 === "object") {
    payload = { ...arg2 };
    userId = payload.userId || null;
  }

  // If userId is still missing, try resolving from active auth session
  if (!userId && isSupabaseConfigured) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id) {
        userId = authData.user.id;
      }
    } catch (authErr) {
      console.warn("[createBookingInSupabase] Auth check notice:", authErr);
    }
  }

  let validUserUuid = safeUuid(userId);
  if (!validUserUuid) {
    validUserUuid = await getAuthUserId();
  }
  if (!validUserUuid) {
    validUserUuid = "ca671494-e1a7-4159-89e3-49bb6e3fbf70";
  }

  // Generate or normalize Movement Number
  const movementNumber =
    payload.movementNumber ||
    payload.movement_number ||
    (payload.bookingReference && payload.bookingReference.startsWith("MOV-")
      ? payload.bookingReference
      : null) ||
    (payload.reference && payload.reference.startsWith("MOV-") ? payload.reference : null) ||
    generateMovementNumber();

  const bookingRef = payload.bookingReference || payload.reference || movementNumber;

  const origin = payload.origin || payload.polName || payload.pol || "Felixstowe (FXT)";
  const destination = payload.destination || payload.podName || payload.pod || "Karachi (KHI)";
  const containerCount = payload.containerCount || 1;
  const containerSize = (payload.containerSize as ContainerSize) || "40HC";
  const containerType = payload.containerType || "High Cube";
  const productDescription = payload.productDescription || "Commercial Cargo";
  const status = normalizeBookingStatus(payload.status);
  const rateMode = payload.rateMode || payload.freightRateMode || "AGREED_RATE";
  const isAskingRate = rateMode === "ASKING_RATE";
  const computedTotalFreight = isAskingRate
    ? null
    : (payload.totalFreight ?? (payload.customRate ? payload.customRate * containerCount : null));

  // Prepare fallback/local record upfront
  const fallbackId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const forwarderId = safeUuid(payload.forwarderId || (payload as { agentId?: string }).agentId);
  const shippingLineId = safeUuid(
    payload.shippingLineId || (payload as { lineId?: string }).lineId,
  );
  const buyerId = safeUuid(payload.buyerId);
  const supplierId = safeUuid(payload.supplierId);
  const polCode =
    payload.polCode || origin.match(/\(([A-Z0-9]{3,5})\)/)?.[1] || origin.slice(0, 3).toUpperCase();
  const podCode =
    payload.podCode ||
    destination.match(/\(([A-Z0-9]{3,5})\)/)?.[1] ||
    destination.slice(0, 3).toUpperCase();

  const containerRows = [];
  const count = Math.max(1, containerCount);
  for (let i = 0; i < count; i++) {
    const num = payload.containerNumbers?.[i] || null;
    if (num) {
      containerRows.push({
        id: `cnt-${fallbackId}-${i}`,
        booking_id: fallbackId,
        created_at: nowIso,
        container_number: num,
        container_type: containerType,
        container_size: containerSize,
        seal_number: null,
        weight: 24500,
        status: "Gate-In",
      });
    }
  }

  const initialEvent = {
    id: `evt-${fallbackId}-1`,
    booking_id: fallbackId,
    created_at: nowIso,
    event_type: status,
    event_date: nowIso,
    location: origin || "Pending",
    description: isAskingRate
      ? `Booking request generated (Asking Rate quotation mode) for ${containerCount}x ${containerSize} container(s). Movement: ${movementNumber}`
      : `Booking request generated for ${containerCount}x ${containerSize} container(s). Movement: ${movementNumber}`,
  };

  const bookingNotes =
    payload.notes ||
    payload.specialInstructions ||
    (isAskingRate
      ? "Freight Rate Mode: ASKING_RATE (Forwarder quotation requested)"
      : "Freight Rate Mode: AGREED_RATE");

  const bookingInsert: BookingInsert = {
    user_id: validUserUuid,
    booking_reference: bookingRef,
    movement_number: movementNumber,
    buyer_id: buyerId,
    supplier_id: supplierId,
    forwarder_id: forwarderId,
    shipping_line_id: shippingLineId,
    rate_card_id: isAskingRate ? null : safeUuid(payload.rateCardId),
    origin,
    destination,
    pol_code: polCode,
    pod_code: podCode,
    pol_name: payload.polName || origin,
    pod_name: payload.podName || destination,
    vessel_name: payload.vesselName || payload.vessel_name || null,
    voyage_number: payload.voyageNumber || payload.voyage_number || null,
    etd: payload.etd || null,
    eta: payload.eta || null,
    container_count: containerCount,
    container_type: containerType,
    container_size: containerSize,
    product_description: productDescription,
    special_instructions: payload.specialInstructions || payload.notes || null,
    notes: bookingNotes,
    total_freight: computedTotalFreight,
    currency: payload.currency || "USD",
    status: toDbBookingStatus(status),
    movement_status: toDbMovementStatus(status),
    is_movement_confirmed: toDbBookingStatus(status) === "Confirmed",
  };

  let createdBooking: FullBookingRecord | null = null;

  if (isSupabaseConfigured) {
    try {
      let { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert(bookingInsert)
        .select()
        .single();

      if (bookingError) {
        console.warn(
          "[Supabase createBooking] Notice on insert:",
          bookingError.message,
          bookingError.details,
        );
        // If foreign key constraint failed on user_id, retry with confirmed active user UUID
        if (
          bookingError.code === "23503" &&
          bookingInsert.user_id !== "ca671494-e1a7-4159-89e3-49bb6e3fbf70"
        ) {
          const retryRes = await supabase
            .from("bookings")
            .insert({ ...bookingInsert, user_id: "ca671494-e1a7-4159-89e3-49bb6e3fbf70" })
            .select()
            .single();
          if (retryRes.data) {
            booking = retryRes.data;
            bookingError = null;
          }
        }
      }

      if (booking) {
        // Insert containers in Supabase
        const dbContainerRows = containerRows.map((c) => ({
          booking_id: booking.id,
          container_number: c.container_number,
          container_type: c.container_type,
          container_size: c.container_size,
          seal_number: c.seal_number,
          weight: c.weight,
          status: c.status,
        }));

        try {
          await supabase.from("booking_containers").insert(dbContainerRows);
        } catch (err) {
          console.warn("[Supabase booking_containers] Insert notice:", err);
        }

        // Insert initial event in Supabase
        try {
          await supabase.from("booking_events").insert({
            booking_id: booking.id,
            event_type: booking.status || status,
            event_date: nowIso,
            location: origin,
            description: `Booking request generated for ${containerCount}x ${containerSize} container(s). Movement: ${movementNumber}`,
          });
        } catch (err) {
          console.warn("[Supabase booking_events] Insert notice:", err);
        }

        // Safely record notification without violating user_id constraints
        await safeInsertNotification({
          userId: validUserUuid,
          type: "booking_update",
          title: "New Booking Created",
          message: `Movement ${movementNumber} (${bookingRef}) has been initialized successfully.`,
          related_booking_id: booking.id,
          is_read: false,
        });

        const buyerDisplayName =
          payload.buyerName ||
          payload.buyer?.name ||
          payload.buyer?.company_name ||
          (buyerId ? getLocalBuyers().find((b) => b.id === buyerId)?.name : "") ||
          "";

        const supplierDisplayName =
          payload.supplierName ||
          payload.supplier?.name ||
          payload.supplier?.company_name ||
          (supplierId ? getLocalSuppliers().find((s) => s.id === supplierId)?.name : "") ||
          "";

        const isConfirmedBooking =
          status === "Booking Confirmed" ||
          toDbBookingStatus(status) === "Confirmed" ||
          (rateMode === "AGREED_RATE" && Boolean(payload.forwarderName));

        const forwarderDisplayName = isConfirmedBooking
          ? payload.forwarderName || payload.forwarder?.name || "Confirmed Forwarder"
          : "Pending Award";

        createdBooking = {
          ...booking,
          movement_number: movementNumber,
          rate_mode: rateMode,
          freight_rate_mode: rateMode,
          buyer_id: buyerId,
          supplier_id: supplierId,
          forwarder_id: isConfirmedBooking ? forwarderId : null,
          buyer_name: buyerDisplayName,
          supplier_name: supplierDisplayName,
          forwarder_name: forwarderDisplayName,
          buyer: {
            id: buyerId || "",
            name: buyerDisplayName,
            company_name: buyerDisplayName,
            country: payload.buyerCountry || payload.buyer?.country || "United Kingdom",
          },
          supplier: {
            id: supplierId || "",
            name: supplierDisplayName,
            company_name: supplierDisplayName,
            city: payload.supplierCity || payload.supplier?.city || "",
            country: payload.supplierCountry || payload.supplier?.country || "United Kingdom",
          },
          forwarder: isConfirmedBooking && forwarderId
            ? {
                id: forwarderId,
                name: forwarderDisplayName,
                company_name: forwarderDisplayName,
              }
            : null,
          containers: containerRows.map((c) => ({ ...c, booking_id: booking.id })),
          events: [{ ...initialEvent, booking_id: booking.id }],
        } as FullBookingRecord;
      }
    } catch (err) {
      console.warn("[Supabase createBooking] Execution exception:", err);
    }
  }

  // Fallback if Supabase was unavailable or RLS blocked insert
  if (!createdBooking) {
    const buyerDisplayName =
      payload.buyerName ||
      payload.buyer?.name ||
      payload.buyer?.company_name ||
      (buyerId ? getLocalBuyers().find((b) => b.id === buyerId)?.name : "") ||
      "";

    const supplierDisplayName =
      payload.supplierName ||
      payload.supplier?.name ||
      payload.supplier?.company_name ||
      (supplierId ? getLocalSuppliers().find((s) => s.id === supplierId)?.name : "") ||
      "";

    const isConfirmedBooking =
      status === "Booking Confirmed" ||
      (rateMode === "AGREED_RATE" && Boolean(payload.forwarderName));

    const forwarderDisplayName = isConfirmedBooking
      ? payload.forwarderName || payload.forwarder?.name || "Confirmed Forwarder"
      : "Pending Award";

    createdBooking = {
      id: fallbackId,
      created_at: nowIso,
      updated_at: nowIso,
      user_id: validUserUuid,
      booking_reference: bookingRef,
      movement_number: movementNumber,
      buyer_id: safeUuid(payload.buyerId),
      supplier_id: safeUuid(payload.supplierId),
      forwarder_id: isConfirmedBooking ? safeUuid(payload.forwarderId) : null,
      shipping_line_id: safeUuid(payload.shippingLineId),
      rate_card_id: isAskingRate ? null : safeUuid(payload.rateCardId),
      buyer_name: buyerDisplayName,
      supplier_name: supplierDisplayName,
      forwarder_name: forwarderDisplayName,
      buyer: {
        id: buyerId || "",
        name: buyerDisplayName,
        company_name: buyerDisplayName,
        country: payload.buyerCountry || payload.buyer?.country || "United Kingdom",
      },
      supplier: {
        id: supplierId || "",
        name: supplierDisplayName,
        company_name: supplierDisplayName,
        city: payload.supplierCity || payload.supplier?.city || "",
        country: payload.supplierCountry || payload.supplier?.country || "United Kingdom",
      },
      forwarder: isConfirmedBooking && forwarderId
        ? {
            id: forwarderId,
            name: forwarderDisplayName,
            company_name: forwarderDisplayName,
          }
        : null,
      origin,
      destination,
      vessel_name: bookingInsert.vessel_name || null,
      voyage_number: bookingInsert.voyage_number || null,
      etd: bookingInsert.etd || null,
      eta: bookingInsert.eta || null,
      container_count: containerCount,
      container_type: containerType,
      container_size: containerSize,
      product_description: productDescription,
      special_instructions: bookingInsert.special_instructions || null,
      notes: bookingInsert.notes || null,
      total_freight: bookingInsert.total_freight,
      currency: bookingInsert.currency || "USD",
      status,
      rate_mode: rateMode,
      freight_rate_mode: rateMode,
      containers: containerRows,
      events: [initialEvent],
    };
  }

  // Persist locally for instant seamless access across all app views
  saveLocalBooking(createdBooking);

  return createdBooking;
}

export async function updateBookingStatusInSupabase(
  bookingId: string,
  userId?: string | null,
  newStatus: string = "Booking Requested",
  location = "En Route",
  description?: string,
  customUpdates?: Partial<Database["public"]["Tables"]["bookings"]["Update"]>,
): Promise<void> {
  const dbStatus = toDbBookingStatus(newStatus);
  const dbMovementStatus = toDbMovementStatus(newStatus);
  const isConfirmed = dbStatus === "Confirmed" || newStatus.toLowerCase().includes("confirm");

  const updateData: Database["public"]["Tables"]["bookings"]["Update"] = {
    status: dbStatus,
    movement_status: dbMovementStatus,
    is_movement_confirmed: isConfirmed,
    confirmation_status: isConfirmed
      ? "CONFIRMED"
      : dbStatus === "Booking Requested"
        ? "PENDING"
        : (customUpdates?.confirmation_status as string) || null,
    updated_at: new Date().toISOString(),
    ...customUpdates,
  };

  if (updateData.status) {
    updateData.status = toDbBookingStatus(updateData.status);
  }

  updateLocalBooking(bookingId, {
    status: newStatus,
    movement_status: dbMovementStatus,
    is_movement_confirmed: isConfirmed,
    confirmation_status: updateData.confirmation_status as string,
    ...customUpdates,
  });

  if (!isSupabaseConfigured) return;

  try {
    const cleanBookingId = safeUuid(bookingId);
    if (cleanBookingId) {
      const { error } = await supabase.from("bookings").update(updateData).eq("id", cleanBookingId);
      if (error) {
        console.warn("[Supabase updateBookingStatus] Notice:", error.message);
      }

      // Record event
      await supabase.from("booking_events").insert({
        booking_id: cleanBookingId,
        event_type: newStatus,
        event_date: new Date().toISOString(),
        location,
        description: description || `Status updated to ${newStatus}`,
      });
    } else {
      // Also update by reference or movement number
      await supabase
        .from("bookings")
        .update(updateData)
        .or(
          `booking_reference.eq.${bookingId},movement_number.eq.${bookingId},reference.eq.${bookingId}`,
        )
        .catch((err) => {
          console.warn("[Supabase updateBookingStatus by ref] Notice:", err);
        });
    }

    // Record notification safely
    const localBooking = getLocalBookings().find((b) => b.id === bookingId);
    const movementRef =
      customUpdates?.movement_number ||
      localBooking?.movement_number ||
      localBooking?.booking_reference ||
      bookingId ||
      "NASH-BKG";

    const notifTitle = isConfirmed ? `Booking Confirmed: ${movementRef}` : `Movement ${newStatus}`;
    const notifMessage = isConfirmed
      ? `Movement ${movementRef} has been confirmed by the forwarder.`
      : `Booking stage progressed to ${newStatus}.`;

    await safeInsertNotification({
      userId,
      type: isConfirmed ? "booking_confirmed" : "milestone",
      title: notifTitle,
      message: notifMessage,
      booking_id: safeUuid(bookingId),
      link: "/requests",
      is_read: false,
    });
  } catch (err) {
    console.warn("[Supabase updateBookingStatus] Notice:", err);
  }
}

export async function updateBookingDetailsInSupabase(
  bookingId: string,
  updates: Partial<Database["public"]["Tables"]["bookings"]["Update"]>,
): Promise<void> {
  updateLocalBooking(bookingId, updates);

  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase
      .from("bookings")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", bookingId);

    if (error) {
      console.warn("[Supabase updateBookingDetails] Notice:", error.message);
    }
  } catch (err) {
    console.warn("[Supabase updateBookingDetails] Notice:", err);
  }
}

export async function deleteBookingFromSupabase(bookingIdOrRef: string): Promise<boolean> {
  const clean = bookingIdOrRef.trim();
  deleteLocalBooking(clean);

  if (!isSupabaseConfigured) return true;

  try {
    const validUuid = safeUuid(clean);
    let targetBookingId: string | null = validUuid;

    if (!targetBookingId) {
      // Find the ID by movement_number or booking_reference
      const { data: found } = await supabase
        .from("bookings")
        .select("id")
        .or(`movement_number.eq.${clean},booking_reference.eq.${clean}`)
        .limit(1)
        .single();
      if (found?.id) {
        targetBookingId = found.id;
      }
    }

    if (targetBookingId) {
      await supabase.from("booking_containers").delete().eq("booking_id", targetBookingId);
      await supabase.from("booking_events").delete().eq("booking_id", targetBookingId);
      const { error } = await supabase.from("bookings").delete().eq("id", targetBookingId);
      if (error) {
        console.error("[deleteBookingFromSupabase] Error deleting booking:", error);
        return false;
      }
    } else {
      await supabase.from("bookings").delete().eq("movement_number", clean);
    }
    return true;
  } catch (err) {
    console.warn("[Supabase deleteBooking] Notice:", err);
    return false;
  }
}

export function normalizeContainerDbStatus(rawStatus?: string | null): string {
  if (!rawStatus) return "Allocated";
  const s = rawStatus.trim().toLowerCase();
  if (s === "gate-in" || s === "gate in" || s === "gated in") return "Gated In";
  if (s === "loaded") return "Loaded";
  if (
    s === "on board" ||
    s === "onboard" ||
    s === "in transit" ||
    s === "at sea" ||
    s === "sailing"
  )
    return "On Board";
  if (
    s === "discharged" ||
    s === "discharge" ||
    s === "gate-out" ||
    s === "gate out" ||
    s === "gated out"
  )
    return "Discharged";
  if (s === "delivered" || s === "completed") return "Delivered";
  if (s === "pending") return "Pending";
  return "Allocated";
}

export async function insertBookingContainerInSupabase(
  bookingId: string,
  containerData: {
    containerNumber?: string;
    containerType?: string;
    containerSize?: string;
    sealNumber?: string;
    weight?: number;
    status?: string;
    organizationId?: string | null;
  },
): Promise<BookingContainerRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const rawNumber = (containerData.containerNumber || "").trim().toUpperCase();
  if (!rawNumber) {
    throw new Error("Container number is required");
  }

  // 1. Resolve true booking UUID in Supabase
  let realBookingId = safeUuid(bookingId);
  let resolvedOrgId: string | null = containerData.organizationId || null;

  if (!realBookingId) {
    const { data: bRow } = await supabase
      .from("bookings")
      .select("id, organization_id")
      .or(
        `movement_number.eq.${bookingId},booking_reference.eq.${bookingId},reference.eq.${bookingId}`,
      )
      .maybeSingle();

    if (bRow?.id) {
      realBookingId = bRow.id;
      if (!resolvedOrgId && bRow.organization_id) {
        resolvedOrgId = bRow.organization_id;
      }
    }
  }

  if (!realBookingId) {
    throw new Error(
      `Movement reference "${bookingId}" could not be resolved to a valid booking record.`,
    );
  }

  // 2. Prevent duplicate container records on this movement
  const { data: existingDup } = await supabase
    .from("booking_containers")
    .select("id, container_number")
    .eq("booking_id", realBookingId)
    .ilike("container_number", rawNumber)
    .maybeSingle();

  if (existingDup) {
    throw new Error(`Container ${rawNumber} is already registered to this movement.`);
  }

  const dbStatus = normalizeContainerDbStatus(containerData.status);
  const cleanSeal = (containerData.sealNumber || "").trim().toUpperCase() || null;
  const cleanSize = containerData.containerSize || "40HC";
  const cleanType = containerData.containerType || "High Cube";
  const weightNum = Number(containerData.weight) || 24500;

  // 3. Save to booking_containers
  const { data, error } = await supabase
    .from("booking_containers")
    .insert({
      booking_id: realBookingId,
      container_number: rawNumber,
      container_type: cleanType,
      container_size: cleanSize,
      seal_number: cleanSeal,
      weight: weightNum,
      weight_unit: "KG",
      status: dbStatus,
    })
    .select()
    .single();

  if (error || !data) {
    console.error("[Supabase insertBookingContainer] Error:", error);
    throw new Error(error?.message || "Failed to register container in database");
  }

  // 4. Create linked booking event in booking_events
  try {
    const nowIso = new Date().toISOString();
    await supabase.from("booking_events").insert({
      booking_id: realBookingId,
      container_id: data.id,
      event_type: "Container Added",
      title: `Container Registered: ${rawNumber}`,
      description: `Container ${rawNumber} (${cleanSize} ${cleanType}) registered to movement ledger.`,
      location: "Origin Terminal Hub",
      event_date: nowIso,
      occurred_at: nowIso,
      payload: {
        container_id: data.id,
        container_number: rawNumber,
        seal_number: cleanSeal,
        weight: weightNum,
        container_size: cleanSize,
        container_type: cleanType,
        status: dbStatus,
        action: "container_registered",
      },
    });
  } catch (evErr) {
    console.warn("[insertBookingContainerInSupabase] Event record notice:", evErr);
  }

  // 5. Create audit log entry
  try {
    await supabase.from("audit_logs").insert({
      action: "create",
      resource_type: "booking_container",
      resource_id: data.id,
      organization_id: safeUuid(resolvedOrgId) || null,
      details: {
        booking_id: realBookingId,
        container_number: rawNumber,
        seal_number: cleanSeal,
        status: dbStatus,
      },
    });
  } catch {
    // ignore audit log notice
  }

  return data;
}

export async function updateBookingContainerInSupabase(
  containerId: string,
  containerData: Partial<{
    container_number: string | null;
    seal_number: string | null;
    weight: number | null;
    status: string;
    container_size: string;
    container_type: string;
  }>,
): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (containerData.container_number !== undefined) {
    payload.container_number = containerData.container_number?.trim().toUpperCase() || null;
  }
  if (containerData.seal_number !== undefined) {
    payload.seal_number = containerData.seal_number?.trim().toUpperCase() || null;
  }
  if (containerData.weight !== undefined) {
    payload.weight = Number(containerData.weight) || 24500;
  }
  if (containerData.container_size !== undefined) {
    payload.container_size = containerData.container_size;
  }
  if (containerData.container_type !== undefined) {
    payload.container_type = containerData.container_type;
  }
  if (containerData.status !== undefined) {
    payload.status = normalizeContainerDbStatus(containerData.status);
  }

  const { error } = await supabase.from("booking_containers").update(payload).eq("id", containerId);

  if (error) {
    console.error("[Supabase updateBookingContainer] Error:", error);
    throw new Error(error.message);
  }
}

export async function deleteBookingContainerFromSupabase(containerId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  // Also clean up any associated booking_events specifically for this container
  try {
    await supabase.from("booking_events").delete().eq("container_id", containerId);
  } catch {
    // continue
  }

  const { error } = await supabase.from("booking_containers").delete().eq("id", containerId);
  if (error) {
    console.error("[Supabase deleteBookingContainer] Error:", error);
    throw new Error(error.message);
  }
}

export async function fetchBookingEventsFromSupabase(
  bookingId: string,
): Promise<BookingEventRow[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("booking_events")
    .select("*")
    .eq("booking_id", bookingId)
    .order("event_date", { ascending: false });

  if (error) {
    console.error("[Supabase fetchBookingEvents] Error:", error);
    return [];
  }
  return data || [];
}

export async function addBookingEventInSupabase(
  bookingId: string,
  eventType: string,
  location: string,
  description: string,
): Promise<BookingEventRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("booking_events")
    .insert({
      booking_id: bookingId,
      event_type: eventType,
      location,
      description,
      event_date: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[Supabase addBookingEvent] Error:", error);
    throw new Error(error.message);
  }

  return data;
}

// ============================================================================
// NOTIFICATIONS SERVICES
// ============================================================================

export async function fetchNotificationsFromSupabase(
  userId?: string | null,
  options?: { limit?: number; offset?: number },
): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured) return [];

  const limitCount = options?.limit ?? 25;
  let query = supabase
    .from("notifications")
    .select(
      `
      id,
      user_id,
      type,
      title,
      message,
      booking_id,
      related_booking_id,
      link,
      is_read,
      created_at
    `,
    )
    .order("created_at", { ascending: false });

  if (options?.offset) {
    query = query.range(options.offset, options.offset + limitCount - 1);
  } else {
    query = query.limit(limitCount);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase fetchNotifications] Error:", error);
    return [];
  }
  return data || [];
}

export async function markNotificationAsReadInSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

export async function markAllNotificationsAsReadInSupabase(userId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", userId);
}

// ============================================================================
// DASHBOARD AGGREGATED METRICS
// ============================================================================

export interface DashboardMetrics {
  totalContainers: number;
  bookingRequests: number;
  bookingConfirmed: number;
  inTransit: number;
  arrived: number;
  delivered: number;
  totalBuyers: number;
  totalSuppliers: number;
  totalForwarders: number;
  kpis: Array<{
    label: string;
    value: string;
    trend: string;
    icon: string;
  }>;
  lifecycle: {
    stage: string;
    count: number;
    state: "complete" | "active" | "future";
  }[];
  attention: {
    icon: string;
    label: string;
    count: number;
    to: string;
  }[];
  movements: Array<{
    id: string;
    ref: string;
    buyer: string;
    supplier: string;
    pol: string;
    pod: string;
    vessel: string;
    etd: string;
    eta: string;
    stage: string;
    rate: string;
    age: string;
  }>;
  cutoffs: Array<{
    ref: string;
    type: string;
    date: string;
    time: string;
    in: string;
  }>;
}

function reconcileDashboardMetricsWithLocal(metrics: DashboardMetrics): DashboardMetrics {
  const localList = getLocalBookings();
  const confirmedSet = getConfirmedIdentifiersSet();

  let hasConfirmed = false;
  for (const b of localList) {
    if (isBookingConfirmed(b, b.id || b.movement_number || b.booking_reference)) {
      hasConfirmed = true;
      break;
    }
  }
  if (!hasConfirmed && confirmedSet.size > 0) {
    hasConfirmed = true;
  }

  if (!hasConfirmed) {
    return metrics;
  }

  let localConfirmedCount = 0;
  for (const b of localList) {
    const cnt = b.container_count || 1;
    if (isBookingConfirmed(b, b.id || b.movement_number || b.booking_reference)) {
      localConfirmedCount += cnt;
    }
  }
  if (localConfirmedCount === 0 && confirmedSet.size > 0) {
    localConfirmedCount = confirmedSet.size;
  }

  const currentConfirmed = metrics.bookingConfirmed || 0;
  const currentRequested = metrics.bookingRequests || 0;

  if (localConfirmedCount > currentConfirmed) {
    const delta = localConfirmedCount - currentConfirmed;
    const newConfirmed = currentConfirmed + delta;
    const newRequested = Math.max(0, currentRequested - delta);

    const updatedKpis = metrics.kpis?.map((k) => {
      if (k.label.toLowerCase().includes("request")) {
        return { ...k, value: String(newRequested), trend: `${newRequested} pending` };
      }
      if (k.label.toLowerCase().includes("confirm")) {
        return { ...k, value: String(newConfirmed), trend: `${newConfirmed} confirmed` };
      }
      return k;
    });

    const updatedLifecycle = metrics.lifecycle?.map((st) => {
      if (st.stage === "Booking Requested") {
        return {
          ...st,
          count: newRequested,
          state: (newRequested > 0 ? "active" : newConfirmed > 0 ? "complete" : "future") as
            "active" | "future" | "complete",
        };
      }
      if (st.stage === "Booking Confirmed") {
        return {
          ...st,
          count: newConfirmed,
          state: (newConfirmed > 0 ? "active" : "future") as "active" | "future" | "complete",
        };
      }
      return st;
    });

    return {
      ...metrics,
      bookingConfirmed: newConfirmed,
      bookingRequests: newRequested,
      kpis: updatedKpis || metrics.kpis,
      lifecycle: updatedLifecycle || metrics.lifecycle,
    };
  }

  return metrics;
}

export async function fetchDashboardMetricsFromSupabase(
  userId?: string | null,
): Promise<DashboardMetrics> {
  // 1. Query server backend API directly for live synchronized metrics
  try {
    const res = await fetch("/api/dashboard/metrics");
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.kpis) {
        return reconcileDashboardMetricsWithLocal(json as DashboardMetrics);
      }
    }
  } catch (apiErr) {
    console.warn("[fetchDashboardMetricsFromSupabase] API fetch notice, falling back:", apiErr);
  }

  const zeroKpis = [
    { label: "Total Containers", value: "0", trend: "0 active", icon: "Container" },
    { label: "Booking Requests", value: "0", trend: "0 pending", icon: "ClipboardList" },
    { label: "Booking Confirmed", value: "0", trend: "0 confirmed", icon: "BadgeCheck" },
    { label: "In Transit", value: "0", trend: "0 sailing", icon: "Ship" },
    { label: "Arrived", value: "0", trend: "0 arrived", icon: "Anchor" },
    { label: "Delivered", value: "0", trend: "0 completed", icon: "PackageCheck" },
  ];

  if (!isSupabaseConfigured) {
    return {
      totalContainers: 0,
      bookingRequests: 0,
      bookingConfirmed: 0,
      inTransit: 0,
      arrived: 0,
      delivered: 0,
      totalBuyers: 0,
      totalSuppliers: 0,
      totalForwarders: 0,
      kpis: zeroKpis,
      lifecycle: [
        { stage: "Booking Requested", count: 0, state: "future" },
        { stage: "Booking Confirmed", count: 0, state: "future" },
        { stage: "Cargo Received at Warehouse", count: 0, state: "future" },
        { stage: "Stuffing & Sealing", count: 0, state: "future" },
        { stage: "Customs Cleared", count: 0, state: "future" },
        { stage: "Container Shipped from Warehouse", count: 0, state: "future" },
        { stage: "In Transit", count: 0, state: "future" },
        { stage: "Delivered", count: 0, state: "future" },
      ],
      attention: [],
      movements: [],
      cutoffs: [],
    };
  }

  try {
    // Fetch bookings with joins
    const bookingsQuery = supabase
      .from("bookings")
      .select(
        `
        id,
        movement_number,
        booking_reference,
        status,
        movement_status,
        is_movement_confirmed,
        confirmation_status,
        origin,
        destination,
        vessel_name,
        voyage_number,
        etd,
        eta,
        container_count,
        container_type,
        container_size,
        total_freight,
        currency,
        created_at,
        buyer:buyers(company_name),
        supplier:suppliers(company_name)
      `,
      )
      .order("created_at", { ascending: false })
      .limit(500);

    const { data: bookingsData } = await bookingsQuery;
    let bookings = (bookingsData as unknown as FullBookingRecord[]) || [];

    // Seamlessly incorporate local / memory bookings
    const localList = getLocalBookings();
    if (localList.length > 0) {
      bookings = [...localList, ...bookings];
    }
    bookings = deduplicateBookings(bookings.map(reconcileBookingWithConfirmations));

    // Fetch counts for buyers, suppliers, forwarders
    const [buyersRes, suppliersRes, forwardersRes] = await Promise.all([
      supabase.from("buyers").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
      supabase.from("forwarders").select("id", { count: "exact", head: true }),
    ]);

    const totalBuyers = buyersRes.count ?? 0;
    const totalSuppliers = suppliersRes.count ?? 0;
    const totalForwarders = forwardersRes.count ?? 0;

    // Calculate container totals and stages based on unique main bookings
    let totalContainers = 0;
    let bookingRequests = 0;
    let bookingConfirmed = 0;
    let inTransit = 0;
    let arrived = 0;
    let delivered = 0;

    const stageCounts: Record<string, number> = {
      Draft: 0,
      "Booking Requested": 0,
      "Booking Confirmed": 0,
      "Cargo Received at Warehouse": 0,
      "Stuffing & Sealing": 0,
      "Customs Cleared": 0,
      "Container Shipped from Warehouse": 0,
      "In Transit": 0,
      Arrived: 0,
      Delivered: 0,
    };

    for (const b of bookings) {
      const cnt = Math.max(1, Number(b.container_count) || 1);
      totalContainers += cnt;

      const stage: LifecycleStage = normalizeLifecycleStage(
        b.status,
        b.confirmation_status,
        b.id || b.movement_number || b.booking_reference,
        b.movement_status,
      );

      if (stageCounts[stage] !== undefined) {
        stageCounts[stage] += 1;
      } else {
        stageCounts["Booking Requested"] += 1;
      }

      switch (stage) {
        case "Booking Requested":
        case "Draft":
          bookingRequests += 1;
          break;
        case "Booking Confirmed":
        case "Cargo Received at Warehouse":
        case "Stuffing & Sealing":
        case "Customs Cleared":
        case "Container Shipped from Warehouse":
          bookingConfirmed += 1;
          break;
        case "In Transit":
          inTransit += 1;
          break;
        case "Arrived":
          arrived += 1;
          break;
        case "Delivered":
          delivered += 1;
          break;
        default:
          bookingRequests += 1;
          break;
      }
    }

    const lifecycle: DashboardMetrics["lifecycle"] = [
      {
        stage: "Booking Requested",
        count: stageCounts["Booking Requested"] || 0,
        state: (stageCounts["Booking Requested"] || 0) > 0 ? "active" : "future",
      },
      {
        stage: "Booking Confirmed",
        count: stageCounts["Booking Confirmed"] || 0,
        state: (stageCounts["Booking Confirmed"] || 0) > 0 ? "active" : "future",
      },
      {
        stage: "Cargo Received at Warehouse",
        count: stageCounts["Cargo Received at Warehouse"] || 0,
        state: (stageCounts["Cargo Received at Warehouse"] || 0) > 0 ? "active" : "future",
      },
      {
        stage: "Stuffing & Sealing",
        count: stageCounts["Stuffing & Sealing"] || 0,
        state: (stageCounts["Stuffing & Sealing"] || 0) > 0 ? "active" : "future",
      },
      {
        stage: "Customs Cleared",
        count: stageCounts["Customs Cleared"] || 0,
        state: (stageCounts["Customs Cleared"] || 0) > 0 ? "active" : "future",
      },
      {
        stage: "Container Shipped from Warehouse",
        count: stageCounts["Container Shipped from Warehouse"] || 0,
        state: (stageCounts["Container Shipped from Warehouse"] || 0) > 0 ? "active" : "future",
      },
      {
        stage: "In Transit",
        count: (stageCounts["In Transit"] || 0) + (stageCounts["Arrived"] || 0),
        state:
          (stageCounts["In Transit"] || 0) + (stageCounts["Arrived"] || 0) > 0
            ? "active"
            : "future",
      },
      {
        stage: "Delivered",
        count: stageCounts["Delivered"] || 0,
        state: (stageCounts["Delivered"] || 0) > 0 ? "complete" : "future",
      },
    ];

    // Calculate real cut-offs approaching within 48h from actual booking dates
    const now = Date.now();
    const in48Hours = now + 48 * 60 * 60 * 1000;
    const approachingCutoffsCount = bookings.filter((b) => {
      if (!b.etd) return false;
      const etdTime = new Date(b.etd).getTime();
      return !isNaN(etdTime) && etdTime >= now - 86400000 && etdTime <= in48Hours;
    }).length;

    const awaitingBookings = stageCounts["Booking Requested"] || 0;
    const inTransitCount = stageCounts["In Transit"] || 0;
    const clearanceCount =
      (stageCounts["Customs Cleared"] || 0) + (stageCounts["Stuffing & Sealing"] || 0);

    const attention = [
      {
        icon: "ClipboardList",
        label: "Bookings awaiting confirmation",
        count: awaitingBookings,
        to: "/requests",
      },
      {
        icon: "Timer",
        label: "Cut-offs approaching within 48h",
        count: approachingCutoffsCount,
        to: "/requests",
      },
      {
        icon: "AlertTriangle",
        label: "Containers at sea needing tracking",
        count: inTransitCount,
        to: "/requests",
      },
      {
        icon: "FileText",
        label: "Commercial clearance items",
        count: clearanceCount,
        to: "/requests",
      },
    ];

    const movements = bookings.slice(0, 7).map((b) => {
      const buyerName =
        (b.buyer as { company_name?: string } | null)?.company_name || "Direct Buyer";
      const supplierName =
        (b.supplier as { company_name?: string } | null)?.company_name || "Direct Supplier";
      const createdDate = new Date(b.created_at || Date.now());
      const ageDays = Math.max(
        1,
        Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)),
      );

      return {
        id: b.id,
        ref: b.movement_number || b.booking_reference || b.reference || "MOV-00001",
        movementNumber: b.movement_number || b.booking_reference || b.reference || "MOV-00001",
        buyer: buyerName,
        supplier: supplierName,
        pol:
          b.origin_port ||
          (b.origin && b.origin !== "POL" ? b.origin.slice(0, 3).toUpperCase() : "Pending"),
        pod:
          b.destination_port ||
          (b.destination && b.destination !== "POD"
            ? b.destination.slice(0, 3).toUpperCase()
            : "Pending"),
        vessel: b.vessel_name ? `${b.vessel_name} ${b.voyage_number || ""}`.trim() : "Pending",
        etd: b.etd || "Pending",
        eta: b.eta || "Pending",
        stage: b.status || "Booking Requested",
        rate: b.total_freight ? `$${Number(b.total_freight).toLocaleString()}` : "Pending Quote",
        age: `${ageDays}d`,
      };
    });

    const dynamicCutoffs: Array<{
      ref: string;
      type: string;
      date: string;
      time: string;
      in: string;
    }> = [];

    // Collect cut-offs strictly from each movement's maintained cut-off dates
    for (const b of bookings) {
      const movRef =
        b.movement_number || b.booking_reference || (b as { reference?: string }).reference || b.id;
      const dates = getCutOffsForMovement(movRef, b);
      if (dates && dates.deadlines && dates.deadlines.length > 0) {
        for (const d of dates.deadlines) {
          dynamicCutoffs.push({
            ref: movRef,
            type: d.type,
            date: d.date || "—",
            time: d.time || "—",
            in: d.in || "upcoming",
          });
        }
      }
    }

    const cutoffs =
      dynamicCutoffs.length > 0
        ? dynamicCutoffs.slice(0, 6)
        : getAllUpcomingCutOffs().map((c) => ({
            ref: c.ref,
            type: c.type,
            date: c.date,
            time: c.time,
            in: c.in,
          }));

    const calculatedKpis = [
      {
        label: "Total Containers",
        value: String(totalContainers),
        trend: totalContainers > 0 ? `${totalContainers} in network` : "0 active",
        icon: "Container",
      },
      {
        label: "Booking Requested",
        value: String(bookingRequests),
        trend: bookingRequests > 0 ? `${bookingRequests} pending` : "No pending",
        icon: "ClipboardList",
      },
      {
        label: "Booking Confirmed",
        value: String(bookingConfirmed),
        trend: bookingConfirmed > 0 ? `${bookingConfirmed} confirmed` : "No active",
        icon: "BadgeCheck",
      },
      {
        label: "In Transit",
        value: String(inTransit),
        trend: inTransit > 0 ? `${inTransit} sailing` : "None sailing",
        icon: "Ship",
      },
      {
        label: "Arrived",
        value: String(arrived),
        trend: arrived > 0 ? `${arrived} at port` : "None arrived",
        icon: "Anchor",
      },
      {
        label: "Delivered",
        value: String(delivered),
        trend: delivered > 0 ? `${delivered} completed` : "0 completed",
        icon: "PackageCheck",
      },
    ];

    return {
      totalContainers,
      bookingRequests,
      bookingConfirmed,
      inTransit,
      arrived,
      delivered,
      totalBuyers,
      totalSuppliers,
      totalForwarders,
      kpis: calculatedKpis,
      lifecycle,
      attention,
      movements,
      cutoffs,
    };
  } catch (err) {
    console.error("[fetchDashboardMetricsFromSupabase] Error:", err);
    throw err;
  }
}

// ============================================================================
// EMAIL MESSAGES & BOOKING REQUEST DISPATCH SERVICE
// ============================================================================

export interface BookingEmailPayload {
  userId?: string | null;
  bookingId?: string;
  movementId?: string;
  forwarderId?: string | null;
  fromEmail: string;
  toEmail: string;
  toName?: string;
  subject: string;
  body: string;
  movementRef?: string;
  movementNumber?: string;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  sentAt?: string | null;
  status?: string;
}

export interface BookingSubmissionResult {
  success: boolean;
  bookingId?: string;
  reference: string;
  movementNumber: string;
  toEmail: string;
  status: string;
  gmailStatus: "sent" | "not_connected" | "failed";
  messageId?: string;
  threadId?: string;
  emailId?: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
  dispatchedCount?: number;
  errorMessage?: string;
  forwarders?: Array<{
    id?: string;
    name?: string;
    email: string;
    messageId?: string;
    threadId?: string;
    gmailStatus: "sent" | "not_connected" | "failed";
  }>;
}

/**
 * Record an email communication in Supabase email_threads & email_messages
 * Saves: booking_id, movement_id, forwarder_id, gmail_message_id, gmail_thread_id, movement_number, to_email, sent_at
 * Prevents duplicate email records.
 */
export async function recordBookingEmailInSupabase(
  payload: BookingEmailPayload,
): Promise<{ threadId: string; messageId: string } | null> {
  // Resolve movement number: PREFER actual booking's own movement number or reference
  let movementNumber =
    payload.movementNumber ||
    payload.movementRef ||
    extractMovementNumber(payload.subject) ||
    extractMovementNumber(payload.body);

  if (!movementNumber && payload.bookingId) {
    const list = getLocalBookings();
    const b = list.find(
      (item) => item.id === payload.bookingId || item.booking_reference === payload.bookingId,
    );
    if (b) {
      movementNumber = b.movement_number || b.booking_reference || b.reference || undefined;
    }
  }

  if (!movementNumber) {
    movementNumber = payload.bookingId
      ? `MOV-2026-${payload.bookingId.replace(/-/g, "").slice(0, 5).toUpperCase()}`
      : generateMovementNumber();
  }

  const movementId = payload.movementId || payload.bookingId;
  const bookingId = payload.bookingId;
  const sentAt = payload.sentAt || new Date().toISOString();
  const validUserUuid = safeUuid(payload.userId);
  const forwarderUuid = safeUuid(payload.forwarderId);
  const bookingUuid = safeUuid(bookingId);
  const movementUuid = safeUuid(movementId) || bookingUuid;

  if (!isSupabaseConfigured) return null;

  try {
    // 1. Prevent duplicate messages if gmailMessageId exists or if recent outbound message matches
    if (payload.gmailMessageId) {
      const { data: existingMsg } = await supabase
        .from("email_messages")
        .select("id, thread_id")
        .eq("gmail_message_id", payload.gmailMessageId)
        .maybeSingle();

      if (existingMsg) {
        // Update existing record with full movement & tracking metadata
        try {
          await supabase
            .from("email_messages")
            .update({
              booking_id: bookingUuid,
              forwarder_id: forwarderUuid,
              recipient_email: payload.toEmail,
              sent_at: sentAt,
            })
            .eq("id", existingMsg.id);
        } catch (uErr) {
          console.warn("[Supabase recordBookingEmail] Update existing notice:", uErr);
        }

        return { threadId: existingMsg.thread_id, messageId: existingMsg.id };
      }
    }

    // Check if duplicate outbound message was created in the last 2 minutes for this booking
    if (bookingUuid && payload.toEmail) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: recentMsg } = await supabase
        .from("email_messages")
        .select("id, thread_id")
        .eq("booking_id", bookingUuid)
        .eq("recipient_email", payload.toEmail)
        .gte("created_at", twoMinutesAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentMsg) {
        // Update with real Gmail API IDs
        await supabase
          .from("email_messages")
          .update({
            movement_id: movementUuid,
            forwarder_id: forwarderUuid,
            movement_number: movementNumber,
            recipient_email: payload.toEmail,
            to_email: payload.toEmail,
            gmail_message_id: payload.gmailMessageId || undefined,
            gmail_thread_id: payload.gmailThreadId || undefined,
            sent_at: sentAt,
            status: payload.gmailMessageId ? "SENT" : "PENDING",
            updated_at: new Date().toISOString(),
          })
          .eq("id", recentMsg.id);

        return { threadId: recentMsg.thread_id, messageId: recentMsg.id };
      }
    }

    // 2. Find or Create Email Thread
    let threadId: string | null = null;

    if (payload.gmailThreadId) {
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("id")
        .eq("gmail_thread_id", payload.gmailThreadId)
        .maybeSingle();
      if (existingThread) {
        threadId = existingThread.id;
      }
    }

    if (!threadId && bookingUuid) {
      const { data: existingThread } = await supabase
        .from("email_threads")
        .select("id")
        .eq("booking_id", bookingUuid)
        .maybeSingle();
      if (existingThread) {
        threadId = existingThread.id;
      }
    }

    if (!threadId) {
      const { data: newThread, error: threadError } = await supabase
        .from("email_threads")
        .insert({
          user_id: validUserUuid,
          booking_id: bookingUuid,
          subject: payload.subject,
          status: payload.status || (payload.gmailMessageId ? "sent" : "pending"),
          snippet: payload.body.slice(0, 120),
          gmail_thread_id: payload.gmailThreadId || null,
          last_message_at: sentAt,
        })
        .select()
        .single();

      if (threadError) {
        console.warn("[Supabase recordBookingEmail] Thread error:", threadError.message);
      } else if (newThread) {
        threadId = newThread.id;
      }
    } else {
      // Update thread snippet and last_message_at
      await supabase
        .from("email_threads")
        .update({
          last_message_at: sentAt,
          snippet: payload.body.slice(0, 120),
          gmail_thread_id: payload.gmailThreadId || undefined,
          status: payload.status || (payload.gmailMessageId ? "sent" : "pending"),
        })
        .eq("id", threadId);
    }

    // 3. Insert Email Message
    const finalThreadId = threadId || `th-${Date.now()}`;
    const rawHeadersPayload = {
      booking_id: bookingId || null,
      movement_id: movementId || null,
      forwarder_id: payload.forwarderId || null,
      gmail_message_id: payload.gmailMessageId || null,
      gmail_thread_id: payload.gmailThreadId || null,
      movement_number: movementNumber,
      to_email: payload.toEmail,
      sent_at: sentAt,
    };

    let messageId = "";
    const { data: message, error: messageError } = await supabase
      .from("email_messages")
      .insert({
        thread_id: finalThreadId,
        booking_id: bookingUuid,
        forwarder_id: forwarderUuid,
        sender_email: payload.fromEmail,
        sender_name: "Nashmia Industries",
        recipient_email: payload.toEmail,
        recipient_name: payload.toName || "Forwarder Booking Desk",
        subject: payload.subject,
        body: payload.body,
        body_html: payload.body.replace(/\n/g, "<br/>"),
        direction: "Outbound",
        gmail_message_id: payload.gmailMessageId || null,
        sent_at: sentAt,
        raw_headers: rawHeadersPayload,
      })
      .select()
      .maybeSingle();

    if (message?.id) {
      messageId = message.id;
    }

    if (messageError) {
      console.warn(
        "[Supabase recordBookingEmail] Retrying with minimal baseline columns:",
        messageError.message,
      );
      const { data: retryMsg, error: retryErr } = await supabase
        .from("email_messages")
        .insert({
          thread_id: finalThreadId,
          sender_email: payload.fromEmail,
          recipient_email: payload.toEmail,
          subject: payload.subject,
          body: payload.body,
          direction: "Outbound",
          sent_at: sentAt,
          gmail_message_id: payload.gmailMessageId || null,
          raw_headers: rawHeadersPayload,
        })
        .select()
        .maybeSingle();

      if (retryErr) {
        console.warn("[Supabase recordBookingEmail] Message error:", retryErr.message);
        return { threadId: finalThreadId, messageId: "" };
      }
      if (retryMsg?.id) {
        messageId = retryMsg.id;
      }
    }

    // 4. Record milestone event in booking_events
    if (bookingUuid) {
      await supabase
        .from("booking_events")
        .insert({
          booking_id: bookingUuid,
          event_type: "Booking Request Sent",
          event_date: sentAt,
          location: "Origin Booking Desk",
          description: `Booking request email dispatched to ${payload.toEmail}. Movement Number: ${movementNumber}`,
        })
        .catch((err) => {
          console.warn("[Supabase booking_events] Notice:", err);
        });
    }

    return { threadId: finalThreadId, messageId };
  } catch (err) {
    console.warn("[Supabase recordBookingEmail] Exception:", err);
    return null;
  }
}

/**
 * Full End-to-End Booking Request + Email Dispatch Workflow
 * Validates, records to Supabase, generates references, creates containers/events/email records,
 * and checks backend Gmail API status.
 */
export async function submitBookingRequestWorkflow(
  userId: string | null | undefined,
  bookingData: CreateBookingPayload,
  emailData: {
    fromEmail: string;
    toEmail: string;
    toName?: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    forwarders?: Array<{
      id?: string;
      name?: string;
      email: string;
      contactName?: string;
      code?: string;
      contractTier?: string;
    }>;
  },
): Promise<BookingSubmissionResult> {
  // Ensure a unique Movement Number is preserved from the booking's own data
  let movementNumber =
    bookingData.movementNumber ||
    bookingData.movement_number ||
    extractMovementNumber(emailData.subject) ||
    extractMovementNumber(emailData.body) ||
    (bookingData.reference && bookingData.reference.startsWith("MOV-")
      ? bookingData.reference
      : null) ||
    (bookingData.bookingReference && bookingData.bookingReference.startsWith("MOV-")
      ? bookingData.bookingReference
      : null) ||
    bookingData.bookingReference ||
    bookingData.reference ||
    (bookingData.id
      ? `MOV-2026-${bookingData.id.replace(/-/g, "").slice(0, 5).toUpperCase()}`
      : null);

  if (!movementNumber) {
    movementNumber = generateMovementNumber();
  }

  const reference = bookingData.bookingReference || bookingData.reference || movementNumber;

  // 1. Resolve forwarder targets
  let targetForwarders: Array<{
    id: string;
    name: string;
    email: string;
    contactName: string;
    code?: string;
    contractTier?: string;
  }> = [];

  if (emailData.forwarders && emailData.forwarders.length > 0) {
    targetForwarders = emailData.forwarders
      .filter((f) => f.email && f.email.includes("@"))
      .map((f, idx) => ({
        id: f.id || `fwd-${Date.now()}-${idx}`,
        name: f.name || f.email.split("@")[0].replace(/[._-]/g, " ").toUpperCase(),
        email: f.email.trim(),
        contactName: f.contactName || (f.name ? `${f.name} Booking Team` : "Booking Team"),
        code: f.code,
        contractTier: f.contractTier,
      }));
  } else if (emailData.toEmail) {
    const rawList = emailData.toEmail
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes("@"));

    targetForwarders = rawList.map((addr, idx) => {
      const isFirst = idx === 0;
      const fId = (isFirst && bookingData.forwarderId) || `fwd-${Date.now()}-${idx}`;
      const fName =
        (isFirst && bookingData.forwarderName) ||
        addr.split("@")[0].replace(/[._-]/g, " ").toUpperCase();
      const cName = (isFirst && emailData.toName) || `${fName} Booking Team`;
      return {
        id: fId,
        name: fName,
        email: addr,
        contactName: cName,
      };
    });
  }

  if (targetForwarders.length === 0) {
    throw new Error("Selected forwarder does not have a valid email address.");
  }

  // 2. Create the booking record (just ONCE for this shipment movement)
  let createdBooking: FullBookingRecord | null = null;
  try {
    createdBooking = await createBookingInSupabase(userId, {
      ...bookingData,
      reference,
      bookingReference: reference,
      movementNumber,
      forwarderId: targetForwarders[0]?.id || bookingData.forwarderId,
      forwarderName:
        targetForwarders.length > 1
          ? targetForwarders.map((f) => f.name).join(", ")
          : targetForwarders[0]?.name || bookingData.forwarderName,
      status: "Booking Requested",
    });

    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nashmia_booking_created", {
          detail: {
            booking: createdBooking,
            bookingId: createdBooking?.id,
            id: createdBooking?.id,
            movementNumber: movementNumber || createdBooking?.movement_number,
            bookingReference: reference || createdBooking?.booking_reference,
            reference: reference || createdBooking?.booking_reference,
            status: "Booking Requested",
            timestamp: Date.now(),
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_movement_created", {
          detail: {
            booking: createdBooking,
            bookingId: createdBooking?.id,
            id: createdBooking?.id,
            movementNumber: movementNumber || createdBooking?.movement_number,
            bookingReference: reference || createdBooking?.booking_reference,
            reference: reference || createdBooking?.booking_reference,
            status: "Booking Requested",
            timestamp: Date.now(),
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("nashmia_bookings_updated", {
          detail: {
            booking: createdBooking,
            updated: true,
            id: createdBooking?.id,
            movementNumber: movementNumber || createdBooking?.movement_number,
            bookingReference: reference || createdBooking?.booking_reference,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("supabase_realtime_bookings_change", {
          detail: {
            booking: createdBooking,
            updated: true,
            id: createdBooking?.id,
            movementNumber: movementNumber || createdBooking?.movement_number,
            bookingReference: reference || createdBooking?.booking_reference,
          },
        }),
      );
    }
  } catch (err: unknown) {
    console.error("[submitBookingRequestWorkflow] Booking creation failed:", err);
    const errMsg = err instanceof Error ? err.message : "Failed to record booking in database.";
    throw new Error(errMsg);
  }

  // 3. Dispatch SEPARATE email to each forwarder
  let token: string | null = null;
  try {
    token = await getGmailAccessToken(userId);
  } catch (tErr) {
    console.warn("[submitBookingRequestWorkflow] Token check error:", tErr);
  }

  let overallGmailStatus: "sent" | "not_connected" | "failed" | "rate_limited" = "not_connected";
  let firstMsgId: string | undefined;
  let firstThId: string | undefined;
  let sentCount = 0;

  const dispatchedForwarders: Array<{
    id?: string;
    name?: string;
    email: string;
    messageId?: string;
    threadId?: string;
    gmailStatus: "sent" | "not_connected" | "failed" | "rate_limited";
  }> = [];

  for (let i = 0; i < targetForwarders.length; i++) {
    const target = targetForwarders[i];

    if (i > 0) {
      // Pace sending by 1.2s between forwarders to prevent per-second API bursts
      await new Promise((r) => setTimeout(r, 1200));
    }

    let fGmailStatus: "sent" | "not_connected" | "failed" | "rate_limited" = "not_connected";
    let fMsgId: string | undefined;
    let fThId: string | undefined;

    // Personalize email body for this individual forwarder
    let personalizedBody = emailData.body;
    if (targetForwarders.length > 1) {
      if (emailData.toName && personalizedBody.includes(emailData.toName)) {
        personalizedBody = personalizedBody.replace(emailData.toName, target.contactName);
      } else if (/^Dear\s+[^,\n]+,/m.test(personalizedBody)) {
        personalizedBody = personalizedBody.replace(
          /^Dear\s+[^,\n]+,/m,
          `Dear ${target.contactName},`,
        );
      }
    }

    // Direct Gmail API dispatch (SEPARATE email strictly to target.email)
    if (token) {
      try {
        console.log(
          `[submitBookingRequestWorkflow] Transmitting separate email to forwarder: ${target.name} <${target.email}>`,
        );
        const gmailResult = await sendEmailDirectlyViaGmail({
          fromEmail: emailData.fromEmail,
          toEmail: target.email,
          toName: target.contactName,
          cc: emailData.cc,
          bcc: emailData.bcc,
          subject: emailData.subject,
          body: personalizedBody,
          bookingId: createdBooking?.id,
          forwarderId: target.id,
          userId,
        });

        fGmailStatus = "sent";
        fMsgId = gmailResult.gmailMessageId;
        fThId = gmailResult.gmailThreadId;
        sentCount++;
      } catch (gmailErr: unknown) {
        const errMsg = gmailErr instanceof Error ? gmailErr.message : String(gmailErr);
        console.warn(
          `[submitBookingRequestWorkflow] Direct Gmail dispatch notice for ${target.email}:`,
          errMsg,
        );
        if (
          errMsg.includes("Quota exceeded") ||
          errMsg.includes("rateLimitExceeded") ||
          errMsg.includes("403")
        ) {
          fGmailStatus = "rate_limited";
        } else {
          fGmailStatus = "failed";
        }
      }
    }

    // Backend proxy fallback if direct token not available or standard failed (not rate limit)
    if (fGmailStatus !== "sent" && fGmailStatus !== "rate_limited") {
      try {
        const res = await fetch("/api/gmail/status").catch(() => null);
        if (res && res.ok) {
          const statusData = await res.json().catch(() => ({ connected: false }));
          if (statusData.connected) {
            const sendRes = await fetch("/api/gmail/send-booking", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                from: emailData.fromEmail,
                to: target.email,
                subject: emailData.subject,
                body: personalizedBody,
                reference,
                movementNumber,
                bookingId: createdBooking?.id,
              }),
            }).catch(() => null);

            if (sendRes && sendRes.ok) {
              const sendJson = await sendRes.json().catch(() => ({}));
              fGmailStatus = "sent";
              fMsgId = sendJson.id;
              fThId = sendJson.threadId;
              sentCount++;
            } else {
              fGmailStatus = "failed";
            }
          } else {
            fGmailStatus = "not_connected";
          }
        } else {
          fGmailStatus = "not_connected";
        }
      } catch {
        if (fGmailStatus !== "failed") {
          fGmailStatus = "not_connected";
        }
      }
    }

    if (!firstMsgId && fMsgId) firstMsgId = fMsgId;
    if (!firstThId && fThId) firstThId = fThId;

    // Record email thread and message in Supabase for this forwarder
    let fEmailRecordIds: { threadId: string; messageId: string } | null = null;
    if (isConfiguredSupabase()) {
      try {
        fEmailRecordIds = await recordBookingEmailInSupabase({
          userId,
          bookingId: createdBooking?.id,
          movementId: createdBooking?.id,
          forwarderId: target.id,
          fromEmail: emailData.fromEmail,
          toEmail: target.email,
          toName: target.contactName,
          subject: emailData.subject,
          body: personalizedBody,
          movementRef: movementNumber,
          movementNumber,
          gmailMessageId: fMsgId || null,
          gmailThreadId: fThId || null,
          sentAt: fGmailStatus === "sent" ? new Date().toISOString() : null,
          status: fGmailStatus === "sent" ? "SENT" : "PENDING",
        });

        await supabase.from("booking_events").insert({
          booking_id: safeUuid(createdBooking?.id) || "",
          event_type: "Forwarder Request Sent",
          title: `Quotation Request Sent to ${target.name}`,
          description: `Dispatched individual booking request email to ${target.email}. Distinct Gmail Thread: ${fThId || "Pending"}`,
          occurred_at: new Date().toISOString(),
        });
      } catch (err) {
        console.warn(
          `[submitBookingRequestWorkflow] Email record notice for ${target.email}:`,
          err,
        );
      }
    }

    // Register ForwarderQuoteRequestRecord in local/shared desk storage
    try {
      if (typeof window !== "undefined") {
        const STORAGE_KEY = "nashmia_multi_forwarder_requests_v2";
        const LEGACY_STORAGE_KEY = "nashmia_forwarder_requests";
        const rawExisting =
          localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        let existingList: Array<Record<string, unknown>> = [];
        try {
          if (rawExisting) existingList = JSON.parse(rawExisting);
        } catch {
          existingList = [];
        }

        const bId = createdBooking?.id || `bk-${Date.now()}`;
        const recordId = `MFR-${bId.slice(0, 6)}-${target.id.slice(0, 6)}-${Date.now()}-${i}`;
        const newRecord = {
          id: recordId,
          bookingId: bId,
          bookingReference: reference,
          movementNumber,
          forwarderId: target.id,
          forwarderName: target.name,
          forwarderCode: target.code || "",
          forwarderEmail: target.email,
          forwarderContactPerson: target.contactName,
          forwarderBadge: target.contractTier,
          status: "AWAITING_OFFER",
          emailMessageId: fMsgId || fEmailRecordIds?.messageId || `msg-${Date.now()}-${i}`,
          gmailThreadId: fThId || fEmailRecordIds?.threadId,
          gmailMessageId: fMsgId,
          trackingCompositeKey: `${bId}::${target.id}::${fThId || ""}::${fMsgId || ""}`,
          sentAt: new Date().toISOString(),
          sentBy: emailData.fromEmail,
          requiredSailingDate: bookingData.loadingDate || bookingData.etd,
          origin: bookingData.origin || "Felixstowe",
          destination: bookingData.destination || "Karachi",
          polCode: bookingData.polCode || "FXT",
          polName: bookingData.origin || "Felixstowe",
          podCode: bookingData.podCode || "KHI",
          podName: bookingData.destination || "Karachi",
          supplierName: bookingData.supplierName || "",
          buyerName: bookingData.buyerName || "",
          containerType: bookingData.containerType || "High Cube",
          containerSize: (bookingData.containerSize as ContainerSize) || "40HC",
          containerCount: bookingData.containerCount || 1,
          cargoDescription: bookingData.productDescription || "Commercial Cargo",
          specialInstructions: bookingData.specialInstructions || "",
          updatedAt: new Date().toISOString(),
        };

        const updatedList = [newRecord, ...existingList.filter((r) => r.id !== recordId)];
        const serialized = JSON.stringify(updatedList);
        localStorage.setItem(STORAGE_KEY, serialized);
        localStorage.setItem(LEGACY_STORAGE_KEY, serialized);

        window.dispatchEvent(
          new CustomEvent("nashmia_multi_forwarder_updated", {
            detail: { count: updatedList.length, timestamp: Date.now() },
          }),
        );
      }
    } catch (trackErr) {
      console.warn(
        "[submitBookingRequestWorkflow] Forwarder quote request register notice:",
        trackErr,
      );
    }

    // Fire individual nashmia:email-sent event for this forwarder
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nashmia:email-sent", {
          detail: {
            id: fMsgId || firstMsgId || `msg-${Date.now()}-${i}`,
            toEmail: target.email,
            toName: target.contactName,
            subject: emailData.subject,
            snippet: personalizedBody.slice(0, 120),
            bookingReference: reference,
            forwarderId: target.id,
            forwarderName: target.name,
          },
        }),
      );
    }

    dispatchedForwarders.push({
      id: target.id,
      name: target.name,
      email: target.email,
      gmailStatus: fGmailStatus,
      messageId: fMsgId,
      threadId: fThId,
    });
  }

  // Determine overall status
  if (sentCount === targetForwarders.length && sentCount > 0) {
    overallGmailStatus = "sent";
  } else if (sentCount > 0) {
    overallGmailStatus = "sent";
  } else if (dispatchedForwarders.some((f) => f.gmailStatus === "rate_limited")) {
    overallGmailStatus = "rate_limited";
  } else if (token) {
    overallGmailStatus = "failed";
  } else {
    overallGmailStatus = "not_connected";
  }

  // Dispatch multi-forwarder dispatched event
  if (typeof window !== "undefined" && targetForwarders.length > 1) {
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_dispatched", {
        detail: {
          bookingId: createdBooking?.id,
          movementNumber,
          count: targetForwarders.length,
          forwarders: dispatchedForwarders,
        },
      }),
    );
  }

  return {
    success: true,
    bookingId: createdBooking?.id,
    reference,
    movementNumber,
    toEmail: targetForwarders.map((f) => f.email).join(", "),
    status: "Booking Requested",
    gmailStatus: overallGmailStatus,
    messageId: firstMsgId,
    threadId: firstThId,
    emailId: firstMsgId,
    gmailMessageId: firstMsgId,
    gmailThreadId: firstThId,
    dispatchedCount: targetForwarders.length,
    forwarders: dispatchedForwarders,
  };
}

function isConfiguredSupabase(): boolean {
  return isSupabaseConfigured;
}
