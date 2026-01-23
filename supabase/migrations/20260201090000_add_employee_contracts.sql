-- Add employee contracts table for uploaded employment contracts.

CREATE TABLE IF NOT EXISTS public.employee_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  contract_type TEXT NOT NULL,
  issue_date DATE NOT NULL,
  file_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "Users can view own employee contracts"
    ON public.employee_contracts
    FOR SELECT
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can insert own employee contracts"
    ON public.employee_contracts
    FOR INSERT
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can update own employee contracts"
    ON public.employee_contracts
    FOR UPDATE
    USING (auth.uid() = company_id)
    WITH CHECK (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE POLICY "Users can delete own employee contracts"
    ON public.employee_contracts
    FOR DELETE
    USING (auth.uid() = company_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

-- Keep only the most recent contract active per employee.
CREATE OR REPLACE FUNCTION public.deactivate_previous_employee_contracts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.employee_contracts
  SET is_active = FALSE
  WHERE employee_id = NEW.employee_id
    AND company_id = NEW.company_id
    AND id <> NEW.id
    AND is_active = TRUE;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER employee_contracts_deactivate_previous
    AFTER INSERT ON public.employee_contracts
    FOR EACH ROW
    EXECUTE FUNCTION public.deactivate_previous_employee_contracts();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

DO $$
BEGIN
  CREATE TRIGGER update_employee_contracts_updated_at
    BEFORE UPDATE ON public.employee_contracts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END;
$$;

