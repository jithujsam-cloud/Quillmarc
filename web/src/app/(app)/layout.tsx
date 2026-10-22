import { AppFrame } from "@/components/app-shell";

// The signed-in pages share one frame, so the sidebar stays mounted while only the page changes.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppFrame>{children}</AppFrame>;
}
