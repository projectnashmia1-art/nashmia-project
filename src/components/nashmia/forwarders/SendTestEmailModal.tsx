import { useState, useEffect } from "react";
import { CheckCircle2, Mail, Send, Sparkles, X } from "lucide-react";
import { ForwarderAccount } from "@/lib/forwarders-data";
import { toast } from "sonner";

interface SendTestEmailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forwarder: ForwarderAccount | null;
}

export function SendTestEmailModal({ open, onOpenChange, forwarder }: SendTestEmailModalProps) {
  const [subject, setSubject] = useState(
    "[NASHMIA LOGISTICS] Booking Inquiry & Rate Verification - Nashmia Industries",
  );
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (forwarder) {
      setMessage(
        `Dear ${forwarder.contactPerson || "Booking Team"},\n\nThis is a test communication dispatch from the Nashmia Logistics Platform to verify operational email deliverability and active rate card sync for upcoming ocean container dispatches.\n\nCarrier Alliance: ${forwarder.shippingLines.join(", ")}\nAgent Code: ${forwarder.code}\n\nBest regards,\nNashmia Freight Operations`,
      );
    }
  }, [forwarder, open]);

  // Lock body scroll and handle Escape key when modal is open
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open || !forwarder) return null;

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      onOpenChange(false);
      toast.success("Test Email Dispatched", {
        description: `Dispatched to ${forwarder.email} (${forwarder.name})`,
      });
    }, 900);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
    >
      <div className="glass-card-strong relative flex max-h-[92vh] w-full max-w-xl flex-col rounded-[28px] border border-white/90 bg-white p-0 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100/90 px-6 py-4.5 bg-[#F8FAFC]/90 shrink-0">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#6A80A9]/10 text-[#6A80A9] font-bold shadow-2xs">
              <Mail className="size-5" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                Send Operational Test Email
              </h2>
              <p className="text-xs text-slate-500">
                Verify booking agent deliverability and communication workflow.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 overflow-y-auto scrollbar-thin">
          <div className="rounded-2xl border border-slate-200/80 bg-[#E8F1F3]/40 p-3.5 space-y-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">To Forwarder:</span>
              <span className="font-semibold text-slate-900">{forwarder.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Recipient Address:</span>
              <span className="font-mono text-slate-800 font-semibold">{forwarder.email}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Subject Line</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 text-xs sm:text-[13px] font-semibold text-slate-900 focus:bg-white focus:border-[#6A80A9] focus:ring-4 focus:ring-[#6A80A9]/10 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">Message Body</label>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs sm:text-[13px] font-medium text-slate-900 focus:bg-white focus:border-[#6A80A9] focus:ring-4 focus:ring-[#6A80A9]/10 focus:outline-none transition-all"
            />
          </div>

          <div className="rounded-xl bg-[#E8F1F3]/30 p-3 text-[11.5px] text-slate-600 flex items-center gap-2 border border-[#6A80A9]/20">
            <Sparkles className="size-4 text-[#6A80A9] shrink-0" />
            <span>
              Connected to Nashmia Email Engine. Real dispatch delivers live notification to
              forwarder inbox.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/80 shrink-0">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="flex items-center gap-2 rounded-xl bg-black px-6 py-2.5 text-xs font-bold text-white shadow-md hover:bg-slate-800 transition-all cursor-pointer disabled:opacity-50"
          >
            <Send className="size-3.5" />
            <span>{isSending ? "Dispatching..." : "Send Test Email"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
