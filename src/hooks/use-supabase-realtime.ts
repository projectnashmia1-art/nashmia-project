import { useEffect, useRef, useState } from "react";
import { useQueryClient, QueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import {
  applyBookingRealtimeUpdate,
  applyOfferRealtimeUpdate,
  applyBookingEventRealtimeUpdate,
  applyEmailMessageRealtimeUpdate,
  applyNotificationRealtimeUpdate,
  applyForwarderRequestRealtimeUpdate,
  applyQuotationRealtimeUpdate,
} from "@/lib/cache/realtime-cache-sync";
import { invalidateBookingsCache } from "@/lib/supabase-services";

export type RealtimeTable =
  | "buyers"
  | "suppliers"
  | "forwarders"
  | "shipping_lines"
  | "rate_cards"
  | "bookings"
  | "booking_containers"
  | "booking_events"
  | "notifications"
  | "email_messages"
  | "email_threads"
  | "forwarder_offers"
  | "booking_forwarders"
  | "forwarder_requests"
  | "quotations"
  | "quotation_versions"
  | "requests"
  | "booking_documents";

export type RealtimeConnectionState =
  | "SUBSCRIBED"
  | "CONNECTING"
  | "TIMED_OUT"
  | "CLOSED"
  | "CHANNEL_ERROR";

// Deduplication sliding window to prevent duplicate handling of the same event
const recentEventSignatures = new Map<string, number>();
const DEDUP_WINDOW_MS = 8000;

function cleanupOldEventSignatures(): void {
  const now = Date.now();
  for (const [sig, ts] of recentEventSignatures.entries()) {
    if (now - ts > DEDUP_WINDOW_MS) {
      recentEventSignatures.delete(sig);
    }
  }
}

// Valid PostgreSQL tables with realtime enabled
const VALID_TABLES = [
  "bookings",
  "booking_containers",
  "booking_events",
  "notifications",
  "email_messages",
  "email_threads",
  "forwarder_offers",
  "forwarder_requests",
  "quotations",
  "quotation_versions",
  "buyers",
  "suppliers",
  "forwarders",
  "shipping_lines",
  "rate_cards",
  "booking_documents",
] as const;

/**
 * Maps incoming table names or legacy aliases to the canonical database table
 */
export function resolveCanonicalTable(table: string): string {
  if (table === "requests") return "bookings";
  if (table === "booking_forwarders") return "forwarder_offers";
  if (table === "email_confirmations") return "email_messages";
  return table;
}

export interface RealtimeSubscriptionOptions {
  filter?: string;
  organizationId?: string | null;
}

type ListenerFn = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;

/**
 * Global Realtime Hub Singleton
 * Connects ONE multiplexed organization-scoped WebSocket channel per session
 * to eliminate connection lag, socket leaks, and duplicate events across tabs/pages.
 */
class GlobalRealtimeHub {
  private channel: RealtimeChannel | null = null;
  private channelName = "";
  public state: RealtimeConnectionState = "CONNECTING";
  private listeners = new Map<string, Set<ListenerFn>>();
  private stateChangeListeners = new Set<(state: RealtimeConnectionState) => void>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private activeQueryClient: QueryClient | null = null;
  private organizationId: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => {
        if (this.state !== "SUBSCRIBED" && this.channel) {
          try {
            void this.channel.subscribe();
          } catch {
            // ignore
          }
        }
      });
    }
  }

  public setQueryClient(qc: QueryClient) {
    this.activeQueryClient = qc;
  }

  public setOrganizationId(orgId?: string | null) {
    if (orgId && orgId !== this.organizationId) {
      this.organizationId = orgId;
      // Re-initialize channel for specific organization
      this.initChannel(orgId);
    }
  }

  public initChannel(orgId?: string | null): RealtimeChannel | null {
    if (!isSupabaseConfigured) return null;

    const desiredChannelName = `org_${orgId || "default"}_session_feed`;
    if (this.channel && this.channelName === desiredChannelName) {
      return this.channel;
    }

    if (this.channel) {
      try {
        void supabase.removeChannel(this.channel);
      } catch {
        // ignore
      }
    }

    this.channelName = desiredChannelName;
    this.organizationId = orgId || null;
    this.state = "CONNECTING";
    this.notifyState();

    const channel = supabase.channel(desiredChannelName);

    // Register all PostgreSQL tables on this single channel
    for (const table of VALID_TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          this.handleIncomingPayload(table, payload);
        },
      );
    }

    channel.subscribe((status, err) => {
      this.state = status as RealtimeConnectionState;
      this.notifyState();

      if (status === "SUBSCRIBED") {
        this.reconnectAttempts = 0;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn(
          `[GlobalRealtimeHub] Channel notice on ${this.channelName} (${status}):`,
          err?.message,
        );
        this.scheduleReconnect();
      }
    });

    this.channel = channel;
    return channel;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectAttempts += 1;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.channel) {
        try {
          void this.channel.subscribe();
        } catch (e) {
          console.warn("[GlobalRealtimeHub] Reconnect notice:", e);
        }
      }
    }, delay);
  }

  private notifyState() {
    for (const fn of this.stateChangeListeners) {
      try {
        fn(this.state);
      } catch {
        // ignore
      }
    }
  }

  public subscribeState(fn: (state: RealtimeConnectionState) => void): () => void {
    this.stateChangeListeners.add(fn);
    fn(this.state);
    return () => {
      this.stateChangeListeners.delete(fn);
    };
  }

  public registerListener(table: string, fn: ListenerFn): () => void {
    const canonical = resolveCanonicalTable(table);
    if (!this.listeners.has(canonical)) {
      this.listeners.set(canonical, new Set());
    }
    this.listeners.get(canonical)!.add(fn);

    return () => {
      const set = this.listeners.get(canonical);
      if (set) {
        set.delete(fn);
      }
    };
  }

  private handleIncomingPayload(
    table: string,
    payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
  ) {
    const row = (payload.new || payload.old || {}) as Record<string, unknown>;

    // 1. Organization isolation guard: discard if belongs to different org
    if (this.organizationId && row.organization_id) {
      if (String(row.organization_id) !== String(this.organizationId)) {
        return;
      }
    }

    // 2. Sliding window event deduplication guard
    const recordId = String(row.id || row.booking_id || row.movement_number || "");
    const recordTs = String(payload.commit_timestamp || row.updated_at || row.created_at || "");
    const eventSig = `${table}:${payload.eventType}:${recordId}:${recordTs}`;

    cleanupOldEventSignatures();
    if (recentEventSignatures.has(eventSig)) {
      return; // Already processed
    }
    recentEventSignatures.set(eventSig, Date.now());

    // 3. Surgical TanStack Query cache sync & instant cache invalidation
    if (this.activeQueryClient) {
      const qc = this.activeQueryClient;
      try {
        if (table === "bookings") {
          applyBookingRealtimeUpdate(qc, payload);
          void qc.invalidateQueries({ queryKey: ["dashboard-data"] });
          void qc.invalidateQueries({ queryKey: ["dashboard-bookings"] });
          void qc.invalidateQueries({ queryKey: ["booking-requests"] });
          void qc.invalidateQueries({ queryKey: ["movements"] });
          void qc.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
          invalidateBookingsCache();
        } else if (table === "forwarder_requests") {
          applyForwarderRequestRealtimeUpdate(qc, payload);
          void qc.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
          void qc.invalidateQueries({ queryKey: ["booking-requests"] });
        } else if (table === "quotations" || table === "quotation_versions") {
          applyQuotationRealtimeUpdate(qc, payload);
          void qc.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
          void qc.invalidateQueries({ queryKey: ["booking-requests"] });
          void qc.invalidateQueries({ queryKey: ["quotations"] });
        } else if (table === "forwarder_offers" || table === "booking_forwarders") {
          applyOfferRealtimeUpdate(qc, payload);
          void qc.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
        } else if (table === "booking_events") {
          applyBookingEventRealtimeUpdate(qc, payload);
        } else if (table === "booking_containers") {
          void qc.invalidateQueries({ queryKey: ["dashboard-bookings"] });
          void qc.invalidateQueries({ queryKey: ["booking-requests"] });
          void qc.invalidateQueries({ queryKey: ["movements"] });
          invalidateBookingsCache();
        } else if (table === "booking_documents") {
          void qc.invalidateQueries({ queryKey: ["booking-documents"] });
          void qc.invalidateQueries({ queryKey: ["documents"] });
        } else if (table === "buyers") {
          void qc.invalidateQueries({ queryKey: ["entities", "buyers"] });
          void qc.invalidateQueries({ queryKey: ["buyers"] });
        } else if (table === "suppliers") {
          void qc.invalidateQueries({ queryKey: ["entities", "suppliers"] });
          void qc.invalidateQueries({ queryKey: ["suppliers"] });
        } else if (table === "forwarders") {
          void qc.invalidateQueries({ queryKey: ["entities", "forwarders"] });
          void qc.invalidateQueries({ queryKey: ["forwarders"] });
          void qc.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
        } else if (table === "rate_cards") {
          void qc.invalidateQueries({ queryKey: ["entities", "rate-cards"] });
          void qc.invalidateQueries({ queryKey: ["rate-cards"] });
          void qc.invalidateQueries({ queryKey: ["all-rate-cards"] });
        } else if (table === "shipping_lines") {
          void qc.invalidateQueries({ queryKey: ["entities", "shipping-lines"] });
          void qc.invalidateQueries({ queryKey: ["shipping-lines"] });
        } else if (table === "email_messages") {
          applyEmailMessageRealtimeUpdate(qc, payload);
        } else if (table === "notifications") {
          applyNotificationRealtimeUpdate(qc, payload);
        }
      } catch (syncErr) {
        console.warn(`[GlobalRealtimeHub] Cache sync notice on ${table}:`, syncErr);
      }
    }

    // 4. Dispatch to registered component listeners
    const targetSet = this.listeners.get(table);
    if (targetSet) {
      for (const fn of targetSet) {
        try {
          fn(payload);
        } catch (err) {
          console.warn(`[GlobalRealtimeHub] Error in listener for ${table}:`, err);
        }
      }
    }
  }
}

// Global Hub Singleton
const globalHub = new GlobalRealtimeHub();

/**
 * Hook to subscribe to PostgreSQL table changes in Supabase in real-time.
 * Multiplexes subscriptions onto a SINGLE organization-scoped WebSocket channel.
 * Eliminates connection storms and duplicate subscriptions.
 */
export function useSupabaseRealtime<T extends Record<string, unknown> = Record<string, unknown>>(
  table: RealtimeTable | string,
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void,
  enabled = true,
  filterOrOptions?: string | RealtimeSubscriptionOptions,
) {
  const queryClient = useQueryClient();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionState>(
    globalHub.state,
  );

  const organizationId =
    typeof filterOrOptions === "object" ? filterOrOptions?.organizationId : null;

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;

    globalHub.setQueryClient(queryClient);
    if (organizationId) {
      globalHub.setOrganizationId(organizationId);
    } else {
      globalHub.initChannel();
    }

    const unsubsState = globalHub.subscribeState((st) => {
      setConnectionStatus(st);
    });

    const targetCanonical = resolveCanonicalTable(table);
    const unregister = globalHub.registerListener(targetCanonical, (payload) => {
      onChangeRef.current?.(payload as RealtimePostgresChangesPayload<T>);
    });

    return () => {
      unsubsState();
      unregister();
    };
  }, [table, enabled, organizationId, queryClient]);

  return { connectionStatus };
}
