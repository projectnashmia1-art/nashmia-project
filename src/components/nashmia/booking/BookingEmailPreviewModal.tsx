import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Mail,
  Minus,
  Maximize2,
  Minimize2,
  ChevronDown,
  UserPlus,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Calendar,
  SendHorizontal,
  Lightbulb,
  CheckCircle2,
  ArrowRight,
  Copy,
  Check,
  Loader2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link2,
  MoreVertical,
  ShieldAlert,
} from "lucide-react";
import type {
  BuyerAccount,
  SupplierVendor,
  Port,
  ShippingLine,
  BookingAgent,
  RateCard,
  ContainerSize,
} from "@/lib/booking-data";
import { useAuth } from "@/lib/auth-context";
import { useGmail } from "@/lib/use-gmail";
import { submitBookingRequestWorkflow, BookingSubmissionResult } from "@/lib/supabase-services";
import { useQueryClient } from "@tanstack/react-query";
import { EMAILS_QUERY_KEY } from "@/lib/use-emails";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BookingEmailPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: string;
  buyer: BuyerAccount | null;
  supplier: SupplierVendor | null;
  pol: Port | null;
  pod: Port | null;
  shippingLine: ShippingLine | null;
  bookingAgent: BookingAgent | null;
  selectedBookingAgents?: BookingAgent[];
  containerSize: ContainerSize;
  quantity: number;
  loadingDate: string;
  productDescription: string;
  instructions: string;
  matchedRate: RateCard | null;
  onSuccess: (result: BookingSubmissionResult) => void;
  onSaveDraft: () => void;
  onViewMovement?: () => void;
}

export function BookingEmailPreviewModal({
  isOpen,
  onClose,
  reference,
  buyer,
  supplier,
  pol,
  pod,
  shippingLine,
  bookingAgent,
  selectedBookingAgents,
  containerSize,
  quantity,
  loadingDate,
  productDescription,
  instructions,
  matchedRate,
  onSuccess,
  onSaveDraft,
  onViewMovement,
}: BookingEmailPreviewModalProps) {
  const { user, userId, profile } = useAuth();
  const { googleEmail, displayName: gmailName, avatarUrl: gmailAvatar } = useGmail();
  const queryClient = useQueryClient();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Dynamic sender email from connected Gmail account or authenticated user/session
  const fromEmail = useMemo(() => {
    return googleEmail || user?.email || profile?.email || "projectnashmia1@gmail.com";
  }, [googleEmail, user?.email, profile?.email]);

  const senderDisplayName = useMemo(() => {
    return gmailName || profile?.name || user?.name || "Nashmia Industries";
  }, [gmailName, profile?.name, user?.name]);

  const senderInitials = useMemo(() => {
    const parts = (senderDisplayName || "NI").trim().split(/\s+/);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return (senderDisplayName?.[0] || fromEmail?.[0] || "N").toUpperCase();
  }, [senderDisplayName, fromEmail]);

  // Forwarder contact & email resolution from selected agent(s) / Supabase
  const forwardersList: BookingAgent[] = useMemo(() => {
    if (selectedBookingAgents && selectedBookingAgents.length > 0) {
      return selectedBookingAgents;
    }
    return bookingAgent ? [bookingAgent] : [];
  }, [selectedBookingAgents, bookingAgent]);

  // Combined recipient emails string: comma separated
  const forwardersEmailsString = useMemo(() => {
    const emails = forwardersList
      .map((f) => f.email?.trim())
      .filter((e): e is string => Boolean(e && e.includes("@")));
    return emails.join(", ");
  }, [forwardersList]);

  const forwarderContact = useMemo(() => {
    if (forwardersList.length === 0) return "Booking Team";
    if (forwardersList.length === 1) {
      return (
        forwardersList[0].contactPerson ||
        forwardersList[0].contact ||
        `${forwardersList[0].name} Booking Team`
      );
    }
    return forwardersList.map((f) => f.name).join(" & ") + " Booking Teams";
  }, [forwardersList]);

  const hasForwarderEmail = Boolean(forwardersEmailsString && forwardersEmailsString.includes("@"));

  // Computed Load Point dynamically tied to supplier
  const loadPoint = useMemo(() => {
    if (supplier?.loadPoint) return supplier.loadPoint;
    if (supplier?.city) return `${supplier.city} Warehouse`;
    return "London Warehouse";
  }, [supplier]);

  const polLabel = useMemo(() => {
    return pol ? pol.name : "Felixstowe";
  }, [pol]);

  const podLabel = useMemo(() => {
    return pod ? pod.name : "Karachi";
  }, [pod]);

  const currency = matchedRate?.currency || "USD";
  const ratePerContainer = matchedRate?.ratePerContainer || 2100;
  const totalFreight = ratePerContainer * quantity;

  // Format date helper (e.g., "18 Aug 2026" or "10 Aug 2026 – 20 Aug 2026 (Window)")
  const formattedLoadingDate = useMemo(() => {
    if (!loadingDate) return "18 Aug 2026";
    if (loadingDate.includes(" to ") || loadingDate.includes(" - ")) {
      const [start, end] = loadingDate.includes(" to ")
        ? loadingDate.split(" to ")
        : loadingDate.split(" - ");
      const d1 = new Date(start?.trim());
      const d2 = new Date(end?.trim());
      if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
        if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
          return `${d1.getDate()}–${d2.getDate()} ${d1.toLocaleString("en-GB", { month: "short" })} ${d1.getFullYear()} (Flexible Window)`;
        }
        return `${d1.getDate()} ${d1.toLocaleString("en-GB", { month: "short" })} – ${d2.getDate()} ${d2.toLocaleString("en-GB", { month: "short" })} ${d2.getFullYear()} (Window)`;
      }
      return loadingDate;
    }
    try {
      const d = new Date(loadingDate);
      if (isNaN(d.getTime())) return loadingDate;
      return d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return loadingDate;
    }
  }, [loadingDate]);

  // Auto-generated subject: Booking Request | {movement_number}
  const defaultSubject = useMemo(() => {
    return `Booking Request | ${reference}`;
  }, [reference]);

  // Structured booking email template matching the required specifications
  const generateEmailBody = () => {
    return `Dear ${forwarderContact},

Please arrange the booking for the following movement.

Movement Number: ${reference}

Buyer:
${buyer?.name || "New Henna"}

Supplier:
${supplier?.name || "UK Supplier"}

Load Point:
${loadPoint}

Port of Loading:
${polLabel}

Port of Discharge:
${podLabel}

Shipping Line:
${shippingLine?.name || "MSC"}

Container:
${containerSize} × ${quantity}

Loading Date:
${formattedLoadingDate}

Agreed Rate:
${currency} ${ratePerContainer} / container (Total: ${currency} ${totalFreight})

${instructions ? `Special Instructions:\n${instructions}\n\n` : ""}Please confirm availability and provide the booking details.

Kind regards,

Nashmia Industries
Logistics Operations`;
  };

  // Form states
  const [recipientEmail, setRecipientEmail] = useState(forwardersEmailsString);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [ccValue, setCcValue] = useState("");
  const [bccValue, setBccValue] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState(generateEmailBody());
  const [isSending, setIsSending] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [selectedFontSize, setSelectedFontSize] = useState("14");
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  // Success modal state
  const [submissionResult, setSubmissionResult] = useState<BookingSubmissionResult | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Synchronize default subject, body and recipient when props change
  useEffect(() => {
    if (forwardersEmailsString) {
      setRecipientEmail(forwardersEmailsString);
    }
  }, [forwardersEmailsString]);

  useEffect(() => {
    setSubject(defaultSubject);
  }, [defaultSubject]);

  useEffect(() => {
    setEmailBody(generateEmailBody());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    reference,
    forwarderContact,
    buyer?.name,
    supplier?.name,
    loadPoint,
    polLabel,
    podLabel,
    shippingLine?.name,
    containerSize,
    quantity,
    formattedLoadingDate,
    currency,
    ratePerContainer,
    totalFreight,
    instructions,
  ]);

  const handleSendRef = useRef<() => void>(() => {});

  const handleSend = async () => {
    const targetEmail = recipientEmail || forwardersEmailsString;
    if (!targetEmail || !targetEmail.includes("@")) {
      toast.error("Forwarder email required", {
        description: "Please provide a valid recipient email to dispatch this booking request.",
      });
      return;
    }

    setIsSending(true);
    try {
      // Build forwarders list for separate individual dispatches
      const rawEmails = targetEmail
        .split(/[,;]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));

      let forwardersPayload: Array<{
        id: string;
        name: string;
        email: string;
        contactName?: string;
        code?: string;
        contractTier?: string;
      }> = [];

      if (forwardersList && forwardersList.length > 0) {
        forwardersPayload = forwardersList
          .map((f) => {
            const email = f.email?.trim() || "";
            return {
              id: f.id,
              name: f.name,
              email,
              contactName: f.contactPerson || f.contact || `${f.name} Booking Team`,
              code: f.code,
              contractTier: f.contractTier,
            };
          })
          .filter((f) => f.email && f.email.includes("@"));
      }

      // Check if user manually added extra email addresses in the recipient field
      rawEmails.forEach((emailStr) => {
        const alreadyExists = forwardersPayload.some(
          (fp) => fp.email.toLowerCase() === emailStr.toLowerCase(),
        );
        if (!alreadyExists) {
          const namePart = emailStr.split("@")[0].replace(/[._-]/g, " ").toUpperCase();
          forwardersPayload.push({
            id: `fwd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: namePart,
            email: emailStr,
            contactName: `${namePart} Booking Team`,
          });
        }
      });

      const result = await submitBookingRequestWorkflow(
        userId,
        {
          reference,
          buyerId: buyer?.id,
          buyerName: buyer?.name,
          buyerCountry: buyer?.country,
          supplierId: supplier?.id,
          supplierName: supplier?.name,
          supplierCity: supplier?.city,
          forwarderId: forwardersPayload[0]?.id || forwardersList[0]?.id || bookingAgent?.id,
          forwarderName:
            forwardersPayload.length > 1
              ? forwardersPayload.map((f) => f.name).join(", ")
              : forwardersList[0]?.name || bookingAgent?.name,
          shippingLineId: shippingLine?.id,
          shippingLineName: shippingLine?.name,
          origin: polLabel,
          destination: podLabel,
          containerSize,
          containerCount: quantity,
          loadingDate,
          productDescription,
          specialInstructions: instructions,
          totalFreight,
          currency,
          rateCardId: matchedRate ? `${matchedRate.agentId}-${matchedRate.polCode}` : undefined,
        },
        {
          fromEmail,
          toEmail: targetEmail,
          toName: forwarderContact,
          cc: ccValue || undefined,
          bcc: bccValue || undefined,
          subject,
          body: emailBody,
          forwarders: forwardersPayload,
        },
      );

      setSubmissionResult(result);
      queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["forwarder-offer-cards"] });
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nashmia_forwarder_offers_updated", {
            detail: { timestamp: Date.now() },
          }),
        );
      }
      onSuccess(result);

      if (forwardersPayload.length > 1) {
        if (result.gmailStatus === "sent") {
          toast.success(`Booking Requests Dispatched to ${forwardersPayload.length} Forwarders`, {
            description: `Separate individual emails sent to: ${forwardersPayload.map((f) => f.name).join(", ")}`,
          });
        } else if (result.gmailStatus === "rate_limited") {
          toast.info(`Booking Requests Saved for ${forwardersPayload.length} Forwarders`, {
            description: `Movement ${reference} recorded. Gmail temporary sending limit active; requests queued.`,
          });
        } else {
          toast.success(`Booking Requests Saved for ${forwardersPayload.length} Forwarders`, {
            description: `Movement ${reference} recorded. Status: Draft / Pending send.`,
          });
        }
      } else {
        if (result.gmailStatus === "sent") {
          toast.success("Booking Request Dispatched via Gmail", {
            description: `Message transmitted to ${targetEmail}`,
          });
        } else if (result.gmailStatus === "rate_limited") {
          toast.info("Booking Request Saved", {
            description: `Movement ${reference} recorded. Gmail temporary sending limit active; request queued.`,
          });
        } else {
          toast.success("Booking Request Saved", {
            description: `Reference ${reference} recorded. Status: Draft / Pending send.`,
          });
        }
      }
    } catch (err: unknown) {
      console.error("[BookingEmailPreviewModal] Send error:", err);
      const errMsg =
        err instanceof Error ? err.message : "Failed to record and send booking request.";
      toast.error("Dispatch Failed", {
        description: errMsg,
      });
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // Keyboard shortcut Ctrl + Enter to send email quickly
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Enter" &&
        isOpen &&
        !submissionResult &&
        !isSending
      ) {
        e.preventDefault();
        handleSendRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submissionResult, isSending]);

  if (!isOpen) return null;

  const handleCopyRef = () => {
    if (submissionResult?.reference) {
      navigator.clipboard.writeText(submissionResult.reference);
      setCopiedRef(true);
      setTimeout(() => setCopiedRef(false), 2000);
    }
  };

  const handleSaveDraftAction = () => {
    onSaveDraft();
    toast.success("Email Draft Saved", {
      description: `Draft for booking reference ${reference} has been preserved.`,
    });
    onClose();
  };

  const handleResetForNew = () => {
    setSubmissionResult(null);
    onClose();
  };

  // SUCCESS CONFIRMATION STATE (CLEAN WHITE & HIGH CONTRAST)
  if (submissionResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4 backdrop-blur-[2px] animate-in fade-in duration-200">
        <div className="relative w-full max-w-[500px] overflow-hidden rounded-[30px] border border-[rgba(106,128,169,0.16)] bg-[#FFFFFF] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.14)] animate-in zoom-in-[0.97] duration-200">
          <div className="flex flex-col items-center text-center space-y-2.5">
            <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-50/80">
              <CheckCircle2 className="size-7 stroke-[2.2]" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-[#000000]">
              Booking Request Dispatched
            </h3>
            <p className="text-[13.5px] text-slate-500 max-w-sm">
              Your container movement booking request has been registered in Supabase and queued for
              forwarder confirmation.
            </p>
          </div>

          <div className="mt-6 rounded-[18px] bg-[#F7FBFC] p-4.5 border border-[rgba(106,128,169,0.12)] space-y-2.5 text-[13px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60">
              <span className="text-slate-500 font-medium">Reference</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-[#000000]">
                <span>{submissionResult.reference}</span>
                <button
                  type="button"
                  onClick={handleCopyRef}
                  className="rounded-md p-1 text-slate-400 hover:text-black transition"
                  title="Copy reference"
                >
                  {copiedRef ? (
                    <Check className="size-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Recipient</span>
              <span className="font-semibold text-slate-900 truncate max-w-[240px]">
                {submissionResult.toEmail}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">
                Forwarder{forwardersList.length > 1 ? "s" : ""}
              </span>
              <span
                className="font-semibold text-[#000000] text-right truncate max-w-[240px]"
                title={forwardersList.map((f) => f.name).join(", ")}
              >
                {forwardersList.length > 1
                  ? `${forwardersList.length} Forwarders (${forwardersList.map((f) => f.name).join(", ")})`
                  : bookingAgent?.name || "Forwarding Partner"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Route</span>
              <span className="font-semibold text-[#000000]">
                {polLabel} → {podLabel}
              </span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetForNew}
              className="flex h-12 flex-1 items-center justify-center rounded-[15px] border border-slate-200 bg-white text-[13.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => {
                setSubmissionResult(null);
                onClose();
                onViewMovement?.();
              }}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[15px] bg-[#000000] text-[13.5px] font-semibold text-[#FFFFFF] shadow-sm hover:bg-slate-800 transition-colors"
            >
              <span>View Booking</span>
              <ArrowRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN PREVIEW / COMPOSE MODAL (MATCHING EXACT VISUAL REFERENCE)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-3 sm:p-5 backdrop-blur-[2px] animate-in fade-in duration-200">
      <div
        className={cn(
          "relative flex flex-col bg-[#FFFFFF] text-slate-900 shadow-[0_24px_70px_rgba(0,0,0,0.12)] border border-[rgba(106,128,169,0.12)] transition-all duration-200 animate-in zoom-in-[0.97] duration-200",
          isMaximized
            ? "w-full h-full max-w-none max-h-none rounded-[20px] p-6 sm:p-8"
            : "w-full max-w-[980px] max-h-[92vh] rounded-[32px] p-6 sm:p-8 overflow-y-auto",
        )}
      >
        {/* HEADER: Circular Email Icon + "New Email" + Subtitle + (Minimize / Expand / Close) */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-100/90">
          <div className="flex items-center gap-3.5">
            {/* Soft Ice Blue Circle with Email Icon */}
            <div className="flex size-12 items-center justify-center rounded-full bg-[#E8F1F3] text-[#24828E]">
              <Mail className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-[21px] font-bold tracking-tight text-slate-900 leading-snug">
                New Email
              </h2>
              <p className="text-[14px] text-slate-500 leading-tight">
                Compose and send your email
              </p>
            </div>
          </div>

          {/* Top-Right 3 Rounded Square Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-[13px] border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title="Minimize"
            >
              <Minus className="size-4 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="flex size-10 items-center justify-center rounded-[13px] border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title={isMaximized ? "Restore Size" : "Expand"}
            >
              {isMaximized ? (
                <Minimize2 className="size-4 stroke-[2.2]" />
              ) : (
                <Maximize2 className="size-4 stroke-[2.2]" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-[13px] border border-slate-200/80 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title="Close"
            >
              <X className="size-4 stroke-[2.2]" />
            </button>
          </div>
        </div>

        {/* EMAIL FIELDS: Horizontal Layout (From, To, Subject) */}
        <div className="py-5 space-y-3.5">
          {/* FROM FIELD */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span className="w-24 sm:w-28 shrink-0 text-[14.5px] font-semibold text-slate-900">
              From
            </span>
            <div className="flex-1 flex items-center justify-between h-[72px] rounded-[20px] border border-[rgba(106,128,169,0.16)] bg-white px-4 py-2.5 transition-all hover:border-[rgba(106,128,169,0.28)]">
              <div className="flex items-center gap-3 min-w-0">
                {/* Circular NI Avatar or Connected Google Avatar */}
                {gmailAvatar ? (
                  <img
                    src={gmailAvatar}
                    alt={senderDisplayName}
                    className="size-11 shrink-0 rounded-full object-cover shadow-2xs border border-slate-100"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#24828E] text-[13.5px] font-bold text-white tracking-wide shadow-2xs">
                    {senderInitials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[14.5px] font-bold text-slate-900 leading-tight truncate">
                    {senderDisplayName}
                  </div>
                  <div className="text-[13.5px] text-slate-500 truncate leading-tight mt-0.5">
                    {fromEmail}
                  </div>
                </div>
              </div>
              <ChevronDown className="size-4.5 text-slate-400 shrink-0 ml-2" />
            </div>
          </div>

          {/* TO FIELD */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:pt-2 gap-2 sm:gap-4">
            <div className="w-24 sm:w-28 shrink-0 pt-2 text-[14.5px] font-semibold text-slate-900 flex items-center justify-between">
              <span>To</span>
              {forwardersList.length > 1 && (
                <span className="rounded-full bg-[#E8F1F3] px-2 py-0.5 text-[10.5px] font-bold text-[#24828E]">
                  {forwardersList.length}
                </span>
              )}
            </div>
            <div className="flex-1 flex flex-col justify-center min-h-[56px] rounded-[20px] border border-[rgba(106,128,169,0.16)] bg-white px-4 py-2 transition-all focus-within:border-[#6A80A9]">
              {forwardersList.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pb-1.5 pt-0.5 border-b border-slate-100/80 mb-1.5">
                  {forwardersList.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex items-center gap-1 rounded-md bg-[#E8F1F3]/90 px-2 py-0.5 text-[11px] font-semibold text-[#24828E]"
                    >
                      <span>{f.name}</span>
                      {f.email && (
                        <span className="text-[10px] opacity-75 font-normal">({f.email})</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between">
                <input
                  type="text"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="Add recipient(s) (comma separated)"
                  className="w-full bg-transparent text-[14px] font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <div className="flex items-center gap-3 shrink-0 text-slate-500 pl-2">
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-700 transition-colors"
                    title="Select Contacts"
                  >
                    <UserPlus className="size-4.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCc(!showCc)}
                    className={cn(
                      "text-[13px] font-semibold transition-colors",
                      showCc ? "text-[#24828E]" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    CC
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBcc(!showBcc)}
                    className={cn(
                      "text-[13px] font-semibold transition-colors",
                      showBcc ? "text-[#24828E]" : "text-slate-500 hover:text-slate-800",
                    )}
                  >
                    BCC
                  </button>
                  <ChevronDown className="size-4.5 text-slate-400" />
                </div>
              </div>
            </div>
          </div>

          {/* OPTIONAL CC ROW */}
          {showCc && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 animate-in fade-in duration-150">
              <span className="w-24 sm:w-28 shrink-0 text-[13.5px] font-semibold text-slate-500">
                CC
              </span>
              <div className="flex-1 flex items-center min-h-[50px] rounded-[18px] border border-[rgba(106,128,169,0.16)] bg-white px-4 py-2">
                <input
                  type="text"
                  value={ccValue}
                  onChange={(e) => setCcValue(e.target.value)}
                  placeholder="CC recipients (comma separated)"
                  className="w-full bg-transparent text-[13.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* OPTIONAL BCC ROW */}
          {showBcc && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 animate-in fade-in duration-150">
              <span className="w-24 sm:w-28 shrink-0 text-[13.5px] font-semibold text-slate-500">
                BCC
              </span>
              <div className="flex-1 flex items-center min-h-[50px] rounded-[18px] border border-[rgba(106,128,169,0.16)] bg-white px-4 py-2">
                <input
                  type="text"
                  value={bccValue}
                  onChange={(e) => setBccValue(e.target.value)}
                  placeholder="BCC recipients (comma separated)"
                  className="w-full bg-transparent text-[13.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* SUBJECT FIELD */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <span className="w-24 sm:w-28 shrink-0 text-[14.5px] font-semibold text-slate-900">
              Subject
            </span>
            <div className="flex-1 flex items-center justify-between min-h-[56px] rounded-[20px] border border-[rgba(106,128,169,0.16)] bg-white px-4 py-2 transition-all focus-within:border-[#6A80A9]">
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject"
                className="w-full bg-transparent text-[14px] font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSubject(defaultSubject)}
                className="text-[#24828E] hover:text-[#147D8A] transition-colors p-1"
                title="AI Suggest / Auto Generate Subject"
              >
                <Sparkles className="size-5 stroke-[2]" />
              </button>
            </div>
          </div>
        </div>

        {/* MESSAGE EDITOR: Large Rounded Editor with Rich Text Toolbar */}
        <div className="rounded-[22px] border border-[rgba(106,128,169,0.14)] bg-white overflow-hidden flex flex-col mt-1">
          {/* RICH TEXT TOOLBAR (Matching Reference) */}
          <div className="flex flex-wrap items-center h-[58px] border-b border-slate-100/90 px-4 gap-1 sm:gap-2 bg-white select-none">
            {/* Font selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowFontMenu(!showFontMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span>{selectedFont}</span>
                <ChevronDown className="size-3.5 text-slate-400" />
              </button>
              {showFontMenu && (
                <div className="absolute top-full left-0 mt-1 w-32 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-20">
                  {["Inter", "Arial", "Calibri", "Helvetica", "Roboto"].map((font) => (
                    <button
                      key={font}
                      type="button"
                      onClick={() => {
                        setSelectedFont(font);
                        setShowFontMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded-md"
                    >
                      {font}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Font size selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSizeMenu(!showSizeMenu)}
                className="flex items-center gap-1 px-2 py-1.5 text-[13px] font-medium text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <span>{selectedFontSize}</span>
                <ChevronDown className="size-3.5 text-slate-400" />
              </button>
              {showSizeMenu && (
                <div className="absolute top-full left-0 mt-1 w-20 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-20">
                  {["12", "14", "16", "18", "20"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedFontSize(size);
                        setShowSizeMenu(false);
                      }}
                      className="w-full text-left px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded-md"
                    >
                      {size}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

            {/* Bold, Italic, Underline, Color */}
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Bold"
            >
              <Bold className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Italic"
            >
              <Italic className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Underline"
            >
              <Underline className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 flex-col items-center justify-center rounded-lg text-[#24828E] hover:bg-slate-100 transition-colors font-bold text-[13.5px]"
              title="Text Color"
            >
              <span>A</span>
              <div className="h-0.5 w-3 bg-[#24828E] -mt-0.5 rounded-full" />
            </button>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

            {/* Alignments */}
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Align Left"
            >
              <AlignLeft className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Align Center"
            >
              <AlignCenter className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Align Right"
            >
              <AlignRight className="size-4" />
            </button>

            {/* Separator */}
            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

            {/* Lists & Media */}
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Bulleted List"
            >
              <List className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Numbered List"
            >
              <ListOrdered className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Insert Link"
            >
              <Link2 className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="Insert Image"
            >
              <ImageIcon className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-8 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
              title="More options"
            >
              <MoreVertical className="size-4" />
            </button>
          </div>

          {/* MESSAGE AREA */}
          <textarea
            ref={textareaRef}
            rows={10}
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            placeholder="Write your message..."
            className="w-full min-h-[260px] p-5 text-[14px] font-normal text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none resize-none bg-white"
          />
        </div>

        {/* BOTTOM ACTION AREA: (Attachments, Image, Smile, Calendar) + (Save Draft, Send Email) */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5">
          {/* LEFT 4 ICON BUTTONS */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-[15px] border border-[rgba(106,128,169,0.16)] bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title="Attach File"
            >
              <Paperclip className="size-4.5" />
            </button>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-[15px] border border-[rgba(106,128,169,0.16)] bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title="Insert Image"
            >
              <ImageIcon className="size-4.5" />
            </button>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-[15px] border border-[rgba(106,128,169,0.16)] bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title="Insert Emoji"
            >
              <Smile className="size-4.5" />
            </button>
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-[15px] border border-[rgba(106,128,169,0.16)] bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
              title="Schedule / Calendar"
            >
              <Calendar className="size-4.5" />
            </button>
          </div>

          {/* RIGHT ACTION BUTTONS */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSaveDraftAction}
              className="h-12 px-6 rounded-[15px] border border-[rgba(106,128,169,0.16)] bg-white text-[14px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={isSending}
              className={cn(
                "h-12 px-7 min-w-[200px] rounded-[15px] text-[14.5px] font-semibold text-white transition-all flex items-center justify-center gap-2.5 shadow-md",
                isSending
                  ? "bg-slate-700 cursor-wait"
                  : "bg-[#000000] hover:bg-slate-800 active:scale-[0.99]",
              )}
            >
              {isSending ? (
                <>
                  <Loader2 className="size-4.5 animate-spin" />
                  <span>Sending Email...</span>
                </>
              ) : (
                <>
                  <span>Send Email</span>
                  <SendHorizontal className="size-4.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* BOTTOM TIP CONTAINER: Lightbulb + "Tip: You can use Ctrl + Enter to send email quickly" */}
        <div className="mt-4 flex items-center justify-center gap-2 rounded-[16px] border border-[rgba(106,128,169,0.10)] bg-[#F7FBFC] py-3 px-4 text-[13.5px] text-slate-600">
          <Lightbulb className="size-4.5 text-[#0FA3B1] shrink-0" />
          <p>
            <span className="font-semibold text-[#0FA3B1]">Tip:</span> You can use{" "}
            <span className="font-bold text-slate-900">Ctrl + Enter</span> to send email quickly
          </p>
        </div>
      </div>
    </div>
  );
}
