-- Single-tenant transition: company_id is no longer required for app writes.
-- Keep columns for backward compatibility, but remove hard requirements.

-- clients
ALTER TABLE IF EXISTS public.clients
  ALTER COLUMN company_id DROP NOT NULL;

-- client_groups
ALTER TABLE IF EXISTS public.client_groups
  ALTER COLUMN company_id DROP NOT NULL;

-- client_file_notes
ALTER TABLE IF EXISTS public.client_file_notes
  ALTER COLUMN company_id DROP NOT NULL;

-- membership_contracts
ALTER TABLE IF EXISTS public.membership_contracts
  ALTER COLUMN company_id DROP NOT NULL;

-- client_logos
ALTER TABLE IF EXISTS public.client_logos
  ALTER COLUMN company_id DROP NOT NULL;

-- subusers
ALTER TABLE IF EXISTS public.subusers
  ALTER COLUMN company_id DROP NOT NULL;

