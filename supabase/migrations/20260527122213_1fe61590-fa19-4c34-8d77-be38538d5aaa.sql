
-- 1. Remove direct audit_log INSERT for authenticated users; force server-side only
DROP POLICY IF EXISTS "Users insert own audit logs" ON public.audit_log;
-- No INSERT policy => only SECURITY DEFINER functions / service_role can write

-- 2. institution-logos: explicit public SELECT policy
DROP POLICY IF EXISTS "Institution logos public read" ON storage.objects;
CREATE POLICY "Institution logos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'institution-logos');

-- 3. message-attachments: allow recipients to read attachments sent to them
DROP POLICY IF EXISTS "Message attachment recipients read" ON storage.objects;
CREATE POLICY "Message attachment recipients read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (
    SELECT 1 FROM public.direct_messages dm
    WHERE dm.receiver_id = auth.uid()
      AND dm.file_url IS NOT NULL
      AND position(storage.objects.name in dm.file_url) > 0
  )
);

-- 4. receipts: allow school admins to upload receipts for their institution
DROP POLICY IF EXISTS "Receipts: school admins write" ON storage.objects;
CREATE POLICY "Receipts: school admins write"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts'
  AND has_role(auth.uid(), 'school_admin'::app_role)
);
