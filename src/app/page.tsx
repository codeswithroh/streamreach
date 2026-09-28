import Link from "next/link";
import { Suspense } from "react";
import { MapLoader } from "@/components/MapLoader";
import { HazardIcon, LevelChip, Sparkline } from "@/components/risk-ui";
import { ScenarioControls } from "@/components/ScenarioControls";
import { LEVEL_LABEL, LEVELS } from "@/lib/risk/engine";
import { allSiteBundles } from "@/lib/risk/service";
import { recentStats } from "@/lib/store";
import { parseScenario } from "@/lib/weather";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const scenario = parseScenario(sp);
  const bundles = await allSiteBundles(scenario);
  const qs = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();
  const suffix = qs ? `?${qs}` : "";

  const alerts = bundles
    .flatMap((b) => b.risk.hazards.map((h) => ({ b, h })))
    .filter(({ h }) => LEVELS.indexOf(h.peak.level) >= 1)
    .sort((x, y) => y.h.peak.p - x.h.peak.p);
  const warnings = alerts.filter(({ h }) => LEVELS.indexOf(h.peak.level) >= 2);
  const { checks, clinic } = await recentStats();
  const liveWeather = bundles.every((b) => b.weather.source === "open-meteo");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <section className="flex flex-col lg:flex-row lg:items-end gap-6 justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow">One Health early warning · urban streams</p>
          <h1 className="font-display text-4xl sm:text-5xl leading-[1.05] mt-2">
            From streams <em className="text-river">to systems.</em>
          </h1>
          <p className="text-ink-2 mt-3 leading-relaxed">
            Citizen stream checks and the 7-day weather forecast become explainable risk assessments for waterborne pathogens,
            toxic algae and mosquito-borne disease. They reach public health teams here, and clinicians inside their EHR.
          </p>
        </div>
        <dl className="grid grid-cols-4 gap-2 text-center shrink-0">
          <Kpi value={bundles.length} label="reaches" />
          <Kpi value={warnings.length} label="warnings, 72 h" tone={warnings.length ? "warn" : undefined} />
          <Kpi value={checks} label="citizen checks, 14 d" />
          <Kpi value={clinic} label="clinic signals, 14 d" />
        </dl>
      </section>

      <section className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] gap-5 mt-8">
        <div className="card p-1.5 h-[440px]">
          <MapLoader
            sites={bundles.map((b) => {
              const top = [...b.risk.hazards].sort((a, c) => c.peak.p - a.peak.p)[0];
              return {
                id: b.site.id,
                name: b.site.name,
                city: b.site.city,
                lat: b.site.lat,
                lon: b.site.lon,
                level: b.risk.overall,
                headline: `${LEVEL_LABEL[top.peak.level]} ${top.label.toLowerCase()}`,
              };
            })}
          />
        </div>
        <div className="flex flex-col gap-5 min-h-0">
          <Suspense>
            <ScenarioControls />
          </Suspense>
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <div className="flex items-baseline justify-between">
              <p className="eyebrow">Alerts · next 72 h</p>
              <span className="text-[11px] text-ink-3">{liveWeather ? "live Open-Meteo forecast" : "offline climatology"}</span>
            </div>
            <ul className="mt-3 space-y-2 overflow-y-auto max-h-[250px] pr-1">
              {alerts.length === 0 && <li className="text-sm text-ink-3">No elevated risk anywhere. Streams look calm.</li>}
              {alerts.map(({ b, h }) => (
                <li key={`${b.site.id}-${h.hazard}`}>
                  <Link href={`/sites/${b.site.id}${suffix}`} className="flex gap-3 p-2 -mx-2 rounded-lg hover:bg-black/[0.03]">
                    <span className={`lvl-${h.peak.level} mt-0.5`} style={{ color: "var(--lvl)" }}>
                      <HazardIcon hazard={h.hazard} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{b.site.name}</span>
                        <LevelChip level={h.peak.level} />
                      </span>
                      <span className="block text-xs text-ink-3 truncate">
                        {h.label} · {h.factors[0]?.label.toLowerCase()} · peak{" "}
                        {new Date(`${h.peak.date}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl">Every reach, every hazard</h2>
          <span className="text-xs text-ink-3">bars: last 3 days, today, 6-day forecast (hatched)</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {bundles.map((b) => (
            <Link key={b.site.id} href={`/sites/${b.site.id}${suffix}`} className="card p-4 hover:border-ink-3 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{b.site.name}</p>
                  <p className="text-xs text-ink-3">
                    {b.site.city}, {b.site.country} · {b.site.source === "oah-ig" ? "OAH IG site" : "demo reach"}
                  </p>
                </div>
                <LevelChip level={b.risk.overall} />
              </div>
              <div className="mt-4 space-y-2.5">
                {b.risk.hazards.map((h) => (
                  <div key={h.hazard} className="flex items-center gap-3">
                    <span className="text-ink-3"><HazardIcon hazard={h.hazard} className="w-4 h-4" /></span>
                    <span className="text-xs w-24 text-ink-2">{h.short}</span>
                    <Sparkline timeline={h.timeline} today={h.now.date} />
                    <span className="ml-auto text-xs tabular-nums text-ink-2">{Math.round(h.peak.p * 100)}%</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-ink-3 mt-3">
                Last citizen check {b.risk.latestCheck ? new Date(b.risk.latestCheck).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "never"}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Kpi({ value, label, tone }: { value: number; label: string; tone?: "warn" }) {
  return (
    <div className={`card px-3 py-2.5 min-w-[84px] ${tone === "warn" ? "border-lvl-high/40 bg-orange-50" : ""}`}>
      <dd className={`font-display text-3xl tabular-nums ${tone === "warn" ? "text-lvl-high" : ""}`}>{value}</dd>
      <dt className="text-[11px] text-ink-3 leading-tight">{label}</dt>
    </div>
  );
}
