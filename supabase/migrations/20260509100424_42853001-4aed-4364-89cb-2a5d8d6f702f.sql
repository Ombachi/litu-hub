REVOKE EXECUTE ON FUNCTION public.gdpr_export_user_data() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.gdpr_delete_user_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gdpr_export_user_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gdpr_delete_user_account() TO authenticated;
