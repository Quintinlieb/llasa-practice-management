import { z } from "zod";
import DOMPurify from "dompurify";

// Sanitization helper
export const sanitizeText = (text: string): string => {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }).trim();
};

// Extract DOB from South African ID (first 6 digits as YYMMDD). Returns null if invalid.
export const extractDobFromId = (idNumber: string): Date | null => {
  const digits = idNumber.replace(/\D/g, "");
  if (digits.length < 6) return null;

  const yy = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const dd = Number(digits.slice(4, 6));

  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;

  const now = new Date();
  const currentYearTwoDigits = now.getFullYear() % 100;
  let fullYear = 2000 + yy;
  // If this makes a future date, shift back a century
  if (fullYear > now.getFullYear()) {
    fullYear -= 100;
  }

  const dob = new Date(fullYear, mm - 1, dd);
  if (dob.getMonth() !== mm - 1 || dob.getDate() !== dd) return null;
  if (dob > now) return null;
  return dob;
};

export const calculateAgeFromDob = (dob: Date): number => {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
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
const saTenDigitRegex = /^\d{10}$/;

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
    .min(5, "ID number is required")
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

export const salaryFrequencyOptions = ["month", "week", "day", "hour"] as const;

const baseContractSchema = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
    .transform((val) => val.trim()),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format")
    .transform((val) => val.trim()),
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
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? sanitizeText(val) : "")),
  passportNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? sanitizeText(val) : "")),
  employeeAddress: z
    .string()
    .min(10, "Address must be at least 10 characters")
    .max(300, "Address must not exceed 300 characters")
    .transform(sanitizeText),
  employeePostalAddress: z
    .string()
    .max(300, "Postal address must not exceed 300 characters")
    .optional()
    .transform((val) => (val ? sanitizeText(val) : "")),
  employeeNumber: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => sanitizeEmployeeNumber(val))
    .refine((val) => !val || employeeNumberRegex.test(val), {
      message: `Employee number must be up to ${EMPLOYEE_NUMBER_MAX_LENGTH} letters or numbers`,
    }),
  nationality: z.enum(nationalityOptions, {
    errorMap: () => ({ message: "Please select a nationality" }),
  }),
  gender: z.enum(genderOptions, {
    errorMap: () => ({ message: "Please select a gender" }),
  }),
  race: z.enum(raceOptions, {
    errorMap: () => ({ message: "Please select a race" }),
  }),
  employeeCell: z
    .string()
    .regex(saTenDigitRegex, "Cell number must be exactly 10 digits with no spaces")
    .transform(sanitizeText),
  alternativeContact: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val ? sanitizeText(val) : ""))
    .refine((val) => !val || saTenDigitRegex.test(val), {
      message: "Alternative contact must be exactly 10 digits with no spaces",
    }),
  employeeEmail: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine((val) => !val || z.string().email().safeParse(val).success, {
      message: "Invalid email address",
    })
    .transform((val) => (val ? sanitizeText(val.toLowerCase()) : "")),
  tradingName: z
    .string()
    .max(200, "Trading as must not exceed 200 characters")
    .optional()
    .transform((val) => (val ? sanitizeText(val) : "")),
  employerContact: z
    .string()
    .regex(/^\d{10}$/, "Employer contact must be exactly 10 digits")
    .transform(sanitizeText),
  employerEmail: z
    .string()
    .email("Invalid employer email address")
    .transform((val) => sanitizeText(val.toLowerCase())),
  jobTitle: z
    .string()
    .min(2, "Job title must be at least 2 characters")
    .max(120, "Job title must not exceed 120 characters")
    .transform(sanitizeText),
  salaryAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Salary must be a valid number")
    .transform((val) => Number(val)),
  salaryFrequency: z.enum(salaryFrequencyOptions, {
    errorMap: () => ({ message: "Please select a salary frequency" }),
  }),
  probationPeriod: z
    .enum(["1", "3", "6"], {
      errorMap: () => ({ message: "Please select a probation period" }),
    }),
  department: z
    .string()
    .max(120, "Department must not exceed 120 characters")
    .optional()
    .transform((val) => (val ? sanitizeText(val) : "")),
  retirementAge: z.enum(["55", "60", "65"], {
    errorMap: () => ({ message: "Please select a retirement age" }),
  }),
  workplace: z
    .string()
    .min(3, "Workplace must be at least 3 characters")
    .max(300, "Workplace must not exceed 300 characters")
    .transform(sanitizeText),
  annualLeaveDays: z
    .string()
    .regex(/^\d{1,3}$/, "Annual leave days must be a whole number")
    .transform((val) => Number(val))
    .refine((val) => val >= 1 && val <= 60, {
      message: "Annual leave days must be between 1 and 60",
    }),
  interpreter: z.enum(["yes", "no"], {
    errorMap: () => ({ message: "Please indicate if an interpreter is required" }),
  }),
  reportsTo: z
    .string()
    .min(2, "Please specify who the employee reports to")
    .max(120, "Reports to must not exceed 120 characters")
    .transform(sanitizeText),
  additionalNotes: z
    .string()
    .max(2000, "Additional notes must not exceed 2000 characters")
    .optional()
    .transform((val) => (val ? sanitizeText(val) : "")),
});

const nationalityRefinement = (data: { nationality: string; employeeIdNumber?: string; passportNumber?: string }, ctx: z.RefinementCtx) => {
  const isSA = data.nationality === "South African";
  if (isSA) {
    if (!data.employeeIdNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["employeeIdNumber"],
        message: "ID number is required for South African nationals",
      });
    } else if (!extractDobFromId(data.employeeIdNumber)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["employeeIdNumber"],
        message: "ID must start with a valid date (YYMMDD)",
      });
    }
  } else {
    if (!data.passportNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passportNumber"],
        message: "Passport number is required for non-South African nationals",
      });
    } else if (data.passportNumber.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passportNumber"],
        message: "Passport number must be at least 3 characters",
      });
    }
  }
};

const idOrPassportRefinement = (
  data: { employeeIdNumber?: string | null; passportNumber?: string | null },
  ctx: z.RefinementCtx,
) => {
  const hasId = data.employeeIdNumber && data.employeeIdNumber.trim().length > 0;
  const hasPassport = data.passportNumber && data.passportNumber.trim().length > 0;
  if (!hasId && !hasPassport) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["employeeIdNumber"],
      message: "Provide an ID number or a passport number",
    });
  }
};

export const permanentContractSchema = baseContractSchema.superRefine(nationalityRefinement);

export const temporaryContractSchema = baseContractSchema
  .omit({
    probationPeriod: true,
    annualLeaveDays: true,
    retirementAge: true,
    reportsTo: true,
    endDate: true,
  })
  .extend({
    endType: z.enum(["date", "completion"]).default("date"),
    endDate: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? val.trim() : ""))
      .refine((val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val), {
        message: "Invalid date format",
      }),
    projectScope: z
      .string()
      .min(3, "Project/Scope must be at least 3 characters")
      .max(200, "Project/Scope must not exceed 200 characters")
      .transform((val) => sanitizeText(val)),
    nationality: z
      .enum(nationalityOptions)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
    gender: z
      .enum(genderOptions)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
    race: z
      .enum(raceOptions)
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
    alternativeContact: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : ""))
      .refine((val) => !val || saTenDigitRegex.test(val), {
        message: "Alternative contact must be exactly 10 digits with no spaces",
      }),
    employeeEmail: z
      .string()
      .optional()
      .or(z.literal(""))
      .refine((val) => !val || z.string().email().safeParse(val).success, {
        message: "Invalid email address",
      })
      .transform((val) => (val ? sanitizeText(val.toLowerCase()) : "")),
    employeePostalAddress: z
      .string()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val ? sanitizeText(val) : "")),
  })
  .superRefine((data, ctx) => {
    idOrPassportRefinement(data, ctx);
    const hasEndDate = Boolean(data.endDate && data.endDate.trim());
    if (data.endType === "date") {
      if (!hasEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "End date is required when ending on a specific date",
        });
      }
    }
  });

export type CompanySetupFormData = z.infer<typeof companySetupSchema>;
export type EmployeeBasicFormData = z.infer<typeof employeeBasicSchema>;
export type EmployeeProfileFormData = z.infer<typeof employeeProfileSchema>;
export type WarningGeneratorFormData = z.infer<typeof warningGeneratorSchema>;
export type PermanentContractFormData = z.infer<typeof permanentContractSchema>;
export type TemporaryContractFormData = z.infer<typeof temporaryContractSchema>;
