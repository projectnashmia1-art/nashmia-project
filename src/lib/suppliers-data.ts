export type SupplierStatus = "Active" | "Inactive" | "Archived";

export interface SupplierAccountFull {
  id: string;
  name: string;
  subtitle?: string;
  companyName?: string;
  country: string;
  countryCode: string;
  loadPoint: string;
  loadPointCity?: string;
  loadPointType:
    | "Warehouse"
    | "Distribution Center"
    | "Factory Hub"
    | "Port Depot"
    | "CFS Terminal"
    | "Cold Hub";
  contactPerson: string;
  contactRole?: string;
  email: string;
  phone: string;
  activeContainers: number;
  containersDelta?: string; // e.g. "+3 this month"
  totalContainersMoved: number;
  status: SupplierStatus;
  code: string;
  taxId?: string;
  address: string;
  city: string;
  operatingHours?: string;
  pickupInstructions?: string;
  recentMovement?: {
    ref: string;
    route: string;
    status: "In Transit" | "Booking Requested" | "Customs Hold" | "Delivered" | "Gate-In";
  };
  createdAt: string;
}

export interface SupplierMovementRecord {
  id: string;
  ref: string;
  supplierId: string;
  supplierName: string;
  loadPoint: string;
  buyerName: string;
  containersCount: number;
  containerSize: "20FT" | "40FT" | "40HC";
  polCode: string;
  polName: string;
  podCode: string;
  podName: string;
  carrier: string;
  vessel: string;
  status: "In Transit" | "Booking Requested" | "Customs Hold" | "Delivered" | "Gate-In";
  etd: string;
  eta: string;
}

export const INITIAL_SUPPLIERS: SupplierAccountFull[] = [];

export const SUPPLIER_MOVEMENTS: SupplierMovementRecord[] = [];

export const SUPPLIER_COUNTRY_OPTIONS = [
  "All Countries",
  "United Kingdom",
  "Spain",
  "France",
  "Germany",
  "Italy",
  "Netherlands",
  "Sweden",
  "Pakistan",
  "United States",
];

export const LOAD_POINT_TYPE_OPTIONS = [
  { label: "All Facility Types", value: "all" },
  { label: "Warehouse", value: "Warehouse" },
  { label: "Distribution Center", value: "Distribution Center" },
  { label: "Factory Hub", value: "Factory Hub" },
  { label: "Port Depot", value: "Port Depot" },
  { label: "CFS Terminal", value: "CFS Terminal" },
  { label: "Cold Hub", value: "Cold Hub" },
];

export const SUPPLIER_SORT_OPTIONS = [
  { label: "Name (A–Z)", value: "name-asc" },
  { label: "Name (Z–A)", value: "name-desc" },
  { label: "Most Active Containers", value: "containers-desc" },
  { label: "Recently Added", value: "recent" },
];
