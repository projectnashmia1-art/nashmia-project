import React from "react";
import {
  Link2,
  MoreVertical,
  Download,
  Eye,
  Star,
  Trash2,
  Share2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DriveFile } from "./documents-data";
import { FileThumbnailIcon } from "./FileThumbnailIcon";

interface FileRowItemProps {
  file: DriveFile;
  isSelected?: boolean;
  onSelect?: () => void;
  onPreview?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onToggleStar?: () => void;
  onReview?: () => void;
  showCursor?: boolean;
}

export function FileRowItem({
  file,
  isSelected = false,
  onSelect,
  onPreview,
  onDownload,
  onShare,
  onDelete,
  onToggleStar,
  onReview,
  showCursor = false,
}: FileRowItemProps) {
  const isNeedsReview = Boolean(
    file.metadata?.needsReview || file.metadata?.reviewStatus === "NEEDS_REVIEW",
  );
  const unconfidentFields = file.metadata?.unconfidentFields || [];

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group grid grid-cols-12 items-center px-4 py-3 sm:py-3.5 transition-all duration-150 rounded-xl cursor-pointer select-none",
        isSelected
          ? isNeedsReview
            ? "bg-amber-50 text-slate-900 shadow-xs ring-1 ring-amber-300"
            : "bg-[#F0F5FF] text-slate-900 shadow-xs ring-1 ring-blue-200/60"
          : isNeedsReview
            ? "bg-amber-50/40 hover:bg-amber-50/70 text-slate-800 border-l-2 border-amber-500"
            : "hover:bg-slate-50/80 text-slate-700",
      )}
    >
      {/* Name Column (Col span 5 on desktop, 6 on tablet, 8 on mobile) */}
      <div className="col-span-8 sm:col-span-5 flex items-center gap-2.5 min-w-0 pr-2">
        <FileThumbnailIcon file={file} size="sm" variant="minimal" />

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                "text-xs sm:text-sm truncate",
                isSelected
                  ? "font-semibold text-slate-900"
                  : "font-medium text-slate-700 group-hover:text-blue-600",
              )}
              title={file.name}
            >
              {file.name}
            </span>

            {/* Hand cursor indicator if specified (matching the design) */}
            {showCursor && (
              <div className="text-slate-800 opacity-90 shrink-0">
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5 fill-slate-900"
                  stroke="white"
                  strokeWidth="1.2"
                >
                  <path d="M7 2l12 11.5-6.5.5 3.5 7.5-2.5 1-3.5-7.5L7 18V2z" />
                </svg>
              </div>
            )}
          </div>

          {/* Movement, Review & Classification Badges */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {isNeedsReview && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-200/80 border border-amber-300 px-1.5 py-0.2 rounded shrink-0">
                <AlertTriangle className="size-2.5 text-amber-700" />
                Needs Review
              </span>
            )}

            {file.metadata?.movementNumber ? (
              <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-1.5 py-0.2 rounded">
                {file.metadata.movementNumber}
              </span>
            ) : isNeedsReview ? (
              <span className="text-[10px] font-mono text-amber-800 bg-amber-100/60 border border-amber-200/60 px-1.5 py-0.2 rounded">
                No Movement Linked
              </span>
            ) : null}

            {file.metadata?.documentType === "CUT_OFF_NOTICE" && (
              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200/50 px-1.5 py-0.2 rounded font-medium">
                Cut-Off Notice &bull; {file.metadata.cutOffDeadlines?.length || 0} dates
              </span>
            )}
            {file.metadata?.documentType === "BILL_OF_LADING" && (
              <span className="text-[10px] text-blue-800 bg-blue-100/60 border border-blue-200/50 px-1.5 py-0.2 rounded font-semibold font-mono">
                BILL_OF_LADING
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Owners Column (Col span 2) */}
      <div className="hidden sm:flex col-span-2 items-center -space-x-1.5">
        {file.owners.map((owner, idx) => (
          <div
            key={owner.id || idx}
            title={owner.name}
            className={cn(
              "size-5 sm:size-6 rounded-full overflow-hidden flex items-center justify-center font-bold text-[9px] shadow-xs ring-1.5 ring-white",
              owner.avatarBg,
            )}
          >
            {owner.avatarImage ? (
              <img
                src={owner.avatarImage}
                alt={owner.name}
                className="size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{owner.avatarText}</span>
            )}
          </div>
        ))}
      </div>

      {/* Last Modified Column (Col span 3) */}
      <div className="hidden sm:block col-span-3 text-xs text-slate-400 font-medium truncate pr-2">
        {file.lastModified}
      </div>

      {/* File Size Column (Col span 1) */}
      <div className="hidden md:block col-span-1 text-xs text-slate-400 font-medium truncate">
        {file.fileSize}
      </div>

      {/* Actions Column (Col span 4 on mobile, 1 on desktop) */}
      <div
        className="col-span-4 sm:col-span-2 md:col-span-1 flex items-center justify-end gap-1 sm:gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Direct Review & Link button if needs review */}
        {isNeedsReview && onReview && (
          <button
            type="button"
            onClick={onReview}
            title="Review & Link Document"
            className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-md transition-colors"
          >
            <ShieldCheck className="size-3 text-amber-700" />
            Review
          </button>
        )}

        {/* Share Link button */}
        <button
          type="button"
          onClick={onShare}
          title="Copy Link / Share"
          className="p-1.5 text-slate-400 hover:text-[#1D63ED] hover:bg-white rounded-lg transition-colors"
        >
          <Link2 className="size-4" />
        </button>

        {/* 3-dots Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            >
              <MoreVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {isNeedsReview && onReview && (
              <>
                <DropdownMenuItem
                  onClick={onReview}
                  className="gap-2 text-xs font-semibold text-amber-900 bg-amber-50 focus:bg-amber-100 focus:text-amber-950"
                >
                  <ShieldCheck className="size-3.5 text-amber-700" />
                  Review &amp; Link Movement
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={onPreview} className="gap-2 text-xs">
              <Eye className="size-3.5 text-slate-500" />
              Preview Document
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare} className="gap-2 text-xs">
              <Share2 className="size-3.5 text-slate-500" />
              Share & Permissions
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStar} className="gap-2 text-xs">
              <Star
                className={cn(
                  "size-3.5",
                  file.starred ? "text-amber-500 fill-amber-500" : "text-slate-500",
                )}
              />
              {file.starred ? "Remove from Starred" : "Add to Starred"}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                if (onDownload) {
                  onDownload();
                } else if (file.url && file.url !== "#") {
                  const a = document.createElement("a");
                  a.href = file.url;
                  a.download = file.name;
                  a.target = "_blank";
                  a.rel = "noopener noreferrer";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                }
              }}
              className="gap-2 text-xs"
            >
              <Download className="size-3.5 text-slate-500" />
              Download
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onDelete}
              className="gap-2 text-xs text-rose-600 focus:text-rose-600 focus:bg-rose-50"
            >
              <Trash2 className="size-3.5" />
              Move to Trash
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
