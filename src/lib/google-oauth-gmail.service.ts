/**
 * Google OAuth2 & Gmail API Service
 *
 * Provides end-to-end functionality for:
 * 1. Initializing Google OAuth2 authentication using environment variables
 *    (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CLIENT_SECRET, etc.)
 * 2. Generating OAuth2 consent URLs, exchanging authorization codes for tokens,
 *    and refreshing expired access tokens
 * 3. Connecting to the Gmail API (v1) to fetch user profile, list emails,
 *    retrieve individual messages with parsed bodies/headers/attachments,
 *    and fetch multi-message conversation threads.
 */

import firebaseConfig from "../../firebase-applet-config.json" with { type: "json" };

// Default Gmail & Google OAuth Scopes
export const DEFAULT_GMAIL_SCOPES: string[] = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

// Configuration options for Google OAuth2
export interface GoogleOAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
  defaultScopes?: string[];
}

// OAuth2 Token Response
export interface GoogleOAuth2Tokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
  id_token?: string;
  expires_at?: number; // Epoch timestamp in milliseconds
}

// User Profile from Gmail API
export interface GmailUserProfile {
  emailAddress: string;
  messagesTotal: number;
  threadsTotal: number;
  historyId: string;
}

// Parsed Email Address
export interface ParsedEmailAddress {
  name: string;
  email: string;
}

// Email Attachment Info
export interface GmailAttachmentInfo {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// Parsed Email Structure
export interface GmailParsedEmail {
  id: string;
  threadId: string;
  snippet: string;
  historyId?: string;
  internalDate: string;
  date: Date | null;
  from: ParsedEmailAddress;
  to: ParsedEmailAddress[];
  cc: ParsedEmailAddress[];
  bcc: ParsedEmailAddress[];
  subject: string;
  messageIdHeader?: string;
  inReplyToHeader?: string;
  referencesHeader?: string;
  textBody: string;
  htmlBody?: string;
  labelIds: string[];
  attachments: GmailAttachmentInfo[];
  isUnread: boolean;
  isStarred: boolean;
}

// Parameters for listing emails
export interface FetchEmailsOptions {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

// Paginated Email List Response
export interface FetchEmailsResult {
  emails: GmailParsedEmail[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

// Gmail API raw message payload parts
interface GmailMessagePart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: {
    size?: number;
    data?: string;
    attachmentId?: string;
  };
  parts?: GmailMessagePart[];
}

// Gmail API raw message structure
interface GmailRawMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
  sizeEstimate?: number;
  raw?: string;
}

/**
 * Safely decodes base64url strings returned by the Gmail API
 */
export function decodeBase64Url(input: string): string {
  if (!input) return "";
  try {
    const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

    // In Node.js environment
    if (typeof Buffer !== "undefined") {
      return Buffer.from(padded, "base64").toString("utf-8");
    }

    // In browser environment
    const binary = atob(padded);
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

/**
 * Parses RFC 2822 email address strings like 'John Doe <john@example.com>' or 'john@example.com'
 */
export function parseEmailHeaderAddress(raw: string): ParsedEmailAddress {
  if (!raw) return { name: "", email: "" };
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1] ? match[1].trim() : match[2] || trimmed,
      email: match[2] ? match[2].trim().toLowerCase() : trimmed.toLowerCase(),
    };
  }
  return { name: trimmed, email: trimmed.toLowerCase() };
}

/**
 * Parses a comma-separated list of email addresses
 */
export function parseEmailAddressList(raw: string): ParsedEmailAddress[] {
  if (!raw) return [];
  // Split on commas not enclosed in quotes
  const parts = raw.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
  return parts.map((part) => parseEmailHeaderAddress(part.trim())).filter((addr) => addr.email);
}

/**
 * Recursively extracts plain text, HTML bodies, and attachment metadata from Gmail payload parts
 */
export function extractBodyAndAttachments(payload?: GmailMessagePart): {
  text: string;
  html?: string;
  attachments: GmailAttachmentInfo[];
} {
  let text = "";
  let html = "";
  const attachments: GmailAttachmentInfo[] = [];

  function walk(part?: GmailMessagePart) {
    if (!part) return;

    // Check for attachments
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        attachmentId: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
      });
    }

    // Extract text content
    if (part.mimeType === "text/plain" && part.body?.data && !text) {
      text = decodeBase64Url(part.body.data);
    } else if (part.mimeType === "text/html" && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }

    // Recursively walk subparts
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
 * Parses a raw Gmail API message response into a structured GmailParsedEmail object
 */
export function parseGmailMessage(raw: GmailRawMessage): GmailParsedEmail {
  const headers = raw.payload?.headers || [];
  const getHeader = (name: string): string => {
    const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
    return found ? found.value : "";
  };

  const fromRaw = getHeader("From");
  const toRaw = getHeader("To");
  const ccRaw = getHeader("Cc");
  const bccRaw = getHeader("Bcc");
  const subject = getHeader("Subject") || "(No Subject)";
  const dateStr = getHeader("Date");
  const messageIdHeader = getHeader("Message-ID");
  const inReplyToHeader = getHeader("In-Reply-To");
  const referencesHeader = getHeader("References");

  const date = dateStr
    ? new Date(dateStr)
    : raw.internalDate
      ? new Date(Number(raw.internalDate))
      : null;
  const { text, html, attachments } = extractBodyAndAttachments(raw.payload);

  const labelIds = raw.labelIds || [];
  const isUnread = labelIds.includes("UNREAD");
  const isStarred = labelIds.includes("STARRED");

  return {
    id: raw.id,
    threadId: raw.threadId,
    snippet: raw.snippet || "",
    historyId: raw.historyId,
    internalDate: raw.internalDate || "",
    date,
    from: parseEmailHeaderAddress(fromRaw),
    to: parseEmailAddressList(toRaw),
    cc: parseEmailAddressList(ccRaw),
    bcc: parseEmailAddressList(bccRaw),
    subject,
    messageIdHeader: messageIdHeader || undefined,
    inReplyToHeader: inReplyToHeader || undefined,
    referencesHeader: referencesHeader || undefined,
    textBody: text,
    htmlBody: html,
    labelIds,
    attachments,
    isUnread,
    isStarred,
  };
}

/**
 * Google OAuth2 and Gmail API Service
 */
export class GoogleOAuth2GmailService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private defaultScopes: string[];

  constructor(config?: Partial<GoogleOAuth2Config>) {
    // 1. Resolve Client ID from environment variables, config, or firebase-applet-config.json
    const resolvedClientId =
      config?.clientId ||
      (typeof process !== "undefined" ? process.env?.GOOGLE_CLIENT_ID : undefined) ||
      (typeof process !== "undefined" ? process.env?.CLIENT_ID : undefined) ||
      (typeof process !== "undefined" ? process.env?.VITE_GOOGLE_CLIENT_ID : undefined) ||
      (firebaseConfig as { oAuthClientId?: string })?.oAuthClientId ||
      "";

    // 2. Resolve Client Secret from environment variables
    const resolvedClientSecret =
      config?.clientSecret ||
      (typeof process !== "undefined" ? process.env?.GOOGLE_CLIENT_SECRET : undefined) ||
      (typeof process !== "undefined" ? process.env?.CLIENT_SECRET : undefined) ||
      "";

    this.clientId = resolvedClientId;
    this.clientSecret = resolvedClientSecret;
    this.redirectUri = config?.redirectUri || "http://localhost:3000/api/auth/google/callback";
    this.defaultScopes = config?.defaultScopes || DEFAULT_GMAIL_SCOPES;
  }

  /**
   * Retrieves the configured client credentials
   */
  public getCredentials(): { clientId: string; hasClientSecret: boolean } {
    return {
      clientId: this.clientId,
      hasClientSecret: Boolean(this.clientSecret),
    };
  }

  /**
   * Checks if OAuth2 credentials are configured
   */
  public isConfigured(): boolean {
    return Boolean(this.clientId);
  }

  /**
   * Generates the Google OAuth2 consent URL
   */
  public generateAuthUrl(options?: {
    redirectUri?: string;
    scopes?: string[];
    state?: string;
    prompt?: "consent" | "select_account" | "none";
    accessType?: "offline" | "online";
    loginHint?: string;
  }): string {
    if (!this.clientId) {
      throw new Error(
        "Google OAuth2 is not configured. Please set GOOGLE_CLIENT_ID in your environment variables.",
      );
    }

    const redirect = options?.redirectUri || this.redirectUri;
    const scopes = (options?.scopes || this.defaultScopes).join(" ");
    const state = options?.state || "";
    const prompt = options?.prompt || "select_account";
    const accessType = options?.accessType || "offline";

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirect,
      response_type: "code",
      scope: scopes,
      access_type: accessType,
      prompt: prompt,
      include_granted_scopes: "true",
    });

    if (state) {
      params.append("state", state);
    }
    if (options?.loginHint) {
      params.append("login_hint", options.loginHint);
    }

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchanges an authorization code for access and refresh tokens
   */
  public async exchangeCodeForTokens(
    code: string,
    redirectUri?: string,
  ): Promise<GoogleOAuth2Tokens> {
    if (!this.clientId) {
      throw new Error("GOOGLE_CLIENT_ID environment variable is missing.");
    }
    if (!this.clientSecret) {
      throw new Error(
        "GOOGLE_CLIENT_SECRET or CLIENT_SECRET environment variable is required to exchange authorization codes.",
      );
    }

    const redirect = redirectUri || this.redirectUri;
    const bodyParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code: code,
      grant_type: "authorization_code",
      redirect_uri: redirect,
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to exchange Google OAuth2 code: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_in: expiresIn,
      token_type: data.token_type || "Bearer",
      scope: data.scope,
      id_token: data.id_token,
      expires_at: expiresAt,
    };
  }

  /**
   * Refreshes an expired access token using the stored refresh token
   */
  public async refreshAccessToken(refreshToken: string): Promise<GoogleOAuth2Tokens> {
    if (!this.clientId) {
      throw new Error("GOOGLE_CLIENT_ID environment variable is missing.");
    }
    if (!this.clientSecret) {
      throw new Error(
        "GOOGLE_CLIENT_SECRET or CLIENT_SECRET environment variable is missing for token refresh.",
      );
    }
    if (!refreshToken) {
      throw new Error("Refresh token is required.");
    }

    const bodyParams = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Google token refresh failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const expiresIn = data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken,
      expires_in: expiresIn,
      token_type: data.token_type || "Bearer",
      scope: data.scope,
      id_token: data.id_token,
      expires_at: expiresAt,
    };
  }

  /**
   * Revokes an access or refresh token
   */
  public async revokeToken(token: string): Promise<boolean> {
    if (!token) return false;
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetches the authenticated user's Gmail profile
   */
  public async getProfile(accessToken: string): Promise<GmailUserProfile> {
    if (!accessToken) {
      throw new Error("Access token is required to fetch Gmail profile.");
    }

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API profile error (${response.status}): ${errorText}`);
    }

    return (await response.json()) as GmailUserProfile;
  }

  /**
   * Lists message identifiers matching search and pagination filters
   */
  public async listMessageIds(
    accessToken: string,
    options?: FetchEmailsOptions,
  ): Promise<{
    messages: Array<{ id: string; threadId: string }>;
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }> {
    if (!accessToken) {
      throw new Error("Access token is required to query Gmail messages.");
    }

    const queryParams = new URLSearchParams();
    if (options?.query) queryParams.append("q", options.query);
    if (options?.maxResults) queryParams.append("maxResults", String(options.maxResults));
    if (options?.pageToken) queryParams.append("pageToken", options.pageToken);
    if (options?.includeSpamTrash) queryParams.append("includeSpamTrash", "true");
    if (options?.labelIds && options.labelIds.length > 0) {
      for (const label of options.labelIds) {
        queryParams.append("labelIds", label);
      }
    }

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?${queryParams.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API list messages error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      messages: data.messages || [],
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate,
    };
  }

  /**
   * Fetches an individual raw message by messageId
   */
  public async getRawMessage(
    messageId: string,
    accessToken: string,
    format: "full" | "metadata" | "minimal" | "raw" = "full",
  ): Promise<GmailRawMessage> {
    if (!accessToken) {
      throw new Error("Access token is required to get a message.");
    }

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=${format}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Gmail API get message error for ${messageId} (${response.status}): ${errorText}`,
      );
    }

    return (await response.json()) as GmailRawMessage;
  }

  /**
   * Fetches an individual parsed email by messageId
   */
  public async fetchEmailById(messageId: string, accessToken: string): Promise<GmailParsedEmail> {
    const raw = await this.getRawMessage(messageId, accessToken, "full");
    return parseGmailMessage(raw);
  }

  /**
   * High-level function to fetch and parse a batch of emails
   */
  public async fetchEmails(
    accessToken: string,
    options?: FetchEmailsOptions,
  ): Promise<FetchEmailsResult> {
    const listResult = await this.listMessageIds(accessToken, options);
    if (!listResult.messages || listResult.messages.length === 0) {
      return {
        emails: [],
        nextPageToken: listResult.nextPageToken,
        resultSizeEstimate: listResult.resultSizeEstimate,
      };
    }

    // Fetch individual messages in bounded concurrent chunks (5 at a time) to prevent throttling
    const emails: GmailParsedEmail[] = [];
    const chunkSize = 5;

    for (let i = 0; i < listResult.messages.length; i += chunkSize) {
      const chunk = listResult.messages.slice(i, i + chunkSize);
      const promises = chunk.map(async (msgRef) => {
        try {
          return await this.fetchEmailById(msgRef.id, accessToken);
        } catch (err) {
          console.warn(`[GoogleOAuth2GmailService] Failed to fetch message ${msgRef.id}:`, err);
          return null;
        }
      });

      const chunkResults = await Promise.all(promises);
      for (const email of chunkResults) {
        if (email) {
          emails.push(email);
        }
      }
    }

    return {
      emails,
      nextPageToken: listResult.nextPageToken,
      resultSizeEstimate: listResult.resultSizeEstimate,
    };
  }

  /**
   * Fetches raw attachment bytes from Gmail API
   */
  public async fetchAttachment(
    messageId: string,
    attachmentId: string,
    accessToken: string,
  ): Promise<{ size: number; data: string }> {
    if (!accessToken) {
      throw new Error("Access token is required to fetch attachment.");
    }

    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(
      messageId,
    )}/attachments/${encodeURIComponent(attachmentId)}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API attachment error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return {
      size: data.size || 0,
      data: data.data || "",
    };
  }
}

// Export default singleton instance initialized with environment variables
export const googleOAuth2GmailService = new GoogleOAuth2GmailService();
export default googleOAuth2GmailService;
