-- Add multilingual fields
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS input_language varchar(16) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS output_language varchar(16) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS normalized_transcript_en jsonb;
