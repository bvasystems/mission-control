-- Add direction field for bidirectional dispatch (operator→agent / agent→operator)
ALTER TABLE office_dispatches ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound';
-- outbound = operator sends command to agent
-- inbound  = agent sends message to operator

-- Timeout stale dispatches: queued > 5min → failed
-- (handled in API, this index helps the query)
CREATE INDEX IF NOT EXISTS idx_office_dispatches_stale
  ON office_dispatches (status, created_at)
  WHERE status IN ('queued', 'sent');
