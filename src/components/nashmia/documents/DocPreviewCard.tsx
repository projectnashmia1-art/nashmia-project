import React from "react";
import { cn } from "@/lib/utils";
import type { DriveFile } from "./documents-data";
import { FileThumbnailIcon } from "./FileThumbnailIcon";

interface DocPreviewCardProps {
  file: DriveFile;
  onClick?: () => void;
  isSelected?: boolean;
}

export function DocPreviewCard({ file, onClick, isSelected = false }: DocPreviewCardProps) {
  const primaryOwner = file.owners[0];

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        "group relative flex flex-col justify-between cursor-pointer select-none transition-all duration-200",
        "h-[150px] w-full min-w-[200px] max-w-[270px] shrink-0 rounded-2xl p-4 sm:p-5 outline-none",
        "bg-[#F8FAFC] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-blue-300",
        isSelected && "ring-2 ring-[#1D63ED] border-transparent bg-blue-50/30",
      )}
    >
      {/* Subtle vertical accent indicator on top-left edge */}
      <div className="absolute left-0 top-4 bottom-4 w-1 bg-[#1D63ED] rounded-r-full" />

      {/* Top: Document Icon / Image Thumbnail & Owner Avatar */}
      <div className="flex items-center justify-between">
        <FileThumbnailIcon file={file} size="sm" />

        {primaryOwner && (
          <div
            title={primaryOwner.name}
            className={cn(
              "size-6 sm:size-7 rounded-full overflow-hidden flex items-center justify-center font-bold text-[10px] shadow-sm ring-2 ring-white",
              primaryOwner.avatarBg,
            )}
          >
            {primaryOwner.avatarImage ? (
              <img
                src={primaryOwner.avatarImage}
                alt={primaryOwner.name}
                className="size-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span>{primaryOwner.avatarText}</span>
            )}
          </div>
        )}
      </div>

      {/* Middle: Document Title */}
      <div className="my-1">
        <h4 className="text-xs sm:text-sm font-bold text-[#173B8A] leading-snug line-clamp-2 group-hover:text-[#1D63ED] transition-colors">
          {file.name}
        </h4>
      </div>

      {/* Bottom: Last Modified */}
      <div>
        <div className="text-[9px] font-bold tracking-wider text-slate-400 uppercase mb-0.5">
          LAST MODIFIED
        </div>
        <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">
          {file.lastModified}
        </div>
      </div>
    </div>
  );
}
