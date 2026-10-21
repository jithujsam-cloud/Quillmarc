# Metrics

How Quillmarc calculates each number. The code is `src/lib/metrics/index.ts` (pure functions, no
network) and its tests are `tests/unit/metrics.test.ts`. If you change a rule, change it in all three.

## Inputs

All subscriptions in the Stripe account (`status=all`), read through the Stripe adapter and turned into
our own shape (`src/lib/stripe/normalize.ts`). Per subscription we keep: customer, status, currency,
start date, end date (`ended_at`), trial end, whether collection is paused, items (price and quantity)
and discounts. Nothing else from Stripe is kept, and only the calculated result is stored.

All dates are UTC. A month runs from the first instant of the month to the first instant of the next.
If the chosen month is still running, it ends at "now" and the update says "month to date".

## When a subscription counts

A subscription counts at a moment t when all of these are true:

- Its status is not `incomplete`, `incomplete_expired`, `paused` or `unpaid`, and collection is not paused.
  These are excluded for every month, because Stripe does not say when a pause started.
- It has at least one price we can value (see "Excluded prices").
- It started before t. If it had a trial, it starts counting when the trial ends.
- It had not ended before t (`ended_at` is empty, or on or after t).

So trials, paused, cancelled and incomplete subscriptions are excluded, and a trial that was cancelled
before it converted never counts. `active` and `past_due` subscriptions count. A subscription set to
cancel at period end counts until it actually ends.

## MRR

The sum, over counted subscriptions at the end of the month, of each item's monthly amount:

- `unit_amount × quantity`, from the price object.
- Normalised to a month: monthly ÷ interval count, annual ÷ 12, weekly × 52 ÷ 12, daily × 365 ÷ 12.
- Discounts active at that moment are then applied to the subscription total. Percent discounts first,
  then fixed amounts. A fixed amount is per invoice, so it is divided by the billing interval in months
  (for example, $240 off an annual plan is $20 a month). Never below zero.
- Discount duration: `forever` always applies; `repeating` applies until its end date (or start plus
  `duration_in_months`); `once` applies for one billing interval from its start.

Amounts are in the currency's minor unit (cents) and rounded to whole minor units at the end.

## Customers

Distinct customers with at least one counted subscription at the end of the month.

## New customers

Customers whose first counted subscription began in the month. A customer who returns after leaving is
not new, because their first subscription began earlier.

## Churned customers

Customers whose last counted subscription ended in the month, with no counted subscription still running.

## Last month MRR (estimated)

The same MRR calculation at the first instant of the month. It is rebuilt from start and end dates using
today's prices and today's discounts, so price changes are not rebuilt. It is always labelled "estimated".

## Net new MRR and growth

- Net new MRR = MRR − last month MRR.
- Growth = net new MRR ÷ last month MRR, as a percent with one decimal. Not available when last month is zero.
- Both are labelled "estimated" because they use last month MRR.

## Warnings shown on the review screen

- **Several currencies.** Only the main currency is counted: the one with the most subscriptions that
  count this month or last (ties go alphabetically). The warning names each excluded currency and how many
  subscriptions it has. Investors see this line too.
- **Usage-based prices.** Metered prices are excluded, with a count of affected subscriptions.
- **Tiered prices** with no unit amount are excluded the same way.
- **Large change.** If MRR moved more than 40 percent versus last month.
- **No subscriptions.** The account has none.

## Founder edits

The founder can edit MRR, last month MRR, customers, new customers and churned customers. Net new MRR and
growth are always recalculated from the two MRR figures, and are marked adjusted when either is edited.
Every edited figure is marked "Adjusted by founder" in the email and on the hosted page.

## Known limits

- Price changes and discount changes during past months are not rebuilt.
- Item-level discounts and quantity changes over time are not modelled.
- Paused subscriptions are excluded from every month, including months before the pause.
