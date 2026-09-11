export type Stage =
  | "Draft"
  | "Booking Requested"
  | "Booking Confirmed"
  | "Loaded"
  | "In Transit"
  | "Arrived"
  | "Cleared"
  | "Delivered";

export const kpis = [
  { label: "Total Containers", value: "248", trend: "+12.4% this month", icon: "Container" },
  { label: "Booking Requests", value: "32", trend: "+4.1% this week", icon: "ClipboardList" },
  { label: "Booking Confirmed", value: "41", trend: "+8.7% this month", icon: "BadgeCheck" },
  { label: "In Transit", value: "87", trend: "+2.9% vs last week", icon: "Ship" },
  { label: "Arrived", value: "28", trend: "-1.8% this week", icon: "Anchor" },
  { label: "Delivered", value: "60", trend: "+15.2% this month", icon: "PackageCheck" },
] as const;

export const lifecycle: {
  stage: Stage;
  count: number;
  state: "complete" | "active" | "future";
}[] = [
  { stage: "Draft", count: 14, state: "complete" },
  { stage: "Booking Requested", count: 32, state: "complete" },
  { stage: "Booking Confirmed", count: 41, state: "complete" },
  { stage: "Loaded", count: 26, state: "complete" },
  { stage: "In Transit", count: 87, state: "active" },
  { stage: "Arrived", count: 28, state: "future" },
  { stage: "Cleared", count: 19, state: "future" },
  { stage: "Delivered", count: 60, state: "future" },
];

export const attention = [
  { icon: "ClipboardList", label: "Bookings awaiting confirmation", count: 5, to: "/" },
  { icon: "Timer", label: "Cut-offs approaching within 48h", count: 3, to: "/" },
  { icon: "AlertTriangle", label: "Containers delayed at sea", count: 2, to: "/" },
  { icon: "FileText", label: "Documents missing for clearance", count: 4, to: "/" },
];

export const movements = [
  {
    ref: "NASH-CM-00042",
    buyer: "Delta Home GmbH",
    supplier: "Sialkot Textile Mills",
    pol: "KHI",
    pod: "HAM",
    vessel: "MSC Adriana / 431W",
    etd: "20 Aug",
    eta: "14 Sep",
    stage: "In Transit" as Stage,
    rate: "$1,840",
    age: "12d",
  },
  {
    ref: "NASH-CM-00041",
    buyer: "Nordic Living AB",
    supplier: "Gujranwala Steel Works",
    pol: "QCT",
    pod: "GOT",
    vessel: "Maersk Kotka / 219E",
    etd: "22 Aug",
    eta: "18 Sep",
    stage: "Booking Confirmed" as Stage,
    rate: "$2,120",
    age: "5d",
  },
  {
    ref: "NASH-CM-00039",
    buyer: "Atlas Retail LLC",
    supplier: "Faisalabad Weaving Co.",
    pol: "KHI",
    pod: "JEA",
    vessel: "CMA CGM Rhone / 087S",
    etd: "17 Aug",
    eta: "26 Aug",
    stage: "Loaded" as Stage,
    rate: "$960",
    age: "9d",
  },
  {
    ref: "NASH-CM-00037",
    buyer: "Maison Verte SAS",
    supplier: "Lahore Leather Crafts",
    pol: "PQP",
    pod: "FOS",
    vessel: "Hapag Bremen / 340W",
    etd: "11 Aug",
    eta: "07 Sep",
    stage: "Arrived" as Stage,
    rate: "$1,675",
    age: "21d",
  },
  {
    ref: "NASH-CM-00035",
    buyer: "Pacific Foods Inc.",
    supplier: "Multan Agro Exports",
    pol: "KHI",
    pod: "LGB",
    vessel: "ONE Harbour / 512E",
    etd: "04 Aug",
    eta: "01 Sep",
    stage: "Cleared" as Stage,
    rate: "$2,940",
    age: "28d",
  },
  {
    ref: "NASH-CM-00033",
    buyer: "Emirates Trading FZE",
    supplier: "Karachi Plastic Industries",
    pol: "KHI",
    pod: "JEA",
    vessel: "Emirates Star / 118S",
    etd: "29 Jul",
    eta: "08 Aug",
    stage: "Delivered" as Stage,
    rate: "$780",
    age: "34d",
  },
  {
    ref: "NASH-CM-00031",
    buyer: "Britannia Interiors Ltd",
    supplier: "Sheikhupura Furniture Co.",
    pol: "QCT",
    pod: "FXT",
    vessel: "Evergreen Ace / 604W",
    etd: "25 Aug",
    eta: "21 Sep",
    stage: "Booking Requested" as Stage,
    rate: "$1,410",
    age: "2d",
  },
];

export const cutoffs = [
  { ref: "NASH-CM-00042", type: "SI Cut-off", date: "20 Aug", time: "04:00 PM", in: "in 2 days" },
  { ref: "NASH-CM-00041", type: "VGM Cut-off", date: "21 Aug", time: "10:00 AM", in: "in 3 days" },
  { ref: "NASH-CM-00039", type: "Port Cut-off", date: "22 Aug", time: "06:00 PM", in: "in 4 days" },
];

export const quickActions = [
  { label: "New Booking", icon: "Plus" },
  { label: "Add Supplier", icon: "Warehouse" },
  { label: "Add Buyer", icon: "Users" },
  { label: "Manage Rates", icon: "Receipt" },
];
