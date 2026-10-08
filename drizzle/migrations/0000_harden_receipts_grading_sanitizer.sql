-- lovable-cron-fallback-reviewed: re-creating the existing user-requested every-minute receipt worker with an auth token; cadence unchanged
CREATE TABLE IF NOT EXISTS public.internal_tokens (
  name text PRIMARY KEY,
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.internal_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.internal_tokens TO service_role;
ALTER TABLE public.internal_tokens ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_tokens(name, token)
VALUES ('receipt_cron_token', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.verify_cron_token(_token text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.internal_tokens WHERE name = 'receipt_cron_token' AND token = _token)
$$;
REVOKE ALL ON FUNCTION public.verify_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text) TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('process-receipt-jobs-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'process-receipt-jobs-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://kysumebakyvzsbuszsja.supabase.co/functions/v1/process-receipt-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5c3VtZWJha3l2enNidXN6c2phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNzExNzksImV4cCI6MjA4Nzg0NzE3OX0.9nfTnXQ3rigw4QwqpRn68pxJb-2A7_8MkHzJkXAmHwI',
      'x-cron-token', (SELECT token FROM public.internal_tokens WHERE name = 'receipt_cron_token')
    ),
    body := jsonb_build_object('time', now())
  );
  $cron$
);

CREATE OR REPLACE FUNCTION public.tg_protect_submission_grading()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _course uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  SELECT course_id INTO _course FROM public.assignments WHERE id = NEW.assignment_id;
  IF public.can_manage_course(_course, auth.uid()) OR public.is_tutor_or_ta(_course, auth.uid()) OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.score := NULL; NEW.feedback := NULL;
    IF NEW.status = 'graded' THEN NEW.status := 'submitted'; END IF;
  ELSE
    NEW.score := OLD.score; NEW.feedback := OLD.feedback;
    IF NEW.status = 'graded' AND OLD.status IS DISTINCT FROM 'graded' THEN NEW.status := OLD.status; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_submission_grading ON public.assignment_submissions;
CREATE TRIGGER protect_submission_grading BEFORE INSERT OR UPDATE ON public.assignment_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_submission_grading();

CREATE OR REPLACE FUNCTION public.tg_protect_quiz_attempt_score()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _course uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  SELECT course_id INTO _course FROM public.quizzes WHERE id = NEW.quiz_id;
  IF public.can_manage_course(_course, auth.uid()) OR public.is_tutor_or_ta(_course, auth.uid()) OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.score := NULL;
  ELSE
    NEW.score := OLD.score;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_quiz_attempt_score ON public.quiz_attempts;
CREATE TRIGGER protect_quiz_attempt_score BEFORE INSERT OR UPDATE ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_quiz_attempt_score();

CREATE OR REPLACE FUNCTION public.sanitize_html(input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  out_text text;
BEGIN
  IF input IS NULL OR input = '' THEN
    RETURN input;
  END IF;
  out_text := input;
  out_text := regexp_replace(out_text, '<\s*(script|style|object|embed|link|meta|form|input|button|textarea|select|option|base|svg|math)\b[^>]*>.*?<\s*/\s*\1\s*>', '', 'gis');
  out_text := regexp_replace(out_text, '<\s*/?\s*(script|style|object|embed|link|meta|form|input|button|textarea|select|option|base|svg|math)\b[^>]*/?\s*>', '', 'gi');
  out_text := regexp_replace(out_text, '\s+on[a-z]+\s*=\s*"[^"]*"', '', 'gi');
  out_text := regexp_replace(out_text, '\s+on[a-z]+\s*=\s*''[^'']*''', '', 'gi');
  out_text := regexp_replace(out_text, '\s+on[a-z]+\s*=\s*[^\s>]+', '', 'gi');
  out_text := regexp_replace(out_text, '\s(href|src|xlink:href|action|formaction|background|poster)\s*=\s*"(?!\s*(https?://|mailto:|tel:|data:image/(png|jpe?g|gif|webp);|#|/|\./))[^"]*"', ' \1="#"', 'gi');
  out_text := regexp_replace(out_text, '\s(href|src|xlink:href|action|formaction|background|poster)\s*=\s*''(?!\s*(https?://|mailto:|tel:|data:image/(png|jpe?g|gif|webp);|#|/|\./))[^'']*''', ' \1="#"', 'gi');
  out_text := regexp_replace(out_text, '\s(href|src|xlink:href|action|formaction|background|poster)\s*=\s*(?!["''])[^\s>]*', ' \1="#"', 'gi');
  out_text := regexp_replace(out_text, '\s(href|src|xlink:href)\s*=\s*"[^"]*&[#a-z0-9]+;?[^"]*"', ' \1="#"', 'gi');
  out_text := regexp_replace(
    out_text,
    '<iframe\b(?![^>]*\bsrc\s*=\s*["''](https?:)?//(www\.)?(youtube(-nocookie)?\.com|youtu\.be)/)[^>]*>.*?</iframe>',
    '', 'gis'
  );
  out_text := regexp_replace(
    out_text,
    '<iframe\b(?![^>]*\bsrc\s*=\s*["''](https?:)?//(www\.)?(youtube(-nocookie)?\.com|youtu\.be)/)[^>]*/?>',
    '', 'gi'
  );
  out_text := regexp_replace(out_text, '\s+style\s*=\s*"[^"]*"', '', 'gi');
  out_text := regexp_replace(out_text, '\s+style\s*=\s*''[^'']*''', '', 'gi');
  out_text := regexp_replace(out_text, '<!--.*?-->', '', 'gs');
  RETURN out_text;
END;
$function$;