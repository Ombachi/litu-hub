-- Assign platform_admin to gmail account
DELETE FROM public.user_roles WHERE user_id = '016543f0-d13d-4396-8259-648f80642456';
INSERT INTO public.user_roles (user_id, role) VALUES ('016543f0-d13d-4396-8259-648f80642456', 'platform_admin');

-- Assign school_admin to outlook account
DELETE FROM public.user_roles WHERE user_id = 'c1b32975-4d8b-4b20-b144-a3ad52ec8c37';
INSERT INTO public.user_roles (user_id, role) VALUES ('c1b32975-4d8b-4b20-b144-a3ad52ec8c37', 'school_admin');

-- Auto-confirm the outlook account email
UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'c1b32975-4d8b-4b20-b144-a3ad52ec8c37' AND email_confirmed_at IS NULL;