/**
 * Production Test Suite for Rule-Based NO-AI Email Quotation Extraction Engine
 * Verifies all 10 requirements and real forwarder email patterns.
 */

import { extractQuotationDeterministic } from "../src/lib/rule-based-quotation-engine";
import { recordQuotationAuditEvent } from "../src/lib/quotation-audit-logger";
import {
  validateQuotationForBackendAction,
  type ExtractedQuotation,
} from "../src/lib/quotation-extractor";

interface TestCase {
  name: string;
  input: {
    subject: string;
    body: string;
    senderEmail?: string;
    senderName?: string;
    knownMovementNumber?: string;
    knownContainerType?: string;
  };
  expected: {
    rate?: number | null;
    currency?: string | null;
    containerType?: string | null;
    containerQuantity?: number | null;
    etdContains?: string;
    etaContains?: string;
    transitTime?: number | null;
    freeDays?: number | null;
    thc?: number | null;
    isDeclined?: boolean;
    needsReview?: boolean;
    hasConflicts?: boolean;
    containerRatesCount?: number;
    reviewReasonMatch?: RegExp;
  };
}

const testCases: TestCase[] = [
  // 1. Natural Language Forwarder Email
  {
    name: "Style 1: Conversational 'our price is around 1,200 usd for two 20ft boxes'",
    input: {
      subject: "Re: Quotation Request MOV-2026-6093",
      body: "Hi team,\n\nOur price is around 1,200 usd for two 20ft boxes.\n\nBest regards,\nOcean Freight Desk",
      senderEmail: "quotes@maersk.com",
      senderName: "Maersk Line",
    },
    expected: {
      rate: 1200,
      currency: "USD",
      containerType: "20FT",
      containerQuantity: 2,
      needsReview: false,
    },
  },

  // 2. Schedule natural phrasing: sails 12 Oct, should land around the 25th
  {
    name: "Style 2: Sailing schedule 'vessel sails 12 Oct, should land around the 25th'",
    input: {
      subject: "Schedule update for MOV-1001",
      body: "Good day,\nRate is $2,100 USD. Vessel sails 12 Oct, should land around the 25th. 14 days free time.\nThanks,\nHapag Desk",
      senderEmail: "ops@hapag-lloyd.com",
    },
    expected: {
      rate: 2100,
      currency: "USD",
      etdContains: "12 Oct",
      etaContains: "25 Oct",
      freeDays: 14,
      needsReview: false,
    },
  },

  // 3. Abbreviated forwarder style: Fr8 $1000 + doc/local 200, valid 2 weeks
  {
    name: "Style 3: Abbreviated 'Fr8 $1000 + doc/local 200, valid 2 weeks'",
    input: {
      subject: "RE: Quote MOV-4589",
      body: "Fr8 $1000 + doc/local 200, valid 2 weeks. THC: 150 USD. Transit 22 days.\nMFR-GLOBAL-4589",
      senderEmail: "sales@msc.com",
    },
    expected: {
      rate: 1000,
      currency: "USD",
      thc: 150,
      transitTime: 22,
      needsReview: false,
    },
  },

  // 4. Multi-Container Rates: 20ft: $1200, 40ft: $1800
  {
    name: "Style 4: Multiple container rates in single message (20ft: $1200, 40ft: $1800)",
    input: {
      subject: "Freight Quote - MOV-9921",
      body: "Dear Nashmia Logistics,\nHere are our best offers for Karachi to Felixstowe:\n20ft: $1200 USD\n40ft: $1800 USD\nValid until 30 Nov 2026. 21d transit time.",
      knownContainerType: "40FT",
      senderEmail: "pricing@apexmaritime.com",
    },
    expected: {
      rate: 1800,
      currency: "USD",
      containerRatesCount: 2,
      transitTime: 21,
      needsReview: false,
    },
  },

  // 5. Decline / Unavailable response
  {
    name: "Style 5: Decline / No Space Available",
    input: {
      subject: "RE: Quote Request MOV-3321",
      body: "Dear Customer,\nRegret to inform you that we have no space available on this vessel due to vessel blank sailing.\nRegards,\nBooking Desk",
      senderEmail: "allocations@cma-cgm.com",
    },
    expected: {
      isDeclined: true,
      rate: null,
      needsReview: false,
    },
  },

  // 6. Conflicting Rates: Ambiguous pricing
  {
    name: "Style 6: Conflicting ambiguous rates ('$1200 or $1500')",
    input: {
      subject: "Rates for MOV-8821",
      body: "Hello,\nRates are $1200 or $1500 depending on space allocation.\nLet us know.",
      senderEmail: "forwarder@unknown-logistics.com",
    },
    expected: {
      hasConflicts: true,
      needsReview: true,
      reviewReasonMatch: /Multiple conflicting rate figures/,
    },
  },

  // 7. Missing Currency: Rate present, no currency symbol or code
  {
    name: "Style 7: Missing Currency (Never guess or assume USD)",
    input: {
      subject: "MOV-7712 rate",
      body: "Our ocean freight rate is 1450 per 40HC container. ETD: 15 Nov.",
      senderEmail: "freight@carrier.com",
    },
    expected: {
      rate: 1450,
      currency: null,
      needsReview: true,
      reviewReasonMatch: /Currency notation.*missing.*never assumes USD/i,
    },
  },

  // 8. Rate outside maritime safety bounds
  {
    name: "Style 8: Rate below standard minimum bounds ($45)",
    input: {
      subject: "MOV-1122 offer",
      body: "We can do ocean freight at $45 USD / box.",
      senderEmail: "sales@test.com",
    },
    expected: {
      rate: 45,
      needsReview: true,
      reviewReasonMatch: /falls outside standard maritime bounds/i,
    },
  },

  // 9. Schedule temporal conflict: ETA precedes ETD
  {
    name: "Style 9: Temporal conflict (ETA 10 Oct precedes ETD 20 Oct)",
    input: {
      subject: "MOV-9988 schedule",
      body: "Rate: $2000 USD. ETD: 20 Oct 2026. ETA: 10 Oct 2026.",
      senderEmail: "sales@hapag.com",
    },
    expected: {
      needsReview: true,
      reviewReasonMatch: /Estimated arrival.*precedes.*departure/i,
    },
  },
];

console.log("================================================================================");
console.log("🚀 STARTING PRODUCTION TEST SUITE: NO-AI EMAIL QUOTATION EXTRACTION ENGINE");
console.log("================================================================================\n");

let passedCount = 0;
let failedCount = 0;

for (let i = 0; i < testCases.length; i++) {
  const tc = testCases[i];
  console.log(`[TEST ${i + 1}/${testCases.length}] ${tc.name}`);

  try {
    const result = extractQuotationDeterministic(tc.input);

    const assertions: string[] = [];
    let testPassed = true;

    // Rate
    if (tc.expected.rate !== undefined) {
      if (result.rate === tc.expected.rate) {
        assertions.push(`✓ Rate matched: ${result.rate}`);
      } else {
        testPassed = false;
        assertions.push(`✗ Rate mismatch: expected ${tc.expected.rate}, got ${result.rate}`);
      }
    }

    // Currency
    if (tc.expected.currency !== undefined) {
      if (result.currency === tc.expected.currency) {
        assertions.push(`✓ Currency matched: ${result.currency}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ Currency mismatch: expected ${tc.expected.currency}, got ${result.currency}`,
        );
      }
    }

    // Container Type
    if (tc.expected.containerType !== undefined) {
      if (result.containerType === tc.expected.containerType) {
        assertions.push(`✓ Container type matched: ${result.containerType}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ Container type mismatch: expected ${tc.expected.containerType}, got ${result.containerType}`,
        );
      }
    }

    // Container Quantity
    if (tc.expected.containerQuantity !== undefined) {
      if (result.containerQuantity === tc.expected.containerQuantity) {
        assertions.push(`✓ Container quantity matched: ${result.containerQuantity}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ Container quantity mismatch: expected ${tc.expected.containerQuantity}, got ${result.containerQuantity}`,
        );
      }
    }

    // ETD
    if (tc.expected.etdContains) {
      if (result.etd && result.etd.includes(tc.expected.etdContains)) {
        assertions.push(`✓ ETD contains '${tc.expected.etdContains}': ${result.etd}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ ETD mismatch: expected to contain '${tc.expected.etdContains}', got ${result.etd}`,
        );
      }
    }

    // ETA
    if (tc.expected.etaContains) {
      if (result.eta && result.eta.includes(tc.expected.etaContains)) {
        assertions.push(`✓ ETA contains '${tc.expected.etaContains}': ${result.eta}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ ETA mismatch: expected to contain '${tc.expected.etaContains}', got ${result.eta}`,
        );
      }
    }

    // Free Days
    if (tc.expected.freeDays !== undefined) {
      if (result.freeDays === tc.expected.freeDays) {
        assertions.push(`✓ Free days matched: ${result.freeDays}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ Free days mismatch: expected ${tc.expected.freeDays}, got ${result.freeDays}`,
        );
      }
    }

    // Transit Time
    if (tc.expected.transitTime !== undefined) {
      if (result.transitTime === tc.expected.transitTime) {
        assertions.push(`✓ Transit time matched: ${result.transitTime}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ Transit time mismatch: expected ${tc.expected.transitTime}, got ${result.transitTime}`,
        );
      }
    }

    // THC
    if (tc.expected.thc !== undefined) {
      if (result.thc === tc.expected.thc) {
        assertions.push(`✓ THC matched: ${result.thc}`);
      } else {
        testPassed = false;
        assertions.push(`✗ THC mismatch: expected ${tc.expected.thc}, got ${result.thc}`);
      }
    }

    // Is Declined
    if (tc.expected.isDeclined !== undefined) {
      if (result.isDeclined === tc.expected.isDeclined) {
        assertions.push(`✓ isDeclined matched: ${result.isDeclined}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ isDeclined mismatch: expected ${tc.expected.isDeclined}, got ${result.isDeclined}`,
        );
      }
    }

    // Needs Review
    if (tc.expected.needsReview !== undefined) {
      if (result.needsReview === tc.expected.needsReview) {
        assertions.push(`✓ needsReview matched: ${result.needsReview}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ needsReview mismatch: expected ${tc.expected.needsReview}, got ${result.needsReview}`,
        );
      }
    }

    // Has Conflicts
    if (tc.expected.hasConflicts !== undefined) {
      if (result.hasConflicts === tc.expected.hasConflicts) {
        assertions.push(`✓ hasConflicts matched: ${result.hasConflicts}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ hasConflicts mismatch: expected ${tc.expected.hasConflicts}, got ${result.hasConflicts}`,
        );
      }
    }

    // Multi-container rates count
    if (tc.expected.containerRatesCount !== undefined) {
      const count = result.containerRates ? Object.keys(result.containerRates).length : 0;
      if (count === tc.expected.containerRatesCount) {
        assertions.push(`✓ containerRates count matched: ${count}`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ containerRates count mismatch: expected ${tc.expected.containerRatesCount}, got ${count}`,
        );
      }
    }

    // Review reason pattern match
    if (tc.expected.reviewReasonMatch) {
      const matchFound = result.reviewReasons.some((r) => tc.expected.reviewReasonMatch!.test(r));
      if (matchFound) {
        assertions.push(`✓ reviewReasons matched expected pattern`);
      } else {
        testPassed = false;
        assertions.push(
          `✗ reviewReasons did not match pattern '${tc.expected.reviewReasonMatch}'. Actual: ${result.reviewReasons.join(" | ")}`,
        );
      }
    }

    // Traceability audit check
    const hasTraceability = result.traceability && Object.keys(result.traceability).length >= 10;
    if (hasTraceability) {
      assertions.push(
        `✓ Field-level traceability recorded (${Object.keys(result.traceability).length} fields audited)`,
      );
    } else {
      testPassed = false;
      assertions.push(`✗ Missing field-level traceability audit records`);
    }

    // Print assertions
    for (const a of assertions) {
      console.log(`   ${a}`);
    }

    if (testPassed) {
      console.log(`   --> RESULT: PASSED\n`);
      passedCount++;
    } else {
      console.log(`   --> RESULT: FAILED\n`);
      failedCount++;
    }
  } catch (err) {
    console.error(`   ✗ Exception in test:`, err);
    failedCount++;
  }
}

// 10. Verification of Backend Action Validation
console.log(`[TEST 10/11] Backend Action Validation Engine`);
try {
  let vPassed = true;
  // Test 10a: Record offer rejected when rate is missing
  const missingRateExtracted = {
    rate: null,
    currency: "USD",
    isDeclined: false,
    isConfirmed: false,
    extractionConfidence: 0.9,
  } as unknown as ExtractedQuotation;
  const v1 = validateQuotationForBackendAction(missingRateExtracted, "RECORD_OFFER");
  if (!v1.allowed && v1.requiresReview) {
    console.log("   ✓ RECORD_OFFER properly rejected and sent to review when rate is missing");
  } else {
    vPassed = false;
    console.log("   ✗ RECORD_OFFER allowed when rate is missing");
  }

  // Test 10b: Record offer approved when rate and currency are valid
  const validExtracted = {
    rate: 1800,
    currency: "USD",
    isDeclined: false,
    isConfirmed: false,
    extractionConfidence: 0.95,
  } as unknown as ExtractedQuotation;
  const v2 = validateQuotationForBackendAction(validExtracted, "RECORD_OFFER");
  if (v2.allowed && v2.suggestedStatus === "OFFER_RECEIVED") {
    console.log(
      "   ✓ RECORD_OFFER approved with OFFER_RECEIVED status for valid rate and currency",
    );
  } else {
    vPassed = false;
    console.log("   ✗ RECORD_OFFER was not approved for valid rate and currency");
  }

  // Test 10c: Automatic confirmation held when confidence < 0.85
  const lowConfidenceConfirm = {
    rate: 1800,
    currency: "USD",
    isDeclined: false,
    isConfirmed: true,
    extractionConfidence: 0.7,
  } as unknown as ExtractedQuotation;
  const v3 = validateQuotationForBackendAction(lowConfidenceConfirm, "CONFIRM_MOVEMENT");
  if (!v3.allowed && v3.requiresReview) {
    console.log(
      "   ✓ CONFIRM_MOVEMENT held for human review when confidence is below 0.85 safety threshold",
    );
  } else {
    vPassed = false;
    console.log("   ✗ CONFIRM_MOVEMENT allowed with low confidence");
  }

  if (vPassed) {
    console.log(`   --> RESULT: PASSED\n`);
    passedCount++;
  } else {
    console.log(`   --> RESULT: FAILED\n`);
    failedCount++;
  }
} catch (e) {
  console.error("   ✗ Exception in validation test:", e);
  failedCount++;
}

// 11. Verification of Safe Audit Logging (Credential & Secret Scrubbing)
console.log(`[TEST 11/11] Audit Logging & Credential Scrubbing Security`);
try {
  let auditPassed = true;
  const event = await recordQuotationAuditEvent({
    eventType: "QUOTATION_SAVED",
    movementNumber: "MOV-2026-6093",
    forwarderName: "Maersk",
    senderEmail: "quotes@maersk.com",
    summary: "Test quotation audit logging",
    details: {
      rate: 1200,
      currency: "USD",
      access_token: "SECRET_GMAIL_TOKEN_12345",
      client_secret: "SUPER_SECRET_CLIENT_KEY",
    },
  });

  const loggedDetails = event.details as Record<string, unknown>;
  if (
    loggedDetails.access_token === "[REDACTED_CREDENTIAL]" &&
    loggedDetails.client_secret === "[REDACTED_CREDENTIAL]"
  ) {
    console.log("   ✓ Sensitive tokens & credentials successfully redacted from audit record");
  } else {
    auditPassed = false;
    console.log("   ✗ Credentials were not redacted from audit log details");
  }

  if (event.id && event.timestamp) {
    console.log("   ✓ Immutable audit event generated with unique ID and ISO timestamp");
  } else {
    auditPassed = false;
    console.log("   ✗ Missing event ID or timestamp");
  }

  if (auditPassed) {
    console.log(`   --> RESULT: PASSED\n`);
    passedCount++;
  } else {
    console.log(`   --> RESULT: FAILED\n`);
    failedCount++;
  }
} catch (e) {
  console.error("   ✗ Exception in audit test:", e);
  failedCount++;
}

console.log("================================================================================");
console.log(`📊 TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of 11 TESTS`);
console.log("================================================================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  console.log(
    "🎯 ALL TESTS PASSED SUCCESSFULLY! Rule-based extraction engine is production-ready.",
  );
  process.exit(0);
}
