import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";

  const isAuthenticated = Boolean(user || session);

  useEffect(() => {
    // Only perform redirects after initial session check has completed
    if (loading) return;

    if (!isAuthenticated && !isAuthRoute) {
      // User is not authenticated and is accessing a protected route
      const currentPath = location.pathname + (location.searchStr ? location.searchStr : "");
      const redirectTarget = currentPath && currentPath !== "/" ? currentPath : undefined;

      navigate({
        to: "/login",
        search: redirectTarget ? { redirect: redirectTarget } : undefined,
        replace: true,
      });
    } else if (isAuthenticated && isAuthRoute) {
      // User is authenticated and on login/signup page
      let targetUrl = "/";
      try {
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const redirectParam = params.get("redirect");
          if (
            redirectParam &&
            redirectParam.startsWith("/") &&
            !redirectParam.startsWith("/login") &&
            !redirectParam.startsWith("/signup")
          ) {
            targetUrl = redirectParam;
          }
        }
      } catch {
        targetUrl = "/";
      }

      navigate({
        to: targetUrl,
        replace: true,
      });
    }
  }, [isAuthenticated, isAuthRoute, loading, location.pathname, location.searchStr, navigate]);

  // While checking auth status on initial load, show clean loading state to prevent flash of login or protected pages
  if (loading) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center bg-white"
        aria-busy="true"
        aria-label="Checking authentication..."
      >
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-[#6A80A9]/25 border-t-[#6A80A9] animate-spin" />
        </div>
      </div>
    );
  }

  // If not authenticated and trying to view a protected route, prevent rendering protected content while redirecting
  if (!isAuthenticated && !isAuthRoute) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center bg-white"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-[#6A80A9]/25 border-t-[#6A80A9] animate-spin" />
        </div>
      </div>
    );
  }

  // If authenticated and on an auth route, prevent rendering login/signup form while redirecting to app
  if (isAuthenticated && isAuthRoute) {
    return (
      <div
        className="flex min-h-screen w-full items-center justify-center bg-white"
        aria-busy="true"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 rounded-full border-2 border-[#6A80A9]/25 border-t-[#6A80A9] animate-spin" />
        </div>
      </div>
    );
  }

  // Otherwise render the route normally
  return <>{children}</>;
}
