export type RateCardStatus = "Active" | "Expired" | "Inactive";

export interface AdditionalChargeItem {
  id: string;
  name: string;
  amount: number;
  currency: string;
  unit: "per_container" | "per_bl" | "percentage" | "fixed";
}

export interface FullRateCardRecord {
  id: string;
  user_id?: string | null;
  forwarder_id: string;
  shipping_line_id?: string | null;
  card_name?: string | null;
  lane?: string | null;
  origin: string;
  destination: string;
  load_point?: string | null;
  pol_code?: string | null;
  pol_name?: string | null;
  pod_code?: string | null;
  pod_name?: string | null;
  container_type: string;
  container_size: "20FT" | "40FT" | "40HC" | string;
  quantity?: number;
  base_rate: number;
  rate?: number | null;
  currency: string;
  additional_charges?: AdditionalChargeItem[];
  total_rate_estimate?: number;
  transit_days_min?: number | null;
  transit_days_max?: number | null;
  transit_time?: string | null;
  etd?: string | null;
  eta?: string | null;
  valid_from: string;
  valid_until: string;
  status: RateCardStatus;
  notes?: string | null;
  free_demurrage_days?: number;
  created_at: string;
  updated_at?: string;
  // Joined relations
  forwarders?: {
    id: string;
    company_name?: string | null;
    contact_person?: string | null;
    email?: string | null;
    phone?: string | null;
    code?: string | null;
    country?: string | null;
    badge?: string | null;
  } | null;
  shipping_lines?: {
    id: string;
    name: string;
    code: string;
    vessels_active?: number;
  } | null;
}
