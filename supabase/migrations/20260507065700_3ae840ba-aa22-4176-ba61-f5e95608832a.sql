
-- 1. Tighten lessons & modules SELECT
DROP POLICY IF EXISTS "View lessons" ON public.lessons;
CREATE POLICY "View lessons" ON public.lessons FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.modules m
    WHERE m.id = lessons.module_id
      AND public.can_access_course(m.course_id, auth.uid())
  )
);

DROP POLICY IF EXISTS "View modules" ON public.modules;
CREATE POLICY "View modules" ON public.modules FOR SELECT TO authenticated
USING (public.can_access_course(course_id, auth.uid()));

-- 2. Tighten submissions storage SELECT to course-scoped
DROP POLICY IF EXISTS "Submissions read scoped" ON storage.objects;
CREATE POLICY "Submissions read scoped" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions' AND (
    -- Owner (file is namespaced by uid as first folder segment)
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_admin(auth.uid())
    -- Staff who manage a course that has a submission referencing this file
    OR EXISTS (
      SELECT 1
      FROM public.assignment_submissions s
      JOIN public.assignments a ON a.id = s.assignment_id
      WHERE s.file_url LIKE '%' || storage.objects.name || '%'
        AND public.can_manage_course(a.course_id, auth.uid())
    )
    -- Parents of the student who owns the submission
    OR EXISTS (
      SELECT 1
      FROM public.assignment_submissions s
      JOIN public.parent_student_links psl
        ON psl.student_id = s.student_id AND psl.parent_id = auth.uid() AND psl.status = 'approved'
      WHERE s.file_url LIKE '%' || storage.objects.name || '%'
    )
  )
);

-- 3. Restrict user_roles SELECT
DROP POLICY IF EXISTS "All authenticated can view roles" ON public.user_roles;
CREATE POLICY "Users view own role" ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'school_admin')
);

-- 4. Narrow profiles SELECT - tutors/TAs limited to profiles sharing an institution
DROP POLICY IF EXISTS "Privileged users view profiles" ON public.profiles;
CREATE POLICY "Privileged users view profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'school_admin')
    AND EXISTS (
      SELECT 1 FROM public.user_institutions ui
      WHERE ui.user_id = profiles.user_id
        AND ui.institution_id = public.get_user_institution_id(auth.uid())
    )
  )
  OR (
    (public.has_role(auth.uid(), 'tutor') OR public.has_role(auth.uid(), 'ta'))
    AND EXISTS (
      SELECT 1
      FROM public.user_institutions ui_self
      JOIN public.user_institutions ui_target
        ON ui_target.institution_id = ui_self.institution_id
      WHERE ui_self.user_id = auth.uid()
        AND ui_target.user_id = profiles.user_id
    )
  )
);

-- 5. Revoke EXECUTE from authenticated on internal trigger-only / cron-only functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_grade() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_announcement() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_lesson() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_module() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_assignment() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_new_quiz() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_on_tutor_assigned() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_quiz_time_limit() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.expire_stale_quiz_attempts() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_notifications() FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM authenticated, anon, public;
