# Decisions

Every judgment call made during the October 21, 2026 audit and rebuild, with a one-line reason.

## Architecture
- **Added three Vercel serverless functions (`/api/join`, `/api/answers`, `/api/config`) with no dependencies.** Duplicate handling, rate limiting, saving thank-you answers to the same row and sending email all need a server; plain Node and `fetch` keep the page dependency-free.
- **Signups now write through the server with the Supabase service role key; the browser no longer talks to Supabase.** The old insert-only anon key could not de-duplicate, rate limit or update a row, and keeping keys server-side is safer.
- **New migration revokes all anon access to `waitlist`.** With the server doing every write, the public key should not touch the table at all.
- **The thank-you page finds its row by a random one-time `edit_token`, never by email.** Anyone could type someone else's email; nobody can guess a UUID.
- **Duplicate signups get no edit token.** Otherwise anyone who knows an email could overwrite that person's answers.
- **Public settings are served as `/config.js` from `/api/config` (via a rewrite) and read from env vars.** The booking link, contact email, analytics domain and headline test can change in Vercel without a code edit.
- **Deleted the static `config.js`.** Vercel serves files before rewrites, so a static file would shadow the function.
- **Added `scripts/dev.js`, a local server that mimics Vercel (clean URLs, rewrites, `/api`, gzip).** It lets anyone run and test the full flow locally without the Vercel CLI.
- **Rate limit: 5 signups per hashed IP per 10 minutes.** Generous for real people on shared offices, tight enough to stop a script.
- **IP addresses are stored only as a salted SHA-256 hash.** Rate limiting needs a stable key, not the address.
- **Honeypot field renamed to `qm_hp`, hidden with `aria-hidden`, `tabindex=-1` and `autocomplete=off`, and answered with a fake success.** Password managers autofill fields named "website", which could block a real person; bots get no signal.
- **Welcome email failures never fail the signup.** Losing a signup over an email outage is worse than a missing email.
- **The thank-you page says "we sent a welcome email" only when the server confirms it sent.** Without Resend keys that line would be false.

## Copy and offer
- **Headline A: "Your monthly investor update, written from your Stripe numbers." No time claim.** "In minutes" cannot be defended for a product that does not exist yet.
- **Headline B: "Stop going quiet on your investors."** Tests loss aversion against the outcome headline, as the brief asked.
- **The headline test is chosen by a tiny inline script right after the h1, not by app.js.** Hiding the title until JavaScript loaded cost about a second of first paint.
- **Subhead cut to one outcome sentence.** The old one listed four features.
- **One CTA label everywhere: "Join the waitlist".** "Request my invite" was inconsistent.
- **The Visible price gap moved above the fold with a dated source link, and stays in the comparison table with its own inline source.** A footnote cannot carry the main wedge.
- **Replaced the Carta "50,316 SAFEs" stat with Wimbart's 8.5 out of 10 reporting-quality figure.** Carta showed market size, not the pain of going quiet.
- **Kept the Hustle Fund 2020 poll but labelled its year.** It is still the only investor-side figure on portfolio update rates; the year lets visitors judge it.
- **Labelled the Wimbart 71% as 2023 and as African tech investors.** Its 2024 follow-up shows more investors now get updates, so the figure must not read as current or global.
- **Dropped the Aaron Harris quote and Visible's "3x more likely" claim.** Neither could be verified at a primary source.
- **Founding member wording: "The first 100 founders on the waitlist keep $29 a month for as long as they stay subscribed."** It is the promise the owner approved, stated once, without a counter.
- **Founding status is computed server-side from signup order and shown only to people inside the first 100.** It can then be honoured, and no visitor sees a running count.
- **Terms define the founding price ending if a subscription is cancelled.** "For as long as they stay subscribed" needs that edge stated to be honourable.
- **Thank-you page call copy says a call is "the fastest way to get an early invite."** A short, honest incentive; it commits the owner to prioritising founders who talk to him.
- **"Who is building this" is written in the first person from Jithu.** It reads more human and avoids guessing anyone's pronouns.
- **Photo slot shows a "J" monogram with the gold square until `FOUNDER_PHOTO_URL` is set.** It must look finished with no photo.
- **Name cue: footer reads "Said 'quill mark', spelled with a c."** The one place it reads naturally; it makes the spelling look chosen, not mistyped.
- **Open tracking FAQ names Apple Mail Privacy Protection.** It is the main, widely documented reason opens are inflated.
- **Launch date: "Invites go out in waves." No dates.** The owner cannot yet keep a date.
- **Annual billing mentioned only as "planned".** Per the brief.

## Design
- **The sample update moved directly under the hero.** The finished letter is the most persuasive visual.
- **The sample update stays directly under the hero, on a navy band with off-white dots (owner's call, October 21).** The owner prefers the stronger blue presence of the earlier version over the lighter band the audit suggested.
- **Hero form enlarged (56px controls, visible label, stronger border and shadow).** It is the page's one job and was its weakest element.
- **Hero headline reduced to a 64px maximum.** The owner found 96px and 80px too big, and the smaller size brings the form and preview up.
- **No visible text below 14px outside the product mockups; footer text opacity raised.** Small, faded captions risked failing contrast.
- **Step cards enlarged (taller art, 28px titles, 17px text).** They looked small for the space around them.
- **Dot texture back to the original faint off-white.** The owner found the pale gold distracting.
- **Kept the navy, sapphire and gilt-gold palette from the last approved round, not the older green.** The owner approved it after the brief's green-era description was written.
- **Google Fonts load without blocking first paint; hero text no longer fades in.** Both delayed first paint on phones.

## Technical
- **Canonical domain is hard-coded as `https://quillmarc.vercel.app` in meta tags, `sitemap.xml` and `robots.txt`, and set by `SITE_URL` for emails and share links.** Static meta tags cannot read env vars; update these four spots when the custom domain is live.
- **Analytics: Plausible, loaded only when `PLAUSIBLE_DOMAIN` is set.** No cookies, custom events on all plans, and no dependency; Vercel Web Analytics custom events need a paid plan.
- **`/thanks` is `noindex`, `/brand` stays unlisted (`noindex` plus `robots.txt`).** Neither should appear in search results.
- **Added a 404 page that mentions the spelling.** Some visitors will type "quillmark".
- **OG image and PNG icons are rendered from `brand/tools/og.html` by `brand/tools/render_images.js`.** They stay on-brand and can be regenerated after any copy change.
- **The "raw markdown leaking" finding did not reproduce.** The live HTML has no `==`, `**` or `###`; the strings came from a markdown converter reading the page. Rendered text was re-checked after the rebuild.
