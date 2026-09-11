import fs from "fs";
import path from "path";
import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid } from "./supabase-services";
import firebaseConfig from "../../firebase-applet-config.json";

export interface StoredGmailConnection {
  id: string;
  user_id: string | null;
  google_email: string;
  google_user_id?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  access_token: string;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  scope?: string | null;
  token_type?: string | null;
  status: string; // 'connected' | 'active' | 'disconnected' | 'expired' | 'revoked'
  last_sync_at?: string | null;
  sync_history_id?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClientGmailStatusResponse {
  isConnected: boolean;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastSyncAt?: string | null;
  tokenExpiresAt?: string | null;
  accessToken?: string | null;
}

const SERVER_STORAGE_FILE = path.join(process.cwd(), ".server_gmail_connections.json");

/**
 * Resolves Google OAuth credentials safely from environment or configuration
 */
export function resolveGoogleCredentials(): { clientId: string; clientSecret: string } {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    (firebaseConfig as { oAuthClientId?: string })?.oAuthClientId ||
    "463842413221-vie9drapegc0vcaduqpc54lpfjmp70ho.apps.googleusercontent.com";

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || "";

  return { clientId, clientSecret };
}

/**
 * Server-side fallback persistence to guarantee tokens are never lost across refreshes,
 * even if Supabase schema cache hasn't registered gmail_connections yet.
 */
function readServerFallbackStorage(): StoredGmailConnection[] {
  try {
    if (fs.existsSync(SERVER_STORAGE_FILE)) {
      const content = fs.readFileSync(SERVER_STORAGE_FILE, "utf-8");
      return JSON.parse(content) as StoredGmailConnection[];
    }
  } catch (err) {
    console.warn("[ServerGmailToken] Error reading fallback storage:", err);
  }
  return [];
}

function writeServerFallbackStorage(connections: StoredGmailConnection[]): void {
  try {
    fs.writeFileSync(SERVER_STORAGE_FILE, JSON.stringify(connections, null, 2), "utf-8");
  } catch (err) {
    console.warn("[ServerGmailToken] Error writing fallback storage:", err);
  }
}

/**
 * Saves or updates connection in server fallback store
 */
function saveToFallbackStore(connection: StoredGmailConnection): void {
  const list = readServerFallbackStorage();
  const existingIdx = list.findIndex(
    (c) =>
      c.id === connection.id ||
      c.google_email.toLowerCase() === connection.google_email.toLowerCase() ||
      (connection.user_id && c.user_id === connection.user_id),
  );

  if (existingIdx >= 0) {
    const prev = list[existingIdx];
    list[existingIdx] = {
      ...prev,
      ...connection,
      // Retain existing refresh token if new one is missing
      refresh_token: connection.refresh_token || prev.refresh_token || null,
      updated_at: new Date().toISOString(),
    };
  } else {
    list.push(connection);
  }

  writeServerFallbackStorage(list);
}

/**
 * Finds active connection from server fallback store
 */
function getFromFallbackStore(userId?: string | null): StoredGmailConnection | null {
  const list = readServerFallbackStorage();
  const validUserUuid = safeUuid(userId);

  if (validUserUuid) {
    const match = list.find(
      (c) => c.user_id === validUserUuid && (c.status === "connected" || c.status === "active"),
    );
    if (match) return match;
  }

  // Fallback to most recently updated connected account
  const connectedList = list
    .filter((c) => c.status === "connected" || c.status === "active")
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  return connectedList[0] || null;
}

/**
 * Saves a Gmail connection to Supabase gmail_connections table,
 * and maintains server fallback store.
 */
export async function persistGmailConnection(connection: StoredGmailConnection): Promise<boolean> {
  // Always update server fallback storage
  saveToFallbackStore(connection);

  if (!isSupabaseConfigured) {
    return true;
  }

  try {
    const validUserUuid = safeUuid(connection.user_id);
    const dbPayload = {
      user_id: validUserUuid,
      google_email: connection.google_email,
      google_user_id: connection.google_user_id || null,
      display_name: connection.display_name || connection.google_email,
      avatar_url: connection.avatar_url || null,
      access_token: connection.access_token,
      refresh_token: connection.refresh_token || null,
      token_expires_at: connection.token_expires_at || null,
      scope: connection.scope || null,
      token_type: connection.token_type || "Bearer",
      status: connection.status || "connected",
      last_sync_at: connection.last_sync_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Attempt upsert in Supabase gmail_connections
    const { error } = await supabase
      .from("gmail_connections")
      .upsert(dbPayload, { onConflict: "user_id,google_email" });

    if (error) {
      // If error code is PGRST205, table not migrated yet; fallback store is active
      if (error.code === "PGRST205") {
        console.warn(
          "[ServerGmailToken] Supabase gmail_connections table pending migration in project. Saved to secure server storage.",
        );
      } else {
        console.warn("[ServerGmailToken] Supabase gmail_connections upsert notice:", error.message);
      }
      return false;
    }

    console.log(
      "[ServerGmailToken] Successfully persisted Gmail connection to Supabase for:",
      connection.google_email,
    );
    return true;
  } catch (err) {
    console.warn("[ServerGmailToken] Could not persist to Supabase:", err);
    return false;
  }
}

/**
 * Refreshes an expired access token using Google OAuth2 token endpoint and stored refresh_token
 */
export async function refreshGoogleAccessToken(
  connection: StoredGmailConnection,
): Promise<{ success: boolean; accessToken?: string; tokenExpiresAt?: string; error?: string }> {
  if (!connection.refresh_token) {
    console.warn(
      `[ServerGmailToken] Cannot refresh token for ${connection.google_email}: No refresh_token stored.`,
    );
    return { success: false, error: "No refresh_token stored for this connection." };
  }

  const { clientId, clientSecret } = resolveGoogleCredentials();

  console.log(
    `[ServerGmailToken] Refreshing expired access token for ${connection.google_email}...`,
  );

  try {
    const postBody = new URLSearchParams({
      client_id: clientId,
      refresh_token: connection.refresh_token,
      grant_type: "refresh_token",
    });

    if (clientSecret) {
      postBody.set("client_secret", clientSecret);
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: postBody.toString(),
    });

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !data.access_token) {
      const errorMsg = data.error_description || data.error || "Token refresh rejected by Google.";
      console.error("[ServerGmailToken] Google token refresh failed:", errorMsg);

      if (data.error === "invalid_grant") {
        connection.status = "expired";
        await persistGmailConnection(connection);
      }

      return { success: false, error: errorMsg };
    }

    const expiresIn = data.expires_in || 3599;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    connection.access_token = data.access_token;
    connection.token_expires_at = tokenExpiresAt;
    connection.status = "connected";
    connection.updated_at = new Date().toISOString();

    if (data.scope) {
      connection.scope = data.scope;
    }

    await persistGmailConnection(connection);

    console.log(
      `[ServerGmailToken] Successfully refreshed access token for ${connection.google_email}. Valid until: ${tokenExpiresAt}`,
    );

    return {
      success: true,
      accessToken: data.access_token,
      tokenExpiresAt,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ServerGmailToken] Network error during token refresh:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Retrieves the active Gmail connection from Supabase or server fallback store,
 * automatically refreshing the access token if expired or near expiry.
 */
export async function getOrRefreshActiveGmailConnection(
  userId?: string | null,
  forceRefresh = false,
): Promise<{ connection: StoredGmailConnection | null; error?: string }> {
  let activeConn: StoredGmailConnection | null = null;
  const validUserUuid = safeUuid(userId);

  // 1. Try to query Supabase gmail_connections table
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from("gmail_connections")
        .select("*")
        .in("status", ["connected", "active"])
        .order("updated_at", { ascending: false })
        .limit(1);

      if (validUserUuid) {
        query = query.eq("user_id", validUserUuid);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        activeConn = {
          id: data.id,
          user_id: data.user_id,
          google_email: data.google_email,
          google_user_id: data.google_user_id,
          display_name: data.display_name,
          avatar_url: data.avatar_url,
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          token_expires_at: data.token_expires_at,
          scope: data.scope,
          token_type: data.token_type,
          status: data.status,
          last_sync_at: data.last_sync_at,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
      }
    } catch (dbErr) {
      console.warn("[ServerGmailToken] Notice checking Supabase connection:", dbErr);
    }
  }

  // 2. Fallback to server fallback store if Supabase returned no active row
  if (!activeConn) {
    activeConn = getFromFallbackStore(userId);
  }

  if (!activeConn) {
    return { connection: null };
  }

  // 3. Check if token is expired or expiring within 5 minutes (300,000 ms)
  const now = Date.now();
  const expiresAtMs = activeConn.token_expires_at
    ? new Date(activeConn.token_expires_at).getTime()
    : 0;

  const isExpiredOrNear = !expiresAtMs || expiresAtMs - now < 5 * 60 * 1000;

  if ((isExpiredOrNear || forceRefresh) && activeConn.refresh_token) {
    console.log(
      `[ServerGmailToken] Token for ${activeConn.google_email} is expired or near expiry (Expires: ${activeConn.token_expires_at}). Triggering automatic refresh...`,
    );

    const refreshResult = await refreshGoogleAccessToken(activeConn);
    if (!refreshResult.success) {
      console.warn(
        `[ServerGmailToken] Automatic refresh failed for ${activeConn.google_email}: ${refreshResult.error}`,
      );
      // If we still have an access token that hasn't strictly passed current time, return it with warning
      if (expiresAtMs > now) {
        return { connection: activeConn };
      }
      return { connection: activeConn, error: refreshResult.error };
    }
  }

  return { connection: activeConn };
}

/**
 * Exchanges OAuth2 Authorization Code for access_token and refresh_token
 * via Google OAuth2 token endpoint (access_type=offline).
 */
export async function exchangeAuthCodeForTokens(
  code: string,
  redirectUri = "postmessage",
  userId?: string | null,
): Promise<{
  success: boolean;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken?: string;
  tokenExpiresAt?: string;
  error?: string;
}> {
  const { clientId, clientSecret } = resolveGoogleCredentials();

  console.log("[ServerGmailToken] Exchanging Google authorization code for tokens...", {
    redirectUri,
    hasClientSecret: Boolean(clientSecret),
  });

  try {
    const postBody = new URLSearchParams({
      code,
      client_id: clientId,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    if (clientSecret) {
      postBody.set("client_secret", clientSecret);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postBody.toString(),
    });

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      const errMsg =
        tokenData.error_description || tokenData.error || "Failed to exchange authorization code.";
      console.error("[ServerGmailToken] Code exchange rejected by Google:", errMsg);
      return { success: false, error: errMsg };
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in || 3599;
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Fetch user profile from Google UserInfo endpoint
    let email = "";
    let displayName = "";
    let avatarUrl = "";
    let googleUserId = "";

    try {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (userinfoRes.ok) {
        const userInfo = (await userinfoRes.json()) as {
          id?: string;
          email?: string;
          name?: string;
          picture?: string;
        };
        email = userInfo.email || "";
        displayName = userInfo.name || email.split("@")[0] || "Gmail User";
        avatarUrl = userInfo.picture || "";
        googleUserId = userInfo.id || "";
      }
    } catch (profileErr) {
      console.warn("[ServerGmailToken] Could not fetch Google userinfo:", profileErr);
    }

    if (!email) {
      email = "user@gmail.com";
    }

    const newConnection: StoredGmailConnection = {
      id: crypto.randomUUID(),
      user_id: safeUuid(userId),
      google_email: email,
      google_user_id: googleUserId,
      display_name: displayName || email.split("@")[0],
      avatar_url: avatarUrl || null,
      access_token: accessToken,
      refresh_token: refreshToken, // Persisted securely server-side!
      token_expires_at: tokenExpiresAt,
      scope: tokenData.scope || null,
      token_type: tokenData.token_type || "Bearer",
      status: "connected",
      last_sync_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await persistGmailConnection(newConnection);

    console.log(
      `[ServerGmailToken] OAuth exchange successful for ${email}. Refresh token saved: ${Boolean(refreshToken)}`,
    );

    // CRITICAL: NEVER expose refresh_token or client_secret to the frontend response!
    return {
      success: true,
      email,
      displayName: newConnection.display_name || email,
      avatarUrl: newConnection.avatar_url || undefined,
      accessToken,
      tokenExpiresAt,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ServerGmailToken] Fatal error in exchangeAuthCodeForTokens:", msg);
    return { success: false, error: msg };
  }
}

/**
 * Saves a direct connection (from popup callback or re-authorization)
 * and stores token expiry information properly.
 */
export async function saveDirectConnection(params: {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  googleUserId?: string | null;
  userId?: string | null;
}): Promise<StoredGmailConnection> {
  const expiresIn = params.expiresIn || 3599;
  const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  // Check if existing connection already has a refresh_token
  const existing = getFromFallbackStore(params.userId);
  const preservedRefreshToken = params.refreshToken || existing?.refresh_token || null;

  const connection: StoredGmailConnection = {
    id: existing?.id || crypto.randomUUID(),
    user_id: safeUuid(params.userId),
    google_email: params.email,
    google_user_id: params.googleUserId || existing?.google_user_id || null,
    display_name: params.displayName || params.email.split("@")[0],
    avatar_url: params.avatarUrl || null,
    access_token: params.accessToken,
    refresh_token: preservedRefreshToken,
    token_expires_at: tokenExpiresAt,
    scope: null,
    token_type: "Bearer",
    status: "connected",
    last_sync_at: new Date().toISOString(),
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await persistGmailConnection(connection);
  return connection;
}

/**
 * Disconnects the active Gmail connection
 */
export async function disconnectGmailConnection(
  userId?: string | null,
  email?: string | null,
): Promise<void> {
  const validUserUuid = safeUuid(userId);
  const normalizedEmail = email ? email.trim().toLowerCase() : null;

  // 1. Mark matching entries as disconnected in server fallback store
  const list = readServerFallbackStorage();
  let updatedAny = false;
  list.forEach((c) => {
    const matchesUser = Boolean(
      (validUserUuid && c.user_id === validUserUuid) || (userId && c.user_id === userId),
    );
    const matchesEmail = Boolean(
      normalizedEmail && c.google_email.toLowerCase() === normalizedEmail,
    );
    // If either matches, or if neither identity is provided, or if this is the active connection
    if (
      matchesUser ||
      matchesEmail ||
      (!validUserUuid && !normalizedEmail) ||
      c.status === "connected"
    ) {
      c.status = "disconnected";
      c.access_token = null;
      c.refresh_token = null;
      c.updated_at = new Date().toISOString();
      updatedAny = true;
    }
  });

  if (updatedAny) {
    writeServerFallbackStorage(list);
  }

  // 2. Persist disconnected state in Supabase
  if (isSupabaseConfigured) {
    try {
      if (normalizedEmail) {
        await supabase
          .from("gmail_connections")
          .update({
            status: "disconnected",
            access_token: null,
            refresh_token: null,
            updated_at: new Date().toISOString(),
          })
          .eq("google_email", normalizedEmail);
      }
      if (validUserUuid) {
        await supabase
          .from("gmail_connections")
          .update({
            status: "disconnected",
            access_token: null,
            refresh_token: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", validUserUuid);
      }
      if (!validUserUuid && !normalizedEmail) {
        await supabase
          .from("gmail_connections")
          .update({
            status: "disconnected",
            access_token: null,
            refresh_token: null,
            updated_at: new Date().toISOString(),
          })
          .neq("status", "disconnected");
      }
    } catch (err) {
      console.warn("[ServerGmailToken] Notice during Supabase disconnect:", err);
    }
  }
}
