import type { SeriesCadence } from '@prisma/client';

function zonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23', weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(parts.year), month: Number(parts.month), day: Number(parts.day),
    hour: Number(parts.hour), minute: Number(parts.minute), second: Number(parts.second),
    weekday: weekdayMap[parts.weekday] ?? 0,
  };
}

function timezoneOffsetMs(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return representedAsUtc - date.getTime();
}

function localToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const first = new Date(guess.getTime() - timezoneOffsetMs(guess, timeZone));
  return new Date(guess.getTime() - timezoneOffsetMs(first, timeZone));
}

export function assertTimeZone(timeZone: string) {
  new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
  return timeZone;
}

export function nextSeriesRun(input: {
  cadence: SeriesCadence;
  weekday?: number | null;
  hour: number;
  minute: number;
  timezone: string;
  from?: Date;
}) {
  const from = input.from ?? new Date();
  assertTimeZone(input.timezone);
  const now = zonedParts(from, input.timezone);
  const localBase = new Date(Date.UTC(now.year, now.month - 1, now.day));

  for (let offset = 0; offset <= 14; offset += 1) {
    const localDate = new Date(localBase.getTime() + offset * 86_400_000);
    const weekday = localDate.getUTCDay();
    if (input.cadence === 'WEEKDAYS' && (weekday === 0 || weekday === 6)) continue;
    if (input.cadence === 'WEEKLY' && weekday !== (input.weekday ?? now.weekday)) continue;

    const candidate = localToUtc(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth() + 1,
      localDate.getUTCDate(),
      input.hour,
      input.minute,
      input.timezone,
    );
    if (candidate.getTime() > from.getTime() + 1000) return candidate;
  }
  throw new Error('Unable to calculate the next series run');
}
