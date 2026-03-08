
-- School admins can enroll students in their institution's courses
CREATE POLICY "School admins insert enrollments"
ON public.enrollments FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'school_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = enrollments.course_id
    AND c.institution_id = get_user_institution_id(auth.uid())
  )
);

-- School admins can remove enrollments from their institution's courses
CREATE POLICY "School admins delete enrollments"
ON public.enrollments FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'school_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM courses c
    WHERE c.id = enrollments.course_id
    AND c.institution_id = get_user_institution_id(auth.uid())
  )
);
