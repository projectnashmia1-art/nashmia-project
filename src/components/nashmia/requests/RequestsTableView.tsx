import { memo } from "react";
import {
  Ship,
  CheckCircle2,
  FileEdit,
  Mail,
  ChevronRight,
  Clock,
  MoreHorizontal,
  Users,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BookingRequestRecord } from "@/types/requests";

interface RequestsTableViewProps {
  requests: BookingRequestRecord[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelectRequest: (request: BookingRequestRecord) => void;
  onApproveRequest: (request: BookingRequestRecord) => void;
  onRequestRevision: (request: BookingRequestRecord) => void;
  onComposeEmail?: (request: BookingRequestRecord) => void;
  onRequestQuotes?: (request: BookingRequestRecord) => void;
  onCompareForwarderOffers?: (request: BookingRequestRecord) => void;
}

export const RequestsTableView = memo(function RequestsTableView({
  requests,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onSelectRequest,
  onApproveRequest,
  onRequestRevision,
  onComposeEmail,
  onRequestQuotes,
  onCompareForwarderOffers,
}: RequestsTableViewProps) {
  const isAllSelected = requests.length > 0 && selectedIds.length === requests.length;

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
        <p className="text-[14px] font-medium text-slate-500">
          No requests match current table filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
                  aria-label="Select all requests"
                />
              </th>
              <th className="px-4 py-3">Reference / Priority</th>
              <th className="px-4 py-3">Shipper & Consignee</th>
              <th className="px-4 py-3">Route (POL → POD)</th>
              <th className="px-4 py-3">Equipment & Cargo</th>
              <th className="px-4 py-3">Carrier / Vessel</th>
              <th className="px-4 py-3 text-right">Freight Rate</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {requests.map((req) => {
              const isSelected = selectedIds.includes(req.id);

              return (
                <tr
                  key={req.id}
                  className={`transition-colors hover:bg-slate-50/80 ${
                    isSelected ? "bg-[#F0F9FA]" : ""
                  }`}
                >
                  {/* Select Checkbox */}
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(req.id)}
                      className="rounded border-slate-300 text-[#0FA3B1] focus:ring-[#0FA3B1]"
                      aria-label={`Select request ${req.reference}`}
                    />
                  </td>

                  {/* Ref & Priority */}
                  <td className="px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => onSelectRequest(req)}
                      className="text-left font-mono font-bold text-[#0FA3B1] hover:underline"
                    >
                      {req.reference}
                    </button>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.2 text-[10px] font-bold uppercase ${
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
                  </td>

                  {/* Shipper & Consignee */}
                  <td className="px-4 py-3.5 max-w-[200px]">
                    <p className="font-semibold text-slate-900 line-clamp-1">{req.supplierName}</p>
                    <p className="text-[11.5px] text-slate-500 line-clamp-1">→ {req.buyerName}</p>
                  </td>

                  {/* Route */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <span>{req.polCode}</span>
                      <span className="text-slate-400">→</span>
                      <span>{req.podCode}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">ETD {req.requestedEtd}</p>
                  </td>

                  {/* Equipment & Cargo */}
                  <td className="px-4 py-3.5 max-w-[200px]">
                    <p className="font-medium text-slate-800">
                      {req.containerCount}x {req.containerSize}
                    </p>
                    <p className="text-[11.5px] text-slate-500 line-clamp-1">
                      {req.cargo.description}
                    </p>
                  </td>

                  {/* Carrier */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-800">
                      {req.preferredCarrier}
                    </span>
                    {req.vesselName && (
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500 line-clamp-1">
                        {req.vesselName}
                      </p>
                    )}
                  </td>

                  {/* Rate */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <span className="font-bold text-slate-900">
                      ${req.totalFreight.toLocaleString()}
                    </span>
                    <p className="text-[11px] text-slate-500">${req.ratePerContainer}/cntr</p>
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
                        req.status === "Approved" || req.confirmationStatus === "CONFIRMED"
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          : req.status === "Pending Review"
                            ? "border border-amber-200 bg-amber-50 text-amber-800"
                            : req.status === "Revision Requested"
                              ? "border border-rose-200 bg-rose-50 text-rose-800"
                              : "border border-indigo-200 bg-indigo-50 text-indigo-800"
                      }`}
                    >
                      {req.status === "Approved" || req.confirmationStatus === "CONFIRMED" ? (
                        <>
                          <CheckCircle2 className="size-3 text-emerald-600" />
                          CONFIRMED
                        </>
                      ) : (
                        req.status
                      )}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {req.status !== "Approved" && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onApproveRequest(req)}
                          className="h-7.5 bg-[#0FA3B1] px-2.5 text-[11.5px] font-semibold text-white hover:bg-[#0D919E]"
                        >
                          <CheckCircle2 className="mr-1 size-3" />
                          Approve
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectRequest(req)}
                        className="h-7.5 border-slate-200 px-2 text-[11.5px] text-slate-700 hover:bg-slate-50"
                      >
                        Details
                      </Button>

                      {onCompareForwarderOffers && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onCompareForwarderOffers(req)}
                          className="h-7.5 border-teal-200 bg-[#E8F5F6]/40 text-[#0FA3B1] hover:bg-[#E8F5F6] px-2 text-[11.5px] font-medium gap-1"
                          title="Compare all forwarder offers for this booking"
                        >
                          <Scale className="size-3" />
                          Compare
                        </Button>
                      )}

                      {onRequestQuotes && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onRequestQuotes(req)}
                          className="h-7.5 border-[#0FA3B1]/30 bg-[#E8F5F6]/30 text-[#0FA3B1] hover:bg-[#E8F5F6] px-2 text-[11.5px] font-medium gap-1"
                          title="Multi-Forwarder Quote Request"
                        >
                          <Users className="size-3" />
                          Quotes
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
