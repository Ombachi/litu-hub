-- School admins can view enrollments for courses in their institution
CREATE POLICY "School admins view institution enrollments"
ON public.enrollments
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'school_admin')
  AND EXISTS (
    SELECT 1 FROM public.courses c
    WHERE c.id = enrollments.course_id
    AND c.institution_id = public.get_user_institution_id(auth.uid())
  )
);

-- School admins can view submissions for assignments in their institution's courses
CREATE POLICY "School admins view institution submissions"
ON public.assignment_submissions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'school_admin')
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    JOIN public.courses c ON c.id = a.course_id
    WHERE a.id = assignment_submissions.assignment_id
    AND c.institution_id = public.get_user_institution_id(auth.uid())
  )
);