import { z } from "zod";
import DOMPurify from "dompurify";

// Sanitization helper
export const sanitizeText = (text: string): string => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }).trim();
};

// South African ID number validation
export const validateSAIdNumber = (idNumber: string): boolean => {
  // Remove spaces and check if it's 13 digits
  const cleanId = idNumber.replace(/\s/g, "");
  if (!/^\d{13}$/.test(cleanId)) return false;

  // Validate checksum using Luhn algorithm
  const digits = cleanId.split("").map(Number);
  const checkDigit = digits.pop()!;
  
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = digits[i];
    if (i % 2 !== 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  
  const calculatedCheck = (10 - (sum % 10)) % 10;
  return calculatedCheck === checkDigit;
};

// Phone number validation (South African format)
const saPhoneRegex = /^(\+27|0)[1-9]\d{8}$/;

// VAT number validation (South African format)
const saVatRegex = /^[0-9]{10}$/;

// Company registration number validation (South African format)
const saRegNumberRegex = /^[0-9]{4}\/[0-9]{6}\/[0-9]{2}$|^[0-9]{10}$/;

// Company Setup Schema
export const southAfricanProvinces = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
] as const;

export const companySetupSchema = z.object({
  companyName: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(200, "Company name must not exceed 200 characters")
    .transform(sanitizeText),
  registrationNumber: z
    .string()
    .regex(saRegNumberRegex, "Invalid registration number format (e.g., 2023/123456/07 or 2023123456)")
    .transform(sanitizeText),
  physicalAddressLine1: z
    .string()
    .max(200, "Address line 1 must not exceed 200 characters")
    .optional()
    .transform((val) => (val ? sanitizeText(val) : "")),
  physicalAddressLine2: z
    .string()
    .min(5, "Address line 2 must be at least 5 characters")
    .max(200, "Address line 2 must not exceed 200 characters")
    .transform(sanitizeText),
  city: z
    .string()
    .min(2, "City must be at least 2 characters")
    .max(100, "City must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "City can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  province: z.enum(southAfricanProvinces, {
    errorMap: () => ({ message: "Please select a province" }),
  }),
  areaCode: z
    .string()
    .regex(/^\d{4}$/, "Area code must be 4 digits")
    .transform(sanitizeText),
  postalAddress: z
    .string()
    .max(500, "Postal address must not exceed 500 characters")
    .optional()
    .transform((val) => (val ? sanitizeText(val) : "")),
  companyContact: z
    .string()
    .regex(saPhoneRegex, "Invalid phone number (e.g., 0123456789 or +27123456789)")
    .transform(sanitizeText),
  companyEmail: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters")
    .transform(sanitizeText),
  userName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  userSurname: z
    .string()
    .min(2, "Surname must be at least 2 characters")
    .max(100, "Surname must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Surname can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  userContact: z
    .string()
    .regex(saPhoneRegex, "Invalid phone number (e.g., 0123456789 or +27123456789)")
    .transform(sanitizeText),
  userEmail: z
    .string()
    .email("Invalid email address")
    .max(255, "Email must not exceed 255 characters")
    .transform(sanitizeText),
});

// Employee Schema
export const employeeSchema = z.object({
  employeeName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  employeeSurname: z
    .string()
    .min(2, "Surname must be at least 2 characters")
    .max(100, "Surname must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Surname can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  idNumber: z
    .string()
    .refine(validateSAIdNumber, "Invalid South African ID number (must be 13 digits with valid checksum)")
    .transform(sanitizeText),
});

// Warning Generator Schema
export const warningGeneratorSchema = z.object({
  tradingName: z
    .string()
    .max(200, "Trading name must not exceed 200 characters")
    .optional()
    .transform((val) => (val ? sanitizeText(val) : "")),
  employeeName: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  employeeSurname: z
    .string()
    .min(2, "Surname must be at least 2 characters")
    .max(100, "Surname must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Surname can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  employeeIdNumber: z
    .string()
    .refine(validateSAIdNumber, "Invalid South African ID number")
    .transform(sanitizeText),
  warningType: z
    .enum(["first", "second", "serious", "final"], {
      errorMap: () => ({ message: "Please select a warning type" }),
    }),
  validityMonths: z
    .string()
    .regex(/^\d+$/, "Validity must be a number")
    .transform(Number)
    .refine((val) => val > 0 && val <= 24, "Validity must be between 1 and 24 months"),
  issuedBy: z
    .string()
    .min(2, "Issued by must be at least 2 characters")
    .max(100, "Issued by must not exceed 100 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens, and apostrophes")
    .transform(sanitizeText),
  dateIssued: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
    .refine((date) => {
      const d = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return d <= today;
    }, "Date cannot be in the future"),
  misconductTypes: z
    .array(z.string())
    .min(1, "Select at least one misconduct type"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(5000, "Description must not exceed 5000 characters")
    .transform(sanitizeText),
});

export type CompanySetupFormData = z.infer<typeof companySetupSchema>;
export type EmployeeFormData = z.infer<typeof employeeSchema>;
export type WarningGeneratorFormData = z.infer<typeof warningGeneratorSchema>;
