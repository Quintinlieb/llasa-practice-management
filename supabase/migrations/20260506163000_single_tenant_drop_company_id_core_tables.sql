-- Single-tenant finalization (core client flows):
-- Drop company_id from core tables now that frontend no longer depends on it.
-- NOTE: subusers is intentionally excluded in this migration because current
-- invite/create-subuser edge functions and unique constraints still reference it.

ALTER TABLE IF EXISTS public.clients
  DROP COLUMN IF EXISTS company_id;

ALTER TABLE IF EXISTS public.client_groups
  DROP COLUMN IF EXISTS company_id;

ALTER TABLE IF EXISTS public.client_file_notes
  DROP COLUMN IF EXISTS company_id;

ALTER TABLE IF EXISTS public.membership_contracts
  DROP COLUMN IF EXISTS company_id;

ALTER TABLE IF EXISTS public.client_logos
  DROP COLUMN IF EXISTS company_id;

