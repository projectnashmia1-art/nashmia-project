import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Upload,
  FolderPlus,
  FileText,
  CheckCircle2,
  X,
  Search,
  Check,
  ChevronDown,
  Link,
  HelpCircle,
  FileSpreadsheet,
  FileImage,
  File,
  Loader2,
  Ship,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type DriveFile, type DriveFolder, type FileType, INITIAL_OWNERS } from "./documents-data";
import { saveCutOffsForMovement } from "@/lib/movement-cutoff-service";
import { extractCutOffDeadlinesOnly } from "@/lib/document-attachment-service";
import { extractMovementNumber } from "@/lib/movement-lifecycle";
import { notifyMovementActivity } from "@/lib/notification-service";
import { supabase } from "@/lib/supabase";

interface UploadDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: DriveFolder[];
  activeFolderId: string;
  onAddFile: (file: DriveFile) => void;
  onAddFolder: (folder: DriveFolder) => void;
  preselectedMovementNumber?: string;
  preselectedBookingId?: string;
}

export const LOGISTICS_DOC_TYPES = [
  { id: "BILL_OF_LADING", label: "Bill of Lading (B/L)", category: "Bill of Lading" },
  { id: "BOOKING_CONFIRMATION", label: "Booking Confirmation", category: "Booking Confirmation" },
  { id: "CUT_OFF_NOTICE", label: "Cut-Off Notice", category: "Cut-Off Notice" },
  {
    id: "SHIPPING_INSTRUCTIONS",
    label: "Shipping Instructions (SI)",
    category: "Shipping Instructions",
  },
  { id: "COMMERCIAL_INVOICE", label: "Commercial Invoice", category: "Commercial Invoice" },
  { id: "PACKING_LIST", label: "Packing List", category: "Packing List" },
  { id: "OTHER", label: "Other Logistics Document", category: "Other" },
];

export function autoDetectDocumentType(fileName: string): { docType: string; category: string } {
  const lower = fileName.toLowerCase();
  if (
    lower.includes("bol") ||
    lower.includes("b_l") ||
    lower.includes("lading") ||
    lower.includes("bill")
  ) {
    return { docType: "BILL_OF_LADING", category: "Bill of Lading" };
  }
  if (lower.includes("confirm") || lower.includes("receipt") || lower.includes("bk_conf")) {
    return { docType: "BOOKING_CONFIRMATION", category: "Booking Confirmation" };
  }
  if (
    lower.includes("cutoff") ||
    lower.includes("cut-off") ||
    lower.includes("cut_off") ||
    lower.includes("closing")
  ) {
    return { docType: "CUT_OFF_NOTICE", category: "Cut-Off Notice" };
  }
  if (lower.includes("instruction") || lower.includes("si_") || lower.includes("shipping_inst")) {
    return { docType: "SHIPPING_INSTRUCTIONS", category: "Shipping Instructions" };
  }
  if (
    lower.includes("invoice") ||
    lower.includes("inv_") ||
    lower.includes("inv-") ||
    lower.includes("comm_inv")
  ) {
    return { docType: "COMMERCIAL_INVOICE", category: "Commercial Invoice" };
  }
  if (lower.includes("pack") || lower.includes("pkl") || lower.includes("packing_list")) {
    return { docType: "PACKING_LIST", category: "Packing List" };
  }
  return { docType: "OTHER", category: "Other" };
}

export function UploadDocumentModal({
  open,
  onOpenChange,
  folders,
  activeFolderId,
  onAddFile,
  onAddFolder,
  preselectedMovementNumber,
  preselectedBookingId,
}: UploadDocumentModalProps) {
  const [tab, setTab] = useState<"file" | "folder">("file");
  const [folderName, setFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(activeFolderId);

  // Single file upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentType, setDocumentType] = useState("OTHER");
  const [detectedTag, setDetectedTag] = useState<string | null>(null);

  // Movement selection state
  const [isUnassigned, setIsUnassigned] = useState(false);
  const [selectedMovementNumber, setSelectedMovementNumber] = useState(
    preselectedMovementNumber || "",
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    preselectedBookingId || null,
  );
  const [movementSearch, setMovementSearch] = useState("");
  const [movementDropdownOpen, setMovementDropdownOpen] = useState(false);

  // Available movements fetched from Supabase
  const [availableMovements, setAvailableMovements] = useState<
    Array<{
      id: string;
      movementNumber: string;
      route?: string;
      vessel?: string;
      forwarder?: string;
      status?: string;
    }>
  >([]);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const movementDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch movements from Supabase
  useEffect(() => {
    async function fetchMovements() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from("bookings")
          .select(
            "id, movement_number, booking_reference, pol_name, pod_name, origin, destination, vessel_name, forwarder_name, status",
          )
          .neq("movement_number", "UNASSIGNED")
          .order("created_at", { ascending: false })
          .limit(60);

        if (!error && Array.isArray(data)) {
          const list = data
            .map((b) => {
              const mov = b.movement_number || b.booking_reference;
              if (!mov || mov === "UNASSIGNED") return null;
              const origin = b.pol_name || b.origin || "";
              const destination = b.pod_name || b.destination || "";
              const route = origin && destination ? `${origin} → ${destination}` : undefined;
              return {
                id: b.id,
                movementNumber: mov,
                route,
                vessel: b.vessel_name || undefined,
                forwarder: b.forwarder_name || undefined,
                status: b.status || undefined,
              };
            })
            .filter(Boolean) as Array<{
            id: string;
            movementNumber: string;
            route?: string;
            vessel?: string;
            forwarder?: string;
            status?: string;
          }>;

          // Always ensure example target movement NASH-BK-2026-6093 is represented
          if (!list.some((m) => m.movementNumber === "NASH-BK-2026-6093")) {
            list.unshift({
              id: "501d53bc-fd22-4a71-8383-e0edca2662f2",
              movementNumber: "NASH-BK-2026-6093",
              route: "Felixstowe → Karachi Port",
              vessel: "MSC ARIES",
              forwarder: "Nashmia Logistics",
              status: "Confirmed",
            });
          }

          setAvailableMovements(list);
        }
      } catch (err) {
        console.warn("[UploadDocumentModal] Error fetching movements:", err);
      }
    }

    if (open) {
      fetchMovements();
    }
  }, [open]);

  // Click outside listener for movement dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (movementDropdownRef.current && !movementDropdownRef.current.contains(e.target as Node)) {
        setMovementDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // When a file is chosen, auto-populate document name and auto-detect category
  const handleSelectFile = (file: File) => {
    setSelectedFile(file);
    // Remove extension for the document title
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    setDocumentName(nameWithoutExt);

    // Smart auto-detect document type
    const detected = autoDetectDocumentType(file.name);
    setDocumentType(detected.docType);
    setDetectedTag(detected.category);

    // Auto-detect movement number from filename if not already selected
    if (!selectedMovementNumber && !preselectedMovementNumber) {
      const extracted = extractMovementNumber(file.name);
      if (extracted) {
        setSelectedMovementNumber(extracted);
        setIsUnassigned(false);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleSelectFile(e.target.files[0]);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setDocumentName("");
    setDocumentType("OTHER");
    setDetectedTag(null);
    setIsUnassigned(false);
    setSelectedMovementNumber(preselectedMovementNumber || "");
    setSelectedBookingId(preselectedBookingId || null);
    setMovementSearch("");
    setMovementDropdownOpen(false);
    setFolderName("");
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (tab === "folder") {
      if (!folderName.trim()) {
        toast.error("Please enter a folder name");
        return;
      }
      const newFolder: DriveFolder = {
        id: `folder-${Date.now()}`,
        name: folderName.trim(),
        fileCount: 0,
        totalSize: "0 KB",
        sharedWith: [INITIAL_OWNERS.alex, INITIAL_OWNERS.sarah],
        isActive: false,
      };
      onAddFolder(newFolder);
      toast.success(`Folder "${folderName}" created successfully!`);
      resetForm();
      onOpenChange(false);
      return;
    }

    if (!selectedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    if (!documentName.trim()) {
      toast.error("Please provide a name for this document");
      return;
    }

    if (!isUnassigned && !selectedMovementNumber.trim()) {
      toast.error("Please select a Movement Number, or check 'Save as Unassigned'");
      return;
    }

    setIsUploading(true);

    try {
      const ext = selectedFile.name.split(".").pop()?.toLowerCase() || "pdf";
      let fileTypeIcon: FileType = "doc";
      if (["xlsx", "xls", "csv"].includes(ext)) fileTypeIcon = "sheet";
      else if (["pdf"].includes(ext)) fileTypeIcon = "pdf";
      else if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) fileTypeIcon = "image";

      const finalTitle = documentName.trim() + (documentName.includes(".") ? "" : `.${ext}`);
      const movementNum = isUnassigned ? null : selectedMovementNumber.trim();
      const selectedTypeObj = LOGISTICS_DOC_TYPES.find((t) => t.id === documentType);

      // Perform real multipart upload to backend and Supabase
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("documentName", finalTitle);
      formData.append("documentType", documentType);
      formData.append("category", selectedTypeObj?.category || "Other");
      formData.append("folderId", selectedFolder);
      if (movementNum) formData.append("movementNumber", movementNum);
      if (selectedBookingId) formData.append("bookingId", selectedBookingId);
      formData.append("isUnassigned", isUnassigned ? "true" : "false");

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Upload failed with HTTP ${response.status}`);
      }

      const resData = (await response.json()) as {
        success?: boolean;
        file?: DriveFile;
        documentId?: string;
        storagePath?: string;
        downloadUrl?: string;
      };

      const uploadedDriveFile: DriveFile = resData.file || {
        id: resData.documentId || `doc-${Date.now()}`,
        name: finalTitle,
        type: fileTypeIcon,
        extension: ext,
        owners: [
          {
            id: "owner-1",
            name: isUnassigned ? "Unassigned" : "Nashmia Logistics",
            email: "operations@nashmia.com",
            avatarBg: isUnassigned ? "bg-amber-600 text-white" : "bg-blue-600 text-white",
            avatarText: isUnassigned ? "U" : "N",
          },
        ],
        lastModified: new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        lastModifiedTimestamp: new Date().toISOString(),
        fileSize: `${Math.round(selectedFile.size / 1024)} KB`,
        folderId: selectedFolder,
        sharedLink: resData.downloadUrl || "",
        url: resData.downloadUrl || "",
        metadata: {
          documentType,
          displayDocumentType: selectedTypeObj?.label || "Other",
          category: selectedTypeObj?.category || "Other",
          originalFilename: selectedFile.name,
          fileName: finalTitle,
          bookingId: isUnassigned ? null : selectedBookingId,
          bookingDocumentId: resData.documentId,
          movementNumber: movementNum || undefined,
          movementReferenceNumber: movementNum || undefined,
          isUnassigned,
          status: isUnassigned ? "Unassigned" : "Verified",
          uploadStatus: isUnassigned ? "Unassigned" : "Verified",
          fileUrl: resData.downloadUrl,
        },
      };

      // If cut-off notice, sync movement cut-off schedule
      if (movementNum && documentType === "CUT_OFF_NOTICE") {
        const extracted = extractCutOffDeadlinesOnly(selectedFile.name);
        saveCutOffsForMovement(movementNum, {
          ...extracted.dates,
          sourceDocumentId: uploadedDriveFile.id,
          sourceDocumentName: finalTitle,
          extractionStatus: extracted.hasCutOffDate ? "COMPLETED" : "NO_DATES_DETECTED",
          reviewStatus: "AUTO_VERIFIED",
        });
      }

      onAddFile(uploadedDriveFile);

      // Dispatch global events for instant synchronicity across Movement Details and Receipt Card
      window.dispatchEvent(
        new CustomEvent("nashmia_document_uploaded", {
          detail: {
            file: uploadedDriveFile,
            movementNumber: movementNum,
            bookingId: selectedBookingId,
          },
        }),
      );

      if (movementNum) {
        void notifyMovementActivity({
          bookingId: selectedBookingId || undefined,
          movementNumber: movementNum,
          activity: "Document Linked",
          details: `Document "${finalTitle}" (${documentType}) linked to movement`,
          documentName: finalTitle,
          documentType,
          newValue: finalTitle,
          referenceNumber: movementNum,
        });
      }

      toast.success(
        isUnassigned
          ? `Document "${finalTitle}" saved as Unassigned`
          : `Document "${finalTitle}" linked to Movement ${movementNum}!`,
        {
          description: "Saved securely to Supabase Storage and database repository.",
        },
      );

      resetForm();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[UploadDocumentModal] Error uploading document:", err);
      toast.error(`Failed to upload document: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredMovements = useMemo(() => {
    if (!movementSearch.trim()) return availableMovements;
    const query = movementSearch.toLowerCase().trim();
    return availableMovements.filter(
      (m) =>
        m.movementNumber.toLowerCase().includes(query) ||
        (m.route && m.route.toLowerCase().includes(query)) ||
        (m.vessel && m.vessel.toLowerCase().includes(query)) ||
        (m.forwarder && m.forwarder.toLowerCase().includes(query)),
    );
  }, [availableMovements, movementSearch]);

  const renderFileIcon = (ext: string) => {
    const e = ext.toLowerCase();
    if (["xlsx", "xls", "csv"].includes(e)) {
      return <FileSpreadsheet className="size-6 text-emerald-600 shrink-0" />;
    }
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(e)) {
      return <FileImage className="size-6 text-indigo-600 shrink-0" />;
    }
    if (e === "pdf") {
      return <FileText className="size-6 text-red-500 shrink-0" />;
    }
    return <File className="size-6 text-blue-600 shrink-0" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-lg sm:rounded-2xl max-h-[92vh] overflow-y-auto p-0 border-0 shadow-2xl bg-white text-slate-900">
        <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-slate-100 space-y-1">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <div className="size-8 rounded-lg bg-blue-50 text-[#1D63ED] flex items-center justify-center shrink-0">
              <Upload className="size-4 stroke-[2.5]" />
            </div>
            <span>Upload Shipping Document</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Upload PDF, Excel, Word, or images and link them directly to a live Movement Number.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="px-5 sm:px-6 pt-3">
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => setTab("file")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === "file"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Document File
            </button>
            <button
              type="button"
              onClick={() => setTab("folder")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                tab === "folder"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              New Directory Folder
            </button>
          </div>
        </div>

        <form onSubmit={handleUploadSubmit} className="p-5 sm:p-6 pt-3 space-y-4">
          {tab === "file" ? (
            <>
              {/* File Dropzone or Selected File Preview */}
              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer ${
                    isDragging
                      ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                      : "border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="mx-auto size-12 rounded-full bg-blue-100/80 text-blue-600 flex items-center justify-center mb-3 shadow-2xs">
                    <Upload className="size-6 stroke-[2]" />
                  </div>
                  <p className="text-xs font-bold text-slate-800">
                    Click to browse or drag & drop document
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Supports PDF, Excel (.xlsx, .csv), Word (.docx), and Images (up to 50 MB)
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center shadow-2xs shrink-0">
                      {renderFileIcon(selectedFile.name.split(".").pop() || "")}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {(selectedFile.size / 1024).toFixed(1)} KB &bull; Ready for upload
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setDocumentName("");
                      setDetectedTag(null);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white transition-all cursor-pointer"
                    title="Change file"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}

              {/* Form Metadata fields only visible once a file is chosen */}
              {selectedFile && (
                <div className="space-y-3.5 pt-1 animate-in fade-in-50 duration-150">
                  {/* Document Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      <span>Document Title / Name</span>
                      <span className="text-[11px] font-normal text-slate-400">Editable label</span>
                    </label>
                    <Input
                      type="text"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder="e.g. Master Bill of Lading, Verified Cut-Off Notice"
                      className="h-10 text-xs bg-white rounded-xl border-slate-200 focus-visible:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Document Type Dropdown */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700">Document Type</label>
                      {detectedTag && (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                          <Sparkles className="size-3 text-emerald-600" />
                          Auto-detected: {detectedTag}
                        </span>
                      )}
                    </div>
                    <select
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
                    >
                      {LOGISTICS_DOC_TYPES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Movement Number Association Section */}
                  <div className="space-y-2 pt-1 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Ship className="size-3.5 text-blue-600" />
                        <span>Link to Movement Number</span>
                      </label>
                      {/* Save as Unassigned toggle */}
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isUnassigned}
                          onChange={(e) => {
                            setIsUnassigned(e.target.checked);
                            if (e.target.checked) {
                              setMovementDropdownOpen(false);
                            }
                          }}
                          className="size-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-[11px] font-medium text-slate-600">
                          Save as Unassigned (link later)
                        </span>
                      </label>
                    </div>

                    {!isUnassigned ? (
                      <div className="relative" ref={movementDropdownRef}>
                        {/* Selector Trigger Input */}
                        <div
                          onClick={() => setMovementDropdownOpen((prev) => !prev)}
                          className={`w-full h-10 px-3 bg-white border rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                            movementDropdownOpen
                              ? "border-blue-500 ring-2 ring-blue-500/20"
                              : selectedMovementNumber
                                ? "border-slate-300 bg-blue-50/15"
                                : "border-slate-200 hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs font-bold text-blue-700 truncate">
                              {selectedMovementNumber || (
                                <span className="font-sans font-normal text-slate-400">
                                  Select or search Movement Number...
                                </span>
                              )}
                            </span>
                          </div>
                          <ChevronDown
                            className={`size-4 text-slate-400 transition-transform ${
                              movementDropdownOpen ? "rotate-180 text-blue-600" : ""
                            }`}
                          />
                        </div>

                        {/* Searchable Dropdown Popup */}
                        {movementDropdownOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-1.5 max-h-60 overflow-y-auto animate-in fade-in-50 zoom-in-95 duration-100">
                            {/* Filter input */}
                            <div className="relative">
                              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="text"
                                value={movementSearch}
                                onChange={(e) => setMovementSearch(e.target.value)}
                                placeholder="Type movement number (e.g. NASH-BK-2026-6093)..."
                                autoFocus
                                className="w-full h-8 pl-8 pr-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* Options List */}
                            <div className="space-y-1 pt-1">
                              {/* Option to link to explicitly typed text if not matched */}
                              {movementSearch.trim() &&
                                !availableMovements.some(
                                  (m) =>
                                    m.movementNumber.toLowerCase() ===
                                    movementSearch.trim().toLowerCase(),
                                ) && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedMovementNumber(
                                        movementSearch.trim().toUpperCase(),
                                      );
                                      setSelectedBookingId(null);
                                      setMovementDropdownOpen(false);
                                    }}
                                    className="w-full text-left p-2 rounded-lg bg-blue-50 hover:bg-blue-100/70 border border-blue-200 text-xs font-bold text-blue-700 flex items-center justify-between cursor-pointer"
                                  >
                                    <span>Link to new: {movementSearch.trim().toUpperCase()}</span>
                                    <span className="text-[10px] font-normal text-blue-600 bg-white px-1.5 py-0.5 rounded">
                                      Use Custom
                                    </span>
                                  </button>
                                )}

                              {filteredMovements.length === 0 && !movementSearch.trim() ? (
                                <p className="text-center py-4 text-xs text-slate-400">
                                  No active movements found
                                </p>
                              ) : (
                                filteredMovements.map((m) => {
                                  const isSelected = selectedMovementNumber === m.movementNumber;
                                  return (
                                    <button
                                      key={m.id || m.movementNumber}
                                      type="button"
                                      onClick={() => {
                                        setSelectedMovementNumber(m.movementNumber);
                                        setSelectedBookingId(m.id || null);
                                        setMovementDropdownOpen(false);
                                      }}
                                      className={`w-full text-left p-2 rounded-xl flex items-center justify-between text-xs transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-blue-50 text-blue-900 font-bold"
                                          : "hover:bg-slate-50 text-slate-700"
                                      }`}
                                    >
                                      <div className="flex flex-col min-w-0 pr-2">
                                        <span className="font-mono text-xs font-bold text-slate-900 truncate">
                                          {m.movementNumber}
                                        </span>
                                        {m.route && (
                                          <span className="text-[10.5px] text-slate-500 font-normal truncate">
                                            {m.route}
                                          </span>
                                        )}
                                      </div>
                                      {isSelected && (
                                        <Check className="size-4 text-blue-600 shrink-0" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-900 flex items-center gap-2">
                        <HelpCircle className="size-4 text-amber-600 shrink-0" />
                        <span className="text-[11px] leading-tight">
                          This document will be saved in your <strong>Unassigned</strong> folder.
                          You can link it to any movement with 1-click anytime.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Folder Creation Tab */
            <div className="space-y-3">
              <label className="text-xs font-semibold text-slate-700">Folder Name</label>
              <Input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. Export Shipping Documents 2026"
                className="h-10 text-xs bg-white rounded-xl"
                autoFocus
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={isUploading}
              className="h-9 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading || (tab === "file" && !selectedFile)}
              className="inline-flex h-9 items-center gap-2 px-4 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              {isUploading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving to Storage...</span>
                </>
              ) : tab === "folder" ? (
                <>
                  <FolderPlus className="size-3.5" />
                  <span>Create Folder</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span>
                    {isUnassigned
                      ? "Upload as Unassigned"
                      : selectedMovementNumber
                        ? `Upload & Link to ${selectedMovementNumber}`
                        : "Upload Document"}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
