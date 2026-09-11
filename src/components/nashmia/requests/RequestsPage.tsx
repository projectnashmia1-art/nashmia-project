import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import {
  fetchBookingRequestsFromSupabase,
  approveBookingRequestInSupabase,
  requestRevisionInSupabase,
  calculateRequestsStats,
} from "@/lib/requests-data";
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
import { RecordOfferModal } from "./RecordOfferModal";
import { ForwarderOfferCardsGrid } from "./ForwarderOfferCardsGrid";
import { ForwarderOfferDetailModal } from "./ForwarderOfferDetailModal";
import { MultipleForwarderComparisonModal } from "./MultipleForwarderComparisonModal";
import { AwardConfirmationModal } from "./AwardConfirmationModal";
import {
  fetchForwarderOfferCardsFromSupabase,
  awardForwarderOfferCard,
  type ForwarderOfferCardItem,
} from "@/lib/forwarder-card-service";
import type {
  BookingRequestRecord,
  ForwarderQuoteRequestRecord,
  RequestsFilterState,
  RequestStatus,
  RequestPriority,
} from "@/types/requests";

interface RequestsPageProps {
  onOpenMobileMenu?: () => void;
}

export function RequestsPage({ onOpenMobileMenu }: RequestsPageProps) {
  const { userId, isConfigured } = useAuth();
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
  const [recordingOfferRequest, setRecordingOfferRequest] =
    useState<ForwarderQuoteRequestRecord | null>(null);

  // Forwarder Offer Card State (Dynamic cards from Supabase)
  const [detailOfferCard, setDetailOfferCard] = useState<ForwarderOfferCardItem | null>(null);
  const [awardConfirmationCard, setAwardConfirmationCard] = useState<ForwarderOfferCardItem | null>(
    null,
  );
  const [awardingCardId, setAwardingCardId] = useState<string | null>(null);

  // Multiple Forwarder Comparison Modal State
  const [comparingBooking, setComparingBooking] = useState<BookingRequestRecord | null>(null);
  const [isComparingModalOpen, setIsComparingModalOpen] = useState(false);

  // React Query Fetch Booking Requests
  const {
    data: requests = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["booking-requests", userId],
    queryFn: () => fetchBookingRequestsFromSupabase(userId),
    staleTime: 30_000,
  });

  // React Query Fetch Forwarder Offers dynamically from Supabase
  const {
    data: forwarderCards = [],
    isLoading: isLoadingForwarderCards,
    refetch: refetchForwarderCards,
  } = useQuery({
    queryKey: ["forwarder-offer-cards", userId],
    queryFn: () => fetchForwarderOfferCardsFromSupabase(userId),
    staleTime: 15_000,
  });

  // Cross-component and multi-forwarder event listener
  useEffect(() => {
    const handleDataChange = () => {
      void refetch();
      void refetchForwarderCards();
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["forwarder-offer-cards"] });
    };

    window.addEventListener("nashmia_multi_forwarder_updated", handleDataChange);
    window.addEventListener("nashmia_multi_forwarder_dispatched", handleDataChange);
    window.addEventListener("nashmia_forwarder_offer_received", handleDataChange);
    window.addEventListener("nashmia_booking_confirmed", handleDataChange);
    window.addEventListener("nashmia_booking_awarded", handleDataChange);

    return () => {
      window.removeEventListener("nashmia_multi_forwarder_updated", handleDataChange);
      window.removeEventListener("nashmia_multi_forwarder_dispatched", handleDataChange);
      window.removeEventListener("nashmia_forwarder_offer_received", handleDataChange);
      window.removeEventListener("nashmia_booking_confirmed", handleDataChange);
      window.removeEventListener("nashmia_booking_awarded", handleDataChange);
    };
  }, [refetch, refetchForwarderCards, queryClient]);

  // Realtime updates subscription for forwarder offers in Supabase
  useSupabaseRealtime(
    "forwarder_offers",
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["forwarder-offer-cards"] });
      void refetchForwarderCards();
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void refetch();
    }, [queryClient, refetchForwarderCards, refetch]),
    isConfigured,
  );

  // Realtime updates subscription
  useSupabaseRealtime(
    "bookings",
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    }, [queryClient]),
    isConfigured,
  );

  useSupabaseRealtime(
    "booking_events",
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void refetch();
    }, [queryClient, refetch]),
    isConfigured,
  );

  useSupabaseRealtime(
    "email_confirmations",
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void refetch();
    }, [queryClient, refetch]),
    isConfigured,
  );

  useSupabaseRealtime(
    "email_messages",
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ["forwarder-offer-cards"] });
      void refetchForwarderCards();
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
      void refetch();
    }, [queryClient, refetchForwarderCards, refetch]),
    isConfigured,
  );

  // Sync with window events from email workflows or other tabs
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
                    return {
                      ...item,
                      status: "Approved",
                      confirmationStatus: "CONFIRMED",
                      confirmedAt: detail.confirmedAt || new Date().toISOString(),
                      confirmedBy:
                        detail.confirmedBy || detail.forwarderName || "Awarded Forwarder",
                      preferredCarrier: detail.carrier || item.preferredCarrier,
                      vesselName: detail.vesselName || item.vesselName,
                      ratePerContainer: detail.rate || item.ratePerContainer,
                      totalFreight: detail.total || item.totalFreight,
                    };
                  }
                  return item;
                });
              },
            );
          }
        }
      }
      let debounceTimer: ReturnType<typeof setTimeout> | null = null;
      const debouncedRefresh = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
          void queryClient.invalidateQueries({ queryKey: ["forwarder-offer-cards"] });
          void refetch();
          void refetchForwarderCards();
        }, 150);
      };
      debouncedRefresh();
    };

    window.addEventListener("nashmia_booking_confirmed", handleUpdate);
    window.addEventListener("nashmia_booking_awarded", handleUpdate);
    window.addEventListener("nashmia_booking_status_updated", handleUpdate);
    window.addEventListener("supabase_realtime_bookings_change", handleUpdate);
    window.addEventListener("nashmia_bookings_updated", handleUpdate);
    window.addEventListener("nashmia_email_matched", handleUpdate);
    window.addEventListener("nashmia:email-sent", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("nashmia_booking_confirmed", handleUpdate);
      window.removeEventListener("nashmia_booking_awarded", handleUpdate);
      window.removeEventListener("nashmia_booking_status_updated", handleUpdate);
      window.removeEventListener("supabase_realtime_bookings_change", handleUpdate);
      window.removeEventListener("nashmia_bookings_updated", handleUpdate);
      window.removeEventListener("nashmia_email_matched", handleUpdate);
      window.removeEventListener("nashmia:email-sent", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [queryClient, refetch, refetchForwarderCards]);

  // Derive reactive active request for drawer to automatically update on confirmation
  const currentActiveDetail = useMemo(() => {
    if (!activeDetailRequest) return null;
    return requests.find((r) => r.id === activeDetailRequest.id) || activeDetailRequest;
  }, [activeDetailRequest, requests]);

  // Filter and Sort requests
  const filteredRequests = useMemo(() => {
    return requests
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

  // Action Handlers
  const handleConfirmApproval = async (
    requestId: string,
    details: {
      vesselName?: string;
      voyageNumber?: string;
      notes?: string;
      notifyParties?: boolean;
    },
  ) => {
    try {
      await approveBookingRequestInSupabase(requestId, userId, details);
      toast.success("Booking Request Approved", {
        description: `Booking ${requestId} is now confirmed. Equipment and space allocated.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    } catch (err: unknown) {
      toast.error("Failed to approve request", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  const handleConfirmRevision = async (requestId: string, revisionNotes: string) => {
    try {
      await requestRevisionInSupabase(requestId, userId, revisionNotes);
      toast.info("Revision Request Dispatched", {
        description: `Shipper has been notified with revision instructions.`,
      });
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    } catch (err: unknown) {
      toast.error("Failed to submit revision", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    }
  };

  // Trigger Award Confirmation Modal with forwarder offer details
  const handleAwardForwarderCard = (card: ForwarderOfferCardItem) => {
    setAwardConfirmationCard(card);
  };

  // Explicit confirmation execution after user clicks Confirm Award in modal
  const handleConfirmAwardCard = async (
    card: ForwarderOfferCardItem,
    options?: { confirmImmediatelyIfExplicit?: boolean; confirmationNotes?: string },
  ) => {
    setAwardingCardId(card.id);
    try {
      // Optimistic update for immediate visual feedback on All Requests
      const targetMov = (card.movementNumber || "").trim().toLowerCase();
      const targetBk = (card.bookingId || "").trim().toLowerCase();
      const targetRef = (card.movementNumber || card.bookingId || "").trim().toLowerCase();

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
              return {
                ...item,
                status: "Approved",
                confirmationStatus: "CONFIRMED",
                confirmedAt: new Date().toISOString(),
                confirmedBy: card.forwarderName || "Awarded Forwarder",
                preferredCarrier: card.carrier || item.preferredCarrier,
                vesselName: card.vesselName || item.vesselName,
                ratePerContainer: card.ratePerContainer || item.ratePerContainer,
                totalFreight: card.totalFreight || item.totalFreight,
              };
            }
            return item;
          });
        },
      );

      const res = await awardForwarderOfferCard(card, userId, options);
      toast.success("Offer Awarded & Request Confirmed!", {
        description: `Booking request ${card.movementNumber || card.bookingId || ""} is now officially Approved & Confirmed with ${card.forwarderName}.`,
      });
      setAwardConfirmationCard(null);
      void refetchForwarderCards();
      void refetch();
      void queryClient.invalidateQueries({ queryKey: ["forwarder-offer-cards"] });
      void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
    } catch (err: unknown) {
      toast.error("Failed to award booking", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setAwardingCardId(null);
    }
  };

  // CSV Export
  const handleExportCsv = () => {
    if (filteredRequests.length === 0) {
      toast.error("No requests to export");
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

    toast.success("CSV Export Generated", {
      description: `Downloaded ${filteredRequests.length} booking request records.`,
    });
  };

  const handleOpenMultiForwarder = (req?: BookingRequestRecord) => {
    const target = req || currentActiveDetail || filteredRequests[0] || null;
    if (!target) {
      toast.error("Please select a booking request first to dispatch quote requests.");
      return;
    }
    setMultiForwarderBooking(target);
    setIsMultiForwarderModalOpen(true);
  };

  const handleOpenComparison = useCallback(
    (bookingOrIdentifier?: BookingRequestRecord | string) => {
      if (!bookingOrIdentifier) {
        setComparingBooking(requests[0] || null);
        setIsComparingModalOpen(true);
        return;
      }

      if (typeof bookingOrIdentifier === "string") {
        const found = requests.find(
          (r) =>
            r.id === bookingOrIdentifier ||
            r.reference === bookingOrIdentifier ||
            r.movementNumber === bookingOrIdentifier,
        );
        if (found) {
          setComparingBooking(found);
        } else {
          // Construct minimal booking context from matching forwarder offer card
          const matchingOffers = forwarderCards.filter(
            (c) => c.movementNumber === bookingOrIdentifier || c.bookingId === bookingOrIdentifier,
          );
          if (matchingOffers.length > 0) {
            const first = matchingOffers[0];
            setComparingBooking({
              id: first.bookingId || `booking-${first.movementNumber}`,
              reference: first.movementNumber,
              movementNumber: first.movementNumber,
              buyerName: "Global Buyer / Consignee",
              supplierName: "Verified Supplier",
              cargoDescription: first.containerType || "General Cargo",
              containerType: first.containerSize || "40HC",
              containerCount: first.containerCount || 1,
              polCode: first.polCode || "PKBQM",
              podCode: first.podCode || "USLAX",
              etd: first.etd || new Date().toISOString(),
              eta: first.eta || new Date().toISOString(),
              status: "Pending Review",
              priority: "Medium",
              requestedBy: { name: "Logistics Team", email: "logistics@example.com" },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as BookingRequestRecord);
          } else {
            setComparingBooking(requests[0] || null);
          }
        }
      } else {
        setComparingBooking(bookingOrIdentifier);
      }
      setIsComparingModalOpen(true);
    },
    [requests, forwarderCards],
  );

  // Filter offers for the comparison modal
  const comparisonOffers = useMemo(() => {
    if (!comparingBooking) return forwarderCards;
    const bookingId = comparingBooking.id;
    const movement = comparingBooking.movementNumber || comparingBooking.reference;
    const filtered = forwarderCards.filter(
      (card) =>
        (card.bookingId && card.bookingId === bookingId) ||
        (movement && card.movementNumber === movement) ||
        (comparingBooking.reference && card.movementNumber === comparingBooking.reference),
    );
    return filtered.length > 0 ? filtered : forwarderCards;
  }, [comparingBooking, forwarderCards]);

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

      {/* Filter & View Toolbar */}
      <RequestsToolbar
        filters={filters}
        onFilterChange={handleFilterChange}
        statusCounts={statusCounts}
        totalFiltered={
          filters.status === "Forwarder Offers" ? forwarderCards.length : filteredRequests.length
        }
        forwarderOffersCount={forwarderCards.length}
      />

      {/* Main Content: Forwarder Offers OR Booking Requests (Grid / Table / Kanban) */}
      {filters.status === "Forwarder Offers" ? (
        <ForwarderOfferCardsGrid
          cards={forwarderCards}
          isLoading={isLoadingForwarderCards}
          onViewDetails={(card) => setDetailOfferCard(card)}
          onAward={handleAwardForwarderCard}
          onCompare={(card) => handleOpenComparison(card.movementNumber || card.bookingId)}
          onCompareBooking={(movement) => handleOpenComparison(movement)}
          onRequestQuotes={() => handleOpenMultiForwarder()}
          onRefresh={() => void refetchForwarderCards()}
          awardingCardId={awardingCardId}
        />
      ) : (
        <>
          {filters.viewMode === "grid" && (
            <RequestsCardGrid
              requests={filteredRequests}
              forwarderCards={forwarderCards}
              onSelectRequest={(req) => setActiveDetailRequest(req)}
              onApproveRequest={(req) => setApprovingRequest(req)}
              onRequestRevision={(req) => setRevisingRequest(req)}
              onRequestQuotes={(req) => handleOpenMultiForwarder(req)}
              onCompareForwarderOffers={handleOpenComparison}
              onViewForwarderOffers={() => {
                setFilters((prev) => ({ ...prev, status: "Forwarder Offers" }));
              }}
              onComposeEmail={(req) => {
                setEmailingRequest(req);
                setIsEmailModalOpen(true);
              }}
            />
          )}

          {filters.viewMode === "table" && (
            <RequestsTableView
              requests={filteredRequests}
              selectedIds={selectedIds}
              onToggleSelect={handleToggleSelect}
              onToggleSelectAll={handleToggleSelectAll}
              onSelectRequest={(req) => setActiveDetailRequest(req)}
              onApproveRequest={(req) => setApprovingRequest(req)}
              onRequestRevision={(req) => setRevisingRequest(req)}
              onRequestQuotes={(req) => handleOpenMultiForwarder(req)}
              onCompareForwarderOffers={handleOpenComparison}
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
        onRecordOffer={(fwdReq) => setRecordingOfferRequest(fwdReq)}
        onCompareForwarderOffers={handleOpenComparison}
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

      {/* Multiple Forwarder Comparison Modal */}
      {isComparingModalOpen && (
        <MultipleForwarderComparisonModal
          booking={comparingBooking}
          offers={comparisonOffers}
          allBookings={requests}
          isOpen={isComparingModalOpen}
          onClose={() => {
            setIsComparingModalOpen(false);
            setComparingBooking(null);
          }}
          onSelectBooking={(b) => setComparingBooking(b)}
          onAwardOffer={async (offer) => {
            await handleAwardForwarderCard(offer);
            setIsComparingModalOpen(false);
            setComparingBooking(null);
          }}
          onRefresh={() => {
            void refetch();
            void refetchForwarderCards();
          }}
          userId={userId}
        />
      )}

      {/* Record Offer Modal */}
      {Boolean(recordingOfferRequest) && (
        <RecordOfferModal
          request={recordingOfferRequest}
          isOpen={Boolean(recordingOfferRequest)}
          onClose={() => setRecordingOfferRequest(null)}
          onSaved={() => {
            void refetch();
            void queryClient.invalidateQueries({ queryKey: ["booking-requests"] });
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

      {/* Forwarder Offer Detail Modal */}
      <ForwarderOfferDetailModal
        card={detailOfferCard}
        isOpen={Boolean(detailOfferCard)}
        onClose={() => setDetailOfferCard(null)}
        onAward={handleAwardForwarderCard}
        isAwarding={awardingCardId === detailOfferCard?.id}
      />

      {/* Award & Official Assignment Confirmation Modal */}
      <AwardConfirmationModal
        isOpen={Boolean(awardConfirmationCard)}
        onClose={() => setAwardConfirmationCard(null)}
        card={awardConfirmationCard}
        onConfirmAward={handleConfirmAwardCard}
        isAwarding={Boolean(awardingCardId)}
      />
    </div>
  );
}
