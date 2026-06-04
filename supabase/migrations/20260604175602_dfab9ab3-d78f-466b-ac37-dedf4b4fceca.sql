
-- 1) ai_question_cache: restrict reads to coaches/admins
DROP POLICY IF EXISTS "Authenticated read ai cache" ON public.ai_question_cache;
CREATE POLICY "Coaches read ai cache"
ON public.ai_question_cache
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'school_admin'::app_role)
  OR public.has_role(auth.uid(), 'tutor'::app_role)
  OR public.has_role(auth.uid(), 'ta'::app_role)
);

-- 2) courses: scope read access by institution / membership
DROP POLICY IF EXISTS "All authenticated can view courses" ON public.courses;
CREATE POLICY "Scoped course visibility"
ON public.courses
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.is_course_tutor(id, auth.uid())
  OR public.is_tutor_or_ta(id, auth.uid())
  OR public.is_enrolled(id, auth.uid())
  OR public.is_parent_of_enrolled(id, auth.uid())
  OR (
    institution_id IS NOT NULL
    AND institution_id = public.get_user_institution_id(auth.uid())
  )
);

-- 3) email_delivery_log: scope school admin reads to their institution
DROP POLICY IF EXISTS "edl_admin_read" ON public.email_delivery_log;
CREATE POLICY "edl_admin_read"
ON public.email_delivery_log
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.payments p
      JOIN public.invoices i ON i.id = p.invoice_id
      WHERE p.id = email_delivery_log.payment_id
        AND i.institution_id = public.get_user_institution_id(auth.uid())
    )
  )
);

-- 4) receipt_jobs: scope school admin reads to their institution
DROP POLICY IF EXISTS "Admins view receipt jobs" ON public.receipt_jobs;
CREATE POLICY "Admins view receipt jobs"
ON public.receipt_jobs
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR (
    public.has_role(auth.uid(), 'school_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.payments p
      JOIN public.invoices i ON i.id = p.invoice_id
      WHERE p.id = receipt_jobs.payment_id
        AND i.institution_id = public.get_user_institution_id(auth.uid())
    )
  )
);

-- 5) storage.objects: remove blanket listing on the public institution-logos bucket
-- Public URLs continue to work; only directory listing via the API is removed.
DROP POLICY IF EXISTS "Institution logos read by authenticated" ON storage.objects;
