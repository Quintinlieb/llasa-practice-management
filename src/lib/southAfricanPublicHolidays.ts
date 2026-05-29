type PublicHolidayRow = {
  date: string;
  localName?: string | null;
  name?: string | null;
};

const southAfricanPublicHolidayCache = new Map<number, Record<string, string>>();

const normalizeHolidayText = (value: unknown) => String(value ?? "").trim();

export const getSouthAfricanPublicHolidayName = async (dateValue: string) => {
  const date = normalizeHolidayText(dateValue);
  const year = Number.parseInt(date.slice(0, 4), 10);
  if (!date || !Number.isFinite(year)) return "";

  if (!southAfricanPublicHolidayCache.has(year)) {
    try {
      const response = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ZA`);
      if (!response.ok) throw new Error("Unable to load public holidays.");
      const rows = await response.json() as PublicHolidayRow[];
      southAfricanPublicHolidayCache.set(
        year,
        Object.fromEntries(
          (Array.isArray(rows) ? rows : [])
            .map((holiday) => [
              normalizeHolidayText(holiday.date),
              normalizeHolidayText(holiday.localName) || normalizeHolidayText(holiday.name),
            ])
            .filter(([holidayDate, label]) => Boolean(holidayDate && label)),
        ),
      );
    } catch {
      southAfricanPublicHolidayCache.set(year, {});
    }
  }

  return southAfricanPublicHolidayCache.get(year)?.[date] || "";
};

export const warnIfSouthAfricanPublicHoliday = async (dateValue: string) => {
  const holidayName = await getSouthAfricanPublicHolidayName(dateValue);
  if (!holidayName) return;
  window.alert(`The selected date is a South African public holiday: ${holidayName}.`);
};
