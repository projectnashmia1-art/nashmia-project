-- ============================================================================
-- 07_BOOKINGS.SQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_reference TEXT UNIQUE NOT NULL,
  
  -- Protected Foreign Keys (Preserve historical booking records)
  buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  shipping_line_id UUID REFERENCES public.shipping_lines(id) ON DELETE SET NULL,
  rate_card_id UUID REFERENCES public.rate_cards(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Movement & Vessel Details
  booking_date DATE NOT NULL DEFAULT CURRENT_DATE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  vessel_name TEXT,
  voyage_number TEXT,
  etd DATE,
  eta DATE,
  
  -- Cargo & Equipment
  container_count INTEGER NOT NULL DEFAULT 1 CHECK (container_count > 0),
  container_type TEXT NOT NULL DEFAULT 'Dry Standard',
  container_size TEXT NOT NULL DEFAULT '40HC' CHECK (container_size IN ('20FT', '40FT', '40HC', '45HC')),
  
  -- Status & Notes
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (
    status IN ('Draft', 'Booking Requested', 'Confirmed', 'In Transit', 'Customs Hold', 'Delivered', 'Cancelled', 'Completed')
  ),
  notes TEXT,

  -- Live Workflow Integration Fields
  reference TEXT,
  pol_code TEXT,
  pol_name TEXT,
  pod_code TEXT,
  pod_name TEXT,
  loading_date DATE,
  product_description TEXT,
  special_instructions TEXT,
  rate_amount NUMERIC(10, 2),
  currency TEXT NOT NULL DEFAULT 'USD',
  total_freight NUMERIC(10, 2),

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
