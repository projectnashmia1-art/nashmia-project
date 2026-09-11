-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - BOOKINGS & CONTAINERS BACKEND (STEP 5)
-- Migration: 20260819000005_bookings_backend.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. BOOKINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_reference TEXT UNIQUE NOT NULL,
  
  -- Foreign keys to directory entities with SET NULL (preserves audit/historical logs)
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  rate_card_id UUID REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  
  -- Core Booking & Movement Information
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

  -- Extended Booking Workflow Fields
  reference TEXT, -- Matching alias for frontend workflow
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

-- ============================================================================
-- 2. BOOKING_CONTAINERS TABLE (Supports Multiple Containers per Booking)
-- ============================================================================

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

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- Bookings Indexes
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

-- Booking Containers Indexes
CREATE INDEX IF NOT EXISTS idx_booking_containers_booking_id ON public.booking_containers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_containers_container_number ON public.booking_containers(container_number);
CREATE INDEX IF NOT EXISTS idx_booking_containers_status ON public.booking_containers(status);

-- ============================================================================
-- 4. AUTOMATED UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS set_bookings_updated_at ON public.bookings;
CREATE TRIGGER set_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_booking_containers_updated_at ON public.booking_containers;
CREATE TRIGGER set_booking_containers_updated_at
  BEFORE UPDATE ON public.booking_containers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES — USER OWNERSHIP
-- ============================================================================

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_containers ENABLE ROW LEVEL SECURITY;

-- Bookings RLS
DROP POLICY IF EXISTS "Users can view their own bookings" ON public.bookings;
CREATE POLICY "Users can view their own bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bookings" ON public.bookings;
CREATE POLICY "Users can insert their own bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bookings" ON public.bookings;
CREATE POLICY "Users can update their own bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bookings" ON public.bookings;
CREATE POLICY "Users can delete their own bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Booking Containers RLS (Scoped through parent booking ownership)
DROP POLICY IF EXISTS "Users can view their own booking_containers" ON public.booking_containers;
CREATE POLICY "Users can view their own booking_containers"
  ON public.booking_containers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own booking_containers" ON public.booking_containers;
CREATE POLICY "Users can insert their own booking_containers"
  ON public.booking_containers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own booking_containers" ON public.booking_containers;
CREATE POLICY "Users can update their own booking_containers"
  ON public.booking_containers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own booking_containers" ON public.booking_containers;
CREATE POLICY "Users can delete their own booking_containers"
  ON public.booking_containers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );
