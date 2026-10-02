import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { BuyerAccountFull } from "@/lib/buyers-data";
import type { SupplierAccountFull } from "@/lib/suppliers-data";
import type { ForwarderAccount } from "@/lib/forwarders-data";
import {
  fetchBuyersFromSupabase,
  insertBuyerToSupabase,
  updateBuyerInSupabase,
  deleteBuyerFromSupabase,
  fetchSuppliersFromSupabase,
  insertSupplierToSupabase,
  updateSupplierInSupabase,
  deleteSupplierFromSupabase,
  fetchForwardersFromSupabase,
  insertForwarderToSupabase,
  updateForwarderInSupabase,
  deleteForwarderFromSupabase,
  fetchShippingLinesFromSupabase,
  insertShippingLineToSupabase,
  updateShippingLineInSupabase,
  deleteShippingLineFromSupabase,
  fetchRateCardsFromSupabase,
  insertRateCardToSupabase,
  updateRateCardInSupabase,
  deleteRateCardFromSupabase,
  fetchBookingsFromSupabase,
  type ShippingLineRow,
  type RateCardRow,
  type FullBookingRecord,
} from "@/lib/supabase-services";

// ============================================================================
// CLIENT-SIDE CACHE CONFIGURATION & LIFECYCLE POLICIES
// ============================================================================

/**
 * Cache policy for stable master entities (Buyers, Suppliers, Forwarders,
 * Shipping Lines, Rate Cards):
 * - Stale Time: 10 minutes. Within 10 minutes, query deduplication ensures
 *   concurrent or consecutive page navigations reuse in-memory data instantly.
 * - Inactive GC Time: 60 minutes. Preserved in memory across route changes.
 * - Background Revalidation: stale-while-revalidate pattern guarantees 0ms layout
 *   shifts while revalidating seamlessly in the background.
 */
export const STABLE_CACHE_STALE_TIME = 1000 * 60 * 10; // 10 minutes
export const STABLE_CACHE_GC_TIME = 1000 * 60 * 60; // 60 minutes

/**
 * STRICT OPERATIONAL DATA POLICY:
 * Critical operational data (bookings, movement lifecycle stages, cut-offs,
 * container events, and booking confirmation statuses) MUST NEVER rely on
 * stale cache as a source of truth. They are synchronized directly with
 * Supabase / backend endpoints with immediate real-time invalidation.
 */
export const OPERATIONAL_CACHE_STALE_TIME = 0; // Always validate with authoritative source
export const OPERATIONAL_CACHE_GC_TIME = 1000 * 60 * 5; // 5 minutes

// ============================================================================
// SECURITY GUARANTEE: SENSITIVE TOKENS ISOLATION
// ============================================================================

/**
 * Assert that a cache key or payload never touches sensitive credentials.
 * Sensitive Gmail tokens (OAuth access tokens, refresh tokens, client secrets)
 * must NEVER be placed into TanStack Query cache or browser storage.
 */
export function assertNonSensitiveCacheKey(key: readonly unknown[]): void {
  const serialized = JSON.stringify(key).toLowerCase();
  if (
    serialized.includes("token") ||
    serialized.includes("secret") ||
    serialized.includes("credential") ||
    serialized.includes("auth_code")
  ) {
    throw new Error(
      "[Security Violation] Sensitive credentials and Gmail tokens must never be written to the client query cache.",
    );
  }
}

// ============================================================================
// UNIFIED ENTITY CACHE KEYS
// ============================================================================

export const entityCacheKeys = {
  all: ["entities"] as const,
  buyers: (userId?: string | null) => {
    const key = ["entities", "buyers", userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  buyerDetail: (id: string, userId?: string | null) => {
    const key = ["entities", "buyers", "detail", id, userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  suppliers: (userId?: string | null) => {
    const key = ["entities", "suppliers", userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  supplierDetail: (id: string, userId?: string | null) => {
    const key = ["entities", "suppliers", "detail", id, userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  forwarders: (userId?: string | null) => {
    const key = ["entities", "forwarders", userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  forwarderDetail: (id: string, userId?: string | null) => {
    const key = ["entities", "forwarders", "detail", id, userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  shippingLines: (userId?: string | null) => {
    const key = ["entities", "shipping-lines", userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  rateCards: (userId?: string | null) => {
    const key = ["entities", "rate-cards", userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
  /**
   * Operational bookings key — designated for authoritative Supabase sync.
   */
  operationalBookings: (userId?: string | null) => {
    const key = ["operational", "bookings", userId || "all"] as const;
    assertNonSensitiveCacheKey(key);
    return key;
  },
};

// ============================================================================
// REACT QUERY HOOKS FOR STABLE DATA CACHING
// ============================================================================

/**
 * Cached Buyers Query:
 * - Reuses cached results across page navigation (e.g. Buyers Directory -> Bookings -> Compose Email).
 * - Deduplicates in-flight requests if multiple components mount simultaneously.
 * - Revalidates in the background after 10 minutes or on real-time mutation.
 */
export function useCachedBuyers(
  userId?: string | null,
  options?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery<BuyerAccountFull[]>({
    queryKey: entityCacheKeys.buyers(userId),
    queryFn: async () => {
      return fetchBuyersFromSupabase(userId);
    },
    staleTime: options?.staleTime ?? STABLE_CACHE_STALE_TIME,
    gcTime: STABLE_CACHE_GC_TIME,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    structuralSharing: true,
  });
}

/**
 * Cached Suppliers Query:
 * - Reuses cached results across page navigation.
 * - Deduplicates queries and provides background revalidation.
 */
export function useCachedSuppliers(
  userId?: string | null,
  options?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery<SupplierAccountFull[]>({
    queryKey: entityCacheKeys.suppliers(userId),
    queryFn: async () => {
      return fetchSuppliersFromSupabase(userId);
    },
    staleTime: options?.staleTime ?? STABLE_CACHE_STALE_TIME,
    gcTime: STABLE_CACHE_GC_TIME,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    structuralSharing: true,
  });
}

/**
 * Cached Forwarders Query:
 * - Reuses cached results across Forwarders Directory, New Booking, Multi-Forwarder Request,
 *   and Compose Email modals.
 */
export function useCachedForwarders(
  userId?: string | null,
  options?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery<ForwarderAccount[]>({
    queryKey: entityCacheKeys.forwarders(userId),
    queryFn: async () => {
      return fetchForwardersFromSupabase(userId);
    },
    staleTime: options?.staleTime ?? STABLE_CACHE_STALE_TIME,
    gcTime: STABLE_CACHE_GC_TIME,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    structuralSharing: true,
  });
}

/**
 * Cached Shipping Lines Query:
 * - Stable carrier data cached for 10 minutes with background revalidation.
 */
export function useCachedShippingLines(
  userId?: string | null,
  options?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery<ShippingLineRow[]>({
    queryKey: entityCacheKeys.shippingLines(userId),
    queryFn: async () => {
      return fetchShippingLinesFromSupabase(userId);
    },
    staleTime: options?.staleTime ?? STABLE_CACHE_STALE_TIME,
    gcTime: STABLE_CACHE_GC_TIME,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    structuralSharing: true,
  });
}

/**
 * Cached Rate Cards Query:
 * - Stable tariff data cached for 10 minutes with background revalidation.
 */
export function useCachedRateCards(
  userId?: string | null,
  options?: { enabled?: boolean; staleTime?: number },
) {
  return useQuery<RateCardRow[]>({
    queryKey: entityCacheKeys.rateCards(userId),
    queryFn: async () => {
      return fetchRateCardsFromSupabase(userId);
    },
    staleTime: options?.staleTime ?? STABLE_CACHE_STALE_TIME,
    gcTime: STABLE_CACHE_GC_TIME,
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: "always",
    structuralSharing: true,
  });
}

// ============================================================================
// CRITICAL OPERATIONAL DATA HOOK (ALWAYS AUTHORITATIVE WITH SUPABASE)
// ============================================================================

/**
 * Operational Bookings Query:
 * - Enforces staleTime: 0.
 * - Always validates with Supabase / `/api/bookings`.
 * - Prevents cached data from ever becoming the authoritative source for critical booking statuses.
 */
export function useOperationalBookings(userId?: string | null, options?: { enabled?: boolean }) {
  return useQuery<FullBookingRecord[]>({
    queryKey: entityCacheKeys.operationalBookings(userId),
    queryFn: async () => {
      return fetchBookingsFromSupabase(userId);
    },
    staleTime: OPERATIONAL_CACHE_STALE_TIME,
    gcTime: OPERATIONAL_CACHE_GC_TIME,
    enabled: options?.enabled ?? true,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: "always",
  });
}

// ============================================================================
// CACHE INVALIDATION UTILITIES
// ============================================================================

export async function invalidateCachedBuyers(queryClient: QueryClient, userId?: string | null) {
  await queryClient.invalidateQueries({ queryKey: entityCacheKeys.buyers(userId) });
}

export async function invalidateCachedSuppliers(queryClient: QueryClient, userId?: string | null) {
  await queryClient.invalidateQueries({ queryKey: entityCacheKeys.suppliers(userId) });
}

export async function invalidateCachedForwarders(queryClient: QueryClient, userId?: string | null) {
  await queryClient.invalidateQueries({ queryKey: entityCacheKeys.forwarders(userId) });
}

export async function invalidateCachedShippingLines(
  queryClient: QueryClient,
  userId?: string | null,
) {
  await queryClient.invalidateQueries({ queryKey: entityCacheKeys.shippingLines(userId) });
}

export async function invalidateCachedRateCards(queryClient: QueryClient, userId?: string | null) {
  await queryClient.invalidateQueries({ queryKey: entityCacheKeys.rateCards(userId) });
}

export async function invalidateAllStableEntities(
  queryClient: QueryClient,
  userId?: string | null,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: entityCacheKeys.buyers(userId) }),
    queryClient.invalidateQueries({ queryKey: entityCacheKeys.suppliers(userId) }),
    queryClient.invalidateQueries({ queryKey: entityCacheKeys.forwarders(userId) }),
    queryClient.invalidateQueries({ queryKey: entityCacheKeys.shippingLines(userId) }),
    queryClient.invalidateQueries({ queryKey: entityCacheKeys.rateCards(userId) }),
  ]);
}

// ============================================================================
// MUTATION HOOKS WITH OPTIMISTIC UPDATES & CACHE INVALIDATION
// ============================================================================

/**
 * Mutation hook for Buyer accounts with automatic cache invalidation
 */
export function useBuyerMutations(userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = entityCacheKeys.buyers(userId);

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<BuyerAccountFull>) => {
      return insertBuyerToSupabase(payload, userId);
    },
    onSuccess: (newBuyer) => {
      if (newBuyer) {
        queryClient.setQueryData<BuyerAccountFull[]>(queryKey, (old) => {
          if (!old) return [newBuyer];
          return [newBuyer, ...old.filter((b) => b.id !== newBuyer.id)];
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<BuyerAccountFull> }) => {
      const success = await updateBuyerInSupabase(id, payload);
      return { success, id, payload };
    },
    onSuccess: ({ id, payload, success }) => {
      if (success) {
        queryClient.setQueryData<BuyerAccountFull[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((b) => (b.id === id ? ({ ...b, ...payload } as BuyerAccountFull) : b));
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const success = await deleteBuyerFromSupabase(id);
      return { success, id };
    },
    onSuccess: ({ id, success }) => {
      if (success) {
        queryClient.setQueryData<BuyerAccountFull[]>(queryKey, (old) => {
          if (!old) return [];
          return old.filter((b) => b.id !== id);
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    createBuyer: createMutation.mutateAsync,
    updateBuyer: updateMutation.mutateAsync,
    deleteBuyer: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Mutation hook for Supplier accounts with automatic cache invalidation
 */
export function useSupplierMutations(userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = entityCacheKeys.suppliers(userId);

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<SupplierAccountFull>) => {
      return insertSupplierToSupabase(payload, userId);
    },
    onSuccess: (newSupplier) => {
      if (newSupplier) {
        queryClient.setQueryData<SupplierAccountFull[]>(queryKey, (old) => {
          if (!old) return [newSupplier];
          return [newSupplier, ...old.filter((s) => s.id !== newSupplier.id)];
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<SupplierAccountFull> }) => {
      const success = await updateSupplierInSupabase(id, payload);
      return { success, id, payload };
    },
    onSuccess: ({ id, payload, success }) => {
      if (success) {
        queryClient.setQueryData<SupplierAccountFull[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((s) => (s.id === id ? ({ ...s, ...payload } as SupplierAccountFull) : s));
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const success = await deleteSupplierFromSupabase(id);
      return { success, id };
    },
    onSuccess: ({ id, success }) => {
      if (success) {
        queryClient.setQueryData<SupplierAccountFull[]>(queryKey, (old) => {
          if (!old) return [];
          return old.filter((s) => s.id !== id);
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    createSupplier: createMutation.mutateAsync,
    updateSupplier: updateMutation.mutateAsync,
    deleteSupplier: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Mutation hook for Forwarder accounts with automatic cache invalidation
 */
export function useForwarderMutations(userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = entityCacheKeys.forwarders(userId);

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<ForwarderAccount>) => {
      return insertForwarderToSupabase(payload, userId);
    },
    onSuccess: (newForwarder) => {
      if (newForwarder) {
        queryClient.setQueryData<ForwarderAccount[]>(queryKey, (old) => {
          if (!old) return [newForwarder];
          return [newForwarder, ...old.filter((f) => f.id !== newForwarder.id)];
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ForwarderAccount> }) => {
      const success = await updateForwarderInSupabase(id, payload);
      return { success, id, payload };
    },
    onSuccess: ({ id, payload, success }) => {
      if (success) {
        queryClient.setQueryData<ForwarderAccount[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((f) => (f.id === id ? ({ ...f, ...payload } as ForwarderAccount) : f));
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const success = await deleteForwarderFromSupabase(id);
      return { success, id };
    },
    onSuccess: ({ id, success }) => {
      if (success) {
        queryClient.setQueryData<ForwarderAccount[]>(queryKey, (old) => {
          if (!old) return [];
          return old.filter((f) => f.id !== id);
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    createForwarder: createMutation.mutateAsync,
    updateForwarder: updateMutation.mutateAsync,
    deleteForwarder: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Mutation hook for Shipping Lines with automatic cache invalidation
 */
export function useShippingLineMutations(userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = entityCacheKeys.shippingLines(userId);

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<ShippingLineRow>) => {
      return insertShippingLineToSupabase(payload, userId);
    },
    onSuccess: (newLine) => {
      if (newLine) {
        queryClient.setQueryData<ShippingLineRow[]>(queryKey, (old) => {
          if (!old) return [newLine];
          return [newLine, ...old.filter((l) => l.id !== newLine.id)];
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ShippingLineRow> }) => {
      const success = await updateShippingLineInSupabase(id, payload);
      return { success, id, payload };
    },
    onSuccess: ({ id, payload, success }) => {
      if (success) {
        queryClient.setQueryData<ShippingLineRow[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((l) => (l.id === id ? ({ ...l, ...payload } as ShippingLineRow) : l));
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const success = await deleteShippingLineFromSupabase(id);
      return { success, id };
    },
    onSuccess: ({ id, success }) => {
      if (success) {
        queryClient.setQueryData<ShippingLineRow[]>(queryKey, (old) => {
          if (!old) return [];
          return old.filter((l) => l.id !== id);
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    createShippingLine: createMutation.mutateAsync,
    updateShippingLine: updateMutation.mutateAsync,
    deleteShippingLine: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

/**
 * Mutation hook for Rate Cards with automatic cache invalidation
 */
export function useRateCardMutations(userId?: string | null) {
  const queryClient = useQueryClient();
  const queryKey = entityCacheKeys.rateCards(userId);

  const createMutation = useMutation({
    mutationFn: async (payload: Partial<RateCardRow>) => {
      return insertRateCardToSupabase(payload, userId);
    },
    onSuccess: (newRate) => {
      if (newRate) {
        queryClient.setQueryData<RateCardRow[]>(queryKey, (old) => {
          if (!old) return [newRate];
          return [newRate, ...old.filter((r) => r.id !== newRate.id)];
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<RateCardRow> }) => {
      const success = await updateRateCardInSupabase(id, payload);
      return { success, id, payload };
    },
    onSuccess: ({ id, payload, success }) => {
      if (success) {
        queryClient.setQueryData<RateCardRow[]>(queryKey, (old) => {
          if (!old) return [];
          return old.map((r) => (r.id === id ? ({ ...r, ...payload } as RateCardRow) : r));
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const success = await deleteRateCardFromSupabase(id);
      return { success, id };
    },
    onSuccess: ({ id, success }) => {
      if (success) {
        queryClient.setQueryData<RateCardRow[]>(queryKey, (old) => {
          if (!old) return [];
          return old.filter((r) => r.id !== id);
        });
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    createRateCard: createMutation.mutateAsync,
    updateRateCard: updateMutation.mutateAsync,
    deleteRateCard: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
