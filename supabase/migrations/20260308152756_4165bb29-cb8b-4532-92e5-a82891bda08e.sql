
-- Parent-student links for parent portal
CREATE TABLE public.parent_student_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL,
  student_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(parent_id, student_id)
);

ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents view own links" ON public.parent_student_links
  FOR SELECT USING (parent_id = auth.uid() OR student_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage parent links" ON public.parent_student_links
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Parents insert own links" ON public.parent_student_links
  FOR INSERT WITH CHECK (parent_id = auth.uid());

-- Enrollment requests for approval workflow
CREATE TABLE public.enrollment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_email text NOT NULL DEFAULT '',
  student_id uuid,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  UNIQUE(student_email, course_id)
);

ALTER TABLE public.enrollment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View enrollment requests" ON public.enrollment_requests
  FOR SELECT USING (
    (student_id = auth.uid()) OR public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.course_tutors WHERE course_id = enrollment_requests.course_id AND tutor_id = auth.uid())
  );

CREATE POLICY "Insert enrollment requests" ON public.enrollment_requests
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Update enrollment requests" ON public.enrollment_requests
  FOR UPDATE USING (
    public.is_admin(auth.uid()) OR
    EXISTS (SELECT 1 FROM public.course_tutors WHERE course_id = enrollment_requests.course_id AND tutor_id = auth.uid())
  );

CREATE POLICY "Delete enrollment requests" ON public.enrollment_requests
  FOR DELETE USING (public.is_admin(auth.uid()));
