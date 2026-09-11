import { useEffect, useMemo, useState, useCallback } from "react";
import { BuyerAccountFull, BUYER_MOVEMENTS, INITIAL_BUYERS } from "@/lib/buyers-data";
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
  insertBuyerToSupabase,
  updateBuyerInSupabase,
} from "@/lib/supabase-services";
import { useSupabaseRealtime } from "@/hooks/use-supabase-realtime";

interface BuyersDirectoryPageProps {
  onOpenMobileMenu?: () => void;
}

export function BuyersDirectoryPage({ onOpenMobileMenu }: BuyersDirectoryPageProps) {
  const { userId, isConfigured } = useAuth();
  // Directory state
  const [buyers, setBuyers] = useState<BuyerAccountFull[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  // Load buyers from Supabase
  const loadBuyers = useCallback(async () => {
    try {
      if (!isConfigured) {
        setBuyers([]);
        setIsLoading(false);
        return;
      }
      const data = await fetchBuyersFromSupabase(userId);
      setBuyers(data || []);
    } catch (err) {
      console.warn("[BuyersDirectoryPage] Error loading buyers from Supabase:", err);
      setBuyers([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isConfigured]);

  useEffect(() => {
    void loadBuyers();
  }, [loadBuyers]);

  // Realtime subscription
  useSupabaseRealtime(
    "buyers",
    useCallback(() => {
      void loadBuyers();
    }, [loadBuyers]),
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
        }
        toast.success("Buyer updated successfully");
      } catch (err: unknown) {
        toast.error("Failed to update buyer", {
          description: err instanceof Error ? err.message : "Database error",
        });
        void loadBuyers();
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
        void loadBuyers();
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
    return BUYER_MOVEMENTS.filter((m) => m.buyerId === selectedBuyer.id);
  }, [selectedBuyer]);

  return (
    <div className="relative min-h-screen bg-[#FFFFFF] text-[#000000] selection:bg-[#E8F1F3] selection:text-[#6A80A9]">
      {/* Subtle Atmospheric Background Overlay */}
      <div className="pointer-events-none fixed inset-0 z-0 bg-gradient-to-b from-[#E8F1F3]/25 via-transparent to-[#E8F1F3]/10" />

      {/* Main Container */}
      <div className="relative z-10 mx-auto max-w-[1520px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10 space-y-7">
        {/* 1. Header with Eyebrow, Title & + Add Buyer Button */}
        <BuyersHeader onOpenMobileMenu={onOpenMobileMenu} onAddBuyer={handleOpenAddModal} />

        {/* 2. Connected Glass Summary Strip */}
        <BuyersSummaryStrip
          totalBuyers={stats.totalBuyers}
          activeBuyers={stats.activeBuyers}
          withActiveMovements={stats.withActiveMovements}
          totalCountries={stats.totalCountries}
        />

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
        {filteredBuyers.length === 0 ? (
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
      </div>

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
