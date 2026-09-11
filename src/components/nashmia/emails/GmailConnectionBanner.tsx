import { useState } from "react";
import {
  Mail,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import { useGmail } from "@/lib/use-gmail";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GmailConnectionBannerProps {
  onRefreshEmails?: () => void;
  className?: string;
}

export function GmailConnectionBanner({ onRefreshEmails, className }: GmailConnectionBannerProps) {
  const {
    isConnected,
    isConnecting,
    googleEmail,
    displayName,
    avatarUrl,
    lastSyncAt,
    connect,
    disconnect,
    syncInboxToApp,
  } = useGmail();

  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleConnect = async () => {
    const success = await connect();
    if (success && onRefreshEmails) {
      onRefreshEmails();
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncInboxToApp();
      toast.success("Inbox Synced", {
        description: `Retrieved latest emails from Gmail. ${result.imported} new messages recorded.`,
      });
      if (onRefreshEmails) onRefreshEmails();
    } catch (err) {
      toast.error("Sync Failed", {
        description: err instanceof Error ? err.message : "Failed to sync Gmail inbox",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (isDisconnecting) return;
    setIsDisconnecting(true);
    try {
      await disconnect();
      if (onRefreshEmails) {
        onRefreshEmails();
      }
    } catch (err) {
      toast.error("Disconnect Failed", {
        description: err instanceof Error ? err.message : "Failed to disconnect Gmail",
      });
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div
        id="gmail-connected-banner"
        className={cn(
          "rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/70 via-white to-emerald-50/30 p-4 sm:p-5 shadow-sm transition-all",
          className,
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName || "Google User"}
                  className="size-10 rounded-full border-2 border-emerald-500 object-cover shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="grid size-10 place-items-center rounded-full bg-emerald-600 text-white font-bold text-sm shadow-sm">
                  {(displayName?.[0] || googleEmail?.[0] || "G").toUpperCase()}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="size-2 text-white" />
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900">
                  {displayName || "Connected Account"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                  <span className="size-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Gmail Live Active
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                <span className="font-mono">{googleEmail}</span>
                {lastSyncAt && (
                  <>
                    <span>•</span>
                    <span className="text-slate-500">
                      Synced{" "}
                      {new Date(lastSyncAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={cn(
                  "size-3.5 text-slate-600",
                  isSyncing && "animate-spin text-emerald-600",
                )}
              />
              <span>{isSyncing ? "Syncing..." : "Sync Gmail"}</span>
            </button>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200/60 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
              title="Disconnect Gmail Account"
            >
              <LogOut className={cn("size-3.5", isDisconnecting && "animate-spin")} />
              <span className="hidden sm:inline">
                {isDisconnecting ? "Disconnecting..." : "Disconnect"}
              </span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="gmail-connect-promo-banner"
      className={cn(
        "rounded-2xl border border-blue-200/70 bg-gradient-to-r from-blue-50/60 via-indigo-50/30 to-white p-4 sm:p-5 shadow-xs transition-all",
        className,
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white shadow-xs border border-blue-100">
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="size-6"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Connect your Gmail Account</h3>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Official Google Workspace
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5 max-w-xl">
              Enable the Gmail API to dispatch official booking requests, shipping instructions, and
              container manifests directly from your verified Google mailbox with end-to-end
              delivery tracking.
            </p>
          </div>
        </div>

        {/* Official Google Sign In Button */}
        <div className="shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-800 shadow-xs hover:bg-slate-50 active:bg-slate-100 transition-all disabled:opacity-60 cursor-pointer"
          >
            <div className="size-4 shrink-0">
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="size-4"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
                <path fill="none" d="M0 0h48v48H0z" />
              </svg>
            </div>
            <span>{isConnecting ? "Connecting to Google..." : "Connect with Google"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
