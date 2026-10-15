import type { Database } from "@/types/database.types";

export type EmailStatus = "DRAFT" | "PENDING" | "SENDING" | "SENT" | "FAILED" | "CANCELLED";

export type EmailType =
  "BOOKING_REQUEST" | "BOOKING_CONFIRMATION" | "BOOKING_UPDATE" | "GENERAL" | "SYSTEM";

export type EmailFolderId =
  "inbox" | "sent" | "drafts" | "pending" | "failed" | "all" | "booking" | "system";

export interface EmailAttachment {
  name: string;
  filename?: string;
  size: string;
  url?: string;
  type?: string;
  mimeType?: string;
  attachmentId?: string;
  gmailMessageId?: string;
  data?: string;
}

export interface EmailTimelineEvent {
  id: string;
  timestamp: string;
  title: string;
  description?: string;
  status?: EmailStatus;
  type: "created" | "queued" | "sending" | "sent" | "failed" | "gmail_id_received";
}

export type EmailRecord = EmailMessageRecord;

export interface EmailMessageRecord {
  threadId: string;
  userId?: string;
  organizationId?: string;
  bookingId?: string | null;
  movementId?: string | null;
  movementNumber?: string | null;
  forwarderId?: string | null;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  cc?: string | null;
  bcc?: string | null;
  subject: string;
  body: string;
  bodyHtml?: string | null;
  snippet?: string;
  emailType: EmailType;
  status: EmailStatus;
  direction: "inbound" | "outbound";
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  errorMessage?: string | null;
  attachments?: EmailAttachment[];
  createdAt: string;
  updatedAt: string;
  sentAt?: string | null;
  receivedAt?: string | null;

  // Matching Engine fields (Step 3)
  matchStatus?: "MATCHED" | "NEEDS_REVIEW" | "UNMATCHED" | "PENDING" | null;
  matchReason?: string | null;
  matchedBy?: "THREAD_ID" | "MOVEMENT_NUMBER" | "MANUAL" | "NONE" | null;
  matchedAt?: string | null;
  matchDetails?: Record<string, unknown> | null;

  // Confirmation Detection fields (Step 4)
  confirmationStatus?: "CONFIRMED" | "NOT_CONFIRMED" | "NEEDS_REVIEW" | "REJECTED" | null;
  confirmationConfidence?: number | null;
  confirmationReason?: string | null;
  confirmationDetectedBy?: "DETERMINISTIC" | "AI" | "RULE_FALLBACK" | null;
  confirmationDetectedAt?: string | null;
  confirmationDetails?: Record<string, unknown> | null;

  // Joined / Associated contextual metadata
  bookingReference?: string | null;
  bookingOrigin?: string | null;
  bookingDestination?: string | null;
  buyerName?: string | null;
  supplierName?: string | null;
  forwarderName?: string | null;
  forwarderCode?: string | null;
  containerSize?: string | null;
  containerCount?: number | null;
  vesselName?: string | null;
}

export interface EmailThreadRecord {
  id: string;
  userId?: string;
  bookingId?: string | null;
  movementId?: string | null;
  movementNumber?: string | null;
  subject: string;
  status: EmailStatus;
  gmailThreadId?: string | null;
  snippet?: string | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages: EmailMessageRecord[];

  // Joined booking data
  bookingReference?: string | null;
  forwarderName?: string | null;
}

export interface EmailFolderCount {
  inbox: number;
  sent: number;
  drafts: number;
  pending: number;
  failed: number;
  all: number;
  booking: number;
  system: number;
}

export interface EmailStatistics {
  total: number;
  inbox: number;
  sent: number;
  drafts: number;
  pending: number;
  failed: number;
}

export interface ComposeEmailFormValues {
  fromEmail: string;
  toEmail: string;
  toName?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  bookingId?: string | null;
  movementId?: string | null;
  movementNumber?: string | null;
  forwarderId?: string | null;
  emailType: EmailType;
  attachments?: EmailAttachment[];
}
