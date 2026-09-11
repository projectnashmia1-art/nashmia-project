import { useState, useRef, useEffect, useMemo } from "react";
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileSpreadsheet,
  Receipt,
  Route as RouteIcon,
  Search,
  Send,
  Ship,
  Sparkles,
  X,
} from "lucide-react";
import {
  SHIPPING_LINES,
  BOOKING_AGENTS,
  RATE_CARDS,
  type ShippingLine,
  type BookingAgent,
  type RateCard,
  type Port,
  type ContainerSize,
} from "@/lib/booking-data";
import { cn } from "@/lib/utils";

interface ShippingSectionProps {
  shippingLine: ShippingLine | null;
  onSelectShippingLine: (line: ShippingLine) => void;
  bookingAgent: BookingAgent | null;
  onSelectBookingAgent: (agent: BookingAgent) => void;
  selectedBookingAgents?: BookingAgent[];
  onSelectBookingAgents?: (agents: BookingAgent[]) => void;
  pol: Port | null;
  pod: Port | null;
  containerSize: ContainerSize;
  matchedRate: RateCard | null;
  availableShippingLines?: ShippingLine[];
  availableBookingAgents?: BookingAgent[];
  errors?: {
    shippingLine?: string;
    bookingAgent?: string;
  };
}

export function ShippingSection({
  shippingLine,
  onSelectShippingLine,
  bookingAgent,
  onSelectBookingAgent,
  selectedBookingAgents,
  onSelectBookingAgents,
  pol,
  pod,
  containerSize,
  matchedRate,
  availableShippingLines = SHIPPING_LINES,
  availableBookingAgents = BOOKING_AGENTS,
  errors,
}: ShippingSectionProps) {
  const [lineOpen, setLineOpen] = useState(false);
  const [lineSearch, setLineSearch] = useState("");
  const [agentOpen, setAgentOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  const [rateDirectoryOpen, setRateDirectoryOpen] = useState(false);

  const lineRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (lineRef.current && !lineRef.current.contains(event.target as Node)) {
        setLineOpen(false);
      }
      if (agentRef.current && !agentRef.current.contains(event.target as Node)) {
        setAgentOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const linesList = availableShippingLines.length > 0 ? availableShippingLines : SHIPPING_LINES;
  const agentsList = availableBookingAgents.length > 0 ? availableBookingAgents : BOOKING_AGENTS;

  // Resolved list of selected agents
  const selectedAgents: BookingAgent[] = useMemo(() => {
    if (selectedBookingAgents && selectedBookingAgents.length > 0) {
      return selectedBookingAgents;
    }
    return bookingAgent ? [bookingAgent] : [];
  }, [selectedBookingAgents, bookingAgent]);

  const filteredLines = linesList.filter(
    (l) =>
      l.name.toLowerCase().includes(lineSearch.toLowerCase()) ||
      l.code.toLowerCase().includes(lineSearch.toLowerCase()),
  );

  const filteredAgents = agentsList.filter(
    (a) =>
      a.name.toLowerCase().includes(agentSearch.toLowerCase()) ||
      (a.code && a.code.toLowerCase().includes(agentSearch.toLowerCase())) ||
      (a.contractTier && a.contractTier.toLowerCase().includes(agentSearch.toLowerCase())) ||
      (a.email && a.email.toLowerCase().includes(agentSearch.toLowerCase())),
  );

  const handleToggleAgent = (agent: BookingAgent) => {
    const isSelected = selectedAgents.some((a) => a.id === agent.id);
    let next: BookingAgent[];
    if (isSelected) {
      next = selectedAgents.filter((a) => a.id !== agent.id);
    } else {
      next = [...selectedAgents, agent];
    }
    if (onSelectBookingAgents) {
      onSelectBookingAgents(next);
    }
    if (next.length > 0) {
      onSelectBookingAgent(next[0]);
    }
  };

  const handleRemoveAgent = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selectedAgents.filter((a) => a.id !== agentId);
    if (onSelectBookingAgents) {
      onSelectBookingAgents(next);
    }
    if (next.length > 0) {
      onSelectBookingAgent(next[0]);
    }
  };

  const handleSelectAllAgents = () => {
    if (onSelectBookingAgents) {
      onSelectBookingAgents(agentsList);
    }
    if (agentsList.length > 0) {
      onSelectBookingAgent(agentsList[0]);
    }
  };

  const handleClearAgents = () => {
    if (onSelectBookingAgents) {
      onSelectBookingAgents([]);
    }
  };

  return (
    <section
      id="section-shipping"
      className="glass-card rounded-[24px] p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#6A80A9]/10 text-xs font-bold text-[#6A80A9]">
              03
            </span>
            <h2 className="text-xl font-bold tracking-tight text-black sm:text-2xl">
              Shipping Details
            </h2>
          </div>
          <p className="text-xs text-slate-500 sm:text-sm">
            Select the carrier and booking partner for freight procurement.
          </p>
        </div>
        <span className="hidden rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-[11px] font-medium text-slate-500 sm:inline-block">
          Approved Rate Cards
        </span>
      </div>

      {/* Grid of Shipping Line and Forwarder */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* SHIPPING LINE */}
        <div className="space-y-2" ref={lineRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Shipping Line <span className="text-rose-500">*</span>
            </label>
            {shippingLine && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                {shippingLine.code}
              </span>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setLineOpen((prev) => !prev);
                setAgentOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[16px] border bg-white/80 px-4 py-3.5 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30",
                lineOpen ? "border-[#6A80A9] ring-2 ring-[#6A80A9]/20" : "border-slate-200/90",
                errors?.shippingLine && !shippingLine && "border-rose-400 bg-rose-50/30",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Ship className="size-4 text-[#6A80A9]" />
                </div>
                <div>
                  {shippingLine ? (
                    <div>
                      <p className="font-semibold text-black">{shippingLine.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {shippingLine.vesselsActive} Vessels operating globally
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select shipping line...</span>
                  )}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-slate-400 transition-transform duration-200",
                  lineOpen && "rotate-180 text-black",
                )}
              />
            </button>

            {errors?.shippingLine && !shippingLine && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">{errors.shippingLine}</p>
            )}

            {lineOpen && (
              <div className="glass-card-strong absolute z-30 mt-2 max-h-64 w-full overflow-hidden rounded-[18px] border border-white/90 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={lineSearch}
                    onChange={(e) => setLineSearch(e.target.value)}
                    placeholder="Search carrier..."
                    className="w-full rounded-xl border border-slate-200/80 bg-white/95 py-2 pl-9 pr-3 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredLines.map((line) => (
                    <button
                      key={line.id}
                      type="button"
                      onClick={() => {
                        onSelectShippingLine(line);
                        setLineOpen(false);
                        setLineSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-[#E8F1F3]/80",
                        shippingLine?.id === line.id &&
                          "bg-[#6A80A9]/10 font-semibold text-[#6A80A9]",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-black">{line.name}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                          {line.code}
                        </span>
                      </div>
                      {shippingLine?.id === line.id && <Check className="size-4 text-[#6A80A9]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BOOKING AGENT / FORWARDER */}
        <div className="space-y-2" ref={agentRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Booking Agents / Forwarders <span className="text-rose-500">*</span>
            </label>
            {selectedAgents.length > 0 && (
              <span className="rounded-md bg-[#6A80A9]/10 px-2 py-0.5 text-[10px] font-semibold text-[#6A80A9]">
                {selectedAgents.length === 1
                  ? selectedAgents[0].contractTier || "1 Forwarder"
                  : `${selectedAgents.length} Forwarders Selected`}
              </span>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setAgentOpen((prev) => !prev);
                setLineOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[16px] border bg-white/80 px-4 py-3.5 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30",
                agentOpen ? "border-[#6A80A9] ring-2 ring-[#6A80A9]/20" : "border-slate-200/90",
                errors?.bookingAgent &&
                  selectedAgents.length === 0 &&
                  "border-rose-400 bg-rose-50/30",
              )}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Send className="size-4 text-[#6A80A9]" />
                </div>
                <div className="min-w-0 flex-1">
                  {selectedAgents.length === 0 ? (
                    <span className="text-slate-400">Select booking agents / forwarders...</span>
                  ) : selectedAgents.length === 1 ? (
                    <div>
                      <p className="font-semibold text-black truncate">{selectedAgents[0].name}</p>
                      <p className="text-[11px] text-slate-500 truncate">
                        {selectedAgents[0].contractTier || "Booking Agent"}
                        {selectedAgents[0].code ? ` • ${selectedAgents[0].code}` : ""}
                        {selectedAgents[0].email ? ` • ${selectedAgents[0].email}` : ""}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-black truncate">
                        {selectedAgents.length} Forwarders Selected
                      </p>
                      <p className="text-[11px] text-[#6A80A9] truncate font-medium">
                        {selectedAgents.map((a) => a.name).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-slate-400 transition-transform duration-200 ml-2",
                  agentOpen && "rotate-180 text-black",
                )}
              />
            </button>

            {/* Selected chips row when multiple forwarders are selected */}
            {selectedAgents.length > 1 && (
              <div className="mt-2 flex flex-wrap gap-1.5 animate-in fade-in">
                {selectedAgents.map((agent) => (
                  <span
                    key={agent.id}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#6A80A9]/20 bg-[#E8F1F3]/80 px-2 py-1 text-[11px] font-medium text-slate-800"
                  >
                    <span className="font-semibold">{agent.name}</span>
                    {agent.email && (
                      <span className="text-[10px] text-slate-500">({agent.email})</span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => handleRemoveAgent(agent.id, e)}
                      className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                      title={`Remove ${agent.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {errors?.bookingAgent && selectedAgents.length === 0 && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">{errors.bookingAgent}</p>
            )}

            {agentOpen && (
              <div className="glass-card-strong absolute z-30 mt-2 max-h-80 w-full overflow-hidden rounded-[18px] border border-white/90 p-2.5 shadow-[0_16px_40px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95">
                {/* Search & Quick Multi-Select Actions */}
                <div className="mb-2 space-y-2 px-1">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-2.5 size-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      placeholder="Search forwarder name, email, code..."
                      className="w-full rounded-xl border border-slate-200/80 bg-white/95 py-2 pl-9 pr-3 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                    <span className="font-semibold text-slate-700">
                      {selectedAgents.length} of {agentsList.length} forwarders selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAllAgents}
                        className="text-[#6A80A9] hover:underline font-semibold"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={handleClearAgents}
                        className="text-slate-400 hover:text-slate-700 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                  {filteredAgents.map((agent) => {
                    const isSelected = selectedAgents.some((a) => a.id === agent.id);
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => handleToggleAgent(agent)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-colors hover:bg-[#E8F1F3]/80",
                          isSelected
                            ? "bg-[#6A80A9]/10 font-semibold text-[#6A80A9] border border-[#6A80A9]/20"
                            : "border border-transparent",
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-black truncate">{agent.name}</span>
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              {agent.code}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span className="truncate">{agent.contractTier}</span>
                            {agent.email && (
                              <>
                                <span>•</span>
                                <span className="truncate font-mono text-[10.5px] text-slate-400">
                                  {agent.email}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Checkbox indicator */}
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-md border transition-all",
                            isSelected
                              ? "border-[#6A80A9] bg-[#6A80A9] text-white shadow-xs"
                              : "border-slate-300 bg-white",
                          )}
                        >
                          {isSelected && <Check className="size-3.5 stroke-[2.5]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dropdown Footer Done Button */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between px-1">
                  <span className="text-[10.5px] text-slate-400">
                    Emails will be sent to all selected forwarders
                  </span>
                  <button
                    type="button"
                    onClick={() => setAgentOpen(false)}
                    className="rounded-lg bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    Done ({selectedAgents.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DEDICATED ELEGANT GLASS RATE PANEL — PREMIUM FEATURE */}
      <div className="mt-6">
        {matchedRate ? (
          <div className="relative overflow-hidden rounded-[22px] border border-white/90 bg-gradient-to-br from-white/95 via-white/85 to-[#E8F1F3]/40 p-5 shadow-[0_12px_35px_rgba(15,23,42,0.04),inset_0_1px_2px_rgba(255,255,255,1)] backdrop-blur-xl transition-all duration-300">
            {/* Top Bar with Status Tag */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-[#C7D5BF]/40 text-[#2D3C26]">
                  <Receipt className="size-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                    Agreed Freight Rate
                  </h3>
                  <p className="text-[11px] text-slate-400">Commercial Rate Card Agreement</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D5BF] bg-[#C7D5BF]/30 px-3 py-1 text-xs font-semibold text-[#2D3C26]">
                  <span className="size-1.5 rounded-full bg-[#2D3C26]" />
                  Rate matched
                </span>
                <span className="text-xs text-slate-400">Valid to {matchedRate.validUntil}</span>
              </div>
            </div>

            {/* Rate Value & Details */}
            <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-black sm:text-4xl">
                    ${matchedRate.ratePerContainer.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium uppercase text-slate-500">
                    USD / container
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {matchedRate.agentName} • {pol?.name ?? matchedRate.polCode} →{" "}
                  {pod?.name ?? matchedRate.podCode} • {containerSize}
                </p>
                <p className="text-[11px] text-slate-400">Card: {matchedRate.cardName}</p>
              </div>

              <button
                type="button"
                onClick={() => setRateDirectoryOpen(true)}
                className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200/80 bg-white/90 px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 sm:self-end"
              >
                <FileSpreadsheet className="size-3.5 text-[#6A80A9]" />
                <span>View Rate Schedule</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-[20px] border border-dashed border-slate-300/80 bg-[#E8F1F3]/25 p-5 transition-all">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <AlertCircle className="size-4.5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">No active rate card found</p>
                  <p className="text-[11px] text-slate-500">
                    {bookingAgent && pol && pod
                      ? `No negotiated monthly rate for ${bookingAgent.name} on ${pol.code} → ${pod.code} (${containerSize})`
                      : "Select booking agent, origin, destination, and container size to match rate."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setRateDirectoryOpen(true)}
                className="rounded-xl border border-slate-200/90 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 shadow-sm transition-all hover:bg-slate-50"
              >
                Review Rate Cards
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RATE CARDS MODAL / DIRECTORY VIEWER */}
      {rateDirectoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4 backdrop-blur-md animate-in fade-in">
          <div className="glass-card-strong w-full max-w-2xl rounded-[24px] border border-white/95 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-[#6A80A9]/10 text-[#6A80A9]">
                  <Receipt className="size-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-black">Active Monthly Rate Cards</h3>
                  <p className="text-xs text-slate-500">
                    Approved contracts for Nashmia Industries Q3 freight procurement
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRateDirectoryOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-black"
              >
                <X className="size-4.5" />
              </button>
            </div>

            <div className="mt-4 max-h-80 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
              {RATE_CARDS.map((card, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center justify-between rounded-xl border p-3 text-xs transition-colors",
                    matchedRate?.cardName === card.cardName &&
                      matchedRate.agentId === card.agentId &&
                      matchedRate.size === card.size
                      ? "border-[#C7D5BF] bg-[#C7D5BF]/20 font-semibold"
                      : "border-slate-200/80 bg-white/70 hover:bg-slate-50",
                  )}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-black">{card.agentName}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-medium">
                        {card.size}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      {card.polCode} → {card.podCode} • Card: {card.cardName}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-black">
                      ${card.ratePerContainer.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-slate-400">Valid to {card.validUntil}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setRateDirectoryOpen(false)}
                className="rounded-xl bg-black px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              >
                Close Rate Cards
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
