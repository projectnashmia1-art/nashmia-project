import React from "react";
import { cn } from "@/lib/utils";
import type { DriveFolder } from "./documents-data";

interface FolderCardProps {
  folder: DriveFolder;
  isActive?: boolean;
  onClick?: () => void;
}

export function FolderCard({ folder, isActive = false, onClick }: FolderCardProps) {
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
        "group relative flex flex-col justify-between cursor-pointer select-none transition-all duration-200 outline-none",
        "h-[150px] w-full min-w-[200px] max-w-[270px] shrink-0",
      )}
    >
      {/* Tabbed Folder Silhouette Container */}
      <div className="absolute inset-0 z-0">
        {isActive ? (
          <svg
            className="w-full h-full drop-shadow-[0_8px_20px_rgba(29,99,237,0.28)]"
            viewBox="0 0 240 150"
            preserveAspectRatio="none"
            fill="none"
          >
            {/* Folder Silhouette with smooth top-left tab */}
            <path
              d="M0 20C0 8.95431 8.95431 0 20 0H80C90 0 97 6 103 14L109 20H220C231.046 20 240 28.9543 240 40V130C240 141.046 231.046 150 220 150H20C8.95431 150 0 141.046 0 130V20Z"
              fill="#1D63ED"
            />
          </svg>
        ) : (
          <svg
            className="w-full h-full transition-all duration-200 group-hover:drop-shadow-md"
            viewBox="0 0 240 150"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M0 20C0 8.95431 8.95431 0 20 0H80C90 0 97 6 103 14L109 20H220C231.046 20 240 28.9543 240 40V130C240 141.046 231.046 150 220 150H20C8.95431 150 0 141.046 0 130V20Z"
              fill="#F8FAFC"
              stroke="#E2E8F0"
              strokeWidth="1.2"
            />
          </svg>
        )}
      </div>

      {/* Foreground Content */}
      <div className="relative z-10 flex flex-col justify-between h-full p-4 pt-5 sm:p-5">
        {/* Top: Shared with Label & Avatar Stack */}
        <div>
          <div
            className={cn(
              "text-[10px] font-bold tracking-wider uppercase mb-2",
              isActive ? "text-blue-200/90" : "text-slate-400",
            )}
          >
            SHARED WITH
          </div>

          <div className="flex items-center -space-x-1.5">
            {folder.sharedWith.slice(0, 5).map((owner, idx) => (
              <div
                key={owner.id || idx}
                title={owner.name}
                className={cn(
                  "size-6 sm:size-7 rounded-full overflow-hidden flex items-center justify-center font-bold text-[10px] shadow-sm ring-2",
                  isActive ? "ring-[#1D63ED]" : "ring-[#F8FAFC]",
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
            {folder.sharedWith.length > 5 && (
              <div
                className={cn(
                  "size-6 sm:size-7 rounded-full flex items-center justify-center text-[10px] font-semibold ring-2",
                  isActive
                    ? "bg-blue-800 text-white ring-[#1D63ED]"
                    : "bg-slate-200 text-slate-600 ring-[#F8FAFC]",
                )}
              >
                +{folder.sharedWith.length - 5}
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Folder Label & Title */}
        <div className="flex items-end justify-between">
          <div>
            <div
              className={cn(
                "text-[10px] font-bold tracking-wider uppercase leading-none mb-1",
                isActive ? "text-blue-200/90" : "text-slate-400",
              )}
            >
              FOLDER
            </div>
            <div
              className={cn(
                "text-sm sm:text-base font-bold tracking-tight truncate max-w-[180px]",
                isActive ? "text-white" : "text-[#1D63ED] group-hover:text-blue-700",
              )}
            >
              {folder.name}
            </div>
          </div>

          {/* Mouse pointer icon on active card */}
          {isActive && (
            <div className="text-white opacity-90 pr-1 pb-0.5 animate-pulse">
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="currentColor"
                stroke="white"
                strokeWidth="1.2"
              >
                <path d="M7 2l12 11.5-6.5.5 3.5 7.5-2.5 1-3.5-7.5L7 18V2z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
