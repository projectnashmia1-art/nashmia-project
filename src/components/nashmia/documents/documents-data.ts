export interface DocumentOwner {
  id: string;
  name: string;
  email: string;
  avatarBg: string;
  avatarText: string;
  avatarImage?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
  sharedWith: DocumentOwner[];
  fileCount: number;
  totalSize: string;
  isActive?: boolean;
}

export type FileType = "doc" | "sheet" | "pdf" | "image" | "slides" | "archive";

export interface CutOffDeadlineItem {
  type: string;
  dateTime: string | null;
  normalizedDate?: string | null;
  originalExtractedText?: string;
  rawText?: string;
  time?: string | null;
  isAmbiguous?: boolean;
  requiresManualReview?: boolean;
  reviewReason?: string | null;
}

export interface DriveFileMetadata {
  category?:
    | "Cut-Off Notice"
    | "Bill of Lading"
    | "Booking Confirmation"
    | "Shipping Instructions"
    | "Invoices & Receipts"
    | "Customs & Clearance"
    | "General"
    | "Other"
    | string;
  documentType?:
    | "BILL_OF_LADING"
    | "CUT_OFF_NOTICE"
    | "BOOKING_CONFIRMATION"
    | "COMMERCIAL_INVOICE"
    | "PACKING_LIST"
    | "CERTIFICATE_OF_ORIGIN"
    | "SHIPPING_INSTRUCTION"
    | "NEEDS_REVIEW"
    | "GENERAL"
    | "OTHER"
    | string;
  originalFilename?: string | null;
  fileName?: string | null;
  bookingId?: string | null;
  movementNumber?: string | null;
  movementReferenceNumber?: string | null;
  movementId?: string | null;
  forwarderId?: string | null;
  forwarderName?: string | null;
  forwarder?: string | null;
  senderEmail?: string | null;
  sourceEmail?: string | null;
  emailMessageId?: string | null;
  gmailMessageId?: string | null;
  fileFormat?: string;
  isMetadataOnly?: boolean;
  displayDocumentType?:
    | "Cut-Off"
    | "BL"
    | "Booking Confirmation"
    | "Shipping Instructions"
    | "Invoice"
    | "Packing List"
    | "Other"
    | string;
  source?: string;
  uploadStatus?: string | null;
  savedAt?: string;
  storageBucket?: string | null;
  storagePath?: string | null;
  classificationSource?: string;
  classificationReason?: string;
  cutOffDeadlines?: CutOffDeadlineItem[];
  hasCutOffDate?: boolean;
  detectedCutOffDate?: string | null;
  cutOffDates?: {
    portCutoff?: string | null;
    siCutoff?: string | null;
    vgmCutoff?: string | null;
    gateCutoff?: string | null;
    terminalCutoff?: string | null;
    docCutoff?: string | null;
    cargoCutoff?: string | null;
    cyCutoff?: string | null;
    closingDate?: string | null;
    deadlines?: CutOffDeadlineItem[];
  };
  blNumber?: string;
  fileUrl?: string | null;
  thumbnail?: string | null;
  thumbnailUrl?: string | null;
  // Shipping table display metadata
  vesselName?: string | null;
  forwarderEmail?: string | null;
  forwarderAvatarText?: string | null;
  typeTag?: "Cut-Off" | "Bill of Lading" | "Invoice" | "Packing List" | "Other" | string | null;
  fileSize?: string | null;
  receivedDate?: string | null;
  receivedTime?: string | null;
  status?:
    | "Processed"
    | "Pending"
    | "Needs Review"
    | "Saved to Supabase Storage"
    | "Metadata Saved"
    | string
    | null;
  uploadStatus?: "Saved to Supabase Storage" | "Metadata Saved" | "Needs Review" | string | null;
  sourceEmail?: string | null;
  storageBucket?: string | null;
  storagePath?: string | null;
  organizationId?: string | null;
  // NEEDS_REVIEW tracking fields
  reviewStatus?: "NEEDS_REVIEW" | "CONFIRMED" | "REVIEWED";
  needsReview?: boolean;
  reviewReason?: string;
  unconfidentFields?: Array<"movement" | "document_type" | "cutoff_date">;
  extractedTextSnippet?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  type: FileType;
  extension: string;
  owners: DocumentOwner[];
  lastModified: string;
  lastModifiedTimestamp: string;
  fileSize: string;
  folderId?: string;
  starred?: boolean;
  sharedLink?: string;
  url?: string;
  metadata?: DriveFileMetadata;
}

export const INITIAL_OWNERS: Record<string, DocumentOwner> = {};

export const INITIAL_FOLDERS: DriveFolder[] = [
  {
    id: "folder-design",
    name: "Shipment Notices",
    fileCount: 0,
    totalSize: "0 KB",
    sharedWith: [],
    isActive: true,
  },
  {
    id: "folder-dev",
    name: "Customs & Clearance",
    fileCount: 0,
    totalSize: "0 KB",
    sharedWith: [],
    isActive: false,
  },
  {
    id: "folder-marketing",
    name: "Bills of Lading",
    fileCount: 0,
    totalSize: "0 KB",
    sharedWith: [],
    isActive: false,
  },
  {
    id: "folder-finance",
    name: "Invoices & Receipts",
    fileCount: 0,
    totalSize: "0 KB",
    sharedWith: [],
    isActive: false,
  },
];

export const INITIAL_FEATURED_DOC: DriveFile | null = null;

export const INITIAL_FILES: DriveFile[] = [];

export const DOCUMENTS_STORAGE_KEY = "nashmia_saved_documents_v2";

/**
 * Retrieves all saved documents from client storage.
 * Safe for SSR.
 */
export function getSavedDocuments(): DriveFile[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: DriveFile[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const merged: DriveFile[] = [];
    const seenIds = new Set<string>();

    for (const file of parsed) {
      if (!seenIds.has(file.id)) {
        merged.push(file);
        seenIds.add(file.id);
      }
    }

    return merged;
  } catch {
    return [];
  }
}

/**
 * Saves or updates a DriveFile in client storage and notifies any active listeners.
 */
export function saveDriveDocument(file: DriveFile): DriveFile[] {
  if (typeof window === "undefined") return [file];
  try {
    const current = getSavedDocuments();
    const filtered = current.filter((f) => f.id !== file.id);
    const updated = [file, ...filtered];
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("nashmia:document-saved", { detail: file }));
    return updated;
  } catch (err) {
    console.warn("Failed to save document to localStorage:", err);
    return [file];
  }
}

/**
 * Removes a DriveFile from client storage by ID.
 */
export function removeDriveDocument(fileId: string): DriveFile[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getSavedDocuments();
    const updated = current.filter((f) => f.id !== fileId);
    localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("nashmia:document-deleted", { detail: { id: fileId } }));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Manually links and updates a NEEDS_REVIEW document to a verified Movement and Document Type.
 */
export function linkAndReviewDriveDocument(
  fileId: string,
  updates: {
    movementNumber: string;
    documentType: string;
    category?: string;
    bookingId?: string | null;
    cutOffDates?: DriveFileMetadata["cutOffDates"];
    cutOffDeadlines?: CutOffDeadlineItem[];
    reviewerName?: string;
    folderId?: string;
  },
): DriveFile | null {
  const current = getSavedDocuments();
  const target = current.find((f) => f.id === fileId);
  if (!target) return null;

  const nowIso = new Date().toISOString();
  const updatedMetadata: DriveFileMetadata = {
    ...target.metadata,
    reviewStatus: "CONFIRMED",
    needsReview: false,
    movementNumber: updates.movementNumber,
    bookingId: updates.bookingId || target.metadata?.bookingId || null,
    documentType: updates.documentType,
    category:
      updates.category ||
      (updates.documentType === "CUT_OFF_NOTICE"
        ? "Cut-Off Notice"
        : updates.documentType === "BILL_OF_LADING"
          ? "Bill of Lading"
          : "General"),
    cutOffDates: updates.cutOffDates || target.metadata?.cutOffDates,
    cutOffDeadlines: updates.cutOffDeadlines || target.metadata?.cutOffDeadlines,
    reviewedBy: updates.reviewerName || "Authorized Operator",
    reviewedAt: nowIso,
  };

  const updatedFile: DriveFile = {
    ...target,
    folderId: updates.folderId || target.folderId || "folder-design",
    metadata: updatedMetadata,
  };

  saveDriveDocument(updatedFile);
  return updatedFile;
}
