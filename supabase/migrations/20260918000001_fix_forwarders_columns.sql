-- ============================================================================
-- 20260918000001_fix_forwarders_columns.sql
-- Ensure backward-compatible columns on public.forwarders table
-- ============================================================================

ALTER TABLE IF EXISTS public.forwarders
  ADD COLUMN IF NOT EXISTS badge TEXT DEFAULT 'Booking Agent',
  ADD COLUMN IF NOT EXISTS contract_tier TEXT,
  ADD COLUMN IF NOT EXISTS code TEXT;
