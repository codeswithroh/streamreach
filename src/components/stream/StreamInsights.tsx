"use client";

import { useState } from "react";
import { dayMonth } from "@/lib/format";
import { LEVEL_LABEL, type HazardAssessment } from "@/lib/risk/engine";
import type { RiskLevel } from "@/lib/types";
import { HazardIcon, LEVEL_HEX, LevelChip, SourceTag, Timeline } from "../risk-ui";
import { RadialDrivers } from "./RadialDrivers";

const COLOR: Record<HazardAssessment["hazard"], string> = { waterborne: "#2f6fd6", cyanobacteria: "#1fa971", vector: "#8b5cf6" };
const SHORT: Record<HazardAssessment["hazard"], string> = { waterborne: "Pathogens", cyanobacteria: "Algal bloom", vector: "Mosquitoes" };
const RANK: RiskLevel[] = ["low", "moderate", "high", "very-high"];

type Tab = "timeline" | "weather" | "advice" | "fhir";

export function StreamInsights({
  hazards,
  today,
  weather,
  spillMm,
  weatherSource,
  fhir,
}: {
  hazards: HazardAssessment[];
  today: string;
  weather: { date: string; rainMm: number; tMax: number; forecast: boolean }[];
  spillMm: number;
  weatherSource: string;
  fhir: { siteId: string; json: string[] };
}) {
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<Tab>("timeline");
  const h = hazards[sel];

  // overall risk per day = worst hazard that day
  const days = hazards[0].timeline.map((d, i) => {
    const worst = hazards.map((x) => x.timeline[i]).sort((a, b) => b.p - a.p)[0];
    return { date: d.date, level: worst.level, forecast: d.forecast };
  });
  const todayIdx = Math.max(0, days.findIndex((d) => d.date === today));
  const overallNow = hazards.map((x) => x.now.level).sort((a, b) => RANK.indexOf(b) - RANK.indexOf(a))[0];
  const peak = [...hazards].sort((a, b) => b.peak.p - a.peak.p)[0].peak;

  const maxRain = Math.max(10, ...weather.map((d) => d.rainMm));

  return (
    <div className="space-y-4 min-w-0">
      {/* risk path */}
      <section className="card p-5" aria-label="Risk path">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Risk path</h2>
          <span className="text-xs text-ink-3">{days.length} days · worst hazard per day</span>
        </div>
        <div className="flex justify-between mt-3 text-xs">
          <span>
            <span className="block text-ink-3">Today</span>
            <span className="font-semibold">{LEVEL_LABEL[overallNow]}</span>
          </span>
          <span className="text-right">
            <span className="block text-ink-3">Peak · {peak.date === today ? "today" : dayMonth(peak.date)}</span>
            <span className="font-semibold">{LEVEL_LABEL[peak.level]}</span>
          </span>
        </div>
        <div className="flex gap-1 mt-2" role="img" aria-label="Daily overall risk level">
          {days.map((d, i) => (
            <span
              key={d.date}
              title={`${dayMonth(d.date)}: ${LEVEL_LABEL[d.level]}`}
              className={`h-2 flex-1 rounded-full ${d.forecast ? "hatch" : ""} ${i === todayIdx ? "ring-2 ring-offset-1 ring-ink/60" : ""}`}
              style={{ background: LEVEL_HEX[d.level], opacity: i < todayIdx ? 0.35 : 1 }}
            />
          ))}
        </div>
      </section>

      {/* why this score */}
      <section className="card p-5" aria-label="Why this score">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Why this score</h2>
          <div className="flex p-1 rounded-lg bg-river-soft text-xs" role="tablist" aria-label="Hazard">
            {hazards.map((x, i) => (
              <button
                key={x.hazard}
                role="tab"
                aria-selected={sel === i}
                onClick={() => setSel(i)}
                className={`px-3 py-1.5 rounded-md ${sel === i ? "bg-white shadow-sm font-semibold text-ink" : "text-ink-2"}`}
              >
                {SHORT[x.hazard]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-4">
          <span style={{ color: COLOR[h.hazard] }}>
            <HazardIcon hazard={h.hazard} className="w-6 h-6" />
          </span>
          <h3 className="text-lg font-semibold">{h.label}</h3>
          <LevelChip level={h.peak.level} />
          <span className="ml-auto text-sm tabular-nums text-ink-2">
            <b className="text-ink">{Math.round(h.now.p * 100)}%</b> today · peak {Math.round(h.peak.p * 100)}%
          </span>
        </div>
        <div className="mt-2">
          <RadialDrivers factors={h.factors} color={COLOR[h.hazard]} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[11px] text-ink-3">
          <span className="flex items-center gap-1.5">
            <i className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR[h.hazard] }} /> Contribution today
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-3 h-3 rounded-sm inline-block" style={{ background: COLOR[h.hazard], opacity: 0.2 }} /> Full weight
          </span>
          <span className={h.confidence === "low" ? "text-lvl-high" : ""}>Confidence {h.confidence}</span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5 justify-center">
          {h.factors.map((f) => (
            <li key={f.id} title={f.detail} className="flex items-center gap-1.5 text-[11px] rounded-full border border-line pl-1 pr-2 py-0.5">
              <SourceTag source={f.source} />
              {f.label}
            </li>
          ))}
        </ul>
      </section>

      {/* forecast & advice */}
      <section className="card p-5" aria-label="Forecast and advice">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Forecast &amp; advice</h2>
          <span className="text-xs text-ink-3">{h.label}</span>
        </div>
        <div className="flex gap-4 border-b border-line mt-3 text-sm overflow-x-auto scroll-thin" role="tablist" aria-label="Details">
          {(
            [
              ["timeline", "Timeline", h.timeline.length],
              ["weather", "Weather", weather.length],
              ["advice", "Advice", 2],
              ["fhir", "FHIR", 4],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px pb-2 border-b-2 whitespace-nowrap flex items-center gap-1.5 ${tab === id ? "border-accent text-ink font-medium" : "border-transparent text-ink-3"}`}
            >
              {label}
              <span className="text-[10px] rounded-full bg-river-soft px-1.5 text-ink-2">{count}</span>
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === "timeline" && <Timeline timeline={h.timeline} today={today} />}

          {tab === "weather" && (
            <div>
              <div className="flex items-end gap-1.5 h-28">
                {weather.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
                    <span className="text-[10px] text-ink-3 tabular-nums">{d.rainMm >= 1 ? Math.round(d.rainMm) : ""}</span>
                    <div
                      className={`w-full rounded-t-[3px] ${d.forecast ? "hatch" : ""}`}
                      style={{ height: `${(d.rainMm / maxRain) * 80}%`, background: "#3d8fc4", opacity: d.date < today ? 0.5 : 1 }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5 mt-1 border-t border-line pt-1">
                {weather.map((d) => (
                  <div key={d.date} className={`flex-1 text-center text-[10px] ${d.date === today ? "font-semibold" : "text-ink-3"}`}>
                    {Math.round(d.tMax)}°
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-3 mt-2">
                Rain (mm) and max °C · {weatherSource === "open-meteo" ? "Open-Meteo, live" : "offline climatology"} · spill threshold ≈ {spillMm} mm/day
              </p>
            </div>
          )}

          {tab === "advice" && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold text-river">For people nearby</p>
                <p className="text-sm mt-1.5">{h.publicAdvice}</p>
              </div>
              <div className="rounded-xl border border-line p-4">
                <p className="text-xs font-semibold text-accent">For clinicians</p>
                <p className="text-sm mt-1.5">{h.clinicalAdvice}</p>
              </div>
            </div>
          )}

          {tab === "fhir" && (
            <div>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  [`/fhir/Location/${fhir.siteId}`, "Location (OAH)"],
                  [`/fhir/Group/cohort-${fhir.siteId}`, "Group (OAH cohort)"],
                  [`/fhir/RiskAssessment?location=Location/${fhir.siteId}`, "RiskAssessments"],
                  [`/fhir/Observation/health-${fhir.siteId}-gastrointestinal`, "Health measure (OAH)"],
                ].map(([href, label]) => (
                  <a key={href} href={href} target="_blank" className="fhir-link rounded-md border border-line px-2 py-1 hover:border-ink-3">
                    {label} ↗
                  </a>
                ))}
              </div>
              <pre tabIndex={0} className="json mt-3 max-h-[360px] overflow-auto rounded-lg bg-ink text-emerald-100 p-4">
                {fhir.json[sel]}
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
