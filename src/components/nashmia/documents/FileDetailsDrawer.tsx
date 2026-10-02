import React from "react";
import {
  X,
  FileText,
  Calendar,
  HardDrive,
  Users,
  Download,
  Share2,
  Trash2,
  Folder,
  Star,
  ExternalLink,
  Clock,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DriveFile, DriveFolder } from "./documents-data";
import { FileThumbnailIcon } from "./FileThumbnailIcon";

interface FileDetailsDrawerProps {
  file: DriveFile | null;
  folder: DriveFolder | null;
  open: boolean;
  onClose: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onReview?: (file: DriveFile) => void;
}

export function FileDetailsDrawer({
  file,
  folder,
  open,
  onClose,
  onShare,
  onDelete,
  onReview,
}: FileDetailsDrawerProps) {
  if (!open || (!file && !folder)) return null;

  const isFolder = Boolean(folder && !file);
  const title = file?.name || folder?.name || "Item Details";
  const isNeedsReview = Boolean(
    file?.metadata?.needsReview || file?.metadata?.reviewStatus === "NEEDS_REVIEW",
  );
  const unconfidentFields = file?.metadata?.unconfidentFields || [];
  const reviewReason = file?.metadata?.reviewReason;

  const isCutOffDoc =
    file?.metadata?.category === "Cut-Off Notice" ||
    file?.metadata?.documentType === "CUT_OFF_NOTICE";
  const isBlDoc =
    file?.metadata?.category === "Bill of Lading" ||
    file?.metadata?.documentType === "BILL_OF_LADING";
  const cutOffDeadlines = file?.metadata?.cutOffDeadlines || file?.metadata?.cutOffDates?.deadlines;
  const movementNumber = file?.metadata?.movementNumber;
  const forwarderName = file?.metadata?.forwarderName;
  const documentType =
    file?.metadata?.documentType ||
    (isBlDoc ? "BILL_OF_LADING" : isCutOffDoc ? "CUT_OFF_NOTICE" : undefined);

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white border-l border-slate-200 shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 min-w-0">
            {isFolder ? (
              <div className="p-2 rounded-lg bg-blue-50 text-[#1D63ED]">
                <Folder className="size-5" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-blue-50 text-[#1D63ED]">
                <FileText className="size-5" />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-800 truncate">{title}</h3>
              <p className="text-[11px] text-slate-400 font-medium">
                {isFolder ? "Directory Folder" : `${file?.extension?.toUpperCase()} File`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Thumbnail Preview Area */}
        <div className="my-5 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/60 border border-slate-200/80 p-6 flex flex-col items-center justify-center text-center shadow-xs">
          {isFolder ? (
            <div className="size-16 rounded-2xl bg-blue-100/80 text-[#1D63ED] flex items-center justify-center mb-3">
              <Folder className="size-8" />
            </div>
          ) : file ? (
            <div className="mb-3">
              <FileThumbnailIcon file={file} size="lg" showFormatTag />
            </div>
          ) : (
            <div className="size-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-3 shadow-md">
              <FileText className="size-8" />
            </div>
          )}
          <span className="text-xs font-semibold text-slate-800 truncate max-w-full px-2">
            {title}
          </span>
          <span className="text-[11px] text-slate-400 mt-0.5 font-medium">
            {file?.fileSize || folder?.totalSize}
          </span>
          {isNeedsReview ? (
            <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
              <AlertTriangle className="size-3 text-amber-700" />
              Needs Review
            </span>
          ) : file?.metadata?.category ? (
            <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {file.metadata.category}
            </span>
          ) : null}
        </div>

        {/* Needs Review Alert Banner */}
        {isNeedsReview && (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50/90 p-4 space-y-2 text-xs">
            <div className="flex items-center justify-between font-bold text-amber-900">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="size-3.5 text-amber-700" /> Manual Review Required
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">
                Stored Safely
              </span>
            </div>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              {reviewReason ||
                "Movement, document type, or cut-off schedule could not be identified with confidence. Stored safely for operator review."}
            </p>
            {unconfidentFields.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {unconfidentFields.map((f) => (
                  <span
                    key={f}
                    className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-amber-200/80 text-amber-900 rounded"
                  >
                    {f === "movement"
                      ? "Unidentified Movement"
                      : f === "document_type"
                        ? "Ambiguous Doc Type"
                        : "Unclear Cut-Off"}
                  </span>
                ))}
              </div>
            )}
            {file && onReview && (
              <div className="pt-2">
                <Button
                  size="sm"
                  onClick={() => onReview(file)}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 h-8"
                >
                  <ShieldCheck className="size-3.5" />
                  Review &amp; Link to Movement
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Cut-Off Deadlines (Only relevant cut-off dates/times and labels) */}
        {isCutOffDoc && (
          <div className="mb-5 rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Clock className="size-3.5 text-amber-600" /> Cut-Off Deadlines
              </span>
              {movementNumber && (
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white text-slate-700 border border-amber-200">
                  {movementNumber}
                </span>
              )}
            </div>

            <div className="space-y-2">
              {cutOffDeadlines && cutOffDeadlines.length > 0 ? (
                cutOffDeadlines.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/60 shadow-2xs"
                  >
                    <span className="font-semibold text-slate-700">{item.type}</span>
                    <span
                      className={cn(
                        "font-medium text-right",
                        item.dateTime ? "text-amber-800 font-semibold" : "text-slate-400 italic",
                      )}
                    >
                      {item.dateTime ? `→ ${item.dateTime}` : "Not Provided"}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  {file?.metadata?.cutOffDates?.siCutoff && (
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/60 shadow-2xs">
                      <span className="font-semibold text-slate-700">SI Cut-Off</span>
                      <span className="font-semibold text-amber-800">
                        → {file.metadata.cutOffDates.siCutoff}
                      </span>
                    </div>
                  )}
                  {file?.metadata?.cutOffDates?.vgmCutoff && (
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/60 shadow-2xs">
                      <span className="font-semibold text-slate-700">VGM Cut-Off</span>
                      <span className="font-semibold text-amber-800">
                        → {file.metadata.cutOffDates.vgmCutoff}
                      </span>
                    </div>
                  )}
                  {file?.metadata?.cutOffDates?.gateCutoff && (
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/60 shadow-2xs">
                      <span className="font-semibold text-slate-700">CY Cut-Off</span>
                      <span className="font-semibold text-amber-800">
                        → {file.metadata.cutOffDates.gateCutoff}
                      </span>
                    </div>
                  )}
                  {file?.metadata?.cutOffDates?.portCutoff && (
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/60 shadow-2xs">
                      <span className="font-semibold text-slate-700">Port Cut-Off</span>
                      <span className="font-semibold text-amber-800">
                        → {file.metadata.cutOffDates.portCutoff}
                      </span>
                    </div>
                  )}
                  {file?.metadata?.cutOffDates?.closingDate && (
                    <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white border border-amber-200/60 shadow-2xs">
                      <span className="font-semibold text-slate-700">Cargo Cut-Off</span>
                      <span className="font-semibold text-amber-800">
                        → {file.metadata.cutOffDates.closingDate}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Bill of Lading Details (Stored as BILL_OF_LADING, linked to movement) */}
        {isBlDoc && (
          <div className="mb-5 rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <FileText className="size-3.5 text-blue-600" /> Bill of Lading (B/L)
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-600 text-white shadow-2xs">
                BILL_OF_LADING
              </span>
            </div>

            <div className="text-xs space-y-1.5 py-2 px-3 rounded-lg bg-white border border-blue-200/60 text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Status</span>
                <span className="font-semibold text-emerald-700">Original Document Saved</span>
              </div>
              {movementNumber && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-400">Linked Movement</span>
                  <span className="font-mono font-bold text-blue-700">{movementNumber}</span>
                </div>
              )}
              {forwarderName && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                  <span className="text-slate-400">Forwarder / Carrier</span>
                  <span className="font-medium text-slate-800">{forwarderName}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Properties List */}
        <div className="space-y-4">
          <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            Properties & Metadata
          </div>

          <div className="space-y-3 text-xs">
            {documentType && (
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
                <span className="flex items-center gap-2 text-slate-400">Document Type</span>
                <span className="font-mono font-bold text-xs text-slate-800 px-1.5 py-0.5 bg-slate-100 rounded">
                  {documentType}
                </span>
              </div>
            )}

            {movementNumber && (
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
                <span className="flex items-center gap-2 text-slate-400">Movement</span>
                <span className="font-semibold text-slate-800">{movementNumber}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
              <span className="flex items-center gap-2 text-slate-400">
                <HardDrive className="size-3.5" /> Size
              </span>
              <span className="font-semibold text-slate-800">
                {file?.fileSize || folder?.totalSize}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-50">
              <span className="flex items-center gap-2 text-slate-400">
                <Calendar className="size-3.5" /> Last Modified
              </span>
              <span className="font-medium text-slate-800">{file?.lastModified || "Just now"}</span>
            </div>

            <div className="py-2 border-b border-slate-50">
              <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Users className="size-3.5" /> People with Access
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(file?.owners || folder?.sharedWith || []).map((owner) => (
                  <div
                    key={owner.id}
                    className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/60 rounded-full py-0.5 pl-1 pr-2.5 text-[11px]"
                  >
                    <div
                      className={cn(
                        "size-4 rounded-full flex items-center justify-center font-bold text-[8px]",
                        owner.avatarBg,
                      )}
                    >
                      {owner.avatarText}
                    </div>
                    <span className="font-medium text-slate-700">{owner.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Quick Actions */}
      <div className="pt-6 border-t border-slate-100 flex items-center gap-2">
        <Button
          onClick={onShare}
          className="flex-1 bg-[#1D63ED] hover:bg-blue-700 text-white text-xs font-semibold gap-2"
        >
          <Share2 className="size-3.5" /> Share
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            onClose();
          }}
          className="text-xs"
        >
          Close
        </Button>
      </div>
    </div>
  );
}
