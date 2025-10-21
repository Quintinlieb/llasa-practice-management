/**
 * Utility functions for masking sensitive ID numbers in the UI
 */

/**
 * Masks an ID number, showing only the last 4 digits
 * @param idNumber - The full ID number to mask
 * @returns Masked ID string (e.g., "****5678")
 */
export function maskIdNumber(idNumber: string): string {
  if (!idNumber || idNumber.length < 4) {
    return "****";
  }
  
  const lastFour = idNumber.slice(-4);
  const masked = "*".repeat(Math.max(0, idNumber.length - 4));
  return masked + lastFour;
}

/**
 * Formats a masked ID with better readability
 * @param idNumber - The full ID number to mask
 * @returns Formatted masked ID (e.g., "******-**-**-5678")
 */
export function maskSAIdNumber(idNumber: string): string {
  if (!idNumber || idNumber.length < 4) {
    return "****";
  }
  
  // South African IDs are 13 digits: YYMMDD-S-CC-C
  if (idNumber.length === 13) {
    const lastFour = idNumber.slice(-4);
    return `******-**-${lastFour}`;
  }
  
  return maskIdNumber(idNumber);
}
