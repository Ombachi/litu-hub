
-- ============================================================
-- 1. Composite indexes for hot read paths
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_submitted
  ON public.assignment_submissions (student_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_status
  ON public.assignment_submissions (assignment_id, status);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_started
  ON public.quiz_attempts (student_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_status
  ON public.quiz_attempts (quiz_id, status);

-- ============================================================
-- 2. Batch notifications RPC (single INSERT … SELECT)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_bulk_notifications(
  _user_ids uuid[],
  _title text,
  _message text,
  _type text DEFAULT 'info',
  _link text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inserted integer;
BEGIN
  -- Only admins, school admins, tutors, or TAs can fan-out notifications
  IF NOT (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'school_admin'::app_role)
    OR public.has_role(auth.uid(), 'tutor'::app_role)
    OR public.has_role(auth.uid(), 'ta'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorised to send bulk notifications';
  END IF;

  IF _link IS NOT NULL AND _link !~ '^/[A-Za-z0-9_?=&%.\-][A-Za-z0-9/_?=&%.\-]*$' THEN
    RAISE EXCEPTION 'Invalid link path';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  SELECT u, _title, _message, _type, _link
  FROM unnest(_user_ids) AS u
  WHERE u IS NOT NULL;

  GET DIAGNOSTICS _inserted = ROW_COUNT;
  RETURN _inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_bulk_notifications(uuid[], text, text, text, text) TO authenticated;

-- ============================================================
-- 3. AI question cache
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_question_cache (
  cache_key text PRIMARY KEY,
  course_id uuid,
  topic text NOT NULL,
  difficulty text NOT NULL,
  assessment_category text NOT NULL DEFAULT 'General',
  question_count integer NOT NULL DEFAULT 3,
  payload jsonb NOT NULL,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_question_cache TO authenticated;
GRANT ALL ON public.ai_question_cache TO service_role;

ALTER TABLE public.ai_question_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ai cache"
  ON public.ai_question_cache FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_ai_cache_last_used
  ON public.ai_question_cache (last_used_at DESC);

-- ============================================================
-- 4. Async receipt job queue
-- ============================================================
CREATE TABLE IF NOT EXISTS public.receipt_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending | processing | completed | failed
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

GRANT SELECT ON public.receipt_jobs TO authenticated;
GRANT ALL ON public.receipt_jobs TO service_role;

ALTER TABLE public.receipt_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view receipt jobs"
  ON public.receipt_jobs FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'school_admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_receipt_jobs_pending
  ON public.receipt_jobs (status, scheduled_for) WHERE status IN ('pending','processing');

-- Auto-enqueue when a payment succeeds
CREATE OR REPLACE FUNCTION public.enqueue_receipt_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'succeeded' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'succeeded') THEN
    INSERT INTO public.receipt_jobs (payment_id) VALUES (NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_enqueue_receipt ON public.payments;
CREATE TRIGGER trg_payments_enqueue_receipt
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_receipt_job();

-- ============================================================
-- 5. SaaS subscription system (per-school)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  price_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  billing_period text NOT NULL DEFAULT 'monthly',  -- monthly | yearly
  max_students integer,                            -- NULL = unlimited
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active plans"
  ON public.subscription_plans FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'platform_admin'::app_role));

CREATE POLICY "Platform admins manage plans"
  ON public.subscription_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role) OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role) OR public.is_admin(auth.uid()));

-- Institution subscriptions
CREATE TABLE IF NOT EXISTS public.institution_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL UNIQUE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'trial',  -- trial | active | past_due | canceled | expired
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.institution_subscriptions TO authenticated;
GRANT ALL ON public.institution_subscriptions TO service_role;

ALTER TABLE public.institution_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own institution subscription"
  ON public.institution_subscriptions FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
    OR institution_id = public.get_user_institution_id(auth.uid())
  );

CREATE POLICY "Platform admins manage subscriptions"
  ON public.institution_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'platform_admin'::app_role) OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'platform_admin'::app_role) OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_inst_subs_status ON public.institution_subscriptions (status, current_period_end);

-- Subscription payments (separate from per-student fee payments)
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid REFERENCES public.institution_subscriptions(id) ON DELETE CASCADE,
  institution_id uuid NOT NULL,
  plan_id uuid REFERENCES public.subscription_plans(id),
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'KES',
  provider text NOT NULL,                  -- mpesa | flutterwave | paystack | bank
  provider_reference text,
  status text NOT NULL DEFAULT 'pending',  -- pending | succeeded | failed
  period_start timestamptz,
  period_end timestamptz,
  paid_at timestamptz,
  payer_id uuid,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.subscription_payments TO authenticated;
GRANT ALL ON public.subscription_payments TO service_role;

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own institution sub payments"
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR public.has_role(auth.uid(), 'platform_admin'::app_role)
    OR institution_id = public.get_user_institution_id(auth.uid())
  );

CREATE POLICY "School admin initiates sub payment"
  ON public.subscription_payments FOR INSERT TO authenticated
  WITH CHECK (
    payer_id = auth.uid()
    AND status = 'pending'
    AND (
      public.has_role(auth.uid(), 'platform_admin'::app_role)
      OR (public.has_role(auth.uid(), 'school_admin'::app_role)
          AND institution_id = public.get_user_institution_id(auth.uid()))
    )
  );

CREATE INDEX IF NOT EXISTS idx_sub_payments_inst_created
  ON public.subscription_payments (institution_id, created_at DESC);

-- Helper: has the institution got an active (paid or trialing) subscription?
CREATE OR REPLACE FUNCTION public.has_active_subscription(_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.institution_subscriptions s
    WHERE s.institution_id = _institution_id
      AND (
        (s.status = 'trial' AND s.trial_ends_at > now())
        OR (s.status = 'active' AND (s.current_period_end IS NULL OR s.current_period_end > now()))
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid) TO authenticated;

-- Seed three starter plans (idempotent via slug)
INSERT INTO public.subscription_plans (slug, name, description, price_cents, billing_period, max_students, features, sort_order)
VALUES
  ('starter-monthly',  'Starter',  'Up to 100 students, core LMS features',                        500000,  'monthly',  100,  '["Core LMS","Quizzes","Discussions","Email support"]'::jsonb, 1),
  ('growth-monthly',   'Growth',   'Up to 1,000 students, AI generation, analytics',              2500000, 'monthly',  1000, '["Everything in Starter","AI question generation","Advanced analytics","Parent portal"]'::jsonb, 2),
  ('enterprise-monthly','Enterprise','Unlimited students, custom branding, priority support',      9000000, 'monthly',  NULL, '["Everything in Growth","Unlimited students","Custom branding","SSO","Priority support"]'::jsonb, 3)
ON CONFLICT (slug) DO NOTHING;
