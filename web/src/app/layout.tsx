import type { Metadata, Viewport } from "next";
import { Geist_Mono, Hanken_Grotesk, Newsreader } from "next/font/google";
import { BootDone } from "@/components/boot-done";
import { Wordmark } from "@/components/wordmark";
import "./globals.css";

// The landing page's three faces: Newsreader for headings and the letter, Hanken Grotesk for text,
// Geist Mono for figures.
const hanken = Hanken_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-hanken", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-newsreader", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], weight: ["400"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Quillmarc", template: "%s | Quillmarc" },
  description: "Your monthly investor update, written from your Stripe numbers.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1628" },
  ],
};

// Restores the saved theme (qm-theme, see theme-toggle.tsx) and sidebar state (qm-sidebar, see nav-links.tsx)
// before first paint, so neither flashes. Kept here: a string exported from a client module reaches the
// server as a client reference, not as the string.
const PREPAINT_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("qm-theme");if(t==="light"||t==="dark")d.setAttribute("data-theme",t);if(localStorage.getItem("qm-sidebar")==="collapsed")d.setAttribute("data-sidebar","collapsed")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hanken.variable} ${newsreader.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREPAINT_SCRIPT }} />
        <noscript>
          <style>{".boot{display:none}"}</style>
        </noscript>
      </head>
      <body className="min-h-dvh">
        {/* Shown while the page loads after a full reload, then hidden by BootDone. It hides itself after a few seconds in any case. */}
        <div className="boot" aria-hidden="true">
          <Wordmark className="h-7 w-auto" />
          <span className="boot-spin" />
        </div>
        <BootDone />
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
