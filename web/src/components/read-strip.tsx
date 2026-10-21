// The read strip: one mark per investor, Sapphire at three intensities, so "who read it" is
// seen before it is read. Problems (bounced, spam, failed) get the negative pair.
import type { DisplayStatus } from "@/lib/sending/status";

type Kind = "read" | "opened" | "delivered" | "problem" | "none";

function kind(s: DisplayStatus): Kind {
  if (s === "read") return "read";
  if (s === "opened") return "opened";
  if (s === "delivered") return "delivered";
  if (s === "bounced" || s === "complained" || s === "failed") return "problem";
  return "none";
}

export function ReadStrip({ statuses, names }: { statuses: DisplayStatus[]; names?: string[] }) {
  const kinds = statuses.map(kind);
  const count = (k: Kind) => kinds.filter((x) => x === k).length;
  const legend: { k: Kind; label: string }[] = [
    { k: "read", label: "Read" },
    { k: "opened", label: "Opened" },
    { k: "delivered", label: "Delivered" },
    { k: "none", label: "Not yet" },
    { k: "problem", label: "Did not arrive" },
  ];
  return (
    <div className="grid gap-3">
      <div className="strip" role="img" aria-label={legend.filter((l) => count(l.k)).map((l) => `${count(l.k)} ${l.label.toLowerCase()}`).join(", ")}>
        {kinds.map((k, i) => (
          <span key={i} className="mark" data-k={k} title={names?.[i]} />
        ))}
      </div>
      <div className="legend" aria-hidden="true">
        {legend
          .filter((l) => count(l.k) > 0)
          .map((l) => (
            <span key={l.k}>
              <span className="mark" data-k={l.k} />
              {l.label} {count(l.k)}
            </span>
          ))}
      </div>
    </div>
  );
}
