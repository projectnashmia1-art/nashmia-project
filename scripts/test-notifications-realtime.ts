/**
 * Comprehensive End-to-End Realtime & Database Notification Verification Script
 *
 * Verifies:
 * 1. Supabase connectivity & notifications table accessibility
 * 2. All 8 logistics event types can be created and saved without PostgreSQL check constraint violations
 * 3. Correct movement numbers and deep-links are formatted
 * 4. Read/unread status transitions persist in Supabase
 * 5. Deduplication engine skips rapid duplicate emissions
 * 6. Clean removal/cleanup of test notifications
 */

import { supabase, isSupabaseConfigured } from "../src/lib/supabase";
import {
  createLogisticsNotification,
  type LogisticsEventType,
} from "../src/lib/notification-service";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Test assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runNotificationsSuite() {
  console.log("================================================================================");
  console.log("🔔 EXECUTING REALTIME & DATABASE NOTIFICATION AUDIT SUITE");
  console.log("================================================================================\n");

  assert(isSupabaseConfigured, "1.1 Supabase client is configured with URL and Anon Key");

  // Step 1: Health check on notifications table
  console.log("\n--- 1. NOTIFICATIONS TABLE CONNECTIVITY ---");
  const { data: initialRows, error: initialErr } = await supabase
    .from("notifications")
    .select("id")
    .limit(1);

  assert(!initialErr, `1.2 Successfully queried public.notifications: ${initialErr?.message || "OK"}`);
  console.log(`  ✓ Table accessible. Initial sample rows found: ${initialRows?.length ?? 0}`);

  // Step 2: Test creation of all 8 core logistics events
  console.log("\n--- 2. LOGISTICS LIFECYCLE EVENT INGESTION ---");
  const testMov = `TEST-MOV-${Math.floor(100000 + Math.random() * 900000)}`;
  const createdIds: string[] = [];

  const testEvents: {
    type: LogisticsEventType;
    params: Parameters<typeof createLogisticsNotification>[0];
    expectedTitleSnippet: string;
  }[] = [
    {
      type: "BOOKING_REQUEST_CREATED",
      params: {
        eventType: "BOOKING_REQUEST_CREATED",
        movementNumber: testMov,
        customerName: "Nordic Retailers AS",
        linkUrl: `/requests?ref=${testMov}&openDrawer=true`,
      },
      expectedTitleSnippet: "Booking Request",
    },
    {
      type: "QUOTATION_RECEIVED",
      params: {
        eventType: "QUOTATION_RECEIVED",
        movementNumber: testMov,
        forwarderName: "Hapag-Lloyd Global",
        rateText: "$1,650 USD",
        linkUrl: `/requests?ref=${testMov}&openDrawer=true`,
      },
      expectedTitleSnippet: "Quote Received",
    },
    {
      type: "OFFER_AWARDED",
      params: {
        eventType: "OFFER_AWARDED",
        movementNumber: testMov,
        forwarderName: "Hapag-Lloyd Global",
        rateText: "$1,650 USD",
        linkUrl: `/requests?ref=${testMov}&openDrawer=true`,
      },
      expectedTitleSnippet: "Forwarder Awarded",
    },
    {
      type: "BOOKING_CONFIRMED",
      params: {
        eventType: "BOOKING_CONFIRMED",
        movementNumber: testMov,
        forwarderName: "Hapag-Lloyd Global",
        rateText: "$1,650 USD",
        linkUrl: `/?ref=${testMov}&openDrawer=true`,
      },
      expectedTitleSnippet: "Booking Confirmed",
    },
    {
      type: "CUTOFF_REMINDER",
      params: {
        eventType: "CUTOFF_REMINDER",
        movementNumber: testMov,
        cutoffType: "Shipping Instructions (SI)",
        cutoffDeadline: "2026-11-02 17:00 UTC",
        linkUrl: `/?ref=${testMov}&openDrawer=true`,
      },
      expectedTitleSnippet: "Cut-Off Reminder",
    },
    {
      type: "DOCUMENT_UPLOADED",
      params: {
        eventType: "DOCUMENT_UPLOADED",
        movementNumber: testMov,
        documentName: "Bill_of_Lading_Original.pdf",
        documentType: "Bill of Lading",
        linkUrl: `/documents?ref=${testMov}`,
      },
      expectedTitleSnippet: "Document Attached",
    },
    {
      type: "ETA_UPDATED",
      params: {
        eventType: "ETA_UPDATED",
        movementNumber: testMov,
        etaDate: "2026-11-18",
        linkUrl: `/?ref=${testMov}&openDrawer=true`,
      },
      expectedTitleSnippet: "ETA Update",
    },
    {
      type: "MOVEMENT_STATUS_CHANGED",
      params: {
        eventType: "MOVEMENT_STATUS_CHANGED",
        movementNumber: testMov,
        statusText: "Vessel Departed Origin Port",
        linkUrl: `/?ref=${testMov}&openDrawer=true`,
      },
      expectedTitleSnippet: "Status Update",
    },
  ];

  for (let i = 0; i < testEvents.length; i++) {
    const ev = testEvents[i];
    const res = await createLogisticsNotification(ev.params);
    assert(res.success === true, `2.${i + 1} Notification created for ${ev.type}`);
    if (res.id) {
      createdIds.push(res.id);
    }
  }

  assert(createdIds.length === testEvents.length, `2.9 All ${testEvents.length} notifications persisted with database IDs`);

  // Step 3: Verification of database fields in Supabase
  console.log("\n--- 3. DATABASE FIELDS & INTEGRITY VERIFICATION ---");
  const { data: insertedRecords, error: fetchErr } = await supabase
    .from("notifications")
    .select("*")
    .in("id", createdIds);

  assert(!fetchErr, `3.1 Re-fetched created records without errors: ${fetchErr?.message || "OK"}`);
  assert(insertedRecords?.length === createdIds.length, `3.2 Exactly ${createdIds.length} records retrieved from Supabase`);

  insertedRecords?.forEach((rec, idx) => {
    assert(Boolean(rec.user_id), `3.3.${idx + 1} user_id is populated: ${rec.user_id}`);
    assert(rec.is_read === false, `3.3.${idx + 1} Initial is_read is false`);
    assert(Boolean(rec.link), `3.3.${idx + 1} Deep link is present: ${rec.link}`);
    assert(rec.title.includes(testMov) || rec.message.includes(testMov), `3.3.${idx + 1} Contains movement number ${testMov}`);
  });

  // Step 4: Mark Notification as Read in Database
  console.log("\n--- 4. READ STATUS PERSISTENCE ---");
  const targetId = createdIds[0];
  const nowIso = new Date().toISOString();

  const { error: markErr } = await supabase
    .from("notifications")
    .update({ is_read: true, read_at: nowIso })
    .eq("id", targetId);

  assert(!markErr, `4.1 Marked notification ${targetId} as read in Supabase`);

  const { data: updatedRec } = await supabase
    .from("notifications")
    .select("is_read, read_at")
    .eq("id", targetId)
    .single();

  assert(updatedRec?.is_read === true, "4.2 Verified is_read persists as true in Supabase");
  assert(Boolean(updatedRec?.read_at), `4.3 Verified read_at timestamp saved: ${updatedRec?.read_at}`);

  // Step 5: Deduplication check
  console.log("\n--- 5. DEDUPLICATION ENGINE VERIFICATION ---");
  const dupResult = await createLogisticsNotification({
    eventType: "BOOKING_REQUEST_CREATED",
    movementNumber: testMov,
    customerName: "Nordic Retailers AS",
  });
  assert(dupResult.success === true, "5.1 Ingestion completed without error for duplicate payload");
  assert(dupResult.id === undefined, "5.2 Deduplication window suppressed secondary database insertion");

  // Step 6: Cleanup test notifications
  console.log("\n--- 6. CLEANUP TEST DATA ---");
  const { error: delErr } = await supabase
    .from("notifications")
    .delete()
    .in("id", createdIds);

  assert(!delErr, `6.1 Cleaned up ${createdIds.length} verification notifications from Supabase`);

  console.log("\n================================================================================");
  console.log("📊 ALL NOTIFICATION AUDIT & PERSISTENCE CHECKS PASSED WITH 100% SUCCESS!");
  console.log("================================================================================\n");
}

runNotificationsSuite().catch((err) => {
  console.error("FATAL ERROR IN SUITE:", err);
  process.exit(1);
});
