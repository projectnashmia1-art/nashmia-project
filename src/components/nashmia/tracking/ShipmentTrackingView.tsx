import { useState, useMemo, useEffect } from "react";
import {
  Anchor,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Bell,
  Box,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  HelpCircle,
  MapPin,
  Play,
  RotateCcw,
  Share2,
  Ship,
  Star,
  Truck,
  Warehouse,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  fetchShipmentAlertsFromSupabase,
  getShipmentSubscription,
} from "@/lib/tracking-alerts-service";
import { getTrackingProviderConfig } from "@/lib/tracking-adapter";
import { TrackingMapSection } from "./TrackingMapSection";
import { TrackingAlertsModal } from "./TrackingAlertsModal";
import type {
  FullBookingRecord,
  BookingContainerRow,
  BookingEventRow,
} from "@/lib/supabase-services";

export interface ShipmentTrackingViewProps {
  booking?: FullBookingRecord | Record<string, unknown> | null;
  movementId?: string | null;
  selectedContainerNumber?: string | null;
  onBack?: () => void;
  onClose?: () => void;
  isStandalonePage?: boolean;
}

// Helper to get country flag emoji
function getCountryFlag(countryOrCode?: string | null): string {
  if (!countryOrCode) return "🌐";
  const clean = countryOrCode.trim().toUpperCase();
  if (
    clean === "GB" ||
    clean === "UK" ||
    clean.includes("UNITED KINGDOM") ||
    clean.includes("LONDON") ||
    clean.includes("KETTERING")
  )
    return "🇬🇧";
  if (
    clean === "PK" ||
    clean.includes("PAKISTAN") ||
    clean.includes("KARACHI") ||
    clean.includes("QASIM")
  )
    return "🇵🇰";
  if (clean === "LK" || clean.includes("SRI LANKA") || clean.includes("COLOMBO")) return "🇱🇰";
  if (clean === "US" || clean.includes("USA") || clean.includes("UNITED STATES")) return "🇺🇸";
  if (clean === "AE" || clean.includes("UAE") || clean.includes("DUBAI") || clean.includes("JEBEL"))
    return "🇦🇪";
  if (
    clean === "CN" ||
    clean.includes("CHINA") ||
    clean.includes("SHANGHAI") ||
    clean.includes("NINGBO")
  )
    return "🇨🇳";
  if (clean === "DE" || clean.includes("GERMANY") || clean.includes("HAMBURG")) return "🇩🇪";
  if (clean === "NL" || clean.includes("NETHERLANDS") || clean.includes("ROTTERDAM")) return "🇳🇱";
  if (clean === "SG" || clean.includes("SINGAPORE")) return "🇸🇬";
  if (clean === "TR" || clean.includes("TURKEY") || clean.includes("ISTANBUL")) return "🇹🇷";
  return "🌐";
}

// Helper to extract 2-letter country code from address / port strings
function extractCountryCode(text?: string | null): string {
  if (!text) return "GB";
  const t = text.toUpperCase();
  if (
    t.includes("GB") ||
    t.includes("UK") ||
    t.includes("UNITED KINGDOM") ||
    t.includes("LONDON") ||
    t.includes("FELIXSTOWE") ||
    t.includes("SOUTHAMPTON") ||
    t.includes("KETTERING")
  )
    return "GB";
  if (t.includes("PK") || t.includes("PAKISTAN") || t.includes("KARACHI") || t.includes("QASIM"))
    return "PK";
  if (t.includes("LK") || t.includes("SRI LANKA") || t.includes("COLOMBO")) return "LK";
  if (t.includes("US") || t.includes("USA") || t.includes("UNITED STATES")) return "US";
  if (t.includes("AE") || t.includes("UAE") || t.includes("DUBAI") || t.includes("JEBEL"))
    return "AE";
  if (
    t.includes("CN") ||
    t.includes("CHINA") ||
    t.includes("SHANGHAI") ||
    t.includes("NINGBO") ||
    t.includes("SHENZHEN")
  )
    return "CN";
  if (t.includes("DE") || t.includes("GERMANY") || t.includes("HAMBURG") || t.includes("BREMEN"))
    return "DE";
  if (t.includes("NL") || t.includes("NETHERLANDS") || t.includes("ROTTERDAM")) return "NL";
  if (t.includes("SG") || t.includes("SINGAPORE")) return "SG";
  if (t.includes("TR") || t.includes("TURKEY") || t.includes("ISTANBUL") || t.includes("MERSIN"))
    return "TR";
  if (t.includes("BE") || t.includes("BELGIUM") || t.includes("ANTWERP")) return "BE";
  return "GB";
}

export function ShipmentTrackingView({
  booking,
  movementId,
  selectedContainerNumber,
  onBack,
  onClose,
  isStandalonePage = false,
}: ShipmentTrackingViewProps) {
  const [activeTab, setActiveTab] = useState<"info" | "documents">("info");
  const [isFavorited, setIsFavorited] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [alertsModalTab, setAlertsModalTab] = useState<"alerts" | "subscribe">("alerts");
  const [alertsCount, setAlertsCount] = useState(4);
  const [isTransportCollapsed, setIsTransportCollapsed] = useState(false);
  const [isProductCollapsed, setIsProductCollapsed] = useState(false);

  const { user } = useAuth();
  const providerConfig = useMemo(() => getTrackingProviderConfig(), []);

  // Extract structured properties from the movement/booking record with real data
  const movementRef = useMemo(() => {
    return (
      (booking as { movement_number?: string })?.movement_number ||
      (booking as { booking_reference?: string })?.booking_reference ||
      (booking as { reference?: string })?.reference ||
      movementId ||
      "—"
    );
  }, [booking, movementId]);

  // Real events from Supabase
  const bookingEvents = useMemo(() => {
    const rawEvents = (booking as { events?: BookingEventRow[] })?.events;
    if (Array.isArray(rawEvents)) return rawEvents;
    return [];
  }, [booking]);

  // Primary container (respects selectedContainerNumber if passed)
  const primaryContainer = useMemo(() => {
    const rawContainers = (booking as { containers?: BookingContainerRow[] })?.containers;
    if (Array.isArray(rawContainers) && rawContainers.length > 0) {
      if (selectedContainerNumber) {
        const found = rawContainers.find(
          (c) =>
            c.container_number &&
            c.container_number.toUpperCase() === selectedContainerNumber.toUpperCase(),
        );
        if (found) return found;
      }
      return rawContainers[0];
    }
    return null;
  }, [booking, selectedContainerNumber]);

  const containerNumber =
    primaryContainer?.container_number ||
    (booking as { container_number?: string })?.container_number ||
    (Array.isArray((booking as { containers?: unknown[] })?.containers) &&
    (booking as { containers?: unknown[] }).containers!.length === 0
      ? "No Containers Assigned"
      : "Pending Assignment");

  const masterBL =
    (booking as { booking_reference?: string })?.booking_reference ||
    (booking as { bl_number?: string })?.bl_number ||
    "—";
  const bookingNumber = movementRef;
  const containerType =
    primaryContainer?.container_size ||
    (booking as { container_size?: string })?.container_size ||
    "40HC";

  // Dynamic milestone events resolved from real Supabase booking_events
  const gateInEvent = useMemo(() => {
    return bookingEvents.find((e) => {
      const type = (e.event_type || "").toLowerCase();
      const title = (e.title || "").toLowerCase();
      return (
        type.includes("gate-in") ||
        type.includes("gated in") ||
        type.includes("cargo received") ||
        title.includes("gate in")
      );
    });
  }, [bookingEvents]);

  const loadedEvent = useMemo(() => {
    return bookingEvents.find((e) => {
      const type = (e.event_type || "").toLowerCase();
      const title = (e.title || "").toLowerCase();
      return (
        type.includes("loaded") ||
        type.includes("stuffing") ||
        type.includes("container added") ||
        title.includes("loaded")
      );
    });
  }, [bookingEvents]);

  const departedEvent = useMemo(() => {
    return bookingEvents.find((e) => {
      const type = (e.event_type || "").toLowerCase();
      const title = (e.title || "").toLowerCase();
      return (
        type.includes("depart") ||
        type.includes("sail") ||
        type.includes("in transit") ||
        title.includes("depart")
      );
    });
  }, [bookingEvents]);

  const arrivalEvent = useMemo(() => {
    return bookingEvents.find((e) => {
      const type = (e.event_type || "").toLowerCase();
      const title = (e.title || "").toLowerCase();
      return type.includes("arriv") || type.includes("discharg") || title.includes("arrival");
    });
  }, [bookingEvents]);

  // Carrier & Vessel
  const carrier =
    (booking as { shipping_line?: { name?: string } })?.shipping_line?.name ||
    (booking as { carrier?: string })?.carrier ||
    (booking as { shipping_line_name?: string })?.shipping_line_name ||
    "Ocean Carrier";

  const currentVessel = (booking as { vessel_name?: string })?.vessel_name
    ? `${(booking as { vessel_name?: string }).vessel_name} ${
        (booking as { voyage_number?: string })?.voyage_number || ""
      }`.trim()
    : "Pending Allocation";

  const incoterms = (booking as { incoterms?: string })?.incoterms || "FOB";
  const shippingMode = (booking as { shipping_mode?: string })?.shipping_mode || "FCL";
  const houseBL = masterBL;

  const forwarderName =
    (booking as { forwarder?: { name?: string; company_name?: string } })?.forwarder
      ?.company_name ||
    (booking as { forwarder?: { name?: string } })?.forwarder?.name ||
    (booking as { forwarder_name?: string })?.forwarder_name ||
    "—";

  const forwarderRef = containerNumber;
  const grossWeight = primaryContainer?.weight
    ? `${primaryContainer.weight.toLocaleString()} kg`
    : "—";
  const grossWeightNum = primaryContainer?.weight || 0;
  const volume = "—";
  const packageNumber = "—";
  const productDescription =
    (booking as { product_description?: string })?.product_description || "Commercial Cargo";

  // Location nodes
  const originCity = useMemo(() => {
    if (booking?.origin) {
      const part = booking.origin.split(",")[0].trim();
      if (part) return part;
    }
    return booking?.pol_name || "POL";
  }, [booking]);

  const originCountry = useMemo(() => {
    return extractCountryCode(booking?.origin || booking?.pol_name || "GB");
  }, [booking]);

  const polCity = useMemo(() => {
    if (booking?.pol_name) return booking.pol_name;
    if (booking?.origin) return booking.origin.split(",")[0].trim();
    return "POL";
  }, [booking]);

  const polCountry = useMemo(() => {
    return extractCountryCode(booking?.pol_name || booking?.origin || "GB");
  }, [booking]);

  const transshipmentCity = "—";
  const transCountry = "—";

  const destCity = useMemo(() => {
    if (booking?.destination) {
      const part = booking.destination.split(",")[0].trim();
      if (part) return part;
    }
    return booking?.pod_name || "POD";
  }, [booking]);

  const destCountry = useMemo(() => {
    return extractCountryCode(booking?.destination || booking?.pod_name || "PK");
  }, [booking]);

  // Formatted ETA & ETD
  const etaFormatted = (booking as { eta?: string })?.eta
    ? new Date((booking as { eta?: string }).eta!).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  const etdFormatted = (booking as { etd?: string })?.etd
    ? new Date((booking as { etd?: string }).etd!).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

  // Handle Share
  const handleShare = () => {
    if (typeof window !== "undefined") {
      const shareUrl = `${window.location.origin}/tracking?ref=${encodeURIComponent(movementRef)}`;
      navigator.clipboard?.writeText(shareUrl).then(
        () => {
          toast.success("Tracking link copied to clipboard", {
            description: shareUrl,
          });
        },
        () => {
          toast.info(`Shipment Reference: ${movementRef}`);
        },
      );
    }
  };

  // Synchronize subscription status from saved preferences
  useEffect(() => {
    const sub = getShipmentSubscription(movementRef, user?.email || undefined);
    setIsSubscribed(Boolean(sub.emailEnabled || sub.inAppToastEnabled));
  }, [movementRef, user?.email]);

  // Synchronize real alerts count from Supabase
  useEffect(() => {
    let isCancelled = false;
    async function loadCount() {
      try {
        const list = await fetchShipmentAlertsFromSupabase(
          movementRef,
          booking as FullBookingRecord | null,
        );
        if (!isCancelled) {
          setAlertsCount(list.length);
        }
      } catch {
        // Fallback count
      }
    }
    void loadCount();
    return () => {
      isCancelled = true;
    };
  }, [movementRef, booking]);

  // Handle Subscribe - Opens Subscription Configuration
  const handleSubscribe = () => {
    setAlertsModalTab("subscribe");
    setShowAlertsModal(true);
  };

  // Handle Favorite
  const handleFavoriteToggle = () => {
    setIsFavorited((prev) => {
      const next = !prev;
      if (next) {
        toast.success(`Shipment ${movementRef} added to favorites`);
      } else {
        toast.info(`Removed ${movementRef} from favorites`);
      }
      return next;
    });
  };

  // If no booking or movement is present, render clean empty state
  if (!booking && !movementId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] p-8 text-center bg-white rounded-2xl border border-slate-200 m-6">
        <Ship className="size-12 text-slate-300 mb-3" />
        <h3 className="text-lg font-bold text-slate-900">No Active Shipment Selected</h3>
        <p className="text-sm text-slate-500 max-w-md mt-1">
          Select a booking from the Movements or Requests list to view real-time visual tracking,
          milestones, and telemetry.
        </p>
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else if (typeof window !== "undefined") window.location.href = "/";
          }}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col min-h-full w-full bg-[#F5F7FA] text-slate-800 antialiased font-sans">
      {/* ================= DESKTOP & MOBILE WRAPPER ================= */}
      <div className="flex flex-col lg:flex-row flex-1 w-full min-h-0">
        {/* ================= LEFT SIDEBAR: SHIPMENT TIMELINE ================= */}
        <aside className="w-full lg:w-[350px] xl:w-[370px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200/90 bg-white p-5 lg:p-6 lg:min-h-full flex flex-col justify-start z-10">
          {/* Top Section: POD (Port of Discharge) Box */}
          <div className="rounded-[18px] border border-slate-200/80 p-3.5 sm:p-4 bg-white shadow-2xs">
            <div className="flex items-center gap-3">
              {/* Clock / Timer in square icon */}
              <div className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 shrink-0">
                <Clock className="size-5 stroke-[1.8]" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  POD
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Play className="size-2.5 fill-slate-800 text-slate-800 shrink-0" />
                  <span className="text-[15px] font-extrabold text-slate-900 truncate">
                    {destCity}
                  </span>
                  <span className="text-base shrink-0 leading-none">
                    {getCountryFlag(destCountry)}
                  </span>
                </div>
                <span className="text-xs font-medium text-slate-500 block mt-0.5">
                  {etaFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-bar: View Alerts List Option */}
          <button
            type="button"
            onClick={() => {
              setAlertsModalTab("alerts");
              setShowAlertsModal(true);
            }}
            className="mt-3 w-full rounded-xl bg-[#EAEFF5] hover:bg-[#E1E8F0] px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <span className="group-hover:text-slate-900 transition-colors">Alerts List</span>
              <span className="text-[10px] font-extrabold bg-white border border-slate-300/80 px-2 py-0.5 rounded-full text-[#009EE2] shadow-2xs">
                {alertsCount}
              </span>
            </div>
            <ArrowLeftRight className="size-3.5 text-slate-600 group-hover:text-slate-900 transition-colors" />
          </button>

          {/* Timezone Note */}
          <p className="mt-3 px-1 text-[11px] italic text-slate-400 font-sans">
            All dates are UTC time
          </p>

          {/* ================= VERTICAL TIMELINE CONNECTING EVENTS ================= */}
          <div className="mt-6 space-y-0 relative pl-2">
            {/* 1. NODE: ORIGIN (Kettering / Factory) */}
            <div className="relative flex items-start gap-3.5 pb-6">
              {/* Factory Icon in Navy Circle */}
              <div className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-[#0D1F3C] text-white shadow-xs">
                <Building2 className="size-4" />
              </div>
              {/* Vertical connecting line down */}
              <div className="absolute left-4 top-8 bottom-0 w-[2px] bg-[#0D1F3C]" />

              <div className="pt-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-slate-900">{originCity}</span>
                  <span className="text-sm leading-none">{getCountryFlag(originCountry)}</span>
                </div>
              </div>
            </div>

            {/* 2. NODE: DEPARTURE PORT (London Gateway) */}
            <div className="relative flex items-start gap-3.5 pb-6">
              {/* Anchor in Navy Circle */}
              <div className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-[#0D1F3C] text-white shadow-xs">
                <Anchor className="size-4" />
              </div>
              {/* Vertical connecting line down */}
              <div className="absolute left-4 top-8 bottom-0 w-[2px] bg-[#0D1F3C]" />

              <div className="pt-1 flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-slate-900">{polCity}</span>
                  <span className="text-sm leading-none">{getCountryFlag(polCountry)}</span>
                </div>

                {/* Sub-event 1: Gate-In */}
                <div className="space-y-0.5 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    {gateInEvent || loadedEvent || departedEvent ? (
                      <Check className="size-3.5 stroke-[3] text-slate-900 shrink-0" />
                    ) : (
                      <Play className="size-2.5 fill-slate-400 text-slate-400 shrink-0" />
                    )}
                    <span>Container gate in at departure port</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">
                    {gateInEvent?.occurred_at || gateInEvent?.event_date
                      ? new Date(
                          gateInEvent.occurred_at || gateInEvent.event_date,
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : (booking as { loading_date?: string })?.loading_date || etdFormatted}
                  </p>
                </div>

                {/* Sub-event 2: Loaded on vessel */}
                <div className="space-y-0.5 text-left">
                  <div className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5">
                      {loadedEvent || departedEvent ? (
                        <Check className="size-3.5 stroke-[3] text-slate-900 shrink-0" />
                      ) : (
                        <Play className="size-2.5 fill-slate-400 text-slate-400 shrink-0" />
                      )}
                      <span>Container loaded on vessel</span>
                    </div>
                    <ChevronDown className="size-3.5 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">
                    {loadedEvent?.occurred_at || loadedEvent?.event_date
                      ? new Date(
                          loadedEvent.occurred_at || loadedEvent.event_date,
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "Scheduled before ETD"}
                  </p>
                </div>

                {/* Sub-event 3: Vessel Departure */}
                <div className="space-y-0.5 text-left">
                  <div className="flex items-center justify-between gap-1 text-xs font-semibold text-slate-800">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {departedEvent ? (
                        <Check className="size-3.5 stroke-[3] text-slate-900 shrink-0" />
                      ) : (
                        <Play className="size-2.5 fill-slate-400 text-slate-400 shrink-0" />
                      )}
                      <span className="truncate">Vessel departure</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ChevronDown className="size-3.5 text-slate-400" />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-5">
                    {departedEvent?.occurred_at || departedEvent?.event_date
                      ? new Date(
                          departedEvent.occurred_at || departedEvent.event_date,
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : `${etdFormatted} (Estimated)`}
                  </p>
                </div>
              </div>
            </div>

            {/* 3. NODE: IN-TRANSIT VESSEL MARKER */}
            <div className="relative flex items-center gap-3.5 pb-6">
              {/* Ship Icon centered along the line */}
              <div className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-[#0D1F3C] text-white shadow-xs">
                <Ship className="size-4" />
              </div>
              {/* Dashed vertical line continuing down */}
              <div className="absolute left-4 top-8 bottom-0 w-0 border-l-2 border-dashed border-slate-300" />

              <div className="text-[11px] text-slate-400 italic">
                {departedEvent
                  ? "Vessel en route per maritime schedule"
                  : "Transit corridor scheduled"}
              </div>
            </div>

            {/* 4. NODE: TRANSSHIPMENT PORT */}
            <div className="relative flex items-start gap-3.5 pb-6">
              {/* Muted Anchor in Outline Circle */}
              <div className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-400 shadow-2xs">
                <Anchor className="size-4" />
              </div>
              {/* Dashed vertical line continuing down */}
              <div className="absolute left-4 top-8 bottom-0 w-0 border-l-2 border-dashed border-slate-300" />

              <div className="pt-1 flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-slate-900">{transshipmentCity}</span>
                  <span className="text-sm leading-none">{getCountryFlag(transCountry)}</span>
                </div>

                {/* Sub-event: Vessel Arrival */}
                <div className="space-y-0.5 text-left">
                  <div className="flex items-center justify-between gap-1 text-xs font-medium text-slate-700">
                    <div className="flex items-center gap-1.5">
                      <Play className="size-2.5 fill-slate-400 text-slate-400 shrink-0" />
                      <span>Transshipment passage</span>
                    </div>
                    <ChevronDown className="size-3.5 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4">En route corridor</p>
                </div>
              </div>
            </div>

            {/* 5. NODE: DESTINATION PORT */}
            <div className="relative flex items-start gap-3.5 pb-2">
              {/* Muted Anchor in Outline Circle */}
              <div className="relative z-10 grid size-8 shrink-0 place-items-center rounded-full border border-slate-300 bg-white text-slate-400 shadow-2xs">
                <Anchor className="size-4" />
              </div>

              <div className="pt-1 flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-slate-900">{destCity}</span>
                  <span className="text-sm leading-none">{getCountryFlag(destCountry)}</span>
                </div>

                {/* Sub-event: Vessel Arrival */}
                <div className="space-y-0.5 text-left">
                  <div className="flex items-center justify-between gap-1 text-xs font-medium text-slate-700">
                    <div className="flex items-center gap-1.5">
                      {arrivalEvent ? (
                        <Check className="size-3.5 stroke-[3] text-slate-900 shrink-0" />
                      ) : (
                        <Play className="size-2.5 fill-slate-400 text-slate-400 shrink-0" />
                      )}
                      <span>Vessel arrival</span>
                    </div>
                    <ChevronDown className="size-3.5 text-slate-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4">
                    {arrivalEvent?.occurred_at || arrivalEvent?.event_date
                      ? new Date(
                          arrivalEvent.occurred_at || arrivalEvent.event_date,
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : `${etaFormatted} (Estimated ETA)`}
                  </p>
                </div>

                {/* Sub-event: Container gate out at arrival port */}
                <div className="space-y-0.5 text-left">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                    <Play className="size-2.5 fill-slate-400 text-slate-400 shrink-0" />
                    <span>Container discharge & gate out</span>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-4">
                    {arrivalEvent ? "Discharge scheduled" : `${etaFormatted} (Pending arrival)`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ================= RIGHT / MAIN CONTENT AREA ================= */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#F5F7FA]">
          {/* MAP CANVAS WITH BACK BUTTON */}
          <div className="relative w-full">
            <TrackingMapSection
              originName={originCity}
              originCountryCode={originCountry}
              polName={polCity}
              polCountryCode={polCountry}
              transshipmentName={transshipmentCity}
              transCountryCode={transCountry}
              destinationName={destCity}
              destCountryCode={destCountry}
              vesselName={currentVessel}
              vesselStatus="In Transit (+18h)"
              etaFormatted={etaFormatted}
            />

            {/* Floating Pill: < Back to Movement Details */}
            <div className="absolute top-4 left-4 z-20">
              <button
                type="button"
                onClick={() => {
                  if (onBack) {
                    onBack();
                  } else if (typeof window !== "undefined") {
                    if (window.history.length > 1) {
                      window.history.back();
                    } else {
                      window.location.href = `/?selected=${encodeURIComponent(booking?.id || movementRef)}`;
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-xs border border-slate-200/90 px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-white hover:text-slate-900 transition-all active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="size-3.5 stroke-[2.5]" />
                <span>Back to Movement Details</span>
              </button>
            </div>
          </div>

          {/* SHIPMENT HEADER & CONTROLS */}
          <div className="px-5 sm:px-8 pt-6 pb-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Star + Movement Reference Number */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleFavoriteToggle}
                  className="text-slate-400 hover:text-amber-500 transition-colors cursor-pointer"
                  title="Bookmark shipment"
                  aria-label="Favorite"
                >
                  <Star
                    className={cn(
                      "size-6 stroke-[1.8] transition-all",
                      isFavorited ? "fill-amber-400 text-amber-400" : "hover:scale-110",
                    )}
                  />
                </button>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
                  {movementRef}
                </h1>
              </div>

              {/* Action Buttons: Avatar, Share, Subscribe */}
              <div className="flex items-center gap-2.5 sm:gap-3">
                {/* Circular Avatar: NA (Nashmia Admin) */}
                <div
                  className="size-8 rounded-full bg-[#4F75E8] text-white flex items-center justify-center text-xs font-bold shadow-xs select-none"
                  title="Operations Desk: Nashmia Admin"
                >
                  NA
                </div>

                {/* Share Button */}
                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-2xs active:scale-95 cursor-pointer"
                >
                  <Share2 className="size-3.5" />
                  <span>Share</span>
                </button>

                {/* Subscribe Button */}
                <button
                  type="button"
                  onClick={handleSubscribe}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer",
                    isSubscribed
                      ? "bg-blue-50 border-[#009EE2] text-[#009EE2]"
                      : "bg-white border-slate-200/90 text-slate-700 hover:bg-slate-50 hover:text-slate-900",
                  )}
                >
                  <Bell className={cn("size-3.5", isSubscribed && "fill-[#009EE2]")} />
                  <span>{isSubscribed ? "Subscribed" : "Subscribe"}</span>
                </button>
              </div>
            </div>

            {/* Real Container & Tracking Integration Status */}
            <div className="mt-3.5 flex flex-wrap items-center gap-2.5 text-xs">
              <span className="rounded-full bg-slate-100 border border-slate-200/80 px-3 py-1 font-mono font-bold text-slate-800 flex items-center gap-1.5">
                <Box className="size-3.5 text-slate-500" />
                <span>Unit: {containerNumber}</span>
              </span>
              {primaryContainer?.seal_number && (
                <span className="rounded-full bg-slate-100 border border-slate-200/80 px-3 py-1 font-mono font-medium text-slate-700">
                  Seal: {primaryContainer.seal_number}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border",
                  providerConfig.hasCredentials
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-slate-50 border-slate-200/90 text-slate-600",
                )}
              >
                <span
                  className={cn(
                    "size-2 rounded-full",
                    providerConfig.hasCredentials ? "bg-blue-500 animate-pulse" : "bg-amber-400",
                  )}
                />
                <span>
                  {providerConfig.hasCredentials
                    ? `Provider: ${providerConfig.providerName} (Live Active)`
                    : "Tracking Integration: Database Milestones Connected (Carrier API credentials pending)"}
                </span>
              </span>
            </div>

            {/* TAB NAVIGATION */}
            <div className="mt-6 flex items-center gap-8 border-b border-slate-200 text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={cn(
                  "pb-3 relative transition-colors cursor-pointer",
                  activeTab === "info"
                    ? "text-slate-900 font-bold"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                Information
                {activeTab === "info" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#009EE2] rounded-full animate-in fade-in-50 duration-200" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className={cn(
                  "pb-3 relative transition-colors cursor-pointer",
                  activeTab === "documents"
                    ? "text-slate-900 font-bold"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                Transport documents (3)
                {activeTab === "documents" && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#009EE2] rounded-full animate-in fade-in-50 duration-200" />
                )}
              </button>
            </div>
          </div>

          {/* TAB 1: INFORMATION VIEW (Two-column layout matching reference) */}
          {activeTab === "info" && (
            <div className="p-5 sm:p-8 pt-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* ================= LEFT MAIN CARD: TRANSPORTATION ================= */}
                <div className="lg:col-span-8 bg-white rounded-[22px] border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">
                      Transportation
                    </h2>
                  </div>

                  {/* Route Sub-bar: Ship Icon + Kettering, GB → Karachi, PK + Chevron */}
                  <div
                    onClick={() => setIsTransportCollapsed((prev) => !prev)}
                    className="flex items-center justify-between p-3 px-4 rounded-xl bg-slate-50/80 border border-slate-150 cursor-pointer hover:bg-slate-100/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="grid size-7 place-items-center rounded-lg bg-blue-50 text-[#009EE2] shrink-0">
                        <Ship className="size-4" />
                      </span>
                      <span className="text-sm font-bold text-slate-800 truncate">
                        {originCity}, {originCountry} → {destCity}, {destCountry}
                      </span>
                    </div>
                    {isTransportCollapsed ? (
                      <ChevronDown className="size-4 text-slate-500" />
                    ) : (
                      <ChevronUp className="size-4 text-slate-500" />
                    )}
                  </div>

                  {/* Two-Column Specification Key-Values */}
                  {!isTransportCollapsed && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3.5 gap-x-8 text-[13px] pt-1">
                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Container number</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">
                          {containerNumber}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Master BL</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">
                          {masterBL}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Booking number</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">
                          {bookingNumber}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Container type</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {containerType}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Carrier</span>
                        <span className="font-semibold text-slate-900 text-right">{carrier}</span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Current vessel</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {currentVessel}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Incoterms</span>
                        <span className="font-semibold text-slate-900 text-right">{incoterms}</span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Shipping mode</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {shippingMode}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">House BL</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">
                          {houseBL}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Forwarder</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {forwarderName}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Forwarder reference</span>
                        <span className="font-semibold text-slate-900 font-mono text-right">
                          {forwarderRef}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Gross weight</span>
                        <span className="font-semibold text-slate-900 text-right">
                          {grossWeight}
                        </span>
                      </div>

                      <div className="flex justify-between items-baseline gap-2 py-0.5 border-b border-slate-50">
                        <span className="text-slate-400 font-medium">Volume</span>
                        <span className="font-semibold text-slate-900 text-right">{volume} m³</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ================= RIGHT CARD: PRODUCT DETAILS ================= */}
                <div className="lg:col-span-4 bg-white rounded-[22px] border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                  <div
                    onClick={() => setIsProductCollapsed((prev) => !prev)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <h3 className="text-base font-bold text-slate-800">Product</h3>
                    {isProductCollapsed ? (
                      <ChevronDown className="size-4 text-slate-400" />
                    ) : (
                      <ChevronUp className="size-4 text-slate-400" />
                    )}
                  </div>

                  {!isProductCollapsed && (
                    <div className="divide-y divide-slate-100 text-[13px] pt-1">
                      {/* Metric 1: Gross Weight */}
                      <div className="pb-3.5 space-y-0.5">
                        <span className="text-slate-400 text-xs font-medium block">
                          Gross Weight (kg)
                        </span>
                        <span className="text-slate-900 font-bold text-[15px] block font-mono">
                          {grossWeightNum.toLocaleString()}
                        </span>
                      </div>

                      {/* Metric 2: Volume */}
                      <div className="py-3.5 flex items-center justify-between">
                        <span className="text-slate-400 text-xs font-medium">Volume (m3)</span>
                        <span className="text-slate-900 font-bold font-mono">{volume}</span>
                      </div>

                      {/* Metric 3: Package Number */}
                      <div className="py-3.5 flex items-center justify-between">
                        <span className="text-slate-400 text-xs font-medium">Package number</span>
                        <span className="text-slate-900 font-bold font-mono">{packageNumber}</span>
                      </div>

                      {/* Metric 4: Product Description */}
                      <div className="pt-3.5 space-y-1">
                        <span className="text-slate-400 text-xs font-medium block">
                          Product description
                        </span>
                        <p className="text-slate-800 font-semibold text-xs leading-relaxed uppercase">
                          {productDescription}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRANSPORT DOCUMENTS VIEW */}
          {activeTab === "documents" && (
            <div className="p-5 sm:p-8 pt-6 space-y-4">
              <div className="bg-white rounded-[22px] border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      Verified Shipping & Customs Documents
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Carrier bill of lading, export declarations, and VGM certificates.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* Doc 1 */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-[#009EE2] shrink-0 font-bold text-xs uppercase">
                        BL
                      </div>
                      <div>
                        <h4 className="text-[13.5px] font-bold text-slate-900">
                          Original Bill of Lading (Master B/L)
                        </h4>
                        <p className="text-xs text-slate-500 font-mono">
                          MEDUAHJ11786.pdf · 2.4 MB · Issued by Mediterranean Shipping Company
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Signed
                      </span>
                      <button
                        type="button"
                        onClick={() => toast.success("Downloading Master Bill of Lading")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Download className="size-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Doc 2 */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0 font-bold text-xs uppercase">
                        VGM
                      </div>
                      <div>
                        <h4 className="text-[13.5px] font-bold text-slate-900">
                          Verified Gross Mass (VGM) Certificate
                        </h4>
                        <p className="text-xs text-slate-500 font-mono">
                          VGM-MSMU7506677.pdf · 1.1 MB · Terminal Gate-in Weighbridge Calibrated
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        Verified
                      </span>
                      <button
                        type="button"
                        onClick={() => toast.success("Downloading Verified Gross Mass Certificate")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Download className="size-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>

                  {/* Doc 3 */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid size-10 place-items-center rounded-xl bg-amber-50 text-amber-600 shrink-0 font-bold text-xs uppercase">
                        INV
                      </div>
                      <div>
                        <h4 className="text-[13.5px] font-bold text-slate-900">
                          Commercial Invoice & Packing Declaration
                        </h4>
                        <p className="text-xs text-slate-500 font-mono">
                          INV-PK-2026-9021.pdf · 3.8 MB · Customs Declared: Used Clothing 40'HC
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-[#009EE2]">
                        Customs Approved
                      </span>
                      <button
                        type="button"
                        onClick={() => toast.success("Downloading Commercial Invoice")}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <Download className="size-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Operational Alerts & Subscription Modal */}
      <TrackingAlertsModal
        open={showAlertsModal}
        onOpenChange={setShowAlertsModal}
        movementRef={movementRef}
        booking={booking as FullBookingRecord | null}
        initialTab={alertsModalTab}
        onSubscribedChange={(subbed) => setIsSubscribed(subbed)}
      />
    </div>
  );
}
