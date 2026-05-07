
-- =========================================================
-- #1 direct_messages: restrict UPDATE to the `read` flag
-- =========================================================
DROP POLICY IF EXISTS "Receiver marks read" ON public.direct_messages;

CREATE OR REPLACE FUNCTION public.mark_direct_message_read(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.direct_messages
    SET read = true
  WHERE id = _message_id AND receiver_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_direct_message_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_direct_message_read(uuid) TO authenticated;

-- =========================================================
-- #2 discussion_posts: prevent author spoofing on UPDATE
-- =========================================================
DROP POLICY IF EXISTS "Update own posts" ON public.discussion_posts;
CREATE POLICY "Update own posts"
ON public.discussion_posts
FOR UPDATE
TO authenticated
USING (author_id = auth.uid() OR is_admin(auth.uid()))
WITH CHECK (
  author_id = (SELECT dp2.author_id FROM public.discussion_posts dp2 WHERE dp2.id = discussion_posts.id)
  AND discussion_id = (SELECT dp2.discussion_id FROM public.discussion_posts dp2 WHERE dp2.id = discussion_posts.id)
);

-- =========================================================
-- #3 enrollment_requests: only request for self
-- =========================================================
DROP POLICY IF EXISTS "Insert enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Insert enrollment requests"
ON public.enrollment_requests
FOR INSERT
TO authenticated
WITH CHECK (
  student_id = auth.uid()
  AND lower(student_email) = lower(COALESCE((SELECT email FROM public.profiles WHERE user_id = auth.uid()), ''))
  AND status = 'pending'
);

-- =========================================================
-- #4 audit_log: caller can only attribute entries to self
-- =========================================================
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_log;
CREATE POLICY "Users insert own audit logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- =========================================================
-- #6 TA scoping: introduce explicit course_tas assignment
-- =========================================================
CREATE TABLE IF NOT EXISTS public.course_tas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL,
  ta_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, ta_id)
);
ALTER TABLE public.course_tas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage course TAs"
ON public.course_tas FOR ALL TO authenticated
USING (is_admin(auth.uid())
  OR (has_role(auth.uid(), 'school_admin') AND school_admin_can_access_course(course_id, auth.uid()))
  OR is_course_tutor(course_id, auth.uid()))
WITH CHECK (is_admin(auth.uid())
  OR (has_role(auth.uid(), 'school_admin') AND school_admin_can_access_course(course_id, auth.uid()))
  OR is_course_tutor(course_id, auth.uid()));

CREATE POLICY "View course TAs"
ON public.course_tas FOR SELECT TO authenticated
USING (can_access_course(course_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.is_tutor_or_ta(_course_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_course_tutor(_course_id, _user_id)
    OR EXISTS (
      SELECT 1 FROM public.course_tas
      WHERE course_id = _course_id AND ta_id = _user_id
    )
$$;

-- =========================================================
-- #7 request_parent_link_by_email: scope admin notifications to student's institution
-- =========================================================
CREATE OR REPLACE FUNCTION public.request_parent_link_by_email(_student_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_student uuid;
  v_existing uuid;
  v_student_inst uuid;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT p.user_id INTO v_student
  FROM public.profiles p
  WHERE lower(p.email) = lower(coalesce(_student_email, ''))
  LIMIT 1;

  IF v_student IS NULL THEN
    RAISE EXCEPTION 'No student found with that email';
  END IF;

  IF v_student = v_caller THEN
    RAISE EXCEPTION 'You cannot link to your own account';
  END IF;

  SELECT id INTO v_existing FROM public.parent_student_links
  WHERE parent_id = v_caller AND student_id = v_student;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'A link request already exists for this student';
  END IF;

  INSERT INTO public.parent_student_links (parent_id, student_id, status)
  VALUES (v_caller, v_student, 'pending')
  RETURNING id INTO v_existing;

  v_student_inst := public.get_user_institution_id(v_student);

  -- Notify only school admins of the student's institution + platform admins
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT DISTINCT ur.user_id,
         'New Parent Link Request',
         'A parent has requested to link to a student. Review pending approvals.',
         'info',
         '/admin?tab=parent-approvals'
  FROM public.user_roles ur
  LEFT JOIN public.user_institutions ui ON ui.user_id = ur.user_id
  WHERE
    ur.role = 'platform_admin'
    OR (ur.role = 'school_admin' AND v_student_inst IS NOT NULL AND ui.institution_id = v_student_inst);

  RETURN v_student;
END;
$$;

-- =========================================================
-- #9 search_messageable_users: scope to shared institution
-- =========================================================
CREATE OR REPLACE FUNCTION public.search_messageable_users(_query text, _limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, first_name text, last_name text, avatar_url text, role app_role)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_q text;
  v_is_admin boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_q := '%' || lower(coalesce(_query, '')) || '%';
  v_is_admin := public.is_admin(v_caller);

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.last_name, p.avatar_url, ur.role
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id <> v_caller
    AND (
      v_is_admin
      OR EXISTS (
        SELECT 1
        FROM public.user_institutions ui_self
        JOIN public.user_institutions ui_target
          ON ui_target.institution_id = ui_self.institution_id
        WHERE ui_self.user_id = v_caller
          AND ui_target.user_id = p.user_id
      )
    )
    AND (
      _query IS NULL OR _query = ''
      OR lower(p.first_name) LIKE v_q
      OR lower(p.last_name) LIKE v_q
      OR lower(p.first_name || ' ' || p.last_name) LIKE v_q
    )
  ORDER BY p.first_name, p.last_name
  LIMIT GREATEST(1, LEAST(_limit, 50));
END;
$$;

-- =========================================================
-- #10 direct_messages INSERT: enforce same-institution (or admin / parent link)
-- =========================================================
CREATE OR REPLACE FUNCTION public.can_message_user(_recipient uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND _recipient IS NOT NULL
    AND _recipient <> auth.uid()
    AND (
      public.is_admin(auth.uid())
      OR public.is_admin(_recipient)
      OR EXISTS (
        SELECT 1 FROM public.user_institutions ui_self
        JOIN public.user_institutions ui_other
          ON ui_other.institution_id = ui_self.institution_id
        WHERE ui_self.user_id = auth.uid()
          AND ui_other.user_id = _recipient
      )
      OR EXISTS (
        SELECT 1 FROM public.parent_student_links psl
        WHERE psl.status = 'approved'
          AND ((psl.parent_id = auth.uid() AND psl.student_id = _recipient)
            OR (psl.student_id = auth.uid() AND psl.parent_id = _recipient))
      )
    )
$$;
REVOKE EXECUTE ON FUNCTION public.can_message_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_message_user(uuid) TO authenticated;

DROP POLICY IF EXISTS "Users send messages" ON public.direct_messages;
CREATE POLICY "Users send messages"
ON public.direct_messages
FOR INSERT
TO authenticated
WITH CHECK (sender_id = auth.uid() AND public.can_message_user(receiver_id));

-- =========================================================
-- #11 notifications.link: forbid protocol-relative URLs (//evil.com)
-- =========================================================
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (link IS NULL OR link ~ '^/[A-Za-z0-9_?=&%.\-][A-Za-z0-9/_?=&%.\-]*$')
);
