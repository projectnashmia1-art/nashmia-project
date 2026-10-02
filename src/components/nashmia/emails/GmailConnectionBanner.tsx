import { useState } from "react";
import {
  CheckCircle2,
  RefreshCw,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Zap,
  Mail,
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
          "rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs transition-all hover:border-slate-300",
          className,
        )}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Left: Account Profile & Status */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <div className="grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#0FA3B1] to-[#0b7a85] text-white font-bold text-base shadow-2xs">
                {(displayName?.[0] || googleEmail?.[0] || "G").toUpperCase()}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center shadow-2xs">
                <CheckCircle2 className="size-2.5 text-white" />
              </span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14.5px] font-bold text-slate-900 tracking-tight truncate">
                  {displayName || "Connected Account"}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Active
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-2 py-0.5">
                  <ShieldCheck className="size-3 text-emerald-600" />
                  Google Verified
                </span>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 flex-wrap">
                <span className="font-mono text-slate-700 font-medium">{googleEmail}</span>
                {lastSyncAt && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-slate-500 text-[11.5px]">
                      Last synced:{" "}
                      <span className="font-medium text-slate-700">
                        {new Date(lastSyncAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0 flex-wrap">
            <button
              type="button"
              onClick={handleSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw
                className={cn(
                  "size-3.5 text-slate-600",
                  isSyncing && "animate-spin text-[#0FA3B1]",
                )}
              />
              <span>{isSyncing ? "Syncing..." : "Sync Gmail"}</span>
            </button>

            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 hover:text-slate-900 transition-all"
            >
              <ExternalLink className="size-3.5 text-slate-400" />
              <span className="hidden sm:inline">Open Mailbox</span>
            </a>

            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50/70 hover:border-rose-300 transition-all disabled:opacity-50 cursor-pointer"
              title="Disconnect Gmail Account"
            >
              <LogOut className={cn("size-3.5", isDisconnecting && "animate-spin")} />
              <span>{isDisconnecting ? "Disconnecting..." : "Disconnect"}</span>
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
        "rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs transition-all hover:border-slate-300",
        className,
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Left: Google / Gmail Icon & Info */}
        <div className="flex items-start gap-4">
          <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
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

          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Connect Gmail for Dispatch & Tracking
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
                <ShieldCheck className="size-3 text-blue-600" />
                Google Workspace Verified
              </span>
            </div>
            <p className="text-[13px] text-slate-600 max-w-2xl leading-relaxed">
              Dispatch RFQ bookings, send container shipping instructions, and track forwarder
              quotations directly through your official company Google account.
            </p>

            {/* Feature Pills */}
            <div className="pt-1 flex items-center gap-2 flex-wrap text-[11.5px] text-slate-500 font-medium">
              <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-0.5 rounded-md text-slate-700">
                <Zap className="size-3 text-amber-500" /> Instant RFQ Dispatch
              </span>
              <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-0.5 rounded-md text-slate-700">
                <Mail className="size-3 text-[#0FA3B1]" /> Real-time Quotation Sync
              </span>
              <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2.5 py-0.5 rounded-md text-slate-700">
                <ShieldCheck className="size-3 text-emerald-600" /> Secure OAuth 2.0
              </span>
            </div>
          </div>
        </div>

        {/* Right: Official Google Connect Button */}
        <div className="shrink-0 self-start lg:self-center">
          <button
            type="button"
            onClick={handleConnect}
            disabled={isConnecting}
            className="inline-flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 hover:border-slate-400 active:scale-[0.99] transition-all disabled:opacity-60 cursor-pointer"
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
