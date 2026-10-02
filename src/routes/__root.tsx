import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth-context";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { GmailProvider } from "@/lib/use-gmail";
import { NotificationsProvider } from "@/lib/notifications-context";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { logger } from "@/lib/error-logging-service";
import { PageTransitionProvider } from "@/components/common/PageTransition";
import { GlobalRealtimeProvider } from "@/components/providers/GlobalRealtimeProvider";
import "@/lib/cache/purge-legacy-cache";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    logger.error("Root router route error", error, {
      boundary: "tanstack_root_error_component",
    });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Nashmia Operations Hub" },
      {
        name: "description",
        content:
          "Container logistics operations platform for Nashmia Industries — bookings, transits, cut-offs, and deliveries in a liquid glass interface.",
      },
      { name: "author", content: "Nashmia Industries" },
      { property: "og:title", content: "Nashmia Operations Hub" },
      {
        property: "og:description",
        content:
          "Container logistics operations platform for Nashmia Industries — bookings, transits, cut-offs, and deliveries in a liquid glass interface.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "data:," },
    ],
    scripts: [
      {
        src: "https://accounts.google.com/gsi/client",
        async: true,
        defer: true,
      },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <PageTransitionProvider>
        <Outlet />
      </PageTransitionProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const { queryClient } = Route.useRouteContext();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="m-0 p-0 w-full min-w-full max-w-full h-full min-h-full min-h-[100dvh] overflow-x-hidden bg-white"
    >
      <head>
        <HeadContent />
      </head>
      <body
        suppressHydrationWarning
        className="m-0 p-0 w-full min-w-full max-w-full min-h-full min-h-[100dvh] overflow-x-hidden bg-white text-black antialiased selection:bg-[#6A80A9]/20 overscroll-none"
      >
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <AuthGuard>
              <GmailProvider>
                <NotificationsProvider>
                  <GlobalRealtimeProvider>
                    <ErrorBoundary moduleName="Application View">{children}</ErrorBoundary>
                    <Toaster position="top-right" />
                  </GlobalRealtimeProvider>
                </NotificationsProvider>
              </GmailProvider>
            </AuthGuard>
          </AuthProvider>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}
