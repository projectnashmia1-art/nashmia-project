import { useState, useCallback, memo, useEffect } from "react";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  BadgeCheck,
  Bell,
  Calendar,
  ChevronDown,
  ClipboardList,
  Container,
  FileText,
  Menu,
  PackageCheck,
  Plus,
  Receipt,
  Search,
  Ship,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { attention, cutoffs, quickActions, type Movement } from "@/lib/nashmia-data";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDashboardMetricsFromSupabase,
  fetchBookingsFromSupabase,
} from "@/lib/supabase-services";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import { getLifecycleStageConfig } from "@/lib/movement-lifecycle";
import { MovementLifecycleDrawer } from "@/components/nashmia/movements/MovementLifecycleDrawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AINotificationCenter } from "@/components/nashmia/AINotificationCenter";
import { useNotifications } from "@/lib/notifications-context";

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
  { stage: "Empty Released", count: 0, state: "future" as const },
  { stage: "Gate In", count: 0, state: "future" as const },
  { stage: "Loaded", count: 0, state: "future" as const },
  { stage: "In Transit", count: 0, state: "future" as const },
  { stage: "Arrived", count: 0, state: "future" as const },
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

/**
 * Unified Dashboard Query for zero lag, single-roundtrip data fetching & caching
 */
export function useDashboardData() {
  const { userId, isConfigured } = useAuth();
  const queryClient = useQueryClient();

  const metricsQuery = useQuery({
    queryKey: ["dashboard-metrics", userId],
    queryFn: () => fetchDashboardMetricsFromSupabase(userId),
    enabled: isConfigured,
    staleTime: 1000 * 30,
  });

  const bookingsQuery = useQuery({
    queryKey: ["dashboard-bookings", userId],
    queryFn: () => fetchBookingsFromSupabase(userId),
    enabled: isConfigured,
    staleTime: 1000 * 30,
  });

  // Single Realtime subscription for all dashboard components
  const invalidateDashboard = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
  }, [queryClient]);

  useSupabaseRealtime("bookings", invalidateDashboard, isConfigured);
  useSupabaseRealtime("booking_events", invalidateDashboard, isConfigured);
  useSupabaseRealtime("notifications", invalidateDashboard, isConfigured);
  useSupabaseRealtime("forwarder_offers", invalidateDashboard, isConfigured);

  useEffect(() => {
    const handleImmediateUpdate = () => {
      invalidateDashboard();
    };

    window.addEventListener("nashmia_booking_confirmed", handleImmediateUpdate);
    window.addEventListener("nashmia_booking_awarded", handleImmediateUpdate);
    window.addEventListener("nashmia_booking_status_updated", handleImmediateUpdate);
    window.addEventListener("supabase_realtime_bookings_change", handleImmediateUpdate);
    window.addEventListener("nashmia_bookings_updated", handleImmediateUpdate);
    window.addEventListener("nashmia:email-sent", handleImmediateUpdate);
    window.addEventListener("storage", handleImmediateUpdate);

    return () => {
      window.removeEventListener("nashmia_booking_confirmed", handleImmediateUpdate);
      window.removeEventListener("nashmia_booking_awarded", handleImmediateUpdate);
      window.removeEventListener("nashmia_booking_status_updated", handleImmediateUpdate);
      window.removeEventListener("supabase_realtime_bookings_change", handleImmediateUpdate);
      window.removeEventListener("nashmia_bookings_updated", handleImmediateUpdate);
      window.removeEventListener("nashmia:email-sent", handleImmediateUpdate);
      window.removeEventListener("storage", handleImmediateUpdate);
    };
  }, [invalidateDashboard]);

  return {
    metrics: metricsQuery.data,
    bookings: bookingsQuery.data || [],
    isLoading: metricsQuery.isLoading || bookingsQuery.isLoading,
    refetch: invalidateDashboard,
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
      <div className="flex items-center gap-3">
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
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-slate-900 sm:text-[30px]">
            Good morning, {displayName}
          </h1>
          <p className="mt-1 text-[14px] text-slate-500">
            Here&apos;s what&apos;s happening across your container operations.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex h-11 w-full min-w-[240px] items-center gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 shadow-2xs sm:w-[330px]">
          <Search className="size-4 shrink-0 text-slate-400" />
          <input
            aria-label="Search"
            placeholder="Search containers, buyers, references..."
            className="w-full bg-transparent text-[13.5px] text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Notifications"
              className="relative grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200/90 bg-white text-slate-700 shadow-2xs transition-all duration-150 hover:bg-slate-50 focus:outline-none"
            >
              <Bell className="size-[18px]" />
              {isMounted && unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-[#0FA3B1] px-1 text-[10px] font-bold text-white shadow-[0_2px_6px_rgba(15,163,177,0.4)] ring-2 ring-white animate-in zoom-in-50">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-auto p-0 border-0 bg-transparent shadow-none"
          >
            <AINotificationCenter />
          </PopoverContent>
        </Popover>

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

export const KpiGrid = memo(function KpiGrid() {
  const { metrics } = useDashboardData();
  const safeKpiList = metrics?.kpis && metrics.kpis.length > 0 ? metrics.kpis : DEFAULT_KPIS;

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {safeKpiList.map((kpi) => {
        const Icon = iconMap[kpi.icon] ?? Container;
        const style = kpiStyleMap[kpi.icon] ?? kpiStyleMap.Container;
        const negative = kpi.trend.startsWith("-");
        const Trend = negative ? TrendingDown : TrendingUp;

        return (
          <article
            key={kpi.label}
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <span
              className={cn(
                "absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r transition-opacity duration-200 opacity-80 group-hover:opacity-100",
                style.topBarGradient,
              )}
            />

            <div>
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "grid size-10 place-items-center rounded-xl border transition-transform duration-200 group-hover:scale-105",
                    style.iconBg,
                    style.iconBorder,
                  )}
                >
                  <Icon className={cn("size-5", style.iconColor)} />
                </span>

                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight",
                    negative
                      ? "border-rose-200/70 bg-rose-50 text-rose-700"
                      : kpi.trend.includes("%")
                        ? "border-emerald-200/70 bg-emerald-50 text-emerald-700"
                        : "border-slate-200/70 bg-slate-50 text-slate-600",
                  )}
                >
                  <Trend className="size-3" />
                  {kpi.trend}
                </span>
              </div>

              <div className="mt-4">
                <p className="text-[12.5px] font-medium text-slate-500 tracking-tight">
                  {kpi.label}
                </p>
                <p className="num mt-1 text-[32px] font-bold leading-none tracking-tight text-slate-900 transition-colors group-hover:text-[#0FA3B1]">
                  {kpi.value}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-[11.5px] text-slate-400">
              <span className="truncate">{style.subtext}</span>
              <span className="size-1.5 rounded-full bg-[#0FA3B1]/50 group-hover:bg-[#0FA3B1] transition-colors" />
            </div>
          </article>
        );
      })}
    </section>
  );
});

export const Lifecycle = memo(function Lifecycle() {
  const { metrics } = useDashboardData();
  const safeLifecycleList =
    metrics?.lifecycle && metrics.lifecycle.length > 0 ? metrics.lifecycle : DEFAULT_LIFECYCLE;
  const max = Math.max(...safeLifecycleList.map((s) => s.count), 1);

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-[18px] font-semibold text-slate-900">Container Lifecycle</h3>
          <p className="mt-1 text-[13.5px] text-slate-500">
            Current distribution across every operational stage.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11.5px] font-medium text-slate-500">
          {[
            { label: "Completed", cls: "bg-emerald-500" },
            { label: "Active", cls: "bg-[#0FA3B1]" },
            { label: "Upcoming", cls: "bg-slate-200 border border-slate-300" },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className={cn("size-2 rounded-full", l.cls)} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 xl:grid-cols-8">
        {safeLifecycleList.map((s, i) => (
          <div key={s.stage} className="relative">
            {i < safeLifecycleList.length - 1 && (
              <span className="absolute left-[calc(50%+22px)] top-[18px] hidden h-px w-[calc(100%-44px)] bg-slate-200 xl:block" />
            )}
            <div className="flex flex-col items-center text-center">
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full border text-[11px] font-bold transition-transform hover:scale-105",
                  s.state === "complete" && "border-emerald-200 bg-emerald-50 text-emerald-700",
                  s.state === "active" &&
                    "border-[#0FA3B1]/40 bg-[#E8F5F6] text-[#0FA3B1] shadow-[0_0_0_4px_rgba(15,163,177,0.12)]",
                  s.state === "future" && "border-slate-200 bg-slate-50 text-slate-400",
                )}
              >
                {i + 1}
              </span>
              <p className="mt-3 text-[12px] font-semibold leading-tight text-slate-800">
                {s.stage}
              </p>
              <p className="num mt-1 text-[20px] font-bold text-slate-900">{s.count}</p>
              <div className="mt-2.5 h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-300",
                    s.state === "active" ? "bg-[#0FA3B1]" : "bg-emerald-500",
                  )}
                  style={{ width: `${Math.round((s.count / max) * 100)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
});

export const NeedsAttention = memo(function NeedsAttention() {
  const { metrics } = useDashboardData();
  const navigate = useNavigate();
  const safeAttentionList =
    metrics?.attention && metrics.attention.length > 0 ? metrics.attention : attention;

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

function StageBadge({ stage }: { stage: string }) {
  const config = getLifecycleStageConfig(stage);
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
  const { bookings, refetch } = useDashboardData();
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const movementsData: (Movement & { id?: string })[] = bookings.map((b, idx) => {
    const rawRef = b.booking_reference || (b as { reference?: string }).reference;
    const fallbackRef = b.id
      ? `NASH-CM-${b.id
          .replace(/[^a-zA-Z0-9]/g, "")
          .slice(-5)
          .toUpperCase()}`
      : `NASH-CM-${String(idx + 1).padStart(5, "0")}`;

    return {
      id: b.id,
      ref: rawRef || fallbackRef,
      buyer:
        (b.buyer as { company_name?: string } | null)?.company_name ||
        (b as { buyerName?: string }).buyerName ||
        "Consignee Account",
      supplier:
        (b.supplier as { company_name?: string } | null)?.company_name ||
        (b as { supplierName?: string }).supplierName ||
        "Collection Point",
      pol: (b.origin || (b as { polName?: string }).polName || "FXT").slice(0, 3).toUpperCase(),
      pod: (b.destination || (b as { podName?: string }).podName || "KHI")
        .slice(0, 3)
        .toUpperCase(),
      vessel: b.vessel_name || (b as { vesselName?: string }).vesselName || "TBD",
      etd: b.etd
        ? new Date(b.etd).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        : "—",
      eta: b.eta
        ? new Date(b.eta).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
        : "—",
      stage: b.status,
      rate: `$${(b.total_freight || 2100).toLocaleString()}`,
      age: "Just now",
    };
  });

  const handleOpenMovement = useCallback((id?: string, ref?: string) => {
    setSelectedBookingId(id || null);
    setSelectedRef(ref || null);
    setIsDrawerOpen(true);
  }, []);

  const cols = [
    "Reference",
    "Buyer",
    "Supplier",
    "POL",
    "POD",
    "Vessel",
    "ETD",
    "ETA",
    "Lifecycle Stage",
    "Rate",
    "Age",
  ];

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)]">
        <div className="flex flex-wrap items-end justify-between gap-3 p-6 pb-4">
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
            <Link
              to="/new-booking"
              className="flex items-center gap-1.5 rounded-xl border border-[#0FA3B1]/20 bg-[#E8F5F6] px-3 py-1.5 text-[12.5px] font-semibold text-[#0FA3B1] transition-colors hover:bg-[#0FA3B1]/15"
            >
              <Plus className="size-3.5" />
              New Booking
            </Link>
          </div>
        </div>

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
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] border-collapse text-left">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60">
                    {cols.map((c) => (
                      <th
                        key={c}
                        className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500"
                      >
                        {c}
                      </th>
                    ))}
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {movementsData.map((m, idx) => (
                    <tr
                      key={m.id ? `mov-${m.id}` : `mov-${m.ref}-${idx}`}
                      onClick={() => handleOpenMovement(m.id, m.ref)}
                      className="group cursor-pointer border-b border-slate-100 transition-colors duration-150 last:border-0 hover:bg-[#E8F5F6]/40"
                    >
                      <td className="num whitespace-nowrap px-4 py-3.5 text-[13px] font-bold tracking-[-0.01em] text-slate-900">
                        {m.ref}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-slate-800">
                        {m.buyer}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[13px] text-slate-500">
                        {m.supplier}
                      </td>
                      <td className="px-4 py-3.5 text-[12.5px] font-semibold text-slate-700">
                        {m.pol}
                      </td>
                      <td className="px-4 py-3.5 text-[12.5px] font-semibold text-slate-700">
                        {m.pod}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-[12.5px] text-slate-500">
                        {m.vessel}
                      </td>
                      <td className="num whitespace-nowrap px-4 py-3.5 text-[12.5px] text-slate-700">
                        {m.etd}
                      </td>
                      <td className="num whitespace-nowrap px-4 py-3.5 text-[12.5px] text-slate-700">
                        {m.eta}
                      </td>
                      <td className="px-4 py-3.5">
                        <StageBadge stage={m.stage} />
                      </td>
                      <td className="num px-4 py-3.5 text-[13px] font-semibold text-slate-900">
                        {m.rate}
                      </td>
                      <td className="num px-4 py-3.5 text-[12.5px] text-slate-500">{m.age}</td>
                      <td className="pr-4">
                        <ArrowRight className="size-4 text-[#0FA3B1] opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="space-y-2.5 p-4 md:hidden">
              {movementsData.map((m, idx) => (
                <button
                  key={m.id ? `mob-mov-${m.id}` : `mob-mov-${m.ref}-${idx}`}
                  type="button"
                  onClick={() => handleOpenMovement(m.id, m.ref)}
                  className="w-full rounded-xl border border-slate-100 bg-slate-50/50 p-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="num text-[13.5px] font-bold text-slate-900">{m.ref}</span>
                    <StageBadge stage={m.stage} />
                  </div>
                  <p className="mt-2 text-[13px] text-slate-800">{m.buyer}</p>
                  <p className="text-[12px] text-slate-500">{m.supplier}</p>
                  <div className="num mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-slate-500">
                    <span>
                      {m.pol} → {m.pod}
                    </span>
                    <span>ETD {m.etd}</span>
                    <span>ETA {m.eta}</span>
                    <span className="font-semibold text-slate-900">{m.rate}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <MovementLifecycleDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        bookingId={selectedBookingId}
        initialReference={selectedRef}
        onMovementUpdated={() => {
          refetch();
        }}
      />
    </>
  );
});

export const UpcomingCutoffs = memo(function UpcomingCutoffs() {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.03)]">
      <h3 className="text-[18px] font-semibold text-slate-900">Upcoming Cut-offs</h3>
      <p className="mt-1 text-[13.5px] text-slate-500">Deadlines in the next few days.</p>
      <div className="mt-5 space-y-2.5">
        {cutoffs.map((c, idx) => (
          <div
            key={`cutoff-${c.type}-${c.ref}-${idx}`}
            className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-amber-200/80 bg-amber-50 text-amber-600">
              <Timer className="size-[17px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="num text-[12.5px] font-bold text-slate-900">{c.ref}</p>
              <p className="text-[12px] text-slate-500">{c.type}</p>
            </div>
            <div className="text-right">
              <p className="num text-[13.5px] font-bold text-slate-900">
                {c.date} · {c.time}
              </p>
              <p className="text-[11px] font-semibold text-[#0FA3B1]">{c.in}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
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
