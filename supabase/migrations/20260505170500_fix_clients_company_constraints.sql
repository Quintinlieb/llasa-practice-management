-- Fix misnamed/legacy constraints on public.clients and align checks to UI dropdown values.

ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS employees_company_type_check,
  DROP CONSTRAINT IF EXISTS clients_company_type_check,
  DROP CONSTRAINT IF EXISTS employees_bargaining_council_check,
  DROP CONSTRAINT IF EXISTS clients_bargaining_council_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_company_type_check
  CHECK (
    company_type IS NULL OR
    company_type IN (
      'Private Company (Pty) Ltd',
      'Close Corporation (CC)',
      'Sole Proprietor',
      'Partnership',
      'Trust',
      'Non-Profit Company (NPC)',
      'Public Company (Ltd)',
      'Personal Liability Company (Inc.)',
      'State-Owned Company (SOC Ltd)'
    )
  );

ALTER TABLE public.clients
  ADD CONSTRAINT clients_bargaining_council_check
  CHECK (
    bargaining_council IS NULL OR
    bargaining_council IN (
      'NBCRFLI',
      'MIBCO',
      'MEIBC',
      'NBCEI',
      'NBCPSS',
      'BCCEI',
      'NBCCI',
      'NBCMI',
      'NBCLI',
      'NBCWPS',
      'HCSBC',
      'NBCFRRCAT',
      'BCFMIWC',
      'BIBC',
      'BCRCAT',
      'SALGBC',
      'ELRC',
      'PSCBC',
      'GPSSBC',
      'PHSDSBC'
    )
  );
