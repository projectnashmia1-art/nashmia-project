import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  Clock,
  CheckCircle2,
  ShieldCheck,
  X,
  Bell,
  Mail,
  Smartphone,
  RefreshCw,
  Send,
  Sliders,
  Ship,
  Layers,
  Sparkles,
  ExternalLink,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type ShipmentAlert,
  type ShipmentSubscriptionPreferences,
  getShipmentSubscription,
  saveShipmentSubscription,
  fetchShipmentAlertsFromSupabase,
  triggerTestShipmentAlert,
} from "@/lib/tracking-alerts-service";
import type { FullBookingRecord } from "@/lib/supabase-services";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

interface TrackingAlertsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementRef?: string;
  booking?: FullBookingRecord | null;
  initialTab?: "alerts" | "subscribe";
  onSubscribedChange?: (isSubscribed: boolean) => void;
}

export function TrackingAlertsModal({
  open,
  onOpenChange,
  movementRef = "",
  booking,
  initialTab = "alerts",
  onSubscribedChange,
}: TrackingAlertsModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"alerts" | "subscribe">(initialTab);
  const [alerts, setAlerts] = useState<ShipmentAlert[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "delay" | "early" | "success" | "info">(
    "all",
  );

  // Subscription form state
  const [prefs, setPrefs] = useState<ShipmentSubscriptionPreferences>(() =>
    getShipmentSubscription(movementRef, user?.email || undefined),
  );
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [selectedTestType, setSelectedTestType] = useState<
    "delay" | "transshipment" | "customs" | "eta"
  >("delay");

  // Load real alerts from Supabase
  const loadAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const data = await fetchShipmentAlertsFromSupabase(movementRef, booking);
      setAlerts(data);
    } catch (err) {
      console.warn("[TrackingAlertsModal] Failed fetching alerts:", err);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, [movementRef, booking]);

  // Keep subscription in sync when modal opens or movementRef changes
  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      const currentPrefs = getShipmentSubscription(movementRef, user?.email || undefined);
      setPrefs(currentPrefs);
      void loadAlerts();
    }
  }, [open, movementRef, initialTab, user?.email, loadAlerts]);

  // Handle saving subscription
  const handleSavePreferences = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSavingPrefs(true);
    try {
      const res = await saveShipmentSubscription(prefs);
      toast.success(res.message, {
        description: `Channels: ${[
          prefs.inAppToastEnabled ? "In-App Toast" : null,
          prefs.emailEnabled ? `Email (${prefs.emailAddress})` : null,
        ]
          .filter(Boolean)
          .join(" + ")}`,
      });
      if (onSubscribedChange) {
        onSubscribedChange(prefs.inAppToastEnabled || prefs.emailEnabled);
      }
    } catch (err) {
      toast.error("Failed to save subscription preferences");
    } finally {
      setIsSavingPrefs(false);
    }
  };

  // Trigger test simulated alert
  const handleTriggerTest = async () => {
    setIsSendingTest(true);
    try {
      const newAlert = await triggerTestShipmentAlert({
        movementRef,
        alertType: selectedTestType,
        prefs,
        booking,
      });
      setAlerts((prev) => [newAlert, ...prev]);
    } catch (err) {
      toast.error("Failed to trigger test alert");
    } finally {
      setIsSendingTest(false);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filterType === "all") return true;
    return a.type === filterType;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-[620px] max-h-[92vh] flex flex-col p-0 overflow-hidden sm:rounded-[26px] bg-white shadow-2xl focus:outline-none">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAEFF5] px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
                <Clock className="size-3 text-slate-600" />
                <span>Operational Exceptions</span>
              </span>
              <span className="text-xs font-semibold text-[#009EE2]">Movement #{movementRef}</span>
            </div>
            <DialogTitle className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1.5 tracking-tight font-sans">
              Shipment Alerts & Subscriptions
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              Live operational exceptions, transit delay logs, and automated event notifications.
            </DialogDescription>
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="size-8 rounded-full bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors shadow-2xs cursor-pointer"
            aria-label="Close modal"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Switcher: Alerts Stream vs. Notification Subscription */}
        <div className="flex border-b border-slate-200 px-6 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={cn(
              "py-3 px-2 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer",
              activeTab === "alerts" ? "text-[#009EE2]" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Clock className="size-3.5" />
            <span>Alerts Feed ({alerts.length})</span>
            {activeTab === "alerts" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#009EE2] rounded-t-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subscribe")}
            className={cn(
              "py-3 px-2 text-xs font-bold transition-all relative flex items-center gap-2 cursor-pointer ml-4",
              activeTab === "subscribe" ? "text-[#009EE2]" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <Bell className="size-3.5" />
            <span>Subscribe to Status Updates</span>
            {(prefs.emailEnabled || prefs.inAppToastEnabled) && (
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
            {activeTab === "subscribe" && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-[#009EE2] rounded-t-full" />
            )}
          </button>
        </div>

        {/* TAB 1: ALERTS STREAM */}
        {activeTab === "alerts" && (
          <div>
            {/* Filter bar & Refresh */}
            <div className="px-6 py-2.5 bg-slate-50/70 border-b border-slate-150 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                <button
                  type="button"
                  onClick={() => setFilterType("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer",
                    filterType === "all"
                      ? "bg-[#0D1F3C] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
                  )}
                >
                  All ({alerts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("delay")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer",
                    filterType === "delay"
                      ? "bg-[#D84926] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
                  )}
                >
                  Delays
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("early")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer",
                    filterType === "early"
                      ? "bg-[#137333] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
                  )}
                >
                  Early / Expedited
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("success")}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer",
                    filterType === "success"
                      ? "bg-[#009EE2] text-white"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200",
                  )}
                >
                  Customs & VGM
                </button>
              </div>

              <button
                type="button"
                onClick={loadAlerts}
                disabled={isLoadingAlerts}
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
                title="Refresh alerts from Supabase"
              >
                <RefreshCw
                  className={cn(
                    "size-3 text-slate-500",
                    isLoadingAlerts && "animate-spin text-[#009EE2]",
                  )}
                />
                <span>{isLoadingAlerts ? "Syncing..." : "Sync"}</span>
              </button>
            </div>

            {/* Alerts List */}
            <div className="p-5 sm:p-6 max-h-[52vh] overflow-y-auto space-y-3.5 [scrollbar-width:thin]">
              {filteredAlerts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="size-12 rounded-full bg-slate-100 text-slate-400 grid place-items-center mx-auto mb-3">
                    <Clock className="size-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">
                    No alerts found in this category
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Vessel schedule and terminal milestone logs are operating normally.
                  </p>
                </div>
              ) : (
                filteredAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-[18px] border border-slate-200/90 bg-white hover:border-slate-300 transition-all space-y-2.5 shadow-2xs"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-start gap-2.5">
                        {alert.type === "delay" && (
                          <span className="grid size-6.5 place-items-center rounded-full bg-orange-100 text-[#D84926] shrink-0 mt-0.5">
                            <AlertCircle className="size-3.5" />
                          </span>
                        )}
                        {alert.type === "early" && (
                          <span className="grid size-6.5 place-items-center rounded-full bg-emerald-100 text-[#137333] shrink-0 mt-0.5">
                            <Clock className="size-3.5" />
                          </span>
                        )}
                        {alert.type === "success" && (
                          <span className="grid size-6.5 place-items-center rounded-full bg-blue-100 text-[#009EE2] shrink-0 mt-0.5">
                            <ShieldCheck className="size-3.5" />
                          </span>
                        )}
                        {alert.type === "info" && (
                          <span className="grid size-6.5 place-items-center rounded-full bg-slate-100 text-slate-600 shrink-0 mt-0.5">
                            <Ship className="size-3.5" />
                          </span>
                        )}
                        <div>
                          <h4 className="text-[13px] font-bold text-slate-900 leading-snug">
                            {alert.title}
                          </h4>
                          {alert.location && (
                            <span className="text-[10.5px] font-semibold text-slate-400">
                              Location: {alert.location}
                            </span>
                          )}
                        </div>
                      </div>

                      {alert.badge && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${
                            alert.badgeType === "orange"
                              ? "bg-[#FDECE7] text-[#D84926] border border-orange-200/60"
                              : alert.badgeType === "green"
                                ? "bg-[#E6F4EA] text-[#137333] border border-emerald-200/60"
                                : alert.badgeType === "blue"
                                  ? "bg-blue-50 text-[#009EE2] border border-blue-200/60"
                                  : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {alert.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-[12px] text-slate-600 leading-relaxed pl-9">
                      {alert.description}
                    </p>

                    <div className="pl-9 pt-1 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                      <span>{alert.timestamp}</span>
                      {alert.source === "supabase_notifications" && (
                        <span className="inline-flex items-center gap-1 text-[#009EE2] text-[10.5px] font-semibold">
                          <Check className="size-3" /> Supabase Verified
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer with Quick Simulation & Close */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("subscribe")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#009EE2] hover:text-[#0D74FF] transition-colors cursor-pointer"
                >
                  <Sliders className="size-3.5" />
                  <span>Configure Alert Channels & Rules</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-5 py-2 rounded-full bg-[#0D1F3C] text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
              >
                Close Feed
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: SUBSCRIBE TO STATUS UPDATES */}
        {activeTab === "subscribe" && (
          <form onSubmit={handleSavePreferences} className="flex flex-col">
            <div className="p-5 sm:p-6 max-h-[55vh] overflow-y-auto space-y-5 [scrollbar-width:thin]">
              {/* Delivery Channels Section */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Delivery Channels
                </h4>

                {/* In-App Toast Toggle */}
                <label className="flex items-start justify-between gap-3 p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="size-8 rounded-xl bg-blue-100 text-[#009EE2] flex items-center justify-center shrink-0 mt-0.5">
                      <Smartphone className="size-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">In-App Toast Alerts</div>
                      <div className="text-[11.5px] text-slate-500 leading-snug">
                        Immediate floating banner notification when ETA shifts or vessel milestones
                        log.
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.inAppToastEnabled}
                    onChange={(e) =>
                      setPrefs((p) => ({ ...p, inAppToastEnabled: e.target.checked }))
                    }
                    className="size-4.5 rounded text-[#009EE2] focus:ring-[#009EE2] mt-1 cursor-pointer"
                  />
                </label>

                {/* Email Notification Toggle & Input */}
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                  <label className="flex items-start justify-between gap-3 cursor-pointer">
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Mail className="size-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">Email Notifications</div>
                        <div className="text-[11.5px] text-slate-500 leading-snug">
                          Receive automated operational reports and exception digests in your inbox.
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.emailEnabled}
                      onChange={(e) => setPrefs((p) => ({ ...p, emailEnabled: e.target.checked }))}
                      className="size-4.5 rounded text-[#009EE2] focus:ring-[#009EE2] mt-1 cursor-pointer"
                    />
                  </label>

                  {prefs.emailEnabled && (
                    <div className="pl-11 pt-1">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Recipient Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={prefs.emailAddress}
                        onChange={(e) => setPrefs((p) => ({ ...p, emailAddress: e.target.value }))}
                        placeholder="operator@nashmia.com"
                        className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#009EE2]"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Status Update Trigger Rules */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Select Events to Track for #{movementRef}
                </h4>

                <div className="space-y-2">
                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-orange-500" />
                      <div>
                        <span className="font-bold text-slate-800">
                          Vessel Departure & Transit Delays
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Schedule adjustments (e.g., +18h weather, berth congestion)
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.subscribedEvents.departureDelay}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          subscribedEvents: {
                            ...p.subscribedEvents,
                            departureDelay: e.target.checked,
                          },
                        }))
                      }
                      className="size-4 rounded text-[#009EE2] focus:ring-[#009EE2] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <div>
                        <span className="font-bold text-slate-800">
                          Transshipment & Feeder Hubs
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Intermediate port arrival and feeder connection confirmation (Colombo)
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.subscribedEvents.transshipmentUpdate}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          subscribedEvents: {
                            ...p.subscribedEvents,
                            transshipmentUpdate: e.target.checked,
                          },
                        }))
                      }
                      className="size-4 rounded text-[#009EE2] focus:ring-[#009EE2] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-blue-500" />
                      <div>
                        <span className="font-bold text-slate-800">
                          Port of Discharge ETA Shifts
                        </span>
                        <p className="text-[11px] text-slate-500">
                          Destination ETA changes, pilot boardings, and berthing
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.subscribedEvents.portArrivalEta}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          subscribedEvents: {
                            ...p.subscribedEvents,
                            portArrivalEta: e.target.checked,
                          },
                        }))
                      }
                      className="size-4 rounded text-[#009EE2] focus:ring-[#009EE2] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-indigo-500" />
                      <div>
                        <span className="font-bold text-slate-800">
                          Customs & Terminal Gate-In / Out
                        </span>
                        <p className="text-[11px] text-slate-500">
                          VGM approval, OCR seal scans, and terminal release
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.subscribedEvents.customsGateInOut}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          subscribedEvents: {
                            ...p.subscribedEvents,
                            customsGateInOut: e.target.checked,
                          },
                        }))
                      }
                      className="size-4 rounded text-[#009EE2] focus:ring-[#009EE2] cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 rounded-xl border border-slate-150 bg-white hover:bg-slate-50 cursor-pointer text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="size-2 rounded-full bg-slate-400" />
                      <div>
                        <span className="font-bold text-slate-800">Daily Satellite AIS Pings</span>
                        <p className="text-[11px] text-slate-500">
                          Automated 24h nautical telemetry coordinates and speed
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.subscribedEvents.aisLivePing}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          subscribedEvents: {
                            ...p.subscribedEvents,
                            aisLivePing: e.target.checked,
                          },
                        }))
                      }
                      className="size-4 rounded text-[#009EE2] focus:ring-[#009EE2] cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Instant Simulation / Test Section */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#009EE2]" />
                  <span className="text-xs font-bold text-slate-900">Test Delivery Pipeline</span>
                </div>
                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                  Trigger an immediate simulated update to preview how your selected In-App Toast
                  and Email channels receive notifications:
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <select
                    value={selectedTestType}
                    onChange={(e) =>
                      setSelectedTestType(
                        e.target.value as "delay" | "transshipment" | "customs" | "eta",
                      )
                    }
                    className="text-xs px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="delay">Weather Delay (+18h)</option>
                    <option value="transshipment">Colombo Hub Connection</option>
                    <option value="customs">Customs & VGM Clearance</option>
                    <option value="eta">Early ETA (-1d)</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleTriggerTest}
                    disabled={isSendingTest}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#009EE2] text-white text-xs font-bold hover:bg-[#0D74FF] transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Send className="size-3" />
                    <span>{isSendingTest ? "Sending..." : "Send Test Alert"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setActiveTab("alerts")}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                ← Back to Alerts Feed
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 rounded-full border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingPrefs}
                  className="px-5 py-2 rounded-full bg-[#0D1F3C] text-white text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingPrefs ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Preferences</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export default TrackingAlertsModal;
