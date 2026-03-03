
-- Step 1: Just expand the enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'platform_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'school_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ta';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'parent';
