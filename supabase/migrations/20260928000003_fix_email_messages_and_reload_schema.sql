-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - FIX EMAIL_MESSAGES COLUMNS & RELOAD SCHEMA CACHE
-- Migration: 20260928000003_fix_email_messages_and_reload_schema.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Ensure all email_messages columns exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'gmail_thread_id'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN gmail_thread_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'cleaned_body'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN cleaned_body TEXT;
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
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'processing_status'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'SAVED';
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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'forwarder_request_id'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN forwarder_request_id UUID REFERENCES public.forwarder_requests(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'body_html'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN body_html TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'received_at'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN received_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'sender_name'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN sender_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'movement_number'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN movement_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 2. Performance indexes on email_messages
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_thread_id ON public.email_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_forwarder_request_id ON public.email_messages(forwarder_request_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_processing_status ON public.email_messages(processing_status);
CREATE INDEX IF NOT EXISTS idx_email_messages_movement_number ON public.email_messages(movement_number);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
