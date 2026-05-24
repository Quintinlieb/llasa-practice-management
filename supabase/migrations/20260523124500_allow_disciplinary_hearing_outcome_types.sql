ALTER TABLE public.case_outcomes
  DROP CONSTRAINT IF EXISTS case_outcomes_outcome_type_check;

ALTER TABLE public.case_outcomes
  ADD CONSTRAINT case_outcomes_outcome_type_check CHECK (
    outcome_type IN (
      'Dismissal Upheld',
      'Settlement',
      'Award Issued',
      'Case Withdrawn',
      'Matter Closed',
      'Consultation Completed',
      'Hearing Finalised',
      'Ruling',
      'Judgment',
      'Not Guilty',
      'Guilty - Verbal Warning',
      'Guilty - Written Warning',
      'Guilty - Final Written Warning',
      'Guilty - Suspension Without Pay',
      'Guilty - Demotion',
      'Guilty - Dismissal',
      'Guilty - Alternative Sanction',
      'Dismissal',
      'Demotion',
      'Suspension without pay',
      'Transfer',
      'Warning',
      'Payment of damages'
    )
  );
