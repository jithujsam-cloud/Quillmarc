import { promises as dns } from "node:dns";

/** False only when DNS says the domain cannot receive email. Network trouble does not block the founder. */
export async function domainAcceptsMail(email: string): Promise<boolean> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  const lookup = dns.resolveMx(domain).then(
    (mx) => mx.length > 0,
    async (e: NodeJS.ErrnoException) => {
      if (e.code !== "ENOTFOUND" && e.code !== "ENODATA") return true;
      // No MX record: mail falls back to the A record, so accept a domain that has one.
      return dns.resolve4(domain).then((a) => a.length > 0, () => false);
    },
  );
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(true), 3000));
  return Promise.race([lookup, timeout]);
}
