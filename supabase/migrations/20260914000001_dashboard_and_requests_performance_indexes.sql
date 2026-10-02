-- ============================================================================
-- NASHMIA GLOBAL OPERATIONS HUB - DASHBOARD & REQUESTS PERFORMANCE INDEXES
-- Migration: 20260914000001_dashboard_and_requests_performance_indexes.sql
-- ============================================================================

DO $$
BEGIN
  -- 1. Ensure required columns exist on public.bookings for composite indexing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'movement_number'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN movement_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmation_status'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmation_status TEXT DEFAULT 'PENDING';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'confirmed_at'
  ) THEN
    ALTER TABLE public.bookings ADD COLUMN confirmed_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- 1. BOOKINGS TABLE (Core Dashboard, RLS, KPI & Lifecycle Indexes)
-- ============================================================================

-- Fast RLS & KPI status lookups (e.g., user_id = X AND status IN (...))
CREATE INDEX IF NOT EXISTS idx_bookings_user_status 
  ON public.bookings(user_id, status);

-- Fast RLS & sorted movement list (e.g., user_id = X ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_bookings_user_created 
  ON public.bookings(user_id, created_at DESC);

-- Fast search & lifecycle lookups by movement number
CREATE INDEX IF NOT EXISTS idx_bookings_movement_number 
  ON public.bookings(movement_number);

CREATE INDEX IF NOT EXISTS idx_bookings_user_movement 
  ON public.bookings(user_id, movement_number);

-- Multi-field reference search & exact lookup
CREATE INDEX IF NOT EXISTS idx_bookings_user_ref 
  ON public.bookings(user_id, booking_reference);

CREATE INDEX IF NOT EXISTS idx_bookings_user_alt_ref 
  ON public.bookings(user_id, reference);

-- Status & Date ordering for Requests & Operations pages
CREATE INDEX IF NOT EXISTS idx_bookings_status_created 
  ON public.bookings(status, created_at DESC);

-- Fast entity relationship joins (Buyer, Supplier, Forwarder, Shipping Line)
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_status 
  ON public.bookings(buyer_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_supplier_status 
  ON public.bookings(supplier_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_forwarder_status 
  ON public.bookings(forwarder_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_shipping_line_status 
  ON public.bookings(shipping_line_id, status);

-- Cutoff, ETD, ETA and Scheduling range queries
CREATE INDEX IF NOT EXISTS idx_bookings_user_loading_date 
  ON public.bookings(user_id, loading_date);

CREATE INDEX IF NOT EXISTS idx_bookings_user_etd 
  ON public.bookings(user_id, etd);

CREATE INDEX IF NOT EXISTS idx_bookings_user_eta 
  ON public.bookings(user_id, eta);

-- Automated confirmation state index
CREATE INDEX IF NOT EXISTS idx_bookings_user_confirmation 
  ON public.bookings(user_id, confirmation_status);

-- ============================================================================
-- 2. FORWARDER OFFERS TABLE (Multi-Forwarder Quote Desk & Awarding)
-- ============================================================================

-- Fast lookup of offers for a specific booking request
CREATE INDEX IF NOT EXISTS idx_forwarder_offers_booking_status 
  ON public.forwarder_offers(booking_id, status);

-- Fast lookup of confirmed awards by movement number
CREATE INDEX IF NOT EXISTS idx_forwarder_offers_movement_confirmed 
  ON public.forwarder_offers(movement_number, is_confirmed);

-- Status & Recency sorting for multi-forwarder offers
CREATE INDEX IF NOT EXISTS idx_forwarder_offers_status_received 
  ON public.forwarder_offers(status, received_at DESC);

-- Forwarder email & movement lookup for automated quote parsers
CREATE INDEX IF NOT EXISTS idx_forwarder_offers_email_movement 
  ON public.forwarder_offers(forwarder_email, movement_number);

-- ============================================================================
-- 3. BOOKING CONTAINERS & EVENTS (Tracking & Sub-Item RLS)
-- ============================================================================

-- Fast container lookup per booking
CREATE INDEX IF NOT EXISTS idx_booking_containers_booking_status 
  ON public.booking_containers(booking_id, status);

-- Fast timeline query on booking events
CREATE INDEX IF NOT EXISTS idx_booking_events_booking_created 
  ON public.booking_events(booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_type 
  ON public.booking_events(booking_id, event_type);

-- ============================================================================
-- 4. NOTIFICATIONS (AI Notification Center & Badge Counts)
-- ============================================================================

-- Ultra-fast unread notification query (user_id = X AND is_read = false ORDER BY created_at DESC)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created 
  ON public.notifications(user_id, is_read, created_at DESC);

-- Lookup notifications linked to a specific booking
CREATE INDEX IF NOT EXISTS idx_notifications_booking_id 
  ON public.notifications(booking_id);

-- ============================================================================
-- 5. RATE CARDS (Lanes & Quoting)
-- ============================================================================

-- Fast lane lookup by active status and user
CREATE INDEX IF NOT EXISTS idx_rate_cards_user_status_lane 
  ON public.rate_cards(user_id, status, lane);

CREATE INDEX IF NOT EXISTS idx_rate_cards_forwarder_lane_status 
  ON public.rate_cards(forwarder_id, lane, status);

-- ============================================================================
-- 6. EMAIL THREADS & MESSAGES (Inbox & Communication Linking)
-- ============================================================================

-- Fast thread listing by user and recency
CREATE INDEX IF NOT EXISTS idx_email_threads_user_last_message 
  ON public.email_threads(user_id, last_message_at DESC);

-- Fast message retrieval for a thread
CREATE INDEX IF NOT EXISTS idx_email_messages_thread_sent 
  ON public.email_messages(thread_id, sent_at ASC);
