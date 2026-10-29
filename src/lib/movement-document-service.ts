import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { safeUuid } from "@/lib/supabase-services";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";

export interface MovementLinkedDocument {
  id: string;
  bookingId: string;
  movementNumber: string;
  documentName: string;
  documentType: string;
  displayType: string;
  fileUrl: string;
  fileSize: number | null;
  fileSizeFormatted: string;
  mimeType: string | null;
  extension: string;
  status: string;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  viewUrl: string;
  downloadUrl: string;
}

export interface BookingDocumentRow {
  id: string;
  booking_id: string;
  document_type: string;
  document_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Format raw bytes into human-readable strings
 */
export function formatDocumentFileSize(bytes: number | null | undefined): string {
  if (bytes == null || isNaN(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Extract clean file extension
 */
export function extractDocExtension(filename: string, mimeType?: string | null): string {
  if (!filename) return "pdf";
  const parts = filename.split(".");
  if (parts.length > 1) {
    return parts.pop()!.toLowerCase().trim();
  }
  if (mimeType?.includes("pdf")) return "pdf";
  if (mimeType?.includes("sheet") || mimeType?.includes("excel")) return "xlsx";
  if (mimeType?.includes("word") || mimeType?.includes("document")) return "docx";
  if (mimeType?.includes("image/png")) return "png";
  if (mimeType?.includes("image/jpeg")) return "jpg";
  return "pdf";
}

/**
 * Format canonical document types into clean display labels
 */
export function resolveDisplayDocType(rawType: string, filename: string): string {
  const norm = (rawType || "").toUpperCase();
  if (norm.includes("BILL_OF_LADING") || norm.includes("BL")) return "Bill of Lading";
  if (norm.includes("BOOKING_CONFIRMATION") || norm.includes("CONFIRMATION"))
    return "Booking Confirmation";
  if (norm.includes("CUT_OFF") || norm.includes("CUTOFF")) return "Cut-Off Notice";
  if (norm.includes("VGM")) return "VGM Certificate";
  if (norm.includes("INVOICE")) return "Commercial Invoice";
  if (norm.includes("CUSTOMS") || norm.includes("DECLARATION")) return "Customs Declaration";
  if (norm.includes("PACKING")) return "Packing List";
  if (norm.includes("SHIPPING_INSTRUCTIONS")) return "Shipping Instructions";

  const lowerName = (filename || "").toLowerCase();
  if (lowerName.includes("bill") || lowerName.includes("b_l") || lowerName.includes("bl_"))
    return "Bill of Lading";
  if (lowerName.includes("confirmation")) return "Booking Confirmation";
  if (lowerName.includes("cutoff") || lowerName.includes("cut-off")) return "Cut-Off Notice";
  if (lowerName.includes("vgm")) return "VGM Certificate";
  if (lowerName.includes("invoice")) return "Commercial Invoice";

  return rawType || "Document";
}

/**
 * Resolve accessible view and download URLs for a document
 */
export function getDocumentActionUrls(doc: {
  file_url: string;
  document_name: string;
  id: string;
}): { viewUrl: string; downloadUrl: string } {
  const url = (doc.file_url || "").trim();

  // If storage path or relative API
  if (url.startsWith("/api/documents/download?path=")) {
    return {
      viewUrl: url,
      downloadUrl: url,
    };
  }

  if (url.startsWith("storage/")) {
    const download = `/api/documents/download?path=${encodeURIComponent(url)}`;
    return {
      viewUrl: download,
      downloadUrl: download,
    };
  }

  // If Supabase public storage URL or data URI or valid external URL
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) {
    return {
      viewUrl: url,
      downloadUrl: url,
    };
  }

  // Fallback: preview/download route via ID
  const fallbackUrl = `/api/documents/download?path=${encodeURIComponent(doc.document_name)}`;
  return {
    viewUrl: url || fallbackUrl,
    downloadUrl: url || fallbackUrl,
  };
}

/**
 * Map raw Supabase booking_documents row to MovementLinkedDocument
 */
export function mapRowToMovementDocument(
  row: BookingDocumentRow,
  movementNumber: string,
): MovementLinkedDocument {
  const ext = extractDocExtension(row.document_name, row.mime_type);
  const displayType = resolveDisplayDocType(row.document_type, row.document_name);
  const { viewUrl, downloadUrl } = getDocumentActionUrls(row);

  return {
    id: row.id,
    bookingId: row.booking_id,
    movementNumber,
    documentName: row.document_name,
    documentType: row.document_type || "OTHER",
    displayType,
    fileUrl: row.file_url,
    fileSize: row.file_size,
    fileSizeFormatted: formatDocumentFileSize(row.file_size),
    mimeType: row.mime_type,
    extension: ext,
    status: row.status || "Verified",
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    viewUrl,
    downloadUrl,
  };
}

/**
 * Strict database fetch for all documents linked to a movement number or booking ID.
 * Respects strict exact matching and organization isolation.
 */
export async function fetchMovementDocuments(params: {
  movementRef?: string | null;
  bookingId?: string | null;
}): Promise<MovementLinkedDocument[]> {
  const { movementRef, bookingId } = params;
  if (!movementRef && !bookingId) return [];

  if (!isSupabaseConfigured) {
    return [];
  }

  try {
    let targetBookingId = safeUuid(bookingId);
    let resolvedMovementNumber = movementRef?.trim() || "";

    // If bookingId not provided as valid UUID, resolve strictly by movement reference
    if (!targetBookingId && resolvedMovementNumber) {
      const cleanRef = resolvedMovementNumber.trim();
      const slashRef = cleanRef.includes("-") ? cleanRef.replace(/-/g, "/") : cleanRef;

      const { data: bookingRows, error: bkErr } = await supabase
        .from("bookings")
        .select("id, movement_number, booking_reference")
        .or(
          `movement_number.eq.${cleanRef},booking_reference.eq.${cleanRef},movement_number.eq.${slashRef},booking_reference.eq.${slashRef}`,
        );

      if (bkErr) {
        console.warn("[fetchMovementDocuments] bookings lookup notice:", bkErr.message);
      } else if (bookingRows && bookingRows.length === 1) {
        targetBookingId = bookingRows[0].id;
        resolvedMovementNumber =
          bookingRows[0].movement_number ||
          bookingRows[0].booking_reference ||
          resolvedMovementNumber;
      } else if (bookingRows && bookingRows.length > 1) {
        // Ambiguous match! Do not guess per strict matching requirements
        console.warn(
          `[fetchMovementDocuments] Ambiguous match: ${bookingRows.length} bookings matched "${cleanRef}". Aborting guessing.`,
        );
        return [];
      }
    }

    if (!targetBookingId) {
      return [];
    }

    // Query Supabase booking_documents strictly by booking_id
    const { data: docRows, error: docErr } = await supabase
      .from("booking_documents")
      .select("*")
      .eq("booking_id", targetBookingId)
      .order("created_at", { ascending: false });

    if (docErr) {
      console.warn("[fetchMovementDocuments] booking_documents error:", docErr.message);
      return [];
    }

    if (!docRows || docRows.length === 0) {
      return [];
    }

    // Map rows and deduplicate by document id / filename
    const seenNames = new Set<string>();
    const documents: MovementLinkedDocument[] = [];

    for (const r of docRows) {
      const nameKey = (r.document_name || "").trim().toLowerCase();
      if (nameKey && seenNames.has(nameKey)) continue;
      if (nameKey) seenNames.add(nameKey);

      documents.push(mapRowToMovementDocument(r as BookingDocumentRow, resolvedMovementNumber));
    }

    return documents;
  } catch (err) {
    console.warn("[fetchMovementDocuments] Unhandled fetch error:", err);
    return [];
  }
}

/**
 * Open document directly in a new browser tab
 */
export function viewDocumentInNewTab(doc: MovementLinkedDocument): void {
  const url = doc.viewUrl || doc.fileUrl;
  if (!url) return;

  // Use window.open with strict security attributes
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    // If popups blocked, fallback to hidden link
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

/**
 * Trigger download for a document
 */
export function downloadDocumentFile(doc: MovementLinkedDocument): void {
  const url = doc.downloadUrl || doc.fileUrl;
  if (!url) return;

  const a = document.createElement("a");
  a.href = url;
  a.download = doc.documentName || "document.pdf";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Custom React hook for fetching and subscribing to documents for a specific movement in real-time
 */
export function useMovementDocuments(movementRef?: string | null, bookingId?: string | null) {
  const [documents, setDocuments] = useState<MovementLinkedDocument[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const resolvedBookingUuid = useMemo(() => safeUuid(bookingId), [bookingId]);

  const loadDocs = useCallback(async () => {
    if (!movementRef && !bookingId) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const docs = await fetchMovementDocuments({ movementRef, bookingId });
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [movementRef, bookingId]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Synchronize immediately on local/global document upload and link events
  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvt = e as CustomEvent<{ movementNumber?: string }>;
      if (!customEvt.detail?.movementNumber || customEvt.detail.movementNumber === movementRef) {
        void loadDocs();
      }
    };
    window.addEventListener("nashmia_document_uploaded", handleSync);
    window.addEventListener("nashmia_document_linked", handleSync);
    return () => {
      window.removeEventListener("nashmia_document_uploaded", handleSync);
      window.removeEventListener("nashmia_document_linked", handleSync);
    };
  }, [loadDocs, movementRef]);

  // Real-time listener for booking_documents table
  useSupabaseRealtime<BookingDocumentRow>({
    table: "booking_documents",
    filter: resolvedBookingUuid ? `booking_id=eq.${resolvedBookingUuid}` : undefined,
    enabled: Boolean(resolvedBookingUuid || movementRef),
    onInsert: () => {
      loadDocs();
    },
    onUpdate: () => {
      loadDocs();
    },
    onDelete: () => {
      loadDocs();
    },
  });

  return {
    documents,
    isLoading,
    error,
    refreshDocuments: loadDocs,
    totalCount: documents.length,
  };
}

/**
 * Link or reassign a document to a movement number or mark as unassigned
 */
export async function linkDocumentToMovement(params: {
  documentId?: string;
  bookingDocumentId?: string;
  movementNumber?: string;
  bookingId?: string;
  documentType?: string;
  isUnassigned?: boolean;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const res = await fetch("/api/documents/link-movement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `HTTP ${res.status}` };
    }
    const data = await res.json();
    // Dispatch global event for instant UI synchronization
    window.dispatchEvent(
      new CustomEvent("nashmia_document_linked", {
        detail: {
          documentId: params.documentId || params.bookingDocumentId,
          movementNumber: params.movementNumber,
        },
      }),
    );
    return { success: true, message: data.message };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}
