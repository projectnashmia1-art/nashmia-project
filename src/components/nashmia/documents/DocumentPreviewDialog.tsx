import React from "react";
import { Download, ExternalLink, FileText, Share2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DriveFile } from "./documents-data";
import { FileThumbnailIcon } from "./FileThumbnailIcon";

interface DocumentPreviewDialogProps {
  file: DriveFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: () => void;
}

export function DocumentPreviewDialog({
  file,
  open,
  onOpenChange,
  onShare,
}: DocumentPreviewDialogProps) {
  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileThumbnailIcon file={file} size="sm" />
            <div className="min-w-0">
              <DialogTitle className="text-sm font-bold text-slate-800 truncate">
                {file.name}
              </DialogTitle>
              <div className="text-[11px] text-slate-400">
                {file.fileSize} &bull; Modified {file.lastModified}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShare}
              className="h-8 text-xs gap-1.5"
            >
              <Share2 className="size-3.5" /> Share
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const dummy = document.createElement("a");
                dummy.href = "#";
                dummy.download = file.name;
                dummy.click();
              }}
              className="h-8 bg-[#1D63ED] hover:bg-blue-700 text-white text-xs gap-1.5"
            >
              <Download className="size-3.5" /> Download
            </Button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6 overflow-y-auto bg-slate-50 flex-1 min-h-[320px] flex items-center justify-center">
          {file.type === "image" ||
          ["jpg", "jpeg", "png", "webp", "gif"].includes((file.extension || "").toLowerCase()) ? (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md max-w-full max-h-[420px] flex items-center justify-center p-3">
              <img
                src={
                  file.url ||
                  file.metadata?.fileUrl ||
                  "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80"
                }
                alt={file.name}
                className="max-h-[380px] w-auto object-contain rounded-xl shadow-inner"
                referrerPolicy="no-referrer"
              />
            </div>
          ) : (
            <div className="w-full max-w-lg bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center space-y-4">
              <div className="flex justify-center">
                <FileThumbnailIcon file={file} size="lg" showFormatTag />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 break-all">{file.name}</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Attachment Metadata Record &bull; Original file is not stored
                </p>
              </div>

              {/* 7 Display Metadata Fields */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2.5 text-slate-700">
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Document Name:</span>
                  <span
                    className="font-semibold text-slate-900 truncate max-w-[240px]"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Document Type:</span>
                  <span className="font-semibold text-blue-600">
                    {file.metadata?.displayDocumentType ||
                      file.metadata?.documentType ||
                      file.metadata?.typeTag ||
                      "Cut-Off"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Movement Reference Number:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {file.metadata?.movementReferenceNumber ||
                      file.metadata?.movementNumber ||
                      "Needs Review"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Forwarder:</span>
                  <span className="font-semibold text-slate-900">
                    {file.metadata?.forwarder || file.metadata?.forwarderName || "Forwarder"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Received Date:</span>
                  <span className="font-semibold text-slate-900">
                    {file.metadata?.receivedDate || file.lastModified}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">File Type / Size:</span>
                  <span className="font-semibold text-slate-900">
                    {(file.metadata?.fileFormat || file.extension).toUpperCase()} &bull;{" "}
                    {file.fileSize}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">Status:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                    {file.metadata?.status || "Metadata Saved"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
