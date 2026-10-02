-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - FULL POSTGRESQL BACKEND SCHEMA
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 0. ORGANIZATIONS (Multi-tenant Foundation)
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  domain TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
  v_avatar_url TEXT;
BEGIN
  v_full_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  v_avatar_url := NEW.raw_user_meta_data->>'avatar_url';

  INSERT INTO public.profiles (
    id,
    full_name,
    email,
    avatar_url,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(v_full_name, 'User'),
    NEW.email,
    v_avatar_url,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE 
      WHEN public.profiles.full_name IS NULL OR public.profiles.full_name = '' 
      THEN EXCLUDED.full_name 
      ELSE public.profiles.full_name 
    END,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. BUYERS
CREATE TABLE IF NOT EXISTS public.buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  notes TEXT,
  code TEXT,
  consignee TEXT,
  tax_id TEXT,
  country_code TEXT,
  contact_role TEXT,
  preferred_port TEXT,
  preferred_carrier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_buyers_user_id ON public.buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_buyers_company_name ON public.buyers(company_name);
CREATE INDEX IF NOT EXISTS idx_buyers_email ON public.buyers(email);
CREATE INDEX IF NOT EXISTS idx_buyers_status ON public.buyers(status);
CREATE INDEX IF NOT EXISTS idx_buyers_country ON public.buyers(country);

CREATE TRIGGER set_buyers_updated_at
  BEFORE UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  notes TEXT,
  code TEXT,
  subtitle TEXT,
  country_code TEXT,
  load_point TEXT NOT NULL DEFAULT 'Main Facility',
  load_point_city TEXT,
  load_point_type TEXT NOT NULL DEFAULT 'Warehouse' CHECK (
    load_point_type IN ('Warehouse', 'Distribution Center', 'Factory Hub', 'Port Depot', 'CFS Terminal', 'Cold Hub')
  ),
  contact_role TEXT,
  tax_id TEXT,
  operating_hours TEXT,
  pickup_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON public.suppliers(company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON public.suppliers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON public.suppliers(status);
CREATE INDEX IF NOT EXISTS idx_suppliers_country ON public.suppliers(country);
CREATE INDEX IF NOT EXISTS idx_suppliers_load_point_type ON public.suppliers(load_point_type);

CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. FORWARDERS
CREATE TABLE IF NOT EXISTS public.forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  notes TEXT,
  code TEXT,
  badge TEXT NOT NULL DEFAULT 'Booking Agent' CHECK (
    badge IN ('Booking Agent', 'Primary Forwarder', 'Regional Agent', 'Tier 1 Priority', 'Preferred Partner', 'Standard Forwarder')
  ),
  contact_role TEXT,
  whatsapp TEXT,
  country_code TEXT,
  shipping_lines TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_forwarders_user_id ON public.forwarders(user_id);
CREATE INDEX IF NOT EXISTS idx_forwarders_company_name ON public.forwarders(company_name);
CREATE INDEX IF NOT EXISTS idx_forwarders_email ON public.forwarders(email);
CREATE INDEX IF NOT EXISTS idx_forwarders_status ON public.forwarders(status);
CREATE INDEX IF NOT EXISTS idx_forwarders_badge ON public.forwarders(badge);

CREATE TRIGGER set_forwarders_updated_at
  BEFORE UPDATE ON public.forwarders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. SHIPPING_LINES
CREATE TABLE IF NOT EXISTS public.shipping_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  website TEXT,
  contact_email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  notes TEXT,
  vessels_active INTEGER NOT NULL DEFAULT 0 CHECK (vessels_active >= 0),
  tracking_url_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_user_id ON public.shipping_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_code ON public.shipping_lines(code);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_name ON public.shipping_lines(name);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_status ON public.shipping_lines(status);

CREATE TRIGGER set_shipping_lines_updated_at
  BEFORE UPDATE ON public.shipping_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RATE_CARDS
CREATE TABLE IF NOT EXISTS public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  forwarder_id UUID NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  container_type TEXT NOT NULL DEFAULT 'Dry Standard',
  container_size TEXT NOT NULL CHECK (container_size IN ('20FT', '40FT', '40HC', '45HC')),
  currency TEXT NOT NULL DEFAULT 'USD',
  base_rate NUMERIC(12, 2) NOT NULL CHECK (base_rate >= 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  valid_until TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expiring Soon', 'Draft', 'Expired', 'Archived')),
  notes TEXT,
  card_name TEXT,
  lane TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  rate NUMERIC(12, 2),
  effective_from TIMESTAMPTZ,
  transit_days_min INTEGER CHECK (transit_days_min IS NULL OR transit_days_min >= 0),
  transit_days_max INTEGER CHECK (transit_days_max IS NULL OR transit_days_max >= transit_days_min),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_rate_card_validity CHECK (valid_until >= valid_from),
  CONSTRAINT chk_rate_card_currency_format CHECK (currency ~ '^[A-Z]{3,4}$')
);
CREATE INDEX IF NOT EXISTS idx_rate_cards_user_id ON public.rate_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_forwarder_id ON public.rate_cards(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_shipping_line_id ON public.rate_cards(shipping_line_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_origin_dest ON public.rate_cards(origin, destination);
CREATE INDEX IF NOT EXISTS idx_rate_cards_pol_pod ON public.rate_cards(pol_code, pod_code);
CREATE INDEX IF NOT EXISTS idx_rate_cards_container_size ON public.rate_cards(container_size);
CREATE INDEX IF NOT EXISTS idx_rate_cards_currency ON public.rate_cards(currency);
CREATE INDEX IF NOT EXISTS idx_rate_cards_status ON public.rate_cards(status);
CREATE INDEX IF NOT EXISTS idx_rate_cards_valid_dates ON public.rate_cards(valid_from, valid_until);

CREATE TRIGGER set_rate_cards_updated_at
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. BOOKINGS
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_reference TEXT UNIQUE NOT NULL,
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  rate_card_id UUID REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  booking_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  vessel_name TEXT,
  voyage_number TEXT,
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  container_count INTEGER NOT NULL DEFAULT 1 CHECK (container_count > 0),
  container_type TEXT NOT NULL DEFAULT 'Dry Standard',
  container_size TEXT NOT NULL DEFAULT '40HC' CHECK (container_size IN ('20FT', '40FT', '40HC', '45HC')),
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (
    status IN ('Draft', 'Booking Requested', 'Confirmed', 'In Transit', 'Customs Hold', 'Delivered', 'Cancelled', 'Completed')
  ),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reference TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  loading_date TIMESTAMPTZ,
  product_description TEXT,
  special_instructions TEXT,
  rate_amount NUMERIC(12, 2) CHECK (rate_amount IS NULL OR rate_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  total_freight NUMERIC(12, 2) CHECK (total_freight IS NULL OR total_freight >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT chk_bookings_eta_after_etd CHECK (eta IS NULL OR etd IS NULL OR eta >= etd),
  CONSTRAINT chk_bookings_currency_format CHECK (currency ~ '^[A-Z]{3,4}$')
);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_id ON public.bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier_id ON public.bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_forwarder_id ON public.bookings(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shipping_line_id ON public.bookings(shipping_line_id);
CREATE INDEX IF NOT EXISTS idx_bookings_rate_card_id ON public.bookings(rate_card_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON public.bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_etd_eta ON public.bookings(etd, eta);
CREATE INDEX IF NOT EXISTS idx_bookings_pol_pod ON public.bookings(pol_code, pod_code);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. BOOKING_CONTAINERS
CREATE TABLE IF NOT EXISTS public.booking_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  container_number TEXT,
  container_type TEXT NOT NULL DEFAULT 'Dry Standard',
  container_size TEXT NOT NULL DEFAULT '40HC' CHECK (container_size IN ('20FT', '40FT', '40HC', '45HC')),
  seal_number TEXT,
  weight NUMERIC(10, 2) CHECK (weight IS NULL OR weight >= 0),
  weight_unit TEXT NOT NULL DEFAULT 'KG' CHECK (weight_unit IN ('KG', 'MT', 'LBS')),
  status TEXT NOT NULL DEFAULT 'Allocated' CHECK (
    status IN ('Pending', 'Allocated', 'Loaded', 'Gated In', 'On Board', 'Discharged', 'Delivered', 'Empty Returned')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_booking_containers_booking_id ON public.booking_containers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_containers_container_number ON public.booking_containers(container_number);
CREATE INDEX IF NOT EXISTS idx_booking_containers_status ON public.booking_containers(status);

CREATE TRIGGER set_booking_containers_updated_at
  BEFORE UPDATE ON public.booking_containers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. BOOKING_EVENTS
CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  location TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  container_id UUID REFERENCES public.booking_containers(id) ON DELETE SET NULL,
  title TEXT,
  occurred_at TIMESTAMPTZ,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON public.booking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_container_id ON public.booking_events(container_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_type ON public.booking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_date ON public.booking_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON public.booking_events(created_at DESC);

-- 10. EMAIL_THREADS (Gmail-Ready Schema)
CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived', 'Pending Reply', 'Resolved', 'Closed')),
  gmail_thread_id TEXT UNIQUE,
  snippet TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_email_threads_user_id ON public.email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_booking_id ON public.email_threads(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_gmail_thread_id ON public.email_threads(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON public.email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON public.email_threads(last_message_at DESC);

CREATE TRIGGER set_email_threads_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. GMAIL_CONNECTIONS (Secure OAuth & Connection Management)
CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_user_id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  token_type TEXT DEFAULT 'Bearer',
  status TEXT NOT NULL DEFAULT 'connected' CHECK (
    status IN ('connected', 'active', 'disconnected', 'expired', 'revoked')
  ),
  last_sync_at TIMESTAMPTZ,
  sync_history_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unq_gmail_connections_user_email UNIQUE (user_id, google_email)
);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_organization_id ON public.gmail_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_google_email ON public.gmail_connections(google_email);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_status ON public.gmail_connections(status);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_created_at ON public.gmail_connections(created_at DESC);

CREATE TRIGGER set_gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. EMAIL_MESSAGES (Gmail-Ready Schema)
CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  from_email TEXT,
  to_email TEXT,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  sender_name TEXT,
  recipient_name TEXT,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,
  snippet TEXT,
  message_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('Inbound', 'Outbound', 'inbound', 'outbound')),
  email_type TEXT NOT NULL DEFAULT 'booking_request' CHECK (
    email_type IN (
      'booking_request', 'booking_confirmation', 'booking_update', 'general', 'system',
      'BOOKING_REQUEST', 'BOOKING_CONFIRMATION', 'BOOKING_UPDATE', 'GENERAL', 'SYSTEM'
    )
  ),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (
    status IN (
      'draft', 'pending', 'sending', 'sent', 'failed', 'cancelled',
      'DRAFT', 'PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'
    )
  ),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  gmail_message_id TEXT UNIQUE,
  gmail_thread_id TEXT,
  error_message TEXT,
  attachments JSONB DEFAULT '[]'::JSONB,
  raw_headers JSONB,
  headers JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_booking_id ON public.email_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_forwarder_id ON public.email_messages(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_organization_id ON public.email_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_email ON public.email_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipient_email ON public.email_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON public.email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_message_id ON public.email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_thread_id ON public.email_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON public.email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON public.email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON public.email_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON public.email_messages(created_at DESC);

CREATE TRIGGER set_email_messages_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info' CHECK (
    type IN ('info', 'success', 'warning', 'error', 'cutoff_warning', 'booking_status', 'email_received', 'system')
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_related_booking_id ON public.notifications(related_booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- 13. AUDIT_LOGS (Immutable System Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read organizations" ON public.organizations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow users to update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- BUYERS RLS
CREATE POLICY "Users can view their own buyers" ON public.buyers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own buyers" ON public.buyers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own buyers" ON public.buyers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own buyers" ON public.buyers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SUPPLIERS RLS
CREATE POLICY "Users can view their own suppliers" ON public.suppliers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own suppliers" ON public.suppliers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- FORWARDERS RLS
CREATE POLICY "Users can view their own forwarders" ON public.forwarders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own forwarders" ON public.forwarders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own forwarders" ON public.forwarders FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own forwarders" ON public.forwarders FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- SHIPPING_LINES RLS
CREATE POLICY "Users can view their own shipping_lines" ON public.shipping_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own shipping_lines" ON public.shipping_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own shipping_lines" ON public.shipping_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own shipping_lines" ON public.shipping_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- RATE_CARDS RLS
CREATE POLICY "Users can view their own rate_cards" ON public.rate_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own rate_cards" ON public.rate_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rate_cards" ON public.rate_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own rate_cards" ON public.rate_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- BOOKINGS RLS
CREATE POLICY "Users can view their own bookings" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bookings" ON public.bookings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bookings" ON public.bookings FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- BOOKING_CONTAINERS RLS
CREATE POLICY "Users can view their own booking_containers" ON public.booking_containers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_containers.booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "Users can insert their own booking_containers" ON public.booking_containers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_containers.booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "Users can update their own booking_containers" ON public.booking_containers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_containers.booking_id AND b.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_containers.booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "Users can delete their own booking_containers" ON public.booking_containers FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_containers.booking_id AND b.user_id = auth.uid())
);

-- BOOKING_EVENTS RLS
CREATE POLICY "Users can view their own booking_events" ON public.booking_events FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_events.booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "Users can insert their own booking_events" ON public.booking_events FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_events.booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "Users can update their own booking_events" ON public.booking_events FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_events.booking_id AND b.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_events.booking_id AND b.user_id = auth.uid())
);
CREATE POLICY "Users can delete their own booking_events" ON public.booking_events FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_events.booking_id AND b.user_id = auth.uid())
);

-- EMAIL_THREADS RLS
CREATE POLICY "Users can view their own email_threads" ON public.email_threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own email_threads" ON public.email_threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own email_threads" ON public.email_threads FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own email_threads" ON public.email_threads FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- GMAIL_CONNECTIONS RLS (Strict user token isolation)
CREATE POLICY "Users can view own gmail_connections" ON public.gmail_connections FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own gmail_connections" ON public.gmail_connections FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own gmail_connections" ON public.gmail_connections FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own gmail_connections" ON public.gmail_connections FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- EMAIL_MESSAGES RLS
CREATE POLICY "Users can view their own email_messages" ON public.email_messages FOR SELECT TO authenticated USING (
  auth.uid() = user_id 
  OR auth.uid() = created_by
  OR user_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.email_threads t
    WHERE t.id = email_messages.thread_id
    AND (t.user_id = auth.uid() OR t.user_id IS NULL)
  )
);
CREATE POLICY "Users can insert their own email_messages" ON public.email_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id 
  OR auth.uid() = created_by 
  OR user_id IS NULL
);
CREATE POLICY "Users can update their own email_messages" ON public.email_messages FOR UPDATE TO authenticated USING (
  auth.uid() = user_id 
  OR auth.uid() = created_by 
  OR user_id IS NULL
) WITH CHECK (
  auth.uid() = user_id 
  OR auth.uid() = created_by 
  OR user_id IS NULL
);
CREATE POLICY "Users can delete their own email_messages" ON public.email_messages FOR DELETE TO authenticated USING (
  auth.uid() = user_id 
  OR auth.uid() = created_by
);

-- NOTIFICATIONS RLS (Strict user isolation)
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- AUDIT_LOGS RLS (Strict user isolation; append-only)
CREATE POLICY "Users can view their own audit_logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own audit_logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ============================================================================
-- 14. FORWARDER REQUESTS & STRUCTURED QUOTATIONS (MULTI-TENANT & AUDITED)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.forwarder_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  request_id TEXT NOT NULL,
  movement_number TEXT,
  gmail_thread_id TEXT,
  status TEXT NOT NULL DEFAULT 'SENT',
  quotation_status TEXT DEFAULT 'PENDING',
  processing_status TEXT NOT NULL DEFAULT 'PENDING',
  award_status TEXT DEFAULT 'NOT_AWARDED' CHECK (award_status IN ('NOT_AWARDED', 'AWARDED', 'PENDING')),
  sent_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  responded_at TIMESTAMPTZ,
  forwarder_name TEXT,
  forwarder_email TEXT,
  forwarder_code TEXT,
  details JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unq_forwarder_requests_booking_fwd UNIQUE (booking_id, forwarder_id)
);

CREATE TABLE IF NOT EXISTS public.quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE CASCADE,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  movement_number TEXT,
  rate NUMERIC(12, 2) CHECK (rate IS NULL OR rate >= 0),
  currency TEXT DEFAULT 'USD' CHECK (currency IS NULL OR currency ~ '^[A-Z]{3,4}$'),
  container_type TEXT DEFAULT '40HC',
  container_quantity INTEGER DEFAULT 1,
  availability TEXT,
  etd TEXT,
  eta TEXT,
  transit_time INTEGER,
  freight_charges NUMERIC(12, 2),
  documentation_charges NUMERIC(12, 2),
  local_charges NUMERIC(12, 2),
  thc NUMERIC(12, 2),
  additional_charges TEXT,
  total_cost NUMERIC(12, 2) CHECK (total_cost IS NULL OR total_cost >= 0),
  free_days INTEGER,
  vessel TEXT,
  voyage TEXT,
  pol TEXT,
  pod TEXT,
  rate_validity TEXT,
  expiry_date TEXT,
  notes TEXT,
  extraction_status TEXT DEFAULT 'SAVED',
  processing_status TEXT NOT NULL DEFAULT 'PROCESSED',
  confidence_status TEXT DEFAULT 'HIGH',
  confidence_score NUMERIC(4, 3) DEFAULT 0.950 CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  validation_errors JSONB DEFAULT '[]'::JSONB,
  metadata JSONB DEFAULT '{}'::JSONB,
  is_current BOOLEAN DEFAULT true,
  version_number INTEGER DEFAULT 1 CHECK (version_number >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quotation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  version_number INTEGER NOT NULL CHECK (version_number >= 1),
  rate NUMERIC(12, 2) CHECK (rate IS NULL OR rate >= 0),
  currency TEXT DEFAULT 'USD',
  total_cost NUMERIC(12, 2),
  etd TEXT,
  eta TEXT,
  transit_time INTEGER,
  processing_status TEXT DEFAULT 'PROCESSED',
  confidence_score NUMERIC(4, 3) CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  changed_fields JSONB DEFAULT '[]'::JSONB,
  previous_values JSONB DEFAULT '{}'::JSONB,
  new_values JSONB DEFAULT '{}'::JSONB,
  extraction_metadata JSONB DEFAULT '{}'::JSONB,
  source_email_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  gmail_message_id TEXT,
  created_by TEXT DEFAULT 'SYSTEM',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.quotation_field_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
  version_number INTEGER DEFAULT 1,
  field_name TEXT NOT NULL,
  extracted_value TEXT,
  normalized_value TEXT,
  source_text TEXT,
  source_position TEXT,
  pattern_matched TEXT,
  extraction_method TEXT DEFAULT 'DETERMINISTIC_RULES',
  confidence TEXT DEFAULT 'HIGH' CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
  confidence_score NUMERIC(4, 3) CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0)),
  validation_status TEXT DEFAULT 'VALID' CHECK (validation_status IN ('VALID', 'INVALID', 'CONFLICT', 'NEEDS_REVIEW')),
  validation_message TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Organization helper function
CREATE OR REPLACE FUNCTION public.get_auth_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'organization_id'), '')::UUID,
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'organization_id'), '')::UUID,
    NULLIF((auth.jwt() ->> 'organization_id'), '')::UUID
  );
$$;

-- RLS FOR QUOTATION & FORWARDER WORKFLOW
ALTER TABLE public.forwarder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_field_extractions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "forwarder_requests_org_select" ON public.forwarder_requests FOR SELECT TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = forwarder_requests.booking_id AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id()))
    OR (organization_id IS NULL AND public.get_auth_organization_id() IS NULL)
  );

CREATE POLICY "forwarder_requests_org_insert" ON public.forwarder_requests FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = forwarder_requests.booking_id AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id()))
  );

CREATE POLICY "forwarder_requests_org_update" ON public.forwarder_requests FOR UPDATE TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = forwarder_requests.booking_id AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id()))
    OR (organization_id IS NULL AND public.get_auth_organization_id() IS NULL)
  );

CREATE POLICY "quotations_org_select" ON public.quotations FOR SELECT TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = quotations.booking_id AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id()))
    OR (organization_id IS NULL AND public.get_auth_organization_id() IS NULL)
  );

CREATE POLICY "quotations_org_insert" ON public.quotations FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = quotations.booking_id AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id()))
  );

CREATE POLICY "quotations_org_update" ON public.quotations FOR UPDATE TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = quotations.booking_id AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id()))
    OR (organization_id IS NULL AND public.get_auth_organization_id() IS NULL)
  );

CREATE POLICY "quotation_versions_org_select" ON public.quotation_versions FOR SELECT TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_versions.quotation_id AND (q.organization_id = public.get_auth_organization_id() OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = q.booking_id AND b.user_id = auth.uid())))
    OR (organization_id IS NULL AND public.get_auth_organization_id() IS NULL)
  );

CREATE POLICY "quotation_field_extractions_org_select" ON public.quotation_field_extractions FOR SELECT TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (SELECT 1 FROM public.quotations q WHERE q.id = quotation_field_extractions.quotation_id AND (q.organization_id = public.get_auth_organization_id() OR EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = q.booking_id AND b.user_id = auth.uid())))
    OR (organization_id IS NULL AND public.get_auth_organization_id() IS NULL)
  );

