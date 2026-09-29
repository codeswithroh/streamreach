import type { Metadata } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600", "700"] });
const jbmono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "StreamReach: from streams to systems",
  description:
    "One Health early warning for urban streams. Citizen science and weather forecasts become FHIR risk assessments that reach clinicians through CDS Hooks.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${poppins.variable} ${jbmono.variable} antialiased`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
