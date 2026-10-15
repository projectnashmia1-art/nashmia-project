import {
  useState,
  useCallback,
  memo,
  useEffect,
  useMemo,
  createContext,
  useContext,
  useRef,
  lazy,
  Suspense,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  BadgeCheck,
  Bell,
  Calendar,
  Check,
  ChevronDown,
  ClipboardList,
  Container,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Menu,
  MoreVertical,
  PackageCheck,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  Ship,
  Timer,
  Trash2,
  Upload,
  Users,
  Warehouse,
  X,
  Edit3,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { quickActions, type Movement } from "@/lib/nashmia-data";
import { getAllUpcomingCutOffs } from "@/lib/movement-cutoff-service";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDashboardMetricsFromSupabase,
  fetchBookingsFromSupabase,
  deduplicateBookings,
  deleteBookingFromSupabase,
  type FullBookingRecord,
  type DashboardMetrics,
} from "@/lib/supabase-services";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import {
  getLifecycleStageConfig,
  normalizeLifecycleStage,
  type LifecycleStage,
} from "@/lib/movement-lifecycle";
import { ExcelBookingUploadModal } from "./movements/ExcelBookingUploadModal";
import { EditMovementModal } from "./movements/EditMovementModal";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PillPagination } from "./common/PillPagination";
import { useNotifications } from "@/lib/notifications-context";
import {
  KpiGridSkeleton,
  LifecycleSkeleton,
  RecentMovementsSkeleton,
  NeedsAttentionSkeleton,
} from "@/components/nashmia/skeletons/DashboardSkeletons";
import { NotificationsListSkeleton } from "@/components/nashmia/skeletons/NotificationSkeletons";
import { GlobalSearch } from "@/components/nashmia/search/GlobalSearch";
import { NotificationCenterTrigger } from "@/components/nashmia/NotificationCenterTrigger";

const MovementLifecycleDrawer = lazy(() =>
  import("@/components/nashmia/movements/MovementLifecycleDrawer").then((m) => ({
    default: m.MovementLifecycleDrawer,
  })),
);

const AINotificationCenter = lazy(() =>
  import("@/components/nashmia/AINotificationCenter").then((m) => ({
    default: m.AINotificationCenter,
  })),
);

const iconMap: Record<string, LucideIcon> = {
  Container,
  ClipboardList,
  BadgeCheck,
  Ship,
  Anchor,
  PackageCheck,
  Timer,
  AlertTriangle,
  FileText,
  Plus,
  Warehouse,
  Users,
  Receipt,
};

const DEFAULT_KPIS = [
  { label: "Total Containers", value: "0", trend: "0 active", icon: "Container" },
  { label: "Booking Requested", value: "0", trend: "0 pending", icon: "ClipboardList" },
  { label: "Booking Confirmed", value: "0", trend: "0 confirmed", icon: "BadgeCheck" },
  { label: "In Transit", value: "0", trend: "0 sailing", icon: "Ship" },
  { label: "Arrived", value: "0", trend: "0 arrived", icon: "Anchor" },
  { label: "Delivered", value: "0", trend: "0 completed", icon: "PackageCheck" },
];

const DEFAULT_LIFECYCLE = [
  { stage: "Booking Requested", count: 0, state: "future" as const },
  { stage: "Booking Confirmed", count: 0, state: "future" as const },
  { stage: "Cargo Received at Warehouse", count: 0, state: "future" as const },
  { stage: "Stuffing & Sealing", count: 0, state: "future" as const },
  { stage: "Customs Cleared", count: 0, state: "future" as const },
  { stage: "Container Shipped from Warehouse", count: 0, state: "future" as const },
  { stage: "In Transit", count: 0, state: "future" as const },
  { stage: "Delivered", count: 0, state: "future" as const },
];

interface KpiStyleConfig {
  accentColor: string;
  iconBg: string;
  iconColor: string;
  iconBorder: string;
  topBarGradient: string;
  subtext: string;
}

const kpiStyleMap: Record<string, KpiStyleConfig> = {
  Container: {
    accentColor: "#0FA3B1",
    iconBg: "bg-[#E8F5F6]",
    iconColor: "text-[#0FA3B1]",
    iconBorder: "border-[#C7E8E8]",
    topBarGradient: "from-[#0FA3B1] to-[#078A99]",
    subtext: "Fleet active in network",
  },
  ClipboardList: {
    accentColor: "#D97706",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    iconBorder: "border-amber-200/80",
    topBarGradient: "from-amber-400 to-amber-500",
    subtext: "Awaiting confirmation",
  },
  BadgeCheck: {
    accentColor: "#059669",
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    iconBorder: "border-emerald-200/80",
    topBarGradient: "from-emerald-400 to-emerald-600",
    subtext: "Confirmed for loading",
  },
  Ship: {
    accentColor: "#0284C7",
    iconBg: "bg-sky-50",
    iconColor: "text-sky-600",
    iconBorder: "border-sky-200/80",
    topBarGradient: "from-sky-400 to-sky-600",
    subtext: "At sea / in transit",
  },
  Anchor: {
    accentColor: "#4F46E5",
    iconBg: "bg-indigo-50",
    iconColor: "text-indigo-600",
    iconBorder: "border-indigo-200/80",
    topBarGradient: "from-indigo-400 to-indigo-600",
    subtext: "Discharged at port",
  },
  PackageCheck: {
    accentColor: "#7C3AED",
    iconBg: "bg-purple-50",
    iconColor: "text-purple-600",
    iconBorder: "border-purple-200/80",
    topBarGradient: "from-purple-400 to-purple-600",
    subtext: "Completed & delivered",
  },
};

const DEFAULT_ATTENTION = [
  {
    icon: "ClipboardList",
    label: "Bookings awaiting forwarder quotes",
    count: 0,
    to: "/requests",
  },
  {
    icon: "AlertTriangle",
    label: "Containers at sea needing tracking",
    count: 0,
    to: "/requests",
  },
  {
    icon: "FileText",
    label: "Commercial clearance & stuffing items",
    count: 0,
    to: "/requests",
  },
];

function deriveLiveDashboardMetrics(
  bookings: FullBookingRecord[],
  serverMetrics?: DashboardMetrics,
): DashboardMetrics {
  if (!bookings || bookings.length === 0) {
    return (
      serverMetrics || {
        totalContainers: 0,
        bookingRequests: 0,
        bookingConfirmed: 0,
        inTransit: 0,
        arrived: 0,
        delivered: 0,
        kpis: DEFAULT_KPIS,
        lifecycle: DEFAULT_LIFECYCLE,
        attention: DEFAULT_ATTENTION,
        cutoffs: [],
      }
    );
  }

  // De-duplicate bookings by unique booking ID / reference to prevent multi-forwarder duplicates
  const uniqueBookings = deduplicateBookings(bookings);

  let totalContainers = 0;
  let bookingRequests = 0;
  let bookingConfirmed = 0;
  let inTransit = 0;
  let arrived = 0;
  let delivered = 0;

  const stageCounts: Record<string, number> = {
    "Booking Requested": 0,
    "Booking Confirmed": 0,
    "Cargo Received at Warehouse": 0,
    "Stuffing & Sealing": 0,
    "Customs Cleared": 0,
    "Container Shipped from Warehouse": 0,
    "In Transit": 0,
    Arrived: 0,
    Delivered: 0,
  };

  for (const b of uniqueBookings) {
    const cnt = Math.max(1, Number(b.container_count) || 1);
    totalContainers += cnt;

    // Use authoritative normalization
    const stage: LifecycleStage = normalizeLifecycleStage(
      b.status,
      b.confirmation_status,
      b.id || b.movement_number || b.booking_reference,
      b.movement_status,
    );

    // Map to lifecycle stage
    if (stageCounts[stage] !== undefined) {
      stageCounts[stage] += 1;
    } else {
      stageCounts["Booking Requested"] += 1;
    }

    // Map to KPI cards (Count of Unique Main Bookings)
    switch (stage) {
      case "Booking Requested":
      case "Draft":
        bookingRequests += 1;
        break;
      case "Booking Confirmed":
      case "Cargo Received at Warehouse":
      case "Stuffing & Sealing":
      case "Customs Cleared":
      case "Container Shipped from Warehouse":
        bookingConfirmed += 1;
        break;
      case "In Transit":
        inTransit += 1;
        break;
      case "Arrived":
        arrived += 1;
        break;
      case "Delivered":
        delivered += 1;
        break;
      default:
        bookingRequests += 1;
        break;
    }
  }

  const kpis = [
    {
      label: "Total Containers",
      value: String(totalContainers),
      trend: `${totalContainers} in network`,
      icon: "Container",
    },
    {
      label: "Booking Requested",
      value: String(bookingRequests),
      trend: `${bookingRequests} pending`,
      icon: "ClipboardList",
    },
    {
      label: "Booking Confirmed",
      value: String(bookingConfirmed),
      trend: `${bookingConfirmed} confirmed`,
      icon: "BadgeCheck",
    },
    {
      label: "In Transit",
      value: String(inTransit),
      trend: `${inTransit} sailing`,
      icon: "Ship",
    },
    {
      label: "Arrived",
      value: String(arrived),
      trend: `${arrived} at port`,
      icon: "Anchor",
    },
    {
      label: "Delivered",
      value: String(delivered),
      trend: `${delivered} completed`,
      icon: "PackageCheck",
    },
  ];

  const requestedCount = (stageCounts["Booking Requested"] || 0) + (stageCounts["Draft"] || 0);

  const lifecycle = [
    {
      stage: "Booking Requested",
      count: requestedCount,
      state: (requestedCount > 0 ? "active" : "future") as "active" | "future" | "complete",
    },
    {
      stage: "Booking Confirmed",
      count: stageCounts["Booking Confirmed"] || 0,
      state: (stageCounts["Booking Confirmed"] > 0 ? "active" : "future") as
        "active" | "future" | "complete",
    },
    {
      stage: "Cargo Received at Warehouse",
      count: stageCounts["Cargo Received at Warehouse"] || 0,
      state: (stageCounts["Cargo Received at Warehouse"] > 0 ? "active" : "future") as
        "active" | "future" | "complete",
    },
    {
      stage: "Stuffing & Sealing",
      count: stageCounts["Stuffing & Sealing"] || 0,
      state: (stageCounts["Stuffing & Sealing"] > 0 ? "active" : "future") as
        "active" | "future" | "complete",
    },
    {
      stage: "Customs Cleared",
      count: stageCounts["Customs Cleared"] || 0,
      state: (stageCounts["Customs Cleared"] > 0 ? "active" : "future") as
        "active" | "future" | "complete",
    },
    {
      stage: "Container Shipped from Warehouse",
      count: stageCounts["Container Shipped from Warehouse"] || 0,
      state: (stageCounts["Container Shipped from Warehouse"] > 0 ? "active" : "future") as
        "active" | "future" | "complete",
    },
    {
      stage: "In Transit",
      count: (stageCounts["In Transit"] || 0) + (stageCounts["Arrived"] || 0),
      state: ((stageCounts["In Transit"] || 0) + (stageCounts["Arrived"] || 0) > 0
        ? "active"
        : "future") as "active" | "future" | "complete",
    },
    {
      stage: "Delivered",
      count: stageCounts["Delivered"] || 0,
      state: (stageCounts["Delivered"] > 0 ? "complete" : "future") as
        "active" | "future" | "complete",
    },
  ];

  const attentionList = [
    {
      icon: "ClipboardList",
      label: "Bookings awaiting forwarder quotes",
      count: bookingRequests,
      to: "/requests",
    },
    {
      icon: "AlertTriangle",
      label: "Containers at sea needing tracking",
      count: inTransit,
      to: "/requests",
    },
    {
      icon: "FileText",
      label: "Commercial clearance & stuffing items",
      count: (stageCounts["Customs Cleared"] || 0) + (stageCounts["Stuffing & Sealing"] || 0),
      to: "/requests",
    },
  ];

  return {
    totalContainers,
    bookingRequests,
    bookingConfirmed,
    inTransit,
    arrived,
    delivered,
    kpis,
    lifecycle,
    attention: attentionList,
    cutoffs: serverMetrics?.cutoffs || getAllUpcomingCutOffs(uniqueBookings) || [],
  };
}

interface DashboardDataContextValue {
  metrics: DashboardMetrics;
  bookings: FullBookingRecord[];
  isLoading: boolean;
  refetch: () => void;
}

const DashboardDataContext = createContext<DashboardDataContextValue | null>(null);

/**
 * Unified Dashboard Provider that manages single-roundtrip queries and instant Realtime synchronization.
 * Prevents multiple components from opening redundant subscriptions or running duplicate queries.
 */
export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const { userId, organizationId, isConfigured } = useAuth();
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: ["dashboard-bookings", userId],
    queryFn: () => fetchBookingsFromSupabase(userId),
    enabled: true,
    staleTime: 1000 * 60 * 5, // 5m cache freshness ensures instant UI rendering on navigation
    gcTime: 1000 * 60 * 60,
  });

  const {
    data: bookingsData,
    isLoading: bookingsIsLoading,
    refetch: bookingsRefetch,
  } = bookingsQuery;

  // Realtime subscription with immediate local cache mutation for zero-lag response
  useSupabaseRealtime("bookings", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("booking_events", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("notifications", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("email_messages", undefined, isConfigured, { organizationId });

  useEffect(() => {
    const handleImmediateUpdate = (e?: Event) => {
      // Immediately trigger fresh refetch from DB / local cache
      void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void bookingsRefetch();

      if (e && "detail" in e) {
        const detail = (e as CustomEvent).detail;
        if (detail) {
          const targetId = (
            detail.bookingId ||
            detail.id ||
            detail.movementNumber ||
            detail.bookingReference ||
            detail.reference ||
            ""
          )
            .trim()
            .toLowerCase();

          // Prepend new booking if attached
          if (detail.booking && typeof detail.booking === "object") {
            const rawBooking = detail.booking as FullBookingRecord;
            queryClient.setQueriesData<FullBookingRecord[]>(
              { queryKey: ["dashboard-bookings"] },
              (old) => {
                if (!old) return [rawBooking];
                const exists = old.some(
                  (b) =>
                    (rawBooking.id && b.id === rawBooking.id) ||
                    (rawBooking.movement_number &&
                      b.movement_number === rawBooking.movement_number) ||
                    (rawBooking.booking_reference &&
                      b.booking_reference === rawBooking.booking_reference),
                );
                if (exists) {
                  return old.map((b) =>
                    (rawBooking.id && b.id === rawBooking.id) ||
                    (rawBooking.movement_number &&
                      b.movement_number === rawBooking.movement_number) ||
                    (rawBooking.booking_reference &&
                      b.booking_reference === rawBooking.booking_reference)
                      ? { ...b, ...rawBooking }
                      : b,
                  );
                }
                return [rawBooking, ...old];
              },
            );
          }

          if (targetId) {
            queryClient.setQueriesData<FullBookingRecord[]>(
              { queryKey: ["dashboard-bookings"] },
              (old) => {
                if (!old) return old;
                return old.map((b) => {
                  const bId = (b.id || "").trim().toLowerCase();
                  const bMov = (b.movement_number || "").trim().toLowerCase();
                  const bRef = (b.booking_reference || "").trim().toLowerCase();
                  if (bId === targetId || bMov === targetId || bRef === targetId) {
                    const isConfirmed =
                      detail.isConfirmed ||
                      detail.confirmationStatus === "CONFIRMED" ||
                      (typeof detail.status === "string" && detail.status.includes("Confirm"));

                    return {
                      ...b,
                      status: detail.status || b.status,
                      confirmation_status:
                        detail.confirmationStatus ||
                        (isConfirmed ? "CONFIRMED" : b.confirmation_status),
                      confirmed_at:
                        detail.confirmedAt ||
                        b.confirmed_at ||
                        (isConfirmed ? new Date().toISOString() : undefined),
                      confirmed_by: detail.confirmedBy || b.confirmed_by,
                      vessel_name: detail.vesselName || b.vessel_name,
                      voyage_number: detail.voyageNumber || b.voyage_number,
                    } as FullBookingRecord;
                  }
                  return b;
                });
              },
            );
          }
        }
      }
    };

    window.addEventListener("nashmia_booking_created", handleImmediateUpdate);
    window.addEventListener("nashmia_movement_created", handleImmediateUpdate);
    window.addEventListener("nashmia_booking_confirmed", handleImmediateUpdate);
    window.addEventListener("nashmia_booking_awarded", handleImmediateUpdate);
    window.addEventListener("nashmia_booking_status_updated", handleImmediateUpdate);
    window.addEventListener("supabase_realtime_bookings_change", handleImmediateUpdate);
    window.addEventListener("nashmia_bookings_updated", handleImmediateUpdate);
    window.addEventListener("nashmia_multi_forwarder_updated", handleImmediateUpdate);
    window.addEventListener("nashmia_forwarder_offer_received", handleImmediateUpdate);
    window.addEventListener("nashmia:email-sent", handleImmediateUpdate);
    window.addEventListener("storage", handleImmediateUpdate);

    return () => {
      window.removeEventListener("nashmia_booking_created", handleImmediateUpdate);
      window.removeEventListener("nashmia_movement_created", handleImmediateUpdate);
      window.removeEventListener("nashmia_booking_confirmed", handleImmediateUpdate);
      window.removeEventListener("nashmia_booking_awarded", handleImmediateUpdate);
      window.removeEventListener("nashmia_booking_status_updated", handleImmediateUpdate);
      window.removeEventListener("supabase_realtime_bookings_change", handleImmediateUpdate);
      window.removeEventListener("nashmia_bookings_updated", handleImmediateUpdate);
      window.removeEventListener("nashmia_multi_forwarder_updated", handleImmediateUpdate);
      window.removeEventListener("nashmia_forwarder_offer_received", handleImmediateUpdate);
      window.removeEventListener("nashmia:email-sent", handleImmediateUpdate);
      window.removeEventListener("storage", handleImmediateUpdate);
    };
  }, [queryClient, userId, bookingsRefetch]);

  const liveMetrics = useMemo(() => {
    return deriveLiveDashboardMetrics(bookingsQuery.data || []);
  }, [bookingsQuery.data]);

  const contextValue = useMemo<DashboardDataContextValue>(
    () => ({
      metrics: liveMetrics,
      bookings: bookingsData || [],
      isLoading: bookingsIsLoading,
      refetch: () => void bookingsRefetch(),
    }),
    [liveMetrics, bookingsData, bookingsIsLoading, bookingsRefetch],
  );

  return (
    <DashboardDataContext.Provider value={contextValue}>{children}</DashboardDataContext.Provider>
  );
}

/**
 * Accesses unified dashboard data and realtime metrics efficiently.
 */
export function useDashboardData(): DashboardDataContextValue {
  const context = useContext(DashboardDataContext);
  const { userId } = useAuth();

  // Fallback if rendered outside DashboardDataProvider
  const fallbackQuery = useQuery({
    queryKey: ["dashboard-bookings", userId],
    queryFn: () => fetchBookingsFromSupabase(userId),
    enabled: !context,
    staleTime: 1000 * 30,
  });

  const fallbackMetrics = useMemo(() => {
    if (context) return context.metrics;
    return deriveLiveDashboardMetrics(fallbackQuery.data || []);
  }, [context, fallbackQuery.data]);

  if (context) {
    return context;
  }

  return {
    metrics: fallbackMetrics,
    bookings: fallbackQuery.data || [],
    isLoading: fallbackQuery.isLoading,
    refetch: () => {
      void fallbackQuery.refetch();
    },
  };
}

export const TopHeader = memo(function TopHeader({
  onOpenMobileMenu,
}: {
  onOpenMobileMenu?: () => void;
}) {
  const { profile, user } = useAuth();
  const { unreadCount, isMounted } = useNotifications();
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Operations";

  return (
    <header className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Toggle navigation menu"
            className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-2xs transition-all hover:bg-slate-50 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 sm:text-[26px] lg:text-[30px] truncate">
            Good morning, {displayName}
          </h1>
          <p className="mt-0.5 sm:mt-1 text-[13px] sm:text-[14px] text-slate-500">
            Here&apos;s what&apos;s happening across your container operations.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <GlobalSearch variant="dashboard" />

        <NotificationCenterTrigger
          className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-2xs transition-all duration-150 hover:bg-slate-50"
          iconClassName="size-[18px]"
        />

        <Link
          to="/new-booking"
          className="flex h-11 items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-4 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(15,163,177,0.3)] transition-all duration-150"
        >
          <Plus className="size-4" />
          New Booking
        </Link>
      </div>
    </header>
  );
});

export const PageTitle = memo(function PageTitle() {
  return (
    <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-slate-900 sm:text-[24px]">
          Container Operations
        </h2>
        <p className="mt-1 text-[14px] text-slate-500">
          Monitor every movement from booking request to final delivery.
        </p>
      </div>
      <button
        type="button"
        className="flex h-10 w-fit items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-3.5 text-[13px] font-semibold text-slate-800 shadow-2xs transition-colors hover:bg-slate-50"
      >
        <Calendar className="size-4 text-[#0FA3B1]" />
        18 Aug 2026
        <ChevronDown className="size-3.5 text-slate-400" />
      </button>
    </section>
  );
});

function formatKpiTitle(label: string): [string, string] {
  const clean = label.trim();
  if (clean === "Total Containers") return ["Total", "Containers"];
  if (clean === "Booking Requested" || clean === "Booking Requests") return ["Booking", "Requests"];
  if (clean === "Booking Confirmed") return ["Booking", "Confirmed"];
  if (clean === "In Transit") return ["In", "Transit"];
  if (clean === "Arrived") return ["Arrived", "At Port"];
  if (clean === "Delivered") return ["Cargo", "Delivered"];

  const words = clean.split(/\s+/);
  if (words.length <= 1) return [words[0] || "", ""];
  return [words[0], words.slice(1).join(" ")];
}

function renderKpiSparkline(iconName: string, index: number) {
  // 5-bar vertical equalizer (like in Active Accounts)
  if (iconName === "ClipboardList" || index === 1) {
    return (
      <div className="flex items-end gap-1.5 h-6 pb-0.5">
        <span className="w-1.5 h-2 rounded-full bg-slate-900/90" />
        <span className="w-1.5 h-3.5 rounded-full bg-slate-900/90" />
        <span className="w-1.5 h-6 rounded-full bg-slate-900" />
        <span className="w-1.5 h-5 rounded-full bg-slate-900" />
        <span className="w-1.5 h-2.5 rounded-full bg-slate-900/80" />
      </div>
    );
  }

  // 3x5 dot matrix pattern (like in Global Corridors / Connected Lines)
  if (iconName === "BadgeCheck" || index === 2) {
    return (
      <div className="grid grid-rows-3 grid-flow-col gap-x-1.5 gap-y-1 pb-1">
        <span className="size-1 rounded-full bg-slate-300" />
        <span className="size-1.5 rounded-full bg-slate-900" />
        <span className="size-1 rounded-full bg-slate-300" />

        <span className="size-1 rounded-full bg-slate-200" />
        <span className="size-1 rounded-full bg-slate-400" />
        <span className="size-1 rounded-full bg-slate-200" />

        <span className="size-1.5 rounded-full bg-slate-900" />
        <span className="size-1.5 rounded-full bg-slate-900" />
        <span className="size-1 rounded-full bg-slate-300" />

        <span className="size-1 rounded-full bg-slate-200" />
        <span className="size-1 rounded-full bg-slate-400" />
        <span className="size-1 rounded-full bg-slate-200" />

        <span className="size-1 rounded-full bg-slate-300" />
        <span className="size-1.5 rounded-full bg-slate-900" />
        <span className="size-1 rounded-full bg-slate-300" />
      </div>
    );
  }

  // Stepped equalizer for Arrived
  if (iconName === "Anchor" || index === 4) {
    return (
      <div className="flex items-end gap-1.5 h-6 pb-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span className="w-1.5 h-3.5 rounded-full bg-slate-600" />
        <span className="w-1.5 h-5 rounded-full bg-slate-800" />
        <span className="w-1.5 h-6 rounded-full bg-slate-900" />
        <span className="w-1.5 h-3 rounded-full bg-slate-700" />
      </div>
    );
  }

  // Arch pulse with node dot for Delivered
  if (iconName === "PackageCheck" || index === 5) {
    return (
      <div className="pb-1">
        <svg className="w-16 h-5 overflow-visible" viewBox="0 0 64 22" fill="none">
          <path
            d="M 2 17 C 14 17 20 5 32 5 C 44 5 50 17 62 17"
            stroke="#0f172a"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="32" cy="5" r="2.5" fill="#0f172a" />
        </svg>
      </div>
    );
  }

  // Default: Rhythmic bracket step arch sparkline (like Total Buyers / Total Suppliers / Total Forwarders)
  return (
    <div className="pb-1.5">
      <svg className="w-16 h-4 overflow-visible" viewBox="0 0 64 16" fill="none">
        <path
          d="M 2 13 C 4 13 5 6 8 6 C 11 6 12 13 14 13 H 18 C 20 13 21 6 24 6 C 27 6 28 13 30 13 H 34 C 36 13 37 6 40 6 C 43 6 44 13 46 13 H 50 C 52 13 53 6 56 6 C 59 6 60 13 62 13"
          stroke="#0f172a"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export const KpiGrid = memo(function KpiGrid() {
  const { metrics, isLoading } = useDashboardData();
  const safeKpiList = metrics?.kpis && metrics.kpis.length > 0 ? metrics.kpis : DEFAULT_KPIS;

  if (isLoading && (!metrics || !metrics.kpis || metrics.kpis.length === 0)) {
    return <KpiGridSkeleton />;
  }

  return (
    <div className="relative w-full min-w-0 max-w-full">
      {/* Soft warm ambient blur glow behind the widgets matching the buyers page design */}
      <div className="pointer-events-none absolute -top-8 inset-x-0 mx-auto h-72 w-full max-w-full sm:max-w-5xl bg-gradient-to-r from-amber-400/20 via-orange-300/15 to-teal-400/15 blur-3xl opacity-65 -z-10" />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4 sm:gap-4.5">
        {safeKpiList.map((kpi, idx) => {
          const Icon = iconMap[kpi.icon] ?? Container;
          const [line1, line2] = formatKpiTitle(kpi.label);
          const isAmberHero =
            kpi.icon === "Ship" ||
            kpi.label.toLowerCase().includes("transit") ||
            (safeKpiList.length >= 4 && idx === 3);

          if (isAmberHero) {
            return (
              <article
                key={kpi.label}
                className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] p-5 sm:p-5.5 border border-amber-400/20 shadow-[0_16px_36px_-10px_rgba(110,65,25,0.3)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_42px_-10px_rgba(110,65,25,0.4)] flex flex-col justify-between min-h-[145px] sm:min-h-[155px]"
                style={{
                  background: `
                    radial-gradient(circle at 85% 15%, rgba(165, 105, 45, 0.85) 0%, transparent 60%),
                    radial-gradient(circle at 20% 80%, rgba(125, 75, 30, 0.5) 0%, transparent 60%),
                    linear-gradient(135deg, #44311e 0%, #684824 52%, #382515 100%)
                  `,
                }}
              >
                {/* Specular edge */}
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

                {/* Top: Translucent Golden Icon circle + Two-line title */}
                <div className="flex items-center gap-3">
                  <div className="size-11 sm:size-12 rounded-full border border-amber-200/30 bg-white/5 backdrop-blur-xs flex items-center justify-center text-amber-100 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] shrink-0">
                    <Icon className="size-5 stroke-[1.8] text-amber-100" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-amber-100/95">
                      {line1}
                    </span>
                    <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-amber-100/95">
                      {line2}
                    </span>
                  </div>
                </div>

                {/* Bottom: Big metric + unit and golden sine wave sparkline */}
                <div className="mt-4 flex items-end justify-between">
                  <div className="flex items-baseline">
                    <span className="text-[28px] sm:text-[32px] font-bold text-white tracking-tight leading-none">
                      {kpi.value}
                    </span>
                    <span className="text-[13px] font-normal text-amber-200/80 ml-1">cgo</span>
                  </div>

                  {/* Golden sine wave sparkline with vertex dots */}
                  <div className="pb-1">
                    <svg className="w-16 h-5 overflow-visible" viewBox="0 0 64 22" fill="none">
                      <path
                        d="M 2 15 C 10 15 14 5 22 5 C 30 5 34 18 42 18 C 50 18 54 8 62 8"
                        stroke="rgba(253, 230, 138, 0.75)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <circle cx="22" cy="5" r="2" fill="rgba(253, 230, 138, 0.95)" />
                      <circle cx="42" cy="18" r="2" fill="rgba(253, 230, 138, 0.95)" />
                      <circle cx="62" cy="8" r="2" fill="rgba(253, 230, 138, 0.95)" />
                    </svg>
                  </div>
                </div>
              </article>
            );
          }

          return (
            <article
              key={kpi.label}
              className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-5.5 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_-8px_rgba(0,0,0,0.09)] flex flex-col justify-between min-h-[145px] sm:min-h-[155px]"
            >
              {/* Top: Icon circle + Two-line title */}
              <div className="flex items-center gap-3">
                <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
                  <Icon className="size-5 stroke-[1.8] text-slate-700" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                    {line1}
                  </span>
                  <span className="text-[14px] sm:text-[15px] font-medium leading-[1.2] text-slate-800">
                    {line2}
                  </span>
                </div>
              </div>

              {/* Bottom: Big metric + sparkline */}
              <div className="mt-4 flex items-end justify-between">
                <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
                  {kpi.value}
                </span>
                {renderKpiSparkline(kpi.icon, idx)}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
});

export const Lifecycle = memo(function Lifecycle() {
  const { metrics, isLoading } = useDashboardData();
  const safeLifecycleList =
    metrics?.lifecycle && metrics.lifecycle.length > 0 ? metrics.lifecycle : DEFAULT_LIFECYCLE;
  const max = Math.max(...safeLifecycleList.map((s) => s.count), 1);
  const totalContainersInPipeline = safeLifecycleList.reduce(
    (acc, curr) => acc + (curr.count || 0),
    0,
  );

  if (isLoading && (!metrics || !metrics.lifecycle || metrics.lifecycle.length === 0)) {
    return <LifecycleSkeleton />;
  }

  return (
    <section className="relative overflow-hidden rounded-[24px] sm:rounded-[26px] border border-slate-100/90 bg-white p-5 sm:p-6 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300">
      {/* Soft subtle warm ambient background glow matching the fintech theme */}
      <div className="pointer-events-none absolute -top-16 -right-12 h-60 w-80 bg-gradient-to-br from-amber-400/15 via-teal-400/10 to-transparent blur-3xl opacity-50 -z-10" />

      {/* Header with icon, title, count pill and status legend pills */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100/90 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
            <Container className="size-5 stroke-[1.8] text-slate-700" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-[18px] sm:text-[20px] font-bold text-slate-900 tracking-tight leading-snug">
                Container Lifecycle
              </h3>
              <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100/90 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200/60 font-mono">
                {totalContainersInPipeline} in pipeline
              </span>
            </div>
            <p className="mt-0.5 text-[13px] text-slate-500 font-normal">
              Real-time stage distribution across freight & cargo milestones.
            </p>
          </div>
        </div>

        {/* Status Legends in clean frosted pills */}
        <div className="flex items-center gap-2 sm:gap-2.5 text-[11.5px] font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50/80 px-2.5 py-1 text-emerald-700 border border-emerald-200/60 shadow-2xs">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Completed
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F5F6]/90 px-2.5 py-1 text-[#0FA3B1] border border-[#0FA3B1]/25 shadow-2xs">
            <span className="size-1.5 rounded-full bg-[#0FA3B1] animate-pulse" />
            Active Gate
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-slate-500 border border-slate-200/60 shadow-2xs">
            <span className="size-1.5 rounded-full bg-slate-300" />
            Upcoming
          </span>
        </div>
      </div>

      {/* Connected Stage Cards Grid */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
        {safeLifecycleList.map((s, i) => {
          const percent = Math.min(100, Math.round((s.count / max) * 100));
          const isActive = s.state === "active";
          const isComplete = s.state === "complete";

          return (
            <div
              key={s.stage}
              className={cn(
                "group relative flex flex-col justify-between overflow-hidden rounded-[20px] p-3 sm:p-3.5 text-center transition-all duration-300 hover:-translate-y-1",
                isActive &&
                  "border border-[#0FA3B1]/40 bg-gradient-to-b from-[#E8F5F6]/80 via-[#E8F5F6]/40 to-white shadow-[0_8px_22px_-6px_rgba(15,163,177,0.22)] ring-1 ring-[#0FA3B1]/25",
                isComplete &&
                  "border border-emerald-100/90 bg-gradient-to-b from-emerald-50/40 via-emerald-50/15 to-white shadow-[0_4px_16px_-4px_rgba(16,185,129,0.08)] hover:border-emerald-200",
                !isActive &&
                  !isComplete &&
                  "border border-slate-100 bg-slate-50/40 shadow-2xs hover:border-slate-200 hover:bg-white",
              )}
            >
              {/* Step badge pill */}
              <div className="flex items-center justify-center">
                <span
                  className={cn(
                    "flex size-7.5 items-center justify-center rounded-full text-[11px] font-bold transition-all duration-200",
                    isActive &&
                      "bg-[#0FA3B1] text-white shadow-[0_0_12px_rgba(15,163,177,0.5)] ring-4 ring-[#0FA3B1]/15",
                    isComplete &&
                      "bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.35)]",
                    !isActive && !isComplete && "border border-slate-200 bg-white text-slate-400",
                  )}
                >
                  {isComplete ? <Check className="size-3 stroke-[3]" /> : i + 1}
                </span>
              </div>

              {/* Stage Title */}
              <p className="mt-2.5 text-[11.5px] font-semibold leading-tight tracking-tight text-slate-800 min-h-[28px] flex items-center justify-center">
                {s.stage}
              </p>

              {/* Big Metric Value */}
              <p className="font-mono mt-1.5 text-[22px] sm:text-[24px] font-bold text-slate-900 tracking-tight leading-none">
                {s.count}
              </p>

              {/* Mini Progress capsule indicator */}
              <div className="mt-2.5 w-full">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100/90">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      isActive
                        ? "bg-gradient-to-r from-[#0FA3B1] to-teal-400"
                        : isComplete
                          ? "bg-emerald-500"
                          : "bg-slate-300/70",
                    )}
                    style={{ width: `${Math.max(percent, s.count > 0 ? 15 : 6)}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Footer Info Ribbon */}
      <div className="mt-5 pt-3.5 border-t border-slate-100/80 flex flex-wrap items-center justify-between gap-3 text-[12px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-[#0FA3B1]" />
          <span>Automated EDI tracking & milestone updates enabled</span>
        </div>
        <Link
          to="/requests"
          className="inline-flex items-center gap-1.5 font-semibold text-[#0FA3B1] hover:text-[#0b7c87] transition-colors"
        >
          <span>View Requests & Quotations</span>
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
});

export const NeedsAttention = memo(function NeedsAttention() {
  const { metrics, isLoading } = useDashboardData();
  const navigate = useNavigate();
  const safeAttentionList =
    metrics?.attention && metrics.attention.length > 0 ? metrics.attention : DEFAULT_ATTENTION;

  if (isLoading && (!metrics || !metrics.attention || metrics.attention.length === 0)) {
    return <NeedsAttentionSkeleton />;
  }

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)]">
      <h3 className="text-[18px] font-semibold text-slate-900">Needs Attention</h3>
      <p className="mt-1 text-[13.5px] text-slate-500">Items waiting on an operator decision.</p>
      <div className="mt-5 space-y-2">
        {safeAttentionList.map((row) => {
          const Icon = iconMap[row.icon] ?? AlertTriangle;
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => {
                if (row.to) {
                  navigate({ to: row.to });
                }
              }}
              className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-3 text-left transition-all duration-150 hover:border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-rose-200/70 bg-rose-50 text-rose-600">
                <Icon className="size-[17px]" />
              </span>
              <span className="min-w-0 flex-1 text-[13.5px] font-medium text-slate-700">
                {row.label}
              </span>
              <span className="num rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[12px] font-bold text-slate-800 shadow-2xs">
                {row.count}
              </span>
              <ArrowRight className="size-4 shrink-0 text-slate-400 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
            </button>
          );
        })}
      </div>
    </section>
  );
});

function StageBadge({
  stage,
  confirmationStatus,
  refOrId,
}: {
  stage: string;
  confirmationStatus?: string;
  refOrId?: string;
}) {
  const config = getLifecycleStageConfig(stage, confirmationStatus, refOrId);
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-bold shadow-xs",
        config.badgeClass,
      )}
    >
      <span className="mr-1.5 inline-block size-1.5 self-center rounded-full bg-current" />
      {config.shortLabel}
    </span>
  );
}

export const RecentMovements = memo(function RecentMovements() {
  const { bookings, isLoading, refetch } = useDashboardData();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<(Movement & { id?: string }) | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const PAGE_SIZE = 6;
  const queryClient = useQueryClient();

  const handleDeleteMovement = useCallback(
    async (m: Movement & { id?: string }) => {
      const targetKey = m.id || m.ref;
      if (!targetKey) return;

      const confirmDelete = window.confirm(
        `Are you sure you want to permanently delete movement ${m.ref} from the database?`,
      );
      if (!confirmDelete) return;

      try {
        const ok = await deleteBookingFromSupabase(targetKey);
        if (ok) {
          toast.success(`Movement ${m.ref} deleted from database`);
          queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
          queryClient.invalidateQueries({ queryKey: ["bookings"] });
          queryClient.invalidateQueries({ queryKey: ["movements"] });
          refetch();
        } else {
          toast.error(`Failed to delete movement ${m.ref}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to delete movement";
        toast.error(msg);
      }
    },
    [queryClient, refetch],
  );

  const handleOpenMovement = useCallback((id?: string, ref?: string) => {
    setSelectedBookingId(id || null);
    setSelectedRef(ref || null);
    setIsDrawerOpen(true);
  }, []);

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId && !selectedRef) return null;
    return (
      bookings.find((b) => {
        if (selectedBookingId && b.id === selectedBookingId) return true;
        const rawRef =
          b.movement_number ||
          b.booking_reference ||
          (b as { movementNumber?: string }).movementNumber ||
          (b as { reference?: string }).reference;
        return Boolean(selectedRef && rawRef && rawRef.toLowerCase() === selectedRef.toLowerCase());
      }) || null
    );
  }, [bookings, selectedBookingId, selectedRef]);

  // Reset pagination to first page when search query or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStage]);

  // Check URL query parameters on mount to auto-open movement drawer if returning from tracking page
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sel = params.get("selected") || params.get("movement");
      if (sel) {
        handleOpenMovement(sel, sel);
      }
    }
  }, [handleOpenMovement]);

  // Global ⌘K / Ctrl+K keyboard shortcut handler to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag !== "input" && activeTag !== "textarea") {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const movementsData: (Movement & { id?: string })[] = useMemo(() => {
    return bookings.map((b, idx) => {
      const rawRef =
        b.movement_number ||
        b.booking_reference ||
        (b as { movementNumber?: string }).movementNumber ||
        (b as { reference?: string }).reference;
      const fallbackRef = `MOV-2026-${String(idx + 1).padStart(5, "0")}`;

      let buyerName =
        (b.buyer as { name?: string; company_name?: string } | null)?.name ||
        (b.buyer as { company_name?: string } | null)?.company_name ||
        (b as { buyerName?: string }).buyerName ||
        (b as { buyer_name?: string }).buyer_name ||
        "";

      let supplierName =
        (b.supplier as { name?: string; company_name?: string } | null)?.name ||
        (b.supplier as { company_name?: string } | null)?.company_name ||
        (b as { supplierName?: string }).supplierName ||
        (b as { supplier_name?: string }).supplier_name ||
        (b as { supplier_company?: string }).supplier_company ||
        "";

      if (!buyerName && b.buyer_id) {
        try {
          const localBuyer = getLocalBuyers().find((byr) => byr.id === b.buyer_id);
          if (localBuyer) buyerName = localBuyer.name || localBuyer.company || "";
        } catch {
          // Ignore fallback
        }
      }
      if (!supplierName && b.supplier_id) {
        try {
          const localSupplier = getLocalSuppliers().find((sup) => sup.id === b.supplier_id);
          if (localSupplier) supplierName = localSupplier.name || localSupplier.companyName || "";
        } catch {
          // Ignore fallback
        }
      }

      const isConfirmedMovement =
        b.status === "Booking Confirmed" ||
        (b as { movement_status?: string }).movement_status === "Confirmed" ||
        b.is_movement_confirmed === true ||
        Boolean(b.confirmed_at) ||
        Boolean((b as { confirmed_by?: string }).confirmed_by) ||
        Boolean((b as { awardedForwarderName?: string }).awardedForwarderName);

      const forwarderName = isConfirmedMovement
        ? (b as { awardedForwarderName?: string }).awardedForwarderName ||
          (b as { confirmed_by?: string }).confirmed_by ||
          (b.forwarder as { name?: string; company_name?: string } | null)?.name ||
          (b.forwarder as { company_name?: string } | null)?.company_name ||
          (b as { forwarderName?: string }).forwarderName ||
          (b as { forwarder_name?: string }).forwarder_name ||
          (b.shipping_line as { name?: string } | null)?.name ||
          "Confirmed Forwarder"
        : "Pending Award";

      // Extract POL (Port of Loading)
      const rawPol =
        b.origin_port ||
        b.origin ||
        (b as { polName?: string }).polName ||
        (b as { pol_code?: string }).pol_code;
      const cleanPol =
        rawPol && typeof rawPol === "string" && rawPol.trim() && rawPol.trim() !== "POL"
          ? rawPol.trim().length <= 5
            ? rawPol.trim().toUpperCase()
            : rawPol.trim().match(/\(([A-Z]{3,5})\)/)?.[1] ||
              rawPol.trim().slice(0, 3).toUpperCase()
          : "Pending";

      // Extract POD (Port of Discharge)
      const rawPod =
        b.destination_port ||
        b.destination ||
        (b as { podName?: string }).podName ||
        (b as { pod_code?: string }).pod_code;
      const cleanPod =
        rawPod && typeof rawPod === "string" && rawPod.trim() && rawPod.trim() !== "POD"
          ? rawPod.trim().length <= 5
            ? rawPod.trim().toUpperCase()
            : rawPod.trim().match(/\(([A-Z]{3,5})\)/)?.[1] ||
              rawPod.trim().slice(0, 3).toUpperCase()
          : "Pending";

      // Extract Vessel
      const rawVessel =
        b.vessel_name ||
        (b as { vesselName?: string }).vesselName ||
        (b as { vessel?: string }).vessel;
      const cleanVessel =
        rawVessel &&
        typeof rawVessel === "string" &&
        rawVessel.trim() &&
        rawVessel.trim().toUpperCase() !== "TBD" &&
        rawVessel.trim().toUpperCase() !== "PENDING ALLOCATION"
          ? rawVessel.trim()
          : "Pending";

      // Extract ETD
      const cleanEtd =
        b.etd && !isNaN(new Date(b.etd).getTime())
          ? new Date(b.etd).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
          : "Pending";

      // Extract ETA
      const cleanEta =
        b.eta && !isNaN(new Date(b.eta).getTime())
          ? new Date(b.eta).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
          : "Pending";

      return {
        id: b.id,
        ref: rawRef || fallbackRef,
        buyer: buyerName || "—",
        supplier: supplierName || "—",
        forwarder: forwarderName || "—",
        pol: cleanPol,
        pod: cleanPod,
        vessel: cleanVessel,
        etd: cleanEtd,
        eta: cleanEta,
        stage: b.status,
        movementStatus: b.movement_status,
        confirmationStatus: b.confirmation_status,
        rate: b.total_freight ? `$${b.total_freight.toLocaleString()}` : "Pending Quote",
        age: "Just now",
      };
    });
  }, [bookings]);

  const filteredMovements = useMemo(() => {
    return movementsData.filter((m) => {
      // 1. Stage filter
      if (selectedStage !== "all") {
        const canonical = normalizeLifecycleStage(
          m.stage,
          m.confirmationStatus,
          m.ref || m.id,
          (m as { movementStatus?: string }).movementStatus,
        );
        if (selectedStage === "CONFIRMED") {
          const isConfirmedPipeline =
            canonical === "Booking Confirmed" ||
            canonical === "Cargo Received at Warehouse" ||
            canonical === "Stuffing & Sealing" ||
            canonical === "Customs Cleared" ||
            canonical === "Container Shipped from Warehouse";
          if (!isConfirmedPipeline) return false;
        } else if (selectedStage === "REQUESTED") {
          if (canonical !== "Booking Requested" && canonical !== "Draft") return false;
        } else if (selectedStage === "IN_TRANSIT") {
          if (canonical !== "In Transit" && canonical !== "Arrived") return false;
        } else if (selectedStage === "DELIVERED") {
          if (canonical !== "Delivered") return false;
        }
      }

      // 2. Search query matching
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        m.ref.toLowerCase().includes(q) ||
        m.buyer.toLowerCase().includes(q) ||
        m.supplier.toLowerCase().includes(q) ||
        (m.forwarder && m.forwarder.toLowerCase().includes(q)) ||
        m.pol.toLowerCase().includes(q) ||
        m.pod.toLowerCase().includes(q) ||
        m.vessel.toLowerCase().includes(q) ||
        (m.stage && m.stage.toLowerCase().includes(q)) ||
        (m.rate && m.rate.toLowerCase().includes(q)) ||
        (m.etd && m.etd.toLowerCase().includes(q)) ||
        (m.eta && m.eta.toLowerCase().includes(q))
      );
    });
  }, [movementsData, selectedStage, searchQuery]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredMovements.length / PAGE_SIZE) || 1;
  }, [filteredMovements.length, PAGE_SIZE]);

  const currentSafePage = useMemo(() => {
    return Math.min(Math.max(1, currentPage), totalPages);
  }, [currentPage, totalPages]);

  const paginatedMovements = useMemo(() => {
    return filteredMovements.slice((currentSafePage - 1) * PAGE_SIZE, currentSafePage * PAGE_SIZE);
  }, [filteredMovements, currentSafePage, PAGE_SIZE]);

  if (isLoading && bookings.length === 0) {
    return <RecentMovementsSkeleton />;
  }

  return (
    <>
      <section className="overflow-hidden rounded-[26px] border border-slate-200/80 bg-white p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)] space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-semibold text-slate-900">Recent Movements</h3>
              <span className="rounded-full bg-[#E8F5F6] border border-[#C7E8E8] px-2.5 py-0.5 text-[11px] font-bold text-[#0FA3B1]">
                Live Real-Time
              </span>
            </div>
            <p className="mt-1 text-[13.5px] text-slate-500">
              Click any shipment to inspect and advance its full logistics lifecycle stage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-[#0FA3B1]/20 bg-[#E8F5F6] px-3.5 py-2 text-[12.5px] font-semibold text-[#0FA3B1] transition-all hover:bg-[#0FA3B1]/15 active:scale-98 cursor-pointer shadow-2xs"
            >
              <Upload className="size-3.5 stroke-[2.2]" />
              Upload Bookings
            </button>
          </div>
        </div>

        {/* Search & Filters Toolbar */}
        {movementsData.length > 0 && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Left: Search Input with ⌘K Badge */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by reference, buyer, supplier, forwarder, port, or vessel..."
                className="h-[42px] w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-20 text-[13.5px] text-slate-900 placeholder:text-slate-400 transition-all duration-200 focus:border-[#0FA3B1] focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,163,177,0.12)] focus:outline-none"
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none hidden items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-400 shadow-2xs sm:inline-flex">
                    ⌘ K
                  </kbd>
                )}
              </div>
            </div>

            {/* Right: Stage Filter Dropdown + Reset */}
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-[42px] items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold transition-all duration-200 cursor-pointer",
                      selectedStage !== "all"
                        ? "border-[#0FA3B1]/40 bg-[#E8F5F6] text-[#0FA3B1]"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <Filter className="size-3.5 text-slate-400" />
                    <span className="max-w-[130px] truncate">
                      {selectedStage === "all"
                        ? "All Stages"
                        : selectedStage === "CONFIRMED"
                          ? "Confirmed"
                          : selectedStage === "REQUESTED"
                            ? "Requested"
                            : selectedStage === "IN_TRANSIT"
                              ? "In Transit"
                              : selectedStage === "DELIVERED"
                                ? "Delivered"
                                : selectedStage}
                    </span>
                    <ChevronDown className="size-3.5 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
                >
                  <DropdownMenuItem
                    onClick={() => setSelectedStage("all")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <span>All Stages</span>
                    {selectedStage === "all" && <Check className="size-4 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSelectedStage("CONFIRMED")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                  >
                    <span>Booking Confirmed</span>
                    {selectedStage === "CONFIRMED" && <Check className="size-4 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSelectedStage("REQUESTED")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                  >
                    <span>Requested / Pending</span>
                    {selectedStage === "REQUESTED" && <Check className="size-4 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSelectedStage("IN_TRANSIT")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                  >
                    <span>In Transit / Loaded</span>
                    {selectedStage === "IN_TRANSIT" && <Check className="size-4 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setSelectedStage("DELIVERED")}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-2.5 py-2 text-[13px] text-slate-700 hover:bg-slate-100"
                  >
                    <span>Delivered / Cleared</span>
                    {selectedStage === "DELIVERED" && <Check className="size-4 text-[#0FA3B1]" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {(searchQuery !== "" || selectedStage !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedStage("all");
                  }}
                  title="Reset filters"
                  className="inline-flex h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <RotateCcw className="size-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>
        )}

        {movementsData.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="grid size-14 place-items-center rounded-2xl bg-[#E8F5F6] text-[#0FA3B1]">
              <Container className="size-7" />
            </div>
            <h4 className="mt-4 text-[16px] font-semibold text-slate-900">No Movements Yet</h4>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              You haven&apos;t created any container bookings in this profile yet. Create your first
              booking to start tracking real-time logistics.
            </p>
            <Link
              to="/new-booking"
              className="mt-5 flex items-center gap-2 rounded-xl bg-[#0FA3B1] hover:bg-[#078A99] px-4 py-2 text-[13px] font-semibold text-white shadow transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" />
              Create First Booking
            </Link>
          </div>
        ) : filteredMovements.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50">
            <div className="grid size-12 place-items-center rounded-2xl bg-[#E8F5F6] text-[#0FA3B1]">
              <Search className="size-5" />
            </div>
            <h4 className="mt-3.5 text-[15px] font-semibold text-slate-900">
              No matching movements found
            </h4>
            <p className="mt-1 max-w-sm text-[13px] text-slate-500">
              No shipments match &quot;{searchQuery || selectedStage}&quot;. Check the reference,
              buyer, supplier, forwarder, or reset filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSelectedStage("all");
              }}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
            >
              <RotateCcw className="size-3.5 text-slate-400" />
              Clear Search &amp; Filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop table matching reference */}
            <div className="hidden overflow-x-auto md:block -mx-6 sm:-mx-7 px-6 sm:px-7">
              <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-left">
                <thead>
                  <tr className="bg-[#ECEEF1] text-[#5E6778]">
                    <th className="rounded-l-2xl pl-6 pr-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Reference
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Buyer
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Supplier
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Forwarder
                    </th>
                    <th className="px-3.5 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      POL
                    </th>
                    <th className="px-3.5 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      POD
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Vessel
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      ETD
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      ETA
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Total Freight
                    </th>
                    <th className="px-4 py-3.5 text-[13px] font-medium tracking-normal text-[#5E6778]">
                      Age
                    </th>
                    <th className="rounded-r-2xl pr-6 pl-2 py-3.5 text-right text-[13px] font-medium text-[#5E6778] w-12">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMovements.map((m, idx) => (
                    <tr
                      key={m.id ? `mov-${m.id}` : `mov-${m.ref}-${idx}`}
                      onClick={() => handleOpenMovement(m.id, m.ref)}
                      className="group cursor-pointer border-b border-[#F0F2F5] transition-colors duration-150 last:border-b-0 hover:bg-[#F8FAFC]"
                    >
                      <td className="whitespace-nowrap pl-6 pr-4 py-4.5 text-[13.5px] font-semibold tracking-[-0.01em] text-slate-900 group-hover:text-blue-600 transition-colors">
                        {m.ref}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4.5 text-[13.5px] text-slate-700 font-medium">
                        {m.buyer}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4.5 text-[13.5px] text-slate-600">
                        <span
                          className="truncate max-w-[140px] inline-block align-middle font-medium"
                          title={m.supplier}
                        >
                          {m.supplier}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4.5 text-[13.5px]">
                        <span
                          className="truncate max-w-[140px] inline-block align-middle font-semibold text-[#0FA3B1]"
                          title={m.forwarder}
                        >
                          {m.forwarder}
                        </span>
                      </td>
                      <td className="px-3.5 py-4.5 text-[13px] font-semibold text-slate-700">
                        {m.pol === "Pending" ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Pending
                          </span>
                        ) : (
                          m.pol
                        )}
                      </td>
                      <td className="px-3.5 py-4.5 text-[13px] font-semibold text-slate-700">
                        {m.pod === "Pending" ? (
                          <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200/60 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                            Pending
                          </span>
                        ) : (
                          m.pod
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4.5 text-[13px] text-slate-600">
                        {m.vessel === "Pending" ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Pending
                          </span>
                        ) : (
                          m.vessel
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4.5 text-[13px] text-slate-600">
                        {m.etd === "Pending" ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Pending
                          </span>
                        ) : (
                          m.etd
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4.5 text-[13px] text-slate-600">
                        {m.eta === "Pending" ? (
                          <span className="inline-flex items-center rounded-md bg-slate-100 border border-slate-200/80 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                            Pending
                          </span>
                        ) : (
                          m.eta
                        )}
                      </td>
                      <td className="px-4 py-4.5">
                        <StageBadge
                          stage={m.stage}
                          confirmationStatus={m.confirmationStatus}
                          refOrId={m.id || m.ref}
                          movementStatus={(m as { movementStatus?: string }).movementStatus}
                        />
                      </td>
                      <td className="px-4 py-4.5 text-[13.5px] font-medium text-slate-900">
                        {m.rate}
                      </td>
                      <td className="px-4 py-4.5 text-[12.5px] text-slate-400">{m.age}</td>
                      <td
                        className="pr-6 pl-2 py-4.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label="Movement options"
                              className="size-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                              <MoreVertical className="size-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-48 text-xs rounded-xl shadow-lg border border-slate-200 p-1"
                          >
                            <DropdownMenuItem
                              onClick={() => handleOpenMovement(m.id, m.ref)}
                              className="gap-2 cursor-pointer font-medium"
                            >
                              <ExternalLink className="size-3.5 text-slate-500" />
                              Inspect Lifecycle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setEditingMovement(m)}
                              className="gap-2 cursor-pointer font-medium text-slate-800"
                            >
                              <Edit3 className="size-3.5 text-blue-500" />
                              Update Movement
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                navigator.clipboard.writeText(m.ref);
                                toast.success(`Movement reference ${m.ref} copied`);
                              }}
                              className="gap-2 cursor-pointer font-medium text-slate-600"
                            >
                              <Copy className="size-3.5 text-slate-400" />
                              Copy Reference
                            </DropdownMenuItem>
                            <div className="h-px bg-slate-100 my-1" />
                            <DropdownMenuItem
                              onClick={() => void handleDeleteMovement(m)}
                              className="gap-2 cursor-pointer font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700"
                            >
                              <Trash2 className="size-3.5 text-rose-500" />
                              Delete Movement
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {paginatedMovements.map((m, idx) => (
                <div
                  key={m.id ? `mob-mov-${m.id}` : `mob-mov-${m.ref}-${idx}`}
                  onClick={() => handleOpenMovement(m.id, m.ref)}
                  className="w-full rounded-2xl border border-slate-200/90 bg-white p-4 text-left transition hover:bg-slate-50 active:bg-slate-100/70 cursor-pointer shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{m.ref}</span>
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <StageBadge
                        stage={m.stage}
                        confirmationStatus={m.confirmationStatus}
                        refOrId={m.id || m.ref}
                        movementStatus={(m as { movementStatus?: string }).movementStatus}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label="Options"
                            className="size-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100"
                          >
                            <MoreVertical className="size-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          className="w-44 text-xs rounded-xl shadow-lg border border-slate-200 p-1"
                        >
                          <DropdownMenuItem
                            onClick={() => setEditingMovement(m)}
                            className="gap-2 font-medium"
                          >
                            <Edit3 className="size-3.5 text-blue-500" />
                            Update
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => void handleDeleteMovement(m)}
                            className="gap-2 font-medium text-rose-600"
                          >
                            <Trash2 className="size-3.5 text-rose-500" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="text-xs text-slate-700">
                    <p className="text-slate-900 font-semibold">{m.buyer}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-slate-500">
                      <span>
                        <strong className="text-slate-400 font-normal">Shipper: </strong>
                        {m.supplier}
                      </span>
                      <span className="text-[#0FA3B1] font-medium">
                        <strong className="text-slate-400 font-normal">Forwarder: </strong>
                        {m.forwarder}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-2.5 text-xs text-slate-600 border border-slate-100">
                    <div className="font-semibold text-slate-800">
                      {m.pol} → {m.pod}
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      ETD {m.etd} • ETA {m.eta}
                    </div>
                    <div className="font-bold text-slate-900">{m.rate}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom pagination matching visual reference */}
            <PillPagination
              currentPage={currentSafePage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredMovements.length}
              pageSize={PAGE_SIZE}
              itemName="movements"
              className="mt-2 pt-2 border-t border-slate-100"
            />
          </>
        )}
      </section>

      {isDrawerOpen && (
        <Suspense fallback={null}>
          <MovementLifecycleDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            bookingId={selectedBookingId}
            initialReference={selectedRef}
            initialBooking={selectedBooking}
            onMovementUpdated={() => {
              refetch();
            }}
          />
        </Suspense>
      )}

      {isUploadModalOpen && (
        <ExcelBookingUploadModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          existingBookings={bookings}
          onUploadSuccess={() => {
            refetch();
          }}
        />
      )}

      {editingMovement && (
        <EditMovementModal
          isOpen={Boolean(editingMovement)}
          onClose={() => setEditingMovement(null)}
          movement={editingMovement}
          onUpdated={() => {
            refetch();
          }}
        />
      )}
    </>
  );
});

export const UpcomingCutoffs = memo(function UpcomingCutoffs() {
  const [selectedMovementRef, setSelectedMovementRef] = useState<string | null>(null);
  const [cutOffList, setCutOffList] = useState(() => getAllUpcomingCutOffs());

  useEffect(() => {
    const refreshCutOffs = () => {
      setCutOffList(getAllUpcomingCutOffs());
    };
    window.addEventListener("nashmia_movement_cutoff_updated", refreshCutOffs);
    window.addEventListener("nashmia_bookings_updated", refreshCutOffs);
    return () => {
      window.removeEventListener("nashmia_movement_cutoff_updated", refreshCutOffs);
      window.removeEventListener("nashmia_bookings_updated", refreshCutOffs);
    };
  }, []);

  return (
    <>
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between">
          <h3 className="text-[18px] font-semibold text-slate-900">Upcoming Cut-offs</h3>
          <span className="text-[11.5px] font-medium text-slate-400">By Movement</span>
        </div>
        <p className="mt-1 text-[13.5px] text-slate-500">Deadlines in the next few days.</p>
        <div className="mt-5 space-y-2.5">
          {cutOffList.slice(0, 5).map((c, idx) => (
            <button
              type="button"
              onClick={() => setSelectedMovementRef(c.ref)}
              key={`cutoff-${c.type}-${c.ref}-${idx}`}
              className="w-full text-left flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3.5 transition-colors hover:border-amber-200 hover:bg-amber-50/40 cursor-pointer group"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-600 group-hover:bg-amber-100/80">
                <Timer className="size-[17px]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="num text-[12.5px] font-bold text-slate-900 group-hover:text-amber-800">
                  {c.ref}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] text-slate-500">{c.type}</span>
                  {c.reminderDateTime && (
                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                      48h: {c.reminderDateTime}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="num text-[13.5px] font-bold text-slate-900">
                  {c.date} · {c.time}
                </p>
                <p className="text-[11px] font-semibold text-[#0FA3B1]">{c.in}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {selectedMovementRef && (
        <Suspense fallback={null}>
          <MovementLifecycleDrawer
            isOpen={Boolean(selectedMovementRef)}
            onClose={() => setSelectedMovementRef(null)}
            initialReference={selectedMovementRef}
          />
        </Suspense>
      )}
    </>
  );
});

export const QuickActions = memo(function QuickActions() {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)]">
      <h3 className="text-[18px] font-semibold text-slate-900">Quick Actions</h3>
      <p className="mt-1 text-[13.5px] text-slate-500">Start a common operation.</p>
      <div className="mt-5 grid grid-cols-2 gap-2.5">
        {quickActions.map((a) => {
          const Icon = iconMap[a.icon] ?? Plus;
          if (a.label === "New Booking") {
            return (
              <Link
                key={a.label}
                to="/new-booking"
                className="group flex flex-col items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50"
              >
                <span className="grid size-9 place-items-center rounded-xl border border-[#C7E8E8] bg-[#E8F5F6] text-[#0FA3B1] transition-transform duration-150 group-hover:scale-105">
                  <Icon className="size-[17px]" />
                </span>
                <span className="text-[13px] font-semibold text-slate-800">{a.label}</span>
              </Link>
            );
          }
          return (
            <button
              key={a.label}
              type="button"
              className="group flex flex-col items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:border-slate-200 hover:bg-slate-50"
            >
              <span className="grid size-9 place-items-center rounded-xl border border-[#C7E8E8] bg-[#E8F5F6] text-[#0FA3B1] transition-transform duration-150 group-hover:scale-105">
                <Icon className="size-[17px]" />
              </span>
              <span className="text-[13px] font-semibold text-slate-800">{a.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
});
