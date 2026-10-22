import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BarChart, LineChart, type ChartPoint } from "@/components/charts";
import { RevenueImporter } from "@/components/revenue-importer";
import { SetupPanel } from "@/components/setup-panel";
import { TitleRow } from "@/components/title-row";
import { TrialEndedPanel } from "@/components/trial-notice";
import { arpa, churnRate, monthRows, netRetention, percentChange, summarizeRevenue, mainRevenueCurrency } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import { chargeSourceFor, ensureSnapshots } from "@/lib/billing";
import type { MetricsResult } from "@/lib/metrics";
import { formatCount, formatMoney, formatPercent } from "@/lib/metrics/present";
import { compactMoney, dayShort, formatDate, monthName, monthShort, signedPercent } from "@/lib/format";
import { loadDailyRevenue, syncRevenue } from "@/lib/revenue";
import { loadInvestorOverview } from "@/lib/investor-data";
import { getSetupState } from "@/lib/setup";
import { getTimeZone } from "@/lib/timezone-server";
import { adminClient } from "@/lib/supabase/admin";
import { accessFor } from "@/lib/trial";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

// The screen's question: "How is the business doing right now, and is the money coming in?"
export default async function Dashboard() {
  const { supabase, user } = await requireUser();
  const setup = await getSetupState(supabase, user.id);
  const access = accessFor(setup.profile ?? {});

  if (setup.nextStep !== null) {
    return (
      <AppShell crumbs={[{ label: "Dashboard" }]}>
        <TitleRow title="Dashboard" sub="Your revenue and customers appear here once Stripe is connected." />
        <SetupPanel step={setup.nextStep} />
      </AppShell>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  // Both reads are best effort: the saved figures still show if Stripe cannot be reached right now.
  const admin = adminClient();
  const [snapshotResult, syncResult] = await Promise.allSettled([
    ensureSnapshots(user.id),
    chargeSourceFor(user.id).then((source) => syncRevenue(admin, user.id, source, { budgetMs: 2500 })),
  ]);
  const stripeError = setup.connection?.status === "error" ? setup.connection.last_error : snapshotResult.status === "rejected" ? (snapshotResult.reason as Error).message : null;
  const syncError = syncResult.status === "fulfilled" ? syncResult.value.error : null;
  const importing = syncResult.status === "fulfilled" ? !syncResult.value.complete && !syncResult.value.error : false;
  const problem = stripeError ?? syncError;

  const tz = await getTimeZone();
  const [overview, { count: openAsks }] = await Promise.all([
    loadInvestorOverview(supabase, user.id),
    supabase.from("asks").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "done"),
  ]);
  const last = overview.last;
  const { data: snapData } = await supabase.from("metrics_snapshots").select("month, metrics_json").eq("user_id", user.id).order("month");
  const snapshots = (snapData ?? []).map((r) => ({ month: String(r.month).slice(0, 7), metrics: r.metrics_json as MetricsResult }));
  const rows = await loadDailyRevenue(supabase, user.id, `${Number(today.slice(0, 4)) - 1}-01-01`, today);

  const latest = snapshots[snapshots.length - 1]?.metrics ?? null;
  const closed = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const currency = latest && !latest.warnings.some((w) => w.code === "no_subscriptions") ? latest.currency : (mainRevenueCurrency(rows) ?? latest?.currency ?? "usd");
  const revenue = summarizeRevenue(rows, currency, today);
  const money = (n: number) => formatMoney(n, currency);
  const sample = Boolean(latest?.sample);

  const monthChange = percentChange(revenue.monthToDate, revenue.lastMonthSameDays);
  const yearChange = percentChange(revenue.yearToDate, revenue.lastYearSameDays);
  const lastMonthKey = snapshots.length > 1 ? snapshots[snapshots.length - 2].month : null;
  const thisMonthKey = today.slice(0, 7);
  const avgDay = Math.round(revenue.days.reduce((s, d) => s + d.net, 0) / 30);

  const mrrGrowth = latest?.growthPercent ?? null;
  const finding = revenue.anyRevenue
    ? `${money(revenue.monthToDate)} collected so far in ${monthName(thisMonthKey)}${signedPercent(monthChange) ? `, ${signedPercent(monthChange)} against the same days of ${lastMonthKey ? monthName(lastMonthKey) : "last month"}` : ""}.${latest ? ` MRR is ${money(latest.mrr)}.` : ""}`
    : latest
      ? `MRR is ${formatMoney(latest.mrr, latest.currency)}${signedPercent(mrrGrowth) ? `, ${signedPercent(mrrGrowth)} so far this month` : ""}. ${importing ? "Payment history is importing." : "No payments received yet."}`
      : "Reading your Stripe data.";

  const history = monthRows(snapshots);
  const revenueByMonth = new Map(revenue.months.map((m) => [m.month, m.net]));

  const dayPoints: ChartPoint[] = revenue.days.map((d, i) => ({ key: d.day, value: d.net, title: `${dayShort(d.day)}: ${money(d.net)}`, tick: i % 7 === 2 || i === 29 ? dayShort(d.day) : null }));
  const monthPoints: ChartPoint[] = revenue.months.map((m) => ({ key: m.month, value: m.net, title: `${monthShort(m.month, true)}${m.month === thisMonthKey ? " so far" : ""}: ${money(m.net)}`, tick: monthShort(m.month) }));
  const mrrPoints: ChartPoint[] = snapshots.map((s) => ({ key: s.month, value: s.metrics.mrr, title: `${monthShort(s.month, true)}: ${formatMoney(s.metrics.mrr, s.metrics.currency)}`, tick: monthShort(s.month) }));
  const customerPoints: ChartPoint[] = snapshots.map((s) => ({ key: s.month, value: s.metrics.customers, title: `${monthShort(s.month, true)}: ${formatCount(s.metrics.customers)} customers`, tick: monthShort(s.month) }));
  const compact = (n: number) => compactMoney(n, currency);

  const churn = closed ? churnRate(closed.metrics) : null;
  const retention = closed ? netRetention(closed.metrics) : null;

  return (
    <AppShell crumbs={[{ label: "Dashboard" }]}>
      <TitleRow
        title="Dashboard"
        sub={finding}
        actions={
          access.expired ? undefined : (
            <Link href="/updates/new" className="btn">
              New update
            </Link>
          )
        }
      />

      <div className="grid gap-4">
        {problem && (
          <p className="notice" role="status">
            {problem} {setup.connection?.status === "error" && <Link href="/settings#stripe">Open settings</Link>}
          </p>
        )}
        {access.expired && <TrialEndedPanel access={access} />}
        {importing && <RevenueImporter />}
        {sample && (
          <p className="notice" role="status">
            <strong>Sample data.</strong> These figures are fictional. Connect your own Stripe in Settings to see yours.
          </p>
        )}

        {(last || (openAsks ?? 0) > 0) && (
          <section className="panel" aria-labelledby="inv-h">
            <div className="panel-head">
              <h2 id="inv-h">Your investors</h2>
              <Link href="/investors" className="card-link">
                All investors
              </Link>
            </div>
            <div className="kpis border-t border-line">
              <Kpi label="Last update" value={last?.label ?? "-"} sub={last ? `Sent ${formatDate(last.sentAt, tz.zone)}` : "Nothing sent yet"} />
              <Kpi label="Sent to" value={last ? `${last.reached} of ${last.of}` : "-"} sub={last ? "Investors on your list" : "Send your first update"} />
              <Kpi
                label="Gone quiet"
                value={String(overview.quiet.length)}
                sub={overview.quiet.length ? `${overview.quiet.slice(0, 3).map((q) => q.name.split(" ")[0]).join(", ")}${overview.quiet.length > 3 ? ` and ${overview.quiet.length - 3} more` : ""}: not read the last 2` : "Nobody has missed two in a row"}
                tone={overview.quiet.length ? -1 : null}
              />
              <Kpi label="Open asks" value={String(openAsks ?? 0)} sub={<Link href="/asks">See your asks</Link>} />
            </div>
          </section>
        )}

        <section className="panel" aria-labelledby="rev-h">
          <div className="panel-head">
            <h2 id="rev-h">Revenue collected</h2>
            <span className="meta">Payments received minus refunds, by UTC day</span>
          </div>
          <div className="kpis border-t border-line">
            <Kpi label="Today" value={money(revenue.today)} sub={`Yesterday ${money(revenue.yesterday)}`} />
            <Kpi label={monthName(thisMonthKey)} value={money(revenue.monthToDate)} sub={deltaText(monthChange, `the same days of ${lastMonthKey ? monthName(lastMonthKey) : "last month"}`)} tone={monthChange} />
            <Kpi label={today.slice(0, 4)} value={money(revenue.yearToDate)} sub={deltaText(yearChange, `the same days of ${Number(today.slice(0, 4)) - 1}`)} tone={yearChange} />
            <Kpi label="Average per day" value={money(avgDay)} sub="Last 30 days" />
          </div>
        </section>

        {latest && (
          <section className="panel" aria-labelledby="rec-h">
            <div className="panel-head">
              <h2 id="rec-h">Recurring revenue</h2>
              <span className="meta">From your Stripe subscriptions, {monthName(thisMonthKey)} so far</span>
            </div>
            <div className="kpis border-t border-line">
              <Kpi label="MRR" value={formatMoney(latest.mrr, latest.currency)} sub={deltaText(mrrGrowth, `${closed ? monthName(closed.month) : "last month"}`)} tone={mrrGrowth} />
              <Kpi label="ARR" value={formatMoney(latest.mrr * 12, latest.currency)} sub="MRR times 12" />
              <Kpi label="Customers" value={formatCount(latest.customers)} sub={`${formatCount(latest.newCustomers)} new, ${formatCount(latest.churnedCustomers)} churned`} />
              <Kpi label="Net new MRR" value={formatMoney(latest.netNewMrr, latest.currency, { signed: true })} sub={`Estimated, against ${closed ? monthName(closed.month) : "last month"}`} />
            </div>
            <div className="kpis border-t border-line">
              <Kpi label={`Churn${closed ? `, ${monthName(closed.month)}` : ""}`} value={churn === null ? "-" : formatPercent(churn).replace("+", "")} sub="Customers lost, of those at the start" />
              <Kpi label="Revenue per customer" value={arpa(latest) === null ? "-" : formatMoney(arpa(latest) as number, latest.currency)} sub="MRR over customers, a month" />
              <Kpi label={`Net revenue retention${closed ? `, ${monthName(closed.month)}` : ""}`} value={retention === null ? "-" : `${retention.toFixed(1)}%`} sub="Estimated, from today's prices" />
              <Kpi label="New customers" value={formatCount(latest.newCustomers)} sub={`${monthName(thisMonthKey)} so far`} />
            </div>
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel" aria-labelledby="day-h">
            <div className="panel-head">
              <h2 id="day-h">Revenue by day</h2>
              <span className="meta">Last 30 days</span>
            </div>
            <div className="panel-body">{revenue.anyRevenue ? <BarChart data={dayPoints} format={compact} label={`Revenue by day for the last 30 days, ${money(revenue.days.reduce((s, d) => s + d.net, 0))} in total`} /> : <p className="empty">{importing ? "Importing payments." : "No payments in this period."}</p>}</div>
          </section>
          <section className="panel" aria-labelledby="mon-h">
            <div className="panel-head">
              <h2 id="mon-h">Revenue by month</h2>
              <span className="meta">Last 12 months</span>
            </div>
            <div className="panel-body">{revenue.anyRevenue ? <BarChart data={monthPoints} format={compact} label="Revenue collected by month for the last 12 months" /> : <p className="empty">{importing ? "Importing payments." : "No payments in this period."}</p>}</div>
          </section>
          {snapshots.length > 0 && (
            <>
              <section className="panel" aria-labelledby="mrr-h">
                <div className="panel-head">
                  <h2 id="mrr-h">MRR over time</h2>
                  <span className="meta">End of each month</span>
                </div>
                <div className="panel-body">
                  <LineChart data={mrrPoints} format={compact} label="Monthly recurring revenue at the end of each of the last 12 months" endLabel={compact(latest?.mrr ?? 0)} />
                </div>
              </section>
              <section className="panel" aria-labelledby="cus-h">
                <div className="panel-head">
                  <h2 id="cus-h">Customers</h2>
                  <span className="meta">End of each month</span>
                </div>
                <div className="panel-body">
                  <BarChart data={customerPoints} format={(n) => formatCount(n)} label="Customers at the end of each of the last 12 months" />
                </div>
              </section>
            </>
          )}
        </div>

        {history.length > 0 && (
          <section className="panel" aria-labelledby="table-h">
            <div className="panel-head">
              <h2 id="table-h">Month by month</h2>
              <span className="meta">
                {history.length} months. Closed months are saved; {monthName(thisMonthKey)} is live.
              </span>
            </div>
            <table className="table stack">
              <thead>
                <tr>
                  <th>Month</th>
                  <th className="n">MRR</th>
                  <th className="n">Growth</th>
                  <th className="n">Customers</th>
                  <th className="n">New</th>
                  <th className="n">Churned</th>
                  {revenue.anyRevenue && <th className="n">Collected</th>}
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.month}>
                    <td className="font-medium">
                      {monthShort(r.month, true)}
                      {r.month === thisMonthKey && <span className="meta"> so far</span>}
                    </td>
                    <td className="n num">{formatMoney(r.metrics.mrr, r.metrics.currency)}</td>
                    <td className="n line2 sm:text-right" data-tone={r.growth === null || r.growth === 0 ? undefined : r.growth > 0 ? "good" : "bad"}>
                      <span className="num">{signedPercent(r.growth) ?? "-"}</span>
                    </td>
                    <td className="n hidden sm:table-cell num">{formatCount(r.metrics.customers)}</td>
                    <td className="n hidden sm:table-cell num">{formatCount(r.metrics.newCustomers)}</td>
                    <td className="n hidden sm:table-cell num">{formatCount(r.metrics.churnedCustomers)}</td>
                    {revenue.anyRevenue && <td className="n hidden sm:table-cell num">{money(revenueByMonth.get(r.month) ?? 0)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function deltaText(p: number | null, against: string): string {
  const s = signedPercent(p);
  return s ? `${s} against ${against}` : `Nothing to compare with in ${against}`;
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: React.ReactNode; tone?: number | null }) {
  return (
    <div className="kpi">
      <p className="kpi-label">{label}</p>
      <p className="kpi-value">{value}</p>
      <p className="delta" data-tone={tone === undefined || tone === null || tone === 0 ? undefined : tone > 0 ? "good" : "bad"}>
        {sub}
      </p>
    </div>
  );
}
