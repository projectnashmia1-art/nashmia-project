import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid } from "./supabase-services";
import { classifyConfirmationDeterministic } from "./forwarder-confirmation-detector";
import type { EmailMessageRecord, EmailStatus } from "@/types/email.types";

export const GMAIL_SCOPES = [
  "https://mail.google.com/",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.insert",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/gmail.settings.sharing",
  "https://www.googleapis.com/auth/gmail.addons.current.action.compose",
  "https://www.googleapis.com/auth/gmail.addons.current.message.action",
  "https://www.googleapis.com/auth/gmail.addons.current.message.metadata",
  "https://www.googleapis.com/auth/gmail.addons.current.message.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

// Initialize Firebase App singleton
const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

// Configure Google Auth Provider with full Gmail scopes
const googleProvider = new GoogleAuthProvider();
GMAIL_SCOPES.forEach((scope) => {
  googleProvider.addScope(scope);
});
googleProvider.setCustomParameters({
  prompt: "select_account",
  access_type: "offline",
});

// In-memory access token cache (adhering strictly to security guidelines)
let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;
let cachedGoogleUser: {
  email: string;
  displayName: string;
  photoURL?: string;
  uid: string;
} | null = null;

// Global Quota & Rate Limit Cooldown State
let globalQuotaCooldownUntil = 0;

export function isGmailQuotaCooldownActive(): boolean {
  return Date.now() < globalQuotaCooldownUntil;
}

export function getGmailQuotaCooldownSeconds(): number {
  return Math.max(0, Math.ceil((globalQuotaCooldownUntil - Date.now()) / 1000));
}

export function setGmailQuotaCooldown(seconds = 65): void {
  globalQuotaCooldownUntil = Date.now() + seconds * 1000;
  console.warn(
    `[GmailService] Gmail API quota cooldown initiated for ${seconds}s to prevent Google Cloud per-minute rate exhaustion.`,
  );
}

// In-Memory Cached Messages to eliminate redundant Gmail queries
let cachedLiveMessages: GmailFetchedMessage[] = [];
let cachedLiveMessagesFetchedAt = 0;
const messageDetailsCache = new Map<string, GmailFetchedMessage>();

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            prompt?: string;
            callback: (response: {
              access_token?: string;
              expires_in?: string | number;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: unknown) => void;
          }) => {
            requestAccessToken: (options?: { prompt?: string }) => void;
          };
          initCodeClient?: (config: {
            client_id: string;
            scope: string;
            ux_mode?: "popup" | "redirect";
            select_account?: boolean;
            access_type?: "offline" | "online";
            callback: (response: {
              code?: string;
              error?: string;
              error_description?: string;
            }) => void;
            error_callback?: (error: unknown) => void;
          }) => {
            requestCode: () => void;
          };
        };
      };
    };
  }
}

let isConnecting = false;

export interface GmailConnectionStatus {
  isConnected: boolean;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastSyncAt?: string | null;
}

/**
 * Encodes a string to RFC 4648 Base64URL without padding
 */
function base64UrlEncode(str: string): string {
  // UTF-8 safe base64 encoding
  const utf8Bytes = new TextEncoder().encode(str);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    const byte = utf8Bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Encodes subject header to RFC 2047 MIME encoded-word syntax
 */
function encodeMimeSubject(subject: string): string {
  if (!subject) return "=?UTF-8?B??=";
  const utf8Bytes = new TextEncoder().encode(subject);
  let binary = "";
  for (let i = 0; i < utf8Bytes.length; i++) {
    const byte = utf8Bytes[i];
    if (byte !== undefined) {
      binary += String.fromCharCode(byte);
    }
  }
  return `=?UTF-8?B?${btoa(binary)}?=`;
}

/**
 * Builds standard RFC 2822 Raw Email String
 */
function createRawEmailMessage(params: {
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  messageId?: string;
}): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  const dateStr = new Date().toUTCString();

  const fromFormatted = params.fromName
    ? `"${params.fromName.replace(/"/g, "")}" <${params.from}>`
    : params.from;

  let toFormatted = params.to;
  if (params.to.includes(",") || params.to.includes(";")) {
    const addresses = params.to
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    toFormatted = addresses
      .map((addr) => (params.toName ? `"${params.toName.replace(/"/g, "")}" <${addr}>` : addr))
      .join(", ");
  } else if (params.toName) {
    toFormatted = `"${params.toName.replace(/"/g, "")}" <${params.to}>`;
  }

  const lines: string[] = [`From: ${fromFormatted}`, `To: ${toFormatted}`];

  if (params.cc && params.cc.trim()) {
    lines.push(`Cc: ${params.cc.trim()}`);
  }
  if (params.bcc && params.bcc.trim()) {
    lines.push(`Bcc: ${params.bcc.trim()}`);
  }

  lines.push(`Subject: ${encodeMimeSubject(params.subject)}`);
  lines.push(`Date: ${dateStr}`);
  lines.push(`MIME-Version: 1.0`);

  if (params.messageId) {
    lines.push(`Message-ID: <${params.messageId}@nashmiaindustries.com>`);
  }

  // Construct Multipart MIME if HTML is available
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push("");

  // Plaintext Part
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 8bit");
  lines.push("");
  lines.push(params.body || "");
  lines.push("");

  // HTML Part
  const htmlContent = params.bodyHtml || (params.body ? params.body.replace(/\n/g, "<br/>") : "");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("Content-Transfer-Encoding: 8bit");
  lines.push("");
  lines.push(
    `<!DOCTYPE html><html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b;">${htmlContent}</body></html>`,
  );
  lines.push("");

  lines.push(`--${boundary}--`);

  return lines.join("\r\n");
}

/**
 * Retrieves the currently active in-memory Gmail Access Token,
 * automatically querying the backend to refresh if expired.
 */
export async function getGmailAccessToken(
  userId?: string | null,
  forceRefresh = false,
): Promise<string | null> {
  const now = Date.now();
  // If we have a cached token that is not expiring within 60 seconds and forceRefresh is false, return it
  if (cachedAccessToken && !forceRefresh && cachedTokenExpiresAt - now > 60 * 1000) {
    return cachedAccessToken;
  }

  // Request validated / auto-refreshed token from server
  try {
    const query = new URLSearchParams();
    if (userId) query.set("userId", userId);
    if (forceRefresh) query.set("forceRefresh", "true");

    const res = await fetch(`/api/gmail/connection-status?${query.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as {
        isConnected: boolean;
        accessToken?: string;
        email?: string;
        displayName?: string;
        avatarUrl?: string;
        tokenExpiresAt?: string;
      };

      if (data.isConnected && data.accessToken) {
        cachedAccessToken = data.accessToken;
        cachedTokenExpiresAt = data.tokenExpiresAt
          ? new Date(data.tokenExpiresAt).getTime()
          : Date.now() + 3500 * 1000;
        cachedGoogleUser = {
          email: data.email || "",
          displayName: data.displayName || data.email || "Gmail User",
          photoURL: data.avatarUrl || undefined,
          uid: "",
        };
        return cachedAccessToken;
      }
    }
  } catch (err) {
    console.warn("[GmailService] Notice checking server for fresh access token:", err);
  }

  // Fallback to Supabase direct query if server endpoint unreachable
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from("gmail_connections")
        .select("*")
        .eq("status", "connected")
        .order("updated_at", { ascending: false })
        .limit(1);

      const validUserUuid = safeUuid(userId);
      if (validUserUuid) {
        query = query.eq("user_id", validUserUuid);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data?.access_token) {
        cachedAccessToken = data.access_token;
        cachedTokenExpiresAt = data.token_expires_at
          ? new Date(data.token_expires_at).getTime()
          : Date.now() + 3500 * 1000;
        cachedGoogleUser = {
          email: data.google_email,
          displayName: data.display_name || data.google_email,
          photoURL: data.avatar_url || undefined,
          uid: data.google_user_id || "",
        };
        return cachedAccessToken;
      }
    } catch (err) {
      console.warn("[GmailService] Notice while retrieving stored access token:", err);
    }
  }

  return cachedAccessToken;
}

/**
 * Returns current cached Google connection user
 */
export function getCachedGoogleUser() {
  return cachedGoogleUser;
}

/**
 * Lazily loads the Google Identity Services (GIS) script only when an OAuth connection
 * is actually initiated, preventing blocking of the initial application page load.
 */
async function ensureGoogleIdentityServicesLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (
    window.google?.accounts?.oauth2?.initTokenClient ||
    window.google?.accounts?.oauth2?.initCodeClient
  ) {
    return;
  }

  return new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      if (
        window.google?.accounts?.oauth2?.initTokenClient ||
        window.google?.accounts?.oauth2?.initCodeClient
      ) {
        resolve();
      } else {
        existing.addEventListener("load", () => resolve(), { once: true });
        setTimeout(resolve, 800);
      }
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      resolve();
    };
    document.head.appendChild(script);
    setTimeout(resolve, 1000);
  });
}

/**
 * Connects to Gmail via Google OAuth.
 * Uses Google Identity Services (GIS) initTokenClient for direct client-side token acquisition.
 * Falls back to Firebase popup if GIS is unavailable.
 */
export async function connectGmailAccount(userId?: string | null): Promise<{
  success: boolean;
  accessToken: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}> {
  if (isConnecting) {
    throw new Error("Gmail connection flow already in progress.");
  }

  try {
    isConnecting = true;

    // Dynamically ensure Google Identity Services script is available on-demand
    await ensureGoogleIdentityServicesLoaded();

    const googleClientId =
      (firebaseConfig as { oAuthClientId?: string })?.oAuthClientId ||
      "1052262935067-h1o99oo3pauajsoafi5va9flit9ntvvv.apps.googleusercontent.com";

    // 1. Primary: Google Identity Services Token Client (official client-side Workspace flow)
    if (typeof window !== "undefined" && window.google?.accounts?.oauth2?.initTokenClient) {
      try {
        console.log("[GmailService] Initiating Google Identity Services token client...");
        const tokenResponse = await new Promise<{
          access_token: string;
          expires_in?: string | number;
        }>((resolve, reject) => {
          try {
            const client = window.google!.accounts!.oauth2!.initTokenClient({
              client_id: googleClientId,
              scope: GMAIL_SCOPES.join(" "),
              prompt: "",
              callback: (response) => {
                if (response.access_token) {
                  resolve({
                    access_token: response.access_token,
                    expires_in: response.expires_in,
                  });
                } else {
                  reject(
                    new Error(
                      response.error_description ||
                        response.error ||
                        "Google authorization was not completed.",
                    ),
                  );
                }
              },
              error_callback: (err) => {
                reject(err);
              },
            });
            client.requestAccessToken({ prompt: "" });
          } catch (initErr) {
            reject(initErr);
          }
        });

        if (tokenResponse.access_token) {
          cachedAccessToken = tokenResponse.access_token;
          const expiresInSec = Number(tokenResponse.expires_in) || 3599;
          cachedTokenExpiresAt = Date.now() + expiresInSec * 1000;

          // Retrieve user profile details from Google UserInfo endpoint
          let email = "";
          let displayName = "Gmail User";
          let avatarUrl: string | undefined = undefined;

          try {
            const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
              headers: { Authorization: `Bearer ${cachedAccessToken}` },
            });
            if (userInfoRes.ok) {
              const userInfo = await userInfoRes.json();
              email = userInfo.email || "";
              displayName = userInfo.name || email.split("@")[0] || "Gmail User";
              avatarUrl = userInfo.picture || undefined;
            }
          } catch (uErr) {
            console.warn("[GmailService] Notice fetching userinfo:", uErr);
          }

          cachedGoogleUser = {
            email,
            displayName,
            photoURL: avatarUrl,
            uid: "",
          };

          // Save connection on backend
          try {
            await fetch("/api/gmail/save-connection", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                accessToken: cachedAccessToken,
                expiresIn: expiresInSec,
                email,
                displayName,
                avatarUrl,
                userId,
              }),
            });
          } catch (saveErr) {
            console.warn("[GmailService] Failed to save connection on backend:", saveErr);
          }

          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("nashmia_gmail_connected", {
                detail: { email, displayName, avatarUrl, timestamp: Date.now() },
              }),
            );
          }

          return {
            success: true,
            accessToken: cachedAccessToken,
            email,
            displayName,
            avatarUrl,
          };
        }
      } catch (gisErr) {
        console.warn(
          "[GmailService] GIS token client notice, attempting Firebase fallback:",
          gisErr,
        );
      }
    }

    // 2. Secondary Fallback: Firebase Google Auth popup
    console.log("[GmailService] Executing Firebase Google Auth popup fallback...");
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);

    if (!credential?.accessToken) {
      throw new Error("Failed to receive Google OAuth access token.");
    }

    cachedAccessToken = credential.accessToken;
    cachedTokenExpiresAt = Date.now() + 3500 * 1000;
    const user = result.user;
    const email = user.email || "";
    const displayName = user.displayName || email.split("@")[0] || "Gmail User";
    const avatarUrl = user.photoURL || undefined;

    cachedGoogleUser = {
      email,
      displayName,
      photoURL: avatarUrl,
      uid: user.uid,
    };

    // Save connection and expiry information to backend
    try {
      await fetch("/api/gmail/save-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken: cachedAccessToken,
          expiresIn: 3599,
          email,
          displayName,
          avatarUrl,
          googleUserId: user.uid,
          userId,
        }),
      });
    } catch (saveErr) {
      console.warn("[GmailService] Failed to save connection on backend:", saveErr);
    }

    return {
      success: true,
      accessToken: cachedAccessToken,
      email,
      displayName,
      avatarUrl,
    };
  } catch (err: unknown) {
    console.error("[GmailService] Error during Google OAuth sign-in:", err);
    const firebaseCode = (err as { code?: string })?.code;
    const rawMessage = err instanceof Error ? err.message : String(err);

    if (firebaseCode === "auth/popup-blocked" || rawMessage.includes("popup-blocked")) {
      throw new Error(
        "The Google authentication popup was blocked by your browser. Please allow popups for this site in your browser address bar and click Connect again.",
      );
    } else if (
      firebaseCode === "auth/popup-closed-by-user" ||
      rawMessage.includes("popup-closed-by-user")
    ) {
      throw new Error("Authentication popup was closed before signing in.");
    } else if (
      firebaseCode === "auth/cancelled-popup-request" ||
      rawMessage.includes("cancelled-popup-request")
    ) {
      throw new Error("A previous authentication request was already pending.");
    } else if (rawMessage.includes("Failed to receive Google OAuth access token")) {
      throw new Error("Google did not return an access token with required Gmail scopes.");
    }

    throw err;
  } finally {
    isConnecting = false;
  }
}

/**
 * Disconnects the Gmail account
 */
export async function disconnectGmailAccount(
  userId?: string | null,
  email?: string | null,
): Promise<void> {
  cachedAccessToken = null;
  cachedTokenExpiresAt = 0;
  cachedGoogleUser = null;

  try {
    await fetch("/api/gmail/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, email }),
    });
  } catch (err) {
    console.warn("[GmailService] Notice while calling backend disconnect:", err);
  }

  // Also directly mark disconnected in Supabase if configured
  if (isSupabaseConfigured) {
    try {
      const validUserUuid = safeUuid(userId);
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
      } else if (email) {
        await supabase
          .from("gmail_connections")
          .update({
            status: "disconnected",
            access_token: null,
            refresh_token: null,
            updated_at: new Date().toISOString(),
          })
          .eq("google_email", email.trim().toLowerCase());
      } else {
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
    } catch (dbErr) {
      console.warn("[GmailService] Client Supabase disconnect update notice:", dbErr);
    }
  }

  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(GMAIL_STATUS_CACHE_KEY);
    }
    await firebaseAuth.signOut();
  } catch (err) {
    console.warn("[GmailService] Firebase sign out notice:", err);
  }
}

const GMAIL_STATUS_CACHE_KEY = "nashmia_gmail_conn_cache_v1";

export function getCachedGmailConnectionState(): GmailConnectionStatus | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(GMAIL_STATUS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GmailConnectionStatus;
      if (parsed && typeof parsed.isConnected === "boolean") {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function persistCachedGmailStatus(status: GmailConnectionStatus) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GMAIL_STATUS_CACHE_KEY, JSON.stringify(status));
  } catch {
    // ignore
  }
}

/**
 * Checks connection state with backend / Supabase, automatically restoring connection
 * and refreshing expired tokens without user intervention.
 */
export async function fetchGmailConnectionState(
  userId?: string | null,
  forceRefresh = false,
): Promise<GmailConnectionStatus> {
  // 1. Query the backend connection status endpoint
  try {
    const params = new URLSearchParams();
    if (userId) params.set("userId", userId);
    if (forceRefresh) params.set("forceRefresh", "true");

    const res = await fetch(`/api/gmail/connection-status?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as {
        isConnected: boolean;
        accessToken?: string;
        email?: string;
        displayName?: string;
        avatarUrl?: string;
        lastSyncAt?: string;
        tokenExpiresAt?: string;
      };

      if (data.isConnected) {
        if (data.accessToken) {
          cachedAccessToken = data.accessToken;
          cachedTokenExpiresAt = data.tokenExpiresAt
            ? new Date(data.tokenExpiresAt).getTime()
            : Date.now() + 3500 * 1000;
        }

        cachedGoogleUser = {
          email: data.email || "",
          displayName: data.displayName || data.email || "Gmail User",
          photoURL: data.avatarUrl || undefined,
          uid: "",
        };

        const result: GmailConnectionStatus = {
          isConnected: true,
          email: data.email || null,
          displayName: data.displayName || null,
          avatarUrl: data.avatarUrl || null,
          lastSyncAt: data.lastSyncAt || null,
        };
        persistCachedGmailStatus(result);
        return result;
      }
    }
  } catch (err) {
    console.warn("[GmailService] Notice fetching connection status from server:", err);
  }

  // 2. Fallback check directly in Supabase if backend was temporarily unreachable
  if (isSupabaseConfigured) {
    try {
      let query = supabase
        .from("gmail_connections")
        .select("*")
        .eq("status", "connected")
        .order("updated_at", { ascending: false })
        .limit(1);

      const validUserUuid = safeUuid(userId);
      if (validUserUuid) {
        query = query.eq("user_id", validUserUuid);
      }

      const { data } = await query.maybeSingle();
      if (data) {
        if (data.access_token) {
          cachedAccessToken = data.access_token;
          cachedTokenExpiresAt = data.token_expires_at
            ? new Date(data.token_expires_at).getTime()
            : Date.now() + 3500 * 1000;
        }
        cachedGoogleUser = {
          email: data.google_email,
          displayName: data.display_name || data.google_email,
          photoURL: data.avatar_url || undefined,
          uid: data.google_user_id || "",
        };
        return {
          isConnected: true,
          email: data.google_email,
          displayName: data.display_name,
          avatarUrl: data.avatar_url,
          lastSyncAt: data.last_sync_at,
        };
      }
    } catch (err) {
      console.warn("[GmailService] Error fetching gmail_connections fallback:", err);
    }
  }

  // 3. In-memory cache fallback
  if (cachedAccessToken && cachedGoogleUser) {
    return {
      isConnected: true,
      email: cachedGoogleUser.email,
      displayName: cachedGoogleUser.displayName,
      avatarUrl: cachedGoogleUser.photoURL || null,
      lastSyncAt: new Date().toISOString(),
    };
  }

  return {
    isConnected: false,
    email: null,
    displayName: null,
    avatarUrl: null,
  };
}

/**
 * Sends a real email directly via the official Gmail REST API
 */
export async function sendEmailDirectlyViaGmail(params: {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  bodyHtml?: string;
  bookingId?: string | null;
  forwarderId?: string | null;
  userId?: string | null;
}): Promise<{
  success: boolean;
  gmailMessageId: string;
  gmailThreadId: string;
}> {
  console.log("[GmailService] sendEmailDirectlyViaGmail called with payload params:", {
    fromEmail: params.fromEmail,
    fromName: params.fromName,
    toEmail: params.toEmail,
    toName: params.toName,
    cc: params.cc || null,
    bcc: params.bcc || null,
    subject: params.subject,
    bodyLength: params.body ? params.body.length : 0,
    hasHtml: Boolean(params.bodyHtml),
    bookingId: params.bookingId || null,
    forwarderId: params.forwarderId || null,
    userId: params.userId || null,
  });

  let token = await getGmailAccessToken(params.userId);

  if (!token) {
    console.log(
      "[GmailService] No access token in cache or database. Initiating Gmail OAuth popup...",
    );
    const connectResult = await connectGmailAccount(params.userId);
    token = connectResult.accessToken;
  }

  if (!token) {
    const errMessage =
      "Gmail authentication token is unavailable. Please connect your Gmail account in settings or login.";
    console.error("[GmailService] Aborted: Token unavailable.", { userId: params.userId });
    throw new Error(errMessage);
  }

  // 1. Build RFC 2822 raw message
  const rawEmail = createRawEmailMessage({
    from: params.fromEmail,
    fromName: params.fromName,
    to: params.toEmail,
    toName: params.toName,
    cc: params.cc,
    bcc: params.bcc,
    subject: params.subject,
    body: params.body,
    bodyHtml: params.bodyHtml,
    messageId: `nashmia-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
  });

  const base64EncodedRaw = base64UrlEncode(rawEmail);

  console.log("[GmailService] RFC 2822 email constructed.", {
    rawLengthBytes: rawEmail.length,
    base64EncodedLength: base64EncodedRaw.length,
    snippet: rawEmail.slice(0, 240),
  });

  const requestPayload = {
    raw: base64EncodedRaw,
  };

  console.log(
    "[GmailService] Dispatching POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send with payload:",
    {
      payloadStructure: "{ raw: string }",
      rawLength: base64EncodedRaw.length,
      tokenPrefix: token.substring(0, 8) + "...",
    },
  );

  // 2. Call Gmail API
  let response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestPayload),
  });

  // If 401 Unauthorized, automatically refresh token or prompt re-authorization popup and retry
  if (response.status === 401) {
    console.warn(
      "[GmailService] Token expired on send (HTTP 401). Attempting token refresh/re-authentication...",
    );
    cachedAccessToken = null;
    let refreshedToken = await getGmailAccessToken(params.userId, true);

    if (!refreshedToken) {
      try {
        console.log(
          "[GmailService] Stale token detected. Prompting Google OAuth re-authentication popup...",
        );
        const connResult = await connectGmailAccount(params.userId);
        refreshedToken = connResult.accessToken;
      } catch (connErr) {
        console.warn(
          "[GmailService] Interactive re-authentication popup skipped or cancelled:",
          connErr,
        );
      }
    }

    if (refreshedToken) {
      console.log("[GmailService] Re-attempting send with fresh access token...");
      token = refreshedToken;
      response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
    }
  }

  // If 403 or 429 Rate Limit / Quota Exceeded, activate cooldown and retry with backoff
  if (response.status === 403 || response.status === 429) {
    setGmailQuotaCooldown(70);
    console.warn(
      `[GmailService] Temporary quota limit reached (HTTP ${response.status}). Waiting 3.5s before retry...`,
    );
    await new Promise((r) => setTimeout(r, 3500));
    response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestPayload),
    });
  }

  if (!response.ok) {
    const status = response.status;
    const statusText = response.statusText;
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    let rawBody = "";
    let errorJson: {
      error?: {
        code?: number;
        message?: string;
        errors?: Array<{ message?: string; domain?: string; reason?: string }>;
        status?: string;
      };
    } | null = null;

    try {
      rawBody = await response.text();
      errorJson = JSON.parse(rawBody);
    } catch {
      // Body was not JSON
    }

    const isRateLimit =
      status === 429 ||
      status === 403 ||
      rawBody.includes("rateLimitExceeded") ||
      rawBody.includes("Quota exceeded") ||
      rawBody.includes("RATE_LIMIT_EXCEEDED") ||
      rawBody.includes("Total Query Cost");

    if (isRateLimit) {
      setGmailQuotaCooldown(75);
      console.warn(
        `[GmailService] Notice: Gmail API per-minute quota reached (HTTP ${status}). Activating 75s cooldown to allow quota window reset.`,
      );
      throw new Error(
        `Gmail API Quota Exceeded (403): Units per minute per user limit reached on Google Cloud. Request has been safely recorded and queued.`,
      );
    }

    console.error("[GmailService] ❌ Gmail API Send Request FAILED. Full error response:", {
      status,
      statusText,
      headers: responseHeaders,
      parsedError: errorJson,
      rawBody,
      requestPayloadPreview: {
        from: params.fromEmail,
        to: params.toEmail,
        subject: params.subject,
        rawLength: base64EncodedRaw.length,
      },
    });

    // If 401 Unauthorized, token expired or invalid
    if (status === 401) {
      console.warn(
        "[GmailService] Token expired or invalid (HTTP 401). Invalidating cached token.",
      );
      cachedAccessToken = null;
      throw new Error(
        "Gmail authentication credentials expired or invalid (401). Please click 'Connect Email' in settings to authorize your account.",
      );
    }

    const detailedMessage =
      errorJson?.error?.message || rawBody || `Gmail API returned status ${status} (${statusText})`;

    throw new Error(`Gmail API Error (${status}): ${detailedMessage}`);
  }

  const data = (await response.json()) as {
    id: string;
    threadId: string;
    labelIds?: string[];
  };

  console.log("[GmailService] ✅ Gmail API Send Request SUCCEEDED:", {
    id: data.id,
    threadId: data.threadId,
    labelIds: data.labelIds,
  });

  return {
    success: true,
    gmailMessageId: data.id,
    gmailThreadId: data.threadId,
  };
}

export interface GmailAttachmentItem {
  id?: string;
  attachmentId?: string;
  filename?: string;
  name?: string;
  mimeType?: string;
  size?: number | string;
  url?: string;
  data?: string;
}

export interface GmailFetchedMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  to: string;
  fromEmail?: string;
  fromName?: string;
  toEmail?: string;
  toName?: string;
  date: string;
  internalDate: string;
  labelIds: string[];
  body: string;
  bodyHtml?: string;
  attachments?: GmailAttachmentItem[];
}

/**
 * Format bytes to readable size string
 */
export function formatAttachmentSize(bytes: number | string | undefined): string {
  if (
    typeof bytes === "string" &&
    (bytes.includes("KB") || bytes.includes("MB") || bytes.includes("B"))
  ) {
    return bytes;
  }
  const num = typeof bytes === "number" ? bytes : parseInt(String(bytes || 0), 10);
  if (!num || isNaN(num) || num <= 0) return "0 KB";
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Safely decodes Base64/Base64URL encoded UTF-8 strings
 */
function safeBase64UrlDecode(input: string): string {
  if (!input) return "";
  try {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    try {
      return decodeURIComponent(escape(atob(input.replace(/-/g, "+").replace(/_/g, "/"))));
    } catch {
      return "";
    }
  }
}

interface MessagePartPayload {
  filename?: string;
  mimeType?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: MessagePartPayload[];
}

/**
 * Recursively extracts plaintext, HTML bodies, and attachment metadata from Gmail MIME payload
 */
function extractBodyAndAttachmentsFromPayload(
  payload: MessagePartPayload | undefined,
  messageId: string,
): {
  text: string;
  html?: string;
  attachments: GmailAttachmentItem[];
} {
  let text = "";
  let html = "";
  const attachments: GmailAttachmentItem[] = [];

  function walk(part: MessagePartPayload | undefined) {
    if (!part) return;

    const rawFilename = part.filename?.trim();
    const attachmentId = part.body?.attachmentId;
    const hasData = Boolean(part.body?.data);
    const size = part.body?.size || 0;
    const isAttachment =
      Boolean(rawFilename && rawFilename.length > 0) ||
      Boolean(attachmentId) ||
      (part.mimeType &&
        ![
          "text/plain",
          "text/html",
          "multipart/alternative",
          "multipart/mixed",
          "multipart/related",
        ].includes(part.mimeType));

    if (isAttachment && (rawFilename || attachmentId || size > 0 || hasData)) {
      const safeName = rawFilename || `attachment_${attachments.length + 1}`;
      const downloadUrl = attachmentId
        ? `/api/gmail/attachment?messageId=${encodeURIComponent(messageId)}&attachmentId=${encodeURIComponent(attachmentId)}&filename=${encodeURIComponent(safeName)}`
        : undefined;

      attachments.push({
        id: attachmentId || `att-${messageId}-${attachments.length}`,
        attachmentId,
        filename: safeName,
        name: safeName,
        mimeType: part.mimeType || "application/octet-stream",
        size: formatAttachmentSize(size),
        url: downloadUrl,
        data: part.body?.data,
      });
    }

    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = safeBase64UrlDecode(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = safeBase64UrlDecode(part.body.data);
    }

    if (part.parts && Array.isArray(part.parts)) {
      for (const subPart of part.parts) {
        walk(subPart);
      }
    }
  }

  walk(payload);
  return { text, html: html || undefined, attachments };
}

/**
 * Fetches real inbox and sent messages from the user's connected Gmail account
 */
export async function fetchLiveGmailMessages(options?: {
  maxResults?: number;
  query?: string;
  labelIds?: string[];
  userId?: string | null;
  forceRefresh?: boolean;
}): Promise<GmailFetchedMessage[]> {
  // 1. If we have recent cached messages and not forcing refresh, return immediately
  const now = Date.now();
  if (
    !options?.forceRefresh &&
    !options?.query &&
    now - cachedLiveMessagesFetchedAt < 60000 &&
    cachedLiveMessages.length > 0
  ) {
    return cachedLiveMessages;
  }

  // 2. If quota cooldown is active, return cached messages to protect sending operations
  if (isGmailQuotaCooldownActive() && !options?.forceRefresh) {
    console.warn(
      `[GmailService] Gmail API quota cooldown active (${getGmailQuotaCooldownSeconds()}s remaining). Serving cached messages.`,
    );
    return cachedLiveMessages;
  }

  let token = cachedAccessToken;
  if (!token && options?.userId) {
    token = await getGmailAccessToken(options.userId);
  }

  if (!token) {
    token = await getGmailAccessToken();
  }

  if (!token) {
    throw new Error("Gmail is not connected. Please connect your Gmail account.");
  }

  const maxResults = options?.maxResults || 15;
  const q = options?.query ? encodeURIComponent(options.query) : "";
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}${
    q ? `&q=${q}` : ""
  }`;

  let listRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (listRes.status === 401) {
    console.warn("[GmailService] Token expired while fetching messages. Auto-refreshing...");
    cachedAccessToken = null;
    const refreshedToken = await getGmailAccessToken(undefined, true);
    if (refreshedToken) {
      token = refreshedToken;
      listRes = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }

  if (!listRes.ok) {
    if (listRes.status === 401) cachedAccessToken = null;
    if (listRes.status === 403 || listRes.status === 429) {
      setGmailQuotaCooldown(60);
      console.warn(
        `[GmailService] Rate limit hit during message listing (HTTP ${listRes.status}). Serving cached inbox messages.`,
      );
      return cachedLiveMessages;
    }
    throw new Error(`Failed to list Gmail messages (${listRes.status})`);
  }

  const listData = (await listRes.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
    resultSizeEstimate?: number;
  };

  if (!listData.messages || listData.messages.length === 0) {
    return [];
  }

  // Fetch individual message details with per-message caching
  const detailPromises = listData.messages.slice(0, maxResults).map(async (msg) => {
    // Return cached message details if available to prevent redundant query cost
    const cachedItem = messageDetailsCache.get(msg.id);
    if (cachedItem) {
      return cachedItem;
    }

    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!msgRes.ok) {
        if (msgRes.status === 403 || msgRes.status === 429) {
          setGmailQuotaCooldown(60);
        }
        return null;
      }
      const fullMsg = await msgRes.json();

      const headers = fullMsg.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find(
          (h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase(),
        )?.value || "";

      const fromRaw = getHeader("From") || "Unknown Sender";
      const toRaw = getHeader("To") || "";
      let fromName = fromRaw;
      let fromEmail = fromRaw;
      const fromMatch = fromRaw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
      if (fromMatch) {
        fromName = fromMatch[1] ? fromMatch[1].trim() : fromMatch[2] || fromRaw;
        fromEmail = fromMatch[2] ? fromMatch[2].trim() : fromRaw;
      }
      let toName = toRaw;
      let toEmail = toRaw;
      const toMatch = toRaw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
      if (toMatch) {
        toName = toMatch[1] ? toMatch[1].trim() : toMatch[2] || toRaw;
        toEmail = toMatch[2] ? toMatch[2].trim() : toRaw;
      }

      const extracted = extractBodyAndAttachmentsFromPayload(fullMsg.payload, msg.id);
      const snippet = fullMsg.snippet || "";
      const body = extracted.text || snippet;
      const bodyHtml = extracted.html;

      const record: GmailFetchedMessage = {
        id: fullMsg.id,
        threadId: fullMsg.threadId,
        snippet,
        subject: getHeader("Subject") || "(No Subject)",
        from: fromRaw,
        to: toRaw,
        fromEmail,
        fromName,
        toEmail,
        toName,
        date: getHeader("Date") || new Date().toISOString(),
        internalDate: fullMsg.internalDate,
        labelIds: fullMsg.labelIds || [],
        body,
        bodyHtml,
        attachments: extracted.attachments,
      };

      messageDetailsCache.set(msg.id, record);
      return record;
    } catch {
      return null;
    }
  });

  const resolved = await Promise.all(detailPromises);
  const finalMessages = resolved.filter((m): m is GmailFetchedMessage => m !== null);

  if (finalMessages.length > 0) {
    cachedLiveMessages = finalMessages;
    cachedLiveMessagesFetchedAt = Date.now();
  }

  return finalMessages.length > 0 ? finalMessages : cachedLiveMessages;
}

/**
 * Maps a real fetched Gmail message into the unified frontend EmailMessageRecord
 */
export function mapGmailMessageToEmailRecord(
  msg: GmailFetchedMessage,
  currentGoogleEmail?: string | null,
): EmailMessageRecord {
  const isSent =
    msg.labelIds.includes("SENT") ||
    (Boolean(currentGoogleEmail) &&
      msg.from.toLowerCase().includes((currentGoogleEmail || "").toLowerCase()));
  const isDraft = msg.labelIds.includes("DRAFT");
  const direction: "inbound" | "outbound" = isSent ? "outbound" : "inbound";

  // Parse Sender
  let fromName = msg.fromName || msg.from;
  let fromEmail = msg.fromEmail || msg.from;
  if (!msg.fromEmail) {
    const fromMatch = msg.from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    if (fromMatch) {
      fromName = fromMatch[1] ? fromMatch[1].trim() : fromMatch[2] || msg.from;
      fromEmail = fromMatch[2] ? fromMatch[2].trim() : msg.from;
    }
  }

  // Parse Recipient
  let toName = msg.toName || msg.to;
  let toEmail = msg.toEmail || msg.to;
  if (!msg.toEmail) {
    const toMatch = msg.to.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    if (toMatch) {
      toName = toMatch[1] ? toMatch[1].trim() : toMatch[2] || msg.to;
      toEmail = toMatch[2] ? toMatch[2].trim() : msg.to;
    }
  }

  // Detect Booking / Movement Reference if present in subject, snippet, or body
  const refMatch = `${msg.subject} ${msg.snippet} ${msg.body || ""}`.match(
    /\b(MOV-\d{4}-\d{3,6}|MOV-[A-Z0-9-]+|BK-[A-Z0-9-]+|REF-[A-Z0-9-]+|PO-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
  );
  const bookingReference = refMatch ? refMatch[1].toUpperCase() : null;

  // Run deterministic confirmation classifier on incoming Gmail message
  const detResult = classifyConfirmationDeterministic(
    msg.subject || "",
    msg.body || msg.snippet || "",
    msg.snippet,
  );
  const isConfirmed = detResult?.status === "CONFIRMED";
  const confirmationStatus = isConfirmed ? "CONFIRMED" : detResult?.status || null;

  let parsedDate = new Date().toISOString();
  try {
    const d = new Date(msg.date);
    if (!isNaN(d.getTime())) {
      parsedDate = d.toISOString();
    }
  } catch {
    // Keep fallback
  }

  const realAttachments = (msg.attachments || []).map((att) => ({
    name: att.name || att.filename || "Attachment",
    filename: att.filename || att.name || "Attachment",
    size: typeof att.size === "string" ? att.size : formatAttachmentSize(att.size),
    url: att.url,
    type: att.mimeType,
    mimeType: att.mimeType,
    attachmentId: att.attachmentId,
    gmailMessageId: msg.id,
    data: att.data,
  }));

  return {
    id: `gmail-${msg.id}`,
    threadId: `gmail-th-${msg.threadId}`,
    userId: undefined,
    fromEmail,
    fromName,
    toEmail,
    toName,
    subject: msg.subject || "(No Subject)",
    body: msg.body || msg.snippet,
    bodyHtml: msg.bodyHtml || null,
    snippet: msg.snippet || (msg.body ? msg.body.slice(0, 140) : ""),
    emailType: isConfirmed
      ? "BOOKING_CONFIRMATION"
      : bookingReference
        ? "BOOKING_REQUEST"
        : "GENERAL",
    status: isDraft ? "DRAFT" : "SENT",
    direction,
    gmailMessageId: msg.id,
    gmailThreadId: msg.threadId,
    createdAt: parsedDate,
    updatedAt: parsedDate,
    sentAt: isSent ? parsedDate : null,
    bookingReference,
    movementNumber: bookingReference,
    confirmationStatus,
    confirmationConfidence: detResult?.confidence,
    confirmationReason: detResult?.reason,
    confirmationDetectedBy: isConfirmed ? "DETERMINISTIC" : undefined,
    attachments: realAttachments,
  };
}
