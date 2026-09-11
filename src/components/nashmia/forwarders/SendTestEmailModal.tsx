import { useState } from "react";
import { CheckCircle2, Mail, Send, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [message, setMessage] = useState(
    `Dear ${forwarder?.contactPerson || "Booking Team"},\n\nThis is a test communication dispatch from the Nashmia Logistics Platform to verify operational email deliverability and active rate card sync for upcoming Q3 ocean container dispatches.\n\nBest regards,\nNashmia Freight Operations`,
  );
  const [isSending, setIsSending] = useState(false);

  if (!forwarder) return null;

  const handleSend = () => {
    setIsSending(true);
    setTimeout(() => {
      setIsSending(false);
      onOpenChange(false);
      toast.success("Test Email Dispatched", {
        description: `Dispatched to ${forwarder.email} (${forwarder.name})`,
      });
    }, 1000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl rounded-[24px] border border-white/80 bg-white/95 p-0 shadow-[0_24px_64px_rgba(15,23,42,0.14)] backdrop-blur-2xl sm:max-w-[560px] overflow-hidden">
        <div className="border-b border-slate-100/80 px-6 py-5">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-[10px] bg-[#E8F1F3] text-[#6A80A9]">
                <Mail className="size-4" />
              </span>
              <DialogTitle className="text-[20px] font-semibold tracking-[-0.02em] text-[#000000]">
                Send Test Email
              </DialogTitle>
            </div>
            <DialogDescription className="text-[13px] text-slate-500 mt-1">
              Verify booking agent deliverability and communication workflow.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-[14px] border border-slate-200/80 bg-[#E8F1F3]/40 p-3.5 space-y-2 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">To Forwarder:</span>
              <span className="font-semibold text-black">{forwarder.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Recipient:</span>
              <span className="font-mono text-slate-800">{forwarder.email}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-[#000000]">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-[44px] w-full rounded-[12px] border border-slate-200 bg-white/80 px-3.5 text-[13.5px] text-black focus:border-[#6A80A9] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12.5px] font-semibold text-[#000000]">Message</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full rounded-[12px] border border-slate-200 bg-white/80 p-3 text-[13px] text-black focus:border-[#6A80A9] focus:outline-none"
            />
          </div>

          <div className="rounded-[10px] bg-slate-50 p-2.5 text-[11.5px] text-slate-500 flex items-center gap-1.5 border border-slate-200/60">
            <Sparkles className="size-3.5 text-[#6A80A9]" />
            <span>
              Frontend simulation ready. OAuth Google Workspace / Gmail API integration supported.
            </span>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-[42px] rounded-[12px] border border-slate-200 bg-white px-5 text-[13.5px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="flex h-[42px] items-center gap-2 rounded-[12px] bg-[#000000] px-6 text-[13.5px] font-medium text-[#FFFFFF] shadow-md hover:bg-slate-900 transition-all"
          >
            <Send className="size-3.5" />
            <span>{isSending ? "Dispatching..." : "Dispatch Test Email"}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
