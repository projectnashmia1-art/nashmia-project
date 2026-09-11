import "./lib/error-capture.ts";

import { consumeLastCapturedError } from "./lib/error-capture.ts";
import { renderErrorPage } from "./lib/error-page.ts";
import { executeServerGmailSync, ensureServerEmailThread } from "./lib/server-gmail-sync.ts";
import { detectForwarderConfirmation } from "./lib/forwarder-confirmation-detector.ts";
import { processAutomaticMovementConfirmation } from "./lib/movement-confirmation-engine.ts";
import { processIncomingEmailReply } from "./lib/incoming-reply-processor.ts";
import { analyzeEmailForForwarderOffer } from "./lib/ai-offer-extractor.ts";
import { supabase } from "./lib/supabase.ts";
import {
  getOrRefreshActiveGmailConnection,
  exchangeAuthCodeForTokens,
  saveDirectConnection,
  disconnectGmailConnection,
} from "./lib/server-gmail-token.ts";

import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";

const startHandler = createStartHandler(defaultStreamHandler);

const apiCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Background Gmail Sync Worker — ensures incoming emails are synchronized continuously
// without relying only on frontend polling or browser state
let backendSyncTimer: ReturnType<typeof setInterval> | null = null;
let isSyncRunning = false;

function startBackgroundSyncWorker() {
  if (backendSyncTimer) return;

  const runSync = async () => {
    if (isSyncRunning) return;
    isSyncRunning = true;
    try {
      await executeServerGmailSync({ maxResults: 10 });
    } catch (err) {
      console.warn("[BackgroundSyncWorker] Periodic sync notice:", err);
    } finally {
      isSyncRunning = false;
    }
  };

  // Initial run shortly after startup
  setTimeout(runSync, 2000);
  // Recurring interval every 20 seconds (20,000ms) so incoming emails appear in real-time
  backendSyncTimer = setInterval(runSync, 20000);
}

// Start worker immediately on server load
startBackgroundSyncWorker();

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      startBackgroundSyncWorker();
      const url = new URL(request.url);

      // Handle OPTIONS preflight requests for API
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return new Response(null, { status: 204, headers: apiCorsHeaders });
      }

      // Check Active Gmail Connection & Auto-refresh Expired Access Tokens
      if (
        url.pathname === "/api/gmail/connection-status" &&
        (request.method === "GET" || request.method === "POST")
      ) {
        try {
          let userId: string | null = url.searchParams.get("userId");
          let forceRefresh = url.searchParams.get("forceRefresh") === "true";

          if (request.method === "POST") {
            try {
              const body = (await request.json()) as { userId?: string; forceRefresh?: boolean };
              if (body.userId) userId = body.userId;
              if (body.forceRefresh !== undefined) forceRefresh = body.forceRefresh;
            } catch {
              // Ignore empty body
            }
          }

          const { connection, error } = await getOrRefreshActiveGmailConnection(
            userId,
            forceRefresh,
          );

          if (!connection || connection.status === "disconnected") {
            return new Response(
              JSON.stringify({
                isConnected: false,
                email: null,
                displayName: null,
                avatarUrl: null,
                lastSyncAt: null,
                tokenExpiresAt: null,
                accessToken: null,
              }),
              {
                status: 200,
                headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          // Return active status with fresh accessToken
          // NOTE: refresh_token is NEVER exposed in the frontend response!
          return new Response(
            JSON.stringify({
              isConnected: true,
              email: connection.google_email,
              displayName: connection.display_name || connection.google_email,
              avatarUrl: connection.avatar_url || null,
              lastSyncAt: connection.last_sync_at || null,
              tokenExpiresAt: connection.token_expires_at || null,
              accessToken: connection.access_token,
              warning: error,
            }),
            {
              status: 200,
              headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ isConnected: false, error: msg }), {
            status: 500,
            headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Exchange OAuth 2.0 Authorization Code (access_type=offline) for tokens
      if (url.pathname === "/api/gmail/oauth/exchange" && request.method === "POST") {
        try {
          const payload = (await request.json()) as {
            code: string;
            redirectUri?: string;
            userId?: string | null;
          };

          if (!payload.code) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing authorization code" }),
              {
                status: 400,
                headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const result = await exchangeAuthCodeForTokens(
            payload.code,
            payload.redirectUri || "postmessage",
            payload.userId,
          );

          return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 400,
            headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Save Direct Connection (e.g. from popup or re-authorization)
      if (url.pathname === "/api/gmail/save-connection" && request.method === "POST") {
        try {
          const payload = (await request.json()) as {
            accessToken: string;
            refreshToken?: string | null;
            expiresIn?: number;
            email: string;
            displayName?: string | null;
            avatarUrl?: string | null;
            googleUserId?: string | null;
            userId?: string | null;
          };

          if (!payload.accessToken || !payload.email) {
            return new Response(
              JSON.stringify({ success: false, error: "Missing required token or email" }),
              {
                status: 400,
                headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          const saved = await saveDirectConnection(payload);

          return new Response(
            JSON.stringify({
              success: true,
              email: saved.google_email,
              displayName: saved.display_name,
              avatarUrl: saved.avatar_url,
              tokenExpiresAt: saved.token_expires_at,
              accessToken: saved.access_token,
            }),
            {
              status: 200,
              headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
            },
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Disconnect Gmail Connection
      if (url.pathname === "/api/gmail/disconnect" && request.method === "POST") {
        try {
          const payload = (await request.json().catch(() => ({}))) as {
            userId?: string | null;
            email?: string | null;
          };
          await disconnectGmailConnection(payload.userId, payload.email);

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ success: false, error: msg }), {
            status: 500,
            headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Secure Server-Side Gmail Reply Sync Endpoint
      if (url.pathname === "/api/gmail/sync-replies" || url.pathname === "/api/gmail/sync") {
        let bodyPayload: {
          userId?: string;
          accessToken?: string;
          userEmail?: string;
          maxResults?: number;
        } = {};

        if (request.method === "POST") {
          try {
            bodyPayload = await request.json();
          } catch {
            // Empty body is acceptable
          }
        } else if (request.method === "GET") {
          const userIdParam = url.searchParams.get("userId");
          const maxResultsParam = url.searchParams.get("maxResults");
          if (userIdParam) bodyPayload.userId = userIdParam;
          if (maxResultsParam) bodyPayload.maxResults = parseInt(maxResultsParam, 10);
        }

        const authHeader = request.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ") && !bodyPayload.accessToken) {
          const tokenCandidate = authHeader.replace("Bearer ", "").trim();
          // Check if token looks like Google OAuth token (starts with ya29.)
          if (tokenCandidate.startsWith("ya29.")) {
            bodyPayload.accessToken = tokenCandidate;
          }
        }

        const syncResult = await executeServerGmailSync(bodyPayload);

        return new Response(JSON.stringify(syncResult), {
          status: syncResult.success ? 200 : 500,
          headers: {
            ...apiCorsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // Forwarder Confirmation Detection Endpoint (Step 4)
      if (url.pathname === "/api/emails/detect-confirmation" && request.method === "POST") {
        try {
          const payload = await request.json();
          const detection = await detectForwarderConfirmation({
            emailMessageId: payload.emailMessageId,
            subject: payload.subject || "",
            body: payload.body || "",
            snippet: payload.snippet || "",
            senderEmail: payload.senderEmail || payload.fromEmail || "",
            senderName: payload.senderName || "",
            movementNumber: payload.movementNumber,
            forwarderName: payload.forwarderName,
            matchStatus: payload.matchStatus || "MATCHED",
          });

          return new Response(JSON.stringify({ success: true, detection }), {
            status: 200,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        }
      }

      // Step 5: Automatic Movement Confirmation Endpoint
      if (url.pathname === "/api/movements/auto-confirm" && request.method === "POST") {
        try {
          const payload = await request.json();
          const result = await processAutomaticMovementConfirmation({
            bookingId: payload.bookingId,
            movementId: payload.movementId,
            movementNumber: payload.movementNumber,
            forwarderId: payload.forwarderId,
            forwarderName: payload.forwarderName,
            emailMessageId: payload.emailMessageId || payload.id,
            gmailMessageId: payload.gmailMessageId,
            gmailThreadId: payload.gmailThreadId,
            senderEmail: payload.senderEmail || payload.fromEmail || "",
            senderName: payload.senderName || "",
            direction: payload.direction || "inbound",
            matchStatus: payload.matchStatus || "MATCHED",
            matchedBy: payload.matchedBy || "MOVEMENT_NUMBER",
            isForwarderValidated: payload.isForwarderValidated !== false,
            confirmationStatus: payload.confirmationStatus || "CONFIRMED",
            confidence: payload.confidence ?? 0.95,
            reason: payload.reason || "Manual / automated confirmation trigger",
            detectedBy: payload.detectedBy || "API_TRIGGER",
            details: payload.details,
            userId: payload.userId,
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        }
      }

      // Step 6: Process Incoming Email Reply Endpoint
      // Flow: email_messages -> Confirmation detected -> Existing Booking/Movement CONFIRMED
      // -> Notification Center "Booking Confirmed" -> Requests Page CONFIRMED -> Dashboard update
      if (url.pathname === "/api/emails/process-reply" && request.method === "POST") {
        try {
          const payload = await request.json();
          let emailMessageId = payload.emailMessageId;

          // If emailMessageId is not provided, but raw email attributes are provided,
          // save to email_messages first (per requirement: "After the incoming email is successfully saved to email_messages, process the reply")
          if (!emailMessageId) {
            const senderEmail = payload.senderEmail || payload.fromEmail || "forwarder@example.com";
            const subject = payload.subject || "Booking confirmed";
            const body = payload.body || "Booking confirmed";
            const gmailThreadId = payload.gmailThreadId || null;
            const gmailMessageId = payload.gmailMessageId || `msg-${Date.now()}`;

            let threadId: string | null = payload.threadId || null;
            if (gmailThreadId && !threadId) {
              const { data: exThread } = await supabase
                .from("email_threads")
                .select("id")
                .eq("gmail_thread_id", gmailThreadId)
                .maybeSingle();
              if (exThread) {
                threadId = exThread.id;
              }
            }
            if (!threadId) {
              threadId = await ensureServerEmailThread(supabase, {
                gmailThreadId,
                subject,
                snippet: (body || subject).slice(0, 120),
                receivedAt: new Date().toISOString(),
                accountUserId: payload.userId,
                accountEmail: payload.senderEmail,
              });
            }

            if (!threadId) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "Failed to resolve or create an email thread in Supabase",
                }),
                {
                  status: 500,
                  headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
                },
              );
            }

            // Check if already in email_messages
            const { data: existingSaved } = await supabase
              .from("email_messages")
              .select("id")
              .eq("gmail_message_id", gmailMessageId)
              .maybeSingle();

            let savedMsg = existingSaved;
            if (!savedMsg) {
              const { data: newSaved, error: saveErr } = await supabase
                .from("email_messages")
                .insert({
                  thread_id: threadId,
                  sender_email: senderEmail,
                  sender_name: payload.senderName || "Forwarder",
                  recipient_email: payload.recipientEmail || "operations@nashmia.com",
                  subject,
                  body,
                  direction: "Inbound",
                  gmail_message_id: gmailMessageId,
                  raw_headers: {
                    gmail_thread_id: gmailThreadId,
                    gmail_message_id: gmailMessageId,
                    subject,
                    body,
                    from_email: senderEmail,
                  },
                })
                .select()
                .maybeSingle();

              if (newSaved) {
                savedMsg = newSaved;
              } else if (
                saveErr?.code === "23505" ||
                saveErr?.message?.includes("duplicate") ||
                saveErr?.message?.includes("already exists")
              ) {
                const { data: found } = await supabase
                  .from("email_messages")
                  .select("id")
                  .eq("gmail_message_id", gmailMessageId)
                  .maybeSingle();
                savedMsg = found;
              } else {
                console.error("[server.ts] Error inserting email_messages:", saveErr);
                return new Response(
                  JSON.stringify({
                    success: false,
                    error: saveErr?.message || "Failed to save email_messages",
                  }),
                  {
                    status: 500,
                    headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
                  },
                );
              }
            }

            if (!savedMsg) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "Failed to save or find email_messages record",
                }),
                {
                  status: 500,
                  headers: { ...apiCorsHeaders, "Content-Type": "application/json" },
                },
              );
            }
            emailMessageId = savedMsg.id;
          }

          // Fetch message record if needed
          const { data: emailRecord } = await supabase
            .from("email_messages")
            .select("*")
            .eq("id", emailMessageId)
            .maybeSingle();

          const rawHeaders = (emailRecord?.raw_headers as Record<string, unknown>) || {};

          const result = await processIncomingEmailReply(supabase, {
            emailMessageId,
            gmailThreadId: payload.gmailThreadId || (rawHeaders.gmail_thread_id as string) || null,
            gmailMessageId: payload.gmailMessageId || emailRecord?.gmail_message_id || null,
            subject: payload.subject || emailRecord?.subject || "",
            body: payload.body || emailRecord?.body || "",
            snippet: payload.snippet || (rawHeaders.snippet as string) || "",
            senderEmail: payload.senderEmail || emailRecord?.sender_email || "",
            senderName: payload.senderName || emailRecord?.sender_name || "",
            recipientEmail: payload.recipientEmail || emailRecord?.recipient_email || null,
            direction: payload.direction || emailRecord?.direction || "Inbound",
            userId: payload.userId || null,
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        }
      }

      // API Route: Analyze forwarder email using AI / document understanding
      if (url.pathname === "/api/emails/analyze-offer" && request.method === "POST") {
        try {
          const payload = (await request.json()) as {
            subject?: string;
            body?: string;
            snippet?: string;
            senderEmail?: string;
            senderName?: string;
            movementNumber?: string;
            forwarderName?: string;
            containerCount?: number;
            containerSize?: string;
          };

          const analysis = await analyzeEmailForForwarderOffer({
            subject: payload.subject || "",
            body: payload.body || "",
            snippet: payload.snippet || "",
            senderEmail: payload.senderEmail || "",
            senderName: payload.senderName || "",
            movementNumber: payload.movementNumber || null,
            forwarderName: payload.forwarderName || null,
            containerCount: payload.containerCount || 1,
            containerSize: payload.containerSize || "40HC",
          });

          return new Response(JSON.stringify({ success: true, ...analysis }), {
            status: 200,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return new Response(JSON.stringify({ success: false, error: message }), {
            status: 500,
            headers: {
              ...apiCorsHeaders,
              "Content-Type": "application/json",
            },
          });
        }
      }

      const response = await startHandler(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error("[Server Error]", error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
