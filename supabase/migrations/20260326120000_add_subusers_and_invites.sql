-- Store invited/linked subusers for each company account.
CREATE TABLE IF NOT EXISTS public.subusers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  email TEXT NOT NULL CHECK (email = lower(email)),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'revoked')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

ALTER TABLE public.subusers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subusers" ON public.subusers;
CREATE POLICY "Users can view own subusers"
  ON public.subusers FOR SELECT
  USING (auth.uid() = company_id);

DROP POLICY IF EXISTS "Users can insert own subusers" ON public.subusers;
CREATE POLICY "Users can insert own subusers"
  ON public.subusers FOR INSERT
  WITH CHECK (auth.uid() = company_id AND auth.uid() = invited_by);

DROP POLICY IF EXISTS "Users can update own subusers" ON public.subusers;
CREATE POLICY "Users can update own subusers"
  ON public.subusers FOR UPDATE
  USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

DROP POLICY IF EXISTS "Users can delete own subusers" ON public.subusers;
CREATE POLICY "Users can delete own subusers"
  ON public.subusers FOR DELETE
  USING (auth.uid() = company_id);

DROP TRIGGER IF EXISTS update_subusers_updated_at ON public.subusers;
CREATE TRIGGER update_subusers_updated_at
  BEFORE UPDATE ON public.subusers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
