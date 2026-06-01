CREATE POLICY "Tutors view enrolled student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (has_role(auth.uid(), 'tutor'::app_role) OR has_role(auth.uid(), 'ta'::app_role) OR has_role(auth.uid(), 'school_admin'::app_role) OR is_admin(auth.uid()))
  AND EXISTS (
    SELECT 1
    FROM public.enrollments e
    WHERE e.student_id = profiles.user_id
      AND can_access_course(e.course_id, auth.uid())
  )
);