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

## Periods (quarter, year, custom range)

An update covers a month, a calendar quarter, a calendar year, or a custom range of up to 24 months that
ends today or earlier. A period runs from the first instant of its first day to the first instant after its
last day (UTC). The month rules above apply unchanged; "month" simply becomes the period.

- **MRR** is at the end of the period; **last period MRR** is the same calculation at its start. Growth and
  net new MRR compare the two. For a quarter this is "last quarter MRR", for a year "last year MRR", for a
  custom range "last period MRR".
- **New customers**: first counted subscription began inside the period. **Churned customers**: last counted
  subscription ended inside it. A customer who joined and left inside a longer period is neither new at the
  end nor counted in customers at the end, but is counted in both new and churned.
- **Starting customers**: customers counted at the start. **Churn rate** (dashboard) is churned customers over
  starting customers. **Net revenue retention** (dashboard, estimated) is today's MRR from the customers who
  were counted at the start, over their MRR at the start.
- **Compared with the period before.** The update also stores the figures of the previous period of the same
  kind (the previous month, quarter or year; for a custom range, the same number of days directly before it).
  Colour on a comparison says good or bad, not up or down: more churned customers is bad.
- **A period still running** ends at "now" and is labelled "so far".

## Revenue collected

Cash received, from Stripe charges that succeeded, minus refunds, per UTC day and currency. Only the account's
main currency is shown. A refund is counted on the day of the charge it refunds, because Stripe's charge list
does not say when each refund happened. Revenue collected is not MRR: it includes one-off payments, annual
plans in the month they are paid, and ignores discounts that never reached a charge.

Past days are saved in `revenue_daily` and never read from Stripe again, except the last 35 days, which are
re-read once a day so late refunds are picked up. The day a sync last ran is re-read on every sync, so "today"
is current to within five minutes. History older than 35 days is imported a month at a time on first use.

## Dashboard monthly numbers

The dashboard's 12 months come from `metrics_snapshots`. A closed month is calculated once and then left
alone; the running month is recalculated when it is more than five minutes old. "Recalculate history" is not
exposed in the app yet: delete the founder's rows in `metrics_snapshots` to rebuild them.

## Known limits

- Price changes and discount changes during past months are not rebuilt.
- Item-level discounts and quantity changes over time are not modelled.
- Paused subscriptions are excluded from every month, including months before the pause.
