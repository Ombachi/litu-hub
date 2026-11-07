-- Weekly timetable. Apply once the backend is resumed.
CREATE TABLE public.timetable_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  start_time time NOT NULL,
  end_time time NOT NULL,
  period_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX ON public.timetable_periods (institution_id, day_of_week, start_time);

CREATE TABLE public.timetable_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES public.timetable_periods(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  tutor_id uuid,
  room_or_location text,
  virtual_link text CHECK (virtual_link IS NULL OR virtual_link ~* '^https://(meet\.google\.com|([a-z0-9-]+\.)*zoom\.us|teams\.(microsoft|live)\.com)/'),
  stream_cohort_id uuid REFERENCES public.cohorts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.timetable_entries (institution_id, period_id);
CREATE INDEX ON public.timetable_entries (course_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.timetable_periods, public.timetable_entries TO authenticated;
GRANT ALL ON public.timetable_periods, public.timetable_entries TO service_role;
ALTER TABLE public.timetable_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_entries ENABLE ROW LEVEL SECURITY;

-- Members of the institution can read periods; school admins manage them.
CREATE POLICY "members read periods" ON public.timetable_periods FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_institutions ui WHERE ui.user_id = auth.uid() AND ui.institution_id = timetable_periods.institution_id));
CREATE POLICY "school admins manage periods" ON public.timetable_periods FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'school_admin') AND EXISTS (SELECT 1 FROM public.user_institutions ui WHERE ui.user_id = auth.uid() AND ui.institution_id = timetable_periods.institution_id))
  WITH CHECK (public.has_role(auth.uid(), 'school_admin') AND EXISTS (SELECT 1 FROM public.user_institutions ui WHERE ui.user_id = auth.uid() AND ui.institution_id = timetable_periods.institution_id));

-- Entries: same-institution members read; admins manage all; tutors manage entries for their own courses.
CREATE POLICY "members read entries" ON public.timetable_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_institutions ui WHERE ui.user_id = auth.uid() AND ui.institution_id = timetable_entries.institution_id));
CREATE POLICY "admins and course tutors manage entries" ON public.timetable_entries FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_institutions ui WHERE ui.user_id = auth.uid() AND ui.institution_id = timetable_entries.institution_id)
    AND (public.has_role(auth.uid(), 'school_admin')
         OR EXISTS (SELECT 1 FROM public.courses c WHERE c.id = timetable_entries.course_id AND c.created_by = auth.uid()))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_institutions ui WHERE ui.user_id = auth.uid() AND ui.institution_id = timetable_entries.institution_id)
    AND EXISTS (SELECT 1 FROM public.timetable_periods p WHERE p.id = period_id AND p.institution_id = timetable_entries.institution_id)
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_id AND c.institution_id = timetable_entries.institution_id
                AND (public.has_role(auth.uid(), 'school_admin') OR c.created_by = auth.uid()))
  );
