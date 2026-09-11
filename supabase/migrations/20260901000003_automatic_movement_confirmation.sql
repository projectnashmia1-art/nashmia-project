-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - AUTOMATIC MOVEMENT CONFIRMATION (STEP 5)
-- Migration: 20260901000003_automatic_movement_confirmation.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Add confirmation tracking columns to bookings table
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmed_by'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmed_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_email_id'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_email_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_status'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_status TEXT DEFAULT 'PENDING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_reason'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_detected_by'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_detected_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_confidence'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_confidence NUMERIC(4, 3);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_details'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_details JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- 2. Performance indexes for confirmation queries
CREATE INDEX IF NOT EXISTS idx_bookings_confirmed_at ON public.bookings(confirmed_at);
CREATE INDEX IF NOT EXISTS idx_bookings_confirmed_by ON public.bookings(confirmed_by);
CREATE INDEX IF NOT EXISTS idx_bookings_confirmation_email_id ON public.bookings(confirmation_email_id);
CREATE INDEX IF NOT EXISTS idx_bookings_confirmation_status ON public.bookings(confirmation_status);
