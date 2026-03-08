-- Drop the recursive policies
DROP POLICY IF EXISTS "School admins manage own institution links" ON public.user_institutions;
DROP POLICY IF EXISTS "School admins view institution members" ON public.user_institutions;

-- Create a SECURITY DEFINER function to get user's institution without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_institution_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM user_institutions WHERE user_id = _user_id LIMIT 1;
$$;

-- Non-recursive policy: school admins can view members of their institution
CREATE POLICY "School admins view institution members"
ON public.user_institutions
FOR SELECT
TO authenticated
USING (
  institution_id = public.get_user_institution_id(auth.uid())
  AND public.has_role(auth.uid(), 'school_admin')
);

-- Non-recursive policy: school admins can add/remove members in their institution
CREATE POLICY "School admins manage own institution links"
ON public.user_institutions
FOR ALL
TO authenticated
USING (
  institution_id = public.get_user_institution_id(auth.uid())
  AND public.has_role(auth.uid(), 'school_admin')
)
WITH CHECK (
  institution_id = public.get_user_institution_id(auth.uid())
  AND public.has_role(auth.uid(), 'school_admin')
);