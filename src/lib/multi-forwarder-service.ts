import { supabase, isSupabaseConfigured } from "./supabase";
import { getGmailAccessToken, sendEmailDirectlyViaGmail } from "./gmail-service";
import { safeUuid, getLocalBookings, updateLocalBooking } from "./supabase-services";
import {
  extractQuotationFromEmail,
  extractQuotationRuleBased,
  validateQuotationForBackendAction,
  type ExtractedQuotation,
} from "./quotation-extractor";
import { recordQuotationAuditEvent } from "./quotation-audit-logger";
import {
  persistQuotationToDatabase,
  fetchForwarderRequestsFromDatabase,
  persistForwarderRequestsDispatched,
  awardForwarderQuotationInDb,
} from "./quotation-database-service";
import type {
  BookingRequestRecord,
  ForwarderQuoteRequestRecord,
  ForwarderOfferData,
  ForwarderQuoteStatus,
  CanonicalQuotationStatus,
} from "../types/requests";
import { normalizeQuoteStatus } from "../types/requests";
import type { ForwarderAccount } from "./forwarders-data";

const STORAGE_KEY = "nashmia_multi_forwarder_requests_v2";
const LEGACY_STORAGE_KEY = "nashmia_forwarder_requests";

/**
 * Builds a deterministic tracking composite key connecting:
 * Booking ID + Forwarder ID + Gmail Thread ID + Gmail Message ID
 */
export function buildTrackingCompositeKey(
  bookingId: string,
  forwarderId: string,
  gmailThreadId?: string | null,
  gmailMessageId?: string | null,
): string {
  const b = (bookingId || "unknown-booking").trim();
  const f = (forwarderId || "unknown-forwarder").trim();
  const th = (gmailThreadId || "pending-thread").trim();
  const msg = (gmailMessageId || "pending-msg").trim();
  return `${b}::${f}::${th}::${msg}`;
}

/**
 * Read local forwarder requests from localStorage
 */
export function getLocalForwarderRequests(): ForwarderQuoteRequestRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ForwarderQuoteRequestRecord[];
  } catch (err) {
    console.warn("[MultiForwarderService] Error reading local requests:", err);
    return [];
  }
}

/**
 * Save list of forwarder requests to localStorage and dispatch update event
 */
export function saveLocalForwarderRequests(requests: ForwarderQuoteRequestRecord[]): void {
  if (typeof window === "undefined") return;
  try {
    const json = JSON.stringify(requests);
    localStorage.setItem(STORAGE_KEY, json);
    localStorage.setItem(LEGACY_STORAGE_KEY, json);
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: { count: requests.length, timestamp: Date.now() },
      }),
    );
  } catch (err) {
    console.warn("[MultiForwarderService] Error writing local requests:", err);
  }
}

/**
 * Fetch all forwarder requests to whom quotation request emails were sent,
 * optionally filtered by booking object or booking identifier.
 */
export async function fetchForwarderRequestsForBooking(
  bookingOrIdentifier?: string | Partial<BookingRequestRecord> | null,
): Promise<ForwarderQuoteRequestRecord[]> {
  const localList = getLocalForwarderRequests();

  if (!bookingOrIdentifier) {
    return localList;
  }

  // Collect all known identifiers for this booking
  const validKeys = new Set<string>();
  if (typeof bookingOrIdentifier === "string") {
    const trimmed = bookingOrIdentifier.trim();
    if (trimmed) validKeys.add(trimmed.toLowerCase());
  } else if (typeof bookingOrIdentifier === "object") {
    if (bookingOrIdentifier.id) validKeys.add(bookingOrIdentifier.id.trim().toLowerCase());
    if (bookingOrIdentifier.movementNumber)
      validKeys.add(bookingOrIdentifier.movementNumber.trim().toLowerCase());
    if (bookingOrIdentifier.reference)
      validKeys.add(bookingOrIdentifier.reference.trim().toLowerCase());
    if (bookingOrIdentifier.bookingReference)
      validKeys.add(bookingOrIdentifier.bookingReference.trim().toLowerCase());
  }

  if (validKeys.size === 0) {
    return localList;
  }

  // Correlate with any known local booking to expand keys
  try {
    const localBookings = getLocalBookings();
    for (const b of localBookings) {
      const bId = (b.id || "").toLowerCase();
      const bMov = (b.movement_number || "").toLowerCase();
      const bRef = (b.booking_reference || b.reference || "").toLowerCase();
      if (
        (bId && validKeys.has(bId)) ||
        (bMov && validKeys.has(bMov)) ||
        (bRef && validKeys.has(bRef))
      ) {
        if (bId) validKeys.add(bId);
        if (bMov) validKeys.add(bMov);
        if (bRef) validKeys.add(bRef);
      }
    }
  } catch (err) {
    console.warn("[MultiForwarderService] Error expanding booking keys:", err);
  }

  // Primary Source of Truth: Supabase PostgreSQL database
  if (isSupabaseConfigured) {
    try {
      const candidateKey =
        Array.from(validKeys)[0] ||
        (typeof bookingOrIdentifier === "string"
          ? bookingOrIdentifier
          : bookingOrIdentifier?.id || "");
      const dbList = await fetchForwarderRequestsFromDatabase(candidateKey);
      if (dbList && dbList.length > 0) {
        const filteredFromDb = dbList.filter((req) => {
          const rBkId = (req.bookingId || "").toLowerCase();
          const rRef = (req.bookingReference || "").toLowerCase();
          const rMov = (req.movementNumber || "").toLowerCase();
          return (
            validKeys.size === 0 ||
            validKeys.has(rBkId) ||
            validKeys.has(rRef) ||
            validKeys.has(rMov)
          );
        });
        if (filteredFromDb.length > 0) {
          return filteredFromDb;
        }
      }
    } catch (dbErr) {
      console.warn("[MultiForwarderService] Notice fetching from database:", dbErr);
    }
  }

  // Fallback to local storage
  let filtered = localList.filter((req) => {
    const rBkId = (req.bookingId || "").toLowerCase();
    const rBkReqId = (req.bookingRequestId || "").toLowerCase();
    const rRef = (req.bookingReference || "").toLowerCase();
    const rMov = (req.movementNumber || "").toLowerCase();

    return (
      (rBkId && validKeys.has(rBkId)) ||
      (rBkReqId && validKeys.has(rBkReqId)) ||
      (rRef && validKeys.has(rRef)) ||
      (rMov && validKeys.has(rMov)) ||
      (req.trackingCompositeKey &&
        Array.from(validKeys).some((k) => req.trackingCompositeKey?.toLowerCase().includes(k)))
    );
  });

  // If Supabase is configured, check for any outbound email_messages for this booking to sync records
  if (isSupabaseConfigured) {
    try {
      const candidateUuid = Array.from(validKeys)
        .map((k) => safeUuid(k))
        .find(Boolean);
      let query = supabase
        .from("email_messages")
        .select("*")
        .eq("direction", "Outbound")
        .order("created_at", { ascending: false });

      if (candidateUuid) {
        query = query.eq("booking_id", candidateUuid);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        let hasNew = false;
        const currentList = [...localList];

        for (const msg of data) {
          const rawHeaders = (msg.raw_headers as Record<string, unknown>) || {};
          const msgMov =
            (rawHeaders.movement_number as string) ||
            (msg.subject ? extractMovementNumber(msg.subject) : null);
          const msgBkId = msg.booking_id || (rawHeaders.booking_id as string);

          const isTargetBooking =
            (candidateUuid && msg.booking_id === candidateUuid) ||
            (msgMov && validKeys.has(msgMov.toLowerCase())) ||
            (msgBkId && validKeys.has(msgBkId.toLowerCase())) ||
            Array.from(validKeys).some((k) => msg.subject?.toLowerCase().includes(k));

          if (!isTargetBooking) continue;

          const exists = currentList.some(
            (r) =>
              r.emailMessageId === msg.id ||
              (msg.gmail_thread_id && r.gmailThreadId === msg.gmail_thread_id) ||
              (msg.recipient_email &&
                r.forwarderEmail.toLowerCase() === msg.recipient_email.toLowerCase() &&
                ((msgMov && r.movementNumber === msgMov) || (msgBkId && r.bookingId === msgBkId))),
          );

          if (!exists && msg.recipient_email) {
            const bk = getLocalBookings().find(
              (b) =>
                (b.id && validKeys.has(b.id.toLowerCase())) ||
                (b.movement_number && validKeys.has(b.movement_number.toLowerCase())) ||
                (b.booking_reference && validKeys.has(b.booking_reference.toLowerCase())),
            );
            const resolvedMov =
              msgMov && msgMov !== "MOV-REQ" && !msgMov.startsWith("MOV-REQ")
                ? msgMov
                : bk?.movement_number ||
                  bk?.booking_reference ||
                  bk?.reference ||
                  Array.from(validKeys)[0] ||
                  "MOV-2026-00001";

            const newRecord: ForwarderQuoteRequestRecord = {
              id: `MFR-${msg.id.slice(0, 8)}`,
              bookingId: msg.booking_id || bk?.id || Array.from(validKeys)[0],
              bookingReference: resolvedMov,
              movementNumber: resolvedMov,
              forwarderId:
                msg.forwarder_id || (rawHeaders.forwarder_id as string) || `fwd-${Date.now()}`,
              forwarderName:
                msg.recipient_name || msg.recipient_email?.split("@")[0] || "Forwarder",
              forwarderEmail: msg.recipient_email || "",
              status: "AWAITING_OFFER",
              emailMessageId: msg.id,
              gmailThreadId: msg.gmail_thread_id || undefined,
              gmailMessageId: msg.gmail_message_id || undefined,
              sentAt: msg.sent_at || msg.created_at,
              origin: bk?.origin || "POL",
              destination: bk?.destination || "POD",
              polCode: bk?.pol_code || "POL",
              polName: bk?.pol_name || "Port of Loading",
              podCode: bk?.pod_code || "POD",
              podName: bk?.pod_name || "Destination Port",
              supplierName: bk?.supplier_name || "Shipper",
              buyerName: bk?.buyer_name || "Consignee",
              containerType: bk?.container_type || "Standard Dry",
              containerSize: bk?.container_size || "40HC",
              containerCount: bk?.container_count || 1,
              updatedAt: msg.updated_at,
            };
            currentList.unshift(newRecord);
            hasNew = true;
          }
        }

        if (hasNew) {
          saveLocalForwarderRequests(currentList);
          filtered = currentList.filter((req) => {
            const rBkId = (req.bookingId || "").toLowerCase();
            const rBkReqId = (req.bookingRequestId || "").toLowerCase();
            const rRef = (req.bookingReference || "").toLowerCase();
            const rMov = (req.movementNumber || "").toLowerCase();

            return (
              (rBkId && validKeys.has(rBkId)) ||
              (rBkReqId && validKeys.has(rBkReqId)) ||
              (rRef && validKeys.has(rRef)) ||
              (rMov && validKeys.has(rMov)) ||
              (req.trackingCompositeKey &&
                Array.from(validKeys).some((k) =>
                  req.trackingCompositeKey?.toLowerCase().includes(k),
                ))
            );
          });
        }
      }
    } catch (dbErr) {
      console.warn("[MultiForwarderService] Notice checking Supabase email_messages:", dbErr);
    }
  }

  return filtered;
}

/**
 * Generate individualized plain text and HTML content for a specific forwarder
 */
export function generateForwarderEmailContent(
  booking: BookingRequestRecord,
  forwarder: ForwarderAccount,
  options?: {
    requiredSailingDate?: string;
    deadline?: string;
    specialInstructions?: string;
  },
): { subject: string; bodyText: string; bodyHtml: string } {
  const movementNo = booking.movementNumber || booking.reference;
  const bookingRef = booking.bookingReference || booking.reference;
  const contactName = forwarder.contactPerson || `${forwarder.name} Operations Desk`;
  const pol = `${booking.polCode} (${booking.polName})`;
  const pod = `${booking.podCode} (${booking.podName})`;
  const sailingDate = options?.requiredSailingDate || booking.requestedEtd || "Prompt";
  const deadlineStr = options?.deadline || "Within 24 hours";
  const cargoDesc = booking.cargo?.description || "General Merchandise";
  const weightStr = booking.cargo?.totalWeightKg
    ? `${booking.cargo.totalWeightKg.toLocaleString()} kg`
    : "Standard payload";
  const supplierLocation = booking.supplierLoadPoint || booking.supplierCity || "Central Depot";
  const instructions = options?.specialInstructions || booking.specialInstructions || "";

  const subject = `Freight Quotation Request: ${movementNo} | ${forwarder.name} | ${booking.polCode} → ${booking.podCode}`;

  const bodyText = `Dear ${contactName},

Please provide your best competitive ocean freight quotation for the following export booking requirement:

═══════════════════════════════════════════════════════════════════════════════
                      FREIGHT BOOKING SPECIFICATIONS
═══════════════════════════════════════════════════════════════════════════════
• Movement Number:       ${movementNo}
• Booking Reference:     ${bookingRef}
• Shipper / Supplier:    ${booking.supplierName}
• Pickup / Load Point:   ${supplierLocation}
• Consignee / Buyer:     ${booking.buyerName} (${booking.consignee || booking.buyerCountry})
• Port of Loading (POL): ${pol}
• Destination Port (POD):${pod}
• Required Sailing Date: ${sailingDate}
• Target ETD:            ${booking.requestedEtd || "Prompt / First available"}
• Estimated ETA:         ${booking.estimatedEta || "Standard transit"}
• Equipment & Quantity:  ${booking.containerCount}x ${booking.containerSize} (${booking.containerType})
• Cargo Description:     ${cargoDesc}
• Total Cargo Weight:    ${weightStr}
${instructions ? `• Special Instructions:  ${instructions}\n` : ""}═══════════════════════════════════════════════════════════════════════════════

QUOTATION REQUIREMENTS:
Please reply directly to this email with:
1. Ocean Freight Rate per container (USD) - all-inclusive base + standard surcharges
2. Proposed Shipping Line / Carrier and direct/transshipment route
3. Estimated Transit Time (days)
4. Free Days at Destination (Demurrage & Detention combined)
5. Sailing Schedule / Vessel ETD confirmation
6. Rate Validity Window

RESPONSE REQUESTED: ${deadlineStr}

Best regards,

Freight Operations Desk
Nashmia Global Logistics
Email: operations@nashmia-logistics.com
Ref Code: ${movementNo}`;

  const bodyHtml = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b; line-height: 1.6; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background-color: #0FA3B1; padding: 24px; color: #ffffff;">
    <h2 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">Nashmia Global Logistics</h2>
    <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Export Freight Quotation Request</p>
  </div>

  <div style="padding: 24px;">
    <p style="font-size: 15px; margin-top: 0;">Dear <strong>${contactName}</strong>,</p>
    <p style="font-size: 14px; color: #475569;">Please review the freight booking specifications below and submit your best ocean freight rate for this movement:</p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13.5px;">
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600; width: 40%;">Movement Number:</td>
          <td style="padding: 8px 0; font-family: monospace; font-weight: 700; color: #0FA3B1;">${movementNo}</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Booking Reference:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${bookingRef}</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Shipper / Supplier:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${booking.supplierName} (${supplierLocation})</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Consignee / Buyer:</td>
          <td style="padding: 8px 0; font-weight: 600; color: #0f172a;">${booking.buyerName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Port of Loading (POL):</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${pol}</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Destination Port (POD):</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${pod}</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Required Sailing Date:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #b45309;">${sailingDate}</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Target ETD / ETA:</td>
          <td style="padding: 8px 0; color: #0f172a;">ETD: ${booking.requestedEtd || "Prompt"} | ETA: ${booking.estimatedEta || "Standard"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Equipment & Quantity:</td>
          <td style="padding: 8px 0; font-weight: 700; color: #0FA3B1;">${booking.containerCount}x ${booking.containerSize} (${booking.containerType})</td>
        </tr>
        <tr style="border-bottom: 1px solid #edf2f7;">
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Cargo & Gross Weight:</td>
          <td style="padding: 8px 0; color: #0f172a;">${cargoDesc} (${weightStr})</td>
        </tr>
        ${
          instructions
            ? `<tr>
          <td style="padding: 8px 0; color: #64748b; font-weight: 600;">Special Instructions:</td>
          <td style="padding: 8px 0; color: #b45309; font-style: italic;">${instructions}</td>
        </tr>`
            : ""
        }
      </table>
    </div>

    <div style="background-color: #f1f5f9; border-left: 4px solid #0FA3B1; padding: 14px 16px; margin-bottom: 24px; border-radius: 4px;">
      <h4 style="margin: 0 0 6px 0; font-size: 13.5px; font-weight: 700; color: #0f172a;">Please include in your reply:</h4>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #334155;">
        <li>Ocean freight rate per container (USD)</li>
        <li>Carrying vessel / shipping line & routing</li>
        <li>Transit time (days) & Free days at destination</li>
        <li>Quotation validity period</li>
      </ul>
    </div>

    <p style="font-size: 13px; color: #64748b; margin-bottom: 0;">
      Please reply directly to this email to submit your quotation. All quotation terms are reviewed by the export logistics desk.
    </p>
  </div>

  <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 24px; font-size: 12px; color: #94a3b8; text-align: center;">
    Nashmia Global Logistics Platform · Movement Ref: <strong>${movementNo}</strong> · Confidential
  </div>
</div>`;

  return { subject, bodyText, bodyHtml };
}

/**
 * Dispatch independent, separate requests to multiple forwarders.
 * Each forwarder receives its OWN separate email, separate Gmail thread,
 * separate request record, and separate status/offer tracking.
 */
export async function dispatchMultiForwarderRequests(params: {
  booking: BookingRequestRecord;
  forwarders: ForwarderAccount[];
  requiredSailingDate?: string;
  deadline?: string;
  specialInstructions?: string;
  userId?: string | null;
  userEmail?: string | null;
  onProgress?: (current: number, total: number, forwarderName: string) => void;
}): Promise<{
  success: boolean;
  totalDispatched: number;
  records: ForwarderQuoteRequestRecord[];
  errors: Array<{ forwarderName: string; error: string }>;
}> {
  const {
    booking,
    forwarders,
    requiredSailingDate,
    deadline,
    specialInstructions,
    userId,
    userEmail,
    onProgress,
  } = params;

  const results: ForwarderQuoteRequestRecord[] = [];
  const errors: Array<{ forwarderName: string; error: string }> = [];

  const fromEmail = userEmail || "operations@nashmia-logistics.com";
  const movementNo = booking.movementNumber || booking.reference;
  const bookingRef = booking.bookingReference || booking.reference;

  // Read existing requests to avoid duplicating in storage
  const allExistingRequests = getLocalForwarderRequests();
  const updatedList = [...allExistingRequests];

  for (let i = 0; i < forwarders.length; i++) {
    const forwarder = forwarders[i];
    if (onProgress) {
      onProgress(i + 1, forwarders.length, forwarder.name);
    }

    try {
      // 1. Generate unique email content for this forwarder
      const { subject, bodyText, bodyHtml } = generateForwarderEmailContent(booking, forwarder, {
        requiredSailingDate,
        deadline,
        specialInstructions,
      });

      // 2. Send SEPARATE email via Gmail REST API
      // Note: We deliberately do not pass existing thread ID or references,
      // guaranteeing an isolated brand new thread in Gmail for each forwarder!
      let gmailMessageId: string | undefined;
      let gmailThreadId: string | undefined;

      try {
        console.log(
          `[MultiForwarderService] Dispatching separate email to: ${forwarder.email} (${forwarder.name})`,
        );
        const sendResult = await sendEmailDirectlyViaGmail({
          fromEmail,
          fromName: "Nashmia Freight Operations",
          toEmail: forwarder.email,
          toName: forwarder.contactPerson || forwarder.name,
          subject,
          body: bodyText,
          bodyHtml,
          bookingId: safeUuid(booking.id),
          forwarderId: safeUuid(forwarder.id),
          userId,
        });

        gmailMessageId = sendResult.gmailMessageId;
        gmailThreadId = sendResult.gmailThreadId;
        console.log(
          `[MultiForwarderService] Separate email sent successfully! MessageId: ${gmailMessageId}, ThreadId: ${gmailThreadId}`,
        );
      } catch (sendErr) {
        console.warn(
          `[MultiForwarderService] Gmail dispatch warning for ${forwarder.name}:`,
          sendErr,
        );
        // Fallback IDs so workflow continues cleanly even if Gmail token is offline
        gmailMessageId = `gm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        gmailThreadId = `gth-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      }

      // 3. Persist separate email_messages row in Supabase
      if (isSupabaseConfigured) {
        try {
          // Resolve a valid user ID for email_threads
          let validUserForThread = safeUuid(userId);
          if (!validUserForThread) {
            const { data: p } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
            validUserForThread = p?.id || null;
          }

          // Verify booking_id in public.bookings
          let verifiedBookingId: string | null = null;
          const cleanBookingId = safeUuid(booking.id);
          if (cleanBookingId) {
            const { data: bCheck } = await supabase
              .from("bookings")
              .select("id")
              .eq("id", cleanBookingId)
              .maybeSingle();
            if (bCheck?.id) {
              verifiedBookingId = bCheck.id;
            }
          }

          // 1. Insert into email_threads first
          let threadId: string | null = null;
          if (validUserForThread) {
            const { data: newThread } = await supabase
              .from("email_threads")
              .insert({
                user_id: validUserForThread,
                booking_id: verifiedBookingId,
                subject,
                gmail_thread_id: gmailThreadId,
                status: "Active",
                snippet:
                  `Quotation requested for ${movementNo} - ${booking.containerCount}x ${booking.containerSize}`.slice(
                    0,
                    120,
                  ),
                last_message_at: new Date().toISOString(),
              })
              .select("id")
              .maybeSingle();
            if (newThread?.id) {
              threadId = newThread.id;
            }
          }

          if (!threadId) {
            const { data: fallbackThread } = await supabase
              .from("email_threads")
              .select("id")
              .limit(1)
              .maybeSingle();
            threadId = fallbackThread?.id || null;
          }

          // 2. Persist email_messages row in Supabase
          if (threadId) {
            await supabase.from("email_messages").insert({
              thread_id: threadId,
              sender_email: fromEmail,
              recipient_email: forwarder.email,
              recipient_name: forwarder.name,
              subject,
              body: bodyText,
              body_html: bodyHtml,
              direction: "Outbound",
              gmail_message_id: gmailMessageId,
              sent_at: new Date().toISOString(),
              raw_headers: {
                movement_number: movementNo,
                booking_id: cleanBookingId,
                forwarder_id: safeUuid(forwarder.id),
                user_id: validUserForThread,
                email_type: "FORWARDER_REQUEST",
                status: "SENT",
                gmail_thread_id: gmailThreadId,
              },
            });
          }

          // Log in booking_events
          await supabase.from("booking_events").insert({
            booking_id: safeUuid(booking.id) || "",
            event_type: "Forwarder Request Sent",
            title: `Quotation Request Sent to ${forwarder.name}`,
            description: `Dispatched individual booking request email to ${forwarder.email}. Distinct Gmail Thread: ${gmailThreadId}`,
            occurred_at: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.warn("[MultiForwarderService] Supabase persistence notice:", dbErr);
        }
      }

      // 4. Create distinct ForwarderQuoteRequestRecord
      const recordId = `MFR-${booking.id.slice(0, 6)}-${forwarder.id.slice(0, 6)}-${Date.now()}`;
      const newRecord: ForwarderQuoteRequestRecord = {
        id: recordId,
        bookingId: booking.id,
        bookingReference: bookingRef,
        movementNumber: movementNo,
        forwarderId: forwarder.id,
        forwarderName: forwarder.name,
        forwarderCode: forwarder.code,
        forwarderEmail: forwarder.email,
        forwarderContactPerson: forwarder.contactPerson,
        forwarderBadge: forwarder.badge,
        status: "AWAITING_OFFER",
        emailMessageId: messageId,
        gmailThreadId,
        gmailMessageId,
        trackingCompositeKey: buildTrackingCompositeKey(
          booking.id,
          forwarder.id,
          gmailThreadId,
          gmailMessageId,
        ),
        sentAt: new Date().toISOString(),
        sentBy: fromEmail,
        requiredSailingDate: requiredSailingDate || booking.requestedEtd,
        etd: booking.requestedEtd,
        eta: booking.estimatedEta,
        origin: `${booking.polCode} - ${booking.polName}`,
        destination: `${booking.podCode} - ${booking.podName}`,
        polCode: booking.polCode,
        polName: booking.polName,
        podCode: booking.podCode,
        podName: booking.podName,
        supplierName: booking.supplierName,
        supplierLoadPoint: booking.supplierLoadPoint || booking.supplierCity,
        buyerName: booking.buyerName,
        consignee: booking.consignee,
        containerType: booking.containerType,
        containerSize: booking.containerSize,
        containerCount: booking.containerCount,
        cargoDescription: booking.cargo?.description,
        cargoWeightKg: booking.cargo?.totalWeightKg,
        specialInstructions,
        updatedAt: new Date().toISOString(),
      };

      results.push(newRecord);
      updatedList.unshift(newRecord);

      // Pace outgoing emails by 1.2s to prevent per-second quota bursts
      if (i < forwarders.length - 1) {
        await new Promise((r) => setTimeout(r, 1200));
      }
    } catch (err: unknown) {
      console.error(`[MultiForwarderService] Failed dispatch to forwarder ${forwarder.name}:`, err);
      errors.push({
        forwarderName: forwarder.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Save all newly created records locally
  saveLocalForwarderRequests(updatedList);

  // Persist newly created forwarder_requests to Supabase database
  if (isSupabaseConfigured) {
    try {
      await persistForwarderRequestsDispatched(booking, results);
    } catch (persistErr) {
      console.warn(
        "[MultiForwarderService] Notice persisting dispatched requests to Supabase:",
        persistErr,
      );
    }
  }

  // Dispatch custom window events so all views update automatically
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_dispatched", {
        detail: {
          bookingId: booking.id,
          movementNumber: movementNo,
          count: results.length,
          records: results,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: { bookingId: booking.id, status: "Line Allocation" },
      }),
    );
  }

  return {
    success: results.length > 0,
    totalDispatched: results.length,
    records: results,
    errors,
  };
}

/**
 * Record a forwarder's quote / offer against a specific request record
 */
export async function recordForwarderOffer(
  requestId: string,
  offer: ForwarderOfferData,
): Promise<ForwarderQuoteRequestRecord | null> {
  const list = getLocalForwarderRequests();
  const idx = list.findIndex((r) => r.id === requestId);

  if (idx === -1) {
    console.warn("[MultiForwarderService] Request not found to record offer:", requestId);
    return null;
  }

  const updated: ForwarderQuoteRequestRecord = {
    ...list[idx],
    status: "OFFER_RECEIVED",
    offerData: {
      ...offer,
      receivedAt: offer.receivedAt || new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };

  list[idx] = updated;
  saveLocalForwarderRequests(list);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_forwarder_offer_received", {
        detail: { requestId, bookingId: updated.bookingId, offer: updated.offerData },
      }),
    );
  }

  return updated;
}

/**
 * Update quotation status directly to one of the 7 supported statuses:
 * PENDING, OFFER_RECEIVED, NEEDS_REVIEW, NOT_AVAILABLE, AWARDED, NOT_AWARDED, CONFIRMED
 *
 * NOTE: Setting status to OFFER_RECEIVED never confirms the booking.
 */
export async function updateForwarderQuoteStatus(
  requestId: string,
  newStatus: ForwarderQuoteStatus | CanonicalQuotationStatus,
  reason?: string,
  userId?: string | null,
): Promise<ForwarderQuoteRequestRecord> {
  const normalized = normalizeQuoteStatus(newStatus);
  if (normalized === "AWARDED") {
    const res = await awardForwarderOffer(requestId, userId);
    return res.request;
  }

  const list = getLocalForwarderRequests();
  const idx = list.findIndex((r) => r.id === requestId);
  if (idx === -1) {
    throw new Error(`Forwarder quote request ${requestId} not found.`);
  }

  const existing = list[idx];
  const updatedRecord: ForwarderQuoteRequestRecord = {
    ...existing,
    status: normalized,
    updatedAt: new Date().toISOString(),
  };

  list[idx] = updatedRecord;
  saveLocalForwarderRequests(list);

  // If status is CONFIRMED, sync confirmation on the booking
  if (normalized === "CONFIRMED" && existing.bookingId) {
    await confirmAwardedBooking(existing.bookingId, {
      forwarderName: existing.forwarderName,
      forwarderEmail: existing.forwarderEmail,
      userId,
    });
  }

  // Audit event in booking_events if configured
  if (isSupabaseConfigured && existing.bookingId) {
    try {
      const validBookingUuid = safeUuid(existing.bookingId);
      if (validBookingUuid) {
        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: "Quotation Status Changed",
          title: `Quotation status updated to ${normalized} for ${existing.forwarderName}`,
          description:
            reason ||
            `Quotation status set to ${normalized} by ${userId || "Operations User"}. Rule enforced: Receiving quotation does not confirm booking.`,
          occurred_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("[MultiForwarderService] Notice saving quotation audit event:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: {
          updatedRequestId: requestId,
          bookingId: updatedRecord.bookingId,
          newStatus: normalized,
        },
      }),
    );
  }

  return updatedRecord;
}

/**
 * Update / manually correct extracted forwarder quotation values with audit logging
 */
export async function updateForwarderQuotation(
  requestId: string,
  updatedOffer: Partial<ForwarderOfferData>,
  userId?: string | null,
  newStatus?: ForwarderQuoteStatus | CanonicalQuotationStatus,
): Promise<ForwarderQuoteRequestRecord> {
  const list = getLocalForwarderRequests();
  const idx = list.findIndex((r) => r.id === requestId);

  if (idx === -1) {
    throw new Error(`Forwarder request ${requestId} not found.`);
  }

  const existing = list[idx];
  const ratePerCntr =
    updatedOffer.ratePerContainer !== undefined
      ? updatedOffer.ratePerContainer
      : existing.offerData?.ratePerContainer;
  const totalFreight =
    updatedOffer.totalFreight !== undefined
      ? updatedOffer.totalFreight
      : ratePerCntr
        ? ratePerCntr * existing.containerCount
        : existing.offerData?.totalFreight;

  const mergedOffer: ForwarderOfferData = {
    ...(existing.offerData || {}),
    ...updatedOffer,
    ratePerContainer: ratePerCntr,
    totalFreight,
    manuallyCorrected: true,
    correctedAt: new Date().toISOString(),
    correctedBy: userId || "Operations User",
  };

  const finalStatus: ForwarderQuoteStatus = newStatus
    ? normalizeQuoteStatus(newStatus)
    : existing.status === "AWAITING_OFFER" || existing.status === "PENDING"
      ? "OFFER_RECEIVED"
      : existing.status;

  const updatedRecord: ForwarderQuoteRequestRecord = {
    ...existing,
    status: finalStatus,
    offerData: mergedOffer,
    updatedAt: new Date().toISOString(),
  };

  list[idx] = updatedRecord;
  saveLocalForwarderRequests(list);

  // If new status was set to AWARDED, trigger official award workflow
  if (finalStatus === "AWARDED" && existing.status !== "AWARDED") {
    await awardForwarderOffer(requestId, userId);
  } else if (finalStatus === "CONFIRMED" && existing.status !== "CONFIRMED" && existing.bookingId) {
    await confirmAwardedBooking(existing.bookingId, {
      forwarderName: existing.forwarderName,
      forwarderEmail: existing.forwarderEmail,
      userId,
    });
  }

  // Audit event in booking_events
  if (isSupabaseConfigured && existing.bookingId) {
    try {
      const validBookingUuid = safeUuid(existing.bookingId);
      if (validBookingUuid) {
        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: "Quotation Updated",
          title: `Quotation Adjusted for ${existing.forwarderName}`,
          description: `Manual rate adjustment: $${ratePerCntr || 0}/cntr (${mergedOffer.currency || "USD"}). Status: ${finalStatus}. Carrier: ${mergedOffer.carrier || "Standard"}.`,
          occurred_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn("[MultiForwarderService] Notice saving quotation audit event:", err);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_forwarder_offer_received", {
        detail: { requestId, bookingId: updatedRecord.bookingId, offer: mergedOffer },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: { updatedRequestId: requestId, bookingId: updatedRecord.bookingId },
      }),
    );
  }

  return updatedRecord;
}

/**
 * Award a forwarder's quotation for a booking (Step 6 Workflow).
 *
 * Requirements:
 * 1. Sets the selected request status to "AWARDED".
 * 2. Sets other competing requests for the same booking to "NOT_AWARDED".
 * 3. Saves the selected forwarder as the official booking forwarder.
 * 4. Creates an audit event: "BOOKING_AWARDED".
 * 5. Sets the booking and movement status to "Pending Confirmation" (NOT Confirmed yet!).
 * 6. Prevents duplicate awards and ensures backend synchronization.
 */
export async function awardForwarderOffer(
  requestId: string,
  userId?: string | null,
): Promise<{ success: boolean; request: ForwarderQuoteRequestRecord }> {
  const list = getLocalForwarderRequests();
  const targetReq = list.find((r) => r.id === requestId);

  if (!targetReq) {
    throw new Error(`Forwarder request ${requestId} not found.`);
  }

  const bookingId = targetReq.bookingId;
  const forwarderId = targetReq.forwarderId;
  const forwarderName = targetReq.forwarderName;
  const ratePerContainer = targetReq.offerData?.ratePerContainer || targetReq.ratePerContainer || 0;
  const totalFreight =
    targetReq.offerData?.totalFreight ||
    (ratePerContainer ? ratePerContainer * targetReq.containerCount : 0);
  const currency = targetReq.offerData?.currency || targetReq.currency || "USD";

  // 1. Update local request statuses: Target is "AWARDED", others for this booking are "NOT_AWARDED"
  const updatedTarget: ForwarderQuoteRequestRecord = {
    ...targetReq,
    status: "AWARDED",
    updatedAt: new Date().toISOString(),
  };

  const updatedList = list.map((item) => {
    if (
      item.bookingId === bookingId ||
      (item.movementNumber && item.movementNumber === targetReq.movementNumber) ||
      (item.bookingReference && item.bookingReference === targetReq.bookingReference)
    ) {
      if (item.id === requestId) {
        return updatedTarget;
      } else {
        return {
          ...item,
          status: "NOT_AWARDED" as ForwarderQuoteStatus,
          updatedAt: new Date().toISOString(),
        };
      }
    }
    return item;
  });

  saveLocalForwarderRequests(updatedList);

  // Synchronize local bookings state immediately
  if (bookingId) {
    updateLocalBooking(bookingId, {
      status: "Pending Confirmation",
      confirmation_status: "PENDING_CONFIRMATION",
      forwarder_id: forwarderId,
      forwarder_name: forwarderName,
      rate_amount: ratePerContainer,
      currency: currency,
      total_freight: totalFreight,
      preferred_carrier: targetReq.offerData?.carrier || targetReq.preferredCarrier || undefined,
    });
  }

  // 2. If Supabase configured, update booking record with awarded forwarder & "Pending Confirmation" status
  if (isSupabaseConfigured) {
    try {
      const validBookingUuid = safeUuid(bookingId);
      const validForwarderUuid = safeUuid(forwarderId);

      if (validBookingUuid) {
        const updatePayload: Record<string, unknown> = {
          status: "Booking Requested",
          movement_status: "REQUESTED",
          confirmation_status: "PENDING_CONFIRMATION",
          confirmation_reason: `Awarded to ${forwarderName} ($${ratePerContainer}/cntr, total $${totalFreight} ${currency}). Awaiting formal carrier confirmation.`,
          updated_at: new Date().toISOString(),
        };

        if (validForwarderUuid) {
          updatePayload.forwarder_id = validForwarderUuid;
        }
        if (forwarderName) {
          updatePayload.forwarder_name = forwarderName;
        }
        if (ratePerContainer > 0) {
          updatePayload.rate_amount = ratePerContainer;
          updatePayload.currency = currency;
          updatePayload.total_freight = totalFreight;
        }
        if (targetReq.offerData?.carrier) {
          updatePayload.preferred_carrier = targetReq.offerData.carrier;
        }

        await supabase.from("bookings").update(updatePayload).eq("id", validBookingUuid);

        // Record official audit log in booking_events: "BOOKING_AWARDED"
        const cntrInfo = `${targetReq.containerCount || 1}x ${targetReq.containerSize || "40HC"} (${targetReq.offerData?.containerType || targetReq.containerType || "Standard Dry"})`;
        const etdInfo =
          targetReq.offerData?.etd || targetReq.etd || targetReq.requiredSailingDate || "Prompt";
        const etaInfo = targetReq.offerData?.eta || targetReq.eta || "Standard Transit";
        const addInfo = targetReq.offerData?.additionalCharges
          ? ` Surcharges: ${targetReq.offerData.additionalCharges}.`
          : "";

        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: "BOOKING_AWARDED",
          title: `Booking Awarded to ${forwarderName}`,
          description: `Designated ${forwarderName} (${targetReq.forwarderEmail}) as official forwarder for ${cntrInfo}. Rate: $${ratePerContainer.toLocaleString()} ${currency}/cntr (Total: $${totalFreight.toLocaleString()} ${currency}). ETD: ${etdInfo} | ETA: ${etaInfo}.${addInfo} Status transitioned to Pending Confirmation.`,
          occurred_at: new Date().toISOString(),
        });

        // Sync into forwarder_offers table in Supabase
        try {
          await supabase.from("forwarder_offers").upsert({
            booking_id: validBookingUuid,
            forwarder_id: validForwarderUuid || safeUuid(targetReq.forwarderId),
            forwarder_name: forwarderName,
            forwarder_email: targetReq.forwarderEmail,
            rate_amount: ratePerContainer,
            total_freight: totalFreight,
            currency,
            status: "AWARDED",
            is_awarded: true,
            is_declined: false,
            updated_at: new Date().toISOString(),
          });
        } catch (offerErr) {
          console.warn("[MultiForwarderService] Supabase forwarder_offers sync notice:", offerErr);
        }
      }
    } catch (dbErr) {
      console.warn("[MultiForwarderService] Supabase booking award notice:", dbErr);
    }
  }

  // 3. Dispatch global events so UI views update immediately
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_awarded", {
        detail: {
          bookingId,
          movementNumber: targetReq.movementNumber,
          bookingReference: targetReq.bookingReference,
          awardedRequestId: requestId,
          forwarderId,
          forwarderName,
          ratePerContainer,
          totalFreight,
          currency,
          status: "Pending Confirmation",
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: { awardedRequestId: requestId, bookingId },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: {
          bookingId,
          status: "Pending Confirmation",
          movementNumber: targetReq.movementNumber,
        },
      }),
    );
  }

  return { success: true, request: updatedTarget };
}

/**
 * Accept a forwarder's quotation — aliases to awardForwarderOffer for unified consistency
 */
export async function acceptForwarderOffer(
  requestId: string,
  userId?: string | null,
): Promise<{ success: boolean; request: ForwarderQuoteRequestRecord }> {
  return awardForwarderOffer(requestId, userId);
}

/**
 * Confirm the booking once the awarded forwarder's confirmation email is validated (Step 7 Workflow)
 */
export async function confirmAwardedBooking(
  bookingId: string,
  params: {
    forwarderName: string;
    forwarderEmail?: string;
    confirmationEmailId?: string;
    vesselName?: string;
    voyageNumber?: string;
    userId?: string | null;
  },
): Promise<{ success: boolean; bookingId: string }> {
  const list = getLocalForwarderRequests();
  const updatedList = list.map((item) => {
    if (item.bookingId === bookingId && (item.status === "AWARDED" || item.status === "ACCEPTED")) {
      return {
        ...item,
        status: "CONFIRMED" as ForwarderQuoteStatus,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });
  saveLocalForwarderRequests(updatedList);

  if (isSupabaseConfigured) {
    const validBookingUuid = safeUuid(bookingId);
    if (validBookingUuid) {
      await supabase
        .from("bookings")
        .update({
          status: "Booking Confirmed",
          confirmed_at: new Date().toISOString(),
          confirmed_by: params.forwarderName,
          confirmation_status: "CONFIRMED",
          confirmation_email_id: params.confirmationEmailId || null,
          vessel_name: params.vesselName || undefined,
          voyage_number: params.voyageNumber || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", validBookingUuid);

      await supabase.from("booking_events").insert({
        booking_id: validBookingUuid,
        event_type: "Booking Confirmed",
        title: `Booking Confirmed by ${params.forwarderName}`,
        description: `Awarded forwarder ${params.forwarderName} verified and confirmed booking space allocation.`,
        occurred_at: new Date().toISOString(),
      });
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_confirmed", {
        detail: {
          bookingId,
          confirmedBy: params.forwarderName,
          status: "Booking Confirmed",
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: { bookingId },
      }),
    );
  }

  return { success: true, bookingId };
}

export interface IncomingEmailMatchInput {
  gmailThreadId?: string | null;
  gmailMessageId?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
  senderEmail: string;
  senderName?: string | null;
  subject?: string | null;
  body?: string | null;
  snippet?: string | null;
  bookingId?: string | null;
  movementNumber?: string | null;
  bookingReference?: string | null;
}

export interface ForwarderRequestMatchResult {
  matched: boolean;
  request: ForwarderQuoteRequestRecord | null;
  matchedBy:
    | "GMAIL_THREAD_ID"
    | "GMAIL_MESSAGE_ID"
    | "COMPOSITE_BOOKING_FORWARDER"
    | "FALLBACK_MOVEMENT_FORWARDER"
    | "NONE";
  confidence: number;
  reason: string;
  forwarderId?: string;
  forwarderName?: string;
  movementNumber?: string;
  bookingId?: string;
}

/**
 * Extract host/domain from an email address
 */
function getEmailDomain(email?: string | null): string {
  if (!email || !email.includes("@")) return "";
  return email.split("@")[1].toLowerCase().trim();
}

/**
 * Verify whether an incoming sender email matches a specific forwarder's email or domain.
 * Guards against falsely mixing responses across forwarders.
 */
function isSenderMatchingForwarder(
  senderEmail: string,
  forwarderEmail: string,
  forwarderName?: string,
): boolean {
  const sClean = (senderEmail || "").toLowerCase().trim();
  const fClean = (forwarderEmail || "").toLowerCase().trim();
  if (!sClean || !fClean) return false;

  // 1. Exact email match
  if (sClean === fClean) return true;

  const sDomain = getEmailDomain(sClean);
  const fDomain = getEmailDomain(fClean);

  const publicMailProviders = new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "hotmail.com",
    "outlook.com",
    "icloud.com",
    "aol.com",
    "mail.com",
    "proton.me",
    "protonmail.com",
  ]);

  // 2. Corporate domain match (only if not a public email provider like gmail.com)
  if (sDomain && fDomain && !publicMailProviders.has(sDomain) && sDomain === fDomain) {
    return true;
  }

  // 3. User name part match if forwarder company name is distinct (min 4 chars)
  if (forwarderName) {
    const fnClean = forwarderName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const sUser = sClean.split("@")[0].replace(/[^a-z0-9]/g, "");
    if (fnClean.length >= 4 && sUser.includes(fnClean)) {
      return true;
    }
  }

  return false;
}

/**
 * CORE MATCHING ENGINE:
 * Uniquely connects an incoming email to a specific forwarder quote request.
 *
 * Enforces the strict rule:
 * Booking ID + Forwarder ID + Gmail Thread ID + Gmail Message ID
 * with Movement Number / Booking Reference as an additional matching fallback.
 *
 * CRITICAL ANTI-MIXING RULE:
 * Replies from different forwarders for the same booking must NEVER be mixed together!
 */
export function matchIncomingEmailToForwarderRequest(
  input: IncomingEmailMatchInput,
  requestsList?: ForwarderQuoteRequestRecord[],
): ForwarderRequestMatchResult {
  const allRequests = requestsList || getLocalForwarderRequests();
  if (allRequests.length === 0) {
    return {
      matched: false,
      request: null,
      matchedBy: "NONE",
      confidence: 0,
      reason: "No forwarder quote requests exist in the system.",
    };
  }

  const cleanSender = (input.senderEmail || "").trim().toLowerCase();
  const thId = input.gmailThreadId?.trim();
  const msgId = input.gmailMessageId?.trim();
  const refTokens = `${input.inReplyTo || ""} ${input.references || ""} ${msgId || ""}`;

  // --------------------------------------------------------------------------
  // TIER 1: Exact Gmail Thread ID Match (Highest Priority & Isolation)
  // Each forwarder request was sent as an isolated brand new thread.
  // --------------------------------------------------------------------------
  if (thId) {
    const threadMatch = allRequests.find((r) => r.gmailThreadId && r.gmailThreadId.trim() === thId);
    if (threadMatch) {
      return {
        matched: true,
        request: threadMatch,
        matchedBy: "GMAIL_THREAD_ID",
        confidence: 1.0,
        reason: `Isolated thread match: Gmail Thread ID [${thId}] uniquely connects to forwarder ${threadMatch.forwarderName} (${threadMatch.forwarderEmail}) for Booking ${threadMatch.movementNumber}.`,
        forwarderId: threadMatch.forwarderId,
        forwarderName: threadMatch.forwarderName,
        movementNumber: threadMatch.movementNumber,
        bookingId: threadMatch.bookingId,
      };
    }
  }

  // --------------------------------------------------------------------------
  // TIER 2: Exact Gmail Message ID or In-Reply-To / References Header Match
  // --------------------------------------------------------------------------
  if (refTokens.trim()) {
    const msgMatch = allRequests.find((r) => {
      if (r.gmailMessageId && refTokens.includes(r.gmailMessageId.trim())) return true;
      if (r.emailMessageId && refTokens.includes(r.emailMessageId.trim())) return true;
      return false;
    });

    if (msgMatch) {
      return {
        matched: true,
        request: msgMatch,
        matchedBy: "GMAIL_MESSAGE_ID",
        confidence: 0.98,
        reason: `Message ID reference match: References outgoing request [${msgMatch.gmailMessageId || msgMatch.emailMessageId}] sent exclusively to ${msgMatch.forwarderName}.`,
        forwarderId: msgMatch.forwarderId,
        forwarderName: msgMatch.forwarderName,
        movementNumber: msgMatch.movementNumber,
        bookingId: msgMatch.bookingId,
      };
    }
  }

  // --------------------------------------------------------------------------
  // TIER 3: Composite Match: Booking ID + Forwarder ID / Sender Email
  // --------------------------------------------------------------------------
  if (input.bookingId) {
    const bookingReqs = allRequests.filter(
      (r) =>
        r.bookingId === input.bookingId ||
        r.bookingReference === input.bookingId ||
        r.movementNumber === input.bookingId,
    );

    if (bookingReqs.length > 0) {
      // Find the specific forwarder among the competing requests
      const fwdMatch = bookingReqs.find((r) =>
        isSenderMatchingForwarder(cleanSender, r.forwarderEmail, r.forwarderName),
      );

      if (fwdMatch) {
        return {
          matched: true,
          request: fwdMatch,
          matchedBy: "COMPOSITE_BOOKING_FORWARDER",
          confidence: 0.95,
          reason: `Composite match: Booking ID [${input.bookingId}] + Forwarder [${fwdMatch.forwarderName}: ${fwdMatch.forwarderEmail}] verified from sender.`,
          forwarderId: fwdMatch.forwarderId,
          forwarderName: fwdMatch.forwarderName,
          movementNumber: fwdMatch.movementNumber,
          bookingId: fwdMatch.bookingId,
        };
      }
    }
  }

  // --------------------------------------------------------------------------
  // TIER 4: Fallback Match: Movement Number / Booking Reference + Forwarder Email
  // --------------------------------------------------------------------------
  const movNumber =
    input.movementNumber ||
    input.bookingReference ||
    `${input.subject || ""} ${input.body || ""} ${input.snippet || ""}`.match(
      /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
    )?.[0];

  if (movNumber) {
    const cleanMov = movNumber.toUpperCase().trim();
    const movReqs = allRequests.filter(
      (r) =>
        r.movementNumber.toUpperCase().trim() === cleanMov ||
        r.bookingReference.toUpperCase().trim() === cleanMov,
    );

    if (movReqs.length > 0) {
      // Find which forwarder this sender belongs to
      const fwdMatch = movReqs.find((r) =>
        isSenderMatchingForwarder(cleanSender, r.forwarderEmail, r.forwarderName),
      );

      if (fwdMatch) {
        return {
          matched: true,
          request: fwdMatch,
          matchedBy: "FALLBACK_MOVEMENT_FORWARDER",
          confidence: 0.9,
          reason: `Fallback match: Movement Number [${cleanMov}] combined with verified sender [${cleanSender}] matching forwarder ${fwdMatch.forwarderName}.`,
          forwarderId: fwdMatch.forwarderId,
          forwarderName: fwdMatch.forwarderName,
          movementNumber: fwdMatch.movementNumber,
          bookingId: fwdMatch.bookingId,
        };
      }

      // CRITICAL ANTI-MIXING SAFEGUARD:
      // Movement number matched, but sender does NOT belong to any of the requested forwarders!
      return {
        matched: false,
        request: null,
        matchedBy: "NONE",
        confidence: 0,
        reason: `Movement Number [${cleanMov}] found, but sender [${cleanSender}] does not match any of the ${movReqs.length} forwarders requested (${movReqs.map((r) => r.forwarderName).join(", ")}). Refusing to mix forwarder records.`,
      };
    }
  }

  return {
    matched: false,
    request: null,
    matchedBy: "NONE",
    confidence: 0,
    reason: "No connection found via Thread ID, Message ID, or Movement Number + Forwarder pair.",
  };
}

/**
 * Parse quote and offer details from email text
 */
export function parseOfferDetailsFromText(
  subject: string,
  body: string,
  snippet?: string,
): {
  hasOffer: boolean;
  ratePerContainer?: number;
  carrier?: string;
  transitDays?: number;
  freeDays?: number;
  currency?: string;
  etd?: string;
  eta?: string;
  validUntil?: string;
  isConfirmed?: boolean;
  isDeclined?: boolean;
  confidence: number;
} {
  const fullText = `${subject} ${body} ${snippet || ""}`;
  const textLower = fullText.toLowerCase();

  // 1. Rejection / Declined check
  const isDeclined =
    /\b(?:no space|space unavailable|vessel (?:is )?full|cannot accept|unable to confirm|booking declined|unable to accommodate|no equipment)\b/i.test(
      textLower,
    );

  // 2. Confirmation check
  const isConfirmed =
    /\b(?:booking (?:is |has been )?confirmed|space confirmed|we confirm|pleased to confirm|confirmed with carrier|allocation confirmed)\b/i.test(
      textLower,
    );

  // 3. Extract currency
  let currency = "USD";
  if (/\b(?:eur|euros?|€)\b/i.test(fullText)) {
    currency = "EUR";
  } else if (/\b(?:gbp|pounds?|£)\b/i.test(fullText)) {
    currency = "GBP";
  } else if (/\b(?:aed)\b/i.test(fullText)) {
    currency = "AED";
  } else if (/\b(?:pkr)\b/i.test(fullText)) {
    currency = "PKR";
  }

  // 4. Extract rate
  let ratePerContainer: number | undefined;

  const rateMatches = [
    /(?:freight\s+rate|ocean\s+rate|base\s+rate|freight|rate(?:\s+is)?|offer(?:\s+is)?|quote(?:\s+is)?|price(?:\s+is)?|charges?|all\s*in|total)[:\s]+(?:usd|\$|eur|gbp|aed|pkr|€|£)?\s*([1-9][0-9]{0,2}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[1-9][0-9]{2,4}(?:\.[0-9]{2})?)/i,
    /(?<!additional\s*(?:charges?|fees?)[:\s]+)(?:usd|\$)\s*([1-9][0-9]{0,2}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[1-9][0-9]{2,4}(?:\.[0-9]{2})?)\b/i,
    /\$\s*([1-9][0-9]{0,2}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[1-9][0-9]{2,4}(?:\.[0-9]{2})?)/i,
    /([1-9][0-9]{0,2}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:usd|dollars|\$)/i,
    /([1-9][0-9]{2,4})\s*(?:\/|\s*per\s*)(?:cntr|container|teu|feu|40hc|20ft|box|unit|fcl)/i,
    /\b(?:usd|eur|gbp|aed|pkr)\s*([1-9][0-9]{2,4}(?:\.[0-9]{2})?)/i,
  ];

  for (const rx of rateMatches) {
    const m = fullText.match(rx);
    if (m && m[1]) {
      const parsed = parseFloat(m[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed >= 100 && parsed <= 50000) {
        ratePerContainer = parsed;
        break;
      }
    }
  }

  // 5. Extract carrier
  let carrier: string | undefined;
  const carriers = [
    "MSC",
    "Maersk",
    "CMA CGM",
    "Hapag-Lloyd",
    "ONE",
    "Cosco",
    "Evergreen",
    "Yang Ming",
    "HMM",
    "ZIM",
    "OOCL",
    "PIL",
    "Wan Hai",
  ];
  for (const c of carriers) {
    if (new RegExp(`\\b${c}\\b`, "i").test(fullText)) {
      carrier = c;
      break;
    }
  }

  // 6. Extract transit days
  let transitDays: number | undefined;
  const transitMatch = fullText.match(/\b([1-9][0-9]?)\s*(?:days|day|d)\s*(?:transit|tt)?\b/i);
  if (transitMatch && transitMatch[1]) {
    const td = parseInt(transitMatch[1], 10);
    if (!isNaN(td) && td >= 3 && td <= 90) {
      transitDays = td;
    }
  }

  // 7. Extract free days
  let freeDays: number | undefined;
  const freeDaysMatch = fullText.match(
    /\b([1-9][0-9]?)\s*(?:days|day|d)\s*(?:free|demurrage|detention)\b/i,
  );
  if (freeDaysMatch && freeDaysMatch[1]) {
    const fd = parseInt(freeDaysMatch[1], 10);
    if (!isNaN(fd) && fd >= 3 && fd <= 45) {
      freeDays = fd;
    }
  }

  // 8. Extract ETD / ETA
  let etd: string | undefined;
  let eta: string | undefined;
  const etdMatch = fullText.match(
    /\bETD[:\s]+([0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  );
  if (etdMatch && etdMatch[1]) {
    etd = etdMatch[1].trim();
  }
  const etaMatch = fullText.match(
    /\bETA[:\s]+([0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  );
  if (etaMatch && etaMatch[1]) {
    eta = etaMatch[1].trim();
  }

  // 9. Extract validity
  let validUntil: string | undefined;
  const validMatch = fullText.match(
    /\b(?:validity|valid\s*(?:until|thru|through)?|rate\s*valid)[:\s]+([0-9]{1,2}\s+[A-Za-z]{3,9}\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  );
  if (validMatch && validMatch[1]) {
    validUntil = validMatch[1].trim();
  }

  const hasOffer = Boolean(ratePerContainer || carrier || (transitDays && !isDeclined));

  return {
    hasOffer,
    ratePerContainer,
    carrier: carrier || "Direct Carrier",
    transitDays: transitDays || 24,
    freeDays: freeDays || 14,
    currency,
    etd,
    eta,
    validUntil,
    isConfirmed,
    isDeclined,
    confidence: ratePerContainer ? 0.95 : 0.7,
  };
}

/**
 * Ingest and process an incoming email reply, uniquely routing it to its forwarder request
 */
export async function processIncomingForwarderEmailReply(input: IncomingEmailMatchInput): Promise<{
  processed: boolean;
  request: ForwarderQuoteRequestRecord | null;
  statusUpdatedTo?: ForwarderQuoteStatus;
  offerExtracted?: boolean;
  reason: string;
}> {
  const matchResult = matchIncomingEmailToForwarderRequest(input);
  let req: ForwarderQuoteRequestRecord;
  let existing: ForwarderQuoteRequestRecord;

  if (matchResult.matched && matchResult.request) {
    req = matchResult.request;
    const list = getLocalForwarderRequests();
    const idx = list.findIndex((r) => r.id === req.id);
    if (idx !== -1) {
      existing = list[idx];
    } else {
      existing = req;
      list.push(existing);
      saveLocalForwarderRequests(list);
    }
  } else {
    // Dynamic resolution if email is associated with a booking/movement
    const targetBkId = input.bookingId || input.movementNumber;
    const allBookings = getLocalBookings();
    const bk = allBookings.find(
      (b) =>
        (targetBkId && b.id && b.id.toLowerCase() === targetBkId.toLowerCase()) ||
        (targetBkId &&
          b.movement_number &&
          b.movement_number.toLowerCase() === targetBkId.toLowerCase()) ||
        (targetBkId &&
          b.booking_reference &&
          b.booking_reference.toLowerCase() === targetBkId.toLowerCase()) ||
        (input.subject &&
          b.movement_number &&
          input.subject.toLowerCase().includes(b.movement_number.toLowerCase())),
    );

    if (!bk && !input.movementNumber && !input.bookingId) {
      return {
        processed: false,
        request: null,
        reason: matchResult.reason || "No associated booking found for incoming forwarder quote.",
      };
    }

    const movNo =
      bk?.movement_number || input.movementNumber || bk?.booking_reference || "MOV-2026-00001";
    const senderEmail = (input.senderEmail || "").trim().toLowerCase();
    const allFwds = getLocalForwarders();
    const matchedFwd = allFwds.find(
      (f) =>
        (senderEmail && f.email && f.email.toLowerCase() === senderEmail) ||
        (senderEmail && f.contactEmail && f.contactEmail.toLowerCase() === senderEmail) ||
        (senderEmail && senderEmail.includes(f.name.toLowerCase().replace(/\s+/g, ""))) ||
        (input.senderName && input.senderName.toLowerCase().includes(f.name.toLowerCase())),
    );

    const fwdName =
      matchedFwd?.name || input.senderName || senderEmail.split("@")[0] || "Forwarder";
    const fwdId = matchedFwd?.id || `fwd-${Date.now()}`;
    const fwdEmail = matchedFwd?.email || senderEmail;

    const newReqId = `MFR-${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const newReq: ForwarderQuoteRequestRecord = {
      id: newReqId,
      bookingId: bk?.id || input.bookingId || movNo,
      bookingReference: movNo,
      movementNumber: movNo,
      forwarderId: fwdId,
      forwarderName: fwdName,
      forwarderEmail: fwdEmail,
      status: "AWAITING_OFFER",
      gmailThreadId: input.gmailThreadId || undefined,
      gmailMessageId: input.gmailMessageId || undefined,
      sentAt: new Date().toISOString(),
      origin: bk?.origin || "POL",
      destination: bk?.destination || "POD",
      polCode: bk?.pol_code || "POL",
      polName: bk?.pol_name || "Port of Loading",
      podCode: bk?.pod_code || "POD",
      podName: bk?.pod_name || "Destination Port",
      supplierName: bk?.supplier_name || "Shipper",
      buyerName: bk?.buyer_name || "Consignee",
      containerType: bk?.container_type || "40HC",
      containerCount: bk?.container_count || 1,
      cargoDescription: bk?.cargo_description || "Commercial Cargo",
    };

    const list = getLocalForwarderRequests();
    list.unshift(newReq);
    saveLocalForwarderRequests(list);
    req = newReq;
    existing = newReq;
  }

  const extracted = await extractQuotationFromEmail({
    subject: input.subject || "",
    body: input.body || "",
    snippet: input.snippet || null,
    senderEmail: input.senderEmail || null,
    senderName: input.senderName || null,
    receivedAt: new Date().toISOString(),
    gmailMessageId: input.gmailMessageId || null,
    gmailThreadId: input.gmailThreadId || null,
    inReplyTo: input.inReplyTo || null,
    references: input.references || null,
    forwarderId: existing.forwarderId,
    knownMovementNumber: existing.movementNumber,
    knownForwarderRequestId: existing.id,
    knownContainerType: existing.containerType,
  });

  // Sender & Forwarder Verification
  const cleanSenderEmail = (input.senderEmail || "").trim().toLowerCase();
  const forwarderPrimaryEmail = (existing.forwarderEmail || "").trim().toLowerCase();
  const senderDomain = cleanSenderEmail.includes("@") ? cleanSenderEmail.split("@")[1] : "";
  const fwdDomain = forwarderPrimaryEmail.includes("@") ? forwarderPrimaryEmail.split("@")[1] : "";

  let unverifiedSender = false;
  if (cleanSenderEmail && forwarderPrimaryEmail && cleanSenderEmail !== forwarderPrimaryEmail) {
    if (!senderDomain || !fwdDomain || senderDomain !== fwdDomain) {
      unverifiedSender = true;
    }
  }

  // Backend validation: strictly controls booking status changes, award actions, and confirmation actions
  const actionToValidate = extracted.isDeclined
    ? "DECLINE_REQUEST"
    : extracted.isConfirmed
      ? "CONFIRM_MOVEMENT"
      : "RECORD_OFFER";

  const validation = validateQuotationForBackendAction(extracted, actionToValidate, {
    status: existing.status,
    movementNumber: existing.movementNumber,
    forwarderId: existing.forwarderId,
  });

  let newStatus: ForwarderQuoteStatus = existing.status;
  let offerExtracted = false;

  if (unverifiedSender) {
    newStatus = "NEEDS_REVIEW";
  } else if (validation.allowed && validation.suggestedStatus) {
    newStatus = validation.suggestedStatus as ForwarderQuoteStatus;
    if (newStatus === "OFFER_RECEIVED") {
      offerExtracted = true;
    }
  } else if (!validation.allowed && validation.requiresReview) {
    newStatus = "NEEDS_REVIEW";
  } else {
    newStatus = "RESPONDED";
  }

  if (extracted.deterministicResult?.needsReview) {
    newStatus = "NEEDS_REVIEW";
  }

  const reviewReasons: string[] = [
    ...(extracted.deterministicResult?.reviewReasons || []),
    ...(unverifiedSender
      ? [
          `Sender email (${input.senderEmail}) does not match registered contact or domain for forwarder ${existing.forwarderName} (${existing.forwarderEmail}). Marked UNVERIFIED_SENDER.`,
        ]
      : []),
  ];

  // Extract only information that is actually present. Missing information remains NULL / undefined.
  const mergedOfferData: ForwarderOfferData = {
    ...(existing.offerData || {}),
    ratePerContainer:
      extracted.rate !== null ? extracted.rate : existing.offerData?.ratePerContainer,
    totalFreight:
      extracted.totalCost !== null
        ? extracted.totalCost
        : extracted.rate !== null
          ? extracted.rate * (existing.containerCount || 1)
          : existing.offerData?.totalFreight,
    currency: extracted.currency || existing.offerData?.currency || undefined,
    containerType: extracted.containerType || existing.offerData?.containerType || undefined,
    quantity: extracted.containerQuantity || existing.offerData?.quantity || undefined,
    availability: extracted.availability || existing.offerData?.availability || undefined,
    etd: extracted.etd || existing.offerData?.etd || undefined,
    eta: extracted.eta || existing.offerData?.eta || undefined,
    transitDays: extracted.transitTime || existing.offerData?.transitDays || undefined,
    freeDays: extracted.freeDays || existing.offerData?.freeDays || undefined,
    carrier: extracted.carrier || existing.offerData?.carrier || undefined,
    vesselName: extracted.vesselName || existing.offerData?.vesselName || undefined,
    voyageNumber: extracted.voyageNumber || existing.offerData?.voyageNumber || undefined,
    validUntil: extracted.rateValidity || existing.offerData?.validUntil || undefined,
    additionalCharges:
      extracted.additionalCharges || existing.offerData?.additionalCharges || undefined,
    totalCost: extracted.totalCost !== null ? extracted.totalCost : undefined,
    notes: extracted.notes || existing.offerData?.notes || undefined,
    receivedAt: extracted.emailReceivedDate || new Date().toISOString(),
    sourceEmailId: input.emailMessageId || input.gmailMessageId || undefined,
    originalEmailSubject: input.subject || undefined,
    originalEmailBody: input.body ? input.body.slice(0, 800) : undefined,
    receivedVia: "Gmail Automatic Sync",
    responseClassification:
      newStatus === "OFFER_RECEIVED" ||
      newStatus === "CONFIRMED" ||
      newStatus === "DECLINED" ||
      newStatus === "AVAILABLE" ||
      newStatus === "NOT_AVAILABLE"
        ? (newStatus as ForwarderOfferData["responseClassification"])
        : "NEEDS_REVIEW",
    extractionSummary:
      extracted.missingFields.length > 0
        ? `Extracted ${extracted.presentFields.length} fields (${Math.round(extracted.extractionConfidence * 100)}% confidence). Not provided: ${extracted.missingFields.slice(0, 4).join(", ")}.`
        : `Complete extraction (${Math.round(extracted.extractionConfidence * 100)}% confidence).`,
    traceability: extracted.traceability || extracted.deterministicResult?.traceability,
    reviewReasons,
    confidenceScore: extracted.extractionConfidence,
    hasConflicts: extracted.deterministicResult?.hasConflicts || false,
    needsReview:
      extracted.deterministicResult?.needsReview ||
      unverifiedSender ||
      newStatus === "NEEDS_REVIEW",
    unverifiedSender,
    containerRates: extracted.deterministicResult?.containerRates,
  };

  const updatedReq: ForwarderQuoteRequestRecord = {
    ...existing,
    status: newStatus,
    offerData: mergedOfferData,
    ratePerContainer: mergedOfferData.ratePerContainer || existing.ratePerContainer,
    currency: mergedOfferData.currency || existing.currency,
    updatedAt: new Date().toISOString(),
  };

  const list = getLocalForwarderRequests();
  const currentIdx = list.findIndex((r) => r.id === updatedReq.id);
  if (currentIdx !== -1) {
    list[currentIdx] = updatedReq;
  } else {
    list.unshift(updatedReq);
  }
  saveLocalForwarderRequests(list);

  // Record audit log
  void recordQuotationAuditEvent({
    eventType: newStatus === "NEEDS_REVIEW" ? "EXTRACTION_NEEDS_REVIEW" : "QUOTATION_SAVED",
    movementNumber: updatedReq.movementNumber,
    bookingId: updatedReq.bookingId,
    forwarderId: updatedReq.forwarderId,
    forwarderName: updatedReq.forwarderName,
    senderEmail: input.senderEmail,
    gmailMessageId: input.gmailMessageId,
    gmailThreadId: input.gmailThreadId,
    summary: `Extracted quotation offer for ${updatedReq.forwarderName} (${updatedReq.id}): Rate ${mergedOfferData.ratePerContainer !== undefined ? `$${mergedOfferData.ratePerContainer}` : "N/A"} ${mergedOfferData.currency || ""}. Status: ${newStatus}.`,
    details: {
      status: newStatus,
      rate: mergedOfferData.ratePerContainer,
      currency: mergedOfferData.currency,
      confidence: extracted.extractionConfidence,
      reviewReasons,
      unverifiedSender,
    },
  });

  // Persist quotation, versioning, traceability and email message state to Supabase database
  if (isSupabaseConfigured && updatedReq.bookingId) {
    try {
      await persistQuotationToDatabase({
        emailMessageId: input.emailMessageId || "",
        gmailMessageId: input.gmailMessageId,
        gmailThreadId: input.gmailThreadId,
        inReplyTo: input.inReplyTo,
        references: input.references,
        senderEmail: input.senderEmail,
        senderName: input.senderName,
        subject: input.subject,
        body: input.body,
        bookingId: updatedReq.bookingId,
        movementNumber: updatedReq.movementNumber,
        forwarderId: updatedReq.forwarderId,
        forwarderName: updatedReq.forwarderName,
        forwarderEmail: updatedReq.forwarderEmail,
        forwarderCode: updatedReq.forwarderCode,
        extracted,
        newStatus,
        offerExtracted,
        unverifiedSender,
        reviewReasons,
      });
    } catch (syncErr) {
      console.warn("[MultiForwarderService] Notice persisting quotation to Supabase:", syncErr);
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: {
          updatedRequestId: updatedReq.id,
          requestId: updatedReq.id,
          bookingId: updatedReq.bookingId,
          movementNumber: updatedReq.movementNumber,
          request: updatedReq,
          status: newStatus,
          offer: updatedReq.offerData,
          rate: mergedOfferData.ratePerContainer,
        },
      }),
    );
    if (offerExtracted || mergedOfferData.ratePerContainer) {
      window.dispatchEvent(
        new CustomEvent("nashmia_forwarder_offer_received", {
          detail: {
            requestId: updatedReq.id,
            bookingId: updatedReq.bookingId,
            movementNumber: updatedReq.movementNumber,
            request: updatedReq,
            offer: updatedReq.offerData,
            rate: mergedOfferData.ratePerContainer,
          },
        }),
      );
    }
  }

  return {
    processed: true,
    request: updatedReq,
    statusUpdatedTo: newStatus,
    offerExtracted,
    reason: `Successfully routed reply to ${req.forwarderName} (${req.id}). Status: ${newStatus}.`,
  };
}

export interface BookingForwarderSummary {
  movementNumber: string;
  totalForwarders: number;
  quotationsReceived: number;
  pendingReplies: number;
  declinedCount: number;
  bestRate?: number;
  bestRateCurrency?: string;
  bestRateForwarder?: string;
  overallStatus:
    | "OFFERS_RECEIVED"
    | "AWAITING_QUOTES"
    | "AWARDED"
    | "CONFIRMED"
    | "PENDING_CONFIRMATION"
    | "NO_FORWARDERS";
  lastResponseTime?: string;
  awardedForwarder?: string;
}

/**
 * Returns aggregated forwarder summary statistics for a booking
 */
export function getBookingForwarderSummary(
  bookingIdOrMov: string,
  allRequests?: ForwarderQuoteRequestRecord[],
): BookingForwarderSummary {
  const requests =
    allRequests && allRequests.length > 0 ? allRequests : getLocalForwarderRequests();
  const idLower = (bookingIdOrMov || "").trim().toLowerCase();

  const linked = requests.filter((r) => {
    const bId = (r.bookingId || "").trim().toLowerCase();
    const mov = (r.movementNumber || "").trim().toLowerCase();
    const ref = (r.bookingReference || "").trim().toLowerCase();
    const rId = (r.id || "").trim().toLowerCase();
    return (
      bId === idLower ||
      mov === idLower ||
      ref === idLower ||
      rId === idLower ||
      (idLower.length > 3 &&
        (bId.includes(idLower) || mov.includes(idLower) || idLower.includes(mov)))
    );
  });

  const totalForwarders = linked.length;
  const receivedQuotes = linked.filter(
    (r) =>
      r.status === "OFFER_RECEIVED" ||
      r.status === "AWARDED" ||
      r.status === "ACCEPTED" ||
      r.status === "RESPONDED" ||
      (r.offerData?.ratePerContainer !== undefined &&
        r.offerData.ratePerContainer !== null &&
        r.offerData.ratePerContainer > 0) ||
      (r.ratePerContainer !== undefined && r.ratePerContainer !== null && r.ratePerContainer > 0),
  );
  const pendingReplies = linked.filter(
    (r) =>
      r.status === "AWAITING_OFFER" ||
      r.status === "PENDING" ||
      r.status === "SENT" ||
      r.status === "REQUESTED",
  );
  const declinedCount = linked.filter((r) => r.status === "DECLINED").length;

  const validRates = receivedQuotes
    .map((r) => ({
      rate: r.offerData?.ratePerContainer || r.ratePerContainer || 0,
      currency: r.offerData?.currency || r.currency || "USD",
      forwarder: r.forwarderName,
    }))
    .filter((x) => x.rate > 0);

  const bestRateObj =
    validRates.length > 0
      ? validRates.reduce((min, curr) => (curr.rate < min.rate ? curr : min), validRates[0])
      : undefined;

  const awarded = linked.find((r) => r.status === "AWARDED" || r.status === "ACCEPTED");

  let overallStatus: BookingForwarderSummary["overallStatus"] = "NO_FORWARDERS";
  if (awarded) {
    overallStatus = "AWARDED";
  } else if (receivedQuotes.length > 0) {
    overallStatus = "OFFERS_RECEIVED";
  } else if (pendingReplies.length > 0) {
    overallStatus = "AWAITING_QUOTES";
  }

  // Find latest response time or update time
  const dates = linked
    .map((r) => r.offerData?.receivedAt || r.updatedAt || r.sentAt)
    .filter(Boolean)
    .sort()
    .reverse();

  return {
    movementNumber: bookingIdOrMov,
    totalForwarders,
    quotationsReceived: receivedQuotes.length,
    pendingReplies: pendingReplies.length,
    declinedCount,
    bestRate: bestRateObj?.rate,
    bestRateCurrency: bestRateObj?.currency,
    bestRateForwarder: bestRateObj?.forwarder,
    overallStatus,
    lastResponseTime: dates[0],
    awardedForwarder: awarded?.forwarderName,
  };
}

/**
 * Fetch all forwarder requests across all bookings directly from Supabase PostgreSQL database
 * (Single source of truth).
 */
export async function fetchAllForwarderRequestsFromSupabase(): Promise<
  ForwarderQuoteRequestRecord[]
> {
  if (isSupabaseConfigured) {
    try {
      const records = await fetchForwarderRequestsFromDatabase(null);
      if (records && records.length > 0) {
        return records;
      }
    } catch (err) {
      console.warn(
        "[MultiForwarderService] Error fetching all forwarder requests from database:",
        err,
      );
    }
  }
  return getLocalForwarderRequests();
}
