import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Briefcase, Building2, Check, FileText, UserPlus, Users } from "lucide-react";
import { genderOptions, nationalityOptions, raceOptions, salaryFrequencyOptions, temporaryContractSchema, type TemporaryContractFormData } from "@/lib/validation";
import type { Tables } from "@/integrations/supabase/types";

type BatchEmployee = {
  id: string;
  employeeNumber: string;
  employeeName: string;
  employeeSurname: string;
  employeeIdNumber: string;
  passportNumber: string;
  employeeCell: string;
  employeeAddress: string;
};

type SharedEmployment = {
  startDate: string;
  endDate: string;
  issueDate: string;
  tradingName: string;
  employerContact: string;
  employerEmail: string;
  jobTitle: string;
  salaryAmount: string;
  salaryFrequency: TemporaryContractFormData["salaryFrequency"];
  workplace: string;
  interpreter: TemporaryContractFormData["interpreter"];
  reportsTo: string;
};

type ClauseDefinition = {
  id: string;
  title: string;
  body: string | string[];
};

const salaryFrequencyLabels: Record<TemporaryContractFormData["salaryFrequency"], string> = {
  month: "per month",
  week: "per week",
  day: "per day",
  hour: "per hour",
};

const probationOptions: TemporaryContractFormData["probationPeriod"][] = ["1", "3", "6"];
const probationLabels: Record<TemporaryContractFormData["probationPeriod"], string> = {
  "1": "1 Month",
  "3": "3 Months",
  "6": "6 Months",
};

const retirementAgeOptions: TemporaryContractFormData["retirementAge"][] = ["55", "60", "65"];

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(amount);

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
};

const extractYear = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 4) : String(date.getFullYear());
};

const withClauseIds = (clauses: Array<Omit<ClauseDefinition, "id">>): ClauseDefinition[] =>
  clauses.map((clause) => ({
    ...clause,
    id: clause.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/(^-|-$)/g, ""),
  }));

const makeRowId = () => `emp-${Math.random().toString(16).slice(2, 8)}`;

const emptyEmployee = (): BatchEmployee => ({
  id: makeRowId(),
  employeeNumber: "",
  employeeName: "",
  employeeSurname: "",
  employeeIdNumber: "",
  passportNumber: "",
  employeeCell: "",
  employeeAddress: "",
});

const todayIso = () => new Date().toISOString().split("T")[0];

const getClauses = () =>
  withClauseIds([
    {
      title: "Introduction",
      body:
        "This employment agreement is entered into between the Employer and the Employee willingly and voluntarily.  The Employee hereby agrees that he/she has been granted the opportunity to peruse and discuss the contract with his/her council and that he/she understands the content that follows.",
    },
    {
      title: "Recordal",
      body:
        "The Employer appoints the Employee in a permanent capacity, which the Employee accepts on the terms of this agreement. This agreement records the essential conditions of employment, including duties, remuneration, working hours, leave, and termination, and constitutes the entire understanding between the parties, replacing any prior verbal or written arrangements unless expressly stated otherwise. The employment relationship is governed by this agreement and all applicable labour laws of South Africa.",
    },
    {
      title: "Probation",
      body:
        "The Employee is appointed subject to a probationary period commencing on the Start Date, during which the Employer will assess the Employee’s performance, conduct, skills, and suitability for the position. If the required standards are not met, the Employer may terminate the employment in accordance with labour law. Successful completion of probation does not guarantee continued employment, and confirmation of permanent employment remains at the Employer’s discretion.",
    },
    {
      title: "Performance and adaptability",
      body: [
        "The Employee shall diligently perform all duties associated with the position and comply with all reasonable and lawful instructions issued by the Employer or its authorised representatives. The Employee confirms that he/she has the necessary skills, qualifications, and experience to perform the required duties to the Employer’s satisfaction.",
        "The Employee acknowledges that the Employer may assign additional or alternative duties within the Employee’s reasonable skills or capabilities, and refusal to perform such duties may constitute insubordination. If the work described in the Employee’s job description becomes unavailable, the Employee agrees to perform suitable alternative work without loss of remuneration, although this does not create a right to continued employment. Should no suitable alternative work exist, the Employer may initiate retrenchment processes in accordance with applicable labour laws.",
      ],
    },
    {
      title: "Guarantee",
      body:
        "The Employee warrants that all information, documentation, and credentials submitted to the Employer are true and accurate. If any submission is found to be false, fraudulent, or misleading, the Employer may institute disciplinary action for dishonesty, which may result in summary termination of employment.",
    },
    {
      title: "Remuneration",
      body: [
        "The Employee shall receive the Gross Salary, which shall comply with all applicable legislation.  Unauthorised or unapproved absence from work shall result in no payment for the period of absence.",
        "Any future salary increases shall be considered at the Employer’s discretion, taking into account the Employee’s performance and the Employer’s financial position in the preceding financial year. No expectation of an increase is created by this clause, and the granting of any increase remains entirely discretionary.",
        "The Employee will be remunerated at two times the normal wage for work performed on a public holiday.",
      ],
    },
    {
      title: "Deductions",
      body:
        "The Employee consents to all lawful and statutory deductions from remuneration, including PAYE, UIF, and any voluntary benefits or contributions agreed to by the parties. The Employee further agrees that the Employer may deduct any amount lawfully owed to it, including losses, damages, cash or stock shortages resulting from the Employee’s negligence, misconduct, or dishonesty, provided such deductions comply with applicable labour laws and are properly recorded and communicated.",
    },
    {
      title: "Hours of work",
      body:
        "The Employee’s ordinary working hours shall not exceed forty-five (45) hours per week. The Employee shall be entitled to a daily unpaid lunch break of one (1) hour, taken at the time agreed between the parties.",
    },
    {
      title: "Overtime",
      body:
        "The Employee may be required to work overtime, subject to the limits set by the BCEA. Reasonable notice of overtime will be given, except in emergencies where short-notice overtime may be required. Overtime shall be remunerated in accordance with applicable legislation; however, employees earning above the Ministerial earnings threshold and employees classified as top management are not entitled to overtime pay.",
    },
    {
      title: "Retirement",
      body:
        "The Employee shall retire at the age recorded in page 1 of this agreement, unless otherwise agreed in writing. If the Employee continues working beyond the agreed retirement age, the Employer may terminate the employment contract on the basis of retirement by giving at least one (1) month’s written notice, and no further consultation shall be required.",
    },
    {
      title: "Exclusivity of employment",
      body: "The Employee shall not undertake any outside work or business activity without the Employer’s prior written consent.",
    },
    {
      title: "Annual bonus",
      body: [
        "Any annual bonus is ex-gratia and granted entirely at the Employer’s discretion, subject to the Employer’s financial position and the Employee’s conduct and performance. No entitlement or expectation of a bonus is created, regardless of whether bonuses were granted in previous years, and the Employer may withhold a bonus at any time.",
        "The Employee agrees that no pro-rata bonus shall be payable in the event of termination of employment for any reason.",
      ],
    },
    {
      title: "Termination of employment",
      body: [
        "Either party may terminate the employment relationship by giving written notice in accordance with the BCEA. The Employer may, at its discretion, make payment in lieu of notice when terminating the Employee’s services.",
        "The Employer reserves the right to summarily dismiss the Employee for gross misconduct, following a fair disciplinary process and in accordance with the principles of substantive and procedural fairness.",
      ],
    },
    {
      title: "Annual leave",
      body: [
        "The Employee is entitled to annual leave per the BCEA. Leave shall be taken at times determined by the Employer, subject to operational requirements. Unused leave will be forfeited if not taken within the applicable cycle.",
        "The Employee agrees to take annual leave during any annual shutdown period implemented by the Employer. Any additional leave taken during the cycle will be deducted from the Employee's leave entitlement.",
      ],
    },
    {
      title: "Sick leave",
      body: [
        "The Employee is entitled to sick leave in accordance with the BCEA. The Employee must provide a valid medical certificate when required by law or by the Employer.",
        "In cases of prolonged or recurring illness, the Employer may initiate a fair incapacity process in line with applicable labour legislation, which may result in termination of employment where the Employee is unable to perform the inherent requirements of the job.",
        "The Employee must submit a valid medical certificate issued and signed by a registered medical practitioner or any person certified to diagnose and treat patients and registered with a recognised professional council.",
        "Clinic or hospital attendance notes that merely confirm a visit, and do not expressly declare the Employee unfit for duty for a specific period, shall also not be accepted as proof of sickness.",
      ],
    },
    {
      title: "Parental leave",
      body: [
        "Where both parents are employed, they are jointly entitled to a combined period of four months and ten days of parental leave, which may be shared between them as they agree. The leave may be taken at the same time or one after the other. If the parents cannot agree on the division of leave, it shall be shared equally.",
        "Where the Employee is a single parent or where only one parent is employed, that parent is entitled to four consecutive months of parental leave.",
        "A pregnant Employee may commence parental leave at any time from four weeks before the expected date of birth, or earlier if medically required, and may not return to work within six weeks after giving birth unless declared fit for duty by a medical practitioner or midwife.",
        "Adoptive and commissioning parents are entitled to parental leave on the same basis as biological parents, subject to the statutory notice requirements.",
        "The Employee must notify the Employer in writing of the intended parental leave dates and return date at least four weeks before the start of the leave.",
        "Parental leave under this agreement is unpaid and the Employee must claim any available benefits from the Unemployment Insurance Fund.",
      ],
    },
    {
      title: "Family responsibility leave",
      body: [
        "An Employee who has completed four months of continuous employment and who works at least four days per week is entitled to three days of paid family responsibility leave per annual leave cycle. This leave may be taken for the illness of the Employee’s child, or in the event of the death of the Employee’s spouse or life partner, parent or adoptive parent, grandparent, child or adopted child, grandchild, or sibling.",
        "The Employee must notify the Employer as soon as reasonably possible if family responsibility leave is required. Where the leave relates to a funeral, the Employee must, where practicable, give at least four days’ prior notice.",
        "The Employer may request reasonable proof of the reason for leave, including a medical certificate for a child’s illness, a death certificate or other acceptable proof in cases of bereavement, and proof of the Employee’s relationship to the deceased.",
        "Failure to provide notice or proof when requested may result in the leave not being approved and treated as unpaid leave. Family responsibility leave does not accumulate, may not be carried over, and lapses at the end of each annual leave cycle.",
      ],
    },
    {
      title: "Absence from work",
      body: [
        "The Employee must notify the Employer before the start of the shift if unable to attend work. Where an absence is known in advance, the Employee must arrange leave at least 24 hours beforehand. Unjustified absence may result in disciplinary action, and sick leave will be applied in line with the BCEA.",
        "Attendance at a disciplinary hearing is compulsory. If the Employee is unable to attend due to illness, an affidavit from a medical practitioner confirming incapacity to attend must be provided, and the practitioner must be available to verify it.",
        "If the Employee fails to comply with these requirements, the hearing may proceed in his or her absence, and the Employee agrees not to dispute the fairness of any outcome, including dismissal.",
        "Failure to report for work for more than five consecutive workdays without valid reason or notifying the Employer shall be regarded as abscondment.",
        "In the instance of abscondment, the Employer will send a notice by WhatsApp, SMS, normal post or registered post instructing the Employee to return to work or contact the office and notifying the Employee of the disciplinary enquiry date. Failure to return, make contact, or attend the enquiry will result in dismissal.",
      ],
    },
    {
      title: "Protection of personal information",
      body: [
        "The Employee consents to the collection, use and storage of Personal Information and Special Personal Information, as defined in POPIA, for purposes related to the employment relationship. This includes payroll and benefit administration, statutory reporting, security and access control, monitoring for operational and risk-management purposes, internal and external communication, and compliance with legal and contractual obligations.",
        "The Employee consents to the sharing or transfer of Personal Information, where necessary, to third party service providers such as benefit administrators and insurers, to clients or service providers for operational purposes, and to secure cloud-based or foreign storage platforms that offer adequate data protection in accordance with POPIA.",
        "The Employee warrants that all Personal Information supplied is accurate and undertakes to update the Employer if any information changes. The Employee agrees to comply with the Employer’s POPIA policies and acknowledges that failure to do so may result in disciplinary action.",
      ],
    },
    {
      title: "Rules and regulations",
      body: [
        "The Employee agrees to comply with all rules, policies, procedures and regulations of the Employer, whether communicated in writing, verbally, or arising by reasonable implication from the nature of the workplace and the duties performed.",
        "The Employee must immediately inform the Employer of any offence, misconduct or breach of company rules committed by himself or herself, or by any other Employee, as soon as he or she becomes aware of it or reasonably ought to have become aware of it.",
        "Failure to disclose such information shall be regarded as dishonesty and a breach of trust, and may result in disciplinary action, including possible dismissal.",
      ],
    },
    {
      title: "Industrial action",
      body: [
        "The Employee may not participate in any unprotected strike, stoppage, or form of industrial action. No strike or picket may be undertaken unless it is protected in terms of the Labour Relations Act and preceded by the required certificate to strike and authorisation to picket.",
        "The Employee acknowledges and agrees that he/she shall be held liable for any damages to property, financial losses, or other harm suffered by the Employer as a result of his/her involvement in any legal or illegal industrial action, whether directly or indirectly.",
      ],
    },
    {
      title: "Health and fitness",
      body: [
        "The Employee confirms that he or she is medically fit to perform the duties of the position. Should the Employee become unable to perform these duties for health reasons, the Employer may follow the applicable incapacity procedures prescribed by the Labour Relations Act, which may result in termination of employment.",
        "The Employer may require the Employee to undergo a medical assessment, at the Employer’s cost, to determine fitness for duty. Unreasonable refusal to attend such an assessment may result in disciplinary action.",
      ],
    },
    {
      title: "Change of status",
      body: [
        "The Employee must promptly notify the Employer in writing of any change to his or her personal details as recorded in this agreement, and in any event within seven days of such change, so that the Employer’s records remain accurate and up to date.",
        "The Employee cannot hold the Employer liable for making use of incorrect details if the Employee breaches this clause.",
      ],
    },
    {
      title: "Domicilium citandi",
      body: [
        "The parties choose the physical addresses recorded on Page 1 of this agreement as their domicilium citandi et executandi for all purposes relating to this agreement. Any notice delivered by hand or by any means as agreed to in this agreement shall be deemed duly received.",
        "The Employee agrees that the Employer may send notices or correspondence by WhatsApp, SMS, email, regular post or registered post, and that proof of transmission or delivery shall constitute sufficient proof that the notice was sent.",
      ],
    },
    {
      title: "Alcohol and drug testing",
      body: [
        "The Employee agrees to undergo alcohol or drug testing when reasonably required by the Employer. All testing will be conducted by a competent person in a lawful and reasonable manner, and the Employer maintains a zero tolerance approach to alcohol and drug use in the workplace.",
        "The Employee further agrees to submit to a blood test where the Employer has reasonable suspicion that the Employee is under the influence of alcohol or drugs. Such testing shall be carried out by a qualified medical professional, and refusal to comply will be regarded as insubordination.",
        "Unreasonable refusal to undergo a required test may result in a negative inference being drawn, which may be treated as a presumptive positive result and may lead to disciplinary action, including dismissal.",
      ],
    },
    {
      title: "Polygraph testing",
      body: [
        "The Employee agrees to undergo polygraph testing when reasonably required by the Employer for investigative or security purposes, including matters involving theft, fraud, dishonesty, misconduct or breach of company policies. All tests will be conducted by a qualified and accredited examiner in a fair and lawful manner.",
        "Refusal to undergo a required polygraph test may result in an adverse inference being drawn.  Such refusal will also be regarded as insubordination and continued refusal could lead to dismissal.",
      ],
    },
    {
      title: "Temporary lay-off",
      body: [
        "The Employee agrees that the Employer may implement a temporary lay off when necessary. Where reasonably possible, the Employer will provide at least one day’s notice, stating the reason and expected duration. The Employee acknowledges that no remuneration is payable during a temporary lay off.",
        "Temporary lay offs may be introduced due to circumstances beyond the Employer’s control, including adverse weather, shortages of material or a temporary shortage of work. A temporary lay off in terms of this clause does not constitute a unilateral change to conditions of employment, nor shall it be regarded as a dismissal, retrenchment or breach of contract.",
      ],
    },
    {
      title: "Proof of citizenship",
      body: [
        "The Employee must provide proof of South African citizenship upon commencement of employment. If not a South African citizen, the Employee must submit a valid work permit or proof of permanent residency within seven days of request, and must continue to provide updated documentation whenever required.",
        "It is the Employee’s sole responsibility to ensure that any work permit remains valid for the full duration of employment. The Employee agrees that failure to maintain a valid permit or to provide updated proof when required will result in immediate termination of employment.",
      ],
    },
    {
      title: "Confidentiality",
      body:
        "The Employee shall keep all confidential information, trade secrets, client data and business affairs of the Employer strictly confidential and shall not disclose or use such information for any purpose other than the performance of his or her duties.",
    },
    {
      title: "Entire Agreement and Acknoweldgement",
      body: [
        "This agreement constitutes the entire agreement between the parties, and no variation, amendment or addition shall be valid unless reduced to writing and signed by both parties. Any indulgence or leniency granted shall not constitute a waiver of rights.",
        "By signing this agreement, both parties acknowledge that they have read and understood its contents and agree to be bound by its terms. The Employee confirms that the conditions of employment have been explained where necessary and that he or she voluntarily accepts them.",
        "The Employee acknowledges that all terms and conditions of employment are contained in this agreement, and any matters not specifically addressed shall be governed by the Employer’s rules and procedures. Where this agreement and the Employer’s policies are silent, the provisions of the Basic Conditions of Employment Act shall apply.",
      ],
    },
  ]);

const generateContractPdf = (data: TemporaryContractFormData, profile: Tables<"profiles"> | null) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  const issueYear = extractYear(data.issueDate);
  let y = margin;

  const ensureSpace = (space: number) => {
    if (y + space > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const valueOrLine = (value?: string | number | null) => {
    if (typeof value === "number") return value.toString();
    if (typeof value === "string" && value.trim()) return value;
    return "________________________";
  };

  const addWrappedText = (
    text: string,
    x: number,
    yPos: number,
    maxWidth: number,
    lineHeight: number,
    fontSize = 10,
    fontStyle: "normal" | "bold" | "italic" | "bolditalic" = "normal",
  ) => {
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, maxWidth);
    const pageHeightInner = doc.internal.pageSize.getHeight();
    let cursorY = yPos;

    lines.forEach((line) => {
      if (cursorY > pageHeightInner - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.text(line, x, cursorY);
      cursorY += lineHeight;
    });

    return cursorY;
  };

  const drawSection = (title: string, subtitle: string | undefined, renderContent: () => void) => {
    ensureSpace(16);
    const boxTop = y;
    doc.setFillColor(237, 242, 247);
    doc.setDrawColor(206, 212, 218);
    doc.rect(margin, y, contentWidth, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(45, 55, 72);
    doc.text(title.toUpperCase(), margin + 3, y + 7);
    if (subtitle) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.text(subtitle, margin + contentWidth - 3, y + 7, { align: "right" });
    }
    y += 12;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    renderContent();
    const boxHeight = y - boxTop;
    doc.setDrawColor(224, 231, 235);
    doc.rect(margin, boxTop, contentWidth, boxHeight, "S");
    y += 8;
  };

  const drawSingleRow = (label: string, value?: string | number | null) => {
    const labelWidth = 42;
    const availableWidth = contentWidth - labelWidth - 6;
    const lineHeight = 5.5;
    const lines = doc.splitTextToSize(valueOrLine(value), availableWidth);
    const rowHeight = lines.length * lineHeight + 3;

    ensureSpace(rowHeight);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text(`${label.toUpperCase()}:`, margin + 3, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    lines.forEach((line, idx) => {
      doc.text(line, margin + labelWidth, y + 6 + idx * lineHeight);
    });

    doc.setDrawColor(224, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    y += rowHeight;
  };

  const drawDualRow = (
    leftLabel: string,
    leftValue: string | number | null,
    rightLabel: string,
    rightValue: string | number | null,
    valueFontSize = 10,
  ) => {
    const columnWidth = (contentWidth - 8) / 2;
    const labelWidth = 42;
    const availableWidth = columnWidth - labelWidth - 6;
    const lineHeight = 5.5;
    const leftLines = doc.splitTextToSize(valueOrLine(leftValue), availableWidth);
    const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
    const rowHeight = Math.max(leftLines.length, rightLines.length) * lineHeight + 3;

    ensureSpace(rowHeight);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text(`${leftLabel.toUpperCase()}:`, margin + 3, y + 6);
    doc.text(`${rightLabel.toUpperCase()}:`, margin + columnWidth + 8 + 3, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(valueFontSize);
    doc.setTextColor(0, 0, 0);
    leftLines.forEach((line, idx) => {
      doc.text(line, margin + labelWidth, y + 6 + idx * lineHeight);
    });
    rightLines.forEach((line, idx) => {
      doc.text(line, margin + columnWidth + 8 + labelWidth, y + 6 + idx * lineHeight);
    });

    doc.setDrawColor(224, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    y += rowHeight;
  };

  const drawDualRowWithMixedLeft = (
    leftLabel: string,
    amountText: string,
    suffixText: string,
    rightLabel: string,
    rightValue: string | number | null,
  ) => {
    const columnWidth = (contentWidth - 8) / 2;
    const labelWidth = 42;
    const availableWidth = columnWidth - labelWidth - 6;
    const lineHeight = 5.5;

    let suffixSize = 8;
    let suffixDisplay = suffixText;

    const fits = (size: number, suffix: string) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const amountWidth = doc.getTextWidth(amountText);
      doc.setFontSize(size);
      const suffixWidth = doc.getTextWidth(` ${suffix}`);
      return amountWidth + suffixWidth <= availableWidth;
    };

    while (!fits(suffixSize, suffixDisplay) && suffixSize > 6) {
      suffixSize -= 0.5;
    }
    if (!fits(suffixSize, suffixDisplay)) {
      suffixDisplay = suffixText.replace("per ", "/");
    }

    const rightLines = doc.splitTextToSize(valueOrLine(rightValue), availableWidth);
    const rowHeight = lineHeight + 3;

    ensureSpace(rowHeight);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text(`${leftLabel.toUpperCase()}:`, margin + 3, y + 6);
    doc.text(`${rightLabel.toUpperCase()}:`, margin + columnWidth + 8 + 3, y + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    const amountX = margin + labelWidth;
    doc.text(amountText, amountX, y + 6);
    doc.setFontSize(suffixSize);
    doc.text(` ${suffixDisplay}`, amountX + doc.getTextWidth(amountText) + 4, y + 6);

    doc.setFontSize(10);
    rightLines.forEach((line, idx) => {
      doc.text(line, margin + columnWidth + 8 + labelWidth, y + 6 + idx * lineHeight);
    });

    doc.setDrawColor(224, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);

    y += rowHeight;
  };

  const addSection = (title: string, body: string) => {
    ensureSpace(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(title.toUpperCase(), margin, y);
    y += 6;
    doc.setTextColor(0, 0, 0);
    y = addWrappedText(body, margin, y, contentWidth, 6, 10, "normal") + 2;
    y += 2;
  };

  const addNumberedParagraph = (index: number, text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const label = `${index}.`;
    const labelWidth = doc.getTextWidth(`${label} `);
    const indent = labelWidth + 2;
    const maxWidth = contentWidth - indent;
    const lineHeight = 6;
    const paragraphSpacing = 2;
    const lines = doc.splitTextToSize(text, maxWidth);
    const blockHeight = lines.length * lineHeight + paragraphSpacing;

    ensureSpace(blockHeight);
    doc.text(label, margin, y);
    lines.forEach((line, idx) => {
      doc.text(line, margin + indent, y + idx * lineHeight);
    });
    y += lines.length * lineHeight + paragraphSpacing;
  };

  const addClauseHeading = (title: string) => {
    const headingHeight = 6;
    ensureSpace(headingHeight * 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(title.toUpperCase(), margin, y);
    y += headingHeight;
    doc.setFont("helvetica", "normal");
  };

  const addInformationPage = () => {
    const isSouthAfrican = data.nationality === "South African";
    const idDisplay = isSouthAfrican ? data.employeeIdNumber : "--";
    const passportDisplay = isSouthAfrican ? "--" : data.passportNumber || "";
    const workplace = data.workplace || profile?.physical_address || "";

    drawSection("A. Employer details", '(Hereinafter referred to as "The Employer")', () => {
      drawSingleRow("Company name", profile?.company_name || data.tradingName);
      drawSingleRow("Reg. number", profile?.registration_number);
      drawSingleRow("Address", profile?.physical_address);
      drawSingleRow("Email", profile?.company_email || data.employerEmail);
      drawSingleRow("Contact", profile?.company_contact || data.employerContact);
    });

    drawSection("B. Employee details", '(Hereinafter referred to as "the Employee")', () => {
      drawDualRow("Surname", data.employeeSurname, "Name(s)", data.employeeName);
      drawDualRow("ID No.", idDisplay, "Passport No.", passportDisplay || "--");
      drawSingleRow("Contact number", data.employeeCell);
      drawSingleRow("Email", data.employeeEmail || "--");
    });

    drawSection("C. Employment details", undefined, () => {
      drawDualRow("Type", "Temporary", "Start date", formatDate(data.startDate));
      drawDualRow("End date", formatDate(data.endDate), "Probation", probationLabels[data.probationPeriod]);
      drawDualRow("Job title", data.jobTitle, "Department", data.department || "");
      drawDualRowWithMixedLeft(
        "Gross salary",
        formatCurrency(data.salaryAmount),
        salaryFrequencyLabels[data.salaryFrequency],
        "Retirement",
        data.retirementAge ? `Age ${data.retirementAge}` : "",
      );
      drawDualRow("Reports to", data.reportsTo, "Interpreter", data.interpreter === "yes" ? "Yes" : "No");
      drawSingleRow("Workplace", workplace);
    });

    doc.addPage();
    y = margin;
  };

  addInformationPage();

  const clauses = getClauses();
  let clauseNumber = 1;
  clauses.forEach((clause, idx) => {
    if (idx > 0) {
      y += 6;
    }
    const paragraphs = Array.isArray(clause.body) ? clause.body : [clause.body];
    addClauseHeading(clause.title);
    paragraphs.forEach((text) => {
      addNumberedParagraph(clauseNumber, text);
      clauseNumber += 1;
    });
  });

  if (data.additionalNotes) {
    addSection("Additional notes", data.additionalNotes);
  }

  ensureSpace(12);
  y += 8;

  const signatureLabels = ["For the Employer", "Employer Witness", "Employee", "Employee Witness"];
  const signingLine = `Done and Signed at ___________________________ on this _____ day of ____________________ ${issueYear}.`;
  ensureSpace(12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(signingLine, margin, y);
  y += 16;

  doc.addPage();
  y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("SIGNATURES", margin, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  signatureLabels.forEach((label) => {
    ensureSpace(20);
    doc.text("_______________________________", margin, y);
    doc.text("Date: __________________", margin + 110, y);
    y += 4;
    doc.text(label, margin, y);
    y += 16;
  });

  const pageCount = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    const footerY = pageHeight - 10;
    doc.text(`Page ${i} of ${pageCount}`, margin, footerY, { align: "left" });
    doc.text("Initial here: ______________________", pageWidth - margin, footerY, { align: "right" });
  }

  return doc.output("arraybuffer");
};

const FirstPagePreview = ({
  data,
  profile,
}: {
  data: TemporaryContractFormData;
  profile: Tables<"profiles"> | null;
}) => {
  const displayValue = (value?: string | number | null) => (value && value.toString().trim() ? value.toString() : "________________________");
  const salaryDisplay = `${formatCurrency(data.salaryAmount)} ${salaryFrequencyLabels[data.salaryFrequency]}`;
  const workplace = data.workplace || profile?.physical_address || "";
  const isSouthAfrican = data.nationality === "South African";
  const idDisplay = isSouthAfrican ? data.employeeIdNumber : "--";
  const passportDisplay = isSouthAfrican ? "--" : data.passportNumber || "--";

  const SectionHeader = ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div className="bg-slate-100 border border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-700 flex items-center">
      <span>{title}</span>
      {subtitle ? <span className="ml-2 italic normal-case font-medium text-gray-600">{subtitle}</span> : null}
    </div>
  );

  const SingleRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="grid grid-cols-[120px_1fr] gap-2 border-b border-slate-200 py-2 px-3 text-[11px]">
      <span className="font-semibold italic uppercase text-gray-700">{label}:</span>
      <span className="text-gray-900">{displayValue(value)}</span>
    </div>
  );

  const DualRow = ({
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
  }: {
    leftLabel: string;
    leftValue?: string | number | null;
    rightLabel: string;
    rightValue?: string | number | null;
  }) => (
    <div className="grid grid-cols-2 gap-4 border-b border-slate-200 py-2 px-3 text-[11px]">
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <span className="font-semibold italic uppercase text-gray-700 whitespace-nowrap">{leftLabel}:</span>
        <span className="text-gray-900">{displayValue(leftValue)}</span>
      </div>
      <div className="grid grid-cols-[120px_1fr] gap-2">
        <span className="font-semibold italic uppercase text-gray-700 whitespace-nowrap">{rightLabel}:</span>
        <span className="text-gray-900">{displayValue(rightValue)}</span>
      </div>
    </div>
  );

  return (
    <div className="bg-white text-black p-6 border border-slate-200 shadow-sm space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-700">Temporary Employment Contract</p>
        <p className="text-sm text-gray-600">Page 1 preview</p>
      </div>

      <div className="space-y-4">
        <div>
          <SectionHeader title="A. Employer details" subtitle='(Hereinafter referred to as "The Employer")' />
          <div className="border border-slate-200 border-t-0">
            <SingleRow label="Company name" value={profile?.company_name || data.tradingName} />
            <SingleRow label="Reg. number" value={profile?.registration_number} />
            <SingleRow label="Address" value={profile?.physical_address} />
            <SingleRow label="Email" value={profile?.company_email || data.employerEmail} />
            <SingleRow label="Contact" value={profile?.company_contact || data.employerContact} />
          </div>
        </div>

        <div>
          <SectionHeader title="B. Employee details" subtitle='(Hereinafter referred to as "the Employee")' />
          <div className="border border-slate-200 border-t-0">
            <DualRow leftLabel="Surname" leftValue={data.employeeSurname} rightLabel="Name(s)" rightValue={data.employeeName} />
            <DualRow leftLabel="ID no." leftValue={idDisplay} rightLabel="Passport no." rightValue={passportDisplay} />
            <SingleRow label="Contact number" value={data.employeeCell} />
            <SingleRow label="Email" value={data.employeeEmail || "--"} />
          </div>
        </div>

        <div>
          <SectionHeader title="C. Employment details" />
          <div className="border border-slate-200 border-t-0">
            <DualRow leftLabel="Type" leftValue="Temporary" rightLabel="Start date" rightValue={formatDate(data.startDate)} />
            <DualRow leftLabel="End date" leftValue={formatDate(data.endDate)} rightLabel="Probation" rightValue={probationLabels[data.probationPeriod]} />
            <DualRow leftLabel="Job title" leftValue={data.jobTitle} rightLabel="Department" rightValue={data.department} />
            <DualRow leftLabel="Gross salary" leftValue={salaryDisplay} rightLabel="Retirement" rightValue={data.retirementAge ? `Age ${data.retirementAge}` : ""} />
            <DualRow leftLabel="Reports to" leftValue={data.reportsTo} rightLabel="Interpreter" rightValue={data.interpreter === "yes" ? "Yes" : "No"} />
            <SingleRow label="Workplace" value={workplace} />
          </div>
        </div>
      </div>
    </div>
  );
};

const TemporaryContractBatch = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const steps = ["Employer", "Employees", "Employment", "Preview & Download"];
  const [employees, setEmployees] = useState<BatchEmployee[]>([emptyEmployee()]);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState<BatchEmployee>(emptyEmployee());
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [shared, setShared] = useState<SharedEmployment>({
    startDate: todayIso(),
    endDate: "",
    issueDate: todayIso(),
    tradingName: "",
    employerContact: "",
    employerEmail: "",
    jobTitle: "",
    salaryAmount: "",
    salaryFrequency: "month",
    workplace: "",
    interpreter: "no",
    reportsTo: "N/A",
  });
  const [previewData, setPreviewData] = useState<TemporaryContractFormData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) {
        console.warn("Unable to load profile", error);
        return;
      }
      if (data) {
        setProfile(data);
        setShared((prev) => ({
          ...prev,
          workplace: prev.workplace || data.physical_address || "",
          employerContact: prev.employerContact || data.company_contact || "",
          employerEmail: prev.employerEmail || data.company_email || "",
          tradingName: prev.tradingName || data.company_name || "",
        }));
      }
    };
    loadProfile();
  }, [user]);

  const employerValid = useMemo(
    () => Boolean(shared.employerContact && shared.employerEmail && shared.workplace),
    [shared.employerContact, shared.employerEmail, shared.workplace],
  );

  const employmentValid = useMemo(
    () =>
      Boolean(
        shared.startDate &&
          shared.endDate &&
          shared.issueDate &&
          shared.jobTitle &&
          shared.salaryAmount &&
          shared.salaryFrequency &&
          shared.workplace,
      ),
    [shared],
  );

  const employeesValid = useMemo(
    () =>
      employees.length > 0 &&
      employees.every(
        (emp) =>
          emp.employeeName &&
          emp.employeeSurname &&
          emp.employeeAddress &&
          emp.employeeCell &&
          ((emp.employeeIdNumber && emp.employeeIdNumber.length === 13) || emp.passportNumber),
      ),
    [employees],
  );

  const canGoNext = () => {
    if (activeStep === 0) return employerValid;
    if (activeStep === 1) return employerValid && employeesValid;
    if (activeStep === 2) return employerValid && employeesValid && employmentValid;
    return true;
  };

  const buildFormData = (emp: BatchEmployee): TemporaryContractFormData => {
    const hasId = Boolean(emp.employeeIdNumber && emp.employeeIdNumber.length === 13);
    return {
      startDate: shared.startDate,
      endDate: shared.endDate,
      issueDate: shared.issueDate,
      employeeName: emp.employeeName,
      employeeSurname: emp.employeeSurname,
      employeeIdNumber: hasId ? emp.employeeIdNumber : "",
      passportNumber: hasId ? "" : emp.passportNumber,
      employeeAddress: emp.employeeAddress,
      employeePostalAddress: emp.employeeAddress,
      employeeNumber: emp.employeeNumber,
      nationality: hasId ? "South African" : "Other",
      gender: "Male",
      race: "African",
      employeeCell: emp.employeeCell,
      alternativeContact: "",
      employeeEmail: "",
      tradingName: shared.tradingName,
      employerContact: shared.employerContact,
      employerEmail: shared.employerEmail,
      jobTitle: shared.jobTitle,
      salaryAmount: Number(shared.salaryAmount),
      annualLeaveDays: 15,
      salaryFrequency: shared.salaryFrequency,
      probationPeriod: "3",
      department: "",
      retirementAge: "65",
      workplace: shared.workplace,
      interpreter: shared.interpreter,
      reportsTo: shared.reportsTo || "N/A",
      additionalNotes: "",
    };
  };

  const handlePreview = () => {
    if (!employerValid || !employmentValid || !employeesValid) {
      toast({
        title: "Missing details",
        description: "Please complete employer, employees, and employment details before previewing.",
        variant: "destructive",
      });
      return;
    }
    try {
      const validated = temporaryContractSchema.parse(buildFormData(employees[0]));
      setPreviewData(validated);
      setActiveStep(3);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please check the required fields.";
      toast({
        title: "Validation error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadZip = async () => {
    if (!employerValid || !employmentValid || !employeesValid) {
      toast({
        title: "Incomplete",
        description: "Finish the shared and employee details first.",
        variant: "destructive",
      });
      return;
    }
    setIsGenerating(true);
    try {
      const zip = new JSZip();
      for (const emp of employees) {
        const validated = temporaryContractSchema.parse(buildFormData(emp));
        const pdfBuffer = generateContractPdf(validated, profile);
        const filename = `Temporary_Contract_${emp.employeeSurname || "Employee"}_${shared.startDate}.pdf`;
        zip.file(filename, pdfBuffer);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Temporary_Contracts_Batch_${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "Batch contracts downloaded as ZIP." });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Unable to generate ZIP. Please try again.", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const updateEmployee = (id: string, key: keyof BatchEmployee, value: string) => {
    setEmployees((prev) => prev.map((emp) => (emp.id === id ? { ...emp, [key]: value } : emp)));
  };

  const addEmployee = () => setEmployees((prev) => [...prev, emptyEmployee()]);
  const removeEmployee = (id: string) => setEmployees((prev) => (prev.length > 1 ? prev.filter((e) => e.id !== id) : prev));

  const saveManualEmployee = () => {
    if (!manualForm.employeeName || !manualForm.employeeSurname || !manualForm.employeeAddress || !manualForm.employeeCell) {
      toast({ title: "Missing fields", description: "Name, surname, cell, and address are required.", variant: "destructive" });
      return;
    }
    if (!manualForm.employeeIdNumber && !manualForm.passportNumber) {
      toast({ title: "ID or Passport needed", description: "Provide either a 13-digit ID or a passport number.", variant: "destructive" });
      return;
    }
    setEmployees((prev) => [...prev, { ...manualForm, id: makeRowId() }]);
    setManualForm(emptyEmployee());
    setManualDialogOpen(false);
  };

  const parsedBulkRows = useMemo(() => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return lines
      .map((line) => {
        const [employeeNumber = "", employeeName = "", employeeSurname = "", employeeIdNumber = "", passportNumber = "", employeeCell = "", employeeAddress = ""] =
          line.split(",").map((s) => s.trim());
        if (!employeeName || !employeeSurname || (!employeeIdNumber && !passportNumber) || !employeeAddress || !employeeCell) return null;
        return {
          id: makeRowId(),
          employeeNumber,
          employeeName,
          employeeSurname,
          employeeIdNumber: employeeIdNumber.replace(/\D/g, "").slice(0, 13),
          passportNumber,
          employeeCell: employeeCell.replace(/\D/g, "").slice(0, 10),
          employeeAddress,
        } as BatchEmployee;
      })
      .filter(Boolean) as BatchEmployee[];
  }, [bulkText]);

  const applyBulkRows = () => {
    if (!parsedBulkRows.length) {
      toast({
        title: "No valid rows",
        description: "Use comma-separated values: EmpNumber,Name,Surname,ID,Passport,Cell,Address",
        variant: "destructive",
      });
      return;
    }
    setEmployees(parsedBulkRows);
    setBulkDialogOpen(false);
    setBulkText("");
  };

  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));
  const handleNext = () => {
    if (activeStep === 2) {
      handlePreview();
      return;
    }
    if (canGoNext()) {
      setActiveStep((prev) => prev + 1);
    } else {
      toast({
        title: "Incomplete",
        description: "Please finish the required fields for this step.",
        variant: "destructive",
      });
    }
  };

  const StepHeader = () => (
    <div className="flex items-center justify-center gap-4">
      {steps.map((step, index) => {
        const isDone = index < activeStep;
        const isActive = index === activeStep;
        const Icon = [Building2, UserPlus, Briefcase, FileText][index] || FileText;
        const circleClasses = isDone ? "bg-[#04b81f] text-white" : isActive ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500";
        const connectorClasses = isDone ? "bg-[#04b81f]" : isActive ? "bg-blue-400" : "bg-slate-200";
        return (
          <div key={step} className="flex items-center gap-4">
            <div className="flex flex-col items-center gap-2">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full shadow-sm ${circleClasses}`}>
                {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className="text-xs font-semibold text-gray-800">{step}</span>
            </div>
            {index < steps.length - 1 && <div className={`h-1 w-16 rounded-full ${connectorClasses}`} aria-hidden="true" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={100}>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium uppercase tracking-wide text-blue-600">Contracts</p>
              <h1 className="text-3xl font-bold text-gray-900">Batch Temporary Contracts</h1>
              <p className="text-base text-gray-600">
              Mirror of the single temporary contract generator, now applying shared employment details to multiple employees and zipping the PDFs.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/documents/contracts")}
            className="flex-shrink-0 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white focus-visible:ring-blue-600"
          >
            <ArrowLeft className="mr-0.5 h-4 w-4" aria-hidden="true" />
            Back to contracts
          </Button>
        </div>

        <StepHeader />

        {activeStep === 0 && (
          <Card className="mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
            <CardContent className="pt-6 space-y-6">
              <div className="rounded-2xl border border-blue-200 bg-slate-50/70 p-4 md:p-6 space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle>Employer details</CardTitle>
                    <CardDescription>Defaults pulled from your company profile.</CardDescription>
                  </div>
                  <span className="text-xs text-slate-500">Step 1 of {steps.length}</span>
                </div>
                <div className="grid md:grid-cols-2 gap-4 [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm">
                  <div className="space-y-1.5">
                    <Label htmlFor="tradingName">Trading name</Label>
                    <Input
                      id="tradingName"
                      value={shared.tradingName}
                      onChange={(e) => setShared((prev) => ({ ...prev, tradingName: e.target.value }))}
                      placeholder="Company / trading name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="employerContact">Employer contact *</Label>
                    <Input id="employerContact" value={shared.employerContact} onChange={(e) => setShared((prev) => ({ ...prev, employerContact: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="employerEmail">Employer email *</Label>
                    <Input
                      id="employerEmail"
                      type="email"
                      value={shared.employerEmail}
                      onChange={(e) => setShared((prev) => ({ ...prev, employerEmail: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="workplace">Workplace *</Label>
                    <Input
                      id="workplace"
                      value={shared.workplace}
                      onChange={(e) => setShared((prev) => ({ ...prev, workplace: e.target.value }))}
                      placeholder="Site address or location"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!canGoNext()}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeStep === 1 && (
          <Card className="mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
            <CardContent className="pt-6 space-y-6">
              <div className="rounded-2xl border border-blue-200 bg-slate-50/70 p-4 md:p-6 space-y-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Employee details</CardTitle>
                    <CardDescription>Rows mirror the single-contract employee fields.</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="icon" className="rounded-full" aria-label="Add employee">
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Add employee</DialogTitle>
                                <DialogDescription>Capture a single employee for this batch.</DialogDescription>
                              </DialogHeader>
                              <div className="grid md:grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label>Employee number</Label>
                                  <Input value={manualForm.employeeNumber} onChange={(e) => setManualForm((p) => ({ ...p, employeeNumber: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Name *</Label>
                                  <Input value={manualForm.employeeName} onChange={(e) => setManualForm((p) => ({ ...p, employeeName: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Surname *</Label>
                                  <Input value={manualForm.employeeSurname} onChange={(e) => setManualForm((p) => ({ ...p, employeeSurname: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>ID number</Label>
                                  <Input
                                    value={manualForm.employeeIdNumber}
                                    onChange={(e) =>
                                      setManualForm((p) => ({ ...p, employeeIdNumber: e.target.value.replace(/\D/g, "").slice(0, 13) }))
                                    }
                                    placeholder="13 digits"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Passport</Label>
                                  <Input value={manualForm.passportNumber} onChange={(e) => setManualForm((p) => ({ ...p, passportNumber: e.target.value }))} />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Cell number *</Label>
                                  <Input
                                    value={manualForm.employeeCell}
                                    onChange={(e) => setManualForm((p) => ({ ...p, employeeCell: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                                    placeholder="Contact number"
                                  />
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                  <Label>Physical address *</Label>
                                  <Input value={manualForm.employeeAddress} onChange={(e) => setManualForm((p) => ({ ...p, employeeAddress: e.target.value }))} />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 pt-4">
                                <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={saveManualEmployee}>Add</Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Add single</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="icon" className="rounded-full" aria-label="Bulk add employees">
                                <Users className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Bulk add employees</DialogTitle>
                                <DialogDescription>Format: EmpNumber,Name,Surname,ID,Passport,Cell,Address (one per line)</DialogDescription>
                              </DialogHeader>
                              <Textarea
                                value={bulkText}
                                onChange={(e) => setBulkText(e.target.value)}
                                rows={6}
                                placeholder="001,Jane,Doe,9901011234088,,0712345678,123 Main Rd"
                              />
                              <Button onClick={applyBulkRows}>Apply</Button>
                            </DialogContent>
                          </Dialog>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Upload batch</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <span className="text-xs text-slate-500">Step 2 of {steps.length}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-600">
                    <span className="col-span-2">Emp #</span>
                    <span className="col-span-3">Name</span>
                    <span className="col-span-3">Surname</span>
                    <span className="col-span-2">ID</span>
                    <span className="col-span-2">Passport</span>
                  </div>
                  {employees.length === 0 ? (
                    <div className="rounded-md border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-600">
                      No employees yet. Use the add buttons above to capture employees.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {employees.map((emp) => (
                        <div key={emp.id} className="grid grid-cols-12 gap-2 items-center border border-slate-200 rounded-md bg-white px-3 py-2">
                          <span className="col-span-2 text-sm text-slate-800">{emp.employeeNumber || "—"}</span>
                          <span className="col-span-3 text-sm text-slate-800">{emp.employeeName}</span>
                          <span className="col-span-3 text-sm text-slate-800">{emp.employeeSurname}</span>
                          <span className="col-span-2 text-sm text-slate-800">{emp.employeeIdNumber || "—"}</span>
                          <div className="col-span-2 flex items-center justify-between gap-2">
                            <span className="text-sm text-slate-800">{emp.passportNumber || "—"}</span>
                            <Button variant="ghost" size="sm" onClick={() => removeEmployee(emp.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!canGoNext()}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeStep === 2 && (
          <Card className="mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
            <CardContent className="pt-6 space-y-6">
              <div className="rounded-2xl border border-blue-200 bg-slate-50/70 p-4 md:p-6 space-y-6">
                <div className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Employment details</CardTitle>
                    <CardDescription>Shared across all selected employees.</CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-slate-500">Step 3 of {steps.length}</span>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4 [&_input]:h-9 [&_input]:py-2 [&_button[role=combobox]]:h-9 [&_textarea]:py-2 [&_textarea]:text-sm">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate">Start date *</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={shared.startDate}
                      onChange={(e) => setShared((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endDate">End date *</Label>
                    <Input id="endDate" type="date" value={shared.endDate} onChange={(e) => setShared((prev) => ({ ...prev, endDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="issueDate">Issue date *</Label>
                    <Input
                      id="issueDate"
                      type="date"
                      value={shared.issueDate}
                      onChange={(e) => setShared((prev) => ({ ...prev, issueDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="jobTitle">Job title *</Label>
                    <Input
                      id="jobTitle"
                      value={shared.jobTitle}
                      onChange={(e) => setShared((prev) => ({ ...prev, jobTitle: e.target.value }))}
                      placeholder="e.g. Site Worker"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="salaryAmount">Gross salary *</Label>
                    <Input
                      id="salaryAmount"
                      value={shared.salaryAmount}
                      onChange={(e) => setShared((prev) => ({ ...prev, salaryAmount: e.target.value.replace(/[^\d.]/g, "") }))}
                      placeholder="e.g. 15000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="salaryFrequency">Salary frequency *</Label>
                    <Select value={shared.salaryFrequency} onValueChange={(val) => setShared((prev) => ({ ...prev, salaryFrequency: val as SharedEmployment["salaryFrequency"] }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {salaryFrequencyOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="interpreter">Interpreter required *</Label>
                    <Select value={shared.interpreter} onValueChange={(val) => setShared((prev) => ({ ...prev, interpreter: val as SharedEmployment["interpreter"] }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no">No</SelectItem>
                        <SelectItem value="yes">Yes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleNext} disabled={!canGoNext()}>
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeStep === 3 && previewData && (
          <Card className="mt-4 shadow-xl border border-blue-100/70 bg-white/95 shadow-blue-100/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Preview (first employee)</CardTitle>
                <CardDescription>Full contract layout matches the single generator.</CardDescription>
              </div>
              <div className="text-sm text-slate-700 flex flex-col items-end gap-1">
                <p>Total employees: {employees.length}</p>
                <p>Each download will be a full contract PDF, zipped together.</p>
                <span className="text-xs text-slate-500">Step 4 of {steps.length}</span>
              </div>
            </CardHeader>
            <CardContent>
              <FirstPagePreview data={previewData} profile={profile} />
            </CardContent>
            <div className="flex justify-between px-6 pb-6">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleDownloadZip} disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Download ZIP"}
              </Button>
            </div>
          </Card>
        )}
        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default TemporaryContractBatch;
