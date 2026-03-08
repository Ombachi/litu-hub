CREATE OR REPLACE FUNCTION public.enforce_quiz_time_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  quiz_time_limit INTEGER;
  attempt_start TIMESTAMPTZ;
  elapsed_minutes DOUBLE PRECISION;
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
    SELECT time_limit INTO quiz_time_limit FROM public.quizzes WHERE id = NEW.quiz_id;
    attempt_start := OLD.started_at;
    elapsed_minutes := EXTRACT(EPOCH FROM (now() - attempt_start)) / 60.0;
    
    IF elapsed_minutes > (quiz_time_limit + 1) THEN
      NEW.score := 0;
      INSERT INTO public.notifications (user_id, title, message, type, link)
      VALUES (
        NEW.student_id,
        'Quiz Time Exceeded',
        'Your quiz submission exceeded the time limit and has been flagged. Score set to 0.',
        'warning',
        '/grades'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_quiz_time
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quiz_time_limit();

CREATE OR REPLACE FUNCTION public.expire_stale_quiz_attempts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.quiz_attempts qa
  SET status = 'completed', completed_at = now(), score = 0
  FROM public.quizzes q
  WHERE qa.quiz_id = q.id
    AND qa.status = 'in_progress'
    AND EXTRACT(EPOCH FROM (now() - qa.started_at)) / 60.0 > (q.time_limit + 2);
END;
$$;

INSERT INTO storage.buckets (id, name, public) VALUES ('institution-logos', 'institution-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Platform admins upload logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'institution-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)
  )
);

CREATE POLICY "Platform admins delete logos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'institution-logos'
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'platform_admin'::public.app_role)
  )
);

CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'institution-logos');