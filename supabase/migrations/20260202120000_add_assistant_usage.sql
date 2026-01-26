-- Track daily assistant usage limits per company.

CREATE TABLE IF NOT EXISTS public.assistant_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  request_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, usage_date)
);

ALTER TABLE public.assistant_usage ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own assistant usage"
    ON public.assistant_usage
    FOR SELECT
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own assistant usage"
    ON public.assistant_usage
    FOR INSERT
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can update own assistant usage"
    ON public.assistant_usage
    FOR UPDATE
    USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_assistant_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.assistant_usage (company_id, usage_date, request_count)
  VALUES (auth.uid(), CURRENT_DATE, 1)
  ON CONFLICT (company_id, usage_date)
  DO UPDATE
    SET request_count = public.assistant_usage.request_count + 1,
        updated_at = NOW()
  RETURNING request_count INTO current_count;

  RETURN current_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_assistant_usage() TO authenticated;
