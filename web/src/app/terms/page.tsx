import type { Metadata } from "next";
import { ContactLink, LegalPage } from "@/components/legal-page";

export const metadata: Metadata = { title: "Terms", robots: { index: true, follow: true } };

export default function TermsPage() {
  const contact = process.env.CONTACT_EMAIL ?? "";
  return (
    <LegalPage>
      <h1>Terms</h1>
      <p className="text-muted">Last updated October 21, 2026.</p>

      <h2>The service</h2>
      <p>Quillmarc reads your Stripe subscriptions with a read-only key, calculates key numbers, and sends your monthly update to your investors. It is an early version used by a small group of founders.</p>

      <h2>Your responsibilities</h2>
      <ul>
        <li>Only add people who expect updates from you, such as your investors.</li>
        <li>Check the numbers before you send. You can edit any figure, and edited figures are marked as adjusted by founder.</li>
        <li>Keep your sign-in email secure. Anyone with access to it can sign in.</li>
        <li>Do not use Quillmarc to send marketing, spam or anything unlawful.</li>
      </ul>

      <h2>The numbers</h2>
      <p>We calculate figures from your Stripe data using the definitions shown next to each number. Last month is an estimate. We work to get the numbers right, but you are responsible for what you send.</p>

      <h2>Price</h2>
      <p>The app is free during this early version. We will tell you before anything changes.</p>

      <h2>Ending</h2>
      <p>You can stop at any time and delete all your data in Settings. We may suspend an account that sends spam or harms other people.</p>

      <h2>No warranty</h2>
      <p>The service is provided as is. To the extent the law allows, we are not liable for indirect losses.</p>

      <h2>Not affiliated</h2>
      <p>Quillmarc is not affiliated with Stripe. The name is used only to describe how Quillmarc connects.</p>

      <h2>Contact</h2>
      <p>
        <ContactLink email={contact} />
      </p>
    </LegalPage>
  );
}
