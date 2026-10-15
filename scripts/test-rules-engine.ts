/**
 * Dedicated Comprehensive Test Suite for:
 * 1. Forwarder Matching Engine (Exact Sender Email, Contact Email, Registered Domain, Unknown Forwarder, Display Name disregard)
 * 2. Charge Extraction (Keyword Dictionaries, regex, line-based, unit, quantity, original line, original name)
 * 3. Currency Extraction (Explicit currencies, Unambiguous symbols, missing currency handling)
 * 4. Amount Extraction (Supported formats, Ranges, Missing values)
 * 5. Total Calculation (quoted_total, calculated_total, conflict detection, discrepancy warning)
 */

import {
  matchSenderWithForwarderMaster,
  getForwarderRegisteredDomains,
  extractCleanDomain,
  type ForwarderMasterRecord,
} from "../src/lib/forwarder-matching-service";

import {
  extractChargesAndTotals,
  extractExplicitCurrency,
  parseChargeAmountDetails,
  extractChargeUnit,
  extractChargeQuantity,
  CHARGE_KEYWORD_MAPPINGS,
  EXPLICIT_CURRENCIES,
  UNAMBIGUOUS_CURRENCY_SYMBOLS,
} from "../src/lib/deterministic-charge-extractor";

import {
  extractOrderedBookingNumbers,
  normalizeBookingNumber,
  validateExtractedQuotation,
  type DeterministicQuotationFields,
} from "../src/lib/forwarder-quotation-processor";

import {
  extractDatesFromText,
  parseDateDeterministic,
  formatIsoDate,
  DATE_LABEL_MAPPINGS,
  type ExtractedDateItem,
} from "../src/lib/deterministic-date-extractor";

import {
  classifyQuotationMessage,
  QUOTATION_CLASSIFICATION_RULES,
  type QuotationMessageCategory,
} from "../src/lib/deterministic-quotation-classifier";

import {
  persistIncomingEmailRecord,
  persistQuotationRequestRecord,
  persistQuotationRecord,
  persistQuotationCharges,
  persistProcessedQuotationBundle,
  executeQuotationTransaction,
  type IncomingEmailRecord,
  type QuotationRequestRecord,
  type QuotationRecord,
  type QuotationChargeRecord,
} from "../src/lib/quotation-schema-persistence";

import {
  processAttachmentDeterministically,
  processAttachmentBatchDeterministically,
  detectAttachmentType,
  extractTextFromXlsx,
  extractTextFromPlainText,
  validateAttachmentSecurity,
  type ExtractedAttachmentResult,
} from "../src/lib/deterministic-attachment-extractor";
import { sanitizeEmailHtml } from "../src/lib/email-cleaning-service";
import { handleQuotationsApiRequest, setInMemoryQuotation } from "../src/lib/api-quotations-router";
import * as XLSX from "xlsx";
import * as fs from "fs";

async function runTests() {
  console.log("================================================================================");
  console.log("🚀 EXECUTING VERIFICATION SUITE FOR DETERMINISTIC QUOTATION RULES");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${testName} ${detail ? `(${detail})` : ""}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ===========================================================================
  // SECTION 1: FORWARDER MATCHING TESTS
  // ===========================================================================
  console.log("--- 1. FORWARDER MATCHING TESTS ---");

  const forwarderMaster: ForwarderMasterRecord[] = [
    {
      id: "fwd-apex-01",
      name: "Apex Maritime",
      company_name: "Apex Maritime Global",
      email: "pricing@apexmaritime.com",
      contactEmail: "ops@apexmaritime.com",
      contactPerson: "John Doe (johndoe@apexmaritime.com)",
      website: "https://www.apexmaritime.com",
      notes: "Registered corporate domain: apexmaritime.com",
    },
    {
      id: "fwd-maersk-02",
      name: "Maersk Line",
      company_name: "A.P. Moller - Maersk",
      email: "oceanquotes@maersk.com",
      contactEmail: "booking@maersk.com",
      website: "https://maersk.com",
    },
    {
      id: "fwd-dhl-03",
      name: "DHL Global Forwarding",
      company_name: "DHL Global Forwarding",
      email: "freight@dhl.com",
      contactEmail: "rates@dhl.com",
      website: "dhl.com",
    },
  ];

  // 1.1 Match by Exact Sender Email
  const exactMatch = matchSenderWithForwarderMaster("pricing@apexmaritime.com", forwarderMaster);
  assert(exactMatch.isMatched === true, "1.1 Exact sender email matches forwarder");
  assert(exactMatch.forwarderId === "fwd-apex-01", "1.1 Matched correct forwarder ID");
  assert(exactMatch.matchedBy === "EXACT_EMAIL", "1.1 MatchedBy is EXACT_EMAIL");
  assert(exactMatch.isForwarderUnknown === false, "1.1 isForwarderUnknown is false");
  assert(exactMatch.needsReview === false, "1.1 needsReview is false");

  // 1.2 Match by Forwarder Contact Email
  const contactMatch = matchSenderWithForwarderMaster("ops@apexmaritime.com", forwarderMaster);
  assert(contactMatch.isMatched === true, "1.2 Forwarder contact email matches forwarder");
  assert(contactMatch.matchedBy === "CONTACT_EMAIL", "1.2 MatchedBy is CONTACT_EMAIL");

  const contactPersonMatch = matchSenderWithForwarderMaster(
    "johndoe@apexmaritime.com",
    forwarderMaster,
  );
  assert(contactPersonMatch.isMatched === true, "1.2 Contact person email matches forwarder");
  assert(contactPersonMatch.matchedBy === "CONTACT_EMAIL", "1.2 MatchedBy is CONTACT_EMAIL");

  // 1.3 Match by Registered Domain
  const domainMatch = matchSenderWithForwarderMaster("rep123@apexmaritime.com", forwarderMaster);
  assert(
    domainMatch.isMatched === true,
    "1.3 Sender domain matches registered forwarder master domain",
  );
  assert(domainMatch.matchedBy === "REGISTERED_DOMAIN", "1.3 MatchedBy is REGISTERED_DOMAIN");
  assert(
    domainMatch.registeredDomainMatched === "apexmaritime.com",
    "1.3 Registered domain is apexmaritime.com",
  );

  // 1.4 Do NOT match generic/public domains even if in forwarder notes
  const publicEmailMatch = matchSenderWithForwarderMaster("some_person@gmail.com", forwarderMaster);
  assert(
    publicEmailMatch.isMatched === false,
    "1.4 Public email (@gmail.com) is NOT matched by domain",
  );
  assert(publicEmailMatch.isForwarderUnknown === true, "1.4 Unknown forwarder set for @gmail.com");
  assert(publicEmailMatch.needsReview === true, "1.4 needsReview is true for unknown forwarder");

  // 1.5 Do NOT trust sender display name alone
  const spoofedDisplayName = matchSenderWithForwarderMaster(
    "attacker@unknownfreight.com",
    forwarderMaster,
    {
      senderDisplayName: "Apex Maritime Global",
    },
  );
  assert(
    spoofedDisplayName.isMatched === false,
    "1.5 Display name alone ('Apex Maritime Global') is NOT trusted",
  );
  assert(
    spoofedDisplayName.isForwarderUnknown === true,
    "1.5 Forwarder marked unknown despite display name",
  );
  assert(
    spoofedDisplayName.forwarderName === "Unknown Forwarder",
    "1.5 forwarderName is 'Unknown Forwarder'",
  );
  assert(
    spoofedDisplayName.disregardedDisplayName === "Apex Maritime Global",
    "1.5 Disregarded display name is audited",
  );

  // 1.6 Unmatched forwarder handling
  const unmatched = matchSenderWithForwarderMaster("random@xyzlogistics.com", forwarderMaster);
  assert(unmatched.isMatched === false, "1.6 Unmatched sender email is marked unmatched");
  assert(unmatched.forwarderId === null, "1.6 forwarderId is null for unmatched sender");
  assert(
    unmatched.forwarderName === "Unknown Forwarder",
    "1.6 forwarderName is 'Unknown Forwarder'",
  );
  assert(unmatched.isForwarderUnknown === true, "1.6 isForwarderUnknown is true");
  assert(unmatched.needsReview === true, "1.6 needsReview is true to route to human review");

  // ===========================================================================
  // SECTION 2: CHARGE EXTRACTION & USER EXAMPLE TEST
  // ===========================================================================
  console.log("\n--- 2. CHARGE EXTRACTION & USER SPECIFICATION EXAMPLE ---");

  const exampleInput = `
Ocean Freight: USD 900 per 40HC
THC: USD 150 x 2 containers
Documentation Fee: USD 75 per shipment
Total: USD 2,425
`;

  const extraction = extractChargesAndTotals(exampleInput);

  assert(extraction.charges.length === 3, "2.1 Extracted exactly 3 line items");

  // Item 1: Ocean Freight
  const ofItem = extraction.charges.find((c) => c.category === "ocean_freight");
  assert(!!ofItem, "2.2 Found Ocean Freight charge");
  assert(ofItem?.extractedAmount === 900, "2.2 Ocean Freight amount is 900");
  assert(ofItem?.currency === "USD", "2.2 Ocean Freight currency is USD");
  assert(ofItem?.unit === "per_container", "2.2 Ocean Freight unit is per_container");
  assert(
    ofItem?.originalChargeName === "Ocean Freight",
    "2.2 Preserves original charge name 'Ocean Freight'",
  );
  assert(
    ofItem?.originalSourceLine.includes("Ocean Freight: USD 900 per 40HC"),
    "2.2 Preserves original source line",
  );

  // Item 2: THC
  const thcItem = extraction.charges.find((c) => c.category === "terminal_handling");
  assert(!!thcItem, "2.3 Found THC charge");
  assert(thcItem?.extractedAmount === 150, "2.3 THC unit amount is 150");
  assert(thcItem?.currency === "USD", "2.3 THC currency is USD");
  assert(thcItem?.quantity === 2, "2.3 THC quantity is 2");
  assert(thcItem?.calculatedSubtotal === 300, "2.3 THC calculated subtotal is 300 (150 x 2)");
  assert(thcItem?.originalChargeName === "THC", "2.3 Preserves original charge name 'THC'");

  // Item 3: Documentation Fee
  const docItem = extraction.charges.find((c) => c.category === "documentation");
  assert(!!docItem, "2.4 Found Documentation Fee charge");
  assert(docItem?.extractedAmount === 75, "2.4 Documentation Fee amount is 75");
  assert(docItem?.currency === "USD", "2.4 Documentation Fee currency is USD");
  assert(docItem?.unit === "per_shipment", "2.4 Documentation Fee unit is per_shipment");

  // Quoted Total
  assert(extraction.quotedTotal === 2425, "2.5 Quoted total extracted as 2425 USD");

  // Keyword mappings verification for other categories
  const multiChargeInput = `
Origin Local Charges: USD 120 per container
Destination Local Charges: USD 180 per container
Customs Clearance: USD 95 per BL
Haulage: USD 450 per container
Miscellaneous Surcharge: USD 50 per shipment
`;
  const multiExtraction = extractChargesAndTotals(multiChargeInput);
  assert(
    multiExtraction.charges.some((c) => c.category === "origin_charges"),
    "2.6 Extracted Origin Charges",
  );
  assert(
    multiExtraction.charges.some((c) => c.category === "destination_charges"),
    "2.7 Extracted Destination Charges",
  );
  assert(
    multiExtraction.charges.some((c) => c.category === "customs"),
    "2.8 Extracted Customs",
  );
  assert(
    multiExtraction.charges.some((c) => c.category === "trucking"),
    "2.9 Extracted Trucking (Haulage)",
  );
  assert(
    multiExtraction.charges.some((c) => c.category === "other"),
    "2.10 Extracted Other (Miscellaneous Surcharge)",
  );

  // ===========================================================================
  // SECTION 3: CURRENCY EXTRACTION TESTS
  // ===========================================================================
  console.log("\n--- 3. CURRENCY EXTRACTION TESTS ---");

  // 3.1 Explicit ISO currency codes
  const testCurrencies = [
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
  ];
  for (const curr of testCurrencies) {
    const res = extractExplicitCurrency(`Ocean Freight: ${curr} 1,200`);
    assert(res === curr, `3.1 Explicit currency recognized: ${curr}`);
  }

  // 3.2 Unambiguous symbols
  assert(extractExplicitCurrency("Freight: € 1,200") === "EUR", "3.2 € recognized as EUR");
  assert(extractExplicitCurrency("Freight: £ 1,200") === "GBP", "3.2 £ recognized as GBP");
  assert(extractExplicitCurrency("Freight: Dhs 1,200") === "AED", "3.2 Dhs recognized as AED");
  assert(extractExplicitCurrency("Freight: AED 1,200") === "AED", "3.2 AED recognized as AED");
  assert(extractExplicitCurrency("Freight: Rs 120,000") === "PKR", "3.2 Rs recognized as PKR");
  assert(extractExplicitCurrency("Freight: PKR 120,000") === "PKR", "3.2 PKR recognized as PKR");
  assert(extractExplicitCurrency("Freight: ₹ 85,000") === "INR", "3.2 ₹ recognized as INR");
  assert(extractExplicitCurrency("Freight: $ 1,200") === "USD", "3.2 $ recognized as USD");

  // 3.3 Missing Currency: Do NOT assume currency when only number is present
  const noCurrencyInput = "Ocean Freight: 900 per container\nTHC: 150 per container";
  const noCurrencyResult = extractChargesAndTotals(noCurrencyInput);
  assert(noCurrencyResult.hasMissingCurrency === true, "3.3 Detected missing currency");
  assert(
    noCurrencyResult.needsReview === true,
    "3.3 Missing currency marks quotation as needs_review",
  );
  const noCurrCharge = noCurrencyResult.charges[0];
  assert(noCurrCharge.currency === null, "3.3 Charge currency is null");
  assert(
    noCurrCharge.amountWithoutCurrency === 900,
    "3.3 Charge amount preserved in amount_without_currency",
  );
  assert(noCurrCharge.amount === null, "3.3 Charge amount is null when currency missing");
  assert(noCurrCharge.status === "currency_missing", "3.3 Charge status is currency_missing");

  // ===========================================================================
  // SECTION 4: AMOUNT EXTRACTION & RANGE HANDLING TESTS
  // ===========================================================================
  console.log("\n--- 4. AMOUNT EXTRACTION & RANGE HANDLING TESTS ---");

  // 4.1 Supported formats: USD 900, USD 1,200.50, 900 USD, $900, 900 USD per container, USD 900 x 2
  const fmt1 = parseChargeAmountDetails("USD 900", "Ocean Freight: USD 900");
  assert(fmt1.amount === 900 && fmt1.currency === "USD", "4.1 Format 'USD 900'");

  const fmt2 = parseChargeAmountDetails("USD 1,200.50", "Ocean Freight: USD 1,200.50");
  assert(fmt2.amount === 1200.5 && fmt2.currency === "USD", "4.1 Format 'USD 1,200.50'");

  const fmt3 = parseChargeAmountDetails("900 USD", "Ocean Freight: 900 USD");
  assert(fmt3.amount === 900 && fmt3.currency === "USD", "4.1 Format '900 USD'");

  const fmt4 = parseChargeAmountDetails("$900", "Ocean Freight: $900");
  assert(fmt4.amount === 900 && fmt4.currency === "USD", "4.1 Format '$900'");

  const fmt5Line = "Ocean Freight: 900 USD per container";
  const fmt5 = parseChargeAmountDetails("900 USD per container", fmt5Line);
  const fmt5Unit = extractChargeUnit(fmt5Line);
  assert(
    fmt5.amount === 900 && fmt5Unit.unit === "per_container",
    "4.1 Format '900 USD per container'",
  );

  const fmt6Line = "THC: USD 900 x 2";
  const fmt6 = parseChargeAmountDetails("USD 900 x 2", fmt6Line);
  const fmt6Qty = extractChargeQuantity(fmt6Line);
  assert(fmt6.amount === 900 && fmt6Qty === 2, "4.1 Format 'USD 900 x 2'");

  // 4.2 Range formats: USD 900-1000, USD 900 to 1000 (never silently pick a value)
  const range1 = parseChargeAmountDetails("USD 900-1000", "Ocean Freight: USD 900-1000");
  assert(range1.status === "range", "4.2 'USD 900-1000' detected as range");
  assert(range1.amountMin === 900, "4.2 amount_min is 900");
  assert(range1.amountMax === 1000, "4.2 amount_max is 1000");
  assert(range1.amount === null, "4.2 amount is null for range (not silently chosen)");
  assert(range1.needsReview === true, "4.2 needsReview is true for range");

  const range2 = parseChargeAmountDetails("USD 900 to 1000", "Ocean Freight: USD 900 to 1000");
  assert(range2.status === "range", "4.2 'USD 900 to 1000' detected as range");
  assert(range2.amountMin === 900, "4.2 amount_min is 900");
  assert(range2.amountMax === 1000, "4.2 amount_max is 1000");
  assert(range2.amount === null, "4.2 amount is null for 'to' range");

  // 4.3 Missing Amount handling
  const missingAmount = parseChargeAmountDetails("USD TBD", "Ocean Freight: USD TBD");
  assert(
    missingAmount.status === "pending_applicable" || missingAmount.status === "amount_missing",
    "4.3 Missing/pending amount status is detected",
  );
  assert(missingAmount.amount === null, "4.3 Missing amount is null");
  assert(missingAmount.needsReview === true, "4.3 Missing amount marks needsReview = true");

  // ===========================================================================
  // SECTION 5: TOTAL CALCULATION TESTS
  // ===========================================================================
  console.log("\n--- 5. TOTAL CALCULATION TESTS ---");

  // 5.1 Quoted Total and Calculated Total match
  const matchingInput = `
Ocean Freight: USD 1000 per container
THC: USD 200 per container
Documentation Fee: USD 100 per shipment
Total: USD 1,300
`;
  const matchTotal = extractChargesAndTotals(matchingInput);
  assert(matchTotal.quotedTotal === 1300, "5.1 Quoted total stored as 1300");
  assert(matchTotal.calculatedTotal === 1300, "5.1 Calculated total calculated as 1300");
  assert(matchTotal.totals.status === "MATCHED", "5.1 Totals status is MATCHED");
  assert(matchTotal.hasDiscrepancy === false, "5.1 No discrepancy when totals match");

  // 5.2 Quoted Total and Calculated Total Discrepancy
  const conflictInput = `
Ocean Freight: USD 1000 per container
THC: USD 200 per container
Documentation Fee: USD 100 per shipment
Total: USD 1,500
`;
  const conflictTotal = extractChargesAndTotals(conflictInput);
  assert(conflictTotal.quotedTotal === 1500, "5.2 Quoted total preserved as 1500 (NEVER replaced)");
  assert(conflictTotal.calculatedTotal === 1300, "5.2 Calculated total preserved as 1300");
  assert(conflictTotal.hasDiscrepancy === true, "5.2 Discrepancy detected (1500 != 1300)");
  assert(conflictTotal.needsReview === true, "5.2 Marked needs_review due to total discrepancy");
  assert(
    conflictTotal.warnings.some((w) => w.includes("Discrepancy")),
    "5.2 Conflict warning added",
  );

  // 5.3 Calculated Total NOT calculated when ranges exist
  const rangeTotalInput = `
Ocean Freight: USD 900-1000 per container
THC: USD 150 per container
Total: USD 1,150
`;
  const rangeTotalRes = extractChargesAndTotals(rangeTotalInput);
  assert(rangeTotalRes.quotedTotal === 1150, "5.3 Quoted total preserved as 1150");
  assert(
    rangeTotalRes.calculatedTotal === null,
    "5.3 Calculated total is null because range exists",
  );
  assert(rangeTotalRes.needsReview === true, "5.3 needsReview is true due to range");

  // 5.4 Calculated Total NOT calculated when mixed currencies exist
  const mixedCurrencyInput = `
Ocean Freight: USD 1000 per container
THC: EUR 200 per container
Total: USD 1,200
`;
  const mixedCurrRes = extractChargesAndTotals(mixedCurrencyInput);
  assert(mixedCurrRes.quotedTotal === 1200, "5.4 Quoted total preserved as 1200");
  assert(
    mixedCurrRes.calculatedTotal === null,
    "5.4 Calculated total is null because currencies differ",
  );

  // ===========================================================================
  // SECTION 6: VALIDATION INTEGRATION TEST
  // ===========================================================================
  console.log("\n--- 6. VALIDATION INTEGRATION TEST ---");

  const unmatchedFwd = matchSenderWithForwarderMaster("unknown@unknown.com", forwarderMaster);

  const valResult = validateExtractedQuotation(
    {
      rate: 900,
      currency: "USD",
      containerType: "40HC",
      isDeclined: false,
    },
    {
      isSenderVerified: false,
      isForwarderUnknown: unmatchedFwd.isForwarderUnknown,
      forwarderMatchReason: unmatchedFwd.reason,
    },
  );

  assert(
    valResult.needsReview === true,
    "6.1 Unknown forwarder causes validation needsReview = true",
  );
  assert(
    valResult.reviewReasons.some((r) => /unknown forwarder/i.test(r)),
    "6.2 Unknown forwarder review reason recorded",
  );

  // ===========================================================================
  // SECTION 7: DATE EXTRACTION TESTS
  // ===========================================================================
  console.log("\n--- 7. DATE EXTRACTION TESTS ---");

  // 7.1 Unambiguous Label & Date Extraction for all requested labels:
  // ETD, sailing date, departure, ETA, arrival date, valid until, validity, rate validity, cutoff, cut-off
  const emailWithDates = `
ETD: 15-Oct-2026
Sailing Date: 20 Oct 2026
Departure: 2026-10-25
ETA: 12-Nov-2026
Arrival Date: November 28, 2026
Valid Until: 2026-12-31
Validity: 15 Dec 2026
Rate Validity: 30-Nov-2026
Cutoff: 10 Oct 2026
Cut-Off: 2026-10-12
`;
  const dateRes = extractDatesFromText(emailWithDates);

  assert(dateRes.dates.length >= 10, "7.1 Extracted all 10 date label items");

  // 7.2 Check unambiguous YYYY-MM-DD conversions
  const etdItem = dateRes.dates.find((d) => d.category === "etd");
  assert(etdItem?.isoDate === "2026-10-15", "7.2 ETD '15-Oct-2026' converted to 2026-10-15");
  assert(etdItem?.isAmbiguous === false, "7.2 ETD is unambiguous");

  const sailingItem = dateRes.dates.find((d) => d.category === "sailing_date");
  assert(
    sailingItem?.isoDate === "2026-10-20",
    "7.2 Sailing Date '20 Oct 2026' converted to 2026-10-20",
  );

  const depItem = dateRes.dates.find((d) => d.category === "departure");
  assert(depItem?.isoDate === "2026-10-25", "7.2 Departure '2026-10-25' converted to 2026-10-25");

  const etaItem = dateRes.dates.find((d) => d.category === "eta");
  assert(etaItem?.isoDate === "2026-11-12", "7.2 ETA '12-Nov-2026' converted to 2026-11-12");

  const arrivalItem = dateRes.dates.find((d) => d.category === "arrival_date");
  assert(
    arrivalItem?.isoDate === "2026-11-28",
    "7.2 Arrival Date 'November 28, 2026' converted to 2026-11-28",
  );

  const validUntilItem = dateRes.dates.find((d) => d.category === "valid_until");
  assert(
    validUntilItem?.isoDate === "2026-12-31",
    "7.2 Valid Until '2026-12-31' converted to 2026-12-31",
  );

  const validityItem = dateRes.dates.find((d) => d.category === "validity");
  assert(
    validityItem?.isoDate === "2026-12-15",
    "7.2 Validity '15 Dec 2026' converted to 2026-12-15",
  );

  const rateValidityItem = dateRes.dates.find((d) => d.category === "rate_validity");
  assert(
    rateValidityItem?.isoDate === "2026-11-30",
    "7.2 Rate Validity '30-Nov-2026' converted to 2026-11-30",
  );

  const cutoffItem = dateRes.dates.find((d) => d.category === "cutoff");
  assert(cutoffItem?.isoDate === "2026-10-10", "7.2 Cutoff '10 Oct 2026' converted to 2026-10-10");

  const cutOffItem = dateRes.dates.find((d) => d.category === "cut_off");
  assert(cutOffItem?.isoDate === "2026-10-12", "7.2 Cut-off '2026-10-12' converted to 2026-10-12");

  // 7.3 Unambiguous numeric date where day > 12 (e.g. 25/04/2026)
  const unambiguousNumeric = parseDateDeterministic("25/04/2026");
  assert(
    unambiguousNumeric.isoDate === "2026-04-25",
    "7.3 '25/04/2026' is unambiguously 2026-04-25 (day > 12)",
  );
  assert(unambiguousNumeric.isAmbiguous === false, "7.3 '25/04/2026' isAmbiguous is false");

  const unambiguousUSNumeric = parseDateDeterministic("04/25/2026");
  assert(
    unambiguousUSNumeric.isoDate === "2026-04-25",
    "7.3 '04/25/2026' is unambiguously 2026-04-25 (day > 12)",
  );

  // 7.4 Ambiguous numeric date where both parts <= 12 (e.g. 04/05/2026)
  const ambiguousNumeric = parseDateDeterministic("04/05/2026");
  assert(ambiguousNumeric.isoDate === null, "7.4 Ambiguous '04/05/2026' isoDate is null");
  assert(ambiguousNumeric.isAmbiguous === true, "7.4 '04/05/2026' isAmbiguous is true");
  assert(ambiguousNumeric.status === "ambiguous", "7.4 status is ambiguous");

  // 7.5 Ambiguous text extraction in email preserves original text & marks for review
  const emailWithAmbiguousDate = `
Ocean Freight: USD 1200 per 40HC
ETD: 04/05/2026
ETA: mid November
`;
  const ambigDateRes = extractDatesFromText(emailWithAmbiguousDate);
  assert(ambigDateRes.hasAmbiguousDate === true, "7.5 Detected ambiguous date in email");
  assert(ambigDateRes.needsReview === true, "7.5 needsReview is true for ambiguous date");
  const ambigEtd = ambigDateRes.dates.find((d) => d.category === "etd");
  assert(ambigEtd?.originalText === "04/05/2026", "7.5 Preserves original text '04/05/2026'");
  assert(ambigEtd?.isoDate === null, "7.5 Ambiguous ETD isoDate is null");

  const ambigEta = ambigDateRes.dates.find((d) => d.category === "eta");
  assert(ambigEta?.originalText === "mid November", "7.5 Preserves original text 'mid November'");
  assert(ambigEta?.isAmbiguous === true, "7.5 Fuzzy ETA marked ambiguous");

  // 7.6 Integration with validation: Ambiguous date triggers quotation needsReview
  const valAmbiguousDate = validateExtractedQuotation(
    {
      rate: 1200,
      currency: "USD",
      containerType: "40HC",
      isDeclined: false,
      hasAmbiguousDate: true,
      dateExtractionWarnings: ambigDateRes.warnings,
    },
    {
      isSenderVerified: true,
      isForwarderUnknown: false,
    },
  );
  assert(
    valAmbiguousDate.needsReview === true,
    "7.6 Ambiguous date marks quotation validation needsReview = true",
  );
  assert(
    valAmbiguousDate.reviewReasons.some((r) => r.includes("04/05/2026")),
    "7.6 Review reason mentions ambiguous date '04/05/2026'",
  );

  // ===========================================================================
  // SECTION 8: QUOTATION CLASSIFICATION TESTS
  // ===========================================================================
  console.log("\n--- 8. QUOTATION CLASSIFICATION TESTS ---");

  // 8.1 Category: quotation keywords
  // - quotation, quote, rates, freight offer, our best rate, please find our offer
  const quotationCases = [
    {
      text: "Please find our quotation for the shipment from Karachi to Felixstowe.",
      kw: "quotation",
    },
    { text: "Here is our quote for 2x40HC containers.", kw: "quote" },
    { text: "Standard rates for October 2026 are USD 1,400.", kw: "rates" },
    { text: "Special freight offer for your upcoming movement.", kw: "freight offer" },
    { text: "Our best rate for 40HC is USD 1,150.", kw: "our best rate" },
    {
      text: "Please find our offer attached for booking MOV-2026-0001.",
      kw: "please find our offer",
    },
  ];
  for (const tc of quotationCases) {
    const res = classifyQuotationMessage("Quotation Request", tc.text);
    assert(res.category === "quotation", `8.1 Classified 'quotation' via '${tc.kw}'`);
    assert(res.isQuotation === true, `8.1 isQuotation is true for '${tc.kw}'`);
  }

  // 8.2 Category: no_quote keywords
  // - unable to quote, cannot provide rate, no service, no space, not accepting, declined
  const noQuoteCases = [
    {
      text: "We are currently unable to quote for this lane due to space constraints.",
      kw: "unable to quote",
    },
    {
      text: "Unfortunately we cannot provide rate for this sailing window.",
      kw: "cannot provide rate",
    },
    { text: "We have no service to this destination port at present.", kw: "no service" },
    { text: "Vessel has no space available for the requested departure.", kw: "no space" },
    {
      text: "Carriers are not accepting bookings for HAZ cargo on this feeder.",
      kw: "not accepting",
    },
    { text: "Request has been declined by operations team.", kw: "declined" },
  ];
  for (const tc of noQuoteCases) {
    const res = classifyQuotationMessage("Re: Quote Request", tc.text);
    assert(res.category === "no_quote", `8.2 Classified 'no_quote' via '${tc.kw}'`);
    assert(res.isNoQuote === true, `8.2 isNoQuote is true for '${tc.kw}'`);
  }

  // 8.3 Category: clarification_required keywords
  // - please confirm, need more information, kindly advise, require details, subject to confirmation
  const clarificationCases = [
    {
      text: "Please confirm the ready date and commodity code before we quote.",
      kw: "please confirm",
    },
    {
      text: "We need more information regarding cargo weight and packing type.",
      kw: "need more information",
    },
    {
      text: "Kindly advise whether pickup from shipper warehouse is required.",
      kw: "kindly advise",
    },
    { text: "We require details of destination customs clearance.", kw: "require details" },
    {
      text: "Rates quoted are subject to confirmation of space allocation.",
      kw: "subject to confirmation",
    },
  ];
  for (const tc of clarificationCases) {
    const res = classifyQuotationMessage("Booking Inquiry", tc.text);
    assert(
      res.category === "clarification_required",
      `8.3 Classified 'clarification_required' via '${tc.kw}'`,
    );
    assert(
      res.isClarificationRequired === true,
      `8.3 isClarificationRequired is true for '${tc.kw}'`,
    );
  }

  // 8.4 Category: revision keywords
  // - revised quotation, revised quote, updated rates, ignore previous quote, amendment, version 2
  const revisionCases = [
    {
      text: "Please find our revised quotation with updated bunker surcharge.",
      kw: "revised quotation",
    },
    { text: "Attached is the revised quote for the 40HC container.", kw: "revised quote" },
    { text: "Here are the updated rates for your shipment.", kw: "updated rates" },
    {
      text: "Please ignore previous quote, this is the final valid offer.",
      kw: "ignore previous quote",
    },
    { text: "Quotation amendment: ocean freight adjusted to USD 1,300.", kw: "amendment" },
    { text: "Quotation version 2 for movement reference MOV-2026-0001.", kw: "version 2" },
  ];
  for (const tc of revisionCases) {
    const res = classifyQuotationMessage("Revised Booking Rate", tc.text);
    assert(res.category === "revision", `8.4 Classified 'revision' via '${tc.kw}'`);
    assert(res.isRevision === true, `8.4 isRevision is true for '${tc.kw}'`);
  }

  // 8.5 Category: automated keywords
  // - out of office, automatic reply, auto response, delivery failure
  const automatedCases = [
    {
      text: "I am out of office until next Monday. For urgent queries contact ops@team.com.",
      kw: "out of office",
    },
    {
      text: "This is an automatic reply: Thank you for contacting our sales desk.",
      kw: "automatic reply",
    },
    {
      text: "Auto response: We have received your message and will respond in 24 hours.",
      kw: "auto response",
    },
    {
      text: "Delivery failure: The recipient inbox is full and could not accept the message.",
      kw: "delivery failure",
    },
  ];
  for (const tc of automatedCases) {
    const res = classifyQuotationMessage("Auto: Out of Office", tc.text);
    assert(res.category === "automated", `8.5 Classified 'automated' via '${tc.kw}'`);
    assert(res.isAutomated === true, `8.5 isAutomated is true for '${tc.kw}'`);
  }

  // ===========================================================================
  // SECTION 9: DATABASE SCHEMA REQUIREMENTS TESTS
  // ===========================================================================
  console.log("\n--- 9. DATABASE SCHEMA REQUIREMENTS TESTS ---");

  // 9.1 incoming_emails schema fields verification
  const testEmailInput = {
    id: "e-msg-test-001",
    message_id: "gmail-msg-12345",
    thread_id: "gmail-thread-98765",
    from_name: "Apex Pricing Desk",
    from_email: "pricing@apexmaritime.com",
    subject: "Quotation for BK-2026-000145",
    body_text: "Ocean Freight: USD 1200 per 40HC\nTotal: USD 1200",
    html_body: "<p>Ocean Freight: USD 1200 per 40HC</p>",
    received_at: "2026-10-03T00:00:00.000Z",
    attachment_metadata: { filename: "quote.pdf", size: 1024 },
    processing_status: "PROCESSED",
    processing_error: null,
    detected_booking_numbers: ["BK-2026-000145"],
    detected_forwarder_id: "fwd-apex-01",
  };
  const savedEmail = await persistIncomingEmailRecord(testEmailInput);

  assert(savedEmail.id === "e-msg-test-001", "9.1 incoming_emails.id preserved");
  assert(savedEmail.message_id === "gmail-msg-12345", "9.1 incoming_emails.message_id preserved");
  assert(savedEmail.thread_id === "gmail-thread-98765", "9.1 incoming_emails.thread_id preserved");
  assert(savedEmail.from_name === "Apex Pricing Desk", "9.1 incoming_emails.from_name preserved");
  assert(
    savedEmail.from_email === "pricing@apexmaritime.com",
    "9.1 incoming_emails.from_email preserved",
  );
  assert(
    savedEmail.subject === "Quotation for BK-2026-000145",
    "9.1 incoming_emails.subject preserved",
  );
  assert(savedEmail.body_text.includes("Ocean Freight"), "9.1 incoming_emails.body_text preserved");
  assert(savedEmail.html_body?.includes("<p>"), "9.1 incoming_emails.html_body preserved");
  assert(
    savedEmail.processing_status === "PROCESSED",
    "9.1 incoming_emails.processing_status preserved",
  );
  assert(
    savedEmail.detected_booking_numbers?.[0] === "BK-2026-000145",
    "9.1 incoming_emails.detected_booking_numbers preserved",
  );
  assert(
    savedEmail.detected_forwarder_id === "fwd-apex-01",
    "9.1 incoming_emails.detected_forwarder_id preserved",
  );
  assert(
    !!savedEmail.created_at && !!savedEmail.updated_at,
    "9.1 incoming_emails timestamps present",
  );

  // 9.2 quotation_requests schema fields verification
  const testQuoteReq = await persistQuotationRequestRecord({
    id: "qr-test-001",
    booking_id: "bk-uuid-001",
    forwarder_id: "fwd-apex-01",
    sent_at: "2026-10-02T12:00:00.000Z",
    response_deadline: "2026-10-05T12:00:00.000Z",
    status: "SENT",
  });
  assert(testQuoteReq.id === "qr-test-001", "9.2 quotation_requests.id preserved");
  assert(testQuoteReq.booking_id === "bk-uuid-001", "9.2 quotation_requests.booking_id preserved");
  assert(
    testQuoteReq.forwarder_id === "fwd-apex-01",
    "9.2 quotation_requests.forwarder_id preserved",
  );
  assert(
    testQuoteReq.sent_at === "2026-10-02T12:00:00.000Z",
    "9.2 quotation_requests.sent_at preserved",
  );
  assert(
    testQuoteReq.response_deadline === "2026-10-05T12:00:00.000Z",
    "9.2 quotation_requests.response_deadline preserved",
  );
  assert(testQuoteReq.status === "SENT", "9.2 quotation_requests.status preserved");

  // 9.3 quotations schema fields verification (all 26 fields)
  const testQuote = await persistQuotationRecord({
    id: "q-test-001",
    booking_id: "bk-uuid-001",
    forwarder_id: "fwd-apex-01",
    quotation_request_id: "qr-test-001",
    incoming_email_id: "e-msg-test-001",
    quotation_reference: "Q-APEX-2026",
    quotation_status: "OFFER_RECEIVED",
    revision_number: 1,
    currency: "USD",
    quoted_total: 1200,
    calculated_total: 1200,
    valid_until: "2026-11-30",
    origin: "Karachi",
    destination: "Felixstowe",
    pol: "PKKHI",
    pod: "GBFXT",
    transit_time_days: 22,
    sailing_date: "2026-10-15",
    arrival_date: "2026-11-06",
    vessel_name: "CMA CGM Palais",
    free_days: 14,
    remarks: "Space confirmed, subject to standard demurrage",
    requires_human_review: false,
    review_reason: null,
  });

  assert(testQuote.id === "q-test-001", "9.3 quotations.id preserved");
  assert(testQuote.booking_id === "bk-uuid-001", "9.3 quotations.booking_id preserved");
  assert(testQuote.forwarder_id === "fwd-apex-01", "9.3 quotations.forwarder_id preserved");
  assert(
    testQuote.quotation_request_id === "qr-test-001",
    "9.3 quotations.quotation_request_id preserved",
  );
  assert(
    testQuote.incoming_email_id === "e-msg-test-001",
    "9.3 quotations.incoming_email_id preserved",
  );
  assert(
    testQuote.quotation_reference === "Q-APEX-2026",
    "9.3 quotations.quotation_reference preserved",
  );
  assert(
    testQuote.quotation_status === "OFFER_RECEIVED",
    "9.3 quotations.quotation_status preserved",
  );
  assert(testQuote.revision_number === 1, "9.3 quotations.revision_number preserved");
  assert(testQuote.currency === "USD", "9.3 quotations.currency preserved");
  assert(testQuote.quoted_total === 1200, "9.3 quotations.quoted_total preserved");
  assert(testQuote.calculated_total === 1200, "9.3 quotations.calculated_total preserved");
  assert(testQuote.valid_until === "2026-11-30", "9.3 quotations.valid_until preserved");
  assert(testQuote.origin === "Karachi", "9.3 quotations.origin preserved");
  assert(testQuote.destination === "Felixstowe", "9.3 quotations.destination preserved");
  assert(testQuote.pol === "PKKHI", "9.3 quotations.pol preserved");
  assert(testQuote.pod === "GBFXT", "9.3 quotations.pod preserved");
  assert(testQuote.transit_time_days === 22, "9.3 quotations.transit_time_days preserved");
  assert(testQuote.sailing_date === "2026-10-15", "9.3 quotations.sailing_date preserved");
  assert(testQuote.arrival_date === "2026-11-06", "9.3 quotations.arrival_date preserved");
  assert(testQuote.vessel_name === "CMA CGM Palais", "9.3 quotations.vessel_name preserved");
  assert(testQuote.free_days === 14, "9.3 quotations.free_days preserved");
  assert(testQuote.remarks?.includes("Space confirmed"), "9.3 quotations.remarks preserved");
  assert(
    testQuote.requires_human_review === false,
    "9.3 quotations.requires_human_review preserved",
  );
  assert(!!testQuote.created_at && !!testQuote.updated_at, "9.3 quotations timestamps present");

  // 9.4 quotation_charges schema fields verification (all 14 fields)
  const sampleCharges = extractChargesAndTotals(`
Ocean Freight: USD 900 per 40HC
THC: USD 150 x 2
Documentation Fee: USD 75 per shipment
`);
  const savedCharges = await persistQuotationCharges("q-test-001", sampleCharges.charges);

  assert(savedCharges.length === 3, "9.4 Saved 3 itemized quotation charges");
  const ofCharge = savedCharges.find((c) => c.charge_code === "ocean_freight");
  assert(!!ofCharge, "9.4 Found ocean_freight charge");
  assert(ofCharge?.quotation_id === "q-test-001", "9.4 quotation_charges.quotation_id linked");
  assert(
    ofCharge?.charge_name_normalized === "Ocean Freight",
    "9.4 quotation_charges.charge_name_normalized preserved",
  );
  assert(
    ofCharge?.charge_name_original === "Ocean Freight",
    "9.4 quotation_charges.charge_name_original preserved",
  );
  assert(ofCharge?.amount === 900, "9.4 quotation_charges.amount preserved");
  assert(ofCharge?.currency === "USD", "9.4 quotation_charges.currency preserved");
  assert(ofCharge?.unit === "per_container", "9.4 quotation_charges.unit preserved");
  assert(ofCharge?.status === "exact", "9.4 quotation_charges.status preserved");
  assert(
    ofCharge?.original_text.includes("Ocean Freight: USD 900 per 40HC"),
    "9.4 quotation_charges.original_text preserved",
  );
  assert(!!ofCharge?.created_at, "9.4 quotation_charges.created_at present");

  const thcCharge = savedCharges.find((c) => c.charge_code === "terminal_handling");
  assert(thcCharge?.quantity === 2, "9.4 quotation_charges.quantity preserved for THC (2)");

  // 9.5 persistProcessedQuotationBundle bundle verification
  const bundle = await persistProcessedQuotationBundle({
    incomingEmailId: "email-bundle-001",
    gmailMessageId: "gmsg-bundle-123",
    gmailThreadId: "gthread-bundle-456",
    senderName: "Apex Maritime",
    senderEmail: "pricing@apexmaritime.com",
    subject: "Quotation for MOV-2026-0001",
    body: "Ocean Freight: USD 1100\nTHC: USD 150\nTotal: USD 1250",
    detectedBookingNumbers: ["MOV-2026-0001"],
    detectedForwarderId: "fwd-apex-01",
    bookingId: "bk-uuid-001",
    fields: {
      oceanFreight: 1100,
      originCharges: null,
      destinationCharges: null,
      thc: 150,
      documentationCharges: null,
      customsCharges: null,
      truckingCharges: null,
      otherCharges: null,
      currency: "USD",
      totalAmount: 1250,
      quotedTotal: 1250,
      quoted_total: 1250,
      calculatedTotal: 1250,
      calculated_total: 1250,
      hasDiscrepancy: false,
      discrepancyDifference: null,
      hasRange: false,
      hasMissingCurrency: false,
      hasMissingAmount: false,
      itemizedCharges: sampleCharges.charges,
      charges: sampleCharges.charges,
      chargeExtractionWarnings: [],
      transitTime: 20,
      sailingDate: "2026-10-18",
      validityDate: "2026-11-15",
      freeDays: 14,
      vesselName: "Apex Trader",
      routing: "Direct",
      carrier: "MAERSK",
      containerType: "40HC",
      containerQuantity: 1,
      notes: "Valid 30 days",
      isDeclined: false,
      isConfirmed: false,
      fieldTraceability: {},
    },
    requiresHumanReview: false,
    reviewReasons: [],
  });

  assert(bundle.incomingEmail.id === "email-bundle-001", "9.5 Bundle incoming_emails saved");
  assert(
    bundle.quotationRequest.booking_id === "bk-uuid-001",
    "9.5 Bundle quotation_requests saved",
  );
  assert(bundle.quotation.booking_id === "bk-uuid-001", "9.5 Bundle quotations saved");
  assert(bundle.quotation.quoted_total === 1250, "9.5 Bundle quotations.quoted_total saved");
  assert(bundle.charges.length > 0, "9.5 Bundle quotation_charges saved");

  // ===========================================================================
  // SECTION 10: ATTACHMENT HANDLING TESTS (STRICTLY NO AI / NO OCR)
  // ===========================================================================
  console.log("\n--- 10. ATTACHMENT HANDLING TESTS (NO AI / NO OCR) ---");

  // 10.1 File Type Detection
  const pdfDetect = detectAttachmentType("Quotation_Rate_Sheet.pdf");
  assert(pdfDetect.fileType === "pdf", "10.1 Detects PDF file type");

  const xlsxDetect = detectAttachmentType("Rates_Nov_2026.xlsx");
  assert(xlsxDetect.fileType === "xlsx", "10.1 Detects XLSX file type");

  const docxDetect = detectAttachmentType("Freight_Offer_Contract.docx");
  assert(docxDetect.fileType === "docx", "10.1 Detects DOCX file type");

  const csvDetect = detectAttachmentType("charge_breakdown.csv");
  assert(csvDetect.fileType === "csv", "10.1 Detects CSV file type");

  const txtDetect = detectAttachmentType("quotation_notes.txt");
  assert(txtDetect.fileType === "txt", "10.1 Detects TXT file type");

  const pngDetect = detectAttachmentType("scanned_quote_page1.png", "image/png");
  assert(pngDetect.fileType === "image", "10.1 Detects PNG image type");

  const jpgDetect = detectAttachmentType("receipt_photo.jpg", "image/jpeg");
  assert(jpgDetect.fileType === "image", "10.1 Detects JPG image type");

  // 10.2 Direct Plain Text / CSV Reading
  const sampleCsvData = `Charge Name,Amount,Currency,Unit
Ocean Freight,1200,USD,per 40HC
THC,180,USD,per container
Documentation Fee,75,USD,per BL`;
  const csvExtracted = extractTextFromPlainText(Buffer.from(sampleCsvData, "utf-8"));
  assert(
    csvExtracted.text.includes("Ocean Freight") && csvExtracted.text.includes("1200"),
    "10.2 CSV read directly without AI/OCR",
  );

  const csvItem = await processAttachmentDeterministically({
    filename: "tariff_export.csv",
    data: Buffer.from(sampleCsvData, "utf-8"),
  });
  assert(csvItem.status === "success", "10.2 CSV status is success");
  assert(csvItem.isReadable === true, "10.2 CSV isReadable = true");
  assert(csvItem.requiresManualReview === false, "10.2 CSV requiresManualReview = false");

  // 10.3 XLSX Spreadsheet Deterministic Parser
  const wsData = [
    ["Item", "Charge Description", "Amount", "Currency"],
    ["1", "Ocean Freight 40HC", 1450, "USD"],
    ["2", "Terminal Handling (THC)", 200, "USD"],
    ["3", "Doc Fee", 80, "USD"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "FreightRates");
  const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const xlsxItem = await processAttachmentDeterministically({
    filename: "Ocean_Freight_Quote_2026.xlsx",
    data: xlsxBuffer,
  });
  assert(xlsxItem.status === "success", "10.3 XLSX parsed deterministically");
  assert(xlsxItem.isReadable === true, "10.3 XLSX isReadable = true");
  assert(xlsxItem.requiresManualReview === false, "10.3 XLSX requiresManualReview = false");
  assert(
    xlsxItem.extractedText.includes("1450") && xlsxItem.extractedText.includes("Ocean Freight"),
    "10.3 XLSX cell values extracted",
  );
  assert(
    xlsxItem.sheets?.length === 1 && xlsxItem.sheets[0].name === "FreightRates",
    "10.3 XLSX sheet metadata recorded",
  );

  // 10.4 Image Attachments: Strictly NO AI, NO OCR -> Mark manual_review_required, preserve original
  const dummyImageBytes = Buffer.from(
    "DUMMY_IMAGE_BINARY_CONTENT_PNG_BYTES_89504E470D0A1A0A",
    "utf-8",
  );
  const imageItem = await processAttachmentDeterministically({
    id: "att-img-001",
    filename: "quotation_scan.png",
    mimeType: "image/png",
    data: dummyImageBytes,
    url: "https://drive.nashmia.com/attachments/att-img-001.png",
  });

  assert(imageItem.fileType === "image", "10.4 Image recognized as image type");
  assert(
    imageItem.status === "manual_review_required",
    "10.4 Image status = 'manual_review_required'",
  );
  assert(imageItem.isReadable === false, "10.4 Image isReadable = false (no AI/OCR called)");
  assert(imageItem.requiresManualReview === true, "10.4 Image requiresManualReview = true");
  assert(imageItem.extractedText === "", "10.4 Image extractedText is empty");
  assert(
    imageItem.originalAttachment.filename === "quotation_scan.png",
    "10.4 Preserves original attachment filename",
  );
  assert(
    imageItem.originalAttachment.url === "https://drive.nashmia.com/attachments/att-img-001.png",
    "10.4 Preserves original attachment URL",
  );
  assert(imageItem.originalAttachment.hasRawData === true, "10.4 Preserves raw attachment data");
  assert(
    imageItem.reason.includes("AI and OCR services are strictly disabled"),
    "10.4 Reason explicitly documents AI/OCR disabled",
  );

  // 10.5 Scanned / Image-Only PDF: Zero extractable text stream -> Mark manual_review_required
  const scannedPdfItem = await processAttachmentDeterministically({
    id: "att-pdf-scanned-001",
    filename: "scanned_handwritten_quote.pdf",
    data: Buffer.from(
      "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 2\n0000000000 65535 f\ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n50\n%%EOF",
      "utf-8",
    ),
  });
  assert(scannedPdfItem.fileType === "pdf", "10.5 PDF recognized as PDF");
  assert(
    scannedPdfItem.status === "manual_review_required",
    "10.5 Scanned PDF marked manual_review_required",
  );
  assert(scannedPdfItem.isReadable === false, "10.5 Scanned PDF isReadable = false");
  assert(
    scannedPdfItem.requiresManualReview === true,
    "10.5 Scanned PDF requiresManualReview = true",
  );

  // 10.6 Batch Processing Integration
  const batchResult = await processAttachmentBatchDeterministically([
    {
      filename: "Rates.xlsx",
      data: xlsxBuffer,
    },
    {
      filename: "Scanned_Stamp.png",
      mimeType: "image/png",
      data: dummyImageBytes,
    },
    {
      filename: "Tariff.csv",
      data: Buffer.from(sampleCsvData, "utf-8"),
    },
  ]);

  assert(batchResult.attachments.length === 3, "10.6 Processed all 3 attachments in batch");
  assert(batchResult.totalReadable === 2, "10.6 2 readable attachments (XLSX, CSV)");
  assert(batchResult.totalUnreadable === 1, "10.6 1 unreadable image attachment");
  assert(batchResult.hasUnreadableAttachments === true, "10.6 hasUnreadableAttachments = true");
  assert(batchResult.requiresManualReview === true, "10.6 requiresManualReview = true");
  assert(
    batchResult.combinedExtractedText.includes("Ocean Freight 40HC"),
    "10.6 Combined text contains XLSX rates",
  );
  assert(
    batchResult.combinedExtractedText.includes("Charge Name,Amount"),
    "10.6 Combined text contains CSV rates",
  );
  assert(
    batchResult.reviewReasons.some((r) => r.includes("Scanned_Stamp.png")),
    "10.6 Review reason recorded for PNG image",
  );

  // ===========================================================================
  // SECTION 11: HUMAN REVIEW CONDITIONS & DETERMINISTIC STATUSES (STRICTLY NO AI CONFIDENCE)
  // ===========================================================================
  console.log("\n--- 11. HUMAN REVIEW CONDITIONS & DETERMINISTIC STATUSES ---");

  // Helper template for clean fields
  const baseValidFields: DeterministicQuotationFields = {
    oceanFreight: 1200,
    originCharges: null,
    destinationCharges: null,
    thc: 150,
    documentationCharges: null,
    customsCharges: null,
    truckingCharges: null,
    otherCharges: null,
    currency: "USD",
    totalAmount: 1350,
    quotedTotal: 1350,
    quoted_total: 1350,
    calculatedTotal: 1350,
    calculated_total: 1350,
    hasDiscrepancy: false,
    discrepancyDifference: null,
    hasRange: false,
    hasMissingCurrency: false,
    hasMissingAmount: false,
    hasMultipleCurrencies: false,
    hasAmbiguousDate: false,
    itemizedCharges: [],
    charges: [],
    chargeExtractionWarnings: [],
    transitTime: 22,
    sailingDate: "2026-10-20",
    validityDate: "2026-11-20",
    freeDays: 14,
    vesselName: "MAERSK MC-KINNEY",
    routing: "Direct",
    carrier: "MAERSK",
    containerType: "40HC",
    containerQuantity: 1,
    notes: null,
    isDeclined: false,
    isConfirmed: false,
    fieldTraceability: {},
  };

  // 11.0 Clean Quotation -> Confirmed status (no AI confidence score)
  const cleanRes = validateExtractedQuotation(baseValidFields, {
    isSenderVerified: true,
    isForwarderUnknown: false,
    isBookingMatched: true,
    detectedBookingNumbers: ["BK-2026-0001"],
  });
  assert(cleanRes.needsReview === false, "11.0 Clean quotation does not need review");
  assert(cleanRes.status === "OFFER_RECEIVED", "11.0 Status is OFFER_RECEIVED");
  assert(cleanRes.deterministicStatus === "confirmed", "11.0 Deterministic status is 'confirmed'");
  assert(
    cleanRes.deterministicStatuses.includes("confirmed"),
    "11.0 deterministicStatuses includes 'confirmed'",
  );

  // 11.1 Condition 1: Booking number is missing
  const missingBkRes = validateExtractedQuotation(baseValidFields, {
    isSenderVerified: true,
    isBookingNumberMissing: true,
    detectedBookingNumbers: [],
  });
  assert(missingBkRes.needsReview === true, "11.1 Booking number missing triggers needs_review");
  assert(missingBkRes.status === "NEEDS_REVIEW", "11.1 Overall status is NEEDS_REVIEW");
  assert(
    missingBkRes.deterministicStatuses.includes("unmatched"),
    "11.1 Deterministic status includes 'unmatched'",
  );
  assert(
    missingBkRes.triggeredConditions.bookingNumberMissing === true,
    "11.1 bookingNumberMissing condition flag true",
  );

  // 11.2 Condition 2: Multiple booking numbers found
  const multiBkRes = validateExtractedQuotation(baseValidFields, {
    isSenderVerified: true,
    hasMultipleBookingNumbers: true,
    detectedBookingNumbers: ["BK-2026-0001", "BK-2026-0002"],
  });
  assert(multiBkRes.needsReview === true, "11.2 Multiple booking numbers triggers needs_review");
  assert(
    multiBkRes.deterministicStatuses.includes("ambiguous"),
    "11.2 Deterministic status includes 'ambiguous'",
  );
  assert(
    multiBkRes.triggeredConditions.multipleBookingNumbers === true,
    "11.2 multipleBookingNumbers condition flag true",
  );

  // 11.3 Condition 3: Forwarder is unknown
  const unknownFwdRes = validateExtractedQuotation(baseValidFields, {
    isSenderVerified: false,
    isForwarderUnknown: true,
    forwarderMatchReason: "Sender domain not registered in master",
  });
  assert(unknownFwdRes.needsReview === true, "11.3 Forwarder unknown triggers needs_review");
  assert(
    unknownFwdRes.deterministicStatuses.includes("unmatched"),
    "11.3 Deterministic status includes 'unmatched'",
  );
  assert(
    unknownFwdRes.triggeredConditions.forwarderUnknown === true,
    "11.3 forwarderUnknown condition flag true",
  );

  // 11.4 Condition 4: Currency is missing
  const missingCurrRes = validateExtractedQuotation(
    { ...baseValidFields, currency: null, hasMissingCurrency: true },
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(missingCurrRes.needsReview === true, "11.4 Currency missing triggers needs_review");
  assert(
    missingCurrRes.deterministicStatus === "currency_missing",
    "11.4 Deterministic status is 'currency_missing'",
  );
  assert(
    missingCurrRes.deterministicStatuses.includes("currency_missing"),
    "11.4 deterministicStatuses includes 'currency_missing'",
  );
  assert(
    missingCurrRes.triggeredConditions.currencyMissing === true,
    "11.4 currencyMissing condition flag true",
  );

  // 11.5 Condition 5: Charge amount is missing
  const missingAmtRes = validateExtractedQuotation(
    {
      ...baseValidFields,
      oceanFreight: null,
      totalAmount: null,
      quotedTotal: null,
      calculatedTotal: null,
      hasMissingAmount: true,
    },
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(missingAmtRes.needsReview === true, "11.5 Charge amount missing triggers needs_review");
  assert(
    missingAmtRes.deterministicStatus === "amount_missing",
    "11.5 Deterministic status is 'amount_missing'",
  );
  assert(
    missingAmtRes.deterministicStatuses.includes("amount_missing"),
    "11.5 deterministicStatuses includes 'amount_missing'",
  );
  assert(
    missingAmtRes.triggeredConditions.chargeAmountMissing === true,
    "11.5 chargeAmountMissing condition flag true",
  );

  // 11.6 Condition 6: Amount is a range
  const rangeAmtRes = validateExtractedQuotation(
    { ...baseValidFields, hasRange: true },
    {
      isSenderVerified: true,
      isBookingMatched: true,
    },
  );
  assert(rangeAmtRes.needsReview === true, "11.6 Amount range triggers needs_review");
  assert(rangeAmtRes.deterministicStatus === "range", "11.6 Deterministic status is 'range'");
  assert(
    rangeAmtRes.deterministicStatuses.includes("range"),
    "11.6 deterministicStatuses includes 'range'",
  );
  assert(
    rangeAmtRes.triggeredConditions.amountIsRange === true,
    "11.6 amountIsRange condition flag true",
  );

  // 11.7 Condition 7: Multiple currencies exist
  const multiCurrRes = validateExtractedQuotation(
    { ...baseValidFields, hasMultipleCurrencies: true },
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(multiCurrRes.needsReview === true, "11.7 Multiple currencies triggers needs_review");
  assert(
    multiCurrRes.deterministicStatuses.includes("conflict"),
    "11.7 Deterministic status includes 'conflict'",
  );
  assert(
    multiCurrRes.triggeredConditions.multipleCurrencies === true,
    "11.7 multipleCurrencies condition flag true",
  );

  // 11.8 Condition 8: Quoted total conflicts with calculated total
  const conflictTotalRes = validateExtractedQuotation(
    {
      ...baseValidFields,
      quotedTotal: 1500,
      calculatedTotal: 1350,
      hasDiscrepancy: true,
      discrepancyDifference: 150,
    },
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(
    conflictTotalRes.needsReview === true,
    "11.8 Quoted vs calculated total conflict triggers needs_review",
  );
  assert(
    conflictTotalRes.deterministicStatus === "conflict",
    "11.8 Deterministic status is 'conflict'",
  );
  assert(
    conflictTotalRes.deterministicStatuses.includes("conflict"),
    "11.8 deterministicStatuses includes 'conflict'",
  );
  assert(
    conflictTotalRes.triggeredConditions.totalConflict === true,
    "11.8 totalConflict condition flag true",
  );

  // 11.9 Condition 9: Attachment is unreadable
  const unreadableAttRes = validateExtractedQuotation(baseValidFields, {
    isSenderVerified: true,
    isBookingMatched: true,
    hasUnreadableAttachments: true,
    unreadableAttachmentReason: "Image attachment scanned without text",
  });
  assert(unreadableAttRes.needsReview === true, "11.9 Unreadable attachment triggers needs_review");
  assert(
    unreadableAttRes.deterministicStatus === "unreadable",
    "11.9 Deterministic status is 'unreadable'",
  );
  assert(
    unreadableAttRes.deterministicStatuses.includes("unreadable"),
    "11.9 deterministicStatuses includes 'unreadable'",
  );
  assert(
    unreadableAttRes.triggeredConditions.attachmentUnreadable === true,
    "11.9 attachmentUnreadable condition flag true",
  );

  // 11.10 Condition 10: Date is ambiguous
  const ambigDateCondRes = validateExtractedQuotation(
    {
      ...baseValidFields,
      hasAmbiguousDate: true,
      dateExtractionWarnings: ["Ambiguous date '04/05/2026'"],
    },
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(ambigDateCondRes.needsReview === true, "11.10 Ambiguous date triggers needs_review");
  assert(
    ambigDateCondRes.deterministicStatuses.includes("ambiguous"),
    "11.10 Deterministic status includes 'ambiguous'",
  );
  assert(
    ambigDateCondRes.triggeredConditions.dateAmbiguous === true,
    "11.10 dateAmbiguous condition flag true",
  );

  // 11.11 Condition 11: Revised quotation is detected
  const revisionRes = validateExtractedQuotation(
    { ...baseValidFields, quotationCategory: "revision" },
    { isSenderVerified: true, isBookingMatched: true, isRevision: true },
  );
  assert(revisionRes.needsReview === true, "11.11 Revised quotation triggers needs_review");
  assert(
    revisionRes.deterministicStatuses.includes("needs_review"),
    "11.11 Deterministic status includes 'needs_review'",
  );
  assert(
    revisionRes.triggeredConditions.revisedQuotation === true,
    "11.11 revisedQuotation condition flag true",
  );

  // 11.12 Condition 12: Booking details do not match
  const mismatchDetailsRes = validateExtractedQuotation(baseValidFields, {
    isSenderVerified: true,
    isBookingMatched: false,
    bookingDetailsMismatch: true,
    bookingMismatchReason: "POL code mismatch with booking specification",
  });
  assert(
    mismatchDetailsRes.needsReview === true,
    "11.12 Booking details mismatch triggers needs_review",
  );
  assert(
    mismatchDetailsRes.deterministicStatuses.includes("unmatched"),
    "11.12 Deterministic status includes 'unmatched'",
  );
  assert(
    mismatchDetailsRes.triggeredConditions.bookingDetailsMismatch === true,
    "11.12 bookingDetailsMismatch condition flag true",
  );

  // 11.13 Condition 13: Parser finds unsupported or unclear text
  const unclearTextRes = validateExtractedQuotation(
    { ...baseValidFields, hasUnsupportedText: true },
    {
      isSenderVerified: true,
      isBookingMatched: true,
      hasUnsupportedText: true,
      unsupportedTextReason: "Unclear freight tariff table structure",
    },
  );
  assert(unclearTextRes.needsReview === true, "11.13 Unsupported text triggers needs_review");
  assert(
    unclearTextRes.deterministicStatuses.includes("ambiguous"),
    "11.13 Deterministic status includes 'ambiguous'",
  );
  assert(
    unclearTextRes.triggeredConditions.unsupportedText === true,
    "11.13 unsupportedText condition flag true",
  );

  // ===========================================================================
  // SECTION 12: API ENDPOINTS TESTS (10 CORE REST ENDPOINTS)
  // ===========================================================================
  console.log("\n--- 12. API ENDPOINTS TESTS (10 CORE REST ENDPOINTS) ---");

  async function callApi(method: string, path: string, body?: unknown) {
    const url = new URL(`https://localhost${path}`);
    const req = new Request(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        authorization: "Bearer mock-test-token",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const res = await handleQuotationsApiRequest(req, url);
    if (!res) {
      throw new Error(`Route not handled: ${method} ${path}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    return { status: res.status, data: json };
  }

  // 12.1 GET /api/bookings/:bookingId/quotations
  const testBookingId = "BK-API-2026-001";
  const getBkJres = await callApi("GET", `/api/bookings/${testBookingId}/quotations`);
  assert(getBkJres.status === 200, "12.1 GET /api/bookings/:bookingId/quotations returns 200");
  assert(getBkJres.data.success === true, "12.1 Returns success = true");
  assert(getBkJres.data.bookingId === testBookingId, "12.1 Matches requested bookingId");
  assert(Array.isArray(getBkJres.data.quotations), "12.1 Returns quotations array");

  // 12.2 GET /api/quotations/:quotationId
  const testQuoteId = "local-quote-test-101";
  setInMemoryQuotation(testQuoteId, {
    id: testQuoteId,
    booking_id: testBookingId,
    forwarder_id: "fwd-cma-01",
    quotation_request_id: "qr-101",
    incoming_email_id: "em-101",
    quotation_reference: "QT-2026-CMA-99",
    quotation_status: "OFFER_RECEIVED",
    revision_number: 1,
    currency: "USD",
    quoted_total: 1380,
    calculated_total: 1380,
    valid_until: "2026-11-30",
    origin: "Shanghai",
    destination: "Jebel Ali",
    pol: "CNSHA",
    pod: "AEJEA",
    transit_time_days: 18,
    sailing_date: "2026-10-25",
    arrival_date: "2026-11-12",
    vessel_name: "CMA CGM RIVOLI",
    free_days: 14,
    remarks: "Direct service",
    requires_human_review: false,
    review_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    charges: [],
  });

  const getQres = await callApi("GET", `/api/quotations/${testQuoteId}`);
  assert(getQres.status === 200, "12.2 GET /api/quotations/:quotationId returns 200");
  assert(getQres.data.success === true, "12.2 Returns success = true");
  assert(Boolean(getQres.data.quotation), "12.2 Returns quotation object");

  // 12.3 POST /api/quotations/:quotationId/confirm
  const confirmRes = await callApi("POST", `/api/quotations/${testQuoteId}/confirm`, {
    confirmedBy: "Lead Cargo Operator",
  });
  assert(confirmRes.status === 200, "12.3 POST /api/quotations/:quotationId/confirm returns 200");
  assert(confirmRes.data.success === true, "12.3 Confirm returns success = true");
  assert(confirmRes.data.status === "confirmed", "12.3 Quotation status updated to 'confirmed'");

  // 12.4 POST /api/quotations/:quotationId/reject
  const rejectRes = await callApi("POST", `/api/quotations/${testQuoteId}/reject`, {
    reason: "Rate too high compared to market benchmark",
  });
  assert(rejectRes.status === 200, "12.4 POST /api/quotations/:quotationId/reject returns 200");
  assert(rejectRes.data.success === true, "12.4 Reject returns success = true");
  assert(rejectRes.data.status === "rejected", "12.4 Quotation status updated to 'rejected'");

  // 12.5 POST /api/quotations/:quotationId/mark-duplicate
  const dupRes = await callApi("POST", `/api/quotations/${testQuoteId}/mark-duplicate`, {
    originalQuotationId: "quote-original-001",
    reason: "Same quotation received twice from forwarder inbox",
  });
  assert(
    dupRes.status === 200,
    "12.5 POST /api/quotations/:quotationId/mark-duplicate returns 200",
  );
  assert(dupRes.data.success === true, "12.5 Mark-duplicate returns success = true");
  assert(dupRes.data.status === "duplicate", "12.5 Status updated to 'duplicate'");

  // 12.6 POST /api/quotations/:quotationId/reprocess
  const reprocessRes = await callApi("POST", `/api/quotations/${testQuoteId}/reprocess`, {
    rawEmail:
      "Booking Ref: BK-2026-0001\nOcean Freight: $1,250 USD\nTHC: $180 USD\nVessel: MAERSK MC-KINNEY",
  });
  assert(
    reprocessRes.status === 200,
    "12.6 POST /api/quotations/:quotationId/reprocess returns 200",
  );
  assert(reprocessRes.data.success === true, "12.6 Reprocess returns success = true");
  assert(reprocessRes.data.reprocessed === true, "12.6 reprocessed flag is true");
  assert(Boolean(reprocessRes.data.quotationFields), "12.6 Returns reprocessed quotationFields");

  // 12.7 POST /api/incoming-emails/:emailId/process
  const testEmailId = `email-${Date.now()}`;
  const processEmailRes = await callApi("POST", `/api/incoming-emails/${testEmailId}/process`, {
    subject: "Rate Offer for BK-2026-0001",
    body: "Dear Nashmia Team,\nPlease find our quotation:\nOcean Freight: $1,400 USD\nTHC: $150 USD\nValid until 2026-12-31",
    senderEmail: "rates@cma-cgm.com",
    senderName: "CMA CGM Logistics",
  });
  assert(
    processEmailRes.status === 200,
    "12.7 POST /api/incoming-emails/:emailId/process returns 200",
  );
  assert(processEmailRes.data.success === true, "12.7 Process email returns success = true");
  assert(
    processEmailRes.data.bookingNumber === "BK-2026-0001",
    "12.7 Extracted booking number BK-2026-0001",
  );

  // 12.8 GET /api/incoming-emails/unmatched
  const unmatchedRes = await callApi("GET", "/api/incoming-emails/unmatched?limit=10");
  assert(unmatchedRes.status === 200, "12.8 GET /api/incoming-emails/unmatched returns 200");
  assert(unmatchedRes.data.success === true, "12.8 Returns success = true");
  assert(Array.isArray(unmatchedRes.data.emails), "12.8 Returns emails array");

  // 12.9 GET /api/incoming-emails/needs-review
  const needsReviewRes = await callApi("GET", "/api/incoming-emails/needs-review?limit=10");
  assert(needsReviewRes.status === 200, "12.9 GET /api/incoming-emails/needs-review returns 200");
  assert(needsReviewRes.data.success === true, "12.9 Returns success = true");
  assert(Array.isArray(needsReviewRes.data.emails), "12.9 Returns emails array");

  // 12.10 POST /api/incoming-emails/:emailId/link-booking
  const linkBookingRes = await callApi("POST", `/api/incoming-emails/${testEmailId}/link-booking`, {
    bookingId: "BK-2026-0001",
    forwarderId: "fwd-cma-cgm",
  });
  assert(
    linkBookingRes.status === 200,
    "12.10 POST /api/incoming-emails/:emailId/link-booking returns 200",
  );
  assert(linkBookingRes.data.success === true, "12.10 Link-booking returns success = true");
  assert(linkBookingRes.data.linked === true, "12.10 linked flag is true");
  assert(linkBookingRes.data.bookingId === "BK-2026-0001", "12.10 bookingId matches target");

  // ===========================================================================
  // SECTION 13: SECURITY TESTS
  // ===========================================================================
  console.log("\n--- 13. SECURITY VERIFICATION TESTS ---");

  // 13.1 Strict AI Independence (No AI API Keys / Dependencies)
  const pkgJson = JSON.parse(fs.readFileSync("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const allDeps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };
  const prohibitedAiPkgs = ["@google/genai", "openai", "@anthropic-ai/sdk", "langchain"];
  for (const pkg of prohibitedAiPkgs) {
    assert(!allDeps[pkg], `13.1 package.json does not contain AI dependency '${pkg}'`);
  }

  // 13.2 Email HTML Content Sanitization
  const maliciousHtml =
    '<p>Normal text</p><script>alert("xss")</script><iframe src="evil.com"></iframe><img src="x" onerror="stealCookies()"><a href="javascript:attack()">Click</a>';
  const cleanHtml = sanitizeEmailHtml(maliciousHtml);
  assert(!cleanHtml.includes("<script>"), "13.2 Strips <script> tags from email HTML");
  assert(!cleanHtml.includes("<iframe>"), "13.2 Strips <iframe> tags from email HTML");
  assert(!cleanHtml.includes("onerror"), "13.2 Strips dangerous event handlers (onerror)");
  assert(!cleanHtml.includes("javascript:attack()"), "13.2 Neutralizes javascript: URI links");
  assert(cleanHtml.includes("Normal text"), "13.2 Preserves legitimate safe text");

  // 13.3 Attachment Security Validation
  const exeValidation = validateAttachmentSecurity("invoice.exe", 1024, "application/x-msdownload");
  assert(exeValidation.isValid === false, "13.3 Rejects dangerous executable attachment (.exe)");
  assert(exeValidation.isDangerousExecutable === true, "13.3 isDangerousExecutable flagged true");

  const batValidation = validateAttachmentSecurity("run.bat", 500, "text/plain");
  assert(batValidation.isValid === false, "13.3 Rejects script attachment (.bat)");

  const oversizedValidation = validateAttachmentSecurity(
    "huge_rates.pdf",
    30 * 1024 * 1024,
    "application/pdf",
  );
  assert(oversizedValidation.isValid === false, "13.3 Rejects oversized attachment (> 25MB)");
  assert(oversizedValidation.isOversized === true, "13.3 isOversized flagged true");

  const pathTraversalValidation = validateAttachmentSecurity(
    "../../../etc/passwd",
    2048,
    "text/plain",
  );
  assert(
    pathTraversalValidation.sanitizedFilename === "passwd",
    "13.3 Sanitizes path traversal sequences from filename",
  );

  // 13.4 Forwarder Isolation & RBAC
  // Setup two forwarders with quotes for same booking
  const quoteFwdA = "quote-fwd-alpha";
  const quoteFwdB = "quote-fwd-beta";
  const isolationBooking = "BK-SEC-2026-99";

  setInMemoryQuotation(quoteFwdA, {
    id: quoteFwdA,
    booking_id: isolationBooking,
    forwarder_id: "fwd-alpha-id",
    forwarder_name: "Alpha Logistics",
    quotation_request_id: "qr-alpha",
    incoming_email_id: "em-alpha",
    quotation_reference: "QT-ALPHA-100",
    quotation_status: "OFFER_RECEIVED",
    revision_number: 1,
    currency: "USD",
    quoted_total: 1500,
    calculated_total: 1500,
    valid_until: "2026-12-31",
    origin: "Shanghai",
    destination: "Jebel Ali",
    pol: "CNSHA",
    pod: "AEJEA",
    transit_time_days: 20,
    sailing_date: "2026-11-01",
    arrival_date: "2026-11-21",
    vessel_name: "ALPHA LEADER",
    free_days: 14,
    remarks: "Alpha quote",
    requires_human_review: false,
    review_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  setInMemoryQuotation(quoteFwdB, {
    id: quoteFwdB,
    booking_id: isolationBooking,
    forwarder_id: "fwd-beta-id",
    forwarder_name: "Beta Maritime",
    quotation_request_id: "qr-beta",
    incoming_email_id: "em-beta",
    quotation_reference: "QT-BETA-200",
    quotation_status: "OFFER_RECEIVED",
    revision_number: 1,
    currency: "USD",
    quoted_total: 1420,
    calculated_total: 1420,
    valid_until: "2026-12-31",
    origin: "Shanghai",
    destination: "Jebel Ali",
    pol: "CNSHA",
    pod: "AEJEA",
    transit_time_days: 19,
    sailing_date: "2026-11-02",
    arrival_date: "2026-11-21",
    vessel_name: "BETA VOYAGER",
    free_days: 21,
    remarks: "Beta quote",
    requires_human_review: false,
    review_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Forwarder Alpha queries booking quotes
  const fwdAUrl = new URL(`https://localhost/api/bookings/${isolationBooking}/quotations`);
  const fwdAReq = new Request(fwdAUrl.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "forwarder",
      "x-forwarder-id": "fwd-alpha-id",
    },
  });
  const fwdARes = await handleQuotationsApiRequest(fwdAReq, fwdAUrl);
  const fwdAData = (await fwdARes?.json()) as {
    success: boolean;
    quotations: Array<{ forwarder_id: string }>;
  };
  assert(fwdAData.success === true, "13.4 Forwarder Alpha query succeeds");
  assert(
    fwdAData.quotations.length === 1 && fwdAData.quotations[0].forwarder_id === "fwd-alpha-id",
    "13.4 Forwarder Alpha sees ONLY their own quotation (competing Beta quote hidden)",
  );

  // Forwarder Alpha tries to access Forwarder Beta quote by ID
  const forbiddenUrl = new URL(`https://localhost/api/quotations/${quoteFwdB}`);
  const forbiddenReq = new Request(forbiddenUrl.toString(), {
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "forwarder",
      "x-forwarder-id": "fwd-alpha-id",
    },
  });
  const forbiddenRes = await handleQuotationsApiRequest(forbiddenReq, forbiddenUrl);
  assert(
    forbiddenRes?.status === 403,
    "13.4 Forwarder Alpha is forbidden (403) from viewing Beta's quotation",
  );

  // Forwarder tries to confirm quotation
  const confirmForbiddenUrl = new URL(`https://localhost/api/quotations/${quoteFwdA}/confirm`);
  const confirmForbiddenReq = new Request(confirmForbiddenUrl.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "forwarder",
      "x-forwarder-id": "fwd-alpha-id",
    },
  });
  const confirmForbiddenRes = await handleQuotationsApiRequest(
    confirmForbiddenReq,
    confirmForbiddenUrl,
  );
  assert(
    confirmForbiddenRes?.status === 403,
    "13.4 Forwarder cannot confirm quotation (403 Forbidden)",
  );

  // 13.5 Database Transaction Execution
  const txSuccess = await executeQuotationTransaction("SaveQuotationBundle", async () => {
    return { bundleId: "tx-bundle-001", committed: true };
  });
  assert(txSuccess.success === true, "13.5 Database transaction commits successfully");
  assert(txSuccess.result?.committed === true, "13.5 Transaction result returned cleanly");

  const txFail = await executeQuotationTransaction("FailingQuotationSave", async () => {
    throw new Error("Simulated database constraint check failure");
  });
  assert(txFail.success === false, "13.5 Database transaction aborts cleanly on error");
  assert(Boolean(txFail.error), "13.5 Transaction error recorded without crashing");

  // 13.6 Preservation of Original Email & Attachments
  const originalAttData = {
    filename: "rates_sheet.xlsx",
    size: 2048,
    data: Buffer.from("test raw binary"),
  };
  const processedAtt = await processAttachmentDeterministically(originalAttData);
  assert(
    processedAtt.originalAttachment.filename === "rates_sheet.xlsx",
    "13.6 Preserves original attachment filename",
  );
  assert(
    processedAtt.originalAttachment.hasRawData === true,
    "13.6 Preserves raw attachment binary data without alteration",
  );

  console.log("\n================================================================================");
  console.log(`📊 ALL ${passed} OF ${total} TESTS PASSED WITH 100% ACCURACY!`);
  console.log("================================================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
