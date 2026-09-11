-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - SYSTEM TABLES & RLS HARDENING (STEP 7)
-- Migration: 20260819000007_system_and_rls_hardening.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info' CHECK (
    type IN ('info', 'success', 'warning', 'error', 'cutoff_warning', 'booking_status', 'email_received', 'system')
  ),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  related_booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 2. AUDIT_LOGS TABLE (Immutable System Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  old_data JSONB,
  new_data JSONB,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. COMPREHENSIVE PERFORMANCE & QUERY INDEXES
-- ============================================================================

-- USER_ID Indexes across all user-scoped tables
CREATE INDEX IF NOT EXISTS idx_buyers_user_id ON public.buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_forwarders_user_id ON public.forwarders(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_user_id ON public.shipping_lines(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_user_id ON public.rate_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_user_id ON public.email_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);

-- EMAIL Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_buyers_email ON public.buyers(email);
CREATE INDEX IF NOT EXISTS idx_suppliers_email ON public.suppliers(email);
CREATE INDEX IF NOT EXISTS idx_forwarders_email ON public.forwarders(email);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_contact_email ON public.shipping_lines(contact_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_sender_email ON public.email_messages(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_messages_recipient_email ON public.email_messages(recipient_email);

-- COMPANY_NAME Indexes
CREATE INDEX IF NOT EXISTS idx_buyers_company_name ON public.buyers(company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON public.suppliers(company_name);
CREATE INDEX IF NOT EXISTS idx_forwarders_company_name ON public.forwarders(company_name);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_name ON public.shipping_lines(name);

-- BOOKING_REFERENCE & STATUS Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(reference);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- BOOKING DATES Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON public.bookings(booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_loading_date ON public.bookings(loading_date);
CREATE INDEX IF NOT EXISTS idx_bookings_etd_eta ON public.bookings(etd, eta);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

-- CONTAINER_NUMBER Indexes
CREATE INDEX IF NOT EXISTS idx_booking_containers_container_number ON public.booking_containers(container_number);
CREATE INDEX IF NOT EXISTS idx_booking_containers_booking_id ON public.booking_containers(booking_id);

-- DIRECTORY ENTITY FOREIGN KEY Indexes (Bookings & Rates)
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_id ON public.bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier_id ON public.bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_forwarder_id ON public.bookings(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shipping_line_id ON public.bookings(shipping_line_id);
CREATE INDEX IF NOT EXISTS idx_bookings_rate_card_id ON public.bookings(rate_card_id);

CREATE INDEX IF NOT EXISTS idx_rate_cards_forwarder_id ON public.rate_cards(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_shipping_line_id ON public.rate_cards(shipping_line_id);

-- Notifications & Audit Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_related_booking_id ON public.notifications(related_booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES — HARDENED USER ISOLATION
-- ============================================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- NOTIFICATIONS RLS (Strict auth.uid() = user_id isolation)
DROP POLICY IF EXISTS "Allow users to read their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow users to update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AUDIT_LOGS RLS (Strict user isolation; immutable append-only logs)
DROP POLICY IF EXISTS "Allow authenticated read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow authenticated insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view their own audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can insert their own audit_logs" ON public.audit_logs;

CREATE POLICY "Users can view their own audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
