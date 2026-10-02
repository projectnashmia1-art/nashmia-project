import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  | "requests";

export type RealtimeConnectionState =
  "SUBSCRIBED" | "CONNECTING" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR";

interface ChannelPoolEntry {
  channel: RealtimeChannel;
  listeners: Set<(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void>;
  teardownTimer: ReturnType<typeof setTimeout> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  reconnectAttempts: number;
  state: RealtimeConnectionState;
  targetTable: string;
  filter?: string;
  channelName: string;
}

// Global multiplexed channel registry to ensure exactly ONE subscription per table resource
const channelPool = new Map<string, ChannelPoolEntry>();

// Grace period before closing an unused channel (avoids WebSocket reconnect storms on route change)
const CHANNEL_TEARDOWN_GRACE_MS = 2500;

// Maximum reconnection backoff in ms
const MAX_RECONNECT_DELAY_MS = 10000;

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
const VALID_TABLES = new Set<string>([
  "buyers",
  "suppliers",
  "forwarders",
  "shipping_lines",
  "rate_cards",
  "bookings",
  "booking_containers",
  "booking_events",
  "notifications",
  "email_messages",
  "email_threads",
  "forwarder_offers",
  "booking_forwarders",
  "forwarder_requests",
  "quotations",
  "quotation_versions",
  "requests",
]);

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

/**
 * Hook to subscribe to PostgreSQL table changes in Supabase in real-time.
 * Multiplexes subscriptions into a single WebSocket channel per table resource.
 * Automatically synchronizes TanStack Query cache without triggering expensive
 * full-database refetches or duplicate WebSocket connections.
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

  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionState>("CONNECTING");

  const filter = typeof filterOrOptions === "string" ? filterOrOptions : filterOrOptions?.filter;
  const organizationId =
    typeof filterOrOptions === "object" ? filterOrOptions?.organizationId : null;

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;

    const targetTable = resolveCanonicalTable(table);

    if (!VALID_TABLES.has(targetTable) && !VALID_TABLES.has(table)) {
      console.warn(`[useSupabaseRealtime] Table "${targetTable}" is not in valid realtime tables.`);
      return;
    }

    const channelKey = `${targetTable}:${filter || "*"}`;

    const listener = (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      // 1. Organization filtering guard: discard if record belongs to another organization
      if (organizationId) {
        const row = (payload.new || payload.old || {}) as Record<string, unknown>;
        if (row.organization_id && String(row.organization_id) !== String(organizationId)) {
          return;
        }
      }

      // 2. Event deduplication guard
      const row = (payload.new || payload.old || {}) as Record<string, unknown>;
      const recordId = String(row.id || row.booking_id || row.movement_number || "");
      const recordTs = String(payload.commit_timestamp || row.updated_at || row.created_at || "");
      const eventSig = `${targetTable}:${payload.eventType}:${recordId}:${recordTs}`;

      cleanupOldEventSignatures();
      if (recentEventSignatures.has(eventSig)) {
        return; // Already processed this exact event
      }
      recentEventSignatures.set(eventSig, Date.now());

      // 3. Forward to component listener if provided
      try {
        onChangeRef.current?.(payload as RealtimePostgresChangesPayload<T>);
      } catch (err) {
        console.warn(`[useSupabaseRealtime] Error in listener for ${targetTable}:`, err);
      }
    };

    let entry = channelPool.get(channelKey);

    const setupSubscription = (currentEntry: ChannelPoolEntry) => {
      const channel = currentEntry.channel;

      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: targetTable,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          // Organization filtering guard:
          // Check if payload row has an organization_id and doesn't match active organization
          const targetRow = (payload.new || payload.old || {}) as Record<string, unknown>;
          if (
            organizationId &&
            targetRow.organization_id &&
            String(targetRow.organization_id) !== String(organizationId)
          ) {
            return;
          }

          // Surgical cache update: update affected item without refetching entire database
          try {
            if (targetTable === "bookings") {
              applyBookingRealtimeUpdate(queryClient, payload);
            } else if (targetTable === "forwarder_requests") {
              applyForwarderRequestRealtimeUpdate(queryClient, payload);
            } else if (targetTable === "quotations" || targetTable === "quotation_versions") {
              applyQuotationRealtimeUpdate(queryClient, payload);
            } else if (targetTable === "forwarder_offers" || targetTable === "booking_forwarders") {
              applyOfferRealtimeUpdate(queryClient, payload);
            } else if (targetTable === "booking_events") {
              applyBookingEventRealtimeUpdate(queryClient, payload);
            } else if (targetTable === "email_messages") {
              applyEmailMessageRealtimeUpdate(queryClient, payload);
            } else if (targetTable === "notifications") {
              applyNotificationRealtimeUpdate(queryClient, payload);
            }
          } catch (syncErr) {
            console.warn(`[useSupabaseRealtime] Cache sync notice on ${targetTable}:`, syncErr);
          }

          // Dispatch to active registered listeners in pool
          currentEntry.listeners.forEach((fn) => {
            try {
              fn(payload);
            } catch (e) {
              console.warn(`[useSupabaseRealtime] Dispatch error on ${targetTable}:`, e);
            }
          });
        },
      );

      channel.subscribe((status, err) => {
        currentEntry.state = status as RealtimeConnectionState;
        setConnectionStatus(status as RealtimeConnectionState);

        if (status === "SUBSCRIBED") {
          currentEntry.reconnectAttempts = 0;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn(
            `[useSupabaseRealtime] Channel notice on ${channelKey} (${status}):`,
            err?.message,
          );

          // Exponential backoff reconnect
          if (!currentEntry.reconnectTimer) {
            currentEntry.reconnectAttempts += 1;
            const delay = Math.min(
              1000 * Math.pow(1.5, currentEntry.reconnectAttempts),
              MAX_RECONNECT_DELAY_MS,
            );
            currentEntry.reconnectTimer = setTimeout(() => {
              currentEntry.reconnectTimer = null;
              if (currentEntry.listeners.size > 0) {
                try {
                  void channel.subscribe();
                } catch (reconnectErr) {
                  console.warn("[useSupabaseRealtime] Reconnect notice:", reconnectErr);
                }
              }
            }, delay);
          }
        }
      });
    };

    if (entry) {
      if (entry.teardownTimer) {
        clearTimeout(entry.teardownTimer);
        entry.teardownTimer = null;
      }
      setConnectionStatus(entry.state);
    } else {
      const channelName = `rt_${targetTable}_${(filter || "all").replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      const channel = supabase.channel(channelName);

      entry = {
        channel,
        listeners: new Set(),
        teardownTimer: null,
        reconnectTimer: null,
        reconnectAttempts: 0,
        state: "CONNECTING",
        targetTable,
        filter,
        channelName,
      };
      channelPool.set(channelKey, entry);
      setupSubscription(entry);
    }

    entry.listeners.add(listener);

    // Network online handler to immediately reconnect if internet drops and recovers
    const handleOnline = () => {
      const activeEntry = channelPool.get(channelKey);
      if (activeEntry && activeEntry.state !== "SUBSCRIBED") {
        try {
          void activeEntry.channel.subscribe();
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("online", handleOnline);
      const currentEntry = channelPool.get(channelKey);
      if (!currentEntry) return;

      currentEntry.listeners.delete(listener);

      // Grace period before tearing down channel to avoid flapping between route navigations
      if (currentEntry.listeners.size === 0) {
        if (currentEntry.teardownTimer) {
          clearTimeout(currentEntry.teardownTimer);
        }
        if (currentEntry.reconnectTimer) {
          clearTimeout(currentEntry.reconnectTimer);
          currentEntry.reconnectTimer = null;
        }

        currentEntry.teardownTimer = setTimeout(() => {
          const freshCheck = channelPool.get(channelKey);
          if (freshCheck && freshCheck.listeners.size === 0) {
            void supabase.removeChannel(freshCheck.channel);
            channelPool.delete(channelKey);
          }
        }, CHANNEL_TEARDOWN_GRACE_MS);
      }
    };
  }, [table, enabled, filter, organizationId, queryClient]);

  return { connectionStatus };
}
