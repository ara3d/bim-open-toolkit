// Calendar dates as plain strings and plain integer arithmetic.
//
// The generators produce dated observations — a delivery, an acceptance, a service visit — and a
// reader compares them as text, so a date is the ten characters `YYYY-MM-DD` and nothing else. The
// conversion is the proleptic Gregorian calendar by Howard Hinnant's civil algorithms, which use
// integer arithmetic only. `Date` is avoided: it carries a time zone and a time of day that this
// data does not have, and it would put a clock inside a function that must be a pure function of
// its seed.
//
// ISO dates of the same length compare correctly with `<`, so no comparison helper is needed.

// A calendar date as `YYYY-MM-DD`. Years before 1000 and after 9999 are out of range.
export type IsoDate = string;

// The number of days from 1970-01-01 to a proleptic Gregorian year, month (1 to 12) and day.
export function daysFromCivil(year: number, month: number, day: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`a civil date must be three integers, got ${year}-${month}-${day}`);
  }
  if (month < 1 || month > 12) throw new Error(`month must be 1 to 12, got ${month}`);
  const shifted = month <= 2 ? year - 1 : year;
  const era = Math.floor(shifted / 400);
  const yearOfEra = shifted - era * 400;
  const dayOfYear = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

// The date this many days after 1970-01-01.
export function isoDate(days: number): IsoDate {
  if (!Number.isInteger(days)) throw new Error(`a day number must be an integer, got ${days}`);
  const shifted = days + 719468;
  const era = Math.floor(shifted / 146097);
  const dayOfEra = shifted - era * 146097;
  const yearOfEra = Math.floor(
    (dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36524) - Math.floor(dayOfEra / 146096)) / 365,
  );
  const dayOfYear = dayOfEra - (yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthPosition = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthPosition + 2) / 5) + 1;
  const month = monthPosition + (monthPosition < 10 ? 3 : -9);
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  if (year < 1000 || year > 9999) throw new Error(`the date for day ${days} is out of range`);
  return `${String(year)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// The day number of an ISO date. Throws for anything that is not `YYYY-MM-DD`.
export function dayOf(date: IsoDate): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) throw new Error(`a date must read YYYY-MM-DD, got ${date}`);
  const [, year, month, day] = match;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`a date must read YYYY-MM-DD, got ${date}`);
  }
  return daysFromCivil(Number(year), Number(month), Number(day));
}

// The date `offset` days after `date`, which may be negative.
export const addDays = (date: IsoDate, offset: number): IsoDate => isoDate(dayOf(date) + offset);
