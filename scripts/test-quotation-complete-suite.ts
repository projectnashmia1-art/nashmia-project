/**
 * ============================================================================
 * COMPLETE DETERMINISTIC TEST SUITE FOR QUOTATION PROCESSING & VERIFICATION
 * ============================================================================
 *
 * Covers all 21 core evaluation criteria using fixed test email fixtures
 * and deterministic expected outputs. ZERO AI API calls are made.
 *
 * 1.  Booking number extraction
 * 2.  Multiple booking number detection
 * 3.  Forwarder email matching
 * 4.  Charge keyword matching
 * 5.  Currency parsing
 * 6.  Amount parsing
 * 7.  Range amount handling
 * 8.  Missing amount handling
 * 9.  Quoted total extraction
 * 10. Calculated total
 * 11. Total conflict
 * 12. Date parsing
 * 13. No quote detection
 * 14. Clarification detection
 * 15. Revision detection
 * 16. Duplicate message handling
 * 17. Unknown booking handling
 * 18. Unknown forwarder handling
 * 19. Unreadable attachment handling
 * 20. Manual link to booking
 * 21. Request Card quotation display
 */

import {
  extractBookingNumbersFromText,
  extractBookingNumberStrictOrder,
  normalizeBookingNumber,
  validateExtractedQuotation,
  processForwarderQuotationEmail,
  extractQuotationFieldsDeterministic,
  type DeterministicQuotationFields,
} from "../src/lib/forwarder-quotation-processor";

import {
  matchSenderWithForwarderMaster,
  getForwarderRegisteredDomains,
  type ForwarderMasterRecord,
} from "../src/lib/forwarder-matching-service";

import {
  extractChargesAndTotals,
  extractExplicitCurrency,
  parseChargeAmountDetails,
  extractChargeUnit,
  extractChargeQuantity,
} from "../src/lib/deterministic-charge-extractor";

import {
  extractDatesFromText,
  parseDateDeterministic,
  formatIsoDate,
} from "../src/lib/deterministic-date-extractor";

import { classifyQuotationMessage } from "../src/lib/deterministic-quotation-classifier";

import {
  processAttachmentDeterministically,
  detectAttachmentType,
} from "../src/lib/deterministic-attachment-extractor";

import {
  handleQuotationsApiRequest,
  setInMemoryQuotation,
  setInMemoryIncomingEmail,
} from "../src/lib/api-quotations-router";

import {
  getBookingForwarderSummary,
  type ForwarderQuoteRequestRecord,
} from "../src/lib/multi-forwarder-service";

import { type ForwarderBookingRequest } from "../src/lib/booking-data";

// ============================================================================
// FIXED TEST EMAIL FIXTURES
// ============================================================================

export const FIXED_TEST_EMAILS = {
  // 1. Standard Booking Number in Subject
  standardBookingSubject: {
    messageId: "fixed-msg-001@apexmaritime.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Pricing Team",
    subject: "Rate Quotation for BK-2026-0042 - 2x40HC Shanghai to Jebel Ali",
    body: `Dear Team,
Please see our rate offer for booking BK-2026-0042:
Ocean Freight: $1,400 / 40HC
BAF: $200
Origin THC: $150
Total: $1,750 USD
ETD: 2026-10-20
ETA: 2026-11-05
Valid until: 2026-11-15
Best regards, Apex Maritime`,
  },

  // 2. Multiple Booking Numbers in Email
  multipleBookings: {
    messageId: "fixed-msg-002@maersk.com",
    from: "oceanquotes@maersk.com",
    senderName: "Maersk Line",
    subject: "Combined Rates: BK-2026-0042 and BK-2026-0088",
    body: `Hello Logistics Team,
Regarding your requests for BK-2026-0042 and MOV-2026-9099:
Rate per container is $1,350 USD.
Please confirm which movement to allocate first.`,
  },

  // 3. Sender from Registered Corporate Domain
  registeredDomainSender: {
    messageId: "fixed-msg-003@cma-cgm.com",
    from: "j.smith.apac@cma-cgm.com",
    senderName: "John Smith (CMA CGM)",
    subject: "Quotation for BK-2026-0042",
    body: `Hi, Ocean Freight rate is $1,300 USD all-in for BK-2026-0042.`,
  },

  // 3b. Spoofed Display Name from Random Domain
  spoofedSender: {
    messageId: "fixed-msg-003b@phishing.net",
    from: "quotes@fake-unregistered-broker.org",
    senderName: "Maersk Line Official",
    subject: "Official Maersk Quote for BK-2026-0042",
    body: `Dear Customer, Rate is $1,100 USD. Send payment immediately.`,
  },

  // 4. Comprehensive Itemized Charges
  itemizedCharges: {
    messageId: "fixed-msg-004@dhl.com",
    from: "rates@dhl.com",
    senderName: "DHL Global Forwarding",
    subject: "Quotation Breakdown: BK-2026-0042",
    body: `Quote Breakdown for BK-2026-0042:
- Ocean Freight: $1,250.00 / 40HC
- Bunker Adjustment Factor (BAF): $180.00 / cntr
- Origin Terminal Handling Charge (OTHC): $145.00
- Destination Terminal Handling Charge (DTHC): $170.00
- Bill of Lading Fee (Doc Fee): $65.00 / BL
- Customs Clearance / Brokerage: $110.00 / shipment
- Inland Drayage / Trucking: $380.00
Quoted Total All-In: $2,300.00 USD`,
  },

  // 5. Currency Parsing Test (EUR)
  euroCurrencyEmail: {
    messageId: "fixed-msg-005@hapag-lloyd.com",
    from: "quotes@hapag-lloyd.com",
    senderName: "Hapag-Lloyd Sales",
    subject: "Rate Offer BK-2026-0042 - EUR Pricing",
    body: `Guten Tag,
For shipment BK-2026-0042:
Ocean Freight: €1.150,00 per box
Bunker Surcharge: EUR 120,00
Total Quoted: 1.270,00 EUR`,
  },

  // 6. European Number Formatting
  europeanNumberFormatting: {
    messageId: "fixed-msg-006@msc.com",
    from: "pricing@msc.com",
    senderName: "MSC Geneva",
    subject: "Quotation MSC-BK-2026-0042",
    body: `Booking ref: BK-2026-0042
Base Freight: 1.450,50 USD
Surcharges: 250,50 USD
Total: 1.701,00 USD`,
  },

  // 7. Range Amount
  rangeAmountEmail: {
    messageId: "fixed-msg-007@forwarder.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "Estimated rate for BK-2026-0042",
    body: `Hi team,
Ocean freight for BK-2026-0042 is expected between $1,200 - $1,450 USD depending on vessel departure.
THC: $150 USD`,
  },

  // 8. Missing Charge Amount
  missingAmountEmail: {
    messageId: "fixed-msg-008@forwarder.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "Rate for BK-2026-0042",
    body: `Booking: BK-2026-0042
Ocean Freight: Subject to confirmation
BAF: At carrier tariff on date of departure
Origin THC: $150 USD`,
  },

  // 9. Quoted Total Explicit
  quotedTotalExplicit: {
    messageId: "fixed-msg-009@maersk.com",
    from: "oceanquotes@maersk.com",
    senderName: "Maersk Line",
    subject: "All-in Quote for BK-2026-0042",
    body: `Booking Ref: BK-2026-0042
Ocean Freight: $1,500
All-in Total Quoted: $1,850 USD
Valid to: 2026-11-30`,
  },

  // 10. Calculated Total Exact
  calculatedTotalItemized: {
    messageId: "fixed-msg-010@apexmaritime.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "Itemized Quote BK-2026-0042",
    body: `Ref: BK-2026-0042
Ocean Freight: $1,200 USD
Bunker: $200 USD
Origin THC: $150 USD
Documentation: $75 USD`,
  },

  // 11. Total Conflict (Quoted vs Calculated Discrepancy)
  totalConflictEmail: {
    messageId: "fixed-msg-011@forwarder.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "Quotation with Conflict for BK-2026-0042",
    body: `Booking: BK-2026-0042
Ocean Freight: $1,200 USD
Origin THC: $150 USD
Total: $1,900 USD`, // Explicit total is 1900, but sum is 1350! (Conflict = 550)
  },

  // 12. Date Parsing
  datesEmail: {
    messageId: "fixed-msg-012@cma-cgm.com",
    from: "j.smith.apac@cma-cgm.com",
    senderName: "CMA CGM",
    subject: "Schedule & Rates BK-2026-0042",
    body: `Ref: BK-2026-0042
Rate: $1,400 USD
ETD / Departure Date: 2026-10-25
ETA / Arrival: 2026-11-12
Quote Validity: 15-Nov-2026`,
  },

  // 13. No Quote / Decline
  noQuoteEmail: {
    messageId: "fixed-msg-013@one-line.com",
    from: "quotes@one-line.com",
    senderName: "Ocean Network Express (ONE)",
    subject: "RE: Rate Request BK-2026-0042",
    body: `Dear Customer,
Thank you for your inquiry for booking BK-2026-0042.
Unfortunately, our vessels are fully booked on this lane and we have no space available.
We regret we cannot offer a rate at this time.`,
  },

  // 14. Clarification Needed
  clarificationEmail: {
    messageId: "fixed-msg-014@evergreen.com",
    from: "rates@evergreen-marine.com",
    senderName: "Evergreen Line",
    subject: "Inquiry clarification for BK-2026-0042",
    body: `Dear Logistics Team,
Regarding your inquiry BK-2026-0042:
Please clarify the gross weight per container and HS code before we can provide rates.
Also confirm if cargo is hazardous or non-hazardous.`,
  },

  // 15. Revision Email
  revisionEmail: {
    messageId: "fixed-msg-015@apexmaritime.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "REVISED Quotation: BK-2026-0042",
    body: `Please note revised quotation for booking BK-2026-0042:
Due to carrier general rate increase (GRI), our revised ocean freight is $1,550 USD (previously $1,400).
Origin THC: $150 USD
Total: $1,700 USD`,
  },

  // 16. Duplicate Email
  duplicateEmail: {
    messageId: "fixed-msg-016@apexmaritime.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "Fwd: Rate Quotation for BK-2026-0042",
    body: `Ocean Freight: $1,400 USD for BK-2026-0042. Valid to 2026-11-15.`,
  },

  // 17. Unknown Booking (No Booking Number or Unrecognized)
  unknownBookingEmail: {
    messageId: "fixed-msg-017@forwarder.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "General Spot Freight Rates Asia to Middle East",
    body: `Hi Team,
Spot ocean freight rate is $1,300 USD per 40HC for shipments next week.
No booking number specified in this message.`,
  },

  // 18. Unknown Forwarder (Unregistered Sender Domain)
  unknownForwarderEmail: {
    messageId: "fixed-msg-018@random-logistics-398.biz",
    from: "sales@random-logistics-398.biz",
    senderName: "Unknown Broker Inc",
    subject: "Quotation for BK-2026-0042",
    body: `Dear Sirs,
We offer $1,220 USD ocean freight for booking BK-2026-0042.`,
  },

  // 19. Unreadable Attachment (Image Scan without text)
  unreadableAttachmentEmail: {
    messageId: "fixed-msg-019@forwarder.com",
    from: "pricing@apexmaritime.com",
    senderName: "Apex Maritime",
    subject: "Scanned Rate Sheet for BK-2026-0042",
    body: `Please see attached scanned image for rates on BK-2026-0042.`,
    attachments: [
      {
        filename: "scan_quote_img_001.png",
        contentType: "image/png",
        size: 54200,
        content: Buffer.from("simulated png binary data"),
      },
    ],
  },
};

// ============================================================================
// FORWARDER MASTER DIRECTORY FOR DETERMINISTIC TESTS
// ============================================================================

export const TEST_FORWARDER_MASTER: ForwarderMasterRecord[] = [
  {
    id: "fwd-apex-01",
    name: "Apex Maritime",
    company_name: "Apex Maritime Co Ltd",
    email: "pricing@apexmaritime.com",
    contactEmail: "ops@apexmaritime.com",
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
    notes: "Registered corporate domain: maersk.com",
  },
  {
    id: "fwd-cma-03",
    name: "CMA CGM",
    company_name: "CMA CGM Group",
    email: "rates@cma-cgm.com",
    contactEmail: "pricing.me@cma-cgm.com",
    website: "https://www.cma-cgm.com",
    notes: "Registered corporate domain: cma-cgm.com",
  },
  {
    id: "fwd-dhl-04",
    name: "DHL Global Forwarding",
    company_name: "DHL Global Forwarding",
    email: "rates@dhl.com",
    contactEmail: "ocean@dhl.com",
    website: "https://dhl.com",
    notes: "Registered corporate domain: dhl.com",
  },
];

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runCompleteQuotationSuite() {
  console.log("================================================================================");
  console.log("🧪 EXECUTING 21 DETERMINISTIC QUOTATION VERIFICATION SUITES (ZERO AI CALLS)");
  console.log("================================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      console.log(`  ✓ ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAILED: ${testName} ${detail ? `(${detail})` : ""}`);
      throw new Error(`Test assertion failed: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // 1. BOOKING NUMBER EXTRACTION
  // --------------------------------------------------------------------------
  console.log("--- 1. BOOKING NUMBER EXTRACTION ---");
  const bkOrder1 = extractBookingNumberStrictOrder({
    subject: FIXED_TEST_EMAILS.standardBookingSubject.subject,
    body: FIXED_TEST_EMAILS.standardBookingSubject.body,
  });
  assert(
    bkOrder1.detectedBookingNumbers.length > 0,
    "1.1 Extracts booking number from subject/body",
  );
  assert(bkOrder1.canonicalBookingNumber === "BK-2026-0042", "1.2 Extracts canonical BK-2026-0042");
  assert(bkOrder1.foundIn === "SUBJECT", "1.3 Identifies foundIn location as SUBJECT");

  const normalizedBk = normalizeBookingNumber("booking # bk-2026-0042");
  assert(normalizedBk === "BK-2026-0042", "1.4 Normalizes booking number format");

  const bodyOnlyOrder = extractBookingNumberStrictOrder({
    subject: "Rate Quote Inquiry",
    body: "Please see quote for MOV-2026-1029.",
  });
  assert(
    bodyOnlyOrder.canonicalBookingNumber === "MOV-2026-1029",
    "1.5 Extracts booking number from body text",
  );
  assert(bodyOnlyOrder.foundIn === "BODY", "1.6 Identifies foundIn location as BODY");

  // --------------------------------------------------------------------------
  // 2. MULTIPLE BOOKING NUMBER DETECTION
  // --------------------------------------------------------------------------
  console.log("\n--- 2. MULTIPLE BOOKING NUMBER DETECTION ---");
  const multiBkOrder = extractBookingNumberStrictOrder({
    subject: FIXED_TEST_EMAILS.multipleBookings.subject,
    body: FIXED_TEST_EMAILS.multipleBookings.body,
  });
  assert(
    multiBkOrder.detectedBookingNumbers.length >= 2,
    "2.1 Detects multiple distinct booking numbers",
  );
  assert(
    multiBkOrder.detectedBookingNumbers.includes("BK-2026-0042"),
    "2.2 Detects first booking BK-2026-0042",
  );
  assert(
    multiBkOrder.detectedBookingNumbers.includes("BK-2026-0088"),
    "2.3 Detects second booking BK-2026-0088",
  );
  assert(multiBkOrder.isAmbiguous === true, "2.4 Flags multiple bookings as ambiguous");

  const multiBkValidation = validateExtractedQuotation(
    { oceanFreight: 1350 } as DeterministicQuotationFields,
    {
      isSenderVerified: true,
      isBookingMatched: true,
      detectedBookingNumbers: multiBkOrder.detectedBookingNumbers,
    },
  );
  assert(multiBkValidation.needsReview === true, "2.5 Multiple bookings trigger needsReview");
  assert(
    multiBkValidation.deterministicStatuses.includes("ambiguous"),
    "2.6 Multiple bookings assign 'ambiguous' status",
  );

  // --------------------------------------------------------------------------
  // 3. FORWARDER EMAIL MATCHING
  // --------------------------------------------------------------------------
  console.log("\n--- 3. FORWARDER EMAIL MATCHING ---");
  // 3a. Exact match
  const matchExact = matchSenderWithForwarderMaster(
    "pricing@apexmaritime.com",
    TEST_FORWARDER_MASTER,
  );
  assert(matchExact.isMatched === true, "3.1 Exact sender email matched");
  assert(matchExact.forwarderId === "fwd-apex-01", "3.2 Matched forwarder is Apex");

  // 3b. Contact email match
  const matchContact = matchSenderWithForwarderMaster(
    "ops@apexmaritime.com",
    TEST_FORWARDER_MASTER,
  );
  assert(matchContact.isMatched === true, "3.3 Contact email matched");

  // 3c. Registered domain match
  const matchDomain = matchSenderWithForwarderMaster(
    FIXED_TEST_EMAILS.registeredDomainSender.from,
    TEST_FORWARDER_MASTER,
  );
  assert(matchDomain.isMatched === true, "3.4 Registered corporate domain matched");
  assert(matchDomain.forwarderId === "fwd-cma-03", "3.5 Matched forwarder is CMA CGM");

  // 3d. Display name disregard (Phishing / Unverified sender)
  const matchSpoofed = matchSenderWithForwarderMaster(
    FIXED_TEST_EMAILS.spoofedSender.from,
    TEST_FORWARDER_MASTER,
    { senderDisplayName: FIXED_TEST_EMAILS.spoofedSender.senderName },
  );
  assert(matchSpoofed.isMatched === false, "3.6 Disregards spoofed display name");
  assert(matchSpoofed.isForwarderUnknown === true, "3.7 Flags unknown sender for review");
  assert(matchSpoofed.needsReview === true, "3.8 Unknown sender requires human review");

  // --------------------------------------------------------------------------
  // 4. CHARGE KEYWORD MATCHING
  // --------------------------------------------------------------------------
  console.log("\n--- 4. CHARGE KEYWORD MATCHING ---");
  const extractedCharges = extractQuotationFieldsDeterministic(
    FIXED_TEST_EMAILS.itemizedCharges.subject,
    FIXED_TEST_EMAILS.itemizedCharges.body,
  );
  assert(extractedCharges.oceanFreight === 1250, "4.1 Extracts Ocean Freight ($1,250)");
  assert(
    extractedCharges.otherCharges === 180 || extractedCharges.originCharges === 180,
    "4.2 Extracts BAF / Surcharges ($180)",
  );
  assert(
    extractedCharges.thc === 145 || extractedCharges.thc === 170,
    "4.3 Extracts Terminal Handling Charge ($145 or $170)",
  );
  assert(
    extractedCharges.documentationCharges === 65,
    "4.4 Extracts Doc Fee / Bill of Lading Fee ($65)",
  );
  assert(
    extractedCharges.customsCharges === 110,
    "4.5 Extracts Customs Clearance / Brokerage ($110)",
  );
  assert(extractedCharges.truckingCharges === 380, "4.6 Extracts Drayage / Trucking ($380)");

  // --------------------------------------------------------------------------
  // 5. CURRENCY PARSING
  // --------------------------------------------------------------------------
  console.log("\n--- 5. CURRENCY PARSING ---");
  const currUsd = extractExplicitCurrency("$1,400 USD");
  assert(currUsd === "USD", "5.1 Parses USD currency");

  const currEur = extractExplicitCurrency("€1.250 EUR");
  assert(currEur === "EUR", "5.2 Parses EUR currency");

  const currGbp = extractExplicitCurrency("£950 GBP");
  assert(currGbp === "GBP", "5.3 Parses GBP currency");

  const currAed = extractExplicitCurrency("5,200 AED");
  assert(currAed === "AED", "5.4 Parses AED currency");

  // --------------------------------------------------------------------------
  // 6. AMOUNT PARSING
  // --------------------------------------------------------------------------
  console.log("\n--- 6. AMOUNT PARSING ---");
  const amtUs = parseChargeAmountDetails("$1,250.50", "Ocean Freight: $1,250.50 USD");
  assert(amtUs.amount === 1250.5, "6.1 Parses US formatted amount ($1,250.50)");

  const amtEu = parseChargeAmountDetails("1.450,50 EUR", "Freight: 1.450,50 EUR");
  assert(amtEu.amount === 1450.5, "6.2 Parses European comma formatted amount (1.450,50)");

  const amtPlain = parseChargeAmountDetails("1800", "Total: 1800 USD");
  assert(amtPlain.amount === 1800, "6.3 Parses integer amount (1800)");

  // --------------------------------------------------------------------------
  // 7. RANGE AMOUNT HANDLING
  // --------------------------------------------------------------------------
  console.log("\n--- 7. RANGE AMOUNT HANDLING ---");
  const rangeCharges = extractChargesAndTotals(FIXED_TEST_EMAILS.rangeAmountEmail.body);
  assert(rangeCharges.hasRange === true, "7.1 Identifies price range ($1,200 - $1,450)");

  const rangeValidation = validateExtractedQuotation(
    { oceanFreight: 1200, hasRange: true } as DeterministicQuotationFields,
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(rangeValidation.needsReview === true, "7.2 Range amount triggers needsReview");
  assert(
    rangeValidation.deterministicStatuses.includes("range"),
    "7.3 Range amount assigns 'range' status",
  );

  // --------------------------------------------------------------------------
  // 8. MISSING AMOUNT HANDLING
  // --------------------------------------------------------------------------
  console.log("\n--- 8. MISSING AMOUNT HANDLING ---");
  const missingValidation = validateExtractedQuotation(
    {
      oceanFreight: null,
      chargeAmountMissing: true,
    } as DeterministicQuotationFields,
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(missingValidation.needsReview === true, "8.1 Missing amount triggers needsReview");
  assert(
    missingValidation.deterministicStatuses.includes("amount_missing"),
    "8.2 Missing amount assigns 'amount_missing' status",
  );

  // --------------------------------------------------------------------------
  // 9. QUOTED TOTAL EXTRACTION
  // --------------------------------------------------------------------------
  console.log("\n--- 9. QUOTED TOTAL EXTRACTION ---");
  const quotedTotalRes = extractChargesAndTotals(FIXED_TEST_EMAILS.quotedTotalExplicit.body);
  assert(quotedTotalRes.quotedTotal === 1850, "9.1 Extracts explicit quoted total ($1,850)");

  // --------------------------------------------------------------------------
  // 10. CALCULATED TOTAL
  // --------------------------------------------------------------------------
  console.log("\n--- 10. CALCULATED TOTAL ---");
  const calculatedRes = extractChargesAndTotals(FIXED_TEST_EMAILS.calculatedTotalItemized.body);
  // $1,200 + $200 + $150 + $75 = $1,625
  assert(
    calculatedRes.calculatedTotal === 1625,
    "10.1 Mathematically calculates exact total ($1,625)",
  );

  // --------------------------------------------------------------------------
  // 11. TOTAL CONFLICT
  // --------------------------------------------------------------------------
  console.log("\n--- 11. TOTAL CONFLICT ---");
  const conflictCharges = extractChargesAndTotals(FIXED_TEST_EMAILS.totalConflictEmail.body);
  // Stated total is 1900, sum is 1350 -> conflict discrepancy of 550
  assert(
    conflictCharges.hasDiscrepancy === true || conflictCharges.totals.hasDiscrepancy === true,
    "11.1 Flags conflict between quoted and calculated",
  );

  const conflictValidation = validateExtractedQuotation(
    {
      oceanFreight: 1200,
      thc: 150,
      quotedTotal: 1900,
      calculatedTotal: 1350,
      totalConflict: true,
    } as DeterministicQuotationFields,
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(conflictValidation.needsReview === true, "11.2 Total conflict triggers needsReview");
  assert(
    conflictValidation.deterministicStatuses.includes("conflict"),
    "11.3 Total conflict assigns 'conflict' status",
  );

  // --------------------------------------------------------------------------
  // 12. DATE PARSING
  // --------------------------------------------------------------------------
  console.log("\n--- 12. DATE PARSING ---");
  const parsedDates = extractDatesFromText(FIXED_TEST_EMAILS.datesEmail.body);
  assert(parsedDates.etd === "2026-10-25", "12.1 Extracts and formats ETD (2026-10-25)");
  assert(parsedDates.eta === "2026-11-12", "12.2 Extracts and formats ETA (2026-11-12)");
  assert(
    parsedDates.validityDate === "2026-11-15",
    "12.3 Extracts and formats Quote Validity (2026-11-15)",
  );

  const directDate = parseDateDeterministic("25/10/2026");
  assert(directDate.isoDate === "2026-10-25", "12.4 Parses DD/MM/YYYY dates");

  // --------------------------------------------------------------------------
  // 13. NO QUOTE DETECTION
  // --------------------------------------------------------------------------
  console.log("\n--- 13. NO QUOTE DETECTION ---");
  const noQuoteClass = classifyQuotationMessage(
    FIXED_TEST_EMAILS.noQuoteEmail.subject,
    FIXED_TEST_EMAILS.noQuoteEmail.body,
  );
  assert(
    noQuoteClass.category === "no_quote" || noQuoteClass.isNoQuote === true,
    "13.1 Classifies decline email as no_quote category",
  );
  assert(noQuoteClass.isNoQuote === true, "13.2 Sets isNoQuote flag true");

  // --------------------------------------------------------------------------
  // 14. CLARIFICATION DETECTION
  // --------------------------------------------------------------------------
  console.log("\n--- 14. CLARIFICATION DETECTION ---");
  const clarifClass = classifyQuotationMessage(
    FIXED_TEST_EMAILS.clarificationEmail.subject,
    FIXED_TEST_EMAILS.clarificationEmail.body,
  );
  assert(
    clarifClass.category === "clarification_required" ||
      clarifClass.isClarificationRequired === true,
    "14.1 Classifies question as clarification_required",
  );
  assert(
    clarifClass.isClarificationRequired === true,
    "14.2 Sets isClarificationRequired flag true",
  );

  // --------------------------------------------------------------------------
  // 15. REVISION DETECTION
  // --------------------------------------------------------------------------
  console.log("\n--- 15. REVISION DETECTION ---");
  const revisionClass = classifyQuotationMessage(
    FIXED_TEST_EMAILS.revisionEmail.subject,
    FIXED_TEST_EMAILS.revisionEmail.body,
  );
  assert(
    revisionClass.category === "revision" || revisionClass.isRevision === true,
    "15.1 Classifies rate update as revision",
  );
  assert(revisionClass.isRevision === true, "15.2 Sets isRevision flag true");

  // --------------------------------------------------------------------------
  // 16. DUPLICATE MESSAGE HANDLING
  // --------------------------------------------------------------------------
  console.log("\n--- 16. DUPLICATE MESSAGE HANDLING ---");
  const dupQuoteId = "fixed-quote-dup-101";
  setInMemoryQuotation(dupQuoteId, {
    id: dupQuoteId,
    booking_id: "BK-2026-0042",
    forwarder_id: "fwd-apex-01",
    status: "received",
    total_amount: 1400,
    currency: "USD",
  });

  const dupReq = new Request(`http://localhost:3000/api/quotations/${dupQuoteId}/mark-duplicate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const dupUrl = new URL(dupReq.url);
  const dupRes = await handleQuotationsApiRequest(dupReq, dupUrl);
  assert(dupRes?.status === 200, "16.1 Marks duplicate quotation via API");
  const dupJson = await dupRes?.json();
  assert(dupJson?.status === "duplicate", "16.2 Status updated to 'duplicate'");

  // --------------------------------------------------------------------------
  // 17. UNKNOWN BOOKING HANDLING
  // --------------------------------------------------------------------------
  console.log("\n--- 17. UNKNOWN BOOKING HANDLING ---");
  const unkBkOrder = extractBookingNumberStrictOrder({
    subject: FIXED_TEST_EMAILS.unknownBookingEmail.subject,
    body: FIXED_TEST_EMAILS.unknownBookingEmail.body,
  });
  assert(
    unkBkOrder.detectedBookingNumbers.length === 0,
    "17.1 No booking number detected in unknown email",
  );

  const unkValidation = validateExtractedQuotation(
    { oceanFreight: 1300 } as DeterministicQuotationFields,
    {
      isSenderVerified: true,
      isBookingMatched: false,
      detectedBookingNumbers: [],
    },
  );
  assert(unkValidation.needsReview === true, "17.2 Unknown booking triggers needsReview");
  assert(
    unkValidation.deterministicStatuses.includes("unmatched"),
    "17.3 Unknown booking assigns 'unmatched' status",
  );

  // --------------------------------------------------------------------------
  // 18. UNKNOWN FORWARDER HANDLING
  // --------------------------------------------------------------------------
  console.log("\n--- 18. UNKNOWN FORWARDER HANDLING ---");
  const unkFwdMatch = matchSenderWithForwarderMaster(
    FIXED_TEST_EMAILS.unknownForwarderEmail.from,
    TEST_FORWARDER_MASTER,
  );
  assert(unkFwdMatch.isMatched === false, "18.1 Unregistered domain forwarder not matched");
  assert(unkFwdMatch.isForwarderUnknown === true, "18.2 Marked as isForwarderUnknown = true");
  assert(unkFwdMatch.needsReview === true, "18.3 Flags unknown forwarder for review");

  const unkFwdValidation = validateExtractedQuotation(
    { oceanFreight: 1220 } as DeterministicQuotationFields,
    {
      isSenderVerified: false,
      isForwarderUnknown: true,
      isBookingMatched: true,
    },
  );
  assert(unkFwdValidation.needsReview === true, "18.3 Unknown forwarder triggers needsReview");
  assert(
    unkFwdValidation.deterministicStatuses.includes("needs_review"),
    "18.4 Unknown forwarder routed to needs_review queue",
  );

  // --------------------------------------------------------------------------
  // 19. UNREADABLE ATTACHMENT HANDLING
  // --------------------------------------------------------------------------
  console.log("\n--- 19. UNREADABLE ATTACHMENT HANDLING ---");
  const attData = FIXED_TEST_EMAILS.unreadableAttachmentEmail.attachments![0];
  const processedAtt = await processAttachmentDeterministically(attData);
  assert(
    processedAtt.isReadable === false,
    "19.1 Binary image without digital text flagged as isReadable = false",
  );
  assert(
    processedAtt.requiresManualReview === true,
    "19.2 Binary image attachment requires manual human review",
  );

  const unreadableValidation = validateExtractedQuotation(
    {
      oceanFreight: null,
      attachmentUnreadable: true,
    } as DeterministicQuotationFields,
    { isSenderVerified: true, isBookingMatched: true },
  );
  assert(
    unreadableValidation.needsReview === true,
    "19.2 Unreadable attachment triggers needsReview",
  );
  assert(
    unreadableValidation.deterministicStatuses.includes("unreadable"),
    "19.3 Assigns 'unreadable' status",
  );

  // --------------------------------------------------------------------------
  // 20. MANUAL LINK TO BOOKING
  // --------------------------------------------------------------------------
  console.log("\n--- 20. MANUAL LINK TO BOOKING ---");
  const orphanEmailId = "email-orphan-to-link-2026";
  setInMemoryIncomingEmail(orphanEmailId, {
    id: orphanEmailId,
    message_id: "orphan-msg@domain.com",
    from_email: "pricing@apexmaritime.com",
    subject: "Rate without booking in subject",
    body_text: "Ocean Freight: $1,400 USD for shipping container.",
    booking_id: null,
    processing_status: "unmatched",
  });

  const linkReq = new Request(
    `http://localhost:3000/api/incoming-emails/${orphanEmailId}/link-booking`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId: "BK-2026-0042",
        reprocessQuotation: true,
      }),
    },
  );
  const linkUrl = new URL(linkReq.url);
  const linkRes = await handleQuotationsApiRequest(linkReq, linkUrl);
  assert(linkRes?.status === 200, "20.1 Manual link endpoint returns 200");
  const linkJson = await linkRes?.json();
  assert(linkJson?.linked === true, "20.2 Email marked as linked");
  assert(linkJson?.bookingId === "BK-2026-0042", "20.3 Target booking associated");

  // --------------------------------------------------------------------------
  // 21. REQUEST CARD QUOTATION DISPLAY
  // --------------------------------------------------------------------------
  console.log("\n--- 21. REQUEST CARD QUOTATION DISPLAY ---");
  const testBookingRequest: ForwarderBookingRequest = {
    id: "req-card-test-001",
    bookingReference: "BK-2026-0042",
    movementNumber: "MOV-2026-4242",
    priority: "High",
    status: "Rate Verification",
    polCode: "CNSHA",
    polName: "Shanghai",
    podCode: "AEJEA",
    podName: "Jebel Ali",
    requestedEtd: "2026-10-20",
    buyerName: "Al-Futtaim Retail",
    supplierName: "Shanghai Global Fabrics",
    containerCount: 2,
    containerSize: "40HC",
    containerType: "High Cube",
    totalFreight: 1500,
    currency: "USD",
    createdDate: "2026-10-01",
  };

  const sampleForwarderOffers: ForwarderQuoteRequestRecord[] = [
    {
      id: "fwd-quote-01",
      bookingId: "BK-2026-0042",
      forwarderId: "fwd-apex-01",
      forwarderName: "Apex Maritime",
      status: "OFFER_RECEIVED",
      ratePerContainer: 1250,
      currency: "USD",
      offerData: {
        ratePerContainer: 1250,
        currency: "USD",
        transitTimeDays: 16,
      },
    },
    {
      id: "fwd-quote-02",
      bookingId: "BK-2026-0042",
      forwarderId: "fwd-maersk-02",
      forwarderName: "Maersk Line",
      status: "OFFER_RECEIVED",
      ratePerContainer: 1380,
      currency: "USD",
      offerData: {
        ratePerContainer: 1380,
        currency: "USD",
        transitTimeDays: 14,
      },
    },
    {
      id: "fwd-quote-03",
      bookingId: "BK-2026-0042",
      forwarderId: "fwd-cma-03",
      forwarderName: "CMA CGM",
      status: "AWAITING_OFFER",
    },
  ];

  const cardSummary = getBookingForwarderSummary("BK-2026-0042", sampleForwarderOffers);
  assert(cardSummary.totalForwarders === 3, "21.1 Card displays total forwarders count = 3");
  assert(
    cardSummary.quotationsReceived === 0,
    "21.2 Card hides auto-extracted quotations on active requests (count = 0)",
  );
  assert(
    cardSummary.pendingReplies === 3,
    "21.3 Card maintains status as pending reply until user manually updates (pending = 3)",
  );
  assert(
    cardSummary.bestRate === undefined,
    "21.4 Does not display auto-extracted best quotation rate on active card",
  );
  assert(
    cardSummary.overallStatus === "AWAITING_QUOTES",
    "21.5 Computes overall card badge status 'AWAITING_QUOTES' without auto-extracted OFFERS_RECEIVED",
  );

  console.log("\n================================================================================");
  console.log(`📊 ALL ${passedTests} OF ${totalTests} TESTS PASSED WITH 100% ACCURACY!`);
  console.log("================================================================================\n");
}

runCompleteQuotationSuite().catch((err) => {
  console.error("Test execution failed with error:", err);
  process.exit(1);
});
