export interface PortCoordinate {
  name: string;
  country: string;
  code: string;
  coords: [number, number]; // [lat, lng]
  isSeaPort?: boolean;
}

// Global maritime ports and logistics origin/destination coordinates catalog
export const PORT_COORDINATES_CATALOG: Record<string, PortCoordinate> = {
  // UK & North Europe
  kettering: { name: "Kettering", country: "United Kingdom", code: "GB", coords: [52.399, -0.728] },
  "london gateway": {
    name: "London Gateway",
    country: "United Kingdom",
    code: "GB",
    coords: [51.505, 0.468],
    isSeaPort: true,
  },
  london: { name: "London", country: "United Kingdom", code: "GB", coords: [51.507, -0.127] },
  felixstowe: {
    name: "Felixstowe",
    country: "United Kingdom",
    code: "GB",
    coords: [51.954, 1.306],
    isSeaPort: true,
  },
  southampton: {
    name: "Southampton",
    country: "United Kingdom",
    code: "GB",
    coords: [50.899, -1.404],
    isSeaPort: true,
  },
  liverpool: {
    name: "Liverpool",
    country: "United Kingdom",
    code: "GB",
    coords: [53.447, -3.023],
    isSeaPort: true,
  },
  rotterdam: {
    name: "Rotterdam",
    country: "Netherlands",
    code: "NL",
    coords: [51.924, 4.477],
    isSeaPort: true,
  },
  antwerp: {
    name: "Antwerp",
    country: "Belgium",
    code: "BE",
    coords: [51.219, 4.402],
    isSeaPort: true,
  },
  hamburg: {
    name: "Hamburg",
    country: "Germany",
    code: "DE",
    coords: [53.551, 9.993],
    isSeaPort: true,
  },
  bremen: {
    name: "Bremen",
    country: "Germany",
    code: "DE",
    coords: [53.079, 8.801],
    isSeaPort: true,
  },
  valencia: {
    name: "Valencia",
    country: "Spain",
    code: "ES",
    coords: [39.469, -0.376],
    isSeaPort: true,
  },
  algeciras: {
    name: "Algeciras",
    country: "Spain",
    code: "ES",
    coords: [36.14, -5.453],
    isSeaPort: true,
  },
  barcelona: {
    name: "Barcelona",
    country: "Spain",
    code: "ES",
    coords: [41.385, 2.173],
    isSeaPort: true,
  },
  genoa: { name: "Genoa", country: "Italy", code: "IT", coords: [44.405, 8.946], isSeaPort: true },

  // Mediterranean & Red Sea Strategic Corridors
  "port said": {
    name: "Port Said",
    country: "Egypt",
    code: "EG",
    coords: [31.265, 32.301],
    isSeaPort: true,
  },
  suez: {
    name: "Suez Canal",
    country: "Egypt",
    code: "EG",
    coords: [29.967, 32.55],
    isSeaPort: true,
  },
  jeddah: {
    name: "Jeddah",
    country: "Saudi Arabia",
    code: "SA",
    coords: [21.486, 39.173],
    isSeaPort: true,
  },
  salalah: {
    name: "Salalah",
    country: "Oman",
    code: "OM",
    coords: [16.94, 54.004],
    isSeaPort: true,
  },
  "jebel ali": {
    name: "Jebel Ali",
    country: "United Arab Emirates",
    code: "AE",
    coords: [25.011, 55.061],
    isSeaPort: true,
  },
  dubai: { name: "Dubai", country: "United Arab Emirates", code: "AE", coords: [25.204, 55.27] },

  // South Asia
  karachi: {
    name: "Karachi",
    country: "Pakistan",
    code: "PK",
    coords: [24.842, 66.974],
    isSeaPort: true,
  },
  "karachi port": {
    name: "Karachi Port",
    country: "Pakistan",
    code: "PK",
    coords: [24.842, 66.974],
    isSeaPort: true,
  },
  "port qasim": {
    name: "Port Qasim",
    country: "Pakistan",
    code: "PK",
    coords: [24.77, 67.339],
    isSeaPort: true,
  },
  lahore: { name: "Lahore", country: "Pakistan", code: "PK", coords: [31.52, 74.358] },
  colombo: {
    name: "Colombo",
    country: "Sri Lanka",
    code: "LK",
    coords: [6.949, 79.843],
    isSeaPort: true,
  },
  "nhava sheva": {
    name: "Nhava Sheva (JNPT)",
    country: "India",
    code: "IN",
    coords: [18.948, 72.951],
    isSeaPort: true,
  },
  mumbai: {
    name: "Mumbai",
    country: "India",
    code: "IN",
    coords: [18.948, 72.951],
    isSeaPort: true,
  },
  mundra: {
    name: "Mundra",
    country: "India",
    code: "IN",
    coords: [22.839, 69.704],
    isSeaPort: true,
  },
  chittagong: {
    name: "Chittagong",
    country: "Bangladesh",
    code: "BD",
    coords: [22.33, 91.8],
    isSeaPort: true,
  },

  // Southeast Asia & Far East
  singapore: {
    name: "Singapore",
    country: "Singapore",
    code: "SG",
    coords: [1.264, 103.84],
    isSeaPort: true,
  },
  "port klang": {
    name: "Port Klang",
    country: "Malaysia",
    code: "MY",
    coords: [3.0, 101.4],
    isSeaPort: true,
  },
  shanghai: {
    name: "Shanghai",
    country: "China",
    code: "CN",
    coords: [31.23, 121.473],
    isSeaPort: true,
  },
  ningbo: {
    name: "Ningbo",
    country: "China",
    code: "CN",
    coords: [29.868, 121.544],
    isSeaPort: true,
  },
  shenzhen: {
    name: "Shenzhen",
    country: "China",
    code: "CN",
    coords: [22.543, 114.057],
    isSeaPort: true,
  },
  "hong kong": {
    name: "Hong Kong",
    country: "Hong Kong",
    code: "HK",
    coords: [22.319, 114.169],
    isSeaPort: true,
  },
  qingdao: {
    name: "Qingdao",
    country: "China",
    code: "CN",
    coords: [36.067, 120.383],
    isSeaPort: true,
  },
  busan: {
    name: "Busan",
    country: "South Korea",
    code: "KR",
    coords: [35.102, 129.04],
    isSeaPort: true,
  },
  tokyo: { name: "Tokyo", country: "Japan", code: "JP", coords: [35.676, 139.65], isSeaPort: true },

  // Americas
  "new york": {
    name: "New York",
    country: "United States",
    code: "US",
    coords: [40.712, -74.006],
    isSeaPort: true,
  },
  "los angeles": {
    name: "Los Angeles",
    country: "United States",
    code: "US",
    coords: [33.743, -118.267],
    isSeaPort: true,
  },
  houston: {
    name: "Houston",
    country: "United States",
    code: "US",
    coords: [29.76, -95.369],
    isSeaPort: true,
  },
  savannah: {
    name: "Savannah",
    country: "United States",
    code: "US",
    coords: [32.08, -81.091],
    isSeaPort: true,
  },

  // Turkey & Mediterranean
  mersin: {
    name: "Mersin",
    country: "Turkey",
    code: "TR",
    coords: [36.812, 34.641],
    isSeaPort: true,
  },
  istanbul: {
    name: "Istanbul",
    country: "Turkey",
    code: "TR",
    coords: [41.008, 28.978],
    isSeaPort: true,
  },
};

/**
 * Finds the closest matching port coordinates from a location string
 */
export function resolveLocationCoords(loc?: string | null): [number, number] {
  if (!loc) return [51.505, 0.468]; // London Gateway default
  const clean = loc.toLowerCase().trim();

  for (const [key, item] of Object.entries(PORT_COORDINATES_CATALOG)) {
    if (clean.includes(key) || key.includes(clean)) {
      return item.coords;
    }
  }

  // Common partial checks
  if (clean.includes("karachi") || clean.includes("qasim") || clean.includes("pakistan")) {
    return PORT_COORDINATES_CATALOG.karachi.coords;
  }
  if (
    clean.includes("london") ||
    clean.includes("kettering") ||
    clean.includes("uk") ||
    clean.includes("united kingdom")
  ) {
    return clean.includes("kettering")
      ? PORT_COORDINATES_CATALOG.kettering.coords
      : PORT_COORDINATES_CATALOG["london gateway"].coords;
  }
  if (clean.includes("colombo") || clean.includes("sri lanka")) {
    return PORT_COORDINATES_CATALOG.colombo.coords;
  }
  if (clean.includes("dubai") || clean.includes("jebel") || clean.includes("uae")) {
    return PORT_COORDINATES_CATALOG["jebel ali"].coords;
  }
  if (clean.includes("china") || clean.includes("shanghai") || clean.includes("ningbo")) {
    return PORT_COORDINATES_CATALOG.ningbo.coords;
  }
  if (clean.includes("rotterdam") || clean.includes("netherlands")) {
    return PORT_COORDINATES_CATALOG.rotterdam.coords;
  }

  // Default fallback
  return [24.842, 66.974];
}

/**
 * Generates high-fidelity maritime nautical route waypoints between origin and destination
 * routing through standard international maritime channels (English Channel, Gibraltar, Suez, Bab-el-Mandeb, Arabian Sea)
 */
export function generateMaritimeRoutePath(
  originCoords: [number, number],
  destCoords: [number, number],
  transshipmentCoords?: [number, number] | null,
): [number, number][] {
  const [oLat, oLng] = originCoords;
  const [dLat, dLng] = destCoords;

  const path: [number, number][] = [originCoords];

  // Check if this is a Europe/UK to South Asia/Middle East route (standard Nashmia trade lane)
  const isEuropeOrigin = oLat > 35 && oLng < 20;
  const isSouthAsiaDest = dLat > 5 && dLat < 35 && dLng > 50 && dLng < 95;

  if (isEuropeOrigin && isSouthAsiaDest) {
    // English Channel & Atlantic Sea Lanes
    path.push([50.2, -0.8]);
    path.push([48.8, -4.5]);
    path.push([44.5, -9.5]);
    path.push([39.0, -10.5]);

    // Strait of Gibraltar
    path.push([36.0, -5.8]);
    path.push([36.1, -4.0]);

    // Mediterranean Sea Corridor
    path.push([37.2, 5.0]);
    path.push([37.5, 11.5]);
    path.push([35.2, 19.0]);
    path.push([33.5, 27.5]);

    // Port Said & Suez Canal Entrance
    path.push([31.3, 32.3]);
    path.push([29.9, 32.6]);

    // Red Sea Channel
    path.push([27.0, 34.5]);
    path.push([22.0, 38.0]);
    path.push([17.0, 41.5]);

    // Bab-el-Mandeb Strait & Gulf of Aden
    path.push([12.6, 43.4]);
    path.push([12.5, 48.0]);
    path.push([13.0, 52.5]);

    // Arabian Sea / Indian Ocean
    if (transshipmentCoords) {
      path.push([15.0, 62.0]);
      path.push(transshipmentCoords);
      path.push([18.5, 73.0]);
    } else {
      path.push([17.5, 60.5]);
      path.push([21.0, 64.0]);
    }

    path.push(destCoords);
    return path;
  }

  // East Asia (China) to South Asia / Middle East
  const isEastAsiaOrigin = oLat > 15 && oLng > 100;
  if (isEastAsiaOrigin && isSouthAsiaDest) {
    path.push([20.0, 115.0]);
    path.push([12.0, 110.0]);
    path.push([4.0, 105.0]);
    // Singapore & Malacca Strait
    path.push([1.3, 104.0]);
    path.push([3.5, 99.5]);
    path.push([6.0, 95.0]);
    // Indian Ocean Corridor
    path.push([7.0, 85.0]);
    if (transshipmentCoords) {
      path.push(transshipmentCoords);
    }
    path.push([14.0, 75.0]);
    path.push([20.0, 70.0]);
    path.push(destCoords);
    return path;
  }

  // Generic intermediate bezier-like geodesic nautical curve for other global routes
  const steps = 12;
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    // Interpolate with a slight ocean-ward curve
    const lat = oLat + (dLat - oLat) * t + Math.sin(t * Math.PI) * (oLng < dLng ? -4.5 : 4.5);
    const lng = oLng + (dLng - oLng) * t;
    path.push([lat, lng]);
  }

  path.push(destCoords);
  return path;
}

/**
 * Calculates current vessel simulated position along the route based on progress or default (~65%)
 */
export function calculateVesselPositionOnRoute(
  routePoints: [number, number][],
  progressRatio = 0.68,
): { position: [number, number]; headingDeg: number } {
  if (routePoints.length === 0) return { position: [20.0, 63.0], headingDeg: 45 };
  if (routePoints.length === 1) return { position: routePoints[0], headingDeg: 0 };

  const targetIdx = Math.floor(routePoints.length * progressRatio);
  const clampedIdx = Math.max(0, Math.min(targetIdx, routePoints.length - 2));

  const p1 = routePoints[clampedIdx];
  const p2 = routePoints[clampedIdx + 1];

  // Heading calculation
  const dLat = p2[0] - p1[0];
  const dLng = p2[1] - p1[1];
  const headingRad = Math.atan2(dLng, dLat);
  const headingDeg = (headingRad * (180 / Math.PI) + 360) % 360;

  // Midpoint between segment points
  const midLat = p1[0] + dLat * 0.4;
  const midLng = p1[1] + dLng * 0.4;

  return {
    position: [midLat, midLng],
    headingDeg: Math.round(headingDeg),
  };
}
