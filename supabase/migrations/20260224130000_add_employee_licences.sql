-- Add employee licences table for uploaded licence documents.

CREATE TABLE IF NOT EXISTS public.employee_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  licence_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE public.employee_licences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own employee licences"
    ON public.employee_licences
    FOR SELECT
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own employee licences"
    ON public.employee_licences
    FOR INSERT
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can update own employee licences"
    ON public.employee_licences
    FOR UPDATE
    USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own employee licences"
    ON public.employee_licences
    FOR DELETE
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER update_employee_licences_updated_at
    BEFORE UPDATE ON public.employee_licences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
