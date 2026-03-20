-- Faísca autonomous actions — pending approval queue
CREATE TABLE IF NOT EXISTS autonomous_actions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        TEXT NOT NULL DEFAULT 'faisca',
  action_type     TEXT NOT NULL CHECK (action_type IN (
    'send_message', 'call_meeting', 'status_report',
    'delegate_task', 'move_task', 'create_task', 'escalate'
  )),
  payload         JSONB NOT NULL DEFAULT '{}',
  reasoning       TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_status TEXT NOT NULL DEFAULT 'auto_approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  approved_by     TEXT,
  executed_at     TIMESTAMPTZ,
  result          JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_autonomous_actions_pending
  ON autonomous_actions (approval_status, created_at DESC)
  WHERE approval_status = 'pending';

CREATE INDEX idx_autonomous_actions_recent
  ON autonomous_actions (created_at DESC);

-- Log of autonomous loop runs
CREATE TABLE IF NOT EXISTS autonomous_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context_summary TEXT,
  raw_response    TEXT,
  actions_count   INT DEFAULT 0,
  duration_ms     INT,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
