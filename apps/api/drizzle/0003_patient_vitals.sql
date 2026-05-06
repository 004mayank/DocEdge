ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group varchar(8);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS allergies text;
