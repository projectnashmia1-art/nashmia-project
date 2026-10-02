/**
 * Forwarder-Specific Pattern Override System (Section 10)
 * Allows organization-scoped, auditable, and version-controlled pattern overrides
 * for forwarders with non-standard syntax (e.g., "Fr8:", "Doc/local:", "HC box").
 */

export interface PatternOverride {
  id: string;
  forwarderId: string; // Specific forwarder ID or '*' for org-wide pattern
  forwarderName: string;
  pattern: string; // Human-readable or regex pattern string
  regexPattern: string; // Compiled regex pattern string
  fieldMapped:
    | "rate"
    | "currency"
    | "containerType"
    | "containerQuantity"
    | "additionalCharges"
    | "totalCost"
    | "transitTime"
    | "freeDays"
    | "etd"
    | "eta"
    | "carrier";
  description: string;
  createdBy: string;
  approvedBy: string;
  createdAt: string;
  isActive: boolean;
  version: number;
  versionHistory: Array<{
    version: number;
    pattern: string;
    regexPattern: string;
    modifiedAt: string;
    modifiedBy: string;
    notes?: string;
  }>;
}

const STORAGE_KEY = "nashmia_forwarder_pattern_overrides_v1";

// Default pre-approved forwarder patterns according to maritime industry standards
const DEFAULT_OVERRIDES: PatternOverride[] = [
  {
    id: "ovr-fr8-rate",
    forwarderId: "*",
    forwarderName: "Global Maritime Standard",
    pattern: "Fr8: $RATE",
    regexPattern: "(?:fr8|frt|o/f|o\\.f\\.)\\s*[:=]?\\s*(?:usd|eur|\\$|€)?\\s*([0-9,.]+)",
    fieldMapped: "rate",
    description: "Matches shorthand 'Fr8 $1000' or 'O/F: 1200' as base ocean freight rate",
    createdBy: "System Admin",
    approvedBy: "Operations Lead",
    createdAt: "2026-08-01T00:00:00.000Z",
    isActive: true,
    version: 1,
    versionHistory: [],
  },
  {
    id: "ovr-doc-local",
    forwarderId: "*",
    forwarderName: "Global Maritime Standard",
    pattern: "doc/local: $CHARGES",
    regexPattern:
      "(?:doc(?:s)?\\s*(?:\\/|\\+|and)\\s*local(?:s)?|local\\s*charges?|dest(?:ination)?\\s*charges?)\\s*[:=]?\\s*(?:usd|eur|\\$|€)?\\s*([0-9,.]+)",
    fieldMapped: "additionalCharges",
    description:
      "Matches 'doc/local 200' or 'docs + local: $250' as documentation and local charges",
    createdBy: "System Admin",
    approvedBy: "Operations Lead",
    createdAt: "2026-08-01T00:00:00.000Z",
    isActive: true,
    version: 1,
    versionHistory: [],
  },
  {
    id: "ovr-hc-box",
    forwarderId: "*",
    forwarderName: "Global Maritime Standard",
    pattern: "HC box = 40HC",
    regexPattern: "\\b(?:hc\\s*box(?:es)?|high\\s*cube\\s*box(?:es)?)\\b",
    fieldMapped: "containerType",
    description: "Normalizes 'HC box' or 'high cube box' to 40HC container type",
    createdBy: "System Admin",
    approvedBy: "Operations Lead",
    createdAt: "2026-08-01T00:00:00.000Z",
    isActive: true,
    version: 1,
    versionHistory: [],
  },
  {
    id: "ovr-two-boxes",
    forwarderId: "*",
    forwarderName: "Global Maritime Standard",
    pattern: "two 20ft boxes = 2 x 20FT",
    regexPattern:
      "\\b(one|two|three|four|five|six|seven|eight|nine|ten|\\d+)\\s*(?:x\\s*)?(?:x\\s*)?(20(?:ft|'|\\s*foot)?|40(?:ft|'|\\s*foot)?(?:\\s*hc)?)\\s*(?:box|boxes|containers?|cntrs?)\\b",
    fieldMapped: "containerQuantity",
    description: "Extracts written quantity and container type from phrases like 'two 20ft boxes'",
    createdBy: "System Admin",
    approvedBy: "Operations Lead",
    createdAt: "2026-08-01T00:00:00.000Z",
    isActive: true,
    version: 1,
    versionHistory: [],
  },
];

export function getStoredPatternOverrides(): PatternOverride[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Fallback to defaults
  }
  return DEFAULT_OVERRIDES;
}

export function saveStoredPatternOverrides(overrides: PatternOverride[]): void {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    }
  } catch (err) {
    console.warn("[PatternOverrideService] Failed to save overrides to storage:", err);
  }
}

/**
 * Returns all active pattern overrides matching a forwarder or global rules
 */
export function getActiveOverridesForForwarder(forwarderId?: string | null): PatternOverride[] {
  const all = getStoredPatternOverrides();
  return all.filter((o) => {
    if (!o.isActive) return false;
    if (o.forwarderId === "*") return true;
    if (forwarderId && o.forwarderId === forwarderId) return true;
    return false;
  });
}

/**
 * Tests a pattern override against a sample email text before activation
 */
export function testPatternOverride(
  regexPattern: string,
  sampleText: string,
): { matched: boolean; extractedGroup: string | null; rawMatch: string | null; error?: string } {
  try {
    const rx = new RegExp(regexPattern, "i");
    const m = sampleText.match(rx);
    if (!m) {
      return { matched: false, extractedGroup: null, rawMatch: null };
    }
    return {
      matched: true,
      rawMatch: m[0],
      extractedGroup: m[1] || m[0],
    };
  } catch (err) {
    return {
      matched: false,
      extractedGroup: null,
      rawMatch: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
