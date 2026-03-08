
-- Allow school admins to insert courses for their institution
CREATE POLICY "School admins insert courses"
ON public.courses FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'school_admin') 
  AND institution_id = get_user_institution_id(auth.uid())
);

-- Allow school admins to update courses in their institution
CREATE POLICY "School admins update courses"
ON public.courses FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'school_admin') 
  AND institution_id = get_user_institution_id(auth.uid())
);

-- Allow school admins to delete courses in their institution
CREATE POLICY "School admins delete courses"
ON public.courses FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'school_admin') 
  AND institution_id = get_user_institution_id(auth.uid())
);

-- Allow school admins to manage course_tutors for their institution's courses
CREATE POLICY "School admins manage course tutors"
ON public.course_tutors FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'school_admin') 
  AND school_admin_can_access_course(course_id, auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'school_admin') 
  AND school_admin_can_access_course(course_id, auth.uid())
);
