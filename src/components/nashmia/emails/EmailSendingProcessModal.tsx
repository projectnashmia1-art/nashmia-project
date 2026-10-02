import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, X, Mail, RefreshCw, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ForwarderSendingItem {
  id: string;
  name: string;
  email: string;
  contactName?: string;
  status: "Waiting" | "Sending" | "Sent" | "Failed";
  errorMessage?: string;
  gmailMessageId?: string;
  gmailThreadId?: string;
}

export interface EmailSendingProcessModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: ForwarderSendingItem[];
  movementReference?: string;
  // Function to execute sending for a single forwarder in uncontrolled queue mode
  onSendItem?: (item: ForwarderSendingItem) => Promise<{
    success: boolean;
    gmailMessageId?: string;
    gmailThreadId?: string;
    errorMessage?: string;
  }>;
  // Optional callback when all items have finished
  onFinished?: (results: {
    successful: ForwarderSendingItem[];
    failed: ForwarderSendingItem[];
  }) => void;
  // Optional custom retry handler when parent manages the workflow
  onRetryFailed?: () => void;
  isControlled?: boolean;
  isCompletedControlled?: boolean;
}

export function EmailSendingProcessModal({
  isOpen,
  onClose,
  items: initialItems,
  movementReference,
  onSendItem,
  onFinished,
  onRetryFailed: externalRetryFailed,
  isControlled = false,
  isCompletedControlled,
}: EmailSendingProcessModalProps) {
  const [itemList, setItemList] = useState<ForwarderSendingItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [activeSendingId, setActiveSendingId] = useState<string | null>(null);

  const isRunningRef = useRef(false);
  const onSendItemRef = useRef(onSendItem);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onSendItemRef.current = onSendItem;
    onFinishedRef.current = onFinished;
  });

  // Controlled mode sync
  useEffect(() => {
    if (isControlled) {
      setItemList(initialItems);
      if (isCompletedControlled !== undefined) {
        setIsCompleted(isCompletedControlled);
      } else {
        const allDone =
          initialItems.length > 0 &&
          initialItems.every((it) => it.status === "Sent" || it.status === "Failed");
        setIsCompleted(allDone);
      }
    }
  }, [isControlled, initialItems, isCompletedControlled]);

  // Reset and initialize when opened in uncontrolled mode
  useEffect(() => {
    if (isControlled) return;

    if (isOpen && initialItems.length > 0) {
      const initialized = initialItems.map((item) => ({
        ...item,
        status: item.status || ("Waiting" as const),
      }));
      setItemList(initialized);
      setIsProcessing(true);
      setIsCompleted(false);
      setActiveSendingId(null);
      isRunningRef.current = false;
    } else if (!isOpen) {
      setIsProcessing(false);
      setIsCompleted(false);
      setActiveSendingId(null);
      isRunningRef.current = false;
    }
  }, [isOpen, initialItems, isControlled]);

  // Run the sequential independent sending loop
  const runSendingQueue = useCallback(async (targetsToRun: ForwarderSendingItem[]) => {
    if (isRunningRef.current || targetsToRun.length === 0 || !onSendItemRef.current) return;
    isRunningRef.current = true;
    setIsProcessing(true);

    const currentList = [...targetsToRun];

    for (let i = 0; i < currentList.length; i++) {
      const currentItem = currentList[i];

      // Mark this item as Sending
      setActiveSendingId(currentItem.id);
      setItemList((prev) =>
        prev.map((it) => (it.id === currentItem.id ? { ...it, status: "Sending" } : it)),
      );

      try {
        const result = await onSendItemRef.current(currentItem);

        if (result.success) {
          setItemList((prev) =>
            prev.map((it) =>
              it.id === currentItem.id
                ? {
                    ...it,
                    status: "Sent",
                    gmailMessageId: result.gmailMessageId,
                    gmailThreadId: result.gmailThreadId,
                    errorMessage: undefined,
                  }
                : it,
            ),
          );
        } else {
          setItemList((prev) =>
            prev.map((it) =>
              it.id === currentItem.id
                ? {
                    ...it,
                    status: "Failed",
                    errorMessage: result.errorMessage || "Unable to send",
                  }
                : it,
            ),
          );
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unable to send";
        setItemList((prev) =>
          prev.map((it) =>
            it.id === currentItem.id
              ? {
                  ...it,
                  status: "Failed",
                  errorMessage: errorMsg,
                }
              : it,
          ),
        );
      }

      // Small 400ms pace between items to respect API rate limits and provide visible visual transitions
      if (i < currentList.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 400));
      }
    }

    setActiveSendingId(null);
    setIsProcessing(false);
    setIsCompleted(true);
    isRunningRef.current = false;

    // Trigger onFinished callback
    setItemList((finalList) => {
      const successful = finalList.filter((it) => it.status === "Sent");
      const failed = finalList.filter((it) => it.status === "Failed");
      if (onFinishedRef.current) {
        onFinishedRef.current({ successful, failed });
      }
      return finalList;
    });
  }, []);

  // Trigger sending queue when modal opens with items in Waiting status
  useEffect(() => {
    if (isControlled) return;

    if (
      isOpen &&
      isProcessing &&
      !isCompleted &&
      !isRunningRef.current &&
      itemList.length > 0 &&
      onSendItem
    ) {
      const waitingItems = itemList.filter((it) => it.status === "Waiting");
      if (waitingItems.length > 0) {
        runSendingQueue(waitingItems);
      }
    }
  }, [isOpen, isProcessing, isCompleted, itemList, runSendingQueue, isControlled, onSendItem]);

  // Retry only the failed forwarders
  const handleRetryFailed = () => {
    if (externalRetryFailed) {
      externalRetryFailed();
      return;
    }

    const failedItems = itemList.filter((it) => it.status === "Failed");
    if (failedItems.length === 0) return;

    // Reset failed items to Waiting
    setItemList((prev) =>
      prev.map((it) =>
        it.status === "Failed" ? { ...it, status: "Waiting", errorMessage: undefined } : it,
      ),
    );
    setIsCompleted(false);
    setIsProcessing(true);

    const reloaded = failedItems.map((it) => ({
      ...it,
      status: "Waiting" as const,
      errorMessage: undefined,
    }));
    runSendingQueue(reloaded);
  };

  const sentCount = useMemo(() => itemList.filter((it) => it.status === "Sent").length, [itemList]);
  const failedCount = useMemo(
    () => itemList.filter((it) => it.status === "Failed").length,
    [itemList],
  );
  const totalCount = itemList.length;
  const isAllSent = sentCount === totalCount && totalCount > 0;
  const hasPartialFailures = failedCount > 0;

  // Lock body scroll while modal is visible
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      id="email-sending-process-overlay"
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 ease-out"
    >
      <div
        id="email-sending-process-card"
        className={cn(
          "relative w-full max-w-[440px] bg-white shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border border-slate-100/90 flex flex-col transition-all will-change-[transform,opacity] outline-none",
          // Mobile: Bottom sheet sliding up
          "max-h-[90vh] rounded-t-[28px] rounded-b-none p-5 pb-8 overflow-y-auto overflow-x-hidden animate-in slide-in-from-bottom duration-240 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Desktop & Tablet: Centered modal
          "sm:slide-in-from-bottom-0 sm:zoom-in-[0.96] sm:fade-in-0 sm:duration-200 sm:ease-[cubic-bezier(0.16,1,0.3,1)] sm:rounded-[28px] sm:p-7",
        )}
      >
        {/* Mobile Drag Handle */}
        <div
          className="mx-auto -mt-1 mb-3.5 h-1.5 w-12 shrink-0 rounded-full bg-slate-300 sm:hidden"
          aria-hidden="true"
        />
        {!isCompleted ? (
          /* ========================================================================= */
          /* STEP 1 & 2: PROCESSING POPUP (TIMELINE STYLE MATCHING REFERENCE 1)        */
          /* ========================================================================= */
          <div className="flex flex-col">
            {/* Header Icon + Titles */}
            <div className="flex flex-col items-center text-center">
              <div className="size-12 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center mb-3 shadow-2xs">
                <Mail className="size-5 stroke-[2.2]" />
              </div>
              <h3 className="text-[20px] font-bold tracking-tight text-slate-900">
                Sending Emails
              </h3>
              <p className="text-[13.5px] text-slate-500 mt-1 leading-relaxed max-w-xs">
                Please wait while we send your booking request.
              </p>
            </div>

            {/* List Header */}
            <div className="mt-6 mb-3 flex items-center justify-between">
              <span className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">
                Sending to Forwarders
              </span>
              <span className="text-[11.5px] font-medium text-slate-400">
                {sentCount} of {totalCount} sent
              </span>
            </div>

            {/* Vertical Forwarder Timeline List */}
            <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-0.5">
              {itemList.map((item, index) => {
                const isWaiting = item.status === "Waiting";
                const isSending = item.status === "Sending";
                const isSent = item.status === "Sent";
                const isFailed = item.status === "Failed";
                const isLast = index === itemList.length - 1;

                return (
                  <div key={item.id} className="relative flex items-start gap-3.5">
                    {/* Vertical Connecting Line */}
                    {!isLast && (
                      <div
                        className={cn(
                          "absolute left-[9px] top-[22px] w-[2px] h-[calc(100%+4px)] transition-colors duration-300",
                          isSent ? "bg-[#2563EB]/30" : "bg-slate-200/80",
                        )}
                      />
                    )}

                    {/* Status Circle Indicator */}
                    <div className="relative z-10 shrink-0 mt-0.5">
                      {isWaiting && (
                        <div
                          className="size-5 rounded-full border-2 border-slate-300 bg-white"
                          title="Waiting"
                        />
                      )}
                      {isSending && (
                        <div
                          className="size-5 rounded-full border-2 border-slate-200 border-t-[#2563EB] animate-spin"
                          title="Sending"
                        />
                      )}
                      {isSent && (
                        <div
                          className="size-5 rounded-full bg-[#2563EB] text-white flex items-center justify-center shadow-2xs animate-in zoom-in-50 duration-200"
                          title="Sent"
                        >
                          <Check className="size-3 stroke-[3]" />
                        </div>
                      )}
                      {isFailed && (
                        <div
                          className="size-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-2xs animate-in zoom-in-50 duration-200"
                          title="Failed"
                        >
                          <X className="size-3 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    {/* Forwarder Details */}
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-semibold text-slate-900 truncate">
                          {item.name}
                        </span>
                        {/* Status Label */}
                        <div className="text-[12px] shrink-0 font-medium">
                          {isWaiting && <span className="text-slate-400">Waiting...</span>}
                          {isSending && (
                            <span className="text-[#2563EB] animate-pulse">Sending...</span>
                          )}
                          {isSent && <span className="text-emerald-600 font-semibold">✓ Sent</span>}
                          {isFailed && (
                            <span className="text-rose-600 font-semibold">✕ Failed</span>
                          )}
                        </div>
                      </div>

                      <div className="text-[11.5px] text-slate-400 font-mono truncate mt-0.5">
                        {item.email}
                      </div>

                      {/* Failure message if failed */}
                      {isFailed && item.errorMessage && (
                        <div className="mt-1 text-[11.5px] text-rose-600 font-medium bg-rose-50/80 border border-rose-100 rounded-lg px-2 py-1 leading-snug">
                          Unable to send: {item.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Live Progress Bar */}
            <div className="mt-5 pt-3 border-t border-slate-100/80">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2563EB] rounded-full transition-all duration-300"
                  style={{
                    width: `${totalCount > 0 ? (sentCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="mt-2 text-center text-[11.5px] text-slate-400">
                Pacing delivery for verified Gmail transmission...
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* STEP 3 & 4: COMPLETION POPUP (MATCHING REFERENCE 2 ROCKET/CARD STYLE)      */
          /* ========================================================================= */
          <div className="flex flex-col animate-in fade-in zoom-in-[0.98] duration-200">
            {/* Top Illustration Area inspired by Reference Image 2 */}
            <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-gradient-to-b from-[#2563EB] via-[#3B82F6] to-[#60A5FA] flex items-center justify-center shadow-inner mb-4 select-none">
              <svg
                viewBox="0 0 320 160"
                className="w-full h-full pointer-events-none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Twinkling soft stars */}
                <circle cx="45" cy="30" r="1.5" fill="#ffffff" opacity="0.8" />
                <circle cx="85" cy="45" r="1.2" fill="#ffffff" opacity="0.6" />
                <circle cx="230" cy="25" r="1.8" fill="#ffffff" opacity="0.8" />
                <circle cx="275" cy="42" r="1.2" fill="#ffffff" opacity="0.7" />
                <circle cx="115" cy="20" r="1.0" fill="#ffffff" opacity="0.5" />
                <circle cx="205" cy="50" r="1.3" fill="#ffffff" opacity="0.6" />

                {/* Layered soft white clouds at bottom */}
                <path
                  d="M-20 160 C 20 115, 75 125, 110 145 C 135 130, 175 128, 200 148 C 225 125, 275 120, 305 142 C 325 132, 345 145, 360 160 Z"
                  fill="#ffffff"
                  opacity="0.35"
                />
                <path
                  d="M-10 160 C 30 122, 90 132, 120 152 C 145 136, 185 132, 212 152 C 242 128, 290 122, 335 160 Z"
                  fill="#ffffff"
                  opacity="0.75"
                />
                <path
                  d="M0 160 C 40 132, 100 142, 130 160 C 160 142, 200 140, 228 160 C 258 137, 310 132, 340 160 Z"
                  fill="#ffffff"
                />

                {/* Rocket Propulsion Vapor Beam */}
                <path
                  d="M 156 68 L 156 160 L 164 160 L 164 68 Z"
                  fill="url(#trailGradientLight)"
                  opacity="0.85"
                />

                {/* Rocket / Mail Shuttle Silhouette */}
                <g transform="translate(142, 28)">
                  {/* Left Thruster Fin */}
                  <path d="M 4 40 C 4 30, 10 32, 10 24 L 10 42 Z" fill="#E2E8F0" />
                  {/* Right Thruster Fin */}
                  <path d="M 32 40 C 32 30, 26 32, 26 24 L 26 42 Z" fill="#E2E8F0" />
                  {/* Main Capsule Body */}
                  <path
                    d="M 18 0 C 10 8, 8 26, 8 44 L 28 44 C 28 26, 26 8, 18 0 Z"
                    fill="#FFFFFF"
                  />
                  {/* Cockpit Window */}
                  <circle cx="18" cy="19" r="4.5" fill="#2563EB" />
                  <circle cx="17" cy="18" r="1.5" fill="#93C5FD" />
                </g>

                <defs>
                  <linearGradient id="trailGradientLight" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
                    <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Title & Subtitle */}
            <div className="text-center">
              <h3 className="text-[21px] font-bold tracking-tight text-slate-900 leading-snug">
                {isAllSent ? "Emails Sent Successfully!" : "Email Sending Completed"}
              </h3>
              <p className="text-[13px] text-slate-500 mt-1 leading-relaxed max-w-sm mx-auto">
                {isAllSent
                  ? "Your booking request has been successfully sent to all selected forwarders."
                  : "Some booking emails were delivered, while others encountered delivery issues."}
              </p>
            </div>

            {/* Compact Summary Pills */}
            <div className="mt-3.5 flex items-center justify-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                <Check className="size-3.5 stroke-[2.5]" />
                {sentCount} Email{sentCount !== 1 ? "s" : ""} Sent
              </span>

              {hasPartialFailures ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                  <X className="size-3.5 stroke-[2.5]" />
                  {failedCount} Email{failedCount !== 1 ? "s" : ""} Failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                  <Check className="size-3.5 stroke-[2.5]" />
                  {sentCount} Forwarder{sentCount !== 1 ? "s" : ""} Notified
                </span>
              )}
            </div>

            {/* Forwarder List Summary */}
            <div className="mt-3.5 rounded-xl bg-slate-50/90 border border-slate-200/70 p-3 space-y-2 max-h-[160px] overflow-y-auto">
              {itemList.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-[13px] py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.status === "Sent" ? (
                      <span className="text-emerald-600 font-bold shrink-0">✓</span>
                    ) : (
                      <span className="text-rose-500 font-bold shrink-0">✕</span>
                    )}
                    <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                  </div>
                  <span
                    className={cn(
                      "text-[12px] font-medium shrink-0 ml-2",
                      item.status === "Sent" ? "text-slate-500" : "text-rose-600 font-semibold",
                    )}
                  >
                    {item.status === "Sent" ? "Sent" : "Failed"}
                  </span>
                </div>
              ))}
            </div>

            {/* Related Movement / Booking Reference */}
            {movementReference && (
              <div className="mt-3 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[12px] font-mono font-medium text-slate-600 bg-slate-100 border border-slate-200/80">
                  Movement: <span className="font-bold text-slate-900">{movementReference}</span>
                </span>
              </div>
            )}

            {/* Action Buttons */}
            {hasPartialFailures ? (
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="h-11 rounded-[14px] border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-800 text-[13.5px] font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <RefreshCw className="size-3.5" />
                  Retry Failed
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="h-11 rounded-[14px] bg-slate-900 hover:bg-black text-white text-[13.5px] font-semibold transition-all shadow-sm active:scale-[0.99] flex items-center justify-center"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="mt-5 w-full h-11 rounded-[14px] bg-slate-900 hover:bg-black text-white text-[14px] font-semibold transition-all shadow-sm active:scale-[0.99] flex items-center justify-center"
              >
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
