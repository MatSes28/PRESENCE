import db from "../storage.js";
import { academicHolidays } from "../schema.js";
import { and, eq, or, sql } from "drizzle-orm";

export type AcademicHoliday = {
  id: number;
  holidayDate: string;
  name: string;
  description: string | null;
  recursAnnually: boolean;
  isActive: boolean;
};

export const formatDateOnly = (date: Date) => date.toISOString().slice(0, 10);

export const getHolidayForDate = async (
  date: Date,
): Promise<AcademicHoliday | null> => {
  const dateOnly = formatDateOnly(date);
  const monthDay = dateOnly.slice(5);

  const [holiday] = await db
    .select({
      id: academicHolidays.id,
      holidayDate: academicHolidays.holidayDate,
      name: academicHolidays.name,
      description: academicHolidays.description,
      recursAnnually: academicHolidays.recursAnnually,
      isActive: academicHolidays.isActive,
    })
    .from(academicHolidays)
    .where(
      and(
        eq(academicHolidays.isActive, true),
        or(
          eq(academicHolidays.holidayDate, dateOnly),
          and(
            eq(academicHolidays.recursAnnually, true),
            sql`substr(${academicHolidays.holidayDate}, 6, 5) = ${monthDay}`,
          ),
        ),
      ),
    )
    .limit(1);

  return holiday ?? null;
};
