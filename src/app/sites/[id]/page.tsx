import Link from "next/link";
import { notFound } from "next/navigation";
import { FactorBars, HazardIcon, LevelChip, Timeline } from "@/components/risk-ui";
import { riskAssessmentResource } from "@/lib/fhir/resources";
import { LEVEL_LABEL } from "@/lib/risk/engine";
import { siteBundleById } from "@/lib/risk/service";
import { observationsFor } from "@/lib/store";
import type { StreamObservation } from "@/lib/types";
import { parseScenario } from "@/lib/weather";

export const dynamic = "force-dynamic";

export default async function SitePage({ params, searchParams }: PageProps<"/sites/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const scenario = parseScenario(sp);
  const sb = await siteBundleById(id, scenario);
  if (!sb) notFound();
  const { site, weather, risk } = sb;
  const obs = observationsFor(site.id);
  const checks = groupChecks(obs).slice(0, 8);
  const window = weather.days.slice(Math.max(0, weather.todayIndex - 7));
  const maxRain = Math.max(10, ...window.map((d) => d.rainMm));
  const today = weather.days[weather.todayIndex].date;
  const scenarioOn = scenario.rainMm || scenario.heatC;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <Link href={`/${scenarioOn ? `?rain=${scenario.rainMm}&heat=${scenario.heatC}` : ""}`} className="text-sm text-ink-3 hover:text-ink">
        ← Situation room
      </Link>

      <header className="mt-3 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Stream health record · FHIR Location/{site.id}</p>
          <h1 className="font-display text-4xl mt-1">{site.name}</h1>
          <p className="text-ink-2 mt-1">
            {site.river} · {site.district}, {site.city}, {site.country} ·{" "}
            <span className="text-ink-3">{site.source === "oah-ig" ? "coordinates from the OneAquaHealth IG" : "demo reach"}</span>
          </p>
          <p className="text-sm text-ink-3 mt-1">
            Used for {site.uses}. ~{site.vulnerability.residentsWithin1km.toLocaleString("en")} residents within 1 km.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LevelChip level={risk.overall}>Overall {LEVEL_LABEL[risk.overall].toLowerCase()}</LevelChip>
          <Link href={`/check?site=${site.id}`} className="rounded-lg bg-river text-white text-sm px-4 py-2 hover:bg-river-deep">
            Add a stream check
          </Link>
        </div>
      </header>

      {scenarioOn ? (
        <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          What-if scenario active: +{scenario.rainMm} mm rain over the next 48 h, {scenario.heatC >= 0 ? "+" : ""}
          {scenario.heatC} °C. <Link href={`/sites/${site.id}`} className="underline">Back to the real forecast</Link>
        </div>
      ) : null}

      <section className="mt-6 space-y-5">
        {risk.hazards.map((h) => (
          <article key={h.hazard} className="card p-5 grid lg:grid-cols-[1.15fr_1fr] gap-8">
            <div>
              <div className="flex items-center gap-3">
                <span className={`lvl-${h.peak.level}`} style={{ color: "var(--lvl)" }}>
                  <HazardIcon hazard={h.hazard} className="w-6 h-6" />
                </span>
                <h2 className="font-display text-2xl">{h.label}</h2>
                <LevelChip level={h.peak.level} />
                <span className="ml-auto text-sm tabular-nums text-ink-2">
                  {Math.round(h.now.p * 100)}% today · peak {Math.round(h.peak.p * 100)}%
                </span>
              </div>
              <div className="mt-6">
                <Timeline timeline={h.timeline} today={today} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mt-5">
                <div className="rounded-lg bg-river-soft/60 p-3">
                  <p className="eyebrow !text-river-deep">For people nearby</p>
                  <p className="text-sm mt-1">{h.publicAdvice}</p>
                </div>
                <div className="rounded-lg bg-stone-100 p-3">
                  <p className="eyebrow">For clinicians</p>
                  <p className="text-sm mt-1">{h.clinicalAdvice}</p>
                </div>
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <p className="eyebrow">Why this score</p>
                <span className={`text-[11px] ${h.confidence === "low" ? "text-lvl-high" : "text-ink-3"}`}>
                  Confidence {h.confidence}: {h.confidenceReason}
                </span>
              </div>
              <div className="mt-3">
                <FactorBars factors={h.factors} />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid lg:grid-cols-[1fr_1.2fr] gap-5 mt-5">
        <div className="card p-5">
          <p className="eyebrow">Weather · {weather.source === "open-meteo" ? "Open-Meteo, live" : "offline climatology"}</p>
          <div className="flex items-end gap-1.5 h-24 mt-4">
            {window.map((d) => (
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
            {window.map((d) => (
              <div key={d.date} className={`flex-1 text-center text-[10px] ${d.date === today ? "font-semibold" : "text-ink-3"}`}>
                {Math.round(d.tMax)}°
              </div>
            ))}
          </div>
          <p className="text-[11px] text-ink-3 mt-2">Daily rain (mm) and max temperature. Spill threshold for this reach ≈ {site.vulnerability.overflowThresholdMm} mm/day.</p>
        </div>

        <div className="card p-5">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">Citizen & lab record</p>
            <Link href={`/fhir/Observation?subject=Location/${site.id}`} className="text-xs text-river hover:underline" target="_blank">
              FHIR Observation bundle ↗
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {checks.map((c) => (
              <li key={c.key} className="py-2.5 flex gap-3">
                <div className="w-20 shrink-0 text-xs text-ink-3">
                  {new Date(c.when).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  <br />
                  {c.who}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.items.map((o) => (
                    <span key={o.id} className="text-[11px] rounded-md bg-stone-100 px-1.5 py-0.5">
                      <span className="text-ink-3">{LABEL[o.code]}:</span> {valueText(o)}
                    </span>
                  ))}
                  {c.status === "preliminary" && (
                    <span className="text-[11px] rounded-md bg-amber-100 text-amber-900 px-1.5 py-0.5">awaiting verification</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card p-5 mt-5">
        <details>
          <summary className="cursor-pointer flex items-center justify-between">
            <span>
              <span className="eyebrow">Interoperability</span>
              <span className="block text-sm text-ink-2 mt-0.5">
                The same record as FHIR R4: a RiskAssessment about an OAH cohort Group, with every factor as a structured extension.
              </span>
            </span>
            <span className="text-xs text-river">show JSON</span>
          </summary>
          <div className="flex flex-wrap gap-2 mt-4 text-xs">
            {[
              [`/fhir/Location/${site.id}`, "Location (OAH)"],
              [`/fhir/Group/cohort-${site.id}`, "Group (OAH cohort)"],
              [`/fhir/RiskAssessment?location=Location/${site.id}`, "RiskAssessments"],
              [`/fhir/Observation/health-${site.id}-gastrointestinal`, "Health measure (OAH)"],
            ].map(([href, label]) => (
              <a key={href} href={href} target="_blank" className="rounded-md border border-line px-2 py-1 hover:border-ink-3">
                {label} ↗
              </a>
            ))}
          </div>
          <pre className="json mt-4 max-h-[420px] overflow-auto rounded-lg bg-ink text-emerald-100 p-4">
            {JSON.stringify(riskAssessmentResource(site, risk, risk.hazards[0]), null, 2)}
          </pre>
        </details>
      </section>
    </div>
  );
}

const LABEL: Record<StreamObservation["code"], string> = {
  foam: "Foam/smell",
  diptera: "Larvae",
  waterTemperature: "Water temp",
  hydrology: "Flow",
  "filamentous-algae": "Algae cover",
  coliforms: "E. coli",
};

function valueText(o: StreamObservation) {
  return o.value.kind === "coded" ? o.value.display : `${o.value.value} ${o.value.unit}`;
}

function groupChecks(obs: StreamObservation[]) {
  const map = new Map<string, { key: string; when: string; who: string; status: string; items: StreamObservation[] }>();
  for (const o of obs) {
    const key = `${o.effective}|${o.performer.id}`;
    if (!map.has(key)) map.set(key, { key, when: o.effective, who: o.performer.kind === "lab" ? "Lab" : o.performer.id, status: o.status, items: [] });
    map.get(key)!.items.push(o);
  }
  return [...map.values()].sort((a, b) => b.when.localeCompare(a.when));
}
