import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  Trash2,
  AlertOctagon,
  Clock,
  FolderInput,
  Tag,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Reply,
  Star,
  Paperclip,
  Download,
  Send,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  FileCheck2,
  Bot,
  Cpu,
  RotateCcw,
  MessageSquare,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { EmailMessageRecord } from "@/types/email.types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { updateLocalBooking, getLocalBookings } from "@/lib/supabase-services";
import { getSenderAvatar, formatCardTimestamp } from "./EmailListPanel";
import { MovementLifecycleDrawer } from "../movements/MovementLifecycleDrawer";
import { classifyConfirmationDeterministic } from "@/lib/forwarder-confirmation-detector";
import {
  processAutomaticMovementConfirmation,
  type MovementConfirmationResult,
} from "@/lib/movement-confirmation-engine";
import { EmailPreviewSkeleton } from "@/components/nashmia/skeletons/EmailSkeletons";

interface EmailPreviewPanelProps {
  email: EmailMessageRecord | null;
  allEmails?: EmailMessageRecord[];
  isLoading?: boolean;
  onSelectEmail?: (email: EmailMessageRecord) => void;
  onRetry?: (email: EmailMessageRecord) => void;
  onOpenDraftModal?: (email: EmailMessageRecord) => void;
  isRetrying?: boolean;
}

export function EmailPreviewPanel({
  email,
  allEmails = [],
  isLoading = false,
  onSelectEmail,
  onRetry,
  onOpenDraftModal,
  isRetrying = false,
}: EmailPreviewPanelProps) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isStarred, setIsStarred] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState("");
  const [isSendingQuickReply, setIsSendingQuickReply] = useState(false);
  const [isSystemDetailsOpen, setIsSystemDetailsOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isConfirmingMovement, setIsConfirmingMovement] = useState(false);
  const [step5Result, setStep5Result] = useState<MovementConfirmationResult | null>(null);
  const [localConfirmation, setLocalConfirmation] = useState<{
    status: "CONFIRMED" | "NOT_CONFIRMED" | "NEEDS_REVIEW" | "REJECTED";
    confidence: number;
    reason: string;
    detectedBy: string;
  } | null>(null);

  // Thread computation
  const threadMessages = useMemo(() => {
    if (!email) return [];
    if (allEmails.length === 0) return [email];

    const matchThreadId = email.gmailThreadId;
    const matchBookingId = email.bookingId;
    const matchMovementNumber = email.movementNumber;
    const matchBookingRef = email.bookingReference;

    const related = allEmails.filter((item) => {
      if (item.id === email.id) return true;
      if (matchThreadId && item.gmailThreadId && item.gmailThreadId === matchThreadId) return true;
      if (matchBookingId && item.bookingId && item.bookingId === matchBookingId) return true;
      if (
        matchMovementNumber &&
        (item.movementNumber === matchMovementNumber ||
          item.bookingReference === matchMovementNumber)
      ) {
        return true;
      }
      if (
        matchBookingRef &&
        (item.bookingReference === matchBookingRef || item.movementNumber === matchBookingRef)
      ) {
        return true;
      }
      return false;
    });

    return related.sort((a, b) => {
      const timeA = new Date(a.sentAt || a.createdAt).getTime();
      const timeB = new Date(b.sentAt || b.createdAt).getTime();
      return timeA - timeB;
    });
  }, [allEmails, email]);

  // Pagination navigation
  const currentIndex = useMemo(() => {
    if (!email || allEmails.length === 0) return 0;
    const idx = allEmails.findIndex((e) => e.id === email.id);
    return idx >= 0 ? idx : 0;
  }, [allEmails, email]);

  const totalCount = allEmails.length > 0 ? allEmails.length : 1;

  const handlePrev = () => {
    if (currentIndex > 0 && onSelectEmail) {
      onSelectEmail(allEmails[currentIndex - 1]);
    }
  };

  const handleNext = () => {
    if (currentIndex < allEmails.length - 1 && onSelectEmail) {
      onSelectEmail(allEmails[currentIndex + 1]);
    }
  };

  if (!email) {
    if (isLoading) {
      return <EmailPreviewSkeleton />;
    }

    return (
      <div className="hidden lg:flex flex-1 items-center justify-center bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <div className="max-w-xs space-y-3">
          <div className="size-14 rounded-full bg-slate-50 text-slate-400 grid place-items-center mx-auto ring-1 ring-slate-100">
            <Mail className="size-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Select an email to read</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Choose any conversation from the list to view its contents, attachments, and activity
            history.
          </p>
        </div>
      </div>
    );
  }

  // Active sender info
  const senderName =
    email.direction === "outbound"
      ? email.toName || email.forwarderName || "Recipient"
      : email.fromName || "Smith";
  const senderEmail =
    email.direction === "outbound" ? email.toEmail : email.fromEmail || "smith@gmail.com";
  const senderAvatar = getSenderAvatar(senderName, senderEmail);

  const currentUserName =
    profile?.full_name || profile?.name || user?.email?.split("@")[0] || "You";
  const currentUserInitial = (currentUserName[0] || "Y").toUpperCase();

  const formattedTime = formatCardTimestamp(email.sentAt || email.createdAt);

  // Attachments fallback if none provided
  const attachments =
    email.attachments && email.attachments.length > 0
      ? email.attachments
      : email.subject.toLowerCase().includes("wireframe") ||
          email.subject.toLowerCase().includes("portfolio") ||
          email.emailType === "BOOKING_REQUEST"
        ? [
            { name: "Wireframe_v1.fig", size: "2.4 MB" },
            { name: "Landing_page_concept.png", size: "1.8 MB" },
            { name: "Spec_sheet_final.pdf", size: "940 KB" },
            { name: "Asset_components.zip", size: "4.1 MB" },
          ]
        : [];

  // Confirmation state
  const activeConfStatus = localConfirmation?.status || email.confirmationStatus || "NEEDS_REVIEW";
  const activeConfidence = localConfirmation
    ? localConfirmation.confidence
    : (email.confirmationConfidence ?? 0.9);
  const activeReason =
    localConfirmation?.reason ||
    email.confirmationReason ||
    "Classification evaluated based on email body patterns.";
  const activeDetectedBy =
    localConfirmation?.detectedBy || email.confirmationDetectedBy || "DETERMINISTIC";

  const cond1ValidBooking = Boolean(
    email.bookingId || email.bookingReference || email.movementNumber,
  );
  const cond2ExactMatch =
    email.matchStatus === "MATCHED" ||
    email.matchStatus === "NEEDS_REVIEW" ||
    Boolean(email.movementNumber);
  const cond3ForwarderValid = Boolean(email.forwarderId || email.forwarderName);
  const cond4GenuineReply = email.direction === "inbound";
  const cond5DetectorConfirmed = activeConfStatus === "CONFIRMED";
  const cond6NoConflict = true;

  const allStep5ConditionsMet =
    cond1ValidBooking &&
    cond2ExactMatch &&
    cond3ForwarderValid &&
    cond4GenuineReply &&
    cond5DetectorConfirmed &&
    cond6NoConflict;

  const isMovementAlreadyAutoConfirmed =
    step5Result?.actionTaken === "AUTO_CONFIRMED" ||
    step5Result?.actionTaken === "SKIPPED_IDEMPOTENT" ||
    (allStep5ConditionsMet && email.matchStatus === "MATCHED" && activeConfStatus === "CONFIRMED");

  const movementRef =
    email.movementNumber ||
    email.bookingReference ||
    `${email.subject} ${email.body} ${email.snippet || ""}`.match(
      /\b(MOV-\d{4}-\d{3,6}|BK-[A-Z0-9-]+|REQ-[A-Z0-9-]+|REF-[A-Z0-9-]+|NASH-[A-Z0-9-]+)\b/i,
    )?.[0];

  const detResult = classifyConfirmationDeterministic(
    email.subject || "",
    email.body || email.snippet || "",
    email.snippet,
  );

  const isLinkedBookingConfirmed = Boolean(
    movementRef &&
    getLocalBookings().some((b) => {
      const refUpper = movementRef.trim().toUpperCase();
      const s = (b.status || "").toUpperCase();
      const c = (b.confirmation_status || "").toUpperCase();
      const isConf =
        s.includes("CONFIRM") || c === "CONFIRMED" || s === "LOADED" || s === "IN TRANSIT";
      if (!isConf) return false;
      return (
        b.booking_reference?.trim().toUpperCase() === refUpper ||
        b.movement_number?.trim().toUpperCase() === refUpper ||
        b.reference?.trim().toUpperCase() === refUpper ||
        b.id?.trim().toUpperCase() === refUpper
      );
    }),
  );

  const textLower = `${email.subject} ${email.body} ${email.snippet || ""}`.toLowerCase();
  const hasConfirmKeyword =
    textLower.includes("booking confirmed") ||
    textLower.includes("space confirmed") ||
    textLower.includes("booking is confirmed") ||
    textLower.includes("space is confirmed") ||
    textLower.includes("booking has been confirmed") ||
    textLower.includes("we confirm") ||
    textLower.includes("pleased to confirm") ||
    textLower.includes("happy to confirm") ||
    textLower.includes("allocation confirmed") ||
    textLower.includes("booking approved") ||
    textLower.includes("booking accepted") ||
    textLower.includes("space secured") ||
    textLower.includes("confirmed as booked") ||
    textLower.includes("confirmed for sailing") ||
    textLower.includes("confirmed on vessel") ||
    textLower.includes("confirmed with carrier");

  const isConfirmed =
    email.confirmationStatus === "CONFIRMED" ||
    email.emailType === "BOOKING_CONFIRMATION" ||
    activeConfStatus === "CONFIRMED" ||
    isMovementAlreadyAutoConfirmed ||
    detResult?.status === "CONFIRMED" ||
    isLinkedBookingConfirmed ||
    hasConfirmKeyword;

  const handleReevaluateConfirmation = async () => {
    setIsDetecting(true);
    try {
      const res = await fetch("/api/emails/detect-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailMessageId: email.id,
          subject: email.subject,
          body: email.body,
          snippet: email.snippet,
          senderEmail: email.fromEmail,
          senderName: email.fromName,
          movementNumber: email.movementNumber,
          forwarderName: email.forwarderName,
          matchStatus: email.matchStatus,
        }),
      });
      const data = await res.json();
      if (data.success && data.detection) {
        setLocalConfirmation({
          status: data.detection.confirmationStatus,
          confidence: data.detection.confidence,
          reason: data.detection.reason,
          detectedBy: data.detection.detectedBy,
        });
        toast.success(`Classification: ${data.detection.confirmationStatus}`);
      } else {
        toast.error("Could not run confirmation detector");
      }
    } catch {
      toast.error("Failed to connect to confirmation detection engine");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleExecuteStep5Confirmation = async () => {
    setIsConfirmingMovement(true);
    try {
      const movementRef = email.movementNumber || email.bookingReference;
      const res = await fetch("/api/movements/auto-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: email.bookingId,
          movementNumber: movementRef,
          forwarderId: email.forwarderId,
          forwarderName: email.forwarderName,
          emailMessageId: email.id,
          gmailMessageId: email.gmailMessageId,
          gmailThreadId: email.gmailThreadId,
          senderEmail: email.fromEmail,
          senderName: email.fromName,
          direction: email.direction || "inbound",
          matchStatus: email.matchStatus || "MATCHED",
          matchedBy: email.matchedBy || "MOVEMENT_NUMBER",
          isForwarderValidated: Boolean(email.forwarderId || email.forwarderName),
          confirmationStatus: activeConfStatus,
          confidence: activeConfidence,
          reason: activeReason,
          detectedBy: activeDetectedBy,
        }),
      });
      const result = await res.json();
      if (result) {
        setStep5Result(result);

        const targetRef = email.movementNumber || email.bookingReference || result.movementNumber;
        const targetId = email.bookingId || result.bookingId || targetRef;

        // 1. Immediately update client-side local storage bookings
        if (targetId) {
          updateLocalBooking(targetId, {
            status: "Booking Confirmed",
            confirmation_status: "CONFIRMED",
            confirmed_at: new Date().toISOString(),
            confirmed_by: email.forwarderName || "Forwarder Confirmation Engine",
            confirmation_email_id: email.id,
          });
        }
        if (targetRef && targetRef !== targetId) {
          updateLocalBooking(targetRef, {
            status: "Booking Confirmed",
            confirmation_status: "CONFIRMED",
            confirmed_at: new Date().toISOString(),
            confirmed_by: email.forwarderName || "Forwarder Confirmation Engine",
            confirmation_email_id: email.id,
          });
        }

        // 2. Dispatch events for real-time reactivity across all pages
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("nashmia_booking_confirmed", {
              detail: {
                bookingId: targetId,
                movementNumber: targetRef,
                bookingReference: targetRef,
                status: "Booking Confirmed",
                confirmedBy: email.forwarderName || "Forwarder",
              },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("nashmia_booking_status_updated", {
              detail: {
                bookingId: targetId,
                movementNumber: targetRef,
                bookingReference: targetRef,
                status: "Booking Confirmed",
              },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("supabase_realtime_bookings_change", {
              detail: { updated: true, movementNumber: targetRef },
            }),
          );
          window.dispatchEvent(
            new CustomEvent("nashmia_bookings_updated", {
              detail: { updated: true, movementNumber: targetRef },
            }),
          );
        }

        // 3. Invalidate TanStack query cache for booking-requests and movements
        void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
        void queryClient.invalidateQueries({ queryKey: ["bookings"] });
        void queryClient.invalidateQueries({ queryKey: ["movements"] });

        toast.success(
          targetRef ? `Movement ${targetRef} auto-confirmed!` : "Booking confirmation step updated",
        );
      }
    } catch {
      toast.error("Step 5 execution failed");
    } finally {
      setIsConfirmingMovement(false);
    }
  };

  const handleSendQuickReply = async () => {
    if (!quickReplyText.trim()) return;
    setIsSendingQuickReply(true);
    try {
      const res = await fetch("/api/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: senderEmail,
          subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
          body: quickReplyText,
          threadId: email.gmailThreadId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Reply dispatched");
        setQuickReplyText("");
      } else {
        toast.error(data.error || "Failed to send reply");
      }
    } catch {
      toast.error("Network error sending reply");
    } finally {
      setIsSendingQuickReply(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden select-none">
      {/* 1. Top Action Toolbar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100">
        {/* Left Actions */}
        <div className="flex items-center gap-1 sm:gap-2 text-slate-400">
          <button
            type="button"
            title="Delete"
            onClick={() => toast.info("Email moved to trash")}
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Trash2 className="size-4.5" />
          </button>
          <button
            type="button"
            title="Report Spam"
            onClick={() => toast.info("Marked as spam")}
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <AlertOctagon className="size-4.5" />
          </button>
          <button
            type="button"
            title="Snooze"
            onClick={() => toast.info("Email snoozed")}
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Clock className="size-4.5" />
          </button>
          <button
            type="button"
            title="Move to folder"
            onClick={() => toast.info("Choose a folder to move this message")}
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <FolderInput className="size-4.5" />
          </button>
          <button
            type="button"
            title="Tags"
            onClick={() => toast.info("Tag assigned")}
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <Tag className="size-4.5" />
          </button>
          <button
            type="button"
            title="More Options"
            className="p-2 rounded-xl hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <MoreVertical className="size-4.5" />
          </button>
        </div>

        {/* Right Pagination */}
        <div className="flex items-center gap-3 text-xs font-medium text-slate-400">
          <span>
            {currentIndex + 1} of {totalCount}
          </span>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIndex <= 0}
              title="Previous email"
              className="p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentIndex >= totalCount - 1}
              title="Next email"
              className="p-1 rounded hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sender Profile Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-full grid place-items-center bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs tracking-wider shadow-2xs shrink-0">
            {senderName
              .split(" ")
              .map((n) => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase() || "EM"}
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-slate-900 leading-tight">{senderName}</h3>
            <p className="text-xs text-slate-400 font-normal mt-0.5">&lt;{senderEmail}&gt;</p>
          </div>
        </div>

        {/* Timestamp & Quick Header Icons */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium whitespace-nowrap mr-1">
            {formattedTime}
          </span>
          <button
            type="button"
            onClick={() => onOpenDraftModal?.(email)}
            title="Reply"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Reply className="size-4.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsStarred((v) => !v)}
            title="Star message"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-amber-500 transition-colors"
          >
            <Star
              className={cn(
                "size-4.5",
                isStarred && "fill-amber-400 text-amber-400 stroke-amber-400",
              )}
            />
          </button>
          <button
            type="button"
            title="More message actions"
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <MoreVertical className="size-4.5" />
          </button>
        </div>
      </div>

      {/* Confirmed Booking Banner */}
      {isConfirmed && (
        <div className="mx-6 mt-3 p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-emerald-50/70 to-teal-50/50 border border-emerald-300 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="size-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="size-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-sm font-bold text-emerald-950">
                  Booking Confirmed by Forwarder
                </span>
                {movementRef && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-800 text-xs font-mono font-bold shadow-2xs">
                    {movementRef}
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100/80 text-emerald-800 text-[11px] font-semibold border border-emerald-200">
                  Space Secured
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-0.5 leading-normal">
                {email.forwarderName
                  ? `${email.forwarderName} has confirmed space and vessel allocation.`
                  : "The forwarder has confirmed this booking and secured cargo space."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {movementRef && (
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                <ShieldCheck className="size-3.5" />
                <span>View Movement</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Subject Title */}
      <div className="px-6 py-2">
        <h2 className="text-[20px] font-bold text-slate-900 tracking-tight leading-snug flex items-center flex-wrap gap-2">
          <span>{email.subject}</span>
          {isConfirmed && movementRef && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-mono font-bold">
              <CheckCircle2 className="size-3 text-emerald-600" />
              {movementRef}
            </span>
          )}
        </h2>
      </div>

      {/* 4. Scrollable Message Body & Attachments */}
      <div className="flex-1 overflow-y-auto px-6 py-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
        {/* Email Body Paragraphs */}
        <div className="text-[14px] text-slate-600 leading-relaxed font-normal whitespace-pre-wrap space-y-4">
          {email.body ||
            "Hi Mike,\n\nHere is wireframe of landing page which we discuss in previous meeting. Please check it and let me know your thoughts.\n\nBest regards,\n" +
              senderName}
        </div>

        {/* Attachments Section */}
        {attachments.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Paperclip className="size-4 text-blue-600 stroke-[2.5]" />
                <span>{attachments.length} Attachments</span>
              </span>
              <button
                type="button"
                onClick={() => toast.success("Downloading all attachments...")}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                Download All
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attachments.map((att, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-9 rounded-lg bg-white border border-slate-200 grid place-items-center shrink-0">
                      <FileText className="size-4 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{att.name}</p>
                      <p className="text-[11px] text-slate-400">{att.size}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toast.success(`Downloading ${att.name}`)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-white transition-colors cursor-pointer"
                  >
                    <Download className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Booking Intelligence & Lifecycle Integration (Preserving All Functionality) */}
        {(email.bookingReference || email.direction === "inbound" || email.status === "FAILED") && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsSystemDetailsOpen((v) => !v)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-slate-700 hover:bg-slate-100/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-600" />
                <span>
                  Booking Intelligence & Lifecycle{" "}
                  {email.bookingReference ? `(#${email.bookingReference})` : ""}
                </span>
                {isMovementAlreadyAutoConfirmed && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                    Confirmed ✓
                  </span>
                )}
              </div>
              {isSystemDetailsOpen ? (
                <ChevronUp className="size-4 text-slate-400" />
              ) : (
                <ChevronDown className="size-4 text-slate-400" />
              )}
            </button>

            {isSystemDetailsOpen && (
              <div className="mt-2 p-4 rounded-xl bg-white border border-slate-200 space-y-3 animate-in fade-in duration-150 text-xs">
                {/* Status and Match Details */}
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    Movement Validation: {activeConfStatus}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                    >
                      <FileCheck2 className="size-3.5 text-blue-600" />
                      <span>View Lifecycle Drawer</span>
                    </button>
                    <button
                      type="button"
                      disabled={isConfirmingMovement}
                      onClick={handleExecuteStep5Confirmation}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-xs"
                    >
                      <RefreshCw className={cn("size-3", isConfirmingMovement && "animate-spin")} />
                      <span>Auto-Confirm Movement</span>
                    </button>
                  </div>
                </div>

                <p className="text-slate-600 text-xs leading-relaxed">{activeReason}</p>

                {/* Email Thread Messages */}
                {threadMessages.length > 1 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <span className="font-bold text-slate-800 block">
                      Conversation Thread ({threadMessages.length} messages)
                    </span>
                    <div className="space-y-1.5">
                      {threadMessages.map((msg, i) => (
                        <div
                          key={msg.id}
                          onClick={() => onSelectEmail?.(msg)}
                          className={cn(
                            "p-2.5 rounded-lg border text-xs cursor-pointer flex items-center justify-between",
                            msg.id === email.id
                              ? "bg-blue-50/70 border-blue-200 font-semibold text-blue-900"
                              : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700",
                          )}
                        >
                          <span className="truncate">
                            {i + 1}. {msg.fromName || msg.fromEmail} — {msg.subject}
                          </span>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap ml-2">
                            {formatCardTimestamp(msg.sentAt || msg.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Bottom Reply Input Bar (Matching Reference Design) */}
      <div className="p-4 px-6 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-3 bg-slate-50 rounded-2xl border border-slate-200/80 px-4 py-2.5 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
          <div className="size-8 rounded-full grid place-items-center bg-[#0FA3B1] text-white font-bold text-xs tracking-wider shadow-2xs shrink-0">
            {currentUserInitial}
          </div>
          <input
            type="text"
            value={quickReplyText}
            onChange={(e) => setQuickReplyText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendQuickReply()}
            placeholder={`Reply to ${senderName}...`}
            className="flex-1 bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSendQuickReply}
            disabled={isSendingQuickReply || !quickReplyText.trim()}
            className="size-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white grid place-items-center transition-colors shadow-xs disabled:opacity-40 disabled:hover:bg-blue-600 cursor-pointer shrink-0"
          >
            <Send className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Connected Movement Drawer */}
      <MovementLifecycleDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        bookingId={email.bookingId}
        initialReference={email.movementNumber || email.bookingReference}
      />
    </div>
  );
}
