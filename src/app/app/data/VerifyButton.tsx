"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/** Human-in-the-loop: a coordinator verifies a citizen check (or sends it back). */
export function VerifyButton({ ids, status, canEdit = true }: { ids: string[]; status: "final" | "preliminary"; canEdit?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [, start] = useTransition();

  async function set(next: "final" | "preliminary") {
    setBusy(true);
    await fetch("/api/observations/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status: next }),
    });
    setBusy(false);
    start(() => router.refresh());
  }

  if (!canEdit)
    return status === "final" ? (
      <span className="text-[11px] rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5">verified</span>
    ) : (
      <span className="text-[11px] rounded bg-amber-100 text-amber-900 px-1.5 py-0.5">awaiting</span>
    );
  if (status === "final")
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-[11px] rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5">verified</span>
        <button disabled={busy} onClick={() => set("preliminary")} className="text-[11px] text-ink-3 hover:text-ink disabled:opacity-40">
          undo
        </button>
      </span>
    );
  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-[11px] rounded bg-amber-100 text-amber-900 px-1.5 py-0.5">awaiting</span>
      <button disabled={busy} onClick={() => set("final")} className="text-[11px] rounded-md border border-river text-river px-2 py-0.5 hover:bg-river hover:text-white disabled:opacity-40">
        {busy ? "…" : "Verify"}
      </button>
    </span>
  );
}
