import "server-only";
import { notFound } from "next/navigation";
import { requireUser } from "./auth";
import { env } from "./env";

/** The signed-in user, only if their email is in ADMIN_EMAILS. Everyone else gets a 404. */
export async function requireAdmin() {
  const { user } = await requireUser();
  const email = (user.email ?? "").toLowerCase();
  if (!email || !env.adminEmails().includes(email)) notFound();
  return user;
}
