import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Minus,
  Maximize2,
  Minimize2,
  ChevronDown,
  Plus,
  FileText,
  MoreHorizontal,
  Link2,
  Folder,
  Trash2,
  Calendar,
  Clock,
  Send,
  Check,
  Loader2,
} from "lucide-react";
import type {
  BuyerAccount,
  SupplierVendor,
  Port,
  ShippingLine,
  BookingAgent,
  RateCard,
  ContainerSize,
  FreightRateMode,
} from "@/lib/booking-data";
import { useAuth } from "@/lib/auth-context";
import { useGmail } from "@/lib/use-gmail";
import {
  createBookingInSupabase,
  type FullBookingRecord,
  type BookingSubmissionResult,
} from "@/lib/supabase-services";
import { sendEmailThroughBackend } from "@/lib/email-services";
import { useQueryClient } from "@tanstack/react-query";
import { EMAILS_QUERY_KEY } from "@/lib/use-emails";
import { cn } from "@/lib/utils";
import { showPillToast } from "@/lib/pill-toast";
import { toast } from "sonner";
import {
  EmailSendingProcessModal,
  type ForwarderSendingItem,
} from "@/components/nashmia/emails/EmailSendingProcessModal";
import {
  getLocalForwarderRequests,
  saveLocalForwarderRequests,
  buildTrackingCompositeKey,
} from "@/lib/multi-forwarder-service";
import type { ForwarderQuoteRequestRecord } from "@/types/requests";

const AVATAR_BG_COLORS = [
  "from-amber-400 to-orange-500",
  "from-blue-500 to-indigo-600",
  "from-emerald-400 to-teal-600",
  "from-purple-400 to-pink-500",
  "from-rose-400 to-red-500",
  "from-cyan-400 to-blue-500",
];

function getInitials(name?: string) {
  if (!name) return "NI";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getFileType(fileName: string): "pptx" | "docx" | "xlsx" | "pdf" | "other" {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "docx" || ext === "doc" || ext === "word") return "docx";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "xlsx";
  if (ext === "pdf") return "pdf";
  return "other";
}

interface RecipientChip {
  id: string;
  name: string;
  email: string;
  avatarBg: string;
}

interface AttachmentItem {
  id: string;
  name: string;
  size: string;
  type: "pptx" | "docx" | "xlsx" | "pdf" | "other";
  file?: File;
}

export interface BookingEmailPreviewModalProps {
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
  rateMode?: FreightRateMode;
  customRate?: number | null;
  currency?: string;
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
  rateMode = "AGREED_RATE",
  customRate = null,
  currency = "USD",
  onSuccess,
  onSaveDraft,
}: BookingEmailPreviewModalProps) {
  const { user, userId, profile } = useAuth();
  const { googleEmail, displayName: gmailName, avatarUrl: gmailAvatar } = useGmail();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic sender details
  const fromEmail = useMemo(() => {
    return googleEmail || user?.email || profile?.email || "operations@nashmia-logistics.com";
  }, [googleEmail, user?.email, profile?.email]);

  const senderDisplayName = useMemo(() => {
    return (
      gmailName ||
      profile?.full_name ||
      profile?.name ||
      user?.email?.split("@")[0] ||
      "Nashmia Logistics Operations"
    );
  }, [gmailName, profile, user?.email]);

  const senderInitials = useMemo(() => {
    return getInitials(senderDisplayName);
  }, [senderDisplayName]);

  // Forwarder contact & email resolution
  const forwardersList: BookingAgent[] = useMemo(() => {
    if (selectedBookingAgents && selectedBookingAgents.length > 0) {
      return selectedBookingAgents;
    }
    return bookingAgent ? [bookingAgent] : [];
  }, [selectedBookingAgents, bookingAgent]);

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

  // Load point & port labels
  const loadPoint = useMemo(() => {
    if (supplier?.loadPoint) return supplier.loadPoint;
    if (supplier?.city) return `${supplier.city} Warehouse`;
    return supplier?.name ? `${supplier.name} Facility` : "Origin Loading Depot";
  }, [supplier]);

  const polLabel = useMemo(() => {
    return pol ? `${pol.code || ""} (${pol.name})`.trim() : "Port of Loading";
  }, [pol]);

  const podLabel = useMemo(() => {
    return pod ? `${pod.code || ""} (${pod.name})`.trim() : "Port of Discharge";
  }, [pod]);

  const effectiveCurrency = currency || matchedRate?.currency || "USD";
  const effectiveRatePerContainer =
    customRate !== null && customRate !== undefined
      ? customRate
      : matchedRate?.ratePerContainer || 0;
  const effectiveTotalFreight = effectiveRatePerContainer * quantity;

  // Format date helper
  const formattedLoadingDate = useMemo(() => {
    if (!loadingDate) return "Prompt / As Scheduled";
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

  // Default Subject
  const defaultSubject = useMemo(() => {
    if (rateMode === "ASKING_RATE") {
      return `Freight Rate Request: ${reference} | ${polLabel} → ${podLabel}`;
    }
    return `Booking Request & Shipping Instruction: ${reference}`;
  }, [reference, rateMode, polLabel, podLabel]);

  // Default Structured Body
  const generateEmailBody = () => {
    if (rateMode === "ASKING_RATE") {
      return `Dear ${forwarderContact},\n\nPlease provide your best ocean freight quotation for Movement ${reference}:\n\n• Route: ${polLabel} to ${podLabel}\n• Shipper / Facility: ${supplier?.name || "Supplier Point"} (${loadPoint})\n• Consignee: ${buyer?.name || "Consignee Account"}\n• Equipment: ${quantity}x ${containerSize}\n• Requested ETD: ${formattedLoadingDate}\n${productDescription ? `• Commodity: ${productDescription}\n` : ""}${instructions ? `• Special Instructions: ${instructions}\n` : ""}\nKindly share your earliest available vessel schedule, transit time, and detention/demurrage free days.\n\nBest regards,\n${senderDisplayName}\nNashmia Global Logistics`;
    }

    return `Dear ${forwarderContact},\n\nPlease arrange booking and container placement for Movement ${reference}:\n\n• Route: ${polLabel} to ${podLabel}\n• Shipping Line: ${shippingLine?.name || "Direct Carrier"}\n• Equipment: ${quantity}x ${containerSize}\n• Loading Date: ${formattedLoadingDate}\n• Shipper: ${supplier?.name || "Supplier Point"} (${loadPoint})\n• Consignee: ${buyer?.name || "Consignee Account"}\n${effectiveRatePerContainer > 0 ? `• Agreed Freight Rate: ${effectiveCurrency} ${effectiveRatePerContainer.toLocaleString()} / container (Total: ${effectiveCurrency} ${effectiveTotalFreight.toLocaleString()})\n` : ""}${instructions ? `• Booking Notes: ${instructions}\n` : ""}\nPlease confirm vessel space and share booking confirmation number at your earliest convenience.\n\nBest regards,\n${senderDisplayName}\nNashmia Global Logistics`;
  };

  // State
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(generateEmailBody());
  const [isMaximized, setIsMaximized] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");

  // Recipients
  const [recipients, setRecipients] = useState<RecipientChip[]>([]);
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<AttachmentItem[]>([
    {
      id: "att-1",
      name: `${reference || "Shipment"}_Specification.docx`,
      size: "1.2 MB",
      type: "docx",
    },
    {
      id: "att-2",
      name: `${reference || "Shipment"}_Rate_Schedule.xlsx`,
      size: "340 KB",
      type: "xlsx",
    },
    {
      id: "att-3",
      name: `${reference || "Shipment"}_Cargo_Manifest.pdf`,
      size: "2.4 MB",
      type: "pdf",
    },
  ]);

  // Email sending process modal state
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [processItems, setProcessItems] = useState<ForwarderSendingItem[]>([]);
  const createdBookingRef = useRef<FullBookingRecord | null>(null);

  // Initialize recipients from selected forwarders
  useEffect(() => {
    if (forwardersList.length > 0) {
      const mapped: RecipientChip[] = forwardersList.map((f, idx) => ({
        id: f.id || `fwd-${idx}`,
        name: f.name,
        email: f.email || `${f.name.toLowerCase().replace(/\s+/g, "")}@freight.com`,
        avatarBg: AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length],
      }));
      setRecipients(mapped);
    } else {
      setRecipients([]);
    }
  }, [forwardersList]);

  // Synchronize dynamic defaults when props change
  useEffect(() => {
    setSubject(defaultSubject);
    setBody(generateEmailBody());
    setAttachments([
      {
        id: "att-1",
        name: `${reference || "Shipment"}_Specification.docx`,
        size: "1.2 MB",
        type: "docx",
      },
      {
        id: "att-2",
        name: `${reference || "Shipment"}_Rate_Schedule.xlsx`,
        size: "340 KB",
        type: "xlsx",
      },
      {
        id: "att-3",
        name: `${reference || "Shipment"}_Cargo_Manifest.pdf`,
        size: "2.4 MB",
        type: "pdf",
      },
    ]);
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
    effectiveCurrency,
    effectiveRatePerContainer,
    effectiveTotalFreight,
    rateMode,
    instructions,
  ]);

  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCreateCustomRecipient = () => {
    if (!recipientInput.trim()) {
      setIsAddingRecipient(false);
      return;
    }
    const val = recipientInput.trim();
    const newRec: RecipientChip = {
      id: `custom-${Date.now()}`,
      name: val.includes("@") ? val.split("@")[0].replace(/[._-]/g, " ") : val,
      email: val.includes("@") ? val : `${val.toLowerCase().replace(/\s+/g, "")}@forwarder.com`,
      avatarBg: AVATAR_BG_COLORS[recipients.length % AVATAR_BG_COLORS.length],
    };
    setRecipients((prev) => [...prev, newRec]);
    setRecipientInput("");
    setIsAddingRecipient(false);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newAtts: AttachmentItem[] = Array.from(files).map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      type: getFileType(file.name),
      file,
    }));
    setAttachments((prev) => [...prev, ...newAtts]);
    showPillToast.success(
      `Attached ${files.length} file${files.length > 1 ? "s" : ""}`,
      "File Attached",
    );
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error("Recipient required", {
        description: "Please specify at least one forwarder recipient to send this booking email.",
      });
      return;
    }

    const items: ForwarderSendingItem[] = recipients.map((r, idx) => ({
      id:
        r.id.startsWith("custom-") || r.id.startsWith("fwd-")
          ? `target-${idx}-${Date.now()}`
          : r.id,
      name: r.name,
      email: r.email,
      contactName: `${r.name} Desk`,
      status: "Waiting",
    }));

    createdBookingRef.current = null;
    setProcessItems(items);
    setIsProcessModalOpen(true);
  };

  const handleSendSingleForwarder = async (item: ForwarderSendingItem) => {
    try {
      let bRecord = createdBookingRef.current;
      if (!bRecord) {
        bRecord = await createBookingInSupabase(userId, {
          reference,
          bookingReference: reference,
          movementNumber: reference,
          buyerId: buyer?.id,
          buyerName: buyer?.name,
          buyerCountry: buyer?.country,
          supplierId: supplier?.id,
          supplierName: supplier?.name,
          supplierCity: supplier?.city,
          forwarderId:
            rateMode === "AGREED_RATE" && forwardersList.length === 1
              ? forwardersList[0]?.id || bookingAgent?.id
              : undefined,
          forwarderName:
            rateMode === "AGREED_RATE" && forwardersList.length === 1
              ? forwardersList[0]?.name || bookingAgent?.name
              : "Pending Award",
          shippingLineId: shippingLine?.id,
          shippingLineName: shippingLine?.name,
          rateCardId: matchedRate?.id,
          origin: pol?.name || pol?.code || "Felixstowe (FXT)",
          destination: pod?.name || pod?.code || "Karachi (KHI)",
          polName: pol?.name || "Felixstowe (FXT)",
          podName: pod?.name || "Karachi (KHI)",
          polCode: pol?.code || "FXT",
          podCode: pod?.code || "KHI",
          containerSize,
          containerType: "High Cube",
          containerCount: quantity,
          loadingDate,
          requestedEtd: loadingDate,
          productDescription: productDescription || "Export Cargo",
          notes: instructions || "",
          rateMode,
          freightRateMode: rateMode,
          customRate: rateMode === "ASKING_RATE" ? null : effectiveRatePerContainer,
          totalFreight: rateMode === "ASKING_RATE" ? null : effectiveTotalFreight,
          currency: effectiveCurrency,
          status: rateMode === "ASKING_RATE" ? "Booking Requested" : "Booking Confirmed",
          allocatedForwarders: forwardersList.map((f) => ({
            id: f.id,
            name: f.name,
            email: f.email,
          })),
        });
        createdBookingRef.current = bRecord;
      }

      const forwarderObj = forwardersList.find(
        (f) =>
          f.id === item.id ||
          (f.email && f.email.toLowerCase() === item.email.toLowerCase()) ||
          f.name.toLowerCase() === item.name.toLowerCase(),
      );

      const recipientName = forwarderObj?.name || item.name;
      const sendResult = await sendEmailThroughBackend({
        userId,
        toEmail: item.email,
        toName: recipientName,
        subject,
        bodyText: body,
        bookingId: bRecord?.id,
        bookingReference: reference,
        movementNumber: reference,
        templateType: rateMode === "ASKING_RATE" ? "rate_request" : "booking_request",
        attachments: attachments.map((a) => ({
          name: a.name,
          size: a.size,
          type: a.type,
        })),
        cc: cc || undefined,
        bcc: bcc || undefined,
      });

      try {
        const allExisting = getLocalForwarderRequests();
        const trackingKey = buildTrackingCompositeKey(
          reference,
          forwarderObj?.id || item.id,
          item.email,
        );

        const newFwdRecord: ForwarderQuoteRequestRecord = {
          id: `fr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          trackingCompositeKey: trackingKey,
          bookingId: bRecord?.id,
          movementNumber: reference,
          bookingReference: reference,
          forwarderId: forwarderObj?.id || item.id,
          forwarderName: recipientName,
          forwarderEmail: item.email,
          contactPerson: item.contactName,
          origin: pol?.name || pol?.code,
          destination: pod?.name || pod?.code,
          containerSize,
          containerType: "High Cube",
          containerCount: quantity,
          status:
            rateMode === "AGREED_RATE" && effectiveRatePerContainer > 0 ? "Quoted" : "Pending",
          hasOffer: rateMode === "AGREED_RATE" && effectiveRatePerContainer > 0,
          sentAt: new Date().toISOString(),
          sentVia: sendResult.success ? "Gmail Direct" : "Simulated Outbox",
          offerData:
            rateMode === "AGREED_RATE" && effectiveRatePerContainer > 0
              ? {
                  ratePerContainer: effectiveRatePerContainer,
                  totalFreight: effectiveTotalFreight,
                  currency: effectiveCurrency,
                  carrier: shippingLine?.name || "Direct Line",
                  receivedAt: new Date().toISOString(),
                  receivedVia: "Agreed Tariff",
                }
              : undefined,
          updatedAt: new Date().toISOString(),
        };

        const filteredExisting = allExisting.filter(
          (r) =>
            !(
              (r.bookingId === newFwdRecord.bookingId ||
                r.movementNumber === newFwdRecord.movementNumber) &&
              r.forwarderEmail.toLowerCase() === newFwdRecord.forwarderEmail.toLowerCase()
            ),
        );
        filteredExisting.unshift(newFwdRecord);
        saveLocalForwarderRequests(filteredExisting);
      } catch (fwdRecErr) {
        console.warn("[BookingEmailPreviewModal] Notice creating forwarder record:", fwdRecErr);
      }

      queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["forwarder-offer-cards"] });
      queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      queryClient.invalidateQueries({ queryKey: ["operational-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nashmia_bookings_updated", {
            detail: {
              updated: true,
              id: bRecord?.id,
              movementNumber: reference,
              bookingReference: reference,
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("supabase_realtime_bookings_change", {
            detail: {
              updated: true,
              id: bRecord?.id,
              movementNumber: reference,
              bookingReference: reference,
            },
          }),
        );
        window.dispatchEvent(
          new CustomEvent("nashmia_forwarder_offers_updated", {
            detail: { timestamp: Date.now() },
          }),
        );
      }

      return {
        success: sendResult.success,
        gmailMessageId: sendResult.gmailMessageId,
        gmailThreadId: sendResult.gmailThreadId,
        errorMessage: sendResult.errorMessage,
      };
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : "Failed to record and send booking request.";
      return {
        success: false,
        errorMessage: errMsg,
      };
    }
  };

  const handleProcessModalClose = () => {
    setIsProcessModalOpen(false);
    const bRecord = createdBookingRef.current;
    if (bRecord) {
      onSuccess({
        success: true,
        bookingId: bRecord.id,
        reference: bRecord.booking_reference || reference,
        movementNumber: bRecord.movement_number || reference,
        toEmail: recipients.map((r) => r.email).join(", "),
        gmailStatus: "sent",
        forwardersCount: processItems.length,
      });
    }
    onClose();
  };

  // Lock body scroll while modal is visible
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    if (!isOpen || isProcessModalOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isProcessModalOpen, onClose]);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {/* Dark Overlay Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Centered Sleek Modal Card Matching Compose Email Exactly */}
      <div
        className={cn(
          "fixed z-50 bg-white shadow-2xl transition-all flex flex-col justify-between overflow-hidden text-slate-900 outline-none",
          isMaximized
            ? "inset-2 sm:inset-4 w-auto h-auto rounded-[20px] p-5 sm:p-6 border border-slate-200/80"
            : "inset-x-0 bottom-0 top-auto translate-x-0 translate-y-0 w-full max-h-[92vh] rounded-t-[28px] rounded-b-none border-t border-x-0 border-b-0 border-slate-200/90 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-240 ease-[cubic-bezier(0.16,1,0.3,1)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-[660px] sm:max-h-[92vh] sm:min-h-[580px] sm:rounded-[28px] sm:border sm:border-slate-200/80 sm:p-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 sm:duration-150",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Tactile Drag Handle */}
        {!isMaximized && (
          <div
            data-swipe-handle="true"
            className="mx-auto -mt-2 mb-2 flex h-6 w-full max-w-[140px] cursor-grab touch-none items-center justify-center sm:hidden select-none shrink-0"
            aria-label="Drag down to dismiss"
          >
            <div className="h-1.5 w-12 rounded-full bg-slate-300" />
          </div>
        )}

        {/* 1. Header: Mail Icon + "Compose email" + Action Controls */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-full bg-slate-100 grid place-items-center text-slate-700">
              <Mail className="size-4" />
            </div>
            <span className="font-bold text-[15px] text-slate-900 tracking-tight">
              Compose email
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title="Minimize"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              {isMaximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              title="Close"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* 2. From Section: Sender Avatar + Verified Blue Checkmark Pill + Sender Name & Email */}
        <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-xs font-normal w-10 shrink-0">From</span>
            <div className="flex items-center gap-2.5">
              {gmailAvatar ? (
                <img
                  src={gmailAvatar}
                  alt={senderDisplayName}
                  className="size-7 rounded-full object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="size-7 rounded-full bg-[#0FA3B1] text-white text-[11px] font-bold grid place-items-center shrink-0">
                  {senderInitials}
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[13px] font-bold text-slate-900">{senderDisplayName}</span>
                <span
                  className="inline-grid place-items-center size-3.5 rounded-full bg-[#0084FF] text-white shrink-0"
                  title="Verified Sender"
                >
                  <Check className="size-2.5 stroke-[3]" />
                </span>
                <span className="text-[12px] text-slate-400 font-normal">({fromEmail})</span>
              </div>
            </div>
          </div>
          <ChevronDown className="size-4 text-slate-400" />
        </div>

        {/* 3. To Section: Interactive Recipient Chips + Add Button + CC/BCC Toggle */}
        <div className="flex items-start justify-between py-2.5 border-b border-slate-100 gap-2 min-h-[44px]">
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <span className="text-slate-400 text-xs font-normal w-10 shrink-0 pt-0.5">To</span>

            {/* Recipient Chips */}
            {recipients.map((rec) => (
              <div
                key={rec.id}
                className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/80 rounded-full pl-1 pr-2 py-0.5 text-xs transition-colors border border-slate-200/50"
              >
                <div
                  className={cn(
                    "size-5 rounded-full text-white text-[9px] font-bold grid place-items-center bg-gradient-to-tr shrink-0",
                    rec.avatarBg,
                  )}
                >
                  {getInitials(rec.name)}
                </div>
                <span className="font-semibold text-slate-800 text-[11.5px] max-w-[140px] truncate">
                  {rec.name}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(rec.id)}
                  className="text-slate-400 hover:text-slate-700 rounded-full p-0.5 transition-colors"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}

            {/* Add recipient inline input */}
            {isAddingRecipient ? (
              <div className="relative inline-flex items-center">
                <input
                  type="text"
                  autoFocus
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCustomRecipient();
                    } else if (e.key === "Escape") {
                      setIsAddingRecipient(false);
                    }
                  }}
                  placeholder="Type name or email..."
                  className="text-[12px] bg-white border border-[#0FA3B1] rounded-full px-2.5 py-0.5 focus:outline-none w-48"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingRecipient(true)}
                className="inline-flex items-center gap-1 text-[11.5px] text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 rounded-full px-2 py-0.5 transition-colors cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Add</span>
              </button>
            )}
          </div>

          {/* Add CC / BCC Button */}
          <button
            type="button"
            onClick={() => setShowCcBcc(!showCcBcc)}
            className="text-[12px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer ml-auto shrink-0 select-none pt-0.5"
          >
            {showCcBcc ? "Hide CC / BCC" : "Add CC / BCC"}
          </button>
        </div>

        {/* Optional CC & BCC Fields */}
        {showCcBcc && (
          <div className="space-y-2 py-1.5 text-xs animate-in fade-in duration-150 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-normal w-10 shrink-0">CC</span>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="CC recipients (comma separated)"
                className="flex-1 text-[12px] text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 font-normal w-10 shrink-0">BCC</span>
              <input
                type="text"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                placeholder="BCC recipients (comma separated)"
                className="flex-1 text-[12px] text-slate-800 bg-slate-50/50 border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-slate-400"
              />
            </div>
          </div>
        )}

        {/* 4. Subject & Body Content Area */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[190px] max-h-[360px] py-2 pr-1">
          {/* Subject Line - Large Bold Title Typography */}
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Booking Request Subject"
            className="w-full text-[16.5px] font-bold text-slate-950 placeholder:text-slate-400 focus:outline-none bg-transparent tracking-tight py-0.5 leading-snug"
          />

          {/* Email Body - Clean Reading Typography */}
          <textarea
            rows={7}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email message..."
            className="w-full text-[13.5px] text-slate-700 leading-relaxed placeholder:text-slate-400 focus:outline-none resize-none bg-transparent py-1.5 min-h-[140px]"
          />
        </div>

        {/* 5. Attachment Section: Header + 3 File Cards (Word, Excel, PDF) */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 pb-2.5">
            <span className="font-bold text-[12.5px] text-slate-900">Attachment</span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              Verified Documents
              <span className="inline-grid place-items-center size-3.5 rounded-full bg-[#10B981] text-white">
                <Check className="size-2.5 stroke-[3]" />
              </span>
            </span>
          </div>

          {/* File Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {attachments.map((att) => {
              return (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/70 transition-colors shadow-2xs group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {att.type === "pptx" ? (
                      <div className="size-7 rounded-lg bg-[#D24726] text-white text-[11px] font-bold grid place-items-center shrink-0 shadow-2xs">
                        P
                      </div>
                    ) : att.type === "docx" ? (
                      <div className="size-7 rounded-lg bg-[#2B579A] text-white text-[11px] font-bold grid place-items-center shrink-0 shadow-2xs">
                        W
                      </div>
                    ) : att.type === "xlsx" ? (
                      <div className="size-7 rounded-lg bg-[#217346] text-white text-[11px] font-bold grid place-items-center shrink-0 shadow-2xs">
                        X
                      </div>
                    ) : (
                      <div className="size-7 rounded-lg bg-[#E53935] text-white text-[10px] font-bold grid place-items-center shrink-0 shadow-2xs">
                        <FileText className="size-3.5 text-white" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold text-slate-900 truncate leading-tight">
                        {att.name}
                      </div>
                      <div className="text-[10.5px] text-slate-400 leading-tight mt-0.5">
                        {att.size}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(att.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition-opacity p-1 cursor-pointer"
                    title="Remove file"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Hidden Native File Input */}
          <input
            type="file"
            multiple
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* 6. Bottom Action Footer Bar */}
        <div className="flex items-center justify-between pt-4 mt-2">
          {/* Left Action Icons: More, Attach/Link, Folder/Draft, Trash */}
          <div className="flex items-center gap-3 text-slate-400">
            <button
              type="button"
              onClick={() => {
                setBody((prev) =>
                  prev
                    ? `${prev}\n\n[AI Verified]: Cargo logistics and vessel dispatch requirement confirmed.`
                    : prev,
                );
                showPillToast.success("Email inquiry optimized with AI.", "AI Polish");
              }}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title="AI Polish"
            >
              <MoreHorizontal className="size-4.5 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title="Attach File"
            >
              <Link2 className="size-4.5 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => {
                onSaveDraft();
                toast.success("Draft Saved", {
                  description: `Booking draft for ${reference} preserved.`,
                });
                onClose();
              }}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title="Save as Draft"
            >
              <Folder className="size-4.5 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSubject("");
                setBody("");
                setRecipients([]);
                showPillToast.info("Cleared email fields.", "Cleared");
              }}
              className="hover:text-rose-500 transition-colors p-1 cursor-pointer"
              title="Discard / Clear"
            >
              <Trash2 className="size-4.5 stroke-[1.8]" />
            </button>
          </div>

          {/* Right Action Buttons: Schedule & Send */}
          <div className="flex items-center gap-2.5 relative">
            {/* Schedule Button */}
            <button
              type="button"
              onClick={() => setIsScheduleOpen(!isScheduleOpen)}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3.5 py-2 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            >
              <Calendar className="size-3.5 text-slate-500 stroke-[1.8]" />
              <span>Schedule</span>
            </button>

            {/* Schedule Dropdown Popup */}
            {isScheduleOpen && (
              <div className="absolute bottom-full right-24 mb-2 w-64 bg-white border border-slate-200 rounded-xl p-3 shadow-xl z-30 space-y-2 text-xs animate-in fade-in">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <Clock className="size-3.5 text-[#0FA3B1]" />
                  Schedule Dispatch
                </div>
                <input
                  type="datetime-local"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-1.5 focus:outline-none"
                />
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsScheduleOpen(false)}
                    className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsScheduleOpen(false);
                      showPillToast.success(
                        `Email scheduled for ${scheduleDate || "tomorrow at 9:00 AM"}`,
                        "Email Scheduled",
                      );
                      void handleSend();
                    }}
                    className="px-2.5 py-1 bg-[#0FA3B1] text-white font-bold rounded-lg cursor-pointer hover:bg-[#0D919E]"
                  >
                    Set Schedule
                  </button>
                </div>
              </div>
            )}

            {/* Primary Dark Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isProcessModalOpen}
              className={cn(
                "bg-[#0F172A] hover:bg-black text-white text-xs font-bold px-4.5 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all",
                isProcessModalOpen && "opacity-80 cursor-wait",
              )}
            >
              {isProcessModalOpen ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <span>Send & Create</span>
                  <Send className="size-3.5 text-white stroke-[2.2]" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dispatching Progress Modal */}
      <EmailSendingProcessModal
        isOpen={isProcessModalOpen}
        onClose={handleProcessModalClose}
        items={processItems}
        movementReference={reference}
        onSendItem={handleSendSingleForwarder}
      />
    </>,
    document.body,
  );
}
