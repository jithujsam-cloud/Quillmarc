import { periodLabel, periodRange, typeLabel, type Period } from "@/lib/periods";

/** What an update covers, in words and dates, wherever the update appears. */
export function PeriodChip({ period, running = false }: { period: Period; running?: boolean }) {
  const label = periodLabel(period);
  const range = periodRange(period);
  return (
    <p className="period-chip" aria-label={`Covers ${label}, ${range}${running ? ", so far" : ""}`}>
      <strong>{typeLabel(period.type)}</strong>
      <span className="dot" aria-hidden="true" />
      <span>{label === range ? range : `${label}, ${range}`}</span>
      {running && (
        <>
          <span className="dot" aria-hidden="true" />
          <span>So far</span>
        </>
      )}
    </p>
  );
}
