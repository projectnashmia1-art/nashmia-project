import React, { useState, useMemo, useCallback } from "react";
import {
  Receipt,
  Plus,
  Building2,
  MapPin,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Menu,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useRealRateCards, useRealForwarders, queryKeys } from "@/services/data-fetching.service";
import {
  insertRateCardToSupabase,
  updateRateCardInSupabase,
  deleteRateCardFromSupabase,
} from "@/lib/supabase-services";
import { RateCardsToolbar } from "./RateCardsToolbar";
import { RateCardsTable } from "./RateCardsTable";
import { RateCardsGridView } from "./RateCardsGridView";
import { RateCardModal } from "./RateCardModal";
import { RateCardDetailDrawer } from "./RateCardDetailDrawer";
import type { FullRateCardRecord } from "@/types/rate-card.types";
import type { RateCardFormValues } from "@/lib/rate-cards-data";

interface RateCardsPageProps {
  onOpenMobileMenu?: () => void;
}

export function RateCardsPage({ onOpenMobileMenu }: RateCardsPageProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Supabase Data
  const {
    data: rateCards = [],
    isLoading: isLoadingRates,
    refetch: refetchRates,
  } = useRealRateCards(user?.id);

  const { data: forwarders = [] } = useRealForwarders(user?.id);

  // UI State
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedForwarder, setSelectedForwarder] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  // Modal & Drawer State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<FullRateCardRecord | null>(null);
  const [detailCard, setDetailCard] = useState<FullRateCardRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete Confirmation State
  const [deleteCandidate, setDeleteCandidate] = useState<{ id: string; name: string } | null>(null);

  // Forwarder options for dropdown
  const forwardersOptions = useMemo(() => {
    return forwarders.map((fwd) => ({
      id: fwd.id,
      name: fwd.name,
      code: fwd.code,
      contact: fwd.contactPerson,
      email: fwd.email,
    }));
  }, [forwarders]);

  // Filter & Sort Rate Cards
  const filteredRateCards = useMemo(() => {
    let result = [...rateCards];

    // 1. Search filter: Pickup point or Forwarder name
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((card) => {
        const forwarderName = card.forwarders?.company_name || "";
        const forwarderCode = card.forwarders?.code || "";
        const pickup = card.load_point || card.origin || "";
        return (
          pickup.toLowerCase().includes(q) ||
          forwarderName.toLowerCase().includes(q) ||
          forwarderCode.toLowerCase().includes(q) ||
          (card.notes && card.notes.toLowerCase().includes(q))
        );
      });
    }

    // 2. Forwarder filter
    if (selectedForwarder !== "all") {
      result = result.filter((card) => card.forwarder_id === selectedForwarder);
    }

    // 3. Sorting
    result.sort((a, b) => {
      const rateA = a.base_rate || a.rate || 0;
      const rateB = b.base_rate || b.rate || 0;
      if (sortBy === "rate-asc") {
        return rateA - rateB;
      }
      if (sortBy === "rate-desc") {
        return rateB - rateA;
      }
      return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime();
    });

    return result;
  }, [rateCards, searchQuery, selectedForwarder, sortBy]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = rateCards.length;
    const uniqueForwarders = new Set(rateCards.map((r) => r.forwarder_id)).size;
    const ratesList = rateCards.map((r) => r.base_rate || r.rate || 0).filter((r) => r > 0);
    const avgRate =
      ratesList.length > 0
        ? Math.round(ratesList.reduce((a, b) => a + b, 0) / ratesList.length)
        : 0;
    const uniquePickupPoints = new Set(rateCards.map((r) => r.load_point || r.origin)).size;

    return { total, uniqueForwarders, avgRate, uniquePickupPoints };
  }, [rateCards]);

  // Handlers
  const handleOpenAddModal = () => {
    setEditingCard(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (card: FullRateCardRecord) => {
    setEditingCard(card);
    setIsModalOpen(true);
  };

  const handleViewDetails = (card: FullRateCardRecord) => {
    setDetailCard(card);
  };

  const handleSaveRateCard = async (values: RateCardFormValues, editingId?: string) => {
    setIsSubmitting(true);
    try {
      if (editingId) {
        await updateRateCardInSupabase(editingId, {
          forwarder_id: values.forwarderId,
          origin: values.origin,
          destination: values.destination,
          load_point: values.loadPoint,
          container_size: values.containerSize,
          container_type: values.containerType,
          quantity: values.quantity,
          base_rate: values.baseRate,
          currency: values.currency,
          valid_from: values.validFrom,
          valid_until: values.validUntil,
          status: values.status,
          notes: values.notes,
        });
        toast.success("✓ Rate Card Updated");
      } else {
        await insertRateCardToSupabase(
          {
            forwarder_id: values.forwarderId,
            origin: values.origin,
            destination: values.destination,
            load_point: values.loadPoint,
            container_size: values.containerSize,
            container_type: values.containerType,
            quantity: values.quantity,
            base_rate: values.baseRate,
            currency: values.currency,
            valid_from: values.validFrom,
            valid_until: values.validUntil,
            status: values.status,
            notes: values.notes,
          },
          user?.id,
        );
        toast.success("✓ Rate Card Added");
      }

      await queryClient.invalidateQueries({ queryKey: queryKeys.rateCards });
      await refetchRates();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save rate card";
      toast.error(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteCandidate) return;
    try {
      const success = await deleteRateCardFromSupabase(deleteCandidate.id);
      if (success) {
        toast.success("Rate Card Deleted", {
          description: deleteCandidate.name,
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.rateCards });
        await refetchRates();
      } else {
        toast.error("Failed to delete rate card");
      }
    } catch (err: unknown) {
      toast.error("Error deleting rate card");
    } finally {
      setDeleteCandidate(null);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedForwarder("all");
    setSortBy("recent");
  };

  return (
    <div className="relative z-10 w-full min-w-0 max-w-full space-y-6 text-slate-900 pb-12">
      {/* 1. Header with Eyebrow: DIRECTORY, Title: Rate Cards & + Add Rate Card Button */}
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Toggle navigation menu"
              className="mt-1 grid size-11 shrink-0 place-items-center rounded-[14px] border border-slate-200/80 bg-white/80 text-black shadow-2xs backdrop-blur-md transition-all hover:bg-white lg:hidden"
            >
              <Menu className="size-5" />
            </button>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#6A80A9]">
              DIRECTORY • FINANCIALS
            </p>
            <h1 className="text-[32px] font-semibold tracking-[-0.03em] text-[#000000] sm:text-[38px] lg:text-[40px] leading-tight">
              Rate Cards
            </h1>
            <p className="max-w-2xl text-[14px] text-slate-500 leading-relaxed">
              Manage agreed pickup points, forwarders and freight rates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="group relative flex h-[50px] items-center gap-2.5 rounded-[14px] bg-[#000000] px-6 text-[14px] font-medium text-[#FFFFFF] shadow-[0_10px_28px_rgba(0,0,0,0.18)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-[0_16px_36px_rgba(0,0,0,0.26)] active:translate-y-0 active:scale-[0.99] cursor-pointer"
          >
            <Plus className="size-4 transition-transform duration-200 group-hover:rotate-90" />
            <span>+ Add Rate Card</span>
          </button>
        </div>
      </header>

      {/* 2. Summary Connected Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Rate Cards */}
        <div className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <Receipt className="size-5 stroke-[1.8] text-[#6A80A9]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-slate-800">Total</span>
              <span className="text-[14px] font-medium text-slate-800">Rate Cards</span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {metrics.total}
            </span>
            <span className="text-xs font-semibold text-[#6A80A9] bg-[#E8F1F3] px-2 py-0.5 rounded-md">
              Active Rates
            </span>
          </div>
        </div>

        {/* Card 2: Pickup Points */}
        <div className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <MapPin className="size-5 stroke-[1.8] text-[#6A80A9]" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-slate-800">Pickup</span>
              <span className="text-[14px] font-medium text-slate-800">Points</span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {metrics.uniquePickupPoints}
            </span>
            <span className="text-xs font-medium text-slate-400">Locations</span>
          </div>
        </div>

        {/* Card 3: Forwarders */}
        <div className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <Building2 className="size-5 stroke-[1.8] text-slate-700" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-slate-800">Forwarder</span>
              <span className="text-[14px] font-medium text-slate-800">Partners</span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none">
              {metrics.uniqueForwarders}
            </span>
            <span className="text-xs font-medium text-slate-400">Linked</span>
          </div>
        </div>

        {/* Card 4: Average Rate */}
        <div className="group relative overflow-hidden rounded-[24px] sm:rounded-[26px] bg-white p-5 sm:p-6 border border-slate-100/90 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.06),0_2px_6px_-1px_rgba(0,0,0,0.02)] transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between min-h-[145px]">
          <div className="flex items-center gap-3">
            <div className="size-11 sm:size-12 rounded-full border border-slate-200/90 bg-white flex items-center justify-center text-slate-700 shadow-2xs shrink-0">
              <DollarSign className="size-5 stroke-[1.8] text-emerald-600" />
            </div>
            <div className="flex flex-col">
              <span className="text-[14px] font-medium text-slate-800">Average</span>
              <span className="text-[14px] font-medium text-slate-800">Freight Rate</span>
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="text-[28px] sm:text-[32px] font-bold text-slate-900 tracking-tight leading-none font-mono">
              ${metrics.avgRate.toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              USD / bkg
            </span>
          </div>
        </div>
      </div>

      {/* 3. Toolbar (Search, Filter, Sort, View Toggle) */}
      <RateCardsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedForwarder={selectedForwarder}
        onForwarderChange={setSelectedForwarder}
        forwardersList={forwardersOptions}
        sortBy={sortBy}
        onSortChange={setSortBy}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onResetFilters={handleResetFilters}
      />

      {/* 4. Main Data View (Table or Grid) */}
      {viewMode === "table" ? (
        <RateCardsTable
          rateCards={filteredRateCards}
          onViewDetails={handleViewDetails}
          onEdit={handleOpenEditModal}
          onDelete={(id, name) => setDeleteCandidate({ id, name })}
          onAddRateCard={handleOpenAddModal}
        />
      ) : (
        <RateCardsGridView
          rateCards={filteredRateCards}
          onViewDetails={handleViewDetails}
          onEdit={handleOpenEditModal}
          onDelete={(id, name) => setDeleteCandidate({ id, name })}
          onAddRateCard={handleOpenAddModal}
        />
      )}

      {/* MODALS & DRAWERS */}
      {/* 1. Add/Edit Rate Card Modal */}
      <RateCardModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveRateCard}
        editingCard={editingCard}
        forwarders={forwardersOptions}
        isSubmitting={isSubmitting}
      />

      {/* 2. Rate Card Detail Drawer */}
      <RateCardDetailDrawer
        card={detailCard}
        isOpen={!!detailCard}
        onClose={() => setDetailCard(null)}
        onEdit={(c) => {
          setDetailCard(null);
          handleOpenEditModal(c);
        }}
        onDelete={(id, name) => setDeleteCandidate({ id, name })}
      />

      {/* 3. Delete Confirmation Modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in">
          <div className="glass-card-strong relative w-full max-w-md rounded-t-[28px] rounded-b-none sm:rounded-[28px] border-t sm:border border-white/90 bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-240 ease-[cubic-bezier(0.16,1,0.3,1)] outline-none">
            {/* Mobile Tactile Drag Handle */}
            <div
              data-swipe-handle="true"
              className="mx-auto -mt-2 mb-3 flex h-6 w-full max-w-[140px] cursor-grab touch-none items-center justify-center sm:hidden select-none"
              aria-label="Drag down to dismiss"
            >
              <div className="h-1.5 w-12 rounded-full bg-slate-300" />
            </div>

            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-2xl bg-rose-50 text-rose-600 shadow-2xs shrink-0">
                <AlertTriangle className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Delete Rate Card?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 font-semibold border border-slate-100">
              {deleteCandidate.name}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteCandidate(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-rose-700 shadow-md transition-colors cursor-pointer"
              >
                Delete Rate Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
