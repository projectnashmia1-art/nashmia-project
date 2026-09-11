import { useState, memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Send } from "lucide-react";
import type { BookingRequestRecord } from "@/types/requests";

interface RevisionRequestModalProps {
  request: BookingRequestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (requestId: string, revisionNotes: string) => Promise<void>;
}

export const RevisionRequestModal = memo(function RevisionRequestModal({
  request,
  isOpen,
  onClose,
  onConfirm,
}: RevisionRequestModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) return;

    setIsSubmitting(true);
    try {
      await onConfirm(request.id, notes.trim());
      setNotes("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-800">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[17px] font-bold text-slate-900">
                Request Shipment Revision
              </DialogTitle>
              <DialogDescription className="text-[13px] text-slate-500">
                Send feedback to {request.supplierName} regarding booking {request.reference}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-[13.5px]">
          <div className="space-y-2">
            <Label className="text-[12.5px] font-semibold text-slate-700">
              Revision Details & Requirements
            </Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Weight exceeds single container limit by 1.2 Tons. Please adjust cargo manifest or request a 2nd container."
              rows={4}
              required
              className="w-full rounded-xl border border-slate-200 p-3 text-[13px] text-slate-900 placeholder:text-slate-400 focus:border-[#0FA3B1] focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !notes.trim()}
              className="bg-amber-600 font-semibold text-white hover:bg-amber-700"
            >
              <Send className="mr-1.5 size-3.5" />
              {isSubmitting ? "Sending..." : "Submit Revision Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
