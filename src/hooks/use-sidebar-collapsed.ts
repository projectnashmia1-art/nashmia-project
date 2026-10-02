import { useSyncExternalStore, useCallback } from "react";

const SIDEBAR_COLLAPSED_KEY = "nashmia_sidebar_collapsed";

function getStoredSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);

  const handleStorage = (e: StorageEvent) => {
    if (e.key === SIDEBAR_COLLAPSED_KEY || e.key === null) {
      callback();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", handleStorage);
  };
}

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error(e);
    }
  });
}

export function setSidebarCollapsed(value: boolean | ((prev: boolean) => boolean)) {
  const current = getStoredSnapshot();
  const next = typeof value === "function" ? value(current) : value;
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  } catch (e) {
    console.error("Failed to save sidebar state", e);
  }
  notifyListeners();
}

export function toggleSidebarCollapsed() {
  setSidebarCollapsed((prev) => !prev);
}

export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getStoredSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    toggleSidebarCollapsed();
  }, []);

  const setCollapsed = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsed(value);
  }, []);

  return [collapsed, toggle, setCollapsed] as const;
}
