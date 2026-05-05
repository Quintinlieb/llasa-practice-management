-- Ensure clients has a display column for selected group name.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS group_name TEXT;

-- Backfill group_name from client_groups when group_id is set.
UPDATE public.clients c
SET group_name = cg.group_name
FROM public.client_groups cg
WHERE c.group_id IS NOT NULL
  AND c.group_id = cg.id
  AND (c.group_name IS NULL OR btrim(c.group_name) = '');

-- Helpful index for filtering/searching by group name.
CREATE INDEX IF NOT EXISTS clients_group_name_idx
  ON public.clients (group_name);
