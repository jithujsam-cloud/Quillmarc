import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { BarChart, LineChart, type ChartPoint } from "@/components/charts";
import { ActivityTabs, type Tab } from "@/components/activity-tabs";
import { DashboardRefresher } from "@/components/dashboard-refresher";
import { SetupPanel } from "@/components/setup-panel";
import { TitleRow } from "@/components/title-row";
import { TrialEndedPanel } from "@/components/trial-notice";
import { arpa, churnRate, monthRows, netRetention, percentChange, summarizeRevenue, mainRevenueCurrency } from "@/lib/analytics";
import { requireUser } from "@/lib/auth";
import type { MetricsResult } from "@/lib/metrics";
import { formatCount, formatMoney, formatPercent } from "@/lib/metrics/present";
import { compactMoney, dayShort, formatDate, monthName, monthShort, signedPercent } from "@/lib/format";
import { loadDailyRevenue } from "@/lib/revenue";
import { loadInvestorOverview } from "@/lib/investor-data";
import { periodFromRow, periodLabel, typeLabel } from "@/lib/periods";
import type { UpdateRow } from "@/lib/db-types";
import { getSetupState } from "@/lib/setup";
import { getTimeZone } from "@/lib/timezone-server";
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
  // Show what is saved straight away. DashboardRefresher brings it up to date from Stripe in the background.
  const { data: syncRow } = await supabase.from("revenue_sync").select("backfill_complete").eq("user_id", user.id).maybeSingle();
  const importing = !syncRow?.backfill_complete;
  const problem = setup.connection?.status === "error" ? setup.connection.last_error : null;
  const tz = await getTimeZone();
  const [overview, { count: openAsks }] = await Promise.all([
    loadInvestorOverview(supabase, user.id),
    supabase.from("asks").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "done"),
  ]);
  const last = overview.last;
  const { data: recentData } = await supabase.from("updates").select("id, period_type, period_start, period_end, status, sent_at, investor_total").eq("user_id", user.id).order("period_end", { ascending: false }).order("created_at", { ascending: false }).limit(6);
  const recent = (recentData ?? []) as Pick<UpdateRow, "id" | "period_type" | "period_start" | "period_end" | "status" | "sent_at" | "investor_total">[];
  const { data: recentSends } = recent.length ? await supabase.from("sends").select("update_id, status").in("update_id", recent.map((u) => u.id)) : { data: [] };
  const sentCount = new Map<string, { delivered: number; all: number }>();
  for (const x of (recentSends ?? []) as { update_id: string; status: string }[]) {
    const c = sentCount.get(x.update_id) ?? { delivered: 0, all: 0 };
    c.all += 1;
    if (x.status === "sent") c.delivered += 1;
    sentCount.set(x.update_id, c);
  }
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

  const customersChange = latest && closed ? latest.customers - closed.metrics.customers : null;
  const churn = closed ? churnRate(closed.metrics) : null;
  const retention = closed ? netRetention(closed.metrics) : null;

  const tabs: Tab[] = [
    {
      key: "updates",
      label: "Updates",
      empty: "No updates yet. Add your first one.",
      links: [{ href: "/updates", label: "All updates" }, { href: "/updates/new", label: "Add update" }],
      rows: recent.map((u) => {
        const p = periodFromRow(u);
        const c = sentCount.get(u.id) ?? { delivered: 0, all: 0 };
        return {
          key: u.id,
          href: u.status === "draft" ? `/updates/${u.id}/edit` : `/updates/${u.id}`,
          title: periodLabel(p),
          sub: `${typeLabel(p.type)}${u.sent_at ? `, sent ${formatDate(u.sent_at, tz.zone)}` : ""}`,
          ...(u.status === "draft" ? { pill: { label: "Draft", tone: "quiet" as const } } : u.status === "sending" ? { pill: { label: "Sending", tone: "accent" as const } } : { right: `${c.delivered} of ${u.investor_total ?? c.all}` }),
        };
      }),
    },
    {
      key: "investors",
      label: "Investors",
      empty: "No investors yet. Add your list.",
      links: [{ href: "/investors", label: "All investors" }, ...((openAsks ?? 0) > 0 ? [{ href: "/asks", label: `${openAsks} open ${openAsks === 1 ? "ask" : "asks"}` }] : [])],
      rows: [...overview.investors]
        .sort((a, b) => Number(Boolean(overview.activity.get(b.id)?.quiet)) - Number(Boolean(overview.activity.get(a.id)?.quiet)) || a.name.localeCompare(b.name))
        .slice(0, 6)
        .map((i) => {
          const a = overview.activity.get(i.id);
          const blocked = i.opted_out ? "Opted out" : i.suppressed ? "Not emailed" : null;
          return {
            key: i.id,
            href: `/investors/${i.id}`,
            title: i.name,
            sub: i.email,
            ...(blocked ? { pill: { label: blocked, tone: "quiet" as const } } : a?.quiet ? { pill: { label: "Gone quiet", tone: "warn" as const } } : { right: a?.received ? `${a.read} of ${a.received} read` : "-" }),
          };
        }),
    },
  ];

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
            {problem} {setup.connection?.status === "error" && <Link href="/settings/stripe">Open settings</Link>}
          </p>
        )}
        {access.expired && <TrialEndedPanel access={access} />}
        <DashboardRefresher hasData={snapshots.length > 0} importing={importing} />
        {sample && (
          <p className="notice" role="status">
            <strong>Sample data.</strong> These figures are fictional. Connect your own Stripe in Settings to see yours.
          </p>
        )}

        <section className="headline" aria-label="The numbers that matter most">
          <HeadlineCard
            topic="money"
            label={`Collected in ${monthName(thisMonthKey)}`}
            value={money(revenue.monthToDate)}
            badge={signedPercent(monthChange)}
            tone={toneOf(monthChange)}
            note={signedPercent(monthChange) ? `against the same days of ${lastMonthKey ? monthName(lastMonthKey) : "last month"}` : "Nothing to compare with yet"}
          />
          <HeadlineCard
            topic="money"
            label="MRR"
            value={latest ? formatMoney(latest.mrr, latest.currency) : "-"}
            badge={signedPercent(mrrGrowth)}
            tone={toneOf(mrrGrowth)}
            note={latest ? `against ${closed ? monthName(closed.month) : "last month"}` : "Reading your subscriptions"}
          />
          <HeadlineCard
            topic="customers"
            label="Customers"
            value={latest ? formatCount(latest.customers) : "-"}
            badge={customersChange === null ? null : `${customersChange > 0 ? "+" : customersChange < 0 ? "−" : ""}${Math.abs(customersChange)}`}
            tone={customersChange === null ? undefined : toneOf(customersChange)}
            note={latest ? `${formatCount(latest.newCustomers)} new, ${formatCount(latest.churnedCustomers)} churned` : "Reading your subscriptions"}
          />
          <HeadlineCard
            topic="investors"
            label="Investors gone quiet"
            value={last ? String(overview.quiet.length) : "-"}
            badge={last ? (overview.quiet.length ? "Needs a look" : "All reading") : null}
            tone={last ? (overview.quiet.length ? "warn" : "good") : undefined}
            note={
              !last
                ? "Send your first update"
                : overview.quiet.length
                  ? `${overview.quiet.slice(0, 3).map((q) => q.name.split(" ")[0]).join(", ")}${overview.quiet.length > 3 ? ` and ${overview.quiet.length - 3} more` : ""}: not read the last 2`
                  : "Nobody has missed two in a row"
            }
          />
        </section>

        <div className="grid items-stretch gap-4 lg:grid-cols-3">
          <StatRows
            topic="money"
            id="rev-h"
            title="Revenue"
            note="Payments received, by UTC day"
            rows={[
              { label: "Today", value: money(revenue.today), hint: `Yesterday ${money(revenue.yesterday)}` },
              { label: today.slice(0, 4), value: money(revenue.yearToDate), hint: signedPercent(yearChange) ? `${signedPercent(yearChange)} on the same days of ${Number(today.slice(0, 4)) - 1}` : undefined },
              { label: "Average per day", value: money(avgDay), hint: "Last 30 days" },
              ...(latest
                ? [
                    { label: "ARR", value: formatMoney(latest.mrr * 12, latest.currency), hint: "MRR times 12" },
                    { label: "Net new MRR", value: formatMoney(latest.netNewMrr, latest.currency, { signed: true }), hint: "Estimated" },
                  ]
                : []),
            ]}
          />
          {latest && (
            <StatRows
              topic="customers"
              id="cus-stats-h"
              title="Customers"
              note="From your Stripe subscriptions"
              rows={[
                { label: "New this month", value: formatCount(latest.newCustomers) },
                { label: "Churned this month", value: formatCount(latest.churnedCustomers) },
                { label: `Churn rate${closed ? `, ${monthName(closed.month)}` : ""}`, value: churn === null ? "-" : formatPercent(churn).replace("+", ""), hint: "Of customers at the start" },
                { label: "Revenue per customer", value: arpa(latest) === null ? "-" : formatMoney(arpa(latest) as number, latest.currency), hint: "A month" },
                { label: `Net revenue retention${closed ? `, ${monthName(closed.month)}` : ""}`, value: retention === null ? "-" : `${retention.toFixed(1)}%`, hint: "Estimated" },
              ]}
            />
          )}
          <ActivityTabs title="Recent updates and investors" tabs={tabs} />
        </div>

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

type Tone = "good" | "bad" | "warn" | "flat";

function toneOf(n: number | null | undefined): Tone | undefined {
  return n === null || n === undefined ? undefined : n > 0 ? "good" : n < 0 ? "bad" : "flat";
}

// One of the four numbers that matter most: big, with a coloured badge for how it moved and a line in words.
function HeadlineCard({ topic, label, value, badge, tone, note }: { topic: "money" | "customers" | "investors"; label: string; value: string; badge: string | null; tone?: Tone; note: string }) {
  return (
    <div className={`hcard topic-${topic}`}>
      <p className="hcard-label">
        <span className="topic-dot" aria-hidden="true" />
        {label}
      </p>
      <p className="hcard-value">{value}</p>
      <p className="hcard-foot">
        {badge && (
          <span className="badge-delta" data-tone={tone}>
            {badge}
          </span>
        )}
        <span>{note}</span>
      </p>
    </div>
  );
}

// The supporting numbers of one topic as plain rows: the label on the left, the figure on the right.
function StatRows({ topic, id, title, note, rows }: { topic: "money" | "customers" | "investors"; id: string; title: string; note: string; rows: { label: string; value: string; hint?: React.ReactNode }[] }) {
  return (
    <section className={`panel topic-panel topic-${topic}`} aria-labelledby={id}>
      <div className="panel-head">
        <h2 id={id}>
          <span className="topic-dot" aria-hidden="true" />
          {title}
        </h2>
      </div>
      <p className="meta stat-note">{note}</p>
      <dl className="stat-rows">
        {rows.map((r) => (
          <div key={r.label}>
            <dt>
              {r.label}
              {r.hint && <span className="stat-hint">{r.hint}</span>}
            </dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
