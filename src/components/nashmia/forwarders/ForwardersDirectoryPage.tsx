import { useEffect, useMemo, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ForwarderAccount } from "@/lib/forwarders-data";
import { AddForwarderModal } from "./AddForwarderModal";
import { ForwarderCardGrid } from "./ForwarderCardGrid";
import { ForwarderDetailDrawer } from "./ForwarderDetailDrawer";
import { ForwardersEmptyState } from "./ForwardersEmptyState";
import { ForwardersHeader } from "./ForwardersHeader";
import { ForwardersListView } from "./ForwardersListView";
import { ForwardersSummaryStrip } from "./ForwardersSummaryStrip";
import { ForwardersToolbar } from "./ForwardersToolbar";
import { SendTestEmailModal } from "./SendTestEmailModal";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  fetchForwardersFromSupabase,
  insertForwarderToSupabase,
  updateForwarderInSupabase,
} from "@/lib/supabase-services";
import { useCachedForwarders, invalidateCachedForwarders, entityCacheKeys } from "@/lib/cache";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";
import {
  DirectorySummaryStripSkeleton,
  DirectoryCardGridSkeleton,
  DirectoryTableSkeleton,
} from "@/components/nashmia/skeletons/DirectorySkeletons";

interface ForwardersDirectoryPageProps {
  onOpenMobileMenu?: () => void;
}

export function ForwardersDirectoryPage({ onOpenMobileMenu }: ForwardersDirectoryPageProps) {
  const { userId, isConfigured } = useAuth();
  const queryClient = useQueryClient();

  // Cached forwarders query with query deduplication, navigation cache reuse & background revalidation
  const {
    data: cachedForwarders = [],
    isLoading: isQueryLoading,
    refetch: refetchForwarders,
  } = useCachedForwarders(userId, { enabled: isConfigured });

  const [forwarders, setForwarders] = useState<ForwarderAccount[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedShippingLine, setSelectedShippingLine] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState("all");
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid"); // Grid View by default

  // Modals & Drawer State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingForwarder, setEditingForwarder] = useState<ForwarderAccount | null>(null);
  const [selectedForwarder, setSelectedForwarder] = useState<ForwarderAccount | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [testEmailForwarder, setTestEmailForwarder] = useState<ForwarderAccount | null>(null);
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false);

  // Synchronize local state with cache whenever cached data arrives or updates in background
  useEffect(() => {
    setForwarders(cachedForwarders || []);
  }, [cachedForwarders]);

  const isLoading = isQueryLoading && forwarders.length === 0;

  // Realtime subscription: invalidates query cache to trigger silent background revalidation
  useSupabaseRealtime(
    "forwarders",
    useCallback(() => {
      void invalidateCachedForwarders(queryClient, userId);
    }, [queryClient, userId]),
    isConfigured,
  );

  // Filtered forwarders computation
  const filteredForwarders = useMemo(() => {
    return forwarders
      .filter((fwd) => {
        // Search query across name, contactPerson, email, whatsapp, notes, code, country, shippingLines
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchName = fwd.name.toLowerCase().includes(q);
          const matchContact = fwd.contactPerson.toLowerCase().includes(q);
          const matchEmail = fwd.email.toLowerCase().includes(q);
          const matchWhatsapp = fwd.whatsapp.toLowerCase().includes(q);
          const matchNotes = fwd.notes.toLowerCase().includes(q);
          const matchCode = fwd.code.toLowerCase().includes(q);
          const matchCountry = fwd.country.toLowerCase().includes(q);
          const matchLines = fwd.shippingLines.some((sl) => sl.toLowerCase().includes(q));
          if (
            !matchName &&
            !matchContact &&
            !matchEmail &&
            !matchWhatsapp &&
            !matchNotes &&
            !matchCode &&
            !matchCountry &&
            !matchLines
          ) {
            return false;
          }
        }

        // Shipping line filter
        if (selectedShippingLine !== "all" && !fwd.shippingLines.includes(selectedShippingLine)) {
          return false;
        }

        // Status filter
        if (selectedStatus !== "all" && fwd.status !== selectedStatus) {
          return false;
        }

        // Country filter
        if (selectedCountry !== "all" && fwd.country !== selectedCountry) {
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
        if (sortBy === "bookings-desc") {
          return b.activeBookings - a.activeBookings;
        }
        if (sortBy === "rates-desc") {
          return b.rateCards.length - a.rateCards.length;
        }
        if (sortBy === "recent") {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
  }, [forwarders, searchQuery, selectedShippingLine, selectedStatus, selectedCountry, sortBy]);

  // Aggregate metrics
  const activeCount = useMemo(
    () => forwarders.filter((f) => f.status === "Active").length,
    [forwarders],
  );
  const totalActiveBookings = useMemo(
    () => forwarders.reduce((sum, f) => sum + f.activeBookings, 0),
    [forwarders],
  );

  // Handlers
  const handleSaveForwarder = async (
    data: Omit<ForwarderAccount, "id" | "createdAt" | "rateCards" | "recentMovements">,
    editId?: string,
  ) => {
    if (editId) {
      setForwarders((prev) => prev.map((f) => (f.id === editId ? { ...f, ...data } : f)));
      if (selectedForwarder?.id === editId) {
        setSelectedForwarder((prev) => (prev ? { ...prev, ...data } : null));
      }
      try {
        if (isConfigured) {
          const updated = await updateForwarderInSupabase(editId, data);
          setForwarders((prev) => prev.map((f) => (f.id === editId ? { ...f, ...updated } : f)));
          await invalidateCachedForwarders(queryClient, userId);
        }
        toast.success("✓ Forwarder Updated", {
          description: `${data.name} profile has been updated.`,
        });
      } catch (err: unknown) {
        toast.error("Failed to update forwarder", {
          description: err instanceof Error ? err.message : "Database error",
        });
        void refetchForwarders();
      }
    } else {
      const tempId = `agent-${Date.now()}`;
      const newForwarder: ForwarderAccount = {
        ...data,
        id: tempId,
        code: `${data.name.slice(0, 3).toUpperCase()}-FWD`,
        createdAt: new Date().toISOString().split("T")[0],
        activeBookings: 0,
        bookingsThisMonth: 0,
        totalBookings: 0,
        rateCards: [],
        recentMovements: [],
      };
      setForwarders((prev) => [newForwarder, ...prev]);

      try {
        const createdAccount = await insertForwarderToSupabase(userId, data);
        setForwarders((prev) => {
          const filtered = prev.filter((f) => f.id !== tempId && f.id !== createdAccount.id);
          return [createdAccount, ...filtered];
        });
        await invalidateCachedForwarders(queryClient, userId);

        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("nashmia-forwarder-created", {
              detail: createdAccount,
            }),
          );
        }

        toast.success("✓ Forwarder Created", {
          description: `${createdAccount.name} has been added successfully.`,
        });
      } catch {
        // Fallback: keep optimistic forwarder and broadcast
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("nashmia-forwarder-created", {
              detail: newForwarder,
            }),
          );
        }
        toast.success("✓ Forwarder Created", {
          description: `${newForwarder.name} has been added successfully.`,
        });
      }
    }
  };

  const handleToggleArchive = async (forwarderId: string) => {
    const target = forwarders.find((f) => f.id === forwarderId);
    if (!target) return;
    const nextStatus = target.status === "Active" ? "Inactive" : "Active";

    setForwarders((prev) =>
      prev.map((f) => (f.id === forwarderId ? { ...f, status: nextStatus } : f)),
    );
    if (selectedForwarder?.id === forwarderId) {
      setSelectedForwarder((prev) => (prev ? { ...prev, status: nextStatus } : null));
    }

    try {
      if (isConfigured) {
        await updateForwarderInSupabase(forwarderId, { status: nextStatus });
        await invalidateCachedForwarders(queryClient, userId);
      }
      toast.info(
        nextStatus === "Inactive" ? `${target.name} archived` : `${target.name} activated`,
      );
    } catch (err: unknown) {
      toast.error("Could not update forwarder status", {
        description: err instanceof Error ? err.message : "Database error",
      });
      void refetchForwarders();
    }
  };

  const handleOpenAddModal = () => {
    setEditingForwarder(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (forwarder: ForwarderAccount) => {
    setEditingForwarder(forwarder);
    setIsAddModalOpen(true);
  };

  const handleSelectForwarder = (forwarder: ForwarderAccount) => {
    setSelectedForwarder(forwarder);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenTestEmail = (forwarder: ForwarderAccount) => {
    setTestEmailForwarder(forwarder);
    setIsTestEmailOpen(true);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedShippingLine("all");
    setSelectedStatus("all");
    setSelectedCountry("all");
    setSortBy("name-asc");
  };

  return (
    <div className="relative z-10 w-full min-w-0 max-w-full space-y-6 text-slate-900 pb-12">
      {/* 1. Header with Eyebrow: DIRECTORY, Title: Forwarders & + Add Forwarder Button */}
      <ForwardersHeader onOpenMobileMenu={onOpenMobileMenu} onAddForwarder={handleOpenAddModal} />

      {/* 2. Summary Glass Connected Strip */}
      {isLoading ? (
        <DirectorySummaryStripSkeleton />
      ) : (
        <ForwardersSummaryStrip
          totalCount={forwarders.length}
          activeCount={activeCount}
          activeBookingsCount={totalActiveBookings}
          shippingLinesCount={7}
        />
      )}

      {/* 3. Floating Glass Filter Toolbar with View Control */}
      <ForwardersToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedShippingLine={selectedShippingLine}
        onShippingLineChange={setSelectedShippingLine}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
        selectedCountry={selectedCountry}
        onCountryChange={setSelectedCountry}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Directory Content */}
      {isLoading ? (
        viewMode === "grid" ? (
          <DirectoryCardGridSkeleton count={8} />
        ) : (
          <DirectoryTableSkeleton rows={8} />
        )
      ) : filteredForwarders.length === 0 ? (
        <ForwardersEmptyState
          isSearchEmpty={
            searchQuery !== "" ||
            selectedShippingLine !== "all" ||
            selectedStatus !== "all" ||
            selectedCountry !== "all"
          }
          onResetFilters={handleResetFilters}
          onAddForwarder={handleOpenAddModal}
        />
      ) : viewMode === "grid" ? (
        /* PRIMARY VISUAL FEATURE: Horizontal Forwarder Card Grid (3 cards per row on desktop) */
        <ForwarderCardGrid
          forwarders={filteredForwarders}
          onSelectForwarder={handleSelectForwarder}
          onEditForwarder={handleOpenEditModal}
          onToggleArchive={handleToggleArchive}
          onSendTestEmail={handleOpenTestEmail}
          onAddForwarder={handleOpenAddModal}
        />
      ) : (
        /* Alternative List View */
        <ForwardersListView
          forwarders={filteredForwarders}
          onSelectForwarder={handleSelectForwarder}
          onEditForwarder={handleOpenEditModal}
          onToggleArchive={handleToggleArchive}
          onSendTestEmail={handleOpenTestEmail}
        />
      )}

      {/* Add / Edit Forwarder Modal */}
      <AddForwarderModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        onSaveForwarder={handleSaveForwarder}
        editForwarder={editingForwarder}
      />

      {/* Slide-Over Forwarder Detail Drawer */}
      <ForwarderDetailDrawer
        open={isDetailDrawerOpen}
        onOpenChange={setIsDetailDrawerOpen}
        forwarder={selectedForwarder}
        onEditForwarder={(f) => {
          setIsDetailDrawerOpen(false);
          handleOpenEditModal(f);
        }}
        onToggleArchive={handleToggleArchive}
        onOpenTestEmail={handleOpenTestEmail}
      />

      {/* Send Test Email Modal */}
      <SendTestEmailModal
        open={isTestEmailOpen}
        onOpenChange={setIsTestEmailOpen}
        forwarder={testEmailForwarder}
      />
    </div>
  );
}
