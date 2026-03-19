-- Office dispatch events: commands sent from the virtual office to agents
CREATE TABLE IF NOT EXISTS office_dispatches (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_agent  TEXT NOT NULL,
  command_text  TEXT NOT NULL,
  action_type   TEXT,                -- e.g. 'ask_update', 'delegate_task', 'mark_blocked', 'free_command'
  project_key   TEXT,
  status        TEXT NOT NULL DEFAULT 'queued'
                CHECK (status IN ('queued', 'sent', 'acknowledged', 'blocked', 'done', 'failed')),
  metadata      JSONB DEFAULT '{}',
  issued_by     TEXT NOT NULL DEFAULT 'joao',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_dispatches_agent ON office_dispatches (target_agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_office_dispatches_status ON office_dispatches (status) WHERE status NOT IN ('done', 'failed');
