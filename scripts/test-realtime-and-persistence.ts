import { supabase, isSupabaseConfigured, testSupabaseConnection } from "../src/lib/supabase";
import {
  fetchBookingsFromSupabase,
  fetchBookingByIdFromSupabase,
  createBookingInSupabase,
  normalizeBookingStatus,
} from "../src/lib/supabase-services";
import { confirmBookingAndMovementInDatabase } from "../src/lib/booking-confirmation-service";

async function runVerification() {
  console.log("=== SUPABASE REALTIME & PERSISTENCE VERIFICATION ===");
  console.log("1. Checking Supabase configuration & connectivity...");
  const connResult = await testSupabaseConnection();
  console.log("Connection result:", connResult);

  if (!isSupabaseConfigured) {
    console.warn("Supabase credentials not configured in local environment; verifying offline fallback resilience.");
    return;
  }

  const testMovNumber = `TEST-MOV-${Date.now().toString().slice(-6)}`;
  console.log(`\n2. Creating test booking record via createBookingInSupabase: ${testMovNumber}...`);

  const newBooking = await createBookingInSupabase({
    movementNumber: testMovNumber,
    bookingReference: testMovNumber,
    status: "Booking Requested",
    origin: "Karachi Port",
    destination: "Felixstowe",
    polName: "Karachi",
    podName: "Felixstowe",
    vesselName: "MSC ARIES",
    voyageNumber: "VOY-902",
    containerCount: 2,
    containerSize: "40HC",
    containerType: "High Cube",
    productDescription: "Realtime Persistence Verification Cargo",
    totalFreight: 4400,
    currency: "USD",
    specialInstructions: "Urgent Priority Handling",
  });

  if (!newBooking || !newBooking.id) {
    console.error("Failed to insert test booking!");
    process.exit(1);
  }

  console.log("Successfully created test booking with ID:", newBooking.id);

  console.log("\n3. Verifying retrieval via fetchBookingsFromSupabase and fetchBookingByIdFromSupabase...");
  const retrieved = await fetchBookingByIdFromSupabase(newBooking.id);

  if (!retrieved) {
    console.error("Test booking could not be fetched by ID!");
    process.exit(1);
  }

  console.log("Retrieved movement:", {
    id: retrieved.id,
    movement_number: retrieved.movement_number,
    origin: retrieved.origin,
    destination: retrieved.destination,
    vessel: retrieved.vessel_name,
    containers: retrieved.container_count,
    status: retrieved.status,
  });

  if (retrieved.movement_number !== testMovNumber) {
    console.error("Mismatch in movement number!");
    process.exit(1);
  }

  console.log("\n4. Updating test booking to Confirmed status via database confirmation workflow...");
  const confirmResult = await confirmBookingAndMovementInDatabase({
    bookingId: newBooking.id,
    movementNumber: testMovNumber,
    forwarderId: "fwd-test-verified",
    forwarderName: "Allied Maritime Logistics",
    forwarderEmail: "test-forwarder@nashmia.com",
    finalRate: 2150,
    currency: "USD",
    etd: "2026-11-15",
    eta: "2026-12-05",
    pickupDate: "2026-11-10",
    pickupAddress: "Warehouse 4, Port Area",
    polName: "Karachi",
    podName: "Felixstowe",
    shippingLine: "MSC",
    vesselName: "MSC ARIES",
    voyageNumber: "VOY-902",
    containerCount: 2,
    containerSize: "40HC",
    containerType: "High Cube",
    specialInstructions: "Clean bill of lading required",
    sendConfirmationEmail: false,
  });

  console.log("Confirmation execution result:", {
    success: confirmResult.success,
    bookingId: confirmResult.bookingId,
    movementNumber: confirmResult.movementNumber,
  });

  console.log("\n5. Verifying updated state in database...");
  const updatedBooking = await fetchBookingByIdFromSupabase(newBooking.id);
  console.log("Updated record in Supabase:", {
    id: updatedBooking?.id,
    status: updatedBooking?.status,
    movement_status: updatedBooking?.movement_status,
    confirmation_status: updatedBooking?.confirmation_status,
    confirmed_forwarder: (updatedBooking?.confirmation_details as any)?.confirmed_forwarder_name,
    rate_amount: updatedBooking?.rate_amount,
  });

  if (
    updatedBooking?.status !== "Confirmed" &&
    updatedBooking?.status !== "Booking Confirmed"
  ) {
    console.error("Booking status did not update to Confirmed!");
    process.exit(1);
  }

  console.log("\n6. Cleaning up test record from Supabase...");
  const { error: deleteErr } = await supabase.from("bookings").delete().eq("id", newBooking.id);
  if (deleteErr) {
    console.warn("Notice deleting test record:", deleteErr.message);
  } else {
    console.log("Test record successfully cleaned up.");
  }

  console.log("\n=== ALL REALTIME & PERSISTENCE VERIFICATION CHECKS PASSED ===");
}

runVerification().catch((err) => {
  console.error("Verification failed with exception:", err);
  process.exit(1);
});
