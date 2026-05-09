-- =========================================================
-- 1) AI usage / quotas
-- =========================================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  request_count integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  last_request_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, function_name, day)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_day ON public.ai_usage (user_id, day);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai_usage"
  ON public.ai_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Writes go exclusively through the SECURITY DEFINER function below.

-- Atomic increment + quota check. Defaults: 60 req/day, 8 req/min.
CREATE OR REPLACE FUNCTION public.record_ai_usage(
  _user_id uuid,
  _function_name text,
  _daily_limit integer DEFAULT 60,
  _per_minute_limit integer DEFAULT 8
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_count integer;
  v_recent integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  -- Per-minute throttle (across all AI functions).
  SELECT COALESCE(SUM(request_count), 0) INTO v_recent
  FROM public.ai_usage
  WHERE user_id = _user_id
    AND last_request_at > now() - interval '1 minute';

  IF v_recent >= _per_minute_limit THEN
    RAISE EXCEPTION 'AI_RATE_LIMIT: too many requests, please wait a moment';
  END IF;

  -- Upsert + increment for today.
  INSERT INTO public.ai_usage (user_id, function_name, day, request_count, last_request_at)
  VALUES (_user_id, _function_name, v_today, 1, now())
  ON CONFLICT (user_id, function_name, day)
  DO UPDATE SET
    request_count = public.ai_usage.request_count + 1,
    last_request_at = now()
  RETURNING request_count INTO v_count;

  IF v_count > _daily_limit THEN
    RAISE EXCEPTION 'AI_QUOTA_EXCEEDED: daily limit of % reached', _daily_limit;
  END IF;

  RETURN jsonb_build_object(
    'count_today', v_count,
    'daily_limit', _daily_limit,
    'remaining', GREATEST(0, _daily_limit - v_count)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, integer, integer) FROM public;
REVOKE EXECUTE ON FUNCTION public.record_ai_usage(uuid, text, integer, integer) FROM anon, authenticated;
-- service role retains EXECUTE by default; edge functions call it with service-role key.

-- =========================================================
-- 2) GDPR deletion requests log
-- =========================================================
CREATE TABLE IF NOT EXISTS public.gdpr_deletion_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  details jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view deletion log"
  ON public.gdpr_deletion_requests FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================================================
-- 3) GDPR export
-- =========================================================
CREATE OR REPLACE FUNCTION public.gdpr_export_user_data()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_build_object(
    'exported_at', now(),
    'user_id', v_user,
    'profile', (SELECT to_jsonb(p) FROM profiles p WHERE p.user_id = v_user),
    'roles', COALESCE((SELECT jsonb_agg(role) FROM user_roles WHERE user_id = v_user), '[]'::jsonb),
    'institutions', COALESCE((SELECT jsonb_agg(to_jsonb(ui)) FROM user_institutions ui WHERE ui.user_id = v_user), '[]'::jsonb),
    'enrollments', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM enrollments e WHERE e.student_id = v_user), '[]'::jsonb),
    'assignment_submissions', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM assignment_submissions s WHERE s.student_id = v_user), '[]'::jsonb),
    'quiz_attempts', COALESCE((SELECT jsonb_agg(to_jsonb(qa)) FROM quiz_attempts qa WHERE qa.student_id = v_user), '[]'::jsonb),
    'lesson_completions', COALESCE((SELECT jsonb_agg(to_jsonb(lc)) FROM lesson_completions lc WHERE lc.student_id = v_user), '[]'::jsonb),
    'discussion_posts', COALESCE((SELECT jsonb_agg(to_jsonb(dp)) FROM discussion_posts dp WHERE dp.author_id = v_user), '[]'::jsonb),
    'announcements', COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM announcements a WHERE a.author_id = v_user), '[]'::jsonb),
    'direct_messages_sent', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM direct_messages m WHERE m.sender_id = v_user), '[]'::jsonb),
    'direct_messages_received', COALESCE((SELECT jsonb_agg(to_jsonb(m)) FROM direct_messages m WHERE m.receiver_id = v_user), '[]'::jsonb),
    'parent_links', COALESCE((SELECT jsonb_agg(to_jsonb(psl)) FROM parent_student_links psl WHERE psl.parent_id = v_user OR psl.student_id = v_user), '[]'::jsonb),
    'notifications', COALESCE((SELECT jsonb_agg(to_jsonb(n)) FROM notifications n WHERE n.user_id = v_user), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.gdpr_export_user_data() TO authenticated;

-- =========================================================
-- 4) GDPR delete (hard delete + anonymize)
-- =========================================================
CREATE OR REPLACE FUNCTION public.gdpr_delete_user_account()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Block admins from self-deleting via this endpoint.
  IF public.is_admin(v_user) OR public.has_role(v_user, 'school_admin') THEN
    RAISE EXCEPTION 'Admin accounts must be removed by another administrator';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE user_id = v_user;

  -- Anonymize residual authorship (preserve historical context).
  UPDATE announcements SET author_id = NULL WHERE author_id = v_user;
  UPDATE discussions SET author_id = NULL WHERE author_id = v_user;
  UPDATE discussion_posts SET author_id = NULL, content = '[deleted]' WHERE author_id = v_user;
  UPDATE course_resources SET uploaded_by = NULL WHERE uploaded_by = v_user;

  -- Hard delete owned/personal records.
  DELETE FROM direct_messages WHERE sender_id = v_user OR receiver_id = v_user;
  DELETE FROM notifications WHERE user_id = v_user;
  DELETE FROM lesson_completions WHERE student_id = v_user;
  DELETE FROM quiz_responses WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE student_id = v_user);
  DELETE FROM quiz_attempts WHERE student_id = v_user;
  DELETE FROM assignment_submissions WHERE student_id = v_user;
  DELETE FROM enrollment_requests WHERE student_id = v_user;
  DELETE FROM enrollments WHERE student_id = v_user;
  DELETE FROM parent_student_links WHERE parent_id = v_user OR student_id = v_user;
  DELETE FROM user_institutions WHERE user_id = v_user;
  DELETE FROM ai_usage WHERE user_id = v_user;
  DELETE FROM user_roles WHERE user_id = v_user;
  DELETE FROM profiles WHERE user_id = v_user;
  DELETE FROM audit_log WHERE user_id = v_user OR target_user_id = v_user;

  -- Log the deletion (no PII reference back to the deleted user).
  INSERT INTO public.gdpr_deletion_requests (user_id, email, status, completed_at)
  VALUES (v_user, COALESCE(v_email, ''), 'completed', now());

  RETURN jsonb_build_object('deleted', true, 'user_id', v_user);
END;
$$;

GRANT EXECUTE ON FUNCTION public.gdpr_delete_user_account() TO authenticated;

-- =========================================================
-- 5) Indexes for hot RLS / query paths
-- =========================================================
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_institutions_user_id ON public.user_institutions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_institutions_inst_id ON public.user_institutions (institution_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON public.enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course_id ON public.enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_course_tutors_tutor_id ON public.course_tutors (tutor_id);
CREATE INDEX IF NOT EXISTS idx_course_tutors_course_id ON public.course_tutors (course_id);
CREATE INDEX IF NOT EXISTS idx_course_tas_ta_id ON public.course_tas (ta_id);
CREATE INDEX IF NOT EXISTS idx_course_tas_course_id ON public.course_tas (course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON public.assignments (course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_course_id ON public.quizzes (course_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON public.quiz_attempts (student_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_responses_attempt_id ON public.quiz_responses (attempt_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON public.assignment_submissions (assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id ON public.assignment_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_lessons_module_id ON public.lessons (module_id);
CREATE INDEX IF NOT EXISTS idx_modules_course_id ON public.modules (course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_student_id ON public.lesson_completions (student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_completions_lesson_id ON public.lesson_completions (lesson_id);
CREATE INDEX IF NOT EXISTS idx_discussions_course_id ON public.discussions (course_id);
CREATE INDEX IF NOT EXISTS idx_discussion_posts_discussion_id ON public.discussion_posts (discussion_id);
CREATE INDEX IF NOT EXISTS idx_announcements_course_id ON public.announcements (course_id);
CREATE INDEX IF NOT EXISTS idx_course_resources_course_id ON public.course_resources (course_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender_id ON public.direct_messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver_id ON public.direct_messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created_at ON public.direct_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_courses_institution_id ON public.courses (institution_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_parent_id ON public.parent_student_links (parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_student_links_student_id ON public.parent_student_links (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_course_id ON public.enrollment_requests (course_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_requests_student_id ON public.enrollment_requests (student_id);

-- =========================================================
-- 6) Lockdown: revoke EXECUTE on internal-only functions
-- These are trigger functions or background jobs and should never be
-- callable directly by clients. RLS-helper functions (has_role, is_admin,
-- can_access_course, etc.) intentionally remain EXECUTABLE so that RLS
-- policies and authorized queries continue to work.
-- =========================================================
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.update_updated_at()',
    'public.expire_stale_quiz_attempts()',
    'public.cleanup_old_notifications()',
    'public.enforce_quiz_time_limit()',
    'public.notify_on_grade()',
    'public.notify_on_new_announcement()',
    'public.notify_on_new_lesson()',
    'public.notify_on_new_assignment()',
    'public.notify_on_new_quiz()',
    'public.notify_on_new_module()',
    'public.notify_on_tutor_assigned()'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', fn);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'skip revoke on %: %', fn, SQLERRM;
    END;
  END LOOP;
END $$;
