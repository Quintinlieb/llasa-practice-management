ALTER TABLE IF EXISTS public.clients
ADD COLUMN IF NOT EXISTS logo_storage_path text;

UPDATE public.clients AS c
SET logo_storage_path = src.storage_path
FROM (
  SELECT DISTINCT ON (client_id)
    client_id,
    COALESCE(
      NULLIF(btrim(storage_path), ''),
      NULLIF(btrim(logo_path), ''),
      NULLIF(
        regexp_replace(
          COALESCE(logo_url, company_logo_url, ''),
          '^https?://[^/]+/storage/v1/object/public/client-logos/',
          ''
        ),
        ''
      )
    ) AS storage_path
  FROM public.client_logos
  ORDER BY client_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
) AS src
WHERE c.id = src.client_id
  AND COALESCE(NULLIF(btrim(c.logo_storage_path), ''), '') = ''
  AND COALESCE(NULLIF(btrim(src.storage_path), ''), '') <> '';
