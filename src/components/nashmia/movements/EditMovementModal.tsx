import React, { useState, useEffect } from "react";
import {
  X,
  Ship,
  MapPin,
  Calendar,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Anchor,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { updateBookingDetailsInSupabase } from "@/lib/supabase-services";
import { toDbBookingStatus, toDbMovementStatus } from "@/lib/movement-lifecycle";
import type { Movement } from "@/lib/nashmia-data";

interface EditMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  movement: (Movement & { id?: string }) | null;
  onUpdated?: () => void;
}

const LIFECYCLE_STATUS_OPTIONS = [
  { value: "Booking Requested", label: "Booking Requested (Pending Quote)" },
  { value: "Confirmed", label: "Booking Confirmed" },
  { value: "In Transit", label: "In Transit / Sailing" },
  { value: "Delivered", label: "Delivered" },
  { value: "Draft", label: "Draft" },
  { value: "Cancelled", label: "Cancelled" },
];

export function EditMovementModal({
  isOpen,
  onClose,
  movement,
  onUpdated,
}: EditMovementModalProps) {
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [pol, setPol] = useState("");
  const [pod, setPod] = useState("");
  const [vessel, setVessel] = useState("");
  const [voyageNumber, setVoyageNumber] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [status, setStatus] = useState("Booking Requested");
  const [totalFreight, setTotalFreight] = useState<string>("");

  useEffect(() => {
    if (movement) {
      setPol(movement.pol !== "Pending" ? movement.pol : "");
      setPod(movement.pod !== "Pending" ? movement.pod : "");
      setVessel(movement.vessel !== "Pending" ? movement.vessel : "");
      setVoyageNumber("");

      // Parse dates if present
      if (movement.etd && movement.etd !== "Pending" && movement.etd !== "—") {
        const parsedEtd = new Date(movement.etd);
        if (!isNaN(parsedEtd.getTime())) {
          setEtd(parsedEtd.toISOString().slice(0, 10));
        } else {
          setEtd("");
        }
      } else {
        setEtd("");
      }

      if (movement.eta && movement.eta !== "Pending" && movement.eta !== "—") {
        const parsedEta = new Date(movement.eta);
        if (!isNaN(parsedEta.getTime())) {
          setEta(parsedEta.toISOString().slice(0, 10));
        } else {
          setEta("");
        }
      } else {
        setEta("");
      }

      setStatus(movement.stage || "Booking Requested");

      // Extract numeric freight rate
      if (movement.rate) {
        const num = movement.rate.replace(/[^0-9.]/g, "");
        setTotalFreight(num || "");
      } else {
        setTotalFreight("");
      }
    }
  }, [movement, isOpen]);

  if (!isOpen || !movement) return null;

  const targetId = movement.id || movement.ref;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) {
      toast.error("Movement ID or Reference is missing");
      return;
    }

    setIsSaving(true);
    try {
      const dbStatus = toDbBookingStatus(status);
      const updates: Record<string, unknown> = {
        origin: pol.trim() || null,
        destination: pod.trim() || null,
        pol_name: pol.trim() || null,
        pod_name: pod.trim() || null,
        pol_code: pol.trim().slice(0, 5).toUpperCase() || null,
        pod_code: pod.trim().slice(0, 5).toUpperCase() || null,
        vessel_name: vessel.trim() || null,
        voyage_number: voyageNumber.trim() || null,
        etd: etd || null,
        eta: eta || null,
        status: dbStatus,
        movement_status: toDbMovementStatus(status),
        is_movement_confirmed: dbStatus === "Confirmed",
        total_freight: totalFreight ? Number(totalFreight) : null,
      };

      await updateBookingDetailsInSupabase(targetId, updates);

      queryClient.invalidateQueries({ queryKey: ["dashboard-bookings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      queryClient.invalidateQueries({ queryKey: ["movements"] });

      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("nashmia_bookings_updated", {
            detail: { updated: true, id: targetId },
          }),
        );
      }

      toast.success("Movement Updated Successfully!", {
        description: `Changes to ${movement.ref} have been persisted in the database.`,
      });

      onUpdated?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to update movement";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 sm:p-7 overflow-hidden text-slate-900 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[#E8F1F3] text-[#0FA3B1]">
              <Ship className="size-5.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Update Movement</span>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                  {movement.ref}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Edit real database fields for this logistics lifecycle record.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          {/* POL & POD */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="size-3 text-[#0FA3B1]" />
                Port of Loading (POL)
              </label>
              <input
                type="text"
                value={pol}
                onChange={(e) => setPol(e.target.value)}
                placeholder="e.g. FXT (Felixstowe)"
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="size-3 text-[#0FA3B1]" />
                Port of Discharge (POD)
              </label>
              <input
                type="text"
                value={pod}
                onChange={(e) => setPod(e.target.value)}
                placeholder="e.g. KHI (Karachi)"
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Vessel & Voyage */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Anchor className="size-3 text-[#0FA3B1]" />
                Vessel Name
              </label>
              <input
                type="text"
                value={vessel}
                onChange={(e) => setVessel(e.target.value)}
                placeholder="e.g. MSC ISABELLA"
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Layers className="size-3 text-[#0FA3B1]" />
                Voyage Number
              </label>
              <input
                type="text"
                value={voyageNumber}
                onChange={(e) => setVoyageNumber(e.target.value)}
                placeholder="e.g. V.2410"
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition"
              />
            </div>
          </div>

          {/* ETD & ETA */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="size-3 text-[#0FA3B1]" />
                ETD (Departure)
              </label>
              <input
                type="date"
                value={etd}
                onChange={(e) => setEtd(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="size-3 text-[#0FA3B1]" />
                ETA (Arrival)
              </label>
              <input
                type="date"
                value={eta}
                onChange={(e) => setEta(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Status & Total Freight */}
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <CheckCircle2 className="size-3 text-[#0FA3B1]" />
                Lifecycle Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition cursor-pointer font-medium"
              >
                {LIFECYCLE_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                <DollarSign className="size-3 text-[#0FA3B1]" />
                Total Freight ($ USD)
              </label>
              <input
                type="number"
                value={totalFreight}
                onChange={(e) => setTotalFreight(e.target.value)}
                placeholder="e.g. 2450"
                min="0"
                step="50"
                className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0FA3B1] focus:outline-none transition"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="h-10 px-5 rounded-xl bg-black hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Saving to DB...</span>
                </>
              ) : (
                <span>Save Database Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
