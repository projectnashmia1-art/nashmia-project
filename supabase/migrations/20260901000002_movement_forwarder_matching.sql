-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - MOVEMENT & FORWARDER MATCHING (STEP 3)
-- Migration: 20260901000002_movement_forwarder_matching.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Add match tracking columns to email_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'match_status'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN match_status TEXT NOT NULL DEFAULT 'UNMATCHED';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'match_reason'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN match_reason TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'matched_by'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN matched_by TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'matched_at'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN matched_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'match_details'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN match_details JSONB DEFAULT '{}'::JSONB;
  END IF;
END $$;

-- 2. Create dedicated email_matches table to store and audit all movement-forwarder matches
CREATE TABLE IF NOT EXISTS public.email_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  movement_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  email_message_id UUID REFERENCES public.email_messages(id) ON DELETE CASCADE,
  match_status TEXT NOT NULL CHECK (match_status IN ('MATCHED', 'NEEDS_REVIEW', 'UNMATCHED', 'PENDING')),
  matched_by TEXT NOT NULL DEFAULT 'NONE' CHECK (matched_by IN ('THREAD_ID', 'MOVEMENT_NUMBER', 'MANUAL', 'NONE')),
  movement_number TEXT,
  sender_email TEXT,
  match_reason TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unq_email_matches_msg_id UNIQUE (email_message_id)
);

-- 3. Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_email_messages_match_status ON public.email_messages(match_status);
CREATE INDEX IF NOT EXISTS idx_email_messages_matched_by ON public.email_messages(matched_by);
CREATE INDEX IF NOT EXISTS idx_email_matches_booking_id ON public.email_matches(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_matches_movement_id ON public.email_matches(movement_id);
CREATE INDEX IF NOT EXISTS idx_email_matches_forwarder_id ON public.email_matches(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_email_matches_msg_id ON public.email_matches(email_message_id);
CREATE INDEX IF NOT EXISTS idx_email_matches_status ON public.email_matches(match_status);
CREATE INDEX IF NOT EXISTS idx_email_matches_movement_number ON public.email_matches(movement_number);
