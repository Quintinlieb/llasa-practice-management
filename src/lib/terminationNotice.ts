const NORMALIZED_POSTAL_METHODS = new Set(["by registered post", "by regular post"]);
const NORMALIZED_SAME_DAY_METHODS = new Set(["by hand", "by email", "by whatsapp", "by facebook"]);

const normalizeMethod = (value: string) => value.trim().toLowerCase();

const toNormalizedDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

export const getTransmissionServiceDelayDays = (transmissionMethodsRaw: string[]) => {
  const methods = transmissionMethodsRaw.map(normalizeMethod);
  const hasPostalMethod = methods.some((method) => NORMALIZED_POSTAL_METHODS.has(method));
  if (!hasPostalMethod) return 0;

  const hasSameDayMethod = methods.some((method) => NORMALIZED_SAME_DAY_METHODS.has(method));
  return hasSameDayMethod ? 0 : 7;
};

export const addServiceDelayToDate = (baseDate: Date, transmissionMethodsRaw: string[]) => {
  const nextDate = new Date(baseDate);
  const serviceDelayDays = getTransmissionServiceDelayDays(transmissionMethodsRaw);
  if (serviceDelayDays > 0) {
    nextDate.setDate(nextDate.getDate() + serviceDelayDays);
  }
  return nextDate;
};

export const parseNoticePeriod = (noticePeriodRaw: string) => {
  const notice = (noticePeriodRaw || "").trim().toLowerCase();
  const match = notice.match(/^(\d+)\s+(day|days|week|weeks|month|months)$/);
  if (!match) return null;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return { amount, unit };
};

export const getNoticeEndDateWithServiceDelay = (
  issueDateRaw: string,
  noticePeriodRaw: string,
  transmissionMethodsRaw: string[],
) => {
  const issueDate = toNormalizedDate((issueDateRaw || "").trim());
  if (!issueDate) return null;

  const notice = parseNoticePeriod(noticePeriodRaw);
  if (!notice) return null;

  const startDate = addServiceDelayToDate(issueDate, transmissionMethodsRaw);
  const endDate = new Date(startDate);

  if (notice.unit === "day" || notice.unit === "days") {
    endDate.setDate(endDate.getDate() + notice.amount);
    return endDate;
  }
  if (notice.unit === "week" || notice.unit === "weeks") {
    endDate.setDate(endDate.getDate() + notice.amount * 7);
    return endDate;
  }
  endDate.setMonth(endDate.getMonth() + notice.amount);
  return endDate;
};
