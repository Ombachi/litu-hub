-- ============================================================
-- STUDENT ANALYTICS RPC FUNCTIONS
-- ============================================================

-- 1. Student summary stats (top cards)
CREATE OR REPLACE FUNCTION public.get_student_analytics_summary(_student_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrolled_count int;
  v_total_assignments int;
  v_submitted_assignments int;
  v_avg_assignment_score numeric;
  v_avg_quiz_score numeric;
  v_total_lessons int;
  v_completed_lessons int;
BEGIN
  -- Authorize: caller must be the student or admin
  IF auth.uid() <> _student_id AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_enrolled_count
  FROM enrollments WHERE student_id = _student_id;

  SELECT COUNT(*) INTO v_total_assignments
  FROM assignments a
  JOIN enrollments e ON e.course_id = a.course_id
  WHERE e.student_id = _student_id;

  SELECT COUNT(*) INTO v_submitted_assignments
  FROM assignment_submissions WHERE student_id = _student_id;

  SELECT AVG(score) INTO v_avg_assignment_score
  FROM assignment_submissions
  WHERE student_id = _student_id AND score IS NOT NULL;

  SELECT AVG(score) INTO v_avg_quiz_score
  FROM quiz_attempts
  WHERE student_id = _student_id AND status = 'completed' AND score IS NOT NULL;

  SELECT COUNT(*) INTO v_total_lessons
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  JOIN enrollments e ON e.course_id = m.course_id
  WHERE e.student_id = _student_id;

  SELECT COUNT(*) INTO v_completed_lessons
  FROM lesson_completions WHERE student_id = _student_id;

  RETURN jsonb_build_object(
    'enrolled_count', COALESCE(v_enrolled_count, 0),
    'total_assignments', COALESCE(v_total_assignments, 0),
    'submitted_assignments', COALESCE(v_submitted_assignments, 0),
    'avg_assignment_score', COALESCE(ROUND(v_avg_assignment_score), 0),
    'avg_quiz_score', COALESCE(ROUND(v_avg_quiz_score), 0),
    'total_lessons', COALESCE(v_total_lessons, 0),
    'completed_lessons', COALESCE(v_completed_lessons, 0)
  );
END;
$$;

-- 2. Per-course progress + grade breakdown
CREATE OR REPLACE FUNCTION public.get_student_course_breakdown(_student_id uuid)
RETURNS TABLE (
  course_id uuid,
  code text,
  title text,
  total_lessons int,
  completed_lessons int,
  progress_pct int,
  total_assignments int,
  submitted_assignments int,
  avg_score int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> _student_id AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH course_lessons AS (
    SELECT m.course_id, COUNT(l.id)::int AS total
    FROM modules m
    LEFT JOIN lessons l ON l.module_id = m.id
    GROUP BY m.course_id
  ),
  done_lessons AS (
    SELECT m.course_id, COUNT(*)::int AS done
    FROM lesson_completions lc
    JOIN lessons l ON l.id = lc.lesson_id
    JOIN modules m ON m.id = l.module_id
    WHERE lc.student_id = _student_id
    GROUP BY m.course_id
  ),
  course_assignments AS (
    SELECT a.course_id, COUNT(*)::int AS total
    FROM assignments a GROUP BY a.course_id
  ),
  student_subs AS (
    SELECT a.course_id,
           COUNT(s.id)::int AS submitted,
           AVG(s.score) FILTER (WHERE s.score IS NOT NULL) AS avg_score
    FROM assignment_submissions s
    JOIN assignments a ON a.id = s.assignment_id
    WHERE s.student_id = _student_id
    GROUP BY a.course_id
  )
  SELECT
    c.id AS course_id,
    c.code,
    c.title,
    COALESCE(cl.total, 0) AS total_lessons,
    COALESCE(dl.done, 0) AS completed_lessons,
    CASE WHEN COALESCE(cl.total, 0) > 0
         THEN ROUND((COALESCE(dl.done,0)::numeric / cl.total) * 100)::int
         ELSE 0 END AS progress_pct,
    COALESCE(ca.total, 0) AS total_assignments,
    COALESCE(ss.submitted, 0) AS submitted_assignments,
    COALESCE(ROUND(ss.avg_score)::int, 0) AS avg_score
  FROM enrollments e
  JOIN courses c ON c.id = e.course_id
  LEFT JOIN course_lessons cl ON cl.course_id = c.id
  LEFT JOIN done_lessons dl ON dl.course_id = c.id
  LEFT JOIN course_assignments ca ON ca.course_id = c.id
  LEFT JOIN student_subs ss ON ss.course_id = c.id
  WHERE e.student_id = _student_id
  ORDER BY c.code;
END;
$$;

-- 3. Recent quiz attempts (history list)
CREATE OR REPLACE FUNCTION public.get_student_quiz_history(_student_id uuid, _limit int DEFAULT 8)
RETURNS TABLE (
  attempt_id uuid,
  quiz_title text,
  score int,
  completed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> _student_id AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT qa.id, q.title, qa.score, qa.completed_at
  FROM quiz_attempts qa
  JOIN quizzes q ON q.id = qa.quiz_id
  WHERE qa.student_id = _student_id
    AND qa.status = 'completed'
  ORDER BY qa.completed_at DESC NULLS LAST
  LIMIT _limit;
END;
$$;

-- ============================================================
-- TUTOR ANALYTICS RPC FUNCTIONS
-- ============================================================

-- 4. Tutor's course list
CREATE OR REPLACE FUNCTION public.get_tutor_courses(_tutor_id uuid)
RETURNS TABLE (course_id uuid, code text, title text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() <> _tutor_id AND NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT c.id, c.code, c.title
  FROM course_tutors ct
  JOIN courses c ON c.id = ct.course_id
  WHERE ct.tutor_id = _tutor_id
  ORDER BY c.code;
END;
$$;

-- 5. Tutor course summary (top cards + class averages)
CREATE OR REPLACE FUNCTION public.get_tutor_course_summary(_course_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_count int;
  v_total_assignments int;
  v_total_submissions int;
  v_class_assignment_avg numeric;
  v_class_quiz_avg numeric;
  v_class_lesson_pct numeric;
  v_submission_rate numeric;
  v_at_risk_count int;
  v_total_lessons int;
BEGIN
  -- Authorize: caller must be a tutor of the course or admin
  IF NOT (is_admin(auth.uid()) OR is_course_tutor(_course_id, auth.uid()) OR is_tutor_or_ta(_course_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_student_count
  FROM enrollments WHERE course_id = _course_id;

  SELECT COUNT(*) INTO v_total_assignments
  FROM assignments WHERE course_id = _course_id;

  SELECT COUNT(s.*) INTO v_total_submissions
  FROM assignment_submissions s
  JOIN assignments a ON a.id = s.assignment_id
  WHERE a.course_id = _course_id;

  SELECT AVG(s.score) INTO v_class_assignment_avg
  FROM assignment_submissions s
  JOIN assignments a ON a.id = s.assignment_id
  WHERE a.course_id = _course_id AND s.score IS NOT NULL;

  SELECT AVG(qa.score) INTO v_class_quiz_avg
  FROM quiz_attempts qa
  JOIN quizzes q ON q.id = qa.quiz_id
  WHERE q.course_id = _course_id AND qa.status = 'completed' AND qa.score IS NOT NULL;

  SELECT COUNT(*) INTO v_total_lessons
  FROM lessons l
  JOIN modules m ON m.id = l.module_id
  WHERE m.course_id = _course_id;

  -- class lesson pct = avg per-student completion rate
  IF v_total_lessons > 0 AND v_student_count > 0 THEN
    SELECT AVG(stu.done * 100.0 / v_total_lessons) INTO v_class_lesson_pct
    FROM (
      SELECT e.student_id, COALESCE(COUNT(lc.id), 0) AS done
      FROM enrollments e
      LEFT JOIN lesson_completions lc ON lc.student_id = e.student_id
        AND lc.lesson_id IN (
          SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = _course_id
        )
      WHERE e.course_id = _course_id
      GROUP BY e.student_id
    ) stu;
  ELSE
    v_class_lesson_pct := 0;
  END IF;

  -- submission rate = avg per-student submission %
  IF v_total_assignments > 0 AND v_student_count > 0 THEN
    SELECT AVG(LEAST(stu.subs * 100.0 / v_total_assignments, 100)) INTO v_submission_rate
    FROM (
      SELECT e.student_id,
             COALESCE(COUNT(s.id), 0) AS subs
      FROM enrollments e
      LEFT JOIN assignment_submissions s ON s.student_id = e.student_id
        AND s.assignment_id IN (SELECT id FROM assignments WHERE course_id = _course_id)
      WHERE e.course_id = _course_id
      GROUP BY e.student_id
    ) stu;
  ELSE
    v_submission_rate := 0;
  END IF;

  -- at-risk: overall avg < 50 OR submission rate < 50%
  SELECT COUNT(*) INTO v_at_risk_count FROM (
    SELECT e.student_id,
           AVG(s.score) FILTER (WHERE s.score IS NOT NULL) AS avg_assign,
           CASE WHEN v_total_assignments > 0
                THEN COUNT(s.id) * 100.0 / v_total_assignments ELSE 0 END AS sub_rate
    FROM enrollments e
    LEFT JOIN assignment_submissions s ON s.student_id = e.student_id
      AND s.assignment_id IN (SELECT id FROM assignments WHERE course_id = _course_id)
    WHERE e.course_id = _course_id
    GROUP BY e.student_id
    HAVING (AVG(s.score) FILTER (WHERE s.score IS NOT NULL)) < 50
        OR (CASE WHEN v_total_assignments > 0 THEN COUNT(s.id) * 100.0 / v_total_assignments ELSE 100 END) < 50
  ) at_risk;

  RETURN jsonb_build_object(
    'student_count', COALESCE(v_student_count, 0),
    'total_assignments', COALESCE(v_total_assignments, 0),
    'total_submissions', COALESCE(v_total_submissions, 0),
    'class_assignment_avg', COALESCE(ROUND(v_class_assignment_avg), 0),
    'class_quiz_avg', COALESCE(ROUND(v_class_quiz_avg), 0),
    'class_lesson_pct', COALESCE(ROUND(v_class_lesson_pct), 0),
    'submission_rate', COALESCE(ROUND(v_submission_rate), 0),
    'at_risk_count', COALESCE(v_at_risk_count, 0)
  );
END;
$$;

-- 6. Grade distribution buckets for the course
CREATE OR REPLACE FUNCTION public.get_tutor_grade_distribution(_course_id uuid)
RETURNS TABLE (range text, count int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_course_tutor(_course_id, auth.uid()) OR is_tutor_or_ta(_course_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH per_student AS (
    SELECT e.student_id,
           AVG(s.score) FILTER (WHERE s.score IS NOT NULL) AS avg_score
    FROM enrollments e
    LEFT JOIN assignment_submissions s ON s.student_id = e.student_id
      AND s.assignment_id IN (SELECT id FROM assignments WHERE course_id = _course_id)
    WHERE e.course_id = _course_id
    GROUP BY e.student_id
  )
  SELECT bucket AS range, COUNT(*)::int AS count FROM (
    SELECT CASE
      WHEN avg_score >= 90 THEN '90-100'
      WHEN avg_score >= 80 THEN '80-89'
      WHEN avg_score >= 70 THEN '70-79'
      WHEN avg_score >= 60 THEN '60-69'
      WHEN avg_score >= 50 THEN '50-59'
      WHEN avg_score IS NOT NULL THEN '<50'
      ELSE NULL
    END AS bucket
    FROM per_student
  ) b
  WHERE bucket IS NOT NULL
  GROUP BY bucket
  ORDER BY bucket DESC;
END;
$$;

-- 7. Per-student performance table
CREATE OR REPLACE FUNCTION public.get_tutor_student_performance(_course_id uuid)
RETURNS TABLE (
  student_id uuid,
  full_name text,
  email text,
  avg_assignment int,
  avg_quiz int,
  overall_avg int,
  submission_rate int,
  lesson_pct int,
  at_risk boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_assignments int;
  v_total_lessons int;
BEGIN
  IF NOT (is_admin(auth.uid()) OR is_course_tutor(_course_id, auth.uid()) OR is_tutor_or_ta(_course_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO v_total_assignments FROM assignments WHERE course_id = _course_id;
  SELECT COUNT(*) INTO v_total_lessons
  FROM lessons l JOIN modules m ON m.id = l.module_id
  WHERE m.course_id = _course_id;

  RETURN QUERY
  WITH stu AS (
    SELECT e.student_id,
           p.first_name, p.last_name, p.email,
           AVG(s.score) FILTER (WHERE s.score IS NOT NULL) AS avg_assign,
           COUNT(s.id) AS sub_count
    FROM enrollments e
    LEFT JOIN profiles p ON p.user_id = e.student_id
    LEFT JOIN assignment_submissions s ON s.student_id = e.student_id
      AND s.assignment_id IN (SELECT id FROM assignments WHERE course_id = _course_id)
    WHERE e.course_id = _course_id
    GROUP BY e.student_id, p.first_name, p.last_name, p.email
  ),
  quiz_avg AS (
    SELECT qa.student_id, AVG(qa.score) AS avg_q
    FROM quiz_attempts qa
    JOIN quizzes q ON q.id = qa.quiz_id
    WHERE q.course_id = _course_id AND qa.status = 'completed' AND qa.score IS NOT NULL
    GROUP BY qa.student_id
  ),
  lesson_done AS (
    SELECT lc.student_id, COUNT(*) AS done
    FROM lesson_completions lc
    WHERE lc.lesson_id IN (
      SELECT l.id FROM lessons l JOIN modules m ON m.id = l.module_id WHERE m.course_id = _course_id
    )
    GROUP BY lc.student_id
  )
  SELECT
    stu.student_id,
    COALESCE(NULLIF(TRIM(COALESCE(stu.first_name,'') || ' ' || COALESCE(stu.last_name,'')), ''), 'Unknown') AS full_name,
    COALESCE(stu.email, '') AS email,
    COALESCE(ROUND(stu.avg_assign)::int, 0) AS avg_assignment,
    COALESCE(ROUND(qa.avg_q)::int, 0) AS avg_quiz,
    COALESCE(
      ROUND(
        ((COALESCE(stu.avg_assign, 0) + COALESCE(qa.avg_q, 0)) /
         NULLIF((CASE WHEN stu.avg_assign IS NOT NULL THEN 1 ELSE 0 END +
                 CASE WHEN qa.avg_q IS NOT NULL THEN 1 ELSE 0 END), 0))::numeric
      )::int, 0
    ) AS overall_avg,
    CASE WHEN v_total_assignments > 0
         THEN LEAST(ROUND(stu.sub_count * 100.0 / v_total_assignments)::int, 100)
         ELSE 0 END AS submission_rate,
    CASE WHEN v_total_lessons > 0
         THEN ROUND(COALESCE(ld.done,0) * 100.0 / v_total_lessons)::int
         ELSE 0 END AS lesson_pct,
    (
      (stu.avg_assign IS NOT NULL AND stu.avg_assign < 50)
      OR (v_total_assignments > 0 AND stu.sub_count * 100.0 / v_total_assignments < 50)
    ) AS at_risk
  FROM stu
  LEFT JOIN quiz_avg qa ON qa.student_id = stu.student_id
  LEFT JOIN lesson_done ld ON ld.student_id = stu.student_id
  ORDER BY full_name;
END;
$$;