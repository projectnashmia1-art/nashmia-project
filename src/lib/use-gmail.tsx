import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import {
  connectGmailAccount,
  disconnectGmailAccount,
  fetchGmailConnectionState,
  getGmailAccessToken,
  sendEmailDirectlyViaGmail,
  fetchLiveGmailMessages,
  isGmailQuotaCooldownActive,
  type GmailFetchedMessage,
} from "./gmail-service";
import { useAuth } from "./auth-context";
import { supabase, isSupabaseConfigured } from "./supabase";
import { safeUuid, updateLocalBooking } from "./supabase-services";
import { toast } from "sonner";
import { processIncomingForwarderEmailReply } from "./multi-forwarder-service";
import type { ComposeEmailFormValues, EmailMessageRecord } from "@/types/email.types";

interface GmailContextType {
  isConnected: boolean;
  isConnecting: boolean;
  googleEmail: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  lastSyncAt: string | null;
  liveMessages: GmailFetchedMessage[];
  isLoadingMessages: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  sendGmailEmail: (
    values: ComposeEmailFormValues,
    existingMessageId?: string,
  ) => Promise<{ success: boolean; gmailMessageId?: string; gmailThreadId?: string }>;
  fetchInbox: () => Promise<GmailFetchedMessage[]>;
  syncInboxToApp: () => Promise<{ imported: number }>;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

export function GmailProvider({ children }: { children: ReactNode }) {
  const { userId } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [liveMessages, setLiveMessages] = useState<GmailFetchedMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // Check initial connection state
  const checkStatus = useCallback(async () => {
    try {
      const state = await fetchGmailConnectionState(userId);
      setIsConnected(state.isConnected);
      setGoogleEmail(state.email);
      setDisplayName(state.displayName);
      setAvatarUrl(state.avatarUrl);
      setLastSyncAt(state.lastSyncAt || null);
    } catch (err) {
      console.warn("[GmailContext] Failed to check status:", err);
    }
  }, [userId]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  const connect = useCallback(async (): Promise<boolean> => {
    setIsConnecting(true);
    try {
      const result = await connectGmailAccount(userId);
      setIsConnected(true);
      setGoogleEmail(result.email);
      setDisplayName(result.displayName);
      setAvatarUrl(result.avatarUrl || null);
      setLastSyncAt(new Date().toISOString());

      toast.success("Connected to Gmail", {
        description: `Signed in as ${result.email}. You can now send real emails directly.`,
      });
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to connect Gmail account";
      toast.error("Gmail Connection Error", {
        description: msg,
      });
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [userId]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectGmailAccount(userId, googleEmail);
      setIsConnected(false);
      setGoogleEmail(null);
      setDisplayName(null);
      setAvatarUrl(null);
      setLastSyncAt(null);
      setLiveMessages([]);
      toast.info("Disconnected from Gmail");
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("gmail_connection_changed", {
            detail: { connected: false },
          }),
        );
      }
    } catch (err: unknown) {
      console.error("[GmailContext] Disconnect error:", err);
      toast.error("Failed to disconnect Gmail account");
    }
  }, [userId, googleEmail]);

  const sendGmailEmail = useCallback(
    async (
      values: ComposeEmailFormValues,
      existingMessageId?: string,
    ): Promise<{ success: boolean; gmailMessageId?: string; gmailThreadId?: string }> => {
      // 1. Send via Gmail API
      const gmailResult = await sendEmailDirectlyViaGmail({
        fromEmail: values.fromEmail || googleEmail || "projectnashmia1@gmail.com",
        toEmail: values.toEmail,
        toName: values.toName,
        cc: values.cc,
        bcc: values.bcc,
        subject: values.subject,
        body: values.body,
        bookingId: values.bookingId,
        forwarderId: values.forwarderId,
        userId,
      });

      // 2. Record / Update in Supabase for unified persistence
      if (isSupabaseConfigured) {
        const validUserUuid = safeUuid(userId);
        try {
          if (existingMessageId) {
            await supabase
              .from("email_messages")
              .update({
                gmail_message_id: gmailResult.gmailMessageId,
                sent_at: new Date().toISOString(),
              })
              .eq("id", existingMessageId);
          } else {
            // Validate user_id against profiles
            let targetUserId = validUserUuid;
            if (!targetUserId) {
              const { data: prof } = await supabase
                .from("profiles")
                .select("id")
                .limit(1)
                .maybeSingle();
              targetUserId = prof?.id || null;
            }

            // Verify booking_id exists in bookings table
            let verifiedBookingId: string | null = null;
            if (values.bookingId) {
              const cleanBid = safeUuid(values.bookingId);
              if (cleanBid) {
                const { data: bCheck } = await supabase
                  .from("bookings")
                  .select("id")
                  .eq("id", cleanBid)
                  .maybeSingle();
                if (bCheck?.id) {
                  verifiedBookingId = bCheck.id;
                }
              }
            }

            if (targetUserId) {
              // Create new thread & message in database
              const { data: thread } = await supabase
                .from("email_threads")
                .insert({
                  user_id: targetUserId,
                  booking_id: verifiedBookingId,
                  subject: values.subject,
                  status: "Active",
                  gmail_thread_id: gmailResult.gmailThreadId,
                  snippet: values.body.slice(0, 100),
                  last_message_at: new Date().toISOString(),
                })
                .select()
                .maybeSingle();

              if (thread) {
                await supabase.from("email_messages").insert({
                  thread_id: thread.id,
                  sender_email: values.fromEmail || googleEmail || "",
                  sender_name: displayName || "Nashmia Operations",
                  recipient_email: values.toEmail,
                  cc: values.cc || null,
                  bcc: values.bcc || null,
                  subject: values.subject,
                  body: values.body,
                  body_html: values.body.replace(/\n/g, "<br/>"),
                  direction: "Outbound",
                  gmail_message_id: gmailResult.gmailMessageId,
                  sent_at: new Date().toISOString(),
                  raw_headers: {
                    user_id: targetUserId,
                    booking_id: safeUuid(values.bookingId),
                    forwarder_id: safeUuid(values.forwarderId),
                    recipient_name: values.toName || null,
                    email_type: values.emailType,
                    status: "sent",
                    gmail_thread_id: gmailResult.gmailThreadId,
                  },
                });
              }
            }
          }
        } catch (dbErr) {
          console.warn("[GmailContext] Failed to persist sent message into Supabase:", dbErr);
        }
      }

      return {
        success: true,
        gmailMessageId: gmailResult.gmailMessageId,
        gmailThreadId: gmailResult.gmailThreadId,
      };
    },
    [userId, googleEmail, displayName],
  );

  const fetchInbox = useCallback(async (): Promise<GmailFetchedMessage[]> => {
    setIsLoadingMessages(true);
    try {
      const messages = await fetchLiveGmailMessages({ maxResults: 25 });
      setLiveMessages(messages);
      setLastSyncAt(new Date().toISOString());

      // Route any forwarder replies to their distinct quote request records
      for (const msg of messages) {
        processIncomingForwarderEmailReply({
          gmailThreadId: msg.threadId,
          gmailMessageId: msg.id,
          senderEmail: msg.fromEmail,
          senderName: msg.fromName,
          subject: msg.subject,
          body: msg.body,
          snippet: msg.snippet,
        }).catch((err) => {
          console.debug("[GmailContext] Background forwarder reply route notice:", err);
        });
      }

      return messages;
    } catch (err: unknown) {
      console.error("[GmailContext] Fetch inbox error:", err);
      throw err;
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const isSyncingRef = useRef(false);

  const syncInboxToApp = useCallback(
    async (options?: { silent?: boolean }): Promise<{ imported: number }> => {
      // Prevent concurrent sync executions
      if (isSyncingRef.current) {
        return { imported: 0 };
      }

      // If global quota cooldown is active, skip polling to preserve Google Cloud per-minute limit
      if (isGmailQuotaCooldownActive()) {
        return { imported: 0 };
      }

      isSyncingRef.current = true;
      try {
        setIsLoadingMessages(true);
        // 1. Retrieve access token (cached or fresh from session)
        const token = await getGmailAccessToken(userId);

        if (!token && !googleEmail) {
          // No connected Gmail account to sync
          return { imported: 0 };
        }

        // 2. Try Supabase Edge Function first if configured
        let serverResult: {
          success?: boolean;
          syncedCount?: number;
          newMessages?: number;
          confirmedMovements?: number;
          details?: Array<{
            actionTaken?: string;
            confirmationStatus?: string;
            movementNumber?: string;
            matchedBookingId?: string;
          }>;
        } | null = null;

        if (isSupabaseConfigured) {
          try {
            const { data, error } = await supabase.functions.invoke("sync-gmail-replies", {
              body: { userId: safeUuid(userId), maxResults: 10 },
            });
            if (!error && data) {
              serverResult = data;
            }
          } catch {
            // Fall through to server API route
          }
        }

        // 3. Call server-side API endpoint /api/gmail/sync-replies
        if (!serverResult || !serverResult.success) {
          const res = await fetch("/api/gmail/sync-replies", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              userId: safeUuid(userId),
              userEmail: googleEmail,
              accessToken: token || undefined,
              maxResults: 10,
            }),
          });

          if (res.ok) {
            serverResult = await res.json();
          }
        }

        const importedCount = serverResult?.newMessages ?? serverResult?.syncedCount ?? 0;
        const confirmedCount = serverResult?.confirmedMovements ?? 0;

        // Update sync timestamp
        const nowIso = new Date().toISOString();
        setLastSyncAt(nowIso);

        if (importedCount > 0 && !options?.silent) {
          toast.success("Gmail Inbox Synchronized", {
            description: `Received and processed ${importedCount} incoming message(s)${
              confirmedCount > 0 ? ` • ${confirmedCount} movement(s) confirmed` : ""
            }.`,
          });
        }

        // Only dispatch cross-component events if new data was actually imported or confirmed
        if (typeof window !== "undefined" && (importedCount > 0 || confirmedCount > 0)) {
          window.dispatchEvent(
            new CustomEvent("supabase_realtime_bookings_change", {
              detail: { updated: true, confirmedCount },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("nashmia_bookings_updated", { detail: { updated: true } }),
          );

          // ONLY dispatch booking_confirmed if specific movements were newly auto-confirmed in this sync
          if (Array.isArray(serverResult?.details)) {
            for (const item of serverResult.details) {
              if (item.actionTaken === "AUTO_CONFIRMED") {
                const movRef = item.movementNumber;
                const bId = item.matchedBookingId || movRef;
                if (bId || movRef) {
                  updateLocalBooking(bId || movRef, {
                    status: "Booking Confirmed",
                    confirmation_status: "CONFIRMED",
                    confirmed_at: new Date().toISOString(),
                    confirmed_by: "Forwarder Email Confirmation",
                  });
                  if (movRef && movRef !== bId) {
                    updateLocalBooking(movRef, {
                      status: "Booking Confirmed",
                      confirmation_status: "CONFIRMED",
                      confirmed_at: new Date().toISOString(),
                      confirmed_by: "Forwarder Email Confirmation",
                    });
                  }

                  window.dispatchEvent(
                    new CustomEvent("nashmia_booking_confirmed", {
                      detail: {
                        bookingId: bId,
                        movementNumber: movRef,
                        bookingReference: movRef,
                        status: "Booking Confirmed",
                      },
                    }),
                  );
                }
              }
            }
          }

          window.dispatchEvent(
            new CustomEvent("nashmia_booking_status_updated", { detail: { updated: true } }),
          );
        }

        return { imported: importedCount };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to sync inbox";
        if (!options?.silent) {
          toast.error("Inbox Sync Notice", { description: msg });
        }
        return { imported: 0 };
      } finally {
        setIsLoadingMessages(false);
        isSyncingRef.current = false;
      }
    },
    [userId, googleEmail],
  );

  // Continuous Background Polling & Window Focus sync
  useEffect(() => {
    if (!isConnected) return;

    let lastSyncTime = Date.now();

    // Initial sync after client settles
    const initialTimer = setTimeout(() => {
      lastSyncTime = Date.now();
      void syncInboxToApp({ silent: true });
    }, 8000);

    // Periodic polling every 35 seconds when visible so emails appear promptly without freezing
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      lastSyncTime = Date.now();
      void syncInboxToApp({ silent: true });
    }, 35000);

    // Sync immediately when user switches back to the tab if at least 20 seconds have elapsed
    const handleFocus = () => {
      if (Date.now() - lastSyncTime > 20000) {
        lastSyncTime = Date.now();
        void syncInboxToApp({ silent: true });
      }
    };

    // Fast-track sync after an email is sent to quickly capture auto-responses or fast quotes
    const handleEmailSent = () => {
      setTimeout(() => {
        lastSyncTime = Date.now();
        void syncInboxToApp({ silent: true });
      }, 8000);
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("nashmia:email-sent", handleEmailSent);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("nashmia:email-sent", handleEmailSent);
    };
  }, [isConnected, syncInboxToApp]);

  const contextValue = useMemo<GmailContextType>(
    () => ({
      isConnected,
      isConnecting,
      googleEmail,
      displayName,
      avatarUrl,
      lastSyncAt,
      liveMessages,
      isLoadingMessages,
      connect,
      disconnect,
      sendGmailEmail,
      fetchInbox,
      syncInboxToApp,
    }),
    [
      isConnected,
      isConnecting,
      googleEmail,
      displayName,
      avatarUrl,
      lastSyncAt,
      liveMessages,
      isLoadingMessages,
      connect,
      disconnect,
      sendGmailEmail,
      fetchInbox,
      syncInboxToApp,
    ],
  );

  return <GmailContext.Provider value={contextValue}>{children}</GmailContext.Provider>;
}

export function useGmail() {
  const context = useContext(GmailContext);
  if (!context) {
    throw new Error("useGmail must be used within a GmailProvider");
  }
  return context;
}
