import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createUserClient } from "./supabase/server";

/** The signed-in founder, or a redirect to /login. */
export async function requireUser(): Promise<{ supabase: Awaited<ReturnType<typeof createUserClient>>; user: User }> {
  const supabase = await createUserClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");
  return { supabase, user: data.user };
}
