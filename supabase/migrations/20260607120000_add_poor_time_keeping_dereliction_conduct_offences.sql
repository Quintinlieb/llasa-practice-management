-- Add the new misconduct types to existing company code-of-conduct JSON records.
-- This preserves each company's existing sections and only appends the offences
-- when an offence with the same name is not already present.

UPDATE public.company_code_of_conduct AS coc
SET
  data = jsonb_set(
    coc.data,
    '{sections}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN section_item.section ->> 'id' = 'minor' THEN
            jsonb_set(
              section_item.section,
              '{offences}',
              COALESCE(section_item.section -> 'offences', '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object(
                  'category', 'Minor',
                  'name', 'Poor Time Keeping',
                  'first', 'First Written Warning',
                  'second', 'Second Written Warning',
                  'third', 'Final Written Warning',
                  'fourth', 'Dismissal',
                  'isDefault', true
                )
              )
            )
          ELSE section_item.section
        END
        ORDER BY section_item.ordinality
      )
      FROM jsonb_array_elements(COALESCE(coc.data -> 'sections', '[]'::jsonb)) WITH ORDINALITY AS section_item(section, ordinality)
    )
  ),
  updated_at = NOW()
WHERE
  jsonb_typeof(coc.data -> 'sections') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coc.data -> 'sections') AS section_item(section)
    WHERE section_item.section ->> 'id' = 'minor'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coc.data -> 'sections') AS section_item(section)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(section_item.section -> 'offences', '[]'::jsonb)) AS offence_item(offence)
    WHERE lower(offence_item.offence ->> 'name') = lower('Poor Time Keeping')
  );

UPDATE public.company_code_of_conduct AS coc
SET
  data = jsonb_set(
    coc.data,
    '{sections}',
    (
      SELECT jsonb_agg(
        CASE
          WHEN section_item.section ->> 'id' = 'serious' THEN
            jsonb_set(
              section_item.section,
              '{offences}',
              COALESCE(section_item.section -> 'offences', '[]'::jsonb) || jsonb_build_array(
                jsonb_build_object(
                  'category', 'Serious',
                  'name', 'Dereliction of Duties',
                  'first', 'Final Written Warning',
                  'second', 'Dismissal',
                  'isDefault', true
                )
              )
            )
          ELSE section_item.section
        END
        ORDER BY section_item.ordinality
      )
      FROM jsonb_array_elements(COALESCE(coc.data -> 'sections', '[]'::jsonb)) WITH ORDINALITY AS section_item(section, ordinality)
    )
  ),
  updated_at = NOW()
WHERE
  jsonb_typeof(coc.data -> 'sections') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coc.data -> 'sections') AS section_item(section)
    WHERE section_item.section ->> 'id' = 'serious'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(coc.data -> 'sections') AS section_item(section)
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(section_item.section -> 'offences', '[]'::jsonb)) AS offence_item(offence)
    WHERE lower(offence_item.offence ->> 'name') = lower('Dereliction of Duties')
  );
