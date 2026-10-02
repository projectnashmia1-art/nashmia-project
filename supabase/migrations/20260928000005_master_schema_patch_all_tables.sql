-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - MASTER COMPLETE DATABASE REPAIR & SYNC SCRIPT
-- Migration: 20260928000005_master_schema_patch_all_tables.sql
-- ============================================================================

-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Function to handle updated_at timestamps
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
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. BUYERS TABLE
CREATE TABLE IF NOT EXISTS public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  consignee TEXT,
  country TEXT NOT NULL,
  country_code TEXT,
  contact_person TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  tax_id TEXT,
  address TEXT,
  city TEXT,
  preferred_port TEXT,
  preferred_carrier TEXT,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'preferred_port') THEN
    ALTER TABLE public.buyers ADD COLUMN preferred_port TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'preferred_carrier') THEN
    ALTER TABLE public.buyers ADD COLUMN preferred_carrier TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'company_name') THEN
    ALTER TABLE public.buyers ADD COLUMN company_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'user_id') THEN
    ALTER TABLE public.buyers ADD COLUMN user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'organization_id') THEN
    ALTER TABLE public.buyers ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'buyers' AND column_name = 'updated_at') THEN
    ALTER TABLE public.buyers ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 3. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  subtitle TEXT,
  company_name TEXT,
  country TEXT NOT NULL,
  country_code TEXT,
  load_point TEXT NOT NULL DEFAULT 'Central Hub',
  load_point_city TEXT,
  load_point_type TEXT NOT NULL DEFAULT 'Warehouse',
  contact_person TEXT,
  contact_role TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  tax_id TEXT,
  address TEXT,
  city TEXT,
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'preferred_port') THEN
    ALTER TABLE public.suppliers ADD COLUMN preferred_port TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'company_name') THEN
    ALTER TABLE public.suppliers ADD COLUMN company_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'subtitle') THEN
    ALTER TABLE public.suppliers ADD COLUMN subtitle TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'load_point') THEN
    ALTER TABLE public.suppliers ADD COLUMN load_point TEXT DEFAULT 'Central Hub';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'load_point_city') THEN
    ALTER TABLE public.suppliers ADD COLUMN load_point_city TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'load_point_type') THEN
    ALTER TABLE public.suppliers ADD COLUMN load_point_type TEXT DEFAULT 'Warehouse';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'user_id') THEN
    ALTER TABLE public.suppliers ADD COLUMN user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'organization_id') THEN
    ALTER TABLE public.suppliers ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'suppliers' AND column_name = 'updated_at') THEN
    ALTER TABLE public.suppliers ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 4. FORWARDERS TABLE
CREATE TABLE IF NOT EXISTS public.forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  badge TEXT NOT NULL DEFAULT 'Booking Agent',
  contact_person TEXT,
  contact_role TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  country TEXT NOT NULL DEFAULT 'Global',
  country_code TEXT,
  status TEXT NOT NULL DEFAULT 'Active',
  tax_id TEXT,
  address TEXT,
  city TEXT,
  notes TEXT,
  rating NUMERIC(3,2) DEFAULT 5.0,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarders' AND column_name = 'contact_email') THEN
    ALTER TABLE public.forwarders ADD COLUMN contact_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarders' AND column_name = 'contact_phone') THEN
    ALTER TABLE public.forwarders ADD COLUMN contact_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarders' AND column_name = 'badge') THEN
    ALTER TABLE public.forwarders ADD COLUMN badge TEXT DEFAULT 'Booking Agent';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarders' AND column_name = 'user_id') THEN
    ALTER TABLE public.forwarders ADD COLUMN user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarders' AND column_name = 'organization_id') THEN
    ALTER TABLE public.forwarders ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarders' AND column_name = 'updated_at') THEN
    ALTER TABLE public.forwarders ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 5. BOOKINGS / MOVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT UNIQUE NOT NULL,
  movement_number TEXT,
  user_id UUID,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Draft',
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
  cargo_description TEXT,
  gross_weight_kg NUMERIC(12,2),
  cbm NUMERIC(10,2),
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  cutoff_si TIMESTAMPTZ,
  cutoff_vgm TIMESTAMPTZ,
  cutoff_gate TIMESTAMPTZ,
  cutoff_doc TIMESTAMPTZ,
  is_movement_confirmed BOOLEAN NOT NULL DEFAULT false,
  confirmation_status TEXT DEFAULT 'PENDING',
  confirmed_at TIMESTAMPTZ,
  forwarder_confirmed_rate NUMERIC(12,2),
  forwarder_confirmed_currency TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'movement_number') THEN
    ALTER TABLE public.bookings ADD COLUMN movement_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'movement_status') THEN
    ALTER TABLE public.bookings ADD COLUMN movement_status TEXT DEFAULT 'DRAFT';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'is_movement_confirmed') THEN
    ALTER TABLE public.bookings ADD COLUMN is_movement_confirmed BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_status') THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_status TEXT DEFAULT 'PENDING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmed_at') THEN
    ALTER TABLE public.bookings ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'forwarder_confirmed_rate') THEN
    ALTER TABLE public.bookings ADD COLUMN forwarder_confirmed_rate NUMERIC(12,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'forwarder_confirmed_currency') THEN
    ALTER TABLE public.bookings ADD COLUMN forwarder_confirmed_currency TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'pol_code') THEN
    ALTER TABLE public.bookings ADD COLUMN pol_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'pol_name') THEN
    ALTER TABLE public.bookings ADD COLUMN pol_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'pod_code') THEN
    ALTER TABLE public.bookings ADD COLUMN pod_code TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'pod_name') THEN
    ALTER TABLE public.bookings ADD COLUMN pod_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cutoff_si') THEN
    ALTER TABLE public.bookings ADD COLUMN cutoff_si TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cutoff_vgm') THEN
    ALTER TABLE public.bookings ADD COLUMN cutoff_vgm TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cutoff_gate') THEN
    ALTER TABLE public.bookings ADD COLUMN cutoff_gate TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'cutoff_doc') THEN
    ALTER TABLE public.bookings ADD COLUMN cutoff_doc TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'organization_id') THEN
    ALTER TABLE public.bookings ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'updated_at') THEN
    ALTER TABLE public.bookings ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 6. EMAIL_THREADS TABLE
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_threads' AND column_name = 'forwarder_id') THEN
    ALTER TABLE public.email_threads ADD COLUMN forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_threads' AND column_name = 'organization_id') THEN
    ALTER TABLE public.email_threads ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_threads' AND column_name = 'updated_at') THEN
    ALTER TABLE public.email_threads ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 7. FORWARDER_REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.forwarder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE CASCADE,
  booking_reference TEXT NOT NULL,
  movement_number TEXT,
  forwarder_name TEXT NOT NULL,
  forwarder_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_OFFER',
  gmail_thread_id TEXT,
  gmail_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
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
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarder_requests' AND column_name = 'movement_number') THEN
    ALTER TABLE public.forwarder_requests ADD COLUMN movement_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarder_requests' AND column_name = 'gmail_thread_id') THEN
    ALTER TABLE public.forwarder_requests ADD COLUMN gmail_thread_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarder_requests' AND column_name = 'gmail_message_id') THEN
    ALTER TABLE public.forwarder_requests ADD COLUMN gmail_message_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarder_requests' AND column_name = 'organization_id') THEN
    ALTER TABLE public.forwarder_requests ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'forwarder_requests' AND column_name = 'updated_at') THEN
    ALTER TABLE public.forwarder_requests ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 8. EMAIL_MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  movement_id UUID,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL,
  movement_number TEXT,
  sender_email TEXT NOT NULL,
  sender_name TEXT,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  cleaned_body TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('Inbound', 'Outbound')),
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
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'booking_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'forwarder_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'forwarder_request_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'movement_number') THEN
    ALTER TABLE public.email_messages ADD COLUMN movement_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'gmail_thread_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN gmail_thread_id TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'cleaned_body') THEN
    ALTER TABLE public.email_messages ADD COLUMN cleaned_body TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'in_reply_to') THEN
    ALTER TABLE public.email_messages ADD COLUMN in_reply_to TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'references_header') THEN
    ALTER TABLE public.email_messages ADD COLUMN references_header TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'processing_status') THEN
    ALTER TABLE public.email_messages ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'SAVED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'matching_status') THEN
    ALTER TABLE public.email_messages ADD COLUMN matching_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'extraction_status') THEN
    ALTER TABLE public.email_messages ADD COLUMN extraction_status TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'error_info') THEN
    ALTER TABLE public.email_messages ADD COLUMN error_info JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'organization_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'updated_at') THEN
    ALTER TABLE public.email_messages ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 9. QUOTATIONS TABLE
CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  movement_number TEXT,
  forwarder_name TEXT NOT NULL,
  forwarder_email TEXT NOT NULL,
  rate NUMERIC(12,2),
  currency TEXT,
  container_type TEXT,
  container_count INTEGER DEFAULT 1,
  transit_time_days INTEGER,
  free_days INTEGER,
  validity_date DATE,
  valid_until TIMESTAMPTZ,
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  carrier_name TEXT,
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
  version INTEGER NOT NULL DEFAULT 1,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'request_id') THEN
    ALTER TABLE public.quotations ADD COLUMN request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'email_message_id') THEN
    ALTER TABLE public.quotations ADD COLUMN email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'movement_number') THEN
    ALTER TABLE public.quotations ADD COLUMN movement_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'field_audit') THEN
    ALTER TABLE public.quotations ADD COLUMN field_audit JSONB DEFAULT '{}'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'extraction_metadata') THEN
    ALTER TABLE public.quotations ADD COLUMN extraction_metadata JSONB DEFAULT '{}'::JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'needs_review') THEN
    ALTER TABLE public.quotations ADD COLUMN needs_review BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'review_reasons') THEN
    ALTER TABLE public.quotations ADD COLUMN review_reasons TEXT[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'organization_id') THEN
    ALTER TABLE public.quotations ADD COLUMN organization_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'updated_at') THEN
    ALTER TABLE public.quotations ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 10. EMAIL_MATCHES TABLE
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

-- 11. EMAIL_CONFIRMATIONS TABLE
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

-- 12. BOOKING_EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  container_id TEXT,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  event_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. BOOKING_DOCUMENTS TABLE
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

-- 14. ACTIVITY_LOGS TABLE
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

-- 15. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_suppliers_preferred_port ON public.suppliers(preferred_port);
CREATE INDEX IF NOT EXISTS idx_buyers_preferred_port ON public.buyers(preferred_port);
CREATE INDEX IF NOT EXISTS idx_bookings_movement_number ON public.bookings(movement_number);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_booking_id ON public.forwarder_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_quotations_booking_id ON public.quotations(booking_id);
CREATE INDEX IF NOT EXISTS idx_quotations_forwarder_id ON public.quotations(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_msg_id ON public.email_messages(gmail_message_id);

-- 16. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
