/**
 * Centralized error handling to prevent information leakage
 * Maps technical database/system errors to user-friendly messages
 */

const safeErrorMessages: Record<string, string> = {
  'employees_id_number_unique': 'An employee with this ID number already exists in your company.',
  'employees_company_id_id_number_unique': 'An employee with this ID number already exists in your company.',
  'profiles_pkey': 'A profile already exists for this account.',
  'Invalid login credentials': 'Invalid email or password.',
  'User already registered': 'An account with this email already exists.',
  'Email not confirmed': 'Please confirm your email before signing in.',
  'duplicate key value': 'This record already exists.',
  'violates foreign key constraint': 'This operation cannot be completed due to related data.',
  'permission denied': 'You do not have permission to perform this action.',
  'row-level security': 'Access denied. You can only access your own data.',
};

/**
 * Converts technical error messages to safe, user-friendly messages
 * Logs full error for debugging while hiding technical details from users
 */
export const getSafeErrorMessage = (error: any): string => {
  // Log the full error for debugging (server-side in production)
  console.error('Operation failed:', error);
  
  const message = error?.message || '';
  
  // Check for known error patterns
  for (const [pattern, safeMsg] of Object.entries(safeErrorMessages)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return safeMsg;
    }
  }
  
  // Handle Zod validation errors specifically
  if (error?.name === 'ZodError' || error?.errors) {
    const firstError = error.errors?.[0];
    if (firstError?.message) {
      return firstError.message;
    }
  }
  
  // Generic fallback for unknown errors
  return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
};
