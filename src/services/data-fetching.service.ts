import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBookingsFromSupabase,
  fetchBookingByIdFromSupabase,
  fetchBuyersFromSupabase,
  fetchSuppliersFromSupabase,
  fetchForwardersFromSupabase,
  fetchShippingLinesFromSupabase,
  fetchRateCardsFromSupabase,
  createBookingInSupabase,
  updateBookingDetailsInSupabase,
  updateBookingStatusInSupabase,
  type FullBookingRecord,
} from "@/lib/supabase-services";
import { fetchBookingRequestsFromSupabase } from "@/lib/requests-data";
import { fetchEmailsFromSupabase } from "@/lib/email-services";
import { getSavedDocuments, type DriveFile } from "@/components/nashmia/documents/documents-data";
import type { BuyerAccountFull } from "@/lib/buyers-data";
import type { SupplierAccountFull } from "@/lib/suppliers-data";
import type { ForwarderAccount } from "@/lib/forwarders-data";
import type { BookingRequestRecord } from "@/types/requests";
import type { EmailRecord } from "@/types/email.types";

// Cache Keys Registry
export const queryKeys = {
  bookings: (userId?: string | null) => ["dashboard-bookings", userId || "all"] as const,
  bookingDetail: (id: string, userId?: string | null) =>
    ["dashboard-bookings", "detail", id, userId || "all"] as const,
  requests: (userId?: string | null) => ["dashboard-requests", userId || "all"] as const,
  buyers: (userId?: string | null) => ["entities", "buyers", userId || "all"] as const,
  suppliers: (userId?: string | null) => ["entities", "suppliers", userId || "all"] as const,
  forwarders: (userId?: string | null) => ["entities", "forwarders", userId || "all"] as const,
  shippingLines: (userId?: string | null) =>
    ["entities", "shipping-lines", userId || "all"] as const,
  rateCards: (userId?: string | null) => ["entities", "rate-cards", userId || "all"] as const,
  emails: (userId?: string | null) => ["emails", userId || "all"] as const,
  documents: (userId?: string | null) => ["documents", userId || "all"] as const,
  metrics: (userId?: string | null) => ["dashboard-metrics", userId || "all"] as const,
};

/**
 * Robust TanStack Query hook to fetch real bookings from Supabase with proper loading states.
 */
export function useRealBookings(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<FullBookingRecord[], Error>({
    queryKey: queryKeys.bookings(userId),
    queryFn: async () => {
      return fetchBookingsFromSupabase(userId);
    },
    staleTime: 0, // Always fresh
    gcTime: 1000 * 60 * 10,
    enabled: options?.enabled ?? true,
    refetchInterval: 3000, // 3s real-time continuous background sync
    refetchOnWindowFocus: true,
    refetchOnReconnect: "always",
  });
}

/**
 * Fetch a single booking by ID or Movement Number with full container & event joins.
 */
export function useRealBookingDetail(
  id: string,
  userId?: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery<FullBookingRecord | null, Error>({
    queryKey: queryKeys.bookingDetail(id, userId),
    queryFn: async () => {
      if (!id) return null;
      return fetchBookingByIdFromSupabase(id);
    },
    enabled: Boolean(id) && (options?.enabled ?? true),
    staleTime: 0,
    refetchInterval: 3000,
  });
}

/**
 * Robust TanStack Query hook for Booking Requests mapped directly from real Supabase records.
 */
export function useRealBookingRequests(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<BookingRequestRecord[], Error>({
    queryKey: queryKeys.requests(userId),
    queryFn: async () => {
      return fetchBookingRequestsFromSupabase(userId);
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    enabled: options?.enabled ?? true,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Robust TanStack Query hook for live Supabase Buyers directory.
 */
export function useRealBuyers(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<BuyerAccountFull[], Error>({
    queryKey: queryKeys.buyers(userId),
    queryFn: async () => {
      return fetchBuyersFromSupabase(userId);
    },
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 30,
    enabled: options?.enabled ?? true,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Robust TanStack Query hook for live Supabase Suppliers directory.
 */
export function useRealSuppliers(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<SupplierAccountFull[], Error>({
    queryKey: queryKeys.suppliers(userId),
    queryFn: async () => {
      return fetchSuppliersFromSupabase(userId);
    },
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 30,
    enabled: options?.enabled ?? true,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Robust TanStack Query hook for live Supabase Forwarders directory.
 */
export function useRealForwarders(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<ForwarderAccount[], Error>({
    queryKey: queryKeys.forwarders(userId),
    queryFn: async () => {
      return fetchForwardersFromSupabase(userId);
    },
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 30,
    enabled: options?.enabled ?? true,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Robust TanStack Query hook for live Shipping Lines.
 */
export function useRealShippingLines(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.shippingLines(userId),
    queryFn: async () => {
      return fetchShippingLinesFromSupabase(userId);
    },
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 60,
    enabled: options?.enabled ?? true,
    refetchInterval: 8000,
  });
}

/**
 * Robust TanStack Query hook for live Rate Cards.
 */
export function useRealRateCards(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.rateCards(userId),
    queryFn: async () => {
      return fetchRateCardsFromSupabase(userId);
    },
    staleTime: 1000 * 5,
    gcTime: 1000 * 60 * 60,
    enabled: options?.enabled ?? true,
    refetchInterval: 8000,
  });
}

/**
 * Robust TanStack Query hook for live Email Messages synchronized from Gmail/Supabase.
 */
export function useRealEmails(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<EmailRecord[], Error>({
    queryKey: queryKeys.emails(userId),
    queryFn: async () => {
      return fetchEmailsFromSupabase();
    },
    staleTime: 0,
    gcTime: 1000 * 60 * 10,
    enabled: options?.enabled ?? true,
    refetchInterval: 4000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Robust TanStack Query hook for live Documents.
 */
export function useRealDocuments(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<DriveFile[], Error>({
    queryKey: queryKeys.documents(userId),
    queryFn: async () => {
      try {
        const res = await fetch("/api/documents");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.files)) {
            return data.files;
          }
        }
      } catch {
        // Fall back to client storage
      }
      return getSavedDocuments();
    },
    staleTime: 1000 * 10,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Real-time Invalidation & Mutation Helper for Booking updates.
 */
export function useBookingMutations(userId?: string | null) {
  const queryClient = useQueryClient();

  const createBooking = useMutation({
    mutationFn: async (payload: Parameters<typeof createBookingInSupabase>[0]) => {
      return createBookingInSupabase(payload, userId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics(userId) });
    },
  });

  const updateBookingDetails = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Parameters<typeof updateBookingDetailsInSupabase>[1];
    }) => {
      return updateBookingDetailsInSupabase(id, updates);
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings(userId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bookingDetail(variables.id, userId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics(userId) });
    },
  });

  const updateBookingStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return updateBookingStatusInSupabase(id, status);
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bookings(userId) });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.bookingDetail(variables.id, userId),
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.requests(userId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.metrics(userId) });
    },
  });

  return {
    createBooking,
    updateBookingDetails,
    updateBookingStatus,
  };
}
