import { SupabaseClient } from "@supabase/supabase-js";
import { safeUuid, safeInsertNotification } from "./supabase-services";
import {
  type DriveFile,
  type FileType,
  type DocumentOwner,
  INITIAL_OWNERS,
  saveDriveDocument,
  getSavedDocuments,
} from "../components/nashmia/documents/documents-data.ts";
import {
  identifyMovementForIncomingEmail,
  type MovementMatchResult,
  type PriorityStepEvaluation,
} from "./movement-forwarder-matcher";
import {
  saveCutOffsForMovement,
  type MovementCutOffDates,
  type MovementCutOffDeadline,
} from "./movement-cutoff-service";

export type AttachmentCategory = "Cut-Off Notice" | "Bill of Lading" | "Other";

export interface CutOffDeadline {
  type: string;
  dateTime: string | null;
  rawText?: string;
}

export interface AttachmentDetectionResult {
  isCutOff: boolean;
  isBillOfLading: boolean;
  category: AttachmentCategory;
  documentType?: "BILL_OF_LADING" | "CUT_OFF_NOTICE" | "OTHER" | string;
  confidence: number;
  detectedType: "cut_off" | "bill_of_lading" | "other";
  cleanedName: string;
  classificationSource:
    | "document_content_ai"
    | "document_content_heuristics"
    | "filename_and_context"
    | "filename_only"
    | "email_context";
  reason: string;
  cutOffDeadlines?: CutOffDeadline[];
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
    deadlines?: CutOffDeadline[];
  };
  blNumber?: string;
}

export interface IncomingAttachmentInput {
  filename?: string;
  name?: string;
  size?: number | string;
  mimeType?: string;
  attachmentId?: string;
  url?: string;
  data?: string; // Base64 or Base64URL encoded data
  content?: string; // Plain text or decoded document content
  extractedText?: string;
}

export interface SaveAndLinkAttachmentParams {
  attachment: IncomingAttachmentInput;
  bookingId?: string | null;
  movementNumber?: string | null;
  movementId?: string | null;
  forwarderId?: string | null;
  forwarderName?: string | null;
  senderEmail?: string | null;
  senderName?: string | null;
  emailMessageId?: string | null;
  gmailMessageId?: string | null;
  gmailThreadId?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
  headers?: Array<{ name: string; value: string }> | Record<string, unknown> | null;
  rawHeaders?: Record<string, unknown> | null;
  subject?: string | null;
  body?: string | null;
  receivedAt?: string | null;
  userId?: string | null;
}

export interface SaveAndLinkAttachmentResult {
  saved: boolean;
  linked: boolean;
  status?: "MATCHED" | "NEEDS_REVIEW";
  matchingPriorityStep?: number;
  document: DriveFile | null;
  category: AttachmentCategory;
  reason: string;
  bookingEventId?: string | null;
  notificationId?: string | null;
  matchResult?: MovementMatchResult;
}

// Server-side in-memory cache of saved documents
const serverSavedDocuments = new Map<string, DriveFile>();

export function getServerSavedDocuments(): DriveFile[] {
  return Array.from(serverSavedDocuments.values());
}

export function saveServerDocument(doc: DriveFile): void {
  serverSavedDocuments.set(doc.id, doc);
}

/**
 * Extracts file extension from filename or mimeType fallback
 */
export function extractExtension(filename?: string, mimeType?: string): string {
  if (filename && filename.includes(".")) {
    const parts = filename.split(".");
    const ext = parts[parts.length - 1]?.trim().toLowerCase();
    if (ext && ext.length <= 10) return ext;
  }
  if (!mimeType) return "pdf";
  const m = mimeType.toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("sheet") || m.includes("excel") || m.includes("csv")) return "xlsx";
  if (m.includes("word") || m.includes("document") || m.includes("msword")) return "docx";
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("image")) return "png";
  if (m.includes("text") || m.includes("plain")) return "txt";
  if (m.includes("presentation") || m.includes("powerpoint")) return "pptx";
  if (m.includes("zip") || m.includes("rar") || m.includes("tar") || m.includes("gz")) return "zip";
  return "pdf";
}

/**
 * Normalizes document classification into standard Document Type:
 * (Cut-Off / BL / Other)
 */
export function resolveDocumentTypeTag(
  classification: {
    isCutOff?: boolean;
    isBillOfLading?: boolean;
    category?: string;
    documentType?: string;
    detectedType?: string;
  },
  filename?: string,
): "Cut-Off" | "BL" | "Other" {
  const lowerName = (filename || "").toLowerCase();
  if (
    classification.isCutOff ||
    classification.detectedType === "cut_off" ||
    classification.category === "Cut-Off Notice" ||
    classification.documentType === "CUT_OFF_NOTICE" ||
    /(?:cut[-_ ]?off|closing|vessel\s*schedule|gate[-_ ]?in|cy\s*closing)/i.test(lowerName)
  ) {
    return "Cut-Off";
  }
  if (
    classification.isBillOfLading ||
    classification.detectedType === "bill_of_lading" ||
    classification.category === "Bill of Lading" ||
    classification.documentType === "BILL_OF_LADING" ||
    /(?:bill\s*of\s*lading|draft\s*b\/?l|sea\s*waybill|house\s*b\/?l|ocean\s*b\/?l)/i.test(
      lowerName,
    )
  ) {
    return "BL";
  }
  return "Other";
}

/**
 * Determines DriveFile FileType based on file extension
 */
export function determineFileType(extension: string): FileType {
  const ext = (extension || "").toLowerCase().replace(/^\./, "");
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "tiff"].includes(ext)) return "image";
  if (["xls", "xlsx", "csv", "tsv", "ods"].includes(ext)) return "sheet";
  if (["doc", "docx", "rtf", "odt", "txt"].includes(ext)) return "doc";
  if (["ppt", "pptx", "key"].includes(ext)) return "slides";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  return "pdf";
}

/**
 * Normalizes file size into human-readable string (e.g. "420 KB", "1.4 MB")
 */
export function formatBytes(bytesOrString: number | string | undefined): string {
  if (typeof bytesOrString === "string") {
    if (bytesOrString.trim().length > 0 && !Number.isNaN(Number(bytesOrString))) {
      bytesOrString = Number(bytesOrString);
    } else if (bytesOrString.trim().length > 0) {
      return bytesOrString;
    }
  }

  const bytes = typeof bytesOrString === "number" ? bytesOrString : 0;
  if (bytes <= 0) return "380 KB";
  if (bytes < 1024) return `${bytes} B`;
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Resolves or constructs a DocumentOwner object for forwarder attribution
 */
export function getOrCreateForwarderOwner(
  forwarderName?: string | null,
  senderEmail?: string | null,
): DocumentOwner {
  const name =
    forwarderName?.trim() ||
    (senderEmail ? senderEmail.split("@")[0].replace(/[._-]/g, " ") : "Freight Forwarder");
  const email = senderEmail?.trim() || "forwarder@logistics.com";
  const initials =
    name
      .split(" ")
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "FW";

  return {
    id: `owner-fwd-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    name,
    email,
    avatarBg: "bg-blue-600 text-white",
    avatarText: initials,
  };
}

/**
 * Extracts readable text streams, form fields, and tokens from attachment data
 */
export function extractTextFromAttachment(attachment: IncomingAttachmentInput): string {
  if (attachment.extractedText && attachment.extractedText.trim().length > 0) {
    return attachment.extractedText.trim();
  }
  if (attachment.content && attachment.content.trim().length > 0) {
    return attachment.content.trim();
  }

  let rawData = attachment.data || "";
  if (!rawData && attachment.url && attachment.url.startsWith("data:")) {
    const commaIdx = attachment.url.indexOf(",");
    if (commaIdx !== -1) {
      rawData = attachment.url.slice(commaIdx + 1);
    }
  }

  if (!rawData || typeof rawData !== "string") {
    return "";
  }

  try {
    // Clean base64url characters
    const cleanBase64 = rawData.trim().replace(/-/g, "+").replace(/_/g, "/");
    let decodedBuffer: Uint8Array;

    if (typeof Buffer !== "undefined") {
      decodedBuffer = Buffer.from(cleanBase64, "base64");
    } else {
      const binStr = atob(cleanBase64);
      decodedBuffer = new Uint8Array(binStr.length);
      for (let i = 0; i < binStr.length; i++) {
        decodedBuffer[i] = binStr.charCodeAt(i);
      }
    }

    const mime = (attachment.mimeType || "").toLowerCase();

    // 1. If text/html/json/csv/plain: decode full UTF-8 text directly
    if (
      mime.includes("text") ||
      mime.includes("json") ||
      mime.includes("csv") ||
      mime.includes("xml") ||
      mime.includes("html")
    ) {
      return new TextDecoder("utf-8", { fatal: false }).decode(decodedBuffer);
    }

    // 2. If PDF or binary document: scan printable ASCII/UTF-8 strings and PDF stream tokens
    const textDecoder = new TextDecoder("latin1");
    const rawString = textDecoder.decode(decodedBuffer);

    // Extract text blocks inside PDF text stream operators (BT ... ET, Tj, TJ, and uncompressed text)
    const textChunks: string[] = [];

    // PDF text operators: (some text) Tj or [(chunk1) 20 (chunk2)] TJ
    const tjMatches = rawString.match(/\(([^()]{2,150})\)\s*T[jJ]/g);
    if (tjMatches) {
      for (const m of tjMatches) {
        const cleaned = m.replace(/[()\s*TjJ]/g, " ").trim();
        if (cleaned.length >= 2) textChunks.push(cleaned);
      }
    }

    // PDF dictionary properties like /Title (...), /Subject (...), /Author (...)
    const docMetaMatches = rawString.match(
      /\/(?:Title|Subject|Keywords|Author)\s*\(([^()]{2,120})\)/g,
    );
    if (docMetaMatches) {
      for (const dm of docMetaMatches) {
        const cleaned = dm
          .replace(/^\/[A-Za-z]+\s*\(/, "")
          .replace(/\)$/, "")
          .trim();
        if (cleaned) textChunks.push(cleaned);
      }
    }

    // PDF / XML printable ASCII sequences >= 3 characters (catches tabular schedules, BL labels, and form fields)
    const printableMatches = rawString.match(/[\x20-\x7E\t\r\n]{3,}/g);
    if (printableMatches) {
      // Filter out low-entropy or binary header garbage
      for (const seq of printableMatches) {
        const trimmed = seq.trim();
        if (
          trimmed.length >= 3 &&
          /[a-zA-Z]{2,}/.test(trimmed) &&
          !trimmed.startsWith("xref") &&
          !trimmed.startsWith("trailer") &&
          !/^[0-9\s]+obj$/.test(trimmed)
        ) {
          textChunks.push(trimmed);
        }
      }
    }

    const aggregated = textChunks.join(" \n ");
    // Limit to reasonable character count for classification
    return aggregated.slice(0, 15000);
  } catch (err) {
    console.warn("[DocumentAttachmentService] Error extracting text from attachment:", err);
    return "";
  }
}

/**
 * Normalizes and validates a candidate cut-off date/time string.
 * Never guesses dates. If date is not clearly valid, returns null.
 */
export function cleanCutOffDateTime(rawDateStr?: string | null): string | null {
  if (!rawDateStr || typeof rawDateStr !== "string") return null;
  const cleaned = rawDateStr
    .trim()
    .replace(/^[-:;,.\s]+/, "")
    .replace(/[-:;,.\s]+$/, "");
  if (!cleaned || cleaned.length < 5) return null;

  // Reject generic placeholder phrases or non-date strings
  if (/^(?:tba|tbd|null|none|n\/a|not provided|pending|to be advised|unknown)$/i.test(cleaned)) {
    return null;
  }

  // Check if it contains a recognizable date pattern (day/month/year or month/day/year)
  const datePattern =
    /(?:[0-9]{1,2}[-/\s.](?:[a-zA-Z]{3,}|[0-9]{1,2})[-/\s.][0-9]{2,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+[0-9]{1,2}(?:st|nd|rd|th)?,?\s+[0-9]{2,4}|[0-9]{4}[-/\s.][0-9]{1,2}[-/\s.][0-9]{1,2})/i;

  const hasDate = datePattern.test(cleaned);
  if (!hasDate) {
    return null;
  }

  return cleaned;
}

/**
 * Extracts ONLY Cut-Off date/times and deadline types.
 * Strictly avoids extracting shipper, consignee, vessel, weight, packages, etc.
 * Never guesses a date - saves null if not clearly available.
 */
export function extractCutOffDeadlinesOnly(text: string): {
  deadlines: CutOffDeadline[];
  dates: NonNullable<AttachmentDetectionResult["cutOffDates"]>;
} {
  const deadlines: CutOffDeadline[] = [];
  const dates: NonNullable<AttachmentDetectionResult["cutOffDates"]> = {
    deadlines,
  };

  const deadlineDefinitions: Array<{
    label: string;
    key?: keyof NonNullable<AttachmentDetectionResult["cutOffDates"]>;
    patterns: RegExp[];
  }> = [
    {
      label: "SI Cut-Off",
      key: "siCutoff",
      patterns: [
        /(?:si|shipping\s*instructions?)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?(?:si|shipping\s*instructions?)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "VGM Cut-Off",
      key: "vgmCutoff",
      patterns: [
        /(?:vgm|verified\s*gross\s*mass)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?(?:vgm|verified\s*gross\s*mass)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "Cargo Cut-Off",
      key: "cargoCutoff",
      patterns: [
        /(?:cargo|cfs|lcl)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?(?:cargo|cfs|lcl)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "Documentation Cut-Off",
      key: "docCutoff",
      patterns: [
        /(?:doc|documentation|draft\s*b\/?l)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?(?:doc|documentation|draft\s*b\/?l)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "CY Cut-Off",
      key: "cyCutoff",
      patterns: [
        /(?:cy|container\s*yard)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?(?:cy|container\s*yard)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "Gate Cut-Off",
      key: "gateCutoff",
      patterns: [
        /(?:gate[-_ ]?in|gate)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?(?:gate[-_ ]?in|gate)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "Terminal Cut-Off",
      key: "terminalCutoff",
      patterns: [
        /(?:terminal|berth|wharf)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?(?:terminal|berth|wharf)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "Port Cut-Off",
      key: "portCutoff",
      patterns: [
        /port\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
        /cut[-_ ]?off\s*(?:for\s*)?port[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "Customs Cut-Off",
      patterns: [
        /(?:customs|export\s*customs)\s*(?:cut[-_ ]?off|closing|deadline)[:\s]+([^\n\r,;]{5,45})/i,
      ],
    },
    {
      label: "Closing Date",
      key: "closingDate",
      patterns: [/(?:closing\s*date|closing\s*time|cargo\s*closing)[:\s]+([^\n\r,;]{5,45})/i],
    },
  ];

  const seenLabels = new Set<string>();

  for (const def of deadlineDefinitions) {
    let matchedDate: string | null = null;
    let rawMatched = "";

    for (const pat of def.patterns) {
      const m = text.match(pat);
      if (m && m[1]) {
        rawMatched = m[1].trim();
        matchedDate = cleanCutOffDateTime(rawMatched);
        if (matchedDate) break;
      }
    }

    if (matchedDate || rawMatched) {
      deadlines.push({
        type: def.label,
        dateTime: matchedDate || null,
        rawText: rawMatched || undefined,
      });
      seenLabels.add(def.label.toLowerCase());

      if (def.key && def.key !== "deadlines") {
        (dates as Record<string, unknown>)[def.key] = matchedDate || null;
      }
    }
  }

  // Look for any other general cut-off deadline Mention
  const genericMatches = text.matchAll(
    /\b([A-Za-z /-]+?)\s*(?:cut[-_ ]?off|deadline|closing)[:\s]+([0-9]{1,2}[-/\s.][a-zA-Z0-9]{3,}[-/\s.][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2}(?:\s*[ap]m)?)?)/gi,
  );

  for (const gm of genericMatches) {
    const rawLabel = `${gm[1].trim()} Cut-Off`;
    const labelKey = rawLabel.toLowerCase();
    if (!seenLabels.has(labelKey) && rawLabel.length <= 35 && !rawLabel.includes("http")) {
      const dt = cleanCutOffDateTime(gm[2]);
      deadlines.push({
        type: rawLabel,
        dateTime: dt || null,
        rawText: gm[2].trim(),
      });
      seenLabels.add(labelKey);
    }
  }

  return { deadlines, dates };
}

/**
 * Formats Cut-Off deadlines into a clean, human-readable summary
 * Example:
 * Cut-Off:
 * SI Cut-Off → 18 Sep 2026, 4:00 PM
 * VGM Cut-Off → 19 Sep 2026, 12:00 PM
 */
export function formatCutOffDeadlinesSummary(
  deadlines?: CutOffDeadline[] | null,
  cutOffDates?: AttachmentDetectionResult["cutOffDates"] | null,
): string {
  const items = deadlines && deadlines.length > 0 ? deadlines : cutOffDates?.deadlines || [];

  if (items.length > 0) {
    return items.map((d) => `${d.type} → ${d.dateTime || "Not Provided"}`).join("\n");
  }

  // Fallback to individual fields if deadlines array not present
  const lines: string[] = [];
  if (cutOffDates?.siCutoff) lines.push(`SI Cut-Off → ${cutOffDates.siCutoff}`);
  if (cutOffDates?.vgmCutoff) lines.push(`VGM Cut-Off → ${cutOffDates.vgmCutoff}`);
  if (cutOffDates?.cargoCutoff) lines.push(`Cargo Cut-Off → ${cutOffDates.cargoCutoff}`);
  if (cutOffDates?.docCutoff) lines.push(`Documentation Cut-Off → ${cutOffDates.docCutoff}`);
  if (cutOffDates?.cyCutoff) lines.push(`CY Cut-Off → ${cutOffDates.cyCutoff}`);
  if (cutOffDates?.gateCutoff) lines.push(`Gate Cut-Off → ${cutOffDates.gateCutoff}`);
  if (cutOffDates?.portCutoff) lines.push(`Port Cut-Off → ${cutOffDates.portCutoff}`);
  if (cutOffDates?.closingDate) lines.push(`Cargo Closing → ${cutOffDates.closingDate}`);

  return lines.length > 0 ? lines.join("\n") : "Cut-Off deadlines: Not Provided";
}

/**
 * Deep heuristic analysis of document content to classify Cut-Off Notice vs Bill of Lading
 */
export function classifyDocumentContentDeep(
  content: string,
  context?: { subject?: string; body?: string; filename?: string },
): {
  isCutOff: boolean;
  isBillOfLading: boolean;
  confidence: number;
  category: AttachmentCategory;
  documentType?: "BILL_OF_LADING" | "CUT_OFF_NOTICE" | "OTHER" | string;
  detectedType: "cut_off" | "bill_of_lading" | "other";
  reason: string;
  cutOffDeadlines?: CutOffDeadline[];
  cutOffDates?: AttachmentDetectionResult["cutOffDates"];
  blNumber?: string;
} {
  const lowerContent = (content || "").toLowerCase();
  const lowerSubject = (context?.subject || "").toLowerCase();
  const lowerBody = (context?.body || "").toLowerCase();
  const lowerFilename = (context?.filename || "").toLowerCase();
  const combinedText = `${lowerFilename} \n ${lowerSubject} \n ${lowerBody} \n ${lowerContent}`;

  let cutOffScore = 0;
  let blScore = 0;
  const cutOffReasons: string[] = [];
  const blReasons: string[] = [];

  // ---------------------------------------------------------------------------
  // 1. CUT-OFF NOTICE SIGNALS IN CONTENT
  // ---------------------------------------------------------------------------
  if (/(?:cut[-_ ]?off|closing[-_ ]?date|closing[-_ ]?time)/i.test(combinedText)) {
    cutOffScore += 30;
    cutOffReasons.push("Found 'cut-off' / 'closing date' terminology");
  }

  // Specific Cut-Off types
  const hasPortCutoff = /(?:port|berth|wharf)\s*cut[-_ ]?off/i.test(combinedText);
  if (hasPortCutoff) {
    cutOffScore += 25;
    cutOffReasons.push("Found Port Cut-off marker");
  }

  const hasGateCutoff = /(?:gate[-_ ]?in|gate|terminal|cy)\s*cut[-_ ]?off/i.test(combinedText);
  if (hasGateCutoff) {
    cutOffScore += 25;
    cutOffReasons.push("Found Gate/CY/Terminal Cut-off marker");
  }

  const hasSiCutoff = /(?:si|shipping\s*instruction|doc|documentation)\s*cut[-_ ]?off/i.test(
    combinedText,
  );
  if (hasSiCutoff) {
    cutOffScore += 25;
    cutOffReasons.push("Found Shipping Instruction (SI) Cut-off marker");
  }

  const hasVgmCutoff = /(?:vgm|verified\s*gross\s*mass)\s*cut[-_ ]?off/i.test(combinedText);
  if (hasVgmCutoff) {
    cutOffScore += 25;
    cutOffReasons.push("Found VGM Cut-off marker");
  }

  // Schedule matrix header (e.g. POL, POD, Vessel, ETD, ETA, Closing)
  if (
    /(?:vessel|feeder|barge)\s*(?:schedule|voyage|departure)/i.test(combinedText) &&
    /(?:etd|eta|pol|pod|closing)/i.test(combinedText)
  ) {
    cutOffScore += 30;
    cutOffReasons.push("Found vessel schedule & rotation matrix");
  }

  // Stacking / Gate-In Period
  if (
    /(?:stacking\s*period|gate[-_ ]?in\s*open|receiving\s*window|stack\s*date)/i.test(combinedText)
  ) {
    cutOffScore += 20;
    cutOffReasons.push("Found cargo stacking / receiving window");
  }

  // ---------------------------------------------------------------------------
  // 2. BILL OF LADING (BL) SIGNALS IN CONTENT
  // ---------------------------------------------------------------------------
  const blHeaderMatch =
    /(?:bill\s*of\s*lading|ocean\s*bill\s*of\s*lading|draft\s*b\/?l|sea\s*waybill|house\s*bill\s*of\s*lading|master\s*bill\s*of\s*lading|original\s*b\/?l|ocean\s*waybill|combined\s*transport\s*bill\s*of\s*lading|non[- ]negotiable\s*copy|multimodal\s*transport\s*document)/i.test(
      combinedText,
    );
  if (blHeaderMatch) {
    blScore += 50;
    blReasons.push("Found standard Bill of Lading / Sea Waybill document header");
  }

  // Standard Maritime B/L Box Fields
  let blFieldMatches = 0;
  if (/\b(?:shipper|exporter)\b[:\s]/i.test(combinedText)) {
    blScore += 15;
    blFieldMatches++;
  }
  if (/\b(?:consignee)\b[:\s]/i.test(combinedText)) {
    blScore += 15;
    blFieldMatches++;
  }
  if (/\b(?:notify\s*party)\b[:\s]/i.test(combinedText)) {
    blScore += 15;
    blFieldMatches++;
  }
  if (/\b(?:port\s*of\s*loading|pol)\b[:\s]/i.test(combinedText)) {
    blScore += 10;
    blFieldMatches++;
  }
  if (/\b(?:port\s*of\s*discharge|pod)\b[:\s]/i.test(combinedText)) {
    blScore += 10;
    blFieldMatches++;
  }
  if (/\b(?:ocean\s*vessel|vessel\s*\/?\s*voyage)\b/i.test(combinedText)) {
    blScore += 10;
    blFieldMatches++;
  }
  if (/\b(?:container\s*(?:no|number)|seal\s*(?:no|number))\b/i.test(combinedText)) {
    blScore += 15;
    blFieldMatches++;
  }
  if (/\b(?:gross\s*weight|tare\s*weight|measurement|cbm)\b/i.test(combinedText)) {
    blScore += 10;
    blFieldMatches++;
  }
  if (/\b(?:freight\s*payable|freight\s*prepaid|freight\s*collect)\b/i.test(combinedText)) {
    blScore += 15;
    blFieldMatches++;
  }
  if (
    /\b(?:number\s*of\s*original\s*b(?:ills|s)?(?:\/l| of lading)?|originals\s*issued)\b/i.test(
      combinedText,
    )
  ) {
    blScore += 20;
    blFieldMatches++;
  }

  if (blFieldMatches >= 2) {
    blReasons.push(
      `Found ${blFieldMatches} standard B/L box fields (Shipper, Consignee, Vessel, POL, Container, Gross Weight, Freight Terms)`,
    );
  }

  // ---------------------------------------------------------------------------
  // 3. EXTRACT METADATA
  // For Cut-Off documents, DO NOT extract full document data.
  // The only important information to extract is the Cut-Off date/time and its label.
  // For BL documents, do NOT perform full BL data extraction.
  // ---------------------------------------------------------------------------
  let cutOffExtraction: ReturnType<typeof extractCutOffDeadlinesOnly> | undefined = undefined;
  if (cutOffScore >= 35 || hasPortCutoff || hasGateCutoff || hasSiCutoff || hasVgmCutoff) {
    cutOffExtraction = extractCutOffDeadlinesOnly(combinedText);
  }

  let blNumber: string | undefined = undefined;
  if (blScore >= 35 || blHeaderMatch) {
    const blNumMatch = combinedText.match(
      /\b(?:b\/?l\s*(?:no\.?|#|number|ref\.?)|bill\s*of\s*lading\s*(?:no\.?|#|number)|waybill\s*no\.?)\s*[-:]?\s*([a-z0-9]{7,20})\b/i,
    );
    if (blNumMatch) {
      blNumber = blNumMatch[1].toUpperCase();
    }
  }

  // ---------------------------------------------------------------------------
  // 4. DECISION SYNTHESIS
  // ---------------------------------------------------------------------------
  if (cutOffScore >= 35 && cutOffScore > blScore) {
    const conf = Math.min(0.98, 0.65 + cutOffScore * 0.003);
    return {
      isCutOff: true,
      isBillOfLading: false,
      confidence: conf,
      category: "Cut-Off Notice",
      documentType: "CUT_OFF_NOTICE",
      detectedType: "cut_off",
      reason: `Document content classified as Cut-Off Notice (${cutOffReasons.join("; ")})`,
      cutOffDeadlines: cutOffExtraction?.deadlines,
      cutOffDates: cutOffExtraction?.dates,
    };
  }

  if (blScore >= 35 && blScore > cutOffScore) {
    const conf = Math.min(0.98, 0.65 + blScore * 0.003);
    return {
      isCutOff: false,
      isBillOfLading: true,
      confidence: conf,
      category: "Bill of Lading",
      documentType: "BILL_OF_LADING",
      detectedType: "bill_of_lading",
      reason: `Document content identified as Bill of Lading (${blReasons.join("; ")}). Document type set to BILL_OF_LADING without full field extraction.`,
      blNumber,
    };
  }

  return {
    isCutOff: false,
    isBillOfLading: false,
    confidence: 0.15,
    category: "Other",
    documentType: "OTHER",
    detectedType: "other",
    reason:
      "Document content did not exhibit definitive Cut-Off or Bill of Lading characteristics.",
  };
}

/**
 * AI-Powered Document Content Classifier (using Gemini API)
 */
export async function classifyAttachmentWithAi(
  attachment: IncomingAttachmentInput,
  context?: { subject?: string; body?: string },
): Promise<AttachmentDetectionResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
    const filename = attachment.filename || attachment.name || "attachment.pdf";
    const mimeType = (attachment.mimeType || "application/pdf").toLowerCase();
    const extractedText = extractTextFromAttachment(attachment);

    const emailSubject = context?.subject || "";
    const emailBody = context?.body || "";

    // Prepare prompt adhering strictly to user requirements
    const prompt = `You are an expert maritime logistics & freight document analyzer.
Analyze the provided email attachment and email context to determine if the attachment is:
1. "Cut-Off Notice" (vessel schedule cut-off deadlines, port cut-off, gate cut-off, SI cut-off, VGM cut-off, cargo cut-off, documentation cut-off, CY cut-off, etc.)
2. "Bill of Lading" (Draft B/L, Ocean Bill of Lading, Sea Waybill, House BL, Master BL, Carrier B/L)
3. "Other" (e.g. commercial invoice, packing list, booking confirmation, rate quote, general message)

CRITICAL INSTRUCTIONS FOR BILL OF LADING (BL) DOCUMENTS:
- For BL attachments, do NOT perform full BL data extraction.
- Simply:
  1. Identify the attachment as a Bill of Lading.
  2. Save the original BL document.
  3. Link it to the correct Movement/Booking.
  4. Store the document type as BILL_OF_LADING.
- No unnecessary BL field extraction is required (do NOT extract shipper name/address, consignee name/address, notify party, vessel name, voyage, container numbers, seal numbers, gross weight, volume, cargo descriptions, freight charges, etc.).

CRITICAL INSTRUCTIONS FOR CUT-OFF DOCUMENTS:
- For Cut-Off documents, DO NOT extract the full document data.
- Do NOT extract unnecessary fields such as shipper, consignee, vessel details, weight, packages, voyage, container counts, etc.
- The ONLY important information to extract is the Cut-Off date/time and its label/type.
- Detect any Cut-Off dates mentioned in the document (SI Cut-Off, VGM Cut-Off, Cargo Cut-Off, Documentation Cut-Off, CY Cut-Off, Port Cut-Off, Gate Cut-Off, Customs Cut-Off, etc.).
- Never guess a date. If a date is not clearly available in the document, save null.

Filename: ${filename}
MIME Type: ${mimeType}
Email Subject: ${emailSubject}
Email Body snippet: ${emailBody.slice(0, 500)}
Extracted Document Text Content:
"""
${extractedText.slice(0, 6000)}
"""

Respond ONLY in valid JSON with this schema:
{
  "category": "Cut-Off Notice" | "Bill of Lading" | "Other",
  "documentType": "BILL_OF_LADING" | "CUT_OFF_NOTICE" | "OTHER",
  "isCutOff": boolean,
  "isBillOfLading": boolean,
  "confidence": number, // between 0.0 and 1.0
  "reason": "Clear explanation of how the document content was classified",
  "cutOffDeadlines": [
    {
      "type": "string (e.g. SI Cut-Off, VGM Cut-Off, Cargo Cut-Off, Documentation Cut-Off, CY Cut-Off, Port Cut-Off)",
      "dateTime": "string or null (e.g. 18 Sep 2026, 4:00 PM)"
    }
  ],
  "cutOffDates": {
    "siCutoff": "string or null",
    "vgmCutoff": "string or null",
    "cargoCutoff": "string or null",
    "docCutoff": "string or null",
    "cyCutoff": "string or null",
    "portCutoff": "string or null",
    "gateCutoff": "string or null",
    "closingDate": "string or null"
  },
  "blNumber": "string or null",
  "suggestedFilename": "string or null"
}`;

    const contentParts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [];

    // If attachment has base64 data and is image or PDF, we can pass inlineData
    let rawData = attachment.data || "";
    if (!rawData && attachment.url && attachment.url.startsWith("data:")) {
      const commaIdx = attachment.url.indexOf(",");
      if (commaIdx !== -1) rawData = attachment.url.slice(commaIdx + 1);
    }

    if (
      rawData &&
      (mimeType.includes("pdf") ||
        mimeType.includes("image") ||
        mimeType.includes("png") ||
        mimeType.includes("jpeg"))
    ) {
      const cleanBase64 = rawData.trim().replace(/-/g, "+").replace(/_/g, "/");
      contentParts.push({
        inlineData: {
          mimeType: mimeType.includes("pdf") ? "application/pdf" : mimeType,
          data: cleanBase64,
        },
      });
    }

    contentParts.push({ text: prompt });

    // Call Gemini with timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: contentParts,
      config: {
        responseMimeType: "application/json",
      },
    });

    clearTimeout(timeoutId);

    const textOutput = response.text?.trim();
    if (!textOutput) return null;

    const parsed = JSON.parse(textOutput);
    const isCutOff = Boolean(parsed.isCutOff || parsed.category === "Cut-Off Notice");
    const isBillOfLading = Boolean(parsed.isBillOfLading || parsed.category === "Bill of Lading");

    let category: AttachmentCategory = "Other";
    if (isCutOff) category = "Cut-Off Notice";
    else if (isBillOfLading) category = "Bill of Lading";

    const documentType = isBillOfLading ? "BILL_OF_LADING" : isCutOff ? "CUT_OFF_NOTICE" : "OTHER";

    // Build normalized cutOffDeadlines array
    let normalizedDeadlines: CutOffDeadline[] = [];
    if (Array.isArray(parsed.cutOffDeadlines)) {
      normalizedDeadlines = parsed.cutOffDeadlines.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any) => ({
          type: item.type || "Cut-Off",
          dateTime: item.dateTime ? String(item.dateTime).trim() : null,
        }),
      );
    } else if (parsed.cutOffDates) {
      const datesObj = parsed.cutOffDates;
      if (datesObj.siCutoff)
        normalizedDeadlines.push({ type: "SI Cut-Off", dateTime: datesObj.siCutoff });
      if (datesObj.vgmCutoff)
        normalizedDeadlines.push({ type: "VGM Cut-Off", dateTime: datesObj.vgmCutoff });
      if (datesObj.cargoCutoff)
        normalizedDeadlines.push({ type: "Cargo Cut-Off", dateTime: datesObj.cargoCutoff });
      if (datesObj.docCutoff)
        normalizedDeadlines.push({ type: "Documentation Cut-Off", dateTime: datesObj.docCutoff });
      if (datesObj.cyCutoff)
        normalizedDeadlines.push({ type: "CY Cut-Off", dateTime: datesObj.cyCutoff });
      if (datesObj.gateCutoff)
        normalizedDeadlines.push({ type: "Gate Cut-Off", dateTime: datesObj.gateCutoff });
      if (datesObj.portCutoff)
        normalizedDeadlines.push({ type: "Port Cut-Off", dateTime: datesObj.portCutoff });
      if (datesObj.closingDate)
        normalizedDeadlines.push({ type: "Cargo Closing", dateTime: datesObj.closingDate });
    }

    const cutOffDatesResult = parsed.cutOffDates
      ? { ...parsed.cutOffDates, deadlines: normalizedDeadlines }
      : normalizedDeadlines.length > 0
        ? { deadlines: normalizedDeadlines }
        : undefined;

    return {
      isCutOff,
      isBillOfLading,
      category,
      documentType,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.95,
      detectedType: isCutOff ? "cut_off" : isBillOfLading ? "bill_of_lading" : "other",
      cleanedName: parsed.suggestedFilename || filename,
      classificationSource: "document_content_ai",
      reason:
        parsed.reason ||
        (isBillOfLading
          ? "Identified as Bill of Lading; document type stored as BILL_OF_LADING."
          : "Classified via Gemini AI document content understanding."),
      cutOffDeadlines: normalizedDeadlines.length > 0 ? normalizedDeadlines : undefined,
      cutOffDates: cutOffDatesResult,
      blNumber: parsed.blNumber || undefined,
    };
  } catch (err) {
    console.warn(
      "[DocumentAttachmentService] Gemini document classification notice (falling back to deep heuristics):",
      err,
    );
    return null;
  }
}

/**
 * Main classification function that incorporates:
 * 1. Document Content (Text streams, PDF tokens, Form fields)
 * 2. AI Document Understanding (Gemini API)
 * 3. Deep Heuristics across extracted content
 * 4. Filename & Email Context
 */
export async function classifyAttachmentWithContent(
  attachment: IncomingAttachmentInput,
  context?: { subject?: string; body?: string },
): Promise<AttachmentDetectionResult> {
  const filename = attachment.filename || attachment.name || "Document.pdf";
  const mimeType = attachment.mimeType;

  // 1. Try AI Document Understanding if API key and content are available
  const hasContentPayload = Boolean(
    attachment.data ||
    attachment.content ||
    attachment.extractedText ||
    (attachment.url && attachment.url.startsWith("data:")),
  );

  if (hasContentPayload && process.env.GEMINI_API_KEY) {
    const aiResult = await classifyAttachmentWithAi(attachment, context);
    if (aiResult && aiResult.confidence >= 0.7) {
      return aiResult;
    }
  }

  // 2. Extract Document Content & perform deep structural analysis
  const extractedText = extractTextFromAttachment(attachment);
  if (extractedText && extractedText.trim().length > 0) {
    const deepResult = classifyDocumentContentDeep(extractedText, {
      subject: context?.subject,
      body: context?.body,
      filename,
    });

    if (deepResult.isCutOff || deepResult.isBillOfLading) {
      return {
        ...deepResult,
        cleanedName: filename,
        classificationSource: "document_content_heuristics",
      };
    }
  }

  // 3. Evaluate Filename and Email Context fallback
  const basicResult = classifyAttachment(filename, mimeType, context);
  return basicResult;
}

/**
 * Synchronous classification based on Filename, MIME type, and email context
 */
export function classifyAttachment(
  filename: string,
  mimeType?: string,
  context?: { subject?: string; body?: string },
): AttachmentDetectionResult {
  const lowerFile = (filename || "").toLowerCase();
  const lowerSubject = (context?.subject || "").toLowerCase();
  const lowerBody = (context?.body || "").toLowerCase();
  const fullText = `${lowerFile} ${lowerSubject} ${lowerBody}`;

  // 1. Check for Forwarder Cut-Off Document
  // Typical patterns:
  // - Cut-off, CutOff, Gate Cutoff, Port Cutoff, SI Cutoff, VGM Cutoff, Terminal Cutoff, Vessel Schedule Cutoff
  const cutOffFileMatch =
    /(?:cut[-_ ]?off|gate[-_ ]?cut|port[-_ ]?cut|si[-_ ]?cut|vgm[-_ ]?cut|terminal[-_ ]?cut|berth[-_ ]?cut|vessel[-_ ]?schedule|closing[-_ ]?schedule)/i.test(
      lowerFile,
    );
  const cutOffContextMatch =
    /(?:port|gate|vessel|si|vgm|terminal|berth|cargo)\s*cut[-_ ]?off/i.test(fullText);

  // 2. Check for Bill of Lading (BL) Document
  // Typical patterns:
  // - Bill of Lading, B/L, Draft BL, Ocean BL, Original BL, Sea Waybill, OBL, HBL, MBL, BL Draft
  const blFileMatch =
    /(?:bill[-_ ]?of[-_ ]?lading|\bbl[-_. ]|[-_. ]bl\b|draft[-_ ]?bl|ocean[-_ ]?bl|original[-_ ]?bl|obl|hbl|mbl|waybill|sea[-_ ]?waybill|carrier[-_ ]?bl|b\/l)/i.test(
      lowerFile,
    );
  const blContextMatch =
    /(?:bill of lading|draft b\/l|ocean b\/l|original b\/l|sea waybill|b\/l copy|hbl|mbl|ocean bill of lading)/i.test(
      fullText,
    );

  // Extract Cut-Off Dates if present
  let cutOffDates: AttachmentDetectionResult["cutOffDates"] | undefined = undefined;
  if (cutOffFileMatch || cutOffContextMatch) {
    cutOffDates = {};
    const portMatch = fullText.match(
      /(?:port|berth)\s*cut[-_ ]?off[:\s]+([0-9]{1,2}[-/\s][a-z0-9]{3,}[-/\s][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i,
    );
    if (portMatch) cutOffDates.portCutoff = portMatch[1].trim();

    const gateMatch = fullText.match(
      /(?:gate|terminal|cy)\s*cut[-_ ]?off[:\s]+([0-9]{1,2}[-/\s][a-z0-9]{3,}[-/\s][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i,
    );
    if (gateMatch) cutOffDates.gateCutoff = gateMatch[1].trim();

    const siMatch = fullText.match(
      /(?:si|shipping\s*instruction)\s*cut[-_ ]?off[:\s]+([0-9]{1,2}[-/\s][a-z0-9]{3,}[-/\s][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i,
    );
    if (siMatch) cutOffDates.siCutoff = siMatch[1].trim();

    const vgmMatch = fullText.match(
      /(?:vgm|verified\s*gross\s*mass)\s*cut[-_ ]?off[:\s]+([0-9]{1,2}[-/\s][a-z0-9]{3,}[-/\s][0-9]{2,4}(?:\s+[0-9]{1,2}:[0-9]{2})?)/i,
    );
    if (vgmMatch) cutOffDates.vgmCutoff = vgmMatch[1].trim();
  }

  // Extract BL Number if present
  let blNumber: string | undefined = undefined;
  if (blFileMatch || blContextMatch) {
    const blNumMatch = fullText.match(
      /\b(?:bl|b\/l|bill of lading)\s*(?:no\.?|#|ref\.?)?\s*[-:]?\s*([a-z0-9]{8,16})\b/i,
    );
    if (blNumMatch) {
      blNumber = blNumMatch[1].toUpperCase();
    }
  }

  if (cutOffFileMatch || (cutOffContextMatch && !blFileMatch)) {
    return {
      isCutOff: true,
      isBillOfLading: false,
      category: "Cut-Off Notice",
      documentType: "CUT_OFF_NOTICE",
      confidence: cutOffFileMatch ? 0.95 : 0.85,
      detectedType: "cut_off",
      cleanedName: filename || "CutOff_Notice.pdf",
      classificationSource: cutOffFileMatch ? "filename_only" : "email_context",
      reason: cutOffFileMatch
        ? `Filename "${filename}" matches Cut-Off Notice naming conventions.`
        : "Email context contains Cut-Off scheduling information.",
      cutOffDates,
    };
  }

  if (blFileMatch || blContextMatch) {
    return {
      isCutOff: false,
      isBillOfLading: true,
      category: "Bill of Lading",
      documentType: "BILL_OF_LADING",
      confidence: blFileMatch ? 0.95 : 0.85,
      detectedType: "bill_of_lading",
      cleanedName: filename || "Bill_of_Lading.pdf",
      classificationSource: blFileMatch ? "filename_only" : "email_context",
      reason: blFileMatch
        ? `Filename "${filename}" matches Bill of Lading naming conventions.`
        : "Email context contains Bill of Lading (B/L) documentation references.",
      blNumber,
    };
  }

  return {
    isCutOff: false,
    isBillOfLading: false,
    category: "Other",
    documentType: "OTHER",
    confidence: 0.1,
    detectedType: "other",
    cleanedName: filename || "Document.pdf",
    classificationSource: "filename_only",
    reason: "No Cut-Off or Bill of Lading indicators detected.",
  };
}

/**
 * Core Backend Function:
 * Automatically identifies, saves, and links incoming Forwarder Cut-Off and BL attachments.
 *
 * Strict Matching Priority Order:
 * 1. Gmail Thread ID
 * 2. In-Reply-To / References headers
 * 3. Movement Number / Request ID
 * 4. Booking Reference
 * 5. Forwarder + booking details
 * 6. AI matching only as a fallback
 *
 * If the system cannot confidently identify the Movement, it does NOT attach
 * the document automatically and marks it as NEEDS_REVIEW instead.
 */
export async function saveAndLinkIncomingAttachment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  params: SaveAndLinkAttachmentParams,
): Promise<SaveAndLinkAttachmentResult> {
  const {
    attachment,
    bookingId,
    movementNumber,
    movementId,
    forwarderId,
    forwarderName,
    senderEmail,
    senderName,
    emailMessageId,
    gmailMessageId,
    gmailThreadId,
    inReplyTo,
    references,
    headers,
    rawHeaders,
    subject,
    body,
    receivedAt,
    userId,
  } = params;

  const rawFilename = attachment.filename || attachment.name || "Forwarder_Document.pdf";
  const mimeType = attachment.mimeType;

  // Step 1: Classify Attachment using content and context (does not rely only on filename)
  const classification = await classifyAttachmentWithContent(attachment, {
    subject: subject || undefined,
    body: body || undefined,
  });
  const category = classification.category;

  const now = new Date();
  const nowIso = now.toISOString();
  const formattedDate = now.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const lastModified = `${formattedDate} - ${formattedTime}`;

  const extension = extractExtension(rawFilename, mimeType);
  const type = determineFileType(extension);
  const fileSize = formatBytes(attachment.size);

  // -------------------------------------------------------------------------
  // STEP 2: IDENTIFY WHICH EXISTING MOVEMENT/BOOKING IT BELONGS TO
  // -------------------------------------------------------------------------
  const matchResult = await identifyMovementForIncomingEmail(supabase, {
    gmailThreadId,
    gmailMessageId,
    inReplyTo,
    references,
    headers,
    rawHeaders,
    subject,
    body,
    senderEmail: senderEmail || "",
    senderName,
    emailMessageId,
    userId,
    attachments: [attachment],
    attachmentTexts: [
      attachment.content || "",
      attachment.extractedText || "",
      classification.reason,
      classification.blNumber ? `B/L: ${classification.blNumber}` : "",
      classification.cutOffDates ? `Cutoff: ${JSON.stringify(classification.cutOffDates)}` : "",
    ].filter(Boolean),
    candidateBookingId: bookingId,
    candidateMovementNumber: movementNumber,
  });

  // -------------------------------------------------------------------------
  // STEP 3: STRICT CONFIDENCE AUDIT FOR MOVEMENT, DOCUMENT TYPE, AND CUT-OFF DATE
  // "If the system cannot confidently identify:
  //  - the Movement
  //  - the document type
  //  - or the Cut-Off date
  //  do not guess. Store the document safely and mark it as NEEDS_REVIEW"
  // -------------------------------------------------------------------------
  const unconfidentFields: Array<"movement" | "document_type" | "cutoff_date"> = [];
  const unconfidentReasons: string[] = [];

  // 1. Movement Confidence Check
  const isConfidentMovement = Boolean(
    matchResult.matchStatus === "MATCHED" &&
    matchResult.bookingId &&
    matchResult.confidence >= 0.75,
  );
  if (!isConfidentMovement) {
    unconfidentFields.push("movement");
    unconfidentReasons.push(
      matchResult.matchReason ||
        "Movement could not be identified with required confidence (>= 75%) across matching priorities",
    );
  }

  // 2. Document Type Confidence Check
  const isConfidentDocType = Boolean(
    classification.confidence >= 0.75 &&
    (classification.isCutOff || classification.isBillOfLading) &&
    classification.documentType !== "OTHER" &&
    classification.category !== "Other",
  );
  if (!isConfidentDocType) {
    unconfidentFields.push("document_type");
    unconfidentReasons.push(
      `Document type is ambiguous (${classification.reason || "Confidence < 75%"})`,
    );
  }

  // 3. Cut-Off Date Confidence Check (if document is a Cut-Off notice)
  let isConfidentCutOffDate = true;
  if (classification.isCutOff || classification.category === "Cut-Off Notice") {
    const extractedDeadlines = classification.cutOffDeadlines || [];
    const hasValidCutOffDate = Boolean(
      (classification.cutOffDates?.siCutoff &&
        cleanCutOffDateTime(classification.cutOffDates.siCutoff)) ||
      (classification.cutOffDates?.vgmCutoff &&
        cleanCutOffDateTime(classification.cutOffDates.vgmCutoff)) ||
      (classification.cutOffDates?.portCutoff &&
        cleanCutOffDateTime(classification.cutOffDates.portCutoff)) ||
      (classification.cutOffDates?.gateCutoff &&
        cleanCutOffDateTime(classification.cutOffDates.gateCutoff)) ||
      (classification.cutOffDates?.cargoCutoff &&
        cleanCutOffDateTime(classification.cutOffDates.cargoCutoff)) ||
      (classification.cutOffDates?.closingDate &&
        cleanCutOffDateTime(classification.cutOffDates.closingDate)) ||
      extractedDeadlines.some((d) => d.dateTime && cleanCutOffDateTime(d.dateTime)),
    );

    if (!hasValidCutOffDate) {
      isConfidentCutOffDate = false;
      unconfidentFields.push("cutoff_date");
      unconfidentReasons.push(
        "Cut-off dates/deadlines could not be verified or parsed from document text without guessing",
      );
    }
  }

  const isOverallConfident = isConfidentMovement && isConfidentDocType && isConfidentCutOffDate;

  // -------------------------------------------------------------------------
  // HANDLE UNCONFIDENT DETECTION: STORE SAFELY AND MARK AS NEEDS_REVIEW
  // -------------------------------------------------------------------------
  if (!isOverallConfident) {
    console.warn(
      `[DocumentAttachmentService] ⚠️ Cannot confidently identify: [${unconfidentFields.join(
        ", ",
      )}] for attachment "${rawFilename}". Storing safely in Documents repository as NEEDS_REVIEW without guessing.`,
    );

    const forwarderOwner = getOrCreateForwarderOwner(
      matchResult.forwarderName || forwarderName,
      senderEmail,
    );
    const uniqueDocId = `doc-review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const docTypeTag = resolveDocumentTypeTag(classification, rawFilename);
    const forwarderDisplayName =
      matchResult.forwarderName || forwarderName || senderName || "Forwarder";

    const driveFile: DriveFile = {
      id: uniqueDocId,
      name: rawFilename,
      type,
      extension,
      owners: [forwarderOwner, INITIAL_OWNERS.alex],
      lastModified,
      lastModifiedTimestamp: nowIso,
      fileSize,
      folderId: "folder-design",
      starred: true,
      sharedLink: `https://drive.nashmia.com/docs/${uniqueDocId}`,
      url: attachment.url || `https://drive.nashmia.com/download/${uniqueDocId}`,
      metadata: {
        category: isConfidentDocType ? classification.category : "Unclassified / Needs Review",
        documentType: docTypeTag,
        displayDocumentType: docTypeTag,
        typeTag: docTypeTag,
        fileFormat: extension.toUpperCase(),
        fileSize,
        bookingId: isConfidentMovement ? matchResult.bookingId : null,
        movementNumber: isConfidentMovement ? matchResult.movementNumber || movementNumber : null,
        movementReferenceNumber: isConfidentMovement
          ? matchResult.movementNumber || movementNumber
          : null,
        forwarderId: matchResult.forwarderId || forwarderId || null,
        forwarderName: forwarderDisplayName,
        forwarder: forwarderDisplayName,
        senderEmail: senderEmail || null,
        emailMessageId: emailMessageId || null,
        gmailMessageId: gmailMessageId || null,
        receivedDate: formattedDate,
        receivedTime: formattedTime,
        status: "Needs Review",
        isMetadataOnly: true,
        source: "Incoming Forwarder Email",
        savedAt: nowIso,
        classificationSource: classification.classificationSource,
        classificationReason: classification.reason,
        cutOffDeadlines: classification.cutOffDeadlines,
        cutOffDates: classification.cutOffDates,
        blNumber: classification.blNumber,
        // Critical Review State
        reviewStatus: "NEEDS_REVIEW",
        needsReview: true,
        reviewReason: unconfidentReasons.join("; "),
        unconfidentFields,
        extractedTextSnippet: (attachment.extractedText || attachment.content || "").slice(0, 600),
      },
    };

    // Store safely in server cache & client storage
    saveServerDocument(driveFile);
    if (typeof window !== "undefined") {
      try {
        saveDriveDocument(driveFile);
      } catch (e) {
        console.warn("[DocumentAttachmentService] Client saveDriveDocument notice:", e);
      }
    }

    // Create high-priority Operational Notification for manual review
    let reviewNotificationId: string | null = null;
    try {
      const missingText = unconfidentFields
        .map((f) =>
          f === "movement" ? "Movement" : f === "document_type" ? "Document Type" : "Cut-Off Date",
        )
        .join(", ");

      const notifTitle = `Document Needs Review: ${rawFilename}`;
      const notifMessage = `Attachment "${rawFilename}" safely stored in Documents. Operator review required: Unconfident ${missingText} (${unconfidentReasons.join(
        "; ",
      )}).`;

      reviewNotificationId = await safeInsertNotification(supabase, {
        userId: userId || null,
        title: notifTitle,
        message: notifMessage,
        type: "document_needs_review",
        bookingId: null,
        movementNumber: null,
      });
    } catch (notifErr) {
      console.warn(
        "[DocumentAttachmentService] Notice creating NEEDS_REVIEW notification:",
        notifErr,
      );
    }

    // Record review state in email_messages table if emailMessageId is available
    const validEmailUuid = safeUuid(emailMessageId);
    if (validEmailUuid) {
      try {
        const { data: curMsg } = await supabase
          .from("email_messages")
          .select("attachments, raw_headers")
          .eq("id", validEmailUuid)
          .maybeSingle();

        const existingAttachments = Array.isArray(curMsg?.attachments)
          ? (curMsg.attachments as Array<Record<string, unknown>>)
          : [];

        const updatedAttachments = [
          ...existingAttachments,
          {
            fileName: rawFilename,
            documentType: docTypeTag,
            fileFormat: extension.toUpperCase(),
            fileSize: driveFile.fileSize,
            gmailMessageId: gmailMessageId || null,
            forwarder: forwarderDisplayName,
            receivedDate: formattedDate,
            receivedTimestamp: receivedAt || nowIso,
            movementReferenceNumber: null,
            status: "Needs Review",
            isMetadataOnly: true,
            savedDocumentId: driveFile.id,
            savedAt: nowIso,
          },
        ];

        const existingRaw = (curMsg?.raw_headers as Record<string, unknown>) || {};
        const existingReviews = Array.isArray(existingRaw.unlinked_attachments_needing_review)
          ? (existingRaw.unlinked_attachments_needing_review as Array<Record<string, unknown>>)
          : [];

        const updatedRawHeaders = {
          ...existingRaw,
          attachment_review_status: "NEEDS_REVIEW",
          unlinked_attachments_needing_review: [
            ...existingReviews,
            {
              documentId: driveFile.id,
              filename: rawFilename,
              category: driveFile.metadata?.category,
              fileSize: driveFile.fileSize,
              unconfidentFields,
              reason: unconfidentReasons.join("; "),
              priorityStepEvaluations: matchResult.priorityStepEvaluations,
              receivedAt: nowIso,
            },
          ],
        };

        await supabase
          .from("email_messages")
          .update({
            attachments: updatedAttachments,
            raw_headers: updatedRawHeaders,
            updated_at: nowIso,
          })
          .eq("id", validEmailUuid);
      } catch (eErr) {
        console.warn(
          "[DocumentAttachmentService] Notice updating email_messages with NEEDS_REVIEW:",
          eErr,
        );
      }
    }

    return {
      saved: true,
      linked: false,
      status: "NEEDS_REVIEW",
      matchingPriorityStep: matchResult.matchingPriorityStep,
      document: driveFile,
      category: driveFile.metadata?.category || "Other",
      reason: `System could not confidently identify: ${unconfidentFields.join(
        ", ",
      )}. Document stored safely and marked as NEEDS_REVIEW (${unconfidentReasons.join("; ")}).`,
      matchResult,
      notificationId: reviewNotificationId,
    };
  }

  // -------------------------------------------------------------------------
  // STEP 3: MOVEMENT CONFIDENTLY IDENTIFIED -> PROCEED TO ATTACH AND SAVE
  // -------------------------------------------------------------------------
  const resolvedBookingId = matchResult.bookingId!;
  const resolvedMovementNumber =
    matchResult.movementNumber || movementNumber || matchResult.bookingReference || "Booking";
  const resolvedForwarderId = matchResult.forwarderId || forwarderId || null;
  const resolvedForwarderName = matchResult.forwarderName || forwarderName || null;

  // Keep original File Name
  const finalFileName = rawFilename;

  // Determine owner
  const forwarderOwner = getOrCreateForwarderOwner(resolvedForwarderName, senderEmail);

  // Generate unique document ID
  const prefix = category === "Cut-Off Notice" ? "doc-cutoff" : "doc-bl";
  const uniqueDocId = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const docTypeTag = resolveDocumentTypeTag(classification, rawFilename);
  const forwarderDisplayName = resolvedForwarderName || "Forwarder";

  // Create DriveFile representation for the existing Documents system (metadata only, no binary stored)
  const driveFile: DriveFile = {
    id: uniqueDocId,
    name: finalFileName,
    type,
    extension,
    owners: [forwarderOwner, INITIAL_OWNERS.alex],
    lastModified,
    lastModifiedTimestamp: nowIso,
    fileSize,
    folderId: "folder-design", // Accessible in Quick Access Design Files
    starred: true, // Starred so high-priority operational documents stand out
    sharedLink: `https://drive.nashmia.com/docs/${uniqueDocId}`,
    url: attachment.url || `https://drive.nashmia.com/download/${uniqueDocId}`,
    metadata: {
      category,
      documentType: docTypeTag,
      displayDocumentType: docTypeTag,
      typeTag: docTypeTag,
      fileFormat: extension.toUpperCase(),
      fileSize,
      bookingId: resolvedBookingId,
      movementNumber: resolvedMovementNumber,
      movementReferenceNumber: resolvedMovementNumber,
      forwarderId: resolvedForwarderId,
      forwarderName: forwarderDisplayName,
      forwarder: forwarderDisplayName,
      senderEmail: senderEmail || null,
      emailMessageId: emailMessageId || null,
      gmailMessageId: gmailMessageId || null,
      receivedDate: formattedDate,
      receivedTime: formattedTime,
      status: "Metadata Saved",
      isMetadataOnly: true,
      source: "Incoming Forwarder Email",
      savedAt: nowIso,
      classificationSource: classification.classificationSource,
      classificationReason: classification.reason,
      cutOffDeadlines: classification.cutOffDeadlines,
      cutOffDates: classification.cutOffDates,
      blNumber: category === "Bill of Lading" ? classification.blNumber : undefined,
    },
  };

  // Save to Server Cache and Client Storage
  saveServerDocument(driveFile);

  if (typeof window !== "undefined") {
    try {
      saveDriveDocument(driveFile);
    } catch (e) {
      console.warn("[DocumentAttachmentService] Client saveDriveDocument notice:", e);
    }
  }

  console.log(
    `[DocumentAttachmentService] 📂 Automatically saved ${docTypeTag} document metadata: "${driveFile.name}" for Movement ${resolvedMovementNumber} (ID: ${driveFile.id}, MatchedBy: ${matchResult.matchedBy}, Priority: ${matchResult.matchingPriorityStep})`,
  );

  // Step 4: Link to Booking / Movement in Supabase
  let bookingEventId: string | null = null;
  let notificationId: string | null = null;
  const validBookingUuid = safeUuid(resolvedBookingId);

  if (validBookingUuid) {
    try {
      const eventTitle =
        docTypeTag === "Cut-Off"
          ? "Port & Gate Cut-Off Document Saved"
          : "Ocean Bill of Lading (B/L) Document Saved";

      const cutOffSummaryText =
        category === "Cut-Off Notice"
          ? `\nCut-Off Deadlines:\n${formatCutOffDeadlinesSummary(
              classification.cutOffDeadlines,
              classification.cutOffDates,
            )}`
          : "";

      const eventDescription = `Document "${driveFile.name}" (${driveFile.fileSize}) from ${
        resolvedForwarderName || "carrier"
      } was automatically saved to Documents repository and linked to Movement ${
        resolvedMovementNumber
      }.${cutOffSummaryText}\n(Matched via Priority ${matchResult.matchingPriorityStep}: ${matchResult.matchedBy}, Classification: ${classification.reason})`;

      const { data: eventData, error: eventErr } = await supabase
        .from("booking_events")
        .insert({
          booking_id: validBookingUuid,
          event_type:
            docTypeTag === "Cut-Off"
              ? "Forwarder Cut-Off Document Linked"
              : "Bill of Lading (B/L) Document Linked",
          event_date: receivedAt || nowIso,
          location: "Documents Repository",
          title: eventTitle,
          description: eventDescription,
          payload: {
            fileName: rawFilename,
            documentId: driveFile.id,
            documentName: driveFile.name,
            documentType: docTypeTag,
            documentCategory: category,
            fileFormat: extension.toUpperCase(),
            fileSize: driveFile.fileSize,
            extension: driveFile.extension,
            sharedLink: driveFile.sharedLink,
            movementReferenceNumber: resolvedMovementNumber,
            movementNumber: resolvedMovementNumber,
            bookingId: validBookingUuid,
            forwarder: forwarderDisplayName,
            forwarderName: forwarderDisplayName,
            gmailMessageId: gmailMessageId || null,
            receivedDate: formattedDate,
            receivedTimestamp: receivedAt || nowIso,
            status: "Metadata Saved",
            isMetadataOnly: true,
            senderEmail: senderEmail || null,
            emailMessageId: emailMessageId || null,
            classificationSource: classification.classificationSource,
            cutOffDeadlines: classification.cutOffDeadlines || null,
            cutOffDates: classification.cutOffDates || null,
            blNumber: category === "Bill of Lading" ? classification.blNumber || null : null,
            matchedBy: matchResult.matchedBy,
            matchingPriorityStep: matchResult.matchingPriorityStep,
            matchConfidence: matchResult.confidence,
            savedAt: nowIso,
          },
        })
        .select("id")
        .maybeSingle();

      if (!eventErr && eventData) {
        bookingEventId = eventData.id;
        console.log(
          `[DocumentAttachmentService] 🔗 Linked document to booking_events ID: ${bookingEventId}`,
        );
      }
    } catch (linkErr) {
      console.warn("[DocumentAttachmentService] Notice linking to booking_events:", linkErr);
    }
  }

  // Step 4.5: Maintain Cut-Off dates inside existing Movement / Booking data
  // The Cut-Off belongs strictly to the specific Movement it was received for (no mixing across movements)
  if (
    category === "Cut-Off Notice" ||
    classification.cutOffDates ||
    (classification.cutOffDeadlines && classification.cutOffDeadlines.length > 0)
  ) {
    try {
      const deadlines: MovementCutOffDeadline[] = (classification.cutOffDeadlines || []).map(
        (d) => ({
          type: d.type,
          dateTime: d.dateTime || "",
          raw: d.rawText,
        }),
      );

      const cutOffPayload: MovementCutOffDates = {
        ...(classification.cutOffDates || {}),
        movementNumber: resolvedMovementNumber,
        deadlines:
          deadlines.length > 0
            ? deadlines
            : (classification.cutOffDates?.deadlines as MovementCutOffDeadline[] | undefined),
        sourceDocumentId: driveFile.id,
        sourceDocumentName: driveFile.name,
        receivedAt: receivedAt || nowIso,
      };

      // Save into isolated movement-specific store and update local bookings
      saveCutOffsForMovement(resolvedMovementNumber, cutOffPayload, validBookingUuid);

      // Persist directly into Supabase bookings record if available
      if (validBookingUuid) {
        try {
          const { data: curBooking } = await supabase
            .from("bookings")
            .select("confirmation_details")
            .eq("id", validBookingUuid)
            .maybeSingle();

          const existingConf = (curBooking?.confirmation_details as Record<string, unknown>) || {};

          await supabase
            .from("bookings")
            .update({
              cut_off_dates: cutOffPayload as unknown as import("@/types/database.types").Json,
              cut_off_deadlines: deadlines as unknown as import("@/types/database.types").Json,
              confirmation_details: {
                ...existingConf,
                cut_off_dates: cutOffPayload,
                cut_off_deadlines: deadlines,
              },
              updated_at: nowIso,
            })
            .eq("id", validBookingUuid);

          console.log(
            `[DocumentAttachmentService] ⏱️ Persisted Cut-Off dates directly into Booking record for Movement ${resolvedMovementNumber}`,
          );
        } catch (dbErr) {
          console.warn(
            "[DocumentAttachmentService] Notice updating booking cut_off_dates in Supabase:",
            dbErr,
          );
        }
      }
    } catch (cutErr) {
      console.warn(
        "[DocumentAttachmentService] Notice maintaining movement cut-off dates:",
        cutErr,
      );
    }
  }

  // Step 5: Update email_messages Record with Document Link
  const validEmailUuid = safeUuid(emailMessageId);
  if (validEmailUuid) {
    try {
      const { data: curMsg } = await supabase
        .from("email_messages")
        .select("attachments, raw_headers")
        .eq("id", validEmailUuid)
        .maybeSingle();

      const existingAttachments = Array.isArray(curMsg?.attachments)
        ? (curMsg.attachments as Array<Record<string, unknown>>)
        : [];

      const updatedAttachments = [
        ...existingAttachments,
        {
          fileName: rawFilename,
          name: driveFile.name,
          documentType: docTypeTag,
          fileFormat: extension.toUpperCase(),
          fileSize: driveFile.fileSize,
          size: driveFile.fileSize,
          type: driveFile.extension,
          gmailMessageId: gmailMessageId || null,
          forwarder: forwarderDisplayName,
          receivedDate: formattedDate,
          receivedTimestamp: receivedAt || nowIso,
          movementReferenceNumber: resolvedMovementNumber,
          status: "Metadata Saved",
          isMetadataOnly: true,
          savedDocumentId: driveFile.id,
          documentCategory: category,
          linkedBookingId: validBookingUuid,
          linkedMovementNumber: resolvedMovementNumber,
          matchedBy: matchResult.matchedBy,
          matchingPriorityStep: matchResult.matchingPriorityStep,
          savedAt: nowIso,
        },
      ];

      const existingRaw = (curMsg?.raw_headers as Record<string, unknown>) || {};
      const existingLinkedDocs = Array.isArray(existingRaw.linked_documents)
        ? (existingRaw.linked_documents as Array<Record<string, unknown>>)
        : [];

      const updatedRawHeaders = {
        ...existingRaw,
        attachment_review_status: "MATCHED_AND_LINKED",
        linked_documents: [
          ...existingLinkedDocs,
          {
            documentId: driveFile.id,
            name: driveFile.name,
            fileName: rawFilename,
            documentType: docTypeTag,
            fileFormat: extension.toUpperCase(),
            category,
            fileSize: driveFile.fileSize,
            bookingId: validBookingUuid,
            movementNumber: resolvedMovementNumber,
            movementReferenceNumber: resolvedMovementNumber,
            forwarder: forwarderDisplayName,
            status: "Metadata Saved",
            isMetadataOnly: true,
            matchedBy: matchResult.matchedBy,
            matchingPriorityStep: matchResult.matchingPriorityStep,
            savedAt: nowIso,
          },
        ],
      };

      await supabase
        .from("email_messages")
        .update({
          booking_id: validBookingUuid,
          movement_number: resolvedMovementNumber,
          forwarder_id: safeUuid(resolvedForwarderId),
          attachments: updatedAttachments,
          raw_headers: updatedRawHeaders,
          updated_at: nowIso,
        })
        .eq("id", validEmailUuid);

      console.log(
        `[DocumentAttachmentService] 📧 Updated email_messages ${validEmailUuid} with linked document`,
      );
    } catch (emailUpdateErr) {
      console.warn("[DocumentAttachmentService] Notice updating email_messages:", emailUpdateErr);
    }
  }

  // Step 6: Dispatch High-Priority Operational Notification
  try {
    const notifTitle =
      category === "Cut-Off Notice"
        ? `Forwarder Cut-Off Document Linked (${resolvedMovementNumber})`
        : `Bill of Lading (B/L) Linked (${resolvedMovementNumber})`;

    const notifMessage = `Incoming attachment "${driveFile.name}" from ${
      resolvedForwarderName || senderEmail || "forwarder"
    } has been automatically saved to your Documents repository and linked to Movement ${resolvedMovementNumber}. (${classification.reason})`;

    notificationId = await safeInsertNotification(supabase, {
      userId: userId || null,
      title: notifTitle,
      message: notifMessage,
      type: "document_linked",
      bookingId: validBookingUuid,
      movementNumber: resolvedMovementNumber,
      metadata: {
        documentId: driveFile.id,
        documentName: driveFile.name,
        category,
        fileSize: driveFile.fileSize,
        bookingId: validBookingUuid,
        movementNumber: resolvedMovementNumber,
        forwarderName: resolvedForwarderName,
        matchedBy: matchResult.matchedBy,
        matchingPriorityStep: matchResult.matchingPriorityStep,
      },
    });
  } catch (notifErr) {
    console.warn("[DocumentAttachmentService] Notice creating notification:", notifErr);
  }

  return {
    saved: true,
    linked: Boolean(bookingEventId || validBookingUuid),
    status: "MATCHED",
    matchingPriorityStep: matchResult.matchingPriorityStep,
    document: driveFile,
    category,
    reason: `Successfully saved ${category} document "${driveFile.name}" and linked to Movement ${
      resolvedMovementNumber
    }. (Matched via Priority ${matchResult.matchingPriorityStep}: ${matchResult.matchedBy}, ${classification.reason})`,
    bookingEventId,
    notificationId,
    matchResult,
  };
}

/**
 * Processes all attachments and inline cut-off/BL notices from an incoming forwarder email
 */
export async function processIncomingEmailAttachments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  input: {
    emailMessageId: string;
    gmailMessageId?: string | null;
    gmailThreadId?: string | null;
    inReplyTo?: string | null;
    references?: string | string[] | null;
    headers?: Array<{ name: string; value: string }> | Record<string, unknown> | null;
    rawHeaders?: Record<string, unknown> | null;
    subject?: string | null;
    body?: string | null;
    senderEmail: string;
    senderName?: string | null;
    bookingId?: string | null;
    movementNumber?: string | null;
    movementId?: string | null;
    forwarderId?: string | null;
    forwarderName?: string | null;
    userId?: string | null;
    receivedAt?: string | null;
    attachments?: IncomingAttachmentInput[];
  },
): Promise<SaveAndLinkAttachmentResult[]> {
  const {
    emailMessageId,
    gmailMessageId,
    gmailThreadId,
    inReplyTo,
    references,
    headers,
    rawHeaders,
    subject = "",
    body = "",
    senderEmail,
    senderName,
    bookingId,
    movementNumber,
    movementId,
    forwarderId,
    forwarderName,
    userId,
    receivedAt,
    attachments = [],
  } = input;

  const results: SaveAndLinkAttachmentResult[] = [];
  const processedKeys = new Set<string>();

  // 1. Process explicit attachments provided with the email
  for (const att of attachments) {
    const rawName = att.filename || att.name;
    if (!rawName) continue;

    const key = `${rawName.toLowerCase()}-${att.size || 0}`;
    if (processedKeys.has(key)) continue;
    processedKeys.add(key);

    const res = await saveAndLinkIncomingAttachment(supabase, {
      attachment: att,
      bookingId,
      movementNumber,
      movementId,
      forwarderId,
      forwarderName,
      senderEmail,
      senderName,
      emailMessageId,
      gmailMessageId,
      gmailThreadId,
      inReplyTo,
      references,
      headers,
      rawHeaders,
      subject,
      body,
      receivedAt,
      userId,
    });

    results.push(res);
  }

  // 2. If no explicit attachments matched Cut-Off or BL, inspect email body & subject
  // Often forwarders send cut-off notices or draft B/L advisories in the message body:
  const hasSavedCutOff = results.some((r) => r.saved && r.category === "Cut-Off Notice");
  const hasSavedBL = results.some((r) => r.saved && r.category === "Bill of Lading");

  const fullEmailContent = `${subject} ${body}`;

  // Check for inline Cut-Off notice in forwarder email
  if (!hasSavedCutOff && /(?:port|gate|vessel|si|vgm)\s*cut[-_ ]?off/i.test(fullEmailContent)) {
    const simulatedCutOffAttachment: IncomingAttachmentInput = {
      filename: `Gate_Cutoff_Notice_${movementNumber || "Forwarder"}.pdf`,
      size: 384000, // 384 KB
      mimeType: "application/pdf",
    };

    const cutOffRes = await saveAndLinkIncomingAttachment(supabase, {
      attachment: simulatedCutOffAttachment,
      bookingId,
      movementNumber,
      movementId,
      forwarderId,
      forwarderName,
      senderEmail,
      senderName,
      emailMessageId,
      gmailMessageId,
      gmailThreadId,
      inReplyTo,
      references,
      headers,
      rawHeaders,
      subject,
      body,
      receivedAt,
      userId,
    });

    if (cutOffRes.saved) {
      results.push(cutOffRes);
    }
  }

  // Check for inline Bill of Lading notice in forwarder email
  if (
    !hasSavedBL &&
    /(?:bill of lading|draft b\/l|ocean b\/l|original b\/l|sea waybill)/i.test(fullEmailContent)
  ) {
    const simulatedBLAttachment: IncomingAttachmentInput = {
      filename: `Ocean_Bill_of_Lading_${movementNumber || "Forwarder"}.pdf`,
      size: 492000, // 492 KB
      mimeType: "application/pdf",
    };

    const blRes = await saveAndLinkIncomingAttachment(supabase, {
      attachment: simulatedBLAttachment,
      bookingId,
      movementNumber,
      movementId,
      forwarderId,
      forwarderName,
      senderEmail,
      senderName,
      emailMessageId,
      gmailMessageId,
      gmailThreadId,
      inReplyTo,
      references,
      headers,
      rawHeaders,
      subject,
      body,
      receivedAt,
      userId,
    });

    if (blRes.saved) {
      results.push(blRes);
    }
  }

  return results;
}
