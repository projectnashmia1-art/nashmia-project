import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  Loader2,
  Receipt,
  RotateCcw,
  Sparkles,
  X,
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
import { cn } from "@/lib/utils";

interface SubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  reference: string;
  buyer: BuyerAccount | null;
  supplier: SupplierVendor | null;
  pol: Port | null;
  pod: Port | null;
  shippingLine: ShippingLine | null;
  bookingAgent: BookingAgent | null;
  containerSize: ContainerSize;
  quantity: number;
  loadingDate: string;
  matchedRate: RateCard | null;
  onReset: () => void;
  onViewMovement: () => void;
}

const STAGES = [
  "Creating Movement Record",
  "Generating Immutable Reference",
  "Matching Commercial Rate Card",
  "Preparing Booking Request EDI",
  "Booking Created Successfully",
];

export function SubmissionModal({
  isOpen,
  onClose,
  reference,
  buyer,
  supplier,
  pol,
  pod,
  shippingLine,
  bookingAgent,
  containerSize,
  quantity,
  loadingDate,
  matchedRate,
  onReset,
  onViewMovement,
}: SubmissionModalProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStageIndex(0);
      setIsCompleted(false);
      return;
    }

    // Step through the processing stages
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < STAGES.length - 1) {
        setCurrentStageIndex(step);
      } else {
        setCurrentStageIndex(STAGES.length - 1);
        setIsCompleted(true);
        clearInterval(interval);
      }
    }, 450);

    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyRef = () => {
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalFreight = matchedRate ? matchedRate.ratePerContainer * quantity : 4200;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="glass-card-strong relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/95 p-6 sm:p-8 shadow-[0_25px_70px_rgba(15,23,42,0.18)] animate-in zoom-in-95 duration-300">
        {/* Top ambient highlight */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-48 rounded-full bg-[#6A80A9]/20 blur-3xl" />

        {/* Processing State */}
        {!isCompleted ? (
          <div className="space-y-6 text-center py-4">
            <div className="relative mx-auto flex size-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#6A80A9]/20 to-[#C7D5BF]/30 shadow-inner">
              <Loader2 className="size-8 text-[#6A80A9] animate-spin" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-bold tracking-tight text-black">
                Processing Booking Request
              </h3>
              <p className="text-xs text-slate-500">
                Registering container movement in Nashmia Logistics Platform
              </p>
            </div>

            {/* Stages Sequence */}
            <div className="space-y-2.5 rounded-2xl border border-white/80 bg-white/60 p-4 text-left shadow-sm">
              {STAGES.slice(0, 4).map((stage, idx) => {
                const isPast = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;

                return (
                  <div key={stage} className="flex items-center gap-3 text-xs">
                    <div
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-[10px] font-bold transition-all",
                        isPast && "bg-[#C7D5BF] text-[#2D3C26]",
                        isCurrent && "bg-[#6A80A9] text-white animate-pulse",
                        !isPast && !isCurrent && "bg-slate-100 text-slate-400",
                      )}
                    >
                      {isPast ? <Check className="size-3 stroke-[2.5]" /> : idx + 1}
                    </div>
                    <span
                      className={cn(
                        "transition-colors",
                        isPast && "text-slate-700 font-medium",
                        isCurrent && "text-black font-semibold",
                        !isPast && !isCurrent && "text-slate-400",
                      )}
                    >
                      {stage}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Completed Success State */
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* Header Badge */}
            <div className="text-center space-y-1.5">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-sm ring-4 ring-emerald-100/60">
                <CheckCircle2 className="size-8 stroke-[2.2]" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-black">Booking Created</h3>
              <p className="text-xs text-slate-500">
                Movement successfully initialized and prepared for forwarder transmission.
              </p>
            </div>

            {/* Reference & Status Bar */}
            <div className="rounded-[20px] border border-[#C7D5BF] bg-gradient-to-r from-[#C7D5BF]/25 via-white/90 to-[#E8F1F3]/40 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Generated Movement Ref
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black font-mono tracking-tight text-black">
                      {reference}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyRef}
                      className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-black"
                    >
                      {copied ? (
                        <Check className="size-4 text-emerald-600" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Lifecycle Status
                  </span>
                  <p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#6A80A9]/30 bg-[#6A80A9]/15 px-2.5 py-0.5 text-xs font-bold text-[#6A80A9]">
                      <Sparkles className="size-3" />
                      Booking Requested
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Summary Highlights */}
            <div className="rounded-2xl border border-slate-100 bg-white/80 p-4 text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Buyer</span>
                <span className="font-semibold text-black">{buyer?.name ?? "New Henna"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Pickup Supplier</span>
                <span className="font-semibold text-black">{supplier?.name ?? "UK Supplier"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Load Point</span>
                <span className="font-semibold text-black">
                  {supplier?.loadPoint ?? "London Warehouse"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Route & Carrier</span>
                <span className="font-semibold text-black">
                  {pol?.code ?? "FXT"} → {pod?.code ?? "KHI"} • {shippingLine?.name ?? "MSC"}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Equipment</span>
                <span className="font-semibold text-black">
                  {containerSize} × {quantity}
                </span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span className="text-slate-500">Agreed Rate</span>
                <span className="font-bold text-black">${totalFreight.toLocaleString()} USD</span>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={onViewMovement}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black font-semibold text-white transition-all hover:bg-slate-800"
              >
                <span>View Movement</span>
                <ArrowRight className="size-4" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onReset}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <RotateCcw className="size-3.5" />
                  <span>Create Another</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <FileCheck2 className="size-3.5" />
                  <span>Close</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
