import type { MovementCutOffDates, MovementCutOffDeadline } from "./movement-cutoff-service";

export type Stage =
  | "Draft"
  | "Booking Requested"
  | "Booking Confirmed"
  | "Loaded"
  | "In Transit"
  | "Arrived"
  | "Cleared"
  | "Delivered";

export interface Movement {
  id?: string;
  ref: string;
  buyer: string;
  supplier: string;
  forwarder?: string;
  pol: string;
  pod: string;
  vessel: string;
  etd: string;
  eta: string;
  stage: Stage | string;
  confirmationStatus?: string | null;
  rate: string;
  age: string;
  cutOffDates?: MovementCutOffDates;
  cutOffDeadlines?: MovementCutOffDeadline[];
}

export const kpis = [
  { label: "Total Containers", value: "0", trend: "0.0%", icon: "Container" },
  { label: "Booking Requests", value: "0", trend: "0.0%", icon: "ClipboardList" },
  { label: "Booking Confirmed", value: "0", trend: "0.0%", icon: "BadgeCheck" },
  { label: "In Transit", value: "0", trend: "0.0%", icon: "Ship" },
  { label: "Arrived", value: "0", trend: "0.0%", icon: "Anchor" },
  { label: "Delivered", value: "0", trend: "0.0%", icon: "PackageCheck" },
] as const;

export const lifecycle: {
  stage: Stage;
  count: number;
  state: "complete" | "active" | "future";
}[] = [];

export const attention = [
  { icon: "ClipboardList", label: "Bookings awaiting confirmation", count: 0, to: "/requests" },
  { icon: "Timer", label: "Cut-offs approaching within 48h", count: 0, to: "/requests" },
  { icon: "AlertTriangle", label: "Containers delayed at sea", count: 0, to: "/requests" },
  { icon: "FileText", label: "Documents missing for clearance", count: 0, to: "/documents" },
];

export const movements: Movement[] = [];

export const cutoffs: Array<{
  ref: string;
  type: string;
  date: string;
  time: string;
  in: string;
}> = [];

export const quickActions = [
  { label: "New Booking", icon: "Plus" },
  { label: "Add Supplier", icon: "Warehouse" },
  { label: "Add Buyer", icon: "Users" },
  { label: "Manage Rates", icon: "Receipt" },
];
