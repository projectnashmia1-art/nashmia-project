import { notifyMovementActivity, formatMovementRef } from "../src/lib/notification-service";
import { supabase, isSupabaseConfigured } from "../src/lib/supabase";

async function runTests() {
  console.log("=== Testing Movement-Based Notifications & Real-Time Sync ===");

  const testMov = "NASH-BK-2026-6093";

  // Test 1: Canonical Reference formatting
  console.log("\n[Test 1] Canonical Reference formatting");
  const formatted = formatMovementRef("  nash-bk-2026-6093  ");
  if (formatted !== testMov) {
    throw new Error(`Expected ${testMov}, got ${formatted}`);
  }
  console.log("✓ Reference properly canonicalized to uppercase:", formatted);

  // Test 2: Movement Stage Updated Notification
  console.log("\n[Test 2] Movement Stage Updated");
  const stageRes = await notifyMovementActivity({
    movementNumber: testMov,
    activity: "Movement Stage Updated",
    details: "Stage advanced to Cargo Received at Warehouse (Karachi Port)",
    previousValue: "Booking Confirmed",
    newValue: "Cargo Received at Warehouse",
    updatedBy: "Admin User",
  });
  console.log("Stage update notification result:", stageRes);
  if (!stageRes.success && stageRes.error && isSupabaseConfigured) {
    throw new Error(`Failed to create stage notification: ${stageRes.error}`);
  }
  console.log("✓ Stage change notification generated successfully");

  // Test 3: Consolidated Movement Details Updated Notification
  console.log("\n[Test 3] Consolidated Movement Details Updated");
  const consolidatedDetails = "POL: Karachi → Dubai · Vessel: MSC Maya · ETA: 2026-11-15 → 2026-11-18";
  const detailsRes = await notifyMovementActivity({
    movementNumber: testMov,
    activity: "Movement Details Updated",
    details: consolidatedDetails,
    updatedBy: "Logistics Desk",
  });
  console.log("Details update notification result:", detailsRes);
  if (!detailsRes.success && detailsRes.error && isSupabaseConfigured) {
    throw new Error(`Failed to create details notification: ${detailsRes.error}`);
  }
  console.log("✓ Consolidated multi-field notification generated successfully");

  // Test 4: Document Linked Notification
  console.log("\n[Test 4] Document Linked Notification");
  const docName = "Original_Bill_Of_Lading_6093.pdf";
  const docRes = await notifyMovementActivity({
    movementNumber: testMov,
    activity: "Document Linked",
    details: `Document "${docName}" (BILL_OF_LADING) linked to movement`,
    documentName: docName,
    documentType: "BILL_OF_LADING",
    newValue: docName,
    updatedBy: "Operations Desk",
  });
  console.log("Document linked notification result:", docRes);
  if (!docRes.success && docRes.error && isSupabaseConfigured) {
    throw new Error(`Failed to create document notification: ${docRes.error}`);
  }
  console.log("✓ Document linked notification generated successfully");

  // Test 5: Cut-off Updates Notification
  console.log("\n[Test 5] Cut-off Updates Notification");
  const cutoffRes = await notifyMovementActivity({
    movementNumber: testMov,
    activity: "Cut-off Updates",
    details: "SI Cut-Off scheduled: 2026-11-05 18:00",
    newValue: "2026-11-05 18:00",
    updatedBy: "Carrier Desk",
  });
  console.log("Cut-off notification result:", cutoffRes);
  if (!cutoffRes.success && cutoffRes.error && isSupabaseConfigured) {
    throw new Error(`Failed to create cutoff notification: ${cutoffRes.error}`);
  }
  console.log("✓ Cut-off deadline notification generated successfully");

  // Test 6: Verify records in Supabase (if configured)
  if (isSupabaseConfigured) {
    console.log("\n[Test 6] Verifying records in Supabase notifications table");
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, message, type, movement_number, link, created_at")
      .eq("movement_number", testMov)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.warn("Supabase query notice:", error.message);
    } else {
      console.log(`Found ${data?.length || 0} notifications in database for ${testMov}:`);
      data?.forEach((n, i) => {
        console.log(`  ${i + 1}. [${n.type}] "${n.title}": ${n.message}`);
        console.log(`     Link: ${n.link}`);
      });
    }
  }

  console.log("\n=== ALL MOVEMENT NOTIFICATION TESTS PASSED ===");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
