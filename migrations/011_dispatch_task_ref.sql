-- Link dispatches to kanban tasks
ALTER TABLE office_dispatches ADD COLUMN IF NOT EXISTS task_id UUID;
