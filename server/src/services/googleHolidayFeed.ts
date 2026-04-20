const PHILIPPINES_HOLIDAY_EMBED_URL =
  "https://calendar.google.com/calendar/embed?src=en.philippines%23holiday%40group.v.calendar.google.com&ctz=UTC";

type RemoteHoliday = {
  holidayDate: string;
  name: string;
  description: string | null;
  source: "google_philippines";
};

type CacheEntry = {
  expiresAt: number;
  data: RemoteHoliday[];
};

const holidayCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function buildGoogleCalendarIcsUrl(embedUrl: string): string {
  const url = new URL(embedUrl);
  const src = url.searchParams.get("src");

  if (!src) {
    throw new Error("Google Calendar embed URL is missing the src parameter");
  }

  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(src)}/public/basic.ics`;
}

function unfoldIcsLines(icsText: string): string[] {
  const rawLines = icsText.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];

  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }

  return lines;
}

function formatIcsDate(value: string): string | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function parseHolidayEvents(icsText: string): RemoteHoliday[] {
  const lines = unfoldIcsLines(icsText);
  const holidays: RemoteHoliday[] = [];
  let currentEvent: Record<string, string> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (currentEvent) {
        const holidayDate = formatIcsDate(
          currentEvent["DTSTART;VALUE=DATE"] || currentEvent.DTSTART || "",
        );

        if (holidayDate && currentEvent.SUMMARY) {
          holidays.push({
            holidayDate,
            name: currentEvent.SUMMARY,
            description: currentEvent.DESCRIPTION || null,
            source: "google_philippines",
          });
        }
      }

      currentEvent = null;
      continue;
    }

    if (!currentEvent) {
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1).trim();
    currentEvent[key] = value;
  }

  return holidays;
}

export async function getPhilippinesGoogleHolidays(
  year?: number,
): Promise<RemoteHoliday[]> {
  const cacheKey = year ? String(year) : "all";
  const cached = holidayCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const icsUrl = buildGoogleCalendarIcsUrl(PHILIPPINES_HOLIDAY_EMBED_URL);
  const response = await fetch(icsUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch Google holiday feed (${response.status})`);
  }

  const icsText = await response.text();
  let holidays = parseHolidayEvents(icsText);

  if (year) {
    holidays = holidays.filter(
      (holiday) => new Date(holiday.holidayDate).getUTCFullYear() === year,
    );
  }

  holidayCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data: holidays,
  });

  return holidays;
}

export const philippinesHolidayEmbedUrl = PHILIPPINES_HOLIDAY_EMBED_URL;
