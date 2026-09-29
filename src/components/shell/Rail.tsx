"use client";

import { BookOpen, ClipboardCheck, Database, LayoutDashboard, LogOut, Stethoscope, Waves } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoMark } from "../Logo";

const ITEMS = [
  { href: "/app", label: "Monitoring", icon: LayoutDashboard, match: (p: string) => p === "/app" },
  { href: "/app/streams/giofyros-1", label: "Stream records", icon: Waves, match: (p: string) => p.startsWith("/app/streams") },
  { href: "/app/check", label: "Stream check", icon: ClipboardCheck, match: (p: string) => p.startsWith("/app/check") },
  { href: "/app/clinic", label: "Clinic view", icon: Stethoscope, match: (p: string) => p.startsWith("/app/clinic") },
  { href: "/app/data", label: "Data", icon: Database, match: (p: string) => p.startsWith("/app/data") },
  { href: "/standards", label: "Standards", icon: BookOpen, match: () => false },
];

export function Rail() {
  const path = usePathname();
  const router = useRouter();
  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <nav
      aria-label="App"
      className="fixed z-[1100] bg-white shadow-[0_8px_28px_rgba(12,18,28,0.12)] flex items-center gap-1
                 bottom-0 inset-x-0 h-16 px-2 justify-around border-t border-line
                 md:top-3 md:bottom-3 md:left-3 md:right-auto md:w-16 md:h-auto md:flex-col md:justify-start md:rounded-2xl md:py-3 md:border-0"
    >
      <Link href="/app" className="hidden md:block mb-4" aria-label="StreamReach home">
        <LogoMark size={36} />
      </Link>
      {ITEMS.map(({ href, label, icon: Icon, match }) => {
        const active = match(path);
        return (
          <Link
            key={label}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`group relative grid place-items-center w-11 h-11 rounded-xl transition-colors ${
              active ? "bg-river text-white" : "text-ink-2 hover:bg-river-soft"
            } ${label === "Standards" ? "hidden md:grid" : ""}`}
          >
            <Icon size={20} strokeWidth={1.8} />
            <span className="pointer-events-none absolute left-14 hidden md:group-hover:block whitespace-nowrap rounded-md bg-ink text-white text-xs px-2 py-1">
              {label}
            </span>
          </Link>
        );
      })}
      <button
        onClick={signOut}
        title="Sign out"
        aria-label="Sign out"
        className="hidden md:grid md:mt-auto place-items-center w-11 h-11 rounded-xl text-ink-2 hover:bg-accent-soft hover:text-accent"
      >
        <LogOut size={20} strokeWidth={1.8} />
      </button>
    </nav>
  );
}
