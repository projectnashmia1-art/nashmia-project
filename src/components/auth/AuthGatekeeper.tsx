import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import {
  clearRedirectTarget,
  getLastActiveRoute,
  getRedirectTarget,
  hasLocalSupabaseSession,
  isTabInitialized,
  markTabInitialized,
  saveRedirectTarget,
  setLastActiveRoute,
} from "@/lib/auth-navigation";

/**
 * Minimal, clean loading placeholder while session is being verified.
 * Matches the existing application canvas to eliminate layout shift and prevent flash.
 */
function AuthLoadingPlaceholder() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white"
      aria-label="Checking session"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-slate-800" />
      </div>
    </div>
  );
}

export function AuthGatekeeper({ children }: { children: ReactNode }) {
  const { session, user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";
  const isAuthenticated = Boolean(session && user);

  useEffect(() => {
    // Wait until the initial session check completes
    if (loading) return;

    if (!isAuthenticated) {
      // Unauthenticated visitor trying to access a protected page
      if (!isAuthRoute) {
        const currentPath = location.pathname + (location.search || "");
        saveRedirectTarget(currentPath);
        navigate({
          to: "/login",
          search: { redirect: currentPath } as never,
          replace: true,
        });
      }
    } else {
      // Authenticated user
      if (isAuthRoute) {
        // Prevent logged-in user from seeing Sign In / Sign Up page again
        const target = getRedirectTarget();
        clearRedirectTarget();
        markTabInitialized();
        navigate({
          to: target as never,
          replace: true,
        });
      } else {
        // Protected route accessed
        // If reopening the website at the root "/" in a fresh tab/window:
        if (location.pathname === "/" && !isTabInitialized()) {
          const lastRoute = getLastActiveRoute();
          markTabInitialized();
          if (lastRoute && lastRoute !== "/") {
            navigate({
              to: lastRoute as never,
              replace: true,
            });
            return;
          }
        } else {
          markTabInitialized();
        }

        // Persist the current valid route so it can be restored on future website reopening
        setLastActiveRoute(location.pathname + (location.search || ""));
      }
    }
  }, [loading, isAuthenticated, isAuthRoute, location.pathname, location.search, navigate]);

  // While checking authentication session, prevent protected pages and existing sessions on /login from flashing
  if (loading) {
    // If on /login or /signup and a local session exists, hold render to avoid flash of login form
    if (isAuthRoute && hasLocalSupabaseSession()) {
      return <AuthLoadingPlaceholder />;
    }
    // If on a protected route, hold render until session state is determined
    if (!isAuthRoute) {
      return <AuthLoadingPlaceholder />;
    }
  }

  // If unauthenticated and on a protected route, do NOT render protected content while redirecting to /login
  if (!isAuthenticated && !isAuthRoute) {
    return <AuthLoadingPlaceholder />;
  }

  // If authenticated and on /login or /signup, do NOT render the auth form while redirecting to destination
  if (isAuthenticated && isAuthRoute) {
    return <AuthLoadingPlaceholder />;
  }

  return <>{children}</>;
}
