import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid, updateLocalBooking, getLocalBookings } from "./supabase-services";
import { getLocalForwarderRequests, saveLocalForwarderRequests } from "./multi-forwarder-service";
import { parseOfferWithNaturalLanguageRules } from "./ai-offer-extractor";
import { extractMovementNumber } from "./movement-lifecycle";
import type { ForwarderResponseClassification } from "@/types/requests";
import { INITIAL_FORWARDERS } from "./forwarders-data";
import { BOOKING_AGENTS } from "./booking-data";

// High-performance in-memory cache to prevent re-parsing identical emails across renders
const parsedOfferCache = new Map<string, ReturnType<typeof parseOfferWithNaturalLanguageRules>>();

export interface AdditionalChargeItem {
  item: string;
  amount: number;
  currency: string;
  description?: string;
}

export interface ForwarderOfferCardItem {
  id: string; // Supabase forwarder_offers id or local request id
  offerId?: string;
  bookingId: string;
  movementNumber: string;
  forwarderId: string;
  forwarderName: string;
  forwarderEmail?: string;
  status: "RESPONDED" | "REQUESTED" | "AWARDED" | "NOT_AWARDED" | "DECLINED" | "NEEDS_REVIEW";
  statusSubtext: string; // e.g. "Available", "Offer Received", "Awaiting Response", "Awarded", "Not Awarded"
  responseClassification?: ForwarderResponseClassification;
  ratePerContainer?: number;
  totalFreight?: number;
  currency: string;
  containerSize: string;
  containerType?: string;
  containerCount: number;
  etd?: string;
  eta?: string;
  transitDays?: number;
  freeDays?: number;
  availability: string; // e.g. "Available", "Not Available", "Pending Response"
  additionalCharges?: AdditionalChargeItem[];
  additionalChargesTotal?: number;
  responseTimeMinutes?: number;
  responseTimeFormatted?: string;
  sentAt?: string;
  carrier?: string;
  vesselName?: string;
  voyageNumber?: string;
  responseTimestamp: string;
  receivedAt?: string;
  summary?: string;
  notes?: string;
  confidence?: number;
  polCode?: string;
  podCode?: string;
  shipperName?: string;
  consigneeName?: string;
  isAwarded: boolean;
  isDeclined: boolean;
  isConfirmed: boolean;
  rawJson?: Record<string, unknown>;
}

const STORAGE_KEY_AWARDED_MOVEMENTS = "nashmia_awarded_forwarder_movements";

export interface AwardedMovementRecord {
  movementNumber: string;
  bookingId?: string | null;
  awardedCardId: string;
  awardedForwarderName: string;
  awardedForwarderId?: string | null;
  awardedAt: string;
  rate?: number;
  currency?: string;
}

/**
 * Retrieve all currently awarded movements and their winning forwarder details
 */
export function getAwardedMovementsMap(): Map<string, AwardedMovementRecord> {
  const map = new Map<string, AwardedMovementRecord>();
  if (typeof window === "undefined") return map;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AWARDED_MOVEMENTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [key, val] of Object.entries(parsed)) {
          if (val && typeof val === "object") {
            map.set(key.trim().toUpperCase(), val as AwardedMovementRecord);
          }
        }
      }
    }
  } catch (err) {
    console.warn("[ForwarderCardService] Error reading awarded movements:", err);
  }
  return map;
}

/**
 * Save an awarded movement so that other offers with the same reference number are automatically removed
 */
export function saveAwardedMovement(record: AwardedMovementRecord): void {
  if (typeof window === "undefined") return;
  try {
    const map = getAwardedMovementsMap();
    const refInfo = normalizeMovementReference(record.movementNumber, record.bookingId);
    if (refInfo.canonicalRef) {
      map.set(refInfo.canonicalRef, record);
    }
    if (record.movementNumber) {
      map.set(record.movementNumber.trim().toUpperCase(), record);
    }
    if (record.bookingId && record.bookingId !== record.movementNumber) {
      map.set(record.bookingId.trim().toUpperCase(), record);
    }
    const obj: Record<string, AwardedMovementRecord> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    localStorage.setItem(STORAGE_KEY_AWARDED_MOVEMENTS, JSON.stringify(obj));
    window.dispatchEvent(new CustomEvent("nashmia_awarded_movements_changed", { detail: record }));
  } catch (err) {
    console.warn("[ForwarderCardService] Error saving awarded movement:", err);
  }
}

/**
 * Helper to format short date (e.g. "18 Sep")
 */
export function formatShortDate(dateStr?: string | null): string {
  if (!dateStr || dateStr === "Prompt" || dateStr === "Standard transit") {
    return dateStr || "N/A";
  }
  // Check if string is already formatted like "18 Sep" or "18 Sep 2026"
  if (/^\d{1,2}\s+[A-Za-z]{3}/i.test(dateStr.trim())) {
    return dateStr.trim();
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Helper to format relative time (e.g. "15 min ago")
 */
export function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Recently";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Recently";
  const diffMs = Math.max(0, Date.now() - d.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Normalizes a movement reference number across movement_number, booking_id, booking_reference, etc.
 * Uses local bookings database and active forwarder requests to reliably map booking UUIDs or aliases
 * to human-readable canonical movement numbers (e.g. MOV-2026-0034).
 */
export function normalizeMovementReference(
  movementNumber?: string | null,
  bookingId?: string | null,
  fallback?: string | null,
): { canonicalRef: string; movementNumber: string; bookingId: string } {
  const mov = (movementNumber || "").trim();
  const bId = (bookingId || "").trim();
  const fb = (fallback || "").trim();

  const isPlaceholder = (s?: string | null) =>
    !s || s === "GLOBAL" || s.toUpperCase().startsWith("MOV-REQ") || s.toUpperCase() === "UNKNOWN";

  // 1. Try to find matching booking in local bookings cache
  try {
    const bookings = getLocalBookings();
    const checkMov = mov.toUpperCase();
    const checkBId = bId.toUpperCase();
    const checkFb = fb.toUpperCase();

    const matched = bookings.find((b) => {
      const bMov = (
        (b as unknown as Record<string, string>).movement_number ||
        b.movementNumber ||
        ""
      )
        .trim()
        .toUpperCase();
      const bRef = (
        (b as unknown as Record<string, string>).booking_reference ||
        b.bookingReference ||
        (b as unknown as Record<string, string>).reference ||
        ""
      )
        .trim()
        .toUpperCase();
      const bUuid = (b.id || "").trim().toUpperCase();

      return (
        (!isPlaceholder(checkMov) &&
          (bMov === checkMov || bRef === checkMov || bUuid === checkMov)) ||
        (checkBId && (bUuid === checkBId || bMov === checkBId || bRef === checkBId)) ||
        (!isPlaceholder(checkFb) && (bMov === checkFb || bRef === checkFb || bUuid === checkFb))
      );
    });

    if (matched) {
      const bMov = (
        (matched as unknown as Record<string, string>).movement_number ||
        matched.movementNumber ||
        ""
      ).trim();
      const bRef = (
        (matched as unknown as Record<string, string>).booking_reference ||
        matched.bookingReference ||
        (matched as unknown as Record<string, string>).reference ||
        ""
      ).trim();
      const canonicalMov = bMov || bRef || matched.id;
      return {
        canonicalRef: canonicalMov.toUpperCase(),
        movementNumber: bMov || (!isPlaceholder(mov) ? mov : bRef || canonicalMov),
        bookingId: matched.id || bId || fb,
      };
    }
  } catch {
    // Ignore error if getLocalBookings fails
  }

  // 2. Try to cross-match with local forwarder requests cache (bridges UUIDs to movement numbers)
  try {
    const localRequests = getLocalForwarderRequests();
    const checkMov = mov.toUpperCase();
    const checkBId = bId.toUpperCase();

    const matchedReq = localRequests.find((r) => {
      const rMov = (r.movementNumber || "").trim().toUpperCase();
      const rRef = (r.bookingReference || "").trim().toUpperCase();
      const rBkId = (r.bookingId || "").trim().toUpperCase();
      const rId = (r.id || "").trim().toUpperCase();

      return (
        (checkBId &&
          (rBkId === checkBId || rMov === checkBId || rRef === checkBId || rId === checkBId)) ||
        (!isPlaceholder(checkMov) && (rMov === checkMov || rRef === checkMov || rBkId === checkMov))
      );
    });

    if (matchedReq) {
      const rMov = (
        !isPlaceholder(matchedReq.movementNumber) ? matchedReq.movementNumber : ""
      ).trim();
      const rRef = (matchedReq.bookingReference || "").trim();
      const canonical = rMov || rRef || matchedReq.bookingId;
      return {
        canonicalRef: canonical.toUpperCase(),
        movementNumber: rMov || (!isPlaceholder(mov) ? mov : canonical),
        bookingId: matchedReq.bookingId || bId || fb,
      };
    }
  } catch {
    // Ignore error if getLocalForwarderRequests fails
  }

  // 3. Fallback: extract movement number or choose best available reference
  const resolved =
    (!isPlaceholder(mov) ? mov : "") ||
    (bId && !bId.includes("-") ? bId : "") ||
    fb ||
    bId ||
    "GLOBAL";
  return {
    canonicalRef: resolved.trim().toUpperCase(),
    movementNumber: !isPlaceholder(mov) ? mov : resolved,
    bookingId: bId || resolved,
  };
}

/**
 * Checks if two forwarder representations refer to the exact same forwarder entity.
 */
export function isSameForwarderIdentity(
  nameA?: string | null,
  emailA?: string | null,
  idA?: string | null,
  nameB?: string | null,
  emailB?: string | null,
  idB?: string | null,
): boolean {
  const cleanEmailA = (emailA || "").trim().toLowerCase();
  const cleanEmailB = (emailB || "").trim().toLowerCase();
  const cleanIdA = (idA || "").trim().toLowerCase();
  const cleanIdB = (idB || "").trim().toLowerCase();

  // 1. If BOTH have valid emails:
  // Same email = definitely same forwarder.
  // Different emails = definitely DIFFERENT forwarders (never merge different contacts)!
  if (cleanEmailA && cleanEmailB) {
    return cleanEmailA === cleanEmailB;
  }

  // 2. If BOTH have explicit non-generic IDs:
  if (cleanIdA && cleanIdB) {
    if (cleanIdA === cleanIdB) return true;
    if (!cleanIdA.startsWith("unknown") && !cleanIdB.startsWith("unknown")) {
      return false;
    }
  }

  // 3. Compare normalized identities
  const normA = normalizeForwarderIdentity(nameA, emailA, idA);
  const normB = normalizeForwarderIdentity(nameB, emailB, idB);
  if (
    normA.canonicalKey &&
    normB.canonicalKey &&
    normA.canonicalKey !== "unknown-forwarder" &&
    normB.canonicalKey !== "unknown-forwarder"
  ) {
    return normA.canonicalKey === normB.canonicalKey;
  }

  // 4. Strict cleaned company name equality (stripping common corporate suffixes)
  const cleanA = (nameA || "")
    .toLowerCase()
    .replace(
      /\b(llc|ltd|inc|corp|co|limited|logistics|freight|shipping|agency|forwarding|lines?)\b/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "");
  const cleanB = (nameB || "")
    .toLowerCase()
    .replace(
      /\b(llc|ltd|inc|corp|co|limited|logistics|freight|shipping|agency|forwarding|lines?)\b/g,
      "",
    )
    .replace(/[^a-z0-9]/g, "");

  const genericTerms = new Set([
    "forwarder",
    "agent",
    "bookingagent",
    "bookingteam",
    "unknown",
    "",
  ]);
  if (
    cleanA &&
    cleanB &&
    !genericTerms.has(cleanA) &&
    !genericTerms.has(cleanB) &&
    cleanA.length >= 3
  ) {
    return cleanA === cleanB;
  }

  return false;
}

/**
 * Checks if two cards refer to the same booking / movement reference.
 */
export function isSameMovementReference(
  cardA: { movementNumber?: string | null; bookingId?: string | null },
  cardB: { movementNumber?: string | null; bookingId?: string | null },
): boolean {
  const refA = normalizeMovementReference(cardA.movementNumber, cardA.bookingId);
  const refB = normalizeMovementReference(cardB.movementNumber, cardB.bookingId);
  if (refA.canonicalRef && refB.canonicalRef && refA.canonicalRef === refB.canonicalRef) {
    return true;
  }

  const movA = (cardA.movementNumber || "").trim().toUpperCase();
  const movB = (cardB.movementNumber || "").trim().toUpperCase();
  const bkA = (cardA.bookingId || "").trim().toUpperCase();
  const bkB = (cardB.bookingId || "").trim().toUpperCase();

  const isPlaceholder = (s: string) =>
    !s || s === "GLOBAL" || s.startsWith("MOV-REQ") || s === "UNKNOWN";

  // Direct non-placeholder movementNumber equality
  if (!isPlaceholder(movA) && !isPlaceholder(movB) && movA === movB) return true;

  // Direct bookingId equality
  if (bkA && bkB && bkA === bkB) return true;

  // Cross-match: cardA movementNumber matches cardB bookingId or vice versa
  if (!isPlaceholder(movA) && bkB && movA === bkB) return true;
  if (!isPlaceholder(movB) && bkA && movB === bkA) return true;

  // Stripped numeric / reference match (e.g. "MOV-2026-0034" vs "2026-0034" or "BK-2026-0034")
  const numA = movA.replace(/[^0-9]/g, "");
  const numB = movB.replace(/[^0-9]/g, "");
  if (
    numA &&
    numB &&
    numA.length >= 4 &&
    (numA === numB || numA.endsWith(numB) || numB.endsWith(numA))
  ) {
    return true;
  }

  return false;
}

/**
 * Comprehensive check to determine if two ForwarderOfferCardItems are duplicates
 * for the same forwarder and movement request.
 */
export function isSameForwarderOfferCard(
  cardA: ForwarderOfferCardItem,
  cardB: ForwarderOfferCardItem,
): boolean {
  // 1. Must be the exact same forwarder
  const sameForwarder = isSameForwarderIdentity(
    cardA.forwarderName,
    cardA.forwarderEmail,
    cardA.forwarderId,
    cardB.forwarderName,
    cardB.forwarderEmail,
    cardB.forwarderId,
  );
  if (!sameForwarder) return false;

  // 2. Must be the exact same movement reference
  return isSameMovementReference(cardA, cardB);
}

/**
 * Normalizes forwarder identity into a canonical key so variations of the SAME
 * company resolve to the same entity, while distinct forwarders are ALWAYS kept separate.
 */
export function normalizeForwarderIdentity(
  name?: string | null,
  email?: string | null,
  id?: string | null,
): { canonicalKey: string; forwarderName: string; forwarderId: string; forwarderEmail?: string } {
  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").toLowerCase().trim();
  const cleanId = (id || "").trim();

  // Combined pool of known forwarders & booking agents
  const knownPool = [
    ...INITIAL_FORWARDERS.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      email: f.email?.toLowerCase().trim() || "",
    })),
    ...BOOKING_AGENTS.map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      email: b.email?.toLowerCase().trim() || "",
    })),
  ];

  for (const fwd of knownPool) {
    const fwdName = fwd.name.toLowerCase().trim();
    const fwdCode = fwd.code?.toLowerCase().trim() || "";
    const fwdId = fwd.id.toLowerCase().trim();
    const fwdEmail = fwd.email;

    const idMatch =
      Boolean(cleanId) && (cleanId.toLowerCase() === fwdId || cleanId.toLowerCase() === fwdCode);

    // Exact email match only — never substring or domain match!
    const emailMatch = Boolean(cleanEmail) && Boolean(fwdEmail) && cleanEmail === fwdEmail;

    // Exact company name equality
    const cleanRawA = cleanName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanRawB = fwdName.replace(/[^a-z0-9]/g, "");
    const nameMatch =
      Boolean(cleanName) &&
      cleanRawA.length >= 3 &&
      (cleanName.toLowerCase() === fwdName || cleanRawA === cleanRawB);

    if (idMatch || emailMatch || nameMatch) {
      return {
        canonicalKey: fwd.id,
        forwarderName: fwd.name,
        forwarderId: fwd.id,
        forwarderEmail: fwd.email || cleanEmail || undefined,
      };
    }
  }

  // 1. If explicit specific ID provided, use it
  if (cleanId && !cleanId.startsWith("unknown")) {
    return {
      canonicalKey: cleanId.toLowerCase(),
      forwarderName: cleanName || cleanId,
      forwarderId: cleanId,
      forwarderEmail: cleanEmail || undefined,
    };
  }

  // 2. If explicit Email provided, use the FULL email as unique canonical key
  if (cleanEmail) {
    return {
      canonicalKey: cleanEmail,
      forwarderName: cleanName || cleanEmail.split("@")[0].toUpperCase(),
      forwarderId: cleanId || `fwd-${cleanEmail.replace(/[^a-z0-9]/g, "-")}`,
      forwarderEmail: cleanEmail,
    };
  }

  // 3. If company name provided
  if (cleanName) {
    const slug = cleanName
      .toLowerCase()
      .replace(
        /\b(llc|ltd|inc|corp|co|limited|logistics|freight|shipping|agency|forwarding|lines?)\b/g,
        "",
      )
      .replace(/[^a-z0-9]/g, "-")
      .replace(/^-+|-+$/g, "");
    const finalSlug = slug || "forwarder";
    return {
      canonicalKey: finalSlug,
      forwarderName: cleanName,
      forwarderId: cleanId || `fwd-${finalSlug}`,
      forwarderEmail: undefined,
    };
  }

  return {
    canonicalKey: "unknown-forwarder",
    forwarderName: "Forwarder",
    forwarderId: cleanId || "unknown-forwarder",
    forwarderEmail: undefined,
  };
}

/**
 * Check whether two card entries represent the same forwarder
 */
export function isSameForwarder(
  a: { forwarderId?: string; forwarderName?: string; forwarderEmail?: string },
  b: { forwarderId?: string; forwarderName?: string; forwarderEmail?: string },
): boolean {
  return isSameForwarderIdentity(
    a.forwarderName,
    a.forwarderEmail,
    a.forwarderId,
    b.forwarderName,
    b.forwarderEmail,
    b.forwarderId,
  );
}

/**
 * Merges two forwarder offer cards.
 * If one has data (rate > 0 / responded / awarded) and the other has NO data (requested / awaiting response):
 * The card with data is kept and enriched with any metadata from the empty card.
 */
export function mergeForwarderOfferCards(
  cardA: ForwarderOfferCardItem,
  cardB: ForwarderOfferCardItem,
): ForwarderOfferCardItem {
  const hasDataA =
    Boolean(cardA.ratePerContainer && cardA.ratePerContainer > 0) ||
    cardA.status === "RESPONDED" ||
    cardA.status === "AWARDED" ||
    cardA.status === "DECLINED";

  const hasDataB =
    Boolean(cardB.ratePerContainer && cardB.ratePerContainer > 0) ||
    cardB.status === "RESPONDED" ||
    cardB.status === "AWARDED" ||
    cardB.status === "DECLINED";

  let primary: ForwarderOfferCardItem;
  let secondary: ForwarderOfferCardItem;

  if (hasDataA && !hasDataB) {
    primary = { ...cardA };
    secondary = cardB;
  } else if (!hasDataA && hasDataB) {
    primary = { ...cardB };
    secondary = cardA;
  } else if (cardA.isAwarded || cardA.status === "AWARDED") {
    primary = { ...cardA };
    secondary = cardB;
  } else if (cardB.isAwarded || cardB.status === "AWARDED") {
    primary = { ...cardB };
    secondary = cardA;
  } else {
    // Both have data or neither has data: pick the one with later responseTimestamp
    const timeA =
      new Date(cardA.responseTimestamp || cardA.receivedAt || cardA.sentAt || 0).getTime() || 0;
    const timeB =
      new Date(cardB.responseTimestamp || cardB.receivedAt || cardB.sentAt || 0).getTime() || 0;
    if (timeB >= timeA) {
      primary = { ...cardB };
      secondary = cardA;
    } else {
      primary = { ...cardA };
      secondary = cardB;
    }
  }

  // Enrich primary with any extra fields from secondary
  return {
    ...primary,
    bookingId: primary.bookingId || secondary.bookingId,
    movementNumber: primary.movementNumber || secondary.movementNumber,
    forwarderId: primary.forwarderId || secondary.forwarderId,
    forwarderName: primary.forwarderName || secondary.forwarderName,
    forwarderEmail: primary.forwarderEmail || secondary.forwarderEmail,
    polCode: primary.polCode || secondary.polCode,
    podCode: primary.podCode || secondary.podCode,
    shipperName: primary.shipperName || secondary.shipperName,
    consigneeName: primary.consigneeName || secondary.consigneeName,
    containerType: primary.containerType || secondary.containerType,
    containerSize: primary.containerSize || secondary.containerSize || "40HC",
    containerCount: primary.containerCount || secondary.containerCount || 1,
    sentAt: primary.sentAt || secondary.sentAt,
    carrier: primary.carrier || secondary.carrier,
    vesselName: primary.vesselName || secondary.vesselName,
    voyageNumber: primary.voyageNumber || secondary.voyageNumber,
    etd: primary.etd || secondary.etd,
    eta: primary.eta || secondary.eta,
    transitDays: primary.transitDays || secondary.transitDays,
    freeDays: primary.freeDays || secondary.freeDays,
    additionalCharges: primary.additionalCharges || secondary.additionalCharges,
    additionalChargesTotal: primary.additionalChargesTotal ?? secondary.additionalChargesTotal,
    responseTimeMinutes: primary.responseTimeMinutes ?? secondary.responseTimeMinutes,
    responseTimeFormatted:
      primary.status !== "REQUESTED"
        ? primary.responseTimeFormatted
        : secondary.responseTimeFormatted || primary.responseTimeFormatted,
    notes: primary.notes || secondary.notes,
    summary: primary.summary || secondary.summary,
    rawJson: primary.rawJson || secondary.rawJson,
  };
}

/**
 * Safely inserts or merges a forwarder offer card into the cards map.
 * Ensures that cards for the same reference number and forwarder are unified,
 * and cards with data always take precedence over empty cards!
 */
export function upsertForwarderCard(
  map: Map<string, ForwarderOfferCardItem>,
  incoming: ForwarderOfferCardItem,
): void {
  const refInfo = normalizeMovementReference(incoming.movementNumber, incoming.bookingId);
  const fwdInfo = normalizeForwarderIdentity(
    incoming.forwarderName,
    incoming.forwarderEmail,
    incoming.forwarderId,
  );

  // Normalize card identity
  incoming.movementNumber = refInfo.movementNumber;
  incoming.bookingId = refInfo.bookingId;
  incoming.forwarderName = fwdInfo.forwarderName || incoming.forwarderName;
  incoming.forwarderId = fwdInfo.forwarderId || incoming.forwarderId;
  incoming.forwarderEmail = fwdInfo.forwarderEmail || incoming.forwarderEmail;

  const canonicalKey = `${refInfo.canonicalRef}::${fwdInfo.canonicalKey}`;

  // 1. Direct key match
  const directMatch = map.get(canonicalKey);
  if (directMatch) {
    const merged = mergeForwarderOfferCards(directMatch, incoming);
    map.set(canonicalKey, merged);
    return;
  }

  // 2. Scan existing cards to find matching reference and forwarder via isSameForwarderOfferCard
  for (const [key, existing] of map.entries()) {
    if (isSameForwarderOfferCard(existing, incoming)) {
      const merged = mergeForwarderOfferCards(existing, incoming);
      map.delete(key);
      const newRef = normalizeMovementReference(merged.movementNumber, merged.bookingId);
      const newFwd = normalizeForwarderIdentity(
        merged.forwarderName,
        merged.forwarderEmail,
        merged.forwarderId,
      );
      map.set(`${newRef.canonicalRef}::${newFwd.canonicalKey}`, merged);
      return;
    }
  }

  // 3. No match found - insert new card
  map.set(canonicalKey, incoming);
}

/**
 * Fetch all forwarder offer cards dynamically from Supabase `forwarder_offers`,
 * merged with any outbound quote requests to ensure that forwarders awaiting
 * response also have their cards on the Requests Page.
 */
export async function fetchForwarderOfferCardsFromSupabase(
  _userId?: string | null,
): Promise<ForwarderOfferCardItem[]> {
  const cardsMap = new Map<string, ForwarderOfferCardItem>();

  // 1. Fetch from Supabase `forwarder_offers`, `forwarders`, and inbound `email_messages` in parallel
  if (isSupabaseConfigured) {
    try {
      const [offersRes, forwardersRes, messagesRes] = await Promise.all([
        supabase
          .from("forwarder_offers")
          .select(
            `
            id,
            booking_id,
            movement_number,
            forwarder_id,
            forwarder_name,
            forwarder_email,
            rate_per_container,
            total_freight,
            currency,
            container_size,
            container_count,
            space_available,
            is_declined,
            is_confirmed,
            status,
            etd,
            eta,
            transit_days,
            free_days,
            carrier,
            vessel_name,
            voyage_number,
            valid_until,
            notes,
            summary,
            confidence,
            extraction_method,
            raw_extracted_json,
            received_at,
            created_at,
            updated_at
          `,
          )
          .order("received_at", { ascending: false }),
        supabase.from("forwarders").select("id, company_name, email, code"),
        supabase
          .from("email_messages")
          .select("id, sender_email, sender_name, subject, body, raw_headers, created_at, sent_at")
          .in("direction", ["Inbound", "inbound", "INBOUND"])
          .order("created_at", { ascending: false })
          .limit(35),
      ]);

      const offers = offersRes.data;
      if (!offersRes.error && offers && offers.length > 0) {
        for (const offer of offers) {
          const forwarderName = offer.forwarder_name || "Forwarder";
          const isAwarded =
            offer.status === "ACCEPTED" ||
            offer.status === "AWARDED" ||
            Boolean(offer.is_confirmed);
          const isNotAwarded = offer.status === "NOT_AWARDED";
          const isDeclined = Boolean(offer.is_declined) || offer.status === "DECLINED";

          let status: ForwarderOfferCardItem["status"] = "RESPONDED";
          let statusSubtext = "Available";

          if (isAwarded) {
            status = "AWARDED";
            statusSubtext = "Awarded";
          } else if (isNotAwarded) {
            status = "NOT_AWARDED";
            statusSubtext = "Not Awarded";
          } else if (isDeclined) {
            status = "DECLINED";
            statusSubtext = "Declined";
          } else if (offer.status === "NOT_AVAILABLE") {
            status = "RESPONDED";
            statusSubtext = "Not Available";
          } else if (offer.status === "NEEDS_REVIEW") {
            status = "NEEDS_REVIEW";
            statusSubtext = "Needs Review";
          } else if (offer.space_available) {
            status = "RESPONDED";
            statusSubtext = "Available";
          } else {
            status = "RESPONDED";
            statusSubtext = "Offer Received";
          }

          const availability = isDeclined
            ? "Declined"
            : offer.space_available
              ? "Available"
              : "Not Available";

          const rawJson = (offer.raw_extracted_json as Record<string, unknown>) || undefined;

          // Parse additional charges
          let additionalCharges: AdditionalChargeItem[] = [];
          if (Array.isArray(rawJson?.additionalCharges)) {
            additionalCharges = rawJson.additionalCharges as AdditionalChargeItem[];
          } else if (Array.isArray(rawJson?.charges)) {
            additionalCharges = rawJson.charges as AdditionalChargeItem[];
          }
          const additionalChargesTotal =
            additionalCharges.length > 0
              ? additionalCharges.reduce((acc, c) => acc + (Number(c.amount) || 0), 0)
              : undefined;

          let responseTimeMinutes: number | undefined;
          let responseTimeFormatted = "Recently";
          if (offer.received_at) {
            responseTimeFormatted = formatRelativeTime(offer.received_at);
          }

          const card: ForwarderOfferCardItem = {
            id: offer.id,
            offerId: offer.id,
            bookingId: offer.booking_id || "",
            movementNumber: offer.movement_number || "MOV-REQ",
            forwarderId: offer.forwarder_id || "",
            forwarderName,
            forwarderEmail: offer.forwarder_email || undefined,
            status,
            statusSubtext,
            responseClassification: (offer.status as ForwarderResponseClassification) || undefined,
            ratePerContainer: offer.rate_per_container
              ? Number(offer.rate_per_container)
              : undefined,
            totalFreight: offer.total_freight ? Number(offer.total_freight) : undefined,
            currency: offer.currency || "USD",
            containerSize: offer.container_size || "40HC",
            containerCount: offer.container_count || 1,
            etd: offer.etd || undefined,
            eta: offer.eta || undefined,
            transitDays: offer.transit_days ? Number(offer.transit_days) : undefined,
            freeDays: offer.free_days ? Number(offer.free_days) : undefined,
            availability,
            additionalCharges: additionalCharges.length > 0 ? additionalCharges : undefined,
            additionalChargesTotal,
            responseTimeMinutes,
            responseTimeFormatted,
            carrier: offer.carrier || undefined,
            vesselName: offer.vessel_name || undefined,
            voyageNumber: offer.voyage_number || undefined,
            responseTimestamp: offer.received_at || offer.created_at || new Date().toISOString(),
            receivedAt: offer.received_at || offer.created_at,
            summary: offer.summary || undefined,
            notes: offer.notes || undefined,
            confidence: offer.confidence ? Number(offer.confidence) : undefined,
            isAwarded,
            isDeclined,
            isConfirmed: Boolean(offer.is_confirmed),
            rawJson,
          };

          upsertForwarderCard(cardsMap, card);
        }
      }

      // Process Inbound messages in parallel
      const forwarders = forwardersRes.data;
      const forwarderByEmail = new Map<string, { id: string; name: string; email: string }>();
      for (const f of forwarders || []) {
        if (f.email) {
          forwarderByEmail.set(f.email.toLowerCase().trim(), {
            id: f.id,
            name: f.company_name,
            email: f.email,
          });
        }
      }

      const messages = messagesRes.data;
      for (const m of messages || []) {
        const fromEmail = (m.sender_email || "").toLowerCase().trim();
        const fwd = forwarderByEmail.get(fromEmail);
        const subject = m.subject || "";
        const body = m.body || "";
        const headers = (m.raw_headers as Record<string, unknown> | null) || {};

        // Extract movement number from raw_headers, subject, or body
        const headerMovNum =
          typeof headers.movement_number === "string" ? headers.movement_number : null;
        const movNum =
          headerMovNum || extractMovementNumber(subject) || extractMovementNumber(body);

        // If no movement number is associated, this is unrelated/marketing email; skip it
        if (!movNum) continue;

        // Skip if this message was superseded or removed by an award
        const isHeaderRemoved =
          headers.award_status === "NOT_AWARDED" ||
          headers.is_removed === true ||
          headers.removed === true ||
          headers.superseded_by_award === true;
        if (isHeaderRemoved) {
          continue;
        }

        const isHeaderAwarded = headers.award_status === "AWARDED" || headers.is_awarded === true;

        // Fast path: use cached NLP parse or pre-extracted offer from headers to avoid expensive regex
        let parsedOffer = parsedOfferCache.get(m.id);
        if (!parsedOffer) {
          parsedOffer = parseOfferWithNaturalLanguageRules(body, subject);
          parsedOfferCache.set(m.id, parsedOffer);
        }
        const rawOffer =
          typeof headers.extracted_offer === "object" && headers.extracted_offer !== null
            ? (headers.extracted_offer as Record<string, unknown>)
            : null;

        const rawRate =
          typeof rawOffer?.ratePerContainer === "number" ? rawOffer.ratePerContainer : undefined;
        // Select rate - preference to parsedOffer unless rawOffer has higher valid rate
        const ratePerContainer = parsedOffer.freightRate || rawRate;
        const forwarderName = fwd?.name || m.sender_name || fromEmail.split("@")[0] || "Forwarder";
        const forwarderId = fwd?.id || m.id;

        // Extract container quantity & routing details from quoted request or body
        const qtyMatch = body.match(/([1-9][0-9]?)\s*(?:x|cntr|container)/i);
        const containerCount = parsedOffer.quantity || (qtyMatch ? parseInt(qtyMatch[1], 10) : 1);
        const totalFreight =
          ratePerContainer && containerCount
            ? ratePerContainer * containerCount
            : (rawOffer?.totalFreight as number | undefined);

        const status: ForwarderOfferCardItem["status"] = isHeaderAwarded
          ? "AWARDED"
          : ratePerContainer && ratePerContainer > 0
            ? "RESPONDED"
            : "RESPONDED";

        const card: ForwarderOfferCardItem = {
          id: `email-offer-${m.id}`,
          offerId: `email-${m.id}`,
          bookingId: (headers.booking_id as string) || "",
          movementNumber: movNum,
          forwarderId,
          forwarderName,
          forwarderEmail: fromEmail,
          status,
          statusSubtext: isHeaderAwarded
            ? "Awarded"
            : ratePerContainer
              ? "Offer Received"
              : "Reply Received",
          responseClassification: isHeaderAwarded
            ? "AWARDED"
            : ratePerContainer
              ? "AVAILABLE"
              : "NEEDS_REVIEW",
          ratePerContainer,
          totalFreight,
          currency: parsedOffer.currency || (rawOffer?.currency as string) || "USD",
          containerSize: parsedOffer.containerSize || (rawOffer?.containerSize as string) || "40HC",
          containerCount,
          etd: parsedOffer.etd || (rawOffer?.etd as string) || undefined,
          eta: parsedOffer.eta || (rawOffer?.eta as string) || undefined,
          transitDays: parsedOffer.transitDays || (rawOffer?.transitDays as number) || undefined,
          freeDays: parsedOffer.freeDays || (rawOffer?.freeDays as number) || undefined,
          availability: parsedOffer.isSpaceAvailable === false ? "Not Available" : "Available",
          responseTimeMinutes: undefined,
          responseTimeFormatted: formatRelativeTime(m.sent_at || m.created_at),
          carrier: parsedOffer.carrier || (rawOffer?.carrier as string) || undefined,
          vesselName: parsedOffer.vesselName || (rawOffer?.vesselName as string) || undefined,
          voyageNumber: parsedOffer.voyageNumber || (rawOffer?.voyageNumber as string) || undefined,
          responseTimestamp: m.sent_at || m.created_at || new Date().toISOString(),
          receivedAt: m.sent_at || m.created_at,
          summary: parsedOffer.notes || subject,
          notes: body.substring(0, 300),
          isAwarded: isHeaderAwarded,
          isDeclined: parsedOffer.isSpaceAvailable === false,
          isConfirmed: isHeaderAwarded,
          rawJson: headers,
        };

        upsertForwarderCard(cardsMap, card);
      }
    } catch (dbErr) {
      console.warn("[ForwarderCardService] Error fetching offers in parallel:", dbErr);
    }
  }

  // 2. Overlay / Merge with Local Forwarder Requests
  // This ensures that:
  // a) Requests sent to forwarders that are awaiting replies also show cards ("Requested • Awaiting Response")
  // b) When a response arrives, it updates that existing card!
  const localRequests = getLocalForwarderRequests();
  for (const req of localRequests) {
    const hasOffer = Boolean(req.offerData?.ratePerContainer);
    const isAccepted = req.status === "ACCEPTED" || req.status === "AWARDED";
    const isNotAwarded = req.status === "NOT_AWARDED";
    const isDeclined = req.status === "DECLINED";

    let status: ForwarderOfferCardItem["status"] = "REQUESTED";
    let statusSubtext = "Awaiting Response";

    if (isAccepted) {
      status = "AWARDED";
      statusSubtext = "Awarded";
    } else if (isNotAwarded) {
      status = "NOT_AWARDED";
      statusSubtext = "Not Awarded";
    } else if (isDeclined) {
      status = "DECLINED";
      statusSubtext = "Declined";
    } else if (hasOffer) {
      status = "RESPONDED";
      statusSubtext = req.offerData?.availability || "Available";
    }

    let responseTimeFormatted = "Awaiting response";
    let responseTimeMinutes: number | undefined;
    if (req.sentAt && req.offerData?.receivedAt) {
      const sent = new Date(req.sentAt).getTime();
      const received = new Date(req.offerData.receivedAt).getTime();
      if (!isNaN(sent) && !isNaN(received) && received >= sent) {
        const diffMin = Math.max(1, Math.round((received - sent) / (1000 * 60)));
        responseTimeMinutes = diffMin;
        responseTimeFormatted =
          diffMin < 60
            ? `${diffMin} min turnaround`
            : `${Math.floor(diffMin / 60)}h ${diffMin % 60}m turnaround`;
      }
    } else if (hasOffer && req.offerData?.receivedAt) {
      responseTimeFormatted = formatRelativeTime(req.offerData.receivedAt);
    }

    const card: ForwarderOfferCardItem = {
      id: req.id,
      bookingId: req.bookingId,
      movementNumber: req.movementNumber || "MOV-REQ",
      forwarderId: req.forwarderId,
      forwarderName: req.forwarderName,
      forwarderEmail: req.forwarderEmail,
      status,
      statusSubtext,
      responseClassification: req.offerData?.responseClassification,
      ratePerContainer: req.offerData?.ratePerContainer,
      totalFreight: req.offerData?.totalFreight,
      currency: req.offerData?.currency || "USD",
      containerSize: req.containerSize || req.offerData?.containerType || "40HC",
      containerType: req.containerType,
      containerCount: req.containerCount || 1,
      etd: req.offerData?.etd || req.etd || req.requiredSailingDate,
      eta: req.offerData?.eta || req.eta,
      transitDays: req.offerData?.transitDays,
      freeDays: req.offerData?.freeDays,
      availability: req.offerData?.availability || (hasOffer ? "Available" : "Pending Response"),
      responseTimeMinutes,
      responseTimeFormatted,
      sentAt: req.sentAt,
      carrier: req.offerData?.carrier,
      vesselName: req.offerData?.vesselName,
      voyageNumber: req.offerData?.voyageNumber,
      responseTimestamp: req.offerData?.receivedAt || req.updatedAt || req.sentAt,
      receivedAt: req.offerData?.receivedAt,
      summary: req.offerData?.extractionSummary,
      notes: req.offerData?.notes,
      polCode: req.polCode,
      podCode: req.podCode,
      shipperName: req.supplierName,
      consigneeName: req.buyerName,
      isAwarded: isAccepted,
      isDeclined,
      isConfirmed: req.status === "CONFIRMED",
    };

    upsertForwarderCard(cardsMap, card);
  }

  // Compile all known awarded references (from persistent store, bookings, and cardsMap)
  const awardedReferenceMap = getAwardedMovementsMap();

  for (const card of cardsMap.values()) {
    if (card.isAwarded || card.status === "AWARDED") {
      const refInfo = normalizeMovementReference(card.movementNumber, card.bookingId);
      const fwdInfo = normalizeForwarderIdentity(
        card.forwarderName,
        card.forwarderEmail,
        card.forwarderId,
      );
      const rec: AwardedMovementRecord = {
        movementNumber: refInfo.movementNumber,
        bookingId: refInfo.bookingId,
        awardedCardId: card.id,
        awardedForwarderName: fwdInfo.forwarderName,
        awardedForwarderId: fwdInfo.forwarderId,
        awardedAt: new Date().toISOString(),
        rate: card.ratePerContainer,
        currency: card.currency,
      };
      if (refInfo.canonicalRef) awardedReferenceMap.set(refInfo.canonicalRef, rec);
      if (card.movementNumber)
        awardedReferenceMap.set(card.movementNumber.trim().toUpperCase(), rec);
      if (card.bookingId) awardedReferenceMap.set(card.bookingId.trim().toUpperCase(), rec);
    }
  }

  // Filter results:
  // When an offer is awarded for a reference number (movementNumber or bookingId),
  // KEEP the awarded winning offer, and AUTOMATICALLY REMOVE all other offers with the same reference number!
  const candidateResults: ForwarderOfferCardItem[] = [];

  for (const card of cardsMap.values()) {
    const rawH = (card.rawJson as Record<string, unknown>) || {};
    if (
      rawH.removed === true ||
      rawH.is_removed === true ||
      rawH.superseded_by_award === true ||
      card.status === "NOT_AWARDED"
    ) {
      // Competing offer removed by award
      continue;
    }

    const refInfo = normalizeMovementReference(card.movementNumber, card.bookingId);
    const movKey = card.movementNumber?.trim().toUpperCase();
    const bkKey = card.bookingId?.trim().toUpperCase();
    const awardRec =
      awardedReferenceMap.get(refInfo.canonicalRef) ||
      (movKey ? awardedReferenceMap.get(movKey) : null) ||
      (bkKey ? awardedReferenceMap.get(bkKey) : null);

    if (awardRec) {
      // Check if this card is the awarded winner
      const isWinner =
        card.id === awardRec.awardedCardId ||
        isSameForwarder(card, {
          forwarderId: awardRec.awardedForwarderId,
          forwarderName: awardRec.awardedForwarderName,
        });

      if (isWinner) {
        card.isAwarded = true;
        card.status = "AWARDED";
        card.statusSubtext = "Awarded";
        candidateResults.push(card);
      } else {
        // Automatically drop competing offers with the same reference number
        continue;
      }
    } else {
      candidateResults.push(card);
    }
  }

  // FINAL BULLETPROOF DEDUPLICATION PASS:
  // For each movement reference, ensure each forwarder has AT MOST ONE CARD!
  // If one card has data and another has no data, the card with data wins and the duplicate is removed!
  const finalDedupedMap = new Map<string, ForwarderOfferCardItem>();

  for (const card of candidateResults) {
    const refInfo = normalizeMovementReference(card.movementNumber, card.bookingId);
    const fwdInfo = normalizeForwarderIdentity(
      card.forwarderName,
      card.forwarderEmail,
      card.forwarderId,
    );
    const dedupeKey = `${refInfo.canonicalRef}::${fwdInfo.canonicalKey}`;

    const existing = finalDedupedMap.get(dedupeKey);
    if (!existing) {
      finalDedupedMap.set(dedupeKey, card);
    } else {
      const merged = mergeForwarderOfferCards(existing, card);
      finalDedupedMap.set(dedupeKey, merged);
    }
  }

  const finalResults = Array.from(finalDedupedMap.values());

  finalResults.sort((a, b) => {
    // Awarded first, then latest
    if (a.isAwarded && !b.isAwarded) return -1;
    if (!a.isAwarded && b.isAwarded) return 1;
    const timeA = new Date(a.responseTimestamp).getTime() || 0;
    const timeB = new Date(b.responseTimestamp).getTime() || 0;
    return timeB - timeA;
  });

  return finalResults;
}

/**
 * Award a forwarder offer:
 * 1. Saves award in persistent storage and Supabase `forwarder_offers`:
 *    - Selected forwarder is set to AWARDED
 *    - All other forwarders for the same reference number are AUTOMATICALLY REMOVED
 * 2. Updates Supabase `email_messages`:
 *    - Winning message marked AWARDED
 *    - Competing messages with same reference marked superseded & removed
 * 3. Updates `bookings` in Supabase:
 *    - Makes the selected forwarder the official forwarder
 *    - If awarded forwarder has already confirmed, sets status to "Booking Confirmed"
 * 4. Creates a BOOKING_AWARDED audit event in `audit_logs` & `booking_events`
 * 5. Dispatches realtime events for instant UI synchronization
 */
export async function awardForwarderOfferCard(
  card: ForwarderOfferCardItem,
  userId?: string | null,
  options?: {
    confirmImmediatelyIfExplicit?: boolean;
    confirmationNotes?: string;
  },
): Promise<{ success: boolean; message: string; isConfirmedNow: boolean }> {
  const nowIso = new Date().toISOString();
  const rate = card.ratePerContainer || 0;
  const total = card.totalFreight || rate * card.containerCount;
  const validBookingUuid = safeUuid(card.bookingId);
  const targetMov = card.movementNumber?.trim();
  const targetBk = card.bookingId?.trim();
  const refKey = (targetMov || targetBk || "").trim();
  const shouldConfirmNow =
    options?.confirmImmediatelyIfExplicit === true || Boolean(card.isConfirmed);

  // 0. Persist award to persistent storage so other offers with the same reference number are immediately removed
  if (refKey) {
    saveAwardedMovement({
      movementNumber: refKey,
      bookingId: card.bookingId,
      awardedCardId: card.id,
      awardedForwarderName: card.forwarderName,
      awardedForwarderId: card.forwarderId,
      awardedAt: nowIso,
      rate,
      currency: card.currency,
    });
  }

  // 1. Update Supabase forwarder_offers & email_messages:
  if (isSupabaseConfigured) {
    try {
      // 1a. Set selected forwarder to AWARDED
      if (card.offerId && safeUuid(card.offerId)) {
        await supabase
          .from("forwarder_offers")
          .update({
            status: "AWARDED",
            is_confirmed: shouldConfirmNow,
            is_declined: false,
            updated_at: nowIso,
          })
          .eq("id", card.offerId);
      }

      // 1b. Set all other forwarders for this booking to NOT_AWARDED
      if (validBookingUuid) {
        let query = supabase
          .from("forwarder_offers")
          .update({
            status: "NOT_AWARDED",
            is_declined: true,
            updated_at: nowIso,
          })
          .eq("booking_id", validBookingUuid);

        if (card.offerId && safeUuid(card.offerId)) {
          query = query.neq("id", card.offerId);
        }
        await query;
      } else if (card.movementNumber) {
        let query = supabase
          .from("forwarder_offers")
          .update({
            status: "NOT_AWARDED",
            is_declined: true,
            updated_at: nowIso,
          })
          .eq("movement_number", card.movementNumber);

        if (card.offerId && safeUuid(card.offerId)) {
          query = query.neq("id", card.offerId);
        }
        await query;
      }
    } catch (err) {
      console.warn("[ForwarderCardService] Error updating forwarder_offers on award:", err);
    }

    // 1.5 Update Supabase email_messages:
    // Mark winning message as AWARDED and competing messages with the same reference number as NOT_AWARDED / REMOVED!
    if (refKey) {
      try {
        const { data: messages } = await supabase
          .from("email_messages")
          .select("id, sender_name, sender_email, subject, body, raw_headers")
          .eq("direction", "Inbound");

        for (const m of messages || []) {
          const headers = (m.raw_headers as Record<string, unknown>) || {};
          const headerMov =
            typeof headers.movement_number === "string" ? headers.movement_number : null;
          const movNum =
            headerMov ||
            extractMovementNumber(m.subject || "") ||
            extractMovementNumber(m.body || "");

          if (!movNum || movNum.toUpperCase() !== refKey.toUpperCase()) continue;

          const fromEmail = (m.sender_email || "").toLowerCase().trim();
          const isWinner =
            m.id === card.id ||
            (card.forwarderEmail && fromEmail === card.forwarderEmail.toLowerCase().trim()) ||
            (card.forwarderName &&
              ((m.sender_name &&
                m.sender_name.toLowerCase().includes(card.forwarderName.toLowerCase())) ||
                fromEmail.includes(card.forwarderName.toLowerCase().replace(/\s+/g, ""))));

          if (isWinner) {
            headers.award_status = "AWARDED";
            headers.is_awarded = true;
            headers.awarded_at = nowIso;
            delete headers.is_removed;
            delete headers.removed;
            delete headers.superseded_by_award;
          } else {
            // Other offers with the same reference number are marked as removed / superseded
            headers.award_status = "NOT_AWARDED";
            headers.is_awarded = false;
            headers.is_declined = true;
            headers.superseded_by_award = true;
            headers.is_removed = true;
            headers.awarded_winner = card.forwarderName;
            headers.removed_at = nowIso;
          }

          await supabase.from("email_messages").update({ raw_headers: headers }).eq("id", m.id);
        }
      } catch (msgErr) {
        console.warn("[ForwarderCardService] Error updating email_messages on award:", msgErr);
      }
    }
  }

  // 2. Update Supabase bookings table:
  // Make selected forwarder the official forwarder
  if (isSupabaseConfigured) {
    try {
      const updatePayload: Record<string, unknown> = {
        forwarder_name: card.forwarderName,
        forwarder_id: safeUuid(card.forwarderId),
        rate_amount: rate > 0 ? rate : null,
        total_freight: total > 0 ? total : null,
        currency: card.currency || "USD",
        vessel_name: card.vesselName || null,
        voyage_number: card.voyageNumber || null,
        carrier: card.carrier || null,
        updated_at: nowIso,
      };

      if (card.etd && card.etd !== "Prompt") {
        updatePayload.etd = card.etd;
      }
      if (card.eta && card.eta !== "Standard transit") {
        updatePayload.eta = card.eta;
      }

      // Automatically Approve & Confirm the booking request with the awarded forwarder
      updatePayload.status = "Booking Confirmed";
      updatePayload.confirmation_status = "CONFIRMED";
      updatePayload.confirmed_at = nowIso;
      updatePayload.confirmed_by = card.forwarderName || "Awarded Forwarder";
      updatePayload.confirmation_reason =
        options?.confirmationNotes ||
        `Awarded to ${card.forwarderName} ($${rate}/container). Movement ${card.movementNumber || ""} automatically approved and confirmed. Competing offers removed.`;

      if (validBookingUuid) {
        await supabase.from("bookings").update(updatePayload).eq("id", validBookingUuid);
      }
      if (targetMov) {
        await supabase.from("bookings").update(updatePayload).eq("booking_reference", targetMov);
        await supabase.from("bookings").update(updatePayload).eq("movement_number", targetMov);
      }
      if (targetBk && targetBk !== targetMov) {
        await supabase.from("bookings").update(updatePayload).eq("booking_reference", targetBk);
      }

      // Record in email_confirmations table for persistent lookup
      if (validBookingUuid || targetMov) {
        try {
          await supabase.from("email_confirmations").insert({
            booking_id: validBookingUuid || targetBk || null,
            movement_number: targetMov || null,
            confirmation_status: "CONFIRMED",
            confirmed_by: card.forwarderName || "Awarded Forwarder",
            source: "FORWARDER_AWARD",
            confirmed_at: nowIso,
          });
        } catch {
          // Table may or may not exist in all environments
        }
      }

      // 3. Create BOOKING_AWARDED audit event in `audit_logs`
      if (validBookingUuid) {
        try {
          await supabase.from("audit_logs").insert({
            user_id: safeUuid(userId),
            action: "BOOKING_AWARDED",
            entity_type: "booking",
            entity_id: validBookingUuid,
            new_data: {
              forwarder_id: card.forwarderId,
              forwarder_name: card.forwarderName,
              rate_per_container: rate,
              total_freight: total,
              currency: card.currency,
              movement_number: card.movementNumber,
              status: "AWARDED",
              confirmed: true,
              awarded_at: nowIso,
            },
            changes: {
              official_forwarder: card.forwarderName,
              award_status: "AWARDED",
              competing_quotes: "REMOVED",
              booking_status: "Booking Confirmed",
            },
            ip_address: "127.0.0.1",
            user_agent: "Nashmia-App/AwardWorkflow",
          });
        } catch (auditErr) {
          console.warn("[ForwarderCardService] Notice logging BOOKING_AWARDED audit:", auditErr);
        }

        // 4. Create BOOKING_AWARDED event in `booking_events`
        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: "BOOKING_AWARDED",
          title: `Official Forwarder Awarded: ${card.forwarderName}`,
          description: `Booking officially awarded to ${card.forwarderName} at ${card.currency} ${rate.toLocaleString()}/container. Competing offers for ${card.movementNumber} have been automatically removed. Booking request automatically approved and confirmed.`,
          user_id: safeUuid(userId),
          created_at: nowIso,
          location: "Logistics Operations Desk",
        });

        // 5. Create Booking Confirmed notification & event
        await supabase.from("booking_events").insert({
          booking_id: validBookingUuid,
          event_type: "Booking Confirmed",
          title: "Booking Approved & Confirmed by Forwarder Award",
          description: `Movement ${card.movementNumber} officially approved and confirmed upon awarding ${card.forwarderName}. Space and equipment allocated.`,
          user_id: safeUuid(userId),
          created_at: nowIso,
          location: "Carrier Desk",
        });

        // Insert into notifications table
        try {
          await supabase.from("notifications").insert({
            user_id: safeUuid(userId),
            type: "booking_confirmed",
            title: `Booking Confirmed: ${card.movementNumber}`,
            message: `Movement ${card.movementNumber} has been officially approved & confirmed with awarded forwarder ${card.forwarderName}.`,
            related_booking_id: validBookingUuid,
            read: false,
            created_at: nowIso,
          });
        } catch (notifErr) {
          console.warn("[ForwarderCardService] Notice inserting notification:", notifErr);
        }
      }
    } catch (dbErr) {
      console.warn("[ForwarderCardService] Notice updating bookings on award:", dbErr);
    }
  }

  // Update local storage bookings
  if (card.bookingId) {
    updateLocalBooking(card.bookingId, {
      status: "Booking Confirmed",
      confirmation_status: "CONFIRMED",
      confirmed_at: nowIso,
      confirmed_by: card.forwarderName || "Awarded Forwarder",
      forwarder_name: card.forwarderName,
      rate_amount: rate > 0 ? rate : undefined,
      total_freight: total > 0 ? total : undefined,
      carrier: card.carrier,
      vessel_name: card.vesselName,
      updated_at: nowIso,
    });
  }

  if (typeof window !== "undefined") {
    try {
      const localBookingsRaw = localStorage.getItem("nashmia_local_bookings");
      if (localBookingsRaw) {
        const list = JSON.parse(localBookingsRaw);
        if (Array.isArray(list)) {
          let modified = false;
          for (const b of list) {
            const bRef = (b.booking_reference || "").trim().toUpperCase();
            const bMov = (b.movement_number || "").trim().toUpperCase();
            const bId = (b.id || "").trim().toUpperCase();
            const targetM = (targetMov || "").trim().toUpperCase();
            const targetB = (targetBk || "").trim().toUpperCase();

            if (
              (targetM && (bRef === targetM || bMov === targetM || bId === targetM)) ||
              (targetB && (bRef === targetB || bMov === targetB || bId === targetB))
            ) {
              b.status = "Booking Confirmed";
              b.confirmation_status = "CONFIRMED";
              b.confirmed_at = nowIso;
              b.confirmed_by = card.forwarderName || "Awarded Forwarder";
              b.forwarder_name = card.forwarderName;
              if (rate > 0) b.rate_amount = rate;
              if (total > 0) b.total_freight = total;
              if (card.carrier) b.carrier = card.carrier;
              if (card.vesselName) b.vessel_name = card.vesselName;
              b.updated_at = nowIso;
              modified = true;
            }
          }
          if (modified) {
            localStorage.setItem("nashmia_local_bookings", JSON.stringify(list));
          }
        }
      }
    } catch (err) {
      console.warn("Local storage bookings update notice:", err);
    }
  }

  // 6. Update local forwarder requests store:
  // Award the winner and remove competing quote requests with the same reference number
  const localList = getLocalForwarderRequests();
  const updatedLocal: ForwarderQuoteRequestRecord[] = [];
  for (const item of localList) {
    const isTargetBooking =
      (refKey &&
        item.movementNumber &&
        item.movementNumber.toUpperCase() === refKey.toUpperCase()) ||
      (card.bookingId && item.bookingId === card.bookingId) ||
      (card.movementNumber && item.movementNumber === card.movementNumber);

    if (isTargetBooking) {
      const isTargetForwarder =
        item.id === card.id ||
        (card.forwarderId && item.forwarderId === card.forwarderId) ||
        item.forwarderName.toLowerCase() === card.forwarderName.toLowerCase();

      if (isTargetForwarder) {
        updatedLocal.push({
          ...item,
          status: "AWARDED" as const,
          updatedAt: nowIso,
        });
      }
      // Competing requests with same reference number are excluded from active list!
    } else {
      updatedLocal.push(item);
    }
  }
  saveLocalForwarderRequests(updatedLocal);

  // 7. Dispatch window events for instant UI synchronization across all pages
  if (typeof window !== "undefined") {
    const detailPayload = {
      bookingId: card.bookingId,
      movementNumber: card.movementNumber,
      bookingReference: card.movementNumber || card.bookingId,
      reference: card.movementNumber || card.bookingId,
      forwarderName: card.forwarderName,
      confirmedBy: card.forwarderName,
      rate,
      total,
      carrier: card.carrier,
      vesselName: card.vesselName,
      status: "Approved",
      confirmationStatus: "CONFIRMED",
      timestamp: Date.now(),
    };

    window.dispatchEvent(
      new CustomEvent("nashmia_booking_awarded", {
        detail: detailPayload,
      }),
    );

    window.dispatchEvent(
      new CustomEvent("nashmia_booking_confirmed", {
        detail: detailPayload,
      }),
    );

    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: detailPayload,
      }),
    );

    window.dispatchEvent(new CustomEvent("nashmia_bookings_updated"));
    window.dispatchEvent(new CustomEvent("nashmia_forwarder_cards_updated"));
    window.dispatchEvent(new CustomEvent("supabase_realtime_email_messages_change"));
    window.dispatchEvent(new CustomEvent("supabase_realtime_bookings_change"));
    window.dispatchEvent(
      new CustomEvent("nashmia_multi_forwarder_updated", {
        detail: { count: updatedLocal.length, timestamp: Date.now() },
      }),
    );
  }

  return {
    success: true,
    isConfirmedNow: true,
    message: `Awarded booking ${card.movementNumber || ""} to ${card.forwarderName}. The booking request has been automatically approved and confirmed, and competing quotes have been removed.`,
  };
}

/**
 * Explicitly confirm an awarded booking from the awarded forwarder.
 * STRICT ENFORCEMENT: If the forwarder is NOT_AWARDED, this will reject immediately!
 */
export async function confirmAwardedForwarderBooking(params: {
  bookingId: string;
  movementNumber: string;
  forwarderName: string;
  forwarderId?: string | null;
  userId?: string | null;
  confirmationReason?: string;
}): Promise<{ success: boolean; message: string }> {
  const { bookingId, movementNumber, forwarderName, forwarderId, userId, confirmationReason } =
    params;
  const nowIso = new Date().toISOString();
  const validBookingUuid = safeUuid(bookingId);

  // Validate that this forwarder is NOT in the NOT_AWARDED state
  if (isSupabaseConfigured && validBookingUuid) {
    try {
      const { data: offers } = await supabase
        .from("forwarder_offers")
        .select("id, forwarder_id, forwarder_name, status")
        .eq("booking_id", validBookingUuid);

      if (offers && offers.length > 0) {
        const matchingOffer = offers.find(
          (o) =>
            (forwarderId && o.forwarder_id === forwarderId) ||
            o.forwarder_name.toLowerCase() === forwarderName.toLowerCase(),
        );

        if (matchingOffer && matchingOffer.status === "NOT_AWARDED") {
          return {
            success: false,
            message: `Strict Policy Violation: Forwarder ${forwarderName} is marked NOT_AWARDED. Only the AWARDED forwarder can confirm this booking.`,
          };
        }
      }
    } catch (chkErr) {
      console.warn("[ForwarderCardService] Check awarded status error:", chkErr);
    }
  }

  // Update Supabase booking to CONFIRMED
  if (isSupabaseConfigured && validBookingUuid) {
    try {
      await supabase
        .from("bookings")
        .update({
          status: "Booking Confirmed",
          confirmation_status: "CONFIRMED",
          confirmed_at: nowIso,
          confirmed_by: forwarderName,
          confirmation_reason:
            confirmationReason || `Confirmed by awarded forwarder ${forwarderName}`,
          updated_at: nowIso,
        })
        .eq("id", validBookingUuid);

      // Mark forwarder offer is_confirmed
      await supabase
        .from("forwarder_offers")
        .update({
          is_confirmed: true,
          updated_at: nowIso,
        })
        .eq("booking_id", validBookingUuid)
        .eq("status", "AWARDED");

      // Audit log
      await supabase.from("audit_logs").insert({
        user_id: safeUuid(userId),
        action: "BOOKING_CONFIRMED",
        entity_type: "booking",
        entity_id: validBookingUuid,
        new_data: {
          confirmed_by: forwarderName,
          status: "Booking Confirmed",
          confirmation_status: "CONFIRMED",
          confirmed_at: nowIso,
        },
        changes: { status: "Booking Confirmed" },
        ip_address: "127.0.0.1",
        user_agent: "Nashmia-App/ConfirmationEngine",
      });

      // Booking event
      await supabase.from("booking_events").insert({
        booking_id: validBookingUuid,
        event_type: "Booking Confirmed",
        title: "Booking Confirmed by Awarded Forwarder",
        description: `Movement ${movementNumber} officially confirmed by awarded partner ${forwarderName}. Space and equipment allocated.`,
        user_id: safeUuid(userId),
        created_at: nowIso,
        location: "Carrier Operations",
      });

      // Notification
      await supabase.from("notifications").insert({
        user_id: safeUuid(userId),
        type: "booking_confirmed",
        title: `Booking Confirmed: ${movementNumber}`,
        message: `Movement ${movementNumber} has been officially confirmed by awarded forwarder ${forwarderName}.`,
        related_booking_id: validBookingUuid,
        read: false,
        created_at: nowIso,
      });
    } catch (dbErr) {
      console.error("[ForwarderCardService] Error confirming awarded booking:", dbErr);
      return {
        success: false,
        message: dbErr instanceof Error ? dbErr.message : "Failed to update booking confirmation",
      };
    }
  }

  // Dispatch realtime events
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_confirmed", {
        detail: {
          bookingId,
          movementNumber,
          forwarderName,
          timestamp: Date.now(),
        },
      }),
    );
    window.dispatchEvent(new CustomEvent("supabase_realtime_bookings_change"));
  }

  return {
    success: true,
    message: `Booking ${movementNumber} successfully CONFIRMED by awarded forwarder ${forwarderName}.`,
  };
}

/**
 * Fetch all forwarder offers for a specific booking request reference or ID
 */
export async function fetchOffersForBooking(
  bookingIdOrRef: string,
  userId?: string | null,
): Promise<ForwarderOfferCardItem[]> {
  const allCards = await fetchForwarderOfferCardsFromSupabase(userId);
  const target = (bookingIdOrRef || "").trim().toLowerCase();

  return allCards.filter((c) => {
    const bId = (c.bookingId || "").trim().toLowerCase();
    const mov = (c.movementNumber || "").trim().toLowerCase();
    const cId = (c.id || "").trim().toLowerCase();
    return bId === target || mov === target || cId === target;
  });
}
