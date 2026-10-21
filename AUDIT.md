# Quillmarc landing page audit

Audit of the live site (https://quillmarc.vercel.app, identical to `main` at commit 59f25c2) on October 21, 2026, followed by fixes in the same pass. Status: **Fixed**, **Partly fixed** or **Not fixed** (with the reason).

## A. Brand strategist

**Good, kept**
- Navy, ivory and gold palette with serif display type feels calm and trustworthy for a tool that touches money and investor email.
- The pen-written Q wordmark with gold squares is distinctive and consistent across the site, files and brand page.
- The Visible price gap is a real, verifiable wedge: custom-domain sending starts on Visible's $59 a month Base plan (billed annually); the free Starter plan does not include it.

**Bad**
- "Working name" weakened trust. **Fixed:** removed from the site and README; Quillmarc is used identically in titles, metadata, footer, emails, the brand page and the OG image.
- The name reads like a typo of "Quillmark". **Fixed:** consistent wordmark, a natural cue in the footer ("Said 'quill mark', spelled with a c"), the 404 page mentions the spelling, and the brand page states how to set the name.
- The price gap lived in a small footnote. **Fixed:** stated under the hero form with a dated source link, and in the comparison table with an inline source.

## B. Conversion copywriter

**Good, kept**
- The NFX "radio silence" quote, the five-bullets idea, and the do-it-yourself versus Quillmarc comparison.

**Bad**
- Headline clever but vague. **Fixed:** A/B test between "Your monthly investor update, written from your Stripe numbers." and "Stop going quiet on your investors." No time claim, since none can be defended before launch.
- Subhead listed four features. **Fixed:** one outcome sentence.
- Stat cards described investors in general, and "50,316 SAFEs" was market size. **Fixed:** the section now leads with the cost of silence; Carta was replaced with Wimbart's reporting-quality figure; each stat names its year.
- Inconsistent button labels. **Fixed:** "Join the waitlist" everywhere.
- The comparison sat low on the page. **Fixed:** moved up, directly after the cost-of-silence section.
- Cost of staying silent was not the lead. **Fixed:** new section "When you stop writing, investors fill the silence with doubt."

## C. UI and visual designer

**Good, kept**
- Consistent type scale, restrained palette, a realistic product mockup with sample-data labels, mono numerals.

**Bad**
- Huge headline, small pale form. **Fixed:** headline capped at 64px; form controls 56px tall with a visible label, stronger border and shadow; it is now the strongest element under the headline.
- Navy sections in a row felt heavy. **Fixed:** the sample update became a light, warm section; navy remains only for the product stage, one quote panel and the footer.
- Tiny captions and labels. **Fixed:** nothing readable below 14px outside the product mockups; faded footer text raised.
- Step cards small. **Fixed:** taller art, larger titles and body text.
- The finished update sat mid-page. **Fixed:** moved directly under the hero.
- Mobile at 360, 390 and 768px. **Fixed and checked:** no horizontal scroll at any width; form, price note and badge fit the first screen on phones; the product stage crops to the composer and letter on narrow screens.

## D. Behavioral psychologist

- Loss aversion: **Fixed.** Headline B and the "cost of going quiet" section frame silence as a loss (follow-on risk, judged on reporting).
- Effort reduction: **Kept and sharpened.** Five bullets, numbers filled in, no spreadsheet.
- Commitment ladder: **Fixed.** Email, then three quick answers, then the thank-you page asks MRR range and one free-text question, then offers a 15 minute call.
- Authority: **Fixed.** Every statistic links to its source and shows its year; unverifiable claims were removed.
- Reason to act now: **Fixed.** Founding member price shown in the pricing card, on the thank-you page (only to people inside the first 100) and in the welcome email. No counters or countdowns.

## E. Funnel and growth lead

- Nobody visible on the page. **Fixed:** "Who is building this" block in Jithu's words, using only the approved facts; photo slot falls back to a monogram.
- A waitlist email is weak evidence. **Fixed:** thank-you page confirms the spot, asks MRR range (single select) and the most annoying part of the update (optional), offers a call from `BOOKING_URL` (hidden when unset) and a share link with UTM tags. Answers save to the same row by a one-time token.
- Welcome email. **Fixed:** sent through Resend on signup with a sample update, the founding promise and a reply prompt; skipped silently when keys are missing.
- Attribution. **Fixed:** UTM source, medium, campaign, term and content, referrer and landing path are stored with each signup (first touch, kept for the session).
- Analytics. **Fixed:** Plausible loads only when `PLAUSIBLE_DOMAIN` is set; events: Form Start, Signup, Extra Answer, Call Click, plus page views.
- Headline test. **Fixed:** two variants, sticky per browser, switchable with `HEADLINE_TEST`, and stored on each signup.

## F. Trust, legal and honesty reviewer

- No privacy policy or terms. **Fixed:** `/privacy` and `/terms` in plain English, linked in the footer and next to the form. Starting drafts, to be reviewed before launch.
- The 2020 Hustle Fund poll sat beside 2023 to 2025 data. **Fixed:** every stat now shows its year; the 2025 Carta stat was removed.
- Open tracking presented as precise. **Fixed:** the FAQ explains Apple Mail Privacy Protection; copy elsewhere calls opens "a guide".
- "Not affiliated with Stripe" and the sample-data labels. **Kept**, plus a "Sample data" flag on the letter.
- No fake social proof, counters or scarcity. **Checked:** none present.

## G. Technical reviewer

- Raw markdown leaking into copy (`==6.1%==`, `**`, `### `). **Not reproducible:** the live HTML contains none of these. The strings came from a markdown converter's reading of `<mark>`, `<b>` and `<h3>` elements. All shipped HTML was re-scanned after the rebuild and is clean.
- Footer Brand link pointed at a vercel.app address. **Already fixed earlier:** the brand page is no longer linked from the site; internal links are relative.
- Form end to end. **Fixed and tested** against local mocks of Supabase and Resend: validation per field, honeypot (silent success, nothing stored, cannot block real users), duplicate email ("You are already on the list"), rate limiting (5 per hashed IP per 10 minutes), success, database row, failure states (server error and network down both show a clear message and keep the input).
- Metadata. **Fixed:** title, description, canonical, robots, Open Graph and Twitter tags, a branded 1200x630 OG image, SVG and PNG favicons, an Apple touch icon, `sitemap.xml`, `robots.txt` and a branded 404 page.
- Accessibility. **Fixed:** labels on every field, visible focus, reduced motion respected, decorative product art `aria-hidden` or labelled with `role="img"`, contrast measured for every text element in light and dark mode (all pass).
- Performance (Lighthouse 12, local with gzip). **Fixed:** mobile 100, 100, 100, 100 and desktop 100, 100, 100, 100 for performance, accessibility, best practices and SEO on a warm run (a cold run scored 85 to 89 on performance while fonts downloaded). Fonts no longer block first paint and hero text no longer fades in. `/thanks` scores 66 on SEO by design (`noindex`).

## Not fixed, and why
- **Live database and email are not connected.** No Supabase project could be created (the account is at its free project limit) and no Resend key exists. The code is ready; see `.env.example`.
- **Visible pricing can change.** It is dated "checked October 2026" in both places; recheck before major launches.
- **Privacy and terms are drafts, not legal advice.** They should be reviewed by a lawyer before launch.
