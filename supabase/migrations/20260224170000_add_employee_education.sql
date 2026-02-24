-- Add employee education table for uploaded qualification/training documents.

CREATE TABLE IF NOT EXISTS public.employee_education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  qualification_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_education_unique_type_per_employee UNIQUE (employee_id, category, qualification_type)
);

ALTER TABLE public.employee_education ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own employee education"
    ON public.employee_education
    FOR SELECT
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own employee education"
    ON public.employee_education
    FOR INSERT
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can update own employee education"
    ON public.employee_education
    FOR UPDATE
    USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own employee education"
    ON public.employee_education
    FOR DELETE
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER update_employee_education_updated_at
    BEFORE UPDATE ON public.employee_education
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
