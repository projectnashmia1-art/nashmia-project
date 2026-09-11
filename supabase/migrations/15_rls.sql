-- ============================================================================
-- 15_RLS.SQL (Row Level Security Policies - Strict User Isolation)
-- ============================================================================

-- Enable RLS across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. PROFILES RLS
CREATE POLICY "Allow authenticated users to read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Allow users to update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. BUYERS RLS
CREATE POLICY "Users can view their own buyers"
  ON public.buyers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own buyers"
  ON public.buyers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own buyers"
  ON public.buyers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own buyers"
  ON public.buyers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 3. SUPPLIERS RLS
CREATE POLICY "Users can view their own suppliers"
  ON public.suppliers FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own suppliers"
  ON public.suppliers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own suppliers"
  ON public.suppliers FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own suppliers"
  ON public.suppliers FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 4. FORWARDERS RLS
CREATE POLICY "Users can view their own forwarders"
  ON public.forwarders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own forwarders"
  ON public.forwarders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forwarders"
  ON public.forwarders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forwarders"
  ON public.forwarders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. SHIPPING_LINES RLS
CREATE POLICY "Users can view their own shipping_lines"
  ON public.shipping_lines FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shipping_lines"
  ON public.shipping_lines FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shipping_lines"
  ON public.shipping_lines FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shipping_lines"
  ON public.shipping_lines FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 6. RATE_CARDS RLS
CREATE POLICY "Users can view their own rate_cards"
  ON public.rate_cards FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own rate_cards"
  ON public.rate_cards FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rate_cards"
  ON public.rate_cards FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rate_cards"
  ON public.rate_cards FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 7. BOOKINGS RLS
CREATE POLICY "Users can view their own bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookings"
  ON public.bookings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
  ON public.bookings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bookings"
  ON public.bookings FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 8. BOOKING_CONTAINERS RLS (Scoped via Parent Booking Ownership)
CREATE POLICY "Users can view their own booking_containers"
  ON public.booking_containers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own booking_containers"
  ON public.booking_containers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own booking_containers"
  ON public.booking_containers FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own booking_containers"
  ON public.booking_containers FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_containers.booking_id
      AND b.user_id = auth.uid()
    )
  );

-- 9. BOOKING_EVENTS RLS (Scoped via Parent Booking Ownership)
CREATE POLICY "Users can view their own booking_events"
  ON public.booking_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own booking_events"
  ON public.booking_events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own booking_events"
  ON public.booking_events FOR UPDATE TO authenticated
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

CREATE POLICY "Users can delete their own booking_events"
  ON public.booking_events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_events.booking_id
      AND b.user_id = auth.uid()
    )
  );

-- 10. EMAIL_THREADS RLS
CREATE POLICY "Users can view their own email_threads"
  ON public.email_threads FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own email_threads"
  ON public.email_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email_threads"
  ON public.email_threads FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email_threads"
  ON public.email_threads FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 11. EMAIL_MESSAGES RLS (Scoped via Parent Thread Ownership)
CREATE POLICY "Users can view their own email_messages"
  ON public.email_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own email_messages"
  ON public.email_messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own email_messages"
  ON public.email_messages FOR UPDATE TO authenticated
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

CREATE POLICY "Users can delete their own email_messages"
  ON public.email_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.email_threads t
      WHERE t.id = email_messages.thread_id
      AND t.user_id = auth.uid()
    )
  );

-- 12. NOTIFICATIONS RLS (Strict user isolation)
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 13. AUDIT_LOGS RLS (Strict user isolation; append-only)
CREATE POLICY "Users can view their own audit_logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own audit_logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
