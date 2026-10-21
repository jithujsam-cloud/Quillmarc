import type { Metadata } from "next";
import { ContactLink, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Privacy", robots: { index: true, follow: true } };

export default function PrivacyPage() {
  const contact = process.env.CONTACT_EMAIL ?? "";
  return (
    <LegalPage>
      <h1 className="text-4xl">Privacy</h1>
      <p className="text-muted">Last updated October 21, 2026. This covers the Quillmarc app. The waitlist has its own page on the marketing site.</p>

      <h2>What we collect</h2>
      <ul>
        <li>Your account: the email you sign in with.</li>
        <li>Your sender details: your name, company name and reply-to email.</li>
        <li>Your Stripe restricted key, encrypted. We use it only to read subscriptions.</li>
        <li>The numbers we calculate from Stripe for each update, and any figures you edit. We do not store your raw Stripe data.</li>
        <li>Your investors: their names and email addresses, as you entered them.</li>
        <li>Your updates: the bullets you write and who you sent each one to.</li>
        <li>Delivery events for each email: sent, delivered, opened, clicked, bounced, marked as spam. Also when an investor reads the update page or opts out.</li>
        <li>A one-way hash of IP addresses, kept for a day, only to rate limit sign-in and other public endpoints.</li>
      </ul>

      <h2>Why</h2>
      <ul>
        <li>To calculate your monthly numbers and send your update to the people you chose.</li>
        <li>To show you who received, opened and read it.</li>
        <li>To stop emailing anyone who opted out, bounced or marked an update as spam.</li>
        <li>To keep the service safe from abuse.</li>
      </ul>

      <h2>Who processes it</h2>
      <ul>
        <li>Supabase stores the database and handles sign-in.</li>
        <li>Vercel hosts the app.</li>
        <li>Resend sends the emails and reports delivery events.</li>
        <li>Stripe is where we read your subscription data, with the read-only key you create.</li>
      </ul>
      <p>We do not sell or rent your data, or your investors&apos; data, and we do not use it for advertising.</p>

      <h2>Your investors</h2>
      <p>
        Investors get one email per update, from you, with a link to their own page. Every email and page has a link to stop receiving updates. Once they use it, they are never emailed again through Quillmarc by you.
      </p>

      <h2>Opens are estimates</h2>
      <p>Open tracking uses a small image in the email. Some email apps load it automatically, so opens can be wrong. Reads on the update page are more reliable.</p>

      <h2>Deleting your data</h2>
      <p>
        In Settings, Delete all my data removes your account, Stripe key, investors, updates, sends and events at once. Disconnect Stripe deletes the key alone. You can also email <ContactLink email={contact} /> and we will delete everything within 30 days. You can revoke the Stripe key in your Stripe dashboard at any time.
      </p>

      <h2>Contact</h2>
      <p>
        Questions or requests: <ContactLink email={contact} />.
      </p>
    </LegalPage>
  );
}
