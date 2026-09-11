-- ============================================================================
-- 14_INDEXES.SQL (Performance & Scalability Indexes)
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

-- COMPANY_NAME & ENTITY NAME Indexes
CREATE INDEX IF NOT EXISTS idx_buyers_company_name ON public.buyers(company_name);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_name ON public.suppliers(company_name);
CREATE INDEX IF NOT EXISTS idx_forwarders_company_name ON public.forwarders(company_name);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_name ON public.shipping_lines(name);
CREATE INDEX IF NOT EXISTS idx_shipping_lines_code ON public.shipping_lines(code);

-- BOOKING_REFERENCE & STATUS Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON public.bookings(booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_reference ON public.bookings(reference);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);

-- BOOKING DATES Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_booking_date ON public.bookings(booking_date DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_loading_date ON public.bookings(loading_date);
CREATE INDEX IF NOT EXISTS idx_bookings_etd_eta ON public.bookings(etd, eta);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON public.bookings(created_at DESC);

-- CONTAINER_NUMBER & CONTAINERS Indexes
CREATE INDEX IF NOT EXISTS idx_booking_containers_container_number ON public.booking_containers(container_number);
CREATE INDEX IF NOT EXISTS idx_booking_containers_booking_id ON public.booking_containers(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_containers_status ON public.booking_containers(status);

-- DIRECTORY ENTITY FOREIGN KEY Indexes (Bookings & Rates)
CREATE INDEX IF NOT EXISTS idx_bookings_buyer_id ON public.bookings(buyer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_supplier_id ON public.bookings(supplier_id);
CREATE INDEX IF NOT EXISTS idx_bookings_forwarder_id ON public.bookings(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_bookings_shipping_line_id ON public.bookings(shipping_line_id);
CREATE INDEX IF NOT EXISTS idx_bookings_rate_card_id ON public.bookings(rate_card_id);

CREATE INDEX IF NOT EXISTS idx_rate_cards_forwarder_id ON public.rate_cards(forwarder_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_shipping_line_id ON public.rate_cards(shipping_line_id);
CREATE INDEX IF NOT EXISTS idx_rate_cards_lane ON public.rate_cards(lane);
CREATE INDEX IF NOT EXISTS idx_rate_cards_status ON public.rate_cards(status);

-- BOOKING EVENTS Indexes
CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON public.booking_events(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_container_id ON public.booking_events(container_id);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_type ON public.booking_events(event_type);
CREATE INDEX IF NOT EXISTS idx_booking_events_event_date ON public.booking_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_booking_events_created_at ON public.booking_events(created_at DESC);

-- EMAIL THREADS & MESSAGES Indexes
CREATE INDEX IF NOT EXISTS idx_email_threads_booking_id ON public.email_threads(booking_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_gmail_thread_id ON public.email_threads(gmail_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_threads_status ON public.email_threads(status);
CREATE INDEX IF NOT EXISTS idx_email_threads_last_message_at ON public.email_threads(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_messages_thread_id ON public.email_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_message_id ON public.email_messages(message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_gmail_message_id ON public.email_messages(gmail_message_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_direction ON public.email_messages(direction);
CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON public.email_messages(sent_at DESC);

-- NOTIFICATIONS & AUDIT Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_related_booking_id ON public.notifications(related_booking_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
