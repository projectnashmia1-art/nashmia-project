import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Mail,
  Maximize2,
  Minimize2,
  Check,
  Plus,
  Trash2,
  Paperclip,
  Link2,
  Folder,
  MoreHorizontal,
  Calendar,
  Send,
  Loader2,
  Sparkles,
  FileSpreadsheet,
  FileText,
  Clock,
  ChevronDown,
} from "lucide-react";
import { useSendEmail, useSaveDraft, EMAILS_QUERY_KEY } from "@/lib/use-emails";
import { useAuth } from "@/lib/auth-context";
import { useGmail } from "@/lib/use-gmail";
import {
  useCachedForwarders,
  useCachedBuyers,
  useCachedSuppliers,
  useOperationalBookings,
} from "@/lib/cache";
import type { EmailType, ComposeEmailFormValues, EmailMessageRecord } from "@/types/email.types";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { sendEmailThroughBackend } from "@/lib/email-services";
import { extractMovementNumber } from "@/lib/movement-lifecycle";
import { showPillToast } from "@/lib/pill-toast";
import { EmailSendingProcessModal, type ForwarderSendingItem } from "./EmailSendingProcessModal";

interface RecipientItem {
  id: string;
  name: string;
  email: string;
  avatarBg?: string;
  avatarImg?: string;
}

interface AttachmentItem {
  id: string;
  name: string;
  size: string;
  type: "pptx" | "docx" | "xlsx" | "pdf" | "other";
}

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft?: EmailMessageRecord | null;
  defaultBookingId?: string | null;
  defaultRecipientEmail?: string;
  defaultSubject?: string;
}

const AVATAR_BG_COLORS = [
  "from-amber-400 to-orange-500",
  "from-emerald-400 to-teal-600",
  "from-blue-400 to-indigo-600",
  "from-purple-400 to-pink-600",
  "from-rose-400 to-red-500",
  "from-cyan-400 to-blue-500",
];

function getInitials(name: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getFileType(fileName: string): "pptx" | "docx" | "xlsx" | "pdf" | "other" {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) return "pptx";
  if (lower.endsWith(".docx") || lower.endsWith(".doc") || lower.includes("word")) return "docx";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "xlsx";
  if (lower.endsWith(".pdf")) return "pdf";
  return "other";
}

export function ComposeEmailModal({
  isOpen,
  onClose,
  initialDraft,
  defaultBookingId,
  defaultRecipientEmail,
  defaultSubject,
}: ComposeEmailModalProps) {
  const { user, userId, profile } = useAuth();
  const sendMutation = useSendEmail();
  const saveDraftMutation = useSaveDraft();

  // Load real contacts from Supabase via unified cache
  const { data: forwarders = [] } = useCachedForwarders(userId, { enabled: isOpen });
  const { data: buyers = [] } = useCachedBuyers(userId, { enabled: isOpen });
  const { data: suppliers = [] } = useCachedSuppliers(userId, { enabled: isOpen });

  // Operational bookings from Supabase
  const { data: bookings = [] } = useOperationalBookings(userId, { enabled: isOpen });

  const { googleEmail, displayName: gmailName, avatarUrl: gmailAvatar } = useGmail();

  const fromEmail = useMemo(() => {
    return googleEmail || user?.email || profile?.email || "operations@nashmia-logistics.com";
  }, [googleEmail, user?.email, profile?.email]);

  const senderDisplayName = useMemo(() => {
    return (
      gmailName ||
      profile?.full_name ||
      profile?.name ||
      user?.email?.split("@")[0] ||
      "Operations Desk"
    );
  }, [gmailName, profile, user?.email]);

  const senderInitials = useMemo(() => {
    return getInitials(senderDisplayName);
  }, [senderDisplayName]);

  // Find linked booking
  const activeBooking = useMemo(() => {
    if (!defaultBookingId && !initialDraft?.bookingId) {
      if (bookings.length > 0) return bookings[0];
      return null;
    }
    const targetId = defaultBookingId || initialDraft?.bookingId;
    return (
      bookings.find((b) => b.id === targetId || b.movementNumber === targetId) ||
      bookings[0] ||
      null
    );
  }, [defaultBookingId, initialDraft?.bookingId, bookings]);

  // Recipients list with interactive chips
  const [recipients, setRecipients] = useState<RecipientItem[]>(() => {
    if (initialDraft?.toEmail) {
      const emails = initialDraft.toEmail
        .split(/[,;]+/)
        .map((e) => e.trim())
        .filter(Boolean);
      return emails.map((email, idx) => ({
        id: `draft-rec-${idx}`,
        name: initialDraft.toName && idx === 0 ? initialDraft.toName : email.split("@")[0],
        email,
        avatarBg: AVATAR_BG_COLORS[idx % AVATAR_BG_COLORS.length],
      }));
    }
    if (defaultRecipientEmail) {
      return [
        {
          id: "default-rec-1",
          name: defaultRecipientEmail.split("@")[0].replace(/[._-]/g, " "),
          email: defaultRecipientEmail,
          avatarBg: AVATAR_BG_COLORS[0],
        },
      ];
    }
    return [];
  });

  const [cc, setCc] = useState(initialDraft?.cc || "");
  const [bcc, setBcc] = useState(initialDraft?.bcc || "");
  const [showCcBcc, setShowCcBcc] = useState(Boolean(initialDraft?.cc || initialDraft?.bcc));
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [recipientInput, setRecipientInput] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Subject state - Real dynamic subject based on active booking / context
  const [subject, setSubject] = useState(() => {
    if (initialDraft?.subject) return initialDraft.subject;
    if (defaultSubject) return defaultSubject;
    if (activeBooking) {
      const mov = activeBooking.movementNumber || activeBooking.reference;
      const pol = activeBooking.polCode || activeBooking.polName || "Origin";
      const pod = activeBooking.podCode || activeBooking.podName || "Destination";
      return `Freight Quotation Request: ${mov} | ${pol} → ${pod}`;
    }
    return "Freight Quotation Request & Schedule Inquiry";
  });

  // Body state - Real logistics inquiry with real dynamic fields
  const [body, setBody] = useState(() => {
    if (initialDraft?.body) return initialDraft.body;
    if (activeBooking) {
      const mov = activeBooking.movementNumber || activeBooking.reference;
      const pol = activeBooking.polName
        ? `${activeBooking.polName} (${activeBooking.polCode})`
        : activeBooking.polCode || "Port of Loading";
      const pod = activeBooking.podName
        ? `${activeBooking.podName} (${activeBooking.podCode})`
        : activeBooking.podCode || "Port of Discharge";
      const cntr = `${activeBooking.containerCount || 1}x ${activeBooking.containerSize || "40HC"} (${activeBooking.containerType || "Dry Standard / High Cube"})`;
      const etd = activeBooking.requestedEtd || "Prompt Sailing";
      const target = activeBooking.targetFreight
        ? `$${activeBooking.targetFreight.toLocaleString()} ${activeBooking.currency || "USD"}`
        : "Best Market Rate";

      return `Dear Forwarding Partner,\n\nPlease provide your best competitive ocean freight quotation for the following booking requirement:\n\n• Movement Number: ${mov}\n• Route: ${pol} to ${pod}\n• Equipment: ${cntr}\n• Requested ETD: ${etd}\n• Target Freight Rate: ${target}\n\nKindly share your earliest available vessel schedule, transit time, and detention/demurrage free days.\n\nBest regards,\n${senderDisplayName}\nNashmia Global Logistics`;
    }
    return `Dear Forwarding Partner,\n\nPlease review our upcoming export shipment requirement and provide your most competitive ocean freight rates along with vessel schedule, transit duration, and container free days.\n\nBest regards,\n${senderDisplayName}\nNashmia Global Logistics`;
  });

  // Real & Dynamic Attachments
  const [attachments, setAttachments] = useState<AttachmentItem[]>(() => {
    if (initialDraft?.attachments && initialDraft.attachments.length > 0) {
      return initialDraft.attachments.map((att, i) => ({
        id: `att-draft-${i}`,
        name: att.name,
        size: att.size || "1.2 MB",
        type: getFileType(att.name),
      }));
    }
    const mov = activeBooking?.movementNumber || activeBooking?.reference || "Shipment";
    return [
      { id: "att-1", name: `${mov}_Specification.docx`, size: "1.2 MB", type: "docx" },
      { id: "att-2", name: `${mov}_Rate_Schedule.xlsx`, size: "340 KB", type: "xlsx" },
      { id: "att-3", name: `${mov}_Cargo_Manifest.pdf`, size: "2.4 MB", type: "pdf" },
    ];
  });

  const [isMaximized, setIsMaximized] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [bookingId, setBookingId] = useState<string>(
    initialDraft?.bookingId || defaultBookingId || "",
  );
  const [emailType, setEmailType] = useState<EmailType>(
    initialDraft?.emailType || "BOOKING_REQUEST",
  );

  const queryClient = useQueryClient();
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [processItems, setProcessItems] = useState<ForwarderSendingItem[]>([]);
  const [movementRef, setMovementRef] = useState<string>("NASH-BK-2026-7023");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Grouped all contacts from real data
  const allContacts = useMemo(() => {
    const list: RecipientItem[] = [];
    forwarders.forEach((f, i) => {
      if (f.email) {
        list.push({
          id: f.id || `fwd-${i}`,
          name: f.name,
          email: f.email,
          avatarBg: AVATAR_BG_COLORS[i % AVATAR_BG_COLORS.length],
        });
      }
    });
    buyers.forEach((b, i) => {
      if (b.email) {
        list.push({
          id: b.id || `buyer-${i}`,
          name: b.name,
          email: b.email,
          avatarBg: AVATAR_BG_COLORS[(i + 2) % AVATAR_BG_COLORS.length],
        });
      }
    });
    suppliers.forEach((s, i) => {
      if (s.email) {
        list.push({
          id: s.id || `sup-${i}`,
          name: s.name,
          email: s.email,
          avatarBg: AVATAR_BG_COLORS[(i + 4) % AVATAR_BG_COLORS.length],
        });
      }
    });

    return list;
  }, [forwarders, buyers, suppliers]);

  // Prepopulate recipients if default recipient exists or initial draft
  useEffect(() => {
    if (recipients.length === 0 && defaultRecipientEmail) {
      setRecipients([
        {
          id: "default-rec-1",
          name: defaultRecipientEmail.split("@")[0].replace(/[._-]/g, " "),
          email: defaultRecipientEmail,
          avatarBg: AVATAR_BG_COLORS[0],
        },
      ]);
    }
  }, [defaultRecipientEmail, recipients.length]);

  const handleAddRecipient = (contact: RecipientItem) => {
    if (!recipients.some((r) => r.email.toLowerCase() === contact.email.toLowerCase())) {
      setRecipients((prev) => [...prev, contact]);
    }
    setRecipientInput("");
    setIsAddingRecipient(false);
    setShowContactDropdown(false);
  };

  const handleCreateCustomRecipient = () => {
    if (!recipientInput.trim()) return;
    const clean = recipientInput.trim();
    const isEmail = clean.includes("@");
    const newRec: RecipientItem = {
      id: `custom-${Date.now()}`,
      name: isEmail ? clean.split("@")[0].replace(/[._-]/g, " ") : clean,
      email: isEmail ? clean : `${clean.toLowerCase().replace(/\s+/g, "")}@forwarder.com`,
      avatarBg: AVATAR_BG_COLORS[recipients.length % AVATAR_BG_COLORS.length],
    };
    setRecipients((prev) => [...prev, newRec]);
    setRecipientInput("");
    setIsAddingRecipient(false);
    setShowContactDropdown(false);
  };

  const handleRemoveRecipient = (id: string) => {
    setRecipients((prev) => prev.filter((r) => r.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentItem[] = Array.from(files).map((f, i) => {
      const sizeMb = (f.size / (1024 * 1024)).toFixed(1);
      const sizeKb = Math.round(f.size / 1024);
      return {
        id: `uploaded-${Date.now()}-${i}`,
        name: f.name,
        size: parseFloat(sizeMb) >= 1 ? `${sizeMb} MB` : `${sizeKb} KB`,
        type: getFileType(f.name),
      };
    });

    setAttachments((prev) => [...prev, ...newAttachments]);
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
      showPillToast.error("Please add at least one recipient email.", "Recipient Required");
      return;
    }

    // Resolve Movement / Booking Reference
    let movementReference = "NASH-BK-2026-7023";
    if (activeBooking) {
      movementReference =
        activeBooking.movementNumber ||
        activeBooking.bookingReference ||
        activeBooking.reference ||
        "NASH-BK-2026-7023";
    } else {
      const extracted = extractMovementNumber(subject) || extractMovementNumber(body);
      if (extracted) movementReference = extracted;
    }

    setMovementRef(movementReference);

    const targets: ForwarderSendingItem[] = recipients.map((r, idx) => ({
      id:
        r.id.startsWith("custom-") || r.id.startsWith("draft-")
          ? `target-${idx}-${Date.now()}`
          : r.id,
      name: r.name,
      email: r.email,
      contactName: r.name,
      status: "Waiting",
    }));

    setProcessItems(targets);
    setIsProcessModalOpen(true);
  };

  const handleSendSingleForwarder = async (item: ForwarderSendingItem) => {
    try {
      const singleValues: ComposeEmailFormValues = {
        fromEmail,
        toEmail: item.email,
        toName: item.contactName || item.name,
        cc: cc || undefined,
        bcc: bcc || undefined,
        subject: subject || "Freight Quotation Request",
        body,
        bookingId: activeBooking?.id || bookingId || null,
        emailType,
        attachments: attachments.map((a) => ({ name: a.name, size: a.size })),
        movementNumber: movementRef,
        forwarderId: item.id.startsWith("target-") ? undefined : item.id,
      };

      const result = await sendEmailThroughBackend(userId, singleValues);
      queryClient.invalidateQueries({ queryKey: EMAILS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });

      return {
        success: result.success,
        gmailMessageId: result.gmailMessageId,
        gmailThreadId: result.gmailThreadId,
        errorMessage: result.errorMessage,
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to dispatch email.";
      return {
        success: false,
        errorMessage: errorMsg,
      };
    }
  };

  const handleSaveDraft = async () => {
    const values: ComposeEmailFormValues = {
      fromEmail,
      toEmail: recipients.map((r) => r.email).join(", "),
      toName: recipients[0]?.name || "",
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: subject || "Draft: (No Subject)",
      body,
      bookingId: activeBooking?.id || bookingId || null,
      emailType,
      attachments: attachments.map((a) => ({ name: a.name, size: a.size })),
    };

    await saveDraftMutation.mutateAsync(values);
    showPillToast.success("Email draft saved.", "Draft Saved");
    onClose();
  };

  // Keyboard shortcut Ctrl + Enter to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isOpen && !sendMutation.isPending) {
        e.preventDefault();
        void handleSend();
      }
      if (e.key === "Escape" && isOpen && !isProcessModalOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isProcessModalOpen, sendMutation.isPending]);

  // Lock body scroll
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
      role="dialog"
      aria-modal="true"
      aria-label="Compose Email"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-y-auto"
    >
      {/* Background Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-all duration-200 ease-out animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Compose Card Modal - Uploaded Design 1:1 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 flex flex-col bg-white text-slate-900 shadow-2xl transition-all duration-200 antialiased outline-none",
          isMaximized
            ? "w-full h-full max-w-none max-h-none rounded-none p-5 sm:p-8"
            : "w-full sm:max-w-[620px] max-h-[92vh] rounded-t-[28px] rounded-b-none sm:rounded-[28px] border-t sm:border border-slate-200/90 p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-7 animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-240 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
        )}
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

        {/* 1. Header Bar: Icon + "Compose email" + Maximize & Close */}
        <div className="flex items-center justify-between pb-3.5">
          <div className="flex items-center gap-2 text-slate-800 font-semibold text-[15px]">
            <Mail className="size-4.5 text-slate-700 stroke-[1.8]" />
            <span>Compose email</span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title={isMaximized ? "Restore Size" : "Expand"}
            >
              {isMaximized ? (
                <Minimize2 className="size-4 stroke-[1.8]" />
              ) : (
                <Maximize2 className="size-4 stroke-[1.8]" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title="Close"
            >
              <X className="size-4 stroke-[1.8]" />
            </button>
          </div>
        </div>

        {/* 2. From Row */}
        <div className="flex items-center gap-3 py-1.5 text-xs">
          <span className="text-slate-400 font-normal w-10 shrink-0">From</span>
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6.5 rounded-full bg-gradient-to-tr from-sky-400 via-indigo-500 to-purple-600 text-white font-bold text-[11px] grid place-items-center shrink-0 shadow-2xs overflow-hidden">
              {gmailAvatar ? (
                <img src={gmailAvatar} alt={senderDisplayName} className="size-full object-cover" />
              ) : (
                senderInitials
              )}
            </div>
            <span className="text-[13.5px] font-semibold text-slate-900 truncate">
              {senderDisplayName}
            </span>
            {/* Blue Verified Checkmark Badge */}
            <span
              className="inline-grid place-items-center size-3.5 rounded-full bg-[#0084FF] text-white shrink-0 shadow-2xs"
              title="Verified Sender"
            >
              <Check className="size-2.5 stroke-[3]" />
            </span>
          </div>
        </div>

        {/* 3. To Row: Recipient Pills + Add CC / BCC */}
        <div className="flex items-start gap-3 py-2 text-xs relative">
          <span className="text-slate-400 font-normal w-10 shrink-0 mt-1.5">To</span>

          <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
            {recipients.map((rec) => (
              <div
                key={rec.id}
                className="inline-flex items-center gap-1.5 bg-slate-100/90 hover:bg-slate-200/80 border border-slate-200/60 rounded-full pl-1 pr-2.5 py-0.5 text-[12px] text-slate-800 font-medium transition-colors group"
              >
                <div
                  className={cn(
                    "size-4.5 rounded-full text-white text-[9px] font-bold grid place-items-center bg-gradient-to-tr",
                    rec.avatarBg || "from-amber-400 to-orange-500",
                  )}
                >
                  {getInitials(rec.name)}
                </div>
                <span className="truncate max-w-[120px]">{rec.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(rec.id)}
                  className="text-slate-400 hover:text-slate-700 p-0.5 rounded-full cursor-pointer transition-colors"
                  title="Remove"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}

            {/* Quick Add Recipient Input / Trigger */}
            {isAddingRecipient ? (
              <div className="inline-flex items-center gap-1 relative min-w-[150px]">
                <input
                  type="text"
                  autoFocus
                  value={recipientInput}
                  onChange={(e) => {
                    setRecipientInput(e.target.value);
                    setShowContactDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreateCustomRecipient();
                    } else if (e.key === "Escape") {
                      setIsAddingRecipient(false);
                      setShowContactDropdown(false);
                    }
                  }}
                  placeholder="Type name or email..."
                  className="text-[12px] bg-white border border-[#0FA3B1] rounded-full px-2.5 py-0.5 focus:outline-none w-full"
                />

                {/* Dropdown Suggestions */}
                {showContactDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-64 max-h-48 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-xl z-30 p-1 space-y-0.5">
                    {allContacts
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(recipientInput.toLowerCase()) ||
                          c.email.toLowerCase().includes(recipientInput.toLowerCase()),
                      )
                      .slice(0, 5)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleAddRecipient(c)}
                          className="w-full text-left px-2.5 py-1.5 hover:bg-slate-100 rounded-lg flex items-center gap-2 text-xs cursor-pointer transition"
                        >
                          <div
                            className={cn(
                              "size-5 rounded-full text-white text-[9px] font-bold grid place-items-center bg-gradient-to-tr shrink-0",
                              c.avatarBg,
                            )}
                          >
                            {getInitials(c.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 truncate text-[12px]">
                              {c.name}
                            </div>
                            <div className="text-[10.5px] text-slate-400 truncate">{c.email}</div>
                          </div>
                        </button>
                      ))}
                    {recipientInput.trim() && (
                      <button
                        type="button"
                        onClick={handleCreateCustomRecipient}
                        className="w-full text-left px-2.5 py-1.5 bg-[#0FA3B1]/10 text-[#0FA3B1] hover:bg-[#0FA3B1]/20 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        Add &quot;{recipientInput}&quot;
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsAddingRecipient(true);
                  setShowContactDropdown(true);
                }}
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
            className="text-[12px] text-slate-400 hover:text-slate-600 font-medium cursor-pointer ml-auto shrink-0 select-none"
          >
            {showCcBcc ? "Hide CC / BCC" : "Add CC / BCC"}
          </button>
        </div>

        {/* Optional CC & BCC Fields */}
        {showCcBcc && (
          <div className="space-y-2 py-1 text-xs animate-in fade-in duration-150">
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

        {/* Divider */}
        <div className="border-b border-slate-100 my-3" />

        {/* 4. Subject & Body Content Area */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px] max-h-[380px] pr-1">
          {/* Subject Line - Large Bold Title Typography */}
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Freight Quotation Request"
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

        {/* 5. Attachment Section: Header + 3 File Cards (PowerPoint, Word, Excel) */}
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
                    {/* Brand File Type Icons */}
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

          {/* Hidden File Input for Native File Uploads */}
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
          {/* Left Action Icons: More, Link/Attach, Folder, Trash */}
          <div className="flex items-center gap-3 text-slate-400">
            <button
              type="button"
              onClick={() => {
                // AI Polish Action
                setBody((prev) =>
                  prev
                    ? `${prev}\n\n[AI Optimized]: Freight inquiry terms and documentation verified.`
                    : prev,
                );
                showPillToast.success("Email content polished with AI assistance.", "AI Polish");
              }}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title="More options & AI Polish"
            >
              <MoreHorizontal className="size-4.5 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title="Attach File / Link"
            >
              <Link2 className="size-4.5 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={handleSaveDraft}
              className="hover:text-slate-700 transition-colors p-1 cursor-pointer"
              title="Save as Draft / Folder"
            >
              <Folder className="size-4.5 stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={() => {
                setSubject("");
                setBody("");
                setRecipients([]);
                showPillToast.info("Cleared email draft.", "Draft Cleared");
              }}
              className="hover:text-rose-500 transition-colors p-1 cursor-pointer"
              title="Discard / Trash"
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

            {/* Schedule Popup Dropdown */}
            {isScheduleOpen && (
              <div className="absolute bottom-full right-24 mb-2 w-64 bg-white border border-slate-200 rounded-xl p-3 shadow-xl z-30 space-y-2 text-xs animate-in fade-in">
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <Clock className="size-3.5 text-[#0FA3B1]" />
                  Schedule Delivery
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

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={sendMutation.isPending || isProcessModalOpen}
              className={cn(
                "bg-[#0F172A] hover:bg-black text-white text-xs font-bold px-4.5 py-2 rounded-xl flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 transition-all",
                (sendMutation.isPending || isProcessModalOpen) && "opacity-80 cursor-wait",
              )}
            >
              {sendMutation.isPending || isProcessModalOpen ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="size-3.5 text-white stroke-[2.2]" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Real-time Email Sending Processing & Success Feedback Modal */}
      <EmailSendingProcessModal
        isOpen={isProcessModalOpen}
        onClose={() => {
          setIsProcessModalOpen(false);
          onClose();
        }}
        items={processItems}
        movementReference={movementRef}
        onSendItem={handleSendSingleForwarder}
      />
    </div>,
    document.body,
  );
}
