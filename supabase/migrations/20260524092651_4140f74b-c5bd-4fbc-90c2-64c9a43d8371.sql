
-- 1) course_tutors: restrict SELECT
DROP POLICY IF EXISTS "View course tutors" ON public.course_tutors;

CREATE POLICY "View course tutors"
ON public.course_tutors
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR tutor_id = auth.uid()
  OR public.can_access_course(course_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.user_institutions ui_self
    JOIN public.courses c ON c.id = course_tutors.course_id
    WHERE ui_self.user_id = auth.uid()
      AND ui_self.institution_id = c.institution_id
  )
);

-- 2) realtime.messages: tighten topic policies to a prefix match on the user's UID
DROP POLICY IF EXISTS "Authenticated users subscribe to own topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users broadcast to own channels" ON realtime.messages;

CREATE POLICY "Authenticated users subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (topic LIKE (auth.uid()::text || ':%') OR topic = auth.uid()::text);

CREATE POLICY "Authenticated users broadcast to own channels"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (topic LIKE (auth.uid()::text || ':%') OR topic = auth.uid()::text);

-- 3) Revoke EXECUTE from anon on all SECURITY DEFINER functions in public schema.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;
