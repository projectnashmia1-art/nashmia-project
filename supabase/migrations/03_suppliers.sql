-- ============================================================================
-- 03_SUPPLIERS.SQL
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
  
  -- Supplier-specific & UI Compatibility Fields
  supplier_type TEXT DEFAULT 'Manufacturer',
  tax_id TEXT,
  currency TEXT DEFAULT 'USD',
  payment_terms TEXT DEFAULT 'Net 30',
  country_code TEXT,
  contact_role TEXT,
  factory_location TEXT,
  default_incoterm TEXT DEFAULT 'FOB',
  loading_port TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
