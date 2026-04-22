-- Search RPC for messaging recipient picker: returns name/avatar/role only (no email).
-- Anyone authenticated can search; results limited to non-self users matching the query.
CREATE OR REPLACE FUNCTION public.search_messageable_users(_query text, _limit int DEFAULT 20)
RETURNS TABLE(user_id uuid, first_name text, last_name text, avatar_url text, role app_role)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_q text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_q := '%' || lower(coalesce(_query, '')) || '%';

  RETURN QUERY
  SELECT p.user_id, p.first_name, p.last_name, p.avatar_url, ur.role
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
  WHERE p.user_id <> v_caller
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

GRANT EXECUTE ON FUNCTION public.search_messageable_users(text, int) TO authenticated;

-- List pending parent-student link requests for admin approval (school admins scoped to their institution).
CREATE OR REPLACE FUNCTION public.list_pending_parent_links()
RETURNS TABLE(
  link_id uuid,
  parent_id uuid,
  parent_first_name text,
  parent_last_name text,
  parent_email text,
  student_id uuid,
  student_first_name text,
  student_last_name text,
  student_email text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_school_admin boolean;
  v_inst uuid;
BEGIN
  IF NOT (is_admin(v_caller) OR has_role(v_caller, 'school_admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_is_school_admin := has_role(v_caller, 'school_admin') AND NOT is_admin(v_caller);
  IF v_is_school_admin THEN
    v_inst := get_user_institution_id(v_caller);
  END IF;

  RETURN QUERY
  SELECT
    psl.id,
    psl.parent_id,
    pp.first_name, pp.last_name, pp.email,
    psl.student_id,
    sp.first_name, sp.last_name, sp.email,
    psl.status,
    psl.created_at
  FROM public.parent_student_links psl
  LEFT JOIN public.profiles pp ON pp.user_id = psl.parent_id
  LEFT JOIN public.profiles sp ON sp.user_id = psl.student_id
  WHERE (
    NOT v_is_school_admin
    OR EXISTS (
      SELECT 1 FROM public.user_institutions ui
      WHERE ui.user_id = psl.student_id AND ui.institution_id = v_inst
    )
  )
  ORDER BY (psl.status = 'pending') DESC, psl.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_parent_links() TO authenticated;

-- Approve a pending parent-student link
CREATE OR REPLACE FUNCTION public.approve_parent_link(_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_link record;
  v_can boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.parent_student_links WHERE id = _link_id;
  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Link not found';
  END IF;

  IF is_admin(v_caller) THEN
    v_can := true;
  ELSIF has_role(v_caller, 'school_admin') THEN
    v_can := EXISTS (
      SELECT 1 FROM public.user_institutions ui
      WHERE ui.user_id = v_link.student_id
        AND ui.institution_id = get_user_institution_id(v_caller)
    );
  END IF;

  IF NOT v_can THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.parent_student_links
  SET status = 'approved', approved_by = v_caller, approved_at = now()
  WHERE id = _link_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_link.parent_id,
    'Parent Link Approved',
    'Your link to the student account has been approved. You can now view their progress.',
    'info',
    '/parent'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_parent_link(uuid) TO authenticated;

-- Reject (delete) a pending parent-student link
CREATE OR REPLACE FUNCTION public.reject_parent_link(_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_link record;
  v_can boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_link FROM public.parent_student_links WHERE id = _link_id;
  IF v_link.id IS NULL THEN
    RAISE EXCEPTION 'Link not found';
  END IF;

  IF is_admin(v_caller) THEN
    v_can := true;
  ELSIF has_role(v_caller, 'school_admin') THEN
    v_can := EXISTS (
      SELECT 1 FROM public.user_institutions ui
      WHERE ui.user_id = v_link.student_id
        AND ui.institution_id = get_user_institution_id(v_caller)
    );
  END IF;

  IF NOT v_can THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM public.parent_student_links WHERE id = _link_id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_link.parent_id,
    'Parent Link Rejected',
    'Your request to link to a student account was not approved. Contact your school admin for help.',
    'warning',
    '/parent'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_parent_link(uuid) TO authenticated;

-- Allow parents to look up a student id by email without exposing the profiles table broadly.
-- Returns the student's user_id only if the email matches an existing student.
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

  -- Prevent duplicate requests
  SELECT id INTO v_existing FROM public.parent_student_links
  WHERE parent_id = v_caller AND student_id = v_student;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'A link request already exists for this student';
  END IF;

  INSERT INTO public.parent_student_links (parent_id, student_id, status)
  VALUES (v_caller, v_student, 'pending')
  RETURNING id INTO v_existing;

  -- Notify school admins of caller's institution (or all platform admins) of pending request
  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT ur.user_id,
         'New Parent Link Request',
         'A parent has requested to link to a student. Review pending approvals.',
         'info',
         '/admin?tab=parent-approvals'
  FROM public.user_roles ur
  WHERE ur.role IN ('platform_admin', 'school_admin');

  RETURN v_student;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_parent_link_by_email(text) TO authenticated;