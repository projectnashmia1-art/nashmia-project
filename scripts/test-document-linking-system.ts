import { supabase } from "../src/lib/supabase";
import { fetchMovementDocuments } from "../src/lib/movement-document-service";

async function runDocumentLinkingTests() {
  console.log("================================================================================");
  console.log("🧪 EXECUTING DOCUMENT UPLOAD & MOVEMENT LINKING VERIFICATION SUITE");
  console.log("================================================================================");

  const testMovement = "NASH-BK-2026-6093";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dbUntyped = supabase as any;

  // 1. Ensure target booking NASH-BK-2026-6093 exists
  let { data: booking6093 } = await dbUntyped
    .from("bookings")
    .select("id, movement_number, booking_reference")
    .eq("movement_number", testMovement)
    .maybeSingle();

  if (!booking6093) {
    const { data: sample } = await dbUntyped.from("bookings").select("user_id").limit(1).single();
    const { data: created } = await dbUntyped
      .from("bookings")
      .insert({
        user_id: sample?.user_id,
        movement_number: testMovement,
        booking_reference: testMovement,
        status: "Confirmed",
        origin: "Felixstowe Port",
        destination: "Karachi Port",
        product_description: "General Verified Cargo",
      })
      .select("id, movement_number, booking_reference")
      .single();
    booking6093 = created;
  }

  console.log(`✓ 1. Target movement verified: ${testMovement} (ID: ${booking6093.id})`);

  // 2. Ensure unassigned system booking exists
  let { data: unassignedB } = await dbUntyped
    .from("bookings")
    .select("id, movement_number")
    .eq("movement_number", "UNASSIGNED")
    .maybeSingle();

  if (!unassignedB) {
    const { data: sample } = await dbUntyped.from("bookings").select("user_id").limit(1).single();
    const { data: created } = await dbUntyped
      .from("bookings")
      .insert({
        user_id: sample?.user_id,
        movement_number: "UNASSIGNED",
        booking_reference: "UNASSIGNED",
        status: "Draft",
        origin: "Unassigned",
        destination: "Unassigned",
        product_description: "Unassigned Document Storage",
      })
      .select("id, movement_number")
      .single();
    unassignedB = created;
  }

  console.log(`✓ 2. Unassigned system booking verified: ${unassignedB.movement_number} (ID: ${unassignedB.id})`);

  // 3. Test Direct Document Creation Linked to Movement NASH-BK-2026-6093
  const testDocName = `Official_BOL_${Date.now()}.pdf`;
  const { data: insertedLinkedDoc, error: insErr } = await dbUntyped
    .from("booking_documents")
    .insert({
      booking_id: booking6093.id,
      document_type: "BILL_OF_LADING",
      document_name: testDocName,
      file_url: `/api/documents/download?path=${encodeURIComponent(`movements/${testMovement}/${testDocName}`)}`,
      file_size: 1048576,
      mime_type: "application/pdf",
      status: "Verified",
    })
    .select()
    .single();

  if (insErr || !insertedLinkedDoc) {
    console.error("❌ Failed to insert linked document:", insErr);
    process.exit(1);
  }

  console.log(`✓ 3. Created linked document: "${insertedLinkedDoc.document_name}" (Doc ID: ${insertedLinkedDoc.id})`);

  // 4. Verify fetchMovementDocuments finds the linked document
  const retrievedDocs = await fetchMovementDocuments({ movementRef: testMovement });
  const foundLinked = retrievedDocs.find((d) => d.id === insertedLinkedDoc.id);

  if (!foundLinked) {
    console.error(`❌ Document ${insertedLinkedDoc.id} not returned by fetchMovementDocuments for ${testMovement}!`);
    process.exit(1);
  }

  console.log(`✓ 4. fetchMovementDocuments successfully retrieved linked document for ${testMovement}:`);
  console.log(`     - Name: ${foundLinked.documentName}`);
  console.log(`     - Display Type: ${foundLinked.displayType}`);
  console.log(`     - File Size: ${foundLinked.fileSizeFormatted}`);
  console.log(`     - Status: ${foundLinked.status}`);

  // 5. Test Unassigned Document Creation
  const testUnassignedName = `Unassigned_Invoice_${Date.now()}.pdf`;
  const { data: insertedUnassignedDoc, error: unassignedErr } = await dbUntyped
    .from("booking_documents")
    .insert({
      booking_id: unassignedB.id,
      document_type: "COMMERCIAL_INVOICE",
      document_name: testUnassignedName,
      file_url: `/api/documents/download?path=${encodeURIComponent(`movements/UNASSIGNED/${testUnassignedName}`)}`,
      file_size: 524288,
      mime_type: "application/pdf",
      status: "Unassigned",
    })
    .select()
    .single();

  if (unassignedErr || !insertedUnassignedDoc) {
    console.error("❌ Failed to insert unassigned document:", unassignedErr);
    process.exit(1);
  }

  console.log(`✓ 5. Created unassigned document: "${insertedUnassignedDoc.document_name}" (Status: ${insertedUnassignedDoc.status})`);

  // 6. Verify fetchMovementDocuments for NASH-BK-2026-6093 does NOT contain unassigned document
  const checkDocsBeforeLink = await fetchMovementDocuments({ movementRef: testMovement });
  const foundUnassignedErroneously = checkDocsBeforeLink.find((d) => d.id === insertedUnassignedDoc.id);
  if (foundUnassignedErroneously) {
    console.error("❌ Unassigned document leaked into movement documents before linking!");
    process.exit(1);
  }
  console.log(`✓ 6. Verified unassigned document is isolated and does not leak into ${testMovement}`);

  // 7. Test Movement Linking (Associate Unassigned Document to NASH-BK-2026-6093)
  const { data: updatedLinkedDoc, error: linkErr } = await dbUntyped
    .from("booking_documents")
    .update({
      booking_id: booking6093.id,
      status: "Verified",
      updated_at: new Date().toISOString(),
    })
    .eq("id", insertedUnassignedDoc.id)
    .select("*, bookings(id, movement_number, booking_reference)")
    .single();

  if (linkErr || !updatedLinkedDoc) {
    console.error("❌ Failed to link document to movement:", linkErr);
    process.exit(1);
  }

  console.log(`✓ 7. Linked unassigned document to Movement ${updatedLinkedDoc.bookings?.movement_number} (Status: ${updatedLinkedDoc.status})`);

  // 8. Verify fetchMovementDocuments now includes the newly linked document
  const checkDocsAfterLink = await fetchMovementDocuments({ movementRef: testMovement });
  const foundAfterLink = checkDocsAfterLink.find((d) => d.id === insertedUnassignedDoc.id);

  if (!foundAfterLink) {
    console.error(`❌ Newly linked document ${insertedUnassignedDoc.id} not found in movement documents!`);
    process.exit(1);
  }

  console.log(`✓ 8. Verified newly linked document automatically displays under Movement ${testMovement}:`);
  console.log(`     - Name: ${foundAfterLink.documentName}`);
  console.log(`     - Display Type: ${foundAfterLink.displayType}`);

  // Clean up test documents
  await dbUntyped.from("booking_documents").delete().in("id", [insertedLinkedDoc.id, insertedUnassignedDoc.id]);
  console.log("✓ 9. Cleaned up verification records");

  console.log("================================================================================");
  console.log("📊 ALL DOCUMENT UPLOAD & MOVEMENT LINKING TESTS PASSED (100% SUCCESS)!");
  console.log("================================================================================");
}

runDocumentLinkingTests().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
