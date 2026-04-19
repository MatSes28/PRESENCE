export const BSIT_SECTIONS = [
  "BSIT 1-1",
  "BSIT 1-2",
  "BSIT 1-3",
  "BSIT 2-1",
  "BSIT 2-2",
  "BSIT 2-3",
  "BSIT 3-1",
  "BSIT 3-2",
  "BSIT 3-3",
  "BSIT 4-1",
  "BSIT 4-2",
  "BSIT 4-3",
];

export const getYearFromSection = (section: string) => {
  const match = section.match(/^BSIT\s+([1-4])-/i);
  return match ? Number(match[1]) : undefined;
};

export const formatYearLabel = (year?: string | number | null) => {
  if (!year) return "Not specified";

  const yearNumber = Number(year);
  if (!Number.isFinite(yearNumber)) return String(year);

  const suffix =
    yearNumber === 1 ? "st" : yearNumber === 2 ? "nd" : yearNumber === 3 ? "rd" : "th";
  return `${yearNumber}${suffix} Year`;
};

