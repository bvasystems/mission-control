-- projects table
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  owner       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  priority    TEXT DEFAULT 'medium',
  objective   TEXT,
  start_date  DATE,
  target_date DATE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- project_metrics table
CREATE TABLE IF NOT EXISTS project_metrics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key     TEXT NOT NULL,
  snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  progress_pct    NUMERIC DEFAULT 0,
  total_tasks     INT DEFAULT 0,
  todo_tasks      INT DEFAULT 0,
  doing_tasks     INT DEFAULT 0,
  review_tasks    INT DEFAULT 0,
  done_tasks      INT DEFAULT 0,
  blocked_tasks   INT DEFAULT 0,
  incidents_open  INT DEFAULT 0,
  risk_score      NUMERIC DEFAULT 0,
  reliability_avg NUMERIC DEFAULT 0,
  last_update_at  TIMESTAMPTZ,
  FOREIGN KEY (project_key) REFERENCES projects(project_key) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_metrics_key_time
  ON project_metrics(project_key, snapshot_at DESC);

-- project_links table
CREATE TABLE IF NOT EXISTS project_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key TEXT NOT NULL,
  dem_id      TEXT,
  task_id     UUID,
  command_id  TEXT,
  agent_id    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (project_key) REFERENCES projects(project_key) ON DELETE CASCADE
);
