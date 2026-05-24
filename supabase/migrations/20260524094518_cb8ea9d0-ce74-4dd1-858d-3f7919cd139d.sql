
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS subtotal_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scholarship_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bursary_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate_bps integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_label text,
  ADD COLUMN IF NOT EXISTS scholarship_label text,
  ADD COLUMN IF NOT EXISTS bursary_label text;

-- Backfill subtotal so existing invoices look consistent (subtotal = total when no adjustments)
UPDATE public.invoices
SET subtotal_cents = total_cents
WHERE subtotal_cents = 0 AND total_cents > 0;
