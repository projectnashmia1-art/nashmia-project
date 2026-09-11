-- ============================================================================
-- 06_RATE_CARDS.SQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  container_type TEXT NOT NULL DEFAULT 'Dry Standard',
  container_size TEXT NOT NULL DEFAULT '40HC' CHECK (container_size IN ('20FT', '40FT', '40HC', '45HC')),
  currency TEXT NOT NULL DEFAULT 'USD',
  base_rate NUMERIC(10, 2) NOT NULL CHECK (base_rate >= 0),
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Expired', 'Draft', 'Pending Approval')),
  notes TEXT,
  
  -- Workflow Integration Fields
  card_name TEXT,
  lane TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  rate NUMERIC(10, 2),
  effective_from DATE,
  transit_days_min INTEGER CHECK (transit_days_min IS NULL OR transit_days_min >= 0),
  transit_days_max INTEGER CHECK (transit_days_max IS NULL OR transit_days_max >= 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

  CONSTRAINT check_rate_card_validity_dates CHECK (valid_until >= valid_from)
);
