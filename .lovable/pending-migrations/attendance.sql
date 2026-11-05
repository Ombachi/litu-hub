-- Attendance tracking (apply when the database is resumed).
CREATE TABLE public.attendance_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  date date NOT NULL,
  period_name text NOT NULL CHECK (char_length(period_name) BETWEEN 1 AND 40),
  tutor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, date, period_name)
);
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'present' CHECK (status IN ('present','absent','late','excused')),
  remarks text CHECK (remarks IS NULL OR char_length(remarks) <= 300),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);
CREATE INDEX attendance_records_student_idx ON public.attendance_records (student_id);
CREATE INDEX attendance_sessions_inst_date_idx ON public.attendance_sessions (institution_id, date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_sessions, public.attendance_records TO authenticated;
GRANT ALL ON public.attendance_sessions, public.attendance_records TO service_role;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Session institution must match the course's institution, and the caller's.
CREATE OR REPLACE FUNCTION public.attendance_session_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.institution_id IS DISTINCT FROM (SELECT institution_id FROM public.courses WHERE id = NEW.course_id) THEN
    RAISE EXCEPTION 'Course does not belong to this institution';
  END IF;
  IF NEW.date > current_date THEN RAISE EXCEPTION 'Attendance cannot be taken for a future date'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER attendance_session_guard BEFORE INSERT OR UPDATE ON public.attendance_sessions FOR EACH ROW EXECUTE FUNCTION public.attendance_session_guard();

CREATE OR REPLACE FUNCTION public.can_take_attendance(_uid uuid, _course uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.courses c WHERE c.id = _course AND c.institution_id = public.get_user_institution_id(_uid)
    AND (c.tutor_id = _uid OR EXISTS (SELECT 1 FROM public.course_tutors ct WHERE ct.course_id = c.id AND ct.tutor_id = _uid) OR public.has_role(_uid, 'school_admin')))
$$;

CREATE POLICY "Staff manage course attendance sessions" ON public.attendance_sessions FOR ALL TO authenticated
  USING (public.can_take_attendance(auth.uid(), course_id))
  WITH CHECK (public.can_take_attendance(auth.uid(), course_id) AND institution_id = public.get_user_institution_id(auth.uid()));
CREATE POLICY "Students and parents read their sessions" ON public.attendance_sessions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attendance_records r WHERE r.session_id = id AND (r.student_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.parent_student_links l WHERE l.student_id = r.student_id AND l.parent_id = auth.uid() AND l.status = 'approved'))));

CREATE POLICY "Staff manage attendance records" ON public.attendance_records FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.attendance_sessions s WHERE s.id = session_id AND public.can_take_attendance(auth.uid(), s.course_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.attendance_sessions s JOIN public.enrollments e ON e.course_id = s.course_id
    WHERE s.id = session_id AND e.student_id = attendance_records.student_id AND public.can_take_attendance(auth.uid(), s.course_id)));
CREATE POLICY "Students read own attendance" ON public.attendance_records FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Parents read linked child attendance" ON public.attendance_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.parent_student_links l WHERE l.student_id = attendance_records.student_id AND l.parent_id = auth.uid() AND l.status = 'approved'));
