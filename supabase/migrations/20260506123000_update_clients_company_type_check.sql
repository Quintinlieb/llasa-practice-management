-- Update clients company_type check constraint to match latest UI company type list.

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_company_type_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_company_type_check
  CHECK (
    company_type IS NULL OR
    company_type IN (
      'Private Company ((Pty) Ltd)',
      'Public Company (Ltd)',
      'Personal Liability Company (Inc.)',
      'State-Owned Company (SOC Ltd)',
      'Non-Profit Company (NPC)',
      'Close Corporation (CC)',
      'Co-operative (Co-op)',
      'Sole Proprietor (SP)',
      'Partnership (Partnership)',
      'Business Trust (Trust)'
    )
  );
