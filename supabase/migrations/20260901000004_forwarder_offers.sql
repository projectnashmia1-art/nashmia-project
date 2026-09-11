-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - INTELLIGENT EMAIL READING & FORWARDER OFFERS
-- Migration: 20260901000004_forwarder_offers.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Create table for storing AI-extracted and validated forwarder offers
  CREATE TABLE IF NOT EXISTS public.forwarder_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    movement_number TEXT,
    forwarder_id UUID,
    forwarder_name TEXT,
    forwarder_email TEXT,
    email_message_id TEXT,
    gmail_thread_id TEXT,
    gmail_message_id TEXT,
    rate_per_container NUMERIC(12, 2),
    total_freight NUMERIC(12, 2),
    currency TEXT DEFAULT 'USD',
    container_size TEXT DEFAULT '40HC',
    container_count INTEGER DEFAULT 1,
    space_available BOOLEAN DEFAULT true,
    is_declined BOOLEAN DEFAULT false,
    is_confirmed BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'OFFER_RECEIVED',
    etd TEXT,
    eta TEXT,
    transit_days INTEGER,
    free_days INTEGER,
    carrier TEXT,
    vessel_name TEXT,
    voyage_number TEXT,
    valid_until TEXT,
    notes TEXT,
    summary TEXT,
    confidence NUMERIC(4, 3) DEFAULT 0.950,
    extraction_method TEXT DEFAULT 'GEMINI_AI',
    raw_extracted_json JSONB DEFAULT '{}'::JSONB,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2. Indexes for efficient lookup
  CREATE INDEX IF NOT EXISTS idx_forwarder_offers_booking_id ON public.forwarder_offers(booking_id);
  CREATE INDEX IF NOT EXISTS idx_forwarder_offers_movement ON public.forwarder_offers(movement_number);
  CREATE INDEX IF NOT EXISTS idx_forwarder_offers_gmail_thread ON public.forwarder_offers(gmail_thread_id);
  CREATE INDEX IF NOT EXISTS idx_forwarder_offers_email_msg ON public.forwarder_offers(email_message_id);
  CREATE INDEX IF NOT EXISTS idx_forwarder_offers_forwarder ON public.forwarder_offers(forwarder_id);
  CREATE INDEX IF NOT EXISTS idx_forwarder_offers_status ON public.forwarder_offers(status);
  CREATE INDEX IF NOT EXISTS idx_forwarder_offers_received ON public.forwarder_offers(received_at DESC);

  -- 3. RLS enablement
  ALTER TABLE public.forwarder_offers ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forwarder_offers' AND policyname = 'Allow public read access to forwarder_offers'
  ) THEN
    CREATE POLICY "Allow public read access to forwarder_offers" ON public.forwarder_offers
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forwarder_offers' AND policyname = 'Allow insert access to forwarder_offers'
  ) THEN
    CREATE POLICY "Allow insert access to forwarder_offers" ON public.forwarder_offers
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'forwarder_offers' AND policyname = 'Allow update access to forwarder_offers'
  ) THEN
    CREATE POLICY "Allow update access to forwarder_offers" ON public.forwarder_offers
      FOR UPDATE USING (true);
  END IF;
END $$;
