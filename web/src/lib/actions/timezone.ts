"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isTimeZone, TZ_COOKIE } from "../timezone";

async function remember(zone: string) {
  (await cookies()).set(TZ_COOKIE, zone, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  revalidatePath("/", "layout");
}

/** Called once by the browser, to start from the zone the computer is set to. */
export async function rememberTimeZone(zone: string): Promise<void> {
  if (isTimeZone(zone)) await remember(zone);
}

/** The Settings form. */
export async function setTimeZone(form: FormData): Promise<void> {
  const zone = form.get("tz");
  if (isTimeZone(zone)) await remember(zone);
  redirect("/settings?done=time");
}
