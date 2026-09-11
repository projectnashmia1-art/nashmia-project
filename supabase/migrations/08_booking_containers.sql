-- ============================================================================
-- 08_BOOKING_CONTAINERS.SQL
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
