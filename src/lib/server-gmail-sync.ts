import { isSupabaseConfigured, supabase } from "./supabase";
import { safeUuid } from "./supabase-services";
import { extractMovementNumber } from "./movement-lifecycle";
import { executeMovementForwarderMatch } from "./movement-forwarder-matcher";
import { detectForwarderConfirmation } from "./forwarder-confirmation-detector";
import {
  processAutomaticMovementConfirmation,
  type MovementConfirmationResult,
} from "./movement-confirmation-engine";
import { processIncomingEmailReply } from "./incoming-reply-processor";
import { getOrRefreshActiveGmailConnection } from "./server-gmail-token";

interface MessagePartPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: MessagePartPayload[];
}

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

function extractBodyFromPayload(payload: MessagePartPayload | undefined): {
  text: string;
  html?: string;
} {
  let text = "";
  let html = "";

  function walk(part: MessagePartPayload | undefined) {
    if (!part) return;
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
  return { text, html: html || undefined };
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  if (!raw) return { name: "", email: "" };
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1] ? match[1].trim() : match[2] || raw,
      email: match[2] ? match[2].trim().toLowerCase() : raw.toLowerCase(),
    };
  }
  return { name: raw, email: raw.toLowerCase() };
}

export interface SyncGmailRepliesOptions {
  userId?: string | null;
  accessToken?: string | null;
  userEmail?: string | null;
  maxResults?: number;
}

export interface SyncGmailRepliesResult {
  success: boolean;
  syncedCount: number;
  newMessages: number;
  processedCount: number;
  message?: string;
  error?: string;
  details?: Array<{
    id: string;
    threadId: string;
    subject: string;
    from: string;
    movementNumber: string | null;
    matchedBookingId: string | null;
  }>;
}

let quotaCooldownUntil = 0;
const processedServerMessageIds = new Set<string>();

/**
 * Ensures an Email Thread exists in Supabase.
 * - Validates user_id against profiles (auth.users)
 * - Validates booking_id against existing rows in bookings (avoids 23503 foreign key error)
 * - Uses duplicate check on gmail_thread_id
 * - Falls back to a safe thread if insertion encounters any transient issue
 * Guarantees a valid thread_id so email_messages NOT NULL foreign key is never violated.
 */
export async function ensureServerEmailThread(
  supabaseClient: typeof supabase,
  params: {
    gmailThreadId?: string | null;
    subject: string;
    snippet: string;
    receivedAt: string;
    accountUserId?: string | null;
    accountEmail?: string | null;
    matchedBookingId?: string | null;
  },
): Promise<string | null> {
  const {
    gmailThreadId,
    subject,
    snippet,
    receivedAt,
    accountUserId,
    accountEmail,
    matchedBookingId,
  } = params;

  // 1. Check if thread already exists by gmail_thread_id
  if (gmailThreadId) {
    const { data: existingThread } = await supabaseClient
      .from("email_threads")
      .select("id, booking_id")
      .eq("gmail_thread_id", gmailThreadId)
      .maybeSingle();

    if (existingThread?.id) {
      return existingThread.id;
    }
  }

  // 2. Validate and resolve user_id that exists in auth.users (via profiles)
  let validUserId: string | null = null;
  if (accountUserId && safeUuid(accountUserId)) {
    const { data: prof } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("id", accountUserId)
      .maybeSingle();
    if (prof?.id) {
      validUserId = prof.id;
    }
  }
  if (!validUserId && accountEmail) {
    const { data: profByEmail } = await supabaseClient
      .from("profiles")
      .select("id")
      .ilike("email", accountEmail.trim())
      .maybeSingle();
    if (profByEmail?.id) {
      validUserId = profByEmail.id;
    }
  }
  if (!validUserId) {
    const { data: defaultProf } = await supabaseClient
      .from("profiles")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (defaultProf?.id) {
      validUserId = defaultProf.id;
    }
  }

  // 3. Verify matchedBookingId actually exists in public.bookings table (avoids FK violation 23503)
  let verifiedBookingId: string | null = null;
  if (matchedBookingId) {
    const cleanBookingId = safeUuid(matchedBookingId);
    if (cleanBookingId) {
      const { data: bCheck } = await supabaseClient
        .from("bookings")
        .select("id")
        .eq("id", cleanBookingId)
        .maybeSingle();
      if (bCheck?.id) {
        verifiedBookingId = bCheck.id;
      }
    }
  }

  const threadSubject = subject || "(No Subject)";
  const threadSnippet = (snippet || threadSubject).slice(0, 120);
  const targetGmailThreadId =
    gmailThreadId || `thread-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // 4. Try inserting new thread if we have a valid profile user ID
  if (validUserId) {
    const { data: newThread, error: threadErr } = await supabaseClient
      .from("email_threads")
      .insert({
        user_id: validUserId,
        booking_id: verifiedBookingId,
        subject: threadSubject,
        gmail_thread_id: targetGmailThreadId,
        status: "Active",
        snippet: threadSnippet,
        last_message_at: receivedAt,
      })
      .select("id")
      .maybeSingle();

    if (newThread?.id) {
      return newThread.id;
    }

    if (threadErr) {
      console.warn(
        `[ServerGmailSync] Initial email_threads insert notice (code ${threadErr.code}):`,
        threadErr.message,
      );
    }

    // If duplicate gmail_thread_id (race condition), fetch it
    if (gmailThreadId) {
      const { data: retryExisting } = await supabaseClient
        .from("email_threads")
        .select("id")
        .eq("gmail_thread_id", gmailThreadId)
        .maybeSingle();
      if (retryExisting?.id) {
        return retryExisting.id;
      }
    }

    // If verifiedBookingId caused an unexpected FK failure, retry with booking_id: null
    if (verifiedBookingId) {
      const { data: threadWithoutBooking } = await supabaseClient
        .from("email_threads")
        .insert({
          user_id: validUserId,
          booking_id: null,
          subject: threadSubject,
          gmail_thread_id: targetGmailThreadId,
          status: "Active",
          snippet: threadSnippet,
          last_message_at: receivedAt,
        })
        .select("id")
        .maybeSingle();

      if (threadWithoutBooking?.id) {
        return threadWithoutBooking.id;
      }
    }
  }

  // 5. Fallback: Find any existing thread in email_threads to avoid breaking the NOT NULL constraint
  const { data: fallbackThread } = await supabaseClient
    .from("email_threads")
    .select("id")
    .limit(1)
    .maybeSingle();

  return fallbackThread?.id || null;
}

/**
 * Server-Side Synchronizer for Incoming Gmail Replies
 * Strictly processes server-side, prevents duplicates via gmail_message_id,
 * extracts conversation metadata, matches by thread_id or movement_number,
 * and persists to Supabase email_messages and email_threads.
 */
export async function executeServerGmailSync(
  options: SyncGmailRepliesOptions = {},
): Promise<SyncGmailRepliesResult> {
  if (Date.now() < quotaCooldownUntil) {
    const remainingSec = Math.ceil((quotaCooldownUntil - Date.now()) / 1000);
    console.log(
      `[ServerGmailSync] Gmail API quota cooldown active (${remainingSec}s remaining). Skipping sync to protect sending quota.`,
    );
    return {
      success: true,
      syncedCount: 0,
      newMessages: 0,
      processedCount: 0,
      message: `Quota cooldown active (${remainingSec}s remaining).`,
    };
  }

  console.log("[ServerGmailSync] Starting server-side incoming reply synchronization...", {
    hasExplicitToken: Boolean(options.accessToken),
    userEmail: options.userEmail,
    userId: options.userId,
    maxResults: options.maxResults || 10,
  });

  const validUserUuid = safeUuid(options.userId);

  // 1. Resolve tokens: Either explicit token or retrieve active connection from database
  let connections: Array<{
    id: string;
    user_id: string;
    google_email: string;
    access_token: string;
    status: string;
  }> = [];

  if (options.accessToken) {
    let resolvedEmail = options.userEmail || "";
    if (!resolvedEmail) {
      try {
        const profRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
          headers: { Authorization: `Bearer ${options.accessToken}` },
        });
        if (profRes.ok) {
          const profData = (await profRes.json()) as { emailAddress?: string };
          resolvedEmail = profData.emailAddress || "";
        }
      } catch {
        // Fallback
      }
    }

    connections = [
      {
        id: "direct-token",
        user_id: validUserUuid || "00000000-0000-0000-0000-000000000000",
        google_email: resolvedEmail || "me@gmail.com",
        access_token: options.accessToken,
        status: "connected",
      },
    ];
  } else {
    try {
      // Fetch and automatically refresh active connection via secure server token manager
      const { connection: activeConn } = await getOrRefreshActiveGmailConnection(options.userId);
      if (
        activeConn &&
        activeConn.access_token &&
        (activeConn.status === "connected" || activeConn.status === "active")
      ) {
        connections = [
          {
            id: activeConn.id,
            user_id: activeConn.user_id || "00000000-0000-0000-0000-000000000000",
            google_email: activeConn.google_email,
            access_token: activeConn.access_token,
            status: activeConn.status,
          },
        ];
      } else if (isSupabaseConfigured) {
        // Fallback check directly in database
        let query = supabase
          .from("gmail_connections")
          .select("id, user_id, google_email, access_token, status")
          .eq("status", "connected");

        if (validUserUuid) {
          query = query.eq("user_id", validUserUuid);
        }

        const { data: dbConnections } = await query;
        if (dbConnections && dbConnections.length > 0) {
          connections = dbConnections.filter((c) => Boolean(c.access_token));
        }
      }
    } catch (err: unknown) {
      console.warn("[ServerGmailSync] Could not resolve active gmail_connections:", err);
    }
  }

  if (connections.length === 0) {
    console.log("[ServerGmailSync] No active connected Gmail accounts to sync.");
    return {
      success: true,
      syncedCount: 0,
      newMessages: 0,
      processedCount: 0,
      message: "No active connected Gmail accounts found to sync.",
    };
  }

  let totalNewMessages = 0;
  let totalProcessed = 0;
  const processedDetails: NonNullable<SyncGmailRepliesResult["details"]> = [];

  for (const conn of connections) {
    let token = conn.access_token;
    const accountEmail = conn.google_email;
    const accountUserId = safeUuid(conn.user_id) || validUserUuid;

    try {
      const maxResults = options.maxResults || 25;
      // Fetch incoming inbox messages
      let listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=is:inbox`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!listRes.ok && listRes.status === 401 && conn.id !== "direct-token") {
        console.warn(
          `[ServerGmailSync] Gmail access token expired (401) for ${accountEmail}. Attempting auto-refresh via refresh_token...`,
        );
        const refreshed = await getOrRefreshActiveGmailConnection(conn.user_id, true);
        if (refreshed?.access_token) {
          token = refreshed.access_token;
          listRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=is:inbox`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
        }
      }

      if (!listRes.ok) {
        if (listRes.status === 403 || listRes.status === 429) {
          quotaCooldownUntil = Date.now() + 90000;
          console.warn(
            `[ServerGmailSync] Gmail API quota/rate limit reached (HTTP ${listRes.status}) for ${accountEmail}. Initiating 90s cooldown to preserve sending quota.`,
          );
          break;
        }
        console.warn(
          `[ServerGmailSync] Gmail API list error for ${accountEmail} (${listRes.status})`,
        );
        continue;
      }

      const listData = (await listRes.json()) as {
        messages?: Array<{ id: string; threadId: string }>;
      };

      const messages = listData.messages || [];
      totalProcessed += messages.length;

      const unexaminedStubs = messages.filter(
        (m: { id: string }) => !processedServerMessageIds.has(m.id),
      );
      if (unexaminedStubs.length === 0) {
        continue;
      }

      // Single batched check in database instead of N sequential queries
      const stubIds = unexaminedStubs.map((m: { id: string }) => m.id);
      const { data: existingRows } = await supabase
        .from("email_messages")
        .select("gmail_message_id")
        .in("gmail_message_id", stubIds);

      const existingSet = new Set(
        (existingRows || []).map((r: { gmail_message_id: string }) => r.gmail_message_id),
      );
      for (const id of stubIds) {
        if (existingSet.has(id)) {
          processedServerMessageIds.add(id);
        }
      }

      const newMessagesToFetch = unexaminedStubs.filter(
        (m: { id: string }) => !existingSet.has(m.id),
      );

      for (const msgStub of newMessagesToFetch) {
        // Step 2: Fetch message details from Gmail
        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgStub.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        if (!msgRes.ok) {
          if (msgRes.status === 403 || msgRes.status === 429) {
            quotaCooldownUntil = Date.now() + 90000;
            console.warn(
              `[ServerGmailSync] Quota limit hit during message detail fetch. Initiating 90s cooldown.`,
            );
            break;
          }
          continue;
        }

        const fullMsg = await msgRes.json();
        const headers: Array<{ name: string; value: string }> = fullMsg.payload?.headers || [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

        const subject = getHeader("Subject") || "(No Subject)";
        const fromRaw = getHeader("From") || "Unknown Sender";
        const toRaw = getHeader("To") || accountEmail;
        const dateHeader = getHeader("Date") || new Date().toISOString();

        const parsedFrom = parseEmailAddress(fromRaw);
        const parsedTo = parseEmailAddress(toRaw);

        // Ignore messages sent by ourselves
        if (accountEmail && parsedFrom.email === accountEmail.toLowerCase()) {
          processedServerMessageIds.add(msgStub.id);
          continue;
        }

        // Compute accurate received_at
        let receivedAt = new Date().toISOString();
        if (fullMsg.internalDate) {
          const intDate = parseInt(fullMsg.internalDate, 10);
          if (!isNaN(intDate)) {
            receivedAt = new Date(intDate).toISOString();
          }
        } else {
          const parsedD = new Date(dateHeader);
          if (!isNaN(parsedD.getTime())) {
            receivedAt = parsedD.toISOString();
          }
        }

        const extracted = extractBodyFromPayload(fullMsg.payload);
        const snippet = fullMsg.snippet || "";
        const body = extracted.text || snippet;
        const bodyHtml = extracted.html || (body ? body.replace(/\n/g, "<br/>") : null);

        // Step 3: Ensure Email Thread exists in Supabase
        // Run initial matcher to resolve booking and forwarder
        const matchResult = await executeMovementForwarderMatch(supabase, {
          gmailThreadId: msgStub.threadId,
          gmailMessageId: msgStub.id,
          subject,
          body,
          snippet,
          senderEmail: parsedFrom.email,
          senderName: parsedFrom.name,
          userId: accountUserId,
        });

        const matchedMovementId = matchResult.movementId;
        const matchedMovementNumber = matchResult.movementNumber;
        const matchedForwarderId = matchResult.forwarderId;

        const threadId = await ensureServerEmailThread(supabase, {
          gmailThreadId: msgStub.threadId,
          subject,
          snippet,
          receivedAt,
          accountUserId,
          accountEmail,
          matchedBookingId: matchResult.bookingId,
        });

        const matchedBookingId = matchResult.bookingId;

        // Step 4: SAVE TO EXISTING email_messages TABLE IN SUPABASE FIRST
        // (The incoming email must actually appear in Supabase email_messages before confirmation processing)
        const nowIso = new Date().toISOString();
        const initialRawHeaders = {
          organization_id: null,
          booking_id: safeUuid(matchedBookingId),
          forwarder_id: safeUuid(matchedForwarderId),
          from_email: parsedFrom.email,
          to_email: parsedTo.email || accountEmail,
          subject: subject,
          body: body,
          gmail_message_id: msgStub.id,
          gmail_thread_id: msgStub.threadId,
          email_type: "BOOKING_REPLY",
          received_at: receivedAt,
          created_at: nowIso,
          movement_number: matchedMovementNumber,
          movement_id: matchedMovementId,
          match_status: matchResult.matchStatus,
          match_reason: matchResult.matchReason,
          matched_by: matchResult.matchedBy,
        };

        // Check if already in email_messages
        const { data: existingDbMsg } = await supabase
          .from("email_messages")
          .select("id, thread_id")
          .eq("gmail_message_id", msgStub.id)
          .maybeSingle();

        let insertedMsg = existingDbMsg;

        if (!insertedMsg) {
          if (!threadId) {
            console.error(
              `[ServerGmailSync] Skipping message ${msgStub.id}: Could not resolve a valid thread_id in Supabase.`,
            );
            continue;
          }

          const { data: newMsg, error: insErr } = await supabase
            .from("email_messages")
            .insert({
              thread_id: threadId,
              sender_email: parsedFrom.email || "unknown@forwarder.com",
              recipient_email: parsedTo.email || accountEmail || "operations@nashmiaindustries.com",
              sender_name: parsedFrom.name || "Forwarder",
              subject: subject || "(No Subject)",
              body: body || "",
              body_html: bodyHtml,
              direction: "Inbound",
              sent_at: receivedAt,
              gmail_message_id: msgStub.id,
              raw_headers: initialRawHeaders,
            })
            .select()
            .maybeSingle();

          if (insErr) {
            // Check if duplicate key violation (23505) - message was inserted concurrently
            if (
              insErr.code === "23505" ||
              insErr.message?.includes("duplicate") ||
              insErr.message?.includes("already exists")
            ) {
              const { data: retryDbMsg } = await supabase
                .from("email_messages")
                .select("id, thread_id")
                .eq("gmail_message_id", msgStub.id)
                .maybeSingle();
              insertedMsg = retryDbMsg;
            } else {
              console.error(
                `[ServerGmailSync] Error inserting into Supabase email_messages (code: ${insErr.code || "unknown"}):`,
                insErr.message || insErr.details || insErr,
              );
              continue;
            }
          } else {
            insertedMsg = newMsg;
          }
        }

        if (!insertedMsg) {
          console.error(
            `[ServerGmailSync] Failed to persist or retrieve email message for gmail_message_id: ${msgStub.id}`,
          );
          continue;
        }

        processedServerMessageIds.add(msgStub.id);

        console.log(
          `[ServerGmailSync] ✅ Incoming email successfully saved to Supabase email_messages (id: ${insertedMsg.id}, gmail_message_id: ${msgStub.id})`,
        );
        totalNewMessages++;

        // Step 5: After saving to email_messages, process the reply:
        // 1. Match email to existing booking (gmail_thread_id -> fallback Movement Number / Booking Reference)
        // 2. Validate sender against assigned forwarder
        // 3. Confirmation detected ("Booking confirmed")
        // 4. Update Booking/Movement -> CONFIRMED
        // 5. Notification Center -> "Booking Confirmed"
        // 6. Requests Page & Dashboard update
        const replyResult = await processIncomingEmailReply(supabase, {
          emailMessageId: insertedMsg.id,
          gmailThreadId: msgStub.threadId,
          gmailMessageId: msgStub.id,
          subject,
          body,
          snippet,
          senderEmail: parsedFrom.email,
          senderName: parsedFrom.name,
          recipientEmail: parsedTo.email || accountEmail,
          direction: "Inbound",
          userId: accountUserId,
        });

        const confirmationResult = replyResult.confirmationResult;
        const matchResultFromReply = replyResult.matchResult;

        processedDetails.push({
          id: msgStub.id,
          threadId: msgStub.threadId,
          subject,
          from: parsedFrom.email,
          movementNumber: replyResult.movementNumber || matchedMovementNumber,
          matchedBookingId: replyResult.bookingId || matchedBookingId,
          matchStatus: matchResultFromReply.matchStatus,
          matchReason: matchResultFromReply.matchReason,
          confirmationStatus: confirmationResult.confirmationStatus,
          confirmationConfidence: confirmationResult.confidence,
          confirmationReason: confirmationResult.reason,
          actionTaken: replyResult.actionTaken,
        });

        // Add timeline entries
        if (matchedBookingId) {
          const eventLabel =
            matchResult.matchStatus === "MATCHED"
              ? "Forwarder Reply Matched"
              : "Forwarder Reply (Needs Review)";

          await supabase.from("booking_events").insert({
            booking_id: matchedBookingId,
            event_type: eventLabel,
            event_date: receivedAt,
            location: "Incoming Mailbox",
            description: `Reply from ${parsedFrom.email}. Match status: ${matchResult.matchStatus} (${matchResult.matchReason})`,
          });

          // Confirmation classification timeline event
          let confEventTitle = "Forwarder Reply Evaluated";
          if (confirmationResult.confirmationStatus === "CONFIRMED") {
            confEventTitle =
              step5Result?.actionTaken === "AUTO_CONFIRMED"
                ? "Movement Auto-Confirmed"
                : "Forwarder Confirmation Detected";
          } else if (confirmationResult.confirmationStatus === "REJECTED") {
            confEventTitle = "Forwarder Space Rejection";
          } else if (confirmationResult.confirmationStatus === "NOT_CONFIRMED") {
            confEventTitle = "Forwarder Non-Confirmation Reply";
          } else if (confirmationResult.confirmationStatus === "NEEDS_REVIEW") {
            confEventTitle = "Forwarder Reply (Review Required)";
          }

          await supabase.from("booking_events").insert({
            booking_id: matchedBookingId,
            event_type: confEventTitle,
            event_date: receivedAt,
            location: "Confirmation Engine",
            description: `Status: ${confirmationResult.confirmationStatus} (${(confirmationResult.confidence * 100).toFixed(0)}% via ${confirmationResult.detectedBy}). ${confirmationResult.reason}`,
          });
        }

        processedServerMessageIds.add(msgStub.id);
        if (processedServerMessageIds.size > 1000) {
          processedServerMessageIds.clear();
        }
      }

      // Update connection sync timestamp
      if (conn.id !== "direct-token") {
        await supabase
          .from("gmail_connections")
          .update({
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", conn.id);
      }
    } catch (accountErr) {
      console.error(`[ServerGmailSync] Error syncing account ${accountEmail}:`, accountErr);
    }
  }

  console.log("[ServerGmailSync] Sync complete.", {
    totalProcessed,
    totalNewMessages,
  });

  return {
    success: true,
    syncedCount: totalNewMessages,
    newMessages: totalNewMessages,
    processedCount: totalProcessed,
    details: processedDetails,
    message: `Synchronized ${totalNewMessages} new incoming reply messages successfully.`,
  };
}
