import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPortCountryMeta } from "@/lib/port-flags";
import { CountryFlagSvg } from "@/components/nashmia/common/CountryFlagSvg";
import {
  Send,
  Ship,
  CheckCircle2,
  Users,
  Search,
  Check,
  AlertCircle,
  Eye,
  Mail,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  FileText,
} from "lucide-react";
import { showPillToast } from "@/lib/pill-toast";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import { useAuth } from "@/lib/auth-context";
import { useCachedForwarders } from "@/lib/cache";
import { sanitizeEmailHtml } from "@/lib/email-cleaning-service";
import {
  dispatchMultiForwarderRequests,
  generateForwarderEmailContent,
} from "@/lib/multi-forwarder-service";
import type { BookingRequestRecord, ForwarderQuoteRequestRecord } from "@/types/requests";
import type { ForwarderAccount } from "@/lib/forwarders-data";

interface MultiForwarderRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingRequestRecord | null;
  allBookings?: BookingRequestRecord[];
  onDispatched?: (records: ForwarderQuoteRequestRecord[]) => void;
}

export function MultiForwarderRequestModal({
  isOpen,
  onClose,
  booking: initialBooking,
  allBookings = [],
  onDispatched,
}: MultiForwarderRequestModalProps) {
  const { userId, userEmail } = useAuth();

  // Booking selection if opened generically or wanting to switch
  const [selectedBookingId, setSelectedBookingId] = useState<string>(initialBooking?.id || "");
  useEffect(() => {
    if (initialBooking?.id) {
      setSelectedBookingId(initialBooking.id);
    } else if (allBookings.length > 0 && !selectedBookingId) {
      setSelectedBookingId(allBookings[0].id);
    }
  }, [initialBooking, allBookings, selectedBookingId]);

  const activeBooking = useMemo(() => {
    if (initialBooking && initialBooking.id === selectedBookingId) return initialBooking;
    return allBookings.find((b) => b.id === selectedBookingId) || initialBooking || null;
  }, [initialBooking, selectedBookingId, allBookings]);

  // Fetch real forwarders from Supabase via unified client cache
  const { data: forwarders = [], isLoading: isLoadingForwarders } = useCachedForwarders(userId);

  // Selected forwarder IDs
  const [selectedForwarderIds, setSelectedForwarderIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [requiredSailingDate, setRequiredSailingDate] = useState("");
  const [deadline, setDeadline] = useState("Within 24 hours");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [activeTab, setActiveTab] = useState<"select" | "preview">("select");
  const [previewForwarderIndex, setPreviewForwarderIndex] = useState(0);

  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    current: number;
    total: number;
    forwarderName: string;
  } | null>(null);
  const [dispatchSuccess, setDispatchSuccess] = useState<{
    total: number;
    records: ForwarderQuoteRequestRecord[];
  } | null>(null);

  // Reset form when booking changes or modal opens
  useEffect(() => {
    if (activeBooking) {
      setRequiredSailingDate(activeBooking.requestedEtd || "");
      setSpecialInstructions(activeBooking.specialInstructions || "");
      // Pre-select top 3 active forwarders by default
      if (forwarders.length > 0 && selectedForwarderIds.length === 0) {
        setSelectedForwarderIds(forwarders.slice(0, 3).map((f) => f.id));
      }
    }
    setDispatchSuccess(null);
    setSendProgress(null);
  }, [activeBooking, isOpen, forwarders, selectedForwarderIds.length]);

  // Filtered forwarders list
  const filteredForwarders = useMemo(() => {
    if (!searchQuery.trim()) return forwarders;
    const q = searchQuery.toLowerCase();
    return forwarders.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        f.contactPerson?.toLowerCase().includes(q) ||
        f.shippingLines?.some((l) => l.toLowerCase().includes(q)),
    );
  }, [forwarders, searchQuery]);

  const selectedForwarders = useMemo(() => {
    return forwarders.filter((f) => selectedForwarderIds.includes(f.id));
  }, [forwarders, selectedForwarderIds]);

  const handleToggleForwarder = (id: string) => {
    setSelectedForwarderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleToggleAll = () => {
    if (selectedForwarderIds.length === filteredForwarders.length) {
      setSelectedForwarderIds([]);
    } else {
      setSelectedForwarderIds(filteredForwarders.map((f) => f.id));
    }
  };

  // Preview generated email for selected forwarder
  const previewEmail = useMemo(() => {
    if (!activeBooking || selectedForwarders.length === 0) return null;
    const targetForwarder = selectedForwarders[previewForwarderIndex] || selectedForwarders[0];
    if (!targetForwarder) return null;

    return generateForwarderEmailContent(activeBooking, targetForwarder, {
      requiredSailingDate,
      deadline,
      specialInstructions,
    });
  }, [
    activeBooking,
    selectedForwarders,
    previewForwarderIndex,
    requiredSailingDate,
    deadline,
    specialInstructions,
  ]);

  // Dispatch handler
  const handleDispatch = async () => {
    if (!activeBooking) {
      showPillToast.error("Please select a booking request first.", "Notice");
      return;
    }
    if (selectedForwarders.length === 0) {
      showPillToast.error("Please select at least one forwarder.", "Notice");
      return;
    }

    setIsSending(true);
    setSendProgress({
      current: 0,
      total: selectedForwarders.length,
      forwarderName: "Initializing...",
    });

    try {
      const result = await dispatchMultiForwarderRequests({
        booking: activeBooking,
        forwarders: selectedForwarders,
        requiredSailingDate,
        deadline,
        specialInstructions,
        userId,
        userEmail,
        onProgress: (current, total, forwarderName) => {
          setSendProgress({ current, total, forwarderName });
        },
      });

      if (result.success) {
        setDispatchSuccess({
          total: result.totalDispatched,
          records: result.records,
        });

        showPillToast.build(
          `Dispatched independent requests to ${result.totalDispatched} forwarders with distinct Gmail threads.`,
          "Separate Request Emails Dispatched!",
          activeBooking.reference || activeBooking.movementNumber,
        );

        if (onDispatched) {
          onDispatched(result.records);
        }
      } else {
        showPillToast.error(
          result.errors[0]?.error || "Please check Gmail connection in Settings.",
          "Failed to dispatch forwarder requests",
        );
      }
    } catch (err: unknown) {
      console.error("[MultiForwarderModal] Error dispatching:", err);
      showPillToast.error(
        err instanceof Error ? err.message : "Failed to dispatch requests.",
        "Dispatch Error",
      );
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-white sm:rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 px-6 py-4 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl border border-[#0FA3B1]/20 bg-[#E8F5F6] text-[#0FA3B1]">
              <Users className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-[17px] font-bold text-slate-900 flex items-center gap-2">
                Multi-Forwarder Quote Request Desk
                <span className="inline-flex items-center gap-1 rounded-full bg-[#E8F5F6] px-2.5 py-0.5 text-[11px] font-bold text-[#0FA3B1]">
                  <Sparkles className="size-3" />
                  Independent Threads
                </span>
              </DialogTitle>
              <DialogDescription className="text-[12.5px] text-slate-500">
                Send separate quotation emails to multiple forwarders. Each forwarder receives their
                own dedicated message, Gmail thread, and response tracking.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Body */}
        {dispatchSuccess ? (
          /* Success Screen */
          <div className="p-8 text-center space-y-6 overflow-y-auto">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-xs">
              <CheckCircle2 className="size-8" />
            </div>

            <div>
              <h3 className="text-[19px] font-bold text-slate-900">
                Successfully Dispatched to {dispatchSuccess.total} Forwarders
              </h3>
              <p className="mt-1 text-[13.5px] text-slate-600 max-w-lg mx-auto">
                Each forwarder has been sent an isolated email with complete booking details. A
                dedicated record and distinct Gmail thread ID has been generated for each:
              </p>
            </div>

            {/* Dispatched Forwarders Card List */}
            <div className="max-w-xl mx-auto space-y-2.5 text-left">
              {dispatchSuccess.records.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-3.5"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[13.5px] text-slate-900">
                        {rec.forwarderName}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {rec.forwarderEmail}
                      </span>
                    </div>
                    <p className="text-[12px] text-slate-500 font-mono">
                      Gmail Thread ID:{" "}
                      <span className="text-[#0FA3B1] font-semibold">{rec.gmailThreadId}</span>
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                    <Check className="size-3" /> Dispatched
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-center gap-3">
              <Button
                type="button"
                onClick={() => {
                  setDispatchSuccess(null);
                  onClose();
                }}
                className="bg-[#0FA3B1] text-white hover:bg-[#0D919E] font-semibold px-6"
              >
                Done & View in Desk
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Top Booking Details Banner */}
            {activeBooking ? (
              <div className="rounded-2xl border border-slate-200/90 bg-slate-50/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[14px] font-bold text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                      {activeBooking.movementNumber || activeBooking.reference}
                    </span>
                    <span className="text-[12px] font-medium text-slate-500">
                      Booking Ref:{" "}
                      <strong className="text-slate-800">
                        {activeBooking.bookingReference || activeBooking.reference}
                      </strong>
                    </span>
                  </div>

                  {allBookings.length > 1 && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <span className="text-slate-500 font-medium">Switch Booking:</span>
                      <LifecycleDropdownSelect
                        value={selectedBookingId}
                        onChange={(val) => setSelectedBookingId(val)}
                        options={allBookings.map((b) => ({
                          value: b.id,
                          label: `${b.movementNumber || b.reference} — ${b.buyerName}`,
                        }))}
                        placeholder="Switch Booking"
                        size="sm"
                        activeColor="teal"
                        triggerClassName="h-8 min-w-[180px]"
                      />
                    </div>
                  )}
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-[12px] border-t border-slate-200/60 pt-3">
                  <div>
                    <span className="text-slate-400 font-medium">Shipper & Origin:</span>
                    <p className="font-semibold text-slate-800 line-clamp-1">
                      {activeBooking.supplierName}
                    </p>
                    <p className="text-[11px] text-slate-600 flex items-center gap-1.5 font-mono">
                      <CountryFlagSvg
                        countryCode={
                          getPortCountryMeta(activeBooking.polCode, activeBooking.polName)
                            .countryCode
                        }
                        size="xs"
                        title={
                          getPortCountryMeta(activeBooking.polCode, activeBooking.polName)
                            .countryName
                        }
                      />
                      <span>{activeBooking.polCode}</span>
                      <span className="text-slate-400 truncate">({activeBooking.polName})</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Consignee & Dest:</span>
                    <p className="font-semibold text-slate-800 line-clamp-1">
                      {activeBooking.buyerName}
                    </p>
                    <p className="text-[11px] text-slate-600 flex items-center gap-1.5 font-mono">
                      <CountryFlagSvg
                        countryCode={
                          getPortCountryMeta(activeBooking.podCode, activeBooking.podName)
                            .countryCode
                        }
                        size="xs"
                        title={
                          getPortCountryMeta(activeBooking.podCode, activeBooking.podName)
                            .countryName
                        }
                      />
                      <span>{activeBooking.podCode}</span>
                      <span className="text-slate-400 truncate">({activeBooking.podName})</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Cargo & Equipment:</span>
                    <p className="font-bold text-[#0FA3B1]">
                      {activeBooking.containerCount}x {activeBooking.containerSize} (
                      {activeBooking.containerType})
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      {activeBooking.cargo.description}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Target ETD:</span>
                    <p className="font-semibold text-slate-800">{activeBooking.requestedEtd}</p>
                    <p className="text-[11px] text-slate-500">
                      ETA: {activeBooking.estimatedEta || "Standard"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4 text-center text-[13px] text-amber-800">
                Please select a booking to proceed with quotes.
              </div>
            )}

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("select")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-lg transition-colors ${
                  activeTab === "select"
                    ? "bg-[#0FA3B1] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Users className="size-3.5" />
                Select Forwarders ({selectedForwarderIds.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                disabled={selectedForwarderIds.length === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-40 ${
                  activeTab === "preview"
                    ? "bg-[#0FA3B1] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Eye className="size-3.5" />
                Preview Personalized Emails
              </button>
            </div>

            {/* TAB 1: Select Forwarders & Settings */}
            {activeTab === "select" && (
              <div className="space-y-4">
                {/* Search and Select-All Bar */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      placeholder="Search forwarder by name, email, shipping lines..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-9 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleToggleAll}
                      className="h-9 text-xs border-slate-200"
                    >
                      {selectedForwarderIds.length === filteredForwarders.length
                        ? "Deselect All"
                        : "Select All Filtered"}
                    </Button>
                    <span className="text-xs text-slate-500 font-medium">
                      Selected: <strong>{selectedForwarderIds.length}</strong> of{" "}
                      {forwarders.length}
                    </span>
                  </div>
                </div>

                {/* Forwarders Grid / Cards */}
                {isLoadingForwarders ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    Loading forwarder accounts...
                  </div>
                ) : filteredForwarders.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
                    No forwarders match search query.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 max-h-60 overflow-y-auto p-1">
                    {filteredForwarders.map((f) => {
                      const isSelected = selectedForwarderIds.includes(f.id);

                      return (
                        <div
                          key={f.id}
                          onClick={() => handleToggleForwarder(f.id)}
                          className={`cursor-pointer select-none rounded-xl border p-3 transition-all ${
                            isSelected
                              ? "border-[#0FA3B1] bg-[#F0F9FA] shadow-xs"
                              : "border-slate-200/90 bg-white hover:border-slate-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-bold text-[13px] text-slate-900 truncate">
                                {f.name}
                              </h4>
                              <p className="text-[11.5px] text-slate-500 truncate">{f.email}</p>
                            </div>
                            <div
                              className={`grid size-5 shrink-0 place-items-center rounded-md border transition-colors ${
                                isSelected
                                  ? "border-[#0FA3B1] bg-[#0FA3B1] text-white"
                                  : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <Check className="size-3" />}
                            </div>
                          </div>

                          <div className="mt-2.5 flex flex-wrap items-center gap-1 text-[10.5px]">
                            {f.badge && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600">
                                {f.badge}
                              </span>
                            )}
                            {f.shippingLines && f.shippingLines.length > 0 && (
                              <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-slate-600 font-mono">
                                {f.shippingLines.slice(0, 2).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Additional Request Parameters */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <h4 className="text-[13px] font-bold text-slate-900 flex items-center gap-1.5">
                    <FileText className="size-4 text-[#0FA3B1]" />
                    Quotation Request Parameters
                  </h4>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <Label htmlFor="sailingDate" className="text-xs font-medium text-slate-600">
                        Required Sailing Date
                      </Label>
                      <Input
                        id="sailingDate"
                        type="date"
                        value={requiredSailingDate}
                        onChange={(e) => setRequiredSailingDate(e.target.value)}
                        className="mt-1 h-8.5 text-xs"
                      />
                    </div>

                    <div>
                      <LifecycleDropdownSelect
                        label="Quote Submission Deadline"
                        value={deadline}
                        onChange={(val) => setDeadline(val)}
                        options={[
                          { value: "Within 12 hours", label: "Within 12 hours (Urgent)" },
                          { value: "Within 24 hours", label: "Within 24 hours (Standard)" },
                          { value: "Within 48 hours", label: "Within 48 hours" },
                          { value: "End of Business Today", label: "End of Business Today" },
                        ]}
                        placeholder="Select Deadline"
                        size="sm"
                        activeColor="teal"
                        triggerClassName="h-9 w-full text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="specialInstructions"
                      className="text-xs font-medium text-slate-600"
                    >
                      Special Instructions / Remarks for Forwarders (Optional)
                    </Label>
                    <Input
                      id="specialInstructions"
                      type="text"
                      placeholder="e.g. Direct vessel preferred, 14 free days required, hazardous cert available..."
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      className="mt-1 h-8.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Email Preview */}
            {activeTab === "preview" && previewEmail && (
              <div className="space-y-4">
                {/* Forwarder Selector for Preview */}
                <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-2.5 border border-slate-200">
                  <span className="text-xs font-medium text-slate-600">
                    Previewing email for recipient:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedForwarders.map((f, idx) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPreviewForwarderIndex(idx)}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                          previewForwarderIndex === idx
                            ? "bg-[#0FA3B1] text-white shadow-xs"
                            : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Email Mock Display */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                  <div className="border-b border-slate-100 bg-slate-50/80 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-400 w-16">To:</span>
                      <span className="font-semibold text-slate-900">
                        {selectedForwarders[previewForwarderIndex]?.name} &lt;
                        {selectedForwarders[previewForwarderIndex]?.email}&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-400 w-16">Subject:</span>
                      <span className="font-bold text-slate-800">{previewEmail.subject}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-400 w-16">Mode:</span>
                      <span className="text-emerald-700 font-medium">
                        ✓ Independent Gmail Message & Thread (No CC/BCC shared)
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div
                      className="border border-slate-100 rounded-lg overflow-hidden"
                      dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(previewEmail.bodyHtml) }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer Controls */}
        {!dispatchSuccess && (
          <DialogFooter className="border-t border-slate-200 bg-slate-50/80 px-6 py-3.5 sm:justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Mail className="size-3.5 text-[#0FA3B1]" />
              <span>
                {selectedForwarders.length === 0
                  ? "Select forwarders to enable sending"
                  : `${selectedForwarders.length} separate email(s) will be generated`}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isSending}
                className="border-slate-200 text-slate-700 hover:bg-white"
              >
                Cancel
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleDispatch}
                disabled={isSending || selectedForwarders.length === 0 || !activeBooking}
                className="bg-[#0FA3B1] font-semibold text-white hover:bg-[#0D919E] gap-1.5 shadow-xs"
              >
                <Send className={`size-3.5 ${isSending ? "animate-spin" : ""}`} />
                {isSending
                  ? sendProgress
                    ? `Sending (${sendProgress.current}/${sendProgress.total})...`
                    : "Dispatching Requests..."
                  : `Send to ${selectedForwarders.length} Forwarder${selectedForwarders.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
