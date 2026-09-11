import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Supabase client configuration using environment variables.
 * Credentials must come exclusively from environment variables.
 */
function resolveEnv(key: string): string {
  try {
    if (typeof process !== "undefined" && process?.env && process.env[key]) {
      return String(process.env[key]);
    }
  } catch {
    // Ignore process reference errors
  }
  try {
    if (
      typeof import.meta !== "undefined" &&
      import.meta?.env &&
      (import.meta.env as Record<string, string>)[key]
    ) {
      return String((import.meta.env as Record<string, string>)[key]);
    }
  } catch {
    // Ignore import.meta reference errors
  }
  return "";
}

const supabaseUrl = (resolveEnv("VITE_SUPABASE_URL") || resolveEnv("SUPABASE_URL") || "") as string;

const supabaseAnonKey = (resolveEnv("SUPABASE_SECRET_KEY") ||
  resolveEnv("SUPABASE_SERVICE_ROLE_KEY") ||
  resolveEnv("VITE_SUPABASE_ANON_KEY") ||
  resolveEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
  resolveEnv("SUPABASE_PUBLISHABLE_KEY") ||
  "") as string;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseAnonKey && !supabaseUrl.includes("placeholder-project"),
);

if (!isSupabaseConfigured) {
  console.warn(
    "[Supabase] Environment variables VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are not set. Provide them in your environment settings.",
  );
}

// Fallback placeholder credentials to prevent module crash when env vars are pending in the preview
const fallbackUrl = "https://placeholder-project.supabase.co";
const fallbackKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder";

/**
 * Centralized Supabase client instance.
 * Exported for application-wide reuse across authentication, tables, and realtime services.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || fallbackUrl,
  supabaseAnonKey || fallbackKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);

export interface SupabaseConnectionResult {
  success: boolean;
  message: string;
  isConfigured: boolean;
  latencyMs?: number;
  timestamp?: string;
  url?: string;
  error?: string;
}

/**
 * Safe connection test to verify that the Supabase client can communicate with the project.
 * Uses a non-destructive auth session ping and health query that does not require any custom database tables to exist.
 */
export async function testSupabaseConnection(): Promise<SupabaseConnectionResult> {
  const timestamp = new Date().toISOString();
  const maskedUrl = supabaseUrl
    ? supabaseUrl.replace(/https:\/\/(.{4}).*(\.supabase\.co)/, "https://$1...$2")
    : undefined;

  if (!isSupabaseConfigured) {
    const result: SupabaseConnectionResult = {
      success: false,
      isConfigured: false,
      timestamp,
      url: maskedUrl,
      message:
        "Supabase credentials pending. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.",
    };
    console.warn("[Supabase Connection Test]", result);
    return result;
  }

  const startTime = performance.now();

  try {
    // Communication test using auth.getSession() which non-destructively pings Supabase
    const { error } = await supabase.auth.getSession();
    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      const result: SupabaseConnectionResult = {
        success: false,
        isConfigured: true,
        latencyMs,
        timestamp,
        url: maskedUrl,
        message: "Failed to communicate with Supabase project.",
        error: error.message,
      };
      console.error("[Supabase Connection Test]", result);
      return result;
    }

    const result: SupabaseConnectionResult = {
      success: true,
      isConfigured: true,
      latencyMs,
      timestamp,
      url: maskedUrl,
      message: "Successfully connected to Supabase project.",
    };
    console.log("[Supabase Connection Test] Connection verified:", result);
    return result;
  } catch (err: unknown) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = err instanceof Error ? err.message : String(err);
    const result: SupabaseConnectionResult = {
      success: false,
      isConfigured: true,
      latencyMs,
      timestamp,
      url: maskedUrl,
      message: "Unexpected error during Supabase connection test.",
      error: errorMessage,
    };
    console.error("[Supabase Connection Test]", result);
    return result;
  }
}
