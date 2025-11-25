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

export const contractTypes = ["Permanent", "Temporary", "Part-Time", "Independent", "Locum"] as const;
export const genderOptions = ["Male", "Female", "Other"] as const;
export const raceOptions = ["African", "Coloured", "Indian", "White", "Other"] as const;

export const nationalityOptions = [
  "Afghan",
  "Albanian",
  "Algerian",
  "American",
  "Andorran",
  "Angolan",
  "Antiguan and Barbudan",
  "Argentine",
  "Armenian",
  "Australian",
  "Austrian",
  "Azerbaijani",
  "Bahamian",
  "Bahraini",
  "Bangladeshi",
  "Barbadian",
  "Belarusian",
  "Belgian",
  "Belizean",
  "Beninese",
  "Bhutanese",
  "Bolivian",
  "Bosnian",
  "Botswanan",
  "Brazilian",
  "British",
  "Bruneian",
  "Bulgarian",
  "Burkinabe",
  "Burmese",
  "Burundian",
  "Cambodian",
  "Cameroonian",
  "Canadian",
  "Cape Verdean",
  "Central African",
  "Chadian",
  "Chilean",
  "Chinese",
  "Colombian",
  "Comoran",
  "Congolese (Congo-Brazzaville)",
  "Congolese (Congo-Kinshasa)",
  "Costa Rican",
  "Croatian",
  "Cuban",
  "Cypriot",
  "Czech",
  "Danish",
  "Djiboutian",
  "Dominican",
  "Dutch",
  "East Timorese",
  "Ecuadorean",
  "Egyptian",
  "Equatorial Guinean",
  "Eritrean",
  "Estonian",
  "Eswatini",
  "Ethiopian",
  "Fijian",
  "Finnish",
  "French",
  "Gabonese",
  "Gambian",
  "Georgian",
  "German",
  "Ghanaian",
  "Greek",
  "Grenadian",
  "Guatemalan",
  "Guinean",
  "Bissau-Guinean",
  "Guyanese",
  "Haitian",
  "Honduran",
  "Hungarian",
  "Icelandic",
  "Indian",
  "Indonesian",
  "Iranian",
  "Iraqi",
  "Irish",
  "Israeli",
  "Italian",
  "Ivorian",
  "Jamaican",
  "Japanese",
  "Jordanian",
  "Kazakh",
  "Kenyan",
  "Kiribati",
  "Kuwaiti",
  "Kyrgyz",
  "Laotian",
  "Latvian",
  "Lebanese",
  "Lesotho",
  "Liberian",
  "Libyan",
  "Liechtensteiner",
  "Lithuanian",
  "Luxembourgish",
  "Malagasy",
  "Malawian",
  "Malaysian",
  "Maldivian",
  "Malian",
  "Maltese",
  "Marshallese",
  "Mauritanian",
  "Mauritian",
  "Mexican",
  "Micronesian",
  "Moldovan",
  "Monégasque",
  "Mongolian",
  "Montenegrin",
  "Moroccan",
  "Mozambican",
  "Namibian",
  "Nauruan",
  "Nepalese",
  "New Zealander",
  "Nicaraguan",
  "Nigerien",
  "Nigerian",
  "North Macedonian",
  "Norwegian",
  "Omani",
  "Pakistani",
  "Palauan",
  "Panamanian",
  "Papua New Guinean",
  "Paraguayan",
  "Peruvian",
  "Philippine",
  "Polish",
  "Portuguese",
  "Qatari",
  "Romanian",
  "Russian",
  "Rwandan",
  "Saint Lucian",
  "Salvadoran",
  "Samoan",
  "San Marinese",
  "Sao Tomean",
  "Saudi",
  "Scottish",
  "Senegalese",
  "Serbian",
  "Seychellois",
  "Sierra Leonean",
  "Singaporean",
  "Slovak",
  "Slovenian",
  "Solomon Islander",
  "Somali",
  "South African",
  "South Korean",
  "South Sudanese",
  "Spanish",
  "Sri Lankan",
  "Sudanese",
  "Surinamese",
  "Swedish",
  "Swiss",
  "Syrian",
  "Taiwanese",
  "Tajik",
  "Tanzanian",
  "Thai",
  "Togolese",
  "Tongan",
  "Trinidadian and Tobagonian",
  "Tunisian",
  "Turkish",
  "Turkmen",
  "Tuvaluan",
  "Ugandan",
  "Ukrainian",
  "Uruguayan",
  "Uzbek",
  "Vanuatu",
  "Venezuelan",
  "Vietnamese",
  "Welsh",
  "Yemeni",
  "Zambian",
  "Zimbabwean",
  "Other",
] as const;

export const EMPLOYEE_NUMBER_MAX_LENGTH = 7;
const employeeNumberRegex = new RegExp(`^[A-Z0-9]{1,${EMPLOYEE_NUMBER_MAX_LENGTH}}$`);

export const sanitizeEmployeeNumber = (value?: string | null): string =>
  value
    ? value
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, EMPLOYEE_NUMBER_MAX_LENGTH)
    : "";

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
    province: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (typeof val === "string" ? val.trim() : ""))
      .refine(
        (val) => !val || southAfricanProvinces.includes(val as (typeof southAfricanProvinces)[number]),
        {
          message: "Please select a valid province",
        },
      ),
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

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const nameRegex = /^[a-zA-Z\s'-]+$/;

export const employeeBasicSchema = z
  .object({
    employeeName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters")
      .regex(nameRegex, "Name can only contain letters, spaces, hyphens, and apostrophes")
      .transform(sanitizeText),
    employeeSurname: z
      .string()
      .min(2, "Surname must be at least 2 characters")
      .max(100, "Surname must not exceed 100 characters")
      .regex(nameRegex, "Surname can only contain letters, spaces, hyphens, and apostrophes")
      .transform(sanitizeText),
    idNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
    employeeNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => sanitizeEmployeeNumber(val))
      .refine((val) => !val || employeeNumberRegex.test(val), {
        message: `Employee number must be up to ${EMPLOYEE_NUMBER_MAX_LENGTH} letters or numbers`,
      }),
  });

// Employee Profile Schema
export const employeeProfileSchema = z
  .object({
    employeeName: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(100, "Name must not exceed 100 characters")
      .regex(nameRegex, "Name can only contain letters, spaces, hyphens, and apostrophes")
      .transform(sanitizeText),
    employeeSurname: z
      .string()
      .min(2, "Surname must be at least 2 characters")
      .max(100, "Surname must not exceed 100 characters")
      .regex(nameRegex, "Surname can only contain letters, spaces, hyphens, and apostrophes")
      .transform(sanitizeText),
    idNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
    startDate: z
      .string()
      .regex(dateRegex, "Invalid date format (YYYY-MM-DD)"),
    contractType: z.enum(contractTypes, {
      errorMap: () => ({ message: "Please select a contract type" }),
    }),
    endDate: z
      .string()
      .regex(dateRegex, "Invalid date format (YYYY-MM-DD)")
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val : "")),
    gender: z
      .enum(genderOptions, {
        errorMap: () => ({ message: "Please select a gender" }),
      })
      .or(z.literal(""))
      .refine((val) => val !== "", {
        message: "Please select a gender",
      }),
    race: z
      .enum(raceOptions, {
        errorMap: () => ({ message: "Please select a race" }),
      })
      .or(z.literal(""))
      .refine((val) => val !== "", {
        message: "Please select a race",
      }),
    nationality: z.enum(nationalityOptions, {
      errorMap: () => ({ message: "Please select a nationality" }),
    }),
    employeeNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => sanitizeEmployeeNumber(val))
      .refine((val) => !val || employeeNumberRegex.test(val), {
        message: `Employee number must be up to ${EMPLOYEE_NUMBER_MAX_LENGTH} letters or numbers`,
      }),
    jobTitle: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
    physicalAddressLine1: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
    physicalAddressLine2: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || val.length >= 5, {
        message: "Address line 2 must be at least 5 characters",
      })
      .refine((val) => !val || val.length <= 200, {
        message: "Address line 2 must not exceed 200 characters",
      }),
    city: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || val.length >= 2, {
        message: "City must be at least 2 characters",
      })
      .refine((val) => !val || val.length <= 100, {
        message: "City must not exceed 100 characters",
      })
      .refine((val) => !val || nameRegex.test(val), {
        message: "City can only contain letters, spaces, hyphens, and apostrophes",
      }),
    province: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (typeof val === "string" ? val.trim() : ""))
      .refine(
        (val) => !val || southAfricanProvinces.includes(val as (typeof southAfricanProvinces)[number]),
        {
          message: "Please select a valid province",
        },
      ),
    areaCode: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || /^\d{4}$/.test(val), {
        message: "Area code must be 4 digits",
      }),
    cellNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || saPhoneRegex.test(val), {
        message: "Invalid phone number (e.g., 0123456789 or +27123456789)",
      }),
    email: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || z.string().email().safeParse(val).success, {
        message: "Invalid email address",
      })
      .refine((val) => !val || val.length <= 255, {
        message: "Email must not exceed 255 characters",
      }),
    emergencyContactName: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || val.length >= 2, {
        message: "Contact name must be at least 2 characters",
      })
      .refine((val) => !val || val.length <= 150, {
        message: "Contact name must not exceed 150 characters",
      })
      .refine((val) => !val || nameRegex.test(val), {
        message: "Name can only contain letters, spaces, hyphens, and apostrophes",
      }),
    emergencyContactNumber: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || saPhoneRegex.test(val), {
        message: "Invalid phone number (e.g., 0123456789 or +27123456789)",
      }),
  })
  .superRefine((data, ctx) => {
    if (data.contractType === "Temporary" && !data.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date is required for temporary contracts",
      });
    }
  });

export const employeeImportSchema = z.object({
  employeeNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => sanitizeEmployeeNumber(val))
    .refine((val) => !val || employeeNumberRegex.test(val), {
      message: `Employee number must be up to ${EMPLOYEE_NUMBER_MAX_LENGTH} letters or numbers`,
    }),
  employeeName: z
    .string()
    .transform((val) => (typeof val === "string" ? val.trim() : ""))
    .refine((val) => val.length > 0, { message: "Name is required" }),
  employeeSurname: z
    .string()
    .transform((val) => (typeof val === "string" ? val.trim() : ""))
    .refine((val) => val.length > 0, { message: "Surname is required" }),
  idNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => (typeof val === "string" ? val.trim() : "")),
  contractType: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => {
      const trimmed = typeof val === "string" ? val.trim() : "";
      if (!trimmed) return "";
      const match = contractTypes.find((type) => type.toLowerCase() === trimmed.toLowerCase());
      return match ?? trimmed;
    })
    .refine((val) => !val || contractTypes.includes(val as (typeof contractTypes)[number]), {
      message: `Contract type must be one of: ${contractTypes.join(", ")}`,
    }),
  gender: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => {
      const trimmed = typeof val === "string" ? val.trim() : "";
      if (!trimmed) return "";
      const match = genderOptions.find((option) => option.toLowerCase() === trimmed.toLowerCase());
      return match ?? trimmed;
    })
    .refine((val) => !val || genderOptions.includes(val as (typeof genderOptions)[number]), {
      message: `Gender must be one of: ${genderOptions.join(", ")}`,
    }),
  race: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => {
      const trimmed = typeof val === "string" ? val.trim() : "";
      if (!trimmed) return "";
      const match = raceOptions.find((option) => option.toLowerCase() === trimmed.toLowerCase());
      return match ?? trimmed;
    })
    .refine((val) => !val || raceOptions.includes(val as (typeof raceOptions)[number]), {
      message: `Race must be one of: ${raceOptions.join(", ")}`,
    }),
  nationality: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => {
      const trimmed = typeof val === "string" ? val.trim() : "";
      if (!trimmed) return "";
      const match = nationalityOptions.find((option) => option.toLowerCase() === trimmed.toLowerCase());
      return match ?? trimmed;
    })
    .refine((val) => !val || nationalityOptions.includes(val as (typeof nationalityOptions)[number]), {
      message: `Nationality must be one of: ${nationalityOptions.join(", ")}`,
    }),
  jobTitle: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => (typeof val === "string" ? val.trim() : "")),
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
export type EmployeeBasicFormData = z.infer<typeof employeeBasicSchema>;
export type EmployeeProfileFormData = z.infer<typeof employeeProfileSchema>;
export type WarningGeneratorFormData = z.infer<typeof warningGeneratorSchema>;
