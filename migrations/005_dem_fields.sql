-- ============================================================
-- Migration 005: DEM Phase-1 fields + new kanban status/column values
-- Safe to re-run (all statements use IF NOT EXISTS / ALTER ... ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- 1) New columns on tasks -----------------------------------------

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS objective           text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type                text CHECK (type IN ('n8n','code','bug','improvement'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS supporter           text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS acceptance_criteria text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS owner               text;  -- replaces / aliases assigned_to

-- priority: extend allowed values (old: low|medium|high|critical → new: P0|P1|P2)
-- We keep the old constraint valid via a new unconstrained column approach:
-- Drop old check on priority and add new allowed values
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_check
  CHECK (priority IN ('low','medium','high','critical','P0','P1','P2'));

-- status: extend to the 7 official statuses (old subset becomes legacy)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN (
    'pending','done','blocked',        -- legacy (keep for backward compat)
    'Backlog','Assigned','In Progress','Review','Approved','Done','Blocked'
  ));

-- column: extend allowed values
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_column_check;
-- (no constraint was defined on column in schema, only in kanban move route — handled in code)

-- updated_at column (some older rows may not have it if schema was minimal)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT NOW();

-- ============================================================
-- 2) task_updates table (protocol timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_updates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  update_type text NOT NULL CHECK (update_type IN ('ACK','UPDATE','BLOCKED','DONE')),
  message     text NOT NULL,
  progress    int  CHECK (progress >= 0 AND progress <= 100),
  author      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON task_updates(task_id, created_at DESC);

-- ============================================================
-- 3) task_evidences table
-- ============================================================
CREATE TABLE IF NOT EXISTS task_evidences (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('print','log','link')),
  content       text NOT NULL,   -- URL or raw content
  note          text,
  created_at    timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_evidences_task_id ON task_evidences(task_id, created_at DESC);
