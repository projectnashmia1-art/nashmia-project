-- ============================================================================
-- 11_EMAIL_MESSAGES.SQL (Prepared for Gmail API Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.email_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  sender_email TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  cc TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  message_id TEXT,
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
