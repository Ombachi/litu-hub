-- 1. Reassign existing 'admin' users to 'platform_admin' (skip if they already have it)
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'platform_admin'::app_role
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
    WHERE ur2.user_id = ur.user_id AND ur2.role = 'platform_admin'
  );

-- 2. Remove the old 'admin' role rows
DELETE FROM public.user_roles WHERE role = 'admin';

-- 3. Tighten is_admin() to only match platform_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'platform_admin'
  )
$$;