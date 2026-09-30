import { Bug, Droplets, FlaskConical, MapPin, Plus, Sprout, Thermometer, Waves } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LEVEL_HEX, LevelChip } from "@/components/risk-ui";
import { riskAssessmentResource } from "@/lib/fhir/resources";
import { LEVEL_LABEL } from "@/lib/risk/engine";
import { siteBundleById } from "@/lib/risk/service";
import { PageHeader } from "@/components/shell/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { listPlans, observationsFor, signalsFor } from "@/lib/store";
import { agentMode } from "@/lib/agent/run";
import type { ResponsePlan } from "@/lib/agent/plan";
import type { OahIndicatorCode, StreamObservation } from "@/lib/types";
import { parseScenario } from "@/lib/weather";
import { SITES } from "@/lib/sites";
import { dayMonth, dayMonthTime } from "@/lib/format";
import { StreamInsights } from "@/components/stream/StreamInsights";
import { ActivityFeed, type Activity } from "@/components/stream/ActivityFeed";
import { AgentDrawer, OpenAgentButton } from "@/components/stream/AgentDrawer";
import { StreamSwitcher } from "@/components/stream/StreamSwitcher";

export const dynamic = "force-dynamic";

const SHORT = { waterborne: "Pathogens", cyanobacteria: "Algal bloom", vector: "Mosquitoes" } as const;
const SYNDROME = { gastrointestinal: "gastrointestinal", "skin-rash": "skin-rash", febrile: "fever" } as const;
const STATUS = {
  draft: { label: "Draft", dot: "bg-amber-500" },
  approved: { label: "Published", dot: "bg-emerald-500" },
  discarded: { label: "Discarded", dot: "bg-stone-400" },
} as const;

export default async function SitePage({ params, searchParams }: PageProps<"/app/streams/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const scenario = parseScenario(sp);
  const sb = await siteBundleById(id, scenario);
  if (!sb) notFound();
  const { site, weather, risk } = sb;
  const [obs, signals, allPlans, user] = await Promise.all([observationsFor(site.id), signalsFor(site.id), listPlans(site.id), getCurrentUser()]);
  const officer = user!.role === "officer";
  const plans = allPlans.filter((p) => officer || p.status === "approved").sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt));
  const advisory = allPlans.filter((p) => p.status === "approved").sort((a, b) => b.decidedAt!.localeCompare(a.decidedAt!))[0];
  const today = weather.days[weather.todayIndex].date;
  const scenarioOn = scenario.rainMm || scenario.heatC;
  const uses = site.uses.split(/,\s*|\s+and\s+/).map((u) => u.trim()).filter(Boolean);

  const activity: Activity[] = [
    ...groupChecks(obs).map<Activity>((c) => ({
      key: c.key,
      kind: c.lab ? "lab" : "check",
      when: c.when,
      title: c.lab ? "Lab result received" : `${c.who} added a stream check`,
      items: c.items.map((o) => `${LABEL[o.code]}: ${valueText(o)}`),
      pending: c.status === "preliminary",
    })),
    ...signals.map<Activity>((s) => ({
      key: s.id,
      kind: "clinic",
      when: s.date,
      title: `A GP shared an anonymous ${SYNDROME[s.syndrome]} case`,
    })),
    ...allPlans
      .filter((p) => p.status === "approved")
      .map<Activity>((p) => ({ key: p.id, kind: "plan", when: p.decidedAt!, title: `${p.decidedBy} published an advisory` })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 24);

  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6 py-6">
      <PageHeader
        eyebrow="Stream record"
        title={site.name}
        actions={<StreamSwitcher current={site.id} sites={SITES.map((s) => ({ id: s.id, name: s.name, city: s.city }))} />}
      />

      {scenarioOn ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          What-if scenario active: +{scenario.rainMm} mm rain over the next 48 h, {scenario.heatC >= 0 ? "+" : ""}
          {scenario.heatC} °C. <Link href={`/app/streams/${site.id}`} className="underline">Back to the real forecast</Link>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[290px_minmax(0,1fr)] xl:grid-cols-[290px_minmax(0,1fr)_340px] items-start">
        {/* left: identity + readings */}
        <div className="space-y-4 min-w-0">
          <section className="card p-5" aria-label="Stream">
            <div className="flex items-center gap-3">
              <span className="grid place-items-center w-14 h-14 rounded-2xl text-white shrink-0" style={{ background: LEVEL_HEX[risk.overall] }}>
                <Waves size={24} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold leading-tight">{site.river}</p>
                <p className="text-xs text-ink-3 mt-0.5 flex items-center gap-1">
                  <MapPin size={12} /> {site.district}, {site.city}
                </p>
              </div>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-x-3 gap-y-3.5 text-sm">
              <div className="col-span-2">
                <dt className="text-[11px] text-ink-3">Overall risk</dt>
                <dd className="mt-1">
                  <LevelChip level={risk.overall}>{LEVEL_LABEL[risk.overall]}</LevelChip>
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-3">Residents ≤ 1 km</dt>
                <dd className="font-semibold mt-0.5">{site.vulnerability.residentsWithin1km.toLocaleString("en")}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-ink-3">Spill threshold</dt>
                <dd className="font-semibold mt-0.5">{site.vulnerability.overflowThresholdMm} mm/day</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] text-ink-3">Used for</dt>
                <dd className="flex flex-wrap gap-1.5 mt-1">
                  {uses.map((u) => (
                    <span key={u} className="text-[11px] rounded-md border border-line px-2 py-0.5">
                      {u}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] text-ink-3">Location data</dt>
                <dd className="mt-1">
                  <span className="text-[11px] rounded-md bg-river-soft text-river px-2 py-0.5">{site.source === "oah-ig" ? "OneAquaHealth IG" : "Demo reach"}</span>
                </dd>
              </div>
            </dl>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Link href={`/app/check?site=${site.id}`} className="btn-accent flex items-center justify-center gap-1 text-sm py-2" aria-label="Add a stream check">
                <Plus size={15} /> Check
              </Link>
              <Link href={`/app?reach=${site.id}${scenarioOn ? `&rain=${scenario.rainMm}&heat=${scenario.heatC}` : ""}`} className="rounded-[10px] border border-line text-sm py-2 text-center hover:border-ink-3">
                View on map
              </Link>
            </div>
          </section>

          <section className="card p-5" aria-label="Risk today">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Risk today</h2>
              <span className="text-xs text-ink-3">{dayMonth(today)}</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5 mt-4" aria-hidden>
              {risk.hazards.map((h) => (
                <span key={h.hazard} style={{ flex: Math.max(0.05, h.now.p), background: LEVEL_HEX[h.now.level] }} />
              ))}
            </div>
            <ul className="mt-4 space-y-2.5">
              {risk.hazards.map((h) => (
                <li key={h.hazard} className="flex items-center gap-2 text-sm">
                  <i className="w-2.5 h-2.5 rounded-sm" style={{ background: LEVEL_HEX[h.now.level] }} />
                  {SHORT[h.hazard]}
                  <span className="ml-auto tabular-nums font-semibold">{Math.round(h.now.p * 100)}%</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5" aria-label="Latest readings">
            <h2 className="font-semibold">Latest readings</h2>
            <ul className="grid grid-cols-2 gap-2 mt-3">
              {READINGS.map(({ code, icon: Icon }) => {
                const o = obs.filter((x) => x.code === code).sort((a, b) => b.effective.localeCompare(a.effective))[0];
                return (
                  <li key={code} className="rounded-xl border border-line p-2.5">
                    <Icon size={16} className="text-river" aria-hidden />
                    <p className="text-[11px] text-ink-3 mt-1.5">{LABEL[code]}</p>
                    <p className="text-sm font-semibold leading-tight truncate" title={o ? valueText(o) : undefined}>
                      {o ? valueText(o) : "—"}
                    </p>
                    {o && <p className="text-[10px] text-ink-3 mt-0.5">{dayMonth(o.effective)}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* centre: visual analysis */}
        <StreamInsights
          hazards={risk.hazards}
          today={today}
          weather={weather.days.slice(Math.max(0, weather.todayIndex - 7)).map((d) => ({ date: d.date, rainMm: d.rainMm, tMax: d.tMax, forecast: d.forecast }))}
          spillMm={site.vulnerability.overflowThresholdMm}
          weatherSource={weather.source}
          fhir={{ siteId: site.id, json: risk.hazards.map((h) => JSON.stringify(riskAssessmentResource(site, risk, h), null, 2)) }}
        />

        {/* right: response + activity */}
        <div className="min-w-0 lg:col-span-2 xl:col-span-1 grid gap-4 lg:grid-cols-2 xl:grid-cols-1 content-start">
          <section className="card p-4" aria-label="Response plans">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Response plans</h2>
              <OpenAgentButton className="inline-flex items-center gap-1.5 rounded-lg border border-river text-river text-xs font-medium px-2.5 py-1.5 hover:bg-river hover:text-white" />
            </div>
            {advisory && (
              <div aria-label="Current advisory" className="mt-3 rounded-xl bg-river text-white p-3.5">
                <p className="text-[11px] text-white/70">
                  Current advisory · {advisory.decidedBy} · {dayMonthTime(advisory.decidedAt!)}
                </p>
                <p className="text-sm font-medium mt-1 leading-snug">{(advisory.plan as ResponsePlan).headline}</p>
                <a href={`/fhir/Communication/${advisory.id}`} target="_blank" className="text-[11px] text-white/80 underline mt-1.5 inline-block">
                  FHIR Communication ↗
                </a>
              </div>
            )}
            <ul className="mt-3 space-y-2">
              {plans.slice(0, 3).map((p) => {
                const pl = p.plan as ResponsePlan;
                const st = STATUS[p.status];
                return (
                  <li key={p.id} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className={`chip ${pl.priority === "urgent" ? "lvl-very-high" : pl.priority === "elevated" ? "lvl-high" : "lvl-low"}`}>{pl.priority}</span>
                      <span className="flex items-center gap-1.5 text-ink-3">
                        {st.label} <i className={`w-2 h-2 rounded-full ${st.dot}`} />
                      </span>
                    </div>
                    <p className="text-[13px] font-medium mt-2 line-clamp-2">{pl.headline}</p>
                    <p className="text-[11px] text-ink-3 mt-1">{dayMonthTime(p.decidedAt ?? p.createdAt)}</p>
                  </li>
                );
              })}
              {plans.length === 0 && (
                <li className="rounded-xl border border-dashed border-line p-4 text-center text-xs text-ink-3">No plans yet for this stream.</li>
              )}
            </ul>
          </section>

          <ActivityFeed items={activity} />
        </div>
      </div>

      <AgentDrawer siteId={site.id} mode={officer ? agentMode() : "forbidden"} officerName={user!.name} />
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

const READINGS: { code: OahIndicatorCode; icon: typeof Droplets }[] = [
  { code: "hydrology", icon: Waves },
  { code: "waterTemperature", icon: Thermometer },
  { code: "foam", icon: Droplets },
  { code: "filamentous-algae", icon: Sprout },
  { code: "diptera", icon: Bug },
  { code: "coliforms", icon: FlaskConical },
];

function valueText(o: StreamObservation) {
  return o.value.kind === "coded" ? o.value.display : `${o.value.value} ${o.value.unit}`;
}

function groupChecks(obs: StreamObservation[]) {
  const map = new Map<string, { key: string; when: string; who: string; lab: boolean; status: string; items: StreamObservation[] }>();
  for (const o of obs) {
    const key = `${o.effective}|${o.performer.id}`;
    if (!map.has(key)) map.set(key, { key, when: o.effective, who: o.performer.kind === "lab" ? "Lab" : o.performer.id, lab: o.performer.kind === "lab", status: o.status, items: [] });
    map.get(key)!.items.push(o);
  }
  return [...map.values()];
}
