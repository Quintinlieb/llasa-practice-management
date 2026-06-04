import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type RefObject, type SVGProps, type SyntheticEvent } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { logGeneratedDocument } from "@/lib/documentsLog";
import { fetchCurrentUserSignatureUrl } from "@/lib/userSignatures";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Check, ChevronDown, ChevronsUpDown, FileText, Info, Pencil, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { jsPDF } from "jspdf";

type DisciplinaryHearingOutcomeGeneratorProps = {
  embedded?: boolean;
  externalNavigation?: boolean;
  onRequestClose?: () => void;
  draftState?: unknown;
  onDraftStateChange?: (draftState: unknown) => void;
  onStepChange?: (step: string | null) => void;
  onStepMetaChange?: (meta: {
    steps: readonly string[];
    activeStep: number;
    icons?: readonly ComponentType<SVGProps<SVGSVGElement>>[];
    canGoNext?: boolean;
    canGoBack?: boolean;
    canSelectStep?: (index: number) => boolean;
    onNext?: () => void;
    onBack?: () => void;
    onStepSelect?: (index: number) => void;
    onClear?: () => void;
    addendumType?: "general" | "renewal" | "extension" | "";
    isFinished?: boolean;
    isPreviewEditable?: boolean;
    supportsPreviewEditToggle?: boolean;
    supportsResetAtFirstStep?: boolean;
    temporaryEmployeeCount?: number;
  }) => void;
};

type ClientRow = {
  id: string;
  registered_name: string | null;
  trading_as: string | null;
  company_type: string | null;
  registration_number: string | null;
  owner_number: string | null;
  primary_number: string | null;
  owner_email: string | null;
  primary_email: string | null;
  physical_address_line1: string | null;
  physical_address_line2: string | null;
  city: string | null;
  province: string | null;
  area_code: string | null;
  bargaining_council: string | null;
};

type ClientFormState = {
  clientId: string;
  clientName: string;
  clientRegisteredName: string;
  clientTradingAsName: string;
  registrationNumber: string;
  clientContactNumber: string;
  clientEmail: string;
  clientAddress: string;
  clientCity: string;
  clientProvince: string;
};

type EmployeeFormState = {
  employeeName: string;
  employeeSurname: string;
};

type HearingFormat = "in_person" | "virtual";
type EmployeeAttendance = "Absent" | "Present";
type HearingProcess = "Continued" | "Continued in absence" | "Postponed" | "Withdrawn";
type RepresentationOption =
  | "Conduct own defense"
  | "Co-worker"
  | "Shop Steward"
  | "Union Official"
  | "Attorney"
  | "Other";
type InterpreterOption = "Yes" | "No";
type AppealNoticeOption = "3" | "5" | "7" | "10";
type PleaOption = "No plea" | "Guilty" | "Not guilty";
type OffenceCategory = "Minor" | "Serious" | "Dismissible";

type ConductOffence = {
  name: string;
  category: OffenceCategory;
};

type HearingDetailsFormState = {
  noticeDate: string;
  hearingDate: string;
  hearingFormat: HearingFormat | "";
  hearingVenue: string;
  misconductTypes: string[];
  employeeAttendance: EmployeeAttendance | "";
  hearingProcess: HearingProcess | "";
  bargainingCouncil: string;
  representation: RepresentationOption | "";
  interpreter: InterpreterOption | "";
  appealNoticeDays: AppealNoticeOption;
  pleasByCharge: Record<string, PleaOption | "">;
};

type PreviewFormState = {
  preliminaryOne: string;
  preliminaryTwo: string;
  preliminaryThree: string;
  preliminaryFour: string;
  preliminaryPleaOverrides: string;
  preliminaryChargeParagraphOverrides: string;
  preliminaryChargePleaOverrides: string;
  preliminaryProcess: string;
  preliminaryExtra: string;
  issueInDispute: string;
  analysisIntro: string;
  analysisDetail: string;
  employeeStatement: string;
  employeeStatementsByEmployee: string;
  employerStatement: string;
  employerEvidence: string;
  employeeEvidence: string;
  analysisFinding: string;
  aggravatingFactors: string;
  mitigatingFactors: string;
  recommendation: string;
  signingPlace: string;
  signingDay: string;
  signingMonth: string;
};

type EditorTarget = keyof PreviewFormState | "preliminarySection" | "issueSection" | "analysisSection" | "employeeStatementGroup";

type OutcomeDraftState = {
  activeStep: number;
  isFinished: boolean;
  clientForm: ClientFormState;
  employeeForms: EmployeeFormState[];
  hearingDetailsForm: HearingDetailsFormState;
  employeeHearingDetailsForms: HearingDetailsFormState[];
  previewForm: PreviewFormState;
  hasRecommendationSection: boolean;
  isPreviewEditable: boolean;
};

const steps = ["Parties", "Hearing Details", "Preview / Edit"] as const;
const stepIcons = [Building2, FileText, Check] as const;
const inputClassName =
  "h-8 rounded-sm border-slate-300 bg-white !text-[11px] md:!text-[11px] font-medium text-slate-900 shadow-none placeholder:!text-[11px] md:placeholder:!text-[11px] placeholder:font-normal placeholder:text-slate-400 hover:border-[#3eca44] focus-visible:border-[#3eca44] focus-visible:ring-0";
const editablePlaceholderText = "Please start typing here...";
const generatedDocumentsBucket = "documents";
const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const getOrdinalSuffix = (value: string) => {
  const day = Number.parseInt(value, 10);
  if (!Number.isFinite(day)) return "";
  const remainder100 = day % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return "th";
  switch (day % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
};
const quintinLiebenbergSignatureDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHkAAACiCAMAAABS3ZKXAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAK1UExURQAAAP///wAAAA8PDxERERISEhMTExUVFRkZGRoaGhsbGxwcHB0dHR8fHyQkJCUlJSYmJicnJygoKCkpKSoqKiwsLC0tLS4uLjAwMDExMTIyMjQ0NDU1NTY2Njc3Nzg4ODk5OTo6Ojs7Ozw8PD09PT4+Pj8/P0BAQEFBQUJCQkNDQ0REREVFRUZGRkdHR0hISElJSUpKSktLS0xMTE1NTU5OTk9PT1BQUFFRUVJSUlNTU1RUVFVVVVZWVldXV1hYWFlZWVpaWltbW1xcXF1dXV5eXl9fX2BgYGFhYWJiYmNjY2RkZGVlZWZmZmdnZ2hoaGlpaWpqamtra2xsbG1tbW5ubm9vb3BwcHFxcXJycnNzc3R0dHV1dXZ2dnd3d3h4eHl5eXp6ent7e3x8fH19fX5+fn9/f4CAgIGBgYKCgoODg4SEhIWFhYaGhoeHh4iIiImJiYqKiouLi4yMjI2NjY6Ojo+Pj5CQkJGRkZKSkpOTk5SUlJWVlZaWlpeXl5iYmJmZmZqampubm5ycnJ2dnZ6enp+fn6CgoKGhoaKioqOjo6SkpKWlpaampqenp6ioqKmpqaqqqqurq6ysrK2tra6urq+vr7CwsLGxsbKysrOzs7S0tLW1tba2tre3t7i4uLm5ubq6uru7u7y8vL29vb6+vr+/v8DAwMHBwcLCwsPDw8TExMXFxcbGxsfHx8jIyMnJycrKysvLy8zMzM3Nzc7Ozs/Pz9DQ0NHR0dLS0tPT09TU1NXV1dbW1tfX19jY2NnZ2dra2tvb29zc3N3d3d7e3t/f3+Dg4OHh4eLi4uPj4+Tk5OXl5ebm5ufn5+jo6Onp6erq6uvr6+zs7O3t7e7u7u/v7/Dw8PHx8fLy8vPz8/T09PX19fb29vf39/j4+Pn5+fr6+vv7+/z8/P39/f7+/v///0MXzbkAAAACdFJOUwC/LU1jJQAAAAlwSFlzAAAOxAAADsMB2mqY3AAADUtJREFUeF7tm/lDE1cewLd7dLftbtfudre69aaKZxWRQ6AiooIccliMgkApgoBarBdn5aqiqFxyKBJERCKKoqAtCFRAboEgcpqQBJKZv2PfTN6EyWTeJCET+oufH/Q7Afwwb97xfd83/uH3A/+9eG+eT96b55P3ZjOiaJHDCDJf5t4zPm9gCJkn88zeP9/CYAyZJ3P7mqMyGFLMj7nBO45xx/NjHhPbruqE8SzzYB4KF+zqhTEN85snEz/531MY0zG7WRK1fF0VjLUwt3km7Y/LSmCsjbnN+X//9A4MGZjZXPvPf5UpYExAG1vmNTev/U8xDEk6++4NwdC85oGtXzyEIQHWFlaxNnsGXpnT3OezpAiGBFh/fk5TQs4wvDSjeergl3UwJJmufwv+fEI1t/nM8oRVT2CoBhuHgRqzmUfOLi+EITvmMksiF1XAEIGZzH2RX92AIQrzmNs8PuZuaoBZzI27PkqdgjESM5hltWc2hTFzH134N88UBFwI1R5ArPBufpNyPH7bb/CCC77NnT/alfn/Ci844dlcf+h0V0CQ7kNW6qSePJuv+2dIim374NUsoipqhZqFT/NYiU06PmhxVQWvNdStSJ+G4Sw8mjuiBOABn3YZhdcaWm1P6N4yf2ZVs7cvuLEnG1rgBxr69h3WvWMezUL/4+9wfNz+CD3tIpAf2KL74AG8mNtnZi75/US0aLF1l/ojDbIE++cw1MYAMyZuAXfDQb1zc8Hqx0TU6VBN/EVDmbHgHgwZGGBW3Vl5ldmEdJpsDyWGtxGRPMR+kvxoltvLsxi1AgpDWlvqF/9adyagaP0moPCMugu1rSxmjKi+TftZujWJYc95WKwzRin6Qu2qsibIUH7me8b9iY/Y/wJDHUztYT0C15RnMBaubYcRhcefKmGki4lmccKS8BcwntgWrd0dpoWfOI3BWBfTzFPRLrsewViVZy2GoRpVjr0Ty46dwiTzROLOBfkwxgc3ZCphqKbU++phCYxZMMX8LnHz5W2D8AK/7K7dsg17Svc8QA8Jk8yxFoMJN6lB02VRDiM1rQHZmaHUHoqNuZsVJevONwVL4ZXqhLPWGtXlF/PEm9hHIZm7OXtpyVu/TOqWWzbT96t4v3/ESNgpzgR0zuaHdhGyRksq1ZP6BtAnkWHB/pEHrj3wip25ml+4JOPKuHQ4gLHbC+hz1cRxh9GxjaXwCsEczY22Me/wKocReCndHUlbKiRROzrxwm+4b3luZqxindcEPuVxAeYaqmpXqqcBFJfsGvA2tzJyqu+/g1iq5mZ++JENuNu7btT2v9shjZbv5HuKcYn/ftI46SsAk8lYP1hOmEN7LuYaa2eQeXTbaCrWV61ewwgg9KgCo9myjPiiPHYdkE4EXxu8orPtMN4sa7dYBe5Qdfoo1Y69O27OLqJ1jmVgrTi7j9hLygtW3gJ/5dk9TbCq7GSMMaPNM/eiPCuBqMcF3A0J9oOmp4H22JEzjWOiL4muLi/zAynY2MugaxGOWSmXTTxNkNRcdowBtywJDiHuStUrxzs23Vd/DdC4miihy91CQI8buZF+AceHqu9UfvGXxDN5tJ5AYqR5Iv9Cjj8xKT5c2Qz+lBU4tU1956dpx/7DCcQIb1oKUv7RCwk1NdLW28O4aI1Pj25OY5xZnnIsL4xYncYO5oIlcSrLc2HH/U9r1V8EeUJEDCGe2HtAgQ/nZPZuij8b96wrcdVZttzVYPMQyADG849c2knOz1nbwFOTZIZWXBgNtKOWitHv95Nz2sNPHmC/iYretS5b5Nj80ufDY9qpCsQAs4QYH70hLvWS1KhnAYXEVZeDCDRt/IFnWeNCp/YS+AhTvyHzMFm4q/x1MthXqF686jrr73qUmQmr0W8WJ0hwrDnIKS4049i4IJL4/acEoQq89bB/c2ndiHPi+eieDtD0ioKIbvIH3tkUlIvUychTL/vErY1kCL6hcZCaAAj0mqWhWyfxds+wK9fSQrqK/cgCyP1//4IP+IRKWh6qqnwLDtedSJPhqnxrOFm8sj3uTG5oFKJNjv2Xv4SrdJsoTETvZ/rMU6kWQrwjJqMm7+LJvic25Ir01isBf/VD8lv8Vu9ru0vn+5Nch8FGJBimvFjFegGZCk6eXvqTROJSSmRnyo6ixOuzo55Aj1mRbCXE2wKDGwruRvdJDxcRv/RMor28ISxmGnueMZWwoBSvTbo+jv8aPbuVU/fktphlV3H80QrwIyO15fEHmeUibvNoms0NrNbzYq+wNuLx9PUT5E/3ri5v9UifwUd2lnZbunW88hXGjz4oYmY+lVu21YN7zbPIvlcWsyOhh/6ISTjN4iPuJYongtja249Ka7ur970iPsTOCd5WgsUCawqYDLU6Isy0dmvuTGJMysoiez9yFZkJWWzvEqGVKUG4zKMnPV421h+6Jo2seC76+d45Efl7tyx+Qd6fIv3gTwtFBQPPFt/vzGSM2OmrnybCEAmHWfzdke6i0uDC8Ru5LX2Ho5/XkIm8MjpyhFykZrKd/noSzN2t32ZnVmvn+DOpa87SUgV20ObhI3atGUX5j/B6i9yu6os9XeQdYzUbc6m+8igA5PbYg+2uHfADyEDC15qdBxqkuS/cZ6h5h1CGv3Fxb1TcqbqsbtDxLeupw4nhjSeJzxQDjGcsDlyqmck5QJnF4X79csckMCtlLMnD8ZJgoTqzfhNK9RYsm73y0h28R+vgBAXCPHAmToYXr78Dpmh/sFSMCNx06tXDS9O0n66aF4c89CSdEHbzRErsNN639mcMH/3uHFgPOoJ0t/4li5n7dIIGh0DtvSwSVnNbYdEkjv2W9w6fSglUVyJ0GNuZzMwyAOXOkWwNwQaLWdkSfQ2Oz+mLvqga+ZU1OlVGHH9gFYcqyOjAYpZna47Ir+xtgBGToaXxuo5bW7NhZACIHqam2pYqRTDBri5jDGLQVnet9R7Y0OAyv9xTpDPPQ0adGKUJsJD/TE+79cNh7g9MR/1LWI4FlW1TjB5bZURTA9Bm+ckgZLHh7bpvGRNX/1FLRH0TBdKsLA5CDkzsjpOmMKPm2T5PKt3SAvW0AEjzXX+qwqbLoFuSdscW7vRgGWO4pH4crUaYsda9HJNvxT+0lgRp3voTjMZXI9zP2EvRQZgVB5LQB4vKqG30TYM0xU4IQ23KklqMbu2p8oNoMd65jCyjQ7pjvV7CUJuOVZwn0OzmPB/dd5s0zCTvphUVX/m4sq0coClColgfAQWruS6I/S7UvLWenTGwWq9wxBJRvJXjtwewmUcDyVIDAuVNS02GqyjYEoFIuHo3EeUCDljMqvNJLOufBunmK9RdTp2zTUR8qyrCRc86zWK+78TM2umoni+kzsJ6zqxA9qEXlshjBIiuuWtfFUdb43IBVWV96efIfhIFGN2VwNVuBDrm4b0pnFnFoB3UVbmHotvz4mKOar4aplmZZqmz8NJR5W4lt4TSuu0c7xJ0rc3najcSplnkzZ05TjrHEc0o/tFf6/UrbaajdnF1FTUM85DHNe4MruMjYrA8Dd7Olcw3b0UfFmnQNkvjwxCpJgQr+7wdl5VtFLAtTRRj/kf1dS+AtrnCln0m1CA/HoYPnffL4ZwXCz+mzs640DKPCPK42xqf8L5dF7Gbsw/iMg8B5y8GoZunT3no+5Fxm9DdPzBTMG1UBQ60yi8auvnm6gcwQjLp5M72viqdoSUn9TScGpq5e73+XS+GqtBrUBZsNOhFFppZGejOXqwzjnYrsBk0hFnzzQ2GvO2jl7OaMqgeNObuhXpOeQyjZ1253nlTDWWWxvpwHSIaiixkttitB2iWFwSgtqtGUf+59puWHEBz40ZDiip6kR84obfzU0BzrWWTOjCNJ59pXhjWCzSP13CcjhuM1CuUI01nQPUwXnhsY1hZiIRP8xufXCO27nyabywi3+ExEB7N777/0eCODeDPrMpxHIChQfBn7llEviFmMPyZM5cbt9TxZhbbXDcoIdDAl1mVus3A1ZGCL/Nr62xjynAAnsxTyb5GdWwAT+bHq42sw/FlVhzfzb03YYEf8wv7SgNzoFl4McsimWVQA+DDjNV9JTT6lnkxKw/sNTwh0MCDGWv+rwiGxsCDeTp4PWfCLGGfYngwD9uwvzwB6W1lX8J4MD+0JF5qQaBsKkUsYaabZ045ol+yVj5KReUpppvFlugCmqohC9nrTTdXf4guY1eWobMFk82qjM9QZRN5JXEmj8Jks9TbB1FnHs4N4jjGMN08siKL/TGPF8dy7phMNo9asm/iunLruFNRk83dFmwTmOrZ+Ww9b1eYbK6y0n4diESS74MsfVOYbL6/Wdfcm+Kl/yUHk833dM1V7ocMSAdNNtdtYsydQ3XuB1g6nc7/7TLZPGbdpPVv1gki2d5PwmTMsWeyWertShu2r7NtfVl6HBsmm5WX/qbpTZOP/DcUGLq7MtmMD292Uz9puejgxnC9RzYaTDfjTxedaugfaKs5/fVq9tNgdngw49UOVns9t1s5lxiVdPNhxicz/H1jDatqz8KLeU68N88nf/jg9+GDD/4P4JFn6rxAyAAAAAAASUVORK5CYII=";

const defaultAnalysisFindingParagraph =
  "Having considered the evidence, the probabilities, and the submissions made during the disciplinary hearing, I am satisfied that the employer followed a fair procedure consistent with the Code of Good Practice: Dismissal contained in Schedule 8 to the Labour Relations Act 66 of 1995.";
const defaultAnalysisFindingsHeadingParagraph =
  "In light of the above, I make the following finding(s):";
const defaultIssueInDisputeParagraph =
  "I must determine whether there are sufficient grounds to prove, on a balance of probability, that the alleged misconduct was committed and further that a fair and reasonable procedure has been followed.";

const emptyClientFormState: ClientFormState = {
  clientId: "",
  clientName: "",
  clientRegisteredName: "",
  clientTradingAsName: "",
  registrationNumber: "",
  clientContactNumber: "",
  clientEmail: "",
  clientAddress: "",
  clientCity: "",
  clientProvince: "",
};

const emptyEmployeeFormState: EmployeeFormState = {
  employeeName: "",
  employeeSurname: "",
};

const emptyHearingDetailsFormState: HearingDetailsFormState = {
  noticeDate: "",
  hearingDate: "",
  hearingFormat: "in_person",
  hearingVenue: "",
  misconductTypes: [],
  employeeAttendance: "",
  hearingProcess: "",
  bargainingCouncil: "None",
  representation: "",
  interpreter: "",
  appealNoticeDays: "5",
  pleasByCharge: {},
};

const createDefaultInPersonVenue = (city: string, province: string) =>
  [String(city || "").trim(), String(province || "").trim()].filter(Boolean).join(", ");

const getDefaultVirtualHearingVenue = () => virtualHearingVenueOptions[0];

const createEmptyHearingDetailsFormState = (bargainingCouncil = "None", hearingVenue = ""): HearingDetailsFormState => ({
  ...emptyHearingDetailsFormState,
  bargainingCouncil,
  hearingVenue,
});

const createTransparentSignatureDataUrl = async (sourceDataUrl: string) => {
  if (typeof window === "undefined" || typeof document === "undefined" || !sourceDataUrl) {
    return sourceDataUrl;
  }
  return new Promise<string>((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth || image.width;
        canvas.height = image.naturalHeight || image.height;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(sourceDataUrl);
          return;
        }
        context.drawImage(image, 0, 0);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const { data } = imageData;
        for (let index = 0; index < data.length; index += 4) {
          const red = data[index];
          const green = data[index + 1];
          const blue = data[index + 2];
          if (red > 235 && green > 235 && blue > 235) {
            data[index + 3] = 0;
          }
        }
        context.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(sourceDataUrl);
      }
    };
    image.onerror = () => resolve(sourceDataUrl);
    image.src = sourceDataUrl;
  });
};

const emptyPreviewFormState: PreviewFormState = {
  preliminaryOne: "",
  preliminaryTwo: "",
  preliminaryThree: "",
  preliminaryFour: "",
  preliminaryPleaOverrides: "",
  preliminaryChargeParagraphOverrides: "",
  preliminaryChargePleaOverrides: "",
  preliminaryProcess: "",
  preliminaryExtra: "",
  issueInDispute: "",
  analysisIntro: "",
  analysisDetail: "",
  employeeStatement: "",
  employeeStatementsByEmployee: "",
  employerStatement: "",
  employerEvidence: "",
  employeeEvidence: "",
  analysisFinding: "",
  aggravatingFactors: "",
  mitigatingFactors: "",
  recommendation: "",
  signingPlace: "",
  signingDay: "",
  signingMonth: "",
};

const AddSectionDivider = ({
  onClick,
  label,
}: {
  onClick: () => void;
  label: string;
}) => (
  <div className="flex justify-center py-1">
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded border border-dashed border-slate-300 px-3 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:border-[#3eca44] hover:text-[#2f9f35]"
    >
      <Plus className="h-3.5 w-3.5" />
      {label}
    </button>
  </div>
);

const hearingFormatOptions: Array<{ value: HearingFormat; label: string }> = [
  { value: "in_person", label: "In person" },
  { value: "virtual", label: "Virtual" },
];
const virtualHearingVenueOptions = [
  "Microsoft Teams",
  "WhatsApp Video Call",
  "Zoom",
  "Google Meet",
  "Skype",
] as const;

const employeeAttendanceOptions: readonly EmployeeAttendance[] = ["Present", "Absent"] as const;
const hearingProcessOptions: readonly HearingProcess[] = ["Continued", "Continued in absence", "Postponed", "Withdrawn"] as const;
const bargainingCouncilOptions = [
  { label: "None", value: "None" },
  { label: "National Bargaining Council for the Road Freight and Logistics Industry (NBCRFLI)", value: "NBCRFLI" },
  { label: "Motor Industry Bargaining Council (MIBCO)", value: "MIBCO" },
  { label: "Metal and Engineering Industries Bargaining Council (MEIBC)", value: "MEIBC" },
  { label: "National Bargaining Council for the Electrical Industry of South Africa (NBCEI)", value: "NBCEI" },
  { label: "National Bargaining Council for the Private Security Sector (NBCPSS)", value: "NBCPSS" },
  { label: "Bargaining Council for the Civil Engineering Industry (BCCEI)", value: "BCCEI" },
  { label: "National Bargaining Council for the Chemical Industry (NBCCI)", value: "NBCCI" },
  { label: "National Bargaining Council for the Clothing Manufacturing Industry (NBCMI)", value: "NBCMI" },
  { label: "National Bargaining Council for the Leather Industry of South Africa (NBCLI)", value: "NBCLI" },
  { label: "National Bargaining Council for the Wood and Paper Sector (NBCWPS)", value: "NBCWPS" },
  { label: "National Bargaining Council for the Hairdressing, Cosmetology, Beauty and Skincare Industry (HCSBC)", value: "HCSBC" },
  { label: "National Bargaining Council for the Food Retail, Restaurant, Catering and Allied Trades (NBCFRRCAT)", value: "NBCFRRCAT" },
  { label: "Bargaining Council for the Furniture Manufacturing Industry of the Western Cape (BCFMIWC)", value: "BCFMIWC" },
  { label: "Building Industry Bargaining Council Cape of Good Hope (BIBC)", value: "BIBC" },
  { label: "Bargaining Council for the Restaurant, Catering and Allied Trades (BCRCAT)", value: "BCRCAT" },
  { label: "South African Local Government Bargaining Council (SALGBC)", value: "SALGBC" },
  { label: "Education Labour Relations Council (ELRC)", value: "ELRC" },
  { label: "Public Service Co-ordinating Bargaining Council (PSCBC)", value: "PSCBC" },
  { label: "General Public Service Sectoral Bargaining Council (GPSSBC)", value: "GPSSBC" },
  { label: "Public Health and Social Development Sectoral Bargaining Council (PHSDSBC)", value: "PHSDSBC" },
] as const;
const representationOptions: readonly RepresentationOption[] = [
  "Conduct own defense",
  "Co-worker",
  "Shop Steward",
  "Union Official",
  "Attorney",
  "Other",
] as const;
const interpreterOptions: readonly InterpreterOption[] = ["Yes", "No"] as const;
const appealNoticeOptions: readonly AppealNoticeOption[] = ["3", "5", "7", "10"] as const;
const pleaOptions: readonly PleaOption[] = ["No plea", "Guilty", "Not guilty"] as const;
const offenceCategoryOrder: OffenceCategory[] = ["Minor", "Serious", "Dismissible"];
const offenceGroupLabel: Record<OffenceCategory, string> = {
  Minor: "Minor Offences",
  Serious: "Serious Offences",
  Dismissible: "Dismissible Offences",
};
const conductOffenceOptions: ConductOffence[] = [
  { name: "Unauthorised Absenteeism", category: "Minor" },
  { name: "Arriving Late For Work", category: "Minor" },
  { name: "Leaving Work Early", category: "Minor" },
  { name: "Failure To Report Absence", category: "Minor" },
  { name: "Failure To Report Late Arrival", category: "Minor" },
  { name: "Failure To Report Leaving Early", category: "Minor" },
  { name: "Sleeping On Duty", category: "Minor" },
  { name: "Failure To Clock In/Out", category: "Minor" },
  { name: "Poor Housekeeping", category: "Minor" },
  { name: "Horseplay", category: "Minor" },
  { name: "Unauthorised Use Of Cell Phone", category: "Minor" },
  { name: "Breach Of Policy Or Procedure", category: "Minor" },
  { name: "Breach Of Rules Or Regulations", category: "Minor" },
  { name: "Failure To Carry Out Instructions", category: "Minor" },
  { name: "Negligence", category: "Serious" },
  { name: "Unauthorised Absenteeism > 5 Days", category: "Serious" },
  { name: "Refusal To Work Overtime", category: "Serious" },
  { name: "Consistent Poor Time Keeping", category: "Serious" },
  { name: "Causing Inharmonious Relationships", category: "Serious" },
  { name: "Unbecoming Behaviour", category: "Serious" },
  { name: "Insolence / Disrespectful Behaviour", category: "Serious" },
  { name: "Aggressive Behaviour", category: "Serious" },
  { name: "Insubordination / Refusing Instructions", category: "Serious" },
  { name: "Refusal To Comply With Policy/Procedure", category: "Serious" },
  { name: "Refusal To Comply With Rule", category: "Serious" },
  { name: "Damage To Company Name", category: "Serious" },
  { name: "Unauthorised Wastage Of Materials", category: "Serious" },
  { name: "Unauthorised Removal", category: "Serious" },
  { name: "Unauthorised Possession", category: "Serious" },
  { name: "Breach Of OHS Standards / Policies", category: "Serious" },
  { name: "Private Work During Working Hours", category: "Serious" },
  { name: "Unauthorised Disclosure Of Information", category: "Serious" },
  { name: "Misappropriation Of Property / Funds", category: "Serious" },
  { name: "Testing Positive For Alcohol", category: "Serious" },
  { name: "Testing Positive For Illegal Drugs", category: "Serious" },
  { name: "Under The Influence Of Alcohol/Drugs", category: "Serious" },
  { name: "Possession Of Alcohol/Drugs On Duty", category: "Serious" },
  { name: "Unauthorised Possession Of Firearm On Duty", category: "Serious" },
  { name: "Intimidation", category: "Serious" },
  { name: "Incitement", category: "Serious" },
  { name: "Illegal Strike / Picketing", category: "Serious" },
  { name: "Viewing Pornographic Material On Duty", category: "Serious" },
  { name: "Unauthorised Access", category: "Serious" },
  { name: "Unauthorised Use Of Company Property", category: "Serious" },
  { name: "Unauthorised Use Of Client Property", category: "Serious" },
  { name: "Abusive Language", category: "Serious" },
  { name: "Dishonesty", category: "Serious" },
  { name: "Gambling On Duty", category: "Serious" },
  { name: "Clocking For Another Employee", category: "Serious" },
  { name: "Theft", category: "Dismissible" },
  { name: "Accomplice To Theft", category: "Dismissible" },
  { name: "Fraud", category: "Dismissible" },
  { name: "Accomplice To Fraud", category: "Dismissible" },
  { name: "Gross Dishonesty", category: "Dismissible" },
  { name: "Gross Negligence", category: "Dismissible" },
  { name: "Assault", category: "Dismissible" },
  { name: "Sexual Harassment", category: "Dismissible" },
  { name: "Viewing Illegal Pornography On Duty", category: "Dismissible" },
  { name: "Racism", category: "Dismissible" },
  { name: "Refusal To Obey OHS Rules/Procedures", category: "Dismissible" },
  { name: "Bribery", category: "Dismissible" },
  { name: "Falsification Of Records", category: "Dismissible" },
  { name: "Intentional Damage To Property", category: "Dismissible" },
  { name: "Gross Insubordination", category: "Dismissible" },
  { name: "Unauthorised Discharge Of Firearm", category: "Dismissible" },
  { name: "Unsafe Use Of Firearm", category: "Dismissible" },
  { name: "Threatening Another Employee/Client", category: "Dismissible" },
  { name: "Unauthorised Possession Of A Weapon On Duty", category: "Dismissible" },
];

const companyTypeSuffixByValue: Record<string, string> = {
  "Private Company ((Pty) Ltd)": "(Pty) Ltd",
  "Public Company (Ltd)": "Ltd",
  "Personal Liability Company (Inc.)": "Inc.",
  "State-Owned Company (SOC Ltd)": "SOC Ltd",
  "Non-Profit Company (NPC)": "NPC",
  "Close Corporation (CC)": "CC",
  "Co-operative (Co-op)": "Co-op",
  "Sole Proprietor (SP)": "SP",
  "Partnership (Partnership)": "Partnership",
  "Business Trust (Trust)": "Trust",
};

const appendCompanyTypeSuffix = (registeredName: string, companyType: string) => {
  const suffix = companyTypeSuffixByValue[companyType] || "";
  if (!suffix) return registeredName;
  if (registeredName.toLowerCase().endsWith(suffix.toLowerCase())) return registeredName;
  return `${registeredName} ${suffix}`;
};

const formatClientDisplayName = (client: ClientRow) => {
  const registeredName = String(client.registered_name || "").trim();
  const tradingName = String(client.trading_as || "").trim();
  const companyType = String(client.company_type || "").trim();
  const registeredWithType = registeredName ? appendCompanyTypeSuffix(registeredName, companyType) : "";
  if (
    registeredWithType &&
    tradingName &&
    tradingName.toLowerCase() !== registeredName.toLowerCase() &&
    tradingName.toLowerCase() !== registeredWithType.toLowerCase()
  ) {
    return `${registeredWithType} t/a ${tradingName}`;
  }
  return registeredWithType || tradingName || "Unnamed client";
};

const formatClientAddress = (client: ClientRow) =>
  [
    String(client.physical_address_line1 || "").trim(),
    String(client.physical_address_line2 || "").trim(),
    String(client.city || "").trim(),
    String(client.province || "").trim(),
    String(client.area_code || "").trim(),
  ]
    .filter(Boolean)
    .join(", ");

const mapClientToFormState = (client: ClientRow): ClientFormState => ({
  clientId: client.id,
  clientName: formatClientDisplayName(client),
  clientRegisteredName: String(client.registered_name || "").trim(),
  clientTradingAsName: String(client.trading_as || "").trim(),
  registrationNumber: String(client.registration_number || "").trim(),
  clientContactNumber: String(client.primary_number || client.owner_number || "").trim(),
  clientEmail: String(client.primary_email || client.owner_email || "").trim(),
  clientAddress: formatClientAddress(client),
  clientCity: String(client.city || "").trim(),
  clientProvince: String(client.province || "").trim(),
});

const getDefaultVenueForClientForm = (clientForm: Pick<ClientFormState, "clientCity" | "clientProvince">) =>
  createDefaultInPersonVenue(clientForm.clientCity, clientForm.clientProvince);

const normalizeClientBargainingCouncil = (value: string | null) => {
  const raw = String(value || "").trim();
  if (!raw || raw === "--") return "None";
  const direct = bargainingCouncilOptions.find((option) => option.value === raw);
  if (direct) return direct.value;
  const labelMatch = bargainingCouncilOptions.find((option) => option.label.toLowerCase() === raw.toLowerCase());
  if (labelMatch) return labelMatch.value;
  const abbreviationMatch = raw.match(/\(([^)]+)\)\s*$/);
  if (abbreviationMatch?.[1]) {
    const extracted = abbreviationMatch[1].trim();
    const extractedDirect = bargainingCouncilOptions.find((option) => option.value === extracted);
    if (extractedDirect) return extractedDirect.value;
  }
  return raw;
};

const appealNoticeWordByValue: Record<AppealNoticeOption, string> = {
  "3": "THREE",
  "5": "FIVE",
  "7": "SEVEN",
  "10": "TEN",
};

const getOutcomeDisputeForumText = (bargainingCouncil: string) => {
  const councilName = String(bargainingCouncil || "").trim();
  if (!councilName || councilName.toLowerCase() === "none") return "the CCMA";
  const councilLabel = bargainingCouncilOptions.find((option) => option.value === councilName)?.label || councilName;
  return `the ${councilLabel}`;
};

const normalizeHearingDetailsFormState = (
  value: unknown,
  options?: { defaultInPersonVenue?: string },
): HearingDetailsFormState => {
  const candidate = (value && typeof value === "object" ? value : {}) as Partial<HearingDetailsFormState>;
  const hearingFormat =
    candidate.hearingFormat === "in_person" || candidate.hearingFormat === "virtual" ? candidate.hearingFormat : "in_person";
  const defaultInPersonVenue = String(options?.defaultInPersonVenue || "").trim();
  const hearingVenue =
    hearingFormat === "virtual"
      ? String(candidate.hearingVenue || "").trim() || getDefaultVirtualHearingVenue()
      : String(candidate.hearingVenue || "").trim() || defaultInPersonVenue;
  const employeeAttendance =
    candidate.employeeAttendance === "Present" || candidate.employeeAttendance === "Absent" ? candidate.employeeAttendance : "";
  const visibleProcessOptions =
    employeeAttendance === "Present"
      ? hearingProcessOptions.filter((option) => option !== "Continued in absence")
      : employeeAttendance === "Absent"
        ? hearingProcessOptions.filter((option) => option !== "Continued")
        : hearingProcessOptions;
  const hearingProcess =
    candidate.hearingProcess && visibleProcessOptions.includes(candidate.hearingProcess)
      ? candidate.hearingProcess
      : employeeAttendance === "Present"
        ? "Continued"
        : employeeAttendance === "Absent"
          ? "Continued in absence"
          : "";
  return {
    ...emptyHearingDetailsFormState,
    ...candidate,
    hearingFormat,
    hearingVenue,
    employeeAttendance,
    hearingProcess,
    bargainingCouncil: String(candidate.bargainingCouncil || emptyHearingDetailsFormState.bargainingCouncil).trim() || "None",
    misconductTypes: Array.isArray(candidate.misconductTypes)
      ? candidate.misconductTypes.filter((entry): entry is string => typeof entry === "string")
      : [],
    pleasByCharge:
      candidate.pleasByCharge && typeof candidate.pleasByCharge === "object"
        ? Object.fromEntries(
            Object.entries(candidate.pleasByCharge).filter(
              (entry): entry is [string, PleaOption | ""] => typeof entry[0] === "string" && typeof entry[1] === "string",
            ),
          )
        : {},
  };
};

const formatDateLabel = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(parsed);
};

const openHiddenDatePicker = (ref: RefObject<HTMLInputElement | null>) => {
  const input = ref.current;
  if (!input) return;
  if (typeof input.showPicker === "function") {
    input.showPicker();
    return;
  }
  input.focus();
  input.click();
};

const serializeOutcomeDraftState = (draft: OutcomeDraftState) =>
  JSON.stringify({
    activeStep: draft.activeStep,
    isFinished: draft.isFinished,
    clientForm: draft.clientForm,
    employeeForms: draft.employeeForms,
    hearingDetailsForm: draft.hearingDetailsForm,
    employeeHearingDetailsForms: draft.employeeHearingDetailsForms,
    previewForm: draft.previewForm,
    hasRecommendationSection: draft.hasRecommendationSection,
    isPreviewEditable: draft.isPreviewEditable,
  });

const toSentenceCaseLower = (value: string) => {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.charAt(0) + trimmed.slice(1);
};

const withIndefiniteArticle = (value: string) => {
  const normalized = toSentenceCaseLower(value);
  if (!normalized) return "";
  const article = /^[aeiou]/i.test(normalized) ? "an" : "a";
  return `${article} ${normalized}`;
};

const joinWithAnd = (values: string[]) => {
  const normalized = values.map((value) => toSentenceCaseLower(value)).filter(Boolean);
  if (normalized.length === 0) return "";
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")}, and ${normalized[normalized.length - 1]}`;
};

const joinSentenceParts = (values: string[]) => {
  const normalized = values.map((value) => String(value || "").trim()).filter(Boolean);
  if (normalized.length === 0) return "";
  if (normalized.length === 1) return normalized[0];
  if (normalized.length === 2) return `${normalized[0]} and ${normalized[1]}`;
  return `${normalized.slice(0, -1).join(", ")}, and ${normalized[normalized.length - 1]}`;
};

const joinEmployeeReferences = (values: string[]) => {
  const normalized = values.map((value) => String(value || "").trim()).filter(Boolean);
  if (normalized.length === 0) return "";
  const bare = normalized.map((value, index) => (index === 0 ? value : value.replace(/^the\s+/i, "")));
  if (bare.length === 1) return bare[0];
  if (bare.length === 2) return `${bare[0]} and ${bare[1]}`;
  return `${bare.slice(0, -1).join(", ")}, and ${bare[bare.length - 1]}`;
};

const normalizeParagraphText = (value: string) =>
  String(value || "")
    .split(/\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

const parseEmployeeStatementOverrides = (value: string) => {
  try {
    const parsed = JSON.parse(String(value || ""));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((entry) => (typeof entry === "string" ? entry : "")).filter((entry) => typeof entry === "string");
  } catch {
    return [];
  }
};

const stripParagraphNumberPrefix = (value: string) => String(value || "").replace(/^\s*\d+(?:\.\d+)?\.?\s*/, "").trim();

const splitEditorDraftLines = (value: string) =>
  String(value || "")
    .split(/\r?\n/)
    .map((line) => stripParagraphNumberPrefix(line));

const sanitizeFileSegment = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || fallback;

const parseDraftState = (value: unknown): OutcomeDraftState => {
  if (!value || typeof value !== "object") {
    return {
      activeStep: 0,
      isFinished: false,
      clientForm: emptyClientFormState,
      employeeForms: [emptyEmployeeFormState],
      hearingDetailsForm: emptyHearingDetailsFormState,
      employeeHearingDetailsForms: [emptyHearingDetailsFormState],
      previewForm: emptyPreviewFormState,
      hasRecommendationSection: false,
      isPreviewEditable: false,
    };
  }
  const candidate = value as {
    activeStep?: unknown;
    isFinished?: unknown;
    clientForm?: Partial<ClientFormState>;
    employeeForms?: unknown;
    employeeForm?: Partial<EmployeeFormState>;
    hearingDetailsForm?: Partial<HearingDetailsFormState>;
    employeeHearingDetailsForms?: unknown;
    previewForm?: Partial<PreviewFormState>;
    hasRecommendationSection?: unknown;
    isPreviewEditable?: unknown;
  };
  const normalizedClientForm = {
    ...emptyClientFormState,
    ...(candidate.clientForm || {}),
  };
  const defaultInPersonVenue = getDefaultVenueForClientForm(normalizedClientForm);
  const normalizedEmployeeForms = Array.isArray(candidate.employeeForms)
    ? candidate.employeeForms
        .filter((entry): entry is Partial<EmployeeFormState> => Boolean(entry) && typeof entry === "object")
        .map((entry) => ({
          ...emptyEmployeeFormState,
          ...entry,
        }))
    : candidate.employeeForm && typeof candidate.employeeForm === "object"
      ? [{
          ...emptyEmployeeFormState,
          ...candidate.employeeForm,
        }]
      : [emptyEmployeeFormState];
  const activeStep = Math.max(0, Math.min(1, Number(candidate.activeStep) || 0));
  const normalizedHearingDetailsForm = normalizeHearingDetailsFormState(candidate.hearingDetailsForm, {
    defaultInPersonVenue,
  });
  const normalizedEmployeeHearingDetailsForms = Array.isArray(candidate.employeeHearingDetailsForms)
    ? candidate.employeeHearingDetailsForms
        .map((entry) => normalizeHearingDetailsFormState(entry, { defaultInPersonVenue }))
        .filter(Boolean)
    : [];
  return {
    activeStep,
    isFinished: Boolean(candidate.isFinished),
    clientForm: normalizedClientForm,
    employeeForms: normalizedEmployeeForms.length > 0 ? normalizedEmployeeForms : [emptyEmployeeFormState],
    hearingDetailsForm: normalizedHearingDetailsForm,
    employeeHearingDetailsForms: normalizedEmployeeHearingDetailsForms.length > 0 ? normalizedEmployeeHearingDetailsForms : [normalizedHearingDetailsForm],
    previewForm: {
      ...emptyPreviewFormState,
      ...(candidate.previewForm || {}),
    },
    hasRecommendationSection: Boolean(candidate.hasRecommendationSection),
    isPreviewEditable: Boolean(candidate.isPreviewEditable),
  };
};

const DisciplinaryHearingOutcomeGenerator = ({
  onRequestClose,
  draftState,
  onDraftStateChange,
  onStepChange,
  onStepMetaChange,
}: DisciplinaryHearingOutcomeGeneratorProps) => {
  const { user } = useAuth();
  const [chairpersonSignatureDataUrl, setChairpersonSignatureDataUrl] = useState("");
  const initialDraft = useMemo(() => parseDraftState(draftState), [draftState]);
  const [activeStep, setActiveStep] = useState(initialDraft.activeStep);
  const [isFinished, setIsFinished] = useState(initialDraft.isFinished);
  const [clientForm, setClientForm] = useState<ClientFormState>(initialDraft.clientForm);
  const [employeeForms, setEmployeeForms] = useState<EmployeeFormState[]>(initialDraft.employeeForms);
  const [hearingDetailsForm, setHearingDetailsForm] = useState<HearingDetailsFormState>(initialDraft.hearingDetailsForm);
  const [employeeHearingDetailsForms, setEmployeeHearingDetailsForms] = useState<HearingDetailsFormState[]>(initialDraft.employeeHearingDetailsForms);
  const [previewForm, setPreviewForm] = useState<PreviewFormState>(initialDraft.previewForm);
  const [hasRecommendationSection, setHasRecommendationSection] = useState(initialDraft.hasRecommendationSection);
  const [isPreviewEditable, setIsPreviewEditable] = useState(initialDraft.isPreviewEditable);
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [clientLoadMessage, setClientLoadMessage] = useState("Loading clients...");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState("");
  const [chargePickerOpen, setChargePickerOpen] = useState(false);
  const [activeEmployeeChargePickerIndex, setActiveEmployeeChargePickerIndex] = useState<number | null>(null);
  const [chargeSearchValue, setChargeSearchValue] = useState("");
  const [employeeChargeSearchValues, setEmployeeChargeSearchValues] = useState<Record<number, string>>({});
  const [bargainingCouncilPickerOpen, setBargainingCouncilPickerOpen] = useState(false);
  const [activeEmployeeBargainingCouncilPickerIndex, setActiveEmployeeBargainingCouncilPickerIndex] = useState<number | null>(null);
  const [bargainingCouncilSearchValue, setBargainingCouncilSearchValue] = useState("");
  const [employeeBargainingCouncilSearchValues, setEmployeeBargainingCouncilSearchValues] = useState<Record<number, string>>({});
  const [collapsedEmployeeHearingSectionIndexes, setCollapsedEmployeeHearingSectionIndexes] = useState<number[]>([]);
  const noticeDatePickerRef = useRef<HTMLInputElement | null>(null);
  const hearingDatePickerRef = useRef<HTMLInputElement | null>(null);
  const employeeNoticeDatePickerRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const employeeHearingDatePickerRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const editingTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const downloadPdfRef = useRef<(() => void) | null>(null);
  const lastEmittedDraftSnapshotRef = useRef<string | null>(null);
  const [editingParagraphId, setEditingParagraphId] = useState<EditorTarget | null>(null);
  const [editingParagraphLabel, setEditingParagraphLabel] = useState("");
  const [editingParagraphDraft, setEditingParagraphDraft] = useState("");
  const [editingEmployeeStatementGroupIndex, setEditingEmployeeStatementGroupIndex] = useState<number | null>(null);
  const [isAddRecommendationOpen, setIsAddRecommendationOpen] = useState(false);
  const [recommendationDraft, setRecommendationDraft] = useState("");
  const defaultClientVenue = getDefaultVenueForClientForm(clientForm);

  useEffect(() => {
    if (!editingParagraphId) return;
    requestAnimationFrame(() => {
      editingTextareaRef.current?.focus({ preventScroll: true });
    });
  }, [editingParagraphId]);

  useEffect(() => {
    let isMounted = true;
    const loadTransparentSignature = async () => {
      const sourceSignature = user?.id ? await fetchCurrentUserSignatureUrl(user.id) : "";
      const nextSignature = await createTransparentSignatureDataUrl(sourceSignature);
      if (isMounted) {
        setChairpersonSignatureDataUrl(nextSignature);
      }
    };
    void loadTransparentSignature();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const nextDraft = parseDraftState(draftState);
    const nextSnapshot = serializeOutcomeDraftState(nextDraft);
    if (nextSnapshot === lastEmittedDraftSnapshotRef.current) return;
    setActiveStep(nextDraft.activeStep);
    setIsFinished(nextDraft.isFinished);
    setClientForm(nextDraft.clientForm);
    setEmployeeForms(nextDraft.employeeForms);
    setHearingDetailsForm(nextDraft.hearingDetailsForm);
    setEmployeeHearingDetailsForms(nextDraft.employeeHearingDetailsForms);
    setPreviewForm(nextDraft.previewForm);
    setHasRecommendationSection(nextDraft.hasRecommendationSection);
    setIsPreviewEditable(nextDraft.isPreviewEditable);
  }, [draftState]);

  useEffect(() => {
    let isMounted = true;
    const loadClients = async () => {
      if (!user?.id) {
        if (isMounted) setClientLoadMessage("Sign in to load clients.");
        return;
      }
      const { data, error } = await supabase
        .from("clients")
        .select("id, registered_name, trading_as, company_type, registration_number, owner_number, primary_number, owner_email, primary_email, physical_address_line1, physical_address_line2, city, province, area_code, bargaining_council")
        .order("registered_name", { ascending: true, nullsFirst: false });
      if (!isMounted) return;
      if (error) {
        setClientRows([]);
        setClientLoadMessage("Unable to load clients.");
        return;
      }
      const rows = Array.isArray(data) ? (data as unknown as ClientRow[]) : [];
      setClientRows(rows);
      setClientLoadMessage(rows.length === 0 ? "No clients found." : "No matching client found.");
    };
    void loadClients();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const nextDraftState = {
      activeStep,
      isFinished,
      clientForm,
      employeeForms,
      hearingDetailsForm,
      employeeHearingDetailsForms,
      previewForm,
      hasRecommendationSection,
      isPreviewEditable,
    } satisfies OutcomeDraftState;
    lastEmittedDraftSnapshotRef.current = serializeOutcomeDraftState(nextDraftState);
    onDraftStateChange?.(nextDraftState);
  }, [activeStep, clientForm, employeeForms, employeeHearingDetailsForms, hasRecommendationSection, hearingDetailsForm, isFinished, isPreviewEditable, onDraftStateChange, previewForm]);

  useEffect(() => {
    onStepChange?.(isFinished ? steps[2] : steps[Math.min(activeStep, steps.length - 1)] ?? null);
  }, [activeStep, isFinished, onStepChange]);

  useEffect(() => {
    setEmployeeHearingDetailsForms((current) => {
      const clientBargainingCouncil = hearingDetailsForm.bargainingCouncil || normalizeClientBargainingCouncil(clientRows.find((row) => row.id === clientForm.clientId)?.bargaining_council ?? null);
      const nextForms = employeeForms.map((_, index) => {
        if (index === 0) return current[index] ? current[index] : hearingDetailsForm;
        return current[index] ? current[index] : createEmptyHearingDetailsFormState(clientBargainingCouncil, defaultClientVenue);
      });
      return nextForms.length > 0 ? nextForms : [hearingDetailsForm];
    });
    setCollapsedEmployeeHearingSectionIndexes((current) => current.filter((index) => index < employeeForms.length));
  }, [clientForm.clientId, clientRows, defaultClientVenue, employeeForms, hearingDetailsForm]);

  useEffect(() => {
    if (!clientForm.clientId) return;
    const selectedClient = clientRows.find((row) => row.id === clientForm.clientId);
    if (!selectedClient) return;
    const nextCouncil = normalizeClientBargainingCouncil(selectedClient.bargaining_council);
    setHearingDetailsForm((current) => {
      const currentCouncil = String(current.bargainingCouncil || "").trim();
      if (currentCouncil && currentCouncil.toLowerCase() !== "none") return current;
      if (currentCouncil === nextCouncil) return current;
      return {
        ...current,
        bargainingCouncil: nextCouncil,
      };
    });
    setEmployeeHearingDetailsForms((current) =>
      current.map((form) => {
        const currentCouncil = String(form.bargainingCouncil || "").trim();
        if (currentCouncil && currentCouncil.toLowerCase() !== "none") return form;
        if (currentCouncil === nextCouncil) return form;
        return {
          ...form,
          bargainingCouncil: nextCouncil,
        };
      }),
    );
  }, [clientForm.clientId, clientRows]);

  const isPartiesStepValid =
    Boolean(clientForm.clientId.trim()) &&
    employeeForms.length > 0 &&
    employeeForms.every((employee) => Boolean(employee.employeeName.trim() && employee.employeeSurname.trim()));
  const getSelectedPleaCount = (form: HearingDetailsFormState) =>
    form.misconductTypes.filter((type) => Boolean(String(form.pleasByCharge[type] || "").trim())).length;
  const isSingleEmployeeFlow = employeeForms.length <= 1;
  const isHearingDetailsFormComplete = (form: HearingDetailsFormState) =>
    Boolean(
      form.noticeDate.trim() &&
        form.hearingDate.trim() &&
        form.hearingFormat.trim() &&
        form.hearingVenue.trim() &&
        form.misconductTypes.length > 0 &&
        form.employeeAttendance.trim() &&
        form.hearingProcess.trim() &&
        form.bargainingCouncil.trim() &&
        form.representation.trim() &&
        form.interpreter.trim() &&
        form.appealNoticeDays.trim() &&
        getSelectedPleaCount(form) === form.misconductTypes.length,
    );
  const selectedPleaCount = getSelectedPleaCount(hearingDetailsForm);
  const isHearingDetailsStepValid = isSingleEmployeeFlow
    ? isHearingDetailsFormComplete(hearingDetailsForm)
    : employeeHearingDetailsForms.length === employeeForms.length && employeeHearingDetailsForms.every(isHearingDetailsFormComplete);
  const usesNoMitigatingFactorsMessage =
    hearingDetailsForm.employeeAttendance === "Absent" && hearingDetailsForm.hearingProcess === "Continued in absence";
  const usesNoEmployeeEvidenceMessage =
    isSingleEmployeeFlow &&
    hearingDetailsForm.employeeAttendance === "Absent" &&
    hearingDetailsForm.hearingProcess === "Continued in absence";
  const hasEditablePreviewText = (value: string) => {
    const trimmedValue = value.trim();
    return Boolean(trimmedValue) && trimmedValue !== editablePlaceholderText;
  };
  const hasCompleteEmployeeStatements = (() => {
    if (employeeForms.length <= 1) return hasEditablePreviewText(previewForm.employeeStatement);
    const presentEmployeeCount = employeeHearingDetailsForms.filter((form) => form.employeeAttendance === "Present").length;
    const statementGroups = parseEmployeeStatementOverrides(previewForm.employeeStatementsByEmployee);
    return (
      presentEmployeeCount > 0 &&
      statementGroups.length >= presentEmployeeCount &&
      statementGroups.slice(0, presentEmployeeCount).every((group) => hasEditablePreviewText(group))
    );
  })();
  const isPreviewDownloadReady =
    hasCompleteEmployeeStatements &&
    hasEditablePreviewText(previewForm.employerStatement) &&
    hasEditablePreviewText(previewForm.employerEvidence) &&
    (usesNoEmployeeEvidenceMessage || hasEditablePreviewText(previewForm.employeeEvidence)) &&
    hasEditablePreviewText(previewForm.analysisDetail) &&
    hasEditablePreviewText(previewForm.analysisFinding) &&
    hasEditablePreviewText(previewForm.aggravatingFactors) &&
    (usesNoMitigatingFactorsMessage || hasEditablePreviewText(previewForm.mitigatingFactors)) &&
    (!hasRecommendationSection || hasEditablePreviewText(previewForm.recommendation));

  useEffect(() => {
    onStepMetaChange?.({
      steps,
      activeStep: isFinished ? 2 : activeStep,
      icons: stepIcons,
      canGoBack: isFinished || activeStep > 0,
      canGoNext:
        isFinished
          ? isPreviewDownloadReady
          : activeStep === 0
            ? isPartiesStepValid
            : activeStep === 1
              ? isHearingDetailsStepValid
              : false,
      supportsPreviewEditToggle: true,
      isPreviewEditable,
      canSelectStep: (index) => {
        if (index < 0 || index > 2) return false;
        if (isFinished) return true;
        if (activeStep === 0) return index === 0;
        if (activeStep === 1) return index <= 1;
        return false;
      },
      onBack: () => {
        if (isFinished) {
          setIsFinished(false);
          setIsPreviewEditable(false);
          return;
        }
        setActiveStep((current) => Math.max(0, current - 1));
      },
      onNext: () => {
        if (isFinished) {
          downloadPdfRef.current?.();
          return;
        }
        if (activeStep === 0) {
          if (!isPartiesStepValid) return;
          setActiveStep(1);
          return;
        }
        if (activeStep === 1 && isHearingDetailsStepValid) {
          setIsFinished(true);
          setIsPreviewEditable(false);
        }
      },
      onStepSelect: (index) => {
        if (index < 0 || index > 2) return;
        if (isFinished) {
          setIsFinished(false);
          setIsPreviewEditable(false);
        }
        if (!isFinished && activeStep === 0 && index !== 0) return;
        if (!isFinished && activeStep === 1 && index > 1) return;
        setActiveStep(Math.max(0, Math.min(index, 1)));
      },
      onClear: () => {
        if (isFinished) {
          setIsPreviewEditable((current) => !current);
          return;
        }
        if (activeStep === 0) {
          setClientForm(emptyClientFormState);
          setEmployeeForms([emptyEmployeeFormState]);
          setEmployeeHearingDetailsForms([createEmptyHearingDetailsFormState()]);
          setCollapsedEmployeeHearingSectionIndexes([]);
          setClientSearchOpen(false);
          return;
        }
        if (activeStep === 1) {
          const clearedPrimaryForm = {
            ...emptyHearingDetailsFormState,
            hearingFormat: "in_person" as const,
            hearingVenue: defaultClientVenue,
          };
          setHearingDetailsForm(clearedPrimaryForm);
          setEmployeeHearingDetailsForms(
            employeeForms.map((_, index) =>
              index === 0 ? clearedPrimaryForm : createEmptyHearingDetailsFormState("None", defaultClientVenue),
            ),
          );
          setCollapsedEmployeeHearingSectionIndexes([]);
          setHasRecommendationSection(false);
          setChargePickerOpen(false);
          setActiveEmployeeChargePickerIndex(null);
          setChargeSearchValue("");
          setEmployeeChargeSearchValues({});
          setBargainingCouncilPickerOpen(false);
          setActiveEmployeeBargainingCouncilPickerIndex(null);
          setBargainingCouncilSearchValue("");
          setEmployeeBargainingCouncilSearchValues({});
          return;
        }
      },
      supportsResetAtFirstStep: Boolean(clientForm.clientId.trim()),
      temporaryEmployeeCount: employeeForms.length,
      isFinished,
    });
  }, [activeStep, clientForm.clientId, defaultClientVenue, employeeForms.length, isPartiesStepValid, isFinished, isHearingDetailsStepValid, isPreviewDownloadReady, isPreviewEditable, onStepMetaChange]);

  const selectedClientLabel = clientForm.clientId ? clientForm.clientName : "Select client";
  const filteredBargainingCouncilOptions = useMemo(() => {
    const searchValue = bargainingCouncilSearchValue.trim().toLowerCase();
    if (!searchValue) return bargainingCouncilOptions;
    return bargainingCouncilOptions.filter(
      (option) =>
        option.label.toLowerCase().includes(searchValue) ||
        option.value.toLowerCase().includes(searchValue),
    );
  }, [bargainingCouncilSearchValue]);
  const selectedBargainingCouncilLabel = hearingDetailsForm.bargainingCouncil || "None";
  const visibleHearingProcessOptions = useMemo(() => {
    if (hearingDetailsForm.employeeAttendance === "Present") {
      return hearingProcessOptions.filter((option) => option !== "Continued in absence");
    }
    if (hearingDetailsForm.employeeAttendance === "Absent") {
      return hearingProcessOptions.filter((option) => option !== "Continued");
    }
    return hearingProcessOptions;
  }, [hearingDetailsForm.employeeAttendance]);
  const filteredClientRows = useMemo(() => {
    const searchValue = clientSearchValue.trim().toLowerCase();
    if (!searchValue) return clientRows;
    return clientRows.filter((client) => {
      const registeredName = String(client.registered_name || "").trim().toLowerCase();
      const tradingAsName = String(client.trading_as || "").trim().toLowerCase();
      return registeredName.startsWith(searchValue) || tradingAsName.startsWith(searchValue);
    });
  }, [clientRows, clientSearchValue]);

  const handleClientSelect = (clientId: string) => {
    const selectedClient = clientRows.find((row) => row.id === clientId);
    if (!selectedClient) return;
    const nextClientForm = mapClientToFormState(selectedClient);
    const nextDefaultVenue = getDefaultVenueForClientForm(nextClientForm);
    setClientForm(nextClientForm);
    setEmployeeForms([emptyEmployeeFormState]);
    setHearingDetailsForm({
      ...emptyHearingDetailsFormState,
      hearingFormat: "in_person",
      hearingVenue: nextDefaultVenue,
      bargainingCouncil: normalizeClientBargainingCouncil(selectedClient.bargaining_council),
    });
    setEmployeeHearingDetailsForms([
      {
        ...emptyHearingDetailsFormState,
        hearingFormat: "in_person",
        hearingVenue: nextDefaultVenue,
        bargainingCouncil: normalizeClientBargainingCouncil(selectedClient.bargaining_council),
      },
    ]);
    setCollapsedEmployeeHearingSectionIndexes([]);
    setPreviewForm(emptyPreviewFormState);
    setActiveStep(0);
    setIsFinished(false);
    setHasRecommendationSection(false);
    setIsPreviewEditable(false);
    setClientSearchValue("");
    setClientSearchOpen(false);
  };

  const handleEmployeeFieldChange = (index: number, field: keyof EmployeeFormState, value: string) => {
    setEmployeeForms((current) =>
      current.map((employee, employeeIndex) =>
        employeeIndex === index
          ? {
              ...employee,
              [field]: value,
            }
          : employee,
      ),
    );
  };

  const handleAddEmployee = () => {
    setEmployeeForms((current) => [...current, emptyEmployeeFormState]);
    setEmployeeHearingDetailsForms((current) => [
      ...current,
      createEmptyHearingDetailsFormState(hearingDetailsForm.bargainingCouncil, defaultClientVenue),
    ]);
  };

  const handleRemoveEmployee = (index: number) => {
    setEmployeeForms((current) => (current.length <= 1 ? current : current.filter((_, employeeIndex) => employeeIndex !== index)));
    setEmployeeHearingDetailsForms((current) => (current.length <= 1 ? current : current.filter((_, employeeIndex) => employeeIndex !== index)));
    setCollapsedEmployeeHearingSectionIndexes((current) =>
      current
        .filter((employeeIndex) => employeeIndex !== index)
        .map((employeeIndex) => (employeeIndex > index ? employeeIndex - 1 : employeeIndex)),
    );
  };

  const handleHearingDetailsFieldChange = <T extends keyof HearingDetailsFormState>(
    field: T,
    value: HearingDetailsFormState[T],
  ) => {
    if (field === "hearingFormat") {
      const nextFormat = value as HearingFormat;
      const nextVenue = nextFormat === "virtual" ? getDefaultVirtualHearingVenue() : defaultClientVenue;
      setHearingDetailsForm((current) => ({
        ...current,
        hearingFormat: nextFormat,
        hearingVenue: nextVenue,
      }));
      setEmployeeHearingDetailsForms((current) => {
        if (current.length === 0) {
          return [
            {
              ...createEmptyHearingDetailsFormState("None", defaultClientVenue),
              hearingFormat: nextFormat,
              hearingVenue: nextVenue,
            },
          ];
        }
        return current.map((form, index) =>
          index === 0
            ? {
                ...form,
                hearingFormat: nextFormat,
                hearingVenue: nextVenue,
              }
            : form,
        );
      });
      return;
    }
    setHearingDetailsForm((current) => ({
      ...current,
      [field]: value,
    }));
    setEmployeeHearingDetailsForms((current) => {
      if (current.length === 0) {
        return [
          {
            ...createEmptyHearingDetailsFormState(),
            [field]: value,
          },
        ];
      }
      return current.map((form, index) =>
        index === 0
          ? {
              ...form,
              [field]: value,
            }
          : form,
      );
    });
  };

  const handleEmployeeHearingDetailsFieldChange = <T extends keyof HearingDetailsFormState>(
    employeeIndex: number,
    field: T,
    value: HearingDetailsFormState[T],
  ) => {
    if (field === "hearingFormat") {
      const nextFormat = value as HearingFormat;
      const nextVenue = nextFormat === "virtual" ? getDefaultVirtualHearingVenue() : defaultClientVenue;
      setEmployeeHearingDetailsForms((current) =>
        current.map((form, index) =>
          index === employeeIndex
            ? {
                ...form,
                hearingFormat: nextFormat,
                hearingVenue: nextVenue,
              }
            : form,
        ),
      );
      if (employeeIndex === 0) {
        setHearingDetailsForm((current) => ({
          ...current,
          hearingFormat: nextFormat,
          hearingVenue: nextVenue,
        }));
      }
      return;
    }
    setEmployeeHearingDetailsForms((current) =>
      current.map((form, index) =>
        index === employeeIndex
          ? {
              ...form,
              [field]: value,
            }
          : form,
      ),
    );
    if (employeeIndex === 0) {
      setHearingDetailsForm((current) => ({
        ...current,
        [field]: value,
      }));
    }
  };

  const handleEmployeeAttendanceChange = (value: EmployeeAttendance) => {
    let nextPrimaryForm: HearingDetailsFormState | null = null;
    setHearingDetailsForm((current) => {
      const visibleOptions: readonly HearingProcess[] =
        value === "Present"
          ? hearingProcessOptions.filter((option) => option !== "Continued in absence")
          : hearingProcessOptions.filter((option) => option !== "Continued");
      const defaultProcess = value === "Present" ? "Continued" : "Continued in absence";
      nextPrimaryForm = {
        ...current,
        employeeAttendance: value,
        hearingProcess: visibleOptions.includes(current.hearingProcess as HearingProcess) ? current.hearingProcess : defaultProcess,
      };
      return nextPrimaryForm;
    });
    setEmployeeHearingDetailsForms((current) => {
      const nextForm = nextPrimaryForm ?? {
        ...createEmptyHearingDetailsFormState(),
        employeeAttendance: value,
        hearingProcess: value === "Present" ? "Continued" : "Continued in absence",
      };
      if (current.length === 0) return [nextForm];
      return current.map((form, index) => (index === 0 ? nextForm : form));
    });
  };

  const handleEmployeeSectionAttendanceChange = (employeeIndex: number, value: EmployeeAttendance) => {
    setEmployeeHearingDetailsForms((current) =>
      current.map((form, index) => {
        if (index !== employeeIndex) return form;
        const visibleOptions: readonly HearingProcess[] =
          value === "Present"
            ? hearingProcessOptions.filter((option) => option !== "Continued in absence")
            : hearingProcessOptions.filter((option) => option !== "Continued");
        const defaultProcess = value === "Present" ? "Continued" : "Continued in absence";
        return {
          ...form,
          employeeAttendance: value,
          hearingProcess: visibleOptions.includes(form.hearingProcess as HearingProcess) ? form.hearingProcess : defaultProcess,
        };
      }),
    );
    if (employeeIndex === 0) {
      handleEmployeeAttendanceChange(value);
    }
  };

  const handlePleaChange = (charge: string, plea: PleaOption) => {
    setHearingDetailsForm((current) => ({
      ...current,
      pleasByCharge: {
        ...current.pleasByCharge,
        [charge]: plea,
      },
    }));
    setEmployeeHearingDetailsForms((current) => {
      if (current.length === 0) {
        return [
          {
            ...createEmptyHearingDetailsFormState(),
            pleasByCharge: {
              [charge]: plea,
            },
          },
        ];
      }
      return current.map((form, index) =>
        index === 0
          ? {
              ...form,
              pleasByCharge: {
                ...form.pleasByCharge,
                [charge]: plea,
              },
            }
          : form,
      );
    });
  };

  const handleEmployeePleaChange = (employeeIndex: number, charge: string, plea: PleaOption) => {
    setEmployeeHearingDetailsForms((current) =>
      current.map((form, index) =>
        index === employeeIndex
          ? {
              ...form,
              pleasByCharge: {
                ...form.pleasByCharge,
                [charge]: plea,
              },
            }
          : form,
      ),
    );
    if (employeeIndex === 0) {
      handlePleaChange(charge, plea);
    }
  };

  const closeParagraphEditor = () => {
    setEditingParagraphId(null);
    setEditingParagraphLabel("");
    setEditingParagraphDraft("");
    setEditingEmployeeStatementGroupIndex(null);
  };

  const openAddRecommendationForm = () => {
    setRecommendationDraft(previewForm.recommendation.trim());
    setIsAddRecommendationOpen(true);
  };

  const closeAddRecommendationForm = () => {
    setIsAddRecommendationOpen(false);
    setRecommendationDraft("");
  };

  const saveAddRecommendationForm = () => {
    const nextRecommendation = recommendationDraft.trim();
    if (!nextRecommendation) {
      toast({
        title: "Add section",
        description: "Please provide recommendation text.",
        variant: "destructive",
      });
      return;
    }
    setPreviewForm((current) => ({
      ...current,
      recommendation: nextRecommendation,
    }));
    setHasRecommendationSection(true);
    closeAddRecommendationForm();
  };

  const removeRecommendationSection = () => {
    setHasRecommendationSection(false);
    setPreviewForm((current) => ({
      ...current,
      recommendation: "",
    }));
  };

  const saveParagraphEditor = () => {
    if (!editingParagraphId) return;
    const normalizedDraft = parseEditorDraft(editingParagraphDraft);
    if (!normalizedDraft.trim()) {
      toast({
        title: "Edit paragraph",
        description: "Paragraph text cannot be empty.",
        variant: "destructive",
      });
      return;
    }
    if (editingParagraphId === "preliminarySection") {
      const rawLines = String(editingParagraphDraft || "").split(/\r?\n/);
      const lines = splitEditorDraftLines(editingParagraphDraft);
      const preliminaryNumbers = getPreliminarySectionEditorNumbers(rawLines);
      const chargeMainParagraphCount = isSingleEmployeeFlow ? 1 : employeeHearingSummaryRows.length;
      const mainParagraphIndexes = preliminaryNumbers
        .map((number, index) => ({ number, index }))
        .filter((entry) => entry.index >= 3 && /^\d+\.$/.test(entry.number))
        .map((entry) => entry.index);
      const extraParagraphStartIndex = mainParagraphIndexes[chargeMainParagraphCount] ?? lines.length;
      const chargeMainParagraphIndexes = mainParagraphIndexes.slice(0, chargeMainParagraphCount);
      const chargePleaLines = preliminaryNumbers
        .map((number, index) => ({ number, index }))
        .filter((entry) => entry.index >= 3 && entry.index < extraParagraphStartIndex && /^\d+\.\d+$/.test(entry.number))
        .map((entry) => lines[entry.index] || "");
      setPreviewForm((current) => ({
        ...current,
        preliminaryOne: (lines[0] || "").trim(),
        preliminaryTwo: (lines[1] || "").trim(),
        preliminaryThree: (lines[2] || "").trim(),
        preliminaryFour: (lines[3] || "").trim(),
        preliminaryPleaOverrides: isSingleEmployeeFlow ? chargePleaLines.map((line) => line.trim()).filter(Boolean).join("\n") : current.preliminaryPleaOverrides,
        preliminaryChargeParagraphOverrides: !isSingleEmployeeFlow
          ? chargeMainParagraphIndexes.map((index) => (lines[index] || "").trim()).filter(Boolean).join("\n")
          : current.preliminaryChargeParagraphOverrides,
        preliminaryChargePleaOverrides: !isSingleEmployeeFlow
          ? chargePleaLines.map((line) => line.trim()).filter(Boolean).join("\n")
          : current.preliminaryChargePleaOverrides,
        preliminaryProcess: (lines[extraParagraphStartIndex] || "").trim(),
        preliminaryExtra: lines.slice(extraParagraphStartIndex + 1).map((line) => line.trim()).filter(Boolean).join("\n"),
      }));
      closeParagraphEditor();
      return;
    }
    if (editingParagraphId === "issueSection") {
      const lines = splitEditorDraftLines(editingParagraphDraft);
      setPreviewForm((current) => ({
        ...current,
        issueInDispute: lines.map((line) => line.trim()).filter(Boolean).join("\n"),
      }));
      closeParagraphEditor();
      return;
    }
    if (editingParagraphId === "employeeStatementGroup") {
      const rawLines = String(editingParagraphDraft || "").split(/\r?\n/);
      const lines = splitEditorDraftLines(editingParagraphDraft);
      const groupLines = rawLines
        .map((rawLine, index) => {
          const numberMatch = String(rawLine || "").trim().match(/^(\d+(?:\.\d+)?)\.?/);
          const number = numberMatch?.[1] || "";
          if (/^\d+\.\d+$/.test(number)) return (lines[index] || "").trim();
          return "";
        })
        .filter(Boolean);
      if (isSingleEmployeeFlow) {
        setPreviewForm((current) => ({
          ...current,
          employeeStatement: groupLines.join("\n"),
        }));
      } else {
        const statementGroups = parseEmployeeStatementOverrides(previewForm.employeeStatementsByEmployee);
        const targetIndex = editingEmployeeStatementGroupIndex ?? 0;
        const nextGroups = Array.from({ length: Math.max(statementGroups.length, presentEmployeeStatementRows.length) }).map(
          (_, index) => (index === targetIndex ? groupLines.join("\n") : statementGroups[index] || ""),
        );
        setPreviewForm((current) => ({
          ...current,
          employeeStatementsByEmployee: JSON.stringify(nextGroups),
        }));
      }
      closeParagraphEditor();
      return;
    }
    if (editingParagraphId === "analysisSection") {
      const lines = splitEditorDraftLines(editingParagraphDraft);
      setPreviewForm((current) => ({
        ...current,
        analysisIntro: (lines[0] || "").trim(),
        analysisDetail: (lines[1] || "").trim(),
        analysisFinding: lines.slice(2).join("\n").trim(),
      }));
      closeParagraphEditor();
      return;
    }
    setPreviewForm((current) => ({
      ...current,
      [editingParagraphId]: normalizedDraft,
    }));
    closeParagraphEditor();
  };

  const handleEditingParagraphKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    if (!editingParagraphId) return;
    const lines = textarea.value.split(/\r?\n/);
    const lineIndex = textarea.value.slice(0, textarea.selectionStart).split(/\r?\n/).length - 1;
    const lineStart = textarea.value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const currentLine = lines[lineIndex] || "";
    const fallbackPrefix = getEditorParagraphPrefix(editingParagraphId, lineIndex);
    const actualPrefix = currentLine.match(/^\s*\d+(?:\.\d+)?\.?\s*/)?.[0] || fallbackPrefix;
    const minPosition = lineStart + actualPrefix.length;
    if (event.key === "Home") {
      event.preventDefault();
      requestAnimationFrame(() => {
        editingTextareaRef.current?.setSelectionRange(minPosition, minPosition);
      });
      return;
    }
    if (event.key === "Backspace" && textarea.selectionStart === textarea.selectionEnd) {
      const currentContent = stripParagraphNumberPrefix(currentLine);
      if (!currentContent && lineIndex > 0) {
        if (editingParagraphId === "employeeStatementGroup" && lineIndex === 1) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        const nextLines = lines.filter((_, index) => index !== lineIndex);
        const renumbered = renumberEditorDraft(editingParagraphId, nextLines);
        setEditingParagraphDraft(renumbered);
        requestAnimationFrame(() => {
          const previousLineText = nextLines[lineIndex - 1] || "";
          const previousPrefix = getEditorParagraphPrefix(editingParagraphId, lineIndex - 1);
          const previousContentLength = stripParagraphNumberPrefix(previousLineText).length;
          const lineOffset = previousPrefix.length + previousContentLength;
          const finalPosition = renumbered
            .split(/\r?\n/)
            .slice(0, lineIndex - 1)
            .reduce((total, line) => total + line.length + 1, 0) + lineOffset;
          editingTextareaRef.current?.setSelectionRange(finalPosition, finalPosition);
        });
        return;
      }
    }
    if ((event.key === "ArrowLeft" || event.key === "Backspace") && textarea.selectionStart <= minPosition && textarea.selectionEnd <= minPosition) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (editingParagraphId === "analysisIntro") {
        return;
      }
      const nextLines = [...lines];
      nextLines.splice(lineIndex + 1, 0, "");
      const renumbered = renumberEditorDraft(editingParagraphId, nextLines);
      setEditingParagraphDraft(renumbered);
      requestAnimationFrame(() => {
        const nextLineStart = renumbered
          .split(/\r?\n/)
          .slice(0, lineIndex + 1)
          .reduce((total, line) => total + line.length + 1, 0);
        const nextPrefix = getEditorParagraphPrefix(editingParagraphId, lineIndex + 1);
        const nextCaretPosition = nextLineStart + nextPrefix.length;
        editingTextareaRef.current?.setSelectionRange(nextCaretPosition, nextCaretPosition);
      });
    }
  };

  const handleToggleCharge = (charge: string) => {
    let nextPrimaryForm: HearingDetailsFormState | null = null;
    setHearingDetailsForm((current) => {
      const isSelected = current.misconductTypes.includes(charge);
      const nextMisconductTypes = isSelected
        ? current.misconductTypes.filter((item) => item !== charge)
        : [...current.misconductTypes, charge];
      const nextPleasByCharge = { ...current.pleasByCharge };
      if (isSelected) {
        delete nextPleasByCharge[charge];
      } else if (!nextPleasByCharge[charge]) {
        nextPleasByCharge[charge] = "";
      }
      nextPrimaryForm = {
        ...current,
        misconductTypes: nextMisconductTypes,
        pleasByCharge: nextPleasByCharge,
      };
      return nextPrimaryForm;
    });
    setEmployeeHearingDetailsForms((current) => {
      const nextForm = nextPrimaryForm ?? createEmptyHearingDetailsFormState();
      if (current.length === 0) return [nextForm];
      return current.map((form, index) => (index === 0 ? nextForm : form));
    });
  };

  const handleEmployeeToggleCharge = (employeeIndex: number, charge: string) => {
    setEmployeeHearingDetailsForms((current) =>
      current.map((form, index) => {
        if (index !== employeeIndex) return form;
        const isSelected = form.misconductTypes.includes(charge);
        const nextMisconductTypes = isSelected
          ? form.misconductTypes.filter((item) => item !== charge)
          : [...form.misconductTypes, charge];
        const nextPleasByCharge = { ...form.pleasByCharge };
        if (isSelected) {
          delete nextPleasByCharge[charge];
        } else if (!nextPleasByCharge[charge]) {
          nextPleasByCharge[charge] = "";
        }
        return {
          ...form,
          misconductTypes: nextMisconductTypes,
          pleasByCharge: nextPleasByCharge,
        };
      }),
    );
    if (employeeIndex === 0) {
      handleToggleCharge(charge);
    }
  };

  const toggleEmployeeHearingSection = (employeeIndex: number) => {
    setCollapsedEmployeeHearingSectionIndexes((current) =>
      current.includes(employeeIndex)
        ? current.filter((index) => index !== employeeIndex)
        : [...current, employeeIndex],
    );
  };

  const selectedChargeLabel =
    hearingDetailsForm.misconductTypes.length === 0
      ? "Select misconduct type(s)"
      : hearingDetailsForm.misconductTypes.length === 1
        ? hearingDetailsForm.misconductTypes[0]
        : `${hearingDetailsForm.misconductTypes.length} misconduct type(s) selected`;
  const misconductListLabel = joinWithAnd(hearingDetailsForm.misconductTypes);
  const preliminaryPleaOverrideLines = normalizeParagraphText(previewForm.preliminaryPleaOverrides);
  const hearingVenueLabel = hearingDetailsForm.hearingVenue.trim() || defaultClientVenue || "CITY, PROVINCE";
  const documentVenueHeading =
    hearingDetailsForm.hearingFormat === "virtual"
      ? `HELD VIRTUALLY VIA ${hearingVenueLabel.toUpperCase()}`
      : `HELD AT ${hearingVenueLabel.toUpperCase()}`;
  const clientMatterName = (clientForm.clientName || "EMPLOYER NAME").toUpperCase();
  const normalizedEmployees = employeeForms.length > 0 ? employeeForms : [emptyEmployeeFormState];
  const employeeFullNames = normalizedEmployees.map((employee) => {
    const fullName = [employee.employeeName, employee.employeeSurname].filter(Boolean).join(" ").trim();
    return fullName || "______________________________";
  });
  const employeeMatterNames = employeeFullNames.map((name) => name.toUpperCase() || "EMPLOYEE NAME");
  const ordinalEmployeeLabels = ["First Employee", "Second Employee", "Third Employee", "Fourth Employee", "Fifth Employee", "Sixth Employee"];
  const employeeRoleLabels = employeeMatterNames.map((_, index) =>
    employeeMatterNames.length > 1 ? ordinalEmployeeLabels[index] || `Employee ${index + 1}` : "Employee",
  );
  const employerStatementValue = previewForm.employerStatement.trim() || editablePlaceholderText;
  const employerEvidenceValue = previewForm.employerEvidence.trim() || editablePlaceholderText;
  const employeeEvidenceValue = previewForm.employeeEvidence.trim() || editablePlaceholderText;
  const preliminaryChargeParagraphOverrideLines = normalizeParagraphText(previewForm.preliminaryChargeParagraphOverrides);
  const preliminaryChargePleaOverrideLines = normalizeParagraphText(previewForm.preliminaryChargePleaOverrides);
  const selectedMisconductCount = hearingDetailsForm.misconductTypes.length;
  const employeeHearingSummaryRows = normalizedEmployees.map((employee, index) => ({
    fullName: employeeRoleLabels[index] || `Employee ${index + 1}`,
    referenceLabel: `The ${employeeRoleLabels[index] || `Employee ${index + 1}`}`,
    inlineReferenceLabel: `the ${employeeRoleLabels[index] || `Employee ${index + 1}`}`,
    hearingDetails: isSingleEmployeeFlow ? hearingDetailsForm : (employeeHearingDetailsForms[index] || createEmptyHearingDetailsFormState(hearingDetailsForm.bargainingCouncil)),
  }));
  const presentEmployeeStatementRows = employeeHearingSummaryRows.filter((row) => row.hearingDetails.employeeAttendance === "Present");
  const employeeStatementOverrideGroups = parseEmployeeStatementOverrides(previewForm.employeeStatementsByEmployee);
  const employeeStatementGroups = isSingleEmployeeFlow
    ? [normalizeParagraphText(previewForm.employeeStatement.trim() || editablePlaceholderText)]
    : presentEmployeeStatementRows.map((_, index) =>
        normalizeParagraphText(employeeStatementOverrideGroups[index] || editablePlaceholderText),
      );
  const employeeStatementValue = previewForm.employeeStatement.trim() || editablePlaceholderText;
  const getRepresentationSentencePart = (representation: RepresentationOption | "") => {
    if (representation === "Conduct own defense") return "elected to conduct own defence.";
    if (representation) return `elected to be represented by ${withIndefiniteArticle(representation)}.`;
    return "";
  };
  const employeeAttendanceSentence = (() => {
    if (employeeHearingSummaryRows.length <= 1) {
      const activeHearingDetails = employeeHearingSummaryRows[0]?.hearingDetails || hearingDetailsForm;
      const representationSentence =
        activeHearingDetails.representation === "Conduct own defense"
          ? " and represented him/her self."
          : activeHearingDetails.representation
            ? ` and was represented by ${withIndefiniteArticle(activeHearingDetails.representation)}.`
            : ".";
      const hearingProcessLower = toSentenceCaseLower(activeHearingDetails.hearingProcess);
      return activeHearingDetails.employeeAttendance === "Absent"
        ? activeHearingDetails.hearingProcess === "Continued in absence"
          ? "The employee was absent at the hearing and the hearing continued in his/her absence."
          : hearingProcessLower
            ? `The employee was absent at the hearing and the hearing was ${hearingProcessLower}.`
            : "The employee was absent at the hearing."
        : `The employee was ${String(activeHearingDetails.employeeAttendance || "______________________________").toLowerCase()} at the hearing${representationSentence}`;
    }

    const presentEmployees = employeeHearingSummaryRows.filter((row) => row.hearingDetails.employeeAttendance === "Present");
    const absentEmployees = employeeHearingSummaryRows.filter((row) => row.hearingDetails.employeeAttendance === "Absent");
    const allPresent = presentEmployees.length === employeeHearingSummaryRows.length;
    const allPresentRepresentations = Array.from(new Set(presentEmployees.map((row) => row.hearingDetails.representation).filter(Boolean)));

    if (allPresent) {
      if (allPresentRepresentations.length === 1 && allPresentRepresentations[0] === "Conduct own defense") {
        return "The employees were present at the hearing and represented themselves.";
      }
      if (allPresentRepresentations.length === 1 && allPresentRepresentations[0]) {
        return `The employees were present at the hearing and were represented by ${withIndefiniteArticle(allPresentRepresentations[0])}.`;
      }
      const representationSentences = presentEmployees
        .map((row) => {
          const representationPart = getRepresentationSentencePart(row.hearingDetails.representation);
          return representationPart ? `${row.referenceLabel} ${representationPart}` : "";
        })
        .filter(Boolean)
        .join(" ");
      return `The employees were present at the hearing.${representationSentences ? ` ${representationSentences}` : ""}`;
    }

    const attendanceSentenceParts: string[] = [];
    if (presentEmployees.length > 0) {
      attendanceSentenceParts.push(
        `${joinEmployeeReferences(
          presentEmployees.map((row, index) => (index === 0 ? row.referenceLabel : row.inlineReferenceLabel)),
        )} ${presentEmployees.length > 1 ? "were" : "was"} present at the hearing`,
      );
    }
    if (absentEmployees.length > 0) {
      attendanceSentenceParts.push(
        `${joinEmployeeReferences(
          absentEmployees.map((row, index) =>
            presentEmployees.length === 0 && index === 0 ? row.referenceLabel : row.inlineReferenceLabel,
          ),
        )} ${absentEmployees.length > 1 ? "were" : "was"} absent`,
      );
    }
    const attendanceSentence = `${joinSentenceParts(attendanceSentenceParts)}.`;
    const representationSentences = presentEmployees
      .map((row) => {
        const representationPart = getRepresentationSentencePart(row.hearingDetails.representation);
        return representationPart ? `${row.referenceLabel} ${representationPart}` : "";
      })
      .filter(Boolean)
      .join(" ");
    return `${attendanceSentence}${representationSentences ? ` ${representationSentences}` : ""}`;
  })();
  const preliminaryOneValue =
    previewForm.preliminaryOne.trim() ||
    `The disciplinary hearing was held on ${formatDateLabel(hearingDetailsForm.hearingDate) || "______________________________"}.`;
  const preliminaryTwoValue = previewForm.preliminaryTwo.trim() || employeeAttendanceSentence;
  const preliminaryThreeValue =
    previewForm.preliminaryThree.trim() ||
    (() => {
      if (employeeHearingSummaryRows.length <= 1) {
        return `The employee received the notice to attend on ${formatDateLabel(hearingDetailsForm.noticeDate) || "______________________________"}.`;
      }

      const noticeDateGroups = employeeHearingSummaryRows.reduce<Array<{ noticeDate: string; names: string[] }>>((groups, row, rowIndex) => {
        const noticeDate = row.hearingDetails.noticeDate || "";
        const existingGroup = groups.find((group) => group.noticeDate === noticeDate);
        if (existingGroup) {
          existingGroup.names.push(existingGroup.names.length === 0 && groups.indexOf(existingGroup) === 0 ? row.referenceLabel : row.inlineReferenceLabel);
          return groups;
        }
        groups.push({ noticeDate, names: [rowIndex === 0 ? row.referenceLabel : row.inlineReferenceLabel] });
        return groups;
      }, []);

      if (noticeDateGroups.length === 1) {
        return `The employees received the notice to attend on ${formatDateLabel(noticeDateGroups[0].noticeDate) || "______________________________"}.`;
      }

      return `${joinSentenceParts(
        noticeDateGroups.map((group) => {
          const groupedNames = joinSentenceParts(group.names);
          const verb = group.names.length > 1 ? "received" : "received";
          return `${groupedNames} ${verb} the notice to attend on ${formatDateLabel(group.noticeDate) || "______________________________"}`;
        }),
      )}.`;
    })();
  const preliminaryChargeRows = (() => {
    if (isSingleEmployeeFlow) {
      const singleChargePlea = hearingDetailsForm.misconductTypes.length === 1
        ? toSentenceCaseLower(String(hearingDetailsForm.pleasByCharge[hearingDetailsForm.misconductTypes[0]] || "").trim())
        : "";
      const preliminaryFourValue =
        previewForm.preliminaryFour.trim() ||
        (selectedMisconductCount === 1 && singleChargePlea
          ? `The employee was charged with ${misconductListLabel} and pleaded ${singleChargePlea}.`
          : selectedMisconductCount > 0
            ? `The employee was charged with ${misconductListLabel}.`
            : "The employee was charged with ______________________________.");
      const defaultPleaRowValues = hearingDetailsForm.misconductTypes
        .map((type) => {
          const plea = toSentenceCaseLower(String(hearingDetailsForm.pleasByCharge[type] || "").trim());
          const charge = toSentenceCaseLower(type);
          return plea && charge
            ? plea === "no plea"
              ? `In respect of ${charge}, the employee entered no plea.`
              : `In respect of ${charge}, the employee pleaded ${plea}.`
            : "";
        })
        .filter(Boolean);
      const pleaRowValues = Array.from({
        length: Math.max(defaultPleaRowValues.length, preliminaryPleaOverrideLines.length),
      })
        .map((_, index) => preliminaryPleaOverrideLines[index] || defaultPleaRowValues[index] || "")
        .filter(Boolean);
      return [
        {
          number: "4.",
          value: preliminaryFourValue,
          subRows: pleaRowValues.map((value, index) => ({
            number: `4.${index + 1}`,
            value,
          })),
        },
      ];
    }

    let chargePleaOverrideCursor = 0;
    return employeeHearingSummaryRows.map((row, employeeIndex) => {
      const employeeCharges = row.hearingDetails.misconductTypes;
      const employeeChargeLabel = joinWithAnd(employeeCharges);
      const singleChargePlea = employeeCharges.length === 1
        ? toSentenceCaseLower(String(row.hearingDetails.pleasByCharge[employeeCharges[0]] || "").trim())
        : "";
      const mainValue =
        preliminaryChargeParagraphOverrideLines[employeeIndex] ||
        (employeeCharges.length === 1 && singleChargePlea
          ? `${row.referenceLabel} was charged with ${employeeChargeLabel} and pleaded ${singleChargePlea}.`
          : employeeCharges.length > 0
            ? `${row.referenceLabel} was charged with ${employeeChargeLabel}.`
            : `${row.referenceLabel} was charged with ______________________________.`);
      const subRows =
        employeeCharges.length > 1
          ? employeeCharges
              .map((type, chargeIndex) => {
                const plea = toSentenceCaseLower(String(row.hearingDetails.pleasByCharge[type] || "").trim());
                const charge = toSentenceCaseLower(type);
                const overrideValue = preliminaryChargePleaOverrideLines[chargePleaOverrideCursor];
                chargePleaOverrideCursor += 1;
                return {
                  number: `${4 + employeeIndex}.${chargeIndex + 1}`,
                  value:
                    overrideValue ||
                    (plea && charge
                      ? plea === "no plea"
                        ? `In respect of ${charge}, ${row.inlineReferenceLabel} entered no plea.`
                        : `In respect of ${charge}, ${row.inlineReferenceLabel} pleaded ${plea}.`
                      : ""),
                };
              })
              .filter((entry) => entry.value)
          : [];
      return {
        number: `${4 + employeeIndex}.`,
        value: mainValue,
        subRows,
      };
    });
  })();
  const preliminaryProcessValue =
    previewForm.preliminaryProcess.trim() ||
    (() => {
      const activeRows = employeeHearingSummaryRows.map((row) => ({
        ...row,
        process: row.hearingDetails.hearingProcess,
      }));
      const continuedRows = activeRows.filter((row) => row.process === "Continued");
      const proceededInAbsenceRows = activeRows.filter((row) => row.process === "Continued in absence");
      const postponedRows = activeRows.filter((row) => row.process === "Postponed");
      const withdrawnRows = activeRows.filter((row) => row.process === "Withdrawn");

      const sentences: string[] = [];
      if (proceededInAbsenceRows.length > 0) {
        sentences.push(
          `There were no objections to the continuation of the hearing, and the hearing proceeded in the absence of ${joinEmployeeReferences(
            proceededInAbsenceRows.map((row) => row.inlineReferenceLabel),
          )}.`,
        );
      } else if (continuedRows.length > 0) {
        sentences.push("There were no objections to the continuation of the hearing, and the hearing proceeded.");
      } else {
        sentences.push("There were no objections to the continuation of the hearing.");
      }

      if (postponedRows.length > 0) {
        sentences.push(
          postponedRows.length === 1
            ? `A postponement was granted in respect of ${postponedRows[0].inlineReferenceLabel}.`
            : `Postponements were granted in respect of ${joinEmployeeReferences(
                postponedRows.map((row, index) => (index === 0 ? row.referenceLabel : row.inlineReferenceLabel)),
              )}.`,
        );
      }

      if (withdrawnRows.length > 0) {
        sentences.push(
          withdrawnRows.length === 1
            ? `The disciplinary proceedings against ${withdrawnRows[0].inlineReferenceLabel} were withdrawn.`
            : `The disciplinary proceedings against ${joinEmployeeReferences(
                withdrawnRows.map((row, index) => (index === 0 ? row.referenceLabel : row.inlineReferenceLabel)),
              )} were withdrawn.`,
        );
      }

      return sentences.join(" ");
    })();
  const preliminaryRows = [
    {
      number: "1.",
      value: preliminaryOneValue,
      field: "preliminaryOne",
      label: "Preliminary paragraph 1",
    },
    {
      number: "2.",
      value: preliminaryTwoValue,
      field: "preliminaryTwo",
      label: "Preliminary paragraph 2",
    },
    {
      number: "3.",
      value: preliminaryThreeValue,
      field: "preliminaryThree",
      label: "Preliminary paragraph 3",
    },
    ...preliminaryChargeRows.map((row, index) => ({
      number: row.number,
      value: row.value,
      field: "preliminaryFour" as const,
      label: `Preliminary paragraph ${4 + index}`,
      subRows: row.subRows,
    })),
    {
      number: `${4 + preliminaryChargeRows.length}.`,
      value: preliminaryProcessValue,
      field: "preliminaryProcess" as const,
      label: "Preliminary process paragraph",
    },
    ...normalizeParagraphText(previewForm.preliminaryExtra).map((paragraph, index) => ({
      number: `${5 + preliminaryChargeRows.length + index}.`,
      value: paragraph,
      field: "preliminaryExtra" as const,
      label: "Preliminary paragraph",
    })),
  ];
  const firstIssueNumber = preliminaryRows.length + 1;
  const issueInDisputeValue = previewForm.issueInDispute.trim() || defaultIssueInDisputeParagraph;
  const defaultAnalysisIntroParagraph = `${defaultAnalysisFindingParagraph} ${
    employeeForms.length > 1
      ? "The employees were afforded proper notice of the proceedings, an opportunity to state their case, and the matter was dealt with in a procedurally fair manner."
      : "The employee was afforded proper notice of the proceedings, an opportunity to state his/her case, and the matter was dealt with in a procedurally fair manner."
  }`;
  const analysisIntroValue = previewForm.analysisIntro.trim() || defaultAnalysisIntroParagraph;
  const analysisDetailValue = previewForm.analysisDetail.trim() || editablePlaceholderText;
  const analysisFindingValue = previewForm.analysisFinding.trim() || editablePlaceholderText;
  const aggravatingFactorsValue = previewForm.aggravatingFactors.trim() || editablePlaceholderText;
  const mitigatingFactorsValue = previewForm.mitigatingFactors.trim() || editablePlaceholderText;
  const recommendationValue = previewForm.recommendation.trim() || editablePlaceholderText;
  const issueParagraphs = normalizeParagraphText(issueInDisputeValue);
  const issueRows = issueParagraphs.map((paragraph, index) => ({
    number: `${firstIssueNumber + index}.`,
    value: paragraph,
    field: "issueInDispute" as const,
    label: "Issue(s) In Dispute",
  }));
  const employerEvidenceParagraphs = normalizeParagraphText(employerEvidenceValue);
  const employeeEvidenceParagraphs = normalizeParagraphText(employeeEvidenceValue);
  const employeeEvidenceHeadingText = usesNoEmployeeEvidenceMessage
    ? "The employee submitted no evidence."
    : employeeForms.length > 1
      ? "The employees submitted the following evidence:"
      : "The employee submitted the following evidence:";
  const analysisFindingsHeadingValue = defaultAnalysisFindingsHeadingParagraph;
  const analysisDetailParagraphs = normalizeParagraphText(analysisDetailValue);
  const analysisParagraphs = normalizeParagraphText(analysisFindingValue);
  const aggravatingParagraphs = normalizeParagraphText(aggravatingFactorsValue);
  const mitigatingParagraphs = normalizeParagraphText(mitigatingFactorsValue);
  const recommendationParagraphs = normalizeParagraphText(recommendationValue);
  const employeeStatementNumber = firstIssueNumber + issueParagraphs.length;
  const employeeStatementMainParagraphCount = isSingleEmployeeFlow ? 1 : presentEmployeeStatementRows.length;
  const employerStatementNumber = employeeStatementNumber + employeeStatementMainParagraphCount;
  const employerEvidenceNumber = employerStatementNumber + 1;
  const employeeEvidenceNumber = employerEvidenceNumber + 1;
  const analysisIntroNumber = employeeEvidenceNumber + 1;
  const analysisDetailNumber = analysisIntroNumber + 1;
  const analysisFindingHeadingNumber = analysisDetailNumber + analysisDetailParagraphs.length;
  const aggravatingHeadingNumber = analysisFindingHeadingNumber + 1;
  const mitigatingHeadingNumber = aggravatingHeadingNumber + 1;
  const recommendationHeadingNumber = mitigatingHeadingNumber + 1;
  const recourseHeadingNumber = hasRecommendationSection
    ? recommendationHeadingNumber + recommendationParagraphs.length
    : mitigatingHeadingNumber + 1;
  const disputeForumText = getOutcomeDisputeForumText(hearingDetailsForm.bargainingCouncil);
  const appealNoticeDaysLabel = hearingDetailsForm.appealNoticeDays || "5";
  const appealNoticeDaysWord = appealNoticeWordByValue[appealNoticeDaysLabel] || "FIVE";
  const recourseParagraph =
    employeeForms.length > 1
      ? `If the employer chooses to dismiss any of the employees, they must be notified that they may refer a dispute to ${disputeForumText} within 30 (THIRTY) days of dismissal or alternatively, apply for an appeal to the outcome within ${appealNoticeDaysLabel} (${appealNoticeDaysWord}) days of dismissal.`
      : `If the employer chooses to dismiss the employee, he/she must be notified that he/she may refer a dispute to ${disputeForumText} within 30 (THIRTY) days of dismissal or alternatively, apply for an appeal to the outcome within ${appealNoticeDaysLabel} (${appealNoticeDaysWord}) days of dismissal.`;
  const recourseParagraphNumber = `${recourseHeadingNumber}.`;
  const signingPlaceValue = previewForm.signingPlace.trim();
  const signingDayValue = previewForm.signingDay.trim();
  const signingDayOrdinalSuffix = getOrdinalSuffix(signingDayValue);
  const signingMonthValue = previewForm.signingMonth.trim();
  const signingYearValue = String(new Date().getFullYear());

  async function handleDownloadPdf() {
    if (!isPreviewDownloadReady) {
      toast({
        title: "Complete preview",
        description: "Please complete all required preview paragraphs before downloading.",
        variant: "destructive",
      });
      return;
    }

    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 20;
    const marginTop = 20;
    const marginBottom = 18;
    const usableWidth = pageWidth - marginX * 2;
    const bodyLimitY = pageHeight - marginBottom;
    const numberColumnWidth = 8;
    const nestedNumberColumnWidth = 12;
    const paragraphLineHeight = 4.9;
    const paragraphGap = 2.4;
    const sectionGap = 4.2;
    let cursorY = marginTop;

    const startPage = () => {
      pdf.addPage();
      cursorY = marginTop;
    };

    const keepRoom = (height: number) => {
      if (cursorY + height <= bodyLimitY) return;
      startPage();
    };

    const textLines = (text: string, width: number) => pdf.splitTextToSize(text, width).map((line) => String(line));

    const keepLineRoom = () => {
      if (cursorY + paragraphLineHeight <= bodyLimitY) return;
      startPage();
    };

    const writeJustifiedLine = (line: string, x: number, y: number, width: number, isLastLine: boolean) => {
      const lineText = String(line);
      const words = lineText.trim().split(/\s+/).filter(Boolean);
      if (isLastLine || words.length <= 1) {
        pdf.text(lineText, x, y);
        return;
      }

      const extraSpace = width - pdf.getTextWidth(lineText);
      const gapCount = words.length - 1;
      let wordX = x;
      words.forEach((word, wordIndex) => {
        pdf.text(word, wordX, y);
        wordX += pdf.getTextWidth(word);
        if (wordIndex < gapCount) {
          wordX += pdf.getTextWidth(" ") + extraSpace / gapCount;
        }
      });
    };

    const writeCenteredLine = (text: string, size: number, fontStyle: "normal" | "bold", gapAfter: number) => {
      keepRoom(5 + gapAfter);
      pdf.setFont("helvetica", fontStyle);
      pdf.setFontSize(size);
      pdf.setTextColor(0, 0, 0);
      pdf.text(text, pageWidth / 2, cursorY, { align: "center" });
      cursorY += 5 + gapAfter;
    };

    const writeMatterRow = (leftText: string, rightText: string, boldLeft = false) => {
      const rightWidth = 34;
      const leftWidth = usableWidth - rightWidth - 8;
      const leftLines = textLines(leftText, leftWidth);
      const rowHeight = Math.max(leftLines.length * paragraphLineHeight, paragraphLineHeight);
      keepRoom(rowHeight + 1.4);
      pdf.setFont("helvetica", boldLeft ? "bold" : "normal");
      pdf.setFontSize(10);
      leftLines.forEach((line, index) => {
        pdf.text(line, marginX, cursorY + index * paragraphLineHeight);
      });
      pdf.setFont("helvetica", "normal");
      pdf.text(rightText, pageWidth - marginX, cursorY, { align: "right" });
      cursorY += rowHeight + 1.4;
    };

    const writePlainParagraph = (text: string, options?: { indent?: number; size?: number; bold?: boolean; gapAfter?: number }) => {
      const indent = options?.indent ?? 0;
      const width = usableWidth - indent;
      const lines = textLines(text, width);
      pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
      pdf.setFontSize(options?.size ?? 10);
      lines.forEach((line) => {
        keepLineRoom();
        pdf.text(line, marginX + indent, cursorY);
        cursorY += paragraphLineHeight;
      });
      cursorY += options?.gapAfter ?? paragraphGap;
    };

    const writeSectionHeading = (heading: string) => {
      const lines = textLines(heading.toUpperCase(), usableWidth);
      keepRoom(lines.length * 4.2 + 2.2 + paragraphLineHeight);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.4);
      lines.forEach((line, index) => {
        const lineY = cursorY + index * 4.2;
        pdf.text(line, marginX, lineY);
        const lineWidth = pdf.getTextWidth(line);
        pdf.setLineWidth(0.15);
        pdf.line(marginX, lineY + 0.8, marginX + lineWidth, lineY + 0.8);
      });
      cursorY += lines.length * 4.2 + 4;
    };

    const writeNumberedParagraph = (number: string, text: string, options?: { nested?: boolean; gapAfter?: number }) => {
      const numberWidth = options?.nested ? nestedNumberColumnWidth : numberColumnWidth;
      const leftOffset = numberColumnWidth + 4;
      const lines = textLines(text, usableWidth - leftOffset);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      lines.forEach((line, index) => {
        keepLineRoom();
        if (index === 0) {
          pdf.text(number, marginX, cursorY);
        }
        writeJustifiedLine(line, marginX + leftOffset, cursorY, usableWidth - leftOffset, index === lines.length - 1);
        cursorY += paragraphLineHeight;
      });
      cursorY += options?.gapAfter ?? paragraphGap;
    };

    const writeSigningStatement = () => {
      const segments: Array<{ text: string; bold?: boolean; size?: number; yOffset?: number }> = [
        { text: "Done and Signed at " },
        { text: signingPlaceValue || "________________", bold: true },
        { text: " on this " },
        { text: signingDayValue || "____", bold: true },
        ...(signingDayValue && signingDayOrdinalSuffix
          ? [{ text: signingDayOrdinalSuffix, bold: true, size: 7, yOffset: -1.8 }]
          : []),
        { text: " day of " },
        { text: signingMonthValue || "________________", bold: true },
        { text: ` ${signingYearValue}`, bold: true },
      ];
      keepRoom(paragraphLineHeight + paragraphGap);
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      let segmentX = marginX;
      let segmentY = cursorY;
      segments.forEach((segment) => {
        pdf.setFont("helvetica", segment.bold ? "bold" : "normal");
        pdf.setFontSize(segment.size ?? 10);
        const segmentWidth = pdf.getTextWidth(segment.text);
        if (segmentX > marginX && segmentX + segmentWidth > pageWidth - marginX) {
          segmentX = marginX;
          segmentY += paragraphLineHeight;
        }
        pdf.text(segment.text, segmentX, segmentY + (segment.yOffset ?? 0));
        segmentX += segmentWidth;
      });
      pdf.setFontSize(10);
      cursorY = segmentY + paragraphLineHeight + paragraphGap;
    };

    const writeDocumentSection = (heading: string, render: () => void) => {
      keepRoom(16);
      writeSectionHeading(heading);
      render();
      cursorY += sectionGap;
    };

    const addPageNumbers = () => {
      const pageCount = pdf.getNumberOfPages();
      for (let pageIndex = 1; pageIndex <= pageCount; pageIndex += 1) {
        pdf.setPage(pageIndex);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`Page ${pageIndex} of ${pageCount}`, pageWidth - marginX, 12, { align: "right" });
      }
    };

    writeCenteredLine("IN THE DISCIPLINARY HEARING", 10, "bold", 0.2);
    writeCenteredLine(documentVenueHeading, 10, "bold", 10);

    writePlainParagraph("In the matter between:", { gapAfter: 4 });
    writeMatterRow(clientMatterName, "EMPLOYER", true);
    cursorY += 2.6;
    writePlainParagraph("and", { gapAfter: 4 });
    employeeMatterNames.forEach((employeeName, index) => {
      writeMatterRow(employeeName, employeeRoleLabels[index].toUpperCase(), true);
    });
    cursorY += 3;

    keepRoom(18);
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.2);
    pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 8.4;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text("OUTCOME OF THE DISCIPLINARY HEARING", pageWidth / 2, cursorY, { align: "center" });
    cursorY += 6.4;
    pdf.line(marginX, cursorY, pageWidth - marginX, cursorY);
    cursorY += 9;

    writeDocumentSection("Preliminary", () => {
      preliminaryRows.forEach((row) => {
        writeNumberedParagraph(row.number, row.value);
        if ("subRows" in row) {
          row.subRows.forEach((subRow) => {
            writeNumberedParagraph(subRow.number, subRow.value, { nested: true });
          });
        }
      });
    });

    writeDocumentSection("Issue(s) In Dispute", () => {
      issueRows.forEach((row) => writeNumberedParagraph(row.number, row.value));
    });

    writeDocumentSection("Background To The Issue", () => {
      if (isSingleEmployeeFlow) {
        writeNumberedParagraph(`${employeeStatementNumber}.`, "The Employee's statement:");
        employeeStatementGroups[0].forEach((paragraph, index) => {
          writeNumberedParagraph(`${employeeStatementNumber}.${index + 1}`, paragraph, { nested: true });
        });
      } else {
        presentEmployeeStatementRows.forEach((row, rowIndex) => {
          const mainNumber = employeeStatementNumber + rowIndex;
          writeNumberedParagraph(`${mainNumber}.`, `${row.referenceLabel}'s statement:`);
          (employeeStatementGroups[rowIndex] || [editablePlaceholderText]).forEach((paragraph, index) => {
            writeNumberedParagraph(`${mainNumber}.${index + 1}`, paragraph, { nested: true });
          });
          cursorY += 1.2;
        });
      }
      cursorY += 1.2;
      writeNumberedParagraph(`${employerStatementNumber}.`, "The Employer's statement:");
      normalizeParagraphText(employerStatementValue).forEach((paragraph, index) => {
        writeNumberedParagraph(`${employerStatementNumber}.${index + 1}`, paragraph, { nested: true });
      });
    });

    writeDocumentSection("Survey Of Evidence", () => {
      writeNumberedParagraph(`${employerEvidenceNumber}.`, "The employer submitted the following evidence:");
      employerEvidenceParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${employerEvidenceNumber}.${index + 1}`, paragraph, { nested: true });
      });
      cursorY += 1.2;
      writeNumberedParagraph(`${employeeEvidenceNumber}.`, employeeEvidenceHeadingText);
      if (!usesNoEmployeeEvidenceMessage) {
        employeeEvidenceParagraphs.forEach((paragraph, index) => {
          writeNumberedParagraph(`${employeeEvidenceNumber}.${index + 1}`, paragraph, { nested: true });
        });
      }
    });

    writeDocumentSection("Analysis Of Evidence And Finding", () => {
      writeNumberedParagraph(`${analysisIntroNumber}.`, analysisIntroValue);
      analysisDetailParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${analysisDetailNumber + index}.`, paragraph);
      });
      writeNumberedParagraph(`${analysisFindingHeadingNumber}.`, analysisFindingsHeadingValue);
      analysisParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${analysisFindingHeadingNumber}.${index + 1}`, paragraph, { nested: true });
      });
    });

    writeDocumentSection("Aggravating And Mitigating", () => {
      writeNumberedParagraph(`${aggravatingHeadingNumber}.`, "The following aggravating factors were submitted:");
      aggravatingParagraphs.forEach((paragraph, index) => {
        writeNumberedParagraph(`${aggravatingHeadingNumber}.${index + 1}`, paragraph, { nested: true });
      });
      cursorY += 1.2;
      writeNumberedParagraph(`${mitigatingHeadingNumber}.`, "The following mitigating factors were submitted:");
      if (usesNoMitigatingFactorsMessage) {
        writeNumberedParagraph(`${mitigatingHeadingNumber}.1`, "No mitigating factors were submitted by the employee.", { nested: true });
      } else {
        mitigatingParagraphs.forEach((paragraph, index) => {
          writeNumberedParagraph(`${mitigatingHeadingNumber}.${index + 1}`, paragraph, { nested: true });
        });
      }
    });

    if (hasRecommendationSection) {
      writeDocumentSection("Recommendation", () => {
        recommendationParagraphs.forEach((paragraph, index) => {
          writeNumberedParagraph(`${recommendationHeadingNumber + index}.`, paragraph);
        });
      });
    }

    writeDocumentSection("Recourse", () => {
      writeNumberedParagraph(recourseParagraphNumber, recourseParagraph);
    });

    const chairpersonSignatureWidth = 33;
    const chairpersonSignatureHeight = 31;
    keepRoom(chairpersonSignatureDataUrl ? chairpersonSignatureHeight + 36 : 42);
    writeSigningStatement();
    cursorY += 18;
    if (chairpersonSignatureDataUrl) {
      const chairpersonSignatureX = marginX + (35 - chairpersonSignatureWidth) / 2 - 4;
      pdf.addImage(
        chairpersonSignatureDataUrl,
        "PNG",
        chairpersonSignatureX,
        cursorY - 21,
        chairpersonSignatureWidth,
        chairpersonSignatureHeight,
        undefined,
        "FAST",
      );
    }
    pdf.setDrawColor(0, 0, 0);
    pdf.line(marginX, cursorY, marginX + 35, cursorY);
    cursorY += 5.2;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("CHAIRPERSON", marginX, cursorY);

    addPageNumbers();

    const firstEmployee = normalizedEmployees[0] || emptyEmployeeFormState;
    const safeEmployeeName =
      [firstEmployee.employeeName, firstEmployee.employeeSurname]
        .filter(Boolean)
        .join("_")
        .replace(/[^A-Za-z0-9_-]+/g, "_")
        .replace(/^_+|_+$/g, "") || "employee";
    const safeDate = hearingDetailsForm.hearingDate || new Date().toISOString().slice(0, 10);
    const documentLabel = "Disciplinary Hearing Outcome";
    const employeeInitials = firstEmployee.employeeName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}.`)
      .join("");
    const employeeSurname = firstEmployee.employeeSurname.trim();
    const documentNameSuffixBase = employeeInitials && employeeSurname ? ` (${employeeInitials} ${employeeSurname})` : "";
    const documentNameSuffix = normalizedEmployees.length > 1 ? `${documentNameSuffixBase} + ${normalizedEmployees.length - 1}` : documentNameSuffixBase;
    const documentName = `${documentLabel}${documentNameSuffix}`;
    const downloadFileName = `Disciplinary_Hearing_Outcome_${safeEmployeeName}_${safeDate}.pdf`;
    const uploadFilePath = [
      "disciplinary-hearing-outcomes",
      sanitizeFileSegment(clientForm.clientName || "client", "client"),
      `${Date.now()}-${sanitizeFileSegment(documentName, "disciplinary-hearing-outcome")}.pdf`,
    ].join("/");
    const uploadBlob = pdf.output("blob");
    let uploadedFileUrl = "";

    const { error: uploadError } = await supabase.storage.from(generatedDocumentsBucket).upload(uploadFilePath, uploadBlob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "application/pdf",
    });

    if (uploadError) {
      toast({
        title: "Upload Error",
        description: `Could not save document file: ${uploadError.message}`,
        variant: "destructive",
      });
    } else {
      const { data: publicUrlData } = supabase.storage.from(generatedDocumentsBucket).getPublicUrl(uploadFilePath);
      uploadedFileUrl = String(publicUrlData?.publicUrl ?? "").trim();
    }

    const logResult = await logGeneratedDocument({
      documentLabel,
      documentName,
      documentType: "Outcome",
      clientId: clientForm.clientId,
      clientName: clientForm.clientName,
      fileUrl: uploadedFileUrl,
      employeeName: firstEmployee.employeeName,
      employeeSurname: firstEmployee.employeeSurname,
      tradingName: clientForm.clientTradingAsName,
      registeredName: clientForm.clientRegisteredName,
    });

    if ("error" in logResult) {
      toast({
        title: "Save Error",
        description: `Could not save document row: ${logResult.error}`,
        variant: "destructive",
      });
    } else {
      window.dispatchEvent(new CustomEvent("documents-row-created"));
    }

    pdf.save(downloadFileName);
    toast({
      title: "Download ready",
      description: "The disciplinary hearing outcome PDF has been downloaded.",
    });
    onRequestClose?.();
  }

  downloadPdfRef.current = handleDownloadPdf;

  const isPartiesStep = !isFinished && activeStep === 0;
  const isHearingDetailsStep = !isFinished && activeStep === 1;
  const isPreviewStep = isFinished;
  const isPreviewEditorOpen = isPreviewEditable && (Boolean(editingParagraphId) || isAddRecommendationOpen);
  const previewWrapperClassName = "rounded-sm bg-white px-8 pt-6 pb-10 text-black shadow-[0_0_0_1px_rgba(148,163,184,0.16)]";
  const previewNumberClassName = "pt-[1px] text-[13px] leading-7 text-black";
  const previewBodyClassName = "text-[13px] leading-7 text-black";
  const previewSectionHeadingClassName = "text-[13px] font-bold uppercase underline underline-offset-2";
  const previewEditableParagraphClassName =
    "rounded-sm transition-colors hover:bg-slate-100/70";
  const placeholderRowClassName = "rounded-sm bg-red-50";
  const isEditablePlaceholder = (value: string) => value.trim() === editablePlaceholderText;
  const getPreliminarySectionSourceLines = () => [
    preliminaryOneValue,
    preliminaryTwoValue,
    preliminaryThreeValue,
    ...preliminaryChargeRows.flatMap((row) => [row.value, ...row.subRows.map((subRow) => subRow.value)]),
    preliminaryProcessValue,
    ...normalizeParagraphText(previewForm.preliminaryExtra),
  ];
  const getPreliminarySectionEditorNumbers = (rawLines: string[]) => {
    const normalizedLines = rawLines.length > 0 ? rawLines : [""];
    const detectedTypes = normalizedLines.map((line, index) => {
      if (index < 3) return "main";
      const trimmedLine = String(line || "").trim();
      if (/^\d+\.\d+/.test(trimmedLine)) return "sub";
      if (/^\d+(?:\.\d+)?\.?/.test(trimmedLine)) return "main";
      return null;
    });

    for (let index = 3; index < detectedTypes.length; index += 1) {
      if (detectedTypes[index]) continue;
      const previousType = detectedTypes[index - 1];
      if (previousType) {
        detectedTypes[index] = previousType;
        continue;
      }
      const nextType = detectedTypes.slice(index + 1).find((type): type is "main" | "sub" => Boolean(type));
      detectedTypes[index] = nextType || "main";
    }

    let mainParagraphNumber = 3;
    let subParagraphNumber = 1;
    let currentMainParagraphNumber = 3;
    return normalizedLines.map((_, index) => {
      if (index < 3) return `${index + 1}.`;
      if (detectedTypes[index] === "sub") {
        const value = `${currentMainParagraphNumber}.${subParagraphNumber}`;
        subParagraphNumber += 1;
        return value;
      }
      mainParagraphNumber += 1;
      currentMainParagraphNumber = mainParagraphNumber;
      const value = `${currentMainParagraphNumber}.`;
      subParagraphNumber = 1;
      return value;
    });
  };
  const getPreliminarySectionEditorNumber = (index: number, rawLines?: string[]) => {
    const sourceLines =
      rawLines ??
      (editingParagraphId === "preliminarySection" ? String(editingParagraphDraft || "").split(/\r?\n/) : getPreliminarySectionSourceLines());
    return getPreliminarySectionEditorNumbers(sourceLines)[index] || `${index + 1}.`;
  };
  const getEditorParagraphNumber = (field: EditorTarget, index: number, rawLines?: string[]) => {
    if (field === "preliminarySection") return getPreliminarySectionEditorNumber(index, rawLines);
    if (field === "issueSection") return `${firstIssueNumber + index}.`;
    if (field === "analysisSection") {
      if (index === 0) return `${analysisIntroNumber}.`;
      return `${analysisDetailNumber + index - 1}.`;
    }
    if (field === "employeeStatementGroup") {
      const targetGroupIndex = editingEmployeeStatementGroupIndex ?? 0;
      const mainNumber = employeeStatementNumber + (isSingleEmployeeFlow ? 0 : targetGroupIndex);
      if (index === 0) return `${mainNumber}.`;
      return `${mainNumber}.${index}`;
    }
    if (field === "preliminaryOne") return "1.";
    if (field === "preliminaryTwo") return "2.";
    if (field === "preliminaryThree") return "3.";
    if (field === "preliminaryFour") return "4.";
    if (field === "preliminaryExtra") return `${5 + index}.`;
    if (field === "issueInDispute") return `${firstIssueNumber}.`;
    if (field === "analysisIntro") return `${analysisIntroNumber}.`;
    if (field === "analysisDetail") return `${analysisDetailNumber + index}.`;
    if (field === "employeeStatement") return `${employeeStatementNumber}.${index + 1}`;
    if (field === "employerStatement") return `${employerStatementNumber}.${index + 1}`;
    if (field === "employerEvidence") return `${employerEvidenceNumber}.${index + 1}`;
    if (field === "employeeEvidence") return `${employeeEvidenceNumber}.${index + 1}`;
    if (field === "analysisFinding") return `${analysisFindingHeadingNumber}.${index + 1}`;
    if (field === "aggravatingFactors") return `${aggravatingHeadingNumber}.${index + 1}`;
    if (field === "mitigatingFactors") return `${mitigatingHeadingNumber}.${index + 1}`;
    if (field === "recommendation") return `${recommendationHeadingNumber + index}.`;
    return `${index + 1}.`;
  };
  const editorParagraphNumberSpacing = "     ";
  const getEditorParagraphPrefix = (field: EditorTarget, index: number, rawLines?: string[]) =>
    `${getEditorParagraphNumber(field, index, rawLines)}${editorParagraphNumberSpacing}`;
  const formatEditorDraft = (field: EditorTarget, value: string) => {
    const paragraphs = normalizeParagraphText(value);
    if (paragraphs.length === 0) {
      return getEditorParagraphPrefix(field, 0, [""]);
    }
    return paragraphs
      .map((paragraph, index) => `${getEditorParagraphPrefix(field, index, paragraphs)}${stripParagraphNumberPrefix(paragraph)}`.trimEnd())
      .join("\n");
  };
  const parseEditorDraft = (value: string) =>
    String(value || "")
      .split(/\r?\n/)
      .map((line) => stripParagraphNumberPrefix(line))
      .filter(Boolean)
      .join("\n");
  const renumberEditorDraft = (field: EditorTarget, lines: string[]) =>
    lines
      .map((line) => stripParagraphNumberPrefix(line))
      .map((line, index) => {
        const prefix = getEditorParagraphPrefix(field, index, lines);
        return line.length > 0 ? `${prefix}${line}` : prefix;
      })
      .join("\n");

  const removeEditablePlaceholderParagraphs = (value: string) =>
    normalizeParagraphText(value).filter((paragraph) => paragraph.trim() !== editablePlaceholderText);

  const moveEditorCaretToLineEnd = (lineIndex: number) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const textarea = editingTextareaRef.current;
        if (!textarea) return;
        const lines = textarea.value.split(/\r?\n/);
        const targetLineIndex = Math.max(0, Math.min(lineIndex, lines.length - 1));
        const lineStart = lines.slice(0, targetLineIndex).reduce((total, line) => total + line.length + 1, 0);
        const targetPosition = lineStart + (lines[targetLineIndex] || "").length;
        textarea.focus();
        textarea.setSelectionRange(targetPosition, targetPosition);
      });
    });
  };

  const blockPreviewInteractionWhenEditorOpen = (event: SyntheticEvent<HTMLElement>) => {
    if (!isPreviewEditorOpen) return;
    event.preventDefault();
    event.stopPropagation();
    editingTextareaRef.current?.focus({ preventScroll: true });
  };

  const openParagraphEditor = (field: EditorTarget, label: string, selectedLineIndex = 0) => {
    setEditingParagraphId(field);
    setEditingParagraphLabel(label);
    if (field === "preliminarySection") {
      const extraPreliminaryParagraphs = normalizeParagraphText(previewForm.preliminaryExtra);
      const preliminarySectionDraftLines = [
        `1.${editorParagraphNumberSpacing}${stripParagraphNumberPrefix(preliminaryOneValue)}`.trimEnd(),
        `2.${editorParagraphNumberSpacing}${stripParagraphNumberPrefix(preliminaryTwoValue)}`.trimEnd(),
        `3.${editorParagraphNumberSpacing}${stripParagraphNumberPrefix(preliminaryThreeValue)}`.trimEnd(),
        ...preliminaryChargeRows.flatMap((row) => [
          `${row.number}${editorParagraphNumberSpacing}${stripParagraphNumberPrefix(row.value)}`.trimEnd(),
          ...row.subRows.map((subRow) => `${subRow.number}${editorParagraphNumberSpacing}${stripParagraphNumberPrefix(subRow.value)}`.trimEnd()),
        ]),
        `${4 + preliminaryChargeRows.length}.${editorParagraphNumberSpacing}${stripParagraphNumberPrefix(preliminaryProcessValue)}`.trimEnd(),
        ...extraPreliminaryParagraphs.map((paragraph, index) => `${5 + preliminaryChargeRows.length + index}.${editorParagraphNumberSpacing}${stripParagraphNumberPrefix(paragraph)}`.trimEnd()),
      ];
      setEditingParagraphDraft(
        preliminarySectionDraftLines.join("\n"),
      );
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    if (field === "issueSection") {
      setEditingParagraphDraft(formatEditorDraft("issueSection", issueInDisputeValue));
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    if (field === "employeeStatementGroup") {
      const targetGroupIndex = selectedLineIndex;
      setEditingEmployeeStatementGroupIndex(targetGroupIndex);
      const mainNumber = employeeStatementNumber + (isSingleEmployeeFlow ? 0 : targetGroupIndex);
      const label = isSingleEmployeeFlow
        ? "The Employee's statement:"
        : `${presentEmployeeStatementRows[targetGroupIndex]?.referenceLabel || "The Employee"}'s statement:`;
      const rawParagraphs = employeeStatementGroups[targetGroupIndex] || [editablePlaceholderText];
      const paragraphs =
        rawParagraphs.length === 1 && rawParagraphs[0] === editablePlaceholderText
          ? [""]
          : rawParagraphs;
      const sectionLines = [
        `${mainNumber}.${editorParagraphNumberSpacing}${label}`,
        ...paragraphs.map((paragraph, index) => {
          const normalizedParagraph = stripParagraphNumberPrefix(paragraph);
          const prefix = `${mainNumber}.${index + 1}${editorParagraphNumberSpacing}`;
          return normalizedParagraph.length > 0 ? `${prefix}${normalizedParagraph}` : prefix;
        }),
      ];
      setEditingParagraphDraft(sectionLines.join("\n"));
      moveEditorCaretToLineEnd(Math.min(1, sectionLines.length - 1));
      return;
    }
    if (field === "analysisSection") {
      const savedAnalysisDetailParagraphs = removeEditablePlaceholderParagraphs(previewForm.analysisDetail);
      const savedAnalysisParagraphs = removeEditablePlaceholderParagraphs(previewForm.analysisFinding);
      setEditingParagraphDraft(
        [
          analysisIntroValue,
          ...(savedAnalysisDetailParagraphs.length > 0 ? savedAnalysisDetailParagraphs : [""]),
          ...(savedAnalysisParagraphs.length > 0 ? savedAnalysisParagraphs : [""]),
        ]
          .map((paragraph, index) => `${getEditorParagraphPrefix("analysisSection", index)}${stripParagraphNumberPrefix(paragraph)}`.trimEnd())
          .join("\n"),
      );
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    if (field === "analysisIntro") {
      setEditingParagraphDraft(`${getEditorParagraphPrefix("analysisIntro", 0)}${stripParagraphNumberPrefix(previewForm.analysisIntro.trim() || analysisIntroValue)}`.trimEnd());
      moveEditorCaretToLineEnd(0);
      return;
    }
    if (field === "analysisFinding") {
      const savedAnalysisParagraphs = removeEditablePlaceholderParagraphs(previewForm.analysisFinding);
      setEditingParagraphDraft(
        (savedAnalysisParagraphs.length > 0 ? savedAnalysisParagraphs : [""])
          .map((paragraph, index) => {
            const normalizedParagraph = stripParagraphNumberPrefix(paragraph);
            return normalizedParagraph.length > 0
              ? `${getEditorParagraphPrefix("analysisFinding", index)}${normalizedParagraph}`
              : getEditorParagraphPrefix("analysisFinding", index);
          })
          .join("\n"),
      );
      moveEditorCaretToLineEnd(selectedLineIndex);
      return;
    }
    setEditingParagraphDraft(formatEditorDraft(field, previewForm[field]));
    moveEditorCaretToLineEnd(selectedLineIndex);
  };
  const renderHearingDetailsFields = (form: HearingDetailsFormState, employeeIndex?: number) => {
    const fieldSuffix = employeeIndex === undefined ? "" : `-${employeeIndex}`;
    const isEmployeeScoped = employeeIndex !== undefined;
    const isChargePickerActive = isEmployeeScoped ? activeEmployeeChargePickerIndex === employeeIndex : chargePickerOpen;
    const isBargainingCouncilPickerActive = isEmployeeScoped
      ? activeEmployeeBargainingCouncilPickerIndex === employeeIndex
      : bargainingCouncilPickerOpen;
    const chargeSearch = isEmployeeScoped ? employeeChargeSearchValues[employeeIndex] || "" : chargeSearchValue;
    const bargainingCouncilSearch = isEmployeeScoped
      ? employeeBargainingCouncilSearchValues[employeeIndex] || ""
      : bargainingCouncilSearchValue;
    const normalizedChargeSearch = chargeSearch.trim().toLowerCase();
    const filteredCouncilOptions = !bargainingCouncilSearch.trim()
      ? bargainingCouncilOptions
      : bargainingCouncilOptions.filter(
          (option) =>
            option.label.toLowerCase().includes(bargainingCouncilSearch.trim().toLowerCase()) ||
            option.value.toLowerCase().includes(bargainingCouncilSearch.trim().toLowerCase()),
        );
    const visibleProcessOptions =
      form.employeeAttendance === "Present"
        ? hearingProcessOptions.filter((option) => option !== "Continued in absence")
        : form.employeeAttendance === "Absent"
          ? hearingProcessOptions.filter((option) => option !== "Continued")
          : hearingProcessOptions;
    const selectedChargeValue =
      form.misconductTypes.length === 0
        ? "Select misconduct type(s)"
        : form.misconductTypes.length === 1
          ? form.misconductTypes[0]
          : `${form.misconductTypes.length} misconduct type(s) selected`;

    return (
      <>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeNoticeDate${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Notice Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`disciplinaryOutcomeNoticeDate${fieldSuffix}`}
              type="text"
              readOnly
              value={form.noticeDate ? formatDateLabel(form.noticeDate) : ""}
              placeholder="Please select a date"
              onClick={() =>
                openHiddenDatePicker(
                  isEmployeeScoped
                    ? { current: employeeNoticeDatePickerRefs.current[employeeIndex] ?? null }
                    : noticeDatePickerRef,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openHiddenDatePicker(
                    isEmployeeScoped
                      ? { current: employeeNoticeDatePickerRefs.current[employeeIndex] ?? null }
                      : noticeDatePickerRef,
                  );
                }
              }}
              className={`${inputClassName} cursor-pointer`}
            />
            <input
              ref={(node) => {
                if (isEmployeeScoped) {
                  employeeNoticeDatePickerRefs.current[employeeIndex] = node;
                  return;
                }
                noticeDatePickerRef.current = node;
              }}
              type="date"
              value={form.noticeDate}
              onChange={(event) =>
                isEmployeeScoped
                  ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "noticeDate", event.target.value)
                  : handleHearingDetailsFieldChange("noticeDate", event.target.value)
              }
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeHearingDate${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Hearing Date <span className="text-red-500">*</span>
            </Label>
            <Input
              id={`disciplinaryOutcomeHearingDate${fieldSuffix}`}
              type="text"
              readOnly
              value={form.hearingDate ? formatDateLabel(form.hearingDate) : ""}
              placeholder="Please select a date"
              onClick={() =>
                openHiddenDatePicker(
                  isEmployeeScoped
                    ? { current: employeeHearingDatePickerRefs.current[employeeIndex] ?? null }
                    : hearingDatePickerRef,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openHiddenDatePicker(
                    isEmployeeScoped
                      ? { current: employeeHearingDatePickerRefs.current[employeeIndex] ?? null }
                      : hearingDatePickerRef,
                  );
                }
              }}
              className={`${inputClassName} cursor-pointer`}
            />
            <input
              ref={(node) => {
                if (isEmployeeScoped) {
                  employeeHearingDatePickerRefs.current[employeeIndex] = node;
                  return;
                }
                hearingDatePickerRef.current = node;
              }}
              type="date"
              value={form.hearingDate}
              onChange={(event) =>
                isEmployeeScoped
                  ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "hearingDate", event.target.value)
                  : handleHearingDetailsFieldChange("hearingDate", event.target.value)
              }
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeHearingFormat${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Hearing Format <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.hearingFormat || undefined}
              onValueChange={(value) =>
                isEmployeeScoped
                  ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "hearingFormat", value as HearingFormat)
                  : handleHearingDetailsFieldChange("hearingFormat", value as HearingFormat)
              }
            >
              <SelectTrigger id={`disciplinaryOutcomeHearingFormat${fieldSuffix}`} className={inputClassName}>
                <SelectValue placeholder="Select hearing format" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {hearingFormatOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-[11px]">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeHearingVenue${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Hearing Venue <span className="text-red-500">*</span>
            </Label>
            {form.hearingFormat === "virtual" ? (
              <Select
                value={form.hearingVenue || undefined}
                onValueChange={(value) =>
                  isEmployeeScoped
                    ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "hearingVenue", value)
                    : handleHearingDetailsFieldChange("hearingVenue", value)
                }
              >
                <SelectTrigger id={`disciplinaryOutcomeHearingVenue${fieldSuffix}`} className={inputClassName}>
                  <SelectValue placeholder="Select hearing venue" />
                </SelectTrigger>
                <SelectContent className="text-[11px]">
                  {virtualHearingVenueOptions.map((option) => (
                    <SelectItem key={option} value={option} className="text-[11px]">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={`disciplinaryOutcomeHearingVenue${fieldSuffix}`}
                value={form.hearingVenue}
                onChange={(event) =>
                  isEmployeeScoped
                    ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "hearingVenue", event.target.value)
                    : handleHearingDetailsFieldChange("hearingVenue", event.target.value)
                }
                placeholder="Enter hearing venue"
                className={inputClassName}
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeEmployeeAttendance${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Employee Attendance <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.employeeAttendance || undefined}
              onValueChange={(value) =>
                isEmployeeScoped
                  ? handleEmployeeSectionAttendanceChange(employeeIndex, value as EmployeeAttendance)
                  : handleEmployeeAttendanceChange(value as EmployeeAttendance)
              }
            >
              <SelectTrigger id={`disciplinaryOutcomeEmployeeAttendance${fieldSuffix}`} className={inputClassName}>
                <SelectValue placeholder="Select attendance" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {employeeAttendanceOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-[11px]">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeHearingProcess${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Hearing Process <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.hearingProcess || undefined}
              onValueChange={(value) =>
                isEmployeeScoped
                  ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "hearingProcess", value as HearingProcess)
                  : handleHearingDetailsFieldChange("hearingProcess", value as HearingProcess)
              }
            >
              <SelectTrigger id={`disciplinaryOutcomeHearingProcess${fieldSuffix}`} className={inputClassName}>
                <SelectValue placeholder="Select hearing process" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {visibleProcessOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-[11px]">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeBargainingCouncil${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Bargaining Council <span className="text-red-500">*</span>
            </Label>
            <Popover
              open={isBargainingCouncilPickerActive}
              onOpenChange={(open) => {
                if (isEmployeeScoped) {
                  setActiveEmployeeBargainingCouncilPickerIndex(open ? employeeIndex : null);
                  if (!open) {
                    setEmployeeBargainingCouncilSearchValues((current) => ({ ...current, [employeeIndex]: "" }));
                  }
                  return;
                }
                setBargainingCouncilPickerOpen(open);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  id={`disciplinaryOutcomeBargainingCouncil${fieldSuffix}`}
                  type="button"
                  className={cn(
                    inputClassName,
                    "inline-flex w-full items-center justify-between border border-slate-300 px-3 text-[12px] hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                  )}
                >
                  <span className="truncate text-left text-slate-900">{form.bargainingCouncil || "None"}</span>
                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-[420px] border border-slate-200 bg-white p-0 shadow-lg"
                onCloseAutoFocus={() => {
                  if (isEmployeeScoped) {
                    setEmployeeBargainingCouncilSearchValues((current) => ({ ...current, [employeeIndex]: "" }));
                    return;
                  }
                  setBargainingCouncilSearchValue("");
                }}
              >
                <Command shouldFilter={false} className="bg-white text-slate-700">
                  <CommandInput
                    value={bargainingCouncilSearch}
                    onValueChange={(value) => {
                      if (isEmployeeScoped) {
                        setEmployeeBargainingCouncilSearchValues((current) => ({ ...current, [employeeIndex]: value }));
                        return;
                      }
                      setBargainingCouncilSearchValue(value);
                    }}
                    placeholder="Search bargaining council..."
                    className="h-8 border-b border-slate-200 text-[12px] placeholder:text-[11px] placeholder:text-slate-400"
                  />
                  <CommandList>
                    <CommandEmpty className="py-3 text-[12px] text-slate-500">No councils found.</CommandEmpty>
                    <CommandGroup>
                      {filteredCouncilOptions.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={`${option.value} ${option.label}`}
                          onSelect={() => {
                            if (isEmployeeScoped) {
                              handleEmployeeHearingDetailsFieldChange(employeeIndex, "bargainingCouncil", option.value);
                              setEmployeeBargainingCouncilSearchValues((current) => ({ ...current, [employeeIndex]: "" }));
                              setActiveEmployeeBargainingCouncilPickerIndex(null);
                              return;
                            }
                            handleHearingDetailsFieldChange("bargainingCouncil", option.value);
                            setBargainingCouncilSearchValue("");
                            setBargainingCouncilPickerOpen(false);
                          }}
                          className="text-[12px] text-slate-700 data-[selected=true]:bg-[#3eca44]/10 data-[selected=true]:text-[#2f9f35]"
                        >
                          <Check className={`mr-2 h-3.5 w-3.5 ${form.bargainingCouncil === option.value ? "opacity-100" : "opacity-0"}`} />
                          <span className="truncate">{option.label}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeRepresentation${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Representation <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.representation || undefined}
              onValueChange={(value) =>
                isEmployeeScoped
                  ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "representation", value as RepresentationOption)
                  : handleHearingDetailsFieldChange("representation", value as RepresentationOption)
              }
            >
              <SelectTrigger id={`disciplinaryOutcomeRepresentation${fieldSuffix}`} className={inputClassName}>
                <SelectValue placeholder="Select representation" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {representationOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-[11px]">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeInterpreter${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Interpreter <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.interpreter || undefined}
              onValueChange={(value) =>
                isEmployeeScoped
                  ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "interpreter", value as InterpreterOption)
                  : handleHearingDetailsFieldChange("interpreter", value as InterpreterOption)
              }
            >
              <SelectTrigger id={`disciplinaryOutcomeInterpreter${fieldSuffix}`} className={inputClassName}>
                <SelectValue placeholder="Select interpreter option" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {interpreterOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-[11px]">
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`disciplinaryOutcomeAppealNotice${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
              Appeal Notice <span className="text-red-500">*</span>
            </Label>
            <Select
              value={form.appealNoticeDays}
              onValueChange={(value) =>
                isEmployeeScoped
                  ? handleEmployeeHearingDetailsFieldChange(employeeIndex, "appealNoticeDays", value as AppealNoticeOption)
                  : handleHearingDetailsFieldChange("appealNoticeDays", value as AppealNoticeOption)
              }
            >
              <SelectTrigger id={`disciplinaryOutcomeAppealNotice${fieldSuffix}`} className={inputClassName}>
                <SelectValue placeholder="Select appeal notice period" />
              </SelectTrigger>
              <SelectContent className="text-[11px]">
                {appealNoticeOptions.map((option) => (
                  <SelectItem key={option} value={option} className="text-[11px]">
                    {option} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`disciplinaryOutcomeCharges${fieldSuffix}`} className="text-[11px] font-semibold text-slate-600">
            Charge <span className="text-red-500">*</span>
          </Label>
          <Popover
            open={isChargePickerActive}
            onOpenChange={(open) => {
              if (isEmployeeScoped) {
                setActiveEmployeeChargePickerIndex(open ? employeeIndex : null);
                return;
              }
              setChargePickerOpen(open);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                id={`disciplinaryOutcomeCharges${fieldSuffix}`}
                type="button"
                variant="outline"
                role="combobox"
                aria-expanded={isChargePickerActive}
                className={cn(
                  inputClassName,
                  "w-full justify-between px-3 text-[12px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                  form.misconductTypes.length === 0 && "text-[11px] text-slate-400",
                )}
              >
                <span className="truncate text-left">{selectedChargeValue}</span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
              onCloseAutoFocus={() => {
                if (isEmployeeScoped) {
                  setEmployeeChargeSearchValues((current) => ({ ...current, [employeeIndex]: "" }));
                  return;
                }
                setChargeSearchValue("");
              }}
            >
              <Command shouldFilter={false}>
                <CommandInput
                  value={chargeSearch}
                  onValueChange={(value) => {
                    if (isEmployeeScoped) {
                      setEmployeeChargeSearchValues((current) => ({ ...current, [employeeIndex]: value }));
                      return;
                    }
                    setChargeSearchValue(value);
                  }}
                  placeholder="Search offences..."
                  className="h-9 border-0 text-[11px] focus:ring-0"
                />
                <CommandList className="max-h-[320px]">
                  <CommandEmpty className="py-4 text-center text-[11px] text-slate-500">
                    No offence found.
                  </CommandEmpty>
                  {offenceCategoryOrder.map((category) => {
                    const options = conductOffenceOptions.filter(
                      (offence) =>
                        offence.category === category &&
                        (!normalizedChargeSearch || offence.name.toLowerCase().startsWith(normalizedChargeSearch)),
                    );
                    if (options.length === 0) return null;
                    return (
                      <CommandGroup key={category} heading={offenceGroupLabel[category]}>
                        {options.map((offence) => {
                          const isSelected = form.misconductTypes.includes(offence.name);
                          return (
                            <CommandItem
                              key={offence.name}
                              value={offence.name}
                              onSelect={() =>
                                isEmployeeScoped
                                  ? (handleEmployeeToggleCharge(employeeIndex, offence.name), setEmployeeChargeSearchValues((current) => ({ ...current, [employeeIndex]: "" })))
                                  : (handleToggleCharge(offence.name), setChargeSearchValue(""))
                              }
                              className="text-[11px]"
                            >
                              <Check className={`mr-2 h-3.5 w-3.5 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                              <span>{offence.name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    );
                  })}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {form.misconductTypes.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {form.misconductTypes.map((type) => (
              <div key={`${fieldSuffix}-${type}`} className="space-y-2">
                <Label htmlFor={`disciplinaryOutcomePlea${fieldSuffix}-${type}`} className="text-[11px] font-semibold text-slate-600">
                  Plea For {type} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={String(form.pleasByCharge[type] || "") || undefined}
                  onValueChange={(value) =>
                    isEmployeeScoped
                      ? handleEmployeePleaChange(employeeIndex, type, value as PleaOption)
                      : handlePleaChange(type, value as PleaOption)
                  }
                >
                  <SelectTrigger id={`disciplinaryOutcomePlea${fieldSuffix}-${type}`} className={inputClassName}>
                    <SelectValue placeholder="Select plea" />
                  </SelectTrigger>
              <SelectContent className="text-[11px]">
                    {pleaOptions.map((option) => (
                      <SelectItem key={option} value={option} className="text-[11px]">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  };

  const previewParagraphEditorDialog = (
    <Dialog open={isPreviewEditable && Boolean(editingParagraphId)} onOpenChange={(open) => (!open ? closeParagraphEditor() : undefined)}>
      <DialogContent
        className="z-[10000] w-[94vw] max-w-[860px] gap-0 overflow-hidden rounded-sm border-0 bg-[#2D4256] p-0 shadow-xl [&>button]:right-3 [&>button]:top-3 [&>button]:text-white [&>button]:hover:text-white"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => editingTextareaRef.current?.focus({ preventScroll: true }));
        }}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Pencil className="h-4 w-4 text-white" />
          <DialogTitle className="text-[15px] font-semibold text-white">
            Edit "{editingParagraphLabel}" Paragraph
          </DialogTitle>
        </div>

        <div className="space-y-4 bg-white px-4 pb-4 pt-5">
          <p className="flex items-center gap-1 text-[12px] text-slate-500">
            <Info className="h-3.5 w-3.5" />
            Press Enter to start the next numbered paragraph.
          </p>
          <textarea
            ref={editingTextareaRef}
            value={editingParagraphDraft}
            onChange={(event) => setEditingParagraphDraft(event.target.value)}
            onKeyDown={handleEditingParagraphKeyDown}
            rows={10}
            className="min-h-[180px] w-full resize-none rounded-sm border-[0.5px] border-slate-300 px-3 py-2 text-[13px] text-slate-700 placeholder:text-[13px] placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus:outline-none"
          />
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeParagraphEditor}
              className="h-8 w-[92px] rounded border-slate-300 bg-white px-3 text-[12px] text-slate-700 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveParagraphEditor}
              className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[12px] text-white hover:bg-[#34b73b]"
            >
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const addRecommendationDialog = (
    <Dialog open={isPreviewEditable && isAddRecommendationOpen} onOpenChange={(open) => (!open ? closeAddRecommendationForm() : undefined)}>
      <DialogContent className="z-[10000] w-[94vw] max-w-[860px] gap-0 overflow-hidden rounded-sm border-0 bg-[#2D4256] p-0 shadow-xl [&>button]:right-3 [&>button]:top-3 [&>button]:text-white [&>button]:hover:text-white">
        <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
          <Plus className="h-4 w-4 text-white" />
          <DialogTitle className="text-[15px] font-semibold text-white">Add Section</DialogTitle>
        </div>

        <div className="space-y-4 bg-white px-4 pb-4 pt-5">
          <Input
            value="Recommendation"
            readOnly
            className="h-8 border-slate-300 !text-[12px] font-bold text-black hover:border-slate-300 focus:border-slate-300 focus-visible:border-slate-300 focus:ring-0 focus-visible:ring-0"
          />
          <p className="flex items-center gap-1 text-[12px] text-slate-500">
            <Info className="h-3.5 w-3.5" />
            Press Enter to start the next paragraph. Numbering is updated automatically.
          </p>
          <textarea
            value={recommendationDraft}
            onChange={(event) => setRecommendationDraft(event.target.value)}
            rows={8}
            autoFocus
            className="min-h-[180px] w-full resize-none rounded-sm border-[0.5px] border-slate-300 px-3 py-2 text-[12px] text-slate-700 placeholder:text-[12px] placeholder:text-slate-400 hover:border-slate-500 focus:border-slate-300 focus:outline-none"
            placeholder="Please start typing here..."
          />
          <div className="flex items-center justify-center gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeAddRecommendationForm}
              className="h-8 w-[92px] rounded border-slate-300 bg-white px-3 text-[12px] text-slate-700 hover:border-[#3eca44] hover:bg-white hover:text-[#2f9f35]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveAddRecommendationForm}
              className="h-8 w-[92px] rounded bg-[#3eca44] px-3 text-[12px] text-white hover:bg-[#34b73b]"
            >
              Add Section
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="h-full overflow-y-auto py-1">
      {isPartiesStep ? (
        <div className="space-y-6 pt-0">
          <section className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Employer</p>
              <div className="border-t border-[#3eca44]" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="disciplinaryOutcomeClientName" className="text-[11px] font-semibold text-slate-600">
                  Client Name <span className="text-red-500">*</span>
                </Label>
                <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="disciplinaryOutcomeClientName"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientSearchOpen}
                      className={cn(
                        inputClassName,
                        "w-full justify-between px-3 text-[12px] font-medium hover:bg-white hover:text-slate-900 data-[state=open]:bg-white data-[state=open]:text-slate-900",
                        !clientForm.clientId && "text-[11px] text-slate-400",
                      )}
                    >
                      <span className="truncate">{selectedClientLabel}</span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="max-h-[380px] w-[var(--radix-popover-trigger-width)] min-w-[420px] overflow-hidden p-0"
                    onCloseAutoFocus={() => setClientSearchValue("")}
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        value={clientSearchValue}
                        onValueChange={setClientSearchValue}
                        placeholder="Search registered or trading name..."
                        className="h-8 text-[12px] placeholder:text-[11px]"
                      />
                      <CommandList className="max-h-[320px] overscroll-contain">
                        {filteredClientRows.length === 0 ? (
                          <CommandEmpty className="px-3 py-4 text-sm text-slate-500">{clientLoadMessage}</CommandEmpty>
                        ) : null}
                        <CommandGroup>
                          {filteredClientRows.map((client) => {
                            const label = formatClientDisplayName(client);
                            return (
                              <CommandItem
                                key={client.id}
                                value={`${String(client.registered_name || "").trim()} ${String(client.trading_as || "").trim()}`.trim()}
                                onSelect={() => handleClientSelect(client.id)}
                                className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]"
                              >
                                <span className="min-w-0 truncate font-medium text-slate-900">{label}</span>
                                {clientForm.clientId === client.id ? <Check className="h-3.5 w-3.5 text-[#2f9f35]" /> : null}
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="disciplinaryOutcomeRegistrationNumber" className="text-[11px] font-semibold text-slate-600">
                  Registration Number
                </Label>
                <Input
                  id="disciplinaryOutcomeRegistrationNumber"
                  value={clientForm.registrationNumber}
                  readOnly
                  placeholder="Will populate from selected client"
                  className={inputClassName}
                />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">Employee(s)</p>
                <Button
                  type="button"
                  variant="outline"
                  className="h-7 rounded border-[#3eca44] px-2.5 text-[10px] font-medium text-[#2f9f35] hover:bg-[#3eca44] hover:text-white"
                  onClick={handleAddEmployee}
                >
                  Add Employee
                </Button>
              </div>
              <div className="border-t border-[#3eca44]" />
            </div>

            <div className="space-y-2.5">
              {employeeForms.map((employee, index) => (
                <div key={`employee-form-${index}`} className="space-y-0">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`disciplinaryOutcomeEmployeeName-${index}`} className="text-[11px] font-semibold text-slate-600">
                        Employee Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`disciplinaryOutcomeEmployeeName-${index}`}
                        value={employee.employeeName}
                        onChange={(event) => handleEmployeeFieldChange(index, "employeeName", event.target.value)}
                        placeholder="Enter employee name"
                        className={inputClassName}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor={`disciplinaryOutcomeEmployeeSurname-${index}`} className="text-[11px] font-semibold text-slate-600">
                        Employee Surname <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id={`disciplinaryOutcomeEmployeeSurname-${index}`}
                        value={employee.employeeSurname}
                        onChange={(event) => handleEmployeeFieldChange(index, "employeeSurname", event.target.value)}
                        placeholder="Enter employee surname"
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  {employeeForms.length > 1 ? (
                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveEmployee(index)}
                        className="inline-flex h-4 items-center gap-1 text-[9px] font-medium leading-none text-slate-500 transition-colors hover:text-red-600"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : isHearingDetailsStep ? (
        isSingleEmployeeFlow ? (
          <div className="space-y-4 pt-0">{renderHearingDetailsFields(hearingDetailsForm)}</div>
        ) : (
          <div className="space-y-6 pt-0">
            {employeeForms.map((employee, index) => {
              const employeeLabel = [employee.employeeName, employee.employeeSurname].filter(Boolean).join(" ").trim() || `Employee ${index + 1}`;
              const isCollapsed = collapsedEmployeeHearingSectionIndexes.includes(index);
              return (
                <section key={`employee-hearing-details-${index}`} className="rounded-sm border border-slate-200 bg-white px-4 py-3">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleEmployeeHearingSection(index)}
                        className="flex w-full items-end justify-between gap-3 text-left"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600">{employeeLabel}</p>
                        <ChevronDown className={cn("h-4 w-4 text-[#2f9f35] transition-transform", !isCollapsed && "rotate-180")} />
                      </button>
                      <div className="border-t border-[#3eca44]" />
                    </div>
                    {!isCollapsed ? <div className="space-y-4">{renderHearingDetailsFields(employeeHearingDetailsForms[index], index)}</div> : null}
                  </div>
                </section>
              );
            })}
          </div>
        )
      ) : isPreviewStep ? (
        <div className="h-full py-1">
          <div className="mx-auto max-w-[820px] space-y-5">
            <div
              className={cn(previewWrapperClassName, isPreviewEditorOpen && "pointer-events-none select-none")}
              aria-hidden={isPreviewEditorOpen ? "true" : undefined}
              onPointerDownCapture={blockPreviewInteractionWhenEditorOpen}
              onMouseDownCapture={blockPreviewInteractionWhenEditorOpen}
              onClickCapture={blockPreviewInteractionWhenEditorOpen}
            >
              <div className="space-y-10">
                <div className="pt-6 text-center">
                  <p className="text-[13px] font-bold uppercase leading-6">In The Disciplinary Hearing</p>
                  <p className="text-[13px] font-bold uppercase leading-6">{documentVenueHeading}</p>
                </div>

                <div className="space-y-4">
                  <p className={previewBodyClassName}>In the matter between:</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-6">
                    <p className="text-[13px] font-bold uppercase leading-7">{clientMatterName}</p>
                    <p className="text-right text-[13px] uppercase leading-7">Employer</p>
                  </div>
                  <p className={previewBodyClassName}>And</p>
                  <div className="space-y-2">
                    {employeeMatterNames.map((employeeName, index) => (
                      <div key={`${employeeName}-${index}`} className="grid grid-cols-[minmax(0,1fr)_140px] items-center gap-6">
                        <p className="text-[13px] font-bold uppercase leading-7">{employeeName}</p>
                        <p className="text-right text-[13px] uppercase leading-7">{employeeRoleLabels[index]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="border-t border-black" />
                  <p className="text-center text-[13px] font-bold uppercase leading-6">Outcome Of The Disciplinary Hearing</p>
                  <div className="border-t border-black" />
                </div>

                <div className="space-y-10">
                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Preliminary</p>
                    <div className="space-y-2">
                      {preliminaryRows.map((row, index) => (
                        <div key={row.number} className="space-y-2">
                          <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                            <div className={previewNumberClassName}>{row.number}</div>
                            <button
                              type="button"
                              onClick={() => (isPreviewEditable ? openParagraphEditor("preliminarySection", "Preliminary", index) : undefined)}
                              className={cn("text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                            >
                              <p className={previewBodyClassName}>{row.value}</p>
                            </button>
                          </div>
                          {"subRows" in row && row.subRows.length > 0 ? (
                            <div className="space-y-2 pl-10">
                              {row.subRows.map((subRow, subRowIndex) => (
                                <div key={subRow.number} className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                                  <div className={previewNumberClassName}>{subRow.number}</div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      (isPreviewEditable
                                        ? openParagraphEditor("preliminarySection", "Preliminary", 4 + subRowIndex)
                                        : undefined)
                                    }
                                    className={cn("text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                                  >
                                    <p className={previewBodyClassName}>{subRow.value}</p>
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Issue(s) In Dispute</p>
                    <div className="space-y-2">
                      {issueRows.map((row, index) => (
                        <div key={row.number} className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                          <div className={previewNumberClassName}>{row.number}</div>
                          <button
                            type="button"
                            onClick={() => (isPreviewEditable ? openParagraphEditor("issueSection", "Issue(s) In Dispute", index) : undefined)}
                            className={cn("text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                          >
                            <p className={previewBodyClassName}>{row.value}</p>
                          </button>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Background To The Issue</p>

                    <div className="space-y-3">
                      {(isSingleEmployeeFlow
                        ? [{ label: "The Employee's statement:", paragraphs: employeeStatementGroups[0], mainNumber: employeeStatementNumber }]
                        : presentEmployeeStatementRows.map((row, index) => ({
                            label: `${row.referenceLabel}'s statement:`,
                            paragraphs: employeeStatementGroups[index] || [editablePlaceholderText],
                            mainNumber: employeeStatementNumber + index,
                          }))).map((statementGroup, groupIndex) => (
                        <button
                          key={`employee-statement-group-${groupIndex}`}
                          type="button"
                          onClick={() => (isPreviewEditable ? openParagraphEditor("employeeStatementGroup", "Employee statement", groupIndex) : undefined)}
                          className={cn("w-full space-y-1.5 text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                        >
                          <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                            <div className={previewNumberClassName}>{`${statementGroup.mainNumber}.`}</div>
                            <div className="space-y-1.5">
                              <p className={previewBodyClassName}>{statementGroup.label}</p>
                            </div>
                          </div>

                          <div className="pl-10">
                            {statementGroup.paragraphs.map((paragraph, index) => (
                              <div
                                key={`employee-${groupIndex}-${index}`}
                                className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                              >
                                <div className={previewNumberClassName}>{`${statementGroup.mainNumber}.${index + 1}`}</div>
                                <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                              </div>
                            ))}
                          </div>
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4 pt-2">
                      <div className={previewNumberClassName}>{`${employerStatementNumber}.`}</div>
                      <div className="space-y-1.5">
                        <p className={previewBodyClassName}>The Employer&apos;s statement:</p>
                      </div>
                    </div>

                    <div className="pl-10">
                      <div>
                        <button
                          type="button"
                          onClick={() => (isPreviewEditable ? openParagraphEditor("employerStatement", "The Employer's statement", 0) : undefined)}
                          className={cn(
                            "w-full text-left",
                            isPreviewEditable ? previewEditableParagraphClassName : "",
                          )}
                        >
                          {normalizeParagraphText(employerStatementValue).map((paragraph, index) => (
                            <div
                              key={`employer-${index}`}
                              onClick={(event) => {
                                if (!isPreviewEditable) return;
                                event.stopPropagation();
                                openParagraphEditor("employerStatement", "The Employer's statement", index);
                              }}
                              className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                            >
                              <div className={previewNumberClassName}>{`${employerStatementNumber}.${index + 1}`}</div>
                              <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                            </div>
                          ))}
                        </button>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Survey Of Evidence</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4">
                        <div className={previewNumberClassName}>{`${employerEvidenceNumber}.`}</div>
                        <p className={previewBodyClassName}>The employer submitted the following evidence:</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("employerEvidence", "Employer evidence", 0) : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {employerEvidenceParagraphs.map((paragraph, index) => (
                          <div
                            key={`evidence-employer-${index}`}
                            onClick={(event) => {
                              if (!isPreviewEditable) return;
                              event.stopPropagation();
                              openParagraphEditor("employerEvidence", "Employer evidence", index);
                            }}
                            className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                          >
                            <div className={previewNumberClassName}>{`${employerEvidenceNumber}.${index + 1}`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                      <div className="grid grid-cols-[24px_minmax(0,1fr)] items-start gap-4 pt-2">
                        <div className={previewNumberClassName}>{`${employeeEvidenceNumber}.`}</div>
                        <p className={previewBodyClassName}>{employeeEvidenceHeadingText}</p>
                      </div>
                      {usesNoEmployeeEvidenceMessage ? null : (
                        <button
                          type="button"
                          onClick={() => (isPreviewEditable ? openParagraphEditor("employeeEvidence", "Employee evidence", 0) : undefined)}
                          className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                        >
                          {employeeEvidenceParagraphs.map((paragraph, index) => (
                            <div
                              key={`evidence-employee-${index}`}
                              onClick={(event) => {
                                if (!isPreviewEditable) return;
                                event.stopPropagation();
                                openParagraphEditor("employeeEvidence", "Employee evidence", index);
                              }}
                              className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                            >
                              <div className={previewNumberClassName}>{`${employeeEvidenceNumber}.${index + 1}`}</div>
                              <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                            </div>
                          ))}
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Analysis Of Evidence And Finding</p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{`${analysisIntroNumber}.`}</div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("analysisIntro", "Analysis of evidence and finding", 0) : undefined)}
                        className={cn("text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{analysisIntroValue}</p>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isPreviewEditable ? openParagraphEditor("analysisDetail", "Analysis of evidence", 0) : undefined)}
                      className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                    >
                      {analysisDetailParagraphs.map((paragraph, index) => (
                        <div
                          key={`analysis-detail-${index}`}
                          onClick={(event) => {
                            if (!isPreviewEditable) return;
                            event.stopPropagation();
                            openParagraphEditor("analysisDetail", "Analysis of evidence", index);
                          }}
                          className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                        >
                          <div className={previewNumberClassName}>{`${analysisDetailNumber + index}.`}</div>
                          <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                        </div>
                      ))}
                    </button>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{`${analysisFindingHeadingNumber}.`}</div>
                      <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{analysisFindingsHeadingValue}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isPreviewEditable ? openParagraphEditor("analysisFinding", "Analysis finding", 0) : undefined)}
                      className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                    >
                      {analysisParagraphs.map((paragraph, index) => (
                        <div
                          key={`analysis-${index}`}
                          onClick={(event) => {
                            if (!isPreviewEditable) return;
                            event.stopPropagation();
                            openParagraphEditor("analysisFinding", "Analysis finding", index);
                          }}
                          className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                        >
                          <div className={previewNumberClassName}>{`${analysisFindingHeadingNumber}.${index + 1}`}</div>
                          <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                        </div>
                      ))}
                    </button>
                  </section>

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Aggravating And Mitigating</p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{`${aggravatingHeadingNumber}.`}</div>
                      <p className={previewBodyClassName}>The following aggravating factors were submitted:</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => (isPreviewEditable ? openParagraphEditor("aggravatingFactors", "Aggravating factors", 0) : undefined)}
                      className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                    >
                      {aggravatingParagraphs.map((paragraph, index) => (
                        <div
                          key={`aggravating-${index}`}
                          onClick={(event) => {
                            if (!isPreviewEditable) return;
                            event.stopPropagation();
                            openParagraphEditor("aggravatingFactors", "Aggravating factors", index);
                          }}
                          className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                        >
                          <div className={previewNumberClassName}>{`${aggravatingHeadingNumber}.${index + 1}`}</div>
                          <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                        </div>
                      ))}
                    </button>

                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4 pt-2">
                      <div className={previewNumberClassName}>{`${mitigatingHeadingNumber}.`}</div>
                      <p className={previewBodyClassName}>The following mitigating factors were submitted:</p>
                    </div>
                    {usesNoMitigatingFactorsMessage ? (
                      <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                        <div className={previewNumberClassName}>{`${mitigatingHeadingNumber}.1`}</div>
                        <p className={previewBodyClassName}>No mitigating factors were submitted by the employee.</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("mitigatingFactors", "Mitigating factors", 0) : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {mitigatingParagraphs.map((paragraph, index) => (
                            <div
                              key={`mitigating-${index}`}
                              onClick={(event) => {
                                if (!isPreviewEditable) return;
                                event.stopPropagation();
                                openParagraphEditor("mitigatingFactors", "Mitigating factors", index);
                              }}
                              className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                            >
                            <div className={previewNumberClassName}>{`${mitigatingHeadingNumber}.${index + 1}`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                    )}
                  </section>

                  {hasRecommendationSection ? (
                    <section className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className={previewSectionHeadingClassName}>Recommendation</p>
                        {isPreviewEditable ? (
                          <button
                            type="button"
                            onClick={removeRecommendationSection}
                            className="text-[11px] font-medium text-slate-500 transition-colors hover:text-red-600"
                          >
                            Remove Recommendation
                          </button>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => (isPreviewEditable ? openParagraphEditor("recommendation", "Recommendation", 0) : undefined)}
                        className={cn("w-full text-left", isPreviewEditable ? previewEditableParagraphClassName : "")}
                      >
                        {recommendationParagraphs.map((paragraph, index) => (
                          <div
                            key={`recommendation-${index}`}
                            onClick={(event) => {
                              if (!isPreviewEditable) return;
                              event.stopPropagation();
                              openParagraphEditor("recommendation", "Recommendation", index);
                            }}
                            className={cn("grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4", isEditablePlaceholder(paragraph) ? placeholderRowClassName : "")}
                          >
                            <div className={previewNumberClassName}>{`${recommendationHeadingNumber + index}.`}</div>
                            <p className={cn(previewBodyClassName, "whitespace-pre-wrap")}>{paragraph}</p>
                          </div>
                        ))}
                      </button>
                    </section>
                  ) : isPreviewEditable ? (
                    <AddSectionDivider onClick={openAddRecommendationForm} label="Add Recommendation here" />
                  ) : null}

                  <section className="space-y-3">
                    <p className={previewSectionHeadingClassName}>Recourse</p>
                    <div className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-4">
                      <div className={previewNumberClassName}>{recourseParagraphNumber}</div>
                      <p className={previewBodyClassName}>{recourseParagraph}</p>
                    </div>
                  </section>

                </div>

                <div className="pt-6">
                  <div className="mb-[47px] flex flex-wrap items-center gap-x-2 gap-y-2 text-[13px] leading-7 text-black">
                    <span>Done and Signed at</span>
                    <Input
                      value={previewForm.signingPlace}
                      onChange={(event) =>
                        setPreviewForm((current) => ({
                          ...current,
                          signingPlace: event.target.value,
                        }))
                      }
                      placeholder="place"
                      className="h-7 w-[170px] rounded-none border-0 border-b border-black bg-transparent px-1 py-0 text-[13px] font-bold text-black shadow-none placeholder:text-[12px] placeholder:font-normal placeholder:text-slate-400 focus-visible:border-black focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <span>on this</span>
                    <Input
                      value={previewForm.signingDay}
                      onChange={(event) =>
                        setPreviewForm((current) => ({
                          ...current,
                          signingDay: event.target.value.replace(/\D/g, "").slice(0, 2),
                        }))
                      }
                      inputMode="numeric"
                      placeholder="day"
                      className="h-7 w-[46px] rounded-none border-0 border-b border-black bg-transparent px-1 py-0 text-center text-[13px] font-bold text-black shadow-none placeholder:text-[12px] placeholder:font-normal placeholder:text-slate-400 focus-visible:border-black focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <span>day of</span>
                    <Select
                      value={previewForm.signingMonth}
                      onValueChange={(value) =>
                        setPreviewForm((current) => ({
                          ...current,
                          signingMonth: value,
                        }))
                      }
                    >
                      <SelectTrigger className="h-7 w-[128px] rounded-none border-0 border-b border-black bg-transparent px-1 py-0 text-[13px] font-bold text-black shadow-none focus:ring-0 focus:ring-offset-0 [&>span]:line-clamp-1">
                        <SelectValue placeholder="month" />
                      </SelectTrigger>
                      <SelectContent className="text-[12px]">
                        {monthOptions.map((month) => (
                          <SelectItem key={month} value={month} className="text-[12px]">
                            {month}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="font-bold">{signingYearValue}</span>
                  </div>
                  <div className="relative w-[132px]">
                    {chairpersonSignatureDataUrl ? (
                      <img
                        src={chairpersonSignatureDataUrl}
                        alt="Chairperson signature"
                        className="pointer-events-none absolute left-[calc(50%-16px)] top-[-79px] h-[136px] w-auto -translate-x-1/2 object-contain"
                      />
                    ) : null}
                    <div className="w-[132px] border-t border-black" />
                  </div>
                  <p className="mt-2 text-[13px] font-bold uppercase leading-7 text-black">Chairperson</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {previewParagraphEditorDialog}
      {addRecommendationDialog}
    </div>
  );
};

export default DisciplinaryHearingOutcomeGenerator;
