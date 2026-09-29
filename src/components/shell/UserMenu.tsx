"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function UserMenu({ name, roleLabel, email, dark = false }: { name: string; roleLabel: string; email: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const initials = name
    .replace(/^Dr\.?\s+/, "")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  async function signOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`flex items-center gap-2 rounded-xl pl-1.5 pr-2.5 py-1.5 ${dark ? "bg-white shadow" : "bg-white border border-line"}`}
      >
        <span className="grid place-items-center w-8 h-8 rounded-full bg-river text-white text-xs font-semibold">{initials}</span>
        <span className="hidden sm:block text-left leading-tight">
          <span className="block text-sm font-medium">{name}</span>
          <span className="block text-[11px] text-ink-3">{roleLabel}</span>
        </span>
        <ChevronDown size={16} className="text-ink-3" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-2 w-60 rounded-xl bg-white shadow-lg border border-line p-2 z-[1200]">
          <p className="px-2 py-1.5 text-xs text-ink-3 break-all">{email}</p>
          <button role="menuitem" onClick={signOut} className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-accent-soft hover:text-accent">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
