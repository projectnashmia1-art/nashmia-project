/**
 * Production-Ready Rule-Based Email Cleaning Service
 * Deterministically strips quoted replies, signatures, and disclaimers
 * while preserving the newest relevant message and audit traceability.
 */

export interface CleanedEmailResult {
  /** The clean, newest message content ready for deterministic quotation extraction */
  cleanedBody: string;
  /** The original, untouched body preserved for audit and verification */
  originalBody: string;
  /** Individual lines of the cleaned text with original 1-based line numbers */
  cleanedLines: Array<{ text: string; originalLineNumber: number }>;
  /** Quoted historical reply blocks detected and removed */
  quotedChainsRemoved: boolean;
  /** Signature block detected and removed */
  signatureRemoved: boolean;
  /** Legal disclaimer block detected and removed */
  disclaimerRemoved: boolean;
  /** Extracted signature text if found */
  detectedSignature?: string;
  /** Extracted disclaimer text if found */
  detectedDisclaimer?: string;
  /** Whether the message boundary was cleanly detected without ambiguity */
  isCleanBoundary: boolean;
  /** Warnings or review reasons if boundary is uncertain */
  warnings: string[];
}

export interface EmailCleaningOptions {
  preserveSubject?: boolean;
  stripHtml?: boolean;
}

// Regex patterns for reply header lines
const QUOTED_HEADER_PATTERNS = [
  /^[>\s]*On\s+[A-Za-z]+,\s+[A-Za-z0-9\s,:]+wrote:\s*$/i,
  /^[>\s]*On\s+.*,\s+.*<.*@.*>\s+wrote:\s*$/i,
  /^[>\s]*-+\s*Original Message\s*-+\s*$/i,
  /^[>\s]*-+\s*Forwarded message\s*-+\s*$/i,
  /^[>\s]*From:\s+.*(?:To:|Sent:|Date:)/i,
  /^[>\s]*_{10,}\s*$/,
  /^[>\s]*-{5,}\s*$/,
];

// Regex patterns that signal start of a signature block
const SIGNATURE_PATTERNS = [
  /^--\s*$/,
  /^__\s*$/,
  /^(?:Best|Kind|Warm|With)?\s*Regards[,.]?\s*$/i,
  /^(?:Thanks\s+(?:&|and)\s+Regards|Thanks\s+a\s+lot|Thank\s+you)[,.]?\s*$/i,
  /^(?:Yours\s+faithfully|Yours\s+sincerely|Sincerely)[,.]?\s*$/i,
  /^(?:Cheers|Best\s+wishes|Best)[,.]?\s*$/i,
];

// Keywords indicating legal/corporate disclaimers
const DISCLAIMER_KEYWORDS = [
  "confidentiality notice",
  "this email and any files transmitted",
  "this communication is intended solely",
  "this message contains confidential information",
  "please consider the environment before printing",
  "if you have received this email in error",
  "the contents of this email are intended only",
  "strictly confidential and may be legally privileged",
];

/**
 * Strips HTML tags and normalizes entities while maintaining line breaks
 */
export function stripHtmlToPlainText(html: string): string {
  if (!html) return "";
  let text = html;
  // Replace <br>, <p>, <div> with newline
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/h[1-6]>/gi, "\n\n");
  text = text.replace(/<li[^>]*>/gi, "• ");
  text = text.replace(/<\/li>/gi, "\n");
  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, " ");
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&euro;/gi, "EUR")
    .replace(/&pound;/gi, "GBP");
  return text;
}

/**
 * Deterministically cleans email content to isolate the newest message for quotation extraction
 */
export function cleanEmailContent(
  rawBody: string,
  options?: EmailCleaningOptions,
): CleanedEmailResult {
  const original = rawBody || "";
  let workingText = original;

  if (options?.stripHtml && /<[a-z][\s\S]*>/i.test(workingText)) {
    workingText = stripHtmlToPlainText(workingText);
  }

  // Normalize Windows CRLF to LF
  workingText = workingText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const lines = workingText.split("\n");
  const warnings: string[] = [];

  let replyCutoffIndex = -1;
  let signatureCutoffIndex = -1;
  let disclaimerCutoffIndex = -1;
  let detectedSignature = "";
  let detectedDisclaimer = "";

  // 1. Scan for quoted reply chains
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check for inline header pattern like "On Sep 25, 2026, John Doe wrote:"
    for (const pat of QUOTED_HEADER_PATTERNS) {
      if (pat.test(line)) {
        replyCutoffIndex = i;
        break;
      }
    }
    if (replyCutoffIndex !== -1) break;

    // Check for block of lines starting with '>'
    if (line.startsWith(">")) {
      // Look back to see if previous line was blank or an introductory "On ... wrote:"
      replyCutoffIndex = i;
      break;
    }
  }

  // Determine effective message boundary before replies
  const boundaryIndex = replyCutoffIndex !== -1 ? replyCutoffIndex : lines.length;

  // 2. Scan for signature and disclaimer within the active message portion
  for (let i = 0; i < boundaryIndex; i++) {
    const line = lines[i].trim();
    const lowerLine = line.toLowerCase();

    // Check disclaimer
    const isDisclaimer = DISCLAIMER_KEYWORDS.some((kw) => lowerLine.includes(kw));
    if (isDisclaimer && disclaimerCutoffIndex === -1) {
      disclaimerCutoffIndex = i;
      detectedDisclaimer = lines.slice(i, boundaryIndex).join("\n").trim();
    }

    // Check signature
    if (signatureCutoffIndex === -1 && disclaimerCutoffIndex === -1) {
      for (const sigPat of SIGNATURE_PATTERNS) {
        if (sigPat.test(line)) {
          // Verify this isn't just "Regards" inside a sentence
          if (line.split(/\s+/).length <= 4) {
            signatureCutoffIndex = i;
            detectedSignature = lines.slice(i, boundaryIndex).join("\n").trim();
            break;
          }
        }
      }
    }
  }

  // Determine overall end of newest message
  let effectiveEnd = boundaryIndex;
  if (disclaimerCutoffIndex !== -1 && disclaimerCutoffIndex < effectiveEnd) {
    effectiveEnd = disclaimerCutoffIndex;
  }
  if (signatureCutoffIndex !== -1 && signatureCutoffIndex < effectiveEnd) {
    effectiveEnd = signatureCutoffIndex;
  }

  // Build cleaned lines with their 1-based original line numbers
  const cleanedLineItems: Array<{ text: string; originalLineNumber: number }> = [];
  for (let i = 0; i < effectiveEnd; i++) {
    cleanedLineItems.push({
      text: lines[i],
      originalLineNumber: i + 1,
    });
  }

  // Trim trailing empty lines
  while (
    cleanedLineItems.length > 0 &&
    cleanedLineItems[cleanedLineItems.length - 1].text.trim() === ""
  ) {
    cleanedLineItems.pop();
  }

  const cleanedBody = cleanedLineItems
    .map((item) => item.text)
    .join("\n")
    .trim();

  // Evaluate boundary confidence
  let isCleanBoundary = true;
  if (cleanedBody.length === 0 && original.trim().length > 0) {
    // Over-cleaning warning!
    isCleanBoundary = false;
    warnings.push("Email cleaning produced an empty body; review original email content.");
  }

  if (replyCutoffIndex === 0) {
    isCleanBoundary = false;
    warnings.push("Quoted reply detected at line 1. Entire message may be forwarded or quoted.");
  }

  return {
    cleanedBody: cleanedBody || original.trim(),
    originalBody: original,
    cleanedLines: cleanedLineItems,
    quotedChainsRemoved: replyCutoffIndex !== -1,
    signatureRemoved: signatureCutoffIndex !== -1,
    disclaimerRemoved: disclaimerCutoffIndex !== -1,
    detectedSignature: detectedSignature || undefined,
    detectedDisclaimer: detectedDisclaimer || undefined,
    isCleanBoundary,
    warnings,
  };
}
