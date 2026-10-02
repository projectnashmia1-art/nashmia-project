-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - ENSURE UPDATED_AT & FULL SCHEMA REFRESH
-- Migration: 20260928000004_fix_email_messages_updated_at_and_schema.sql
-- ============================================================================

DO $$
BEGIN
  -- Ensure updated_at exists on email_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;

  -- Ensure cleaned_body exists on email_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'cleaned_body'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN cleaned_body TEXT;
  END IF;

  -- Ensure gmail_thread_id exists on email_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'gmail_thread_id'
  ) THEN
    ALTER TABLE public.email_messages ADD COLUMN gmail_thread_id TEXT;
  END IF;
END $$;

-- Set trigger if not already present
DROP TRIGGER IF EXISTS set_email_messages_updated_at ON public.email_messages;
CREATE TRIGGER set_email_messages_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Force reload of PostgREST schema cache
NOTIFY pgrst, 'reload schema';
