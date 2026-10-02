import { useEffect, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { isSupabaseConfigured } from "@/lib/supabase";
import { queryKeys } from "@/services/data-fetching.service";

/**
 * Global Realtime Provider
 * Subscribes to all Supabase PostgreSQL tables over WebSocket channels,
 * ensuring any change (INSERT, UPDATE, DELETE) instantly syncs across all pages
 * without requiring the user to manually refresh their browser.
 */
export function GlobalRealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Helper to invalidate queries on change
  const handleRealtimeChange = (tableName: string) => {
    console.info(
      `[Global Realtime] Postgres change on "${tableName}", invalidating query caches...`,
    );

    if (
      tableName === "bookings" ||
      tableName === "booking_containers" ||
      tableName === "booking_events"
    ) {
      void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    }

    if (tableName === "buyers") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.buyers() });
    }

    if (tableName === "suppliers") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers() });
    }

    if (tableName === "forwarders" || tableName === "rate_cards") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.forwarders() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.rateCards() });
    }

    if (tableName === "shipping_lines") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shippingLines() });
    }

    if (tableName === "email_messages" || tableName === "email_threads") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.emails() });
    }

    if (
      tableName === "forwarder_requests" ||
      tableName === "quotations" ||
      tableName === "quotation_versions"
    ) {
      void queryClient.invalidateQueries({ queryKey: ["all-forwarder-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests() });
    }

    if (tableName === "notifications") {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  };

  // 1. Core Bookings & Containers Realtime
  useSupabaseRealtime("bookings", () => handleRealtimeChange("bookings"), isSupabaseConfigured);
  useSupabaseRealtime(
    "booking_containers",
    () => handleRealtimeChange("booking_containers"),
    isSupabaseConfigured,
  );
  useSupabaseRealtime(
    "booking_events",
    () => handleRealtimeChange("booking_events"),
    isSupabaseConfigured,
  );

  // 2. Master Directories Realtime
  useSupabaseRealtime("buyers", () => handleRealtimeChange("buyers"), isSupabaseConfigured);
  useSupabaseRealtime("suppliers", () => handleRealtimeChange("suppliers"), isSupabaseConfigured);
  useSupabaseRealtime("forwarders", () => handleRealtimeChange("forwarders"), isSupabaseConfigured);
  useSupabaseRealtime(
    "shipping_lines",
    () => handleRealtimeChange("shipping_lines"),
    isSupabaseConfigured,
  );
  useSupabaseRealtime("rate_cards", () => handleRealtimeChange("rate_cards"), isSupabaseConfigured);

  // 3. Communications & Quotations Realtime
  useSupabaseRealtime(
    "email_messages",
    () => handleRealtimeChange("email_messages"),
    isSupabaseConfigured,
  );
  useSupabaseRealtime(
    "notifications",
    () => handleRealtimeChange("notifications"),
    isSupabaseConfigured,
  );
  useSupabaseRealtime(
    "forwarder_requests",
    () => handleRealtimeChange("forwarder_requests"),
    isSupabaseConfigured,
  );
  useSupabaseRealtime("quotations", () => handleRealtimeChange("quotations"), isSupabaseConfigured);

  // 4. Listen for cross-tab and in-window custom events with debounced targeted invalidation
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleWindowEvent = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
        void queryClient.invalidateQueries({ queryKey: ["dashboard-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      }, 300);
    };

    window.addEventListener("nashmia_bookings_updated", handleWindowEvent);
    window.addEventListener("nashmia_booking_confirmed", handleWindowEvent);
    window.addEventListener("supabase_realtime_bookings_change", handleWindowEvent);
    window.addEventListener("storage", handleWindowEvent);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener("nashmia_bookings_updated", handleWindowEvent);
      window.removeEventListener("nashmia_booking_confirmed", handleWindowEvent);
      window.removeEventListener("supabase_realtime_bookings_change", handleWindowEvent);
      window.removeEventListener("storage", handleWindowEvent);
    };
  }, [queryClient]);

  return <>{children}</>;
}
