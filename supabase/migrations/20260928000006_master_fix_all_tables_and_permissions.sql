-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - MASTER 100% COMPLETE DATABASE REPAIR & PERMISSIONS SCRIPT
-- Migration: 20260928000006_master_fix_all_tables_and_permissions.sql
-- ============================================================================

-- 0. Enable Essential PostgreSQL Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to handle updated_at timestamps automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. ORGANIZATIONS TABLE
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT,
  domain TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL DEFAULT 'Operations User',
  email TEXT NOT NULL DEFAULT 'user@company.com',
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. GMAIL CONNECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID,
  google_email TEXT NOT NULL,
  google_user_id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  token_type TEXT DEFAULT 'Bearer',
  status TEXT NOT NULL DEFAULT 'connected',
  last_sync_at TIMESTAMPTZ,
  sync_history_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. BUYERS TABLE
CREATE TABLE IF NOT EXISTS public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT,
  company_name TEXT,
  consignee TEXT,
  country TEXT NOT NULL DEFAULT 'Global',
  country_code TEXT DEFAULT 'GB',
  contact_person TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  tax_id TEXT,
  address TEXT,
  city TEXT,
  website TEXT,
  notes TEXT,
  preferred_port TEXT,
  preferred_carrier TEXT,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS company_name TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS code TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS consignee TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Global';
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'GB';
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS contact_person TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS contact_role TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS tax_id TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS city TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS website TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS preferred_port TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS preferred_carrier TEXT;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 5. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT,
  subtitle TEXT,
  company_name TEXT,
  country TEXT NOT NULL DEFAULT 'Global',
  country_code TEXT DEFAULT 'GB',
  load_point TEXT NOT NULL DEFAULT 'Central Hub',
  load_point_city TEXT,
  load_point_type TEXT NOT NULL DEFAULT 'Warehouse',
  contact_person TEXT,
  contact_role TEXT,
  contact_person_role TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  tax_id TEXT,
  address TEXT,
  city TEXT,
  website TEXT,
  notes TEXT,
  preferred_port TEXT,
  operating_hours TEXT,
  pickup_instructions TEXT,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company_name TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS subtitle TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS code TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Global';
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'GB';
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS load_point TEXT DEFAULT 'Central Hub';
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS load_point_city TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS load_point_type TEXT DEFAULT 'Warehouse';
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_person TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_role TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS contact_person_role TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS email TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS tax_id TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS city TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS website TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS preferred_port TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS operating_hours TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS pickup_instructions TEXT;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 6. FORWARDERS TABLE
CREATE TABLE IF NOT EXISTS public.forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT,
  name TEXT,
  company_name TEXT,
  badge TEXT NOT NULL DEFAULT 'Booking Agent',
  contact_person TEXT,
  contact_role TEXT,
  email TEXT NOT NULL DEFAULT 'forwarder@logistics.com',
  phone TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  whatsapp TEXT,
  country TEXT NOT NULL DEFAULT 'Global',
  country_code TEXT DEFAULT 'GB',
  status TEXT NOT NULL DEFAULT 'Active',
  tax_id TEXT,
  address TEXT,
  city TEXT,
  website TEXT,
  notes TEXT,
  rating NUMERIC(3,2) DEFAULT 5.0,
  shipping_lines TEXT[],
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS company_name TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'Booking Agent';
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS contact_person TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS contact_role TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS email TEXT DEFAULT 'forwarder@logistics.com';
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS contact_email TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS contact_phone TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS whatsapp TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Global';
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'GB';
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS tax_id TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS address TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS city TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS website TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) DEFAULT 5.0;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS shipping_lines TEXT[];
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.forwarders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 7. SHIPPING_LINES TABLE
CREATE TABLE IF NOT EXISTS public.shipping_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  website TEXT,
  contact_email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  vessels_active INTEGER DEFAULT 0,
  tracking_url_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS code TEXT;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS website TEXT;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS contact_email TEXT;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS vessels_active INTEGER DEFAULT 0;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS tracking_url_template TEXT;
  ALTER TABLE public.shipping_lines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 8. RATE_CARDS TABLE
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE CASCADE,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  container_type TEXT DEFAULT 'Standard',
  container_size TEXT NOT NULL DEFAULT '40HC',
  currency TEXT NOT NULL DEFAULT 'USD',
  base_rate NUMERIC(12,2) NOT NULL DEFAULT 0.0,
  rate NUMERIC(12,2),
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  effective_from DATE,
  status TEXT NOT NULL DEFAULT 'Active',
  notes TEXT,
  card_name TEXT,
  lane TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  transit_days_min INTEGER,
  transit_days_max INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS forwarder_id UUID;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS shipping_line_id UUID;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS origin TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS destination TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS container_type TEXT DEFAULT 'Standard';
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS container_size TEXT DEFAULT '40HC';
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS base_rate NUMERIC(12,2) DEFAULT 0.0;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS rate NUMERIC(12,2);
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS valid_from DATE DEFAULT CURRENT_DATE;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS valid_until DATE;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS effective_from DATE;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS card_name TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS lane TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS pol_code TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS pol_name TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS pod_code TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS pod_name TEXT;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS transit_days_min INTEGER;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS transit_days_max INTEGER;
  ALTER TABLE public.rate_cards ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 9. BOOKINGS / MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT UNIQUE NOT NULL,
  movement_number TEXT,
  reference TEXT,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  rate_card_id UUID REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  booking_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  loading_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'Booking Requested',
  movement_status TEXT DEFAULT 'DRAFT',
  origin TEXT NOT NULL,
  origin_flag TEXT,
  destination TEXT NOT NULL,
  destination_flag TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  vessel_name TEXT,
  voyage_number TEXT,
  carrier TEXT,
  container_count INTEGER NOT NULL DEFAULT 1,
  container_type TEXT NOT NULL DEFAULT '40HC',
  container_size TEXT DEFAULT '40HC',
  cargo_description TEXT,
  product_description TEXT,
  special_instructions TEXT,
  gross_weight_kg NUMERIC(12,2),
  cbm NUMERIC(10,2),
  rate_amount NUMERIC(12,2),
  total_freight NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  cutoff_si TIMESTAMPTZ,
  cutoff_vgm TIMESTAMPTZ,
  cutoff_gate TIMESTAMPTZ,
  cutoff_doc TIMESTAMPTZ,
  is_movement_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmation_status TEXT DEFAULT 'PENDING',
  confirmed_at TIMESTAMPTZ,
  confirmed_by TEXT,
  confirmation_email_id TEXT,
  confirmation_reason TEXT,
  confirmation_detected_by TEXT,
  confirmation_confidence NUMERIC(4,3),
  confirmation_details JSONB,
  cut_off_dates JSONB,
  cut_off_deadlines JSONB,
  forwarder_confirmed_rate NUMERIC(12,2),
  forwarder_confirmed_currency TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS movement_number TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reference TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS buyer_id UUID;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS supplier_id UUID;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS forwarder_id UUID;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS shipping_line_id UUID;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rate_card_id UUID;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS booking_date TIMESTAMPTZ DEFAULT timezone('utc'::text, now());
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS loading_date TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Booking Requested';
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS movement_status TEXT DEFAULT 'DRAFT';
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS origin TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS origin_flag TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS destination TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS destination_flag TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pol_code TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pol_name TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pod_code TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pod_name TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS vessel_name TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS voyage_number TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS carrier TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS container_count INTEGER DEFAULT 1;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS container_type TEXT DEFAULT '40HC';
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS container_size TEXT DEFAULT '40HC';
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cargo_description TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS product_description TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS special_instructions TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS gross_weight_kg NUMERIC(12,2);
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cbm NUMERIC(10,2);
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rate_amount NUMERIC(12,2);
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS total_freight NUMERIC(12,2);
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS etd TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS eta TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cutoff_si TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cutoff_vgm TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cutoff_gate TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cutoff_doc TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_movement_confirmed BOOLEAN DEFAULT false;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'PENDING';
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmed_by TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_email_id TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_reason TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_detected_by TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_confidence NUMERIC(4,3);
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS confirmation_details JSONB;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cut_off_dates JSONB;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS cut_off_deadlines JSONB;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS forwarder_confirmed_rate NUMERIC(12,2);
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS forwarder_confirmed_currency TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS created_by TEXT;
  ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 10. BOOKING_CONTAINERS TABLE
CREATE TABLE IF NOT EXISTS public.booking_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  container_number TEXT NOT NULL,
  seal_number TEXT,
  container_size TEXT DEFAULT '40HC',
  container_type TEXT DEFAULT '40HC',
  weight NUMERIC(10,2),
  weight_unit TEXT DEFAULT 'KG',
  status TEXT DEFAULT 'Gate-In',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. EMAIL_THREADS TABLE
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  gmail_thread_id TEXT UNIQUE,
  subject TEXT NOT NULL,
  snippet TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. FORWARDER_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.forwarder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE CASCADE,
  booking_reference TEXT NOT NULL,
  movement_number TEXT,
  forwarder_name TEXT NOT NULL,
  forwarder_email TEXT NOT NULL,
  forwarder_code TEXT,
  status TEXT NOT NULL DEFAULT 'AWAITING_OFFER',
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  responded_at TIMESTAMPTZ,
  origin TEXT,
  destination TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  supplier_name TEXT,
  buyer_name TEXT,
  container_type TEXT,
  container_count INTEGER DEFAULT 1,
  cargo_description TEXT,
  details JSONB,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.forwarder_requests ADD COLUMN IF NOT EXISTS booking_reference TEXT;
  ALTER TABLE public.forwarder_requests ADD COLUMN IF NOT EXISTS movement_number TEXT;
  ALTER TABLE public.forwarder_requests ADD COLUMN IF NOT EXISTS forwarder_code TEXT;
  ALTER TABLE public.forwarder_requests ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
  ALTER TABLE public.forwarder_requests ADD COLUMN IF NOT EXISTS details JSONB;
  ALTER TABLE public.forwarder_requests ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.forwarder_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 13. EMAIL_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  movement_id UUID,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL,
  movement_number TEXT,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  recipient_email TEXT NOT NULL DEFAULT 'ops@nashmia.com',
  recipient_name TEXT,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  cleaned_body TEXT,
  direction TEXT NOT NULL DEFAULT 'Inbound',
  status TEXT DEFAULT 'SAVED',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  received_at TIMESTAMPTZ,
  gmail_message_id TEXT UNIQUE,
  gmail_thread_id TEXT,
  in_reply_to TEXT,
  references_header TEXT,
  processing_status TEXT NOT NULL DEFAULT 'SAVED',
  matching_status TEXT,
  extraction_status TEXT,
  error_info JSONB,
  attachments JSONB DEFAULT '[]'::JSONB,
  raw_headers JSONB DEFAULT '{}'::JSONB,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS booking_id UUID;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS forwarder_id UUID;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS forwarder_request_id UUID;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS movement_number TEXT;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS gmail_thread_id TEXT;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS cleaned_body TEXT;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS in_reply_to TEXT;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS references_header TEXT;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'SAVED';
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS matching_status TEXT;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS extraction_status TEXT;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS error_info JSONB;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.email_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 14. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL,
  forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  movement_number TEXT,
  forwarder_name TEXT NOT NULL,
  forwarder_email TEXT NOT NULL,
  rate NUMERIC(12,2),
  rate_per_container NUMERIC(12,2),
  total_freight NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  container_type TEXT,
  container_count INTEGER DEFAULT 1,
  transit_time_days INTEGER,
  free_days INTEGER,
  validity_date DATE,
  valid_until TIMESTAMPTZ,
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  carrier_name TEXT,
  carrier TEXT,
  vessel_name TEXT,
  voyage_number TEXT,
  is_declined BOOLEAN NOT NULL DEFAULT false,
  needs_review BOOLEAN NOT NULL DEFAULT false,
  review_reasons TEXT[] DEFAULT '{}',
  confidence_score NUMERIC(4,3) DEFAULT 1.000,
  extraction_metadata JSONB DEFAULT '{}'::JSONB,
  field_audit JSONB DEFAULT '{}'::JSONB,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_current BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS request_id UUID;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS forwarder_request_id UUID;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS email_message_id UUID;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS movement_number TEXT;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS rate_per_container NUMERIC(12,2);
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS total_freight NUMERIC(12,2);
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS carrier TEXT;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS field_audit JSONB DEFAULT '{}'::JSONB;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS extraction_metadata JSONB DEFAULT '{}'::JSONB;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT false;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS review_reasons TEXT[] DEFAULT '{}';
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS organization_id UUID;
  ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
END $$;

-- 15. QUOTATION_VERSIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  rate NUMERIC(12,2),
  currency TEXT DEFAULT 'USD',
  transit_time_days INTEGER,
  free_days INTEGER,
  valid_until TIMESTAMPTZ,
  carrier TEXT,
  vessel_name TEXT,
  voyage_number TEXT,
  raw_payload JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 16. QUOTATION_FIELD_EXTRACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotation_field_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  extracted_value TEXT,
  confidence NUMERIC(4,3) DEFAULT 1.000,
  raw_snippet TEXT,
  source TEXT DEFAULT 'EMAIL_BODY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 17. EMAIL_MATCHES TABLE
CREATE TABLE IF NOT EXISTS public.email_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  movement_id UUID,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  movement_number TEXT,
  match_status TEXT NOT NULL DEFAULT 'MATCHED',
  match_reason TEXT,
  confidence NUMERIC(4,3) DEFAULT 1.000,
  matched_by TEXT,
  is_forwarder_validated BOOLEAN DEFAULT false,
  matched_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 18. EMAIL_CONFIRMATIONS TABLE
CREATE TABLE IF NOT EXISTS public.email_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  movement_id UUID,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  movement_number TEXT,
  confirmation_status TEXT NOT NULL DEFAULT 'PENDING',
  confidence NUMERIC(4,3) DEFAULT 0.000,
  detected_by TEXT,
  reason TEXT,
  classification TEXT,
  details TEXT,
  confirmed_rate NUMERIC(12,2),
  confirmed_currency TEXT,
  raw_payload JSONB DEFAULT '{}'::JSONB,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 19. BOOKING_EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  container_id TEXT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Status Update',
  description TEXT,
  location TEXT,
  occurred_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  event_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 20. BOOKING_DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.booking_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'Verified',
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 21. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  booking_id UUID,
  related_booking_id UUID,
  type TEXT DEFAULT 'booking_update',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 22. ACTIVITY_LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  description TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 23. SECURITY & ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures data can be read, written, updated, and deleted seamlessly without
-- RLS blockades for anon, authenticated, and service_role.
-- ============================================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'organizations',
    'profiles',
    'gmail_connections',
    'buyers',
    'suppliers',
    'forwarders',
    'shipping_lines',
    'rate_cards',
    'bookings',
    'booking_containers',
    'booking_events',
    'booking_documents',
    'email_threads',
    'forwarder_requests',
    'email_messages',
    'quotations',
    'quotation_versions',
    'quotation_field_extractions',
    'email_matches',
    'email_confirmations',
    'notifications',
    'activity_logs'
  ];
BEGIN
  FOR i IN 1..array_length(tables, 1) LOOP
    tbl := tables[i];
    
    -- Enable RLS on table
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    
    -- Drop existing wide policy if present to avoid duplication error
    EXECUTE format('DROP POLICY IF EXISTS "Allow full access for all roles" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public read access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public write access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public update access" ON public.%I;', tbl);
    EXECUTE format('DROP POLICY IF EXISTS "Public delete access" ON public.%I;', tbl);
    
    -- Create open access policy
    EXECUTE format('
      CREATE POLICY "Allow full access for all roles"
      ON public.%I
      FOR ALL
      USING (true)
      WITH CHECK (true);
    ', tbl);
  END LOOP;
END $$;

-- 24. GRANT SCHEMA & TABLE PERMISSIONS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;

-- 25. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_suppliers_preferred_port ON public.suppliers(preferred_port);
CREATE INDEX IF NOT EXISTS idx_buyers_preferred_port ON public.buyers(preferred_port);
CREATE INDEX IF NOT EXISTS idx_bookings_movement_number ON public.bookings(movement_number);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_booking_id ON public.forwarder_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_quotations_booking_id ON public.quotations(booking_id);
CREATE INDEX IF NOT EXISTS idx_quotations_forwarder_id ON public.quotations(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_msg_id ON public.email_messages(gmail_message_id);

-- 26. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
