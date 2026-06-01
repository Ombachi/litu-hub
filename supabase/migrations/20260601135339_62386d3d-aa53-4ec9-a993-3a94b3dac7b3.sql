
-- 1. Restrict institutions SELECT to members + admins (hide contact info from non-members)
DROP POLICY IF EXISTS "Anyone can view institutions" ON public.institutions;
CREATE POLICY "Members and admins view institutions"
ON public.institutions
FOR SELECT
TO authenticated
USING (
  is_admin(auth.uid())
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.user_institutions ui
    WHERE ui.user_id = auth.uid() AND ui.institution_id = institutions.id
  )
);

-- 2. user_roles: scope school_admin read to same institution
DROP POLICY IF EXISTS "Users view own role" ON public.user_roles;
CREATE POLICY "Users view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR is_admin(auth.uid())
  OR has_role(auth.uid(), 'platform_admin'::app_role)
  OR (
    has_role(auth.uid(), 'school_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.user_institutions ui
      WHERE ui.user_id = user_roles.user_id
        AND ui.institution_id = get_user_institution_id(auth.uid())
    )
  )
);

-- 3. Receipts bucket: scope school admin writes to their own institution
DROP POLICY IF EXISTS "Receipts: school admins write" ON storage.objects;
CREATE POLICY "Receipts: school admins write"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND has_role(auth.uid(), 'school_admin'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id::text = (storage.foldername(name))[1]
      AND i.institution_id = get_user_institution_id(auth.uid())
  )
);

-- 4. Receipts bucket: add DELETE policy for admins / school admins (scoped)
CREATE POLICY "Receipts: admins delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'receipts'
  AND (
    is_admin(auth.uid())
    OR (
      has_role(auth.uid(), 'school_admin'::app_role)
      AND EXISTS (
        SELECT 1 FROM public.invoices i
        WHERE i.id::text = (storage.foldername(name))[1]
          AND i.institution_id = get_user_institution_id(auth.uid())
      )
    )
  )
);

-- 5. Institution logos: remove broad listing policy. Public CDN URLs still work for public buckets.
DROP POLICY IF EXISTS "Institution logos public read" ON storage.objects;
CREATE POLICY "Institution logos read by authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'institution-logos');

-- 6. Revoke EXECUTE on SECURITY DEFINER functions from anon (keep authenticated)
REVOKE EXECUTE ON FUNCTION public.has_active_subscription(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_receipt_job() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_bulk_notifications(uuid[], text, text, text, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_receipt_job() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_bulk_notifications(uuid[], text, text, text, text) TO authenticated, service_role;
