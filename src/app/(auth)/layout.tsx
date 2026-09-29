import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-white">
      <div className="flex flex-col px-6 sm:px-12 py-8">
        <Link href="/" aria-label="StreamReach home">
          <Logo />
        </Link>
        <main className="flex-1 flex items-center">
          <div className="w-full max-w-md mx-auto py-10">{children}</div>
        </main>
        <p className="text-xs text-ink-3">© 2026 StreamReach</p>
      </div>
      <div className="hidden lg:block relative overflow-hidden bg-[#1f2b22]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/landing/dashboard.png" alt="" className="absolute inset-0 w-full h-full object-cover object-left-top opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-2xl font-semibold leading-snug max-w-lg">&ldquo;A warning sign in the stream should reach the clinic before the patient does.&rdquo;</p>
          <p className="text-sm text-white/75 mt-3">One Health early warning for urban streams, built on HL7 FHIR and CDS Hooks.</p>
        </div>
      </div>
    </div>
  );
}
