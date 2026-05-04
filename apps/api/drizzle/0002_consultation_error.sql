-- Track processing errors on consultations
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS error jsonb;
