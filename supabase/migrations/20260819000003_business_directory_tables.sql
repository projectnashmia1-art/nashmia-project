-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - BUSINESS DIRECTORY TABLES (STEP 3)
-- Migration: 20260819000003_business_directory_tables.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. BUYERS TABLE
-- ============================================================================

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
  -- Preserved operational fields from frontend data
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

DROP TRIGGER IF EXISTS set_buyers_updated_at ON public.buyers;
CREATE TRIGGER set_buyers_updated_at
  BEFORE UPDATE ON public.buyers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. SUPPLIERS TABLE
-- ============================================================================

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
  -- Preserved supplier-specific fields from frontend
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

DROP TRIGGER IF EXISTS set_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. FORWARDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.forwarders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT NOT NULL, -- Stored reliably for booking communications
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT NOT NULL,
  website TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  notes TEXT,
  -- Preserved forwarder-specific fields from frontend
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

DROP TRIGGER IF EXISTS set_forwarders_updated_at ON public.forwarders;
CREATE TRIGGER set_forwarders_updated_at
  BEFORE UPDATE ON public.forwarders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. SHIPPING_LINES TABLE
-- ============================================================================

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
  -- Preserved shipping line fields from frontend
  vessels_active INTEGER NOT NULL DEFAULT 0 CHECK (vessels_active >= 0),
  tracking_url_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_shipping_lines_user_id ON public.shipping_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_code ON public.shipping_lines(code);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_name ON public.shipping_lines(name);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_status ON public.shipping_lines(status);

DROP TRIGGER IF EXISTS set_shipping_lines_updated_at ON public.shipping_lines;
CREATE TRIGGER set_shipping_lines_updated_at
  BEFORE UPDATE ON public.shipping_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — USER OWNERSHIP
-- ============================================================================

ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_lines ENABLE ROW LEVEL SECURITY;

-- BUYERS RLS
DROP POLICY IF EXISTS "Users can view their own buyers" ON public.buyers;
CREATE POLICY "Users can view their own buyers"
  ON public.buyers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own buyers" ON public.buyers;
CREATE POLICY "Users can insert their own buyers"
  ON public.buyers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own buyers" ON public.buyers;
CREATE POLICY "Users can update their own buyers"
  ON public.buyers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own buyers" ON public.buyers;
CREATE POLICY "Users can delete their own buyers"
  ON public.buyers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- SUPPLIERS RLS
DROP POLICY IF EXISTS "Users can view their own suppliers" ON public.suppliers;
CREATE POLICY "Users can view their own suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own suppliers" ON public.suppliers;
CREATE POLICY "Users can insert their own suppliers"
  ON public.suppliers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own suppliers" ON public.suppliers;
CREATE POLICY "Users can update their own suppliers"
  ON public.suppliers FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own suppliers" ON public.suppliers;
CREATE POLICY "Users can delete their own suppliers"
  ON public.suppliers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- FORWARDERS RLS
DROP POLICY IF EXISTS "Users can view their own forwarders" ON public.forwarders;
CREATE POLICY "Users can view their own forwarders"
  ON public.forwarders FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own forwarders" ON public.forwarders;
CREATE POLICY "Users can insert their own forwarders"
  ON public.forwarders FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own forwarders" ON public.forwarders;
CREATE POLICY "Users can update their own forwarders"
  ON public.forwarders FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own forwarders" ON public.forwarders;
CREATE POLICY "Users can delete their own forwarders"
  ON public.forwarders FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- SHIPPING_LINES RLS
DROP POLICY IF EXISTS "Users can view their own shipping_lines" ON public.shipping_lines;
CREATE POLICY "Users can view their own shipping_lines"
  ON public.shipping_lines FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own shipping_lines" ON public.shipping_lines;
CREATE POLICY "Users can insert their own shipping_lines"
  ON public.shipping_lines FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own shipping_lines" ON public.shipping_lines;
CREATE POLICY "Users can update their own shipping_lines"
  ON public.shipping_lines FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own shipping_lines" ON public.shipping_lines;
CREATE POLICY "Users can delete their own shipping_lines"
  ON public.shipping_lines FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
