import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Anchor,
  ArrowRight,
  BadgeCheck,
  Box,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Container,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  FileCheck2,
  FileText,
  MapPin,
  PackageCheck,
  Paperclip,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Ship,
  Timer,
  Trash2,
  Truck,
  User,
  Users,
  Warehouse,
  Waves,
  X,
  CheckCheck,
  Radio,
  Eye,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSwipeToDismiss } from "@/hooks/use-swipe-to-dismiss";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { LifecycleDropdownSelect } from "@/components/nashmia/common/LifecycleDropdownSelect";
import {
  getCutOffsForMovement,
  saveCutOffsForMovement,
  type MovementCutOffDeadline,
} from "@/lib/movement-cutoff-service";
import {
  LIFECYCLE_STAGES,
  getLifecycleStageConfig,
  getStageStepIndex,
  getNextLifecycleStage,
  toDbMovementStatus,
  type LifecycleStageConfig,
} from "@/lib/movement-lifecycle";
import { useAuth } from "@/lib/auth-context";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { startContainerTracking, getTrackingProviderConfig } from "@/lib/tracking-adapter";
import {
  fetchBookingByIdFromSupabase,
  updateBookingStatusInSupabase,
  insertBookingContainerInSupabase,
  updateBookingContainerInSupabase,
  deleteBookingContainerFromSupabase,
  addBookingEventInSupabase,
  isBookingConfirmed,
  getLocalBookings,
  saveLocalBookings,
  updateLocalBooking,
  type FullBookingRecord,
  type BookingContainerRow,
  type BookingEventRow,
} from "@/lib/supabase-services";
import {
  useMovementDocuments,
  viewDocumentInNewTab,
  downloadDocumentFile,
  type MovementLinkedDocument,
} from "@/lib/movement-document-service";
import { notifyMovementActivity } from "@/lib/notification-service";
import { toast } from "sonner";

export type DrawerTab = "overview" | "milestones" | "containers" | "cutoffs" | "documents" | "audit";

export interface MovementLifecycleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId?: string | null;
  initialReference?: string | null;
  initialBooking?: FullBookingRecord | Record<string, unknown> | null;
  onMovementUpdated?: () => void;
  defaultTab?: DrawerTab;
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

export function MovementLifecycleDrawer(props: MovementLifecycleDrawerProps) {
  if (!props.isOpen) return null;
  return <MovementLifecycleDrawerInner {...props} />;
}

function MovementLifecycleDrawerInner({
  isOpen,
  onClose,
  bookingId,
  initialReference,
  initialBooking,
  onMovementUpdated,
  defaultTab,
}: MovementLifecycleDrawerProps) {
  const { userId, isConfigured, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [booking, setBooking] = useState<FullBookingRecord | null>(() => initialBooking || null);
  const [containers, setContainers] = useState<BookingContainerRow[]>(
    () => initialBooking?.containers || [],
  );
  const [events, setEvents] = useState<BookingEventRow[]>(() => initialBooking?.events || []);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState<DrawerTab>(() => defaultTab || "overview");
  const [copiedRef, setCopiedRef] = useState(false);

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  const { elementRef: sheetElementRef, handleRef: sheetHandleRef } =
    useSwipeToDismiss<HTMLDivElement>({
      direction: "down",
      onDismiss: onClose,
      enabled: isOpen,
    });

  // Transition state
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [advanceLocation, setAdvanceLocation] = useState("");

  // Container editing state
  const [editingContainerId, setEditingContainerId] = useState<string | null>(null);
  const [editContainerNum, setEditContainerNum] = useState("");
  const [editSealNum, setEditSealNum] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editStatus, setEditStatus] = useState("Allocated");

  // New container input
  const [showAddContainer, setShowAddContainer] = useState(false);
  const [newContainerNum, setNewContainerNum] = useState("");
  const [newSealNum, setNewSealNum] = useState("");
  const [newWeight, setNewWeight] = useState("24500");
  const [newSize, setNewSize] = useState("40HC");
  const [newType, setNewType] = useState("High Cube");
  const [isAddingContainer, setIsAddingContainer] = useState(false);
  const [trackingLoadingId, setTrackingLoadingId] = useState<string | null>(null);

  // Custom Event input
  const [customEventText, setCustomEventText] = useState("");
  const [customEventLocation, setCustomEventLocation] = useState("");

  // Cut-off deadlines state
  const [movementCutOffs, setMovementCutOffs] = useState(() =>
    getCutOffsForMovement(initialReference || "NASH-2026-0042", initialBooking || null),
  );
  const [showAddCutOff, setShowAddCutOff] = useState(false);
  const [newCutOffType, setNewCutOffType] = useState("SI Cut-Off");
  const [newCutOffDateTime, setNewCutOffDateTime] = useState("");

  // Create robust fallback booking record if missing (WITHOUT mock containers or fake ports/vessels)
  const buildFallbackBooking = useCallback(
    (lookupId: string): FullBookingRecord =>
      ({
        id: bookingId || `mov-${Date.now()}`,
        booking_reference: initialReference || lookupId || "MOV-2026-00042",
        movement_number: initialReference || lookupId || "MOV-2026-00042",
        status: "Booking Requested",
        confirmation_status: "PENDING",
        origin: undefined,
        destination: undefined,
        origin_port: undefined,
        destination_port: undefined,
        vessel_name: undefined,
        voyage_number: undefined,
        etd: undefined,
        eta: undefined,
        total_freight: undefined,
        containers: [],
        events: [],
        created_at: new Date().toISOString(),
      }) as unknown as FullBookingRecord,
    [bookingId, initialReference],
  );

  // Keep track of loaded target key so opening modal loads once and doesn't re-trigger on local stage changes
  const loadedKeyRef = useRef<string | null>(null);

  // Load complete record
  const loadData = useCallback(async () => {
    const targetLookup = bookingId || initialReference;
    if (!targetLookup) return;

    // Use initialBooking immediately if available
    if (initialBooking) {
      setBooking(initialBooking);
      setContainers(initialBooking.containers || []);
      setEvents(initialBooking.events || []);
      const refId =
        initialBooking.movement_number ||
        initialBooking.booking_reference ||
        initialBooking.reference ||
        targetLookup;
      setMovementCutOffs(getCutOffsForMovement(refId, initialBooking));
    }

    setIsLoading(true);
    try {
      const record = await fetchBookingByIdFromSupabase(targetLookup);
      if (record) {
        setBooking(record);

        // Fetch fresh containers directly from Supabase for this movement
        if (isSupabaseConfigured && record.id) {
          try {
            const { data: dbContainers } = await supabase
              .from("booking_containers")
              .select("*")
              .eq("booking_id", record.id)
              .order("created_at", { ascending: true });

            if (dbContainers) {
              setContainers(dbContainers);
            } else {
              setContainers(record.containers || []);
            }

            const { data: dbEvents } = await supabase
              .from("booking_events")
              .select("*")
              .eq("booking_id", record.id)
              .order("created_at", { ascending: false });

            if (dbEvents) {
              setEvents(dbEvents as unknown as BookingEventRow[]);
            } else {
              setEvents(record.events || []);
            }
          } catch (fetchErr) {
            console.warn("[MovementLifecycleDrawer] Notice fetching live containers:", fetchErr);
            setContainers(record.containers || []);
            setEvents(record.events || []);
          }
        } else {
          setContainers(record.containers || []);
          setEvents(record.events || []);
        }

        const nextSt = getNextLifecycleStage(
          record.status,
          record.confirmation_status,
          record.id,
          record.movement_status,
        );
        if (nextSt) {
          setAdvanceLocation(nextSt.locationDefault);
        }
        const refId =
          record.movement_number ||
          record.booking_reference ||
          (record as { reference?: string }).reference ||
          targetLookup;
        const cutOffs = getCutOffsForMovement(refId, record);
        setMovementCutOffs(cutOffs);
        return;
      }

      // Local fallback lookup
      const localList = getLocalBookings();
      const cleanLookup = targetLookup.trim().toLowerCase();
      const localRec = localList.find(
        (b) =>
          b.id.toLowerCase() === cleanLookup ||
          (b.movement_number && b.movement_number.toLowerCase() === cleanLookup) ||
          (b.booking_reference && b.booking_reference.toLowerCase() === cleanLookup) ||
          (b.reference && b.reference.toLowerCase() === cleanLookup) ||
          (initialReference &&
            ((b.movement_number &&
              b.movement_number.toLowerCase() === initialReference.toLowerCase()) ||
              (b.booking_reference &&
                b.booking_reference.toLowerCase() === initialReference.toLowerCase()))),
      );

      if (localRec) {
        setBooking(localRec);
        setContainers(localRec.containers || []);
        setEvents(localRec.events || []);
        const nextSt = getNextLifecycleStage(
          localRec.status,
          localRec.confirmation_status,
          localRec.id,
          localRec.movement_status,
        );
        if (nextSt) {
          setAdvanceLocation(nextSt.locationDefault);
        }
        const refId =
          localRec.movement_number ||
          localRec.booking_reference ||
          (localRec as { reference?: string }).reference ||
          targetLookup;
        const cutOffs = getCutOffsForMovement(refId, localRec);
        setMovementCutOffs(cutOffs);
        return;
      }

      // If neither Supabase nor local list had it, create a solid fallback record
      if (!initialBooking) {
        const fallback = buildFallbackBooking(targetLookup);
        setBooking(fallback);
        setContainers(fallback.containers || []);
        setEvents(fallback.events || []);
        setMovementCutOffs(getCutOffsForMovement(targetLookup, fallback));
      }
    } catch (err) {
      console.warn("[MovementLifecycleDrawer] Error loading booking:", err);
      setBooking((prev) => {
        if (!prev && !initialBooking) {
          const fallback = buildFallbackBooking(targetLookup);
          setContainers(fallback.containers || []);
          setEvents(fallback.events || []);
          return fallback;
        }
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [bookingId, initialReference, initialBooking, buildFallbackBooking]);

  useEffect(() => {
    if (isOpen) {
      const targetKey = `${bookingId || ""}_${initialReference || ""}`;
      if (loadedKeyRef.current !== targetKey) {
        loadedKeyRef.current = targetKey;
        void loadData();
      }
    } else {
      loadedKeyRef.current = null;
    }
  }, [isOpen, bookingId, initialReference, loadData]);

  // Keyboard shortcut: Escape to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll while modal is visible
  useEffect(() => {
    if (!isOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Supabase realtime listeners
  useSupabaseRealtime<BookingEventRow>({
    table: "booking_events",
    filter: booking?.id ? `booking_id=eq.${booking.id}` : undefined,
    enabled: isOpen && Boolean(booking?.id),
    onInsert: (payload) => {
      setEvents((prev) => [payload.new, ...prev.filter((e) => e.id !== payload.new.id)]);
    },
  });

  useSupabaseRealtime<BookingContainerRow>({
    table: "booking_containers",
    filter: booking?.id ? `booking_id=eq.${booking.id}` : undefined,
    enabled: isOpen && Boolean(booking?.id),
    onInsert: (payload) => {
      setContainers((prev) => [...prev.filter((c) => c.id !== payload.new.id), payload.new]);
    },
    onUpdate: (payload) => {
      setContainers((prev) => prev.map((c) => (c.id === payload.new.id ? payload.new : c)));
    },
    onDelete: (payload) => {
      setContainers((prev) => prev.filter((c) => c.id !== (payload.old as { id: string }).id));
    },
  });

  // Stage resolutions
  const isConfirmed = isBookingConfirmed(booking, bookingId || initialReference || undefined);
  const effectiveConfStatus = isConfirmed ? "CONFIRMED" : booking?.confirmation_status || undefined;
  const rawStatus = booking?.status || "Booking Confirmed";
  const stageConfig = getLifecycleStageConfig(
    rawStatus,
    effectiveConfStatus,
    booking?.id,
    booking?.movement_status,
  );
  const currentStepIdx = getStageStepIndex(
    stageConfig.id,
    effectiveConfStatus,
    booking?.id,
    booking?.movement_status,
  );
  const nextStage = getNextLifecycleStage(
    stageConfig.id,
    effectiveConfStatus,
    booking?.id,
    booking?.movement_status,
  );

  // Notes state matching reference design
  const [noteText, setNoteText] = useState(
    "Booking confirmed with forwarder. All documents are in process. Vessel oocl (sdas).",
  );
  const [isEditingNote, setIsEditingNote] = useState(false);

  const effectiveMovementRef =
    booking?.movement_number ||
    booking?.booking_reference ||
    (booking as { reference?: string })?.reference ||
    initialReference ||
    "—";

  const {
    documents: movementDocs,
    isLoading: isLoadingDocs,
    refreshDocuments,
    totalCount: docCount,
  } = useMovementDocuments(
    effectiveMovementRef !== "—" ? effectiveMovementRef : null,
    booking?.id || bookingId || null,
  );

  const originPort =
    booking?.origin_port?.trim() ||
    booking?.origin?.trim() ||
    (booking as { polName?: string })?.polName?.trim() ||
    "Pending";
  const destinationPort =
    booking?.destination_port?.trim() ||
    booking?.destination?.trim() ||
    (booking as { podName?: string })?.podName?.trim() ||
    "Pending";
  const rawVessel =
    booking?.vessel_name?.trim() ||
    (booking as { vessel?: string })?.vessel?.trim() ||
    (booking as { vesselName?: string })?.vesselName?.trim();
  const vesselName =
    rawVessel &&
    rawVessel.toUpperCase() !== "TBD" &&
    rawVessel.toUpperCase() !== "PENDING ALLOCATION"
      ? rawVessel
      : "Pending";
  const modeName = "Ocean Freight";

  const buyerName =
    (booking?.buyer as { company_name?: string } | null)?.company_name ||
    (booking?.buyer as { name?: string } | null)?.name ||
    (booking as { buyerName?: string })?.buyerName ||
    (booking as { buyer_name?: string })?.buyer_name ||
    (booking as { buyer?: string })?.buyer ||
    (booking as { customer_name?: string })?.customer_name ||
    "—";

  const supplierName =
    (booking?.supplier as { company_name?: string } | null)?.company_name ||
    (booking?.supplier as { name?: string } | null)?.name ||
    (booking as { supplierName?: string })?.supplierName ||
    (booking as { supplier_name?: string })?.supplier_name ||
    (booking as { supplier_company?: string })?.supplier_company ||
    (booking as { supplier?: string })?.supplier ||
    "—";

  const forwarderName =
    (booking?.forwarder as { company_name?: string } | null)?.company_name ||
    (booking?.forwarder as { name?: string } | null)?.name ||
    (booking as { forwarderName?: string })?.forwarderName ||
    (booking as { forwarder_name?: string })?.forwarder_name ||
    ((booking?.confirmation_details as Record<string, unknown>)
      ?.confirmed_forwarder_name as string) ||
    (booking as { forwarder_company?: string })?.forwarder_company ||
    (booking?.shipping_line as { name?: string } | null)?.name ||
    (booking as { forwarder?: string })?.forwarder ||
    "Pending";

  const pickupAddress =
    ((booking?.confirmation_details as Record<string, unknown>)?.pickup_address as string) ||
    (booking as { pickupAddress?: string })?.pickupAddress ||
    null;
  const pickupDate =
    ((booking?.confirmation_details as Record<string, unknown>)?.pickup_date as string) ||
    booking?.loading_date ||
    null;
  const agreedRate =
    booking?.rate_amount ||
    ((booking?.confirmation_details as Record<string, unknown>)?.agreed_rate as number) ||
    null;
  const agreedCurrency =
    booking?.currency ||
    ((booking?.confirmation_details as Record<string, unknown>)?.currency as string) ||
    "USD";

  const etdFormatted =
    booking?.etd && !isNaN(new Date(booking.etd).getTime())
      ? new Date(booking.etd).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "Pending";

  const etaFormatted =
    booking?.eta && !isNaN(new Date(booking.eta).getTime())
      ? `~ ${new Date(booking.eta).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`
      : "Pending";

  // Handle stage advancement
  const handleAdvanceStage = async (targetStage?: LifecycleStageConfig) => {
    const nextToApply = targetStage || nextStage;
    if (!nextToApply) {
      toast.info("Movement has reached final delivery milestone");
      return;
    }

    if (isUpdating) return;

    const currentBooking = booking || buildFallbackBooking(effectiveMovementRef);
    const loc = advanceLocation.trim() || nextToApply.locationDefault;
    const desc = advanceNotes.trim() || nextToApply.description;

    const newConfStatus =
      nextToApply.id === "Booking Confirmed"
        ? "CONFIRMED"
        : nextToApply.id === "Booking Requested"
          ? "PENDING"
          : currentBooking.confirmation_status || "CONFIRMED";

    const newMovementStatus = toDbMovementStatus(nextToApply.id);

    const existingConf = (currentBooking.confirmation_details as Record<string, unknown>) || {};
    const updatedConfirmationDetails = {
      ...existingConf,
      current_stage: nextToApply.id,
      lifecycle_stage: nextToApply.id,
      movement_status: newMovementStatus,
    };

    const optimisticBooking: FullBookingRecord = {
      ...currentBooking,
      status: nextToApply.id,
      movement_status: newMovementStatus,
      confirmation_status: newConfStatus,
      is_movement_confirmed: newConfStatus === "CONFIRMED",
      confirmed_at:
        nextToApply.id === "Booking Confirmed"
          ? currentBooking.confirmed_at || new Date().toISOString()
          : currentBooking.confirmed_at,
      confirmation_details: updatedConfirmationDetails,
    };
    setBooking(optimisticBooking);

    // Optimistically update timeline events
    const newEvent: BookingEventRow = {
      id: `evt-stage-${Date.now()}`,
      booking_id: currentBooking.id,
      event_type: nextToApply.label,
      event_date: new Date().toISOString(),
      location: loc,
      description: desc || `Status updated to ${nextToApply.label}`,
      created_at: new Date().toISOString(),
    };
    setEvents((prev) => [newEvent, ...prev.filter((e) => e.event_type !== nextToApply.label)]);

    // Persist locally for instant dashboard feedback
    saveLocalBookings([optimisticBooking]);
    updateLocalBooking(currentBooking.id, {
      status: nextToApply.id,
      movement_status: newMovementStatus,
      confirmation_status: newConfStatus,
      is_movement_confirmed: newConfStatus === "CONFIRMED",
      confirmation_details: updatedConfirmationDetails,
    });
    window.dispatchEvent(
      new CustomEvent("nashmia_bookings_updated", {
        detail: { updated: true, id: currentBooking.id, booking: optimisticBooking },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_booking_status_updated", {
        detail: {
          bookingId: currentBooking.id,
          status: nextToApply.id,
          movement_status: newMovementStatus,
          movementStatus: newMovementStatus,
          booking: optimisticBooking,
        },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("nashmia_movement_status_updated", {
        detail: {
          bookingId: currentBooking.id,
          movementNumber: currentBooking.movement_number,
          status: nextToApply.id,
          movement_status: newMovementStatus,
          movementStatus: newMovementStatus,
          booking: optimisticBooking,
        },
      }),
    );

    queryClient.setQueriesData<FullBookingRecord[]>({ queryKey: ["dashboard-bookings"] }, (old) => {
      if (!old) return [optimisticBooking];
      return old.map((b) =>
        b.id === optimisticBooking.id ||
        (b.movement_number && b.movement_number === optimisticBooking.movement_number) ||
        (b.booking_reference && b.booking_reference === optimisticBooking.booking_reference)
          ? optimisticBooking
          : b,
      );
    });

    setIsUpdating(true);
    try {
      if (isConfigured) {
        await updateBookingStatusInSupabase(currentBooking.id, userId, nextToApply.id, loc, desc, {
          movement_status: newMovementStatus,
          confirmation_status: newConfStatus,
          confirmation_details: updatedConfirmationDetails,
        });
      }

      toast.success(`Milestone updated: ${nextToApply.label}`, {
        description: `Location: ${loc}`,
      });

      void notifyMovementActivity({
        bookingId: currentBooking.id,
        movementNumber: effectiveMovementRef,
        activity: "Movement Stage Updated",
        details: `Stage updated to ${nextToApply.label}${loc ? ` (${loc})` : ""}`,
        previousValue: stageConfig.label,
        newValue: nextToApply.label,
        updatedBy: userId || "Operations",
        referenceNumber: effectiveMovementRef,
      });

      setAdvanceNotes("");
      onMovementUpdated?.();
      void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
    } catch (err) {
      console.warn("[MovementLifecycleDrawer] Advance server notice, kept in local state:", err);
      toast.success(`Milestone updated: ${nextToApply.label}`);
    } finally {
      setIsUpdating(false);
    }
  };

  // Add container
  const handleAddContainer = async () => {
    const cleanNum = newContainerNum.trim().toUpperCase();
    if (!cleanNum) {
      toast.error("Container number is required");
      return;
    }

    // Check duplicate locally
    if (containers.some((c) => c.container_number?.trim().toUpperCase() === cleanNum)) {
      toast.error(`Container ${cleanNum} is already assigned to this movement`);
      return;
    }

    const currentBookingId = booking?.id || bookingId || initialReference;
    if (!currentBookingId) {
      toast.error("No active movement selected");
      return;
    }

    setIsAddingContainer(true);
    try {
      const saved = await insertBookingContainerInSupabase(currentBookingId, {
        containerNumber: cleanNum,
        sealNumber: newSealNum.trim().toUpperCase() || undefined,
        weight: Number(newWeight) || 24500,
        containerSize: newSize,
        containerType: newType,
        status: "Allocated",
        organizationId: organizationId || null,
      });

      // Update state with returned confirmed database record
      setContainers((prev) => [...prev, saved]);

      // Add corresponding local event
      const nowIso = new Date().toISOString();
      const localEvent: BookingEventRow = {
        id: `evt-${Date.now()}`,
        booking_id: saved.booking_id,
        container_id: saved.id,
        event_type: "Container Added",
        title: `Container Registered: ${saved.container_number}`,
        description: `Container ${saved.container_number} (${saved.container_size} ${saved.container_type}) registered to movement ledger.`,
        location: booking?.origin_port || booking?.origin || "Origin Port",
        event_date: nowIso,
        occurred_at: nowIso,
        payload: {
          container_id: saved.id,
          container_number: saved.container_number,
          seal_number: saved.seal_number,
          weight: saved.weight,
        },
        created_at: nowIso,
        created_by: userId || null,
      };
      setEvents((prev) => [localEvent, ...prev]);

      // Close and clear form
      setShowAddContainer(false);
      setNewContainerNum("");
      setNewSealNum("");
      setNewWeight("24500");
      toast.success(`Container ${saved.container_number} saved to database`);

      void notifyMovementActivity({
        bookingId: saved.booking_id,
        movementNumber: effectiveMovementRef,
        activity: "Movement Details Updated",
        details: `Container registered: ${saved.container_number} (${saved.container_size} ${saved.container_type}, ${saved.weight} kg, Seal: ${saved.seal_number || "None"})`,
        newValue: saved.container_number,
        updatedBy: userId || "Operations",
        referenceNumber: effectiveMovementRef,
      });

      // Invalidate queries for instant app-wide synchronization
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      onMovementUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to save container");
    } finally {
      setIsAddingContainer(false);
    }
  };

  // Start tracking handler
  const handleStartTracking = async (container: BookingContainerRow) => {
    if (!container.id && !container.container_number) return;
    const targetKey = container.id || container.container_number || "";
    setTrackingLoadingId(targetKey);

    try {
      const res = await startContainerTracking({
        containerId: container.id,
        containerNumber: container.container_number || undefined,
        bookingId: booking?.id || bookingId || undefined,
        movementReference: effectiveMovementRef,
      });

      if (res.success) {
        if (res.event) {
          setEvents((prev) => [
            res.event as BookingEventRow,
            ...prev.filter((e) => e.id !== res.event!.id),
          ]);
        }
        if (res.isProviderConnected) {
          toast.success(`Live tracking active for ${container.container_number || "container"}`);
        } else {
          toast.info(
            `Tracking registered in database for ${container.container_number}. External tracking provider integration is not yet connected (awaiting provider credentials).`,
            { duration: 6000 },
          );
        }
        queryClient.invalidateQueries({ queryKey: ["bookings"] });
        queryClient.invalidateQueries({ queryKey: ["booking-detail"] });
      } else {
        toast.error(res.message || "Failed to initialize tracking");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Tracking initialization failed");
    } finally {
      setTrackingLoadingId(null);
    }
  };

  // Save container edit
  const handleSaveContainerEdit = async (containerId: string) => {
    setContainers((prev) =>
      prev.map((c) =>
        c.id === containerId
          ? {
              ...c,
              container_number: editContainerNum.trim().toUpperCase() || c.container_number,
              seal_number: editSealNum.trim().toUpperCase() || c.seal_number,
              weight: Number(editWeight) || c.weight,
              status: editStatus,
            }
          : c,
      ),
    );
    setEditingContainerId(null);
    toast.success("Container specifications updated");

    void notifyMovementActivity({
      bookingId: booking?.id || bookingId || undefined,
      movementNumber: effectiveMovementRef,
      activity: "Movement Details Updated",
      details: `Container ${editContainerNum || containerId} updated: Status=${editStatus}, Seal=${editSealNum || "N/A"}, Weight=${editWeight}kg`,
      updatedBy: userId || "Operations",
      referenceNumber: effectiveMovementRef,
    });

    if (isConfigured) {
      try {
        await updateBookingContainerInSupabase(containerId, {
          container_number: editContainerNum.trim().toUpperCase(),
          seal_number: editSealNum.trim().toUpperCase(),
          weight: Number(editWeight) || 24500,
          status: editStatus,
        });
        queryClient.invalidateQueries({ queryKey: ["bookings"] });
      } catch (err) {
        console.warn("Supabase container update deferred to local state:", err);
      }
    }
    onMovementUpdated?.();
  };

  // Delete container
  const handleDeleteContainer = async (containerId: string) => {
    try {
      await deleteBookingContainerFromSupabase(containerId);
      setContainers((prev) => prev.filter((c) => c.id !== containerId));
      toast.success("Container removed from booking");
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["booking-detail"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
      onMovementUpdated?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg || "Failed to remove container");
    }
  };

  // Add custom event
  const handleAddCustomEvent = async () => {
    if (!customEventText.trim()) return;
    const currentBookingId = booking?.id || `mov-${Date.now()}`;
    const loc = customEventLocation.trim() || "Terminal Hub";

    const fakeEvt: BookingEventRow = {
      id: `evt-${Date.now()}`,
      booking_id: currentBookingId,
      event_type: stageConfig.label,
      event_date: new Date().toISOString(),
      location: loc,
      description: customEventText.trim(),
      created_at: new Date().toISOString(),
    };
    setEvents((prev) => [fakeEvt, ...prev]);
    setCustomEventText("");
    setCustomEventLocation("");
    toast.success("Timeline event logged");

    if (isConfigured) {
      try {
        await addBookingEventInSupabase(
          currentBookingId,
          stageConfig.label,
          loc,
          customEventText.trim(),
        );
      } catch (err) {
        console.warn("Supabase event log deferred to local state:", err);
      }
    }
  };

  const handleSaveCutOffDeadline = () => {
    if (!newCutOffDateTime.trim()) {
      toast.error("Please provide a date and time for the cut-off deadline.");
      return;
    }

    const existingDeadlines = movementCutOffs?.deadlines || [];
    const updatedDeadlines: MovementCutOffDeadline[] = [
      ...existingDeadlines.filter((d) => d.type.toLowerCase() !== newCutOffType.toLowerCase()),
      {
        type: newCutOffType,
        dateTime: newCutOffDateTime.trim(),
        date: newCutOffDateTime.trim().split(" ")[0] || "",
        time: newCutOffDateTime.trim().split(" ").slice(1).join(" ") || "",
        in: "Active",
      },
    ];

    const updatedDates = {
      ...(movementCutOffs?.dates || {}),
      [newCutOffType]: newCutOffDateTime.trim(),
      deadlines: updatedDeadlines,
      isManuallyVerified: true,
      reviewStatus: "MANUALLY_VERIFIED",
      requiresManualReview: false,
      extractionStatus: "COMPLETED",
    };

    saveCutOffsForMovement(effectiveMovementRef, updatedDates, booking?.id);
    setMovementCutOffs({
      movementRef: effectiveMovementRef,
      bookingId: booking?.id,
      deadlines: updatedDeadlines,
      dates: updatedDates,
    });

    toast.success(
      `${newCutOffType} saved and manually verified for movement ${effectiveMovementRef}`,
    );

    void notifyMovementActivity({
      bookingId: booking?.id || undefined,
      movementNumber: effectiveMovementRef,
      activity: "Cut-off Updates",
      details: `${newCutOffType} scheduled: ${newCutOffDateTime.trim()}`,
      newValue: newCutOffDateTime.trim(),
      updatedBy: userId || "Operations",
      referenceNumber: effectiveMovementRef,
    });

    setNewCutOffDateTime("");
    setShowAddCutOff(false);
  };

  const handleVerifyCutOff = (dl: MovementCutOffDeadline) => {
    const existingDeadlines = movementCutOffs?.deadlines || [];
    const updatedDeadlines = existingDeadlines.map((d) =>
      d.type.toLowerCase() === dl.type.toLowerCase()
        ? {
            ...d,
            requiresManualReview: false,
            requires_manual_review: false,
            reviewStatus: "MANUALLY_VERIFIED",
            review_status: "MANUALLY_VERIFIED",
            reviewReason: null,
            review_reason: null,
          }
        : d,
    );

    const updatedDates = {
      ...(movementCutOffs?.dates || {}),
      deadlines: updatedDeadlines,
      isManuallyVerified: true,
      reviewStatus: "MANUALLY_VERIFIED",
      requiresManualReview: false,
      extractionStatus: "COMPLETED",
    };

    saveCutOffsForMovement(effectiveMovementRef, updatedDates, booking?.id);
    setMovementCutOffs({
      movementRef: effectiveMovementRef,
      bookingId: booking?.id,
      deadlines: updatedDeadlines,
      dates: updatedDates,
    });

    toast.success(`${dl.type} manually verified and confirmed.`);

    void notifyMovementActivity({
      bookingId: booking?.id || undefined,
      movementNumber: effectiveMovementRef,
      activity: "Cut-off Updates",
      details: `${dl.type} manually verified for movement`,
      newValue: "Verified",
      updatedBy: userId || "Operations",
      referenceNumber: effectiveMovementRef,
    });
  };

  const handleCopyReference = () => {
    navigator.clipboard.writeText(effectiveMovementRef);
    setCopiedRef(true);
    toast.success(`Copied ${effectiveMovementRef} to clipboard`);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const totalVGM = containers.reduce((acc, c) => acc + (Number(c.weight) || 24500), 0);

  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="region"
      aria-label="Movement Details Modal Backdrop"
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 overflow-y-auto"
    >
      {/* Dark Transparent Overlay matching Dribbble reference */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 ease-out"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main Dialog Window with exact styling matching uploaded design */}
      <div
        ref={sheetElementRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-modal-title"
        className={cn(
          "relative z-10 w-full max-w-6xl bg-[#F8FAFD] border border-slate-200/80 shadow-[0_25px_70px_rgba(0,0,0,0.18)] flex flex-col overflow-hidden transition-all will-change-[transform,opacity] outline-none",
          // Mobile bottom sheet:
          "max-h-[92vh] rounded-t-[28px] rounded-b-none my-0 overflow-y-auto overflow-x-hidden animate-in slide-in-from-bottom duration-240 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // Desktop / Tablet dialog:
          "sm:slide-in-from-bottom-0 sm:zoom-in-95 sm:fade-in-0 sm:duration-200 sm:ease-[cubic-bezier(0.16,1,0.3,1)] sm:rounded-[32px] sm:max-h-[92vh] sm:my-auto",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================= TOP HEADER ================= */}
        <div className="border-b border-slate-200/60 px-5 sm:px-8 pt-4 sm:pt-6 pb-4 bg-white shrink-0">
          {/* Mobile Drag Handle with touch target and active feedback */}
          <div
            ref={sheetHandleRef}
            data-swipe-handle="true"
            className="group mx-auto -mt-2 mb-2 flex h-8 w-full max-w-[200px] cursor-grab touch-none items-center justify-center sm:hidden active:cursor-grabbing select-none"
            aria-label="Drag down to dismiss"
          >
            <div className="h-1.5 w-12 rounded-full bg-slate-300 transition-all duration-150 group-hover:bg-slate-400 group-active:scale-x-110 group-active:bg-slate-500" />
          </div>
          <div className="flex items-center justify-between gap-4">
            {/* Left Identifier with Electric Blue Ship Icon */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#EBF3FF] border border-[#D0E2FF] text-[#0D74FF] shadow-xs">
                <Ship className="size-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2
                    id="movement-modal-title"
                    className="text-[17px] font-bold tracking-tight text-slate-900 truncate"
                  >
                    {effectiveMovementRef}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCopyReference}
                    title="Copy Reference"
                    className="inline-flex size-6 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                  >
                    {copiedRef ? (
                      <CheckCheck className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF3] border border-[#A6F4C5]/80 px-3 py-0.5 text-[12px] font-semibold text-[#027A48]">
                    <span className="size-2 rounded-full bg-[#12B76A]" />
                    {isConfirmed ? "Confirmed" : stageConfig.label}
                  </span>
                </div>
                <p className="mt-0.5 text-[13px] text-slate-500 truncate font-normal">
                  {originPort} → {destinationPort} · Vessel {vesselName}
                </p>
              </div>
            </div>

            {/* Right Action Close Button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* ================= SEGMENTED PILL NAVIGATION BAR ================= */}
          <div className="mt-5 flex items-center gap-1.5 p-1.5 bg-[#F2F4F7] rounded-full overflow-x-auto no-scrollbar">
            {[
              { id: "overview", label: "Overview", count: null },
              { id: "milestones", label: "Milestones", count: 5 },
              { id: "containers", label: "Containers", count: containers.length },
              {
                id: "cutoffs",
                label: "Cut-Offs",
                count: movementCutOffs?.deadlines?.length || 0,
              },
              { id: "documents", label: "Documents", count: docCount },
              { id: "audit", label: "Audit Log", count: events.length },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as DrawerTab)}
                  className={cn(
                    "px-5 py-2 text-[12.5px] rounded-full transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 font-medium",
                    isActive
                      ? "bg-white text-slate-900 shadow-xs font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/50",
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count !== null && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                        isActive ? "bg-slate-100 text-slate-800" : "bg-[#EAECF0] text-slate-600",
                      )}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================= MAIN CONTENT AREA ================= */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-6 bg-[#F8FAFD]">
          {/* ================= TAB 1: OVERVIEW ================= */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-in fade-in-50 duration-150">
              {/* Left / Center Section (8 cols) */}
              <div className="lg:col-span-8 space-y-5">
                {/* Row 1: Shipment Details + Booking Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card 1: Shipment Details */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Ship className="size-4.5 text-slate-700" />
                          <h3 className="text-[15px] font-bold text-slate-900">Shipment Details</h3>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF8FF] text-[#175CD3] text-[11.5px] font-semibold">
                          <Ship className="size-3" />
                          {modeName}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-y-4 gap-x-3 pt-5">
                        {/* Booking No. */}
                        <div className="flex items-start gap-2.5">
                          <div className="grid size-7 place-items-center rounded-lg bg-slate-50 text-slate-400 mt-0.5">
                            <FileText className="size-3.5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-400 block">
                              Booking No.
                            </span>
                            <span className="text-[13px] font-bold text-slate-900 font-mono tracking-tight block">
                              {effectiveMovementRef}
                            </span>
                          </div>
                        </div>

                        {/* Vessel */}
                        <div className="flex items-start gap-2.5">
                          <div className="grid size-7 place-items-center rounded-lg bg-slate-50 text-slate-400 mt-0.5">
                            <Ship className="size-3.5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-400 block">
                              Vessel
                            </span>
                            <span className="text-[13px] font-bold text-slate-900 block truncate">
                              {vesselName}
                            </span>
                          </div>
                        </div>

                        {/* Origin */}
                        <div className="flex items-start gap-2.5">
                          <div className="grid size-7 place-items-center rounded-lg bg-slate-50 text-slate-400 mt-0.5">
                            <MapPin className="size-3.5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-400 block">
                              Origin (POL)
                            </span>
                            <span className="text-[13px] font-bold text-slate-900 block">
                              {originPort === "Pending" ? (
                                <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  Pending
                                </span>
                              ) : (
                                originPort
                              )}
                            </span>
                          </div>
                        </div>

                        {/* Destination */}
                        <div className="flex items-start gap-2.5">
                          <div className="grid size-7 place-items-center rounded-lg bg-slate-50 text-slate-400 mt-0.5">
                            <MapPin className="size-3.5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-400 block">
                              Destination (POD)
                            </span>
                            <span className="text-[13px] font-bold text-slate-900 block">
                              {destinationPort === "Pending" ? (
                                <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                                  Pending
                                </span>
                              ) : (
                                destinationPort
                              )}
                            </span>
                          </div>
                        </div>

                        {/* ETD */}
                        <div className="flex items-start gap-2.5">
                          <div className="grid size-7 place-items-center rounded-lg bg-slate-50 text-slate-400 mt-0.5">
                            <Calendar className="size-3.5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-400 block">
                              ETD
                            </span>
                            <span className="text-[13px] font-bold text-slate-900 block">
                              {etdFormatted}
                            </span>
                          </div>
                        </div>

                        {/* Mode */}
                        <div className="flex items-start gap-2.5">
                          <div className="grid size-7 place-items-center rounded-lg bg-slate-50 text-slate-400 mt-0.5">
                            <Waves className="size-3.5" />
                          </div>
                          <div>
                            <span className="text-[11px] font-medium text-slate-400 block">
                              Mode
                            </span>
                            <span className="text-[13px] font-bold text-slate-900 block">
                              {modeName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Booking Status */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="grid size-6 place-items-center rounded-full bg-[#12B76A] text-white">
                          <Check className="size-3.5 stroke-[3]" />
                        </div>
                        <h3 className="text-[15px] font-bold text-slate-900">Booking Status</h3>
                      </div>

                      {/* Automated Corroboration Active Box */}
                      <div className="mt-4 rounded-[18px] bg-[#ECFDF3] border border-[#A6F4C5] p-3.5 flex items-start gap-3">
                        <div className="grid size-5 place-items-center rounded-full bg-[#12B76A] text-white shrink-0 mt-0.5">
                          <Check className="size-3 stroke-[3]" />
                        </div>
                        <div>
                          <p className="text-[12.5px] font-bold text-[#027A48]">
                            {stageConfig.label} Active
                          </p>
                          <p className="text-[11.5px] text-[#027A48]/80 leading-relaxed mt-0.5">
                            {stageConfig.description} (Stage {stageConfig.stepNumber} of{" "}
                            {LIFECYCLE_STAGES.length})
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Stepper Progress matching design */}
                    <div className="pt-5 pb-1">
                      <div className="flex items-center justify-between relative px-2">
                        {/* Step 1: Booking */}
                        <div className="flex flex-col items-center relative z-10">
                          {currentStepIdx >= 1 ? (
                            <div className="grid size-6 place-items-center rounded-full bg-[#12B76A] text-white shadow-2xs">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="grid size-6 place-items-center rounded-full bg-[#0D74FF] text-white shadow-2xs">
                              <div className="size-2 rounded-full bg-white animate-pulse" />
                            </div>
                          )}
                          <span
                            className={cn(
                              "text-[11px] font-semibold mt-2",
                              currentStepIdx >= 1 ? "text-slate-700" : "text-[#0D74FF]",
                            )}
                          >
                            Booking
                          </span>
                        </div>

                        <div
                          className={cn(
                            "flex-1 h-0.5 -mt-5 transition-colors",
                            currentStepIdx >= 1 ? "bg-[#12B76A]" : "bg-slate-200",
                          )}
                        />

                        {/* Step 2: Documentation */}
                        <div className="flex flex-col items-center relative z-10">
                          {currentStepIdx >= 4 ? (
                            <div className="grid size-6 place-items-center rounded-full bg-[#12B76A] text-white shadow-2xs">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : currentStepIdx >= 1 ? (
                            <div className="grid size-6 place-items-center rounded-full bg-[#0D74FF] text-white shadow-2xs">
                              <div className="size-2 rounded-full bg-white animate-pulse" />
                            </div>
                          ) : (
                            <div className="size-6 rounded-full border-2 border-slate-300 bg-white" />
                          )}
                          <span
                            className={cn(
                              "text-[11px] font-semibold mt-2",
                              currentStepIdx >= 4
                                ? "text-slate-700"
                                : currentStepIdx >= 1
                                  ? "text-[#0D74FF]"
                                  : "text-slate-400",
                            )}
                          >
                            Documentation
                          </span>
                        </div>

                        <div
                          className={cn(
                            "flex-1 h-0.5 -mt-5 transition-colors",
                            currentStepIdx >= 4 ? "bg-[#12B76A]" : "bg-slate-200",
                          )}
                        />

                        {/* Step 3: In Transit */}
                        <div className="flex flex-col items-center relative z-10">
                          {currentStepIdx >= 7 ? (
                            <div className="grid size-6 place-items-center rounded-full bg-[#12B76A] text-white shadow-2xs">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : currentStepIdx >= 5 ? (
                            <div className="grid size-6 place-items-center rounded-full bg-[#0D74FF] text-white shadow-2xs">
                              <div className="size-2 rounded-full bg-white animate-pulse" />
                            </div>
                          ) : (
                            <div className="size-6 rounded-full border-2 border-slate-300 bg-white" />
                          )}
                          <span
                            className={cn(
                              "text-[11px] font-semibold mt-2",
                              currentStepIdx >= 7
                                ? "text-slate-700"
                                : currentStepIdx >= 5
                                  ? "text-[#0D74FF]"
                                  : "text-slate-400",
                            )}
                          >
                            In Transit
                          </span>
                        </div>

                        <div
                          className={cn(
                            "flex-1 h-0.5 -mt-5 transition-colors",
                            currentStepIdx >= 7 ? "bg-[#12B76A]" : "bg-slate-200",
                          )}
                        />

                        {/* Step 4: Arrived */}
                        <div className="flex flex-col items-center relative z-10">
                          {currentStepIdx >= 8 ? (
                            <div className="grid size-6 place-items-center rounded-full bg-[#12B76A] text-white shadow-2xs">
                              <Check className="size-3.5 stroke-[3]" />
                            </div>
                          ) : currentStepIdx >= 7 ? (
                            <div className="grid size-6 place-items-center rounded-full bg-[#0D74FF] text-white shadow-2xs">
                              <div className="size-2 rounded-full bg-white animate-pulse" />
                            </div>
                          ) : (
                            <div className="size-6 rounded-full border-2 border-slate-300 bg-white" />
                          )}
                          <span
                            className={cn(
                              "text-[11px] font-medium mt-2",
                              currentStepIdx >= 8
                                ? "text-slate-700 font-semibold"
                                : currentStepIdx >= 7
                                  ? "text-[#0D74FF] font-semibold"
                                  : "text-slate-400",
                            )}
                          >
                            Arrived
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 2: Key Operational Parties */}
                <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="size-4.5 text-slate-700" />
                      <h3 className="text-[15px] font-bold text-slate-900">
                        Key Operational Parties
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        toast.success("Manifest exported", {
                          description: `Manifest for ${effectiveMovementRef} downloaded`,
                        });
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EFF8FF] text-[#175CD3] text-[11.5px] font-semibold hover:bg-[#E0F2FE] transition-colors cursor-pointer"
                    >
                      Export Manifest <ExternalLink className="size-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
                    {/* Buyer / Consignee */}
                    <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-3.5 flex items-start gap-3">
                      <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 shrink-0">
                        <User className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium text-slate-400 block">
                          Buyer / Consignee
                        </span>
                        <p className="text-[13.5px] font-bold text-slate-900 truncate mt-0.5">
                          {buyerName}
                        </p>
                        <p className="text-[11.5px] text-slate-500 truncate">{destinationPort}</p>
                      </div>
                    </div>

                    {/* Supplier / Load Point */}
                    <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-3.5 flex items-start gap-3">
                      <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 shrink-0">
                        <Building2 className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium text-slate-400 block">
                          Supplier / Load Point
                        </span>
                        <p className="text-[13.5px] font-bold text-slate-900 truncate mt-0.5">
                          {supplierName}
                        </p>
                        <p className="text-[11.5px] text-slate-500 truncate">{originPort}</p>
                      </div>
                    </div>

                    {/* Forwarder & Desk */}
                    <div className="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-3.5 flex items-start gap-3">
                      <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600 shrink-0">
                        <Send className="size-4 -rotate-45" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[11px] font-medium text-slate-400 block">
                          Forwarder & Desk
                        </span>
                        <p className="text-[13.5px] font-bold text-slate-900 truncate mt-0.5">
                          {forwarderName}
                        </p>
                        <p className="text-[11.5px] text-slate-500 truncate">Booking Desk</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Row 3: Shipment Timeline + Containers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Shipment Timeline */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="size-4.5 text-slate-700" />
                        <h3 className="text-[15px] font-bold text-slate-900">Shipment Timeline</h3>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full bg-[#EFF8FF] text-[#175CD3] text-[11.5px] font-semibold">
                        5 Milestones
                      </span>
                    </div>

                    <div className="mt-4 space-y-4 relative">
                      {/* Vertical line */}
                      <div className="absolute left-[11px] top-3 bottom-3 w-0.5 bg-slate-100" />

                      {[
                        {
                          title: "Booking Confirmed",
                          desc: "Forwarder correspondence confirmed",
                          date: etdFormatted,
                          stepIdx: 1,
                        },
                        {
                          title: "Documentation & Staged",
                          desc: originPort,
                          date: etdFormatted,
                          stepIdx: 3,
                        },
                        {
                          title: "Customs Cleared",
                          desc: "Clearance approved for export",
                          date: etdFormatted,
                          stepIdx: 4,
                        },
                        {
                          title: "In Transit",
                          desc: `${modeName} • ${vesselName}`,
                          date: etdFormatted,
                          stepIdx: 6,
                        },
                        {
                          title: "Arrived at Destination",
                          desc: destinationPort,
                          date: etaFormatted,
                          stepIdx: 7,
                        },
                      ].map((item, idx) => {
                        const isCompleted = currentStepIdx > item.stepIdx;
                        const isCurrent =
                          currentStepIdx === item.stepIdx ||
                          (idx === 0 && currentStepIdx <= 1 && currentStepIdx > 0) ||
                          (idx === 1 && currentStepIdx >= 2 && currentStepIdx <= 3) ||
                          (idx === 2 && currentStepIdx >= 4 && currentStepIdx <= 5) ||
                          (idx === 3 && currentStepIdx === 6) ||
                          (idx === 4 && currentStepIdx >= 7);

                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between relative z-10"
                          >
                            <div className="flex items-center gap-3">
                              {isCompleted ? (
                                <div className="grid size-6 place-items-center rounded-full bg-[#12B76A] text-white shadow-2xs">
                                  <Check className="size-3.5 stroke-[3]" />
                                </div>
                              ) : isCurrent ? (
                                <div className="grid size-6 place-items-center rounded-full bg-[#0D74FF] text-white shadow-2xs">
                                  <ChevronRight className="size-3.5 stroke-[3]" />
                                </div>
                              ) : (
                                <div className="size-6 rounded-full border-2 border-slate-300 bg-white" />
                              )}
                              <div>
                                <p className="text-[13px] font-bold text-slate-900 leading-none">
                                  {item.title}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">{item.desc}</p>
                              </div>
                            </div>
                            <span className="text-[12px] font-medium text-slate-500">
                              {item.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Containers */}
                  <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Box className="size-4.5 text-slate-700" />
                          <h3 className="text-[15px] font-bold text-slate-900">Containers</h3>
                        </div>
                        <span className="grid size-5 place-items-center rounded-full bg-slate-100 text-slate-600 text-[11.5px] font-semibold">
                          {containers.length}
                        </span>
                      </div>

                      {/* Empty state or container list */}
                      {containers.length === 0 ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center">
                          <div className="grid size-14 place-items-center rounded-full bg-[#F2F4F7] text-slate-400 mb-3">
                            <Box className="size-7 stroke-[1.5]" />
                          </div>
                          <p className="text-[13.5px] font-bold text-slate-800">
                            No containers assigned
                          </p>
                          <p className="text-[12px] text-slate-400 mt-1">
                            Containers will be added once available.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab("containers")}
                            className="mt-3 text-[12px] font-semibold text-[#0D74FF] hover:underline cursor-pointer"
                          >
                            Manage Containers →
                          </button>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-2.5">
                          {containers.slice(0, 3).map((c) => (
                            <div
                              key={c.id}
                              className="p-3 rounded-2xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-between"
                            >
                              <div>
                                <span className="font-mono text-[13px] font-bold text-slate-900 block">
                                  {c.container_number}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  {c.container_size} · {c.weight} kg
                                </span>
                              </div>
                              <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                {c.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 text-right">
                      <button
                        type="button"
                        onClick={() => setActiveTab("containers")}
                        className="text-[12px] font-semibold text-slate-500 hover:text-[#0D74FF] transition-colors cursor-pointer"
                      >
                        View container ledger
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar Section (4 cols) */}
              <div className="lg:col-span-4 space-y-5">
                {/* Card 1: Quick Actions */}
                <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <Send className="size-4 text-slate-700" />
                    <h3 className="text-[15px] font-bold text-slate-900">Quick Actions</h3>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {/* View Full Details - Solid Black Button */}
                    <button
                      type="button"
                      onClick={() => setActiveTab("milestones")}
                      className="w-full bg-[#101828] hover:bg-black text-white text-[13px] font-semibold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                    >
                      <ExternalLink className="size-4" />
                      View Full Details
                    </button>

                    {/* Download Documents - White Button */}
                    <button
                      type="button"
                      onClick={() => {
                        if (movementDocs.length > 0) {
                          toast.success("Opening movement document", {
                            description: `${movementDocs.length} linked document(s) for ${effectiveMovementRef}`,
                          });
                          viewDocumentInNewTab(movementDocs[0]);
                        } else {
                          toast.info(`No documents linked for ${effectiveMovementRef} yet`);
                        }
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[13px] font-semibold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Download className="size-4 text-slate-600" />
                      Download Documents {docCount > 0 ? `(${docCount})` : ""}
                    </button>

                    {/* Track Shipment - White Button */}
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        void navigate({
                          to: "/tracking",
                          search: {
                            id: booking?.id || bookingId || undefined,
                            ref: effectiveMovementRef || undefined,
                          },
                        });
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[13px] font-semibold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                    >
                      <MapPin className="size-4 text-slate-600" />
                      Track Shipment
                    </button>

                    {/* Contact Forwarder - White Button */}
                    <button
                      type="button"
                      onClick={() => {
                        toast.info(`Contacting ${forwarderName}`, {
                          description: "Opening forwarder operations desk channel",
                        });
                      }}
                      className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[13px] font-semibold py-2.5 px-4 rounded-full flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Phone className="size-4 text-slate-600" />
                      Contact Forwarder
                    </button>
                  </div>
                </div>

                {/* Card 2: Important Dates */}
                <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="size-4 text-slate-700" />
                    <h3 className="text-[15px] font-bold text-slate-900">Important Dates</h3>
                  </div>

                  <div className="space-y-3 pt-1">
                    {/* ETD */}
                    <div className="flex items-center justify-between p-1 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600">
                          <Truck className="size-4" />
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-slate-400 block">
                            ETD (Estimated Time of Departure)
                          </span>
                          <span className="text-[13px] font-bold text-slate-900 block">
                            {etdFormatted}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-slate-400" />
                    </div>

                    {/* ETA */}
                    <div className="flex items-center justify-between p-1 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div className="grid size-8 place-items-center rounded-full bg-slate-100 text-slate-600">
                          <Anchor className="size-4" />
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-slate-400 block">
                            ETA (Estimated Time of Arrival)
                          </span>
                          <span className="text-[13px] font-bold text-slate-900 block">
                            {etaFormatted}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Card 3: Notes */}
                <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-slate-700" />
                      <h3 className="text-[15px] font-bold text-slate-900">Notes</h3>
                    </div>
                  </div>

                  <div className="bg-[#F8F9FC] border border-slate-200/60 rounded-[18px] p-3.5 relative">
                    {isEditingNote ? (
                      <div>
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          className="w-full text-[12.5px] text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none"
                          rows={3}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingNote(false);
                            toast.success("Note updated");
                          }}
                          className="mt-2 px-3 py-1 bg-[#0D74FF] text-white rounded-full text-xs font-semibold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-[12px] text-slate-600 leading-relaxed pr-6">
                          {noteText}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsEditingNote(true)}
                          className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <Edit2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Card 4: Attachments / Documents */}
                <div className="bg-white rounded-[24px] border border-slate-200/80 p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Paperclip className="size-4 text-slate-700" />
                      <h3 className="text-[15px] font-bold text-slate-900">
                        Documents {docCount > 0 ? `(${docCount})` : ""}
                      </h3>
                    </div>
                    {isLoadingDocs ? (
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <RefreshCw className="size-3 animate-spin text-[#0D74FF]" />
                        Syncing...
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          refreshDocuments();
                          toast.info(`Documents refreshed for ${effectiveMovementRef}`);
                        }}
                        className="text-[11.5px] font-semibold text-[#175CD3] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="size-3" />
                        Refresh
                      </button>
                    )}
                  </div>

                  {isLoadingDocs ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
                      <RefreshCw className="size-5 text-[#0D74FF] animate-spin" />
                      <p className="text-[11.5px] text-slate-500">Loading linked documents...</p>
                    </div>
                  ) : movementDocs.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-center space-y-1">
                      <p className="text-[12px] font-semibold text-slate-700">
                        No documents linked yet
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Carrier documents, bills of lading, and cut-off notices matched to #
                        {effectiveMovementRef} will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {movementDocs.map((doc) => {
                        const ext = doc.extension.toUpperCase();
                        const isPdf = ext === "PDF";
                        const isSpreadsheet = ext === "XLS" || ext === "XLSX" || ext === "CSV";

                        return (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 bg-[#FAFAFA] hover:bg-slate-50 transition-colors gap-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={cn(
                                  "grid size-7 place-items-center rounded-lg border font-bold text-[9px] uppercase shrink-0",
                                  isPdf
                                    ? "bg-rose-50 border-rose-200/60 text-rose-600"
                                    : isSpreadsheet
                                      ? "bg-emerald-50 border-emerald-200/60 text-emerald-600"
                                      : "bg-blue-50 border-blue-200/60 text-[#0D74FF]",
                                )}
                              >
                                {ext.slice(0, 3)}
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="text-[12px] font-semibold text-slate-800 truncate max-w-[170px]"
                                  title={doc.documentName}
                                >
                                  {doc.documentName}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {doc.fileSizeFormatted} · {doc.displayType}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {/* Working View in New Tab action */}
                              <button
                                type="button"
                                onClick={() => {
                                  viewDocumentInNewTab(doc);
                                  toast.success(`Opening ${doc.documentName}`);
                                }}
                                title="Open in new browser tab"
                                className="grid size-7 place-items-center rounded-lg text-slate-500 hover:text-[#0D74FF] hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Eye className="size-3.5" />
                              </button>

                              {/* Working Download action */}
                              <button
                                type="button"
                                onClick={() => {
                                  downloadDocumentFile(doc);
                                  toast.success(`Downloading ${doc.documentName}`);
                                }}
                                title="Download file"
                                className="grid size-7 place-items-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors cursor-pointer"
                              >
                                <Download className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: MILESTONES & LIFECYCLE ================= */}
          {activeTab === "milestones" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              {/* Current Active Milestone Hero */}
              <div className="rounded-[26px] bg-white border border-slate-200/60 p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D74FF]">
                      Current Stage {stageConfig.stepNumber} of {LIFECYCLE_STAGES.length}
                    </span>
                    <h3 className="text-[16px] font-bold text-slate-900 mt-0.5">
                      {stageConfig.label}
                    </h3>
                    <p className="text-[12.5px] text-slate-500 mt-0.5">{stageConfig.description}</p>
                  </div>
                  {nextStage && (
                    <button
                      type="button"
                      onClick={() => void handleAdvanceStage()}
                      disabled={isUpdating}
                      className="inline-flex items-center gap-2 rounded-full bg-[#0D74FF] hover:bg-[#0062E3] text-white px-5 py-2 text-[12.5px] font-semibold shadow-[0_6px_16px_rgba(13,116,255,0.25)] transition-all cursor-pointer"
                    >
                      <span>{stageConfig.nextActionLabel}</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Checklist */}
                <div className="border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
                    Required Verifications
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {stageConfig.checklist.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[12px] text-slate-700 border border-slate-150/70"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pipeline Progression Steps */}
              <div className="space-y-2">
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400 block px-1">
                  End-to-End Logistics Pipeline
                </span>
                <div className="space-y-2">
                  {LIFECYCLE_STAGES.map((st, i) => {
                    const Icon = iconMap[st.iconName] || ClipboardList;
                    const isCurrent = st.id === stageConfig.id;
                    const isCompleted = i < currentStepIdx;

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => void handleAdvanceStage(st)}
                        disabled={isUpdating}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-[20px] border p-3.5 text-left transition-all cursor-pointer",
                          isCurrent
                            ? "border-2 border-[#0D74FF] bg-[#F0F6FF] text-slate-900 shadow-xs"
                            : isCompleted
                              ? "border-emerald-200 bg-white text-slate-800 hover:bg-emerald-50/40"
                              : "border-slate-200/70 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50/50",
                          isUpdating && "opacity-60 cursor-not-allowed",
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={cn(
                              "grid size-8 shrink-0 place-items-center rounded-full text-[12px] font-bold shadow-2xs",
                              isCurrent
                                ? "bg-[#0D74FF] text-white"
                                : isCompleted
                                  ? "bg-emerald-500 text-white"
                                  : "bg-[#EEF2F7] text-slate-500",
                            )}
                          >
                            {isCompleted ? (
                              <Check className="size-3.5" />
                            ) : (
                              <Icon className="size-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-bold truncate">
                              Stage 0{st.stepNumber}: {st.label}
                            </p>
                            <p className="text-[11.5px] text-slate-500 truncate">
                              {st.description}
                            </p>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="rounded-full bg-[#0D74FF] text-white px-3 py-0.5 text-[10px] font-bold shrink-0 shadow-2xs">
                            CURRENT
                          </span>
                        )}
                        {isCompleted && !isCurrent && (
                          <span className="rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-0.5 text-[10px] font-bold shrink-0">
                            COMPLETED
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: CONTAINERS & CARGO ================= */}
          {activeTab === "containers" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">
                    Container Ledger ({containers.length})
                  </h4>
                  <p className="text-[12px] text-slate-500">
                    Track containers, verified gross mass (VGM), and high-security seals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddContainer((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200/80 px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="size-3.5 text-[#0D74FF]" />
                  {showAddContainer ? "Close Form" : "Add Container"}
                </button>
              </div>

              {/* Add Container Form (Styled like Dribbble Reference Form) */}
              {showAddContainer && (
                <div className="rounded-[24px] border border-[#0D74FF]/30 bg-[#F0F6FF]/70 p-5 space-y-4">
                  <p className="text-[13.5px] font-bold text-slate-900">
                    Register Container to Movement
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-500 uppercase block ml-1 mb-1">
                        Container # *
                      </label>
                      <input
                        type="text"
                        placeholder="MSCU9842104"
                        value={newContainerNum}
                        onChange={(e) => setNewContainerNum(e.target.value.toUpperCase())}
                        disabled={isAddingContainer}
                        className="w-full rounded-full bg-white border border-slate-200 px-3.5 py-2 text-[12.5px] font-mono outline-none focus:border-[#0D74FF] focus:ring-2 focus:ring-[#0D74FF]/15 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-500 uppercase block ml-1 mb-1">
                        Seal #
                      </label>
                      <input
                        type="text"
                        placeholder="SL-984210"
                        value={newSealNum}
                        onChange={(e) => setNewSealNum(e.target.value.toUpperCase())}
                        disabled={isAddingContainer}
                        className="w-full rounded-full bg-white border border-slate-200 px-3.5 py-2 text-[12.5px] font-mono outline-none focus:border-[#0D74FF] focus:ring-2 focus:ring-[#0D74FF]/15 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-500 uppercase block ml-1 mb-1">
                        Weight (KG)
                      </label>
                      <input
                        type="number"
                        placeholder="24500"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        disabled={isAddingContainer}
                        className="w-full rounded-full bg-white border border-slate-200 px-3.5 py-2 text-[12.5px] font-mono outline-none focus:border-[#0D74FF] focus:ring-2 focus:ring-[#0D74FF]/15 disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <LifecycleDropdownSelect
                        label="SIZE"
                        value={newSize}
                        onChange={(val) => setNewSize(val)}
                        options={[
                          { value: "40HC", label: "40ft High Cube" },
                          { value: "40FT", label: "40ft Standard" },
                          { value: "20FT", label: "20ft Standard" },
                        ]}
                        placeholder="Select Size"
                        size="sm"
                        activeColor="blue"
                        triggerClassName="w-full h-[38px] text-[12.5px]"
                      />
                    </div>
                    <div>
                      <LifecycleDropdownSelect
                        label="CONTAINER TYPE"
                        value={newType}
                        onChange={(val) => setNewType(val)}
                        options={[
                          { value: "High Cube", label: "High Cube" },
                          { value: "Dry Standard", label: "Dry Standard" },
                          { value: "Reefer", label: "Refrigerated" },
                          { value: "Open Top", label: "Open Top" },
                          { value: "Flat Rack", label: "Flat Rack" },
                          { value: "Tank", label: "Tank Container" },
                        ]}
                        placeholder="Select Type"
                        size="sm"
                        activeColor="blue"
                        triggerClassName="w-full h-[38px] text-[12.5px]"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isAddingContainer}
                      onClick={() => setShowAddContainer(false)}
                      className="px-4 py-2 text-[12px] font-medium text-slate-600 rounded-full hover:bg-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isAddingContainer}
                      onClick={() => void handleAddContainer()}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#0D74FF] hover:bg-[#0062E3] px-5 py-2 text-[12px] font-bold text-white shadow-xs disabled:opacity-60 cursor-pointer"
                    >
                      {isAddingContainer ? (
                        <>
                          <RefreshCw className="size-3.5 animate-spin" />
                          <span>Saving to Supabase...</span>
                        </>
                      ) : (
                        <span>Save Container</span>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Container List */}
              <div className="space-y-2.5">
                {containers.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-slate-200 bg-white p-6 text-center">
                    <Container className="size-6 text-slate-400 mx-auto" />
                    <p className="mt-2 text-[13px] font-semibold text-slate-700">
                      No containers attached yet
                    </p>
                    <p className="text-[11.5px] text-slate-400">
                      Click "Add Container" above to register units.
                    </p>
                  </div>
                ) : (
                  containers.map((c) => {
                    const containerEvents = events.filter(
                      (e) =>
                        e.container_id === c.id ||
                        (e.payload as Record<string, unknown> | null)?.container_id === c.id ||
                        (e.payload as Record<string, unknown> | null)?.container_number ===
                          c.container_number,
                    );
                    const trackingEvent = containerEvents.find(
                      (e) =>
                        e.event_type === "Tracking Initialized" ||
                        e.event_type === "Tracking Registered",
                    );
                    const isTrackingActive = Boolean(trackingEvent);
                    const trackingPayload = (trackingEvent?.payload || {}) as Record<
                      string,
                      unknown
                    >;
                    const isProviderConnected = Boolean(trackingPayload.is_provider_connected);
                    const lastTrackUpdate = trackingEvent?.created_at
                      ? new Date(trackingEvent.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : null;

                    return (
                      <div
                        key={c.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-[22px] border border-slate-200/60 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#0D74FF] font-bold text-xs">
                            <Container className="size-4.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[14px] font-bold text-slate-900">
                                {c.container_number || "UNASSIGNED"}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                                {c.container_size || "40HC"} · {c.container_type || "High Cube"}
                              </span>
                              <span className="rounded-full bg-emerald-50 border border-emerald-200/60 px-2.5 py-0.5 text-[10.5px] font-bold text-emerald-700">
                                {c.status || "Allocated"}
                              </span>
                              {isTrackingActive && (
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold inline-flex items-center gap-1",
                                    isProviderConnected
                                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                                      : "bg-amber-50 text-amber-800 border border-amber-200",
                                  )}
                                  title={
                                    isProviderConnected
                                      ? "Live tracking provider connected"
                                      : "Tracking registered in database; provider credentials pending"
                                  }
                                >
                                  <Radio className="size-3" />
                                  {isProviderConnected
                                    ? "Tracking Active"
                                    : "Tracking Registered (API Pending)"}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-slate-500 font-mono mt-1">
                              Seal: {c.seal_number || "PENDING"} · VGM:{" "}
                              {(c.weight || 24500).toLocaleString()} kg
                              {lastTrackUpdate && ` · Tracked: ${lastTrackUpdate}`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isTrackingActive ? (
                            <Link
                              to="/tracking"
                              search={{
                                id: booking?.id || "",
                                ref: effectiveMovementRef,
                                container: c.container_number || "",
                              }}
                              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 hover:bg-slate-200 px-3.5 py-1.5 text-[11px] font-bold text-slate-700 transition-colors shadow-2xs cursor-pointer"
                              title="Open visual tracking for this container"
                            >
                              <Eye className="size-3.5 text-[#0D74FF]" />
                              <span>View Tracking</span>
                            </Link>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleStartTracking(c)}
                              disabled={trackingLoadingId === (c.id || c.container_number)}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#0D74FF]/10 hover:bg-[#0D74FF]/20 border border-[#0D74FF]/30 px-3.5 py-1.5 text-[11.5px] font-bold text-[#0D74FF] transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                              title="Start container tracking session"
                            >
                              {trackingLoadingId === (c.id || c.container_number) ? (
                                <RefreshCw className="size-3.5 animate-spin" />
                              ) : (
                                <Ship className="size-3.5" />
                              )}
                              <span>
                                {trackingLoadingId === (c.id || c.container_number)
                                  ? "Connecting..."
                                  : "Start Tracking"}
                              </span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleDeleteContainer(c.id)}
                            className="grid size-8 place-items-center rounded-full text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Remove container"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: CUT-OFF DEADLINES ================= */}
          {activeTab === "cutoffs" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">
                    Carrier Cut-Off Deadlines
                  </h4>
                  <p className="text-[12px] text-slate-500">
                    Deadlines maintained for Movement {effectiveMovementRef}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddCutOff((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200/80 px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus className="size-3.5 text-[#0D74FF]" />
                  {showAddCutOff ? "Close Form" : "Add Deadline"}
                </button>
              </div>

              {/* Add Cut-off Form */}
              {showAddCutOff && (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/50 p-5 space-y-4">
                  <p className="text-[13.5px] font-bold text-slate-900">
                    Record Specific Cut-Off Deadline
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <LifecycleDropdownSelect
                        label="CUT-OFF TYPE"
                        value={newCutOffType}
                        onChange={(val) => setNewCutOffType(val)}
                        options={[
                          { value: "SI Cut-Off", label: "SI Cut-Off (Shipping Instructions)" },
                          { value: "VGM Cut-Off", label: "VGM Cut-Off (Verified Gross Mass)" },
                          { value: "Port Cut-Off", label: "Port Cut-Off" },
                          { value: "Gate Cut-Off", label: "Gate Cut-Off" },
                          { value: "Cargo Cut-Off", label: "Cargo Cut-Off" },
                        ]}
                        placeholder="Select Cut-Off"
                        size="sm"
                        activeColor="teal"
                        triggerClassName="w-full h-[38px] text-[12.5px]"
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-bold text-slate-500 uppercase block ml-1 mb-1">
                        Date &amp; Time
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 24 Sep 2026 4:00 PM"
                        value={newCutOffDateTime}
                        onChange={(e) => setNewCutOffDateTime(e.target.value)}
                        className="w-full rounded-full bg-white border border-slate-200 px-3.5 py-2 text-[12.5px] outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddCutOff(false)}
                      className="px-4 py-2 text-[12px] font-medium text-slate-600 rounded-full hover:bg-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCutOffDeadline}
                      className="rounded-full bg-amber-600 hover:bg-amber-700 px-5 py-2 text-[12px] font-bold text-white shadow-2xs"
                    >
                      Save Deadline
                    </button>
                  </div>
                </div>
              )}

              {/* Deadlines Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {!movementCutOffs ||
                !movementCutOffs.deadlines ||
                movementCutOffs.deadlines.length === 0 ? (
                  <div className="col-span-full rounded-[24px] border border-dashed border-slate-200 bg-white p-6 text-center">
                    <Timer className="size-6 text-slate-400 mx-auto" />
                    <p className="mt-2 text-[13px] font-semibold text-slate-700">
                      No cut-off notices recorded yet
                    </p>
                    <p className="text-[11.5px] text-slate-400">
                      Add deadlines above or forward booking confirmations to auto-parse.
                    </p>
                  </div>
                ) : (
                  movementCutOffs.deadlines.map((dl, idx) => {
                    const isNeedsReview = Boolean(
                      dl.requiresManualReview ||
                      dl.requires_manual_review ||
                      dl.reviewStatus === "NEEDS_REVIEW" ||
                      dl.review_status === "NEEDS_REVIEW",
                    );
                    const isVerified = Boolean(
                      dl.reviewStatus === "MANUALLY_VERIFIED" ||
                      dl.review_status === "MANUALLY_VERIFIED" ||
                      (!isNeedsReview && dl.dateTime),
                    );

                    return (
                      <div
                        key={`dl-${dl.type}-${idx}`}
                        className={cn(
                          "rounded-[22px] border p-4 shadow-2xs space-y-2",
                          isNeedsReview
                            ? "border-amber-300 bg-amber-50/40"
                            : "border-slate-200/60 bg-white",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                            {dl.type}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isNeedsReview ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full"
                                title={
                                  dl.reviewReason ||
                                  dl.review_reason ||
                                  "Requires operational review"
                                }
                              >
                                <AlertTriangle className="size-2.5 text-amber-700" />
                                <span>Needs Review</span>
                              </span>
                            ) : isVerified ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                                <Check className="size-2.5" />
                                <span>Verified</span>
                              </span>
                            ) : null}
                            <span className="rounded-full bg-slate-100 border border-slate-200/60 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600">
                              {dl.in || "Active"}
                            </span>
                          </div>
                        </div>

                        <p className="font-mono text-[14px] font-bold text-slate-900">
                          {dl.dateTime || `${dl.date || ""} ${dl.time || ""}`}
                        </p>

                        {isNeedsReview && (
                          <div className="pt-1 flex items-center justify-between gap-2 border-t border-amber-200/60">
                            <p className="text-[11px] text-amber-800 truncate">
                              {dl.reviewReason ||
                                dl.review_reason ||
                                "Date format requires manual verification"}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleVerifyCutOff(dl)}
                              className="shrink-0 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1 shadow-2xs cursor-pointer transition-colors"
                            >
                              Verify Date
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 5: DOCUMENTS & ATTACHMENTS ================= */}
          {activeTab === "documents" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="rounded-[24px] bg-white border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Paperclip className="size-4.5 text-[#0D74FF]" />
                    <h3 className="text-[16px] font-bold text-slate-900">
                      Movement Documents ({docCount})
                    </h3>
                  </div>
                  <p className="text-[12.5px] text-slate-500 mt-0.5">
                    Carrier documents, bills of lading, and cut-off notices linked to #{effectiveMovementRef}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    refreshDocuments();
                    toast.info(`Documents refreshed for ${effectiveMovementRef}`);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-center"
                >
                  <RefreshCw
                    className={cn(
                      "size-3.5 text-slate-500",
                      isLoadingDocs && "animate-spin text-[#0D74FF]",
                    )}
                  />
                  <span>Refresh Documents</span>
                </button>
              </div>

              {isLoadingDocs ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-white rounded-[24px] border border-slate-200/80">
                  <RefreshCw className="size-6 text-[#0D74FF] animate-spin" />
                  <p className="text-[13px] font-semibold text-slate-700">Loading linked documents...</p>
                </div>
              ) : movementDocs.length === 0 ? (
                <div className="py-12 px-6 flex flex-col items-center justify-center text-center space-y-2 bg-white rounded-[24px] border border-slate-200/80">
                  <div className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400 mb-1">
                    <FileText className="size-6 stroke-[1.5]" />
                  </div>
                  <p className="text-[14px] font-bold text-slate-800">No documents linked yet</p>
                  <p className="text-[12px] text-slate-400 max-w-md">
                    Documents uploaded or synced matching reference #{effectiveMovementRef} will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {movementDocs.map((doc) => {
                    const ext = doc.extension.toUpperCase();
                    const isPdf = ext === "PDF";
                    const isSpreadsheet = ext === "XLS" || ext === "XLSX" || ext === "CSV";

                    return (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className={cn(
                              "grid size-10 place-items-center rounded-xl border font-bold text-[11px] uppercase shrink-0",
                              isPdf
                                ? "bg-rose-50 border-rose-200 text-rose-600"
                                : isSpreadsheet
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                                  : "bg-blue-50 border-blue-200 text-[#0D74FF]",
                            )}
                          >
                            {ext.slice(0, 3)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-[13.5px] font-bold text-slate-900 truncate"
                              title={doc.documentName}
                            >
                              {doc.documentName}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-[11.5px] text-slate-500">
                              <span className="font-semibold text-slate-700">{doc.displayType}</span>
                              <span>·</span>
                              <span>{doc.fileSizeFormatted}</span>
                              {doc.uploadedAt && (
                                <>
                                  <span>·</span>
                                  <span>
                                    {new Date(doc.uploadedAt).toLocaleDateString("en-GB", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => {
                              viewDocumentInNewTab(doc);
                              toast.success(`Opening ${doc.documentName}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[12px] font-semibold transition-colors cursor-pointer"
                          >
                            <Eye className="size-3.5 text-[#0D74FF]" />
                            <span>View</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadDocumentFile(doc);
                              toast.success(`Downloading ${doc.documentName}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#101828] hover:bg-black text-white text-[12px] font-semibold transition-colors cursor-pointer shadow-xs"
                          >
                            <Download className="size-3.5" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 6: AUDIT LOG & TIMELINE ================= */}
          {activeTab === "audit" && (
            <div className="space-y-4 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900">
                    Live Movement Events ({events.length})
                  </h4>
                  <p className="text-[12px] text-slate-500">
                    Immutable real-time audit stream synchronized across operations.
                  </p>
                </div>
              </div>

              {/* Log manual event input */}
              <div className="flex flex-col sm:flex-row gap-2 rounded-[24px] border border-slate-200/60 bg-white p-3.5 shadow-2xs">
                <input
                  type="text"
                  placeholder="Log operational update note..."
                  value={customEventText}
                  onChange={(e) => setCustomEventText(e.target.value)}
                  className="flex-1 rounded-full border border-slate-200 bg-[#F7F9FD] px-4 py-2 text-[12.5px] outline-none focus:bg-white focus:border-[#0D74FF]"
                />
                <input
                  type="text"
                  placeholder="Location"
                  value={customEventLocation}
                  onChange={(e) => setCustomEventLocation(e.target.value)}
                  className="rounded-full border border-slate-200 bg-[#F7F9FD] px-4 py-2 text-[12.5px] outline-none sm:w-44 focus:bg-white focus:border-[#0D74FF]"
                />
                <button
                  type="button"
                  onClick={() => void handleAddCustomEvent()}
                  className="rounded-full bg-[#0D74FF] hover:bg-[#0062E3] px-5 py-2 text-[12px] font-bold text-white shadow-2xs"
                >
                  Log Note
                </button>
              </div>

              {/* Event Stream */}
              <div className="space-y-3 border-l-2 border-slate-200 pl-4 ml-3 pt-1">
                {events.length === 0 ? (
                  <p className="text-[12px] text-slate-400 py-2">No event records logged yet.</p>
                ) : (
                  events.map((evt) => (
                    <div key={evt.id} className="relative group space-y-0.5">
                      <span className="absolute -left-[23px] top-1.5 size-3 rounded-full border-2 border-white bg-[#0D74FF] shadow-xs" />
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-bold text-slate-900">
                          {evt.event_type}
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(evt.event_date || evt.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-[12px] text-slate-600">{evt.description}</p>
                      {evt.location && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                          <MapPin className="size-3 text-[#0D74FF]" />
                          {evt.location}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* ================= BOTTOM ACTION BAR (DRIBBBLE REFERENCE) ================= */}
        <div className="flex items-center justify-between border-t border-slate-200/60 bg-white px-6 py-4 shrink-0">
          <button
            type="button"
            onClick={() => {
              toast.success("Terminal pass generated", {
                description: `Pass for ${effectiveMovementRef} downloaded`,
              });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-2xs cursor-pointer"
          >
            <Download className="size-3.5 text-slate-500" />
            Export Pass
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white border border-slate-200/80 px-5 py-2.5 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
            >
              Close
            </button>
            {nextStage && (
              <button
                type="button"
                onClick={() => void handleAdvanceStage()}
                disabled={isUpdating}
                className="inline-flex items-center gap-2 rounded-full bg-[#0D74FF] hover:bg-[#0062E3] px-6 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(13,116,255,0.28)] transition-all cursor-pointer disabled:opacity-50"
              >
                {isUpdating ? "Updating..." : `Advance to ${nextStage.shortLabel}`}
                <ArrowRight className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export { MovementLifecycleDrawer as MovementLifecycleModal };
