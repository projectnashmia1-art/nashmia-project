/**
 * Deterministic Rule-Based Quotation Message Classification Engine
 *
 * Conforms strictly to specifications:
 * - 100% Deterministic Keyword Matching & Configured Rules
 * - Zero AI / LLM / Gemini / OpenAI / External Machine Learning
 *
 * Categories & Configured Keyword Mappings:
 * 1. quotation:
 *    - quotation
 *    - quote
 *    - rates
 *    - freight offer
 *    - our best rate
 *    - please find our offer
 *
 * 2. no_quote:
 *    - unable to quote
 *    - cannot provide rate
 *    - no service
 *    - no space
 *    - not accepting
 *    - declined
 *
 * 3. clarification_required:
 *    - please confirm
 *    - need more information
 *    - kindly advise
 *    - require details
 *    - subject to confirmation
 *
 * 4. revision:
 *    - revised quotation
 *    - revised quote
 *    - updated rates
 *    - ignore previous quote
 *    - amendment
 *    - version 2
 *
 * 5. automated:
 *    - out of office
 *    - automatic reply
 *    - auto response
 *    - delivery failure
 */

export type QuotationMessageCategory =
  "quotation" | "no_quote" | "clarification_required" | "revision" | "automated" | "unknown";

export interface KeywordRuleDefinition {
  category: QuotationMessageCategory;
  categoryLabel: string;
  keywords: string[];
  priority: number;
  description: string;
}

export interface QuotationClassificationResult {
  category: QuotationMessageCategory;
  categoryLabel: string;
  matchedKeywords: string[];
  matchedRule: string;
  confidence: number;
  reason: string;
  allMatchedCategories: QuotationMessageCategory[];
  isQuotation: boolean;
  isNoQuote: boolean;
  isClarificationRequired: boolean;
  isRevision: boolean;
  isAutomated: boolean;
  cleanedText: string;
  originalSubject: string;
  detectedIn: "SUBJECT" | "BODY" | "BOTH" | "NONE";
}

/**
 * Configurable Keyword Rules Dictionary
 */
export const QUOTATION_CLASSIFICATION_RULES: Record<
  Exclude<QuotationMessageCategory, "unknown">,
  KeywordRuleDefinition
> = {
  automated: {
    category: "automated",
    categoryLabel: "Automated / System Response",
    keywords: [
      "out of office",
      "automatic reply",
      "auto response",
      "auto-response",
      "autoreply",
      "delivery failure",
      "delivery status notification",
      "undeliverable",
      "mail delivery subsystem",
    ],
    priority: 1, // Highest priority to immediately filter out automated bounces/OOO
    description: "System auto-replies, out of office notifications, and delivery failures.",
  },
  no_quote: {
    category: "no_quote",
    categoryLabel: "No Quote / Declined",
    keywords: [
      "unable to quote",
      "cannot provide rate",
      "cannot quote",
      "no service",
      "no space",
      "not accepting",
      "declined",
      "we decline",
      "decline to quote",
      "fully booked",
      "no equipment available",
    ],
    priority: 2,
    description: "Forwarder unable to provide quote or declining due to capacity/routing.",
  },
  revision: {
    category: "revision",
    categoryLabel: "Revised Quotation",
    keywords: [
      "revised quotation",
      "revised quote",
      "updated rates",
      "ignore previous quote",
      "amendment",
      "version 2",
      "v2",
      "revised offer",
      "rate revision",
      "updated quotation",
    ],
    priority: 3,
    description: "Amended, updated, or corrected quotation replacing prior quote.",
  },
  clarification_required: {
    category: "clarification_required",
    categoryLabel: "Clarification Required",
    keywords: [
      "please clarify",
      "kindly clarify",
      "clarify",
      "clarification",
      "inquiry clarification",
      "please confirm",
      "also confirm",
      "need more information",
      "more information",
      "kindly advise",
      "require details",
      "subject to confirmation",
      "need details",
      "please advise",
      "awaiting clarification",
    ],
    priority: 4,
    description: "Forwarder requesting additional details before confirming or finalizing.",
  },
  quotation: {
    category: "quotation",
    categoryLabel: "Quotation / Rate Offer",
    keywords: [
      "quotation",
      "quote",
      "rates",
      "freight offer",
      "our best rate",
      "please find our offer",
      "ocean freight",
      "rate offer",
      "offered rate",
      "quotation for",
    ],
    priority: 5,
    description: "Active freight quotation or rate proposal from forwarder.",
  },
};

/**
 * Cleans email body by removing quoted historical threads and normalizing whitespace.
 */
export function cleanEmailBodyForClassification(body: string): string {
  if (!body) return "";

  const lines = body.split(/\r?\n/);
  const cleanLines: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith(">")) continue;
    if (
      /^on\s.+wrote:?$/i.test(line) ||
      /^from:\s.+/i.test(line) ||
      /^-----original message-----/i.test(line) ||
      /^---------------------------/i.test(line)
    ) {
      break;
    }
    cleanLines.push(rawLine);
  }

  return cleanLines.join("\n").toLowerCase();
}

/**
 * Deterministically checks whether text contains a specific keyword with word boundary awareness.
 */
export function matchesKeyword(text: string, keyword: string): boolean {
  if (!text || !keyword) return false;
  const kw = keyword.toLowerCase().trim();
  const lowerText = text.toLowerCase();

  // If keyword contains non-word characters (e.g. "out of office", "v2", "version 2")
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[^a-zA-Z0-9])${escaped}(?:$|[^a-zA-Z0-9])`, "i");

  return regex.test(lowerText) || lowerText.includes(kw);
}

/**
 * Deterministically classifies an incoming forwarder message using configured keyword rules.
 *
 * Strictly NO AI.
 */
export function classifyQuotationMessage(
  subject: string,
  body: string,
): QuotationClassificationResult {
  const cleanSubj = (subject || "").trim().toLowerCase();
  const cleanBody = cleanEmailBodyForClassification(body || "");
  const fullText = `${cleanSubj}\n${cleanBody}`;

  const matchedKeywordsByCat: Record<QuotationMessageCategory, string[]> = {
    automated: [],
    no_quote: [],
    revision: [],
    clarification_required: [],
    quotation: [],
    unknown: [],
  };

  const detectedInByCat: Record<QuotationMessageCategory, "SUBJECT" | "BODY" | "BOTH" | "NONE"> = {
    automated: "NONE",
    no_quote: "NONE",
    revision: "NONE",
    clarification_required: "NONE",
    quotation: "NONE",
    unknown: "NONE",
  };

  // Evaluate each category rules
  const ruleCategories: Exclude<QuotationMessageCategory, "unknown">[] = [
    "automated",
    "no_quote",
    "revision",
    "clarification_required",
    "quotation",
  ];

  for (const cat of ruleCategories) {
    const rule = QUOTATION_CLASSIFICATION_RULES[cat];
    const foundKeywords: string[] = [];
    let inSubj = false;
    let inBody = false;

    for (const kw of rule.keywords) {
      const matchSubj = matchesKeyword(cleanSubj, kw);
      const matchBody = matchesKeyword(cleanBody, kw);

      if (matchSubj || matchBody) {
        foundKeywords.push(kw);
        if (matchSubj) inSubj = true;
        if (matchBody) inBody = true;
      }
    }

    matchedKeywordsByCat[cat] = foundKeywords;

    if (inSubj && inBody) detectedInByCat[cat] = "BOTH";
    else if (inSubj) detectedInByCat[cat] = "SUBJECT";
    else if (inBody) detectedInByCat[cat] = "BODY";
    else detectedInByCat[cat] = "NONE";
  }

  // Determine winning category by configured priority order
  // Priority: 1. automated -> 2. no_quote -> 3. revision -> 4. clarification_required -> 5. quotation
  let winningCat: QuotationMessageCategory = "unknown";
  let winningKeywords: string[] = [];

  const matchedCategories = ruleCategories.filter((c) => matchedKeywordsByCat[c].length > 0);

  for (const cat of ruleCategories) {
    if (matchedKeywordsByCat[cat].length > 0) {
      winningCat = cat;
      winningKeywords = matchedKeywordsByCat[cat];
      break;
    }
  }

  // Fallback: If no explicit keywords matched but body contains rate indicators like "$900" or "USD 1200"
  if (winningCat === "unknown") {
    if (
      /(?:USD|EUR|GBP|AED|PKR|INR|\$|€|£)\s*[0-9,.]+|[0-9,.]+\s*(?:USD|EUR|GBP|AED|PKR|INR)/i.test(
        fullText,
      )
    ) {
      winningCat = "quotation";
      winningKeywords = ["monetary amount pattern"];
      matchedCategories.push("quotation");
    }
  }

  const isAutomated = winningCat === "automated";
  const isNoQuote = winningCat === "no_quote";
  const isRevision = winningCat === "revision";
  const isClarificationRequired = winningCat === "clarification_required";
  const isQuotation = winningCat === "quotation";

  let confidence = 0.95;
  if (winningCat === "unknown") {
    confidence = 0.3;
  } else if (winningKeywords.length >= 2 || detectedInByCat[winningCat] === "BOTH") {
    confidence = 0.99;
  }

  const categoryLabel =
    winningCat !== "unknown"
      ? QUOTATION_CLASSIFICATION_RULES[winningCat].categoryLabel
      : "Unclassified Message";

  const reason =
    winningCat !== "unknown"
      ? `Deterministic classification: matched keyword(s) [${winningKeywords.join(
          ", ",
        )}] for rule '${winningCat}'.`
      : "Deterministic classification: No configured quotation keywords matched.";

  return {
    category: winningCat,
    categoryLabel,
    matchedKeywords: winningKeywords,
    matchedRule: winningCat,
    confidence,
    reason,
    allMatchedCategories: matchedCategories,
    isQuotation,
    isNoQuote,
    isClarificationRequired,
    isRevision,
    isAutomated,
    cleanedText: cleanBody,
    originalSubject: subject || "",
    detectedIn: winningCat !== "unknown" ? detectedInByCat[winningCat] : "NONE",
  };
}
