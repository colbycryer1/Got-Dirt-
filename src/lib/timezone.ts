// US state abbreviation → IANA timezone (primary timezone for states that span zones)
const STATE_TIMEZONE: Record<string, string> = {
  AL: "America/Chicago",
  AK: "America/Anchorage",
  AZ: "America/Phoenix",
  AR: "America/Chicago",
  CA: "America/Los_Angeles",
  CO: "America/Denver",
  CT: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York",
  GA: "America/New_York",
  HI: "Pacific/Honolulu",
  ID: "America/Boise",
  IL: "America/Chicago",
  IN: "America/Indiana/Indianapolis",
  IA: "America/Chicago",
  KS: "America/Chicago",
  KY: "America/New_York",
  LA: "America/Chicago",
  ME: "America/New_York",
  MD: "America/New_York",
  MA: "America/New_York",
  MI: "America/Detroit",
  MN: "America/Chicago",
  MS: "America/Chicago",
  MO: "America/Chicago",
  MT: "America/Denver",
  NE: "America/Chicago",
  NV: "America/Los_Angeles",
  NH: "America/New_York",
  NJ: "America/New_York",
  NM: "America/Denver",
  NY: "America/New_York",
  NC: "America/New_York",
  ND: "America/Chicago",
  OH: "America/New_York",
  OK: "America/Chicago",
  OR: "America/Los_Angeles",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  UT: "America/Denver",
  VT: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  WV: "America/New_York",
  WI: "America/Chicago",
  WY: "America/Denver",
};

const COB_HOUR   = 17; // 5 PM
const COB_MINUTE = 30; // :30

/**
 * Returns the UTC Date object that corresponds to 5:30 PM local time
 * on the same calendar day as `referenceDate` in the given pit state's timezone.
 *
 * Works correctly across DST transitions and all US timezones.
 */
export function getCobDueAt(pitState: string, referenceDate: Date): Date {
  const tz = STATE_TIMEZONE[pitState?.toUpperCase() ?? ""] ?? "America/New_York";

  // Get the calendar date in the pit's local timezone (en-CA = ISO "YYYY-MM-DD" format)
  const localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(referenceDate);

  // Create a naive UTC point at COB on that date
  const naiveUtc = new Date(`${localDateStr}T${String(COB_HOUR).padStart(2, "0")}:${String(COB_MINUTE).padStart(2, "0")}:00Z`);

  // Find what local hour:minute naiveUtc displays as in the target timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour:     "2-digit",
    minute:   "2-digit",
    hour12:   false,
  }).formatToParts(naiveUtc);

  const localHour = parseInt(parts.find((p) => p.type === "hour")?.value   ?? String(COB_HOUR));
  const localMin  = parseInt(parts.find((p) => p.type === "minute")?.value ?? String(COB_MINUTE));

  // Shift naiveUtc by the difference to land on 17:30 local
  const diffMs = ((COB_HOUR - (localHour % 24)) * 60 + (COB_MINUTE - localMin)) * 60 * 1000;
  return new Date(naiveUtc.getTime() + diffMs);
}

/** Returns true if `date` is past 5:30 PM local time in the given state. */
export function isAfterCOB(pitState: string, date: Date): boolean {
  return date > getCobDueAt(pitState, date);
}
