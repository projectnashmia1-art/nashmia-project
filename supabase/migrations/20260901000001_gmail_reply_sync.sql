-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - GMAIL INCOMING REPLY SYNC (STEP 2)
-- Migration: 20260901000001_gmail_reply_sync.sql
-- ============================================================================

DO $$
BEGIN
  -- Add received_at column to email_messages if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'received_at'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN received_at TIMESTAMPTZ;
  END IF;

  -- Add movement_id column to email_messages if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'movement_id'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN movement_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
  END IF;

  -- Add movement_number column to email_messages if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'movement_number'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN movement_number TEXT;
  END IF;

  -- Add movement_id column to email_threads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_threads' AND column_name = 'movement_id'
  ) THEN
    ALTER TABLE public.email_threads ADD COLUMN movement_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
  END IF;

  -- Add movement_number column to email_threads if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_threads' AND column_name = 'movement_number'
  ) THEN
    ALTER TABLE public.email_threads ADD COLUMN movement_number TEXT;
  END IF;
END $$;

-- Indexes for lightning fast lookups during Gmail syncing
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_msg_id ON public.email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_th_id ON public.email_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_mov_number ON public.email_messages(movement_number);
CREATE INDEX IF NOT EXISTS idx_email_threads_gmail_th_id ON public.email_threads(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_mov_number ON public.email_threads(movement_number);
CREATE INDEX IF NOT EXISTS idx_bookings_movement_number ON public.bookings(movement_number);
