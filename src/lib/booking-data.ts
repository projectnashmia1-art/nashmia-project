export type ContainerSize = "20FT" | "40FT" | "40HC";

export interface BuyerAccount {
  id: string;
  name: string;
  consignee: string;
  country: string;
  code: string;
  badge: string;
}

export interface SupplierVendor {
  id: string;
  name: string;
  loadPoint: string;
  city: string;
  address: string;
  country: string;
}

export interface Port {
  code: string;
  name: string;
  country: string;
  fullLabel: string;
}

export interface ShippingLine {
  id: string;
  name: string;
  code: string;
  vesselsActive: number;
}

export interface BookingAgent {
  id: string;
  name: string;
  code: string;
  contractTier: "Tier 1 Priority" | "Preferred Partner" | "Standard Forwarder";
  email?: string;
  contactPerson?: string;
  contact?: string;
  phone?: string;
  whatsapp?: string;
  slaHours?: number;
  activeRates?: number;
  supportedLines?: string[];
}

export interface RateCard {
  agentId: string;
  agentName: string;
  polCode: string;
  podCode: string;
  size: ContainerSize;
  ratePerContainer: number;
  currency: string;
  validUntil: string;
  cardName: string;
}

export const BUYERS: BuyerAccount[] = [
  {
    id: "buyer-1",
    name: "New Henna",
    consignee: "New Henna Trading FZCO",
    country: "United Arab Emirates",
    code: "NH-DXB",
    badge: "Consignee",
  },
  {
    id: "buyer-2",
    name: "Delta Home GmbH",
    consignee: "Delta Home Logistics DE",
    country: "Germany",
    code: "DH-HAM",
    badge: "Consignee",
  },
  {
    id: "buyer-3",
    name: "Nordic Living AB",
    consignee: "Nordic Living Scandinavia AB",
    country: "Sweden",
    code: "NL-GOT",
    badge: "Consignee",
  },
  {
    id: "buyer-4",
    name: "Atlas Retail LLC",
    consignee: "Atlas Retail Group US",
    country: "United States",
    code: "AR-JEA",
    badge: "Consignee",
  },
  {
    id: "buyer-5",
    name: "Maison Verte SAS",
    consignee: "Maison Verte Distribution",
    country: "France",
    code: "MV-FOS",
    badge: "Consignee",
  },
  {
    id: "buyer-6",
    name: "Pacific Foods Inc.",
    consignee: "Pacific Foods Imports Corp",
    country: "United States",
    code: "PF-LGB",
    badge: "Consignee",
  },
  {
    id: "buyer-7",
    name: "Britannia Interiors Ltd",
    consignee: "Britannia UK Wholesale Ltd",
    country: "United Kingdom",
    code: "BI-FXT",
    badge: "Consignee",
  },
];

export const SUPPLIERS: SupplierVendor[] = [
  {
    id: "sup-1",
    name: "UK Supplier",
    loadPoint: "London Warehouse",
    city: "London, UK",
    address: "Unit 4, Gateway Logistics Park, Dagenham RM9 6RH",
    country: "United Kingdom",
  },
  {
    id: "sup-2",
    name: "Sialkot Textile Mills",
    loadPoint: "Sialkot Factory Hub #2",
    city: "Sialkot, Pakistan",
    address: "Plot 18-B, Small Industrial Estate, Sialkot",
    country: "Pakistan",
  },
  {
    id: "sup-3",
    name: "Gujranwala Steel Works",
    loadPoint: "Gujranwala Industrial Yard",
    city: "Gujranwala, Pakistan",
    address: "GT Road Industrial Zone, Gujranwala",
    country: "Pakistan",
  },
  {
    id: "sup-4",
    name: "Faisalabad Weaving Co.",
    loadPoint: "Faisalabad Main Depot",
    city: "Faisalabad, Pakistan",
    address: "Millat Road Textile Enclave, Faisalabad",
    country: "Pakistan",
  },
  {
    id: "sup-5",
    name: "Lahore Leather Crafts",
    loadPoint: "Lahore Cargo Terminal",
    city: "Lahore, Pakistan",
    address: "Sundar Industrial Estate, Gate 3, Lahore",
    country: "Pakistan",
  },
  {
    id: "sup-6",
    name: "Multan Agro Exports",
    loadPoint: "Multan Cold Hub",
    city: "Multan, Pakistan",
    address: "Vehari Road Logistic Centre, Multan",
    country: "Pakistan",
  },
  {
    id: "sup-7",
    name: "Karachi Plastic Industries",
    loadPoint: "Korangi Warehouse 7",
    city: "Karachi, Pakistan",
    address: "Sector 15, Korangi Industrial Area, Karachi",
    country: "Pakistan",
  },
];

export const PORTS_OF_LOADING: Port[] = [
  {
    code: "FXT",
    name: "Felixstowe",
    country: "United Kingdom",
    fullLabel: "Felixstowe (FXT) · UK",
  },
  {
    code: "SOU",
    name: "Southampton",
    country: "United Kingdom",
    fullLabel: "Southampton (SOU) · UK",
  },
  {
    code: "LGP",
    name: "London Gateway",
    country: "United Kingdom",
    fullLabel: "London Gateway (LGP) · UK",
  },
  { code: "KHI", name: "Karachi Port", country: "Pakistan", fullLabel: "Karachi (KHI) · PK" },
  { code: "QCT", name: "Port Qasim", country: "Pakistan", fullLabel: "Port Qasim (QCT) · PK" },
  { code: "HAM", name: "Hamburg", country: "Germany", fullLabel: "Hamburg (HAM) · DE" },
  { code: "RTM", name: "Rotterdam", country: "Netherlands", fullLabel: "Rotterdam (RTM) · NL" },
  { code: "JEA", name: "Jebel Ali", country: "UAE", fullLabel: "Jebel Ali (JEA) · AE" },
];

export const PORTS_OF_DISCHARGE: Port[] = [
  { code: "KHI", name: "Karachi Port", country: "Pakistan", fullLabel: "Karachi (KHI) · PK" },
  { code: "QCT", name: "Port Qasim", country: "Pakistan", fullLabel: "Port Qasim (QCT) · PK" },
  { code: "JEA", name: "Jebel Ali", country: "UAE", fullLabel: "Jebel Ali (JEA) · AE" },
  { code: "HAM", name: "Hamburg", country: "Germany", fullLabel: "Hamburg (HAM) · DE" },
  { code: "GOT", name: "Gothenburg", country: "Sweden", fullLabel: "Gothenburg (GOT) · SE" },
  { code: "FOS", name: "Fos-sur-Mer", country: "France", fullLabel: "Fos-sur-Mer (FOS) · FR" },
  { code: "LGB", name: "Long Beach", country: "United States", fullLabel: "Long Beach (LGB) · US" },
  {
    code: "FXT",
    name: "Felixstowe",
    country: "United Kingdom",
    fullLabel: "Felixstowe (FXT) · UK",
  },
  { code: "RTM", name: "Rotterdam", country: "Netherlands", fullLabel: "Rotterdam (RTM) · NL" },
];

export const SHIPPING_LINES: ShippingLine[] = [
  { id: "sl-msc", name: "MSC", code: "MSCU", vesselsActive: 780 },
  { id: "sl-maersk", name: "Maersk", code: "MAEU", vesselsActive: 710 },
  { id: "sl-cmacgm", name: "CMA CGM", code: "CMDU", vesselsActive: 590 },
  { id: "sl-hapag", name: "Hapag-Lloyd", code: "HLCU", vesselsActive: 260 },
  { id: "sl-evergreen", name: "Evergreen", code: "EGLV", vesselsActive: 215 },
  { id: "sl-one", name: "ONE", code: "ONEY", vesselsActive: 220 },
  { id: "sl-cosco", name: "Cosco Shipping", code: "COSU", vesselsActive: 500 },
];

export const BOOKING_AGENTS: BookingAgent[] = [
  {
    id: "agent-abc",
    name: "ABC Forwarding",
    code: "ABC-FWD",
    contractTier: "Tier 1 Priority",
    contactPerson: "John Smith",
    contact: "John Smith",
    email: "john@abc-forwarding.co.uk",
    phone: "+44 7700 900077",
    whatsapp: "+44 7700 900077",
    slaHours: 4,
    activeRates: 4,
    supportedLines: ["MSC", "Maersk", "CMA CGM"],
  },
  {
    id: "agent-kn",
    name: "Kuehne+Nagel",
    code: "KN-GLB",
    contractTier: "Preferred Partner",
    contactPerson: "Liner Bookings",
    contact: "Liner Bookings",
    email: "bookings@kuehne-nagel.com",
    phone: "+44 207 946 0192",
    whatsapp: "+44 207 946 0192",
    slaHours: 6,
    activeRates: 3,
    supportedLines: ["MSC", "Hapag-Lloyd", "ONE"],
  },
  {
    id: "agent-dhl",
    name: "DHL Global Forwarding",
    code: "DHL-GF",
    contractTier: "Preferred Partner",
    contactPerson: "Freight Dispatch",
    contact: "Freight Dispatch",
    email: "oceanfreight@dhl.com",
    phone: "+49 228 1820",
    whatsapp: "+49 228 1820",
    slaHours: 8,
    activeRates: 5,
    supportedLines: ["Maersk", "CMA CGM", "Evergreen"],
  },
  {
    id: "agent-apex",
    name: "Apex Global Logistics",
    code: "APX-LOG",
    contractTier: "Standard Forwarder",
    contactPerson: "Tariq Mahmood",
    contact: "Tariq Mahmood",
    email: "tariq@apex-logistics.ae",
    phone: "+971 50 123 4567",
    whatsapp: "+971 50 123 4567",
    slaHours: 4,
    activeRates: 2,
    supportedLines: ["MSC", "Cosco Shipping", "ONE"],
  },
  {
    id: "agent-bollore",
    name: "Bolloré Logistics",
    code: "BOL-EUR",
    contractTier: "Preferred Partner",
    contactPerson: "Claire Fontaine",
    contact: "Claire Fontaine",
    email: "c.fontaine@bollore.com",
    phone: "+33 6 12 34 56 78",
    whatsapp: "+33 6 12 34 56 78",
    slaHours: 6,
    activeRates: 3,
    supportedLines: ["CMA CGM", "MSC"],
  },
  {
    id: "agent-expeditors",
    name: "Expeditors",
    code: "EXPD-US",
    contractTier: "Standard Forwarder",
    contactPerson: "Jennifer Adams",
    contact: "Jennifer Adams",
    email: "jennifer.adams@expeditors.com",
    phone: "+1 206 555 0188",
    whatsapp: "+1 206 555 0188",
    slaHours: 12,
    activeRates: 2,
    supportedLines: ["Maersk", "MSC", "Evergreen"],
  },
  {
    id: "agent-dsv",
    name: "DSV Global Transport",
    code: "DSV-DEN",
    contractTier: "Preferred Partner",
    contactPerson: "Ocean Line Lead",
    contact: "Ocean Line Lead",
    email: "oceanbookings@dsv.com",
    phone: "+45 70 35 15 00",
    whatsapp: "+45 70 35 15 00",
    slaHours: 6,
    activeRates: 4,
    supportedLines: ["MSC", "Maersk", "Hapag-Lloyd"],
  },
];

export const RATE_CARDS: RateCard[] = [
  // ABC Forwarding FXT -> KHI
  {
    agentId: "agent-abc",
    agentName: "ABC Forwarding",
    polCode: "FXT",
    podCode: "KHI",
    size: "40HC",
    ratePerContainer: 2100,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "UK-PK Monthly Freight Q3",
  },
  {
    agentId: "agent-abc",
    agentName: "ABC Forwarding",
    polCode: "FXT",
    podCode: "KHI",
    size: "40FT",
    ratePerContainer: 1950,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "UK-PK Monthly Freight Q3",
  },
  {
    agentId: "agent-abc",
    agentName: "ABC Forwarding",
    polCode: "FXT",
    podCode: "KHI",
    size: "20FT",
    ratePerContainer: 1350,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "UK-PK Monthly Freight Q3",
  },
  // ABC Forwarding SOU -> KHI
  {
    agentId: "agent-abc",
    agentName: "ABC Forwarding",
    polCode: "SOU",
    podCode: "KHI",
    size: "40HC",
    ratePerContainer: 2150,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "UK-PK Monthly Freight Q3",
  },
  {
    agentId: "agent-abc",
    agentName: "ABC Forwarding",
    polCode: "SOU",
    podCode: "KHI",
    size: "20FT",
    ratePerContainer: 1400,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "UK-PK Monthly Freight Q3",
  },
  // Kuehne+Nagel
  {
    agentId: "agent-kn",
    agentName: "Kuehne+Nagel",
    polCode: "FXT",
    podCode: "KHI",
    size: "40HC",
    ratePerContainer: 2250,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "KN Northern Europe Contract",
  },
  {
    agentId: "agent-kn",
    agentName: "Kuehne+Nagel",
    polCode: "KHI",
    podCode: "HAM",
    size: "40HC",
    ratePerContainer: 1840,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "KN PK-EU Express Tariff",
  },
  // DHL Global Forwarding
  {
    agentId: "agent-dhl",
    agentName: "DHL Global Forwarding",
    polCode: "QCT",
    podCode: "GOT",
    size: "40HC",
    ratePerContainer: 2120,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "DHL Nordic Standard",
  },
  // Apex Global Logistics
  {
    agentId: "agent-apex",
    agentName: "Apex Global Logistics",
    polCode: "KHI",
    podCode: "JEA",
    size: "40HC",
    ratePerContainer: 960,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "Gulf Regional Tariff",
  },
  {
    agentId: "agent-apex",
    agentName: "Apex Global Logistics",
    polCode: "KHI",
    podCode: "JEA",
    size: "20FT",
    ratePerContainer: 620,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "Gulf Regional Tariff",
  },
  // Bolloré
  {
    agentId: "agent-bollore",
    agentName: "Bolloré Logistics",
    polCode: "QCT",
    podCode: "FOS",
    size: "40HC",
    ratePerContainer: 1675,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "Bolloré Mediterranean Corridor",
  },
  // Expeditors
  {
    agentId: "agent-expeditors",
    agentName: "Expeditors",
    polCode: "KHI",
    podCode: "LGB",
    size: "40HC",
    ratePerContainer: 2940,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "Transpacific Westbound Schedule",
  },
  // ABC Forwarding LGP -> KHI
  {
    agentId: "agent-abc",
    agentName: "ABC Forwarding",
    polCode: "LGP",
    podCode: "KHI",
    size: "40HC",
    ratePerContainer: 2180,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "UK-PK Monthly Freight Q3",
  },
  // ABC Forwarding FXT -> JEA
  {
    agentId: "agent-abc",
    agentName: "ABC Forwarding",
    polCode: "FXT",
    podCode: "JEA",
    size: "40HC",
    ratePerContainer: 1850,
    currency: "USD",
    validUntil: "31 Aug 2026",
    cardName: "UK-Gulf Monthly Schedule",
  },
];

export function findAgreedRate(
  agentId: string,
  polCode: string,
  podCode: string,
  size: ContainerSize,
): RateCard | null {
  if (!agentId || !polCode || !podCode || !size) return null;
  return (
    RATE_CARDS.find(
      (rc) =>
        rc.agentId === agentId &&
        rc.polCode === polCode &&
        rc.podCode === podCode &&
        rc.size === size,
    ) ?? null
  );
}

export const CONTAINER_SPECS: Record<
  ContainerSize,
  {
    label: string;
    sublabel: string;
    cbm: string;
    maxPayload: string;
    description: string;
  }
> = {
  "20FT": {
    label: "20FT",
    sublabel: "Standard Dry",
    cbm: "33.2 CBM",
    maxPayload: "28,180 kg",
    description: "Best for heavy & dense commodities",
  },
  "40FT": {
    label: "40FT",
    sublabel: "Standard GP",
    cbm: "67.7 CBM",
    maxPayload: "26,700 kg",
    description: "General purpose multi-item cargo",
  },
  "40HC": {
    label: "40HC",
    sublabel: "High Cube",
    cbm: "76.3 CBM",
    maxPayload: "26,500 kg",
    description: "Extra 1ft height for voluminous freight",
  },
};

export const PRESET_INSTRUCTIONS = [
  "Please confirm availability before vessel cut-off.",
  "Requires clean, dry, odor-free container inspection at depot.",
  "Direct Bill of Lading required with freight prepaid.",
  "Release BL against surrender of original export docs.",
  "Notify warehouse dispatch 24 hours prior to container positioning.",
];
