// The founder's time zone. Everything is stored and calculated in UTC; this only changes how a time is
// shown. It lives in a cookie, set from the browser the first time and changeable in Settings.
export const TZ_COOKIE = "qm-tz";

export function isTimeZone(raw: unknown): raw is string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return true;
  } catch {
    return false;
  }
}

/** Every zone the browser knows, UTC first. */
export function timeZoneOptions(): string[] {
  const all = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  return ["UTC", ...all.filter((z) => z !== "UTC")];
}
