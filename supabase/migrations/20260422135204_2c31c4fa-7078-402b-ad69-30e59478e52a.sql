-- =========================================================
-- 1. ADMIN ANALYTICS: add authorization guards
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_admin_analytics_summary(_institution_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
  v_scope uuid;
BEGIN
  IF NOT (is_admin(auth.uid()) OR has_role(auth.uid(), 'school_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- School admins are restricted to their own institution
  IF has_role(auth.uid(), 'school_admin') AND NOT is_admin(auth.uid()) THEN
    v_scope := get_user_institution_id(auth.uid());
  ELSE
    v_scope := _institution_id;
  END IF;

  WITH scoped_courses AS (
    SELECT id FROM public.courses
    WHERE v_scope IS NULL OR institution_id = v_scope
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

CREATE OR REPLACE FUNCTION public.get_admin_course_stats(_institution_id uuid DEFAULT NULL)
 RETURNS TABLE(course_id uuid, code text, title text, term_name text, students bigint, assignments bigint, submissions bigint, avg_score integer, quiz_avg integer, submission_rate integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope uuid;
BEGIN
  IF NOT (is_admin(auth.uid()) OR has_role(auth.uid(), 'school_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF has_role(auth.uid(), 'school_admin') AND NOT is_admin(auth.uid()) THEN
    v_scope := get_user_institution_id(auth.uid());
  ELSE
    v_scope := _institution_id;
  END IF;

  RETURN QUERY
  WITH c AS (
    SELECT co.id, co.code, co.title, t.name AS term_name
    FROM public.courses co
    LEFT JOIN public.terms t ON t.id = co.term_id
    WHERE v_scope IS NULL OR co.institution_id = v_scope
  ),
  enr AS (
    SELECT e.course_id, count(*)::bigint AS n FROM public.enrollments e
    WHERE e.course_id IN (SELECT id FROM c) GROUP BY e.course_id
  ),
  asg AS (
    SELECT a.course_id, count(*)::bigint AS n FROM public.assignments a
    WHERE a.course_id IN (SELECT id FROM c) GROUP BY a.course_id
  ),
  subs AS (
    SELECT a.course_id, count(*)::bigint AS n,
           round(avg(s.score) FILTER (WHERE s.score IS NOT NULL))::int AS avg
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    WHERE a.course_id IN (SELECT id FROM c) GROUP BY a.course_id
  ),
  qa AS (
    SELECT q.course_id, round(avg(qa2.score))::int AS avg
    FROM public.quiz_attempts qa2
    JOIN public.quizzes q ON q.id = qa2.quiz_id
    WHERE q.course_id IN (SELECT id FROM c) AND qa2.status = 'completed'
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_grade_distribution(_institution_id uuid DEFAULT NULL)
 RETURNS TABLE(range text, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope uuid;
BEGIN
  IF NOT (is_admin(auth.uid()) OR has_role(auth.uid(), 'school_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF has_role(auth.uid(), 'school_admin') AND NOT is_admin(auth.uid()) THEN
    v_scope := get_user_institution_id(auth.uid());
  ELSE
    v_scope := _institution_id;
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT s.score
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.courses c ON c.id = a.course_id
    WHERE s.score IS NOT NULL
      AND (v_scope IS NULL OR c.institution_id = v_scope)
  )
  SELECT t.range, count(*)::bigint FROM (
    SELECT CASE
      WHEN score >= 90 THEN '90-100'
      WHEN score >= 80 THEN '80-89'
      WHEN score >= 70 THEN '70-79'
      WHEN score >= 60 THEN '60-69'
      ELSE '<60' END AS range
    FROM scoped
  ) t
  GROUP BY t.range
  ORDER BY t.range;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_admin_submission_timeline(_institution_id uuid DEFAULT NULL)
 RETURNS TABLE(day date, count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_scope uuid;
BEGIN
  IF NOT (is_admin(auth.uid()) OR has_role(auth.uid(), 'school_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF has_role(auth.uid(), 'school_admin') AND NOT is_admin(auth.uid()) THEN
    v_scope := get_user_institution_id(auth.uid());
  ELSE
    v_scope := _institution_id;
  END IF;

  RETURN QUERY
  WITH days AS (
    SELECT generate_series((current_date - interval '29 days')::date, current_date, '1 day')::date AS day
  ),
  scoped AS (
    SELECT s.submitted_at::date AS day
    FROM public.assignment_submissions s
    JOIN public.assignments a ON a.id = s.assignment_id
    JOIN public.courses c ON c.id = a.course_id
    WHERE s.submitted_at >= (current_date - interval '29 days')
      AND (v_scope IS NULL OR c.institution_id = v_scope)
  )
  SELECT d.day, COALESCE(count(s.day), 0)::bigint
  FROM days d
  LEFT JOIN scoped s ON s.day = d.day
  GROUP BY d.day
  ORDER BY d.day;
END;
$function$;

-- =========================================================
-- 2. QUIZ QUESTIONS: hide correct_answer from students
-- =========================================================

-- Restrict the existing SELECT policy to coaches/admins only
DROP POLICY IF EXISTS "View quiz questions" ON public.quiz_questions;

CREATE POLICY "Coaches view quiz questions"
ON public.quiz_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_questions.quiz_id
      AND can_manage_course(q.course_id, auth.uid())
  )
);

-- Student-safe accessor (returns everything EXCEPT correct_answer + explanation)
CREATE OR REPLACE FUNCTION public.get_quiz_questions_for_student(_quiz_id uuid)
 RETURNS TABLE(
   id uuid,
   quiz_id uuid,
   question_text text,
   question_type text,
   options jsonb,
   points integer,
   "order" integer,
   difficulty text,
   competency_tag text,
   pool_name text,
   correct_answer text,
   explanation text
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_course_id uuid;
  v_can_see_answers boolean;
BEGIN
  SELECT q.course_id INTO v_course_id FROM public.quizzes q WHERE q.id = _quiz_id;
  IF v_course_id IS NULL THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  IF NOT can_access_course(v_course_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Coaches/admins always see answers; students never see them via this function
  v_can_see_answers := can_manage_course(v_course_id, auth.uid());

  RETURN QUERY
  SELECT
    qq.id,
    qq.quiz_id,
    qq.question_text,
    qq.question_type,
    qq.options,
    qq.points,
    qq."order",
    qq.difficulty,
    qq.competency_tag,
    qq.pool_name,
    CASE WHEN v_can_see_answers THEN qq.correct_answer ELSE ''::text END AS correct_answer,
    CASE WHEN v_can_see_answers THEN qq.explanation ELSE NULL::text END AS explanation
  FROM public.quiz_questions qq
  WHERE qq.quiz_id = _quiz_id
  ORDER BY qq."order";
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_quiz_questions_for_student(uuid) TO authenticated;

-- =========================================================
-- 3. QUIZ RESPONSES: prevent direct client inserts
-- =========================================================

DROP POLICY IF EXISTS "Students submit responses" ON public.quiz_responses;
DROP POLICY IF EXISTS "Update responses" ON public.quiz_responses;

-- Only admins (or service role implicitly) may insert/update; the edge function uses the service role
CREATE POLICY "Admins manage responses"
ON public.quiz_responses
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Tutors may update for manual SAQ grading
CREATE POLICY "Tutors update SAQ responses"
ON public.quiz_responses
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quiz_attempts a
    JOIN public.quizzes q ON q.id = a.quiz_id
    WHERE a.id = quiz_responses.attempt_id
      AND can_manage_course(q.course_id, auth.uid())
  )
);

-- Server-side scoring function (runs as definer with full access)
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  _attempt_id uuid,
  _responses jsonb
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_attempt record;
  v_total_score int := 0;
  v_correct int := 0;
  v_pending int := 0;
  v_response jsonb;
  v_question record;
  v_is_correct boolean;
  v_points int;
  v_correct_set text[];
  v_user_set text[];
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_attempt FROM public.quiz_attempts WHERE id = _attempt_id;
  IF v_attempt.id IS NULL THEN
    RAISE EXCEPTION 'Attempt not found';
  END IF;
  IF v_attempt.student_id <> v_user THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_attempt.status = 'completed' THEN
    RAISE EXCEPTION 'Attempt already submitted';
  END IF;

  -- Iterate over client responses; only trust question_id and response text
  FOR v_response IN SELECT * FROM jsonb_array_elements(_responses)
  LOOP
    SELECT * INTO v_question FROM public.quiz_questions
    WHERE id = (v_response->>'question_id')::uuid AND quiz_id = v_attempt.quiz_id;

    IF v_question.id IS NULL THEN CONTINUE; END IF;

    v_is_correct := false;
    v_points := 0;

    IF v_question.question_type = 'short_answer' THEN
      v_pending := v_pending + 1;
    ELSE
      v_correct_set := string_to_array(COALESCE(v_question.correct_answer, ''), '|||');
      IF array_length(v_correct_set, 1) > 1 THEN
        v_user_set := string_to_array(COALESCE(v_response->>'response', ''), '|||');
        IF array_length(v_correct_set, 1) = array_length(v_user_set, 1)
           AND v_correct_set @> v_user_set AND v_user_set @> v_correct_set THEN
          v_is_correct := true;
        END IF;
      ELSE
        IF (v_response->>'response') = v_question.correct_answer THEN
          v_is_correct := true;
        END IF;
      END IF;

      IF v_is_correct THEN
        v_points := v_question.points;
        v_correct := v_correct + 1;
      END IF;
    END IF;

    v_total_score := v_total_score + v_points;

    INSERT INTO public.quiz_responses (attempt_id, question_id, response, is_correct, points_earned)
    VALUES (_attempt_id, v_question.id, COALESCE(v_response->>'response', ''), v_is_correct, v_points);
  END LOOP;

  UPDATE public.quiz_attempts
  SET status = 'completed', completed_at = now(), score = v_total_score
  WHERE id = _attempt_id;

  RETURN jsonb_build_object(
    'score', v_total_score,
    'correct', v_correct,
    'pending_review', v_pending
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(uuid, jsonb) TO authenticated;

-- =========================================================
-- 4. SUBMISSIONS STORAGE: drop broad insert policy
-- =========================================================

DROP POLICY IF EXISTS "Authenticated users can upload to submissions" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own uploads in submissions" ON storage.objects;

-- Recreate the view policy properly scoped (own folder OR shared system folders)
CREATE POLICY "Users view own submissions uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'submissions'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] IN ('lessons', 'discussions', 'quiz-answers')
  )
);

-- Allow uploads to user's own folder OR shared system folders (for lessons, discussions, quiz-answer attachments)
CREATE POLICY "Users upload to own or shared folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[1] IN ('lessons', 'discussions', 'quiz-answers')
  )
);

-- =========================================================
-- 5. AVATARS: prevent listing the bucket
-- =========================================================

DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;

-- Reads still work via direct/signed URLs but listing/searching the bucket is blocked
-- (Direct GET on storage object endpoints does not invoke this policy for public buckets,
-- but listing requires SELECT on storage.objects.)
CREATE POLICY "Owners read own avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- =========================================================
-- 6. PARENT-STUDENT LINKS: pending state with admin approval
-- =========================================================

ALTER TABLE public.parent_student_links
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Existing links are grandfathered as approved
UPDATE public.parent_student_links SET status = 'approved' WHERE status = 'pending' AND created_at < now();

-- Tighten parent SELECT policies on dependent tables to require approval
DROP POLICY IF EXISTS "Parents view children submissions" ON public.assignment_submissions;
CREATE POLICY "Parents view children submissions"
ON public.assignment_submissions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_student_links psl
  WHERE psl.parent_id = auth.uid()
    AND psl.student_id = assignment_submissions.student_id
    AND psl.status = 'approved'
));

DROP POLICY IF EXISTS "Parents view children enrollments" ON public.enrollments;
CREATE POLICY "Parents view children enrollments"
ON public.enrollments FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_student_links psl
  WHERE psl.parent_id = auth.uid()
    AND psl.student_id = enrollments.student_id
    AND psl.status = 'approved'
));

DROP POLICY IF EXISTS "Parents view children quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Parents view children quiz attempts"
ON public.quiz_attempts FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_student_links psl
  WHERE psl.parent_id = auth.uid()
    AND psl.student_id = quiz_attempts.student_id
    AND psl.status = 'approved'
));

DROP POLICY IF EXISTS "Parents view children lesson completions" ON public.lesson_completions;
CREATE POLICY "Parents view children lesson completions"
ON public.lesson_completions FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.parent_student_links psl
  WHERE psl.parent_id = auth.uid()
    AND psl.student_id = lesson_completions.student_id
    AND psl.status = 'approved'
));

-- Parents can request a link but it stays pending
DROP POLICY IF EXISTS "Parents insert own links" ON public.parent_student_links;
CREATE POLICY "Parents request own links"
ON public.parent_student_links FOR INSERT TO authenticated
WITH CHECK (parent_id = auth.uid() AND status = 'pending');

-- Only admins or school admins can approve (update) links
CREATE POLICY "Admins approve parent links"
ON public.parent_student_links FOR UPDATE TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'school_admin'))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'school_admin'));

-- =========================================================
-- 7. PROFILES: tighten email exposure
-- =========================================================

DROP POLICY IF EXISTS "All authenticated can view profiles" ON public.profiles;

-- Self / admin / school admin / tutor / TA can read full profile (incl. email)
CREATE POLICY "Privileged users view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin(auth.uid())
  OR has_role(auth.uid(), 'school_admin')
  OR has_role(auth.uid(), 'tutor')
  OR has_role(auth.uid(), 'ta')
);

-- Public-safe view for general directory lookups (no email)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
SELECT user_id, first_name, last_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- Allow all authenticated to read public_profiles via a permissive policy on the underlying view path
CREATE POLICY "All authenticated view public profile fields"
ON public.profiles FOR SELECT TO authenticated
USING (true);
-- Wait: the new policy above would re-expose email. Instead drop it and use a SECURITY DEFINER function for non-privileged lookups.

DROP POLICY IF EXISTS "All authenticated view public profile fields" ON public.profiles;

-- Helper function for non-privileged lookup of name/avatar by user_ids
CREATE OR REPLACE FUNCTION public.get_public_profiles(_user_ids uuid[])
 RETURNS TABLE(user_id uuid, first_name text, last_name text, avatar_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id, p.first_name, p.last_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids);
$function$;

GRANT EXECUTE ON FUNCTION public.get_public_profiles(uuid[]) TO authenticated;

-- =========================================================
-- 8. REALTIME: scope channel subscriptions
-- =========================================================

-- Enable RLS on the realtime messages table (no-op if already enabled)
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to subscribe only to their own user-scoped channels
-- Convention: channel topics include the user's UUID (e.g. "notifications:<uuid>", "messages:<uuid>")
DROP POLICY IF EXISTS "Authenticated users subscribe to own channels" ON realtime.messages;
CREATE POLICY "Authenticated users subscribe to own channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Permit standard postgres_changes broadcasts (they are filtered by table RLS already)
  extension = 'postgres_changes'
  -- Or topic-scoped broadcasts containing the user's id
  OR topic LIKE '%' || auth.uid()::text || '%'
);

DROP POLICY IF EXISTS "Authenticated users broadcast to own channels" ON realtime.messages;
CREATE POLICY "Authenticated users broadcast to own channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  topic LIKE '%' || auth.uid()::text || '%'
);
