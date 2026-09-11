-- ============================================================================
-- 05_SHIPPING_LINES.SQL
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shipping_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  website TEXT,
  contact_email TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Archived')),
  notes TEXT,
  
  -- Tracking & UI Compatibility Fields
  scac TEXT,
  tracking_url_template TEXT,
  booking_portal_url TEXT,
  headquarters TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
