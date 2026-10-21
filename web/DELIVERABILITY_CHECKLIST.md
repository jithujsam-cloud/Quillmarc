# Deliverability checklist

Run this by hand before the first real founder sends, and again after any change to the sending domain.
Tick each box. Write down anything that fails, with a screenshot of the headers.

## 1. Domain set up in Resend
- [ ] In Resend, Domains, the sending domain (your `SENDING_DOMAIN`, for example `updates.klaroh.com`) shows **Verified**.
- [ ] The SPF (TXT on `send.<domain>`), DKIM (TXT `resend._domainkey.<domain>`) and MX records Resend lists are all green.
- [ ] A DMARC record exists for the parent domain or subdomain. Start with `v=DMARC1; p=none; rua=mailto:<your inbox>` on `_dmarc.<domain>`. Move to `p=quarantine` once reports look clean.
- [ ] **Open tracking is on** for the domain (Resend, Domains, the domain, Configuration). Click tracking is optional; reads come from the hosted page either way.
- [ ] In Vercel: `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `SENDING_DOMAIN` and `APP_URL` are set, and the app was redeployed after setting them.

## 2. Webhook
- [ ] In Resend, Webhooks, an endpoint points to `<APP_URL>/api/webhooks/resend`.
- [ ] Events selected: sent, delivered, delivery delayed, opened, clicked, bounced, complained.
- [ ] Its signing secret is in Vercel as `RESEND_WEBHOOK_SECRET`.
- [ ] Resend's webhook log shows `200` responses after a send (a `401` means the secret is wrong).

## 3. Send a real update to test inboxes
Add yourself as an investor with one address at each provider, create an update, send a test, then send.
- [ ] Gmail (web and phone app)
- [ ] Outlook.com or Microsoft 365
- [ ] Apple Mail (iCloud address, on a Mac or iPhone)
- [ ] Yahoo Mail

For each inbox:
- [ ] It arrived in the **Inbox**, not Spam, Junk or Promotions. Note the folder if not.
- [ ] From reads "<Founder name> via Quillmarc" and the address is `updates@<SENDING_DOMAIN>`.
- [ ] Reply goes to the founder's reply-to address, not to `updates@`.
- [ ] Subject is "<Company> investor update, <Month Year>".
- [ ] The greeting uses that investor's first name. Only one recipient is visible (no CC or BCC).
- [ ] Numbers, bullets and the "Read the full update" button look right, in light and dark mode.
- [ ] The plain text version looks right (Gmail: More, Show original; Apple Mail: View, Message, Plain Text Alternative).
- [ ] Gmail and Yahoo show an "Unsubscribe" link near the sender name (from the List-Unsubscribe header).

## 4. Check authentication in the headers
Open the raw message (Gmail: Show original; Outlook: View message source; Apple Mail: View, Message, All Headers; Yahoo: View raw message).
- [ ] `SPF: PASS` (Gmail shows it at the top; elsewhere look for `spf=pass` in `Authentication-Results`).
- [ ] `DKIM: PASS` with `d=<your sending domain>` (not only `d=resend.com` or `amazonses.com`).
- [ ] `DMARC: PASS`.
- [ ] `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers are present.

## 5. Check events reach the status table
On the update's status page in Quillmarc:
- [ ] Each investor moves from Queued to Sent within a minute.
- [ ] Delivered appears for each inbox within a few minutes.
- [ ] Opening the email shows Opened. Apple Mail usually shows "Opened, possibly automatic" because Mail Privacy Protection loads images on delivery. That is expected.
- [ ] Clicking "Read the full update" and staying on the page for two seconds shows **Read**.
- [ ] "Stop receiving these updates", then confirming, shows **Opted out**, and that address is unticked and locked on the next update.
- [ ] Gmail's one-click Unsubscribe also shows Opted out.
- [ ] Send to a made-up address at a real domain (for example `nobody-qm-test@gmail.com`): it shows **Bounced**, and the investor is marked Bounced on the Investors page.

## 6. Record the result
- [ ] Date, sending domain, and which providers put it in the inbox.
- [ ] Any provider that sent it to spam: check the headers again, wait 24 hours for domain reputation, then retest.
