import "server-only";
import { cookies } from "next/headers";
import { isTimeZone, TZ_COOKIE } from "./timezone";

/** The time zone to show times in. UTC until the founder's browser or Settings says otherwise. */
export async function getTimeZone(): Promise<{ zone: string; known: boolean }> {
  const value = (await cookies()).get(TZ_COOKIE)?.value;
  return isTimeZone(value) ? { zone: value, known: true } : { zone: "UTC", known: false };
}
