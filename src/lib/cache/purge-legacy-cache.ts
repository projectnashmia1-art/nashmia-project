/**
 * Comprehensive Cache Purge Utility
 * Completely cleanses any legacy demo/mock data saved in browser localStorage and sessionStorage,
 * ensuring the application exclusively fetches and renders 100% live database data from Supabase.
 */

const CACHE_VERSION = "v3_real_db_only";
const VERSION_KEY = "nashmia_db_cache_version";

const LEGACY_STORAGE_KEYS = [
  "nashmia_custom_bookings_v1",
  "nashmia_local_bookings",
  "nashmia_custom_buyers_v1",
  "nashmia_custom_suppliers_v1",
  "nashmia_custom_forwarders_v1",
  "nashmia_custom_emails_v1",
  "nashmia_custom_notifications_v1",
  "nashmia_awarded_movements_v1",
  "nashmia_movement_cutoffs_v1",
  "nashmia_movement_cutoffs_registry",
  "nashmia_confirmed_identifiers_v1",
  "nashmia_booking_requests_v1",
  "nashmia_drive_documents_v1",
  "nashmia_forwarder_requests_v1",
  "nashmia_quotations_v1",
  "nashmia_local_documents",
];

export function purgeLegacyClientCache(force = false): boolean {
  if (typeof window === "undefined") return false;

  try {
    const currentVersion = localStorage.getItem(VERSION_KEY);
    if (!force && currentVersion === CACHE_VERSION) {
      return false;
    }

    console.info(
      "[Cache Purge] Purging legacy local storage cache to ensure 100% live Supabase sync...",
    );

    for (const key of LEGACY_STORAGE_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }

    // Set updated version tag
    localStorage.setItem(VERSION_KEY, CACHE_VERSION);
    return true;
  } catch (err) {
    console.warn("[Cache Purge] Notice:", err);
    return false;
  }
}

/**
 * Explicit user-triggered cache purge and hard refresh
 */
export function purgeAllDataAndReload(): void {
  if (typeof window === "undefined") return;

  try {
    for (const key of LEGACY_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    sessionStorage.clear();
    localStorage.setItem(VERSION_KEY, CACHE_VERSION);
  } catch {
    // ignore
  }

  window.location.reload();
}

// Auto-run purge on module initialization
if (typeof window !== "undefined") {
  purgeLegacyClientCache();
}
