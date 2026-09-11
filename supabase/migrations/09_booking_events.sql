-- ============================================================================
-- 09_BOOKING_EVENTS.SQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  location TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Auxiliary tracking & container integration fields
  container_id UUID REFERENCES public.booking_containers(id) ON DELETE SET NULL,
  title TEXT,
  occurred_at TIMESTAMPTZ,
  payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
