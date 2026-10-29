import { getServerSupabaseClient } from "./supabase.ts";

export const usersCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

export interface AdminUserRecord {
  id: string;
  fullName: string;
  username: string;
  email: string;
  role: "admin" | "user";
  status: "active" | "inactive";
  isActive: boolean;
  createdAt: string;
  lastSignInAt?: string | null;
}

// System super admin emails that are always granted administrator permissions
const SUPER_ADMIN_EMAILS = new Set(["fleeksaas@gmail.com"]);

/**
 * Validates whether the caller has administrator privileges.
 */
async function getCallerAuth(request: Request) {
  const authHeader =
    request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader) {
    return { isAuthenticated: false, isAdmin: false, user: null };
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { isAuthenticated: false, isAdmin: false, user: null };
  }

  try {
    const client = getServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);

    if (error || !user) {
      return { isAuthenticated: false, isAdmin: false, user: null };
    }

    const email = user.email?.toLowerCase().trim() || "";
    const isSuperAdmin = SUPER_ADMIN_EMAILS.has(email);
    const role = (user.user_metadata?.role || "user").toLowerCase();
    const isActive =
      user.user_metadata?.is_active !== false &&
      user.user_metadata?.status !== "inactive" &&
      !user.banned_until;

    const isAdmin = isSuperAdmin || role === "admin";

    return {
      isAuthenticated: true,
      isAdmin,
      isActive,
      user,
      role: isAdmin ? "admin" : "user",
    };
  } catch (err) {
    console.warn("[UserMgmt] Error verifying caller JWT:", err);
    return { isAuthenticated: false, isAdmin: false, user: null };
  }
}

/**
 * Formats an auth user object into an AdminUserRecord
 */
function formatUserRecord(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authUser: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profileMap?: Map<string, any>,
): AdminUserRecord {
  const profile = profileMap?.get(authUser.id);
  const meta = authUser.user_metadata || {};
  const email = (authUser.email || profile?.email || "").toLowerCase().trim();

  // Deduce or normalize username
  let username = meta.username || "";
  if (!username) {
    if (email.endsWith("@nashmia.internal")) {
      username = email.replace("@nashmia.internal", "");
    } else if (email) {
      username = email.split("@")[0].replace(/[^a-zA-Z0-9_-]/g, "_");
    } else {
      username = `user_${authUser.id.slice(0, 6)}`;
    }
  }

  // Deduce full name
  const fullName =
    profile?.full_name ||
    meta.full_name ||
    meta.name ||
    (username ? username.charAt(0).toUpperCase() + username.slice(1) : "Nashmia User");

  // Deduce role
  const isSuper = SUPER_ADMIN_EMAILS.has(email);
  const rawRole = (meta.role || profile?.role || "").toLowerCase();
  const role: "admin" | "user" = isSuper || rawRole === "admin" ? "admin" : "user";

  // Deduce active status
  const isBanned = Boolean(
    authUser.banned_until && new Date(authUser.banned_until).getTime() > Date.now(),
  );
  const isActive = !isBanned && meta.is_active !== false && meta.status !== "inactive";

  return {
    id: authUser.id,
    fullName,
    username: username.toLowerCase().trim(),
    email,
    role,
    status: isActive ? "active" : "inactive",
    isActive,
    createdAt: authUser.created_at || profile?.created_at || new Date().toISOString(),
    lastSignInAt: authUser.last_sign_in_at || null,
  };
}

/**
 * Main User Management API Router for /api/admin/users and /api/auth/resolve-username
 */
export async function handleUserManagementApiRequest(
  request: Request,
  url: URL,
): Promise<Response | null> {
  const pathname = url.pathname;

  // Handle OPTIONS preflight
  if (
    request.method === "OPTIONS" &&
    (pathname.startsWith("/api/admin/users") || pathname === "/api/auth/resolve-username")
  ) {
    return new Response(null, { status: 204, headers: usersCorsHeaders });
  }

  // 1. POST /api/auth/resolve-username
  // Allows the client login form to deterministically resolve usernames to auth emails
  if (pathname === "/api/auth/resolve-username" && request.method === "POST") {
    try {
      const body = (await request.json().catch(() => ({}))) as { identifier?: string };
      const rawIdentifier = (body.identifier || "").trim().toLowerCase();

      if (!rawIdentifier) {
        return new Response(
          JSON.stringify({ success: false, error: "Username or email is required" }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const client = getServerSupabaseClient();
      let targetEmail = rawIdentifier;
      const isPlainUsername = !rawIdentifier.includes("@");

      if (isPlainUsername) {
        // Query users by username metadata or deterministic domain
        const { data: listResult } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const matched = listResult?.users?.find(
          (u) =>
            u.user_metadata?.username?.toLowerCase() === rawIdentifier ||
            u.email?.toLowerCase() === `${rawIdentifier}@nashmia.internal`,
        );

        if (matched && matched.email) {
          targetEmail = matched.email;
          const isBanned = Boolean(
            matched.banned_until && new Date(matched.banned_until).getTime() > Date.now(),
          );
          const isActive =
            !isBanned &&
            matched.user_metadata?.is_active !== false &&
            matched.user_metadata?.status !== "inactive";

          return new Response(
            JSON.stringify({
              success: true,
              email: targetEmail,
              username: rawIdentifier,
              isActive,
              fullName: matched.user_metadata?.full_name || rawIdentifier,
              role: matched.user_metadata?.role || "user",
            }),
            { status: 200, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
          );
        } else {
          // Fallback to deterministic mapping: username@nashmia.internal
          targetEmail = `${rawIdentifier}@nashmia.internal`;
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          email: targetEmail,
          username: isPlainUsername ? rawIdentifier : targetEmail.split("@")[0],
          isActive: true,
        }),
        { status: 200, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error resolving username";
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 500,
        headers: { ...usersCorsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 2. GET /api/admin/users
  // Retrieves list of all users
  if (pathname === "/api/admin/users" && request.method === "GET") {
    try {
      const caller = await getCallerAuth(request);
      // In development or when requested by authenticated admin
      const client = getServerSupabaseClient();

      // Fetch users from Supabase Auth
      const { data: usersData, error: usersErr } = await client.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });

      if (usersErr) {
        return new Response(JSON.stringify({ success: false, error: usersErr.message }), {
          status: 500,
          headers: { ...usersCorsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch matching profile records
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbUntyped = client as any;
      const { data: profilesData } = await dbUntyped.from("profiles").select("*");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileMap = new Map<string, any>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      profilesData?.forEach((p: any) => {
        if (p.id) profileMap.set(p.id, p);
      });

      const users: AdminUserRecord[] = (usersData?.users || []).map((u) =>
        formatUserRecord(u, profileMap),
      );

      // Sort by creation date descending
      users.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return new Response(
        JSON.stringify({
          success: true,
          users,
          callerRole: caller.role,
          isAdmin: caller.isAdmin,
        }),
        { status: 200, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error listing users";
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 500,
        headers: { ...usersCorsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 3. POST /api/admin/users/create
  // Admin provisions a new user with username, password, full name, and role
  if (pathname === "/api/admin/users/create" && request.method === "POST") {
    try {
      const caller = await getCallerAuth(request);
      if (caller.isAuthenticated && !caller.isAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden: Only administrators can create new user accounts.",
          }),
          { status: 403, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const body = (await request.json().catch(() => ({}))) as {
        fullName?: string;
        username?: string;
        password?: string;
        confirmPassword?: string;
        role?: string;
      };

      const fullName = (body.fullName || "").trim();
      const username = (body.username || "").toLowerCase().trim();
      const password = body.password || "";
      const confirmPassword = body.confirmPassword || "";
      const role = (body.role || "user").toLowerCase() === "admin" ? "admin" : "user";

      // Validations
      if (!fullName || fullName.length < 2) {
        return new Response(
          JSON.stringify({ success: false, error: "Please enter a valid full name." }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!username || !/^[a-z0-9_-]{3,30}$/.test(username)) {
        return new Response(
          JSON.stringify({
            success: false,
            error:
              "Username must be 3-30 characters long and contain only lowercase letters, numbers, underscores, or hyphens.",
          }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (!password || password.length < 6) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Password must be at least 6 characters long.",
          }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (confirmPassword && password !== confirmPassword) {
        return new Response(
          JSON.stringify({ success: false, error: "Passwords do not match." }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const client = getServerSupabaseClient();

      // Check for duplicate username in auth users
      const { data: existingList } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const internalEmail = `${username}@nashmia.internal`;

      const duplicate = existingList?.users?.some(
        (u) =>
          u.user_metadata?.username?.toLowerCase() === username ||
          u.email?.toLowerCase() === internalEmail,
      );

      if (duplicate) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Username "${username}" is already taken. Please choose another username.`,
          }),
          { status: 409, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Provision user via Supabase Auth Admin
      const { data: createResult, error: createErr } = await client.auth.admin.createUser({
        email: internalEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          username,
          role,
          is_active: true,
          status: "active",
        },
      });

      if (createErr || !createResult?.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: createErr?.message || "Failed to create user account in authentication provider.",
          }),
          { status: 500, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const newAuthUser = createResult.user;

      // Upsert user into profiles table
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dbUntyped = client as any;
        await dbUntyped.from("profiles").upsert({
          id: newAuthUser.id,
          full_name: fullName,
          email: internalEmail,
          updated_at: new Date().toISOString(),
        });
      } catch (profErr) {
        console.warn("[UserMgmt] Notice syncing new profile record:", profErr);
      }

      const formatted = formatUserRecord(newAuthUser);

      return new Response(
        JSON.stringify({
          success: true,
          message: `User "${fullName}" (@${username}) created successfully with role "${role.toUpperCase()}".`,
          user: formatted,
        }),
        { status: 201, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error creating user";
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 500,
        headers: { ...usersCorsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 4. POST /api/admin/users/toggle-status
  // Admin activates or deactivates an account
  if (pathname === "/api/admin/users/toggle-status" && request.method === "POST") {
    try {
      const caller = await getCallerAuth(request);
      if (caller.isAuthenticated && !caller.isAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden: Only administrators can modify account status.",
          }),
          { status: 403, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        isActive?: boolean;
      };

      const userId = (body.userId || "").trim();
      const isActive = Boolean(body.isActive);

      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "User ID is required." }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const client = getServerSupabaseClient();
      const { data: targetUser, error: getUserErr } = await client.auth.admin.getUserById(userId);

      if (getUserErr || !targetUser?.user) {
        return new Response(
          JSON.stringify({ success: false, error: "User not found." }),
          { status: 404, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Prevent deactivating system super admin
      if (SUPER_ADMIN_EMAILS.has(targetUser.user.email?.toLowerCase() || "")) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "The primary system administrator account cannot be deactivated.",
          }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Update user_metadata and ban_duration in Supabase Auth
      const currentMeta = targetUser.user.user_metadata || {};
      const newMeta = {
        ...currentMeta,
        is_active: isActive,
        status: isActive ? "active" : "inactive",
      };

      const updatePayload: {
        user_metadata: Record<string, unknown>;
        ban_duration?: string;
      } = {
        user_metadata: newMeta,
        ban_duration: isActive ? "none" : "876000h", // 100 years if deactivated
      };

      const { data: updatedData, error: updateErr } = await client.auth.admin.updateUserById(
        userId,
        updatePayload,
      );

      if (updateErr || !updatedData?.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: updateErr?.message || "Failed to update account status.",
          }),
          { status: 500, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const formatted = formatUserRecord(updatedData.user);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Account for ${formatted.fullName} has been ${isActive ? "activated" : "deactivated"}.`,
          user: formatted,
        }),
        { status: 200, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating account status";
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 500,
        headers: { ...usersCorsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 5. POST /api/admin/users/update
  // Admin updates full name, role, or resets password
  if (pathname === "/api/admin/users/update" && request.method === "POST") {
    try {
      const caller = await getCallerAuth(request);
      if (caller.isAuthenticated && !caller.isAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Forbidden: Only administrators can edit user accounts.",
          }),
          { status: 403, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const body = (await request.json().catch(() => ({}))) as {
        userId?: string;
        fullName?: string;
        role?: string;
        newPassword?: string;
      };

      const userId = (body.userId || "").trim();
      const fullName = (body.fullName || "").trim();
      const role = body.role ? (body.role.toLowerCase() === "admin" ? "admin" : "user") : undefined;
      const newPassword = (body.newPassword || "").trim();

      if (!userId) {
        return new Response(
          JSON.stringify({ success: false, error: "User ID is required." }),
          { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const client = getServerSupabaseClient();
      const { data: targetUser, error: getUserErr } = await client.auth.admin.getUserById(userId);

      if (getUserErr || !targetUser?.user) {
        return new Response(
          JSON.stringify({ success: false, error: "User not found." }),
          { status: 404, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      const currentMeta = targetUser.user.user_metadata || {};
      const updatedMeta: Record<string, unknown> = {
        ...currentMeta,
        ...(fullName ? { full_name: fullName } : {}),
        ...(role ? { role } : {}),
      };

      const updatePayload: {
        user_metadata: Record<string, unknown>;
        password?: string;
      } = {
        user_metadata: updatedMeta,
      };

      if (newPassword) {
        if (newPassword.length < 6) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "New password must be at least 6 characters long.",
            }),
            { status: 400, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
          );
        }
        updatePayload.password = newPassword;
      }

      const { data: updatedData, error: updateErr } = await client.auth.admin.updateUserById(
        userId,
        updatePayload,
      );

      if (updateErr || !updatedData?.user) {
        return new Response(
          JSON.stringify({
            success: false,
            error: updateErr?.message || "Failed to update user record.",
          }),
          { status: 500, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
        );
      }

      if (fullName) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const dbUntyped = client as any;
          await dbUntyped
            .from("profiles")
            .update({ full_name: fullName, updated_at: new Date().toISOString() })
            .eq("id", userId);
        } catch (profErr) {
          console.warn("[UserMgmt] Notice updating profiles record:", profErr);
        }
      }

      const formatted = formatUserRecord(updatedData.user);

      return new Response(
        JSON.stringify({
          success: true,
          message: `User "${formatted.fullName}" updated successfully.`,
          user: formatted,
        }),
        { status: 200, headers: { ...usersCorsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error updating user";
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 500,
        headers: { ...usersCorsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Not handled by this router
  return null;
}
