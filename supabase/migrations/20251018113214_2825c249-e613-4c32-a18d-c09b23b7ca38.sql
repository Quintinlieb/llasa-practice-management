-- Create profiles table for company information
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  vat_number TEXT,
  physical_address TEXT NOT NULL,
  postal_address TEXT NOT NULL,
  representative_name TEXT NOT NULL,
  representative_surname TEXT NOT NULL,
  company_contact TEXT NOT NULL,
  company_email TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_surname TEXT NOT NULL,
  user_contact TEXT NOT NULL,
  user_email TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create employees table
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_surname TEXT NOT NULL,
  id_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create warning types enum
CREATE TYPE warning_type AS ENUM ('first', 'second', 'serious', 'final');

-- Create documents table for storing warnings
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  document_type TEXT DEFAULT 'written_warning',
  trading_name TEXT,
  employee_name TEXT NOT NULL,
  employee_surname TEXT NOT NULL,
  employee_id_number TEXT NOT NULL,
  warning_type warning_type NOT NULL,
  validity_months INTEGER NOT NULL,
  issued_by TEXT NOT NULL,
  date_issued DATE NOT NULL,
  misconduct TEXT NOT NULL,
  description TEXT NOT NULL,
  dates_committed TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for employees
CREATE POLICY "Users can view own employees"
  ON public.employees FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert own employees"
  ON public.employees FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update own employees"
  ON public.employees FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete own employees"
  ON public.employees FOR DELETE
  USING (auth.uid() = company_id);

-- RLS Policies for documents
CREATE POLICY "Users can view own documents"
  ON public.documents FOR SELECT
  USING (auth.uid() = company_id);

CREATE POLICY "Users can insert own documents"
  ON public.documents FOR INSERT
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update own documents"
  ON public.documents FOR UPDATE
  USING (auth.uid() = company_id);

CREATE POLICY "Users can delete own documents"
  ON public.documents FOR DELETE
  USING (auth.uid() = company_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();