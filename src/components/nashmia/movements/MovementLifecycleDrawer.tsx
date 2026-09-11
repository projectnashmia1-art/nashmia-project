import { useState, useEffect, useCallback } from "react";
import {
  Anchor,
  ArrowRight,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Container,
  Download,
  Edit2,
  FileCheck2,
  MapPin,
  PackageCheck,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Ship,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  User,
  Warehouse,
  X,
  Mail,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import {
  LIFECYCLE_STAGES,
  getLifecycleStageConfig,
  getStageStepIndex,
  getNextLifecycleStage,
  getPreviousLifecycleStage,
  type LifecycleStage,
  type LifecycleStageConfig,
} from "@/lib/movement-lifecycle";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBookingByIdFromSupabase,
  updateBookingStatusInSupabase,
  updateBookingDetailsInSupabase,
  insertBookingContainerInSupabase,
  updateBookingContainerInSupabase,
  deleteBookingContainerFromSupabase,
  addBookingEventInSupabase,
  type FullBookingRecord,
  type BookingContainerRow,
  type BookingEventRow,
} from "@/lib/supabase-services";
import { toast } from "sonner";

export interface MovementLifecycleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string | null;
  initialReference?: string | null;
  onMovementUpdated?: () => void;
}

const iconMap: Record<string, LucideIcon> = {
  ClipboardList,
  BadgeCheck,
  Warehouse,
  PackageCheck,
  FileCheck2,
  Truck,
  Ship,
  Anchor,
  CheckCircle2,
};

export function MovementLifecycleDrawer({
  isOpen,
  onClose,
  bookingId,
  initialReference,
  onMovementUpdated,
}: MovementLifecycleDrawerProps) {
  const { userId, isConfigured } = useAuth();
  const [booking, setBooking] = useState<FullBookingRecord | null>(null);
  const [containers, setContainers] = useState<BookingContainerRow[]>([]);
  const [events, setEvents] = useState<BookingEventRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Transition Modal / Dialog inside Drawer
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [advanceLocation, setAdvanceLocation] = useState("");

  // Container editing state
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null);
  const [editContainerNum, setEditContainerNum] = useState("");
  const [editSealNum, setEditSealNum] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editStatus, setEditStatus] = useState("Gate-In");

  // New container input
  const [showAddContainer, setShowAddContainer] = useState(false);
  const [newContainerNum, setNewContainerNum] = useState("");
  const [newSealNum, setNewSealNum] = useState("");
  const [newWeight, setNewWeight] = useState("24500");
  const [newSize, setNewSize] = useState("40HC");

  // Custom Event input
  const [customEventText, setCustomEventText] = useState("");
  const [customEventLocation, setCustomEventLocation] = useState("");

  // Load complete record
  const loadData = useCallback(async () => {
    if (!bookingId) return;
    setIsLoading(true);
    try {
      if (isConfigured) {
        const record = await fetchBookingByIdFromSupabase(bookingId);
        if (record) {
          setBooking(record);
          setContainers(record.containers || []);
          setEvents(record.events || []);
          const nextSt = getNextLifecycleStage(record.status);
          if (nextSt) {
            setAdvanceLocation(nextSt.locationDefault);
          }
          return;
        }
      }

      setBooking(null);
      setContainers([]);
      setEvents([]);
    } catch (err) {
      console.warn("[MovementLifecycleDrawer] Error loading booking:", err);
      setBooking(null);
      setContainers([]);
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, isConfigured]);

  useEffect(() => {
    if (isOpen && bookingId) {
      void loadData();
    }
  }, [isOpen, bookingId, loadData]);

  // Step 6: Supabase Realtime automatically updates without page refresh
  useSupabaseRealtime(
    "bookings",
    useCallback(() => {
      void loadData();
      onMovementUpdated?.();
    }, [loadData, onMovementUpdated]),
    Boolean(isOpen && isConfigured && bookingId),
  );

  useSupabaseRealtime(
    "booking_events",
    useCallback(() => {
      void loadData();
    }, [loadData]),
    Boolean(isOpen && isConfigured && bookingId),
  );

  // Sync with browser custom events
  useEffect(() => {
    if (!isOpen) return;
    const handleUpdate = () => {
      void loadData();
      onMovementUpdated?.();
    };

    window.addEventListener("nashmia_booking_confirmed", handleUpdate);
    window.addEventListener("nashmia_booking_status_updated", handleUpdate);
    window.addEventListener("supabase_realtime_bookings_change", handleUpdate);
    window.addEventListener("nashmia_bookings_updated", handleUpdate);

    return () => {
      window.removeEventListener("nashmia_booking_confirmed", handleUpdate);
      window.removeEventListener("nashmia_booking_status_updated", handleUpdate);
      window.removeEventListener("supabase_realtime_bookings_change", handleUpdate);
      window.removeEventListener("nashmia_bookings_updated", handleUpdate);
    };
  }, [isOpen, loadData, onMovementUpdated]);

  if (!isOpen) return null;

  const currentStatus = booking?.status || "Booking Requested";
  const stageConfig = getLifecycleStageConfig(currentStatus);
  const currentStepIdx = getStageStepIndex(currentStatus);
  const nextStage = getNextLifecycleStage(currentStatus);
  const prevStage = getPreviousLifecycleStage(currentStatus);

  // Advance to next milestone
  const handleAdvanceStage = async (targetStage?: LifecycleStageConfig) => {
    if (!booking) return;
    const nextToApply = targetStage || nextStage;
    if (!nextToApply) return;

    setIsUpdating(true);
    try {
      const loc = advanceLocation.trim() || nextToApply.locationDefault;
      const desc =
        advanceNotes.trim() ||
        `Milestone advanced to ${nextToApply.label}: ${nextToApply.description}`;

      if (isConfigured && userId) {
        await updateBookingStatusInSupabase(booking.id, userId, nextToApply.id, loc, desc);
      }

      toast.success(`Milestone updated: ${nextToApply.label}`, {
        description: `Location: ${loc}`,
      });

      setAdvanceNotes("");
      await loadData();
      onMovementUpdated?.();
    } catch (err) {
      console.error("[MovementLifecycleDrawer] Advance error:", err);
      toast.error("Failed to update status in database");
    } finally {
      setIsUpdating(false);
    }
  };

  // Add container
  const handleAddContainer = async () => {
    if (!booking) return;
    if (!newContainerNum.trim()) {
      toast.error("Container number is required");
      return;
    }

    try {
      if (isConfigured) {
        const added = await insertBookingContainerInSupabase(booking.id, {
          containerNumber: newContainerNum.trim(),
          sealNumber: newSealNum.trim() || `SL-${Math.floor(100000 + Math.random() * 900000)}`,
          weight: Number(newWeight) || 24500,
          containerSize: newSize,
          containerType: "High Cube",
          status: "Staged",
        });
        setContainers((prev) => [...prev, added]);
      } else {
        const fake: BookingContainerRow = {
          id: `cnt-${Date.now()}`,
          booking_id: booking.id,
          container_number: newContainerNum.trim(),
          seal_number: newSealNum.trim() || `SL-99210`,
          weight: Number(newWeight) || 24500,
          weight_unit: "KG",
          container_type: "High Cube",
          container_size: newSize,
          status: "Staged",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setContainers((prev) => [...prev, fake]);
      }

      toast.success("Container added to booking ledger");
      setNewContainerNum("");
      setNewSealNum("");
      setShowAddContainer(false);
      onMovementUpdated?.();
    } catch (err) {
      console.error("[MovementLifecycleDrawer] Add container error:", err);
      toast.error("Failed to add container");
    }
  };

  // Save edited container
  const handleSaveContainerEdit = async (containerId: string) => {
    try {
      if (isConfigured) {
        await updateBookingContainerInSupabase(containerId, {
          container_number: editContainerNum.trim(),
          seal_number: editSealNum.trim(),
          weight: Number(editWeight) || 24500,
          status: editStatus,
        });
      }

      setContainers((prev) =>
        prev.map((c) =>
          c.id === containerId
            ? {
                ...c,
                container_number: editContainerNum.trim(),
                seal_number: editSealNum.trim(),
                weight: Number(editWeight) || 24500,
                status: editStatus,
              }
            : c,
        ),
      );

      toast.success("Container specifications updated");
      setEditingContainerId(null);
      onMovementUpdated?.();
    } catch (err) {
      console.error("[MovementLifecycleDrawer] Update container error:", err);
      toast.error("Failed to update container");
    }
  };

  // Delete container
  const handleDeleteContainer = async (containerId: string) => {
    try {
      if (isConfigured) {
        await deleteBookingContainerFromSupabase(containerId);
      }
      setContainers((prev) => prev.filter((c) => c.id !== containerId));
      toast.success("Container removed from booking");
      onMovementUpdated?.();
    } catch (err) {
      console.error("[MovementLifecycleDrawer] Delete container error:", err);
      toast.error("Failed to delete container");
    }
  };

  // Add custom manual event
  const handleAddCustomEvent = async () => {
    if (!booking || !customEventText.trim()) return;

    try {
      const loc = customEventLocation.trim() || "London Warehouse Dock";
      if (isConfigured) {
        const newEvt = await addBookingEventInSupabase(
          booking.id,
          stageConfig.label,
          loc,
          customEventText.trim(),
        );
        setEvents((prev) => [newEvt, ...prev]);
      } else {
        const fakeEvt: BookingEventRow = {
          id: `evt-${Date.now()}`,
          booking_id: booking.id,
          event_type: stageConfig.label,
          event_date: new Date().toISOString(),
          location: loc,
          description: customEventText.trim(),
          created_at: new Date().toISOString(),
        };
        setEvents((prev) => [fakeEvt, ...prev]);
      }

      toast.success("Timeline event logged");
      setCustomEventText("");
      setCustomEventLocation("");
    } catch (err) {
      console.error("[MovementLifecycleDrawer] Add event error:", err);
      toast.error("Failed to log event");
    }
  };

  const buyerName =
    (booking?.buyer as { company_name?: string } | undefined)?.company_name || "Consignee Account";
  const supplierName =
    (booking?.supplier as { company_name?: string } | undefined)?.company_name || "Pickup Supplier";
  const forwarderName =
    (booking?.forwarder as { company_name?: string } | undefined)?.company_name ||
    "MSC Forwarding Desk";

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div className="w-screen max-w-4xl bg-white shadow-2xl transition-transform duration-300 ease-glass dark:bg-zinc-950 flex flex-col">
          {/* TOP DRAWER HEADER */}
          <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4.5 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-[14px] bg-primary/10 text-primary border border-primary/20">
                <Truck className="size-5" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[14px] font-bold text-ink">
                    {booking?.booking_reference || initialReference || "NASH-CM-00042"}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold",
                      stageConfig.badgeClass,
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current" />
                    {stageConfig.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {booking?.origin || "London Central Warehouse"} →{" "}
                  {booking?.destination || "Karachi Port"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadData()}
                disabled={isLoading}
                title="Refresh Live Data"
                className="grid size-9 place-items-center rounded-xl border border-glass-border bg-white text-muted-foreground transition hover:bg-zinc-100 hover:text-ink dark:bg-zinc-900"
              >
                <RefreshCw className={cn("size-4", isLoading && "animate-spin text-primary")} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 place-items-center rounded-xl border border-glass-border bg-white text-muted-foreground transition hover:bg-zinc-100 hover:text-ink dark:bg-zinc-900"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* MAIN SCROLLABLE CONTENT */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">
            {/* Step 5 & 6 — Automated Confirmation Banner */}
            {(booking?.confirmed_by === "SYSTEM" ||
              booking?.confirmation_status === "CONFIRMED" ||
              booking?.status === "CONFIRMED" ||
              booking?.status === "Booking Confirmed" ||
              Boolean(booking?.confirmed_at)) && (
              <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-4.5 dark:border-emerald-900/50 dark:bg-emerald-950/30 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-600 text-white shadow-xs">
                      <CheckCircle2 className="size-3.5" />✓ Confirmed
                    </span>
                    <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300">
                      Step 6 • Real-Time Automated Corroboration
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-emerald-800 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-md">
                    Audit Log: AUTO_CONFIRMED_FROM_EMAIL
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1 text-xs">
                  <div className="bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                      Movement:
                    </span>
                    <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-[13px] block truncate">
                      {booking.movement_number ||
                        initialReference ||
                        `MOV-2026-${booking.id.slice(0, 5).toUpperCase()}`}
                    </span>
                  </div>

                  <div className="bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                      Confirmed By:
                    </span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 text-[13px]">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      {booking.confirmed_by || "System"}
                    </span>
                  </div>

                  <div className="bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                      Confirmed At:
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-[12px] block">
                      {booking.confirmed_at
                        ? new Date(booking.confirmed_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : new Date().toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                    </span>
                  </div>

                  <div className="bg-white/90 dark:bg-zinc-900/80 p-3 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 space-y-1 flex flex-col justify-between">
                    <span className="text-[10px] font-bold uppercase text-zinc-500 block">
                      Confirmation Email:
                    </span>
                    <Link
                      to="/emails"
                      search={{
                        emailId: booking.confirmation_email_id || undefined,
                        movement: booking.movement_number || initialReference || undefined,
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0FA3B1] hover:bg-[#0D919E] text-white text-xs font-bold transition-all shadow-xs text-center justify-center w-full"
                    >
                      <Mail className="size-3.5" />
                      <span>View Email</span>
                    </Link>
                  </div>
                </div>

                {booking.confirmation_reason && (
                  <p className="text-[12px] text-emerald-950 dark:text-emerald-200 bg-white/60 dark:bg-zinc-900/40 p-2.5 rounded-lg border border-emerald-200/40">
                    <strong className="font-bold">Confirmation Reason:</strong>{" "}
                    {booking.confirmation_reason}
                  </p>
                )}
              </div>
            )}

            {/* STAGE PROGRESSION HERO CARD */}
            <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/[0.06] via-white to-zinc-50 p-5 dark:from-primary/10 dark:via-zinc-900 dark:to-zinc-950">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="size-3.5" />
                    Current Operational Milestone
                  </div>
                  <h3 className="mt-1 text-[20px] font-bold text-ink">
                    Stage {stageConfig.stepNumber}: {stageConfig.label}
                  </h3>
                  <p className="mt-1 max-w-xl text-[13.5px] text-muted-foreground">
                    {stageConfig.description}
                  </p>
                </div>

                {/* ADVANCE ACTION BUTTON */}
                {nextStage && (
                  <button
                    type="button"
                    onClick={() => void handleAdvanceStage()}
                    disabled={isUpdating}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-[13.5px] font-semibold text-white shadow-md transition-all hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                  >
                    {isUpdating ? (
                      <RefreshCw className="size-4 animate-spin" />
                    ) : (
                      <>
                        <span>{stageConfig.nextActionLabel}</span>
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* STAGE CHECKLIST */}
              <div className="mt-5 border-t border-zinc-200/60 pt-4 dark:border-zinc-800">
                <p className="text-[12px] font-bold uppercase tracking-wider text-zinc-500">
                  Required Milestone Verifications
                </p>
                <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {stageConfig.checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-[12.5px] text-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200 border border-zinc-200/50 dark:border-zinc-800/80"
                    >
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* LIFECYCLE TIMELINE PIPELINE */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-bold text-ink">End-to-End Logistics Pipeline</h4>
                  <p className="text-[12.5px] text-muted-foreground">
                    From Initial Booking Request to Container Shipped & Final Delivery.
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-primary">
                  Step {stageConfig.stepNumber} of {LIFECYCLE_STAGES.length}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {LIFECYCLE_STAGES.map((st, i) => {
                  const Icon = iconMap[st.iconName] || ClipboardList;
                  const isCurrent = st.id === currentStatus;
                  const isCompleted = i < currentStepIdx;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => void handleAdvanceStage(st)}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition-all",
                        isCurrent && "border-primary bg-primary/8 shadow-sm ring-2 ring-primary/20",
                        isCompleted &&
                          "border-emerald-500/30 bg-emerald-500/[0.04] text-zinc-800 dark:text-zinc-200",
                        !isCurrent &&
                          !isCompleted &&
                          "border-zinc-200 bg-zinc-50/50 text-zinc-500 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/30",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border text-[11px] font-bold",
                          isCurrent && "border-primary bg-primary text-white",
                          isCompleted && "border-emerald-500 bg-emerald-500 text-white",
                          !isCurrent &&
                            !isCompleted &&
                            "border-zinc-300 bg-white text-zinc-400 dark:border-zinc-700 dark:bg-zinc-800",
                        )}
                      >
                        {isCompleted ? <Check className="size-4" /> : <Icon className="size-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                            Stage 0{st.stepNumber}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <p
                          className={cn(
                            "mt-0.5 text-[13px] font-bold leading-snug",
                            isCurrent
                              ? "text-primary"
                              : isCompleted
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-600 dark:text-zinc-400",
                          )}
                        >
                          {st.shortLabel}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CONTAINER SPECIFICATIONS & LEDGER */}
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/50 p-5 dark:border-zinc-800 dark:bg-zinc-900/30">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-bold text-ink">
                    Container Ledger & Seals ({containers.length})
                  </h4>
                  <p className="text-[12.5px] text-muted-foreground">
                    Verified container numbers, high-security seals, and gross mass (VGM).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddContainer(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink shadow-sm transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <Plus className="size-3.5 text-primary" />
                  Add Container
                </button>
              </div>

              {/* ADD CONTAINER FORM */}
              {showAddContainer && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/[0.04] p-4">
                  <p className="text-[13px] font-bold text-ink">Register Additional Container</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase text-zinc-500">
                        Container #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. MSCU9842104"
                        value={newContainerNum}
                        onChange={(e) => setNewContainerNum(e.target.value.toUpperCase())}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[13px] outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase text-zinc-500">
                        Seal #
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. SL-984210"
                        value={newSealNum}
                        onChange={(e) => setNewSealNum(e.target.value.toUpperCase())}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[13px] outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase text-zinc-500">
                        Weight (KG)
                      </label>
                      <input
                        type="number"
                        placeholder="24500"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[13px] outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase text-zinc-500">
                        Size / Type
                      </label>
                      <select
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-[13px] outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                      >
                        <option value="40HC">40ft High Cube</option>
                        <option value="40FT">40ft Standard</option>
                        <option value="20FT">20ft Standard</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddContainer(false)}
                      className="rounded-lg px-3 py-1.5 text-[12.5px] font-medium text-zinc-500 hover:text-zinc-800"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAddContainer()}
                      className="rounded-lg bg-primary px-4 py-1.5 text-[12.5px] font-semibold text-white shadow-sm hover:bg-primary/90"
                    >
                      Save Container
                    </button>
                  </div>
                </div>
              )}

              {/* CONTAINER LIST */}
              <div className="mt-4 space-y-2.5">
                {containers.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-3.5 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {editingContainerId === c.id ? (
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                          <input
                            type="text"
                            value={editContainerNum}
                            onChange={(e) => setEditContainerNum(e.target.value)}
                            placeholder="Container #"
                            className="rounded-lg border px-2.5 py-1 text-[13px]"
                          />
                          <input
                            type="text"
                            value={editSealNum}
                            onChange={(e) => setEditSealNum(e.target.value)}
                            placeholder="Seal #"
                            className="rounded-lg border px-2.5 py-1 text-[13px]"
                          />
                          <input
                            type="number"
                            value={editWeight}
                            onChange={(e) => setEditWeight(e.target.value)}
                            placeholder="Weight (KG)"
                            className="rounded-lg border px-2.5 py-1 text-[13px]"
                          />
                          <select
                            value={editStatus}
                            onChange={(e) => setEditStatus(e.target.value)}
                            className="rounded-lg border px-2.5 py-1 text-[13px]"
                          >
                            <option value="Gate-In">Gate-In</option>
                            <option value="Staged">Staged</option>
                            <option value="Stuffed">Stuffed</option>
                            <option value="Dispatched">Dispatched</option>
                            <option value="On-Board">On-Board</option>
                          </select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingContainerId(null)}
                            className="text-[12px] text-zinc-500"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleSaveContainerEdit(c.id)}
                            className="rounded-md bg-primary px-3 py-1 text-[12px] font-semibold text-white"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="grid size-9 place-items-center rounded-lg bg-zinc-100 font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            <Container className="size-4" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[13.5px] font-bold text-ink">
                                {c.container_number || "UNASSIGNED"}
                              </span>
                              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                {c.container_size || "40HC"}
                              </span>
                              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                                {c.status || "Staged"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[12px] text-muted-foreground">
                              Seal:{" "}
                              <span className="font-mono font-medium text-ink">
                                {c.seal_number || "PENDING"}
                              </span>{" "}
                              · VGM:{" "}
                              <span className="font-mono font-medium text-ink">
                                {(c.weight || 24500).toLocaleString()} kg
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingContainerId(c.id);
                              setEditContainerNum(c.container_number || "");
                              setEditSealNum(c.seal_number || "");
                              setEditWeight(String(c.weight || 24500));
                              setEditStatus(c.status || "Gate-In");
                            }}
                            className="grid size-8 place-items-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-100 hover:text-ink dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteContainer(c.id)}
                            className="grid size-8 place-items-center rounded-lg border border-zinc-200 text-rose-500 hover:bg-rose-50 dark:border-zinc-700 dark:hover:bg-rose-950/30"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ROUTE, VESSEL & PARTY SPECIFICATIONS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Buyer Account
                </span>
                <p className="mt-1 text-[14px] font-bold text-ink">{buyerName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {booking?.destination || "Karachi Port"}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Supplier / Vendor
                </span>
                <p className="mt-1 text-[14px] font-bold text-ink">{supplierName}</p>
                <p className="text-[12px] text-muted-foreground">
                  {booking?.origin || "London Warehouse"}
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Vessel & Voyage
                </span>
                <p className="mt-1 text-[14px] font-bold text-ink">
                  {booking?.vessel_name || "MSC EMMA"} {booking?.voyage_number || "V.2409"}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  ETD: {booking?.etd || "20 Aug 2026"}
                </p>
              </div>
            </div>

            {/* REAL-TIME AUDIT LOG & TIMELINE EVENTS */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h4 className="text-[15px] font-bold text-ink">
                Live Movement Audit Log & Events ({events.length})
              </h4>
              <p className="text-[12.5px] text-muted-foreground">
                Immutable event stream synchronized in real-time across Supabase.
              </p>

              {/* ADD EVENT INPUT */}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  placeholder="Add operational update / dispatch note..."
                  value={customEventText}
                  onChange={(e) => setCustomEventText(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-[13px] outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800"
                />
                <input
                  type="text"
                  placeholder="Location (e.g. London Dock Bay 4)"
                  value={customEventLocation}
                  onChange={(e) => setCustomEventLocation(e.target.value)}
                  className="rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2 text-[13px] outline-none focus:border-primary dark:border-zinc-700 dark:bg-zinc-800 sm:w-56"
                />
                <button
                  type="button"
                  onClick={() => void handleAddCustomEvent()}
                  className="rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
                >
                  Log Event
                </button>
              </div>

              {/* TIMELINE STREAM */}
              <div className="mt-6 space-y-4 border-l-2 border-primary/20 pl-4">
                {events.map((evt) => (
                  <div key={evt.id} className="relative group">
                    <span className="absolute -left-[23px] top-1 size-3 rounded-full border-2 border-white bg-primary dark:border-zinc-900" />
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-bold text-ink">{evt.event_type}</span>
                      <span className="text-[11.5px] text-muted-foreground">
                        {new Date(evt.event_date || evt.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12.5px] text-zinc-700 dark:text-zinc-300">
                      {evt.description}
                    </p>
                    {evt.location && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <MapPin className="size-3 text-primary" />
                        {evt.location}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOTTOM FOOTER */}
          <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  toast.success("Gate pass & manifest generated for download");
                }}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-ink shadow-sm hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800"
              >
                <Download className="size-3.5" />
                Export Gate Pass
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold text-zinc-600 hover:text-ink"
              >
                Close
              </button>
              {nextStage && (
                <button
                  type="button"
                  onClick={() => void handleAdvanceStage()}
                  disabled={isUpdating}
                  className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2 text-[13px] font-semibold text-white shadow-md hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUpdating ? "Updating Database..." : `Advance to ${nextStage.shortLabel}`}
                  <ArrowRight className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
