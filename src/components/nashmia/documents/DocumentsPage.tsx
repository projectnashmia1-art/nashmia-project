import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Folder,
  FileText,
  Clock,
  Ship,
  File,
  Search,
  SlidersHorizontal,
  Calendar,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Download,
  MoreVertical,
  Share2,
  Trash2,
  Receipt,
  Image as ImageIcon,
  Archive,
  Menu,
  ShieldCheck,
  Link as LinkIcon,
  Check,
  Plus,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentsSummaryStrip } from "./DocumentsSummaryStrip";
import { PillPagination } from "../common/PillPagination";
import { LifecycleDropdownSelect } from "../common/LifecycleDropdownSelect";
import { FileDetailsDrawer } from "./FileDetailsDrawer";
import { ShareDocumentModal } from "./ShareDocumentModal";
import { UploadDocumentModal } from "./UploadDocumentModal";
import { DocumentPreviewDialog } from "./DocumentPreviewDialog";
import { ManualReviewLinkModal } from "./ManualReviewLinkModal";
import { FileThumbnailIcon } from "./FileThumbnailIcon";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import {
  INITIAL_FOLDERS,
  INITIAL_FILES,
  getSavedDocuments,
  saveDriveDocument,
  removeDriveDocument,
  type DriveFile,
  type DriveFolder,
} from "./documents-data";

interface DocumentsPageProps {
  onOpenMobileMenu?: () => void;
  isLoading?: boolean;
}

type SortField = "document" | "movement" | "documentType" | "forwarder" | "receivedDate";
type SortOrder = "asc" | "desc";

export function DocumentsPage({ onOpenMobileMenu }: DocumentsPageProps) {
  const { organizationId } = useAuth();

  // State
  const [folders, setFolders] = useState<DriveFolder[]>(INITIAL_FOLDERS);
  const [files, setFiles] = useState<DriveFile[]>(INITIAL_FILES);

  // Selected file ids for bulk actions & checkboxes
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Search & Filter state matching design
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMovement, setSelectedMovement] = useState<string>("all");
  const [selectedDocType, setSelectedDocType] = useState<string>("all");
  const [selectedForwarder, setSelectedForwarder] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [activeStatFilter, setActiveStatFilter] = useState<"all" | "cutoff" | "bl" | "other">(
    "all",
  );

  // Sorting
  const [sortField, setSortField] = useState<SortField>("receivedDate");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination (8 items per page exactly as in reference screenshot)
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modals & Drawers
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [activeItemForDetails, setActiveItemForDetails] = useState<{
    file: DriveFile | null;
    folder: DriveFolder | null;
  }>({ file: null, folder: null });

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTargetItem, setShareTargetItem] = useState<DriveFile | DriveFolder | null>(null);

  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<DriveFile | null>(null);

  const [manualReviewModalOpen, setManualReviewModalOpen] = useState(false);
  const [manualReviewDoc, setManualReviewDoc] = useState<DriveFile | null>(null);

  // Dynamic Statistics computed from current dataset
  const totalCount = files.length;
  const cutoffCount = useMemo(() => {
    return files.filter(
      (f) =>
        f.metadata?.typeTag === "Cut-Off" ||
        f.metadata?.category === "Cut-Off Notice" ||
        f.metadata?.documentType?.toLowerCase().includes("cut-off") ||
        f.name.toLowerCase().includes("cutoff") ||
        f.name.toLowerCase().includes("cut-off"),
    ).length;
  }, [files]);

  const blCount = useMemo(() => {
    return files.filter(
      (f) =>
        f.metadata?.typeTag === "BL" ||
        f.metadata?.typeTag === "Bill of Lading" ||
        f.metadata?.category === "Bill of Lading" ||
        f.metadata?.documentType?.toLowerCase().includes("bill of lading") ||
        f.name.toLowerCase().includes("bl_") ||
        f.name.toLowerCase().includes("bl-") ||
        f.name.toLowerCase().includes("bill"),
    ).length;
  }, [files]);

  const otherCount = useMemo(() => {
    return Math.max(0, totalCount - cutoffCount - blCount);
  }, [totalCount, cutoffCount, blCount]);

  // Unique lists for filter dropdowns
  const availableMovements = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      const mov = f.metadata?.movementNumber || f.metadata?.movementReferenceNumber;
      if (mov && mov !== "—") set.add(mov);
    });
    return Array.from(set).sort();
  }, [files]);

  const availableForwarders = useMemo(() => {
    const set = new Set<string>();
    files.forEach((f) => {
      const fwd = f.metadata?.forwarderName || f.metadata?.forwarder;
      if (fwd) set.add(fwd);
    });
    return Array.from(set).sort();
  }, [files]);

  // Filtering Logic
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // 1. Stat card shortcut filter
      if (activeStatFilter === "cutoff") {
        const isCutoff =
          file.metadata?.typeTag === "Cut-Off" ||
          file.metadata?.category === "Cut-Off Notice" ||
          file.name.toLowerCase().includes("cutoff") ||
          file.name.toLowerCase().includes("cut-off");
        if (!isCutoff) return false;
      } else if (activeStatFilter === "bl") {
        const isBL =
          file.metadata?.typeTag === "BL" ||
          file.metadata?.typeTag === "Bill of Lading" ||
          file.metadata?.category === "Bill of Lading" ||
          file.name.toLowerCase().includes("bl_") ||
          file.name.toLowerCase().includes("bl-") ||
          file.name.toLowerCase().includes("bill");
        if (!isBL) return false;
      } else if (activeStatFilter === "other") {
        const isCutoff =
          file.metadata?.typeTag === "Cut-Off" ||
          file.metadata?.category === "Cut-Off Notice" ||
          file.name.toLowerCase().includes("cutoff") ||
          file.name.toLowerCase().includes("cut-off");
        const isBL =
          file.metadata?.typeTag === "BL" ||
          file.metadata?.typeTag === "Bill of Lading" ||
          file.metadata?.category === "Bill of Lading" ||
          file.name.toLowerCase().includes("bl_") ||
          file.name.toLowerCase().includes("bl-") ||
          file.name.toLowerCase().includes("bill");
        if (isCutoff || isBL) return false;
      }

      // 2. Search query (Locate by Document Name, Movement Number, Original Filename, Forwarder, Source Email, Doc Type)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = file.name.toLowerCase().includes(query);
        const matchesOriginalName = Boolean(
          file.metadata?.originalFilename?.toLowerCase().includes(query),
        );
        const matchesMov = Boolean(
          file.metadata?.movementNumber?.toLowerCase().includes(query) ||
          file.metadata?.movementReferenceNumber?.toLowerCase().includes(query) ||
          file.metadata?.bookingId?.toLowerCase().includes(query),
        );
        const matchesVessel = Boolean(file.metadata?.vesselName?.toLowerCase().includes(query));
        const matchesFwd = Boolean(
          file.metadata?.forwarderName?.toLowerCase().includes(query) ||
          file.metadata?.forwarder?.toLowerCase().includes(query) ||
          file.metadata?.senderEmail?.toLowerCase().includes(query) ||
          file.metadata?.sourceEmail?.toLowerCase().includes(query),
        );
        const matchesDocType = Boolean(
          file.metadata?.documentType?.toLowerCase().includes(query) ||
          file.metadata?.displayDocumentType?.toLowerCase().includes(query) ||
          file.metadata?.typeTag?.toLowerCase().includes(query) ||
          file.metadata?.category?.toLowerCase().includes(query),
        );
        if (
          !matchesName &&
          !matchesOriginalName &&
          !matchesMov &&
          !matchesVessel &&
          !matchesFwd &&
          !matchesDocType
        ) {
          return false;
        }
      }

      // 3. Movement filter (Locate documents by Movement Number)
      if (selectedMovement !== "all") {
        const fileMov = file.metadata?.movementNumber || file.metadata?.movementReferenceNumber;
        if (fileMov !== selectedMovement) return false;
      }

      // 4. Document Type filter
      if (selectedDocType !== "all") {
        const tag = (
          file.metadata?.typeTag ||
          file.metadata?.documentType ||
          file.metadata?.displayDocumentType ||
          file.metadata?.category ||
          ""
        ).toLowerCase();
        if (!tag.includes(selectedDocType.toLowerCase())) return false;
      }

      // 5. Forwarder filter
      if (selectedForwarder !== "all") {
        const fileFwd = (
          file.metadata?.forwarderName ||
          file.metadata?.forwarder ||
          ""
        ).toLowerCase();
        if (fileFwd !== selectedForwarder.toLowerCase()) return false;
      }

      // 6. Status filter
      if (selectedStatus !== "all") {
        const status = (
          file.metadata?.uploadStatus ||
          file.metadata?.status ||
          "Processed"
        ).toLowerCase();
        if (!status.includes(selectedStatus.toLowerCase())) return false;
      }

      return true;
    });
  }, [
    files,
    activeStatFilter,
    searchQuery,
    selectedMovement,
    selectedDocType,
    selectedForwarder,
    selectedStatus,
  ]);

  // Sorting Logic
  const sortedFiles = useMemo(() => {
    return [...filteredFiles].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "document":
          comparison = a.name.localeCompare(b.name);
          break;
        case "movement":
          comparison = (a.metadata?.movementNumber || "").localeCompare(
            b.metadata?.movementNumber || "",
          );
          break;
        case "documentType":
          comparison = (a.metadata?.documentType || "").localeCompare(
            b.metadata?.documentType || "",
          );
          break;
        case "forwarder":
          comparison = (a.metadata?.forwarderName || "").localeCompare(
            b.metadata?.forwarderName || "",
          );
          break;
        case "receivedDate":
        default: {
          const timeA = new Date(a.lastModifiedTimestamp || a.lastModified).getTime();
          const timeB = new Date(b.lastModifiedTimestamp || b.lastModified).getTime();
          comparison = timeA - timeB;
          break;
        }
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [filteredFiles, sortField, sortOrder]);

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(sortedFiles.length / pageSize));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedFiles = useMemo(() => {
    const startIndex = (currentSafePage - 1) * pageSize;
    return sortedFiles.slice(startIndex, startIndex + pageSize);
  }, [sortedFiles, currentSafePage, pageSize]);

  const startRecord = sortedFiles.length === 0 ? 0 : (currentSafePage - 1) * pageSize + 1;
  const endRecord = Math.min(currentSafePage * pageSize, sortedFiles.length);

  // Toggle sorting on column click
  const handleSortToggle = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Checkbox handlers
  const areAllCurrentSelected = useMemo(() => {
    if (paginatedFiles.length === 0) return false;
    return paginatedFiles.every((f) => selectedFileIds.has(f.id));
  }, [paginatedFiles, selectedFileIds]);

  const handleSelectAllToggle = () => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (areAllCurrentSelected) {
        paginatedFiles.forEach((f) => next.delete(f.id));
      } else {
        paginatedFiles.forEach((f) => next.add(f.id));
      }
      return next;
    });
  };

  const handleSelectRow = (fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      return next;
    });
  };

  // File action handlers
  const handlePreviewFile = (file: DriveFile) => {
    setPreviewFile(file);
    setPreviewDialogOpen(true);
  };

  const handleOpenStoredDocument = (file: DriveFile) => {
    const targetUrl = file.url || file.metadata?.fileUrl;
    if (targetUrl && targetUrl !== "#") {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
      toast.info(`Opening stored document: "${file.name}"`);
    } else {
      handlePreviewFile(file);
    }
  };

  const handleDownloadFile = (file: DriveFile) => {
    // 1. If file has a storagePath in Supabase Storage, use secure authorized download proxy
    if (file.metadata?.storagePath) {
      const a = document.createElement("a");
      const orgParam = organizationId ? `&organizationId=${encodeURIComponent(organizationId)}` : "";
      a.href = `/api/documents/download?path=${encodeURIComponent(file.metadata.storagePath)}${orgParam}`;
      a.download = file.metadata?.originalFilename || file.metadata?.fileName || file.name;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloading ${file.name}`);
      return;
    }

    // 2. If it's a Gmail attachment with messageId and attachmentId, download directly from Gmail attachment API
    const msgId = file.metadata?.gmailMessageId || file.metadata?.emailMessageId;
    const attId = (file.metadata as Record<string, unknown>)?.attachmentId as string | undefined;
    if (msgId && attId) {
      const filename = file.metadata?.originalFilename || file.metadata?.fileName || file.name;
      const downloadEndpoint = `/api/gmail/attachment?messageId=${encodeURIComponent(msgId)}&attachmentId=${encodeURIComponent(attId)}&filename=${encodeURIComponent(filename)}&mimeType=${encodeURIComponent(file.metadata?.fileFormat || "application/octet-stream")}`;
      const a = document.createElement("a");
      a.href = downloadEndpoint;
      a.download = filename;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloading ${file.name}`);
      return;
    }

    // 3. If file has a valid direct URL
    const downloadUrl = file.url || file.metadata?.fileUrl || file.sharedLink;
    if (
      downloadUrl &&
      downloadUrl !== "#" &&
      !downloadUrl.startsWith("https://drive.nashmia.com")
    ) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = file.metadata?.originalFilename || file.metadata?.fileName || file.name;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloading ${file.name}`);
      return;
    }

    // 4. If attachment has not completed synchronization yet, display actual processing status instead of fake data
    toast.info(`Document "${file.name}" is synchronizing from forwarder email. File content will be ready once retrieved.`);
  };

  const handleShareItem = (item: DriveFile | DriveFolder) => {
    setShareTargetItem(item);
    setShareModalOpen(true);
  };

  const handleDeleteFile = (fileId: string) => {
    const file = files.find((f) => f.id === fileId);
    removeDriveDocument(fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      next.delete(fileId);
      return next;
    });
    toast.success(`Moved "${file?.name || "Document"}" to Trash`);
  };

  const handleAddFile = (newFile: DriveFile) => {
    saveDriveDocument(newFile);
    setFiles((prev) => [newFile, ...prev.filter((f) => f.id !== newFile.id)]);
  };

  const handleAddFolder = (newFolder: DriveFolder) => {
    setFolders((prev) => [...prev, newFolder]);
  };

  // Realtime Supabase integration preserving exact backend events
  const handleBookingRealtime = useCallback((payload: { new?: Record<string, unknown> }) => {
    if (!payload?.new) return;
    const booking = payload.new;
    const movNumber = String(
      booking.movement_number || booking.booking_reference || booking.reference || "",
    ).trim();
    const cutOffDates = (booking.cut_off_dates || {}) as Record<string, unknown>;
    const rawConf = (booking.confirmation_details || {}) as Record<string, unknown>;
    const confCutOffs = (rawConf.cut_off_dates || {}) as Record<string, unknown>;
    const deadlines = (booking.cut_off_deadlines || rawConf.cut_off_deadlines || []) as unknown[];

    if (movNumber && (deadlines.length > 0 || cutOffDates.siCutoff || confCutOffs.siCutoff)) {
      setFiles((prev) => {
        const hasMatchingDoc = prev.some(
          (f) =>
            f.metadata?.movementNumber === movNumber &&
            (f.metadata?.category === "Cut-Off Notice" ||
              f.metadata?.documentType === "Cut-Off" ||
              f.name.toLowerCase().includes("cutoff") ||
              f.name.toLowerCase().includes("cut-off")),
        );

        if (!hasMatchingDoc) {
          const newDoc: DriveFile = {
            id: `doc-cutoff-${movNumber.toLowerCase()}-${Date.now()}`,
            name: `Cut-Off_${movNumber}.pdf`,
            type: "pdf",
            extension: "pdf",
            owners: [],
            lastModified: "Just now",
            lastModifiedTimestamp: new Date().toISOString(),
            fileSize: "410 KB",
            folderId: "folder-design",
            starred: true,
            sharedLink: `/documents?movement=${encodeURIComponent(movNumber)}`,
            metadata: {
              category: "Cut-Off Notice",
              documentType: "Cut-Off",
              movementNumber: movNumber,
              vesselName: "Vessel Updated",
              forwarderName: "Realtime Forwarder",
              forwarderEmail: "ops@forwarder.com",
              forwarderAvatarText: "A",
              typeTag: "Cut-Off",
              receivedDate: "Today",
              receivedTime: "Just now",
              status: "Processed",
              cutOffDeadlines: deadlines as DriveFile["metadata"]["cutOffDeadlines"],
              cutOffDates: (cutOffDates || confCutOffs) as DriveFile["metadata"]["cutOffDates"],
            },
          };
          saveDriveDocument(newDoc);
          return [newDoc, ...prev];
        }
        return prev;
      });
    }
  }, []);

  const handleBookingEventRealtime = useCallback((payload: { new?: Record<string, unknown> }) => {
    if (!payload?.new) return;
    const eventRow = payload.new;
    const rawPayload = eventRow.payload;
    if (!rawPayload) return;

    try {
      const parsed = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;
      if (parsed?.document && parsed.document.id) {
        const doc = parsed.document as DriveFile;
        saveDriveDocument(doc);
        setFiles((prev) => {
          const filtered = prev.filter((f) => f.id !== doc.id);
          return [doc, ...filtered];
        });
      }
    } catch {
      // Ignore parse notices
    }
  }, []);

  useSupabaseRealtime("bookings", handleBookingRealtime, isSupabaseConfigured);
  useSupabaseRealtime("booking_events", handleBookingEventRealtime, isSupabaseConfigured);

  // Sync with persistent document repository and window events
  useEffect(() => {
    const initialDocs = getSavedDocuments();
    setFiles(initialDocs);

    const syncFromServer = () => {
      const headers: Record<string, string> = {};
      if (organizationId) {
        headers["x-organization-id"] = organizationId;
      }
      const fetchUrl = organizationId
        ? `/api/documents?organizationId=${encodeURIComponent(organizationId)}`
        : "/api/documents";

      fetch(fetchUrl, { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && Array.isArray(data.files) && data.files.length > 0) {
            const currentLocal = getSavedDocuments();
            const currentMap = new Map(currentLocal.map((f) => [f.id, f]));
            let hasNewOrUpdated = false;

            for (const serverFile of data.files) {
              const existing = currentMap.get(serverFile.id);
              if (!existing) {
                saveDriveDocument(serverFile);
                hasNewOrUpdated = true;
              } else if (
                (!existing.url && serverFile.url) ||
                (!existing.metadata?.fileUrl && serverFile.metadata?.fileUrl) ||
                (serverFile.metadata?.uploadStatus &&
                  serverFile.metadata?.uploadStatus !== existing.metadata?.uploadStatus)
              ) {
                const merged: DriveFile = {
                  ...existing,
                  ...serverFile,
                  metadata: {
                    ...existing.metadata,
                    ...serverFile.metadata,
                  },
                };
                saveDriveDocument(merged);
                hasNewOrUpdated = true;
              }
            }
            if (hasNewOrUpdated) {
              setFiles(getSavedDocuments());
            }
          }
        })
        .catch(() => {
          // Silently use client documents
        });
    };

    syncFromServer();
    // Continuous background sync interval so incoming documents appear without requiring manual page refresh
    const pollInterval = setInterval(syncFromServer, 4000);

    const handleDocumentSaved = (e: Event) => {
      const customEvent = e as CustomEvent<DriveFile>;
      if (customEvent.detail) {
        setFiles((prev) => {
          const filtered = prev.filter((f) => f.id !== customEvent.detail.id);
          return [customEvent.detail, ...filtered];
        });
      }
    };

    const handleDocumentDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string }>;
      if (customEvent.detail?.id) {
        setFiles((prev) => prev.filter((f) => f.id !== customEvent.detail.id));
      }
    };

    const handleCutoffUpdated = () => {
      const current = getSavedDocuments();
      setFiles(current);
    };

    const handleStorageUpdate = (e: StorageEvent) => {
      if (e.key === DOCUMENTS_STORAGE_KEY) {
        setFiles(getSavedDocuments());
      }
    };

    window.addEventListener("nashmia:document-saved", handleDocumentSaved);
    window.addEventListener("nashmia:attachment-saved", handleDocumentSaved);
    window.addEventListener("nashmia:document-deleted", handleDocumentDeleted);
    window.addEventListener("nashmia_movement_cutoff_updated", handleCutoffUpdated);
    window.addEventListener("storage", handleStorageUpdate);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("nashmia:document-saved", handleDocumentSaved);
      window.removeEventListener("nashmia:attachment-saved", handleDocumentSaved);
      window.removeEventListener("nashmia:document-deleted", handleDocumentDeleted);
      window.removeEventListener("nashmia_movement_cutoff_updated", handleCutoffUpdated);
      window.removeEventListener("storage", handleStorageUpdate);
    };
  }, []);

  // Helper to render Document Icon Badge matching design
  const renderDocumentBadge = (file: DriveFile) => {
    return <FileThumbnailIcon file={file} size="md" showFormatTag={false} />;
  };

  // Helper to render Type Pill Badge matching design
  const renderTypePill = (type?: string | null) => {
    const val = type || "Other";
    if (val === "Cut-Off" || val === "Cut-Off Notice") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F8F0] text-[#10B981]">
          Cut-Off
        </span>
      );
    }
    if (val === "BL" || val === "Bill of Lading") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F4EFFE] text-[#9333EA]">
          BL
        </span>
      );
    }
    if (val === "Booking Confirmation") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E0F2FE] text-[#0284C7]">
          Booking Confirmation
        </span>
      );
    }
    if (val === "Shipping Instructions") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FEF3C7] text-[#D97706]">
          Shipping Instructions
        </span>
      );
    }
    if (val === "Invoice") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EBF7FC] text-[#0284C7]">
          Invoice
        </span>
      );
    }
    if (val === "Packing List") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F8F0] text-[#10B981]">
          Packing List
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F1F5F9] text-[#64748B]">
        {val}
      </span>
    );
  };

  return (
    <div className="w-full space-y-6 font-sans">
      {/* 1. TOP HEADER SECTION (Styled in harmony with SuppliersHeader) */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {/* Left side: Mobile button + Eyebrow + Title + Subtitle */}
        <div className="flex items-start gap-3.5">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Toggle navigation menu"
              className="mt-1 grid size-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs transition-all hover:bg-slate-50 lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          )}

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#2563EB]">
                <Folder className="size-3 text-[#2563EB]" />
                Document Center
              </span>
            </div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900 leading-tight">
              Documents
            </h1>
            <p className="max-w-2xl text-[13.5px] text-slate-500 font-normal">
              Manage and track all your shipping documents, cut-offs, and bills of lading in one
              place.
            </p>
          </div>
        </div>

        {/* Right side: Primary Upload Document Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] px-5 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(37,99,235,0.25)] transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="size-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </header>

      {/* 2. SUMMARY KPI CARDS STRIP (SAME DESIGN AS SUPPLIERS PAGE) */}
      <DocumentsSummaryStrip
        totalCount={totalCount}
        cutoffCount={cutoffCount}
        blCount={blCount}
        otherCount={otherCount}
        activeFilter={activeStatFilter}
        onSelectFilter={(filter) => {
          setActiveStatFilter(filter);
          setCurrentPage(1);
        }}
      />

      {/* 2. MAIN CARD: FILTERS + TABLE + PAGINATION */}
      <div className="bg-white rounded-[22px] sm:rounded-[26px] border border-slate-200/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] p-4 sm:p-6 lg:p-7 space-y-6">
        {/* Top Filter Controls Row matching design */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input on Left */}
          <div className="relative flex-1 min-w-0 sm:min-w-[240px] max-w-md">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by document name, movement, forwarder..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-10 pl-9 pr-3.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Filter Selectors on Right */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Movement Filter */}
            <LifecycleDropdownSelect
              label="Movement"
              value={selectedMovement}
              onChange={(val) => {
                setSelectedMovement(val);
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "All Movements" },
                ...availableMovements.map((mov) => ({ value: mov, label: mov })),
              ]}
              placeholder="All Movements"
              size="sm"
              activeColor="blue"
              triggerClassName="h-9 min-w-[130px]"
            />

            {/* Document Type Filter */}
            <LifecycleDropdownSelect
              label="Document Type"
              value={selectedDocType}
              onChange={(val) => {
                setSelectedDocType(val);
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "All Types" },
                { value: "Booking Confirmation", label: "Booking Confirmation" },
                { value: "Bill of Lading", label: "Bill of Lading" },
                { value: "Shipping Instructions", label: "Shipping Instructions" },
                { value: "Cut-Off", label: "Cut-Off Notice" },
                { value: "Invoice", label: "Commercial Invoice" },
                { value: "Packing List", label: "Packing List" },
                { value: "Other", label: "Other" },
              ]}
              placeholder="All Types"
              size="sm"
              activeColor="blue"
              triggerClassName="h-9 min-w-[125px]"
            />

            {/* Forwarder Filter */}
            <LifecycleDropdownSelect
              label="Forwarder"
              value={selectedForwarder}
              onChange={(val) => {
                setSelectedForwarder(val);
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "All Forwarders" },
                ...availableForwarders.map((fwd) => ({ value: fwd, label: fwd })),
              ]}
              placeholder="All Forwarders"
              size="sm"
              activeColor="blue"
              triggerClassName="h-9 min-w-[135px]"
            />

            {/* Status Filter */}
            <LifecycleDropdownSelect
              label="Status"
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "All Status" },
                { value: "Processed", label: "Processed" },
                { value: "Pending", label: "Pending" },
                { value: "Needs Review", label: "Needs Review" },
              ]}
              placeholder="All Status"
              size="sm"
              activeColor="blue"
              triggerClassName="h-9 min-w-[115px]"
            />

            {/* Date Range Filter */}
            <div className="flex flex-col gap-0.5">
              <label className="text-[11.5px] font-medium text-slate-500 flex items-center gap-1">
                Date Range
              </label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-2xs cursor-pointer"
                  >
                    <Calendar className="size-3.5 text-slate-400" />
                    <span>{dateRangeFilter === "all" ? "From - To" : dateRangeFilter}</span>
                    <ChevronDown className="size-3 text-slate-400 ml-0.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl text-xs"
                >
                  <DropdownMenuItem
                    onClick={() => setDateRangeFilter("all")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>All Time</span>
                    {dateRangeFilter === "all" && <Check className="size-4 text-blue-600" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDateRangeFilter("Today")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>Today</span>
                    {dateRangeFilter === "Today" && <Check className="size-4 text-blue-600" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDateRangeFilter("Last 7 Days")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>Last 7 Days</span>
                    {dateRangeFilter === "Last 7 Days" && (
                      <Check className="size-4 text-blue-600" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDateRangeFilter("Last 30 Days")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>Last 30 Days</span>
                    {dateRangeFilter === "Last 30 Days" && (
                      <Check className="size-4 text-blue-600" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDateRangeFilter("September 2025")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>September 2025</span>
                    {dateRangeFilter === "September 2025" && (
                      <Check className="size-4 text-blue-600" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Settings Button */}
            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={() => {
                  // Reset all filters
                  setSearchQuery("");
                  setSelectedMovement("all");
                  setSelectedDocType("all");
                  setSelectedForwarder("all");
                  setSelectedStatus("all");
                  setDateRangeFilter("all");
                  setActiveStatFilter("all");
                  setCurrentPage(1);
                  toast.info("Filters reset to default");
                }}
                title="Reset / Toggle Filters"
                className="h-9 w-9 flex items-center justify-center border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <SlidersHorizontal className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Selected Items Banner if rows are checked */}
        {selectedFileIds.size > 0 && (
          <div className="flex items-center justify-between px-4 py-2 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-blue-900">
            <span className="font-medium">
              {selectedFileIds.size} document{selectedFileIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toast.success(`Downloading ${selectedFileIds.size} selected documents`);
                }}
                className="px-2.5 py-1 bg-white border border-blue-200 rounded-lg text-blue-700 hover:bg-blue-50 font-medium transition-colors"
              >
                Download Selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedFileIds(new Set())}
                className="px-2 py-1 text-slate-500 hover:text-slate-700 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Shipping Documents Table */}
        <div className="overflow-x-auto -mx-4 sm:-mx-6 lg:-mx-7 px-4 sm:px-6 lg:px-7">
          <table className="w-full min-w-[1000px] border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="bg-[#ECEEF1] text-[#5E6778]">
                {/* Select All Checkbox */}
                <th className="rounded-l-2xl w-12 pl-6 pr-3 py-3.5">
                  <input
                    type="checkbox"
                    checked={areAllCurrentSelected}
                    onChange={handleSelectAllToggle}
                    className="size-4 rounded border-slate-300 text-[#2563EB] focus:ring-blue-500 cursor-pointer"
                  />
                </th>

                {/* Document Column */}
                <th
                  onClick={() => handleSortToggle("document")}
                  className="px-4 py-3.5 text-[13px] font-medium text-[#5E6778] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Document</span>
                    <ChevronsUpDown className="size-3.5 text-slate-400" />
                  </div>
                </th>

                {/* Movement Column */}
                <th
                  onClick={() => handleSortToggle("movement")}
                  className="px-4 py-3.5 text-[13px] font-medium text-[#5E6778] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Movement</span>
                    <ChevronsUpDown className="size-3.5 text-slate-400" />
                  </div>
                </th>

                {/* Document Type Column */}
                <th
                  onClick={() => handleSortToggle("documentType")}
                  className="px-4 py-3.5 text-[13px] font-medium text-[#5E6778] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Document Type</span>
                    <ChevronsUpDown className="size-3.5 text-slate-400" />
                  </div>
                </th>

                {/* Forwarder Column */}
                <th
                  onClick={() => handleSortToggle("forwarder")}
                  className="px-4 py-3.5 text-[13px] font-medium text-[#5E6778] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Forwarder</span>
                    <ChevronsUpDown className="size-3.5 text-slate-400" />
                  </div>
                </th>

                {/* Type Badge Column */}
                <th className="px-4 py-3.5 text-[13px] font-medium text-[#5E6778]">
                  <div className="flex items-center gap-1">
                    <span>Type</span>
                    <ChevronDown className="size-3 text-slate-400" />
                  </div>
                </th>

                {/* Received Date Column */}
                <th
                  onClick={() => handleSortToggle("receivedDate")}
                  className="px-4 py-3.5 text-[13px] font-medium text-[#5E6778] cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Received Date</span>
                    <ChevronsUpDown className="size-3.5 text-slate-400" />
                  </div>
                </th>

                {/* Status Column */}
                <th className="px-4 py-3.5 text-[13px] font-medium text-[#5E6778]">
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ChevronDown className="size-3 text-slate-400" />
                  </div>
                </th>

                {/* Actions Column */}
                <th className="rounded-r-2xl pr-6 pl-4 py-3.5 text-right text-[13px] font-medium text-[#5E6778] w-28">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {paginatedFiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400 text-sm">
                    No documents found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedFiles.map((file) => {
                  const isSelected = selectedFileIds.has(file.id);
                  const movement =
                    file.metadata?.movementReferenceNumber || file.metadata?.movementNumber || "—";
                  const vessel =
                    file.metadata?.vesselName ||
                    (movement !== "—" ? "Linked Movement" : "Pending Review");
                  const rawDocType =
                    file.metadata?.displayDocumentType ||
                    file.metadata?.documentType ||
                    file.metadata?.category ||
                    "Other";
                  const docType =
                    rawDocType === "CUT_OFF_NOTICE" || rawDocType.toLowerCase().includes("cut")
                      ? "Cut-Off"
                      : rawDocType === "BILL_OF_LADING" ||
                          rawDocType.toLowerCase().includes("lading") ||
                          rawDocType === "BL"
                        ? "BL"
                        : rawDocType;
                  const forwarder =
                    file.metadata?.forwarder || file.metadata?.forwarderName || "Direct Carrier";
                  const email = file.metadata?.forwarderEmail || file.metadata?.senderEmail || "—";
                  const avatarLetter = (
                    file.metadata?.forwarderAvatarText ||
                    (forwarder !== "Direct Carrier" ? forwarder[0] : "D") ||
                    "D"
                  ).toUpperCase();
                  const typeTag = docType;
                  const dateStr =
                    file.metadata?.receivedDate ||
                    (file.lastModified
                      ? file.lastModified.split("•")[0]?.trim()
                      : new Date().toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }));
                  const timeStr =
                    file.metadata?.receivedTime ||
                    (file.lastModified && file.lastModified.includes("•")
                      ? file.lastModified.split("•")[1]?.trim()
                      : "");
                  const status =
                    file.metadata?.status || (movement !== "—" ? "Metadata Saved" : "Needs Review");
                  const fileFormat = (
                    file.metadata?.fileFormat ||
                    file.extension ||
                    "PDF"
                  ).toUpperCase();

                  return (
                    <tr
                      key={file.id}
                      onClick={() => handleSelectRow(file.id)}
                      className={`group cursor-pointer border-b border-[#F0F2F5] transition-colors last:border-b-0 hover:bg-[#F8FAFC] ${
                        isSelected ? "bg-blue-50/40" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="w-12 pl-6 pr-3 py-4.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(file.id)}
                          className="size-4 rounded border-slate-300 text-[#2563EB] focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      {/* Document Name & File Type / Size */}
                      <td className="px-4 py-4.5">
                        <div className="flex items-center gap-3">
                          {renderDocumentBadge(file)}
                          <div className="flex flex-col min-w-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePreviewFile(file);
                              }}
                              className="font-medium text-[13.5px] text-slate-900 truncate max-w-[220px] hover:text-blue-600 transition-colors text-left cursor-pointer"
                              title={file.name}
                            >
                              {file.name}
                            </button>
                            {file.metadata?.originalFilename &&
                            file.metadata.originalFilename !== file.name ? (
                              <span
                                className="text-[10.5px] text-slate-400 font-mono truncate max-w-[220px]"
                                title={`Original filename: ${file.metadata.originalFilename}`}
                              >
                                Orig: {file.metadata.originalFilename}
                              </span>
                            ) : null}
                            <span className="text-[11.5px] text-slate-400 font-normal">
                              {fileFormat} &bull; {file.fileSize}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Movement Reference Number */}
                      <td className="px-4 py-4.5">
                        <div className="flex flex-col">
                          {movement !== "—" ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMovement(movement);
                                setCurrentPage(1);
                                toast.info(`Filtered documents for Movement ${movement}`);
                              }}
                              className="text-left font-medium text-[13px] text-slate-900 hover:text-blue-600 font-mono transition-colors cursor-pointer"
                              title={`Filter by Movement ${movement}`}
                            >
                              {movement}
                            </button>
                          ) : (
                            <span className="font-medium text-[13px] text-slate-400 font-mono">
                              —
                            </span>
                          )}
                          <span className="text-[11.5px] text-slate-500 font-normal">{vessel}</span>
                        </div>
                      </td>

                      {/* Document Type */}
                      <td className="px-4 py-4.5">
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <FileText className="size-3.5" />
                          </div>
                          <span className="text-slate-800 text-[13px] font-medium">{docType}</span>
                        </div>
                      </td>

                      {/* Forwarder */}
                      <td className="px-4 py-4.5">
                        <div className="flex items-center gap-2.5">
                          <div className="size-7 rounded-full bg-[#1E293B] text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                            {avatarLetter}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium text-[13px] text-slate-900 truncate max-w-[150px]">
                              {forwarder}
                            </span>
                            <span
                              className="text-[11.5px] text-slate-500 font-normal truncate max-w-[150px]"
                              title={email}
                            >
                              {email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Type Pill */}
                      <td className="px-4 py-4.5">{renderTypePill(typeTag)}</td>

                      {/* Received Date */}
                      <td className="px-4 py-4.5">
                        <div className="flex flex-col">
                          <span className="font-medium text-[13px] text-slate-900">{dateStr}</span>
                          <span className="text-[11.5px] text-slate-400 font-normal">
                            {timeStr}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4.5">
                        {status === "Saved to Supabase Storage" ||
                        status === "Stored in Supabase" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            <Check className="size-3 text-emerald-600" /> Stored in Supabase
                          </span>
                        ) : status === "Metadata Saved" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                            Metadata Saved
                          </span>
                        ) : status === "Needs Review" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">
                            Needs Review
                          </span>
                        ) : status === "Processed" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            {status}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                            {status}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td
                        className="pr-6 pl-4 py-4.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {(file.url || file.metadata?.fileUrl) && (
                            <button
                              type="button"
                              onClick={() => handleOpenStoredDocument(file)}
                              title="Open Stored Document"
                              className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <ExternalLink className="size-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handlePreviewFile(file)}
                            title="Preview Document & Details"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file)}
                            title="Download Document"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Download className="size-4" />
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                title="More Options"
                                className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <MoreVertical className="size-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 text-xs">
                              {(file.url || file.metadata?.fileUrl) && (
                                <DropdownMenuItem
                                  onClick={() => handleOpenStoredDocument(file)}
                                  className="gap-2 cursor-pointer font-medium text-blue-700"
                                >
                                  <ExternalLink className="size-3.5 text-blue-600" />
                                  Open Stored Document
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDownloadFile(file)}
                                className="gap-2 cursor-pointer"
                              >
                                <Download className="size-3.5 text-slate-500" />
                                Download File
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handlePreviewFile(file)}
                                className="gap-2 cursor-pointer"
                              >
                                <Eye className="size-3.5 text-slate-500" />
                                Preview Document
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setActiveItemForDetails({ file, folder: null });
                                  setDetailsDrawerOpen(true);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <FileText className="size-3.5 text-slate-500" />
                                View Document Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleShareItem(file)}
                                className="gap-2 cursor-pointer"
                              >
                                <Share2 className="size-3.5 text-slate-500" />
                                Share Document
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    file.sharedLink || file.url || window.location.href,
                                  );
                                  toast.success("Link copied to clipboard");
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <LinkIcon className="size-3.5 text-slate-500" />
                                Copy Link
                              </DropdownMenuItem>
                              {file.metadata?.needsReview && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setManualReviewDoc(file);
                                    setManualReviewModalOpen(true);
                                  }}
                                  className="gap-2 font-medium text-amber-800 bg-amber-50 cursor-pointer"
                                >
                                  <ShieldCheck className="size-3.5 text-amber-600" />
                                  Review Document
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteFile(file.id)}
                                className="gap-2 text-rose-600 focus:text-rose-600 focus:bg-rose-50 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                Move to Trash
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pill Pagination matching reference */}
        <PillPagination
          currentPage={currentSafePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          totalItems={sortedFiles.length}
          pageSize={pageSize}
          itemName="documents"
          className="pt-2 border-t border-slate-100"
        />
      </div>

      {/* 3. MODALS & DRAWERS (Preserved functionality) */}
      {/* File Details Drawer */}
      <FileDetailsDrawer
        file={activeItemForDetails.file}
        folder={activeItemForDetails.folder}
        open={detailsDrawerOpen}
        onClose={() => setDetailsDrawerOpen(false)}
        onShare={() => {
          if (activeItemForDetails.file) handleShareItem(activeItemForDetails.file);
          else if (activeItemForDetails.folder) handleShareItem(activeItemForDetails.folder);
        }}
        onReview={(fileToReview) => {
          setDetailsDrawerOpen(false);
          setManualReviewDoc(fileToReview);
          setManualReviewModalOpen(true);
        }}
      />

      {/* Manual Review & Link Modal for Unidentified Documents */}
      <ManualReviewLinkModal
        isOpen={manualReviewModalOpen}
        onClose={() => {
          setManualReviewModalOpen(false);
          setManualReviewDoc(null);
        }}
        document={manualReviewDoc}
        onDocumentLinked={(updated) => {
          const fresh = getSavedDocuments();
          setFiles(fresh);
          toast.success(`Document linked to Movement ${updated.metadata?.movementNumber || ""}`, {
            description: `Classification set to ${updated.metadata?.documentType || "DOCUMENT"}`,
          });
        }}
      />

      {/* Share Document Dialog */}
      <ShareDocumentModal
        item={shareTargetItem}
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
      />

      {/* Upload Document / Folder Dialog */}
      <UploadDocumentModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        folders={folders}
        activeFolderId="folder-design"
        onAddFile={handleAddFile}
        onAddFolder={handleAddFolder}
      />

      {/* Document Viewer Dialog */}
      <DocumentPreviewDialog
        file={previewFile}
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        onShare={() => {
          if (previewFile) handleShareItem(previewFile);
        }}
      />
    </div>
  );
}
