-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - DATABASE PERSISTENCE FOR QUOTATIONS & FORWARDER REQUESTS
-- Migration: 20260928000001_forwarder_requests_and_quotations.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Create table for Forwarder Requests (Parent for each forwarder dispatched per booking)
  CREATE TABLE IF NOT EXISTS public.forwarder_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
    request_id TEXT NOT NULL,
    movement_number TEXT,
    gmail_thread_id TEXT,
    status TEXT NOT NULL DEFAULT 'SENT',
    quotation_status TEXT DEFAULT 'PENDING',
    award_status TEXT DEFAULT 'NOT_AWARDED' CHECK (award_status IN ('NOT_AWARDED', 'AWARDED', 'PENDING')),
    sent_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    responded_at TIMESTAMPTZ,
    forwarder_name TEXT,
    forwarder_email TEXT,
    forwarder_code TEXT,
    details JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unq_forwarder_requests_booking_fwd UNIQUE (booking_id, forwarder_id)
  );

  -- 2. Create table for Structured Quotations
  CREATE TABLE IF NOT EXISTS public.quotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE CASCADE,
    email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
    forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
    movement_number TEXT,
    rate NUMERIC(12, 2),
    currency TEXT DEFAULT 'USD',
    container_type TEXT DEFAULT '40HC',
    container_quantity INTEGER DEFAULT 1,
    availability TEXT,
    etd TEXT,
    eta TEXT,
    transit_time INTEGER,
    freight_charges NUMERIC(12, 2),
    documentation_charges NUMERIC(12, 2),
    local_charges NUMERIC(12, 2),
    thc NUMERIC(12, 2),
    additional_charges TEXT,
    total_cost NUMERIC(12, 2),
    free_days INTEGER,
    vessel TEXT,
    voyage TEXT,
    pol TEXT,
    pod TEXT,
    rate_validity TEXT,
    expiry_date TEXT,
    notes TEXT,
    extraction_status TEXT DEFAULT 'SAVED',
    confidence_status TEXT DEFAULT 'HIGH',
    confidence_score NUMERIC(4, 3) DEFAULT 0.950,
    is_current BOOLEAN DEFAULT true,
    version_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
  );

  -- 3. Create table for Quotation Versions (audit history)
  CREATE TABLE IF NOT EXISTS public.quotation_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    changed_fields JSONB DEFAULT '[]'::JSONB,
    previous_values JSONB DEFAULT '{}'::JSONB,
    new_values JSONB DEFAULT '{}'::JSONB,
    source_email_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
    gmail_message_id TEXT,
    created_by TEXT DEFAULT 'SYSTEM',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
  );

  -- 4. Create table for Field-Level Extraction Traceability
  CREATE TABLE IF NOT EXISTS public.quotation_field_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quotation_id UUID NOT NULL REFERENCES public.quotations(id) ON DELETE CASCADE,
    email_message_id UUID REFERENCES public.email_messages(id) ON DELETE SET NULL,
    field_name TEXT NOT NULL,
    extracted_value TEXT,
    normalized_value TEXT,
    source_text TEXT,
    source_position TEXT,
    extraction_method TEXT DEFAULT 'DETERMINISTIC_RULES',
    confidence TEXT DEFAULT 'HIGH' CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW', 'NONE')),
    validation_status TEXT DEFAULT 'VALID' CHECK (validation_status IN ('VALID', 'INVALID', 'CONFLICT', 'NEEDS_REVIEW')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
  );

  -- 5. Extend email_messages with forwarder request & traceability fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'forwarder_request_id'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'in_reply_to'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN in_reply_to TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'references_header'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN references_header TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'cleaned_body'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN cleaned_body TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN processing_status TEXT DEFAULT 'SAVED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'matching_status'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN matching_status TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'extraction_status'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN extraction_status TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'error_info'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN error_info JSONB;
  END IF;

END $$;

-- 6. Indexes for efficient lookup & idempotency
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_booking_id ON public.forwarder_requests(booking_id);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_forwarder_id ON public.forwarder_requests(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_request_id ON public.forwarder_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_movement ON public.forwarder_requests(movement_number);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_gmail_thread ON public.forwarder_requests(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_status ON public.forwarder_requests(status);
CREATE INDEX IF NOT EXISTS idx_forwarder_requests_sent_at ON public.forwarder_requests(sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_quotations_booking_id ON public.quotations(booking_id);
CREATE INDEX IF NOT EXISTS idx_quotations_fwd_request_id ON public.quotations(forwarder_request_id);
CREATE INDEX IF NOT EXISTS idx_quotations_email_msg_id ON public.quotations(email_message_id);
CREATE INDEX IF NOT EXISTS idx_quotations_forwarder_id ON public.quotations(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_quotations_movement ON public.quotations(movement_number);
CREATE INDEX IF NOT EXISTS idx_quotations_is_current ON public.quotations(is_current);
CREATE INDEX IF NOT EXISTS idx_quotations_extraction_status ON public.quotations(extraction_status);

CREATE INDEX IF NOT EXISTS idx_quotation_versions_quotation_id ON public.quotation_versions(quotation_id);
CREATE INDEX IF NOT EXISTS idx_quotation_field_extractions_quotation ON public.quotation_field_extractions(quotation_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_fwd_request_id ON public.email_messages(forwarder_request_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_processing_status ON public.email_messages(processing_status);

-- 7. Row Level Security Enablement
ALTER TABLE public.forwarder_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotation_field_extractions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- forwarder_requests RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forwarder_requests' AND policyname = 'Allow authenticated read forwarder_requests') THEN
    CREATE POLICY "Allow authenticated read forwarder_requests" ON public.forwarder_requests FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forwarder_requests' AND policyname = 'Allow authenticated insert forwarder_requests') THEN
    CREATE POLICY "Allow authenticated insert forwarder_requests" ON public.forwarder_requests FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forwarder_requests' AND policyname = 'Allow authenticated update forwarder_requests') THEN
    CREATE POLICY "Allow authenticated update forwarder_requests" ON public.forwarder_requests FOR UPDATE USING (true);
  END IF;

  -- quotations RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotations' AND policyname = 'Allow authenticated read quotations') THEN
    CREATE POLICY "Allow authenticated read quotations" ON public.quotations FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotations' AND policyname = 'Allow authenticated insert quotations') THEN
    CREATE POLICY "Allow authenticated insert quotations" ON public.quotations FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotations' AND policyname = 'Allow authenticated update quotations') THEN
    CREATE POLICY "Allow authenticated update quotations" ON public.quotations FOR UPDATE USING (true);
  END IF;

  -- quotation_versions RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_versions' AND policyname = 'Allow authenticated read quotation_versions') THEN
    CREATE POLICY "Allow authenticated read quotation_versions" ON public.quotation_versions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_versions' AND policyname = 'Allow authenticated insert quotation_versions') THEN
    CREATE POLICY "Allow authenticated insert quotation_versions" ON public.quotation_versions FOR INSERT WITH CHECK (true);
  END IF;

  -- quotation_field_extractions RLS
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_field_extractions' AND policyname = 'Allow authenticated read quotation_field_extractions') THEN
    CREATE POLICY "Allow authenticated read quotation_field_extractions" ON public.quotation_field_extractions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'quotation_field_extractions' AND policyname = 'Allow authenticated insert quotation_field_extractions') THEN
    CREATE POLICY "Allow authenticated insert quotation_field_extractions" ON public.quotation_field_extractions FOR INSERT WITH CHECK (true);
  END IF;
END $$;
