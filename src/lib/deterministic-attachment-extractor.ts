/**
 * Deterministic Attachment Text Extraction & Handling Engine
 *
 * Conforms strictly to specifications:
 * - Strictly NO AI or OCR APIs
 * - Deterministic text extraction using standard libraries:
 *   * PDF: pdf-parse library
 *   * XLSX: xlsx spreadsheet parser (all sheets, rows, cells)
 *   * DOCX: mammoth document text parser
 *   * TXT/CSV: Direct string/UTF-8 decode
 * - Image or scanned PDF attachments:
 *   * Strictly NO AI or OCR service called
 *   * Mark as 'unreadable' or 'manual_review_required'
 *   * Preserve original attachment (metadata, binary/base64, URL)
 *   * Route to operator manual review for manual quotation data entry
 */

import * as XLSX from "xlsx";

export type AttachmentFileType = "pdf" | "xlsx" | "docx" | "txt" | "csv" | "image" | "unknown";

export type AttachmentExtractionStatus =
  "success" | "manual_review_required" | "unreadable" | "unsupported_format" | "empty_content";

export interface AttachmentInputData {
  id?: string;
  filename?: string;
  name?: string;
  mimeType?: string;
  size?: number | string;
  data?: string | Buffer | ArrayBuffer | Uint8Array; // Base64 or Buffer/ArrayBuffer
  content?: string; // Pre-extracted or plain text content
  url?: string;
  attachmentId?: string;
}

export interface ExtractedAttachmentResult {
  id: string;
  filename: string;
  fileType: AttachmentFileType;
  mimeType: string;
  size: number;
  status: AttachmentExtractionStatus;
  isReadable: boolean;
  requiresManualReview: boolean;
  extractedText: string;
  textSnippet: string;
  characterCount: number;
  reason: string;
  originalAttachment: {
    filename: string;
    mimeType: string;
    size: number;
    url?: string;
    attachmentId?: string;
    hasRawData: boolean;
  };
  sheets?: Array<{ name: string; rowCount: number }>;
}

export interface BatchAttachmentExtractionResult {
  attachments: ExtractedAttachmentResult[];
  combinedExtractedText: string;
  hasUnreadableAttachments: boolean;
  requiresManualReview: boolean;
  reviewReasons: string[];
  totalReadable: number;
  totalUnreadable: number;
}

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "bmp",
  "webp",
  "tiff",
  "tif",
  "svg",
  "ico",
  "heic",
  "avif",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/bmp",
  "image/webp",
  "image/tiff",
  "image/svg+xml",
  "image/x-icon",
  "image/heic",
  "image/avif",
]);

// Maximum allowed attachment size: 25MB
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;

// Disallowed dangerous executable formats
export const DANGEROUS_EXECUTABLE_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "vbs",
  "js",
  "scr",
  "msi",
  "dll",
  "com",
  "ps1",
  "jar",
  "apk",
  "bin",
  "elf",
]);

export interface AttachmentSecurityValidation {
  isValid: boolean;
  sanitizedFilename: string;
  isOversized: boolean;
  isDangerousExecutable: boolean;
  error?: string;
}

/**
 * Validates attachment security:
 * 1. Checks file size against 25MB threshold
 * 2. Blocks dangerous executable extensions
 * 3. Sanitizes filename against path traversal attacks
 */
export function validateAttachmentSecurity(
  filename?: string,
  sizeBytes?: number,
  mimeType?: string,
): AttachmentSecurityValidation {
  const rawName = (filename || "attachment").trim();
  // Strip path traversal attempts and null characters
  const sanitizedFilename = rawName
    .replace(/\0/g, "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.\./g, ".");

  const lowerName = sanitizedFilename.toLowerCase();
  let ext = "";
  if (lowerName.includes(".")) {
    const parts = lowerName.split(".");
    ext = parts[parts.length - 1].trim();
  }

  // 1. Check dangerous executable extensions
  if (DANGEROUS_EXECUTABLE_EXTENSIONS.has(ext)) {
    return {
      isValid: false,
      sanitizedFilename,
      isOversized: false,
      isDangerousExecutable: true,
      error: `Security Policy Violation: Executable attachment type (.${ext}) is prohibited.`,
    };
  }

  // 2. Check file size limits
  if (sizeBytes && sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      isValid: false,
      sanitizedFilename,
      isOversized: true,
      isDangerousExecutable: false,
      error: `File Size Exceeded: Attachment size (${(sizeBytes / (1024 * 1024)).toFixed(
        1,
      )}MB) exceeds maximum limit of 25MB.`,
    };
  }

  return {
    isValid: true,
    sanitizedFilename,
    isOversized: false,
    isDangerousExecutable: false,
  };
}

/**
 * Detects the file type from filename and/or MIME type.
 */
export function detectAttachmentType(
  filename?: string,
  mimeType?: string,
): { fileType: AttachmentFileType; extension: string; mime: string } {
  const cleanName = (filename || "").trim().toLowerCase();
  const cleanMime = (mimeType || "").trim().toLowerCase();

  let ext = "";
  if (cleanName.includes(".")) {
    const parts = cleanName.split(".");
    ext = parts[parts.length - 1].trim();
  }

  // 1. PDF
  if (ext === "pdf" || cleanMime.includes("application/pdf")) {
    return { fileType: "pdf", extension: "pdf", mime: cleanMime || "application/pdf" };
  }

  // 2. XLSX / XLS
  if (
    ext === "xlsx" ||
    ext === "xls" ||
    ext === "xlsm" ||
    ext === "xlsb" ||
    cleanMime.includes("spreadsheetml") ||
    cleanMime.includes("ms-excel")
  ) {
    return {
      fileType: "xlsx",
      extension: ext || "xlsx",
      mime: cleanMime || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  // 3. DOCX / DOC
  if (
    ext === "docx" ||
    ext === "doc" ||
    cleanMime.includes("wordprocessingml") ||
    cleanMime.includes("msword")
  ) {
    return {
      fileType: "docx",
      extension: ext || "docx",
      mime: cleanMime || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }

  // 4. CSV
  if (ext === "csv" || cleanMime.includes("text/csv") || cleanMime.includes("application/csv")) {
    return { fileType: "csv", extension: "csv", mime: cleanMime || "text/csv" };
  }

  // 5. TXT / LOG / MD
  if (
    ext === "txt" ||
    ext === "text" ||
    ext === "log" ||
    ext === "md" ||
    cleanMime.startsWith("text/plain")
  ) {
    return { fileType: "txt", extension: ext || "txt", mime: cleanMime || "text/plain" };
  }

  // 6. Image
  if (
    IMAGE_EXTENSIONS.has(ext) ||
    IMAGE_MIME_TYPES.has(cleanMime) ||
    cleanMime.startsWith("image/")
  ) {
    return { fileType: "image", extension: ext || "png", mime: cleanMime || "image/png" };
  }

  return { fileType: "unknown", extension: ext, mime: cleanMime || "application/octet-stream" };
}

/**
 * Converts input data to Buffer or Uint8Array.
 */
export function normalizeToBuffer(
  input?: string | Buffer | ArrayBuffer | Uint8Array,
): Buffer | null {
  if (!input) return null;

  if (Buffer.isBuffer(input)) {
    return input;
  }

  if (input instanceof Uint8Array) {
    return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  }

  if (input instanceof ArrayBuffer) {
    return Buffer.from(input);
  }

  if (typeof input === "string") {
    // If it's a data URI (e.g. data:application/pdf;base64,...)
    let raw = input;
    if (raw.includes(";base64,")) {
      raw = raw.split(";base64,")[1];
    }
    // Clean whitespace and URL encoding characters
    const cleanB64 = raw
      .replace(/[\r\n\s]/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    try {
      return Buffer.from(cleanB64, "base64");
    } catch {
      return Buffer.from(input, "utf-8");
    }
  }

  return null;
}

/**
 * Deterministically extracts text from PDF buffer using pdf-parse.
 * If the PDF has no text stream (scanned PDF), returns unreadable.
 */
export async function extractTextFromPdf(
  buffer: Buffer,
): Promise<{ text: string; isScanned: boolean }> {
  try {
    let rawText = "";

    // 1. Try pdf-parse library
    try {
      const pdfParseModule = await import("pdf-parse");
      if (typeof (pdfParseModule as { PDFParse?: unknown }).PDFParse === "function") {
        const { PDFParse } = pdfParseModule as {
          PDFParse: new (opts: { data: Buffer }) => {
            load: () => Promise<void>;
            getText: () => Promise<{ text?: string }>;
            destroy: () => Promise<void>;
          };
        };
        const parser = new PDFParse({ data: buffer });
        await parser.load();
        const res = await parser.getText();
        rawText = (res?.text || "").trim();
        try {
          await parser.destroy();
        } catch {
          // ignore
        }
      } else {
        const pdfParseFn =
          (pdfParseModule as unknown as { default?: (b: Buffer) => Promise<{ text: string }> }).default ||
          (pdfParseModule as unknown as (b: Buffer) => Promise<{ text: string }>);
        if (typeof pdfParseFn === "function") {
          const data = await pdfParseFn(buffer);
          rawText = (data?.text || "").trim();
        }
      }
    } catch {
      // Proceed to deterministic fallback
    }

    // 2. Fallback: Parse uncompressed text streams, operators (Tj, TJ), and dictionary fields
    if (!rawText || rawText.trim().length < 5) {
      const latin1Str = new TextDecoder("latin1").decode(buffer);
      const textChunks: string[] = [];

      // TJ array operators: [(Part 1) 20 (Part 2)] TJ
      const tjArrayMatches = latin1Str.match(/\[([\s\S]*?)\]\s*TJ/gi);
      if (tjArrayMatches) {
        for (const arr of tjArrayMatches) {
          const strMatches = arr.match(/\(([^()]+)\)/g);
          if (strMatches) {
            const joined = strMatches.map((s) => s.slice(1, -1)).join("");
            if (joined.trim().length >= 2) textChunks.push(joined.trim());
          }
        }
      }

      // Tj operators: (string) Tj
      const tjMatches = latin1Str.match(/\(([^()]{2,150})\)\s*T[jJ]/g);
      if (tjMatches) {
        for (const m of tjMatches) {
          const cleaned = m.replace(/[()\s*TjJ]/g, " ").trim();
          if (cleaned.length >= 2) textChunks.push(cleaned);
        }
      }

      // stream ... endstream blocks
      const streamMatches = latin1Str.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/gi);
      if (streamMatches) {
        for (const sm of streamMatches) {
          const textInStream = sm.match(/\(([^()]+)\)/g);
          if (textInStream) {
            for (const tis of textInStream) {
              const c = tis.slice(1, -1).trim();
              if (c.length >= 2) textChunks.push(c);
            }
          }
        }
      }

      // ASCII printables
      const printableMatches = latin1Str.match(/[\x20-\x7E\t\r\n]{3,}/g);
      if (printableMatches) {
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

      if (textChunks.length > 0) {
        rawText = textChunks.join(" \n ").slice(0, 20000);
      }
    }

    // Check if extracted text contains actual alphanumeric words
    const meaningfulText = rawText.replace(/[\s\r\n\t]+/g, " ").trim();
    const alphanumericCount = (meaningfulText.match(/[a-zA-Z0-9]/g) || []).length;

    if (!meaningfulText || alphanumericCount < 10) {
      // PDF contains images only or insufficient digital text stream (Scanned PDF)
      return { text: "", isScanned: true };
    }

    return { text: rawText, isScanned: false };
  } catch {
    return { text: "", isScanned: true };
  }
}

/**
 * Deterministically extracts text from XLSX/XLS buffer using SheetJS (xlsx).
 */
export function extractTextFromXlsx(buffer: Buffer): {
  text: string;
  sheets: Array<{ name: string; rowCount: number }>;
} {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetSummaries: Array<{ name: string; rowCount: number }> = [];
    const textParts: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      // Extract sheet rows as CSV string for clean uniform line-by-line charge parsing
      const csvContent = XLSX.utils.sheet_to_csv(worksheet, {
        FS: "\t", // Tab-delimited for clear tabular distinction
        blankrows: false,
      });

      const rowCount = csvContent.split("\n").filter((l) => l.trim().length > 0).length;
      sheetSummaries.push({ name: sheetName, rowCount });

      if (csvContent.trim().length > 0) {
        textParts.push(`--- Sheet: ${sheetName} ---`);
        textParts.push(csvContent.trim());
      }
    }

    return {
      text: textParts.join("\n\n"),
      sheets: sheetSummaries,
    };
  } catch (err) {
    return { text: "", sheets: [] };
  }
}

/**
 * Deterministically extracts text from DOCX buffer using mammoth.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<{ text: string }> {
  try {
    const mammothModule = await import("mammoth");
    const mammoth =
      (
        mammothModule as unknown as {
          default?: {
            extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
          };
          extractRawText?: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
        }
      ).default ||
      (mammothModule as unknown as {
        extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
      });

    const result = await mammoth.extractRawText({ buffer });
    return { text: (result?.value || "").trim() };
  } catch {
    return { text: "" };
  }
}

/**
 * Deterministically extracts plain text from TXT or CSV buffer/string.
 */
export function extractTextFromPlainText(buffer: Buffer | string): { text: string } {
  if (typeof buffer === "string") {
    return { text: buffer.trim() };
  }
  try {
    return { text: buffer.toString("utf-8").trim() };
  } catch {
    return { text: buffer.toString("ascii").trim() };
  }
}

/**
 * Extracts and handles a single attachment deterministically without AI or OCR.
 */
export async function processAttachmentDeterministically(
  input: AttachmentInputData,
): Promise<ExtractedAttachmentResult> {
  const filename = input.filename || input.name || "unnamed_attachment";
  const { fileType, mime } = detectAttachmentType(filename, input.mimeType);
  const id =
    input.id || input.attachmentId || `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const buffer = normalizeToBuffer(input.data);
  const size = buffer ? buffer.length : typeof input.size === "number" ? input.size : 0;

  // Security Check: Validate attachment size and block dangerous executables
  const securityCheck = validateAttachmentSecurity(filename, size, mime);
  const safeFilename = securityCheck.sanitizedFilename;

  const originalAttachment = {
    filename: safeFilename,
    mimeType: mime,
    size,
    url: input.url,
    attachmentId: input.attachmentId,
    hasRawData: !!buffer || !!input.data,
  };

  if (!securityCheck.isValid) {
    return {
      id,
      filename: safeFilename,
      fileType,
      mimeType: mime,
      size,
      status: "unsupported_format",
      isReadable: false,
      requiresManualReview: true,
      extractedText: "",
      textSnippet: "",
      characterCount: 0,
      reason: securityCheck.error || "Attachment failed security policy validation.",
      originalAttachment,
    };
  }

  // 1. If explicit plain text content was already provided
  if (
    typeof input.content === "string" &&
    input.content.trim().length > 0 &&
    fileType !== "image"
  ) {
    const text = input.content.trim();
    return {
      id,
      filename,
      fileType,
      mimeType: mime,
      size,
      status: "success",
      isReadable: true,
      requiresManualReview: false,
      extractedText: text,
      textSnippet: text.slice(0, 300),
      characterCount: text.length,
      reason: `Deterministic text extraction from ${fileType.toUpperCase()} content.`,
      originalAttachment,
    };
  }

  // 2. Image Attachments: Strictly NO AI, NO OCR
  if (fileType === "image") {
    return {
      id,
      filename,
      fileType: "image",
      mimeType: mime,
      size,
      status: "manual_review_required",
      isReadable: false,
      requiresManualReview: true,
      extractedText: "",
      textSnippet: "",
      characterCount: 0,
      reason:
        "Image attachment: AI and OCR services are strictly disabled. Preserved original file for manual operator quotation entry.",
      originalAttachment,
    };
  }

  // 3. If no buffer data available to parse
  if (!buffer || buffer.length === 0) {
    return {
      id,
      filename,
      fileType,
      mimeType: mime,
      size: 0,
      status: "empty_content",
      isReadable: false,
      requiresManualReview: true,
      extractedText: "",
      textSnippet: "",
      characterCount: 0,
      reason: `Attachment ${filename} contains empty payload or missing binary data.`,
      originalAttachment,
    };
  }

  // 4. PDF Extraction
  if (fileType === "pdf") {
    const pdfResult = await extractTextFromPdf(buffer);
    if (pdfResult.isScanned || !pdfResult.text) {
      return {
        id,
        filename,
        fileType: "pdf",
        mimeType: mime,
        size,
        status: "manual_review_required",
        isReadable: false,
        requiresManualReview: true,
        extractedText: "",
        textSnippet: "",
        characterCount: 0,
        reason:
          "Scanned PDF or image-only PDF with no extractable text stream. AI/OCR disabled. Preserved for operator manual entry.",
        originalAttachment,
      };
    }

    return {
      id,
      filename,
      fileType: "pdf",
      mimeType: mime,
      size,
      status: "success",
      isReadable: true,
      requiresManualReview: false,
      extractedText: pdfResult.text,
      textSnippet: pdfResult.text.slice(0, 300),
      characterCount: pdfResult.text.length,
      reason: "Successfully extracted digital text stream from PDF via deterministic parser.",
      originalAttachment,
    };
  }

  // 5. XLSX / Spreadsheet Extraction
  if (fileType === "xlsx") {
    const xlsxResult = extractTextFromXlsx(buffer);
    if (!xlsxResult.text) {
      return {
        id,
        filename,
        fileType: "xlsx",
        mimeType: mime,
        size,
        status: "unreadable",
        isReadable: false,
        requiresManualReview: true,
        extractedText: "",
        textSnippet: "",
        characterCount: 0,
        reason: "Unable to parse tabular sheet cells from spreadsheet.",
        originalAttachment,
        sheets: xlsxResult.sheets,
      };
    }

    return {
      id,
      filename,
      fileType: "xlsx",
      mimeType: mime,
      size,
      status: "success",
      isReadable: true,
      requiresManualReview: false,
      extractedText: xlsxResult.text,
      textSnippet: xlsxResult.text.slice(0, 300),
      characterCount: xlsxResult.text.length,
      reason: `Successfully extracted tabular data from ${xlsxResult.sheets.length} worksheet(s) via SheetJS parser.`,
      originalAttachment,
      sheets: xlsxResult.sheets,
    };
  }

  // 6. DOCX Document Extraction
  if (fileType === "docx") {
    const docxResult = await extractTextFromDocx(buffer);
    if (!docxResult.text) {
      return {
        id,
        filename,
        fileType: "docx",
        mimeType: mime,
        size,
        status: "unreadable",
        isReadable: false,
        requiresManualReview: true,
        extractedText: "",
        textSnippet: "",
        characterCount: 0,
        reason: "No extractable text found in Word document.",
        originalAttachment,
      };
    }

    return {
      id,
      filename,
      fileType: "docx",
      mimeType: mime,
      size,
      status: "success",
      isReadable: true,
      requiresManualReview: false,
      extractedText: docxResult.text,
      textSnippet: docxResult.text.slice(0, 300),
      characterCount: docxResult.text.length,
      reason: "Successfully extracted raw text from DOCX document via mammoth parser.",
      originalAttachment,
    };
  }

  // 7. CSV or Plain Text (TXT/LOG/MD)
  if (fileType === "csv" || fileType === "txt") {
    const textResult = extractTextFromPlainText(buffer);
    if (!textResult.text) {
      return {
        id,
        filename,
        fileType,
        mimeType: mime,
        size,
        status: "empty_content",
        isReadable: false,
        requiresManualReview: true,
        extractedText: "",
        textSnippet: "",
        characterCount: 0,
        reason: `Plain text file ${filename} is empty.`,
        originalAttachment,
      };
    }

    return {
      id,
      filename,
      fileType,
      mimeType: mime,
      size,
      status: "success",
      isReadable: true,
      requiresManualReview: false,
      extractedText: textResult.text,
      textSnippet: textResult.text.slice(0, 300),
      characterCount: textResult.text.length,
      reason: `Successfully read ${fileType.toUpperCase()} plain text content directly.`,
      originalAttachment,
    };
  }

  // 8. Unsupported Format
  return {
    id,
    filename,
    fileType: "unknown",
    mimeType: mime,
    size,
    status: "unsupported_format",
    isReadable: false,
    requiresManualReview: true,
    extractedText: "",
    textSnippet: "",
    characterCount: 0,
    reason: `Unsupported attachment file format '${filename}'. Preserved for manual operator review.`,
    originalAttachment,
  };
}

/**
 * Processes a batch of attachments and aggregates extracted text and manual review flags.
 */
export async function processAttachmentBatchDeterministically(
  attachments: AttachmentInputData[],
): Promise<BatchAttachmentExtractionResult> {
  const results: ExtractedAttachmentResult[] = [];
  const textParts: string[] = [];
  const reviewReasons: string[] = [];

  let hasUnreadable = false;
  let totalReadable = 0;
  let totalUnreadable = 0;

  for (const att of attachments) {
    const res = await processAttachmentDeterministically(att);
    results.push(res);

    if (res.isReadable && res.extractedText) {
      textParts.push(
        `--- ATTACHMENT: ${res.filename} (${res.fileType.toUpperCase()}) ---\n${res.extractedText}`,
      );
      totalReadable++;
    } else {
      hasUnreadable = true;
      totalUnreadable++;
      if (res.requiresManualReview) {
        reviewReasons.push(`Attachment '${res.filename}': ${res.reason}`);
      }
    }
  }

  return {
    attachments: results,
    combinedExtractedText: textParts.join("\n\n"),
    hasUnreadableAttachments: hasUnreadable,
    requiresManualReview: reviewReasons.length > 0,
    reviewReasons,
    totalReadable,
    totalUnreadable,
  };
}
