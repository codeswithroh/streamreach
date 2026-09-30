"use client";

import { ChevronLeft, ChevronRight, ClipboardCheck, FlaskConical, Megaphone, Stethoscope } from "lucide-react";
import { useState } from "react";
import { dayMonth, dayMonthTime } from "@/lib/format";

export interface Activity {
  key: string;
  kind: "check" | "lab" | "clinic" | "plan";
  when: string;
  title: string;
  items?: string[];
  pending?: boolean;
}

const ICON = { check: ClipboardCheck, lab: FlaskConical, clinic: Stethoscope, plan: Megaphone };
const TONE = {
  check: "bg-emerald-50 text-emerald-700",
  lab: "bg-violet-50 text-violet-700",
  clinic: "bg-rose-50 text-rose-700",
  plan: "bg-river-soft text-river",
};

export function ActivityFeed({ items, pageSize = 4 }: { items: Activity[]; pageSize?: number }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const shown = items.slice(page * pageSize, (page + 1) * pageSize);
  return (
    <section className="card p-4" aria-label="Latest activity">
      <h2 className="font-semibold">Latest activity</h2>
      <ul className="mt-3 space-y-2">
        {shown.map((a) => {
          const Icon = ICON[a.kind];
          return (
            <li key={a.key} className="rounded-xl border border-line p-3 flex gap-3">
              <span className={`grid place-items-center w-8 h-8 rounded-lg shrink-0 ${TONE[a.kind]}`}>
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-snug">{a.title}</p>
                {a.items && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {a.items.map((t) => (
                      <span key={t} className="text-[11px] rounded-md bg-stone-100 px-1.5 py-0.5">
                        {t}
                      </span>
                    ))}
                    {a.pending && <span className="text-[11px] rounded-md bg-amber-100 text-amber-900 px-1.5 py-0.5">awaiting verification</span>}
                  </div>
                )}
                <p className="text-[11px] text-ink-3 mt-1.5 text-right tabular-nums">{a.when.length > 10 ? dayMonthTime(a.when) : dayMonth(a.when)}</p>
              </div>
            </li>
          );
        })}
        {items.length === 0 && <li className="text-sm text-ink-3">Nothing yet.</li>}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-ink-3">
          <span>
            {page + 1} of {pages}
          </span>
          <span className="flex gap-1">
            <button aria-label="Newer activity" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="p-1 rounded hover:bg-river-soft disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <button aria-label="Older activity" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} className="p-1 rounded hover:bg-river-soft disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </span>
        </div>
      )}
    </section>
  );
}
