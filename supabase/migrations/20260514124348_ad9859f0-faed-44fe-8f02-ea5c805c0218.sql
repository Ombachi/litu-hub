
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('draft','issued','partial','paid','overdue','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_provider AS ENUM ('mpesa','flutterwave','paystack','bank_transfer','cash','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending','succeeded','failed','refunded','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.fee_status AS ENUM ('none','paid','partial','grace','overdue','blocked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABLES ============
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  term_id uuid,
  course_id uuid,
  name text NOT NULL,
  description text DEFAULT '',
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'KES',
  due_date date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL,
  student_id uuid NOT NULL,
  fee_structure_id uuid REFERENCES public.fee_structures(id) ON DELETE SET NULL,
  term_id uuid,
  reference text NOT NULL UNIQUE,
  description text DEFAULT '',
  total_cents bigint NOT NULL CHECK (total_cents >= 0),
  paid_cents bigint NOT NULL DEFAULT 0 CHECK (paid_cents >= 0),
  currency text NOT NULL DEFAULT 'KES',
  due_date date,
  status invoice_status NOT NULL DEFAULT 'issued',
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  sequence int NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  paid_cents bigint NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(invoice_id, sequence)
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payer_id uuid,
  provider payment_provider NOT NULL,
  provider_reference text,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'KES',
  status payment_status NOT NULL DEFAULT 'pending',
  raw_payload jsonb DEFAULT '{}'::jsonb,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_status ON public.payments(invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_provider_ref ON public.payments(provider, provider_reference);

CREATE TABLE IF NOT EXISTS public.student_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE,
  blocked boolean NOT NULL DEFAULT false,
  grace_until date,
  reason text,
  set_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_student_status ON public.invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_institution ON public.invoices(institution_id);
CREATE INDEX IF NOT EXISTS idx_fee_structures_institution ON public.fee_structures(institution_id);
CREATE INDEX IF NOT EXISTS idx_installments_invoice ON public.invoice_installments(invoice_id);

-- ============ TRIGGERS for updated_at ============
DROP TRIGGER IF EXISTS trg_fee_structures_updated ON public.fee_structures;
CREATE TRIGGER trg_fee_structures_updated BEFORE UPDATE ON public.fee_structures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_invoices_updated ON public.invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
DROP TRIGGER IF EXISTS trg_payments_updated ON public.payments;
CREATE TRIGGER trg_payments_updated BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ ENABLE RLS ============
ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_overrides ENABLE ROW LEVEL SECURITY;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.is_school_admin_of(_institution_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'school_admin')
     AND public.get_user_institution_id(_user_id) = _institution_id
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of(_student_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_student_links
    WHERE parent_id = _user_id AND student_id = _student_id AND status = 'approved'
  )
$$;

-- ============ RLS POLICIES ============
-- fee_structures
DROP POLICY IF EXISTS fs_admin_manage ON public.fee_structures;
CREATE POLICY fs_admin_manage ON public.fee_structures FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_school_admin_of(institution_id, auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_school_admin_of(institution_id, auth.uid()));

DROP POLICY IF EXISTS fs_member_view ON public.fee_structures;
CREATE POLICY fs_member_view ON public.fee_structures FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_institutions ui WHERE ui.user_id = auth.uid() AND ui.institution_id = fee_structures.institution_id)
  );

-- invoices
DROP POLICY IF EXISTS inv_admin_manage ON public.invoices;
CREATE POLICY inv_admin_manage ON public.invoices FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_school_admin_of(institution_id, auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_school_admin_of(institution_id, auth.uid()));

DROP POLICY IF EXISTS inv_student_view ON public.invoices;
CREATE POLICY inv_student_view ON public.invoices FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_parent_of(student_id, auth.uid()));

-- installments
DROP POLICY IF EXISTS ins_admin_manage ON public.invoice_installments;
CREATE POLICY ins_admin_manage ON public.invoice_installments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_installments.invoice_id
                 AND (public.is_admin(auth.uid()) OR public.is_school_admin_of(i.institution_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_installments.invoice_id
                 AND (public.is_admin(auth.uid()) OR public.is_school_admin_of(i.institution_id, auth.uid()))));

DROP POLICY IF EXISTS ins_student_view ON public.invoice_installments;
CREATE POLICY ins_student_view ON public.invoice_installments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_installments.invoice_id
                 AND (i.student_id = auth.uid() OR public.is_parent_of(i.student_id, auth.uid()))));

-- payments
DROP POLICY IF EXISTS pay_admin_manage ON public.payments;
CREATE POLICY pay_admin_manage ON public.payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payments.invoice_id
                 AND (public.is_admin(auth.uid()) OR public.is_school_admin_of(i.institution_id, auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payments.invoice_id
                 AND (public.is_admin(auth.uid()) OR public.is_school_admin_of(i.institution_id, auth.uid()))));

DROP POLICY IF EXISTS pay_payer_insert ON public.payments;
CREATE POLICY pay_payer_insert ON public.payments FOR INSERT TO authenticated
  WITH CHECK (
    payer_id = auth.uid()
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payments.invoice_id
                AND (i.student_id = auth.uid() OR public.is_parent_of(i.student_id, auth.uid())))
  );

DROP POLICY IF EXISTS pay_view ON public.payments;
CREATE POLICY pay_view ON public.payments FOR SELECT TO authenticated
  USING (
    payer_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = payments.invoice_id
               AND (i.student_id = auth.uid() OR public.is_parent_of(i.student_id, auth.uid())
                    OR public.is_admin(auth.uid()) OR public.is_school_admin_of(i.institution_id, auth.uid())))
  );

-- overrides
DROP POLICY IF EXISTS sfo_admin_manage ON public.student_fee_overrides;
CREATE POLICY sfo_admin_manage ON public.student_fee_overrides FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())
         OR (public.has_role(auth.uid(), 'school_admin')
             AND EXISTS (SELECT 1 FROM public.user_institutions ui
                         WHERE ui.user_id = student_fee_overrides.student_id
                           AND ui.institution_id = public.get_user_institution_id(auth.uid()))))
  WITH CHECK (public.is_admin(auth.uid())
         OR (public.has_role(auth.uid(), 'school_admin')
             AND EXISTS (SELECT 1 FROM public.user_institutions ui
                         WHERE ui.user_id = student_fee_overrides.student_id
                           AND ui.institution_id = public.get_user_institution_id(auth.uid()))));

DROP POLICY IF EXISTS sfo_student_view ON public.student_fee_overrides;
CREATE POLICY sfo_student_view ON public.student_fee_overrides FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_parent_of(student_id, auth.uid()));

-- ============ STATUS FUNCTION ============
CREATE OR REPLACE FUNCTION public.get_fee_status(_student_id uuid)
RETURNS public.fee_status LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total bigint := 0;
  v_paid bigint := 0;
  v_oldest_due date;
  v_days_overdue int := 0;
  v_override record;
  v_inst_overdue boolean := false;
BEGIN
  SELECT * INTO v_override FROM public.student_fee_overrides WHERE student_id = _student_id;
  IF v_override.blocked IS TRUE THEN
    RETURN 'blocked';
  END IF;

  -- Sum non-cancelled invoices
  SELECT COALESCE(SUM(total_cents),0), COALESCE(SUM(paid_cents),0)
    INTO v_total, v_paid
  FROM public.invoices
  WHERE student_id = _student_id AND status <> 'cancelled';

  IF v_total = 0 THEN RETURN 'none'; END IF;

  IF v_paid >= v_total THEN RETURN 'paid'; END IF;

  -- Earliest unpaid installment, otherwise earliest invoice due_date for unpaid invoices
  SELECT MIN(ii.due_date) INTO v_oldest_due
  FROM public.invoice_installments ii
  JOIN public.invoices i ON i.id = ii.invoice_id
  WHERE i.student_id = _student_id AND i.status <> 'cancelled' AND ii.paid_cents < ii.amount_cents;

  IF v_oldest_due IS NULL THEN
    SELECT MIN(due_date) INTO v_oldest_due
    FROM public.invoices
    WHERE student_id = _student_id AND status <> 'cancelled' AND paid_cents < total_cents;
  END IF;

  -- Any installment overdue means not on-track
  SELECT EXISTS (
    SELECT 1 FROM public.invoice_installments ii
    JOIN public.invoices i ON i.id = ii.invoice_id
    WHERE i.student_id = _student_id AND i.status <> 'cancelled'
      AND ii.paid_cents < ii.amount_cents AND ii.due_date < CURRENT_DATE
  ) INTO v_inst_overdue;

  IF v_oldest_due IS NULL OR v_oldest_due >= CURRENT_DATE THEN
    -- Future-due unpaid balance => partial (on-track if installments) or paid-pending
    RETURN 'partial';
  END IF;

  v_days_overdue := (CURRENT_DATE - v_oldest_due);

  -- Grace extension override
  IF v_override.grace_until IS NOT NULL AND v_override.grace_until >= CURRENT_DATE THEN
    RETURN 'grace';
  END IF;

  IF v_days_overdue < 14 THEN
    RETURN 'grace';
  END IF;

  RETURN 'overdue';
END;
$$;

-- ============ APPLY PAYMENT ============
CREATE OR REPLACE FUNCTION public.apply_payment_to_invoice(_payment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  p record;
  i record;
  remaining bigint;
  inst record;
  alloc bigint;
BEGIN
  SELECT * INTO p FROM public.payments WHERE id = _payment_id FOR UPDATE;
  IF p.id IS NULL OR p.status <> 'succeeded' THEN RETURN; END IF;

  SELECT * INTO i FROM public.invoices WHERE id = p.invoice_id FOR UPDATE;
  IF i.id IS NULL THEN RETURN; END IF;

  remaining := p.amount_cents;

  -- Allocate to oldest unpaid installments first
  FOR inst IN
    SELECT * FROM public.invoice_installments
    WHERE invoice_id = i.id AND paid_cents < amount_cents
    ORDER BY sequence ASC
  LOOP
    EXIT WHEN remaining <= 0;
    alloc := LEAST(remaining, inst.amount_cents - inst.paid_cents);
    UPDATE public.invoice_installments
       SET paid_cents = paid_cents + alloc,
           paid_at = CASE WHEN paid_cents + alloc >= amount_cents THEN now() ELSE paid_at END
     WHERE id = inst.id;
    remaining := remaining - alloc;
  END LOOP;

  UPDATE public.invoices
     SET paid_cents = LEAST(total_cents, paid_cents + p.amount_cents),
         status = CASE
           WHEN paid_cents + p.amount_cents >= total_cents THEN 'paid'::invoice_status
           ELSE 'partial'::invoice_status
         END
   WHERE id = i.id;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (i.student_id,
          'Payment received',
          'KES ' || (p.amount_cents/100.0)::text || ' applied to invoice ' || i.reference || '.',
          'success', '/fees');
END;
$$;

-- Trigger: when a payment becomes succeeded, allocate it
CREATE OR REPLACE FUNCTION public.on_payment_succeeded()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'succeeded' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'succeeded') THEN
    PERFORM public.apply_payment_to_invoice(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_payment_succeeded ON public.payments;
CREATE TRIGGER trg_payment_succeeded AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.on_payment_succeeded();

-- Auto-flip overdue invoices nightly via a helper callable from edge cron later
CREATE OR REPLACE FUNCTION public.refresh_invoice_statuses()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.invoices
     SET status = 'overdue'
   WHERE status IN ('issued','partial')
     AND due_date IS NOT NULL
     AND due_date < CURRENT_DATE
     AND paid_cents < total_cents;
$$;

-- ============ GATE ENFORCEMENT (RLS) ============
-- Prevent self-enrollment when student is overdue or blocked.
DROP POLICY IF EXISTS "Students self-enroll" ON public.enrollments;
CREATE POLICY "Students self-enroll" ON public.enrollments FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.get_fee_status(auth.uid()) NOT IN ('overdue','blocked')
  );

-- Prevent enrollment requests when overdue/blocked
DROP POLICY IF EXISTS "Insert enrollment requests" ON public.enrollment_requests;
CREATE POLICY "Insert enrollment requests" ON public.enrollment_requests FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND lower(student_email) = lower(COALESCE((SELECT email FROM profiles WHERE user_id = auth.uid()),''))
    AND status = 'pending'
    AND public.get_fee_status(auth.uid()) NOT IN ('overdue','blocked')
  );
