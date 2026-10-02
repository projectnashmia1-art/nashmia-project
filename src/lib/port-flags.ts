/**
 * Port to Country Flag and Metadata Mapping Utility
 * Maps port codes, UN/LOCODEs, port names, and country names to high-accuracy country flags and codes.
 */

export interface PortCountryMeta {
  flag: string;
  countryCode: string;
  countryName: string;
}

// 2-Letter Country Code to Flag Emoji
export const COUNTRY_CODE_TO_FLAG: Record<string, string> = {
  GB: "🇬🇧",
  UK: "🇬🇧",
  PK: "🇵🇰",
  US: "🇺🇸",
  USA: "🇺🇸",
  DE: "🇩🇪",
  AE: "🇦🇪",
  UAE: "🇦🇪",
  CN: "🇨🇳",
  NL: "🇳🇱",
  BE: "🇧🇪",
  FR: "🇫🇷",
  ES: "🇪🇸",
  IT: "🇮🇹",
  SG: "🇸🇬",
  IN: "🇮🇳",
  SA: "🇸🇦",
  QA: "🇶🇦",
  OM: "🇴🇲",
  KW: "🇰🇼",
  BH: "🇧🇭",
  JO: "🇯🇴",
  EG: "🇪🇬",
  TR: "🇹🇷",
  GR: "🇬🇷",
  KR: "🇰🇷",
  JP: "🇯🇵",
  HK: "🇭🇰",
  MY: "🇲🇾",
  TH: "🇹🇭",
  VN: "🇻🇳",
  ID: "🇮🇩",
  PH: "🇵🇭",
  TW: "🇹🇼",
  LK: "🇱🇰",
  BD: "🇧🇩",
  AU: "🇦🇺",
  NZ: "🇳🇿",
  ZA: "🇿🇦",
  BR: "🇧🇷",
  AR: "🇦🇷",
  CL: "🇨🇱",
  MX: "🇲🇽",
  CA: "🇨🇦",
  IE: "🇮🇪",
  PT: "🇵🇹",
  PL: "🇵🇱",
  SE: "🇸🇪",
  NO: "🇳🇴",
  DK: "🇩🇰",
  FI: "🇫🇮",
  CH: "🇨🇭",
  AT: "🇦🇹",
};

// Port Code (3-letter or 5-letter UN/LOCODE) directly to Country & Flag Meta
const PORT_CODE_MAP: Record<string, PortCountryMeta> = {
  // United Kingdom 🇬🇧
  FXT: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  FEL: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  SOU: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  LGP: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  LIV: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  TEE: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  TIL: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  IMM: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  GBFXT: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  GBSOU: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },
  GBLGP: { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" },

  // Pakistan 🇵🇰
  KHI: { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" },
  KAR: { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" },
  QCT: { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" },
  BQM: { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" },
  PKKHI: { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" },
  PKBQM: { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" },
  GWD: { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" },

  // Germany 🇩🇪
  HAM: { flag: "🇩🇪", countryCode: "DE", countryName: "Germany" },
  BRV: { flag: "🇩🇪", countryCode: "DE", countryName: "Germany" },
  DEHAM: { flag: "🇩🇪", countryCode: "DE", countryName: "Germany" },
  DEBRV: { flag: "🇩🇪", countryCode: "DE", countryName: "Germany" },

  // Netherlands 🇳🇱
  RTM: { flag: "🇳🇱", countryCode: "NL", countryName: "Netherlands" },
  AMS: { flag: "🇳🇱", countryCode: "NL", countryName: "Netherlands" },
  NLRTM: { flag: "🇳🇱", countryCode: "NL", countryName: "Netherlands" },

  // Belgium 🇧🇪
  ANR: { flag: "🇧🇪", countryCode: "BE", countryName: "Belgium" },
  ZEE: { flag: "🇧🇪", countryCode: "BE", countryName: "Belgium" },
  BEANR: { flag: "🇧🇪", countryCode: "BE", countryName: "Belgium" },

  // France 🇫🇷
  LEH: { flag: "🇫🇷", countryCode: "FR", countryName: "France" },
  FOS: { flag: "🇫🇷", countryCode: "FR", countryName: "France" },
  MRS: { flag: "🇫🇷", countryCode: "FR", countryName: "France" },
  DKK: { flag: "🇫🇷", countryCode: "FR", countryName: "France" },
  FRLEH: { flag: "🇫🇷", countryCode: "FR", countryName: "France" },
  FRFOS: { flag: "🇫🇷", countryCode: "FR", countryName: "France" },

  // Spain 🇪🇸
  VLC: { flag: "🇪🇸", countryCode: "ES", countryName: "Spain" },
  BCN: { flag: "🇪🇸", countryCode: "ES", countryName: "Spain" },
  ALG: { flag: "🇪🇸", countryCode: "ES", countryName: "Spain" },
  ESVLC: { flag: "🇪🇸", countryCode: "ES", countryName: "Spain" },
  ESBCN: { flag: "🇪🇸", countryCode: "ES", countryName: "Spain" },

  // Italy 🇮🇹
  GOA: { flag: "🇮🇹", countryCode: "IT", countryName: "Italy" },
  SPE: { flag: "🇮🇹", countryCode: "IT", countryName: "Italy" },
  LIV_IT: { flag: "🇮🇹", countryCode: "IT", countryName: "Italy" },
  TRS: { flag: "🇮🇹", countryCode: "IT", countryName: "Italy" },
  ITGOA: { flag: "🇮🇹", countryCode: "IT", countryName: "Italy" },

  // United Arab Emirates 🇦🇪
  JEA: { flag: "🇦🇪", countryCode: "AE", countryName: "UAE" },
  DXB: { flag: "🇦🇪", countryCode: "AE", countryName: "UAE" },
  AEJEA: { flag: "🇦🇪", countryCode: "AE", countryName: "UAE" },
  AUH: { flag: "🇦🇪", countryCode: "AE", countryName: "UAE" },
  SHJ: { flag: "🇦🇪", countryCode: "AE", countryName: "UAE" },
  KLF: { flag: "🇦🇪", countryCode: "AE", countryName: "UAE" },

  // United States 🇺🇸
  SAV: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  NYC: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  NYK: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  NWK: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  LGB: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  LAX: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  HOU: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  ORF: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  CHS: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  OAK: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  SEA: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  USSAV: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  USNYC: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },
  USLAX: { flag: "🇺🇸", countryCode: "US", countryName: "United States" },

  // China 🇨🇳
  SHA: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  NBO: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  SZX: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  YTN: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  QIN: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  XMN: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  TXG: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  CNSHA: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },
  CNNBO: { flag: "🇨🇳", countryCode: "CN", countryName: "China" },

  // Singapore 🇸🇬
  SIN: { flag: "🇸🇬", countryCode: "SG", countryName: "Singapore" },
  SGSIN: { flag: "🇸🇬", countryCode: "SG", countryName: "Singapore" },

  // Hong Kong 🇭🇰
  HKG: { flag: "🇭🇰", countryCode: "HK", countryName: "Hong Kong" },
  HKHKG: { flag: "🇭🇰", countryCode: "HK", countryName: "Hong Kong" },

  // India 🇮🇳
  BOM: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },
  NSA: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },
  MAA: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },
  MUN: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },
  CCU: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },
  COK: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },
  INNSA: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },
  INMUN: { flag: "🇮🇳", countryCode: "IN", countryName: "India" },

  // Saudi Arabia 🇸🇦
  DMM: { flag: "🇸🇦", countryCode: "SA", countryName: "Saudi Arabia" },
  JED: { flag: "🇸🇦", countryCode: "SA", countryName: "Saudi Arabia" },
  RUH: { flag: "🇸🇦", countryCode: "SA", countryName: "Saudi Arabia" },
  JUB: { flag: "🇸🇦", countryCode: "SA", countryName: "Saudi Arabia" },
  SADMM: { flag: "🇸🇦", countryCode: "SA", countryName: "Saudi Arabia" },
  SAJED: { flag: "🇸🇦", countryCode: "SA", countryName: "Saudi Arabia" },

  // Qatar 🇶🇦
  DOH: { flag: "🇶🇦", countryCode: "QA", countryName: "Qatar" },
  QADOH: { flag: "🇶🇦", countryCode: "QA", countryName: "Qatar" },

  // Oman 🇴🇲
  MCT: { flag: "🇴🇲", countryCode: "OM", countryName: "Oman" },
  SOH: { flag: "🇴🇲", countryCode: "OM", countryName: "Oman" },
  SLL: { flag: "🇴🇲", countryCode: "OM", countryName: "Oman" },

  // Kuwait 🇰🇼
  KWI: { flag: "🇰🇼", countryCode: "KW", countryName: "Kuwait" },
  SHU: { flag: "🇰🇼", countryCode: "KW", countryName: "Kuwait" },

  // Bahrain 🇧🇭
  BAH: { flag: "🇧🇭", countryCode: "BH", countryName: "Bahrain" },
  KBS: { flag: "🇧🇭", countryCode: "BH", countryName: "Bahrain" },

  // Egypt 🇪🇬
  SOK: { flag: "🇪🇬", countryCode: "EG", countryName: "Egypt" },
  PSD: { flag: "🇪🇬", countryCode: "EG", countryName: "Egypt" },
  ALX: { flag: "🇪🇬", countryCode: "EG", countryName: "Egypt" },
  EGSOK: { flag: "🇪🇬", countryCode: "EG", countryName: "Egypt" },

  // Jordan 🇯🇴
  AQB: { flag: "🇯🇴", countryCode: "JO", countryName: "Jordan" },
  JOAQB: { flag: "🇯🇴", countryCode: "JO", countryName: "Jordan" },

  // Turkey 🇹🇷
  IST: { flag: "🇹🇷", countryCode: "TR", countryName: "Turkey" },
  MER: { flag: "🇹🇷", countryCode: "TR", countryName: "Turkey" },
  IZM: { flag: "🇹🇷", countryCode: "TR", countryName: "Turkey" },
  AMB: { flag: "🇹🇷", countryCode: "TR", countryName: "Turkey" },

  // Sri Lanka 🇱🇰
  CMB: { flag: "🇱🇰", countryCode: "LK", countryName: "Sri Lanka" },
  LKCMB: { flag: "🇱🇰", countryCode: "LK", countryName: "Sri Lanka" },

  // Bangladesh 🇧🇩
  CHG: { flag: "🇧🇩", countryCode: "BD", countryName: "Bangladesh" },
  CGP: { flag: "🇧🇩", countryCode: "BD", countryName: "Bangladesh" },

  // South Korea 🇰🇷
  BUS: { flag: "🇰🇷", countryCode: "KR", countryName: "South Korea" },
  INC: { flag: "🇰🇷", countryCode: "KR", countryName: "South Korea" },
  KRBUS: { flag: "🇰🇷", countryCode: "KR", countryName: "South Korea" },

  // Japan 🇯🇵
  TYO: { flag: "🇯🇵", countryCode: "JP", countryName: "Japan" },
  YOK: { flag: "🇯🇵", countryCode: "JP", countryName: "Japan" },
  KOB: { flag: "🇯🇵", countryCode: "JP", countryName: "Japan" },
  NAG: { flag: "🇯🇵", countryCode: "JP", countryName: "Japan" },

  // Australia 🇦🇺
  SYD: { flag: "🇦🇺", countryCode: "AU", countryName: "Australia" },
  MEL: { flag: "🇦🇺", countryCode: "AU", countryName: "Australia" },
  BNE: { flag: "🇦🇺", countryCode: "AU", countryName: "Australia" },
  FRE: { flag: "🇦🇺", countryCode: "AU", countryName: "Australia" },

  // South Africa 🇿🇦
  DUR: { flag: "🇿🇦", countryCode: "ZA", countryName: "South Africa" },
  CPT: { flag: "🇿🇦", countryCode: "ZA", countryName: "South Africa" },
  PLZ: { flag: "🇿🇦", countryCode: "ZA", countryName: "South Africa" },

  // Brazil 🇧🇷
  SSZ: { flag: "🇧🇷", countryCode: "BR", countryName: "Brazil" },
  PNG: { flag: "🇧🇷", countryCode: "BR", countryName: "Brazil" },

  // Canada 🇨🇦
  VAN: { flag: "🇨🇦", countryCode: "CA", countryName: "Canada" },
  MTR: { flag: "🇨🇦", countryCode: "CA", countryName: "Canada" },
};

/**
 * Resolves country metadata (Flag, Code, Name) from Port Code, Port Name, or Country string.
 */
export function getPortCountryMeta(
  portCode?: string | null,
  portName?: string | null,
  countryHint?: string | null,
): PortCountryMeta {
  const code = (portCode || "").trim().toUpperCase();
  const name = (portName || "").toLowerCase();
  const hint = (countryHint || "").toLowerCase();

  // 1. Direct port code lookup
  if (code && PORT_CODE_MAP[code]) {
    return PORT_CODE_MAP[code];
  }

  // 2. UN/LOCODE 2-letter prefix check (e.g. GBFXT, PKKHI, USNYC, DEHAM)
  if (code && code.length === 5) {
    const prefix = code.slice(0, 2);
    if (COUNTRY_CODE_TO_FLAG[prefix]) {
      return {
        flag: COUNTRY_CODE_TO_FLAG[prefix],
        countryCode: prefix,
        countryName: prefix,
      };
    }
  }

  // 3. Check countryHint if provided
  if (countryHint) {
    const upperHint = countryHint.trim().toUpperCase();
    if (COUNTRY_CODE_TO_FLAG[upperHint]) {
      return {
        flag: COUNTRY_CODE_TO_FLAG[upperHint],
        countryCode: upperHint,
        countryName: countryHint,
      };
    }
  }

  // 4. Heuristic text search in portName or countryHint
  const combined = `${name} ${hint}`;

  if (
    combined.includes("felixstowe") ||
    combined.includes("southampton") ||
    combined.includes("london gateway") ||
    combined.includes("liverpool") ||
    combined.includes("united kingdom") ||
    combined.includes("uk") ||
    combined.includes("britain") ||
    combined.includes("england")
  ) {
    return { flag: "🇬🇧", countryCode: "GB", countryName: "United Kingdom" };
  }

  if (
    combined.includes("karachi") ||
    combined.includes("qasim") ||
    combined.includes("pakistan") ||
    combined.includes("gwadar")
  ) {
    return { flag: "🇵🇰", countryCode: "PK", countryName: "Pakistan" };
  }

  if (
    combined.includes("hamburg") ||
    combined.includes("bremerhaven") ||
    combined.includes("germany") ||
    combined.includes("deutschland")
  ) {
    return { flag: "🇩🇪", countryCode: "DE", countryName: "Germany" };
  }

  if (
    combined.includes("rotterdam") ||
    combined.includes("amsterdam") ||
    combined.includes("netherlands") ||
    combined.includes("holland")
  ) {
    return { flag: "🇳🇱", countryCode: "NL", countryName: "Netherlands" };
  }

  if (combined.includes("antwerp") || combined.includes("belgium")) {
    return { flag: "🇧🇪", countryCode: "BE", countryName: "Belgium" };
  }

  if (
    combined.includes("le havre") ||
    combined.includes("marseille") ||
    combined.includes("fos") ||
    combined.includes("france")
  ) {
    return { flag: "🇫🇷", countryCode: "FR", countryName: "France" };
  }

  if (
    combined.includes("valencia") ||
    combined.includes("barcelona") ||
    combined.includes("algeciras") ||
    combined.includes("spain") ||
    combined.includes("espana")
  ) {
    return { flag: "🇪🇸", countryCode: "ES", countryName: "Spain" };
  }

  if (
    combined.includes("genoa") ||
    combined.includes("la spezia") ||
    combined.includes("italy") ||
    combined.includes("italia")
  ) {
    return { flag: "🇮🇹", countryCode: "IT", countryName: "Italy" };
  }

  if (
    combined.includes("jebel ali") ||
    combined.includes("dubai") ||
    combined.includes("uae") ||
    combined.includes("emirates") ||
    combined.includes("abu dhabi")
  ) {
    return { flag: "🇦🇪", countryCode: "AE", countryName: "UAE" };
  }

  if (
    combined.includes("savannah") ||
    combined.includes("new york") ||
    combined.includes("los angeles") ||
    combined.includes("long beach") ||
    combined.includes("houston") ||
    combined.includes("usa") ||
    combined.includes("united states")
  ) {
    return { flag: "🇺🇸", countryCode: "US", countryName: "United States" };
  }

  if (
    combined.includes("shanghai") ||
    combined.includes("ningbo") ||
    combined.includes("shenzhen") ||
    combined.includes("yantian") ||
    combined.includes("china")
  ) {
    return { flag: "🇨🇳", countryCode: "CN", countryName: "China" };
  }

  if (combined.includes("singapore")) {
    return { flag: "🇸🇬", countryCode: "SG", countryName: "Singapore" };
  }

  if (
    combined.includes("mumbai") ||
    combined.includes("nhava sheva") ||
    combined.includes("mundra") ||
    combined.includes("chennai") ||
    combined.includes("india")
  ) {
    return { flag: "🇮🇳", countryCode: "IN", countryName: "India" };
  }

  if (
    combined.includes("dammam") ||
    combined.includes("jeddah") ||
    combined.includes("riyadh") ||
    combined.includes("saudi")
  ) {
    return { flag: "🇸🇦", countryCode: "SA", countryName: "Saudi Arabia" };
  }

  if (combined.includes("colombo") || combined.includes("sri lanka")) {
    return { flag: "🇱🇰", countryCode: "LK", countryName: "Sri Lanka" };
  }

  if (combined.includes("chittagong") || combined.includes("bangladesh")) {
    return { flag: "🇧🇩", countryCode: "BD", countryName: "Bangladesh" };
  }

  if (combined.includes("busan") || combined.includes("korea")) {
    return { flag: "🇰🇷", countryCode: "KR", countryName: "South Korea" };
  }

  if (
    combined.includes("tokyo") ||
    combined.includes("yokohama") ||
    combined.includes("kobe") ||
    combined.includes("japan")
  ) {
    return { flag: "🇯🇵", countryCode: "JP", countryName: "Japan" };
  }

  if (
    combined.includes("alexandria") ||
    combined.includes("sokhna") ||
    combined.includes("egypt")
  ) {
    return { flag: "🇪🇬", countryCode: "EG", countryName: "Egypt" };
  }

  if (combined.includes("turkey") || combined.includes("istanbul") || combined.includes("mersin")) {
    return { flag: "🇹🇷", countryCode: "TR", countryName: "Turkey" };
  }

  // Default fallback
  return { flag: "🌐", countryCode: "INT", countryName: "International Port" };
}

/**
 * Returns just the flag emoji string (e.g., "🇬🇧", "🇵🇰", "🇺🇸", "🌐").
 */
export function getPortCountryFlag(
  portCode?: string | null,
  portName?: string | null,
  countryHint?: string | null,
): string {
  return getPortCountryMeta(portCode, portName, countryHint).flag;
}
