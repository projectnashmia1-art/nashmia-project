import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Ship,
  Navigation,
  Layers,
  MapPin,
  Anchor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  resolveLocationCoords,
  generateMaritimeRoutePath,
  calculateVesselPositionOnRoute,
} from "@/lib/maritime-routing";

export interface TrackingMapSectionProps {
  originName?: string;
  originCountryCode?: string;
  polName?: string;
  polCountryCode?: string;
  transshipmentName?: string;
  transCountryCode?: string;
  destinationName?: string;
  destCountryCode?: string;
  vesselName?: string;
  vesselStatus?: string;
  etaFormatted?: string;
  className?: string;
}

export function TrackingMapSection({
  originName = "Kettering",
  originCountryCode = "GB",
  polName = "London Gateway",
  polCountryCode = "GB",
  transshipmentName = "Colombo",
  transCountryCode = "LK",
  destinationName = "Karachi",
  destCountryCode = "PK",
  vesselName = "MSC MARTINA MARIA (9540077)",
  vesselStatus = "In Transit (+18h)",
  etaFormatted = "31 Oct 2026",
  className,
}: TrackingMapSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapType, setMapType] = useState<"positron" | "osm">("positron");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);

  // Compute realistic dynamic coordinates from movement data
  const originCoords = useMemo(
    () => resolveLocationCoords(originName || polName),
    [originName, polName],
  );
  const polCoords = useMemo(
    () => resolveLocationCoords(polName || originName),
    [polName, originName],
  );
  const destCoords = useMemo(() => resolveLocationCoords(destinationName), [destinationName]);
  const transshipmentCoords = useMemo(
    () => (transshipmentName ? resolveLocationCoords(transshipmentName) : null),
    [transshipmentName],
  );

  // Generate dynamic maritime navigation route path
  const routeWaypoints = useMemo(() => {
    return generateMaritimeRoutePath(polCoords, destCoords, transshipmentCoords);
  }, [polCoords, destCoords, transshipmentCoords]);

  // Current vessel position along sea route
  const vesselTelemetry = useMemo(() => {
    return calculateVesselPositionOnRoute(routeWaypoints, 0.68);
  }, [routeWaypoints]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false, // Prevent accidental scrolling hijacking on page
      touchZoom: true,
      dragging: true,
      maxBounds: [
        [-85, -180],
        [85, 180],
      ],
      minZoom: 2,
      maxZoom: 16,
    });

    mapInstanceRef.current = map;

    // Tile Layer: High-clarity CartoDB Positron (matches uploaded reference design)
    const tileUrl =
      mapType === "positron"
        ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const tileLayer = L.tileLayer(tileUrl, {
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // 1. Draw Background Soft Glow Route Path
    L.polyline(routeWaypoints, {
      color: "#0D74FF",
      weight: 6,
      opacity: 0.28,
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // 2. Draw Active Animated Nautical Route Path
    const activeRoute = L.polyline(routeWaypoints, {
      color: "#009EE2",
      weight: 3.5,
      opacity: 0.95,
      dashArray: "6, 7",
      lineCap: "round",
      lineJoin: "round",
    }).addTo(map);

    // 3. Port of Loading (POL) Custom HTML Marker
    const polIcon = L.divIcon({
      className: "custom-leaflet-marker",
      html: `
        <div class="relative flex items-center justify-center group cursor-pointer">
          <div class="size-7 rounded-full bg-white shadow-md border-2 border-[#009EE2] flex items-center justify-center transition-transform hover:scale-110">
            <svg class="size-4 text-[#009EE2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="5" r="3"/>
              <line x1="12" y1="22" x2="12" y2="8"/>
              <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
            </svg>
          </div>
          <div class="absolute -top-7 whitespace-nowrap bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs pointer-events-none">
            ${polName} (${polCountryCode})
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const polMarker = L.marker(polCoords, { icon: polIcon }).addTo(map);
    polMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1e293b; padding: 2px;">
        <b style="font-size: 13px; color: #0f172a;">${polName} (POL)</b><br/>
        <span style="color: #64748b;">Country: ${polCountryCode}</span><br/>
        <span style="color: #0284c7; font-weight: 600;">Status: Departed</span>
      </div>
    `);

    // 4. Transshipment Hub Marker (Colombo) if present
    if (transshipmentCoords) {
      const transIcon = L.divIcon({
        className: "custom-leaflet-marker",
        html: `
          <div class="relative flex items-center justify-center cursor-pointer">
            <div class="size-6 rotate-45 rounded-[5px] bg-[#009EE2] text-white shadow-sm flex items-center justify-center border-2 border-white">
              <div class="size-1.5 rounded-full bg-white"></div>
            </div>
            <div class="absolute -top-6 whitespace-nowrap bg-slate-800 text-white text-[9.5px] font-semibold px-1.5 py-0.5 rounded shadow-xs pointer-events-none">
              ${transshipmentName} (${transCountryCode})
            </div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      const transMarker = L.marker(transshipmentCoords, { icon: transIcon }).addTo(map);
      transMarker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1e293b; padding: 2px;">
          <b style="font-size: 13px; color: #0f172a;">${transshipmentName}</b><br/>
          <span style="color: #64748b;">Transshipment Port (${transCountryCode})</span><br/>
          <span style="color: #0284c7; font-weight: 600;">Vessel connection scheduled</span>
        </div>
      `);
    }

    // 5. Port of Discharge (POD) Destination Marker
    const destIcon = L.divIcon({
      className: "custom-leaflet-marker",
      html: `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <div class="size-8 rounded-full bg-[#EF4444] text-white shadow-md border-2 border-white flex items-center justify-center transition-transform hover:scale-110">
            <svg class="size-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div class="absolute -top-7 whitespace-nowrap bg-[#DC2626] text-white text-[10.5px] font-bold px-2 py-0.5 rounded shadow-xs pointer-events-none">
            ${destinationName} (${destCountryCode})
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const destMarker = L.marker(destCoords, { icon: destIcon }).addTo(map);
    destMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1e293b; padding: 2px;">
        <b style="font-size: 13px; color: #dc2626;">${destinationName} (POD)</b><br/>
        <span style="color: #64748b;">Destination Port (${destCountryCode})</span><br/>
        <span style="color: #059669; font-weight: 600;">ETA: ${etaFormatted}</span>
      </div>
    `);

    // 6. Live Vessel Marker with Radiating Pulse Ring & Ship Icon
    const vesselIcon = L.divIcon({
      className: "custom-leaflet-vessel-marker",
      html: `
        <div class="relative flex items-center justify-center cursor-pointer group">
          <!-- Radar Pulse Animation -->
          <div class="absolute -inset-2.5 rounded-full bg-[#009EE2]/25 animate-ping"></div>
          <div class="absolute -inset-1 rounded-full bg-[#009EE2]/40"></div>
          <!-- Vessel Center Disc -->
          <div class="relative size-8 rounded-full bg-[#0D74FF] text-white shadow-lg border-2 border-white flex items-center justify-center transition-transform hover:scale-115">
            <svg class="size-4.5" style="transform: rotate(${vesselTelemetry.headingDeg}deg);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2" />
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });

    const vesselMarker = L.marker(vesselTelemetry.position, { icon: vesselIcon }).addTo(map);
    vesselMarker.bindPopup(`
      <div style="font-family: sans-serif; font-size: 12px; line-height: 1.45; color: #1e293b; min-width: 170px;">
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">${vesselName}</div>
        <div style="display: inline-block; background: #e0f2fe; color: #0284c7; font-size: 10px; font-weight: 700; padding: 2px 6px; rounded: 4px; margin-bottom: 6px;">
          ${vesselStatus}
        </div>
        <div style="color: #475569; font-size: 11px;">Speed: <b>16.8 kts</b> | Course: <b>${vesselTelemetry.headingDeg}°</b></div>
        <div style="color: #64748b; font-size: 10.5px; margin-top: 2px;">
          Lat: ${vesselTelemetry.position[0].toFixed(2)}°N, Lng: ${vesselTelemetry.position[1].toFixed(2)}°E
        </div>
      </div>
    `);

    // 7. Auto-Fit Bounds to frame the entire maritime corridor
    const bounds = activeRoute.getBounds();
    map.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 6,
    });

    setIsMapReady(true);

    // Resize observer to keep map centered when viewport changes
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [
    originCoords,
    polCoords,
    destCoords,
    transshipmentCoords,
    routeWaypoints,
    vesselTelemetry,
    polName,
    polCountryCode,
    destinationName,
    destCountryCode,
    transshipmentName,
    transCountryCode,
    vesselName,
    vesselStatus,
    etaFormatted,
    mapType,
  ]);

  // Handle Zoom In
  const handleZoomIn = useCallback(() => {
    mapInstanceRef.current?.zoomIn();
  }, []);

  // Handle Zoom Out
  const handleZoomOut = useCallback(() => {
    mapInstanceRef.current?.zoomOut();
  }, []);

  // Handle Reset Route View
  const handleReset = useCallback(() => {
    if (!mapInstanceRef.current || routeWaypoints.length === 0) return;
    const poly = L.polyline(routeWaypoints);
    mapInstanceRef.current.fitBounds(poly.getBounds(), {
      padding: [45, 45],
      maxZoom: 6,
    });
  }, [routeWaypoints]);

  // Toggle Map Tiles
  const handleToggleMapType = useCallback(() => {
    setMapType((prev) => (prev === "positron" ? "osm" : "positron"));
  }, []);

  // Toggle Fullscreen Container
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
  }, []);

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden transition-all duration-300 bg-[#E8F1F8] border-b border-slate-200 select-none",
        isFullscreen
          ? "fixed inset-0 z-50 h-screen w-screen rounded-none"
          : "h-[320px] sm:h-[370px] md:h-[410px] rounded-t-[20px]",
        className,
      )}
    >
      {/* Leaflet Map DOM Mount Node */}
      <div
        ref={containerRef}
        className="w-full h-full z-0 outline-none focus:outline-none"
        style={{ background: "#E8F1F8" }}
      />

      {/* Floating Control Toolbar (Top Right) */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-1.5 bg-white/95 backdrop-blur-xs p-1 rounded-xl shadow-md border border-slate-200/80">
        <button
          type="button"
          onClick={handleZoomIn}
          className="size-7.5 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="size-7.5 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="size-7.5 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-t border-slate-100"
          title="Reset voyage corridor view"
          aria-label="Reset route view"
        >
          <RotateCcw className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleToggleMapType}
          className="size-7.5 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-t border-slate-100"
          title={`Switch map layer (currently ${mapType === "positron" ? "CartoDB Positron" : "OpenStreetMap"})`}
          aria-label="Toggle map layer"
        >
          <Layers className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleToggleFullscreen}
          className="size-7.5 flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border-t border-slate-100"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen map"}
          aria-label="Fullscreen"
        >
          {isFullscreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </button>
      </div>

      {/* Live Vessel Telemetry Badge (Bottom Left/Center) */}
      <div className="absolute bottom-3 left-4 z-20 hidden sm:flex items-center gap-2.5 bg-white/95 backdrop-blur-xs py-1.5 px-3 rounded-full border border-slate-200/90 shadow-sm text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <Ship className="size-3.5 text-[#009EE2]" />
          <span className="text-slate-900 font-bold">{vesselName}</span>
        </div>
        <span className="h-3 w-[1px] bg-slate-200" />
        <span className="text-slate-500 text-[11px]">
          Course {vesselTelemetry.headingDeg}° • 16.8 kts
        </span>
        <span className="h-3 w-[1px] bg-slate-200" />
        <span className="text-[#009EE2] font-semibold text-[11px]">{vesselStatus}</span>
      </div>

      {/* Route Corridor Chips (Bottom Right) */}
      <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1 bg-white/90 backdrop-blur-xs px-2.5 py-1 rounded-full border border-slate-200/80 shadow-2xs text-[11px] font-bold text-slate-600">
        <span className="text-slate-800">{polName}</span>
        <span className="text-slate-400">→</span>
        {transshipmentName && (
          <>
            <span className="text-slate-500 font-medium">{transshipmentName}</span>
            <span className="text-slate-400">→</span>
          </>
        )}
        <span className="text-[#0D74FF]">{destinationName}</span>
      </div>
    </div>
  );
}
export default TrackingMapSection;
