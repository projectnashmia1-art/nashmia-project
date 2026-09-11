-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - RATE CARDS BACKEND (STEP 4)
-- Migration: 20260819000004_rate_cards_backend.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. RATE_CARDS TABLE
-- ============================================================================

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
  
  -- Workflow & Route Integration Fields
  card_name TEXT,
  lane TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  rate NUMERIC(12, 2), -- Synced base rate column for frontend compatibility
  effective_from TIMESTAMPTZ, -- Synced valid_from alias for workflow compatibility
  transit_days_min INTEGER CHECK (transit_days_min IS NULL OR transit_days_min >= 0),
  transit_days_max INTEGER CHECK (transit_days_max IS NULL OR transit_days_max >= transit_days_min),

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  -- Enforce valid dates and flexible 3-4 letter ISO standard currency codes (USD, EUR, GBP, AED, PKR, etc.)
  CONSTRAINT chk_rate_card_validity CHECK (valid_until >= valid_from),
  CONSTRAINT chk_rate_card_currency_format CHECK (currency ~ '^[A-Z]{3,4}$')
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_rate_cards_user_id ON public.rate_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_forwarder_id ON public.rate_cards(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_shipping_line_id ON public.rate_cards(shipping_line_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_origin_dest ON public.rate_cards(origin, destination);
CREATE INDEX IF NOT EXISTS idx_rate_cards_pol_pod ON public.rate_cards(pol_code, pod_code);
CREATE INDEX IF NOT EXISTS idx_rate_cards_container_size ON public.rate_cards(container_size);
CREATE INDEX IF NOT EXISTS idx_rate_cards_currency ON public.rate_cards(currency);
CREATE INDEX IF NOT EXISTS idx_rate_cards_status ON public.rate_cards(status);
CREATE INDEX IF NOT EXISTS idx_rate_cards_valid_dates ON public.rate_cards(valid_from, valid_until);

-- ============================================================================
-- 3. AUTOMATED UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS set_rate_cards_updated_at ON public.rate_cards;
CREATE TRIGGER set_rate_cards_updated_at
  BEFORE UPDATE ON public.rate_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES — USER OWNERSHIP
-- ============================================================================

ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own rate_cards" ON public.rate_cards;
CREATE POLICY "Users can view their own rate_cards"
  ON public.rate_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own rate_cards" ON public.rate_cards;
CREATE POLICY "Users can insert their own rate_cards"
  ON public.rate_cards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own rate_cards" ON public.rate_cards;
CREATE POLICY "Users can update their own rate_cards"
  ON public.rate_cards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own rate_cards" ON public.rate_cards;
CREATE POLICY "Users can delete their own rate_cards"
  ON public.rate_cards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
