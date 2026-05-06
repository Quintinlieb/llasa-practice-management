ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lr_billing_cycle text,
  ADD COLUMN IF NOT EXISTS ee_billing_cycle text,
  ADD COLUMN IF NOT EXISTS pr_billing_cycle text,
  ADD COLUMN IF NOT EXISTS hs_billing_cycle text;

UPDATE public.clients
SET
  lr_billing_cycle = COALESCE(NULLIF(lr_billing_cycle, ''), NULLIF(retainer_cycle, ''), NULLIF(membership_period, '')),
  ee_billing_cycle = COALESCE(NULLIF(ee_billing_cycle, ''), NULLIF(retainer_cycle, ''), NULLIF(membership_period, '')),
  pr_billing_cycle = COALESCE(NULLIF(pr_billing_cycle, ''), NULLIF(retainer_cycle, ''), NULLIF(membership_period, '')),
  hs_billing_cycle = COALESCE(NULLIF(hs_billing_cycle, ''), NULLIF(retainer_cycle, ''), NULLIF(membership_period, ''))
WHERE
  lr_billing_cycle IS NULL
  OR ee_billing_cycle IS NULL
  OR pr_billing_cycle IS NULL
  OR hs_billing_cycle IS NULL;
