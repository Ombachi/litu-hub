
-- Helper: is the requester an approved parent of someone enrolled in the given course?
CREATE OR REPLACE FUNCTION public.is_parent_of_enrolled(_course_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_student_links psl
    JOIN public.enrollments e ON e.student_id = psl.student_id
    WHERE psl.parent_id = _user_id
      AND psl.status = 'approved'
      AND e.course_id = _course_id
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_parent_of_enrolled(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_parent_of_enrolled(uuid, uuid) TO authenticated, service_role;

-- Parents can read assignment metadata for their children's enrolled courses
DROP POLICY IF EXISTS "Parents view children assignments" ON public.assignments;
CREATE POLICY "Parents view children assignments"
ON public.assignments
FOR SELECT
TO authenticated
USING (public.is_parent_of_enrolled(course_id, auth.uid()));

-- Parents can read quiz metadata for their children's enrolled courses
DROP POLICY IF EXISTS "Parents view children quizzes" ON public.quizzes;
CREATE POLICY "Parents view children quizzes"
ON public.quizzes
FOR SELECT
TO authenticated
USING (public.is_parent_of_enrolled(course_id, auth.uid()));

-- Parents can read modules/lessons (read-only) so progress views render
DROP POLICY IF EXISTS "Parents view children modules" ON public.modules;
CREATE POLICY "Parents view children modules"
ON public.modules
FOR SELECT
TO authenticated
USING (public.is_parent_of_enrolled(course_id, auth.uid()));
