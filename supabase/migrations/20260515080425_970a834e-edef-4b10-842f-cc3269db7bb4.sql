
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS receipt_number text UNIQUE;

INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Receipts naming convention: {invoice_id}/{payment_id}.pdf
DROP POLICY IF EXISTS "Receipts: payer or student or parent reads" ON storage.objects;
CREATE POLICY "Receipts: payer or student or parent reads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipts' AND EXISTS (
    SELECT 1 FROM public.payments p
    JOIN public.invoices i ON i.id = p.invoice_id
    WHERE (storage.foldername(name))[1] = p.invoice_id::text
      AND (
        p.payer_id = auth.uid()
        OR i.student_id = auth.uid()
        OR public.is_parent_of(i.student_id, auth.uid())
        OR public.is_admin(auth.uid())
        OR public.is_school_admin_of(i.institution_id, auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Receipts: admins write" ON storage.objects;
CREATE POLICY "Receipts: admins write"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'receipts' AND public.is_admin(auth.uid()));

-- Recompute statuses across an institution (idempotent)
CREATE OR REPLACE FUNCTION public.recompute_fee_status_for_institution(_institution_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
  inv record;
  new_status invoice_status;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_school_admin_of(_institution_id, auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  FOR inv IN
    SELECT id, total_cents, paid_cents, due_date, status
    FROM public.invoices
    WHERE institution_id = _institution_id
      AND status NOT IN ('cancelled')
  LOOP
    new_status := CASE
      WHEN inv.paid_cents >= inv.total_cents THEN 'paid'::invoice_status
      WHEN inv.due_date IS NULL THEN inv.status
      WHEN inv.due_date < (current_date - INTERVAL '14 days') THEN 'overdue'::invoice_status
      WHEN inv.due_date < current_date THEN 'partial'::invoice_status  -- in grace
      WHEN inv.paid_cents > 0 THEN 'partial'::invoice_status
      ELSE 'issued'::invoice_status
    END;
    IF new_status <> inv.status THEN
      UPDATE public.invoices SET status = new_status, updated_at = now() WHERE id = inv.id;
      updated_count := updated_count + 1;
    END IF;
  END LOOP;

  RETURN updated_count;
END;
$$;
