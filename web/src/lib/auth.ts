import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createUserClient } from "./supabase/server";

/**
 * The signed-in user, looked up once per request however many parts of the page ask (the sidebar,
 * the page, its sections). Asking Supabase who is signed in is a network round trip, so doing it
 * three times on every page view was most of the wait.
 */
export const getAuth = cache(async (): Promise<{ supabase: Awaited<ReturnType<typeof createUserClient>>; user: User | null }> => {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  return { supabase, user: data.user };
});

/** The signed-in founder, or a redirect to /login. */
export async function requireUser(): Promise<{ supabase: Awaited<ReturnType<typeof createUserClient>>; user: User }> {
  const { supabase, user } = await getAuth();
  if (!user) redirect("/login");
  return { supabase, user };
}
