-- Add response field to office_dispatches for agent replies
ALTER TABLE office_dispatches ADD COLUMN IF NOT EXISTS response TEXT;
ALTER TABLE office_dispatches ADD COLUMN IF NOT EXISTS responded_at TIMESTAMPTZ;
