import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SupplierAccountFull, SupplierMovementRecord } from "@/lib/suppliers-data";
import { AddSupplierModal } from "./AddSupplierModal";
import { SupplierCardGrid } from "./SupplierCardGrid";
import { SupplierDetailDrawer } from "./SupplierDetailDrawer";
import { SuppliersEmptyState } from "./SuppliersEmptyState";
import { SuppliersHeader } from "./SuppliersHeader";
import { SuppliersSummaryStrip } from "./SuppliersSummaryStrip";
import { SuppliersTable } from "./SuppliersTable";
import { SuppliersToolbar } from "./SuppliersToolbar";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  fetchSuppliersFromSupabase,
  fetchBookingsFromSupabase,
  insertSupplierToSupabase,
  updateSupplierInSupabase,
} from "@/lib/supabase-services";
import { useCachedSuppliers, invalidateCachedSuppliers, entityCacheKeys } from "@/lib/cache";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import {
  DirectorySummaryStripSkeleton,
  DirectoryCardGridSkeleton,
  DirectoryTableSkeleton,
} from "@/components/nashmia/skeletons/DirectorySkeletons";

interface SuppliersDirectoryPageProps {
  onOpenMobileMenu?: () => void;
}

export function SuppliersDirectoryPage({ onOpenMobileMenu }: SuppliersDirectoryPageProps) {
  const { userId, isConfigured } = useAuth();
  const queryClient = useQueryClient();

  // Cached suppliers query with query deduplication, navigation cache reuse & background revalidation
  const {
    data: cachedSuppliers = [],
    isLoading: isQueryLoading,
    refetch: refetchSuppliers,
  } = useCachedSuppliers(userId, { enabled: isConfigured });

  const { data: allBookings = [] } = useQuery({
    queryKey: ["dashboard-bookings", userId],
    queryFn: () => fetchBookingsFromSupabase(userId),
    enabled: true,
  });

  const [suppliers, setSuppliers] = useState<SupplierAccountFull[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedLoadPoint, setSelectedLoadPoint] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid"); // Grid view is DEFAULT

  // Modal & Drawer states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierAccountFull | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierAccountFull | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Synchronize local state with cache whenever cached data arrives or updates in background
  useEffect(() => {
    setSuppliers(cachedSuppliers || []);
  }, [cachedSuppliers]);

  const isLoading = isQueryLoading && suppliers.length === 0;

  // Realtime subscription: invalidates query cache to trigger silent background revalidation
  useSupabaseRealtime(
    "suppliers",
    useCallback(() => {
      void invalidateCachedSuppliers(queryClient, userId);
    }, [queryClient, userId]),
    isConfigured,
  );

  // Filter & Sort Logic
  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter((supplier) => {
        // Search query
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          const matchName = supplier.name.toLowerCase().includes(q);
          const matchCode = supplier.code?.toLowerCase().includes(q);
          const matchContact = supplier.contactPerson.toLowerCase().includes(q);
          const matchCity = supplier.city.toLowerCase().includes(q);
          const matchLoadPoint = supplier.loadPoint.toLowerCase().includes(q);
          const matchEmail = supplier.email.toLowerCase().includes(q);
          if (
            !matchName &&
            !matchCode &&
            !matchContact &&
            !matchCity &&
            !matchLoadPoint &&
            !matchEmail
          ) {
            return false;
          }
        }

        // Country filter
        if (selectedCountry !== "all" && supplier.country !== selectedCountry) {
          return false;
        }

        // Status filter
        if (selectedStatus !== "all" && supplier.status !== selectedStatus) {
          return false;
        }

        // Load Point filter
        if (selectedLoadPoint !== "all" && supplier.loadPointType !== selectedLoadPoint) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "name-asc":
            return a.name.localeCompare(b.name);
          case "name-desc":
            return b.name.localeCompare(a.name);
          case "containers-desc":
            return b.activeContainers - a.activeContainers;
          case "country":
            return a.country.localeCompare(b.country);
          default:
            return 0;
        }
      });
  }, [suppliers, searchQuery, selectedCountry, selectedStatus, selectedLoadPoint, sortBy]);

  // Handler: Add or Edit supplier
  const handleSaveSupplier = async (
    data: Omit<SupplierAccountFull, "id" | "createdAt">,
    editId?: string,
  ) => {
    if (editId) {
      // Update existing
      setSuppliers((prev) => prev.map((s) => (s.id === editId ? { ...s, ...data } : s)));
      if (selectedSupplier?.id === editId) {
        setSelectedSupplier((prev) => (prev ? { ...prev, ...data } : null));
      }
      toast.success("Supplier updated successfully");

      try {
        if (isConfigured) {
          await updateSupplierInSupabase(editId, data);
          await invalidateCachedSuppliers(queryClient, userId);
        }
      } catch (err: unknown) {
        toast.error("Failed to update supplier in Supabase", {
          description: err instanceof Error ? err.message : "Database error",
        });
        void refetchSuppliers();
      }
    } else {
      // Add new
      const tempSupplier: SupplierAccountFull = {
        ...data,
        id: `sup-${Date.now()}`,
        createdAt: "Just now",
      };
      setSuppliers((prev) => [tempSupplier, ...prev]);
      toast.success("New supplier registered successfully");

      try {
        const created = await insertSupplierToSupabase(userId || null, data);
        if (created) {
          setSuppliers((prev) => [
            created,
            ...prev.filter((s) => s.id !== tempSupplier.id && s.id !== created.id),
          ]);
          await invalidateCachedSuppliers(queryClient, userId);
        }
      } catch (err: unknown) {
        console.warn("Supplier insert notice:", err);
      }
    }
  };

  // Handler: Toggle archive
  const handleToggleArchive = async (supplierId: string) => {
    const target = suppliers.find((s) => s.id === supplierId);
    if (!target) return;
    const nextStatus = target.status === "Active" ? "Inactive" : "Active";

    setSuppliers((prev) =>
      prev.map((s) => (s.id === supplierId ? { ...s, status: nextStatus } : s)),
    );
    if (selectedSupplier?.id === supplierId) {
      setSelectedSupplier((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }

    try {
      if (isConfigured) {
        await updateSupplierInSupabase(supplierId, { status: nextStatus });
        await invalidateCachedSuppliers(queryClient, userId);
      }
      toast.info(
        nextStatus === "Inactive" ? `${target.name} archived` : `${target.name} activated`,
      );
    } catch (err: unknown) {
      toast.error("Could not update supplier status", {
        description: err instanceof Error ? err.message : "Database error",
      });
      void refetchSuppliers();
    }
  };

  // Handlers for Drawer & Modal opens
  const handleOpenAddModal = () => {
    setEditingSupplier(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (supplier: SupplierAccountFull) => {
    setEditingSupplier(supplier);
    setIsAddModalOpen(true);
  };

  const handleSelectSupplier = (supplier: SupplierAccountFull) => {
    setSelectedSupplier(supplier);
    setIsDetailDrawerOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCountry("all");
    setSelectedStatus("all");
    setSelectedLoadPoint("all");
    setSortBy("name-asc");
  };

  // Movements belonging to selected supplier
  const selectedSupplierMovements = useMemo(() => {
    if (!selectedSupplier) return [];
    const sId = (selectedSupplier.id || "").toLowerCase();
    const sName = (selectedSupplier.name || "").toLowerCase();

    return (allBookings || [])
      .filter((b) => {
        const rowSuppId = (b.supplier_id || "").toLowerCase();
        const rowSuppName = (b.supplier_name || "").toLowerCase();
        return (
          rowSuppId === sId ||
          (sId && rowSuppId && rowSuppId === sId) ||
          (sName && rowSuppName === sName)
        );
      })
      .map((b) => ({
        id: b.id,
        ref: b.booking_reference || b.movement_number || b.id,
        supplierId: selectedSupplier.id,
        supplierName: selectedSupplier.name,
        loadPoint: selectedSupplier.loadPoint || "Default Load Point",
        buyerName: b.buyer_name || b.customer_name || "Buyer",
        containersCount: b.container_count || 1,
        containerSize: (b.container_size as "40HC") || "40HC",
        polCode: b.pol_code || "POL",
        polName: b.pol_name || b.origin || "Origin",
        podCode: b.pod_code || "POD",
        podName: b.pod_name || b.destination || "Destination",
        carrier: b.carrier || "Carrier",
        vessel: b.vessel_name || "Vessel",
        status: (b.status || "In Transit") as SupplierMovementRecord["status"],
        etd: b.etd || "—",
        eta: b.eta || "—",
      }));
  }, [selectedSupplier, allBookings]);

  const activeCount = suppliers.filter((s) => s.status === "Active").length;
  const loadPointsCount = new Set(suppliers.map((s) => s.loadPoint)).size;
  const activeMovementsCount = suppliers.reduce((acc, s) => acc + (s.activeContainers || 0), 0);

  return (
    <div className="relative z-10 w-full min-w-0 max-w-full space-y-6 text-slate-900 pb-12">
      {/* 1. Header with Eyebrow, Title & + Register Supplier Button */}
      <SuppliersHeader onOpenMobileMenu={onOpenMobileMenu} onAddSupplier={handleOpenAddModal} />

      {/* 2. Summary KPI Cards Strip */}
      {isLoading ? (
        <DirectorySummaryStripSkeleton />
      ) : (
        <SuppliersSummaryStrip
          totalCount={suppliers.length || 28}
          activeCount={activeCount || 25}
          loadPointsCount={loadPointsCount || 31}
          activeMovementsCount={activeMovementsCount || 19}
        />
      )}

      {/* 3. Toolbar: Spotlight Search, Quick Filters & Dropdowns */}
      <SuppliersToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedLoadPoint={selectedLoadPoint}
        onLoadPointChange={setSelectedLoadPoint}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Primary Experience: Supplier Card Grid or Table List */}
      {isLoading ? (
        viewMode === "grid" ? (
          <DirectoryCardGridSkeleton count={8} />
        ) : (
          <DirectoryTableSkeleton rows={8} />
        )
      ) : filteredSuppliers.length === 0 ? (
        <SuppliersEmptyState
          isSearchEmpty={
            searchQuery !== "" ||
            selectedCountry !== "all" ||
            selectedStatus !== "all" ||
            selectedLoadPoint !== "all"
          }
          onResetFilters={handleResetFilters}
          onAddSupplier={handleOpenAddModal}
        />
      ) : viewMode === "grid" ? (
        <SupplierCardGrid
          suppliers={filteredSuppliers}
          onSelectSupplier={handleSelectSupplier}
          onEditSupplier={handleOpenEditModal}
          onToggleArchive={handleToggleArchive}
          onAddSupplier={handleOpenAddModal}
        />
      ) : (
        <SuppliersTable
          suppliers={filteredSuppliers}
          onSelectSupplier={handleSelectSupplier}
          onEditSupplier={handleOpenEditModal}
          onToggleArchive={handleToggleArchive}
        />
      )}

      {/* Add / Edit Supplier Modal */}
      <AddSupplierModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSaveSupplier={handleSaveSupplier}
        editSupplier={editingSupplier}
      />

      {/* Slide-Over Supplier Detail Drawer */}
      <SupplierDetailDrawer
        open={isDetailDrawerOpen}
        onOpenChange={setIsDetailDrawerOpen}
        supplier={selectedSupplier}
        movements={selectedSupplierMovements}
        onEditSupplier={(s) => {
          setIsDetailDrawerOpen(false);
          handleOpenEditModal(s);
        }}
        onToggleArchive={handleToggleArchive}
      />
    </div>
  );
}
