
-- 1. Email/SMS delivery audit log for fee receipts
CREATE TABLE IF NOT EXISTS public.email_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid REFERENCES public.payments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  recipient_user_id uuid,
  recipient_address text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending','succeeded','failed','dlq')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  next_retry_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_edl_retry ON public.email_delivery_log(status, next_retry_at) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_edl_payment ON public.email_delivery_log(payment_id);

ALTER TABLE public.email_delivery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edl_admin_read" ON public.email_delivery_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'school_admin'));

-- 2. Webhook idempotency
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_id text NOT NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  payload jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "we_admin_read" ON public.webhook_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Atomic claim for receipt generation — returns true only for the first caller
CREATE OR REPLACE FUNCTION public.claim_payment_for_receipt(_payment_id uuid, _claim_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE updated int;
BEGIN
  UPDATE public.payments
     SET notes = COALESCE(notes,'') || E'\n[receipt-claim:' || _claim_token || '@' || now()::text || ']'
   WHERE id = _payment_id
     AND status = 'succeeded'
     AND receipt_url IS NULL
     AND (notes IS NULL OR notes !~ '\[receipt-claim:[^@]+@[^]]+\]'
          OR notes ~ ('\[receipt-claim:[^@]+@[0-9-]+ [0-9:.+]+\]')
          AND substring(notes from '\[receipt-claim:[^@]+@([^]]+)\]')::timestamptz < now() - interval '2 minutes');
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$;

-- 4. Harden SECURITY DEFINER funcs — revoke from public/authenticated, grant only service_role
REVOKE EXECUTE ON FUNCTION public.apply_payment_to_invoice(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_fee_status_for_institution(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_payment_for_receipt(uuid, text) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_payment_for_receipt(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_payment_to_invoice(uuid) TO service_role;
-- recompute is still callable by admins via RPC (auth.uid checked inside); allow authenticated to call it (it self-authorizes)
GRANT EXECUTE ON FUNCTION public.recompute_fee_status_for_institution(uuid) TO authenticated, service_role;

-- Trigger functions are invoked by the engine, not direct callers — revoke direct execute
REVOKE EXECUTE ON FUNCTION public.on_invoice_status_change() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.on_payment_status_notify() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.on_payment_succeeded() FROM PUBLIC, authenticated, anon;
