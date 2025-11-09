-- Fix employee ID uniqueness constraint to be company-scoped
-- This prevents cross-company information leakage

-- Remove the global unique constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_id_number_unique;

-- Add company-scoped unique constraint
-- This allows the same ID number in different companies while preventing duplicates within a company
ALTER TABLE employees ADD CONSTRAINT employees_company_id_id_number_unique 
  UNIQUE (company_id, id_number);