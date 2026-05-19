-- Align case_files check constraints with the current Matters UI options.

ALTER TABLE public.case_files
  DROP CONSTRAINT IF EXISTS case_files_case_type_check;

ALTER TABLE public.case_files
  ADD CONSTRAINT case_files_case_type_check CHECK (
    case_type IN (
      'Hearing',
      'Consultation',
      'CCMA',
      'Bargaining Council',
      'Wage Negotiations',
      'Labour Court'
    )
  );

ALTER TABLE public.case_files
  DROP CONSTRAINT IF EXISTS case_files_status_check;

ALTER TABLE public.case_files
  ADD CONSTRAINT case_files_status_check CHECK (
    status IN (
      'Active',
      'Pending',
      'Awaiting Documents',
      'Set Down',
      'Postponed',
      'Settled',
      'Closed',
      'Archived'
    )
  );
