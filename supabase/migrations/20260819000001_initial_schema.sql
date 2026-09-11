-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - POSTGRESQL BACKEND FOUNDATION
-- Migration: 20260819000001_initial_schema.sql
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- HELPER FUNCTIONS & TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. PROFILES TABLE (Linked with Supabase Auth)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'operations' CHECK (role IN ('admin', 'operations', 'manager', 'viewer', 'agent')),
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-provision profile upon auth.users insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'operations')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. BUYERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  consignee TEXT,
  country TEXT NOT NULL,
  country_code TEXT,
  contact_person TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  tax_id TEXT,
  address TEXT,
  city TEXT,
  preferred_port TEXT,
  preferred_carrier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_buyers_code ON public.buyers(code);
CREATE INDEX IF NOT EXISTS idx_buyers_name ON public.buyers(name);
CREATE INDEX IF NOT EXISTS idx_buyers_status ON public.buyers(status);
CREATE INDEX IF NOT EXISTS idx_buyers_country ON public.buyers(country);

CREATE TRIGGER set_buyers_updated_at
  BEFORE UPDATE ON public.buyers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. SUPPLIERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  company_name TEXT,
  country TEXT NOT NULL,
  country_code TEXT,
  load_point TEXT NOT NULL,
  load_point_city TEXT,
  load_point_type TEXT NOT NULL DEFAULT 'Warehouse' CHECK (
    load_point_type IN ('Warehouse', 'Distribution Center', 'Factory Hub', 'Port Depot', 'CFS Terminal', 'Cold Hub')
  ),
  contact_person TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  tax_id TEXT,
  address TEXT,
  city TEXT,
  operating_hours TEXT,
  pickup_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_suppliers_code ON public.suppliers(code);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_country ON public.suppliers(country);
CREATE INDEX IF NOT EXISTS idx_suppliers_load_point_type ON public.suppliers(load_point_type);

CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. FORWARDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT 'Booking Agent' CHECK (
    badge IN ('Booking Agent', 'Primary Forwarder', 'Regional Agent', 'Tier 1 Priority', 'Preferred Partner', 'Standard Forwarder')
  ),
  contact_person TEXT,
  contact_role TEXT,
  email TEXT,
  whatsapp TEXT,
  country TEXT NOT NULL,
  country_code TEXT,
  shipping_lines TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_forwarders_code ON public.forwarders(code);
CREATE INDEX IF NOT EXISTS idx_forwarders_name ON public.forwarders(name);
CREATE INDEX IF NOT EXISTS idx_forwarders_status ON public.forwarders(status);
CREATE INDEX IF NOT EXISTS idx_forwarders_badge ON public.forwarders(badge);

CREATE TRIGGER set_forwarders_updated_at
  BEFORE UPDATE ON public.forwarders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. SHIPPING_LINES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT UNIQUE NOT NULL,
  vessels_active INTEGER NOT NULL DEFAULT 0 CHECK (vessels_active >= 0),
  tracking_url_template TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_shipping_lines_code ON public.shipping_lines(code);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_status ON public.shipping_lines(status);

CREATE TRIGGER set_shipping_lines_updated_at
  BEFORE UPDATE ON public.shipping_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 6. RATE_CARDS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id UUID NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  card_name TEXT NOT NULL,
  lane TEXT,
  pol_code TEXT NOT NULL,
  pol_name TEXT NOT NULL,
  pod_code TEXT NOT NULL,
  pod_name TEXT NOT NULL,
  container_size TEXT NOT NULL CHECK (container_size IN ('20FT', '40FT', '40HC')),
  rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'EUR', 'GBP', 'AED', 'PKR')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring Soon', 'Draft', 'Expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_rate_card_valid_dates CHECK (valid_until >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_forwarder ON public.rate_cards(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_pol_pod ON public.rate_cards(pol_code, pod_code);
CREATE INDEX IF NOT EXISTS idx_rate_cards_container_size ON public.rate_cards(container_size);
CREATE INDEX IF NOT EXISTS idx_rate_cards_status ON public.rate_cards(status);
CREATE INDEX IF NOT EXISTS idx_rate_cards_valid_until ON public.rate_cards(valid_until);

CREATE TRIGGER set_rate_cards_updated_at
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7. BOOKINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE NOT NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE RESTRICT,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  rate_card_id UUID REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  stage TEXT NOT NULL DEFAULT 'Draft' CHECK (
    stage IN (
      'Draft',
      'Booking Requested',
      'Booking Confirmed',
      'Loaded',
      'In Transit',
      'Arrived',
      'Cleared',
      'Delivered',
      'Cancelled',
      'Customs Hold'
    )
  ),
  pol_code TEXT NOT NULL,
  pol_name TEXT NOT NULL,
  pod_code TEXT NOT NULL,
  pod_name TEXT NOT NULL,
  place_of_receipt TEXT,
  final_destination TEXT,
  vessel_name TEXT,
  voyage_number TEXT,
  carrier_booking_ref TEXT,
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  actual_departure TIMESTAMPTZ,
  actual_arrival TIMESTAMPTZ,
  cargo_description TEXT,
  hs_code TEXT,
  total_weight_kg NUMERIC(12, 2) CHECK (total_weight_kg IS NULL OR total_weight_kg >= 0),
  total_volume_cbm NUMERIC(12, 2) CHECK (total_volume_cbm IS NULL OR total_volume_cbm >= 0),
  freight_rate NUMERIC(12, 2) CHECK (freight_rate IS NULL OR freight_rate >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  payment_terms TEXT DEFAULT 'Freight Prepaid' CHECK (payment_terms IN ('Freight Prepaid', 'Freight Collect')),
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(reference);
CREATE INDEX IF NOT EXISTS idx_bookings_stage ON public.bookings(stage);
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_id ON public.bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier_id ON public.bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_forwarder_id ON public.bookings(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shipping_line_id ON public.bookings(shipping_line_id);
CREATE INDEX IF NOT EXISTS idx_bookings_etd ON public.bookings(etd);
CREATE INDEX IF NOT EXISTS idx_bookings_eta ON public.bookings(eta);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 8. BOOKING_CONTAINERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  container_number TEXT,
  container_size TEXT NOT NULL CHECK (container_size IN ('20FT', '40FT', '40HC')),
  seal_number TEXT,
  tare_weight_kg NUMERIC(10, 2) CHECK (tare_weight_kg IS NULL OR tare_weight_kg >= 0),
  cargo_weight_kg NUMERIC(10, 2) CHECK (cargo_weight_kg IS NULL OR cargo_weight_kg >= 0),
  verified_gross_mass_kg NUMERIC(10, 2) CHECK (verified_gross_mass_kg IS NULL OR verified_gross_mass_kg >= 0),
  status TEXT NOT NULL DEFAULT 'Allocated' CHECK (
    status IN (
      'Allocated',
      'Gate-In',
      'Loaded on Vessel',
      'Discharged',
      'Customs Hold',
      'Delivered',
      'Gate-Out',
      'Empty Returned'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_booking_containers_booking ON public.booking_containers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_containers_number ON public.booking_containers(container_number);
CREATE INDEX IF NOT EXISTS idx_booking_containers_status ON public.booking_containers(status);
CREATE INDEX IF NOT EXISTS idx_booking_containers_size ON public.booking_containers(container_size);

CREATE TRIGGER set_booking_containers_updated_at
  BEFORE UPDATE ON public.booking_containers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 9. BOOKING_EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  container_id UUID REFERENCES public.booking_containers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'Stage Changed',
      'Booking Created',
      'Booking Requested',
      'Booking Confirmed',
      'Gate-In Recorded',
      'Vessel Loaded',
      'Vessel Departed',
      'Vessel Arrived',
      'Customs Cleared',
      'Customs Hold',
      'Delivered',
      'Note Added',
      'Email Sent',
      'Document Uploaded',
      'Exception'
    )
  ),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking ON public.booking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_container ON public.booking_events(container_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_type ON public.booking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_occurred_at ON public.booking_events(occurred_at DESC);

-- ============================================================================
-- 10. EMAIL_THREADS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT UNIQUE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  snippet TEXT,
  recipient_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sender_email TEXT NOT NULL,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  message_count INTEGER NOT NULL DEFAULT 1 CHECK (message_count >= 1),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived', 'Pending Reply', 'Resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_email_threads_thread_id ON public.email_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_booking_id ON public.email_threads(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message ON public.email_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON public.email_threads(status);

CREATE TRIGGER set_email_threads_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 11. EMAIL_MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  cc_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  bcc_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  is_incoming BOOLEAN NOT NULL DEFAULT false,
  attachments JSONB DEFAULT '[]'::JSONB,
  headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_email_messages_thread ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_booking ON public.email_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON public.email_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender ON public.email_messages(sender_email);

-- ============================================================================
-- 12. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (
    type IN ('info', 'success', 'warning', 'error', 'cutoff_warning', 'booking_status', 'email_received')
  ),
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- ============================================================================
-- 13. AUDIT_LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Authenticated users can view profiles and update their own profile
CREATE POLICY "Allow authenticated users to read profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow users to update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Operational Tables (buyers, suppliers, forwarders, shipping_lines, rate_cards, bookings, containers, events):
-- Allow full access to authenticated operations team members
CREATE POLICY "Allow authenticated read buyers"
  ON public.buyers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write buyers"
  ON public.buyers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read suppliers"
  ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write suppliers"
  ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read forwarders"
  ON public.forwarders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write forwarders"
  ON public.forwarders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read shipping_lines"
  ON public.shipping_lines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write shipping_lines"
  ON public.shipping_lines FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read rate_cards"
  ON public.rate_cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write rate_cards"
  ON public.rate_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read bookings"
  ON public.bookings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write bookings"
  ON public.bookings FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read booking_containers"
  ON public.booking_containers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write booking_containers"
  ON public.booking_containers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read booking_events"
  ON public.booking_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write booking_events"
  ON public.booking_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read email_threads"
  ON public.email_threads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write email_threads"
  ON public.email_threads FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated read email_messages"
  ON public.email_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write email_messages"
  ON public.email_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow users to read their notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Allow users to update their notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid())
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Allow authenticated insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated read audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
