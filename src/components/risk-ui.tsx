import { LEVEL_LABEL, type Factor, type HazardAssessment, type HazardDay } from "@/lib/risk/engine";
import type { RiskLevel } from "@/lib/types";

export const LEVEL_HEX: Record<RiskLevel, string> = {
  low: "#3f8a5a",
  moderate: "#b8901c",
  high: "#d06a1f",
  "very-high": "#b8322a",
};

export function LevelChip({ level, children }: { level: RiskLevel; children?: React.ReactNode }) {
  return <span className={`chip lvl-${level}`}>{children ?? LEVEL_LABEL[level]}</span>;
}

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short" });
const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Compact 10-day strip of daily probability bars. */
export function Sparkline({ timeline, today }: { timeline: HazardDay[]; today: string }) {
  const days = timeline.slice(-10);
  return (
    <div className="flex items-end gap-[3px] h-8" aria-hidden>
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${Math.round(d.p * 100)}%`}
          className={`w-2 rounded-sm ${d.forecast ? "hatch" : ""} ${d.date === today ? "ring-1 ring-ink/50 ring-offset-1" : ""}`}
          style={{ height: `${Math.max(8, d.p * 100)}%`, background: LEVEL_HEX[d.level], opacity: d.date < today ? 0.45 : 1 }}
        />
      ))}
    </div>
  );
}

/** Larger timeline with day labels, used on the stream record. */
export function Timeline({ timeline, today }: { timeline: HazardDay[]; today: string }) {
  return (
    <div>
      <div className="relative flex items-end gap-1.5 h-28 border-b border-line">
        {[0.2, 0.4, 0.65].map((t) => (
          <div key={t} className="absolute left-0 right-0 border-t border-dashed border-line" style={{ bottom: `${t * 100}%` }} />
        ))}
        {timeline.map((d) => (
          <div key={d.date} className="relative flex-1 flex flex-col justify-end h-full group">
            <div
              className={`rounded-t-[3px] ${d.forecast ? "hatch" : ""}`}
              style={{ height: `${Math.max(3, d.p * 100)}%`, background: LEVEL_HEX[d.level], opacity: d.date < today ? 0.5 : 1 }}
            />
            <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-ink-2 opacity-0 group-hover:opacity-100">
              {Math.round(d.p * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 mt-1">
        {timeline.map((d) => (
          <div key={d.date} className={`flex-1 text-center text-[10px] leading-tight ${d.date === today ? "text-ink font-semibold" : "text-ink-3"}`}>
            {d.date === today ? "Today" : fmtDay(d.date)}
            <br />
            <span>{fmtDate(d.date)}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-ink-3/50 inline-block" /> observed</span>
        <span className="flex items-center gap-1.5"><i className="w-3 h-2 rounded-sm bg-ink-3 hatch inline-block" /> forecast</span>
        <span>dashed lines: moderate · high · very high</span>
      </div>
    </div>
  );
}

const SOURCE_LABEL: Record<Factor["source"], string> = {
  forecast: "Forecast",
  weather: "Weather",
  citizen: "Citizen",
  lab: "Lab",
  site: "Site",
  clinical: "Clinic",
};

const SOURCE_CLASS: Record<Factor["source"], string> = {
  forecast: "bg-sky-100 text-sky-800",
  weather: "bg-sky-50 text-sky-700",
  citizen: "bg-emerald-100 text-emerald-800",
  lab: "bg-violet-100 text-violet-800",
  site: "bg-stone-200 text-stone-700",
  clinical: "bg-rose-100 text-rose-800",
};

export function SourceTag({ source }: { source: Factor["source"] }) {
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${SOURCE_CLASS[source]}`}>{SOURCE_LABEL[source]}</span>;
}

/** Why the score is what it is: each factor's push on the log-odds. */
export function FactorBars({ factors }: { factors: Factor[] }) {
  const max = Math.max(2.6, ...factors.map((f) => f.weight));
  return (
    <ul className="space-y-2.5">
      {factors.map((f) => (
        <li key={f.id}>
          <div className="flex items-center gap-2 text-sm">
            <SourceTag source={f.source} />
            <span className="font-medium">{f.label}</span>
            <span className="ml-auto tabular-nums text-xs text-ink-3">+{f.contribution.toFixed(2)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-line/70 overflow-hidden">
            <div className="h-full rounded-full bg-river" style={{ width: `${(f.contribution / max) * 100}%` }} />
          </div>
          <p className="text-xs text-ink-3 mt-1">{f.detail}</p>
        </li>
      ))}
    </ul>
  );
}

export function HazardIcon({ hazard, className = "w-5 h-5" }: { hazard: HazardAssessment["hazard"]; className?: string }) {
  if (hazard === "waterborne")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z" />
        <circle cx="10" cy="14" r="1.2" fill="currentColor" />
        <circle cx="13.5" cy="16.5" r="1" fill="currentColor" />
        <circle cx="14" cy="12.5" r="0.8" fill="currentColor" />
      </svg>
    );
  if (hazard === "cyanobacteria")
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
        <path d="M3 15c2-2 4 2 6 0s4-2 6 0 4 2 6 0" />
        <path d="M3 19c2-2 4 2 6 0s4-2 6 0 4 2 6 0" />
        <circle cx="8" cy="8" r="2" />
        <circle cx="14" cy="6" r="1.5" />
        <circle cx="17" cy="10" r="1.2" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <path d="M12 8v9M9 11l-5-3M15 11l5-3M9 15l-5 2M15 15l5 2M10 19l-2 3M14 19l2 3" />
      <ellipse cx="12" cy="13" rx="2.5" ry="5" />
      <circle cx="12" cy="6" r="2" />
    </svg>
  );
}
