-- Allow all authenticated users to view roles (needed for messaging role badges)
CREATE POLICY "All authenticated can view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

-- Drop the old restrictive select policy
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;