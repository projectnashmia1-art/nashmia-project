import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

let browserQueryClient: QueryClient | null = null;

export const createQueryClientInstance = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Keep query data fresh for 5 minutes by default; stable entities use 10m
        staleTime: 1000 * 60 * 5,
        // Retain unused/inactive cache entries in memory for 60 minutes across route navigations
        gcTime: 1000 * 60 * 60,
        // Disable automatic refetches on window focus to eliminate redundant network traffic
        refetchOnWindowFocus: false,
        // Do not automatically refetch on component remount if cached data is still fresh
        refetchOnMount: false,
        // Synchronize on real network reconnection
        refetchOnReconnect: "always",
        // Enable structural sharing to preserve referential identity and avoid unnecessary re-renders
        structuralSharing: true,
        // Limit retry attempts with exponential backoff
        retry: 1,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 15000),
      },
      mutations: {
        retry: 1,
      },
    },
  });
};

export const getRouter = () => {
  const queryClient =
    typeof window !== "undefined"
      ? (browserQueryClient ??= createQueryClientInstance())
      : createQueryClientInstance();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 1000 * 60 * 10,
  });

  return router;
};
