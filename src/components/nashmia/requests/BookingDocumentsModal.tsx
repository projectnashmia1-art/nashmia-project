import { memo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  X,
  FileSpreadsheet,
  FileImage,
  File,
  Loader2,
  Plus,
} from "lucide-react";
import { showPillToast } from "@/lib/pill-toast";
import type { BookingRequestRecord } from "@/types/requests";
import {
  useMovementDocuments,
  viewDocumentInNewTab,
  downloadDocumentFile,
  type MovementLinkedDocument,
} from "@/lib/movement-document-service";

interface BookingDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: BookingRequestRecord | null;
  onDownloadPdf?: () => void;
}

export const BookingDocumentsModal = memo(function BookingDocumentsModal({
  isOpen,
  onClose,
  request,
  onDownloadPdf,
}: BookingDocumentsModalProps) {
  const movementNumber =
    request?.movementNumber ||
    request?.confirmationDetails?.movement_number ||
    request?.bookingReference ||
    request?.reference ||
    "NASH-BK";

  const bookingId = request?.id || null;

  const forwarderName =
    request?.confirmationDetails?.confirmed_forwarder_name ||
    request?.forwarderName ||
    "Contracted Freight Forwarder";

  // Real-time live documents from Supabase booking_documents
  const { documents, isLoading, refreshDocuments } = useMovementDocuments(
    movementNumber,
    bookingId,
  );

  if (!isOpen || !request) return null;

  const renderDocIcon = (ext: string) => {
    const e = ext.toLowerCase();
    if (["xlsx", "xls", "csv"].includes(e)) {
      return <FileSpreadsheet className="size-5 text-emerald-600" />;
    }
    if (["png", "jpg", "jpeg", "webp"].includes(e)) {
      return <FileImage className="size-5 text-indigo-600" />;
    }
    if (e === "pdf") {
      return <FileText className="size-5 text-red-500" />;
    }
    return <File className="size-5 text-[#009EE2]" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="w-full sm:max-w-[560px] max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-[24px] bg-white shadow-2xl focus:outline-none border-0 text-slate-900"
      >
        {/* Floating Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-20 flex size-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-700 active:scale-95 cursor-pointer shadow-2xs"
        >
          <X className="size-4 stroke-[2.5]" />
        </button>

        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 pb-3 sm:pb-4 border-b border-slate-100 shrink-0 bg-white space-y-1.5 text-left pr-10">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5F6] px-3 py-1 text-[11px] font-bold text-[#0FA3B1] w-fit">
            <span className="size-1.5 rounded-full bg-[#0FA3B1]" />
            Movement {movementNumber}
          </div>
          <DialogTitle className="text-xl font-extrabold tracking-tight text-[#0D1F3C]">
            Movement Verified Documents
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-[13px] font-medium text-slate-500">
            Confirmed shipment documentation, cargo manifests, and official booking slips on file.
          </DialogDescription>
        </DialogHeader>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-3 [scrollbar-width:thin]">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
              <span>
                Booking confirmed with <strong>{forwarderName}</strong>
              </span>
            </div>
            <span className="font-mono text-[11px] text-emerald-700 font-bold bg-white px-2 py-0.5 rounded-md border border-emerald-200">
              CONFIRMED
            </span>
          </div>

          {/* Official Booking Confirmation Slip Card (if onDownloadPdf is present) */}
          {onDownloadPdf && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3.5 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-xl bg-blue-100 text-blue-600 grid place-items-center shrink-0 border border-blue-200/60">
                  <FileText className="size-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[13px] font-bold text-slate-900 truncate">
                    Booking Confirmation Receipt & Manifest
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                    <span>PDF Document</span>
                    <span>·</span>
                    <span className="text-emerald-700 font-medium">Verified & Issued</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onDownloadPdf}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#009EE2] hover:bg-[#0089c7] px-3 text-xs font-bold text-white shadow-xs cursor-pointer active:scale-95 transition-all shrink-0"
              >
                <Download className="size-3.5" />
                <span>Download</span>
              </button>
            </div>
          )}

          {/* Live Supabase Documents for this movement */}
          {isLoading ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="size-5 animate-spin text-blue-600" />
              <span className="text-xs">Loading movement documents...</span>
            </div>
          ) : documents.length === 0 && !onDownloadPdf ? (
            <div className="py-10 text-center px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
              <FileText className="size-8 mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">No documents linked yet</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                Documents uploaded and associated with Movement <strong>{movementNumber}</strong>{" "}
                will automatically synchronize and display here.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {documents.map((doc: MovementLinkedDocument) => (
                <div
                  key={doc.id}
                  className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs hover:border-[#0FA3B1]/40 transition-all flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-xl bg-slate-100 text-slate-700 grid place-items-center shrink-0 border border-slate-200/60">
                      {renderDocIcon(doc.extension)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-[13px] font-bold text-slate-900 truncate">
                        {doc.documentName}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="font-semibold text-blue-700">{doc.displayType}</span>
                        <span>·</span>
                        <span>{doc.fileSizeFormatted}</span>
                        <span>·</span>
                        <span className="text-emerald-700 font-medium">{doc.status}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {doc.viewUrl && (
                      <button
                        type="button"
                        onClick={() => viewDocumentInNewTab(doc)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 hover:bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 shadow-2xs cursor-pointer active:scale-95 transition-all"
                        title="View Document"
                      >
                        <ExternalLink className="size-3.5 text-slate-500" />
                        <span className="hidden sm:inline">View</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => downloadDocumentFile(doc)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#009EE2] hover:bg-[#0089c7] px-3 text-xs font-bold text-white shadow-xs cursor-pointer active:scale-95 transition-all"
                      title="Download File"
                    >
                      <Download className="size-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
          <span className="text-[11.5px] text-slate-500">
            Movement: <strong className="font-mono text-slate-800">{movementNumber}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-full text-xs font-semibold text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
});
