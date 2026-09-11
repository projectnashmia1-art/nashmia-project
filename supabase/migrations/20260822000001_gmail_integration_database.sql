-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - GMAIL INTEGRATION DATABASE FOUNDATION (STEP 2)
-- Migration: 20260822000001_gmail_integration_database.sql
-- ============================================================================

-- Ensure required extensions are available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ORGANIZATIONS TABLE (Multi-tenant Foundation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  domain TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. GMAIL CONNECTIONS TABLE (Secure OAuth & Connection Management)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.gmail_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email TEXT NOT NULL,
  google_user_id TEXT,
  display_name TEXT,
  avatar_url TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,
  token_type TEXT DEFAULT 'Bearer',
  status TEXT NOT NULL DEFAULT 'connected' CHECK (
    status IN ('connected', 'active', 'disconnected', 'expired', 'revoked')
  ),
  last_sync_at TIMESTAMPTZ,
  sync_history_id TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unq_gmail_connections_user_email UNIQUE (user_id, google_email)
);

-- Gmail Connections Indexes
CREATE INDEX IF NOT EXISTS idx_gmail_connections_organization_id ON public.gmail_connections(organization_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_user_id ON public.gmail_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_google_email ON public.gmail_connections(google_email);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_status ON public.gmail_connections(status);
CREATE INDEX IF NOT EXISTS idx_gmail_connections_created_at ON public.gmail_connections(created_at DESC);

CREATE TRIGGER set_gmail_connections_updated_at
  BEFORE UPDATE ON public.gmail_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. EXTEND / ENSURE EMAIL_MESSAGES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.email_threads(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL,
  from_email TEXT,
  to_email TEXT,
  sender_email TEXT,
  recipient_email TEXT,
  sender_name TEXT,
  recipient_name TEXT,
  cc TEXT,
  bcc TEXT,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  snippet TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (
    direction IN ('inbound', 'outbound', 'Inbound', 'Outbound')
  ),
  email_type TEXT NOT NULL DEFAULT 'booking_request' CHECK (
    email_type IN (
      'booking_request', 'booking_confirmation', 'booking_update', 'general', 'system',
      'BOOKING_REQUEST', 'BOOKING_CONFIRMATION', 'BOOKING_UPDATE', 'GENERAL', 'SYSTEM'
    )
  ),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (
    status IN (
      'draft', 'pending', 'sending', 'sent', 'failed', 'cancelled',
      'DRAFT', 'PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED'
    )
  ),
  gmail_message_id TEXT,
  gmail_thread_id TEXT,
  message_id TEXT,
  error_message TEXT,
  attachments JSONB DEFAULT '[]'::JSONB,
  raw_headers JSONB,
  headers JSONB,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- In case email_messages already exists, safely add all required fields
DO $$
BEGIN
  -- Organization & Relationships
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'organization_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'user_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'booking_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'forwarder_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN forwarder_id UUID REFERENCES public.forwarders(id) ON DELETE SET NULL;
  END IF;

  -- Email addressing & content
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'from_email') THEN
    ALTER TABLE public.email_messages ADD COLUMN from_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'to_email') THEN
    ALTER TABLE public.email_messages ADD COLUMN to_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'recipient_name') THEN
    ALTER TABLE public.email_messages ADD COLUMN recipient_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'snippet') THEN
    ALTER TABLE public.email_messages ADD COLUMN snippet TEXT;
  END IF;

  -- Status & Typing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'email_type') THEN
    ALTER TABLE public.email_messages ADD COLUMN email_type TEXT NOT NULL DEFAULT 'booking_request';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'status') THEN
    ALTER TABLE public.email_messages ADD COLUMN status TEXT NOT NULL DEFAULT 'sent';
  END IF;

  -- Gmail API Metadata
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'gmail_thread_id') THEN
    ALTER TABLE public.email_messages ADD COLUMN gmail_thread_id TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'error_message') THEN
    ALTER TABLE public.email_messages ADD COLUMN error_message TEXT;
  END IF;

  -- Audit & Tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'created_by') THEN
    ALTER TABLE public.email_messages ADD COLUMN created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'email_messages' AND column_name = 'updated_at') THEN
    ALTER TABLE public.email_messages ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- Make thread_id nullable if it was previously NOT NULL to allow standalone message rows
ALTER TABLE public.email_messages ALTER COLUMN thread_id DROP NOT NULL;

-- Email Messages Indexes for High Performance Querying
CREATE INDEX IF NOT EXISTS idx_email_messages_booking_id ON public.email_messages(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_forwarder_id ON public.email_messages(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_organization_id ON public.email_messages(organization_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_by ON public.email_messages(created_by);
CREATE INDEX IF NOT EXISTS idx_email_messages_status ON public.email_messages(status);
CREATE INDEX IF NOT EXISTS idx_email_messages_email_type ON public.email_messages(email_type);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_message_id ON public.email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_thread_id ON public.email_messages(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_created_at ON public.email_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON public.email_messages(sent_at DESC);

-- Trigger for email_messages updated_at
DROP TRIGGER IF EXISTS set_email_messages_updated_at ON public.email_messages;
CREATE TRIGGER set_email_messages_updated_at
  BEFORE UPDATE ON public.email_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gmail_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Organizations RLS
CREATE POLICY "Allow authenticated read organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (true);

-- Gmail Connections RLS (Strict user token isolation)
DROP POLICY IF EXISTS "Users can view own gmail_connections" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can insert own gmail_connections" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can update own gmail_connections" ON public.gmail_connections;
DROP POLICY IF EXISTS "Users can delete own gmail_connections" ON public.gmail_connections;

CREATE POLICY "Users can view own gmail_connections"
  ON public.gmail_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own gmail_connections"
  ON public.gmail_connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own gmail_connections"
  ON public.gmail_connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own gmail_connections"
  ON public.gmail_connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Email Messages RLS
DROP POLICY IF EXISTS "Users can view own email_messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can insert own email_messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can update own email_messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can delete own email_messages" ON public.email_messages;
DROP POLICY IF EXISTS "Allow authenticated read email_messages" ON public.email_messages;
DROP POLICY IF EXISTS "Allow authenticated write email_messages" ON public.email_messages;

CREATE POLICY "Users can view own email_messages"
  ON public.email_messages FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = created_by
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.email_threads
      WHERE email_threads.id = email_messages.thread_id
      AND (email_threads.user_id = auth.uid() OR email_threads.user_id IS NULL)
    )
  );

CREATE POLICY "Users can insert own email_messages"
  ON public.email_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    OR auth.uid() = created_by 
    OR user_id IS NULL
  );

CREATE POLICY "Users can update own email_messages"
  ON public.email_messages FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = created_by 
    OR user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR auth.uid() = created_by 
    OR user_id IS NULL
  );

CREATE POLICY "Users can delete own email_messages"
  ON public.email_messages FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR auth.uid() = created_by
  );
