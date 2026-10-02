export type ContainerSize = "20FT" | "40FT" | "40HC";

export type FreightRateMode = "ASKING_RATE" | "AGREED_RATE";

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

export const BUYERS: BuyerAccount[] = [];

export const SUPPLIERS: SupplierVendor[] = [];

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

export const BOOKING_AGENTS: BookingAgent[] = [];

export const RATE_CARDS: RateCard[] = [];

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
