import { useState, useRef, useEffect } from "react";
import { Anchor, ArrowRight, Check, ChevronDown, Compass, MapPin, Search } from "lucide-react";
import { PORTS_OF_LOADING, PORTS_OF_DISCHARGE, type Port } from "@/lib/booking-data";
import { cn } from "@/lib/utils";

interface RouteSectionProps {
  pol: Port | null;
  onSelectPol: (port: Port) => void;
  pod: Port | null;
  onSelectPod: (port: Port) => void;
  errors?: {
    pol?: string;
    pod?: string;
  };
}

export function RouteSection({ pol, onSelectPol, pod, onSelectPod, errors }: RouteSectionProps) {
  const [polOpen, setPolOpen] = useState(false);
  const [polSearch, setPolSearch] = useState("");
  const [podOpen, setPodOpen] = useState(false);
  const [podSearch, setPodSearch] = useState("");

  const polRef = useRef<HTMLDivElement>(null);
  const podRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (polRef.current && !polRef.current.contains(event.target as Node)) {
        setPolOpen(false);
      }
      if (podRef.current && !podRef.current.contains(event.target as Node)) {
        setPodOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPol = PORTS_OF_LOADING.filter(
    (p) =>
      p.name.toLowerCase().includes(polSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(polSearch.toLowerCase()) ||
      p.country.toLowerCase().includes(polSearch.toLowerCase()),
  );

  const filteredPod = PORTS_OF_DISCHARGE.filter(
    (p) =>
      p.name.toLowerCase().includes(podSearch.toLowerCase()) ||
      p.code.toLowerCase().includes(podSearch.toLowerCase()) ||
      p.country.toLowerCase().includes(podSearch.toLowerCase()),
  );

  return (
    <section
      id="section-route"
      className="glass-card rounded-[24px] p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(15,23,42,0.06)]"
    >
      {/* Section Header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#6A80A9]/10 text-xs font-bold text-[#6A80A9]">
              02
            </span>
            <h2 className="text-xl font-bold tracking-tight text-black sm:text-2xl">Route</h2>
          </div>
          <p className="text-xs text-slate-500 sm:text-sm">
            Define where the container is loading and where it is going.
          </p>
        </div>
        <span className="hidden rounded-full border border-slate-200/80 bg-white/60 px-3 py-1 text-[11px] font-medium text-slate-500 sm:inline-block">
          Maritime Corridor
        </span>
      </div>

      {/* Route Inputs with Central Directional Visualizer */}
      <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        {/* PORT OF LOADING */}
        <div className="space-y-2" ref={polRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Port of Loading (POL) <span className="text-rose-500">*</span>
            </label>
            {pol && (
              <span className="rounded-md bg-[#6A80A9]/10 px-2 py-0.5 text-[10px] font-bold text-[#6A80A9]">
                {pol.code}
              </span>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setPolOpen((prev) => !prev);
                setPodOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[16px] border bg-white/80 px-4 py-3.5 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30",
                polOpen ? "border-[#6A80A9] ring-2 ring-[#6A80A9]/20" : "border-slate-200/90",
                errors?.pol && !pol && "border-rose-400 bg-rose-50/30",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Anchor className="size-4 text-[#6A80A9]" />
                </div>
                <div>
                  {pol ? (
                    <div>
                      <p className="font-semibold text-black">{pol.name}</p>
                      <p className="text-[11px] text-slate-500">{pol.fullLabel}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select origin port...</span>
                  )}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-slate-400 transition-transform duration-200",
                  polOpen && "rotate-180 text-black",
                )}
              />
            </button>

            {errors?.pol && !pol && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">{errors.pol}</p>
            )}

            {polOpen && (
              <div className="glass-card-strong absolute z-30 mt-2 max-h-64 w-full overflow-hidden rounded-[18px] border border-white/90 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={polSearch}
                    onChange={(e) => setPolSearch(e.target.value)}
                    placeholder="Search origin port or country..."
                    className="w-full rounded-xl border border-slate-200/80 bg-white/95 py-2 pl-9 pr-3 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredPol.map((port) => (
                    <button
                      key={port.code}
                      type="button"
                      onClick={() => {
                        onSelectPol(port);
                        setPolOpen(false);
                        setPolSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-[#E8F1F3]/80",
                        pol?.code === port.code && "bg-[#6A80A9]/10 font-semibold text-[#6A80A9]",
                      )}
                    >
                      <div>
                        <span className="font-semibold text-black">{port.name}</span>
                        <span className="ml-2 text-[11px] text-slate-500">
                          {port.code} • {port.country}
                        </span>
                      </div>
                      {pol?.code === port.code && <Check className="size-4 text-[#6A80A9]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DIRECTIONAL VISUALIZER */}
        <div className="my-2 flex flex-col items-center justify-center px-2 lg:my-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            <span>PORT OF LOADING</span>
            <ArrowRight className="size-3 text-[#6A80A9]" />
            <span>PORT OF DISCHARGE</span>
          </div>

          <div className="relative mt-2 flex w-full min-w-[140px] items-center justify-center">
            <div className="h-[2px] w-full bg-gradient-to-r from-[#6A80A9]/20 via-[#6A80A9] to-[#6A80A9]/20" />
            <div className="absolute flex size-7 items-center justify-center rounded-full border border-white bg-white shadow-sm ring-2 ring-[#6A80A9]/20">
              <Compass className="size-3.5 text-[#6A80A9] animate-[spin_12s_linear_infinite]" />
            </div>
          </div>

          <span className="mt-1 text-[11px] font-medium text-slate-500">
            {pol?.code ?? "POL"} → {pod?.code ?? "POD"}
          </span>
        </div>

        {/* PORT OF DISCHARGE */}
        <div className="space-y-2" ref={podRef}>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Port of Discharge (POD) <span className="text-rose-500">*</span>
            </label>
            {pod && (
              <span className="rounded-md bg-[#6A80A9]/10 px-2 py-0.5 text-[10px] font-bold text-[#6A80A9]">
                {pod.code}
              </span>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setPodOpen((prev) => !prev);
                setPolOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-[16px] border bg-white/80 px-4 py-3.5 text-left text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#6A80A9]/30",
                podOpen ? "border-[#6A80A9] ring-2 ring-[#6A80A9]/20" : "border-slate-200/90",
                errors?.pod && !pod && "border-rose-400 bg-rose-50/30",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <MapPin className="size-4 text-[#6A80A9]" />
                </div>
                <div>
                  {pod ? (
                    <div>
                      <p className="font-semibold text-black">{pod.name}</p>
                      <p className="text-[11px] text-slate-500">{pod.fullLabel}</p>
                    </div>
                  ) : (
                    <span className="text-slate-400">Select destination port...</span>
                  )}
                </div>
              </div>
              <ChevronDown
                className={cn(
                  "size-4 text-slate-400 transition-transform duration-200",
                  podOpen && "rotate-180 text-black",
                )}
              />
            </button>

            {errors?.pod && !pod && (
              <p className="mt-1 text-[11px] font-medium text-rose-500">{errors.pod}</p>
            )}

            {podOpen && (
              <div className="glass-card-strong absolute z-30 mt-2 max-h-64 w-full overflow-hidden rounded-[18px] border border-white/90 p-2 shadow-[0_16px_40px_rgba(15,23,42,0.12)] animate-in fade-in zoom-in-95">
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-3.5 top-2.5 size-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={podSearch}
                    onChange={(e) => setPodSearch(e.target.value)}
                    placeholder="Search destination port or country..."
                    className="w-full rounded-xl border border-slate-200/80 bg-white/95 py-2 pl-9 pr-3 text-xs text-black placeholder:text-slate-400 focus:border-[#6A80A9] focus:outline-none"
                    autoFocus
                  />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {filteredPod.map((port) => (
                    <button
                      key={port.code}
                      type="button"
                      onClick={() => {
                        onSelectPod(port);
                        setPodOpen(false);
                        setPodSearch("");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-[#E8F1F3]/80",
                        pod?.code === port.code && "bg-[#6A80A9]/10 font-semibold text-[#6A80A9]",
                      )}
                    >
                      <div>
                        <span className="font-semibold text-black">{port.name}</span>
                        <span className="ml-2 text-[11px] text-slate-500">
                          {port.code} • {port.country}
                        </span>
                      </div>
                      {pod?.code === port.code && <Check className="size-4 text-[#6A80A9]" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
