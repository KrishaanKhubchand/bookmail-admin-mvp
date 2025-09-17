export const COMMON_TIMEZONES = [
  { value: "Europe/London", city: "London", offset: "GMT+0" },
  { value: "Europe/Paris", city: "Paris", offset: "GMT+1" },
  { value: "Europe/Berlin", city: "Berlin", offset: "GMT+1" },
  { value: "America/New_York", city: "New York", offset: "GMT-5" },
  { value: "America/Chicago", city: "Chicago", offset: "GMT-6" },
  { value: "America/Denver", city: "Denver", offset: "GMT-7" },
  { value: "America/Los_Angeles", city: "Los Angeles", offset: "GMT-8" },
  { value: "America/Toronto", city: "Toronto", offset: "GMT-5" },
  { value: "Asia/Tokyo", city: "Tokyo", offset: "GMT+9" },
  { value: "Asia/Shanghai", city: "Shanghai", offset: "GMT+8" },
  { value: "Asia/Kolkata", city: "Mumbai", offset: "GMT+5:30" },
  { value: "Australia/Sydney", city: "Sydney", offset: "GMT+10" },
  { value: "UTC", city: "UTC", offset: "GMT+0" },
].map(tz => ({
  ...tz,
  label: `${tz.city} (${tz.offset})`
}));

export function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
