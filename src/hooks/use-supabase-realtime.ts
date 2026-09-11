import { useEffect, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

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
  | "forwarder_offers";

/**
 * Hook to subscribe to PostgreSQL table changes in Supabase in real-time.
 * Uses a ref for onChange to prevent unnecessary WebSocket channel teardowns.
 * Automatically cleans up channel subscriptions when the component unmounts.
 */
export function useSupabaseRealtime<T extends Record<string, unknown> = Record<string, unknown>>(
  table: RealtimeTable,
  onChange: (payload: RealtimePostgresChangesPayload<T>) => void,
  enabled = true,
  filter?: string,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!isSupabaseConfigured || !enabled) return;

    const channelId = `realtime_${table}_${filter || "all"}_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    const channel = supabase.channel(channelId);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            try {
              onChangeRef.current?.(payload);
            } catch (err) {
              console.warn("[useSupabaseRealtime] Handler error:", err);
            }
          }, 400);
        },
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [table, enabled, filter]);
}
