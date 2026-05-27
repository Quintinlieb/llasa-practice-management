DROP INDEX IF EXISTS public.llasa_memberships_organisation_idx;

ALTER TABLE IF EXISTS public.llasa_memberships
  DROP CONSTRAINT IF EXISTS llasa_memberships_organisation_check,
  DROP COLUMN IF EXISTS organisation;
