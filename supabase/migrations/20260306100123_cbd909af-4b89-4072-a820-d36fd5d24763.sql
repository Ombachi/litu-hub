
-- Add question metadata columns for pools, difficulty, competency tagging
ALTER TABLE public.quiz_questions 
  ADD COLUMN IF NOT EXISTS difficulty text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS competency_tag text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pool_name text NOT NULL DEFAULT '';
