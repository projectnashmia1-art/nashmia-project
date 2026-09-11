-- ============================================================================
-- 04_FORWARDERS.SQL
-- ============================================================================

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
  
  -- UI Compatibility Fields
  license_number TEXT,
  service_scope TEXT[] DEFAULT ARRAY['Ocean Freight', 'Air Freight', 'Customs Brokerage']::TEXT[],
  country_code TEXT,
  contact_role TEXT,
  primary_ports TEXT[] DEFAULT ARRAY[]::TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
