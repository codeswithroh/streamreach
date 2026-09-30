"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentPanel } from "../AgentPanel";

const EVENT = "streamreach:open-agent";

/** Opens the AI duty-officer drawer from anywhere on the page. */
export function OpenAgentButton({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button onClick={() => window.dispatchEvent(new Event(EVENT))} className={className}>
      {children ?? (
        <>
          <Sparkles size={15} /> Draft with AI
        </>
      )}
    </button>
  );
}

export function AgentDrawer(props: { siteId: string; mode: "live" | "mock" | "off" | "forbidden"; officerName: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(EVENT, show);
    if (window.location.hash === "#agent") queueMicrotask(show);
    return () => window.removeEventListener(EVENT, show);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  // kept mounted so a running draft survives closing the drawer
  return (
    <div className={open ? "" : "hidden"} id="agent">
      <div className="fixed inset-0 z-[1250] bg-ink/30 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label="AI duty officer" className="fixed z-[1300] inset-y-0 right-0 w-full max-w-[900px] bg-paper shadow-2xl overflow-y-auto scroll-thin">
        <button onClick={() => setOpen(false)} aria-label="Close" className="absolute right-4 top-4 grid place-items-center w-9 h-9 rounded-lg bg-white border border-line hover:border-ink-3 z-10">
          <X size={18} />
        </button>
        <AgentPanel {...props} className="p-6 pr-16" />
      </div>
    </div>
  );
}
