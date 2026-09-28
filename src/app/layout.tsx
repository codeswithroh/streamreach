import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { NavLinks } from "@/components/NavLinks";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const jbmono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StreamReach: from streams to systems",
  description:
    "One Health early warning for urban streams. Citizen science and weather forecasts become FHIR risk assessments that reach clinicians through CDS Hooks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} ${jbmono.variable} antialiased`}>
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-line bg-paper/90 backdrop-blur sticky top-0 z-[1000]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <Logo />
              <span className="font-display text-xl">StreamReach</span>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line mt-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-ink-3 flex flex-wrap gap-x-6 gap-y-2 justify-between">
            <span>
              StreamReach · IEEE OneAquaHealth Global Hackathon 2026 · Track 6 Resilience Informatics + Track 7 Digital Health
              Standards
            </span>
            <span>
              Weather: Open-Meteo · Profiles: HL7 Europe OneAquaHealth IG · Clinical integration: CDS Hooks 2.0
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0d6e79" />
      <path d="M6 20c4-6 7 2 11-3s5-6 9-5" stroke="#dcefee" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M6 25c4-4 8 1 12-2.5S23 18 26 18.5" stroke="#8fd0cf" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="23" cy="9" r="2.2" fill="#f3b34c" />
    </svg>
  );
}
