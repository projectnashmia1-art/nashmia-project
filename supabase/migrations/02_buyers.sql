-- ============================================================================
-- 02_BUYERS.SQL
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
  
  -- UI Compatibility Fields
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
