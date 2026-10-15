import type { ContainerSize } from "@/lib/booking-data";

export type RequestStatus =
  | "Pending Review"
  | "Rate Verification"
  | "Line Allocation"
  | "Approved"
  | "Revision Requested"
  | "Declined";

export type RequestPriority = "Urgent" | "High" | "Normal" | "Flexible";

export interface BookingRequestCargo {
  description: string;
  hsCode?: string;
  totalWeightKg: number;
  totalVolumeCbm?: number;
  packagesCount?: number;
  packageType?: string;
  temperatureRequired?: string;
  hazardous?: boolean;
  unNumber?: string;
}

export interface BookingRequestRecord {
  id: string;
  reference: string;
  movementNumber?: string;
  movementId?: string;
  bookingReference?: string;
  createdAt: string;
  updatedAt: string;
  status: RequestStatus;
  priority: RequestPriority;

  // Forwarder Confirmation details
  confirmationStatus?: "CONFIRMED" | "REJECTED" | "NEEDS_REVIEW" | "PENDING";
  confirmedAt?: string;
  confirmedBy?: string;
  confirmationEmailId?: string;
  confirmationReason?: string;
  confirmationDetectedBy?: string;
  confirmationConfidence?: number;

  // Parties
  buyerId?: string;
  buyerName: string;
  buyerCode: string;
  buyerCountry: string;
  consignee: string;

  supplierId?: string;
  supplierName: string;
  supplierCode: string;
  supplierCity: string;
  supplierLoadPoint: string;

  forwarderId?: string;
  forwarderName: string;
  forwarderCode?: string;
  forwarderEmail?: string;

  // Routing
  polCode: string;
  polName: string;
  podCode: string;
  podName: string;
  requestedEtd: string;
  estimatedEta?: string;

  // Equipment
  containerSize: ContainerSize;
  containerType: string;
  containerCount: number;
  allocatedContainers?: string[];

  // Carrier & Vessel
  preferredCarrier: string;
  assignedCarrier?: string;
  vesselName?: string;
  voyageNumber?: string;

  // Commercials
  ratePerContainer: number;
  totalFreight: number;
  currency: string;
  rateCardId?: string;
  rateValidUntil?: string;

  // Cargo specs
  cargo: BookingRequestCargo;

  // Operational Timings & Cut-offs
  siCutoff?: string;
  vgmCutoff?: string;
  gateCutoff?: string;

  // Notes & Revisions
  specialInstructions?: string;
  revisionNotes?: string;
  declineReason?: string;
  requestedBy: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface RequestsFilterState {
  search: string;
  status: RequestStatus | "All";
  priority: RequestPriority | "All";
  pol: string;
  pod: string;
  carrier: string;
  dateRange: "all" | "today" | "this-week" | "this-month";
  sortBy: "date-desc" | "date-asc" | "priority-desc" | "rate-desc" | "buyer-asc";
  viewMode: "grid" | "table" | "kanban";
}

export interface RequestsStatsSummary {
  total: number;
  pendingReview: number;
  rateVerification: number;
  lineAllocation: number;
  approved: number;
  revisionRequested: number;
  urgentCutoffs: number;
  totalCargoTons: number;
  totalValueUsd: number;
  avgTurnaroundHours: string;
}

export type ForwarderResponseClassification =
  "OFFER_RECEIVED" | "AVAILABLE" | "NOT_AVAILABLE" | "DECLINED" | "NEEDS_REVIEW" | "CONFIRMED";

/**
 * Deterministic statuses mandated for rule-based quotation processing (Strictly NO AI confidence scores)
 */
export type DeterministicQuotationStatus =
  | "confirmed"
  | "amount_missing"
  | "currency_missing"
  | "range"
  | "ambiguous"
  | "conflict"
  | "unreadable"
  | "unmatched"
  | "needs_review";

export type CanonicalQuotationStatus =
  | "PENDING"
  | "OFFER_RECEIVED"
  | "NEEDS_REVIEW"
  | "NOT_AVAILABLE"
  | "AWARDED"
  | "NOT_AWARDED"
  | "CONFIRMED";

export const ALL_QUOTATION_STATUSES: CanonicalQuotationStatus[] = [
  "PENDING",
  "OFFER_RECEIVED",
  "NEEDS_REVIEW",
  "NOT_AVAILABLE",
  "AWARDED",
  "NOT_AWARDED",
  "CONFIRMED",
];

export function normalizeQuoteStatus(status?: string | null): CanonicalQuotationStatus {
  if (!status) return "PENDING";
  const s = status.trim().toUpperCase().replace(/\s+/g, "_");
  if (s === "OFFER_RECEIVED" || s === "QUOTE_RECEIVED" || s === "OFFER" || s === "QUOTED") {
    return "OFFER_RECEIVED";
  }
  if (s === "NEEDS_REVIEW" || s === "REVIEW_NEEDED" || s === "RESPONDED") {
    return "NEEDS_REVIEW";
  }
  if (
    s === "NOT_AVAILABLE" ||
    s === "UNAVAILABLE" ||
    s === "DECLINED" ||
    s === "NO_RESPONSE" ||
    s === "REJECTED_BY_FORWARDER"
  ) {
    return "NOT_AVAILABLE";
  }
  if (s === "AWARDED" || s === "ACCEPTED") {
    return "AWARDED";
  }
  if (s === "NOT_AWARDED" || s === "LOST" || s === "REJECTED") {
    return "NOT_AWARDED";
  }
  if (s === "CONFIRMED" || s === "BOOKING_CONFIRMED") {
    return "CONFIRMED";
  }
  if (
    s === "PENDING" ||
    s === "SENT" ||
    s === "DELIVERED" ||
    s === "REQUESTED" ||
    s === "AWAITING_OFFER" ||
    s === "AWAITING_QUOTE"
  ) {
    return "PENDING";
  }
  return "PENDING";
}

export type ForwarderQuoteStatus =
  | CanonicalQuotationStatus
  | "SENT"
  | "DELIVERED"
  | "REQUESTED"
  | "AWAITING_OFFER"
  | "AVAILABLE"
  | "PENDING_CONFIRMATION"
  | "DECLINED"
  | "NO_RESPONSE"
  | "ACCEPTED"
  | "RESPONDED"
  | "EXPIRED";

export interface ForwarderOfferData {
  ratePerContainer?: number;
  totalFreight?: number;
  currency?: string;
  containerType?: string;
  quantity?: number;
  availability?: string;
  responseClassification?: ForwarderResponseClassification;
  etd?: string;
  eta?: string;
  transitDays?: number;
  freeDays?: number;
  carrier?: string;
  vesselName?: string;
  voyageNumber?: string;
  validUntil?: string;
  additionalCharges?: number | string;
  totalCost?: number;
  notes?: string;
  receivedAt?: string;
  sourceEmailId?: string;
  originalEmailBody?: string;
  originalEmailSubject?: string;
  receivedVia?: "Gmail Automatic Sync" | "Manual Entry" | "Email Reply" | string;
  extractionSummary?: string;
  manuallyCorrected?: boolean;
  correctedAt?: string;
  correctedBy?: string;

  // 16 Standard Quotation Processing Fields
  oceanFreight?: number;
  originCharges?: number;
  destinationCharges?: number;
  thc?: number;
  documentationCharges?: number;
  customsCharges?: number;
  truckingCharges?: number;
  otherCharges?: number;
  totalAmount?: number;
  sailingDate?: string;
  validityDate?: string;
  routing?: string;

  // Traceability & rule-based engine metadata
  traceability?: Record<string, unknown>;
  reviewReasons?: string[];
  deterministicStatus?: DeterministicQuotationStatus;
  deterministicStatuses?: DeterministicQuotationStatus[];
  confidenceScore?: number;
  hasConflicts?: boolean;
  needsReview?: boolean;
  unverifiedSender?: boolean;
  containerRates?: Record<string, number>;
}

export interface ForwarderQuoteRequestRecord {
  id: string;
  bookingId: string;
  bookingReference: string;
  movementNumber: string;
  forwarderId: string;
  forwarderName: string;
  forwarderCode?: string;
  forwarderEmail: string;
  forwarderContactPerson?: string;
  forwarderBadge?: string;
  status: ForwarderQuoteStatus;
  awardStatus?: "AWARDED" | "NOT_AWARDED" | "PENDING";
  emailMessageId?: string;
  gmailThreadId?: string;
  gmailMessageId?: string;
  trackingCompositeKey?: string; // Connected to Booking ID + Forwarder ID + Gmail Thread ID + Gmail Message ID
  sentAt: string;
  sentBy?: string;
  requiredSailingDate?: string;
  etd?: string;
  eta?: string;
  origin: string;
  destination: string;
  polCode: string;
  polName: string;
  podCode: string;
  podName: string;
  supplierName: string;
  supplierLoadPoint?: string;
  buyerName: string;
  consignee?: string;
  containerType: string;
  containerSize: ContainerSize;
  containerCount: number;
  cargoDescription?: string;
  cargoWeightKg?: number;
  specialInstructions?: string;
  offerData?: ForwarderOfferData;
  updatedAt: string;
}
