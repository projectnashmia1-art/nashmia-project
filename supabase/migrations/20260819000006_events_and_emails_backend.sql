-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - BOOKING EVENTS & EMAIL CORRESPONDENCE (STEP 6)
-- Migration: 20260819000006_events_and_emails_backend.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. BOOKING_EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  location TEXT,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Auxiliary tracking & container integration fields
  container_id UUID REFERENCES public.booking_containers(id) ON DELETE SET NULL,
  title TEXT,
  occurred_at TIMESTAMPTZ,
  payload JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 2. EMAIL_THREADS TABLE (Gmail-Ready Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Archived', 'Pending Reply', 'Resolved', 'Closed')),
  
  -- Future Google Workspace / Gmail Sync Fields
  gmail_thread_id TEXT UNIQUE,
  snippet TEXT,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. EMAIL_MESSAGES TABLE (Gmail-Ready Schema)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  cc TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_id TEXT, -- RFC 2822 or Google Gmail Message ID
  direction TEXT NOT NULL CHECK (direction IN ('Inbound', 'Outbound')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  
  -- Future Google Workspace / Gmail Extended Fields
  gmail_message_id TEXT UNIQUE,
  sender_name TEXT,
  bcc TEXT,
  body_html TEXT,
  attachments JSONB DEFAULT '[]'::JSONB,
  raw_headers JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- Booking Events Indexes
CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON public.booking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_container_id ON public.booking_events(container_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_type ON public.booking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_date ON public.booking_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON public.booking_events(created_at DESC);

-- Email Threads Indexes
CREATE INDEX IF NOT EXISTS idx_email_threads_user_id ON public.email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_booking_id ON public.email_threads(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_gmail_thread_id ON public.email_threads(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON public.email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON public.email_threads(last_message_at DESC);

-- Email Messages Indexes
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_email ON public.email_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipient_email ON public.email_messages(recipient_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON public.email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_message_id ON public.email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON public.email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON public.email_messages(sent_at DESC);

-- ============================================================================
-- 5. AUTOMATED UPDATED_AT TRIGGER
-- ============================================================================

DROP TRIGGER IF EXISTS set_email_threads_updated_at ON public.email_threads;
CREATE TRIGGER set_email_threads_updated_at
  BEFORE UPDATE ON public.email_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

-- Booking Events RLS (Scoped via Parent Booking Ownership)
DROP POLICY IF EXISTS "Users can view their own booking_events" ON public.booking_events;
CREATE POLICY "Users can view their own booking_events"
  ON public.booking_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own booking_events" ON public.booking_events;
CREATE POLICY "Users can insert their own booking_events"
  ON public.booking_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own booking_events" ON public.booking_events;
CREATE POLICY "Users can update their own booking_events"
  ON public.booking_events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own booking_events" ON public.booking_events;
CREATE POLICY "Users can delete their own booking_events"
  ON public.booking_events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  );

-- Email Threads RLS (Direct User Ownership)
DROP POLICY IF EXISTS "Users can view their own email_threads" ON public.email_threads;
CREATE POLICY "Users can view their own email_threads"
  ON public.email_threads FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own email_threads" ON public.email_threads;
CREATE POLICY "Users can insert their own email_threads"
  ON public.email_threads FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own email_threads" ON public.email_threads;
CREATE POLICY "Users can update their own email_threads"
  ON public.email_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own email_threads" ON public.email_threads;
CREATE POLICY "Users can delete their own email_threads"
  ON public.email_threads FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Email Messages RLS (Scoped via Parent Thread Ownership)
DROP POLICY IF EXISTS "Users can view their own email_messages" ON public.email_messages;
CREATE POLICY "Users can view their own email_messages"
  ON public.email_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert their own email_messages" ON public.email_messages;
CREATE POLICY "Users can insert their own email_messages"
  ON public.email_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own email_messages" ON public.email_messages;
CREATE POLICY "Users can update their own email_messages"
  ON public.email_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own email_messages" ON public.email_messages;
CREATE POLICY "Users can delete their own email_messages"
  ON public.email_messages FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  );
