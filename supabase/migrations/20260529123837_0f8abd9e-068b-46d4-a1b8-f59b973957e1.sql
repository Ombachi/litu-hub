
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS assessment_category text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS exam_period text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_quizzes_category ON public.quizzes (course_id, assessment_category);
