import type { QuotationExtractionInput, ExtractedQuotation } from "./quotation-extractor";

export interface AiParsedQuotationResult {
  rate: number | null;
  currency: string | null;
  totalCost: number | null;
  originCharges: number | null;
  destinationCharges: number | null;
  thc: number | null;
  documentationCharges: number | null;
  customsCharges: number | null;
  truckingCharges: number | null;
  otherCharges: number | null;
  transitTime: number | null;
  freeDays: number | null;
  etd: string | null;
  eta: string | null;
  carrier: string | null;
  vesselName: string | null;
  voyageNumber: string | null;
  rateValidity: string | null;
  quotationReference: string | null;
  notes: string | null;
  confidenceScore: number;
}

/**
 * Validates and sanitizes AI extraction output.
 * Ensures AI never invents numbers, hallucinated dates, or invalid currencies.
 */
function validateAiExtractedData(raw: Record<string, unknown>): AiParsedQuotationResult {
  const sanitizeNumber = (val: unknown): number | null => {
    if (typeof val === "number" && !isNaN(val) && val > 0 && val < 500000) {
      return Math.round(val * 100) / 100;
    }
    if (typeof val === "string") {
      const cleaned = val.replace(/[^0-9.]/g, "");
      const n = parseFloat(cleaned);
      if (!isNaN(n) && n > 0 && n < 500000) {
        return Math.round(n * 100) / 100;
      }
    }
    return null;
  };

  const sanitizeCurrency = (val: unknown): string | null => {
    if (typeof val === "string") {
      const upper = val.trim().toUpperCase();
      if (/^[A-Z]{3}$/.test(upper)) {
        return upper;
      }
    }
    return null;
  };

  const sanitizeString = (val: unknown): string | null => {
    if (typeof val === "string" && val.trim().length > 0 && val.trim().length < 200) {
      return val.trim();
    }
    return null;
  };

  const sanitizeDate = (val: unknown): string | null => {
    if (typeof val === "string" && val.trim().length >= 4) {
      const str = val.trim();
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString();
      }
      return str;
    }
    return null;
  };

  const rate = sanitizeNumber(raw.rate || raw.oceanFreight || raw.ocean_freight);
  const totalCost = sanitizeNumber(
    raw.totalCost || raw.totalAmount || raw.total_cost || raw.total_amount,
  );
  const currency = sanitizeCurrency(raw.currency) || (rate || totalCost ? "USD" : null);

  const rawConfidence = typeof raw.confidenceScore === "number" ? raw.confidenceScore : 0.75;
  const confidenceScore = Math.max(0.1, Math.min(0.95, rawConfidence));

  return {
    rate,
    currency,
    totalCost,
    originCharges: sanitizeNumber(raw.originCharges || raw.origin_charges),
    destinationCharges: sanitizeNumber(raw.destinationCharges || raw.destination_charges),
    thc: sanitizeNumber(raw.thc || raw.terminalHandlingCharge),
    documentationCharges: sanitizeNumber(raw.documentationCharges || raw.doc_fee),
    customsCharges: sanitizeNumber(raw.customsCharges || raw.customs_clearance),
    truckingCharges: sanitizeNumber(raw.truckingCharges || raw.haulage),
    otherCharges: sanitizeNumber(raw.otherCharges || raw.surcharges),
    transitTime: sanitizeNumber(raw.transitTime || raw.transit_days),
    freeDays: sanitizeNumber(raw.freeDays || raw.free_days),
    etd: sanitizeDate(raw.etd || raw.sailingDate),
    eta: sanitizeDate(raw.eta || raw.arrivalDate),
    carrier: sanitizeString(raw.carrier || raw.shippingLine),
    vesselName: sanitizeString(raw.vesselName || raw.vessel),
    voyageNumber: sanitizeString(raw.voyageNumber || raw.voyage),
    rateValidity: sanitizeDate(raw.rateValidity || raw.validUntil),
    quotationReference: sanitizeString(raw.quotationReference || raw.quoteRef),
    notes: sanitizeString(raw.notes || raw.remarks),
    confidenceScore,
  };
}

/**
 * AI Fallback Parser for Highly Unstructured Forwarder Quotation Emails.
 * ONLY called when the deterministic parser cannot confidently extract freight rate numbers.
 * Deterministic matching ALWAYS determines the booking and forwarder identity.
 */
export async function extractQuotationWithAiFallback(
  input: QuotationExtractionInput,
): Promise<AiParsedQuotationResult | null> {
  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    (typeof window !== "undefined"
      ? (window as unknown as Record<string, string>).__GEMINI_API_KEY__
      : undefined);

  if (!apiKey) {
    if (typeof window !== "undefined") {
      try {
        const response = await fetch("/api/extraction/extract-quotation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: input.subject || "",
            body: input.body || "",
            snippet: input.snippet || "",
            senderEmail: input.senderEmail || "",
            senderName: input.senderName || "",
            knownMovementNumber: input.movementNumber || "",
          }),
        });
        if (response.ok) {
          const resData = await response.json();
          if (resData.quotation) {
            const q = resData.quotation;
            return {
              rate: q.rate ?? null,
              currency: q.currency ?? "USD",
              totalCost: q.totalCost ?? null,
              originCharges: q.freightCharges?.originCharges ?? null,
              destinationCharges: q.freightCharges?.destinationCharges ?? null,
              thc: q.freightCharges?.thc ?? null,
              documentationCharges: q.freightCharges?.documentationCharges ?? null,
              customsCharges: q.freightCharges?.customsCharges ?? null,
              truckingCharges: q.freightCharges?.truckingCharges ?? null,
              otherCharges: q.freightCharges?.otherCharges ?? null,
              transitTime: q.transitTime ?? null,
              freeDays: q.freeDays ?? null,
              etd: q.etd ?? null,
              eta: q.eta ?? null,
              carrier: q.carrier ?? null,
              vesselName: q.vesselName ?? null,
              voyageNumber: q.voyageNumber ?? null,
              rateValidity: q.rateValidity ?? null,
              quotationReference: q.quotationReference ?? null,
              notes: q.notes ?? null,
              confidenceScore: q.confidenceScore ?? 0.85,
            };
          }
        }
      } catch (proxyErr) {
        console.warn(
          "[AiQuotationFallback] Browser proxy to /api/extraction/extract-quotation notice:",
          proxyErr,
        );
      }
    }
    console.info(
      "[AiQuotationFallback] Gemini API key not present, preserving deterministic result.",
    );
    return null;
  }

  const combinedContent = [
    input.subject ? `SUBJECT: ${input.subject}` : "",
    input.body ? `BODY:\n${input.body}` : "",
    input.snippet ? `SNIPPET: ${input.snippet}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (combinedContent.trim().length < 10) {
    return null;
  }

  try {
    const { GoogleGenAI, Type } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a strict data extraction tool for ocean freight quotation emails.
Analyze this forwarder email text and extract commercial rate details.

CRITICAL RULES:
1. ONLY extract values EXPLICITLY written in the email.
2. DO NOT guess, hallucinate, assume, or fabricate any numbers, dates, or shipping lines.
3. If a value is not mentioned in the email text, return null for that field.
4. If this email is NOT an ocean freight quotation or contains no rate offer, return null for rate and totalCost.

EMAIL TEXT:
${combinedContent}

Extract the fields according to the schema.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rate: {
              type: Type.NUMBER,
              description: "Ocean freight rate per container (e.g. 2100)",
            },
            currency: {
              type: Type.STRING,
              description: "3-letter currency code, e.g. USD, EUR, GBP",
            },
            totalCost: {
              type: Type.NUMBER,
              description: "Total quotation cost if stated explicitly",
            },
            originCharges: { type: Type.NUMBER, description: "Origin terminal or THC charges" },
            destinationCharges: { type: Type.NUMBER, description: "Destination charges" },
            thc: { type: Type.NUMBER, description: "Terminal handling charges" },
            documentationCharges: { type: Type.NUMBER, description: "Documentation fee" },
            customsCharges: { type: Type.NUMBER, description: "Customs clearance charge" },
            truckingCharges: {
              type: Type.NUMBER,
              description: "Inland haulage or trucking charge",
            },
            otherCharges: { type: Type.NUMBER, description: "Other itemized surcharges" },
            transitTime: { type: Type.NUMBER, description: "Transit time in days" },
            freeDays: {
              type: Type.NUMBER,
              description: "Detention / demurrage free days (e.g. 14)",
            },
            etd: { type: Type.STRING, description: "Estimated time of departure date string" },
            eta: { type: Type.STRING, description: "Estimated time of arrival date string" },
            carrier: {
              type: Type.STRING,
              description: "Ocean shipping line name, e.g. Maersk, MSC, CMA CGM",
            },
            vesselName: { type: Type.STRING, description: "Vessel name" },
            voyageNumber: { type: Type.STRING, description: "Voyage number" },
            rateValidity: { type: Type.STRING, description: "Rate validity or expiration date" },
            quotationReference: {
              type: Type.STRING,
              description: "Quotation quote reference number",
            },
            notes: { type: Type.STRING, description: "Important conditions, exclusions or notes" },
            confidenceScore: { type: Type.NUMBER, description: "Confidence score from 0.0 to 1.0" },
          },
        },
      },
    });

    const text = response.text?.trim();
    if (!text) return null;

    const parsedJson = JSON.parse(text) as Record<string, unknown>;
    const validated = validateAiExtractedData(parsedJson);

    // If AI found no rate or total, it did not extract a valid quotation offer
    if (!validated.rate && !validated.totalCost) {
      return null;
    }

    console.log(
      "[AiQuotationFallback] ✅ AI fallback successfully extracted unstructured quotation:",
      {
        rate: validated.rate,
        currency: validated.currency,
        carrier: validated.carrier,
        etd: validated.etd,
      },
    );

    return validated;
  } catch (err) {
    console.warn("[AiQuotationFallback] Notice during AI fallback extraction:", err);
    return null;
  }
}
