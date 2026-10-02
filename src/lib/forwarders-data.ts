export type ForwarderStatus = "Active" | "Inactive" | "Archived";

export interface ForwarderRateCard {
  id: string;
  lane: string; // e.g. "UK (FXT) → Karachi (KHI)"
  polCode: string;
  polName: string;
  podCode: string;
  podName: string;
  containerSize: "20FT" | "40FT" | "40HC";
  rate: number;
  currency: "USD" | "EUR" | "GBP";
  effectiveFrom: string;
  validUntil: string;
  status: "Active" | "Expiring Soon" | "Draft";
}

export interface ForwarderMovement {
  id: string;
  ref: string;
  buyerName: string;
  route: string;
  polCode: string;
  podCode: string;
  containerSize: "20FT" | "40FT" | "40HC";
  containersCount: number;
  stage: "Booking Requested" | "Confirmed" | "In Transit" | "Customs Hold" | "Delivered";
  etd: string;
  eta: string;
  shippingLine: string;
  vessel: string;
}

export interface ForwarderAccount {
  id: string;
  name: string;
  code: string;
  badge: "Booking Agent" | "Primary Forwarder" | "Regional Agent";
  contactPerson: string;
  contactRole?: string;
  email: string;
  whatsapp: string;
  country: string;
  countryCode: string;
  shippingLines: string[]; // e.g. ["MSC", "Maersk", "CMA CGM"]
  activeBookings: number;
  bookingsThisMonth?: number;
  totalBookings: number;
  notes: string;
  status: ForwarderStatus;
  rateCards: ForwarderRateCard[];
  recentMovements: ForwarderMovement[];
  createdAt: string;
}

export const INITIAL_FORWARDERS: ForwarderAccount[] = [];

export const FORWARDER_SHIPPING_LINES_OPTIONS = [
  "All Shipping Lines",
  "MSC",
  "Maersk",
  "CMA CGM",
  "Hapag-Lloyd",
  "ONE",
  "Evergreen",
  "Cosco Shipping",
];

export const FORWARDER_COUNTRY_OPTIONS = [
  "All Countries",
  "United Kingdom",
  "Pakistan",
  "Spain",
  "France",
  "Germany",
  "Italy",
  "United Arab Emirates",
  "United States",
];

export const FORWARDER_SORT_OPTIONS = [
  { label: "Name (A–Z)", value: "name-asc" },
  { label: "Name (Z–A)", value: "name-desc" },
  { label: "Most Active Bookings", value: "bookings-desc" },
  { label: "Most Rate Cards", value: "rates-desc" },
  { label: "Recently Added", value: "recent" },
];
