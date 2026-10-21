// One outline icon set, 16px, 1.4px stroke.
const PATHS = {
  updates: "M3 3.5h10v9H3zM3 6l5 3 5-3",
  investors: "M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM1.5 13.5c.6-2.3 2.4-3.5 4.5-3.5s3.9 1.2 4.5 3.5M10.5 3.8a2.3 2.3 0 0 1 0 4.4M12.2 10.3c1.1.5 1.9 1.6 2.3 3.2",
  settings: "M8 10.2a2.2 2.2 0 1 0 0-4.4 2.2 2.2 0 0 0 0 4.4ZM8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M3.6 12.4 5 11M11 5l1.4-1.4",
  menu: "M2.5 4.5h11M2.5 8h11M2.5 11.5h11",
  close: "M4 4l8 8M12 4l-8 8",
  stripe: "M8 1.5 14 5v6l-6 3.5L2 11V5z",
  plus: "M8 3v10M3 8h10",
} as const;

export function Icon({ name, className = "size-4" }: { name: keyof typeof PATHS; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className}>
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
