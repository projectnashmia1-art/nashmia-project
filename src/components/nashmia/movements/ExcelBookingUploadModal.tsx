import React, { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  X,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  FolderOpen,
  Info,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Ban,
  Check,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSwipeToDismiss } from "@/hooks/use-swipe-to-dismiss";
import { useAuth } from "@/lib/auth-context";
import { showPillToast } from "@/lib/pill-toast";
import {
  parseAndPreviewExcelBookings,
  executeExcelBookingUpdates,
  type RowChangeItem,
  type ExcelUploadPreviewResult,
  type ExcelUploadExecutionResult,
  type RowChangeStatus,
} from "@/lib/excel-booking-service";
import type { FullBookingRecord } from "@/lib/supabase-services";

interface ExcelBookingUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingBookings: FullBookingRecord[];
  onUploadSuccess?: () => void;
}

type ModalStep = "upload" | "preview" | "processing" | "result";

const PROCESSING_STEPS = [
  "Reading Excel file",
  "Validating rows",
  "Matching existing bookings",
  "Comparing updated fields",
  "Updating database records",
  "Refreshing Movement Lifecycle data",
];

export function ExcelBookingUploadModal({
  isOpen,
  onClose,
  existingBookings,
  onUploadSuccess,
}: ExcelBookingUploadModalProps) {
  const { userId } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ModalStep>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Preview Data
  const [previewResult, setPreviewResult] = useState<ExcelUploadPreviewResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | RowChangeStatus>("all");
  const [searchFilter, setSearchFilter] = useState("");

  // Processing state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [processingStatusText, setProcessingStatusText] = useState("");

  // Result state
  const [executionResult, setExecutionResult] = useState<ExcelUploadExecutionResult | null>(null);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  // Touch-based swipe-down gestures for mobile bottom sheet
  const { elementRef: sheetElementRef, handleRef: sheetHandleRef } =
    useSwipeToDismiss<HTMLDivElement>({
      onDismiss: () => {
        if (step !== "processing") handleClose();
      },
      direction: "down",
      threshold: 65,
      enabled: step !== "processing",
    });

  // Reset modal state
  const handleReset = useCallback(() => {
    setSelectedFile(null);
    setPreviewResult(null);
    setStep("upload");
    setCurrentStepIndex(0);
    setProcessingProgress(0);
    setProcessedCount(0);
    setUpdatedCount(0);
    setSkippedCount(0);
    setErrorCount(0);
    setProcessingStatusText("");
    setExecutionResult(null);
    setShowErrorDetails(false);
    setStatusFilter("all");
    setSearchFilter("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleClose = useCallback(() => {
    if (step === "processing") return; // Prevent closing while processing is active
    handleReset();
    onClose();
  }, [step, handleReset, onClose]);

  // Handle file drop & selection
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  }, []);

  const validateAndSetFile = (file: File) => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const lowerName = file.name.toLowerCase();
    const isValid = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      toast.error("Invalid file format. Please upload an Excel file (.xlsx, .xls, or .csv).");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      toast.error("File size exceeds 25 MB limit. Please upload a smaller file.");
      return;
    }

    setSelectedFile(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileExtension = (name: string): string => {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";
  };

  // Process File to Preview
  const handleContinueToPreview = async () => {
    if (!selectedFile) return;

    setIsReadingFile(true);
    try {
      const buffer = await selectedFile.arrayBuffer();

      // Attempt backend API parsing first for secure server validation
      let result: ExcelUploadPreviewResult | null = null;
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        const res = await fetch("/api/excel-upload/preview", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.summary) {
            result = json as ExcelUploadPreviewResult;
          }
        }
      } catch (apiErr) {
        console.warn("[Excel Modal] Server preview notice, running client parser:", apiErr);
      }

      // If backend was unreachable or returned non-200, use robust client parser
      if (!result) {
        result = await parseAndPreviewExcelBookings(buffer, existingBookings);
      }

      setPreviewResult(result);
      setStep("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to read Excel file.";
      toast.error(msg);
      console.error("[Excel Read Error]", err);
    } finally {
      setIsReadingFile(false);
    }
  };

  // Filtered Changes in Preview Table
  const filteredChanges = useMemo(() => {
    if (!previewResult) return [];
    let list = previewResult.changes;

    if (statusFilter !== "all") {
      list = list.filter((item) => item.status === statusFilter);
    }

    if (searchFilter.trim()) {
      const q = searchFilter.trim().toLowerCase();
      list = list.filter(
        (item) =>
          (item.bookingReference && item.bookingReference.toLowerCase().includes(q)) ||
          (item.movementNumber && item.movementNumber.toLowerCase().includes(q)) ||
          item.fieldLabel.toLowerCase().includes(q) ||
          item.previousValue.toLowerCase().includes(q) ||
          item.newValue.toLowerCase().includes(q),
      );
    }

    return list;
  }, [previewResult, statusFilter, searchFilter]);

  // Execute Database Updates
  const handleConfirmAndApply = async () => {
    if (!previewResult) return;

    const willUpdateItems = previewResult.changes.filter((c) => c.status === "Will Update");
    if (willUpdateItems.length === 0) {
      toast.info("No rows with new updates detected.");
      return;
    }

    setStep("processing");
    setCurrentStepIndex(0);
    setProcessingProgress(5);
    setProcessingStatusText("Initiating secure update pipeline...");

    try {
      // Step 1: Reading Excel file
      setCurrentStepIndex(0);
      setProcessingProgress(15);
      await new Promise((r) => setTimeout(r, 200));

      // Step 2: Validating rows
      setCurrentStepIndex(1);
      setProcessingProgress(30);
      await new Promise((r) => setTimeout(r, 200));

      // Step 3: Matching existing bookings
      setCurrentStepIndex(2);
      setProcessingProgress(45);
      await new Promise((r) => setTimeout(r, 200));

      // Step 4: Comparing updated fields
      setCurrentStepIndex(3);
      setProcessingProgress(60);
      await new Promise((r) => setTimeout(r, 200));

      // Step 5: Updating database records
      setCurrentStepIndex(4);
      setProcessingProgress(75);

      let execResult: ExcelUploadExecutionResult | null = null;

      // Try server endpoint first
      try {
        const res = await fetch("/api/excel-upload/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirmedChanges: previewResult.changes,
            userId,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            execResult = json as ExcelUploadExecutionResult;
          }
        }
      } catch (serverErr) {
        console.warn("[Excel Modal] Server confirm notice, executing client updater:", serverErr);
      }

      // Client updater fallback if server endpoint was unreachable
      if (!execResult) {
        execResult = await executeExcelBookingUpdates(
          previewResult.changes,
          userId,
          (processed, total, stepText) => {
            setProcessedCount(processed);
            setProcessingStatusText(stepText);
            const dynamicProgress = 75 + Math.round((processed / Math.max(total, 1)) * 20);
            setProcessingProgress(Math.min(95, dynamicProgress));
          },
        );
      }

      // Step 6: Refreshing Movement Lifecycle data
      setCurrentStepIndex(5);
      setProcessingProgress(100);
      setProcessingStatusText("Movement Lifecycle records refreshed!");
      await new Promise((r) => setTimeout(r, 350));

      setExecutionResult(execResult);
      setStep("result");

      // Notify parent to refresh table
      onUploadSuccess?.();

      showPillToast.success(
        `Successfully updated ${execResult.totalUpdated} booking(s) across Movement Lifecycle.`,
        "Bookings Updated",
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute Excel update.";
      toast.error(msg);
      console.error("[Excel Execute Error]", err);
      setStep("preview");
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Excel Booking Upload Modal"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
    >
      {/* Full-screen Dark Backdrop covering whole window, navbar, and sidebar */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 ease-out"
        onClick={() => {
          if (step !== "processing") handleClose();
        }}
        aria-hidden="true"
      />
      <div
        ref={sheetElementRef}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full max-w-full sm:max-w-2xl bg-white shadow-2xl transition-all duration-300 max-h-[92vh] flex flex-col outline-none",
          // Mobile: smooth bottom sheet sliding from bottom
          "rounded-t-[28px] sm:rounded-[26px] border-t sm:border border-slate-200/90",
          step === "preview" && "sm:max-w-3xl lg:max-w-4xl",
        )}
      >
        {/* Mobile Swipe / Drag Handle Indicator */}
        <div
          ref={sheetHandleRef}
          data-swipe-handle="true"
          className="flex sm:hidden justify-center pt-2.5 pb-2 cursor-grab active:cursor-grabbing touch-none select-none"
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-300/80 hover:bg-slate-400 transition-colors" />
        </div>

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: EXCEL UPLOAD POPUP (Inspired by Reference Image)      */}
        {/* ------------------------------------------------------------- */}
        {step === "upload" && (
          <div className="flex flex-col h-full overflow-y-auto p-5 sm:p-7">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-[#E8F5F6] text-[#0FA3B1] flex items-center justify-center border border-[#0FA3B1]/20">
                  <Upload className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-[17px] sm:text-[18px] font-bold text-slate-900 tracking-tight">
                    Upload Bookings
                  </h3>
                  <p className="text-[12px] text-slate-500">
                    Bulk update Movement Lifecycle records via Excel spreadsheet.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Upload Area / Drop Zone (Faithfully matches user reference image) */}
            <div className="py-6">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative group flex flex-col items-center justify-center p-8 sm:p-10 rounded-[24px] border-2 border-dashed transition-all duration-200 cursor-pointer text-center",
                  isDragging
                    ? "border-[#0FA3B1] bg-[#0FA3B1]/5 scale-[0.99]"
                    : "border-slate-200/90 bg-slate-50/50 hover:border-[#0FA3B1]/50 hover:bg-slate-50/90",
                  selectedFile && "border-emerald-300 bg-emerald-50/30",
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Center Stylized Folder / File Icon */}
                <div className="relative mb-4">
                  <div className="size-16 sm:size-18 rounded-[20px] bg-gradient-to-tr from-[#3b5998] to-[#4c6ef5] text-white flex items-center justify-center shadow-[0_10px_25px_-5px_rgba(76,110,245,0.4)] transition-transform duration-200 group-hover:scale-105">
                    <FolderOpen className="size-8 stroke-[1.8]" />
                  </div>
                  {selectedFile && (
                    <div className="absolute -bottom-1 -right-1 size-6 rounded-full bg-emerald-500 text-white flex items-center justify-center ring-2 ring-white">
                      <Check className="size-3.5 stroke-[2.5]" />
                    </div>
                  )}
                </div>

                {/* Primary text */}
                <h4 className="text-[15px] sm:text-[16px] font-semibold text-slate-800 tracking-tight">
                  Drag your Excel file here to start uploading.
                </h4>

                {/* Secondary text */}
                <p className="mt-1 text-[12.5px] text-slate-400 font-medium">
                  Supported formats: XLSX, XLS, CSV
                </p>

                {/* "— OR —" divider line */}
                <div className="my-4 flex items-center justify-center w-48 max-w-full">
                  <div className="h-[1px] flex-1 bg-slate-200" />
                  <span className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    OR
                  </span>
                  <div className="h-[1px] flex-1 bg-slate-200" />
                </div>

                {/* Primary Browse Files Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="rounded-xl bg-[#4c6ef5] hover:bg-[#3b5bdb] active:scale-98 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(76,110,245,0.3)] transition-all cursor-pointer"
                >
                  Browse files
                </button>
              </div>

              {/* Selected File Card View */}
              {selectedFile && (
                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200/90 bg-white p-3 sm:p-3.5 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="size-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/70 shrink-0">
                      <FileSpreadsheet className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                        <span className="rounded bg-slate-100 px-1.5 py-0.2 font-mono uppercase text-slate-700 font-bold">
                          {getFileExtension(selectedFile.name)}
                        </span>
                        <span>•</span>
                        <span>{formatFileSize(selectedFile.size)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 pl-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[12px] font-semibold text-[#0FA3B1] hover:text-[#078A99] px-2.5 py-1 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFile(null)}
                      title="Remove file"
                      className="size-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Helpful Hint */}
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200/60 p-3 text-[12px] text-slate-600 flex items-start gap-2.5">
                <Info className="size-4 text-[#0FA3B1] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Excel rows will be matched to existing bookings by{" "}
                  <strong>Movement Number</strong>, <strong>Booking Reference</strong>, or{" "}
                  <strong>Container Number</strong>. Empty cells will never overwrite existing
                  database data.
                </p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedFile || isReadingFile}
                onClick={handleContinueToPreview}
                className="flex items-center gap-1.5 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all cursor-pointer"
              >
                {isReadingFile ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Reading Excel...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: UPLOAD PREVIEW POPUP (Matches user specification)    */}
        {/* ------------------------------------------------------------- */}
        {step === "preview" && previewResult && (
          <div className="flex flex-col h-full overflow-hidden p-5 sm:p-7">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-xl bg-[#E8F5F6] text-[#0FA3B1] flex items-center justify-center border border-[#0FA3B1]/20">
                  <FileSpreadsheet className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-[17px] sm:text-[18px] font-bold text-slate-900 tracking-tight">
                    Upload Preview
                  </h3>
                  <p className="text-[12px] text-slate-500">
                    Verify matched bookings and field comparisons before applying changes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close"
                className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Summary Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 py-4">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 text-center">
                <span className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Rows
                </span>
                <span className="text-[18px] font-bold text-slate-800">
                  {previewResult.summary.totalRows}
                </span>
              </div>
              <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-2.5 text-center">
                <span className="text-[10.5px] font-semibold text-blue-700 uppercase tracking-wider block">
                  Matched
                </span>
                <span className="text-[18px] font-bold text-blue-800">
                  {previewResult.summary.matchedCount}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-2.5 text-center">
                <span className="text-[10.5px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  With Changes
                </span>
                <span className="text-[18px] font-bold text-emerald-800">
                  {previewResult.summary.rowsWithChangesCount}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-2.5 text-center">
                <span className="text-[10.5px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Unchanged
                </span>
                <span className="text-[18px] font-bold text-slate-700">
                  {previewResult.summary.unchangedCount}
                </span>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-2.5 text-center">
                <span className="text-[10.5px] font-semibold text-amber-700 uppercase tracking-wider block">
                  Unmatched
                </span>
                <span className="text-[18px] font-bold text-amber-800">
                  {previewResult.summary.unmatchedCount}
                </span>
              </div>
              <div className="rounded-xl border border-rose-200/80 bg-rose-50/50 p-2.5 text-center">
                <span className="text-[10.5px] font-semibold text-rose-700 uppercase tracking-wider block">
                  Invalid / Errors
                </span>
                <span className="text-[18px] font-bold text-rose-800">
                  {previewResult.summary.invalidCount}
                </span>
              </div>
            </div>

            {/* Unmatched Notice Banner */}
            {previewResult.summary.unmatchedCount > 0 && (
              <div className="mb-3 rounded-xl bg-amber-50/90 border border-amber-200/80 p-3 text-[12px] text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  <strong>{previewResult.summary.unmatchedCount} record(s)</strong> do not match any
                  existing movement or booking reference in the database. As per security rules,
                  they <strong>will not be created</strong> automatically.
                </p>
              </div>
            )}

            {/* Filter Pills Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-[11px] sm:text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer",
                    statusFilter === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  All ({previewResult.changes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("Will Update")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer",
                    statusFilter === "Will Update"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
                  )}
                >
                  Will Update ({previewResult.summary.rowsWithChangesCount})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("Keep Existing")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer",
                    statusFilter === "Keep Existing"
                      ? "bg-slate-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  Keep Existing
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("Unchanged")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer",
                    statusFilter === "Unchanged"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100",
                  )}
                >
                  Unchanged ({previewResult.summary.unchangedCount})
                </button>
                {previewResult.summary.unmatchedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusFilter("Unmatched")}
                    className={cn(
                      "px-2.5 py-1 rounded-lg font-semibold transition-all shrink-0 cursor-pointer",
                      statusFilter === "Unmatched"
                        ? "bg-amber-600 text-white"
                        : "bg-amber-50 text-amber-700 hover:bg-amber-100",
                    )}
                  >
                    Unmatched ({previewResult.summary.unmatchedCount})
                  </button>
                )}
              </div>

              {/* Quick Search */}
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter preview table..."
                className="h-8 px-2.5 text-[12px] rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0FA3B1]"
              />
            </div>

            {/* Comparison Table (Exact columns requested by user) */}
            <div className="flex-1 overflow-y-auto border border-slate-200/80 rounded-xl min-h-[220px] max-h-[360px] bg-white">
              <table className="w-full text-left border-collapse text-[12.5px]">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px] uppercase tracking-wider z-10">
                  <tr>
                    <th className="px-3.5 py-2.5">Booking Reference / Movement</th>
                    <th className="px-3.5 py-2.5">Field</th>
                    <th className="px-3.5 py-2.5">Previous Value</th>
                    <th className="px-3.5 py-2.5">New Value</th>
                    <th className="px-3.5 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredChanges.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400 text-xs">
                        No rows found matching current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredChanges.map((item) => (
                      <tr
                        key={item.id}
                        className={cn(
                          "transition-colors",
                          item.status === "Will Update" &&
                            "bg-emerald-50/20 hover:bg-emerald-50/40",
                          item.status === "Unmatched" && "bg-amber-50/20 hover:bg-amber-50/40",
                          item.status === "Invalid" && "bg-rose-50/20 hover:bg-rose-50/40",
                          item.status === "Unchanged" && "hover:bg-slate-50/50",
                        )}
                      >
                        <td className="px-3.5 py-2.5 font-bold text-slate-900 font-mono text-[12px]">
                          {item.bookingReference || item.movementNumber || "—"}
                        </td>
                        <td className="px-3.5 py-2.5 font-medium text-slate-700">
                          {item.fieldLabel}
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-500 font-mono text-[11.5px]">
                          {item.previousValue}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <span
                            className={cn(
                              "font-mono text-[11.5px] font-semibold",
                              item.status === "Will Update"
                                ? "text-emerald-700 font-bold"
                                : item.newValue === "Empty"
                                  ? "text-slate-400 italic font-normal"
                                  : "text-slate-800",
                            )}
                          >
                            {item.newValue}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold shadow-2xs",
                              item.status === "Will Update" &&
                                "bg-emerald-50 text-emerald-700 border border-emerald-200/80",
                              item.status === "Keep Existing" &&
                                "bg-slate-100 text-slate-600 border border-slate-200/80",
                              item.status === "Unchanged" &&
                                "bg-blue-50 text-blue-700 border border-blue-200/60",
                              item.status === "Unmatched" &&
                                "bg-amber-50 text-amber-800 border border-amber-200/80",
                              item.status === "Invalid" &&
                                "bg-rose-50 text-rose-700 border border-rose-200/80",
                            )}
                          >
                            {item.status === "Will Update" && (
                              <CheckCircle2 className="size-3 text-emerald-600" />
                            )}
                            {item.status === "Keep Existing" && (
                              <Info className="size-3 text-slate-500" />
                            )}
                            {item.status === "Unmatched" && (
                              <Ban className="size-3 text-amber-600" />
                            )}
                            {item.status === "Invalid" && (
                              <AlertTriangle className="size-3 text-rose-600" />
                            )}
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep("upload")}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ArrowLeft className="size-3.5" />
                Back
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={previewResult.summary.rowsWithChangesCount === 0}
                  onClick={handleConfirmAndApply}
                  className="flex items-center gap-1.5 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] disabled:opacity-50 disabled:cursor-not-allowed px-4.5 py-2 text-[12.5px] font-bold text-white shadow-xs transition-all cursor-pointer"
                >
                  <Check className="size-3.5 stroke-[2.5]" />
                  Confirm & Update ({previewResult.summary.rowsWithChangesCount})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: PROFESSIONAL PROCESSING POPUP                         */}
        {/* ------------------------------------------------------------- */}
        {step === "processing" && (
          <div className="flex flex-col h-full p-6 sm:p-8 text-center items-center justify-center">
            {/* Pulsing Animated Loader Icon */}
            <div className="relative mb-5">
              <div className="size-16 rounded-full bg-[#E8F5F6] flex items-center justify-center text-[#0FA3B1] animate-pulse">
                <RefreshCw className="size-8 animate-spin" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-[#0FA3B1]/20 animate-ping opacity-40" />
            </div>

            <h3 className="text-[19px] font-bold text-slate-900 tracking-tight">
              Updating Movement Bookings
            </h3>
            <p className="mt-1 text-[13px] text-slate-500 max-w-sm">
              Please wait while the system validates, matches, and persists updates securely.
            </p>

            {/* Smooth Progress Bar */}
            <div className="mt-6 w-full max-w-md">
              <div className="flex items-center justify-between text-[12px] font-semibold text-slate-600 mb-1.5">
                <span>{processingStatusText || "Processing records..."}</span>
                <span className="font-mono text-[#0FA3B1]">{processingProgress}%</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#0FA3B1] to-[#078A99] transition-all duration-300 ease-out"
                  style={{ width: `${processingProgress}%` }}
                />
              </div>
            </div>

            {/* 6 Real-Time Processing Steps */}
            <div className="mt-6 w-full max-w-md rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 text-left divide-y divide-slate-100/80">
              {PROCESSING_STEPS.map((stepLabel, idx) => {
                const isComplete = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;
                const isPending = idx > currentStepIndex;

                return (
                  <div
                    key={stepLabel}
                    className="flex items-center justify-between py-2 text-[12px]"
                  >
                    <span
                      className={cn(
                        "font-medium",
                        isComplete && "text-slate-800 font-semibold",
                        isCurrent && "text-[#0FA3B1] font-bold",
                        isPending && "text-slate-400",
                      )}
                    >
                      {idx + 1}. {stepLabel}
                    </span>
                    <span className="shrink-0">
                      {isComplete && <CheckCircle2 className="size-4 text-emerald-500" />}
                      {isCurrent && <Loader2 className="size-4 text-[#0FA3B1] animate-spin" />}
                      {isPending && (
                        <span className="size-2 rounded-full bg-slate-300 block mr-1" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 4: COMPLETION RESULT POPUP                               */}
        {/* ------------------------------------------------------------- */}
        {step === "result" && executionResult && (
          <div className="flex flex-col h-full overflow-y-auto p-6 sm:p-8">
            <div className="text-center flex flex-col items-center">
              {/* Success Badge */}
              <div className="size-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center ring-8 ring-emerald-50/50 mb-3.5">
                <FileCheck className="size-8 stroke-[2.2]" />
              </div>

              <h3 className="text-[20px] font-bold text-slate-900 tracking-tight">
                Bookings Updated Successfully
              </h3>
              <p className="mt-1 text-[13px] text-slate-500 max-w-md">
                The Movement Lifecycle records have been updated in real-time. All audit logs and
                timeline events have been recorded.
              </p>
            </div>

            {/* Summary Statistics Grid */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-center">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Total Processed
                </span>
                <span className="text-[20px] font-bold text-slate-800">
                  {executionResult.totalProcessed}
                </span>
              </div>
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-center">
                <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                  Bookings Updated
                </span>
                <span className="text-[20px] font-bold text-emerald-700">
                  {executionResult.totalUpdated}
                </span>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 text-center">
                <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                  Unchanged Rows
                </span>
                <span className="text-[20px] font-bold text-slate-700">
                  {executionResult.totalUnchanged}
                </span>
              </div>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-center">
                <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
                  Skipped / Kept
                </span>
                <span className="text-[20px] font-bold text-amber-800">
                  {executionResult.totalSkippedOrInvalid}
                </span>
              </div>
            </div>

            {/* Errors Section (Collapsible) */}
            {executionResult.errors.length > 0 && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 text-left">
                <button
                  type="button"
                  onClick={() => setShowErrorDetails((prev) => !prev)}
                  className="flex items-center justify-between w-full text-[12.5px] font-semibold text-rose-800 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="size-4 text-rose-600" />
                    {executionResult.errors.length} Notice(s) or Warning(s)
                  </span>
                  {showErrorDetails ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </button>
                {showErrorDetails && (
                  <ul className="mt-2.5 space-y-1 text-[11.5px] text-rose-700 list-disc list-inside">
                    {executionResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Close / Action Buttons */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-center">
              <button
                type="button"
                onClick={handleClose}
                className="w-full sm:w-auto min-w-[180px] rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 px-6 py-2.5 text-[13px] font-bold text-white shadow-xs transition-all cursor-pointer"
              >
                Close & View Movements
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
