// Loading screens: the final layout with flat grey bars at the size of what will arrive,
// so nothing jumps when the data lands. No shimmer gradient.
import { Wordmark } from "./wordmark";

function Bar({ w, h = 12, className = "" }: { w: string; h?: number; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width: w, height: h }} />;
}

export function SkeletonShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app" aria-busy="true" aria-live="polite">
      <aside className="app-side" aria-hidden="true">
        <div className="app-brand">
          <Wordmark className="h-[22px] w-auto" />
        </div>
        <div className="mt-6 grid gap-3 px-2.5">
          <Bar w="60%" />
          <Bar w="100%" h={36} />
          <Bar w="100%" h={36} />
          <Bar w="100%" h={36} />
        </div>
      </aside>
      <header className="app-top" aria-hidden="true">
        <Bar w="140px" h={14} />
      </header>
      <main className="app-canvas">
        <p className="sr-only">Loading</p>
        <div className="app-canvas-inner" aria-hidden="true">
          {children}
        </div>
      </main>
    </div>
  );
}

function Title() {
  return (
    <div className="mb-6 grid gap-2.5">
      <Bar w="200px" h={26} />
      <Bar w="320px" h={14} />
    </div>
  );
}

function Rows({ n = 4 }: { n?: number }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <Bar w="120px" h={16} />
      </div>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="flex items-center justify-between gap-6 border-t border-rule px-5 py-4">
          <div className="grid flex-1 gap-2">
            <Bar w="40%" h={14} />
            <Bar w="28%" />
          </div>
          <Bar w="72px" h={22} />
        </div>
      ))}
    </div>
  );
}

function Kpis() {
  return (
    <div className="panel">
      <div className="kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="kpi grid gap-2.5">
            <Bar w="50%" />
            <Bar w="70%" h={i === 0 ? 34 : 26} />
            <Bar w="40%" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <SkeletonShell>
      <Title />
      <Kpis />
      <div className="mt-6">
        <Rows n={3} />
      </div>
    </SkeletonShell>
  );
}

export function TableSkeleton() {
  return (
    <SkeletonShell>
      <Title />
      <Rows n={6} />
    </SkeletonShell>
  );
}

export function StatusSkeleton() {
  return (
    <SkeletonShell>
      <Title />
      <Kpis />
      <div className="mt-6">
        <Rows n={5} />
      </div>
    </SkeletonShell>
  );
}

export function EditorSkeleton() {
  return (
    <SkeletonShell>
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Title />
          <div className="mb-6 flex gap-5 border-b border-line pb-3">
            {[70, 60, 80, 90].map((w, i) => (
              <Bar key={i} w={`${w}px`} h={14} />
            ))}
          </div>
          <div className="panel grid sm:grid-cols-2">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`grid gap-2.5 border-line p-5 ${i > 1 ? "border-t" : ""} ${i % 2 ? "sm:border-l" : ""}`}>
                <Bar w="45%" />
                <Bar w="60%" h={26} />
                <Bar w="70%" />
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block">
          <div className="panel h-[600px] p-5">
            <div className="grid gap-3">
              <Bar w="80%" />
              <Bar w="60%" />
              <Bar w="100%" h={180} className="mt-6" />
              <Bar w="90%" />
              <Bar w="70%" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonShell>
  );
}

export function SettingsSkeleton() {
  return (
    <SkeletonShell>
      <Title />
      {[0, 1].map((i) => (
        <div key={i} className="setting">
          <div className="grid content-start gap-2.5">
            <Bar w="140px" h={16} />
            <Bar w="90%" />
            <Bar w="70%" />
          </div>
          <div className="setting-panel grid gap-4">
            {[0, 1, 2].map((j) => (
              <div key={j} className="grid gap-2">
                <Bar w="120px" />
                <Bar w="100%" h={40} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </SkeletonShell>
  );
}
