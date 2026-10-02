-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - DATA LAYER OPTIMIZATION & TARGETED INDEXES
-- Migration: 20260915000001_optimize_data_layer_and_indexes.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Ensure public.email_confirmations table exists with proper types
  CREATE TABLE IF NOT EXISTS public.email_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT,
    movement_number TEXT,
    confirmation_status TEXT DEFAULT 'CONFIRMED',
    confirmed_by TEXT DEFAULT 'Operations Desk',
    source TEXT DEFAULT 'OPERATIONS_APPROVAL',
    confirmed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2. Enable RLS on email_confirmations
  ALTER TABLE public.email_confirmations ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_confirmations' AND policyname = 'Allow authenticated read access to email_confirmations'
  ) THEN
    CREATE POLICY "Allow authenticated read access to email_confirmations" ON public.email_confirmations
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_confirmations' AND policyname = 'Allow insert access to email_confirmations'
  ) THEN
    CREATE POLICY "Allow insert access to email_confirmations" ON public.email_confirmations
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_confirmations' AND policyname = 'Allow update access to email_confirmations'
  ) THEN
    CREATE POLICY "Allow update access to email_confirmations" ON public.email_confirmations
      FOR UPDATE USING (true);
  END IF;
END $$;

-- ============================================================================
-- 2. TARGETED HIGH-SELECTIVITY INDEXES
-- ============================================================================

-- Buyers: user-scoped sorted lookups & company searches
CREATE INDEX IF NOT EXISTS idx_buyers_user_created 
  ON public.buyers(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_buyers_user_company 
  ON public.buyers(user_id, company_name);

-- Suppliers: user-scoped sorted lookups & company searches
CREATE INDEX IF NOT EXISTS idx_suppliers_user_created 
  ON public.suppliers(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_company 
  ON public.suppliers(user_id, company_name);

-- Forwarders: user-scoped alphabetical sorting & lookup
CREATE INDEX IF NOT EXISTS idx_forwarders_user_company 
  ON public.forwarders(user_id, company_name ASC);

-- Bookings: user-scoped status and date ordering
CREATE INDEX IF NOT EXISTS idx_bookings_user_status_created 
  ON public.bookings(user_id, status, created_at DESC);

-- Bookings: entity relationship recency indexes (prevents slow joins)
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_created 
  ON public.bookings(buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_supplier_created 
  ON public.bookings(supplier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_forwarder_created 
  ON public.bookings(forwarder_id, created_at DESC);

-- Forwarder Offers: multi-column lookup & ordering
CREATE INDEX IF NOT EXISTS idx_forwarder_offers_forwarder_status 
  ON public.forwarder_offers(forwarder_id, status);

CREATE INDEX IF NOT EXISTS idx_forwarder_offers_mov_fwd 
  ON public.forwarder_offers(movement_number, forwarder_id);

CREATE INDEX IF NOT EXISTS idx_forwarder_offers_received_desc 
  ON public.forwarder_offers(received_at DESC);

-- Email Confirmations: fast lookups by status, booking_id, movement_number
CREATE INDEX IF NOT EXISTS idx_email_confirmations_status 
  ON public.email_confirmations(confirmation_status);

CREATE INDEX IF NOT EXISTS idx_email_confirmations_booking 
  ON public.email_confirmations(booking_id);

CREATE INDEX IF NOT EXISTS idx_email_confirmations_mov 
  ON public.email_confirmations(movement_number);

-- Notifications: user-scoped recency
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON public.notifications(user_id, created_at DESC);

-- Email Messages: direction, organization and recency
CREATE INDEX IF NOT EXISTS idx_email_messages_dir_created 
  ON public.email_messages(direction, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_booking_recipient 
  ON public.email_messages(booking_id, recipient_email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_org_created 
  ON public.email_messages(organization_id, created_at DESC);
