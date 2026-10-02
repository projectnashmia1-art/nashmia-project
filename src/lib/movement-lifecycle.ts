export type LifecycleStage =
  | "Draft"
  | "Booking Requested"
  | "Booking Confirmed"
  | "Cargo Received at Warehouse"
  | "Stuffing & Sealing"
  | "Customs Cleared"
  | "Container Shipped from Warehouse"
  | "In Transit"
  | "Arrived"
  | "Delivered";

export interface LifecycleStageConfig {
  id: LifecycleStage;
  label: string;
  shortLabel: string;
  description: string;
  stepNumber: number;
  badgeClass: string;
  iconName: string;
  category: "pre-warehouse" | "warehouse" | "dispatch" | "transit" | "final";
  checklist: string[];
  nextActionLabel: string;
  locationDefault: string;
}

export const LIFECYCLE_STAGES: LifecycleStageConfig[] = [
  {
    id: "Booking Requested",
    label: "Booking Requested",
    shortLabel: "Requested",
    description: "Initial booking request generated with buyer, supplier, and freight parameters.",
    stepNumber: 1,
    badgeClass: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    iconName: "ClipboardList",
    category: "pre-warehouse",
    checklist: [
      "Buyer and Supplier parties validated",
      "Route parameters (POL → POD) established",
      "Rate card commercial freight locked",
      "Booking EDI transmitted to Forwarder",
    ],
    nextActionLabel: "Confirm Booking & Assign Carrier",
    locationDefault: "Origin Office",
  },
  {
    id: "Booking Confirmed",
    label: "Booking Confirmed",
    shortLabel: "Confirmed",
    description: "Carrier and forwarder confirmed space, vessel schedule, and container release.",
    stepNumber: 2,
    badgeClass: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    iconName: "BadgeCheck",
    category: "pre-warehouse",
    checklist: [
      "Shipping line booking reference issued",
      "Vessel name and voyage number assigned",
      "Container release order authorized from depot",
      "Depot gate-in window scheduled",
    ],
    nextActionLabel: "Receive Cargo at Warehouse",
    locationDefault: "Depot / Booking Desk",
  },
  {
    id: "Cargo Received at Warehouse",
    label: "Cargo Received at Warehouse",
    shortLabel: "Warehouse Staged",
    description:
      "Supplier goods physically received, weighed, and staged at warehouse loading dock.",
    stepNumber: 3,
    badgeClass: "border-indigo-500/20 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
    iconName: "Warehouse",
    category: "warehouse",
    checklist: [
      "Supplier delivery vehicle inspected",
      "Tally sheet and packing list verified against PO",
      "Gross weight and cubic volume checked",
      "Cargo positioned in warehouse loading bay",
    ],
    nextActionLabel: "Begin Stuffing & Apply Container Seal",
    locationDefault: "London Central Warehouse, Bay 4A",
  },
  {
    id: "Stuffing & Sealing",
    label: "Stuffing & Sealing",
    shortLabel: "Stuffed & Sealed",
    description:
      "Cargo loaded into container, Verified Gross Mass (VGM) certified, and high-security seal attached.",
    stepNumber: 4,
    badgeClass: "border-purple-500/20 bg-purple-500/10 text-purple-700 dark:text-purple-300",
    iconName: "PackageCheck",
    category: "warehouse",
    checklist: [
      "Empty container inspected for clean/dry/odorless condition",
      "Cargo stuffed per weight distribution plan",
      "High-security bolt seal affixed and recorded",
      "VGM weight certificate generated and signed",
    ],
    nextActionLabel: "Verify Customs & Generate Gate Pass",
    locationDefault: "London Central Warehouse, Stuffing Bay",
  },
  {
    id: "Customs Cleared",
    label: "Customs Cleared",
    shortLabel: "Customs Cleared",
    description:
      "Export customs declaration filed, port entry permit and outbound gate pass issued.",
    stepNumber: 5,
    badgeClass: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    iconName: "FileCheck2",
    category: "dispatch",
    checklist: [
      "Single Administrative Document (SAD / C88) submitted",
      "Commercial invoice and packing list cleared",
      "Haulier truck and driver details allocated",
      "Warehouse Outbound Gate Pass generated",
    ],
    nextActionLabel: "Ship Container from Warehouse (Gate-Out)",
    locationDefault: "Warehouse Customs Inspection Desk",
  },
  {
    id: "Container Shipped from Warehouse",
    label: "Container Shipped from Warehouse",
    shortLabel: "Dispatched",
    description: "Container trailer departed warehouse gate; en route to port of loading.",
    stepNumber: 6,
    badgeClass: "border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300",
    iconName: "Truck",
    category: "dispatch",
    checklist: [
      "Warehouse security gate-out timestamp logged",
      "Driver handed over stamped shipping documentation",
      "GPS tracking initiated to Port of Loading",
      "Port cutoff countdown active",
    ],
    nextActionLabel: "Mark Container Loaded On-Board Vessel",
    locationDefault: "En Route to POL (Felixstowe)",
  },
  {
    id: "In Transit",
    label: "In Transit",
    shortLabel: "In Transit",
    description:
      "Container loaded on ocean vessel and voyage underway across international waters.",
    stepNumber: 7,
    badgeClass: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    iconName: "Ship",
    category: "transit",
    checklist: [
      "Container loaded on container vessel",
      "Ocean Bill of Lading (B/L) issued",
      "Vessel departure confirmation received",
      "ETA monitoring active",
    ],
    nextActionLabel: "Mark Vessel Arrived at Destination Port",
    locationDefault: "At Sea / Ocean Transit",
  },
  {
    id: "Arrived",
    label: "Arrived at Port",
    shortLabel: "Arrived",
    description: "Vessel berthed at destination port of discharge (POD).",
    stepNumber: 8,
    badgeClass: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    iconName: "Anchor",
    category: "final",
    checklist: [
      "Vessel berthed at destination terminal",
      "Container discharged from vessel onto port stack",
      "Arrival notice dispatched to consignee/buyer",
      "Import customs clearance initiated",
    ],
    nextActionLabel: "Complete Final Delivery to Buyer",
    locationDefault: "Port of Discharge (Karachi)",
  },
  {
    id: "Delivered",
    label: "Delivered",
    shortLabel: "Delivered",
    description: "Container released, transported to buyer's warehouse, and POD signed.",
    stepNumber: 9,
    badgeClass: "border-emerald-600/20 bg-emerald-600/15 text-emerald-800 dark:text-emerald-300",
    iconName: "CheckCircle2",
    category: "final",
    checklist: [
      "Consignee delivery appointment scheduled",
      "Container de-vanned at buyer facility",
      "Proof of Delivery (POD) signed and archived",
      "Empty container returned to carrier depot",
    ],
    nextActionLabel: "Movement Complete",
    locationDefault: "Buyer Warehouse Destination",
  },
];

/**
 * Valid values allowed by PostgreSQL check constraint "bookings_status_check":
 * 'Draft' | 'Booking Requested' | 'Confirmed' | 'In Transit' | 'Delivered' | 'Cancelled' | 'Completed'
 */
export type DbBookingStatus =
  "Draft" | "Booking Requested" | "Confirmed" | "In Transit" | "Delivered" | "Cancelled";

/**
 * Valid values allowed for bookings.movement_status:
 * 'DRAFT' | 'REQUESTED' | 'CONFIRMED' | 'CARGO_RECEIVED' | 'STUFFING_SEALING' | 'CUSTOMS_CLEARED' | 'DISPATCHED' | 'IN_TRANSIT' | 'ARRIVED' | 'DELIVERED'
 */
export type DbMovementStatus =
  | "DRAFT"
  | "REQUESTED"
  | "CONFIRMED"
  | "CARGO_RECEIVED"
  | "STUFFING_SEALING"
  | "CUSTOMS_CLEARED"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "ARRIVED"
  | "DELIVERED";

/**
 * Maps any UI lifecycle stage or status to the strictly allowed database bookings.status column value.
 * Prevents PostgreSQL 23514 check constraint violations ("bookings_status_check").
 */
export function toDbBookingStatus(statusOrStage: string | null | undefined): DbBookingStatus {
  if (!statusOrStage) return "Booking Requested";
  const s = statusOrStage.trim().toLowerCase();

  if (s === "draft" || s.startsWith("draft")) return "Draft";
  if (s.includes("cancel") || s === "rejected") return "Cancelled";
  if (s.includes("deliver") || s.includes("completed")) return "Delivered";
  if (
    s.includes("transit") ||
    s.includes("at sea") ||
    s.includes("sailing") ||
    s.includes("arriv")
  ) {
    return "In Transit";
  }
  if (
    s.includes("confirm") ||
    s.includes("approv") ||
    s.includes("warehouse") ||
    s.includes("stuff") ||
    s.includes("seal") ||
    s.includes("loaded") ||
    s.includes("custom") ||
    s.includes("cleared") ||
    s.includes("ship") ||
    s.includes("dispatch")
  ) {
    return "Confirmed";
  }

  return "Booking Requested";
}

/**
 * Maps any UI lifecycle stage or status to the allowed bookings.movement_status column value.
 */
export function toDbMovementStatus(statusOrStage: string | null | undefined): DbMovementStatus {
  if (!statusOrStage) return "REQUESTED";
  const s = statusOrStage.trim().toLowerCase();

  if (s === "draft" || s.startsWith("draft")) return "DRAFT";
  if (s.includes("deliver") || s.includes("completed")) return "DELIVERED";
  if (s.includes("arriv") || s.includes("berth") || s.includes("discharg")) return "ARRIVED";
  if (s.includes("transit") || s.includes("at sea") || s.includes("sailing")) return "IN_TRANSIT";
  if (
    s.includes("ship") ||
    s.includes("dispatch") ||
    s.includes("gate-out") ||
    s.includes("gate out")
  ) {
    return "DISPATCHED";
  }
  if (s.includes("custom") || s.includes("cleared")) return "CUSTOMS_CLEARED";
  if (s.includes("stuff") || s.includes("seal") || s.includes("loaded")) return "STUFFING_SEALING";
  if (s.includes("received") || s.includes("staged") || s.includes("warehouse"))
    return "CARGO_RECEIVED";
  if (s.includes("confirm") || s.includes("approv")) return "CONFIRMED";

  return "REQUESTED";
}

/**
 * Normalize any legacy, database or variant status string to standard LifecycleStage.
 * Authoritative interpretation hierarchy:
 * 1. movement_status (exact operational milestone)
 * 2. status (database status)
 * 3. confirmation_status (CONFIRMED space verification)
 */
export function normalizeLifecycleStage(
  status: string | null | undefined,
  confirmationStatus?: string | null | undefined,
  identifierOrIsConfirmed?: string | boolean | null,
  movementStatus?: string | null | undefined,
): LifecycleStage {
  const m = (movementStatus || "").trim().toUpperCase();
  const confUpper = (confirmationStatus || "").trim().toUpperCase();
  const s = (status || "").trim().toLowerCase();

  // 1. Authoritative check on operational movement_status if populated
  if (m === "DELIVERED") return "Delivered";
  if (m === "ARRIVED") return "Arrived";
  if (m === "IN_TRANSIT") return "In Transit";
  if (m === "DISPATCHED") return "Container Shipped from Warehouse";
  if (m === "CUSTOMS_CLEARED") return "Customs Cleared";
  if (m === "STUFFING_SEALING") return "Stuffing & Sealing";
  if (m === "CARGO_RECEIVED") return "Cargo Received at Warehouse";
  if (m === "CONFIRMED") return "Booking Confirmed";
  if (m === "REQUESTED") return "Booking Requested";
  if (m === "DRAFT") return s.includes("request") ? "Booking Requested" : "Draft";

  // 2. Exact match with any canonical LifecycleStage
  for (const stage of LIFECYCLE_STAGES) {
    if (stage.id.toLowerCase() === s) {
      return stage.id;
    }
  }

  let isExplicitlyConfirmed = confUpper === "CONFIRMED";
  if (!isExplicitlyConfirmed && typeof identifierOrIsConfirmed === "boolean") {
    isExplicitlyConfirmed = identifierOrIsConfirmed;
  } else if (
    !isExplicitlyConfirmed &&
    typeof identifierOrIsConfirmed === "string" &&
    identifierOrIsConfirmed
  ) {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("nashmia_confirmed_identifiers_v1");
        if (raw) {
          const arr = JSON.parse(raw);
          if (Array.isArray(arr) && arr.includes(identifierOrIsConfirmed.trim().toUpperCase())) {
            isExplicitlyConfirmed = true;
          }
        }
      } catch {
        // Ignore JSON or storage errors
      }
    }
  }

  if (!status) {
    return isExplicitlyConfirmed ? "Booking Confirmed" : "Booking Requested";
  }

  // 3. High-milestone progression
  if (s.includes("deliver") || s.includes("completed")) return "Delivered";
  if (s.includes("arriv") || s.includes("berth") || s.includes("discharg")) return "Arrived";
  if (s.includes("transit") || s.includes("at sea") || s.includes("sailing")) return "In Transit";
  if (
    s.includes("shipped") ||
    s.includes("dispatch") ||
    s.includes("gate-out") ||
    s.includes("gate out")
  )
    return "Container Shipped from Warehouse";
  if (s.includes("custom") || s.includes("cleared")) return "Customs Cleared";
  if (s.includes("stuff") || s.includes("seal") || s.includes("loaded"))
    return "Stuffing & Sealing";
  if (
    s.includes("received") ||
    s.includes("staged") ||
    s.includes("warehouse staged") ||
    s.includes("warehouse")
  )
    return "Cargo Received at Warehouse";

  // 4. Operational stages: Quotation received / Rate verification / Awarded
  // Note: Receiving a quotation or awarding a forwarder DOES NOT automatically mean CONFIRMED space!
  // It remains at pre-confirmation stage until carrier/forwarder explicitly confirms space.
  if (
    s.includes("quote") ||
    s.includes("offer") ||
    s.includes("verification") ||
    s.includes("awarded") ||
    s.includes("allocation")
  ) {
    if (isExplicitlyConfirmed) {
      return "Booking Confirmed";
    }
    return "Booking Requested";
  }

  // 5. Confirmation & Approval variations
  if (
    isExplicitlyConfirmed ||
    s === "booking confirmed" ||
    s === "confirmed" ||
    s === "approved" ||
    s === "booking approved" ||
    s.includes("space confirmed") ||
    s.includes("carrier confirmed")
  ) {
    return "Booking Confirmed";
  }

  // 6. Draft states
  if (s === "draft" || s.startsWith("draft")) {
    return "Draft";
  }

  // 7. Initial / Request / Revision states
  return "Booking Requested";
}

export function getLifecycleStageConfig(
  status: string | null | undefined,
  confirmationStatus?: string | null | undefined,
  identifierOrIsConfirmed?: string | boolean | null,
  movementStatus?: string | null | undefined,
): LifecycleStageConfig {
  const normalized = normalizeLifecycleStage(
    status,
    confirmationStatus,
    identifierOrIsConfirmed,
    movementStatus,
  );
  return LIFECYCLE_STAGES.find((st) => st.id === normalized) || LIFECYCLE_STAGES[0];
}

export function getStageStepIndex(
  status: string | null | undefined,
  confirmationStatus?: string | null | undefined,
  identifierOrIsConfirmed?: string | boolean | null,
  movementStatus?: string | null | undefined,
): number {
  const normalized = normalizeLifecycleStage(
    status,
    confirmationStatus,
    identifierOrIsConfirmed,
    movementStatus,
  );
  const idx = LIFECYCLE_STAGES.findIndex((st) => st.id === normalized);
  return idx >= 0 ? idx : 0;
}

export function getNextLifecycleStage(
  status: string | null | undefined,
  confirmationStatus?: string | null | undefined,
  identifierOrIsConfirmed?: string | boolean | null,
  movementStatus?: string | null | undefined,
): LifecycleStageConfig | null {
  const currentIdx = getStageStepIndex(
    status,
    confirmationStatus,
    identifierOrIsConfirmed,
    movementStatus,
  );
  if (currentIdx < LIFECYCLE_STAGES.length - 1) {
    return LIFECYCLE_STAGES[currentIdx + 1];
  }
  return null;
}

export function getPreviousLifecycleStage(
  status: string | null | undefined,
  confirmationStatus?: string | null | undefined,
  identifierOrIsConfirmed?: string | boolean | null,
  movementStatus?: string | null | undefined,
): LifecycleStageConfig | null {
  const currentIdx = getStageStepIndex(
    status,
    confirmationStatus,
    identifierOrIsConfirmed,
    movementStatus,
  );
  if (currentIdx > 0) {
    return LIFECYCLE_STAGES[currentIdx - 1];
  }
  return null;
}

/**
 * Generates a standardized, unique Movement Number.
 * Format: MOV-YYYY-XXXXX (e.g., MOV-2026-00125)
 */
export function generateMovementNumber(year: number = new Date().getFullYear()): string {
  const randomSuffix = Math.floor(100 + Math.random() * 90000);
  const padded = String(randomSuffix).padStart(5, "0");
  return `MOV-${year}-${padded}`;
}

/**
 * Checks if a string matches the Movement Number format
 */
export function isMovementNumber(ref: string | null | undefined): boolean {
  if (!ref) return false;
  return /^MOV-\d{4}-\d+$/i.test(ref.trim());
}

/**
 * Extracts a Movement or Booking Number (MOV-YYYY-XXXXX, NASH-BK-YYYY-XXXX, REQ-YYYY-XXXXX, BK-YYYY-XXXXX) from any string (subject, body, snippet, etc.)
 */
export function extractMovementNumber(text: string | null | undefined): string | null {
  if (!text) return null;

  // 1. Strict priority: check for official Movement Number (MOV-) first!
  const movMatch =
    text.match(/\b(MOV-\d{4}-\d{3,6})\b/i) ||
    text.match(/\b([A-Z0-9]{2,10}-MOV-\d{4}-\d{3,6})\b/i) ||
    text.match(/\b(MOV-[A-Z0-9-]{3,20})\b/i) ||
    text.match(/\b([A-Z0-9]{2,10}-MOV-[A-Z0-9-]{3,20})\b/i);
  if (movMatch) return movMatch[1].toUpperCase();

  // 2. Secondary references (REQ-, BK-, NASH-)
  const match =
    text.match(/\b([A-Z0-9]{2,10}-(?:REQ|BK)-\d{4}-\d{3,6})\b/i) ||
    text.match(/\b((?:REQ|BK)-\d{4}-\d{3,6})\b/i) ||
    text.match(/\b([A-Z0-9]{2,10}-(?:REQ|BK)-[A-Z0-9-]{3,20})\b/i) ||
    text.match(/\b((?:REQ|BK)-[A-Z0-9-]{3,20})\b/i) ||
    text.match(/\b(NASH-[A-Z0-9-]{3,20})\b/i) ||
    text.match(/\b(BKG?-[A-Z0-9-]{3,20})\b/i) ||
    text.match(/\b(REF-[A-Z0-9-]{3,20})\b/i);
  return match ? match[1].toUpperCase() : null;
}
