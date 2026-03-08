
-- 1. Institutions table
CREATE TABLE public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view institutions" ON public.institutions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Platform admins manage institutions" ON public.institutions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin') OR public.has_role(auth.uid(), 'admin'));

-- 2. User-institution linking table
CREATE TABLE public.user_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, institution_id)
);

ALTER TABLE public.user_institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own institution links" ON public.user_institutions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage institution links" ON public.user_institutions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 3. Add institution_id to courses (nullable for backward compat)
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id);

-- 4. Security definer helper: check if user belongs to same institution as course
CREATE OR REPLACE FUNCTION public.school_admin_can_access_course(_course_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.courses c
    JOIN public.user_institutions ui ON ui.institution_id = c.institution_id
    WHERE c.id = _course_id AND ui.user_id = _user_id
  )
$$;

-- 5. Update can_manage_course to scope school_admin by institution
CREATE OR REPLACE FUNCTION public.can_manage_course(_course_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR public.is_course_tutor(_course_id, _user_id)
    OR (public.has_role(_user_id, 'school_admin') AND public.school_admin_can_access_course(_course_id, _user_id))
$$;

-- 6. Update can_access_course to scope school_admin by institution
CREATE OR REPLACE FUNCTION public.can_access_course(_course_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR (public.has_role(_user_id, 'school_admin') AND public.school_admin_can_access_course(_course_id, _user_id))
    OR public.is_course_tutor(_course_id, _user_id)
    OR public.has_role(_user_id, 'ta')
    OR public.is_enrolled(_course_id, _user_id)
$$;
