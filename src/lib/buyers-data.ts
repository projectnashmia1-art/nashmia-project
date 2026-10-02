import { ContainerSize } from "./booking-data";

export type BuyerStatus = "Active" | "Inactive" | "Archived";

export interface MovementSummaryPreview {
  ref: string;
  polCode: string;
  polName: string;
  podCode: string;
  podName: string;
  containerSummary: string; // e.g. "40HC × 2"
  status: "In Transit" | "Booking Requested" | "Customs Hold" | "Delivered" | "Gate-In";
  etd: string;
  eta: string;
  carrier?: string;
  vessel?: string;
}

export interface BuyerAccountFull {
  id: string;
  name: string;
  company: string;
  country: string;
  countryCode: string;
  contactPerson: string;
  contactRole?: string;
  email: string;
  phone: string;
  activeMovements: number;
  deltaThisMonth: string; // e.g. "+3 this month"
  progressPercent: number; // 0-100 for movement bar
  totalMovements: number;
  deliveredMovements: number;
  inTransitMovements: number;
  status: BuyerStatus;
  code: string;
  taxId?: string;
  address?: string;
  city?: string;
  preferredPort?: string;
  preferredCarrier?: string;
  createdAt: string;
  recentMovement?: MovementSummaryPreview;
}

export interface BuyerMovementRecord {
  id: string;
  ref: string;
  buyerId: string;
  buyerName: string;
  supplierName: string;
  containersCount: number;
  containerSize: ContainerSize;
  polCode: string;
  polName: string;
  podCode: string;
  podName: string;
  carrier: string;
  vessel: string;
  status: "In Transit" | "Booking Requested" | "Customs Hold" | "Delivered" | "Gate-In";
  etd: string;
  eta: string;
  ratePerContainer: number;
  totalFreight: number;
  currency: string;
}

export const INITIAL_BUYERS: BuyerAccountFull[] = [];

export const BUYER_MOVEMENTS: BuyerMovementRecord[] = [];

export const COUNTRY_FILTER_OPTIONS = [
  "All Countries",
  "United Kingdom",
  "Pakistan",
  "Spain",
  "Germany",
  "Italy",
  "France",
  "Sweden",
  "United States",
];

export const SORT_OPTIONS = [
  { label: "Name A–Z", value: "name-asc" },
  { label: "Name Z–A", value: "name-desc" },
  { label: "Most Active Movements", value: "movements-desc" },
  { label: "Recently Added", value: "recent" },
];
