import type {
  FullRateCardRecord,
  AdditionalChargeItem,
  RateCardStatus,
} from "@/types/rate-card.types";

export interface RateCardFormValues {
  forwarderId: string;
  shippingLineId?: string;
  cardName: string;
  origin: string;
  destination: string;
  loadPoint?: string;
  polCode?: string;
  polName?: string;
  podCode?: string;
  podName?: string;
  containerSize: "20FT" | "40FT" | "40HC" | string;
  containerType: string;
  quantity: number;
  baseRate: number;
  currency: string;
  additionalCharges: AdditionalChargeItem[];
  transitDaysMin?: number;
  transitDaysMax?: number;
  etd?: string;
  eta?: string;
  validFrom: string;
  validUntil: string;
  status: RateCardStatus;
  freeDemurrageDays?: number;
  notes?: string;
}

export const CONTAINER_SIZE_OPTIONS = [
  { value: "40HC", label: "40ft High Cube (40HC)" },
  { value: "40FT", label: "40ft Standard Dry (40FT)" },
  { value: "20FT", label: "20ft Standard Dry (20FT)" },
];

export const CONTAINER_TYPE_OPTIONS = [
  { value: "High Cube", label: "High Cube (HQ)" },
  { value: "Dry Standard", label: "Dry Standard (GP)" },
  { value: "Reefer", label: "Refrigerated (RF)" },
  { value: "Open Top", label: "Open Top (OT)" },
  { value: "Flat Rack", label: "Flat Rack (FR)" },
  { value: "Tank", label: "ISO Tank (TK)" },
];

export const CURRENCY_OPTIONS = [
  { value: "USD", symbol: "$", label: "USD - US Dollar" },
  { value: "GBP", symbol: "£", label: "GBP - British Pound" },
  { value: "EUR", symbol: "€", label: "EUR - Euro" },
  { value: "PKR", symbol: "Rs", label: "PKR - Pakistani Rupee" },
  { value: "AED", symbol: "AED", label: "AED - UAE Dirham" },
];

export const COMMON_CHARGE_TEMPLATES = [
  {
    name: "BAF (Bunker Adjustment Factor)",
    defaultAmount: 180,
    currency: "USD",
    unit: "per_container",
  },
  {
    name: "CAF (Currency Adjustment Factor)",
    defaultAmount: 45,
    currency: "USD",
    unit: "per_container",
  },
  {
    name: "THC Origin (Terminal Handling)",
    defaultAmount: 160,
    currency: "USD",
    unit: "per_container",
  },
  {
    name: "THC Destination (Port Handling)",
    defaultAmount: 190,
    currency: "USD",
    unit: "per_container",
  },
  { name: "Documentation & Bill of Lading", defaultAmount: 65, currency: "USD", unit: "per_bl" },
  { name: "ISPS / Security Surcharge", defaultAmount: 25, currency: "USD", unit: "per_container" },
  {
    name: "VGM Calibration Certificate",
    defaultAmount: 35,
    currency: "USD",
    unit: "per_container",
  },
  { name: "Seal & Compliance Fee", defaultAmount: 15, currency: "USD", unit: "per_container" },
];

/**
 * Calculates total landed rate per container including applicable surcharges.
 */
export function calculateTotalRate(baseRate: number, charges: AdditionalChargeItem[]): number {
  const surchargeTotal = charges.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  return (Number(baseRate) || 0) + surchargeTotal;
}

/**
 * Checks if a rate card is expired based on validUntil ISO date string.
 */
export function computeEffectiveStatus(status: RateCardStatus, validUntil: string): RateCardStatus {
  if (status === "Inactive") return "Inactive";
  if (!validUntil) return status;
  try {
    const expiry = new Date(validUntil).getTime();
    const now = Date.now();
    // Allow till end of day
    if (expiry + 86400000 < now) {
      return "Expired";
    }
  } catch {
    // fallback to provided status
  }
  return status || "Active";
}

/**
 * Encodes extra metadata cleanly into the notes string for transparent DB persistence.
 */
export function encodeRateCardNotes(
  userNotes?: string | null,
  metadata?: {
    load_point?: string | null;
    quantity?: number | null;
    additional_charges?: AdditionalChargeItem[] | null;
    etd?: string | null;
    eta?: string | null;
    free_demurrage_days?: number | null;
  },
): string {
  const metaPayload: Record<string, unknown> = {};
  if (metadata?.load_point) metaPayload.load_point = metadata.load_point;
  if (metadata?.quantity) metaPayload.quantity = metadata.quantity;
  if (metadata?.additional_charges && metadata.additional_charges.length > 0) {
    metaPayload.additional_charges = metadata.additional_charges;
  }
  if (metadata?.etd) metaPayload.etd = metadata.etd;
  if (metadata?.eta) metaPayload.eta = metadata.eta;
  if (metadata?.free_demurrage_days) metaPayload.free_demurrage_days = metadata.free_demurrage_days;

  const cleanUserNotes = (userNotes || "").trim();
  if (Object.keys(metaPayload).length === 0) {
    return cleanUserNotes;
  }

  const metaString = `__RC_META__:${JSON.stringify(metaPayload)}`;
  if (!cleanUserNotes) {
    return metaString;
  }
  return `${cleanUserNotes}\n\n${metaString}`;
}

/**
 * Decodes metadata from notes string.
 */
export function decodeRateCardNotes(rawNotes?: string | null): {
  userNotes: string;
  load_point?: string;
  quantity?: number;
  additional_charges?: AdditionalChargeItem[];
  etd?: string;
  eta?: string;
  free_demurrage_days?: number;
} {
  if (!rawNotes) {
    return { userNotes: "" };
  }

  const marker = "__RC_META__:";
  const idx = rawNotes.indexOf(marker);
  if (idx === -1) {
    return { userNotes: rawNotes.trim() };
  }

  const userNotes = rawNotes.substring(0, idx).trim();
  const jsonStr = rawNotes.substring(idx + marker.length).trim();
  try {
    const meta = JSON.parse(jsonStr) as Record<string, unknown>;
    return {
      userNotes,
      load_point: (meta.load_point as string) || undefined,
      quantity: typeof meta.quantity === "number" ? meta.quantity : undefined,
      additional_charges: Array.isArray(meta.additional_charges)
        ? (meta.additional_charges as AdditionalChargeItem[])
        : undefined,
      etd: (meta.etd as string) || undefined,
      eta: (meta.eta as string) || undefined,
      free_demurrage_days:
        typeof meta.free_demurrage_days === "number" ? meta.free_demurrage_days : undefined,
    };
  } catch {
    return { userNotes: rawNotes.trim() };
  }
}

/**
 * Normalizes a raw Supabase rate_cards row into a rich FullRateCardRecord.
 */
export function normalizeRateCardRecord(raw: Record<string, unknown>): FullRateCardRecord {
  const decoded = decodeRateCardNotes(raw.notes as string | null);
  const baseRate = Number(raw.base_rate ?? raw.rate ?? 0);
  const additionalCharges = decoded.additional_charges || [];
  const validUntil =
    (raw.valid_until as string) || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];
  const validFrom =
    (raw.valid_from as string) ||
    (raw.effective_from as string) ||
    new Date().toISOString().split("T")[0];

  const rawStatus = (raw.status as RateCardStatus) || "Active";
  const status = computeEffectiveStatus(rawStatus, validUntil);

  const transitMin = typeof raw.transit_days_min === "number" ? raw.transit_days_min : null;
  const transitMax = typeof raw.transit_days_max === "number" ? raw.transit_days_max : null;
  let transitTimeText: string | null = null;
  if (transitMin && transitMax) {
    transitTimeText = `${transitMin}–${transitMax} days`;
  } else if (transitMin) {
    transitTimeText = `${transitMin} days`;
  } else if (transitMax) {
    transitTimeText = `${transitMax} days`;
  }

  return {
    id: (raw.id as string) || "",
    user_id: (raw.user_id as string) || null,
    forwarder_id: (raw.forwarder_id as string) || "",
    shipping_line_id: (raw.shipping_line_id as string) || null,
    card_name: (raw.card_name as string) || null,
    lane:
      (raw.lane as string) ||
      `${(raw.origin as string) || "POL"} → ${(raw.destination as string) || "POD"}`,
    origin: (raw.origin as string) || (raw.pol_name as string) || (raw.pol_code as string) || "POL",
    destination:
      (raw.destination as string) || (raw.pod_name as string) || (raw.pod_code as string) || "POD",
    load_point: decoded.load_point || null,
    pol_code: (raw.pol_code as string) || null,
    pol_name: (raw.pol_name as string) || null,
    pod_code: (raw.pod_code as string) || null,
    pod_name: (raw.pod_name as string) || null,
    container_type: (raw.container_type as string) || "High Cube",
    container_size: (raw.container_size as string) || "40HC",
    quantity: decoded.quantity || 1,
    base_rate: baseRate,
    rate: baseRate,
    currency: ((raw.currency as string) || "USD").toUpperCase(),
    additional_charges: additionalCharges,
    total_rate_estimate: calculateTotalRate(baseRate, additionalCharges),
    transit_days_min: transitMin,
    transit_days_max: transitMax,
    transit_time: transitTimeText,
    etd: decoded.etd || null,
    eta: decoded.eta || null,
    valid_from: validFrom,
    valid_until: validUntil,
    status,
    notes: decoded.userNotes || (raw.notes as string) || null,
    free_demurrage_days: decoded.free_demurrage_days || 14,
    created_at: (raw.created_at as string) || new Date().toISOString(),
    updated_at: (raw.updated_at as string) || undefined,
    forwarders: (raw.forwarders as FullRateCardRecord["forwarders"]) || null,
    shipping_lines: (raw.shipping_lines as FullRateCardRecord["shipping_lines"]) || null,
  };
}
