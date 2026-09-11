import { useEffect, useState } from "react";
import { Database, RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { testSupabaseConnection, type SupabaseConnectionResult } from "@/lib/supabase";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface SupabaseStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
}

export function SupabaseStatusIndicator({ className }: SupabaseStatusIndicatorProps) {
  const [result, setResult] = useState<SupabaseConnectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const runTest = async () => {
    setIsLoading(true);
    try {
      const res = await testSupabaseConnection();
      setResult(res);
    } catch (err) {
      console.error("[SupabaseStatusIndicator] Connection test failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void runTest();
  }, []);

  const getStatusColor = () => {
    if (isLoading) return "bg-amber-400";
    if (result?.success) return "bg-emerald-500";
    if (!result?.isConfigured) return "bg-amber-500";
    return "bg-rose-500";
  };

  const getStatusLabel = () => {
    if (isLoading) return "Testing...";
    if (result?.success) return "Supabase Live";
    if (!result?.isConfigured) return "Supabase (Setup)";
    return "Supabase Offline";
  };

  const getStatusBadgeClasses = () => {
    if (isLoading) return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    if (result?.success)
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
    if (!result?.isConfigured)
      return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200";
    return "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300";
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id="supabase-status-indicator-button"
          title="Supabase Database Connection Status"
          aria-label="Supabase Database Connection Status"
          className={cn(
            "group inline-flex h-8 items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-xs transition-all duration-200 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary/20",
            getStatusBadgeClasses(),
            className,
          )}
        >
          <span className="relative flex size-2">
            <span
              className={cn(
                "absolute inline-flex h-full w-full rounded-full opacity-75",
                isLoading && "animate-ping",
                result?.success && "animate-ping",
                getStatusColor(),
              )}
            />
            <span className={cn("relative inline-flex size-2 rounded-full", getStatusColor())} />
          </span>

          <Database className="size-3.5 opacity-80" />
          <span className="hidden sm:inline">{getStatusLabel()}</span>
          {result?.latencyMs !== undefined && result.success && (
            <span className="hidden text-[10px] opacity-70 md:inline">{result.latencyMs}ms</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        id="supabase-status-popover"
        align="end"
        className="glass-apple w-80 rounded-[18px] border border-white/80 p-4 shadow-xl backdrop-blur-2xl"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "grid size-7 place-items-center rounded-lg border",
                  getStatusBadgeClasses(),
                )}
              >
                {result?.success ? (
                  <CheckCircle2 className="size-4 text-emerald-600" />
                ) : !result?.isConfigured ? (
                  <AlertTriangle className="size-4 text-amber-600" />
                ) : (
                  <XCircle className="size-4 text-rose-600" />
                )}
              </div>
              <div>
                <p className="text-[13px] font-bold text-foreground">Database Connection</p>
                <p className="text-[10.5px] text-muted-foreground">Supabase Client Verification</p>
              </div>
            </div>

            <button
              type="button"
              id="supabase-retest-button"
              onClick={() => void runTest()}
              disabled={isLoading}
              className="inline-flex size-7 items-center justify-center rounded-lg border border-border/70 bg-background/80 text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Re-run connection test"
              aria-label="Re-run connection test"
            >
              <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
            </button>
          </div>

          <div className="flex flex-col gap-2 rounded-xl bg-muted/50 p-2.5 text-[11.5px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-semibold text-foreground">
                {isLoading
                  ? "Testing..."
                  : result?.success
                    ? "Active & Connected"
                    : result?.isConfigured
                      ? "Connection Error"
                      : "Pending Credentials"}
              </span>
            </div>

            {result?.latencyMs !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Latency:</span>
                <span className="font-mono text-[11px] font-medium text-foreground">
                  {result.latencyMs} ms
                </span>
              </div>
            )}

            {result?.timestamp && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Checked at:</span>
                <span className="font-mono text-[10.5px] text-muted-foreground">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </span>
              </div>
            )}

            <div className="border-t border-border/50 pt-2">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {result?.message || "Running verification query..."}
              </p>
              {result?.error && (
                <p className="mt-1 rounded-md bg-rose-500/10 p-1.5 font-mono text-[10.5px] text-rose-600 dark:text-rose-400">
                  {result.error}
                </p>
              )}
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            Non-destructive query via Supabase JavaScript SDK.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
