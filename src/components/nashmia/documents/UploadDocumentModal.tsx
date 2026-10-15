import React, { useState, useRef } from "react";
import { Upload, FolderPlus, FileText, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DriveFile, type DriveFolder, type FileType } from "./documents-data";
import { saveCutOffsForMovement } from "@/lib/movement-cutoff-service";
import { extractCutOffDeadlinesOnly } from "@/lib/document-attachment-service";
import { extractMovementNumber } from "@/lib/movement-lifecycle";

interface UploadDocumentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: DriveFolder[];
  activeFolderId: string;
  onAddFile: (file: DriveFile) => void;
  onAddFolder: (folder: DriveFolder) => void;
}

export function UploadDocumentModal({
  open,
  onOpenChange,
  folders,
  activeFolderId,
  onAddFile,
  onAddFolder,
}: UploadDocumentModalProps) {
  const [tab, setTab] = useState<"file" | "folder">("file");
  const [folderName, setFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(activeFolderId);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
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
      setFolderName("");
      onOpenChange(false);
      return;
    }

    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }

    selectedFiles.forEach((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase() || "file";
      let type: FileType = "doc";
      if (["xlsx", "xls", "csv"].includes(ext)) type = "sheet";
      else if (["pdf"].includes(ext)) type = "pdf";
      else if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) type = "image";

      const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
      const formattedSize =
        file.size > 1024 * 1024 ? `${sizeInMb} MB` : `${Math.round(file.size / 1024)} KB`;

      const now = new Date();
      const formattedDate = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      const detectedMovement = extractMovementNumber(file.name);
      const isCutOffNotice =
        file.name.toLowerCase().includes("cutoff") ||
        file.name.toLowerCase().includes("cut-off") ||
        file.name.toLowerCase().includes("gate_cutoff") ||
        file.name.toLowerCase().includes("si_cutoff");

      const extractedCutOffs = isCutOffNotice
        ? extractCutOffDeadlinesOnly(file.name)
        : { deadlines: [], dates: {} };

      const newDriveFile: DriveFile = {
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        name: file.name,
        type,
        extension: ext,
        owners: [],
        lastModified: formattedDate,
        lastModifiedTimestamp: now.toISOString(),
        fileSize: formattedSize,
        folderId: selectedFolder,
        sharedLink: "",
        metadata: {
          category: isCutOffNotice ? "Cut-Off Notice" : "Other",
          documentType: isCutOffNotice ? "CUT_OFF_NOTICE" : "OTHER",
          movementNumber: detectedMovement || undefined,
          hasCutOffDate: extractedCutOffs.hasCutOffDate,
          detectedCutOffDate: extractedCutOffs.detectedCutOffDate,
          cutOffDeadlines:
            extractedCutOffs.deadlines.length > 0 ? extractedCutOffs.deadlines : undefined,
          cutOffDates: extractedCutOffs.dates,
        },
      };

      if (detectedMovement && isCutOffNotice) {
        saveCutOffsForMovement(detectedMovement, {
          ...extractedCutOffs.dates,
          sourceDocumentId: newDriveFile.id,
          sourceDocumentName: file.name,
          extractionStatus: extractedCutOffs.hasCutOffDate ? "COMPLETED" : "NO_DATES_DETECTED",
          reviewStatus: extractedCutOffs.hasAmbiguousDates ? "NEEDS_REVIEW" : "AUTO_VERIFIED",
        });
      }

      onAddFile(newDriveFile);
    });

    toast.success(`${selectedFiles.length} file(s) uploaded successfully!`);
    setSelectedFiles([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Upload className="size-4 text-[#1D63ED]" /> Add to My Drive
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Upload documents, images, spreadsheets or create a new directory folder.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setTab("file")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === "file"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Upload Files
          </button>
          <button
            type="button"
            onClick={() => setTab("folder")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              tab === "folder"
                ? "bg-white text-slate-800 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            New Folder
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="space-y-4 mt-2">
          {tab === "file" ? (
            <>
              {/* Drag and drop target */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-[#1D63ED] bg-blue-50/50"
                    : "border-slate-200 hover:border-blue-400 bg-slate-50/50"
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  multiple
                  className="hidden"
                />
                <div className="size-10 rounded-xl bg-blue-100 text-[#1D63ED] flex items-center justify-center mx-auto mb-2">
                  <Upload className="size-5" />
                </div>
                <div className="text-xs font-bold text-slate-700">
                  Click to upload or drag & drop
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  PDF, DOCX, XLSX, JPG, PNG up to 100MB
                </div>
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {selectedFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs"
                    >
                      <span className="font-medium text-slate-700 truncate max-w-[240px]">
                        {f.name}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Folder destination selector */}
              <div>
                <LifecycleDropdownSelect
                  label="DESTINATION FOLDER"
                  value={selectedFolder}
                  onChange={(val) => setSelectedFolder(val)}
                  options={[
                    { value: "root", label: "My Drive (Root)" },
                    ...folders.map((f) => ({ value: f.id, label: f.name })),
                  ]}
                  placeholder="Select Destination Folder"
                  activeColor="blue"
                  triggerClassName="w-full text-xs h-9"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Folder Name
              </label>
              <Input
                placeholder="e.g. Design Files, Invoices, Marketing"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="text-xs h-9"
                autoFocus
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-[#1D63ED] hover:bg-blue-700 text-white text-xs font-semibold"
            >
              {tab === "file" ? "Upload" : "Create Folder"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
