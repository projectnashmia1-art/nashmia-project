import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BuyerAccountFull, BuyerMovementRecord } from "@/lib/buyers-data";
import { AddBuyerModal } from "./AddBuyerModal";
import { BuyerCardGrid } from "./BuyerCardGrid";
import { BuyerDetailDrawer } from "./BuyerDetailDrawer";
import { BuyersEmptyState } from "./BuyersEmptyState";
import { BuyersHeader } from "./BuyersHeader";
import { BuyersListView } from "./BuyersListView";
import { BuyersSummaryStrip } from "./BuyersSummaryStrip";
import { BuyersToolbar } from "./BuyersToolbar";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBuyersFromSupabase,
  fetchBookingsFromSupabase,
  insertBuyerToSupabase,
  updateBuyerInSupabase,
} from "@/lib/supabase-services";
import { useCachedBuyers, invalidateCachedBuyers, entityCacheKeys } from "@/lib/cache";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import {
  DirectorySummaryStripSkeleton,
  DirectoryCardGridSkeleton,
  DirectoryTableSkeleton,
} from "@/components/nashmia/skeletons/DirectorySkeletons";

interface BuyersDirectoryPageProps {
  onOpenMobileMenu?: () => void;
}

export function BuyersDirectoryPage({ onOpenMobileMenu }: BuyersDirectoryPageProps) {
  const { userId, isConfigured } = useAuth();
  const queryClient = useQueryClient();

  // Cached buyers query with query deduplication, navigation cache reuse & background revalidation
  const {
    data: cachedBuyers = [],
    isLoading: isQueryLoading,
    refetch: refetchBuyers,
  } = useCachedBuyers(userId, { enabled: isConfigured });

  const { data: allBookings = [] } = useQuery({
    queryKey: ["dashboard-bookings", userId],
    queryFn: () => fetchBookingsFromSupabase(userId),
    enabled: true,
  });

  // Directory state
  const [buyers, setBuyers] = useState<BuyerAccountFull[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid"); // GRID VIEW MUST BE DEFAULT

  // Modal & Drawer states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<BuyerAccountFull | null>(null);
  const [selectedBuyer, setSelectedBuyer] = useState<BuyerAccountFull | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Synchronize local state with cache whenever cached data arrives or updates in background
  useEffect(() => {
    setBuyers(cachedBuyers || []);
  }, [cachedBuyers]);

  const isLoading = isQueryLoading && buyers.length === 0;

  // Realtime subscription: invalidates query cache to trigger silent background revalidation
  useSupabaseRealtime(
    "buyers",
    useCallback(() => {
      void invalidateCachedBuyers(queryClient, userId);
    }, [queryClient, userId]),
    isConfigured,
  );

  // Filter & Sort computation
  const filteredBuyers = useMemo(() => {
    return buyers
      .filter((b) => {
        // Search across name, company, country, contactPerson, email, phone, code
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = b.name.toLowerCase().includes(q);
          const matchCompany = b.company.toLowerCase().includes(q);
          const matchCountry = b.country.toLowerCase().includes(q);
          const matchContact = b.contactPerson.toLowerCase().includes(q);
          const matchEmail = b.email.toLowerCase().includes(q);
          const matchPhone = b.phone.toLowerCase().includes(q);
          const matchCode = b.code.toLowerCase().includes(q);
          if (
            !matchName &&
            !matchCompany &&
            !matchCountry &&
            !matchContact &&
            !matchEmail &&
            !matchPhone &&
            !matchCode
          ) {
            return false;
          }
        }

        // Country filter
        if (selectedCountry !== "all" && b.country !== selectedCountry) {
          return false;
        }

        // Status filter
        if (selectedStatus !== "all" && b.status !== selectedStatus) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name-asc") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "name-desc") {
          return b.name.localeCompare(a.name);
        }
        if (sortBy === "movements-desc") {
          return b.activeMovements - a.activeMovements;
        }
        if (sortBy === "recent") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
  }, [buyers, searchQuery, selectedCountry, selectedStatus, sortBy]);

  // Statistics calculation for the connected Summary Strip
  const stats = useMemo(() => {
    const total = buyers.length;
    const active = buyers.filter((b) => b.status === "Active").length;
    const withMovements = buyers.filter((b) => b.activeMovements > 0).length;
    const distinctCountries = new Set(buyers.map((b) => b.country)).size;

    return {
      totalBuyers: total,
      activeBuyers: active,
      withActiveMovements: withMovements,
      totalCountries: distinctCountries,
    };
  }, [buyers]);

  // Handler: Add or update buyer
  const handleSaveBuyer = async (
    data: Omit<BuyerAccountFull, "id" | "createdAt">,
    editId?: string,
  ) => {
    if (editId) {
      // Optimistic update
      setBuyers((prev) => prev.map((b) => (b.id === editId ? { ...b, ...data } : b)));
      if (selectedBuyer?.id === editId) {
        setSelectedBuyer((prev) => (prev ? { ...prev, ...data } : null));
      }
      try {
        if (isConfigured) {
          const updated = await updateBuyerInSupabase(editId, data);
          setBuyers((prev) => prev.map((b) => (b.id === editId ? updated : b)));
          await invalidateCachedBuyers(queryClient, userId);
        }
        toast.success("Buyer updated successfully");
      } catch (err: unknown) {
        toast.error("Failed to update buyer", {
          description: err instanceof Error ? err.message : "Database error",
        });
        void refetchBuyers();
      }
    } else {
      const tempId = `buyer-${Date.now()}`;
      const newBuyerLocal: BuyerAccountFull = {
        ...data,
        id: tempId,
        createdAt: new Date().toISOString().split("T")[0],
      };
      setBuyers((prev) => [newBuyerLocal, ...prev]);

      try {
        if (isConfigured) {
          const created = await insertBuyerToSupabase(userId || null, data);
          setBuyers((prev) => prev.map((b) => (b.id === tempId ? created : b)));
          await invalidateCachedBuyers(queryClient, userId);
          try {
            window.dispatchEvent(new CustomEvent("nashmia-buyer-created", { detail: created }));
          } catch (e) {
            console.error("Failed to broadcast buyer event:", e);
          }
        } else {
          try {
            window.dispatchEvent(
              new CustomEvent("nashmia-buyer-created", { detail: newBuyerLocal }),
            );
          } catch (e) {
            console.error("Failed to broadcast buyer event:", e);
          }
        }
        toast.success(`${data.name} added to directory & Supabase`);
      } catch (err: unknown) {
        console.warn("[BuyersDirectoryPage] Supabase buyer creation error:", err);
        toast.error("Failed to save buyer to Supabase", {
          description: err instanceof Error ? err.message : "Database error",
        });
        void refetchBuyers();
      }
    }
  };

  // Handler: Toggle archive
  const handleToggleArchive = async (buyerId: string) => {
    const target = buyers.find((b) => b.id === buyerId);
    if (!target) return;
    const nextStatus = target.status === "Active" ? "Inactive" : "Active";

    setBuyers((prev) => prev.map((b) => (b.id === buyerId ? { ...b, status: nextStatus } : b)));
    if (selectedBuyer?.id === buyerId) {
      setSelectedBuyer((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }

    try {
      if (isConfigured) {
        await updateBuyerInSupabase(buyerId, { status: nextStatus });
        await invalidateCachedBuyers(queryClient, userId);
      }
      toast.info(
        nextStatus === "Inactive" ? `${target.name} archived` : `${target.name} activated`,
      );
    } catch (err: unknown) {
      toast.error("Could not update buyer status", {
        description: err instanceof Error ? err.message : "Database error",
      });
      void loadBuyers();
    }
  };

  // Handlers for Drawer & Modal opens
  const handleOpenAddModal = () => {
    setEditingBuyer(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (buyer: BuyerAccountFull) => {
    setEditingBuyer(buyer);
    setIsAddModalOpen(true);
  };

  const handleSelectBuyer = (buyer: BuyerAccountFull) => {
    setSelectedBuyer(buyer);
    setIsDetailDrawerOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCountry("all");
    setSelectedStatus("all");
    setSortBy("name-asc");
  };

  // Movements belonging to selected buyer
  const selectedBuyerMovements = useMemo(() => {
    if (!selectedBuyer) return [];
    const bId = (selectedBuyer.id || "").toLowerCase();
    const bName = (selectedBuyer.name || "").toLowerCase();
    const bComp = (selectedBuyer.company || "").toLowerCase();

    return (allBookings || [])
      .filter((b) => {
        const rowBuyerId = (b.buyer_id || "").toLowerCase();
        const rowCustName = (b.customer_name || "").toLowerCase();
        const rowBuyerName = (b.buyer_name || "").toLowerCase();
        return (
          rowBuyerId === bId ||
          (bId && rowBuyerId && rowBuyerId === bId) ||
          (bName && (rowCustName === bName || rowBuyerName === bName)) ||
          (bComp && (rowCustName === bComp || rowBuyerName === bComp))
        );
      })
      .map((b) => ({
        id: b.id,
        ref: b.booking_reference || b.movement_number || b.id,
        buyerId: selectedBuyer.id,
        buyerName: selectedBuyer.name,
        supplierName: b.supplier_name || "Supplier",
        containersCount: b.container_count || 1,
        containerSize: (b.container_size as "40HC") || "40HC",
        polCode: b.pol_code || "POL",
        polName: b.pol_name || b.origin || "Origin",
        podCode: b.pod_code || "POD",
        podName: b.pod_name || b.destination || "Destination",
        carrier: b.carrier || "Carrier",
        vessel: b.vessel_name || "Vessel",
        status: (b.status || "In Transit") as BuyerMovementRecord["status"],
        etd: b.etd || "—",
        eta: b.eta || "—",
        ratePerContainer: b.rate_amount || 0,
        totalFreight: b.total_freight || 0,
        currency: b.currency || "USD",
      }));
  }, [selectedBuyer, allBookings]);

  return (
    <div className="relative z-10 w-full min-w-0 max-w-full space-y-7 text-slate-900">
      {/* 1. Header with Eyebrow, Title & + Add Buyer Button */}
      <BuyersHeader onOpenMobileMenu={onOpenMobileMenu} onAddBuyer={handleOpenAddModal} />

      {/* 2. Connected Glass Summary Strip */}
      {isLoading ? (
        <DirectorySummaryStripSkeleton />
      ) : (
        <BuyersSummaryStrip
          totalBuyers={stats.totalBuyers}
          activeBuyers={stats.activeBuyers}
          withActiveMovements={stats.withActiveMovements}
          totalCountries={stats.totalCountries}
        />
      )}

      {/* 3. Floating Glass Toolbar (Spotlight Search + Filters + Grid/List Switch) */}
      <BuyersToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetFilters={handleResetFilters}
      />

      {/* 4. MAIN HERO: Buyer Card Grid (Default) or List View */}
      {isLoading ? (
        viewMode === "grid" ? (
          <DirectoryCardGridSkeleton count={8} />
        ) : (
          <DirectoryTableSkeleton rows={8} />
        )
      ) : filteredBuyers.length === 0 ? (
        <BuyersEmptyState
          isSearchEmpty={
            searchQuery !== "" || selectedCountry !== "all" || selectedStatus !== "all"
          }
          onResetFilters={handleResetFilters}
          onAddBuyer={handleOpenAddModal}
        />
      ) : viewMode === "grid" ? (
        <BuyerCardGrid
          buyers={filteredBuyers}
          onSelectBuyer={handleSelectBuyer}
          onEditBuyer={handleOpenEditModal}
          onToggleArchive={handleToggleArchive}
          onAddBuyer={handleOpenAddModal}
        />
      ) : (
        <BuyersListView
          buyers={filteredBuyers}
          onSelectBuyer={handleSelectBuyer}
          onEditBuyer={handleOpenEditModal}
          onToggleArchive={handleToggleArchive}
        />
      )}

      {/* Add / Edit Buyer Modal */}
      <AddBuyerModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSaveBuyer={handleSaveBuyer}
        editBuyer={editingBuyer}
      />

      {/* Slide-Over Buyer Detail Drawer */}
      <BuyerDetailDrawer
        open={isDetailDrawerOpen}
        onOpenChange={setIsDetailDrawerOpen}
        buyer={selectedBuyer}
        movements={selectedBuyerMovements}
        onEditBuyer={(b) => {
          setIsDetailDrawerOpen(false);
          handleOpenEditModal(b);
        }}
        onToggleArchive={handleToggleArchive}
      />
    </div>
  );
}
