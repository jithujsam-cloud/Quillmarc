// Small charts drawn in HTML and SVG, no script. One series each, so no legend. Four faint
// horizontal lines, a scale on the left, and the one hue on the current period only. Each column
// carries its figure in a tooltip and the whole chart has a plain-text summary for screen readers.

export interface ChartPoint {
  key: string;
  value: number;
  /** Tooltip: "Oct 2026: $15,568" */
  title: string;
  /** Short label under the column, or null for none. */
  tick: string | null;
}

/** A round top for the scale: 0 to 4 steps of 1, 2, 2.5 or 5 times a power of ten. */
export function niceScale(max: number, steps = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: steps, ticks: Array.from({ length: steps + 1 }, (_, i) => i) };
  const raw = max / steps;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((u) => u >= raw) as number;
  return { top: unit * steps, ticks: Array.from({ length: steps + 1 }, (_, i) => unit * i) };
}

function Frame({ ticks, format, label, children, xs, dense = false }: { ticks: number[]; format: (n: number) => string; label: string; children: React.ReactNode; xs: React.ReactNode; dense?: boolean }) {
  return (
    <figure className="chart" role="img" aria-label={label} data-dense={dense ? "" : undefined}>
      <div className="chart-y" aria-hidden="true">
        {[...ticks].reverse().map((t) => (
          <span key={t}>{format(t)}</span>
        ))}
      </div>
      <div className="chart-plot">
        {ticks.map((t, i) => (
          <i key={t} className="chart-grid" style={{ bottom: `${(i / (ticks.length - 1)) * 100}%` }} data-base={i === 0 ? "" : undefined} />
        ))}
        {children}
      </div>
      <div className="chart-x" aria-hidden="true">
        {xs}
      </div>
    </figure>
  );
}

export function BarChart({ data, format, label }: { data: ChartPoint[]; format: (n: number) => string; label: string }) {
  const { top, ticks } = niceScale(Math.max(0, ...data.map((d) => d.value)));
  return (
    <Frame
      ticks={ticks}
      format={format}
      label={label}
      dense={data.length === 12}
      xs={data.map((d) => (
        <span key={d.key}>{d.tick ? <b>{d.tick}</b> : null}</span>
      ))}
    >
      <div className="chart-cols">
        {data.map((d, i) => (
          <div key={d.key} className="chart-col" title={d.title}>
            <span className="chart-bar" data-current={i === data.length - 1 ? "" : undefined} style={{ height: `${(d.value / top) * 100}%` }} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

export function LineChart({ data, format, label, endLabel }: { data: ChartPoint[]; format: (n: number) => string; label: string; endLabel?: string }) {
  const { top, ticks } = niceScale(Math.max(0, ...data.map((d) => d.value)));
  const n = data.length;
  const pts = data.map((d, i) => ({ x: ((i + 0.5) / n) * 100, y: 100 - (d.value / top) * 100 }));
  const last = pts[pts.length - 1];
  return (
    <Frame
      ticks={ticks}
      format={format}
      label={label}
      dense={data.length === 12}
      xs={data.map((d) => (
        <span key={d.key}>{d.tick ? <b>{d.tick}</b> : null}</span>
      ))}
    >
      <svg className="chart-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" />
      </svg>
      <div className="chart-cols chart-hits">
        {data.map((d) => (
          <div key={d.key} className="chart-col" title={d.title} />
        ))}
      </div>
      {last && (
        <>
          <i className="chart-end" style={{ left: `${last.x}%`, top: `${last.y}%` }} />
          {endLabel && (
            <span className="chart-end-label" style={{ right: `${100 - last.x}%`, top: `${last.y}%` }}>
              {endLabel}
            </span>
          )}
        </>
      )}
    </Frame>
  );
}
