-- Add missing client_number column used by Clients UI
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS client_number text;

-- Backfill from existing membership_period when present
UPDATE public.clients
SET client_number = NULLIF(TRIM(membership_period), '')
WHERE client_number IS NULL
  AND membership_period IS NOT NULL
  AND NULLIF(TRIM(membership_period), '') IS NOT NULL;

-- Prevent duplicates (case-insensitive, ignores null/blank)
CREATE UNIQUE INDEX IF NOT EXISTS clients_client_number_unique_idx
ON public.clients (LOWER(TRIM(client_number)))
WHERE client_number IS NOT NULL
  AND NULLIF(TRIM(client_number), '') IS NOT NULL;
