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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Ship, Calendar, ShieldCheck, Mail } from "lucide-react";
import type { BookingRequestRecord } from "@/types/requests";

interface ApproveRequestModalProps {
  request: BookingRequestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    requestId: string,
    details: {
      vesselName?: string;
      voyageNumber?: string;
      notes?: string;
      notifyParties?: boolean;
    },
  ) => Promise<void>;
}

export const ApproveRequestModal = memo(function ApproveRequestModal({
  request,
  isOpen,
  onClose,
  onConfirm,
}: ApproveRequestModalProps) {
  const [vesselName, setVesselName] = useState(request?.vesselName || "");
  const [voyageNumber, setVoyageNumber] = useState(request?.voyageNumber || "");
  const [notes, setNotes] = useState("");
  const [notifyParties, setNotifyParties] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(request.id, {
        vesselName,
        voyageNumber,
        notes,
        notifyParties,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[17px] font-bold text-slate-900">
                Approve & Release Booking
              </DialogTitle>
              <DialogDescription className="text-[13px] text-slate-500">
                Confirm reference{" "}
                <strong className="font-mono text-slate-800">{request.reference}</strong> and issue
                booking order.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-[13.5px]">
          {/* Quick Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Shipper:</span>
              <span className="font-bold text-slate-900">{request.supplierName}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Consignee:</span>
              <span className="font-bold text-slate-900">{request.buyerName}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Route:</span>
              <span className="font-bold text-[#0FA3B1]">
                {request.polCode} → {request.podCode} ({request.containerCount}x{" "}
                {request.containerSize})
              </span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span className="font-medium">Total Freight:</span>
              <span className="font-bold text-slate-900">
                ${request.totalFreight.toLocaleString()} {request.currency}
              </span>
            </div>
          </div>

          {/* Carrier & Vessel Assignment */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-slate-700">Vessel Name</Label>
              <Input
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder="e.g. MSC ADRIANA"
                className="h-9.5 text-[13px]"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12.5px] font-semibold text-slate-700">
                Voyage / Flight #
              </Label>
              <Input
                value={voyageNumber}
                onChange={(e) => setVoyageNumber(e.target.value)}
                placeholder="e.g. 431W"
                className="h-9.5 text-[13px]"
                required
              />
            </div>
          </div>

          {/* Operational Notes */}
          <div className="space-y-1.5">
            <Label className="text-[12.5px] font-semibold text-slate-700">
              Operational Notes (Optional)
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Space confirmed with MSC line desk. Equipment release ready."
              className="h-9.5 text-[13px]"
            />
          </div>

          {/* Email Notification Option */}
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-3">
            <input
              type="checkbox"
              id="notify-parties"
              checked={notifyParties}
              onChange={(e) => setNotifyParties(e.target.checked)}
              className="size-4 rounded border-slate-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
            />
            <label
              htmlFor="notify-parties"
              className="text-[12.5px] font-medium text-slate-700 cursor-pointer"
            >
              Send automated confirmation email to shipper ({request.requestedBy.email}) & forwarder
            </label>
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
              disabled={isSubmitting}
              className="bg-[#0FA3B1] font-semibold text-white hover:bg-[#0D919E]"
            >
              <CheckCircle2 className="mr-1.5 size-4" />
              {isSubmitting ? "Confirming..." : "Confirm & Release Booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
