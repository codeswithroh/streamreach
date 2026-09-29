import Link from "next/link";
import { Logo } from "@/components/Logo";
import { getCurrentUser } from "@/lib/auth";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen flex flex-col bg-[#f6f7f4]">
      <header className="sticky top-0 z-50 bg-[#f6f7f4]/90 backdrop-blur border-b border-line/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-8">
          <Link href="/" aria-label="StreamReach home">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-ink-2" aria-label="Site">
            <Link href="/#features" className="hover:text-ink">Features</Link>
            <Link href="/#how" className="hover:text-ink">How it works</Link>
            <Link href="/#roles" className="hover:text-ink">Who it&apos;s for</Link>
            <Link href="/standards" className="hover:text-ink">Standards</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <Link href="/app" className="btn-accent px-4 py-2 text-sm">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/signin" className="px-3 py-2 text-sm font-medium hover:text-accent">
                  Sign in
                </Link>
                <Link href="/signin" className="btn-accent px-4 py-2 text-sm">
                  Try the live demo
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 text-xs text-ink-3 flex items-center justify-between">
          <span>© 2026 StreamReach</span>
          <a href="https://github.com/codeswithroh/streamreach" className="hover:text-ink">
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
