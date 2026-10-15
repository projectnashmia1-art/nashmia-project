import { useState, useMemo, useEffect, memo } from "react";
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
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import type { BookingRequestRecord } from "@/types/requests";
import { useAuth } from "@/lib/auth-context";
import { useCachedForwarders } from "@/lib/cache";
import { type ForwarderAccount } from "@/lib/forwarders-data";

interface ApproveRequestModalProps {
  request: BookingRequestRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (
    requestId: string,
    details: {
      forwarderId?: string;
      forwarderName?: string;
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
  const { userId, isConfigured } = useAuth();
  const { data: cachedForwarders = [] } = useCachedForwarders(userId, { enabled: isConfigured });

  // Available forwarders from cache or database
  const availableForwarders: ForwarderAccount[] = useMemo(() => {
    return cachedForwarders || [];
  }, [cachedForwarders]);

  const [selectedForwarderId, setSelectedForwarderId] = useState<string>("");
  const [selectedForwarderName, setSelectedForwarderName] = useState<string>("");
  const [vesselName, setVesselName] = useState("");
  const [voyageNumber, setVoyageNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [notifyParties, setNotifyParties] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state whenever the modal opens or request changes
  useEffect(() => {
    if (!request) return;
    setVesselName(request.vesselName || "");
    setVoyageNumber(request.voyageNumber || "");
    setNotes("");

    if (request.forwarderId) {
      setSelectedForwarderId(request.forwarderId);
      const match = availableForwarders.find((f) => f.id === request.forwarderId);
      setSelectedForwarderName(match?.name || request.forwarderName || "");
    } else if (request.forwarderName) {
      const match = availableForwarders.find(
        (f) => f.name.toLowerCase() === request.forwarderName.toLowerCase(),
      );
      if (match) {
        setSelectedForwarderId(match.id);
        setSelectedForwarderName(match.name);
      } else {
        setSelectedForwarderId(availableForwarders[0]?.id || "");
        setSelectedForwarderName(request.forwarderName);
      }
    } else if (availableForwarders.length > 0) {
      setSelectedForwarderId(availableForwarders[0].id);
      setSelectedForwarderName(availableForwarders[0].name);
    }
  }, [request, availableForwarders]);

  const selectedForwarder = useMemo(() => {
    return availableForwarders.find(
      (f) => f.id === selectedForwarderId || f.name === selectedForwarderName,
    );
  }, [availableForwarders, selectedForwarderId, selectedForwarderName]);

  if (!request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onConfirm(request.id, {
        forwarderId: selectedForwarderId || selectedForwarder?.id,
        forwarderName: selectedForwarderName || selectedForwarder?.name,
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
      <DialogContent className="w-full sm:max-w-[460px] p-0 overflow-hidden sm:rounded-2xl bg-white shadow-xl">
        {/* Minimal Header */}
        <div className="px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-[16px] font-semibold text-slate-900 tracking-tight">
                Approve Booking
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-slate-500 mt-0.5">
                Assign allocation and confirm booking release
              </DialogDescription>
            </div>
            <span className="font-mono text-[11.5px] font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200/60">
              {request.reference}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-[13px]">
          {/* Compact Route & Cargo Summary */}
          <div className="bg-slate-50/70 border border-slate-200/70 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <div className="flex items-center gap-1.5 font-medium text-slate-900">
                <span>{request.polCode}</span>
                <ArrowRight className="size-3 text-slate-400" />
                <span>{request.podCode}</span>
              </div>
              <span className="text-slate-600 font-medium">
                {request.containerCount} × {request.containerSize}
              </span>
            </div>

            <div className="pt-1.5 border-t border-slate-200/60 grid grid-cols-2 gap-2 text-[11.5px]">
              <div>
                <span className="text-slate-400 block">Shipper</span>
                <span className="text-slate-800 font-medium truncate block">
                  {request.supplierName}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Consignee</span>
                <span className="text-slate-800 font-medium truncate block">
                  {request.buyerName}
                </span>
              </div>
            </div>
          </div>

          {/* Forwarder Select */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="forwarder-select" className="text-[12px] font-medium text-slate-700">
                Forwarder / Agent
              </Label>
              {selectedForwarder?.email && (
                <span className="text-[11px] text-slate-400 truncate max-w-[200px]">
                  {selectedForwarder.email}
                </span>
              )}
            </div>

            <LifecycleDropdownSelect
              value={selectedForwarderId}
              onChange={(val) => {
                setSelectedForwarderId(val);
                const matched = availableForwarders.find((f) => f.id === val);
                if (matched) {
                  setSelectedForwarderName(matched.name);
                }
              }}
              options={availableForwarders.map((fwd) => ({
                value: fwd.id,
                label: `${fwd.name} ${fwd.code ? `(${fwd.code})` : ""}`,
              }))}
              placeholder="Select Forwarder"
              size="sm"
              activeColor="teal"
              triggerClassName="w-full h-9.5 text-[12.5px]"
            />
          </div>

          {/* Vessel & Voyage Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-slate-700">Vessel</Label>
              <Input
                value={vesselName}
                onChange={(e) => setVesselName(e.target.value)}
                placeholder="e.g. MSC ADRIANA"
                className="h-9 text-[12.5px] bg-white border-slate-200"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-slate-700">Voyage / Flight #</Label>
              <Input
                value={voyageNumber}
                onChange={(e) => setVoyageNumber(e.target.value)}
                placeholder="e.g. 431W"
                className="h-9 text-[12.5px] bg-white border-slate-200"
                required
              />
            </div>
          </div>

          {/* Operational Notes */}
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-slate-700">
              Notes <span className="text-slate-400 font-normal">(Optional)</span>
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Space confirmed, gate-in open"
              className="h-9 text-[12.5px] bg-white border-slate-200"
            />
          </div>

          {/* Notification Checkbox */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="checkbox"
              id="notify-parties"
              checked={notifyParties}
              onChange={(e) => setNotifyParties(e.target.checked)}
              className="size-3.5 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
            />
            <label
              htmlFor="notify-parties"
              className="text-[12px] text-slate-600 cursor-pointer select-none"
            >
              Notify shipper & forwarder via email
            </label>
          </div>

          {/* Minimal Footer */}
          <DialogFooter className="gap-2 pt-2 border-t border-slate-100 mt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-3.5 text-[12.5px] text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 px-4 text-[12.5px] font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  Confirming...
                </>
              ) : (
                <>
                  <Check className="mr-1.5 size-3.5" />
                  Confirm Release
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
