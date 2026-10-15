import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  AlertTriangle,
  FileText,
  Link,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Search,
  Building2,
  Info,
  ChevronDown,
} from "lucide-react";
import type { DriveFile, DriveFileMetadata, CutOffDeadlineItem } from "./documents-data";
import { linkAndReviewDriveDocument } from "./documents-data";
import { saveCutOffsForMovement } from "@/lib/movement-cutoff-service";
import { getLocalBookings } from "@/lib/supabase-services";
import { safeInsertNotification } from "@/lib/supabase-services";
import { supabase } from "@/lib/supabase";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";

interface ManualReviewLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DriveFile | null;
  onDocumentLinked?: (updatedDoc: DriveFile) => void;
}

const DOCUMENT_TYPES = [
  { id: "CUT_OFF_NOTICE", label: "Cut-Off Notice", category: "Cut-Off Notice" },
  { id: "BILL_OF_LADING", label: "Bill of Lading (B/L)", category: "Bill of Lading" },
  { id: "COMMERCIAL_INVOICE", label: "Commercial Invoice", category: "General" },
  { id: "PACKING_LIST", label: "Packing List", category: "General" },
  { id: "CERTIFICATE_OF_ORIGIN", label: "Certificate of Origin", category: "General" },
  { id: "SHIPPING_INSTRUCTION", label: "Shipping Instructions (SI)", category: "General" },
  { id: "GENERAL", label: "General Logistics Document", category: "General" },
];

export const ManualReviewLinkModal: React.FC<ManualReviewLinkModalProps> = ({
  isOpen,
  onClose,
  document,
  onDocumentLinked,
}) => {
  const metadata = document?.metadata || {};
  const unconfidentFields = metadata.unconfidentFields || [];
  const reviewReason =
    metadata.reviewReason ||
    "Document stored safely. Identification confidence was below the required threshold.";

  // Form states
  const [movementSearch, setMovementSearch] = useState(metadata.movementNumber || "");
  const [selectedMovement, setSelectedMovement] = useState(metadata.movementNumber || "");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    metadata.bookingId || null,
  );
  const [documentType, setDocumentType] = useState<string>(
    metadata.documentType && metadata.documentType !== "NEEDS_REVIEW"
      ? metadata.documentType
      : metadata.category === "Cut-Off Notice"
        ? "CUT_OFF_NOTICE"
        : metadata.category === "Bill of Lading"
          ? "BILL_OF_LADING"
          : "CUT_OFF_NOTICE",
  );

  // Cut-Off dates state
  const existingCutoff = metadata.cutOffDates || {};
  const [siCutoff, setSiCutoff] = useState(existingCutoff.siCutoff || "");
  const [vgmCutoff, setVgmCutoff] = useState(existingCutoff.vgmCutoff || "");
  const [portCutoff, setPortCutoff] = useState(existingCutoff.portCutoff || "");
  const [gateCutoff, setGateCutoff] = useState(existingCutoff.gateCutoff || "");
  const [closingDate, setClosingDate] = useState(existingCutoff.closingDate || "");

  const [reviewerName, setReviewerName] = useState("Alex Rivera (Operations Lead)");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Movement suggestions from local/remote bookings
  const [availableMovements, setAvailableMovements] = useState<
    Array<{ movementNumber: string; bookingId?: string; vessel?: string; port?: string }>
  >([]);

  useEffect(() => {
    if (document) {
      const meta = document.metadata || {};
      const cutoffs = meta.cutOffDates || {};
      setMovementSearch(meta.movementNumber || "");
      setSelectedMovement(meta.movementNumber || "");
      setSelectedBookingId(meta.bookingId || null);
      setDocumentType(
        meta.documentType && meta.documentType !== "NEEDS_REVIEW"
          ? meta.documentType
          : meta.category === "Cut-Off Notice"
            ? "CUT_OFF_NOTICE"
            : meta.category === "Bill of Lading"
              ? "BILL_OF_LADING"
              : "CUT_OFF_NOTICE",
      );
      setSiCutoff(cutoffs.siCutoff || "");
      setVgmCutoff(cutoffs.vgmCutoff || "");
      setPortCutoff(cutoffs.portCutoff || "");
      setGateCutoff(cutoffs.gateCutoff || "");
      setClosingDate(cutoffs.closingDate || "");
    }
  }, [document]);

  useEffect(() => {
    try {
      const bookings = getLocalBookings();
      const list = bookings.map((b) => ({
        movementNumber: b.movement_number || b.booking_reference || "NASH-2026-0042",
        bookingId: b.id,
        vessel: b.vessel_name,
        port: `${b.pol_name || b.origin || ""} → ${b.pod_name || b.destination || ""}`,
      }));

      // Ensure at least default active movement if empty
      if (list.length === 0) {
        list.push({
          movementNumber: "NASH-2026-0042",
          bookingId: "428b49e1-b1e0-4a87-a068-1e43cfa11042",
          vessel: "MSC ISABELLA",
          port: "Jebel Ali (AEJEA) → Rotterdam (NLRTM)",
        });
        list.push({
          movementNumber: "NASH-2026-0089",
          bookingId: "89a2341b-12e0-4a87-b068-1e43cfa11089",
          vessel: "CMA CGM ANTOINE",
          port: "Shanghai (CNSHA) → Hamburg (DEHAM)",
        });
      }
      setAvailableMovements(list);
    } catch {
      setAvailableMovements([
        {
          movementNumber: "NASH-2026-0042",
          bookingId: "428b49e1-b1e0-4a87-a068-1e43cfa11042",
          vessel: "MSC ISABELLA",
          port: "Jebel Ali (AEJEA) → Rotterdam (NLRTM)",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !document) return null;

  const filteredMovements = availableMovements.filter((m) =>
    m.movementNumber.toLowerCase().includes(movementSearch.toLowerCase()),
  );

  const handleSelectMovement = (m: { movementNumber: string; bookingId?: string }) => {
    setSelectedMovement(m.movementNumber);
    setMovementSearch(m.movementNumber);
    if (m.bookingId) setSelectedBookingId(m.bookingId);
    setShowDropdown(false);
  };

  const handleConfirmAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovement && !movementSearch) {
      alert("Please specify or select a Movement Number to link this document.");
      return;
    }

    const finalMovementNumber = selectedMovement || movementSearch.trim();
    setIsSubmitting(true);

    try {
      const selectedTypeObj = DOCUMENT_TYPES.find((t) => t.id === documentType);
      const isCutoff = documentType === "CUT_OFF_NOTICE";

      // Build deadlines list
      const cutOffDeadlines: CutOffDeadlineItem[] = [];
      if (siCutoff) cutOffDeadlines.push({ type: "SI Cut-Off", dateTime: siCutoff });
      if (vgmCutoff) cutOffDeadlines.push({ type: "VGM Cut-Off", dateTime: vgmCutoff });
      if (portCutoff) cutOffDeadlines.push({ type: "Port Cut-Off", dateTime: portCutoff });
      if (gateCutoff) cutOffDeadlines.push({ type: "Gate Cut-Off", dateTime: gateCutoff });
      if (closingDate) cutOffDeadlines.push({ type: "Vessel Closing", dateTime: closingDate });

      const cutOffDates = isCutoff
        ? {
            siCutoff: siCutoff || null,
            vgmCutoff: vgmCutoff || null,
            portCutoff: portCutoff || null,
            gateCutoff: gateCutoff || null,
            closingDate: closingDate || null,
            deadlines: cutOffDeadlines,
          }
        : undefined;

      // Update document
      const updatedDoc = linkAndReviewDriveDocument(document.id, {
        movementNumber: finalMovementNumber,
        bookingId: selectedBookingId,
        documentType: documentType,
        category: selectedTypeObj?.category || "General",
        cutOffDates,
        cutOffDeadlines: isCutoff ? cutOffDeadlines : undefined,
        reviewerName,
        folderId: `folder-movement-${finalMovementNumber.toLowerCase()}`,
      });

      // If cut-off notice, sync movement cut-off schedule and triggers
      if (isCutoff && cutOffDates) {
        try {
          await saveCutOffsForMovement(
            finalMovementNumber,
            {
              ...cutOffDates,
              siCutoff: cutOffDates.siCutoff,
              vgmCutoff: cutOffDates.vgmCutoff,
              portCutoff: cutOffDates.portCutoff,
              gateCutoff: cutOffDates.gateCutoff,
              closingDate: cutOffDates.closingDate,
              deadlines: cutOffDeadlines,
              sourceDocumentId: document.id,
              sourceDocumentName: document.name,
              sourceEmailId:
                ((document.metadata as Record<string, unknown>)?.sourceEmailId as string) ||
                ((document.metadata as Record<string, unknown>)?.emailMessageId as string) ||
                null,
              extractionStatus: "COMPLETED",
              reviewStatus: "MANUALLY_VERIFIED",
              requiresManualReview: false,
              hasAmbiguousDates: false,
            },
            selectedBookingId || undefined,
          );
        } catch (syncErr) {
          console.warn("[ManualReviewLinkModal] saveCutOffsForMovement notice:", syncErr);
        }
      }

      // Safe notification
      try {
        await safeInsertNotification(supabase, {
          userId: null,
          title: `Document Linked: ${finalMovementNumber}`,
          message: `Document "${document.name}" was manually verified and linked to Movement ${finalMovementNumber} by ${reviewerName}.`,
          type: "document_saved",
          bookingId: selectedBookingId,
          movementNumber: finalMovementNumber,
        });
      } catch {
        // notification fallback
      }

      if (updatedDoc && onDocumentLinked) {
        onDocumentLinked(updatedDoc);
      }

      onClose();
    } catch (err) {
      console.error("[ManualReviewLinkModal] Error linking document:", err);
      alert("An error occurred while linking the document. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      id="manual-review-modal-backdrop"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id="manual-review-modal-card"
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 bg-white rounded-t-[28px] rounded-b-none sm:rounded-xl shadow-2xl border-t sm:border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-hidden my-0 sm:my-8 outline-none animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 duration-240 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col"
      >
        {/* Mobile Tactile Drag Handle */}
        <div
          data-swipe-handle="true"
          className="mx-auto pt-2.5 pb-1 flex h-6 w-full max-w-[140px] cursor-grab touch-none items-center justify-center sm:hidden select-none shrink-0 bg-amber-500/10"
          aria-label="Drag down to dismiss"
        >
          <div className="h-1.5 w-12 rounded-full bg-amber-300" />
        </div>

        {/* Modal Header */}
        <div className="bg-amber-500/10 border-b border-amber-200/80 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                Review &amp; Link Document
              </h2>
              <p className="text-xs text-amber-800">
                Operator verification required &bull; Safely stored without guessing
              </p>
            </div>
          </div>
          <button
            id="btn-close-review-modal"
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmAndLink} className="p-6 space-y-6">
          {/* Document Summary Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0 text-rose-600">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 truncate">{document.name}</p>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                  <AlertTriangle className="w-3 h-3" />
                  Needs Review
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Size: {document.fileSize} &bull; Received: {document.lastModified} &bull; Sender:{" "}
                {metadata.forwarderName || metadata.senderEmail || "External Carrier / Forwarder"}
              </p>

              {/* Review Reasons */}
              <div className="mt-2.5 p-2.5 bg-amber-50/80 border border-amber-200 rounded text-xs text-amber-900 space-y-1">
                <div className="font-medium flex items-center gap-1.5 text-amber-800">
                  <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                  <span>Why manual review is required:</span>
                </div>
                <p className="pl-5 text-amber-900/90 leading-relaxed">{reviewReason}</p>
                {unconfidentFields.length > 0 && (
                  <div className="pl-5 flex flex-wrap gap-1.5 pt-1">
                    {unconfidentFields.map((f) => (
                      <span
                        key={f}
                        className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-amber-200/80 text-amber-900 rounded"
                      >
                        {f === "movement"
                          ? "🔍 Unidentified Movement"
                          : f === "document_type"
                            ? "📄 Ambiguous Document Type"
                            : "⏰ Unclear Cut-Off Date"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Inputs Grid */}
          <div className="space-y-4">
            {/* 1. Movement Selection */}
            <div>
              <label
                htmlFor="movement-search-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                1. Link to Movement Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="movement-search-input"
                    type="text"
                    required
                    placeholder="e.g. NASH-2026-0042 or search existing..."
                    value={movementSearch}
                    onChange={(e) => {
                      setMovementSearch(e.target.value);
                      setSelectedMovement(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium text-slate-900 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Dropdown Suggestions */}
                {showDropdown && filteredMovements.length > 0 && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {filteredMovements.map((m) => (
                      <button
                        key={m.movementNumber}
                        type="button"
                        onClick={() => handleSelectMovement(m)}
                        className="w-full text-left px-3.5 py-2 hover:bg-amber-50 transition-colors flex items-center justify-between gap-2"
                      >
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{m.movementNumber}</p>
                          {m.port && <p className="text-[11px] text-slate-500">{m.port}</p>}
                        </div>
                        {m.vessel && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium shrink-0">
                            {m.vessel}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Select an existing active shipment or enter a custom Movement identifier.
              </p>
            </div>

            {/* 2. Document Type */}
            <div>
              <LifecycleDropdownSelect
                label="2. CONFIRM DOCUMENT TYPE *"
                value={documentType}
                onChange={(val) => setDocumentType(val)}
                options={DOCUMENT_TYPES.map((type) => ({
                  value: type.id,
                  label: type.label,
                }))}
                placeholder="Select Document Type"
                activeColor="teal"
                triggerClassName="w-full text-sm h-10 font-medium"
              />
            </div>

            {/* 3. Cut-Off Date Deadlines (Visible when Cut-Off Notice is selected) */}
            {documentType === "CUT_OFF_NOTICE" && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Calendar className="w-4 h-4 text-amber-600" />
                  <span>3. Verify Cut-Off Deadlines for this Movement</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Enter or verify the cut-off dates parsed from the forwarder document. Do not leave
                  ambiguous dates.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="si-cutoff-input"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      SI (Shipping Instructions) Cut-Off
                    </label>
                    <input
                      id="si-cutoff-input"
                      type="text"
                      placeholder="e.g. 19 Sep 2026 4:00 PM"
                      value={siCutoff}
                      onChange={(e) => setSiCutoff(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="vgm-cutoff-input"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      VGM (Verified Gross Mass) Cut-Off
                    </label>
                    <input
                      id="vgm-cutoff-input"
                      type="text"
                      placeholder="e.g. 20 Sep 2026 12:00 PM"
                      value={vgmCutoff}
                      onChange={(e) => setVgmCutoff(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="port-cutoff-input"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      Port / Terminal Cut-Off
                    </label>
                    <input
                      id="port-cutoff-input"
                      type="text"
                      placeholder="e.g. 21 Sep 2026 6:00 PM"
                      value={portCutoff}
                      onChange={(e) => setPortCutoff(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="gate-cutoff-input"
                      className="block text-[11px] font-medium text-slate-700 mb-1"
                    >
                      Gate / Cargo Closing
                    </label>
                    <input
                      id="gate-cutoff-input"
                      type="text"
                      placeholder="e.g. 21 Sep 2026 12:00 PM"
                      value={gateCutoff}
                      onChange={(e) => setGateCutoff(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 4. Reviewer Signature */}
            <div>
              <label
                htmlFor="reviewer-name-input"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                4. Authorized Operator
              </label>
              <input
                id="reviewer-name-input"
                type="text"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-review"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-link-document"
              type="submit"
              disabled={isSubmitting || (!selectedMovement && !movementSearch)}
              className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-xs flex items-center gap-2 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? "Linking Document..." : "Confirm & Link to Movement"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
