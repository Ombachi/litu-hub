
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND (link IS NULL OR link ~ '^/[A-Za-z0-9/_?=&%.\-]*$'));

CREATE OR REPLACE FUNCTION public.notify_saq_graded(_attempt_id uuid, _points_earned int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caller uuid := auth.uid(); v_student uuid; v_course uuid; v_title text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT a.student_id, q.course_id, q.title INTO v_student, v_course, v_title
  FROM public.quiz_attempts a JOIN public.quizzes q ON q.id = a.quiz_id WHERE a.id = _attempt_id;
  IF v_student IS NULL THEN RAISE EXCEPTION 'Attempt not found'; END IF;
  IF NOT public.can_manage_course(v_course, v_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (v_student, 'Quiz Answer Graded',
    'Your short answer for "' || COALESCE(v_title,'') || '" has been graded. Points: ' || _points_earned,
    'grade', '/grades');
END $$;

DROP POLICY IF EXISTS "Tutors view all submissions" ON storage.objects;
DROP POLICY IF EXISTS "Users view own submissions uploads" ON storage.objects;
DROP POLICY IF EXISTS "Students view own submissions" ON storage.objects;
DROP POLICY IF EXISTS "Users view message attachments" ON storage.objects;

CREATE POLICY "Submissions read scoped" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submissions' AND (
  (storage.foldername(name))[1] = (auth.uid())::text
  OR public.is_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid()
    AND ur.role IN ('platform_admin','school_admin','tutor','ta'))));

CREATE POLICY "Message attachments read own" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'message-attachments' AND (storage.foldername(name))[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Authenticated users subscribe to own channels" ON realtime.messages;
CREATE POLICY "Authenticated users subscribe to own topics" ON realtime.messages FOR SELECT TO authenticated
USING (topic LIKE ('%' || (auth.uid())::text || '%'));

CREATE OR REPLACE FUNCTION public.is_tutor_or_ta(_course_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_course_tutor(_course_id, _user_id)
    OR EXISTS (SELECT 1 FROM public.user_roles ur
      JOIN public.user_institutions ui ON ui.user_id = ur.user_id
      JOIN public.courses c ON c.institution_id = ui.institution_id
      WHERE ur.user_id = _user_id AND ur.role = 'ta' AND c.id = _course_id)
$$;

CREATE OR REPLACE FUNCTION public.can_access_course(_course_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(_user_id)
    OR (public.has_role(_user_id, 'school_admin') AND public.school_admin_can_access_course(_course_id, _user_id))
    OR public.is_course_tutor(_course_id, _user_id)
    OR public.is_tutor_or_ta(_course_id, _user_id)
    OR public.is_enrolled(_course_id, _user_id)
$$;

DO $$ DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure::text AS sig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef = true LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', r.sig);
  END LOOP;
END $$;
