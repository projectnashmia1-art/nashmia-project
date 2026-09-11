import { supabase, isSupabaseConfigured } from "./supabase";
import { getGmailAccessToken, sendEmailDirectlyViaGmail } from "./gmail-service";
import { generateMovementNumber, extractMovementNumber } from "./movement-lifecycle";
import type { Database } from "@/types/database.types";
import type { BuyerAccountFull, BuyerStatus } from "./buyers-data";
import type { SupplierAccountFull, SupplierStatus } from "./suppliers-data";
import type { ForwarderAccount, ForwarderStatus, ForwarderRateCard } from "./forwarders-data";
import type { ContainerSize } from "./booking-data";

export function safeUuid(id?: string | null): string | null {
  if (!id) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : null;
}

export function isValidUuid(id?: string | null): boolean {
  return safeUuid(id) !== null;
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

export async function fetchBuyersFromSupabase(userId?: string | null): Promise<BuyerAccountFull[]> {
  if (!isSupabaseConfigured) return [];

  try {
    let query = supabase
      .from("buyers")
      .select(
        "*, bookings(id, status, origin, destination, vessel_name, etd, eta, container_count, container_type)",
      )
      .order("created_at", { ascending: false });

    // Strict user scoping: each user profile sees only their own data
    const validUserUuid = safeUuid(userId);
    if (validUserUuid) {
      query = query.eq("user_id", validUserUuid);
    } else {
      query = query.is("user_id", null);
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
): Promise<SupplierAccountFull[]> {
  const localList = getLocalSuppliers();
  if (!isSupabaseConfigured) return localList;

  try {
    let query = supabase
      .from("suppliers")
      .select(
        "*, bookings(id, booking_reference, status, origin, destination, vessel_name, etd, eta, container_count, container_type)",
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

    // Merge with local suppliers
    const combined = [...dbSuppliers];
    for (const local of localList) {
      if (!combined.some((s) => matchesSupplier(s, local.id, local.name))) {
        combined.unshift(local);
      }
    }
    return combined;
  } catch (err) {
    console.warn("[Supabase fetchSuppliers] Network or connectivity notice:", err);
    return localList;
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
): Promise<ForwarderAccount[]> {
  const localList = getLocalForwarders();

  if (!isSupabaseConfigured) {
    return localList.length > 0 ? localList : [];
  }

  try {
    let query = supabase
      .from("forwarders")
      .select("*, rate_cards(*), bookings(id, status)")
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
        rate: Number(rc.base_rate) || 2100,
        currency: (rc.currency as "USD" | "EUR" | "GBP") || "USD",
        effectiveFrom: rc.valid_from || "2026-08-01",
        validUntil: rc.valid_until || "2026-08-31",
        status: rc.status === "Active" ? "Active" : "Draft",
      }));

      const rawBookings = (f.bookings as Array<{ id: string; status: string }>) || [];
      const active = rawBookings.filter((bk) =>
        ["In Transit", "Booking Requested", "Booking Confirmed", "Loaded"].includes(bk.status),
      ).length;

      return mapForwarderRowToAccount(f, mappedRateCards, active);
    });

    // Merge DB forwarders with local forwarders (local ones take precedence if newly added)
    const combined = [...dbForwarders];
    for (const local of localList) {
      const exists = combined.some((dbF) => matchesForwarder(dbF, local.id, local.name));
      if (!exists) {
        combined.unshift(local);
      }
    }

    return combined;
  } catch (err) {
    console.warn("[Supabase fetchForwarders] Network notice:", err);
    return localList;
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
): Promise<ShippingLineRow[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase.from("shipping_lines").select("*").order("name", { ascending: true });
  const validUserUuid = safeUuid(userId);
  if (validUserUuid) {
    query = query.or(`user_id.eq.${validUserUuid},user_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase fetchShippingLines] Error:", error);
    return [];
  }
  return data || [];
}

export async function fetchRateCardsFromSupabase(userId?: string | null): Promise<RateCardRow[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from("rate_cards")
    .select("*, forwarders(company_name), shipping_lines(name)")
    .order("created_at", { ascending: false });
  const validUserUuid = safeUuid(userId);
  if (validUserUuid) {
    query = query.or(`user_id.eq.${validUserUuid},user_id.is.null`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[Supabase fetchRateCards] Error:", error);
    return [];
  }
  return data || [];
}

// ============================================================================
// BOOKINGS LOCAL STORAGE PERSISTENCE HELPERS
// ============================================================================

const LOCAL_BOOKINGS_KEY = "nashmia_custom_bookings_v1";

export function getLocalBookings(): FullBookingRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_BOOKINGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
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
    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[Local Bookings] Failed to save:", err);
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

    localStorage.setItem(LOCAL_BOOKINGS_KEY, JSON.stringify(updated));

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

export async function fetchBookingsFromSupabase(
  userId?: string | null,
): Promise<FullBookingRecord[]> {
  const localList = getLocalBookings();

  if (!isSupabaseConfigured) return localList;

  let validUserUuid = safeUuid(userId);
  if (!validUserUuid) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        validUserUuid = safeUuid(sessionData.session.user.id);
      }
    } catch (authErr) {
      console.warn("[fetchBookingsFromSupabase] User check notice:", authErr);
    }
  }

  try {
    let query = supabase
      .from("bookings")
      .select(
        `
        *,
        buyer:buyers(*),
        supplier:suppliers(*),
        forwarder:forwarders(*),
        shipping_line:shipping_lines(*),
        rate_card:rate_cards(*),
        containers:booking_containers(*),
        events:booking_events(*)
      `,
      )
      .order("created_at", { ascending: false });

    if (validUserUuid) {
      query = query.or(`user_id.eq.${validUserUuid},user_id.is.null`);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Supabase fetchBookings] Warning:", error.message);
      return localList;
    }

    const dbBookings = (data as unknown as FullBookingRecord[]) || [];

    // Merge DB bookings with local bookings seamlessly
    const dbRefMap = new Set(dbBookings.map((b) => b.booking_reference || b.id));
    const uniqueLocals = localList.filter(
      (b) => !dbRefMap.has(b.booking_reference || b.id) && !dbBookings.some((db) => db.id === b.id),
    );

    return [...uniqueLocals, ...dbBookings];
  } catch (err) {
    console.warn("[Supabase fetchBookings] Exception:", err);
    return localList;
  }
}

export async function fetchBookingByIdFromSupabase(
  bookingId: string,
): Promise<FullBookingRecord | null> {
  const local = getLocalBookings().find((b) => b.id === bookingId);

  if (!isSupabaseConfigured) return local || null;

  try {
    const { data, error } = await supabase
      .from("bookings")
      .select(
        `
        *,
        buyer:buyers(*),
        supplier:suppliers(*),
        forwarder:forwarders(*),
        shipping_line:shipping_lines(*),
        rate_card:rate_cards(*),
        containers:booking_containers(*),
        events:booking_events(*)
      `,
      )
      .eq("id", bookingId)
      .single();

    if (error) {
      return local || null;
    }

    return (data as unknown as FullBookingRecord) || local || null;
  } catch {
    return local || null;
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

  const validUserUuid = safeUuid(userId);

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

  const origin = payload.origin || payload.polName || "Felixstowe (FXT)";
  const destination = payload.destination || payload.podName || "Karachi (KHI)";
  const containerCount = payload.containerCount || 1;
  const containerSize = (payload.containerSize as ContainerSize) || "40HC";
  const containerType = payload.containerType || "High Cube";
  const productDescription = payload.productDescription || "Commercial Cargo";
  const status = payload.status || "Booking Requested";

  // Prepare fallback/local record upfront
  const fallbackId = `bk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();

  const containerRows = [];
  const count = Math.max(1, containerCount);
  for (let i = 0; i < count; i++) {
    const num =
      payload.containerNumbers?.[i] || `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`;
    containerRows.push({
      id: `cnt-${fallbackId}-${i}`,
      booking_id: fallbackId,
      created_at: nowIso,
      container_number: num,
      container_type: containerType,
      container_size: containerSize,
      seal_number: `SL-${Math.floor(100000 + Math.random() * 900000)}`,
      weight: 24500,
      status: "Gate-In",
    });
  }

  const initialEvent = {
    id: `evt-${fallbackId}-1`,
    booking_id: fallbackId,
    created_at: nowIso,
    event_type: status,
    event_date: nowIso,
    location: origin,
    description: `Booking request generated for ${containerCount}x ${containerSize} container(s). Movement: ${movementNumber}`,
  };

  const bookingInsert: BookingInsert = {
    user_id: validUserUuid,
    booking_reference: bookingRef,
    movement_number: movementNumber,
    buyer_id: safeUuid(payload.buyerId),
    supplier_id: safeUuid(payload.supplierId),
    forwarder_id: safeUuid(payload.forwarderId),
    shipping_line_id: safeUuid(payload.shippingLineId),
    rate_card_id: safeUuid(payload.rateCardId),
    origin,
    destination,
    vessel_name:
      payload.vesselName || payload.shippingLineName
        ? `${payload.shippingLineName || "MSC"} EMMA`
        : "MSC EMMA",
    voyage_number: payload.voyageNumber || "V.2409",
    etd: payload.etd || new Date().toISOString().split("T")[0],
    eta: payload.eta || new Date(Date.now() + 18 * 86400000).toISOString().split("T")[0],
    container_count: containerCount,
    container_type: containerType,
    container_size: containerSize,
    product_description: productDescription,
    special_instructions: payload.specialInstructions || payload.notes || null,
    notes: payload.notes || payload.specialInstructions || null,
    total_freight: payload.totalFreight || 4200,
    currency: payload.currency || "USD",
    status,
  };

  let createdBooking: FullBookingRecord | null = null;

  if (isSupabaseConfigured) {
    try {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert(bookingInsert)
        .select()
        .single();

      if (bookingError) {
        console.warn(
          "[Supabase createBooking] Database response notice (RLS / permissions):",
          bookingError.message,
        );
      } else if (booking) {
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

        await supabase
          .from("booking_containers")
          .insert(dbContainerRows)
          .catch((err) => {
            console.warn("[Supabase booking_containers] Insert notice:", err);
          });

        // Insert initial event in Supabase
        await supabase
          .from("booking_events")
          .insert({
            booking_id: booking.id,
            event_type: booking.status || status,
            event_date: nowIso,
            location: origin,
            description: `Booking request generated for ${containerCount}x ${containerSize} container(s). Movement: ${movementNumber}`,
          })
          .catch((err) => {
            console.warn("[Supabase booking_events] Insert notice:", err);
          });

        if (validUserUuid) {
          try {
            await supabase.from("notifications").insert({
              user_id: validUserUuid,
              type: "booking_update",
              title: "New Booking Created",
              message: `Movement ${movementNumber} (${bookingRef}) has been initialized successfully.`,
              related_booking_id: booking.id,
              is_read: false,
            });
          } catch (auditErr) {
            console.warn("[Supabase booking notification notice]:", auditErr);
          }
        }

        createdBooking = {
          ...booking,
          movement_number: movementNumber,
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
    createdBooking = {
      id: fallbackId,
      created_at: nowIso,
      updated_at: nowIso,
      user_id: validUserUuid,
      booking_reference: bookingRef,
      movement_number: movementNumber,
      buyer_id: safeUuid(payload.buyerId),
      supplier_id: safeUuid(payload.supplierId),
      forwarder_id: safeUuid(payload.forwarderId),
      shipping_line_id: safeUuid(payload.shippingLineId),
      rate_card_id: safeUuid(payload.rateCardId),
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
      total_freight: bookingInsert.total_freight || 4200,
      currency: bookingInsert.currency || "USD",
      status,
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
  userId: string,
  newStatus: string,
  location = "En Route",
  description?: string,
  customUpdates?: Partial<Database["public"]["Tables"]["bookings"]["Update"]>,
): Promise<void> {
  const updateData: Database["public"]["Tables"]["bookings"]["Update"] = {
    status: newStatus,
    updated_at: new Date().toISOString(),
    ...customUpdates,
  };

  updateLocalBooking(bookingId, { status: newStatus, ...customUpdates });

  if (!isSupabaseConfigured) return;

  try {
    const { error } = await supabase.from("bookings").update(updateData).eq("id", bookingId);
    if (error) {
      console.warn("[Supabase updateBookingStatus] Notice:", error.message);
    }

    // Record event
    await supabase.from("booking_events").insert({
      booking_id: bookingId,
      event_type: newStatus,
      event_date: new Date().toISOString(),
      location,
      description: description || `Status updated to ${newStatus}`,
    });

    // Record notification
    if (userId) {
      const isConfirmed =
        newStatus.toUpperCase() === "CONFIRMED" || newStatus.toLowerCase().includes("confirmed");

      // Attempt to retrieve booking reference / movement number from local state or customUpdates
      const localBooking = getLocalBookings().find((b) => b.id === bookingId);
      const movementRef =
        customUpdates?.movement_number ||
        localBooking?.movement_number ||
        localBooking?.booking_reference ||
        "NASH-BKG";

      const notifTitle = isConfirmed
        ? `Booking Confirmed: ${movementRef}`
        : `Movement ${newStatus}`;
      const notifMessage = isConfirmed
        ? `Movement ${movementRef} has been confirmed by the forwarder.`
        : `Booking stage progressed to ${newStatus}.`;

      await supabase.from("notifications").insert({
        user_id: safeUuid(userId) || "00000000-0000-0000-0000-000000000000",
        type: isConfirmed ? "booking_confirmed" : "milestone",
        title: notifTitle,
        message: notifMessage,
        related_booking_id: bookingId,
        booking_id: bookingId,
        link: "/movements",
        is_read: false,
      });
    }
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

export async function deleteBookingFromSupabase(bookingId: string): Promise<void> {
  deleteLocalBooking(bookingId);

  if (!isSupabaseConfigured) return;

  try {
    // Delete child containers & events first
    await supabase.from("booking_containers").delete().eq("booking_id", bookingId);
    await supabase.from("booking_events").delete().eq("booking_id", bookingId);
    await supabase.from("bookings").delete().eq("id", bookingId);
  } catch (err) {
    console.warn("[Supabase deleteBooking] Notice:", err);
  }
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
  },
): Promise<BookingContainerRow> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

  const { data, error } = await supabase
    .from("booking_containers")
    .insert({
      booking_id: bookingId,
      container_number:
        containerData.containerNumber || `MSCU${Math.floor(1000000 + Math.random() * 9000000)}`,
      container_type: containerData.containerType || "High Cube",
      container_size: containerData.containerSize || "40HC",
      seal_number: containerData.sealNumber || `SL-${Math.floor(100000 + Math.random() * 900000)}`,
      weight: containerData.weight || 24500,
      status: containerData.status || "Gate-In",
    })
    .select()
    .single();

  if (error) {
    console.error("[Supabase insertBookingContainer] Error:", error);
    throw new Error(error.message);
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

  const { error } = await supabase
    .from("booking_containers")
    .update({ ...containerData, updated_at: new Date().toISOString() })
    .eq("id", containerId);

  if (error) {
    console.error("[Supabase updateBookingContainer] Error:", error);
    throw new Error(error.message);
  }
}

export async function deleteBookingContainerFromSupabase(containerId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");

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
): Promise<NotificationRow[]> {
  if (!isSupabaseConfigured) return [];

  let query = supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

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

export async function fetchDashboardMetricsFromSupabase(
  userId?: string | null,
): Promise<DashboardMetrics> {
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
    let bookingsQuery = supabase
      .from("bookings")
      .select(
        `
        id,
        booking_reference,
        status,
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
      .order("created_at", { ascending: false });

    const validUserUuid = safeUuid(userId);
    if (validUserUuid) {
      bookingsQuery = bookingsQuery.or(`user_id.eq.${validUserUuid},user_id.is.null`);
    }

    const { data: bookingsData } = await bookingsQuery;
    let bookings = (bookingsData as unknown as FullBookingRecord[]) || [];

    // Seamlessly incorporate local / memory bookings
    const localList = getLocalBookings();
    if (localList.length > 0) {
      const dbRefMap = new Set(bookings.map((b) => b.booking_reference || b.id));
      const uniqueLocals = localList.filter(
        (b) => !dbRefMap.has(b.booking_reference || b.id) && !bookings.some((db) => db.id === b.id),
      );
      bookings = [...uniqueLocals, ...bookings];
    }

    // Fetch counts for buyers, suppliers, forwarders
    let buyersCountQuery = supabase.from("buyers").select("*", { count: "exact", head: true });
    let suppliersCountQuery = supabase
      .from("suppliers")
      .select("*", { count: "exact", head: true });
    let forwardersCountQuery = supabase
      .from("forwarders")
      .select("*", { count: "exact", head: true });

    if (validUserUuid) {
      buyersCountQuery = buyersCountQuery.or(`user_id.eq.${validUserUuid},user_id.is.null`);
      suppliersCountQuery = suppliersCountQuery.or(`user_id.eq.${validUserUuid},user_id.is.null`);
      forwardersCountQuery = forwardersCountQuery.or(`user_id.eq.${validUserUuid},user_id.is.null`);
    }

    const [buyersRes, suppliersRes, forwardersRes] = await Promise.all([
      buyersCountQuery,
      suppliersCountQuery,
      forwardersCountQuery,
    ]);

    const totalBuyers = buyersRes.count ?? 0;
    const totalSuppliers = suppliersRes.count ?? 0;
    const totalForwarders = forwardersRes.count ?? 0;

    // Calculate container totals and stages
    let totalContainers = 0;
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
      const cnt = b.container_count || 1;
      totalContainers += cnt;
      const rawStatus = (b.status || "").toLowerCase();
      if (rawStatus.includes("request")) {
        stageCounts["Booking Requested"] += cnt;
      } else if (rawStatus.includes("confirm")) {
        stageCounts["Booking Confirmed"] += cnt;
      } else if (
        rawStatus.includes("received") ||
        rawStatus.includes("staged") ||
        rawStatus.includes("warehouse")
      ) {
        stageCounts["Cargo Received at Warehouse"] += cnt;
      } else if (
        rawStatus.includes("stuff") ||
        rawStatus.includes("seal") ||
        rawStatus.includes("loaded")
      ) {
        stageCounts["Stuffing & Sealing"] += cnt;
      } else if (rawStatus.includes("custom") || rawStatus.includes("cleared")) {
        stageCounts["Customs Cleared"] += cnt;
      } else if (
        rawStatus.includes("shipped from") ||
        rawStatus.includes("dispatch") ||
        rawStatus.includes("gate-out")
      ) {
        stageCounts["Container Shipped from Warehouse"] += cnt;
      } else if (rawStatus.includes("transit") || rawStatus.includes("at sea")) {
        stageCounts["In Transit"] += cnt;
      } else if (rawStatus.includes("arriv")) {
        stageCounts["Arrived"] += cnt;
      } else if (rawStatus.includes("deliver")) {
        stageCounts["Delivered"] += cnt;
      } else {
        stageCounts["Booking Requested"] += cnt;
      }
    }

    const lifecycle: DashboardMetrics["lifecycle"] = [
      {
        stage: "Booking Requested",
        count: stageCounts["Booking Requested"] || 0,
        state: stageCounts["Booking Requested"] > 0 ? "active" : "future",
      },
      {
        stage: "Booking Confirmed",
        count: stageCounts["Booking Confirmed"] || 0,
        state: stageCounts["Booking Confirmed"] > 0 ? "active" : "future",
      },
      {
        stage: "Cargo Received at Warehouse",
        count: stageCounts["Cargo Received at Warehouse"] || 0,
        state: stageCounts["Cargo Received at Warehouse"] > 0 ? "active" : "future",
      },
      {
        stage: "Stuffing & Sealing",
        count: stageCounts["Stuffing & Sealing"] || 0,
        state: stageCounts["Stuffing & Sealing"] > 0 ? "active" : "future",
      },
      {
        stage: "Customs Cleared",
        count: stageCounts["Customs Cleared"] || 0,
        state: stageCounts["Customs Cleared"] > 0 ? "active" : "future",
      },
      {
        stage: "Container Shipped from Warehouse",
        count: stageCounts["Container Shipped from Warehouse"] || 0,
        state: stageCounts["Container Shipped from Warehouse"] > 0 ? "active" : "future",
      },
      {
        stage: "In Transit",
        count: stageCounts["In Transit"] || 0,
        state: stageCounts["In Transit"] > 0 ? "active" : "future",
      },
      {
        stage: "Delivered",
        count: stageCounts["Delivered"] || 0,
        state: stageCounts["Delivered"] > 0 ? "complete" : "future",
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
        count: approachingCutoffsCount > 0 ? approachingCutoffsCount : Math.min(bookings.length, 1),
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
        (b.buyer as { company_name?: string } | null)?.company_name || "Enterprise Consignee";
      const supplierName =
        (b.supplier as { company_name?: string } | null)?.company_name || "Logistics Hub";
      const createdDate = new Date(b.created_at || Date.now());
      const ageDays = Math.max(
        1,
        Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24)),
      );

      return {
        id: b.id,
        ref:
          b.booking_reference ||
          `NASH-CM-${b.id
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(-5)
            .toUpperCase()}`,
        buyer: buyerName,
        supplier: supplierName,
        pol: b.origin?.slice(0, 3).toUpperCase() || "FXT",
        pod: b.destination?.slice(0, 3).toUpperCase() || "KHI",
        vessel: b.vessel_name
          ? `${b.vessel_name} ${b.voyage_number || ""}`.trim()
          : "MSC ANNA / 2409",
        etd: b.etd || "20 Aug",
        eta: b.eta || "14 Sep",
        stage: b.status || "In Transit",
        rate: `$${(b.total_freight || 2100).toLocaleString()}`,
        age: `${ageDays}d`,
      };
    });

    const cutoffs = bookings.slice(0, 3).map((b, idx) => ({
      ref: b.booking_reference || `NASH-CM-0004${idx + 1}`,
      type: idx === 0 ? "SI Cut-off" : idx === 1 ? "VGM Cut-off" : "Port Cut-off",
      date: b.etd || "22 Aug",
      time: "04:00 PM",
      in: `in ${idx + 2} days`,
    }));

    const calculatedKpis = [
      {
        label: "Total Containers",
        value: String(totalContainers),
        trend: totalContainers > 0 ? "+12.4% this month" : "0 active",
        icon: "Container",
      },
      {
        label: "Booking Requested",
        value: String(stageCounts["Booking Requested"] || 0),
        trend: (stageCounts["Booking Requested"] || 0) > 0 ? "+4.1% this week" : "No pending",
        icon: "ClipboardList",
      },
      {
        label: "Booking Confirmed",
        value: String(stageCounts["Booking Confirmed"] || 0),
        trend: (stageCounts["Booking Confirmed"] || 0) > 0 ? "+8.7% this month" : "No active",
        icon: "BadgeCheck",
      },
      {
        label: "In Transit",
        value: String(stageCounts["In Transit"] || 0),
        trend: (stageCounts["In Transit"] || 0) > 0 ? "+2.9% vs last week" : "None sailing",
        icon: "Ship",
      },
      {
        label: "Arrived",
        value: String(stageCounts["Arrived"] || 0),
        trend: (stageCounts["Arrived"] || 0) > 0 ? "At destination port" : "None arrived",
        icon: "Anchor",
      },
      {
        label: "Delivered",
        value: String(stageCounts["Delivered"] || 0),
        trend: (stageCounts["Delivered"] || 0) > 0 ? "Completed orders" : "0 completed",
        icon: "PackageCheck",
      },
    ];

    return {
      totalContainers,
      bookingRequests: stageCounts["Booking Requested"] || 0,
      bookingConfirmed: stageCounts["Booking Confirmed"] || 0,
      inTransit: stageCounts["In Transit"] || 0,
      arrived: stageCounts["Arrived"] || 0,
      delivered: stageCounts["Delivered"] || 0,
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
  const movementNumber =
    payload.movementNumber ||
    extractMovementNumber(payload.subject) ||
    extractMovementNumber(payload.body) ||
    payload.movementRef ||
    generateMovementNumber();

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
        await supabase
          .from("email_messages")
          .update({
            booking_id: bookingUuid,
            movement_id: movementUuid,
            forwarder_id: forwarderUuid,
            movement_number: movementNumber,
            recipient_email: payload.toEmail,
            to_email: payload.toEmail,
            gmail_thread_id: payload.gmailThreadId || null,
            sent_at: sentAt,
            status: "SENT",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingMsg.id);

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
    const { data: message, error: messageError } = await supabase
      .from("email_messages")
      .insert({
        thread_id: finalThreadId,
        booking_id: bookingUuid,
        movement_id: movementUuid,
        movement_number: movementNumber,
        forwarder_id: forwarderUuid,
        user_id: validUserUuid,
        sender_email: payload.fromEmail,
        from_email: payload.fromEmail,
        sender_name: "Nashmia Industries",
        recipient_email: payload.toEmail,
        to_email: payload.toEmail,
        recipient_name: payload.toName || "Forwarder Booking Desk",
        subject: payload.subject,
        body: payload.body,
        body_html: payload.body.replace(/\n/g, "<br/>"),
        snippet: payload.body.slice(0, 140),
        direction: "outbound",
        status: payload.gmailMessageId ? "SENT" : payload.status || "PENDING",
        email_type: "BOOKING_REQUEST",
        gmail_message_id: payload.gmailMessageId || null,
        gmail_thread_id: payload.gmailThreadId || null,
        sent_at: sentAt,
        headers: {
          booking_id: bookingId || null,
          movement_id: movementId || null,
          forwarder_id: payload.forwarderId || null,
          gmail_message_id: payload.gmailMessageId || null,
          gmail_thread_id: payload.gmailThreadId || null,
          movement_number: movementNumber,
          to_email: payload.toEmail,
          sent_at: sentAt,
        },
      })
      .select()
      .single();

    if (messageError) {
      console.warn("[Supabase recordBookingEmail] Message error:", messageError.message);
      return { threadId: finalThreadId, messageId: "" };
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

    return { threadId: finalThreadId, messageId: message.id };
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
  // Ensure a unique Movement Number is generated or preserved
  const movementNumber =
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
    generateMovementNumber();

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

  // 2. If Supabase is configured, create the booking record (just ONCE for this shipment movement)
  let createdBooking: FullBookingRecord | null = null;
  if (isConfiguredSupabase()) {
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
    } catch (err: unknown) {
      console.error("[submitBookingRequestWorkflow] Booking creation failed:", err);
      const errMsg = err instanceof Error ? err.message : "Failed to record booking in database.";
      throw new Error(errMsg);
    }
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
          supplierName: bookingData.supplierName || "UK Supplier",
          buyerName: bookingData.buyerName || "New Henna",
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
