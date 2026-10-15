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
      <DialogContent className="w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl shadow-2xl">
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
            {file.url || file.metadata?.fileUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const targetUrl = file.url || file.metadata?.fileUrl;
                  if (targetUrl) {
                    const a = document.createElement("a");
                    a.href = targetUrl;
                    a.target = "_blank";
                    a.rel = "noopener noreferrer";
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                className="h-8 text-xs gap-1.5 cursor-pointer"
              >
                <ExternalLink className="size-3.5" /> Open
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onShare}
              className="h-8 text-xs gap-1.5 cursor-pointer"
            >
              <Share2 className="size-3.5" /> Share
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const storagePath = file.metadata?.storagePath;
                const msgId = file.metadata?.gmailMessageId || file.metadata?.emailMessageId;
                const attId = (file.metadata as Record<string, unknown>)?.attachmentId as string | undefined;

                let downloadUrl = "";
                if (storagePath) {
                  downloadUrl = `/api/documents/download?path=${encodeURIComponent(storagePath)}`;
                } else if (msgId && attId) {
                  const filename = file.metadata?.originalFilename || file.metadata?.fileName || file.name;
                  downloadUrl = `/api/gmail/attachment?messageId=${encodeURIComponent(msgId)}&attachmentId=${encodeURIComponent(attId)}&filename=${encodeURIComponent(filename)}`;
                } else if (file.url && file.url !== "#" && !file.url.startsWith("https://drive.nashmia.com")) {
                  downloadUrl = file.url;
                } else if (file.metadata?.fileUrl && file.metadata.fileUrl !== "#") {
                  downloadUrl = file.metadata.fileUrl;
                }

                if (downloadUrl) {
                  const a = document.createElement("a");
                  a.href = downloadUrl;
                  a.download =
                    file.metadata?.originalFilename || file.metadata?.fileName || file.name;
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
              className="h-8 bg-[#1D63ED] hover:bg-blue-700 text-white text-xs gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5" /> Download
            </Button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="p-6 overflow-y-auto bg-slate-50 flex-1 min-h-[320px] flex items-center justify-center">
          {file.type === "image" && (file.url || file.metadata?.fileUrl) ? (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-md max-w-full max-h-[420px] flex items-center justify-center p-3">
              <img
                src={file.url || file.metadata?.fileUrl || ""}
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
                  {file.metadata?.uploadStatus ||
                    (file.url ? "Stored in Supabase Storage" : "Metadata Record")}{" "}
                  &bull; {file.metadata?.source || "Incoming Forwarder Email"}
                </p>
              </div>

              {/* Complete Metadata Fields (Displaying all 9 required attributes) */}
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
                  <span className="text-slate-400 font-medium">Movement Number:</span>
                  <span className="font-semibold text-blue-700 font-mono">
                    {file.metadata?.movementNumber ||
                      file.metadata?.movementReferenceNumber ||
                      "Not Linked"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Document Type:</span>
                  <span className="font-semibold text-blue-600">
                    {file.metadata?.displayDocumentType ||
                      file.metadata?.documentType ||
                      file.metadata?.typeTag ||
                      file.metadata?.category ||
                      "Other"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Original Filename:</span>
                  <span
                    className="font-mono text-slate-800 truncate max-w-[240px]"
                    title={file.metadata?.originalFilename || file.metadata?.fileName || file.name}
                  >
                    {file.metadata?.originalFilename || file.metadata?.fileName || file.name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">File Format & Size:</span>
                  <span className="font-semibold text-slate-900">
                    {(file.metadata?.fileFormat || file.extension).toUpperCase()} &bull;{" "}
                    {file.fileSize}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Received Date:</span>
                  <span className="font-semibold text-slate-900">
                    {file.metadata?.receivedDate || file.lastModified}
                    {file.metadata?.receivedTime ? ` (${file.metadata.receivedTime})` : ""}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Sender / Forwarder:</span>
                  <span className="font-semibold text-slate-900">
                    {file.metadata?.forwarder ||
                      file.metadata?.forwarderName ||
                      "Freight Forwarder"}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                  <span className="text-slate-400 font-medium">Source Email:</span>
                  <span className="font-mono text-slate-800 text-[11px] truncate max-w-[240px]">
                    {file.metadata?.sourceEmail ||
                      file.metadata?.senderEmail ||
                      file.metadata?.forwarderEmail ||
                      "Not Provided"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className="text-slate-400 font-medium">Upload / Source Status:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                    {file.metadata?.uploadStatus || file.metadata?.status || "Processed"}
                  </span>
                </div>
              </div>

              {/* Open Stored Document Quick Action Button */}
              {file.url || file.metadata?.fileUrl ? (
                <div className="pt-2">
                  <a
                    href={file.url || file.metadata?.fileUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs border border-blue-200 transition-colors"
                  >
                    <ExternalLink className="size-3.5" /> Open Stored Document
                  </a>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
