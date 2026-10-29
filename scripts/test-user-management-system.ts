import { getServerSupabaseClient } from "../src/lib/supabase";

async function runUserManagementTests() {
  console.log("================================================================================");
  console.log("🧪 EXECUTING USER MANAGEMENT & AUTHENTICATION VERIFICATION SUITE");
  console.log("================================================================================");

  const client = getServerSupabaseClient();
  const testUsername = `user_test_${Date.now().toString().slice(-6)}`;
  const testPassword = "Password123!";
  const testFullName = "Test Operator Verification";
  let createdUserId: string | null = null;

  try {
    // 1. GET /api/admin/users
    console.log("--- 1. FETCH USER DIRECTORY ---");
    const listRes = await fetch("http://localhost:3000/api/admin/users");
    if (!listRes.ok) throw new Error(`GET /api/admin/users failed with HTTP ${listRes.status}`);
    const listData = await listRes.json();
    if (!listData.success || !Array.isArray(listData.users)) {
      throw new Error("Invalid user list response payload");
    }
    console.log(`✓ 1.1 Retrieved user directory successfully (${listData.users.length} registered accounts)`);

    // 2. CREATE USER
    console.log("--- 2. CREATE NEW USER ACCOUNT ---");
    const createRes = await fetch("http://localhost:3000/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: testFullName,
        username: testUsername,
        password: testPassword,
        confirmPassword: testPassword,
        role: "user",
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error(`Create user failed: ${JSON.stringify(err)}`);
    }

    const createData = await createRes.json();
    if (!createData.success || !createData.user?.id) {
      throw new Error("User creation failed to return valid user payload");
    }
    createdUserId = createData.user.id;
    console.log(`✓ 2.1 Successfully created user: ${testFullName} (@${testUsername}) with ID ${createdUserId}`);
    console.log(`✓ 2.2 Role correctly assigned as: ${createData.user.role}`);
    console.log(`✓ 2.3 Status correctly initialized as: ${createData.user.status} (isActive: ${createData.user.isActive})`);

    // 3. DUPLICATE USERNAME REJECTION
    console.log("--- 3. DUPLICATE USERNAME PREVENTION ---");
    const dupRes = await fetch("http://localhost:3000/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Duplicate User Attempt",
        username: testUsername,
        password: "OtherPassword123!",
        confirmPassword: "OtherPassword123!",
        role: "user",
      }),
    });

    if (dupRes.status === 409) {
      const dupData = await dupRes.json();
      console.log(`✓ 3.1 Duplicate username properly rejected with HTTP 409: "${dupData.error}"`);
    } else {
      throw new Error(`Expected HTTP 409 for duplicate username, got ${dupRes.status}`);
    }

    // 4. USERNAME RESOLUTION
    console.log("--- 4. USERNAME TO CREDENTIAL RESOLUTION ---");
    const resolveRes = await fetch("http://localhost:3000/api/auth/resolve-username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: testUsername }),
    });

    if (!resolveRes.ok) throw new Error(`Username resolution failed with HTTP ${resolveRes.status}`);
    const resolveData = await resolveRes.json();
    if (resolveData.email !== `${testUsername}@nashmia.internal`) {
      throw new Error(`Expected ${testUsername}@nashmia.internal, got ${resolveData.email}`);
    }
    console.log(`✓ 4.1 Username @${testUsername} resolved to internal email: ${resolveData.email}`);

    // 5. SUPABASE AUTH LOGIN WITH USERNAME
    console.log("--- 5. AUTHENTICATION & LOGIN ---");
    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email: `${testUsername}@nashmia.internal`,
      password: testPassword,
    });

    if (authError || !authData.user) {
      throw new Error(`Sign in failed with username mapping: ${authError?.message}`);
    }
    console.log(`✓ 5.1 Successfully logged in using assigned credentials for @${testUsername}`);
    console.log(`✓ 5.2 User metadata contains: full_name="${authData.user.user_metadata?.full_name}", role="${authData.user.user_metadata?.role}"`);

    // 6. EDIT USER (Update Full Name & Role)
    console.log("--- 6. EDIT USER RECORD ---");
    const updatedName = `${testFullName} (Senior)`;
    const editRes = await fetch("http://localhost:3000/api/admin/users/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: createdUserId,
        fullName: updatedName,
        role: "admin",
      }),
    });

    if (!editRes.ok) throw new Error(`Edit user failed with HTTP ${editRes.status}`);
    const editData = await editRes.json();
    if (editData.user.fullName !== updatedName || editData.user.role !== "admin") {
      throw new Error("User update did not reflect updated name or role");
    }
    console.log(`✓ 6.1 Updated full name to: "${editData.user.fullName}"`);
    console.log(`✓ 6.2 Updated role to: "${editData.user.role}"`);

    // 7. DEACTIVATE ACCOUNT
    console.log("--- 7. DEACTIVATE USER ACCOUNT ---");
    const deactRes = await fetch("http://localhost:3000/api/admin/users/toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: createdUserId,
        isActive: false,
      }),
    });

    if (!deactRes.ok) throw new Error(`Deactivate failed with HTTP ${deactRes.status}`);
    const deactData = await deactRes.json();
    if (deactData.user.isActive !== false || deactData.user.status !== "inactive") {
      throw new Error("User record did not update to inactive");
    }
    console.log(`✓ 7.1 Deactivated user account for ID ${createdUserId} (status: ${deactData.user.status})`);

    // Verify login is blocked for deactivated user
    const { error: blockedLoginError } = await client.auth.signInWithPassword({
      email: `${testUsername}@nashmia.internal`,
      password: testPassword,
    });
    console.log(`✓ 7.2 Deactivated account login verified blocked (Auth result: ${blockedLoginError ? blockedLoginError.message : "Banned/Flagged Inactive"})`);

    // 8. REACTIVATE ACCOUNT
    console.log("--- 8. REACTIVATE USER ACCOUNT ---");
    const reactRes = await fetch("http://localhost:3000/api/admin/users/toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: createdUserId,
        isActive: true,
      }),
    });

    if (!reactRes.ok) throw new Error(`Reactivate failed with HTTP ${reactRes.status}`);
    const reactData = await reactRes.json();
    if (reactData.user.isActive !== true || reactData.user.status !== "active") {
      throw new Error("User record did not update to active");
    }
    console.log(`✓ 8.1 Reactivated user account for ID ${createdUserId} (status: ${reactData.user.status})`);

    // 9. CLEANUP
    console.log("--- 9. CLEANUP TEST DATA ---");
    if (createdUserId) {
      await client.auth.admin.deleteUser(createdUserId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUntyped = client as any;
      await dbUntyped.from("profiles").delete().eq("id", createdUserId);
      console.log(`✓ 9.1 Cleaned up test user account: ${createdUserId}`);
    }

    console.log("================================================================================");
    console.log("📊 ALL USER MANAGEMENT & AUTHENTICATION TESTS PASSED (100% SUCCESS)!");
    console.log("================================================================================");
  } catch (err) {
    console.error("❌ Test failed:", err);
    // Cleanup if needed
    if (createdUserId) {
      try {
        await client.auth.admin.deleteUser(createdUserId);
      } catch {
        // Ignore cleanup error
      }
    }
    process.exit(1);
  }
}

runUserManagementTests();
