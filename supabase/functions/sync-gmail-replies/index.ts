import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    return "";
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

function extractMovementNumber(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(/\b(MOV-\d{4}-\d{3,6}|MOV-[A-Z0-9-]+)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function parseEmailAddress(raw: string): { name: string; email: string } {
  if (!raw) return { name: "", email: "" };
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: match[1] ? match[1].trim() : match[2] || raw,
      email: match[2] ? match[2].trim() : raw,
    };
  }
  return { name: raw, email: raw };
}

type ConfirmationStatus = "CONFIRMED" | "NOT_CONFIRMED" | "NEEDS_REVIEW" | "REJECTED";

function classifyConfirmationEdge(
  subject: string,
  body: string,
  snippet?: string,
): {
  status: ConfirmationStatus;
  confidence: number;
  reason: string;
  detectedBy: string;
} {
  const fullText = `${subject} ${body || snippet || ""}`.toLowerCase();

  // 1. Rejections
  const rejections = [
    /\bno space\b/i,
    /\bspace (?:is )?unavailable\b/i,
    /\bvessel (?:is )?fully booked\b/i,
    /\bvessel (?:is )?full\b/i,
    /\bunable to confirm\b/i,
    /\bcannot accept (?:this )?booking\b/i,
    /\bcan not accept (?:this )?booking\b/i,
    /\bunable to accommodate\b/i,
    /\bunable to accept\b/i,
    /\bbooking (?:is )?rejected\b/i,
    /\bbooking (?:is )?declined\b/i,
    /\bdeclined\b/i,
    /\bno equipment (?:available)?\b/i,
    /\bcannot confirm\b/i,
    /\bservice (?:is )?(?:suspended|cancelled|canceled)\b/i,
  ];
  if (rejections.some((r) => r.test(fullText))) {
    return {
      status: "REJECTED",
      confidence: 0.95,
      reason: "Forwarder stated rejection/inability to accept space or booking.",
      detectedBy: "DETERMINISTIC",
    };
  }

  // 2. Negative qualifiers (guarding against false positive confirmations)
  const negQualifiers = [
    /\bnot confirmed\b/i,
    /\bwill confirm\b/i,
    /\bsubject to\b/i,
    /\bpending confirmation\b/i,
    /\bwaiting (?:for )?confirmation\b/i,
    /\bprior to confirmation\b/i,
  ];
  const hasNegative = negQualifiers.some((nq) => nq.test(fullText));

  // 3. Confirmations
  if (!hasNegative) {
    const confirmations = [
      /\bbooking (?:is |has been )?confi[r]?med\b/i,
      /\bbooking confi[r]?med\b/i,
      /\bconfi[r]?med for this sailing\b/i,
      /\bconfi[r]?med for the sailing\b/i,
      /\bconfi[r]?med for (?:sailing|loading|vessel|departure|dispatch)\b/i,
      /\bspace (?:is )?confi[r]?med\b/i,
      /\bwe (?:hereby |can )?confi[r]?m (?:the |your )?booking\b/i,
      /\bwe (?:hereby )?confi[r]?m your booking\b/i,
      /\byour booking is confi[r]?med\b/i,
      /\bbooking has been confi[r]?med\b/i,
      /\bconfi[r]?med as booked\b/i,
      /\bconfi[r]?med as requested\b/i,
      /\bconfi[r]?med with (?:carrier|line|vessel|shipping line)\b/i,
      /\bpleased to confi[r]?m\b/i,
      /\bhappy to confi[r]?m\b/i,
      /\bglad to confi[r]?m\b/i,
      /\bwe confi[r]?m space\b/i,
      /\bwe confi[r]?m\b/i,
      /\bspace (?:and|&) rate confi[r]?med\b/i,
      /\brate (?:and|&) space confi[r]?med\b/i,
      /\ballocation (?:is )?confi[r]?med\b/i,
      /\bbooking confirmation\b/i,
      /\bbooking confirmation (?:attached|enclosed|is attached)\b/i,
      /\bconfi[r]?med on (?:vessel|voyage|flight|train|carrier)\b/i,
      /\bbooking secured\b/i,
      /\bspace secured\b/i,
      /\bspace allocated\b/i,
      /\bbooking approved\b/i,
      /\bbooking accepted\b/i,
      /\ball confi[r]?med\b/i,
      /\b(?:ok|okay|yes|done|noted|thanks|thank you)[,\s]+confi[r]?med\b/i,
      /\bconfi[r]?med\b/i,
      /\bconfimed\b/i,
      /\bconfirm(?:ing)?\b/i,
    ];
    if (confirmations.some((c) => c.test(fullText))) {
      return {
        status: "CONFIRMED",
        confidence: 0.95,
        reason: "Forwarder explicitly confirmed space and booking for the movement.",
        detectedBy: "DETERMINISTIC",
      };
    }
  }

  // 4. Non-confirmation / In-progress
  const nonConfirmations = [
    /\breceived\b/i,
    /\bwell received\b/i,
    /\bnoted with thanks\b/i,
    /\bwe will check\b/i,
    /\bchecking availability\b/i,
    /\bchecking with (?:carrier|line|vessel)\b/i,
    /\bchecking space\b/i,
    /\bwaiting for approval\b/i,
    /\bwaiting for allocation\b/i,
    /\bsubject to (?:space|availability|approval)\b/i,
    /\bpending (?:space|approval|confirmation)\b/i,
    /\bworking on this\b/i,
    /\bwill revert (?:shortly|soon|later)\b/i,
    /\bunder processing\b/i,
    /\bin process\b/i,
    /\bwill update you\b/i,
    /\backnowledged\b/i,
  ];
  if (nonConfirmations.some((nc) => nc.test(fullText))) {
    return {
      status: "NOT_CONFIRMED",
      confidence: 0.92,
      reason:
        "Forwarder acknowledged receipt or stated pending check/availability without confirmation.",
      detectedBy: "DETERMINISTIC",
    };
  }

  // 5. Inquiries / Questions / Modifications
  const inquiries = [
    /\bcan you (?:please )?(?:advise|provide|confirm)\b/i,
    /\bplease advise\b/i,
    /\bis it possible to\b/i,
    /\balternate (?:port|vessel|sailing)\b/i,
    /\brate (?:change|increase)\b/i,
  ];
  if (inquiries.some((inq) => inq.test(fullText))) {
    return {
      status: "NEEDS_REVIEW",
      confidence: 0.8,
      reason:
        "Forwarder message contains questions, modification proposals, or conditional remarks requiring operator review.",
      detectedBy: "DETERMINISTIC",
    };
  }

  return {
    status: "NEEDS_REVIEW",
    confidence: 0.5,
    reason:
      "Email content does not match standard confirmation phrases and requires operator review.",
    detectedBy: "RULE_FALLBACK",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Missing Supabase credentials in Edge Function environment." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Optional parameters from request body
    let requestBody: { userId?: string; maxResults?: number } = {};
    try {
      requestBody = await req.json();
    } catch {
      // Empty body is acceptable
    }

    // 1. Fetch active Gmail connections
    let connectionsQuery = supabase.from("gmail_connections").select("*").eq("status", "connected");

    if (requestBody.userId) {
      connectionsQuery = connectionsQuery.eq("user_id", requestBody.userId);
    }

    const { data: connections, error: connError } = await connectionsQuery;

    if (connError || !connections || connections.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          syncedCount: 0,
          message: "No active connected Gmail accounts found to sync.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalSyncedMessages = 0;
    const syncResults: Array<{ account: string; newMessages: number; errors?: string }> = [];

    // 2. Iterate through each connected Gmail account
    for (const connection of connections) {
      const accessToken = connection.access_token;
      const accountEmail = connection.google_email;
      const userId = connection.user_id;

      if (!accessToken) {
        syncResults.push({
          account: accountEmail,
          newMessages: 0,
          errors: "No access token found",
        });
        continue;
      }

      try {
        // Query Gmail for recent incoming messages
        const maxResults = requestBody.maxResults || 25;
        const listRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=is:inbox`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          },
        );

        if (!listRes.ok) {
          if (listRes.status === 401) {
            // Mark token as expired
            await supabase
              .from("gmail_connections")
              .update({ status: "expired", updated_at: new Date().toISOString() })
              .eq("id", connection.id);
          }
          syncResults.push({
            account: accountEmail,
            newMessages: 0,
            errors: `Gmail API list error: ${listRes.status}`,
          });
          continue;
        }

        const listData = await listRes.json();
        const messageStubs: Array<{ id: string; threadId: string }> = listData.messages || [];

        if (messageStubs.length === 0) {
          syncResults.push({ account: accountEmail, newMessages: 0 });
          continue;
        }

        let accountNewCount = 0;

        // Process messages sequentially to ensure reliable matching
        for (const stub of messageStubs) {
          // Check if message is already stored in database (prevent duplicates)
          const { data: existingMsg } = await supabase
            .from("email_messages")
            .select("id")
            .eq("gmail_message_id", stub.id)
            .maybeSingle();

          if (existingMsg) {
            continue; // Already processed
          }

          // Fetch full message details from Gmail
          const msgRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${stub.id}?format=full`,
            {
              headers: { Authorization: `Bearer ${accessToken}` },
            },
          );

          if (!msgRes.ok) continue;

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

          // Calculate received_at timestamp
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
          const bodyHtml = extracted.html || body.replace(/\n/g, "<br/>");

          // 3. Movement & Forwarder Matching Engine (Step 3)
          let matchedBookingId: string | null = null;
          let matchedMovementId: string | null = null;
          let matchedMovementNumber: string | null = null;
          let matchedForwarderId: string | null = null;
          let matchedBy: "THREAD_ID" | "MOVEMENT_NUMBER" | "NONE" = "NONE";
          let matchDiscoveryMethod = "";

          // Priority A: Try matching by gmail_thread_id
          const { data: threadMatch } = await supabase
            .from("email_threads")
            .select("id, booking_id, movement_id, movement_number")
            .eq("gmail_thread_id", stub.threadId)
            .maybeSingle();

          if (threadMatch?.booking_id) {
            matchedBookingId = threadMatch.booking_id;
            matchedMovementId = threadMatch.movement_id || threadMatch.booking_id;
            matchedMovementNumber = threadMatch.movement_number || null;
            matchedBy = "THREAD_ID";
            matchDiscoveryMethod = `Gmail Thread ID [${stub.threadId}] linked in email_threads`;
          } else {
            // Check existing message with same thread_id
            const { data: prevMsg } = await supabase
              .from("email_messages")
              .select("booking_id, movement_id, movement_number, forwarder_id")
              .eq("gmail_thread_id", stub.threadId)
              .not("booking_id", "is", null)
              .limit(1)
              .maybeSingle();

            if (prevMsg?.booking_id) {
              matchedBookingId = prevMsg.booking_id;
              matchedMovementId = prevMsg.movement_id || prevMsg.booking_id;
              matchedMovementNumber = prevMsg.movement_number || null;
              matchedForwarderId = prevMsg.forwarder_id || null;
              matchedBy = "THREAD_ID";
              matchDiscoveryMethod = `Prior email message in Gmail Thread [${stub.threadId}] linked to booking`;
            }
          }

          // Priority B: Match using exact Movement Number if thread match was not found
          if (!matchedBookingId) {
            const extractedMov =
              extractMovementNumber(subject) ||
              extractMovementNumber(body) ||
              extractMovementNumber(snippet);

            if (extractedMov) {
              matchedMovementNumber = extractedMov;

              // Find matching booking exactly
              const { data: bookingData } = await supabase
                .from("bookings")
                .select("id, movement_number, booking_reference, reference, forwarder_id")
                .or(
                  `movement_number.eq.${extractedMov},booking_reference.eq.${extractedMov},reference.eq.${extractedMov}`,
                )
                .limit(1)
                .maybeSingle();

              if (bookingData) {
                matchedBookingId = bookingData.id;
                matchedMovementId = bookingData.id;
                matchedForwarderId = bookingData.forwarder_id || null;
                matchedMovementNumber =
                  bookingData.movement_number || bookingData.booking_reference || extractedMov;
                matchedBy = "MOVEMENT_NUMBER";
                matchDiscoveryMethod = `Exact Movement Number [${extractedMov}] extracted from message content`;
              }
            }
          }

          // Verify Forwarder against incoming sender email
          let matchStatus: "MATCHED" | "NEEDS_REVIEW" = "NEEDS_REVIEW";
          let matchReason = "";
          let isForwarderValidated = false;
          let forwarderName: string | null = null;
          let forwarderEmail: string | null = null;

          if (!matchedBookingId) {
            matchStatus = "NEEDS_REVIEW";
            matchReason = "Movement Number could not be found and no Gmail thread match exists.";
          } else {
            // Retrieve booking and associated forwarder
            const { data: bookingWithForwarder } = await supabase
              .from("bookings")
              .select(
                `
                id,
                movement_number,
                forwarder_id,
                forwarder:forwarders!bookings_forwarder_id_fkey(
                  id,
                  company_name,
                  email,
                  website,
                  notes
                )
              `,
              )
              .eq("id", matchedBookingId)
              .maybeSingle();

            const fwd = bookingWithForwarder?.forwarder as {
              id: string;
              company_name?: string | null;
              email?: string | null;
              website?: string | null;
              notes?: string | null;
            } | null;

            if (!matchedForwarderId && bookingWithForwarder?.forwarder_id) {
              matchedForwarderId = bookingWithForwarder.forwarder_id;
            }
            if (bookingWithForwarder?.movement_number) {
              matchedMovementNumber = bookingWithForwarder.movement_number;
            }

            // If matchedForwarderId is specific (e.g. from distinct thread), load that forwarder
            let activeForwarder = fwd;
            if (matchedForwarderId && (!fwd || fwd.id !== matchedForwarderId)) {
              const { data: specificFwd } = await supabase
                .from("forwarders")
                .select("id, company_name, email, website, notes")
                .eq("id", matchedForwarderId)
                .maybeSingle();
              if (specificFwd) {
                activeForwarder = specificFwd;
              }
            }

            if (activeForwarder) {
              forwarderName = activeForwarder.company_name || null;
              forwarderEmail = activeForwarder.email || null;
              const cleanSender = (parsedFrom.email || "").trim().toLowerCase();
              const fwdEmail = (activeForwarder.email || "").trim().toLowerCase();

              // Exact match or domain check
              if (fwdEmail && cleanSender === fwdEmail) {
                isForwarderValidated = true;
              } else {
                const senderDomain = cleanSender.split("@")[1];
                const fwdDomain = fwdEmail.includes("@") ? fwdEmail.split("@")[1] : null;
                const publicMailHosts = new Set([
                  "gmail.com",
                  "yahoo.com",
                  "hotmail.com",
                  "outlook.com",
                  "icloud.com",
                ]);

                if (
                  senderDomain &&
                  fwdDomain &&
                  senderDomain === fwdDomain &&
                  !publicMailHosts.has(senderDomain)
                ) {
                  isForwarderValidated = true;
                } else if (
                  fwd.website &&
                  senderDomain &&
                  fwd.website.toLowerCase().includes(senderDomain) &&
                  !publicMailHosts.has(senderDomain)
                ) {
                  isForwarderValidated = true;
                } else if (fwd.notes && fwd.notes.toLowerCase().includes(cleanSender)) {
                  isForwarderValidated = true;
                }
              }

              if (isForwarderValidated) {
                matchStatus = "MATCHED";
                matchReason = `Movement ${matchedMovementNumber} matched via ${matchedBy} and verified for forwarder ${forwarderName || "Partner"}.`;
              } else {
                matchStatus = "NEEDS_REVIEW";
                matchReason = `Movement ${matchedMovementNumber} identified via ${matchedBy}, but sender ${cleanSender} is not validated for forwarder ${forwarderName || "Assigned"}.`;
              }
            } else {
              matchStatus = "NEEDS_REVIEW";
              matchReason = `Movement ${matchedMovementNumber} found, but no Forwarder is associated with this booking to validate the sender.`;
            }
          }

          // 4. Find or Create Email Thread
          let threadId: string | null = threadMatch?.id || null;

          if (!threadId) {
            const { data: newThread } = await supabase
              .from("email_threads")
              .insert({
                user_id: userId,
                booking_id: matchedBookingId,
                movement_id: matchedMovementId,
                movement_number: matchedMovementNumber,
                subject: subject,
                gmail_thread_id: stub.threadId,
                status: "received",
                snippet: body.slice(0, 120),
                last_message_at: receivedAt,
              })
              .select()
              .single();

            if (newThread) {
              threadId = newThread.id;
            }
          } else {
            // Update thread with latest reply timestamp and snippet
            await supabase
              .from("email_threads")
              .update({
                last_message_at: receivedAt,
                snippet: body.slice(0, 120),
                status: "received",
                booking_id: matchedBookingId || undefined,
                movement_id: matchedMovementId || undefined,
                movement_number: matchedMovementNumber || undefined,
              })
              .eq("id", threadId);
          }

          // Run confirmation classifier (Step 4)
          const confClass = classifyConfirmationEdge(subject, body, snippet);

          // 5. Insert Incoming Email Message into email_messages
          const nowIso = new Date().toISOString();
          const { data: insertedMsg, error: insertError } = await supabase
            .from("email_messages")
            .insert({
              thread_id: threadId,
              user_id: userId,
              booking_id: matchedBookingId,
              movement_id: matchedMovementId,
              movement_number: matchedMovementNumber,
              forwarder_id: matchedForwarderId,
              from_email: parsedFrom.email,
              sender_email: parsedFrom.email,
              sender_name: parsedFrom.name || forwarderName || "Forwarder",
              to_email: parsedTo.email || accountEmail,
              recipient_email: parsedTo.email || accountEmail,
              recipient_name: parsedTo.name || "Nashmia Operations",
              subject: subject,
              body: body,
              body_html: bodyHtml,
              snippet: snippet || body.slice(0, 140),
              direction: "inbound",
              status: "SENT",
              email_type: matchedBookingId ? "BOOKING_UPDATE" : "GENERAL",
              match_status: matchStatus,
              match_reason: matchReason,
              matched_by: matchedBy,
              matched_at: nowIso,
              match_details: {
                isForwarderValidated,
                forwarderName,
                forwarderEmail,
                discoveryMethod: matchDiscoveryMethod,
              },
              // Step 4 fields
              confirmation_status: confClass.status,
              confirmation_confidence: confClass.confidence,
              confirmation_reason: confClass.reason,
              confirmation_detected_by: confClass.detectedBy,
              confirmation_detected_at: nowIso,
              confirmation_details: {
                confidence: confClass.confidence,
                reason: confClass.reason,
                detectedBy: confClass.detectedBy,
              },
              gmail_message_id: stub.id,
              gmail_thread_id: stub.threadId,
              received_at: receivedAt,
              sent_at: receivedAt,
              headers: {
                gmail_message_id: stub.id,
                gmail_thread_id: stub.threadId,
                from_email: parsedFrom.email,
                to_email: parsedTo.email,
                subject: subject,
                received_at: receivedAt,
                movement_number: matchedMovementNumber,
                booking_id: matchedBookingId,
                forwarder_id: matchedForwarderId,
                match_status: matchStatus,
                matched_by: matchedBy,
                confirmation_status: confClass.status,
                confirmation_confidence: confClass.confidence,
              },
            })
            .select()
            .single();

          if (!insertError && insertedMsg) {
            accountNewCount++;
            totalSyncedMessages++;

            // Save to email_matches audit table
            try {
              await supabase.from("email_matches").upsert(
                {
                  email_message_id: insertedMsg.id,
                  booking_id: matchedBookingId,
                  movement_id: matchedMovementId,
                  forwarder_id: matchedForwarderId,
                  movement_number: matchedMovementNumber,
                  sender_email: parsedFrom.email,
                  match_status: matchStatus,
                  matched_by: matchedBy,
                  match_reason: matchReason,
                  metadata: {
                    isForwarderValidated,
                    forwarderName,
                    forwarderEmail,
                    confirmationStatus: confClass.status,
                    confidence: confClass.confidence,
                  },
                  updated_at: nowIso,
                },
                { onConflict: "email_message_id" },
              );
            } catch (auditErr) {
              console.warn("Could not record email_matches audit:", auditErr);
            }

            // Save to email_confirmations audit table (Step 4)
            try {
              await supabase.from("email_confirmations").upsert(
                {
                  email_message_id: insertedMsg.id,
                  booking_id: matchedBookingId,
                  movement_id: matchedMovementId,
                  forwarder_id: matchedForwarderId,
                  movement_number: matchedMovementNumber,
                  confirmation_status: confClass.status,
                  confidence: confClass.confidence,
                  reason: confClass.reason,
                  detected_by: confClass.detectedBy,
                  raw_subject: subject,
                  raw_snippet: snippet || body.slice(0, 140),
                  created_at: nowIso,
                  updated_at: nowIso,
                },
                { onConflict: "email_message_id" },
              );
            } catch (confAuditErr) {
              console.warn("Could not record email_confirmations audit:", confAuditErr);
            }

            // Step 5 — Automatic Movement Confirmation
            if (matchedBookingId) {
              const allConditionsMet =
                Boolean(matchedBookingId) &&
                (matchedBy === "MOVEMENT_NUMBER" || matchedBy === "THREAD_ID") &&
                isForwarderValidated &&
                confClass.status === "CONFIRMED";

              // Check if not already confirmed by this email (idempotency)
              const { data: currentBookingData } = await supabase
                .from("bookings")
                .select("id, status, confirmation_email_id")
                .eq("id", matchedBookingId)
                .maybeSingle();

              const alreadyConfirmedByThis =
                currentBookingData?.confirmation_email_id === insertedMsg.id;

              if (allConditionsMet && !alreadyConfirmedByThis) {
                const prevStatus = currentBookingData?.status || "Awaiting Confirmation";
                // 1. Update movement status to CONFIRMED
                await supabase
                  .from("bookings")
                  .update({
                    status: "CONFIRMED",
                    confirmed_at: nowIso,
                    confirmed_by: "SYSTEM",
                    confirmation_email_id: insertedMsg.id,
                    confirmation_status: "CONFIRMED",
                    confirmation_reason: confClass.reason,
                    confirmation_detected_by: confClass.detectedBy,
                    confirmation_confidence: confClass.confidence,
                    updated_at: nowIso,
                  })
                  .eq("id", matchedBookingId);

                // 2. Audit Log
                await supabase.from("audit_logs").insert({
                  user_id: userId,
                  action: "AUTO_CONFIRMED_FROM_EMAIL",
                  entity_type: "booking",
                  entity_id: matchedBookingId,
                  old_data: { status: prevStatus },
                  new_data: {
                    status: "CONFIRMED",
                    confirmed_by: "SYSTEM",
                    confirmed_at: nowIso,
                    confirmation_email_id: insertedMsg.id,
                    movement_number: matchedMovementNumber,
                  },
                });

                // 3. Timeline event
                await supabase.from("booking_events").insert({
                  booking_id: matchedBookingId,
                  event_type: "AUTO_CONFIRMED_FROM_EMAIL",
                  event_date: nowIso,
                  location: "System Automation Engine",
                  description: `Movement automatically transitioned from ${prevStatus} to CONFIRMED following verified forwarder reply confirmation.`,
                });
              } else if (confClass.status === "REJECTED") {
                await supabase
                  .from("bookings")
                  .update({
                    confirmation_status: "REJECTED",
                    confirmation_reason: confClass.reason,
                    updated_at: nowIso,
                  })
                  .eq("id", matchedBookingId);
              } else if (
                confClass.status === "NEEDS_REVIEW" ||
                confClass.status === "NOT_CONFIRMED"
              ) {
                await supabase
                  .from("bookings")
                  .update({
                    confirmation_status: confClass.status,
                    confirmation_reason: confClass.reason,
                    updated_at: nowIso,
                  })
                  .eq("id", matchedBookingId);
              }

              const eventLabel =
                matchStatus === "MATCHED"
                  ? "Forwarder Reply Matched"
                  : "Forwarder Reply (Needs Review)";

              await supabase.from("booking_events").insert({
                booking_id: matchedBookingId,
                event_type: eventLabel,
                event_date: receivedAt,
                location: "Incoming Mailbox",
                description: `Reply received from ${parsedFrom.email}. Match status: ${matchStatus} (${matchReason})`,
              });

              let confEventTitle = "Forwarder Reply Evaluated";
              if (confClass.status === "CONFIRMED") {
                confEventTitle = allConditionsMet
                  ? "Movement Auto-Confirmed"
                  : "Forwarder Confirmation Detected";
              } else if (confClass.status === "REJECTED") {
                confEventTitle = "Forwarder Space Rejection";
              } else if (confClass.status === "NOT_CONFIRMED") {
                confEventTitle = "Forwarder Non-Confirmation Reply";
              } else if (confClass.status === "NEEDS_REVIEW") {
                confEventTitle = "Forwarder Reply (Review Required)";
              }

              await supabase.from("booking_events").insert({
                booking_id: matchedBookingId,
                event_type: confEventTitle,
                event_date: receivedAt,
                location: "Confirmation Engine",
                description: `Status: ${confClass.status} (${(confClass.confidence * 100).toFixed(0)}% via ${confClass.detectedBy}). ${confClass.reason}`,
              });
            }
          }
        }

        // Update connection last_sync_at
        await supabase
          .from("gmail_connections")
          .update({
            last_sync_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        syncResults.push({ account: accountEmail, newMessages: accountNewCount });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        syncResults.push({ account: accountEmail, newMessages: 0, errors: errorMsg });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        syncedCount: totalSyncedMessages,
        results: syncResults,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (globalErr: unknown) {
    const errorMsg = globalErr instanceof Error ? globalErr.message : String(globalErr);
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
