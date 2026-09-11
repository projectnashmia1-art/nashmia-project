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
  status: RequestStatus | "All" | "Forwarder Offers";
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

export type ForwarderQuoteStatus =
  | "REQUESTED"
  | "AWAITING_OFFER"
  | "OFFER_RECEIVED"
  | "AVAILABLE"
  | "NOT_AVAILABLE"
  | "DECLINED"
  | "NEEDS_REVIEW"
  | "CONFIRMED"
  | "ACCEPTED"
  | "AWARDED"
  | "NOT_AWARDED"
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
  notes?: string;
  receivedAt?: string;
  sourceEmailId?: string;
  receivedVia?: "Gmail Automatic Sync" | "Manual Entry" | "Email Reply" | string;
  extractionSummary?: string;
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
