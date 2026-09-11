import { memo } from "react";
import {
  Clock,
  Receipt,
  Container,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Ship,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingRequestRecord, RequestStatus } from "@/types/requests";

interface RequestsKanbanViewProps {
  requests: BookingRequestRecord[];
  onSelectRequest: (request: BookingRequestRecord) => void;
  onApproveRequest: (request: BookingRequestRecord) => void;
  onRequestRevision: (request: BookingRequestRecord) => void;
}

interface KanbanColumn {
  id: RequestStatus;
  title: string;
  subtitle: string;
  icon: typeof Clock;
  headerColor: string;
  badgeBg: string;
}

const COLUMNS: KanbanColumn[] = [
  {
    id: "Pending Review",
    title: "Pending Review",
    subtitle: "Awaiting ops dispatch check",
    icon: Clock,
    headerColor: "text-amber-700 bg-amber-50/80 border-amber-200",
    badgeBg: "bg-amber-100 text-amber-800",
  },
  {
    id: "Rate Verification",
    title: "Rate Verification",
    subtitle: "Checking contract & spot quotes",
    icon: Receipt,
    headerColor: "text-indigo-700 bg-indigo-50/80 border-indigo-200",
    badgeBg: "bg-indigo-100 text-indigo-800",
  },
  {
    id: "Line Allocation",
    title: "Line Allocation",
    subtitle: "Carrier space & equipment",
    icon: Container,
    headerColor: "text-cyan-700 bg-cyan-50/80 border-cyan-200",
    badgeBg: "bg-cyan-100 text-cyan-800",
  },
  {
    id: "Approved",
    title: "Approved & Confirmed",
    subtitle: "Booking order released",
    icon: CheckCircle2,
    headerColor: "text-emerald-700 bg-emerald-50/80 border-emerald-200",
    badgeBg: "bg-emerald-100 text-emerald-800",
  },
  {
    id: "Revision Requested",
    title: "Needs Revision",
    subtitle: "Awaiting shipper updates",
    icon: AlertTriangle,
    headerColor: "text-rose-700 bg-rose-50/80 border-rose-200",
    badgeBg: "bg-rose-100 text-rose-800",
  },
];

export const RequestsKanbanView = memo(function RequestsKanbanView({
  requests,
  onSelectRequest,
  onApproveRequest,
  onRequestRevision,
}: RequestsKanbanViewProps) {
  return (
    <div className="grid grid-cols-1 gap-4 overflow-x-auto pb-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {COLUMNS.map((col) => {
        const colRequests = requests.filter((r) => r.status === col.id);
        const Icon = col.icon;

        return (
          <div
            key={col.id}
            className="flex flex-col rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 shadow-xs"
          >
            {/* Column Header */}
            <div
              className={`flex items-center justify-between rounded-xl border p-2.5 ${col.headerColor}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="size-4" />
                <span className="text-[13px] font-bold">{col.title}</span>
              </div>
              <span className={`rounded-full px-2 py-0.2 text-[11px] font-bold ${col.badgeBg}`}>
                {colRequests.length}
              </span>
            </div>

            {/* Cards List */}
            <div className="mt-3 flex flex-1 flex-col gap-2.5">
              {colRequests.length === 0 ? (
                <div className="grid flex-1 place-items-center rounded-xl border border-dashed border-slate-200 p-6 text-center text-[12px] text-slate-400">
                  No requests in this stage
                </div>
              ) : (
                colRequests.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => onSelectRequest(req)}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs transition-all hover:border-[#0FA3B1] hover:shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-mono text-[12px] font-bold text-slate-900">
                        {req.reference}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase ${
                          req.priority === "Urgent"
                            ? "bg-rose-100 text-rose-800"
                            : req.priority === "High"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {req.priority}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[12.5px] font-semibold text-slate-800 line-clamp-1">
                      {req.buyerName}
                    </p>
                    <p className="text-[11px] text-slate-500 line-clamp-1">
                      From: {req.supplierName}
                    </p>

                    {/* Route */}
                    <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1 text-[11.5px] font-medium text-slate-700">
                      <span>{req.polCode}</span>
                      <ArrowRight className="size-3 text-slate-400" />
                      <span>{req.podCode}</span>
                    </div>

                    {/* Footer specs */}
                    <div className="mt-2.5 flex items-center justify-between text-[11.5px]">
                      <span className="font-medium text-slate-600">
                        {req.containerCount}x {req.containerSize}
                      </span>
                      <span className="font-bold text-slate-900">
                        ${req.totalFreight.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});
