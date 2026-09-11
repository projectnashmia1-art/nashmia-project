import { memo } from "react";
import {
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Scale,
  TrendingUp,
  Boxes,
} from "lucide-react";
import type { RequestsStatsSummary } from "@/types/requests";

interface RequestsMetricsProps {
  stats: RequestsStatsSummary;
  onFilterStatus?: (status: string) => void;
  activeStatusFilter?: string;
}

export const RequestsMetrics = memo(function RequestsMetrics({
  stats,
  onFilterStatus,
  activeStatusFilter = "All",
}: RequestsMetricsProps) {
  const cards = [
    {
      id: "total",
      label: "Total Requests",
      value: stats.total,
      sublabel: `${stats.totalCargoTons} metric tons total`,
      icon: Boxes,
      iconColor: "text-slate-700",
      iconBg: "bg-slate-100 border-slate-200",
      statusKey: "All",
      trend: stats.total > 0 ? `${stats.total} live bookings` : "No requests",
      trendColor: "text-slate-700 bg-slate-100",
    },
    {
      id: "pending",
      label: "Pending Review",
      value: stats.pendingReview,
      sublabel: "Awaiting forwarder confirmation",
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-50 border-amber-200",
      statusKey: "Pending Review",
      highlight: stats.pendingReview > 0,
      trend: stats.pendingReview > 0 ? `Turnaround ~${stats.avgTurnaroundHours}` : "Queue clear",
      trendColor: "text-amber-700 bg-amber-50",
    },
    {
      id: "rate",
      label: "Rate Verification",
      value: stats.rateVerification,
      sublabel: "Carrier spot rate check",
      icon: Receipt,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-50 border-indigo-200",
      statusKey: "Rate Verification",
      trend: `${stats.rateVerification} spot checks`,
      trendColor: "text-indigo-700 bg-indigo-50",
    },
    {
      id: "urgent",
      label: "Urgent Cut-Offs",
      value: stats.urgentCutoffs,
      sublabel: "Gate closing within 48 hrs",
      icon: AlertTriangle,
      iconColor: "text-rose-600",
      iconBg: "bg-rose-50 border-rose-200",
      statusKey: "Urgent",
      highlight: stats.urgentCutoffs > 0,
      trend: stats.urgentCutoffs > 0 ? `${stats.urgentCutoffs} critical cut-offs` : "All on track",
      trendColor: "text-rose-700 bg-rose-50",
    },
    {
      id: "approved",
      label: "Approved & Confirmed",
      value: stats.approved,
      sublabel: `$${stats.totalValueUsd.toLocaleString()} freight value`,
      icon: CheckCircle2,
      iconColor: "text-[#0FA3B1]",
      iconBg: "bg-[#E8F5F6] border-[#C7E8E8]",
      statusKey: "Approved",
      trend: `${stats.approved} confirmed`,
      trendColor: "text-[#0FA3B1] bg-[#E8F5F6]",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected =
          card.statusKey === activeStatusFilter ||
          (card.id === "urgent" && activeStatusFilter === "Urgent");

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onFilterStatus?.(card.statusKey)}
            className={`group flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200 ${
              isSelected
                ? "border-[#0FA3B1] bg-[#F4FBFC] shadow-sm ring-1 ring-[#0FA3B1]/40"
                : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 hover:shadow-sm"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] font-semibold text-slate-600">{card.label}</span>
              <span
                className={`grid size-8 place-items-center rounded-xl border ${card.iconBg} ${card.iconColor} transition-transform group-hover:scale-105`}
              >
                <Icon className="size-4" />
              </span>
            </div>

            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[26px] font-bold tracking-tight text-slate-900">
                  {card.value}
                </span>
                {card.highlight && (
                  <span className="size-2 animate-ping rounded-full bg-amber-500" />
                )}
              </div>
              <p className="mt-1 line-clamp-1 text-[11.5px] text-slate-500">{card.sublabel}</p>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-100">
              <span
                className={`inline-block rounded-md px-2 py-0.5 text-[10.5px] font-medium ${card.trendColor}`}
              >
                {card.trend}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
});
