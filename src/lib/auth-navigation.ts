/**
 * Authentication Navigation & Route Persistence Utilities
 * Manages route restoration, redirect targets, and session pre-checks.
 */

const LAST_ROUTE_KEY = "nashmia_last_route";
const REDIRECT_TARGET_KEY = "nashmia_auth_redirect";
const TAB_INITIALIZED_KEY = "nashmia_tab_initialized";

const EXCLUDED_ROUTES = ["/login", "/signup", "/404"];

export function isValidAppRoute(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith("/")) return false;
  return !EXCLUDED_ROUTES.some(
    (excluded) => trimmed === excluded || trimmed.startsWith(`${excluded}?`),
  );
}

export function getLastActiveRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const route = localStorage.getItem(LAST_ROUTE_KEY);
    if (isValidAppRoute(route)) {
      return route;
    }
  } catch {
    // Ignore storage exceptions
  }
  return null;
}

export function setLastActiveRoute(route: string): void {
  if (typeof window === "undefined") return;
  if (!isValidAppRoute(route)) return;
  try {
    localStorage.setItem(LAST_ROUTE_KEY, route);
  } catch {
    // Ignore storage exceptions
  }
}

export function saveRedirectTarget(target: string): void {
  if (typeof window === "undefined") return;
  if (!isValidAppRoute(target)) return;
  try {
    sessionStorage.setItem(REDIRECT_TARGET_KEY, target);
  } catch {
    // Ignore storage exceptions
  }
}

export function getRedirectTarget(): string {
  if (typeof window === "undefined") return "/";

  // 1. Check URL query parameter ?redirect=...
  try {
    const params = new URLSearchParams(window.location.search);
    const redirectParam = params.get("redirect");
    if (isValidAppRoute(redirectParam)) {
      return redirectParam!;
    }
  } catch {
    // Ignore URL parsing exceptions
  }

  // 2. Check sessionStorage for redirect saved when unauthenticated user tried to access a protected page
  try {
    const saved = sessionStorage.getItem(REDIRECT_TARGET_KEY);
    if (isValidAppRoute(saved)) {
      return saved!;
    }
  } catch {
    // Ignore storage exceptions
  }

  // 3. Check localStorage for last active route
  const last = getLastActiveRoute();
  if (last && last !== "/") {
    return last;
  }

  return "/";
}

export function clearRedirectTarget(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(REDIRECT_TARGET_KEY);
  } catch {
    // Ignore storage exceptions
  }
}

export function clearAllAuthTracking(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LAST_ROUTE_KEY);
    sessionStorage.removeItem(REDIRECT_TARGET_KEY);
    sessionStorage.removeItem(TAB_INITIALIZED_KEY);
  } catch {
    // Ignore storage exceptions
  }
}

export function isTabInitialized(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return sessionStorage.getItem(TAB_INITIALIZED_KEY) === "true";
  } catch {
    return true;
  }
}

export function markTabInitialized(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(TAB_INITIALIZED_KEY, "true");
  } catch {
    // Ignore storage exceptions
  }
}

/**
 * Checks if there is a cached Supabase session token in localStorage.
 * Runs synchronously to prevent the login form from flashing when reopening the site.
 */
export function hasLocalSupabaseSession(): boolean {
  if (typeof window === "undefined" || !window.localStorage) return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const item = localStorage.getItem(key);
        if (item && item.includes("access_token")) {
          return true;
        }
      }
    }
  } catch {
    // Ignore storage exceptions
  }
  return false;
}
