import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PillPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  itemName?: string;
  className?: string;
}

export function PillPagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  itemName = "records",
  className = "",
}: PillPaginationProps) {
  if (totalPages <= 1 && (!totalItems || totalItems <= (pageSize || 10))) {
    // If only 1 page and very few items, still render or show minimal status if totalItems provided
    if (!totalItems) return null;
  }

  // Calculate visible range numbers
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) {
      return [1, 2, 3, 4, 5];
    }
    if (currentPage >= totalPages - 2) {
      return [totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

  const pages = getPageNumbers();

  const startRecord =
    totalItems !== undefined && pageSize !== undefined
      ? Math.min(totalItems, (currentPage - 1) * pageSize + 1)
      : null;
  const endRecord =
    totalItems !== undefined && pageSize !== undefined
      ? Math.min(totalItems, currentPage * pageSize)
      : null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3.5 pt-2 text-xs text-slate-500 select-none ${className}`}
    >
      {/* Record info or subtle label */}
      {startRecord !== null && endRecord !== null && totalItems !== undefined ? (
        <div className="text-[12.5px] text-slate-500 font-normal">
          Showing <span className="font-semibold text-slate-700">{startRecord}</span>–
          <span className="font-semibold text-slate-700">{endRecord}</span> of{" "}
          <span className="font-semibold text-slate-700">{totalItems}</span> {itemName}
        </div>
      ) : (
        <div />
      )}

      {/* Pill Capsule Pagination matching exact reference image */}
      <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-[#ECEEF1] border border-slate-200/80 shadow-2xs">
        {/* Previous Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous Page"
          className="size-7 sm:size-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white/60 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <ChevronLeft className="size-4 stroke-[2.2]" />
        </button>

        {/* Page Buttons */}
        {pages.map((p) => {
          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`min-w-7 sm:min-w-8 h-7 sm:h-8 px-2 rounded-full text-[12px] sm:text-[13px] font-medium flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? "bg-[#D8F836] text-slate-900 font-bold shadow-xs border border-lime-400/40"
                  : "border border-slate-300/60 bg-white/50 text-slate-600 hover:bg-white hover:text-slate-900"
              }`}
            >
              {p}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages || totalPages === 0}
          aria-label="Next Page"
          className="size-7 sm:size-8 rounded-full bg-white text-slate-700 shadow-2xs border border-slate-200/90 hover:bg-slate-50 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
        >
          <ChevronRight className="size-4 stroke-[2.2]" />
        </button>
      </div>
    </div>
  );
}
