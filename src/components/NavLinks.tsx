"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Situation room" },
  { href: "/check", label: "Stream check" },
  { href: "/clinic", label: "Clinic view" },
  { href: "/data", label: "Data" },
  { href: "/standards", label: "Standards" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-sm -mx-2">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" || path.startsWith("/sites") : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-2.5 py-1.5 rounded-md whitespace-nowrap transition-colors ${
              active ? "bg-river-soft text-river-deep font-medium" : "text-ink-2 hover:text-ink hover:bg-black/[0.03]"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
