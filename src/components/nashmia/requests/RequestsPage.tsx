import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { showPillToast } from "@/lib/pill-toast";
import { useAuth } from "@/lib/auth-context";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import type { FullBookingRecord } from "@/lib/supabase-services";
import {
  fetchBookingRequestsFromSupabase,
  approveBookingRequestInSupabase,
  requestRevisionInSupabase,
  calculateRequestsStats,
  mapBookingRecordToRequest,
} from "@/lib/requests-data";
import { fetchAllForwarderRequestsFromSupabase } from "@/lib/multi-forwarder-service";
import { RequestsHeader } from "./RequestsHeader";
import { RequestsMetrics } from "./RequestsMetrics";
import { RequestsToolbar } from "./RequestsToolbar";
import { RequestsCardGrid } from "./RequestsCardGrid";
import { RequestsTableView } from "./RequestsTableView";
import { RequestsKanbanView } from "./RequestsKanbanView";
import { RequestDetailDrawer } from "./RequestDetailDrawer";
import { ApproveRequestModal } from "./ApproveRequestModal";
import { RevisionRequestModal } from "./RevisionRequestModal";
import { ComposeEmailModal } from "../emails/ComposeEmailModal";
import { MultiForwarderRequestModal } from "./MultiForwarderRequestModal";
import { GroupedQuotationModal } from "./GroupedQuotationModal";
import {
  RequestsMetricsSkeleton,
  RequestsTableSkeleton,
  RequestsCardGridSkeleton,
} from "@/components/nashmia/skeletons/RequestsSkeletons";
import type {
  BookingRequestRecord,
  RequestsFilterState,
  RequestStatus,
  RequestPriority,
} from "@/types/requests";

interface RequestsPageProps {
  onOpenMobileMenu?: () => void;
}

export function RequestsPage({ onOpenMobileMenu }: RequestsPageProps) {
  const { userId, organizationId, isConfigured } = useAuth();
  const queryClient = useQueryClient();

  // Filters & layout state
  const [filters, setFilters] = useState<RequestsFilterState>({
    search: "",
    status: "All",
    priority: "All",
    pol: "",
    pod: "",
    carrier: "",
    dateRange: "all",
    sortBy: "date-desc",
    viewMode: "grid",
  });

  // Selected for batch operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Drawers
  const [activeDetailRequest, setActiveDetailRequest] = useState<BookingRequestRecord | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<BookingRequestRecord | null>(null);
  const [revisingRequest, setRevisingRequest] = useState<BookingRequestRecord | null>(null);
  const [emailingRequest, setEmailingRequest] = useState<BookingRequestRecord | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  // Multi-Forwarder Quote Desk State
  const [multiForwarderBooking, setMultiForwarderBooking] = useState<BookingRequestRecord | null>(
    null,
  );
  const [isMultiForwarderModalOpen, setIsMultiForwarderModalOpen] = useState(false);
  const [viewingQuotationsBooking, setViewingQuotationsBooking] =
    useState<BookingRequestRecord | null>(null);

  // React Query Fetch Booking Requests
  const {
    data: requests = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["booking-requests", userId],
    queryFn: () => fetchBookingRequestsFromSupabase(userId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Supabase Source of Truth: All Forwarder Requests & Current Quotations
  const { data: allForwarderRequests = [] } = useQuery({
    queryKey: ["all-forwarder-requests"],
    queryFn: () => fetchAllForwarderRequestsFromSupabase(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Consolidated Realtime updates subscriptions (multiplexed 1 channel per table, updating cache surgically)
  useSupabaseRealtime("bookings", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("booking_events", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("email_messages", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("notifications", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("forwarder_requests", undefined, isConfigured, { organizationId });
  useSupabaseRealtime("quotations", undefined, isConfigured, { organizationId });

  // Sync with window events from email workflows or other tabs with surgical cache updates
  useEffect(() => {
    const handleUpdate = (e?: Event) => {
      if (e && "detail" in e) {
        const detail = (e as CustomEvent).detail;
        if (detail) {
          const targetRef = (
            detail.bookingReference ||
            detail.reference ||
            detail.movementNumber ||
            detail.bookingId ||
            detail.id ||
            ""
          )
            .trim()
            .toLowerCase();

          const targetMov = (detail.movementNumber || "").trim().toLowerCase();
          const targetBk = (detail.bookingId || detail.id || "").trim().toLowerCase();

          // Handle newly created booking prepending
          if (detail.booking && typeof detail.booking === "object") {
            try {
              const mapped = mapBookingRecordToRequest(detail.booking as FullBookingRecord);
              queryClient.setQueriesData<BookingRequestRecord[]>(
                { queryKey: ["booking-requests"] },
                (prev) => {
                  if (!prev) return [mapped];
                  const exists = prev.some(
                    (r) =>
                      r.id === mapped.id ||
                      (mapped.movementNumber && r.movementNumber === mapped.movementNumber) ||
                      (mapped.reference && r.reference === mapped.reference),
                  );
                  if (exists) return prev;
                  return [mapped, ...prev];
                },
              );
            } catch (err) {
              console.warn("[RequestsPage] Failed to map new booking:", err);
            }
          }

          // Always refresh/sync all-forwarder-requests query cache
          void queryClient.invalidateQueries({ queryKey: ["all-forwarder-requests"] });

          if (targetRef || targetMov || targetBk) {
            queryClient.setQueriesData<BookingRequestRecord[]>(
              { queryKey: ["booking-requests"] },
              (prev) => {
                if (!prev) return prev;
                return prev.map((item) => {
                  const itemRef = (item.reference || "").trim().toLowerCase();
                  const itemMov = (item.movementNumber || "").trim().toLowerCase();
                  const itemBkRef = (item.bookingReference || "").trim().toLowerCase();
                  const itemId = (item.id || "").trim().toLowerCase();

                  const isMatch =
                    (targetRef &&
                      (itemRef === targetRef ||
                        itemMov === targetRef ||
                        itemBkRef === targetRef ||
                        itemId === targetRef)) ||
                    (targetMov &&
                      (itemRef === targetMov ||
                        itemMov === targetMov ||
                        itemBkRef === targetMov ||
                        itemId === targetMov)) ||
                    (targetBk &&
                      (itemRef === targetBk ||
                        itemMov === targetBk ||
                        itemBkRef === targetBk ||
                        itemId === targetBk));

                  if (isMatch) {
                    const eventStatus = (detail.status || "").trim();
                    const isConfirmedEvent =
                      detail.isConfirmed ||
                      eventStatus === "Approved" ||
                      eventStatus === "Booking Confirmed" ||
                      detail.confirmationStatus === "CONFIRMED";

                    const isOfferEvent =
                      eventStatus === "OFFER_RECEIVED" ||
                      eventStatus === "Rate Verification" ||
                      detail.offer ||
                      detail.rate;

                    let mappedStatus = item.status;
                    if (
                      isConfirmedEvent &&
                      (item.status === "Pending Review" ||
                        item.status === "Rate Verification" ||
                        item.status === "Line Allocation")
                    ) {
                      mappedStatus = "Approved";
                    } else if (
                      isOfferEvent &&
                      item.status !== "Approved" &&
                      item.status !== "Booking Confirmed"
                    ) {
                      mappedStatus = "Rate Verification";
                    } else if (
                      eventStatus &&
                      eventStatus !== "Approved" &&
                      eventStatus !== "Booking Confirmed"
                    ) {
                      mappedStatus = eventStatus as RequestStatus;
                    }

                    const newRate =
                      detail.rate ?? detail.offer?.ratePerContainer ?? item.ratePerContainer;

                    const newTotal =
                      detail.total ??
                      detail.offer?.totalFreight ??
                      (newRate ? newRate * (item.containerCount || 1) : item.totalFreight);

                    return {
                      ...item,
                      status: mappedStatus,
                      confirmationStatus:
                        detail.confirmationStatus ||
                        (isConfirmedEvent ? "CONFIRMED" : item.confirmationStatus),
                      confirmedAt:
                        detail.confirmedAt ||
                        item.confirmedAt ||
                        (isConfirmedEvent ? new Date().toISOString() : undefined),
                      confirmedBy:
                        detail.confirmedBy ||
                        detail.forwarderName ||
                        item.confirmedBy ||
                        "Operations Desk",
                      preferredCarrier:
                        detail.carrier ||
                        detail.offer?.carrier ||
                        detail.preferredCarrier ||
                        item.preferredCarrier,
                      vesselName: detail.vesselName || detail.offer?.vesselName || item.vesselName,
                      voyageNumber:
                        detail.voyageNumber || detail.offer?.voyageNumber || item.voyageNumber,
                      ratePerContainer: newRate,
                      totalFreight: newTotal,
                    };
                  }
                  return item;
                });
              },
            );
          }
        }
      }
    };

    window.addEventListener("nashmia_multi_forwarder_updated", handleUpdate);
    window.addEventListener("nashmia_multi_forwarder_dispatched", handleUpdate);
    window.addEventListener("nashmia_forwarder_offer_received", handleUpdate);
    window.addEventListener("nashmia_booking_confirmed", handleUpdate);
    window.addEventListener("nashmia_booking_awarded", handleUpdate);
    window.addEventListener("nashmia_booking_status_updated", handleUpdate);
    window.addEventListener("supabase_realtime_bookings_change", handleUpdate);
    window.addEventListener("nashmia_bookings_updated", handleUpdate);
    window.addEventListener("nashmia_email_matched", handleUpdate);

    return () => {
      window.removeEventListener("nashmia_multi_forwarder_updated", handleUpdate);
      window.removeEventListener("nashmia_multi_forwarder_dispatched", handleUpdate);
      window.removeEventListener("nashmia_forwarder_offer_received", handleUpdate);
      window.removeEventListener("nashmia_booking_confirmed", handleUpdate);
      window.removeEventListener("nashmia_booking_awarded", handleUpdate);
      window.removeEventListener("nashmia_booking_status_updated", handleUpdate);
      window.removeEventListener("supabase_realtime_bookings_change", handleUpdate);
      window.removeEventListener("nashmia_bookings_updated", handleUpdate);
      window.removeEventListener("nashmia_email_matched", handleUpdate);
    };
  }, [queryClient]);

  // Derive reactive active request for drawer to automatically update on confirmation
  const currentActiveDetail = useMemo(() => {
    if (!activeDetailRequest) return null;
    return requests.find((r) => r.id === activeDetailRequest.id) || activeDetailRequest;
  }, [activeDetailRequest, requests]);

  // Filter and Sort requests - Guaranteed exactly ONE main request per booking / Movement Number
  const filteredRequests = useMemo(() => {
    // 1. Enforce strict 1:1 grouping per Movement Number / Booking
    const uniqueGroupMap = new Map<string, BookingRequestRecord>();
    for (const req of requests) {
      const groupKey = (req.movementNumber || req.bookingReference || req.reference || req.id)
        .trim()
        .toUpperCase();

      if (!uniqueGroupMap.has(groupKey)) {
        uniqueGroupMap.set(groupKey, req);
      } else {
        const existing = uniqueGroupMap.get(groupKey)!;
        if (new Date(req.updatedAt).getTime() > new Date(existing.updatedAt).getTime()) {
          uniqueGroupMap.set(groupKey, req);
        }
      }
    }

    return Array.from(uniqueGroupMap.values())
      .filter((req) => {
        // Search filter
        if (filters.search.trim()) {
          const q = filters.search.toLowerCase().trim();
          const matchRef = req.reference.toLowerCase().includes(q);
          const matchBuyer = req.buyerName.toLowerCase().includes(q);
          const matchSupplier = req.supplierName.toLowerCase().includes(q);
          const matchPol =
            req.polCode.toLowerCase().includes(q) || req.polName.toLowerCase().includes(q);
          const matchPod =
            req.podCode.toLowerCase().includes(q) || req.podName.toLowerCase().includes(q);
          const matchCargo = req.cargo.description.toLowerCase().includes(q);
          const matchHs = req.cargo.hsCode?.toLowerCase().includes(q) || false;
          const matchCarrier = req.preferredCarrier.toLowerCase().includes(q);
          if (
            !matchRef &&
            !matchBuyer &&
            !matchSupplier &&
            !matchPol &&
            !matchPod &&
            !matchCargo &&
            !matchHs &&
            !matchCarrier
          ) {
            return false;
          }
        }

        // Status filter
        if (filters.status !== "All" && req.status !== filters.status) {
          return false;
        }

        // Priority filter
        if (filters.priority !== "All" && req.priority !== filters.priority) {
          return false;
        }

        // Carrier filter
        if (
          filters.carrier &&
          !req.preferredCarrier.toLowerCase().includes(filters.carrier.toLowerCase())
        ) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (filters.sortBy === "date-desc") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (filters.sortBy === "date-asc") {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        if (filters.sortBy === "priority-desc") {
          const priorityScore = { Urgent: 4, High: 3, Normal: 2, Flexible: 1 };
          return (priorityScore[b.priority] || 0) - (priorityScore[a.priority] || 0);
        }
        if (filters.sortBy === "rate-desc") {
          return b.totalFreight - a.totalFreight;
        }
        if (filters.sortBy === "buyer-asc") {
          return a.buyerName.localeCompare(b.buyerName);
        }
        return 0;
      });
  }, [requests, filters]);

  // Statistics
  const stats = useMemo(() => calculateRequestsStats(requests), [requests]);

  // Status counts for tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: requests.length };
    for (const r of requests) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }
    return counts;
  }, [requests]);

  // Batch toggle
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }, []);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.length === filteredRequests.length ? [] : filteredRequests.map((r) => r.id),
    );
  }, [filteredRequests]);

  // Filter updates
  const handleFilterChange = useCallback((updates: Partial<RequestsFilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
  }, []);

  // Action Handlers: Optimistic mutation for manual booking approval
  const approveBookingMutation = useMutation({
    mutationFn: async ({
      requestId,
      details,
    }: {
      requestId: string;
      details: {
        forwarderId?: string;
        forwarderName?: string;
        vesselName?: string;
        voyageNumber?: string;
        notes?: string;
        notifyParties?: boolean;
      };
      displayRef?: string;
    }) => {
      return await approveBookingRequestInSupabase(requestId, userId, details);
    },
    onMutate: async ({ requestId, details, displayRef }) => {
      // 1. Cancel any active outgoing refetches so they don't overwrite optimistic data
      await queryClient.cancelQueries({ queryKey: ["booking-requests"] });
      await queryClient.cancelQueries({ queryKey: ["dashboard-bookings"] });
      await queryClient.cancelQueries({ queryKey: ["movements"] });

      // 2. Snapshot previous query states for rollback on failure
      const previousRequests = queryClient.getQueriesData<BookingRequestRecord[]>({
        queryKey: ["booking-requests"],
      });
      const previousDashboard = queryClient.getQueriesData<FullBookingRecord[]>({
        queryKey: ["dashboard-bookings"],
      });

      const confirmedAt = new Date().toISOString();
      const targetIdLower = requestId.trim().toLowerCase();

      // 3. Optimistically update all matching booking-requests queries
      queryClient.setQueriesData<BookingRequestRecord[]>(
        { queryKey: ["booking-requests"] },
        (prev) => {
          if (!prev) return prev;
          return prev.map((item) => {
            const itemRef = (item.reference || "").trim().toLowerCase();
            const itemMov = (item.movementNumber || "").trim().toLowerCase();
            const itemBkRef = (item.bookingReference || "").trim().toLowerCase();
            const itemId = (item.id || "").trim().toLowerCase();

            const isMatch =
              itemId === targetIdLower ||
              itemRef === targetIdLower ||
              itemMov === targetIdLower ||
              itemBkRef === targetIdLower;

            if (isMatch) {
              return {
                ...item,
                status: "Approved",
                confirmationStatus: "CONFIRMED",
                confirmedAt,
                confirmedBy: details.forwarderName || "Operations Desk",
                forwarderId: details.forwarderId || item.forwarderId,
                forwarderName: details.forwarderName || item.forwarderName,
                vesselName: details.vesselName || item.vesselName,
                voyageNumber: details.voyageNumber || item.voyageNumber,
              };
            }
            return item;
          });
        },
      );

      // 4. Optimistically update all dashboard queries
      queryClient.setQueriesData<FullBookingRecord[]>(
        { queryKey: ["dashboard-bookings"] },
        (prev) => {
          if (!prev) return prev;
          return prev.map((b) => {
            const bId = (b.id || "").trim().toLowerCase();
            const bMov = (b.movement_number || "").trim().toLowerCase();
            const bRef = (b.booking_reference || "").trim().toLowerCase();
            const bRefCode = (b.reference || "").trim().toLowerCase();

            const isMatch =
              bId === targetIdLower ||
              bMov === targetIdLower ||
              bRef === targetIdLower ||
              bRefCode === targetIdLower;

            if (isMatch) {
              return {
                ...b,
                status: "Booking Confirmed",
                confirmation_status: "CONFIRMED",
                confirmed_at: confirmedAt,
                confirmed_by: details.forwarderName || "Operations Desk",
                forwarder_id: details.forwarderId || b.forwarder_id,
                forwarder_name: details.forwarderName || b.forwarder_name,
                vessel_name: details.vesselName || b.vessel_name,
                voyage_number: details.voyageNumber || b.voyage_number,
              };
            }
            return b;
          });
        },
      );

      // 5. Dispatch instantaneous UI events for non-query listeners & cross-component sync
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nashmia_booking_confirmed", {
            detail: {
              bookingId: requestId,
              id: requestId,
              status: "Booking Confirmed",
              confirmationStatus: "CONFIRMED",
              isConfirmed: true,
              confirmedAt,
              confirmedBy: "Operations Desk",
              vesselName: details.vesselName,
              voyageNumber: details.voyageNumber,
            },
          }),
        );
        window.dispatchEvent(new CustomEvent("nashmia_bookings_updated"));
        window.dispatchEvent(new CustomEvent("supabase_realtime_bookings_change"));
      }

      return { previousRequests, previousDashboard, displayRef };
    },
    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousRequests) {
        context.previousRequests.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDashboard) {
        context.previousDashboard.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      showPillToast.error(
        err instanceof Error ? err.message : "Please try again.",
        "Failed to approve request",
      );
    },
    onSuccess: (_data, variables, context) => {
      const displayRef = context?.displayRef || variables.requestId;
      showPillToast.success(
        `Booking ${displayRef} is now confirmed. Equipment and space allocated.`,
        "Booking Request Approved",
        displayRef,
      );
    },
    onSettled: () => {
      // Targeted UI refresh via TanStack Query cache invalidations
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      void queryClient.invalidateQueries({ queryKey: ["movements"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-events"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("nashmia_bookings_updated"));
        window.dispatchEvent(new CustomEvent("supabase_realtime_bookings_change"));
      }
    },
  });

  const handleConfirmApproval = async (
    requestId: string,
    details: {
      forwarderId?: string;
      forwarderName?: string;
      vesselName?: string;
      voyageNumber?: string;
      notes?: string;
      notifyParties?: boolean;
    },
  ) => {
    const displayRef = approvingRequest?.reference || approvingRequest?.movementNumber || requestId;
    await approveBookingMutation.mutateAsync({
      requestId,
      details,
      displayRef,
    });
  };

  const handleConfirmRevision = async (requestId: string, revisionNotes: string) => {
    try {
      await requestRevisionInSupabase(requestId, userId, revisionNotes);
      showPillToast.info(
        "Shipper has been notified with revision instructions.",
        "Revision Request Dispatched",
      );
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    } catch (err: unknown) {
      showPillToast.error(
        err instanceof Error ? err.message : "Please try again.",
        "Failed to submit revision",
      );
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (filteredRequests.length === 0) {
      showPillToast.error("No requests to export", "Notice");
      return;
    }

    const headers = [
      "Reference",
      "Priority",
      "Status",
      "Shipper",
      "Consignee",
      "POL",
      "POD",
      "ETD",
      "Equipment",
      "Weight_Kg",
      "Carrier",
      "Rate_USD",
    ];

    const rows = filteredRequests.map((r) => [
      r.reference,
      r.priority,
      r.status,
      `"${r.supplierName}"`,
      `"${r.buyerName}"`,
      r.polCode,
      r.podCode,
      r.requestedEtd,
      `"${r.containerCount}x ${r.containerSize}"`,
      r.cargo.totalWeightKg,
      r.preferredCarrier,
      r.totalFreight,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Nashmia_Booking_Requests_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showPillToast.build(
      `Downloaded ${filteredRequests.length} booking request records.`,
      "CSV Export Generated",
    );
  };

  const handleOpenMultiForwarder = (req?: BookingRequestRecord) => {
    const target = req || currentActiveDetail || filteredRequests[0] || null;
    if (!target) {
      showPillToast.error(
        "Please select a booking request first to dispatch quote requests.",
        "Notice",
      );
      return;
    }
    setMultiForwarderBooking(target);
    setIsMultiForwarderModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <RequestsHeader
        onOpenMobileMenu={onOpenMobileMenu}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
        onExportCsv={handleExportCsv}
        onOpenMultiForwarderModal={() => handleOpenMultiForwarder()}
        totalRequests={stats.total}
        pendingCount={stats.pendingReview}
      />

      {/* KPI Metrics */}
      {isLoading && requests.length === 0 ? (
        <RequestsMetricsSkeleton />
      ) : (
        <RequestsMetrics
          stats={stats}
          activeStatusFilter={filters.status}
          onFilterStatus={(status) => {
            if (status === "Urgent") {
              setFilters((prev) => ({ ...prev, priority: "Urgent", status: "All" }));
            } else {
              setFilters((prev) => ({
                ...prev,
                status: status as RequestStatus | "All",
                priority: "All",
              }));
            }
          }}
        />
      )}

      {/* Filter & View Toolbar */}
      <RequestsToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        statusCounts={statusCounts}
        totalFiltered={filteredRequests.length}
      />

      {/* Main Content: Booking Requests (Grid / Table / Kanban) */}
      {isLoading && requests.length === 0 ? (
        filters.viewMode === "table" ? (
          <RequestsTableSkeleton rows={7} />
        ) : (
          <RequestsCardGridSkeleton count={6} />
        )
      ) : (
        <>
          {filters.viewMode === "grid" && (
            <RequestsCardGrid
              requests={filteredRequests}
              forwarderRequests={allForwarderRequests}
              onSelectRequest={(req) => setActiveDetailRequest(req)}
              onApproveRequest={(req) => setApprovingRequest(req)}
              onRequestRevision={(req) => setRevisingRequest(req)}
              onRequestQuotes={(req) => handleOpenMultiForwarder(req)}
              onViewQuotations={(req) => setViewingQuotationsBooking(req)}
              onComposeEmail={(req) => {
                setEmailingRequest(req);
                setIsEmailModalOpen(true);
              }}
            />
          )}

          {filters.viewMode === "table" && (
            <RequestsTableView
              requests={filteredRequests}
              forwarderRequests={allForwarderRequests}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onSelectRequest={(req) => setActiveDetailRequest(req)}
              onApproveRequest={(req) => setApprovingRequest(req)}
              onRequestRevision={(req) => setRevisingRequest(req)}
              onRequestQuotes={(req) => handleOpenMultiForwarder(req)}
              onViewQuotations={(req) => setViewingQuotationsBooking(req)}
              onComposeEmail={(req) => {
                setEmailingRequest(req);
                setIsEmailModalOpen(true);
              }}
            />
          )}

          {filters.viewMode === "kanban" && (
            <RequestsKanbanView
              requests={filteredRequests}
              onSelectRequest={(req) => setActiveDetailRequest(req)}
              onApproveRequest={(req) => setApprovingRequest(req)}
              onRequestRevision={(req) => setRevisingRequest(req)}
            />
          )}
        </>
      )}

      {/* Detail Drawer */}
      <RequestDetailDrawer
        request={currentActiveDetail}
        isOpen={Boolean(currentActiveDetail)}
        onClose={() => setActiveDetailRequest(null)}
        onApprove={(req) => {
          setActiveDetailRequest(null);
          setApprovingRequest(req);
        }}
        onRequestRevision={(req) => {
          setActiveDetailRequest(null);
          setRevisingRequest(req);
        }}
        onRequestQuotes={(req) => handleOpenMultiForwarder(req)}
        onComposeEmail={(req) => {
          setEmailingRequest(req);
          setIsEmailModalOpen(true);
        }}
      />

      {/* Approve Modal */}
      <ApproveRequestModal
        request={approvingRequest}
        isOpen={Boolean(approvingRequest)}
        onClose={() => setApprovingRequest(null)}
        onConfirm={handleConfirmApproval}
      />

      {/* Revision Request Modal */}
      <RevisionRequestModal
        request={revisingRequest}
        isOpen={Boolean(revisingRequest)}
        onClose={() => setRevisingRequest(null)}
        onConfirm={handleConfirmRevision}
      />

      {/* Multi-Forwarder Request Modal */}
      {isMultiForwarderModalOpen && (
        <MultiForwarderRequestModal
          booking={multiForwarderBooking}
          isOpen={isMultiForwarderModalOpen}
          onClose={() => {
            setIsMultiForwarderModalOpen(false);
            setMultiForwarderBooking(null);
          }}
          onDispatched={() => {
            void refetch();
            void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
          }}
        />
      )}

      {/* Grouped Quotation Comparison Modal */}
      {viewingQuotationsBooking && (
        <GroupedQuotationModal
          booking={viewingQuotationsBooking}
          isOpen={Boolean(viewingQuotationsBooking)}
          onClose={() => setViewingQuotationsBooking(null)}
          onRequestMoreQuotes={(req) => {
            setViewingQuotationsBooking(null);
            handleOpenMultiForwarder(req);
          }}
        />
      )}

      {/* Email Compose Modal */}
      {isEmailModalOpen && (
        <ComposeEmailModal
          isOpen={isEmailModalOpen}
          onClose={() => {
            setIsEmailModalOpen(false);
            setEmailingRequest(null);
          }}
          defaultRecipientEmail={emailingRequest?.requestedBy.email}
          defaultSubject={
            emailingRequest
              ? `Booking Request Update: ${emailingRequest.reference} | ${emailingRequest.polCode} → ${emailingRequest.podCode}`
              : ""
          }
        />
      )}
    </div>
  );
}
