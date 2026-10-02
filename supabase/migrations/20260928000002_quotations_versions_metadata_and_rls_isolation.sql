-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - QUOTATION VERSIONS, METADATA & STRICT RLS ISOLATION
-- Migration: 20260928000002_quotations_versions_metadata_and_rls_isolation.sql
-- ============================================================================

DO $$
BEGIN

  -- --------------------------------------------------------------------------
  -- 1. EXTEND TABLES FOR MULTI-TENANT ISOLATION & TRACEABILITY METADATA
  -- --------------------------------------------------------------------------

  -- 1a. Ensure profiles has organization_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.profiles 
      ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- 1b. Ensure bookings has organization_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.bookings 
      ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  -- 1c. Extend forwarder_requests with processing_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'forwarder_requests' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.forwarder_requests 
      ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'PENDING';
  END IF;

  -- 1d. Extend quotations with processing_status, validation_errors, and metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.quotations 
      ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'PROCESSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'validation_errors'
  ) THEN
    ALTER TABLE public.quotations 
      ADD COLUMN validation_errors JSONB DEFAULT '[]'::JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotations' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.quotations 
      ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
  END IF;

  -- 1e. Extend quotation_versions with organization_id, booking_id, forwarder_id, snapshots & metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'forwarder_id'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'rate'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN rate NUMERIC(12, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'currency'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN currency TEXT DEFAULT 'USD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'total_cost'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN total_cost NUMERIC(12, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'etd'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN etd TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'eta'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN eta TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'transit_time'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN transit_time INTEGER;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN processing_status TEXT DEFAULT 'PROCESSED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN confidence_score NUMERIC(4, 3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_versions' AND column_name = 'extraction_metadata'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD COLUMN extraction_metadata JSONB DEFAULT '{}'::JSONB;
  END IF;

  -- 1f. Extend quotation_field_extractions with organization_id, booking_id, version_number, patterns & metadata
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_field_extractions' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_field_extractions' AND column_name = 'booking_id'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD COLUMN booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_field_extractions' AND column_name = 'version_number'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD COLUMN version_number INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_field_extractions' AND column_name = 'pattern_matched'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD COLUMN pattern_matched TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_field_extractions' AND column_name = 'confidence_score'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD COLUMN confidence_score NUMERIC(4, 3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_field_extractions' AND column_name = 'validation_message'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD COLUMN validation_message TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'quotation_field_extractions' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;
  END IF;

END $$;

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS FOR STRICT ORGANIZATION ISOLATION
-- ----------------------------------------------------------------------------

-- Function to securely resolve the calling user's active organization ID
CREATE OR REPLACE FUNCTION public.get_auth_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- 1. Check profile organization_id directly in DB
    (SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1),
    -- 2. Check JWT user_metadata organization_id
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'organization_id'), '')::UUID,
    -- 3. Check JWT app_metadata organization_id
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'organization_id'), '')::UUID,
    -- 4. Check direct JWT claim
    NULLIF((auth.jwt() ->> 'organization_id'), '')::UUID
  );
$$;

-- ----------------------------------------------------------------------------
-- 3. VALIDATION CHECKS & INTEGRITY CONSTRAINTS
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  -- Rate format and bounds validation
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotations_rate_non_negative'
  ) THEN
    ALTER TABLE public.quotations 
      ADD CONSTRAINT chk_quotations_rate_non_negative 
      CHECK (rate IS NULL OR rate >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotations_total_cost_non_negative'
  ) THEN
    ALTER TABLE public.quotations 
      ADD CONSTRAINT chk_quotations_total_cost_non_negative 
      CHECK (total_cost IS NULL OR total_cost >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotations_currency_format'
  ) THEN
    ALTER TABLE public.quotations 
      ADD CONSTRAINT chk_quotations_currency_format 
      CHECK (currency IS NULL OR currency ~ '^[A-Z]{3,4}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotations_confidence_score_range'
  ) THEN
    ALTER TABLE public.quotations 
      ADD CONSTRAINT chk_quotations_confidence_score_range 
      CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotations_version_positive'
  ) THEN
    ALTER TABLE public.quotations 
      ADD CONSTRAINT chk_quotations_version_positive 
      CHECK (version_number >= 1);
  END IF;

  -- Version table checks
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotation_versions_version_positive'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD CONSTRAINT chk_quotation_versions_version_positive 
      CHECK (version_number >= 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotation_versions_confidence_score'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD CONSTRAINT chk_quotation_versions_confidence_score 
      CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotation_versions_rate_non_negative'
  ) THEN
    ALTER TABLE public.quotation_versions 
      ADD CONSTRAINT chk_quotation_versions_rate_non_negative 
      CHECK (rate IS NULL OR rate >= 0);
  END IF;

  -- Field extraction checks
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_quotation_fields_confidence_score'
  ) THEN
    ALTER TABLE public.quotation_field_extractions 
      ADD CONSTRAINT chk_quotation_fields_confidence_score 
      CHECK (confidence_score IS NULL OR (confidence_score >= 0.0 AND confidence_score <= 1.0));
  END IF;

END $$;

-- ----------------------------------------------------------------------------
-- 4. AUTOMATIC ORGANIZATION INHERITANCE TRIGGERS
-- ----------------------------------------------------------------------------

-- 4a. Auto-inherit organization_id on quotations from booking or request
CREATE OR REPLACE FUNCTION public.fn_inherit_quotations_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    -- Try from forwarder_request
    IF NEW.forwarder_request_id IS NOT NULL THEN
      SELECT organization_id INTO NEW.organization_id
      FROM public.forwarder_requests
      WHERE id = NEW.forwarder_request_id;
    END IF;

    -- Fallback to booking
    IF NEW.organization_id IS NULL AND NEW.booking_id IS NOT NULL THEN
      SELECT organization_id INTO NEW.organization_id
      FROM public.bookings
      WHERE id = NEW.booking_id;
    END IF;

    -- Fallback to authenticated user's organization
    IF NEW.organization_id IS NULL THEN
      NEW.organization_id := public.get_auth_organization_id();
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_quotations_org_id ON public.quotations;
CREATE TRIGGER trg_inherit_quotations_org_id
  BEFORE INSERT OR UPDATE ON public.quotations
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inherit_quotations_org_id();

-- 4b. Auto-inherit organization_id, booking_id, and forwarder_id on quotation_versions
CREATE OR REPLACE FUNCTION public.fn_inherit_quotation_versions_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.booking_id IS NULL OR NEW.forwarder_id IS NULL THEN
    SELECT 
      COALESCE(NEW.organization_id, q.organization_id),
      COALESCE(NEW.booking_id, q.booking_id),
      COALESCE(NEW.forwarder_id, q.forwarder_id)
    INTO 
      NEW.organization_id, 
      NEW.booking_id, 
      NEW.forwarder_id
    FROM public.quotations q
    WHERE q.id = NEW.quotation_id;
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_auth_organization_id();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_quotation_versions_org_id ON public.quotation_versions;
CREATE TRIGGER trg_inherit_quotation_versions_org_id
  BEFORE INSERT ON public.quotation_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inherit_quotation_versions_org_id();

-- 4c. Auto-inherit organization_id and booking_id on quotation_field_extractions
CREATE OR REPLACE FUNCTION public.fn_inherit_field_extractions_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.booking_id IS NULL THEN
    SELECT 
      COALESCE(NEW.organization_id, q.organization_id),
      COALESCE(NEW.booking_id, q.booking_id)
    INTO 
      NEW.organization_id, 
      NEW.booking_id
    FROM public.quotations q
    WHERE q.id = NEW.quotation_id;
  END IF;

  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_auth_organization_id();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_field_extractions_org_id ON public.quotation_field_extractions;
CREATE TRIGGER trg_inherit_field_extractions_org_id
  BEFORE INSERT ON public.quotation_field_extractions
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inherit_field_extractions_org_id();

-- 4d. Auto-inherit organization_id on forwarder_requests
CREATE OR REPLACE FUNCTION public.fn_inherit_forwarder_requests_org_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    IF NEW.booking_id IS NOT NULL THEN
      SELECT organization_id INTO NEW.organization_id
      FROM public.bookings
      WHERE id = NEW.booking_id;
    END IF;

    IF NEW.organization_id IS NULL THEN
      NEW.organization_id := public.get_auth_organization_id();
    END IF;
  END IF;

  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inherit_forwarder_requests_org_id ON public.forwarder_requests;
CREATE TRIGGER trg_inherit_forwarder_requests_org_id
  BEFORE INSERT OR UPDATE ON public.forwarder_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inherit_forwarder_requests_org_id();

-- ----------------------------------------------------------------------------
-- 5. PERFORMANCE & AUDIT INDEXES
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_bookings_organization_id ON public.bookings(organization_id);

CREATE INDEX IF NOT EXISTS idx_quotations_org_id ON public.quotations(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotations_processing_status ON public.quotations(processing_status);

CREATE INDEX IF NOT EXISTS idx_quotation_versions_org_id ON public.quotation_versions(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotation_versions_booking_id ON public.quotation_versions(booking_id);
CREATE INDEX IF NOT EXISTS idx_quotation_versions_lookup ON public.quotation_versions(quotation_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_quotation_fields_org_id ON public.quotation_field_extractions(organization_id);
CREATE INDEX IF NOT EXISTS idx_quotation_fields_booking_id ON public.quotation_field_extractions(booking_id);
CREATE INDEX IF NOT EXISTS idx_quotation_fields_field_name ON public.quotation_field_extractions(quotation_id, field_name);
CREATE INDEX IF NOT EXISTS idx_quotation_fields_val_status ON public.quotation_field_extractions(validation_status);

-- ----------------------------------------------------------------------------
-- 6. STRICT ROW LEVEL SECURITY (RLS) POLICIES FOR ORGANIZATION ISOLATION
-- ----------------------------------------------------------------------------

-- Ensure RLS is active
ALTER TABLE public.forwarder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_field_extractions ENABLE ROW LEVEL SECURITY;

-- 6a. Drop previous overly-permissive (USING true) policies
DROP POLICY IF EXISTS "Allow authenticated read forwarder_requests" ON public.forwarder_requests;
DROP POLICY IF EXISTS "Allow authenticated insert forwarder_requests" ON public.forwarder_requests;
DROP POLICY IF EXISTS "Allow authenticated update forwarder_requests" ON public.forwarder_requests;
DROP POLICY IF EXISTS "forwarder_requests_org_select" ON public.forwarder_requests;
DROP POLICY IF EXISTS "forwarder_requests_org_insert" ON public.forwarder_requests;
DROP POLICY IF EXISTS "forwarder_requests_org_update" ON public.forwarder_requests;
DROP POLICY IF EXISTS "forwarder_requests_org_delete" ON public.forwarder_requests;

-- Forwarder Requests Policies
CREATE POLICY "forwarder_requests_org_select"
  ON public.forwarder_requests FOR SELECT
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = forwarder_requests.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  );

CREATE POLICY "forwarder_requests_org_insert"
  ON public.forwarder_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = forwarder_requests.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
  );

CREATE POLICY "forwarder_requests_org_update"
  ON public.forwarder_requests FOR UPDATE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = forwarder_requests.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  )
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = forwarder_requests.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
  );

CREATE POLICY "forwarder_requests_org_delete"
  ON public.forwarder_requests FOR DELETE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = forwarder_requests.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
  );

-- 6b. Drop previous overly-permissive policies on quotations
DROP POLICY IF EXISTS "Allow authenticated read quotations" ON public.quotations;
DROP POLICY IF EXISTS "Allow authenticated insert quotations" ON public.quotations;
DROP POLICY IF EXISTS "Allow authenticated update quotations" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_select" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_insert" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_update" ON public.quotations;
DROP POLICY IF EXISTS "quotations_org_delete" ON public.quotations;

-- Quotations Policies
CREATE POLICY "quotations_org_select"
  ON public.quotations FOR SELECT
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = quotations.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
    OR (
      organization_id IS NULL AND EXISTS (
        SELECT 1 FROM public.forwarder_requests fr
        WHERE fr.id = quotations.forwarder_request_id
        AND (
          fr.organization_id = public.get_auth_organization_id() 
          OR (fr.organization_id IS NULL AND public.get_auth_organization_id() IS NULL)
        )
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  );

CREATE POLICY "quotations_org_insert"
  ON public.quotations FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = quotations.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
  );

CREATE POLICY "quotations_org_update"
  ON public.quotations FOR UPDATE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = quotations.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  )
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = quotations.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
  );

CREATE POLICY "quotations_org_delete"
  ON public.quotations FOR DELETE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = quotations.booking_id
      AND (
        b.user_id = auth.uid() 
        OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
      )
    )
  );

-- 6c. Drop previous overly-permissive policies on quotation_versions
DROP POLICY IF EXISTS "Allow authenticated read quotation_versions" ON public.quotation_versions;
DROP POLICY IF EXISTS "Allow authenticated insert quotation_versions" ON public.quotation_versions;
DROP POLICY IF EXISTS "quotation_versions_org_select" ON public.quotation_versions;
DROP POLICY IF EXISTS "quotation_versions_org_insert" ON public.quotation_versions;
DROP POLICY IF EXISTS "quotation_versions_org_update" ON public.quotation_versions;
DROP POLICY IF EXISTS "quotation_versions_org_delete" ON public.quotation_versions;

-- Quotation Versions Policies
CREATE POLICY "quotation_versions_org_select"
  ON public.quotation_versions FOR SELECT
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_versions.quotation_id
      AND (
        (q.organization_id IS NOT NULL AND q.organization_id = public.get_auth_organization_id())
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (
            b.user_id = auth.uid() 
            OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
          )
        )
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  );

CREATE POLICY "quotation_versions_org_insert"
  ON public.quotation_versions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_versions.quotation_id
      AND (
        q.organization_id = public.get_auth_organization_id()
        OR q.organization_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id())
        )
      )
    )
  );

CREATE POLICY "quotation_versions_org_update"
  ON public.quotation_versions FOR UPDATE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_versions.quotation_id
      AND (
        (q.organization_id IS NOT NULL AND q.organization_id = public.get_auth_organization_id())
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id())
        )
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  )
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_versions.quotation_id
      AND (
        q.organization_id = public.get_auth_organization_id()
        OR q.organization_id IS NULL
      )
    )
  );

CREATE POLICY "quotation_versions_org_delete"
  ON public.quotation_versions FOR DELETE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_versions.quotation_id
      AND (
        (q.organization_id IS NOT NULL AND q.organization_id = public.get_auth_organization_id())
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id())
        )
      )
    )
  );

-- 6d. Drop previous overly-permissive policies on quotation_field_extractions
DROP POLICY IF EXISTS "Allow authenticated read quotation_field_extractions" ON public.quotation_field_extractions;
DROP POLICY IF EXISTS "Allow authenticated insert quotation_field_extractions" ON public.quotation_field_extractions;
DROP POLICY IF EXISTS "quotation_field_extractions_org_select" ON public.quotation_field_extractions;
DROP POLICY IF EXISTS "quotation_field_extractions_org_insert" ON public.quotation_field_extractions;
DROP POLICY IF EXISTS "quotation_field_extractions_org_update" ON public.quotation_field_extractions;
DROP POLICY IF EXISTS "quotation_field_extractions_org_delete" ON public.quotation_field_extractions;

-- Quotation Field Extractions Policies
CREATE POLICY "quotation_field_extractions_org_select"
  ON public.quotation_field_extractions FOR SELECT
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_field_extractions.quotation_id
      AND (
        (q.organization_id IS NOT NULL AND q.organization_id = public.get_auth_organization_id())
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (
            b.user_id = auth.uid() 
            OR (b.organization_id IS NOT NULL AND b.organization_id = public.get_auth_organization_id())
          )
        )
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  );

CREATE POLICY "quotation_field_extractions_org_insert"
  ON public.quotation_field_extractions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_field_extractions.quotation_id
      AND (
        q.organization_id = public.get_auth_organization_id()
        OR q.organization_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id())
        )
      )
    )
  );

CREATE POLICY "quotation_field_extractions_org_update"
  ON public.quotation_field_extractions FOR UPDATE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_field_extractions.quotation_id
      AND (
        (q.organization_id IS NOT NULL AND q.organization_id = public.get_auth_organization_id())
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id())
        )
      )
    )
    OR (
      organization_id IS NULL AND public.get_auth_organization_id() IS NULL
    )
  )
  WITH CHECK (
    organization_id = public.get_auth_organization_id()
    OR organization_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_field_extractions.quotation_id
      AND (
        q.organization_id = public.get_auth_organization_id()
        OR q.organization_id IS NULL
      )
    )
  );

CREATE POLICY "quotation_field_extractions_org_delete"
  ON public.quotation_field_extractions FOR DELETE
  TO authenticated
  USING (
    (organization_id IS NOT NULL AND organization_id = public.get_auth_organization_id())
    OR EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_field_extractions.quotation_id
      AND (
        (q.organization_id IS NOT NULL AND q.organization_id = public.get_auth_organization_id())
        OR EXISTS (
          SELECT 1 FROM public.bookings b
          WHERE b.id = q.booking_id
          AND (b.user_id = auth.uid() OR b.organization_id = public.get_auth_organization_id())
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 7. ATOMIC STORED FUNCTION FOR QUOTATION VERSION & TRACEABILITY PERSISTENCE
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.save_quotation_version_and_metadata(
  p_quotation_id UUID,
  p_booking_id UUID,
  p_forwarder_id UUID,
  p_forwarder_request_id UUID,
  p_email_message_id UUID,
  p_movement_number TEXT,
  p_rate NUMERIC,
  p_currency TEXT,
  p_total_cost NUMERIC,
  p_etd TEXT,
  p_eta TEXT,
  p_transit_time INTEGER,
  p_container_type TEXT,
  p_container_quantity INTEGER,
  p_extraction_status TEXT,
  p_confidence_score NUMERIC,
  p_notes TEXT,
  p_raw_body TEXT,
  p_changed_fields JSONB,
  p_previous_values JSONB,
  p_new_values JSONB,
  p_field_extractions JSONB,
  p_is_revision BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_version_number INTEGER := 1;
  v_target_quote_id UUID := p_quotation_id;
  v_current_quote RECORD;
  v_field RECORD;
BEGIN
  -- 1. Resolve Organization ID
  SELECT organization_id INTO v_org_id FROM public.bookings WHERE id = p_booking_id;
  IF v_org_id IS NULL THEN
    v_org_id := public.get_auth_organization_id();
  END IF;

  -- 2. Check existing active quotation if revision requested
  IF v_target_quote_id IS NOT NULL THEN
    SELECT * INTO v_current_quote FROM public.quotations WHERE id = v_target_quote_id;
    IF FOUND THEN
      v_version_number := COALESCE(v_current_quote.version_number, 1);
    END IF;
  END IF;

  -- 3. Handle versioning
  IF p_is_revision AND v_target_quote_id IS NOT NULL AND v_current_quote.id IS NOT NULL THEN
    -- Snapshot current state into quotation_versions
    INSERT INTO public.quotation_versions (
      quotation_id,
      organization_id,
      booking_id,
      forwarder_id,
      version_number,
      rate,
      currency,
      total_cost,
      etd,
      eta,
      transit_time,
      processing_status,
      confidence_score,
      changed_fields,
      previous_values,
      new_values,
      source_email_id,
      created_by
    ) VALUES (
      v_current_quote.id,
      v_org_id,
      p_booking_id,
      p_forwarder_id,
      v_version_number,
      v_current_quote.rate,
      v_current_quote.currency,
      v_current_quote.total_cost,
      v_current_quote.etd,
      v_current_quote.eta,
      v_current_quote.transit_time,
      'ARCHIVED',
      v_current_quote.confidence_score,
      COALESCE(p_changed_fields, '[]'::JSONB),
      COALESCE(p_previous_values, '{}'::JSONB),
      COALESCE(p_new_values, '{}'::JSONB),
      v_current_quote.email_message_id,
      'SYSTEM'
    );

    -- Mark current as false and insert new version
    UPDATE public.quotations 
    SET is_current = false, updated_at = timezone('utc'::text, now()) 
    WHERE id = v_current_quote.id;

    v_version_number := v_version_number + 1;

    INSERT INTO public.quotations (
      organization_id,
      booking_id,
      forwarder_request_id,
      email_message_id,
      forwarder_id,
      movement_number,
      rate,
      currency,
      total_cost,
      etd,
      eta,
      transit_time,
      container_type,
      container_quantity,
      extraction_status,
      processing_status,
      confidence_score,
      confidence_status,
      is_current,
      version_number,
      notes
    ) VALUES (
      v_org_id,
      p_booking_id,
      p_forwarder_request_id,
      p_email_message_id,
      p_forwarder_id,
      p_movement_number,
      p_rate,
      p_currency,
      p_total_cost,
      p_etd,
      p_eta,
      p_transit_time,
      COALESCE(p_container_type, '40HC'),
      COALESCE(p_container_quantity, 1),
      COALESCE(p_extraction_status, 'SAVED'),
      'PROCESSED',
      p_confidence_score,
      CASE WHEN p_confidence_score >= 0.8 THEN 'HIGH' WHEN p_confidence_score >= 0.5 THEN 'MEDIUM' ELSE 'LOW' END,
      true,
      v_version_number,
      p_notes
    ) RETURNING id INTO v_target_quote_id;

  ELSIF v_target_quote_id IS NULL THEN
    -- First version
    INSERT INTO public.quotations (
      organization_id,
      booking_id,
      forwarder_request_id,
      email_message_id,
      forwarder_id,
      movement_number,
      rate,
      currency,
      total_cost,
      etd,
      eta,
      transit_time,
      container_type,
      container_quantity,
      extraction_status,
      processing_status,
      confidence_score,
      confidence_status,
      is_current,
      version_number,
      notes
    ) VALUES (
      v_org_id,
      p_booking_id,
      p_forwarder_request_id,
      p_email_message_id,
      p_forwarder_id,
      p_movement_number,
      p_rate,
      p_currency,
      p_total_cost,
      p_etd,
      p_eta,
      p_transit_time,
      COALESCE(p_container_type, '40HC'),
      COALESCE(p_container_quantity, 1),
      COALESCE(p_extraction_status, 'SAVED'),
      'PROCESSED',
      p_confidence_score,
      CASE WHEN p_confidence_score >= 0.8 THEN 'HIGH' WHEN p_confidence_score >= 0.5 THEN 'MEDIUM' ELSE 'LOW' END,
      true,
      1,
      p_notes
    ) RETURNING id INTO v_target_quote_id;
  END IF;

  -- 4. Insert Field Extractions Metadata if provided
  IF p_field_extractions IS NOT NULL AND jsonb_array_length(p_field_extractions) > 0 THEN
    FOR v_field IN SELECT * FROM jsonb_to_recordset(p_field_extractions) AS x(
      field_name TEXT,
      extracted_value TEXT,
      normalized_value TEXT,
      source_text TEXT,
      source_position TEXT,
      pattern_matched TEXT,
      extraction_method TEXT,
      confidence TEXT,
      confidence_score NUMERIC,
      validation_status TEXT,
      validation_message TEXT,
      metadata JSONB
    ) LOOP
      INSERT INTO public.quotation_field_extractions (
        quotation_id,
        organization_id,
        booking_id,
        email_message_id,
        version_number,
        field_name,
        extracted_value,
        normalized_value,
        source_text,
        source_position,
        pattern_matched,
        extraction_method,
        confidence,
        confidence_score,
        validation_status,
        validation_message,
        metadata
      ) VALUES (
        v_target_quote_id,
        v_org_id,
        p_booking_id,
        p_email_message_id,
        v_version_number,
        v_field.field_name,
        v_field.extracted_value,
        v_field.normalized_value,
        v_field.source_text,
        v_field.source_position,
        v_field.pattern_matched,
        COALESCE(v_field.extraction_method, 'DETERMINISTIC_RULES'),
        COALESCE(v_field.confidence, 'HIGH'),
        COALESCE(v_field.confidence_score, 0.950),
        COALESCE(v_field.validation_status, 'VALID'),
        v_field.validation_message,
        COALESCE(v_field.metadata, '{}'::JSONB)
      );
    END LOOP;
  END IF;

  -- 5. Update email_messages processing status
  IF p_email_message_id IS NOT NULL THEN
    UPDATE public.email_messages
    SET 
      processing_status = 'PROCESSED',
      extraction_status = COALESCE(p_extraction_status, 'SAVED'),
      matching_status = 'MATCHED',
      forwarder_request_id = p_forwarder_request_id,
      booking_id = p_booking_id,
      forwarder_id = p_forwarder_id,
      movement_number = p_movement_number,
      updated_at = timezone('utc'::text, now())
    WHERE id = p_email_message_id;
  END IF;

  -- 6. Update forwarder_requests quotation & processing status
  IF p_forwarder_request_id IS NOT NULL THEN
    UPDATE public.forwarder_requests
    SET 
      quotation_status = CASE WHEN p_is_revision THEN 'REVISED' ELSE 'RECEIVED' END,
      processing_status = 'PROCESSED',
      responded_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
    WHERE id = p_forwarder_request_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'quotation_id', v_target_quote_id,
    'version_number', v_version_number,
    'organization_id', v_org_id,
    'is_revision', p_is_revision
  );
END;
$$;
