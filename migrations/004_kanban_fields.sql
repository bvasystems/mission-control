-- Migration: add kanban fields to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS deliverables jsonb DEFAULT '[]';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress     int  DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS label        text;

-- Populate some sample data for testing
UPDATE tasks SET progress = 0,  label = 'feature'  WHERE progress IS NULL OR label IS NULL;
