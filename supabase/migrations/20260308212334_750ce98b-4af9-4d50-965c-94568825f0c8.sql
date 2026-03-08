-- Allow school admins to add/remove users from their own institution
CREATE POLICY "School admins manage own institution links"
ON public.user_institutions
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_institutions ui2
    WHERE ui2.user_id = auth.uid()
    AND ui2.institution_id = user_institutions.institution_id
    AND public.has_role(auth.uid(), 'school_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_institutions ui2
    WHERE ui2.user_id = auth.uid()
    AND ui2.institution_id = user_institutions.institution_id
    AND public.has_role(auth.uid(), 'school_admin')
  )
);

-- Allow school admins to view all user_institutions for their institution
CREATE POLICY "School admins view institution members"
ON public.user_institutions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_institutions ui2
    WHERE ui2.user_id = auth.uid()
    AND ui2.institution_id = user_institutions.institution_id
    AND public.has_role(auth.uid(), 'school_admin')
  )
);