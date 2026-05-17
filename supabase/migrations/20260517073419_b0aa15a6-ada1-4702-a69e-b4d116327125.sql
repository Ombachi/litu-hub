
-- Helper: notify a single user
CREATE OR REPLACE FUNCTION public.notify_user(_user_id uuid, _title text, _message text, _type text, _link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, link, read)
  VALUES (_user_id, _title, _message, _type, _link, false);
END;
$$;

-- Notify student + linked parents
CREATE OR REPLACE FUNCTION public.notify_student_and_parents(_student_id uuid, _title text, _message text, _type text, _link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parent uuid;
BEGIN
  PERFORM public.notify_user(_student_id, _title, _message, _type, _link);
  FOR _parent IN
    SELECT parent_id FROM public.parent_student_links
    WHERE student_id = _student_id AND status = 'approved'
  LOOP
    PERFORM public.notify_user(_parent, _title, _message, _type, _link);
  END LOOP;
END;
$$;

-- Trigger: invoice status changes
CREATE OR REPLACE FUNCTION public.on_invoice_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _title text;
  _msg text;
  _type text := 'info';
BEGIN
  IF TG_OP = 'INSERT' THEN
    _title := 'New invoice issued';
    _msg := 'Invoice ' || NEW.reference || ' for KES ' || to_char(NEW.total_cents/100.0, 'FM999,999,990.00') || ' has been issued.';
    PERFORM public.notify_student_and_parents(NEW.student_id, _title, _msg, 'info', '/fees');
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status::text
      WHEN 'paid'      THEN _title := 'Invoice paid'; _msg := 'Invoice ' || NEW.reference || ' has been fully paid. Thank you!'; _type := 'success';
      WHEN 'partial'   THEN _title := 'Partial payment received'; _msg := 'Invoice ' || NEW.reference || ' has a partial balance remaining.'; _type := 'info';
      WHEN 'grace'     THEN _title := 'Invoice past due'; _msg := 'Invoice ' || NEW.reference || ' is past due. You are within the grace period.'; _type := 'warning';
      WHEN 'overdue'   THEN _title := 'Invoice overdue'; _msg := 'Invoice ' || NEW.reference || ' is overdue. Some features may be restricted until it is paid.'; _type := 'error';
      WHEN 'cancelled' THEN _title := 'Invoice cancelled'; _msg := 'Invoice ' || NEW.reference || ' was cancelled.'; _type := 'info';
      ELSE                  _title := 'Invoice updated'; _msg := 'Invoice ' || NEW.reference || ' status changed to ' || NEW.status::text || '.';
    END CASE;
    PERFORM public.notify_student_and_parents(NEW.student_id, _title, _msg, _type, '/fees');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_status_change ON public.invoices;
CREATE TRIGGER trg_invoice_status_change
AFTER INSERT OR UPDATE OF status ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.on_invoice_status_change();

-- Trigger: payment status change (succeeded/failed)
CREATE OR REPLACE FUNCTION public.on_payment_status_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student uuid;
  _ref text;
  _title text;
  _msg text;
  _type text;
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status) THEN
    RETURN NEW;
  END IF;
  IF NEW.status::text NOT IN ('succeeded', 'failed') THEN
    RETURN NEW;
  END IF;

  SELECT student_id, reference INTO _student, _ref FROM public.invoices WHERE id = NEW.invoice_id;
  IF _student IS NULL THEN RETURN NEW; END IF;

  IF NEW.status::text = 'succeeded' THEN
    _title := 'Payment received';
    _msg := 'Payment of KES ' || to_char(NEW.amount_cents/100.0, 'FM999,999,990.00') || ' for invoice ' || COALESCE(_ref, '') || ' was successful.';
    _type := 'success';
  ELSE
    _title := 'Payment failed';
    _msg := 'A payment attempt for invoice ' || COALESCE(_ref, '') || ' failed. Please try again.';
    _type := 'error';
  END IF;

  PERFORM public.notify_student_and_parents(_student, _title, _msg, _type, '/fees');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_status_notify ON public.payments;
CREATE TRIGGER trg_payment_status_notify
AFTER INSERT OR UPDATE OF status ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.on_payment_status_notify();
