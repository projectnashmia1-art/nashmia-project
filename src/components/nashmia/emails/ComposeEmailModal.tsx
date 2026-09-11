import { useState, useMemo, useEffect, useRef } from "react";
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
} from "lucide-react";
import { useSendEmail, useSaveDraft } from "@/lib/use-emails";
import { useAuth } from "@/lib/auth-context";
import { useGmail } from "@/lib/use-gmail";
import { useQuery } from "@tanstack/react-query";
import {
  fetchForwardersFromSupabase,
  fetchBuyersFromSupabase,
  fetchSuppliersFromSupabase,
  fetchBookingsFromSupabase,
} from "@/lib/supabase-services";
import type { EmailType, ComposeEmailFormValues, EmailMessageRecord } from "@/types/email.types";
import { cn } from "@/lib/utils";

interface ComposeEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDraft?: EmailMessageRecord | null;
  defaultBookingId?: string | null;
  defaultRecipientEmail?: string;
  defaultSubject?: string;
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

  // Load existing contacts for quick selection
  const { data: forwarders = [] } = useQuery({
    queryKey: ["forwarders", userId],
    queryFn: () => fetchForwardersFromSupabase(userId),
    enabled: isOpen,
  });

  const { data: buyers = [] } = useQuery({
    queryKey: ["buyers", userId],
    queryFn: () => fetchBuyersFromSupabase(userId),
    enabled: isOpen,
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers", userId],
    queryFn: () => fetchSuppliersFromSupabase(userId),
    enabled: isOpen,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings", userId],
    queryFn: () => fetchBookingsFromSupabase(userId),
    enabled: isOpen,
  });

  const { googleEmail, displayName: gmailName, avatarUrl: gmailAvatar } = useGmail();

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

  const [toEmail, setToEmail] = useState(initialDraft?.toEmail || defaultRecipientEmail || "");
  const [toName, setToName] = useState(initialDraft?.toName || "");
  const [cc, setCc] = useState(initialDraft?.cc || "");
  const [bcc, setBcc] = useState(initialDraft?.bcc || "");
  const [showCc, setShowCc] = useState(Boolean(initialDraft?.cc));
  const [showBcc, setShowBcc] = useState(Boolean(initialDraft?.bcc));
  const [subject, setSubject] = useState(initialDraft?.subject || defaultSubject || "");
  const [body, setBody] = useState(initialDraft?.body || "");
  const [bookingId, setBookingId] = useState<string>(
    initialDraft?.bookingId || defaultBookingId || "",
  );
  const [emailType, setEmailType] = useState<EmailType>(
    initialDraft?.emailType || "BOOKING_REQUEST",
  );
  const [attachments, setAttachments] = useState<Array<{ name: string; size: string }>>(
    initialDraft?.attachments || [],
  );
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedFont, setSelectedFont] = useState("Inter");
  const [selectedFontSize, setSelectedFontSize] = useState("14");
  const [showFontMenu, setShowFontMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);

  // Grouped contact suggestions
  const allContacts = useMemo(() => {
    const list: Array<{
      name: string;
      email: string;
      type: "Forwarder" | "Buyer" | "Supplier";
      id: string;
    }> = [];
    forwarders.forEach((f) => {
      if (f.email) list.push({ name: f.name, email: f.email, type: "Forwarder", id: f.id });
    });
    buyers.forEach((b) => {
      if (b.email) list.push({ name: b.name, email: b.email, type: "Buyer", id: b.id });
    });
    suppliers.forEach((s) => {
      if (s.email) list.push({ name: s.name, email: s.email, type: "Supplier", id: s.id });
    });
    return list;
  }, [forwarders, buyers, suppliers]);

  const handleSendRef = useRef<() => void>(() => {});

  const handleSelectContact = (contact: { name: string; email: string; id: string }) => {
    setToEmail(contact.email);
    setToName(contact.name);
    setShowContactPicker(false);
  };

  const handleSend = async () => {
    if (!toEmail) return;

    const values: ComposeEmailFormValues = {
      fromEmail,
      toEmail,
      toName,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: subject || "Logistics Correspondence",
      body,
      bookingId: bookingId || null,
      emailType,
      attachments,
    };

    await sendMutation.mutateAsync(values);
    onClose();
  };

  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // Keyboard shortcut Ctrl + Enter to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isOpen && !sendMutation.isPending) {
        e.preventDefault();
        handleSendRef.current();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, sendMutation.isPending]);

  if (!isOpen) return null;

  const handleSaveDraft = async () => {
    const values: ComposeEmailFormValues = {
      fromEmail,
      toEmail,
      toName,
      cc: cc || undefined,
      bcc: bcc || undefined,
      subject: subject || "Draft: (No Subject)",
      body,
      bookingId: bookingId || null,
      emailType,
      attachments,
    };

    await saveDraftMutation.mutateAsync(values);
    onClose();
  };

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
            <div className="flex size-12 items-center justify-center rounded-full bg-[#E8F1F3] text-[#24828E]">
              <Mail className="size-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-[21px] font-bold tracking-tight text-slate-900 leading-snug">
                {initialDraft ? "Edit Email" : "New Email"}
              </h2>
              <p className="text-[14px] text-slate-500 leading-tight">
                Compose and send your email
              </p>
            </div>
          </div>

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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 relative">
            <span className="w-24 sm:w-28 shrink-0 text-[14.5px] font-semibold text-slate-900">
              To
            </span>
            <div className="flex-1 flex items-center justify-between min-h-[56px] rounded-[20px] border border-[rgba(106,128,169,0.16)] bg-white px-4 py-2 transition-all focus-within:border-[#6A80A9]">
              <input
                type="text"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="Add recipient(s)"
                className="w-full bg-transparent text-[14px] font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none"
              />
              <div className="flex items-center gap-3 shrink-0 text-slate-500 pl-2">
                <button
                  type="button"
                  onClick={() => setShowContactPicker(!showContactPicker)}
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

            {/* Quick Contact Picker dropdown */}
            {showContactPicker && allContacts.length > 0 && (
              <div className="absolute top-full right-0 mt-2 w-80 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-30 space-y-1 animate-in fade-in">
                <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Select Partner Contact
                </div>
                {allContacts.map((c) => (
                  <button
                    key={`${c.type}-${c.id}`}
                    type="button"
                    onClick={() => handleSelectContact(c)}
                    className="w-full text-left p-2 rounded-xl hover:bg-slate-100 flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">{c.name}</div>
                      <div className="text-[11px] text-slate-400">{c.email}</div>
                    </div>
                    <span className="text-[10px] font-semibold bg-[#E8F1F3] text-[#24828E] px-2 py-0.5 rounded-md">
                      {c.type}
                    </span>
                  </button>
                ))}
              </div>
            )}
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
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
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
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
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
                className="text-[#24828E] hover:text-[#147D8A] transition-colors p-1"
                title="AI Assist"
              >
                <Sparkles className="size-5 stroke-[2]" />
              </button>
            </div>
          </div>
        </div>

        {/* MESSAGE EDITOR */}
        <div className="rounded-[22px] border border-[rgba(106,128,169,0.14)] bg-white overflow-hidden flex flex-col mt-1">
          {/* RICH TEXT TOOLBAR */}
          <div className="flex flex-wrap items-center h-[58px] border-b border-slate-100/90 px-4 gap-1 sm:gap-2 bg-white select-none">
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

            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

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

            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

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

            <div className="h-5 w-px bg-slate-200 mx-1 shrink-0" />

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

          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="w-full min-h-[260px] p-5 text-[14px] font-normal text-slate-800 leading-relaxed placeholder:text-slate-400 focus:outline-none resize-none bg-white"
          />
        </div>

        {/* BOTTOM ACTION AREA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-5">
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

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saveDraftMutation.isPending}
              className="h-12 px-6 rounded-[15px] border border-[rgba(106,128,169,0.16)] bg-white text-[14px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Save Draft
            </button>

            <button
              type="button"
              onClick={handleSend}
              disabled={sendMutation.isPending}
              className={cn(
                "h-12 px-7 min-w-[200px] rounded-[15px] text-[14.5px] font-semibold text-white transition-all flex items-center justify-center gap-2.5 shadow-md",
                sendMutation.isPending
                  ? "bg-slate-700 cursor-wait"
                  : "bg-[#000000] hover:bg-slate-800 active:scale-[0.99]",
              )}
            >
              {sendMutation.isPending ? (
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

        {/* BOTTOM TIP CONTAINER */}
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
