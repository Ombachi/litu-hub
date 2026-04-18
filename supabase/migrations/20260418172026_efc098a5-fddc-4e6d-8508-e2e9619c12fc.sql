-- ============================================================
-- 1. COMPOSITE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created
  ON public.notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrollments_student_course
  ON public.enrollments (student_id, course_id);

CREATE INDEX IF NOT EXISTS idx_enrollments_course
  ON public.enrollments (course_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_status
  ON public.quiz_attempts (student_id, status);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_status
  ON public.quiz_attempts (quiz_id, status);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_status
  ON public.assignment_submissions (student_id, status);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment
  ON public.assignment_submissions (assignment_id);

CREATE INDEX IF NOT EXISTS idx_courses_institution
  ON public.courses (institution_id);

CREATE INDEX IF NOT EXISTS idx_assignments_course
  ON public.assignments (course_id);

CREATE INDEX IF NOT EXISTS idx_quizzes_course
  ON public.quizzes (course_id);

CREATE INDEX IF NOT EXISTS idx_lesson_completions_student
  ON public.lesson_completions (student_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles (user_id, role);


-- ============================================================
-- 2. BATCH NOTIFICATION TRIGGERS (INSERT ... SELECT)
-- ============================================================

-- New lesson
CREATE OR REPLACE FUNCTION public.notify_on_new_lesson()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_module_title text;
BEGIN
  SELECT m.course_id, m.title INTO v_course_id, v_module_title
  FROM public.modules m WHERE m.id = NEW.module_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT
    e.student_id,
    'New Lesson: ' || NEW.title,
    'A new lesson "' || NEW.title || '" has been added to ' || COALESCE(v_module_title, 'the module') || '.',
    'lesson',
    '/lesson/' || NEW.id
  FROM public.enrollments e
  JOIN public.user_roles ur ON ur.user_id = e.student_id
  WHERE e.course_id = v_course_id AND ur.role = 'student';

  RETURN NEW;
END;
$function$;

-- New module
CREATE OR REPLACE FUNCTION public.notify_on_new_module()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_course_code text;
BEGIN
  SELECT code INTO v_course_code FROM public.courses WHERE id = NEW.course_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT
    e.student_id,
    'New Module: ' || NEW.title,
    'A new module "' || NEW.title || '" has been added to ' || COALESCE(v_course_code, 'your course') || '.',
    'module',
    '/course/' || NEW.course_id
  FROM public.enrollments e
  JOIN public.user_roles ur ON ur.user_id = e.student_id
  WHERE e.course_id = NEW.course_id AND ur.role = 'student';

  RETURN NEW;
END;
$function$;

-- New assignment
CREATE OR REPLACE FUNCTION public.notify_on_new_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT
    e.student_id,
    'New Assignment: ' || NEW.title,
    'A new assignment has been posted. Due: ' || COALESCE(to_char(NEW.due_date, 'Mon DD, YYYY'), 'No deadline'),
    'assignment',
    '/assignment/' || NEW.id
  FROM public.enrollments e
  JOIN public.user_roles ur ON ur.user_id = e.student_id
  WHERE e.course_id = NEW.course_id AND ur.role = 'student';

  RETURN NEW;
END;
$function$;

-- New quiz
CREATE OR REPLACE FUNCTION public.notify_on_new_quiz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT
    e.student_id,
    'New Quiz: ' || NEW.title,
    'A new quiz has been posted. Due: ' || COALESCE(to_char(NEW.due_date, 'Mon DD, YYYY'), 'No deadline'),
    'quiz',
    '/quizzes?take=' || NEW.id
  FROM public.enrollments e
  JOIN public.user_roles ur ON ur.user_id = e.student_id
  WHERE e.course_id = NEW.course_id AND ur.role = 'student';

  RETURN NEW;
END;
$function$;

-- New announcement
CREATE OR REPLACE FUNCTION public.notify_on_new_announcement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT
    e.student_id,
    '📢 ' || NEW.title,
    LEFT(NEW.content, 100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
    'announcement',
    '/course/' || NEW.course_id || '?tab=announcements'
  FROM public.enrollments e
  JOIN public.user_roles ur ON ur.user_id = e.student_id
  WHERE e.course_id = NEW.course_id AND ur.role = 'student';

  RETURN NEW;
END;
$function$;

-- Grade notification (student + parents in two batched inserts)
CREATE OR REPLACE FUNCTION public.notify_on_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_student_name text;
BEGIN
  IF NEW.status = 'graded' AND (OLD.status IS DISTINCT FROM 'graded') THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.student_id,
      'Assignment Graded',
      'Your submission has been graded. Score: ' || COALESCE(NEW.score::text, '—') || '. Check your grades.',
      'grade',
      '/grades'
    );

    SELECT first_name INTO v_student_name FROM public.profiles WHERE user_id = NEW.student_id;

    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT
      psl.parent_id,
      COALESCE(v_student_name, 'Your child') || '''s Assignment Graded',
      'Score: ' || COALESCE(NEW.score::text, '—') || '. View in Parent Portal.',
      'grade',
      '/parent'
    FROM public.parent_student_links psl
    WHERE psl.student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$function$;


-- ============================================================
-- 3. ANALYTICS RPC FUNCTIONS
-- ============================================================

-- Summary stats
CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary(_institution_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  WITH scoped_courses AS (
    SELECT id FROM public.courses
    WHERE _institution_id IS NULL OR institution_id = _institution_id
  ),
  scoped_assignments AS (
    SELECT a.id, a.course_id FROM public.assignments a
    WHERE a.course_id IN (SELECT id FROM scoped_courses)
  ),
  scoped_quizzes AS (
    SELECT q.id FROM public.quizzes q
    WHERE q.course_id IN (SELECT id FROM scoped_courses)
  ),
  subs AS (
    SELECT s.score, s.status FROM public.assignment_submissions s
    WHERE s.assignment_id IN (SELECT id FROM scoped_assignments)
  ),
  qa AS (
    SELECT score FROM public.quiz_attempts
    WHERE quiz_id IN (SELECT id FROM scoped_quizzes) AND status = 'completed'
  )
  SELECT jsonb_build_object(
    'total_courses', (SELECT count(*) FROM scoped_courses),
    'total_students', (SELECT count(DISTINCT student_id) FROM public.enrollments WHERE course_id IN (SELECT id FROM scoped_courses)),
    'total_tutors', (SELECT count(DISTINCT tutor_id) FROM public.course_tutors WHERE course_id IN (SELECT id FROM scoped_courses)),
    'total_assignments', (SELECT count(*) FROM scoped_assignments),
    'total_quizzes', (SELECT count(*) FROM scoped_quizzes),
    'total_submissions', (SELECT count(*) FROM subs),
    'graded_submissions', (SELECT count(*) FROM subs WHERE score IS NOT NULL),
    'ungraded_submissions', (SELECT count(*) FROM subs WHERE score IS NULL),
    'avg_assignment_score', COALESCE((SELECT round(avg(score)) FROM subs WHERE score IS NOT NULL), 0),
    'completed_quiz_attempts', (SELECT count(*) FROM qa),
    'avg_quiz_score', COALESCE((SELECT round(avg(score)) FROM qa WHERE score IS NOT NULL), 0)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Per-course stats
CREATE OR REPLACE FUNCTION public.get_admin_course_stats(_institution_id uuid DEFAULT NULL)
RETURNS TABLE (
  course_id uuid,
  code text,
  title text,
  term_name text,
  students bigint,
  assignments bigint,
  submissions bigint,
  avg_score integer,
  quiz_avg integer,
  submission_rate integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH c AS (
    SELECT co.id, co.code, co.title, t.name AS term_name
    FROM public.courses co
    LEFT JOIN public.terms t ON t.id = co.term_id
    WHERE _institution_id IS NULL OR co.institution_id = _institution_id
  ),
  enr AS (
    SELECT course_id, count(*)::bigint AS n FROM public.enrollments
    WHERE course_id IN (SELECT id FROM c) GROUP BY course_id
  ),
  asg AS (
    SELECT course_id, count(*)::bigint AS n FROM public.assignments
    WHERE course_id IN (SELECT id FROM c) GROUP BY course_id
  ),
  subs AS (
    SELECT a.course_id, count(*)::bigint AS n,
           round(avg(s.score) FILTER (WHERE s.score IS NOT NULL))::int AS avg
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE a.course_id IN (SELECT id FROM c) GROUP BY a.course_id
  ),
  qa AS (
    SELECT q.course_id, round(avg(qa.score))::int AS avg
    FROM public.quiz_attempts qa
    JOIN public.quizzes q ON q.id = qa.quiz_id
    WHERE q.course_id IN (SELECT id FROM c) AND qa.status = 'completed'
    GROUP BY q.course_id
  )
  SELECT
    c.id, c.code, c.title, COALESCE(c.term_name, '—'),
    COALESCE(enr.n, 0),
    COALESCE(asg.n, 0),
    COALESCE(subs.n, 0),
    COALESCE(subs.avg, 0),
    COALESCE(qa.avg, 0),
    CASE WHEN COALESCE(enr.n,0) > 0 AND COALESCE(asg.n,0) > 0
         THEN LEAST(100, round((COALESCE(subs.n,0)::numeric / (enr.n * asg.n)) * 100)::int)
         ELSE 0 END
  FROM c
  LEFT JOIN enr ON enr.course_id = c.id
  LEFT JOIN asg ON asg.course_id = c.id
  LEFT JOIN subs ON subs.course_id = c.id
  LEFT JOIN qa ON qa.course_id = c.id
  ORDER BY COALESCE(enr.n, 0) DESC;
$function$;

-- Grade distribution buckets
CREATE OR REPLACE FUNCTION public.get_admin_grade_distribution(_institution_id uuid DEFAULT NULL)
RETURNS TABLE (range text, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH scoped AS (
    SELECT s.score
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.courses c ON c.id = a.course_id
    WHERE s.score IS NOT NULL
      AND (_institution_id IS NULL OR c.institution_id = _institution_id)
  )
  SELECT range, count(*)::bigint FROM (
    SELECT CASE
      WHEN score >= 90 THEN '90-100'
      WHEN score >= 80 THEN '80-89'
      WHEN score >= 70 THEN '70-79'
      WHEN score >= 60 THEN '60-69'
      ELSE '<60' END AS range
    FROM scoped
  ) t
  GROUP BY range
  ORDER BY range;
$function$;

-- Submission timeline (last 30 days)
CREATE OR REPLACE FUNCTION public.get_admin_submission_timeline(_institution_id uuid DEFAULT NULL)
RETURNS TABLE (day date, count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH days AS (
    SELECT generate_series((current_date - interval '29 days')::date, current_date, '1 day')::date AS day
  ),
  scoped AS (
    SELECT s.submitted_at::date AS day
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.courses c ON c.id = a.course_id
    WHERE s.submitted_at >= (current_date - interval '29 days')
      AND (_institution_id IS NULL OR c.institution_id = _institution_id)
  )
  SELECT d.day, COALESCE(count(s.day), 0)::bigint
  FROM days d
  LEFT JOIN scoped s ON s.day = d.day
  GROUP BY d.day
  ORDER BY d.day;
$function$;


-- ============================================================
-- 4. NOTIFICATION RETENTION CLEANUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_deleted integer;
BEGIN
  WITH d AS (
    DELETE FROM public.notifications
    WHERE created_at < now() - interval '90 days' AND read = true
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM d;
  RETURN v_deleted;
END;
$function$;

-- Enable cron + schedule daily at 03:00 UTC
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-notifications-daily') THEN
    PERFORM cron.unschedule('cleanup-old-notifications-daily');
  END IF;
  PERFORM cron.schedule(
    'cleanup-old-notifications-daily',
    '0 3 * * *',
    $cron$ SELECT public.cleanup_old_notifications(); $cron$
  );
END $$;
