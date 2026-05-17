
REVOKE EXECUTE ON FUNCTION public.notify_user(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_student_and_parents(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_invoice_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_payment_status_notify() FROM PUBLIC, anon, authenticated;
