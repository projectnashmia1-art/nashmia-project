/**
 * Deterministic Rule-Based Charge, Currency, Amount & Total Extraction Engine
 *
 * Conforms strictly to business requirements:
 * 3. Charge Extraction
 *    - Keyword dictionaries, regular expressions, and line-based parsing
 *    - Configurable keyword mappings:
 *      * Ocean Freight (ocean freight, ocean freight charges, sea freight, freight, o/f, OF)
 *      * Terminal Handling (THC, terminal handling, terminal handling charge)
 *      * Documentation (documentation, documentation fee, doc fee, DOC, BL fee, bill of lading fee)
 *      * Origin Charges (origin charges, origin local charges, export charges, origin handling)
 *      * Destination Charges (destination charges, destination local charges, import charges, destination handling)
 *      * Customs (customs, customs clearance, clearance charges)
 *      * Trucking (trucking, haulage, transport, delivery charges)
 *      * Other (other charges, miscellaneous, surcharge, additional charges)
 *    - Preserves: Original charge name, Extracted amount, Currency, Unit, Quantity, Original source line
 *
 * 4. Currency Extraction
 *    - Recognizes only explicit currency values: USD, EUR, GBP, AED, PKR, INR, SAR, CNY, JPY, CAD, AUD
 *    - Recognizes symbols only when unambiguous: € = EUR, £ = GBP, AED/Dhs = AED, PKR/Rs = PKR, ₹ = INR, $ = USD
 *    - Does NOT assume currency when only a number is present
 *    - If currency is missing: saves amount as null or amount_without_currency, adds warning, marks needs_review
 *
 * 5. Amount Extraction
 *    - Supports formats: USD 900, USD 1,200.50, 900 USD, $900, 900 USD per container, USD 900 x 2, USD 900-1000, USD 900 to 1000
 *    - Does not silently choose a value from a range:
 *      * amount_min, amount_max, amount = null, status = 'range', needs_review = true
 *    - For missing values: amount = null, status = 'amount_missing', needs_review = true
 *
 * 6. Total Calculation
 *    - Stores explicitly written total as quoted_total
 *    - Calculates calculated_total only when all amounts available, same currency, no ranges, clear units/quantities, no pending/applicable charges
 *    - Never replaces quoted_total with calculated_total
 *    - If quoted_total != calculated_total: preserves both, adds conflict warning, marks needs_review
 */

export type ChargeCategory =
  | "ocean_freight"
  | "terminal_handling"
  | "documentation"
  | "origin_charges"
  | "destination_charges"
  | "customs"
  | "trucking"
  | "other";

export type ChargeUnit =
  | "per_container"
  | "per_shipment"
  | "per_bl"
  | "per_cbm"
  | "per_kg"
  | "per_teu"
  | "lump_sum"
  | "flat"
  | "unknown";

export type ChargeAmountStatus =
  "exact" | "range" | "amount_missing" | "currency_missing" | "pending_applicable";

export interface ExtractedChargeItem {
  category: ChargeCategory;
  categoryLabel: string;
  originalChargeName: string;
  original_charge_name: string;
  amount: number | null;
  extractedAmount: number | null;
  extracted_amount: number | null;
  amountWithoutCurrency: number | null;
  amount_without_currency: number | null;
  amountMin: number | null;
  amount_min: number | null;
  amountMax: number | null;
  amount_max: number | null;
  currency: string | null;
  unit: ChargeUnit;
  unitRaw?: string | null;
  quantity: number | null;
  calculatedSubtotal: number | null;
  calculated_subtotal: number | null;
  status: ChargeAmountStatus;
  needsReview: boolean;
  needs_review: boolean;
  warnings: string[];
  originalSourceLine: string;
  original_source_line: string;
  lineNumber: number;
}

export interface TotalCalculationResult {
  quotedTotal: number | null;
  quoted_total: number | null;
  calculatedTotal: number | null;
  calculated_total: number | null;
  currency: string | null;
  isEligibleForCalculation: boolean;
  hasDiscrepancy: boolean;
  discrepancyDifference: number | null;
  status: "MATCHED" | "DISCREPANCY" | "CALCULATION_UNAVAILABLE" | "QUOTED_ONLY" | "CALCULATED_ONLY";
  warnings: string[];
  needsReview: boolean;
  needs_review: boolean;
}

export interface ChargeExtractionResult {
  charges: ExtractedChargeItem[];
  chargeMap: Record<ChargeCategory, ExtractedChargeItem | null>;
  quotedTotal: number | null;
  quoted_total: number | null;
  calculatedTotal: number | null;
  calculated_total: number | null;
  totals: TotalCalculationResult;
  currency: string | null;
  hasRange: boolean;
  hasMissingCurrency: boolean;
  hasMissingAmount: boolean;
  hasDiscrepancy: boolean;
  hasMultipleCurrencies: boolean;
  needsReview: boolean;
  warnings: string[];
}

/**
 * Configurable Keyword Mappings strictly mapped to specification
 */
export const CHARGE_KEYWORD_MAPPINGS: Record<
  ChargeCategory,
  { label: string; keywords: string[] }
> = {
  ocean_freight: {
    label: "Ocean Freight",
    keywords: [
      "ocean freight charges",
      "ocean freight",
      "sea freight",
      "freight charges",
      "freight rate",
      "freight",
      "o/f",
      "o.f.",
      "ocean rate",
      "sea rate",
      "baserate",
      "base rate",
      "rate",
      "price",
      "quote",
      "offer",
    ],
  },
  terminal_handling: {
    label: "Terminal Handling",
    keywords: [
      "terminal handling charge",
      "terminal handling charges",
      "terminal handling",
      "origin thc",
      "destination thc",
      "dest thc",
      "o-thc",
      "d-thc",
      "thc",
    ],
  },
  documentation: {
    label: "Documentation",
    keywords: [
      "bill of lading fee",
      "documentation fee",
      "documentation charges",
      "documentation",
      "doc fee",
      "bl fee",
      "b/l fee",
      "doc",
    ],
  },
  origin_charges: {
    label: "Origin Charges",
    keywords: [
      "origin local charges",
      "origin local fees",
      "origin handling",
      "origin charges",
      "export local charges",
      "export charges",
      "origin locals",
      "origin port charges",
    ],
  },
  destination_charges: {
    label: "Destination Charges",
    keywords: [
      "destination local charges",
      "destination local fees",
      "destination handling",
      "destination charges",
      "dest local charges",
      "import local charges",
      "import charges",
      "destination locals",
      "destination port charges",
      "dest charges",
    ],
  },
  customs: {
    label: "Customs",
    keywords: [
      "customs clearance charges",
      "customs clearance fee",
      "customs clearance",
      "clearance charges",
      "customs charges",
      "customs fee",
      "customs broker fee",
      "customs brokerage",
      "customs",
    ],
  },
  trucking: {
    label: "Trucking",
    keywords: [
      "delivery charges",
      "trucking charges",
      "trucking fee",
      "trucking",
      "haulage charges",
      "haulage fee",
      "haulage",
      "inland transport",
      "transport charges",
      "transport",
      "drayage",
    ],
  },
  other: {
    label: "Other Charges",
    keywords: [
      "bunker adjustment factor",
      "bunker adjustment",
      "bunker surcharge",
      "bunker",
      "baf",
      "additional charges",
      "miscellaneous charges",
      "other charges",
      "miscellaneous",
      "misc charges",
      "surcharge",
      "surcharges",
      "vgm fee",
      "vgm charge",
      "seal fee",
      "ams fee",
      "ens fee",
      "admin fee",
      "security fee",
    ],
  },
};

/**
 * Recognized explicit ISO currencies
 */
export const EXPLICIT_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
  "AED",
  "PKR",
  "INR",
  "SAR",
  "CNY",
  "JPY",
  "CAD",
  "AUD",
]);

/**
 * Unambiguous currency symbols mapping
 */
export const UNAMBIGUOUS_CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  "£": "GBP",
  "₹": "INR",
  AED: "AED",
  DHS: "AED",
  DH: "AED",
  PKR: "PKR",
  RS: "PKR",
  PKRS: "PKR",
  $: "USD",
  US$: "USD",
};

/**
 * Terms indicating a charge is pending, not yet fixed, or at actuals
 */
const PENDING_APPLICABLE_TERMS = [
  "at actuals",
  "at actual",
  "actuals",
  "as per receipt",
  "as per actual",
  "as applicable",
  "subject to",
  "tba",
  "tbd",
  "pending",
  "extra at actual",
  "excluded",
];

/**
 * Normalizes numerical text into clean standard float.
 * Handles commas as thousands separators ("1,200.50" -> 1200.5) or European decimal ("1.200,50" -> 1200.5).
 */
export function parseNumericClean(raw: string): number | null {
  if (!raw) return null;
  let str = raw.trim();

  // If both , and . exist
  if (str.includes(",") && str.includes(".")) {
    const lastComma = str.lastIndexOf(",");
    const lastDot = str.lastIndexOf(".");
    if (lastDot > lastComma) {
      // 1,200.50 -> 1200.50
      str = str.replace(/,/g, "");
    } else {
      // 1.200,50 -> 1200.50
      str = str.replace(/\./g, "").replace(",", ".");
    }
  } else if (str.includes(",")) {
    // Check if comma is decimal (e.g. "150,50") or thousands (e.g. "1,500")
    const parts = str.split(",");
    if (parts.length === 2 && parts[1].length === 3) {
      // Thousands separator
      str = str.replace(/,/g, "");
    } else {
      // Decimal separator
      str = str.replace(",", ".");
    }
  }

  const num = parseFloat(str);
  return !isNaN(num) && isFinite(num) ? num : null;
}

/**
 * 4. CURRENCY EXTRACTION
 *
 * Recognizes only explicit currency values or unambiguous symbols.
 * Returns null if no currency is identified.
 */
export function extractExplicitCurrency(text: string): string | null {
  if (!text) return null;

  // 1. Check explicit 3-letter ISO currencies (word boundary)
  const isoMatch = text.match(/\b(USD|EUR|GBP|AED|PKR|INR|SAR|CNY|JPY|CAD|AUD)\b/i);
  if (isoMatch) {
    const code = isoMatch[1].toUpperCase();
    if (EXPLICIT_CURRENCIES.has(code)) {
      return code;
    }
  }

  // 2. Check Dhs / DH for AED
  if (/\b(?:Dhs|DH)\b/i.test(text)) {
    return "AED";
  }

  // 3. Check Rs / PKRs for PKR
  if (/\b(?:PKRs|Rs)\b/i.test(text)) {
    return "PKR";
  }

  // 4. Check unambiguous symbols (€, £, ₹, $)
  if (text.includes("€")) return "EUR";
  if (text.includes("£")) return "GBP";
  if (text.includes("₹")) return "INR";
  if (text.includes("US$") || text.includes("$")) return "USD";

  return null;
}

/**
 * Extracts unit from a text line (e.g. "per 40HC", "per shipment", "/cntr", "per container")
 */
export function extractChargeUnit(text: string): { unit: ChargeUnit; unitRaw: string | null } {
  if (!text) return { unit: "unknown", unitRaw: null };

  const lower = text.toLowerCase();

  // per_container
  const containerMatch = lower.match(
    /(?:per|\/)?\s*(?:(?:40\s*h[cq]|20\s*f[t]?|40\s*f[t]?|45\s*h[cq]|teu|cntrs?|containers?|boxes?))\b/i,
  );
  if (containerMatch) {
    return { unit: "per_container", unitRaw: containerMatch[0] };
  }

  if (
    lower.includes("per container") ||
    lower.includes("/container") ||
    lower.includes("per cntr") ||
    lower.includes("/cntr") ||
    lower.includes("containers") ||
    lower.includes("container")
  ) {
    return { unit: "per_container", unitRaw: "per container" };
  }

  // per_shipment
  const shipmentMatch = lower.match(/(?:per|\/)\s*(?:shipment|shpt|booking)\b/i);
  if (shipmentMatch) {
    return { unit: "per_shipment", unitRaw: shipmentMatch[0] };
  }

  // per_bl
  const blMatch = lower.match(/(?:per|\/)\s*(?:b\/?l|bill\s*of\s*lading|bl)\b/i);
  if (blMatch) {
    return { unit: "per_bl", unitRaw: blMatch[0] };
  }

  // per_cbm
  const cbmMatch = lower.match(/(?:per|\/)\s*(?:cbm|m3|cubic\s*meter)\b/i);
  if (cbmMatch) {
    return { unit: "per_cbm", unitRaw: cbmMatch[0] };
  }

  // per_kg
  const kgMatch = lower.match(/(?:per|\/)\s*(?:kg|kilo|ton|mt|metric\s*ton)\b/i);
  if (kgMatch) {
    return { unit: "per_kg", unitRaw: kgMatch[0] };
  }

  // lump_sum / flat
  if (
    lower.includes("lump sum") ||
    lower.includes("lumpsum") ||
    lower.includes("flat fee") ||
    lower.includes("flat rate")
  ) {
    return { unit: "lump_sum", unitRaw: "lump sum" };
  }

  return { unit: "unknown", unitRaw: null };
}

/**
 * Extracts quantity from a text line (e.g. "x 2 containers", "x 2", "2 containers", "qty: 2")
 */
export function extractChargeQuantity(text: string): number | null {
  if (!text) return null;

  // Patterns like "x 2", "x 2 containers", "x2"
  const xMatch = text.match(/[x*]\s*(\d+)(?:\s*(?:containers?|cntrs?|units?|boxes|shpt|bl))?/i);
  if (xMatch) {
    const q = parseInt(xMatch[1], 10);
    if (!isNaN(q) && q > 0 && q <= 500) return q;
  }

  // Patterns like "2 containers", "2 x 40HC"
  const countMatch = text.match(/\b(\d+)\s*(?:x\s*)?(?:containers?|cntrs?|boxes|units)\b/i);
  if (countMatch) {
    const q = parseInt(countMatch[1], 10);
    if (!isNaN(q) && q > 0 && q <= 500) return q;
  }

  // Patterns like "qty: 2"
  const qtyMatch = text.match(/\b(?:qty|quantity)\s*[:=]?\s*(\d+)\b/i);
  if (qtyMatch) {
    const q = parseInt(qtyMatch[1], 10);
    if (!isNaN(q) && q > 0 && q <= 500) return q;
  }

  return null;
}

/**
 * 5. AMOUNT EXTRACTION
 *
 * Extracts monetary amount, detecting:
 * - Exact single value (e.g. "USD 900", "USD 1,200.50", "900 USD", "$900")
 * - Ranges (e.g. "USD 900-1000", "USD 900 to 1000", "900 - 1000 USD")
 * - Missing values (e.g. "THC: TBA", "Customs: At actuals")
 *
 * Rules:
 * - Do not silently choose a value from a range!
 *   For ranges: amount_min = 900, amount_max = 1000, amount = null, status = 'range', needs_review = true
 * - For missing values: amount = null, status = 'amount_missing', needs_review = true
 */
export interface ParsedAmountDetails {
  amount: number | null;
  amountWithoutCurrency: number | null;
  amountMin: number | null;
  amountMax: number | null;
  currency: string | null;
  status: ChargeAmountStatus;
  needsReview: boolean;
  warnings: string[];
}

export function parseChargeAmountDetails(
  lineValuePart: string,
  fullLine: string,
): ParsedAmountDetails {
  const warnings: string[] = [];

  // Check 1: Pending or At Actuals (use word boundaries to avoid matching substrings like 'depending')
  for (const term of PENDING_APPLICABLE_TERMS) {
    const termRegex = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i");
    if (termRegex.test(fullLine)) {
      warnings.push(`Charge is marked as '${term}'. Amount is not fixed.`);
      return {
        amount: null,
        amountWithoutCurrency: null,
        amountMin: null,
        amountMax: null,
        currency: extractExplicitCurrency(fullLine),
        status: "pending_applicable",
        needsReview: true,
        warnings,
      };
    }
  }

  // Check 2: Currency detection
  const detectedCurrency = extractExplicitCurrency(fullLine);

  // Check 3: Range Detection (e.g., "USD 900-1000", "USD 900 to 1000", "900 - 1000 USD", "$1,200 - $1,450 USD")
  // First clean booking tokens (e.g. BK-2026-0042) to avoid false range matches
  const cleanValuePart = lineValuePart.replace(
    /\b(?:BK|MOV|BKG|REF|PO|CNTR|CONTAINER)[\s#.:-]*[0-9A-Z-]+/gi,
    " ",
  );

  const rangePattern =
    /(?:(?:USD|EUR|GBP|AED|PKR|INR|SAR|CNY|JPY|CAD|AUD|\$|€|£)\s*)?([0-9,.]+)\s*(?:-|to|~|\/)\s*(?:(?:USD|EUR|GBP|AED|PKR|INR|SAR|CNY|JPY|CAD|AUD|\$|€|£)\s*)?([0-9,.]+)(?:\s*(?:USD|EUR|GBP|AED|PKR|INR|SAR|CNY|JPY|CAD|AUD))?/i;
  const rangeMatch = cleanValuePart.match(rangePattern) || lineValuePart.match(rangePattern);

  if (rangeMatch) {
    const rawMin = rangeMatch[1];
    const rawMax = rangeMatch[2];
    const minVal = parseNumericClean(rawMin);
    const maxVal = parseNumericClean(rawMax);

    if (minVal !== null && maxVal !== null && minVal < maxVal && minVal > 0) {
      warnings.push(
        `Range detected (${minVal} to ${maxVal}${detectedCurrency ? " " + detectedCurrency : ""}). Cannot select arbitrary value without human review.`,
      );
      if (!detectedCurrency) {
        warnings.push("Currency is missing for range charge.");
      }

      return {
        amount: null,
        amountWithoutCurrency: null,
        amountMin: minVal,
        amountMax: maxVal,
        currency: detectedCurrency,
        status: "range",
        needsReview: true,
        warnings,
      };
    }
  }

  // Check 4: Single Amount Detection
  // Matches:
  // "USD 900", "USD 1,200.50", "900 USD", "$900", "900 USD per container", "USD 900 x 2"
  const amountPattern =
    /(?:(?:USD|EUR|GBP|AED|PKR|INR|SAR|CNY|JPY|CAD|AUD|\$|€|£)\s*([0-9,.]+)|([0-9,.]+)\s*(?:USD|EUR|GBP|AED|PKR|INR|SAR|CNY|JPY|CAD|AUD)|([0-9,.]+))/i;
  const match = lineValuePart.match(amountPattern);

  if (match) {
    const rawAmountStr = match[1] || match[2] || match[3];
    const parsed = parseNumericClean(rawAmountStr);

    if (parsed !== null && parsed > 0) {
      // Filter out year numbers like 2026 if standalone
      if (parsed === 2026 && !detectedCurrency) {
        return {
          amount: null,
          amountWithoutCurrency: null,
          amountMin: null,
          amountMax: null,
          currency: null,
          status: "amount_missing",
          needsReview: true,
          warnings: ["Detected value appears to be calendar year (2026), not monetary amount."],
        };
      }

      if (!detectedCurrency) {
        warnings.push(
          `Currency is missing for extracted amount ${parsed}. Cannot assume currency.`,
        );
        return {
          amount: null,
          amountWithoutCurrency: parsed,
          amountMin: null,
          amountMax: null,
          currency: null,
          status: "currency_missing",
          needsReview: true,
          warnings,
        };
      }

      return {
        amount: parsed,
        amountWithoutCurrency: null,
        amountMin: null,
        amountMax: null,
        currency: detectedCurrency,
        status: "exact",
        needsReview: false,
        warnings,
      };
    }
  }

  // Check 5: Missing Amount
  warnings.push("No monetary amount found on charge line.");
  return {
    amount: null,
    amountWithoutCurrency: null,
    amountMin: null,
    amountMax: null,
    currency: detectedCurrency,
    status: "amount_missing",
    needsReview: true,
    warnings,
  };
}

/**
 * Identifies which charge category a line header matches
 */
function identifyChargeCategory(
  lineHeader: string,
): { category: ChargeCategory; label: string; matchedKeyword: string } | null {
  const clean = lineHeader
    .toLowerCase()
    .trim()
    .replace(/[:=-]+$/, "")
    .trim();

  for (const [catKey, config] of Object.entries(CHARGE_KEYWORD_MAPPINGS)) {
    for (const kw of config.keywords) {
      // Word boundary match
      const regex = new RegExp(`\\b${kw.replace("/", "\\/")}\\b`, "i");
      if (regex.test(clean)) {
        return {
          category: catKey as ChargeCategory,
          label: config.label,
          matchedKeyword: kw,
        };
      }
    }
  }

  return null;
}

/**
 * 3. & 5. LINE-BASED CHARGE EXTRACTION
 *
 * Iterates line by line through email subject and body.
 * Identifies charges using keyword mappings, extracts amount, currency, unit, quantity.
 */
export function extractChargesFromLines(
  text: string,
  context?: {
    containerCount?: number | null;
  },
): {
  charges: ExtractedChargeItem[];
  chargeMap: Record<ChargeCategory, ExtractedChargeItem | null>;
  quotedTotal: number | null;
  quotedTotalLine: string | null;
} {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const charges: ExtractedChargeItem[] = [];
  const chargeMap: Record<ChargeCategory, ExtractedChargeItem | null> = {
    ocean_freight: null,
    terminal_handling: null,
    documentation: null,
    origin_charges: null,
    destination_charges: null,
    customs: null,
    trucking: null,
    other: null,
  };

  let quotedTotal: number | null = null;
  let quotedTotalLine: string | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const lineNumber = idx + 1;
    const cleanLine = rawLine.replace(/^[\s\-*•·\d.)\]]+/, "").trim();

    // Check for Quoted Total line:
    // e.g. "Total: USD 2,425", "Quoted Total = $2,425", "Grand Total: 2,425 USD", "All-in Total Quoted: $1,850 USD"
    const totalMatch =
      cleanLine.match(
        /^(?:all[\s\-_]*in(?:\s*(?:total|rate|quote|quoted|cost|charges?))*|quoted\s*total|total(?:\s*(?:quoted|all[\s\-_]*in|rate|amount|cost|freight|charges?))*|grand\s*total|lump\s*sum)\s*(?::|=|\s+-\s+)\s*(.*)$/i,
      ) ||
      rawLine.match(
        /^(?:all[\s\-_]*in(?:\s*(?:total|rate|quote|quoted|cost|charges?))*|quoted\s*total|total(?:\s*(?:quoted|all[\s\-_]*in|rate|amount|cost|freight|charges?))*|grand\s*total|lump\s*sum)\s*(?::|=|\s+-\s+)\s*(.*)$/i,
      );

    if (totalMatch && quotedTotal === null) {
      const valuePart = totalMatch[1].trim();
      const parsedTotal = parseChargeAmountDetails(valuePart, rawLine);
      if (parsedTotal.amount !== null) {
        quotedTotal = parsedTotal.amount;
        quotedTotalLine = rawLine;
      }
      continue;
    }

    // Line with key-value delimiter (colon, equals, or spaced hyphen)
    const delimiterMatch =
      cleanLine.match(/^([a-zA-Z0-9\s/&._()[\]#,-]+?)\s*(?::|=|\s+-\s+)\s*(.+)$/) ||
      rawLine.match(/^([a-zA-Z0-9\s/&._()[\]#,-]+?)\s*(?::|=|\s+-\s+)\s*(.+)$/);
    if (!delimiterMatch) {
      // Also test if line begins with a known charge keyword followed by currency / amount
      // e.g., "THC USD 150 x 2 containers"
      let handledAsKeywordLine = false;
      for (const [catKey, config] of Object.entries(CHARGE_KEYWORD_MAPPINGS)) {
        for (const kw of config.keywords) {
          const kwRegex = new RegExp(`^(${kw.replace("/", "\\/")})\\b\\s*(.+)$`, "i");
          const m = cleanLine.match(kwRegex) || rawLine.match(kwRegex);
          if (m) {
            const chargeName = m[1].trim();
            const valuePart = m[2].trim();
            processChargeLine(
              catKey as ChargeCategory,
              config.label,
              chargeName,
              valuePart,
              rawLine,
              lineNumber,
              context,
            );
            handledAsKeywordLine = true;
            break;
          }
        }
        if (handledAsKeywordLine) break;
      }
      continue;
    }

    const header = delimiterMatch[1].trim();
    const valuePart = delimiterMatch[2].trim();

    // Identify if header matches a charge category
    const catMatch = identifyChargeCategory(header);
    if (catMatch) {
      processChargeLine(
        catMatch.category,
        catMatch.label,
        header,
        valuePart,
        rawLine,
        lineNumber,
        context,
      );
    }
  }

  function processChargeLine(
    category: ChargeCategory,
    categoryLabel: string,
    originalChargeName: string,
    valuePart: string,
    sourceLine: string,
    lineNum: number,
    optContext?: { containerCount?: number | null },
  ) {
    const amountDetails = parseChargeAmountDetails(valuePart, sourceLine);
    const unitDetails = extractChargeUnit(sourceLine);
    let quantity = extractChargeQuantity(sourceLine);

    // If unit is per_container and no explicit line quantity is written, check if context specifies containers
    if (unitDetails.unit === "per_container" && quantity === null && optContext?.containerCount) {
      quantity = optContext.containerCount;
    } else if (unitDetails.unit === "per_shipment" && quantity === null) {
      quantity = 1;
    }

    // Calculate subtotal if amount and quantity are clear
    let calculatedSubtotal: number | null = null;
    if (amountDetails.amount !== null) {
      const q = quantity || 1;
      calculatedSubtotal = Math.round(amountDetails.amount * q * 100) / 100;
    }

    const item: ExtractedChargeItem = {
      category,
      categoryLabel,
      originalChargeName,
      original_charge_name: originalChargeName,
      amount: amountDetails.amount,
      extractedAmount: amountDetails.amount,
      extracted_amount: amountDetails.amount,
      amountWithoutCurrency: amountDetails.amountWithoutCurrency,
      amount_without_currency: amountDetails.amountWithoutCurrency,
      amountMin: amountDetails.amountMin,
      amount_min: amountDetails.amountMin,
      amountMax: amountDetails.amountMax,
      amount_max: amountDetails.amountMax,
      currency: amountDetails.currency,
      unit: unitDetails.unit,
      unitRaw: unitDetails.unitRaw,
      quantity,
      calculatedSubtotal,
      calculated_subtotal: calculatedSubtotal,
      status: amountDetails.status,
      needsReview: amountDetails.needsReview,
      needs_review: amountDetails.needsReview,
      warnings: amountDetails.warnings,
      originalSourceLine: sourceLine,
      original_source_line: sourceLine,
      lineNumber: lineNum,
    };

    charges.push(item);
    if (!chargeMap[category]) {
      chargeMap[category] = item;
    }
  }

  return {
    charges,
    chargeMap,
    quotedTotal,
    quotedTotalLine,
  };
}

/**
 * 6. TOTAL CALCULATION ENGINE
 *
 * Rules:
 * - Store forwarder's explicitly written total as quoted_total
 * - Calculate calculated_total ONLY when:
 *   * All charge amounts are available
 *   * All charges use the same currency
 *   * No range values exist
 *   * Units and quantities are clear
 *   * No charges are marked pending or applicable
 * - Never replace quoted_total with calculated_total!
 * - If quoted_total and calculated_total are different:
 *   * Preserve both values
 *   * Add conflict warning
 *   * Mark quotation as needs_review
 */
export function calculateAndValidateTotals(
  charges: ExtractedChargeItem[],
  explicitQuotedTotal: number | null,
  detectedOverallCurrency: string | null,
): TotalCalculationResult {
  const warnings: string[] = [];
  let isEligible = true;
  let targetCurrency: string | null = detectedOverallCurrency;

  if (charges.length === 0) {
    return {
      quotedTotal: explicitQuotedTotal,
      quoted_total: explicitQuotedTotal,
      calculatedTotal: null,
      calculated_total: null,
      currency: targetCurrency,
      isEligibleForCalculation: false,
      hasDiscrepancy: false,
      discrepancyDifference: null,
      status: explicitQuotedTotal !== null ? "QUOTED_ONLY" : "CALCULATION_UNAVAILABLE",
      warnings: ["No itemized charges found to calculate total."],
      needsReview: explicitQuotedTotal === null,
      needs_review: explicitQuotedTotal === null,
    };
  }

  // Condition 1: Check currency consistency
  const distinctCurrencies = new Set<string>();
  for (const c of charges) {
    if (c.currency) distinctCurrencies.add(c.currency);
  }

  if (distinctCurrencies.size > 1) {
    isEligible = false;
    warnings.push(
      `Multiple currencies detected across charges (${Array.from(distinctCurrencies).join(
        ", ",
      )}). Total cannot be computed automatically across mixed currencies.`,
    );
  } else if (distinctCurrencies.size === 1) {
    targetCurrency = Array.from(distinctCurrencies)[0];
  }

  // Condition 2: Check for missing amounts, ranges, or pending charges
  for (const c of charges) {
    if (c.status === "range") {
      isEligible = false;
      warnings.push(
        `Charge '${c.originalChargeName}' has a price range. Total cannot be computed.`,
      );
    }
    if (c.status === "amount_missing" || c.amount === null) {
      isEligible = false;
      warnings.push(`Charge '${c.originalChargeName}' is missing an amount.`);
    }
    if (c.status === "pending_applicable") {
      isEligible = false;
      warnings.push(`Charge '${c.originalChargeName}' is marked pending / at actuals.`);
    }
    if (c.status === "currency_missing") {
      isEligible = false;
      warnings.push(`Charge '${c.originalChargeName}' is missing currency.`);
    }
  }

  let calculatedTotal: number | null = null;

  if (isEligible) {
    let sum = 0;
    for (const c of charges) {
      const q = c.quantity || 1;
      const sub = (c.amount || 0) * q;
      sum += sub;
    }
    calculatedTotal = Math.round(sum * 100) / 100;
  }

  // Compare Quoted Total vs Calculated Total
  let hasDiscrepancy = false;
  let discrepancyDifference: number | null = null;
  let needsReview = false;

  if (explicitQuotedTotal !== null && calculatedTotal !== null) {
    discrepancyDifference = Math.round(Math.abs(explicitQuotedTotal - calculatedTotal) * 100) / 100;

    // Discrepancy threshold: more than 1.0 currency unit
    if (discrepancyDifference > 1.0) {
      hasDiscrepancy = true;
      needsReview = true;
      warnings.push(
        `Discrepancy detected: Explicitly quoted total (${explicitQuotedTotal}${
          targetCurrency ? " " + targetCurrency : ""
        }) differs from calculated itemized charges sum (${calculatedTotal}${
          targetCurrency ? " " + targetCurrency : ""
        }) by ${discrepancyDifference}.`,
      );
    }
  }

  // Determine calculation status
  let status: TotalCalculationResult["status"] = "CALCULATION_UNAVAILABLE";
  if (hasDiscrepancy) {
    status = "DISCREPANCY";
  } else if (explicitQuotedTotal !== null && calculatedTotal !== null) {
    status = "MATCHED";
  } else if (explicitQuotedTotal !== null) {
    status = "QUOTED_ONLY";
  } else if (calculatedTotal !== null) {
    status = "CALCULATED_ONLY";
  }

  return {
    quotedTotal: explicitQuotedTotal,
    quoted_total: explicitQuotedTotal,
    calculatedTotal,
    calculated_total: calculatedTotal,
    currency: targetCurrency,
    isEligibleForCalculation: isEligible,
    hasDiscrepancy,
    discrepancyDifference,
    status,
    warnings,
    needsReview: needsReview || !isEligible || explicitQuotedTotal === null,
    needs_review: needsReview || !isEligible || explicitQuotedTotal === null,
  };
}

/**
 * Complete Charge Extraction Pipeline for an Incoming Email
 */
export function extractChargesAndTotals(
  emailText: string,
  context?: {
    containerCount?: number | null;
  },
): ChargeExtractionResult {
  const lineExtraction = extractChargesFromLines(emailText, context);
  const overallCurrency = extractExplicitCurrency(emailText);

  const totals = calculateAndValidateTotals(
    lineExtraction.charges,
    lineExtraction.quotedTotal,
    overallCurrency,
  );

  const hasRange = lineExtraction.charges.some((c) => c.status === "range");
  const hasMissingCurrency = lineExtraction.charges.some((c) => c.status === "currency_missing");
  const hasMissingAmount = lineExtraction.charges.some(
    (c) => c.status === "amount_missing" || c.status === "pending_applicable",
  );

  const distinctCurrencies = new Set<string>();
  for (const c of lineExtraction.charges) {
    if (c.currency) distinctCurrencies.add(c.currency);
  }
  const hasMultipleCurrencies = distinctCurrencies.size > 1;

  const allWarnings = [...lineExtraction.charges.flatMap((c) => c.warnings), ...totals.warnings];

  const needsReview =
    hasRange ||
    hasMissingCurrency ||
    hasMissingAmount ||
    hasMultipleCurrencies ||
    totals.hasDiscrepancy ||
    totals.quotedTotal === null;

  return {
    charges: lineExtraction.charges,
    chargeMap: lineExtraction.chargeMap,
    quotedTotal: totals.quotedTotal,
    quoted_total: totals.quoted_total,
    calculatedTotal: totals.calculatedTotal,
    calculated_total: totals.calculated_total,
    totals,
    currency: totals.currency || overallCurrency,
    hasRange,
    hasMissingCurrency,
    hasMissingAmount,
    hasDiscrepancy: totals.hasDiscrepancy,
    hasMultipleCurrencies,
    needsReview,
    warnings: Array.from(new Set(allWarnings)),
  };
}
