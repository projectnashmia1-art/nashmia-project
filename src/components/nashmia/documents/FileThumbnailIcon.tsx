import React, { useState } from "react";
import {
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  Presentation,
  FileCode,
  FileQuestion,
  Ship,
  Clock,
  Receipt,
  PackageCheck,
  CheckCircle2,
  FileCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { DriveFile, DriveFileMetadata } from "./documents-data";

interface FileThumbnailIconProps {
  file: Partial<DriveFile> & {
    name: string;
    type?: string;
    extension?: string;
    url?: string;
    thumbnailUrl?: string | null;
    metadata?: (Partial<DriveFileMetadata> & Record<string, unknown>) | null;
  };
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  showFormatTag?: boolean;
  variant?: "default" | "minimal";
}

/**
 * Clean, minimal file-type icon matching reference design:
 * - Red for PDF
 * - Green for Excel (.xlsx, .xls, .csv)
 * - Blue for Word (.docx, .doc)
 * - Gray for text (.txt) or other file types
 */
export function MinimalDocumentIcon({
  file,
  className,
  size = "md",
}: {
  file: Partial<DriveFile> & {
    name: string;
    type?: string;
    extension?: string;
    metadata?: (Partial<DriveFileMetadata> & Record<string, unknown>) | null;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const rawExt = (file.extension || file.name?.split(".").pop() || "").toLowerCase();
  const rawType = (
    file.type ||
    (file.metadata?.displayDocumentType as string) ||
    (file.metadata?.documentType as string) ||
    ""
  ).toLowerCase();

  let colorClass = "text-slate-400"; // default gray for text / other

  if (rawExt === "pdf" || rawType.includes("pdf")) {
    colorClass = "text-red-500"; // red for PDF
  } else if (
    ["xlsx", "xls", "csv"].includes(rawExt) ||
    rawType.includes("excel") ||
    rawType.includes("spreadsheet") ||
    rawType.includes("sheet")
  ) {
    colorClass = "text-emerald-500"; // green for Excel
  } else if (
    ["docx", "doc"].includes(rawExt) ||
    rawType.includes("word") ||
    rawType.includes("document")
  ) {
    colorClass = "text-blue-500"; // blue for Word
  } else {
    colorClass = "text-slate-400"; // gray for text or other file types
  }

  const sizeClass = size === "sm" ? "size-4" : size === "lg" ? "size-6" : "size-4.5 sm:size-5";

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0 transition-colors", sizeClass, colorClass, className)}
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

export function FileThumbnailIcon({
  file,
  size = "md",
  className,
  showFormatTag = false,
  variant = "default",
}: FileThumbnailIconProps) {
  const [imageError, setImageError] = useState(false);

  if (variant === "minimal") {
    return (
      <MinimalDocumentIcon
        file={file}
        className={className}
        size={size === "lg" || size === "xl" ? "lg" : size === "sm" ? "sm" : "md"}
      />
    );
  }

  const rawExt = (file.extension || file.name.split(".").pop() || "").toLowerCase();
  const fileType = file.type || getFileTypeFromExt(rawExt);
  const nameLower = (file.name || "").toLowerCase();
  const typeTag = (
    file.metadata?.typeTag ||
    file.metadata?.category ||
    file.metadata?.documentType ||
    ""
  ).toLowerCase();

  const isBl =
    typeTag.includes("bill of lading") ||
    typeTag === "bl" ||
    nameLower.includes("bl_") ||
    nameLower.includes("bl-") ||
    nameLower.includes("master_bl") ||
    nameLower.includes("house_bl");

  const isInvoice = typeTag.includes("invoice") || nameLower.includes("invoice");

  const isPackingList = typeTag.includes("packing") || nameLower.includes("packing");

  const isCutOff =
    typeTag.includes("cut-off") ||
    typeTag.includes("cutoff") ||
    nameLower.includes("cut-off") ||
    nameLower.includes("cutoff");

  const isImage =
    fileType === "image" || ["jpg", "jpeg", "png", "webp", "gif", "svg"].includes(rawExt);

  // Check if we have an image URL
  const imageUrl =
    file.url ||
    file.metadata?.fileUrl ||
    file.metadata?.thumbnail ||
    file.thumbnailUrl ||
    (isImage ? getFallbackImageUrl(file.name) : null);

  const sizeClasses = {
    sm: "size-7 rounded-lg text-xs",
    md: "size-8.5 sm:size-9 rounded-xl text-sm",
    lg: "size-14 rounded-2xl text-base",
    xl: "size-20 rounded-2xl text-lg",
  };

  const iconSizes = {
    sm: "size-3.5",
    md: "size-4.5",
    lg: "size-7",
    xl: "size-10",
  };

  // 1. Live Image Thumbnail
  if (isImage && imageUrl && !imageError) {
    return (
      <div
        className={cn(
          "relative overflow-hidden shrink-0 border border-slate-200/90 bg-slate-100 shadow-xs group/thumb select-none flex items-center justify-center",
          sizeClasses[size],
          className,
        )}
      >
        <img
          src={imageUrl}
          alt={file.name}
          onError={() => setImageError(true)}
          className="size-full object-cover transition-transform duration-300 group-hover/thumb:scale-110"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        {/* Format badge overlay */}
        {(size === "lg" || size === "xl" || showFormatTag) && (
          <span className="absolute bottom-1 right-1 rounded-md bg-black/70 px-1 py-0.2 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-xs">
            {rawExt || "IMG"}
          </span>
        )}
        {size === "sm" && (
          <span className="absolute bottom-0 right-0 size-2 rounded-tl-xs bg-amber-500" />
        )}
      </div>
    );
  }

  // 2. Bill of Lading Specific Badge (Navy / Ocean Blue)
  if (isBl && rawExt !== "jpg" && rawExt !== "png") {
    return (
      <div
        className={cn(
          "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
          "bg-gradient-to-br from-[#1E40AF] via-[#1D4ED8] to-[#1E3A8A] ring-1 ring-blue-500/30",
          sizeClasses[size],
          className,
        )}
      >
        <div className="absolute top-0 right-0 border-t-[5px] border-r-[5px] border-t-white/30 border-r-[#1E3A8A] rounded-bl-xs" />
        <div className="flex flex-col items-center justify-center">
          <span
            className={cn("font-black tracking-tight", size === "sm" ? "text-[10px]" : "text-xs")}
          >
            B/L
          </span>
          {(size === "lg" || size === "xl") && (
            <span className="text-[9px] font-semibold tracking-wider text-blue-200 uppercase mt-0.5">
              Bill of Lading
            </span>
          )}
        </div>
      </div>
    );
  }

  // 3. Commercial Invoice Specific Badge (Emerald Green)
  if (isInvoice && rawExt !== "jpg" && rawExt !== "png") {
    return (
      <div
        className={cn(
          "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
          "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 ring-1 ring-emerald-500/30",
          sizeClasses[size],
          className,
        )}
      >
        <div className="absolute top-0 right-0 border-t-[5px] border-r-[5px] border-t-white/30 border-r-teal-800 rounded-bl-xs" />
        <div className="flex flex-col items-center justify-center">
          <Receipt className={iconSizes[size]} />
          {(size === "lg" || size === "xl") && (
            <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">INV</span>
          )}
        </div>
      </div>
    );
  }

  // 4. Cut-Off Notice (Ocean Cyan / Sky)
  if (isCutOff && rawExt === "pdf") {
    return (
      <div
        className={cn(
          "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
          "bg-gradient-to-br from-rose-500 via-rose-600 to-red-700 ring-1 ring-rose-500/30",
          sizeClasses[size],
          className,
        )}
      >
        <div className="absolute top-0 right-0 border-t-[6px] border-r-[6px] border-t-white/35 border-r-red-800 rounded-bl-xs" />
        <div className="flex flex-col items-center justify-center">
          <svg viewBox="0 0 24 24" className={cn("fill-current", iconSizes[size])}>
            <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
          </svg>
          {(size === "lg" || size === "xl") && (
            <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 opacity-95">
              PDF
            </span>
          )}
        </div>
      </div>
    );
  }

  // 5. Standard Type Switch
  switch (fileType) {
    case "pdf":
      return (
        <div
          className={cn(
            "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
            "bg-gradient-to-br from-rose-500 via-rose-600 to-red-700 ring-1 ring-rose-500/25",
            sizeClasses[size],
            className,
          )}
        >
          {/* Folded paper corner effect */}
          <div className="absolute top-0 right-0 border-t-[6px] border-r-[6px] border-t-white/35 border-r-red-800 rounded-bl-xs" />

          <div className="flex flex-col items-center justify-center">
            <svg viewBox="0 0 24 24" className={cn("fill-current", iconSizes[size])}>
              <path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z" />
            </svg>
            {(size === "lg" || size === "xl") && (
              <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 opacity-95">
                PDF
              </span>
            )}
          </div>

          {showFormatTag && size !== "lg" && size !== "xl" && (
            <span className="absolute -bottom-1 -right-1 rounded-sm bg-red-900/90 px-1 py-0.1 text-[8px] font-bold text-white shadow-xs">
              PDF
            </span>
          )}
        </div>
      );

    case "sheet":
      return (
        <div
          className={cn(
            "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
            "bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 ring-1 ring-emerald-500/25",
            sizeClasses[size],
            className,
          )}
        >
          <div className="flex flex-col items-center justify-center">
            <svg viewBox="0 0 24 24" className={cn("fill-current", iconSizes[size])}>
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H5v-2h4v2zm0-4H5v-2h4v2zm0-4H5V7h4v2zm10 8h-8v-2h8v2zm0-4h-8v-2h8v2zm0-4h-8V7h8v2z" />
            </svg>
            {(size === "lg" || size === "xl") && (
              <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 opacity-95">
                XLS
              </span>
            )}
          </div>
        </div>
      );

    case "doc":
      return (
        <div
          className={cn(
            "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
            "bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 ring-1 ring-blue-500/25",
            sizeClasses[size],
            className,
          )}
        >
          <div className="flex flex-col items-center justify-center">
            <svg viewBox="0 0 24 24" className={cn("fill-current", iconSizes[size])}>
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
            {(size === "lg" || size === "xl") && (
              <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 opacity-95">
                DOC
              </span>
            )}
          </div>
        </div>
      );

    case "image":
      return (
        <div
          className={cn(
            "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
            "bg-gradient-to-br from-purple-500 via-indigo-600 to-purple-700 ring-1 ring-purple-500/25",
            sizeClasses[size],
            className,
          )}
        >
          <div className="flex flex-col items-center justify-center">
            <svg viewBox="0 0 24 24" className={cn("fill-current", iconSizes[size])}>
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
            </svg>
            {(size === "lg" || size === "xl") && (
              <span className="text-[10px] font-black uppercase tracking-wider mt-0.5 opacity-95">
                IMG
              </span>
            )}
          </div>
        </div>
      );

    case "slides":
      return (
        <div
          className={cn(
            "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
            "bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 ring-1 ring-amber-600/25",
            sizeClasses[size],
            className,
          )}
        >
          <Presentation className={iconSizes[size]} />
        </div>
      );

    case "archive":
      return (
        <div
          className={cn(
            "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
            "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 ring-1 ring-slate-600/25",
            sizeClasses[size],
            className,
          )}
        >
          <Archive className={iconSizes[size]} />
        </div>
      );

    default:
      return (
        <div
          className={cn(
            "relative shrink-0 flex items-center justify-center font-bold text-white shadow-xs select-none",
            "bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800 ring-1 ring-slate-500/25",
            sizeClasses[size],
            className,
          )}
        >
          <FileText className={iconSizes[size]} />
        </div>
      );
  }
}

function getFileTypeFromExt(ext: string): string {
  switch (ext) {
    case "pdf":
      return "pdf";
    case "xls":
    case "xlsx":
    case "csv":
      return "sheet";
    case "doc":
    case "docx":
    case "txt":
      return "doc";
    case "jpg":
    case "jpeg":
    case "png":
    case "webp":
    case "gif":
    case "svg":
      return "image";
    case "ppt":
    case "pptx":
      return "slides";
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return "archive";
    default:
      return "doc";
  }
}

function getFallbackImageUrl(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.includes("packing") || lower.includes("cargo") || lower.includes("loading")) {
    return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=300&auto=format&fit=crop&q=80";
  }
  if (lower.includes("container") || lower.includes("ship") || lower.includes("port")) {
    return "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=300&auto=format&fit=crop&q=80";
  }
  if (lower.includes("inspection") || lower.includes("factory") || lower.includes("warehouse")) {
    return "https://images.unsplash.com/photo-1553413077-190dd305871c?w=300&auto=format&fit=crop&q=80";
  }
  return "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=300&auto=format&fit=crop&q=80";
}
