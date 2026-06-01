
-- Extend can_message_user: allow parent <-> tutor/TA messaging
-- when the tutor teaches a course the approved-linked child is enrolled in.
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
      -- Parent (auth.uid) -> Tutor/TA (_recipient) of an approved child's course
      OR EXISTS (
        SELECT 1
        FROM public.parent_student_links psl
        JOIN public.enrollments e ON e.student_id = psl.student_id
        LEFT JOIN public.course_tutors ct ON ct.course_id = e.course_id AND ct.tutor_id = _recipient
        LEFT JOIN public.course_tas    cta ON cta.course_id = e.course_id AND cta.ta_id = _recipient
        WHERE psl.parent_id = auth.uid()
          AND psl.status = 'approved'
          AND (ct.id IS NOT NULL OR cta.id IS NOT NULL)
      )
      -- Tutor/TA (auth.uid) -> Parent (_recipient) of a child in their course
      OR EXISTS (
        SELECT 1
        FROM public.parent_student_links psl
        JOIN public.enrollments e ON e.student_id = psl.student_id
        LEFT JOIN public.course_tutors ct ON ct.course_id = e.course_id AND ct.tutor_id = auth.uid()
        LEFT JOIN public.course_tas    cta ON cta.course_id = e.course_id AND cta.ta_id = auth.uid()
        WHERE psl.parent_id = _recipient
          AND psl.status = 'approved'
          AND (ct.id IS NOT NULL OR cta.id IS NOT NULL)
      )
    )
$$;

-- RPC: list tutors/TAs a parent can message for a specific approved child,
-- with the course context. Returns first/last name (no email).
CREATE OR REPLACE FUNCTION public.get_parent_tutor_contacts(_student_id uuid)
RETURNS TABLE (
  tutor_id uuid,
  first_name text,
  last_name text,
  role text,
  course_id uuid,
  course_code text,
  course_title text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH approved AS (
    SELECT 1
    FROM public.parent_student_links
    WHERE parent_id = auth.uid()
      AND student_id = _student_id
      AND status = 'approved'
  ),
  child_courses AS (
    SELECT e.course_id
    FROM public.enrollments e, approved
    WHERE e.student_id = _student_id
  )
  SELECT
    p.user_id AS tutor_id,
    p.first_name,
    p.last_name,
    src.role,
    c.id AS course_id,
    c.code AS course_code,
    c.title AS course_title
  FROM (
    SELECT ct.tutor_id AS uid, ct.course_id, 'Tutor'::text AS role
    FROM public.course_tutors ct
    JOIN child_courses cc ON cc.course_id = ct.course_id
    UNION ALL
    SELECT cta.ta_id AS uid, cta.course_id, 'TA'::text AS role
    FROM public.course_tas cta
    JOIN child_courses cc ON cc.course_id = cta.course_id
  ) src
  JOIN public.profiles p ON p.user_id = src.uid
  JOIN public.courses  c ON c.id = src.course_id
  ORDER BY c.code, p.first_name, p.last_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_parent_tutor_contacts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_parent_tutor_contacts(uuid) TO authenticated, service_role;
