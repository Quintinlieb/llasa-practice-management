-- Align the database schema with the current application requirements.

-- Allow storing employees without ID numbers (UI treats it as optional).
ALTER TABLE public.employees
  ALTER COLUMN id_number DROP NOT NULL;

-- Add the extended profile fields used throughout the app if they don't exist yet.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS contract_type TEXT,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS race TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS employee_number TEXT,
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS physical_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS physical_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS area_code TEXT,
  ADD COLUMN IF NOT EXISTS cell_number TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT;

-- Ensure profiles contain the VAT number field used in Settings.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vat_number TEXT;

-- Create storage for per-company code of conduct templates.
CREATE TABLE IF NOT EXISTS public.company_code_of_conduct (
  company_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.company_code_of_conduct ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own code of conduct"
    ON public.company_code_of_conduct
    FOR SELECT
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own code of conduct"
    ON public.company_code_of_conduct
    FOR INSERT
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can update own code of conduct"
    ON public.company_code_of_conduct
    FOR UPDATE
    USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER update_company_code_of_conduct_updated_at
    BEFORE UPDATE ON public.company_code_of_conduct
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;
