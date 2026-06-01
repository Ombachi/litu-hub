CREATE OR REPLACE FUNCTION public.get_parent_link_audit(_link_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_link record;
  v_can boolean := false;
  v_link_json jsonb;
  v_notifications jsonb;
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

  SELECT jsonb_build_object(
    'link_id', v_link.id,
    'status', v_link.status,
    'created_at', v_link.created_at,
    'approved_at', v_link.approved_at,
    'parent', jsonb_build_object(
      'user_id', v_link.parent_id,
      'first_name', pp.first_name,
      'last_name', pp.last_name,
      'email', pp.email
    ),
    'student', jsonb_build_object(
      'user_id', v_link.student_id,
      'first_name', sp.first_name,
      'last_name', sp.last_name,
      'email', sp.email
    ),
    'approver', CASE WHEN v_link.approved_by IS NULL THEN NULL ELSE jsonb_build_object(
      'user_id', v_link.approved_by,
      'first_name', ap.first_name,
      'last_name', ap.last_name,
      'email', ap.email
    ) END
  ) INTO v_link_json
  FROM (SELECT 1) AS _
  LEFT JOIN public.profiles pp ON pp.user_id = v_link.parent_id
  LEFT JOIN public.profiles sp ON sp.user_id = v_link.student_id
  LEFT JOIN public.profiles ap ON ap.user_id = v_link.approved_by;

  SELECT COALESCE(jsonb_agg(payload ORDER BY ts), '[]'::jsonb) INTO v_notifications
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'user_id', n.user_id,
      'title', n.title,
      'message', n.message,
      'type', n.type,
      'created_at', n.created_at,
      'read', n.read
    ) AS payload, n.created_at AS ts
    FROM public.notifications n
    WHERE
      (n.user_id = v_link.parent_id
        AND n.title IN ('Parent Link Approved', 'Parent Link Rejected')
        AND n.created_at >= v_link.created_at - interval '1 minute')
      OR
      (n.title = 'New Parent Link Request'
        AND n.created_at BETWEEN v_link.created_at - interval '1 minute'
                             AND v_link.created_at + interval '1 minute')
  ) sub;

  RETURN jsonb_build_object(
    'link', v_link_json,
    'notifications', v_notifications
  );
END;
$$;