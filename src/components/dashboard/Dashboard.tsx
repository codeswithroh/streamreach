"use client";

import { ArrowLeft, Bell, ChevronLeft, ChevronRight, Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Download, ExternalLink, Plus, Search, Settings, Snowflake, Sparkles, Sun, Waves } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { dayMonth, dayMonthTime, dayMonthYear } from "@/lib/format";
import type { HazardId, RiskLevel } from "@/lib/types";
import type { CurrentWeather, Scenario } from "@/lib/weather";
import { UserMenu } from "../shell/UserMenu";
import { RiskChart } from "./RiskChart";
import type { MapPoint } from "./SatelliteMap";

const SatelliteMap = dynamic(() => import("./SatelliteMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[#243227]" />,
});

export interface DashSite {
  id: string;
  name: string;
  river: string;
  city: string;
  district: string;
  country: string;
  lat: number;
  lon: number;
  source: "oah-ig" | "demo";
  uses: string;
  residents: number;
  overall: RiskLevel;
  hazards: {
    id: HazardId;
    label: string;
    timeline: { date: string; p: number; level: RiskLevel; forecast: boolean }[];
    peak: { date: string; p: number; level: RiskLevel };
    confidence: string;
    factors: { label: string; source: string; detail: string }[];
  }[];
  weather: { source: string; days: { date: string; rain: number; tMax: number; forecast: boolean }[]; current?: CurrentWeather };
  checks: {
    pending: { key: string; when: string; who: string; items: string[] }[];
    verified: { key: string; when: string; who: string; items: string[] }[];
    pendingCount: number;
  };
}

const LEVEL_LABEL: Record<RiskLevel, string> = { low: "Low", moderate: "Moderate", high: "High", "very-high": "Very high" };
const HEX: Record<RiskLevel, string> = { low: "#3f8a5a", moderate: "#d4a72c", high: "#e07a2c", "very-high": "#d23b33" };
const SERIES_COLOR: Record<HazardId, string> = { waterborne: "#2f6fd6", cyanobacteria: "#1fa971", vector: "#8b5cf6" };
const HAZARD_SHORT: Record<HazardId, string> = { waterborne: "Pathogens", cyanobacteria: "Algal bloom", vector: "Mosquitoes" };

const PRESETS = [
  { id: "today", label: "Today's forecast", rain: 0, heat: 0 },
  { id: "storm", label: "Storm tomorrow · 40 mm", rain: 40, heat: 0 },
  { id: "heat", label: "Heatwave · +6 °C", rain: 0, heat: 6 },
  { id: "both", label: "Storm after heat", rain: 30, heat: 4 },
];

type HazardSel = "all" | HazardId;

const fmtDay = dayMonth;
const fmtLong = dayMonthYear;

function levelAt(site: DashSite, hazard: HazardSel, dayIndex: number): { level: RiskLevel; p: number } {
  const hs = hazard === "all" ? site.hazards : site.hazards.filter((h) => h.id === hazard);
  let best = { level: "low" as RiskLevel, p: 0 };
  for (const h of hs) {
    const d = h.timeline[Math.min(dayIndex, h.timeline.length - 1)];
    if (d && d.p > best.p) best = { level: d.level, p: d.p };
  }
  return best;
}

export function Dashboard({
  sites,
  initialReach,
  scenario,
  warnings,
  user,
}: {
  sites: DashSite[];
  initialReach?: string;
  scenario: Scenario;
  warnings: number;
  user: { name: string; role: string; roleLabel: string; email: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [reach, setReach] = useState<string | undefined>(initialReach);
  const [hazard, setHazard] = useState<HazardSel>("all");
  const [barKind, setBarKind] = useState<"rain" | "temp">("rain");
  const [query, setQuery] = useState("");
  const [checkTab, setCheckTab] = useState<"new" | "verified">("new");

  const dates = sites[0].hazards[0].timeline.map((d) => d.date);
  const todayIndex = Math.max(0, sites[0].hazards[0].timeline.findIndex((d) => d.forecast) - 1);
  const [day, setDay] = useState(todayIndex);
  const [stripStart, setStripStart] = useState(Math.max(0, todayIndex - 4));
  const STRIP = 10;

  const site = sites.find((s) => s.id === reach);
  const focus = site ?? [...sites].sort((a, b) => levelAt(b, hazard, day).p - levelAt(a, hazard, day).p)[0];
  const scenarioId = PRESETS.find((p) => p.rain === scenario.rainMm && p.heat === scenario.heatC)?.id ?? "custom";

  const points: MapPoint[] = useMemo(
    () =>
      sites.map((s) => {
        const l = levelAt(s, hazard, day);
        return { id: s.id, name: s.name, city: s.city, lat: s.lat, lon: s.lon, color: HEX[l.level], label: `${LEVEL_LABEL[l.level]} (${Math.round(l.p * 100)}%)` };
      }),
    [sites, hazard, day],
  );

  const ranked = useMemo(
    () =>
      sites
        .filter((s) => `${s.name} ${s.city} ${s.river}`.toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => levelAt(b, hazard, day).p - levelAt(a, hazard, day).p),
    [sites, query, hazard, day],
  );

  function select(id?: string) {
    setReach(id);
    const q = new URLSearchParams(window.location.search);
    if (id) q.set("reach", id);
    else q.delete("reach");
    window.history.replaceState(null, "", `/app${q.size ? `?${q}` : ""}`);
  }

  function setScenario(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    const q = new URLSearchParams();
    if (reach) q.set("reach", reach);
    if (p.rain) q.set("rain", String(p.rain));
    if (p.heat) q.set("heat", String(p.heat));
    start(() => router.replace(`/app${q.size ? `?${q}` : ""}`, { scroll: false }));
  }

  function downloadCsv() {
    const header = ["date", ...focus.hazards.map((h) => `${h.id}_probability`), "rain_mm", "t_max_c"];
    const rows = dates.map((d, i) => [d, ...focus.hazards.map((h) => h.timeline[i]?.p.toFixed(3)), focus.weather.days[i]?.rain, focus.weather.days[i]?.tMax].join(","));
    const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${focus.id}-risk.csv`;
    a.click();
  }

  const chartHazards = hazard === "all" ? focus.hazards : focus.hazards.filter((h) => h.id === hazard);
  const checks = (site ?? focus).checks;

  return (
    <div className="relative lg:h-screen lg:overflow-hidden">
      {/* map */}
      <div className="relative h-[58vh] lg:absolute lg:inset-0 lg:h-auto">
        <SatelliteMap points={points} selectedId={reach} onSelect={select} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent z-[400]" />

        {/* top bar */}
        <div className="absolute z-[700] top-3 lg:top-5 left-4 lg:left-6 right-4 lg:right-6 flex items-start gap-3">
          <div className="text-white drop-shadow min-w-0">
            <h1 className="text-xl lg:text-2xl font-semibold">Monitoring</h1>
            <p className="text-xs lg:text-sm text-white/85 truncate">
              {sites.length} urban streams · {new Set(sites.map((s) => s.city)).size} OneAquaHealth cities
            </p>
          </div>
          <div className="hidden md:flex mx-auto items-center gap-2 rounded-xl bg-white shadow pl-3 pr-1.5 py-1.5 text-sm">
            {scenarioId === "today" ? (
              <>
                <span className="grid place-items-center w-5 h-5 rounded-full border border-accent text-accent text-[11px] font-bold">!</span>
                <span className="text-ink-2">
                  <b className="text-ink">{warnings}</b> stream{warnings === 1 ? "" : "s"} at high risk in the next 72 h
                </span>
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-amber-600" />
                <span className="text-ink-2">What-if: {PRESETS.find((p) => p.id === scenarioId)?.label ?? "custom"}</span>
                <button onClick={() => setScenario("today")} className="text-xs underline text-ink-3">
                  reset
                </button>
              </>
            )}
            <Link href={`/app/check${reach ? `?site=${reach}` : ""}`} className="btn-accent inline-flex items-center gap-1 px-3 py-1.5 text-sm">
              <Plus size={16} /> Add stream check
            </Link>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="hidden sm:grid place-items-center h-10 px-3 rounded-xl bg-white shadow text-xs font-semibold">EN</span>
            <Link href="/standards" aria-label="Standards and settings" className="hidden sm:grid place-items-center w-10 h-10 rounded-xl bg-white shadow text-ink-2">
              <Settings size={18} />
            </Link>
            <button
              aria-label={`${warnings} warnings`}
              onClick={() => select(ranked[0]?.id)}
              className="relative hidden sm:grid place-items-center w-10 h-10 rounded-xl bg-white shadow text-ink-2"
            >
              <Bell size={18} />
              {warnings > 0 && <span className="absolute -top-1 -right-1 grid place-items-center w-5 h-5 rounded-full bg-accent text-white text-[10px] font-semibold">{warnings}</span>}
            </button>
            <UserMenu name={user.name} roleLabel={user.roleLabel} email={user.email} dark />
          </div>
        </div>

        {/* legend */}
        <div className="absolute z-[500] right-4 lg:right-[392px] top-20 lg:top-24 float-card p-3 w-60 hidden sm:block">
          <p className="text-sm font-semibold">Risk distribution model</p>
          <p className="text-[11px] text-ink-3">
            {hazard === "all" ? "Highest of the three hazards" : HAZARD_SHORT[hazard]} · {day === todayIndex ? "today" : fmtDay(dates[day])}
          </p>
          <div className="mt-2 h-3 rounded-full" style={{ background: `linear-gradient(90deg, ${HEX.low}, ${HEX.moderate} 38%, ${HEX.high} 62%, ${HEX["very-high"]})` }} />
          <div className="mt-1 flex justify-between text-[10px] text-ink-3">
            <span>Low</span>
            <span>Moderate</span>
            <span>High</span>
            <span>Very high</span>
          </div>
        </div>
      </div>

      {/* bottom: date strip + chart + selectors */}
      <div className="relative z-[600] px-4 lg:px-0 mt-4 lg:mt-0 lg:absolute lg:left-6 lg:right-[392px] lg:bottom-5 space-y-3">
        <div className="float-card flex items-center gap-1 px-2 py-1.5">
          <button aria-label="Earlier days" disabled={stripStart === 0} onClick={() => setStripStart((s) => Math.max(0, s - 3))} className="p-1.5 rounded-lg hover:bg-river-soft disabled:opacity-30">
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 grid grid-cols-5 sm:grid-cols-10 gap-1">
            {dates.slice(stripStart, stripStart + STRIP).map((d, k) => {
              const i = stripStart + k;
              const lvl = levelAt(focus, hazard, i).level;
              const sel = i === day;
              return (
                <button
                  key={d}
                  onClick={() => setDay(i)}
                  aria-pressed={sel}
                  className={`${k >= 5 ? "hidden sm:flex" : "flex"} items-center justify-center gap-1.5 rounded-lg px-1 py-1.5 text-xs whitespace-nowrap ${
                    sel ? "bg-accent-soft text-accent font-semibold ring-1 ring-accent/40" : "text-ink-2 hover:bg-river-soft"
                  }`}
                >
                  <i className="w-2 h-2 rounded-full shrink-0" style={{ background: HEX[lvl] }} />
                  {i === todayIndex ? "Today" : fmtDay(d)}
                  {i > todayIndex && <CloudRain size={11} className="opacity-50 hidden xl:inline" aria-label="forecast" />}
                </button>
              );
            })}
          </div>
          <button aria-label="Later days" disabled={stripStart + STRIP >= dates.length} onClick={() => setStripStart((s) => Math.min(dates.length - STRIP, s + 3))} className="p-1.5 rounded-lg hover:bg-river-soft disabled:opacity-30">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
          <div className="float-card p-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold truncate">
                {pending && <span className="text-xs text-ink-3 font-normal mr-2 animate-pulse">recomputing…</span>}
                {focus.name} <span className="font-normal text-ink-3">· {fmtDay(dates[0])}–{fmtDay(dates[dates.length - 1])}</span>
              </p>
              <button onClick={downloadCsv} aria-label="Download chart data as CSV" title="Download CSV" className="grid place-items-center w-8 h-8 rounded-lg border border-line text-ink-2 hover:bg-river-soft">
                <Download size={15} />
              </button>
            </div>
            <RiskChart
              dates={dates}
              series={chartHazards.map((h) => ({ name: HAZARD_SHORT[h.id], color: SERIES_COLOR[h.id], values: h.timeline.map((d) => d.p) }))}
              bars={focus.weather.days.slice(0, dates.length).map((d) => (barKind === "rain" ? d.rain : d.tMax))}
              barLabel={barKind === "rain" ? "Rain" : "Max temperature"}
              barUnit={barKind === "rain" ? "mm" : "°C"}
              todayIndex={todayIndex}
              selectedIndex={day}
              onSelect={setDay}
            />
          </div>
          <div className="float-card p-3 space-y-2.5">
            <Field label="Hazard">
              <select value={hazard} onChange={(e) => setHazard(e.target.value as HazardSel)} className="w-full bg-transparent text-sm font-medium focus:outline-none">
                <option value="all">All hazards</option>
                <option value="waterborne">Pathogens</option>
                <option value="cyanobacteria">Algal bloom</option>
                <option value="vector">Mosquitoes</option>
              </select>
            </Field>
            <Field label="Period">
              <span className="text-sm font-medium">
                {fmtDay(dates[0])} – {fmtLong(dates[dates.length - 1])}
              </span>
            </Field>
            <Field label="Weather data">
              <select value={barKind} onChange={(e) => setBarKind(e.target.value as "rain" | "temp")} className="w-full bg-transparent text-sm font-medium focus:outline-none">
                <option value="rain">Rain</option>
                <option value="temp">Temperature</option>
              </select>
            </Field>
            <Field label="What-if scenario">
              <select value={scenarioId} onChange={(e) => setScenario(e.target.value)} className="w-full bg-transparent text-sm font-medium focus:outline-none">
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                {scenarioId === "custom" && <option value="custom">Custom</option>}
              </select>
            </Field>
          </div>
        </div>
      </div>

      {/* right column */}
      <aside className="relative z-[600] px-4 lg:px-0 mt-3 lg:mt-0 lg:absolute lg:right-6 lg:top-20 lg:bottom-5 lg:w-[350px] flex flex-col gap-3 pb-4 lg:pb-0">
        <section className="float-card flex flex-col min-h-0 lg:flex-1 overflow-hidden" aria-label={site ? "Stream details" : "Streams"}>
          {!site ? (
            <>
              <div className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">
                    Streams <span className="text-ink-3 font-normal text-sm">{sites.length}</span>
                  </p>
                  <span className="text-[11px] text-ink-3">by risk on {day === todayIndex ? "today" : fmtDay(dates[day])}</span>
                </div>
                <label className="mt-2 flex items-center gap-2 rounded-lg bg-river-soft px-3 py-2 text-sm">
                  <Search size={15} className="text-ink-3" />
                  <span className="sr-only">Search streams and cities</span>
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search streams and cities" className="bg-transparent flex-1 min-w-0 focus:outline-none" />
                </label>
              </div>
              <ul className="overflow-y-auto scroll-thin px-2 pb-2 max-h-[360px] lg:max-h-none">
                {ranked.map((s) => {
                  const l = levelAt(s, hazard, day);
                  return (
                    <li key={s.id}>
                      <button onClick={() => select(s.id)} className="w-full flex items-center gap-3 rounded-xl p-2 text-left hover:bg-river-soft">
                        <span className="grid place-items-center w-10 h-10 rounded-lg shrink-0 text-white" style={{ background: HEX[l.level] }}>
                          <Waves size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium truncate">{s.name}</span>
                          <span className="block text-[11px] text-ink-3 truncate">
                            {s.city}, {s.country} · {s.lat.toFixed(4)}° N {Math.abs(s.lon).toFixed(4)}° {s.lon < 0 ? "W" : "E"}
                          </span>
                        </span>
                        <span className={`chip lvl-${l.level}`}>{LEVEL_LABEL[l.level]}</span>
                      </button>
                    </li>
                  );
                })}
                {ranked.length === 0 && <li className="p-3 text-sm text-ink-3">No stream matches “{query}”.</li>}
              </ul>
            </>
          ) : (
            <div className="overflow-y-auto scroll-thin">
              <div className="flex items-center justify-between px-4 pt-3">
                <button onClick={() => select(undefined)} className="flex items-center gap-1.5 text-sm font-medium hover:text-accent">
                  <ArrowLeft size={16} /> Stream
                </button>
                <Link href={`/app/streams/${site.id}`} aria-label="Open full stream record" title="Open record" className="grid place-items-center w-8 h-8 rounded-lg border border-line text-ink-2 hover:bg-river-soft">
                  <ExternalLink size={15} />
                </Link>
              </div>
              <div className="flex gap-3 px-4 pt-3">
                <span className="w-14 h-14 rounded-lg shrink-0 grid place-items-center text-white" style={{ background: HEX[levelAt(site, hazard, day).level] }}>
                  <Waves size={22} />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{site.name}</p>
                  <p className="text-xs text-ink-3 mt-0.5">
                    {site.river} · {site.district}, {site.city}
                  </p>
                  <p className="text-xs text-ink-3">
                    {site.lat.toFixed(4)}° N {Math.abs(site.lon).toFixed(4)}° {site.lon < 0 ? "W" : "E"} · ~{site.residents.toLocaleString("en")} residents
                  </p>
                </div>
              </div>

              <div className="px-4 pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Hazards · {day === todayIndex ? "today" : fmtDay(dates[day])}</p>
                  <Link href={`/app/streams/${site.id}`} className="text-xs text-accent font-medium hover:underline">
                    Why this score
                  </Link>
                </div>
                <ul className="mt-2 grid grid-cols-1 gap-2">
                  {site.hazards.map((h) => {
                    const d = h.timeline[day];
                    return (
                      <li key={h.id} className="rounded-lg border border-line px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm">{h.label}</span>
                          <span className={`chip lvl-${d.level}`}>{Math.round(d.p * 100)}%</span>
                        </div>
                        <p className="text-[11px] text-ink-3 mt-0.5">
                          Peak {LEVEL_LABEL[h.peak.level].toLowerCase()} on {fmtDay(h.peak.date)} · {h.factors[0]?.label.toLowerCase()}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                {user.role === "officer" && (
                  <Link href={`/app/streams/${site.id}#agent`} className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-river text-river text-sm font-medium py-2 hover:bg-river hover:text-white">
                    <Sparkles size={15} /> Draft response plan with AI
                  </Link>
                )}
              </div>

              <div className="px-4 py-4 mt-3 border-t border-line">
                <p className="text-sm font-semibold">Current weather</p>
                {site.weather.current ? (
                  <>
                    <p className="text-[11px] text-ink-3">
                      {dayMonthTime(site.weather.current.time)} local
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <WeatherIcon code={site.weather.current.code} />
                      <span className="text-3xl font-semibold">{Math.round(site.weather.current.tempC)}°C</span>
                      <span className="text-sm text-ink-2">{describe(site.weather.current.code)}</span>
                    </div>
                    <dl className="grid grid-cols-4 gap-2 mt-3 text-center">
                      {[
                        ["Wind", `${Math.round(site.weather.current.windKmh)} km/h`],
                        ["Humidity", `${Math.round(site.weather.current.humidity)}%`],
                        ["Cloud", `${Math.round(site.weather.current.cloudCover)}%`],
                        ["Precip.", `${site.weather.current.precipMm} mm`],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[10px] text-ink-3">{k}</dt>
                          <dd className="text-sm font-medium">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <p className="text-sm text-ink-3 mt-1">Live conditions unavailable (offline climatology).</p>
                )}
                <Link href={`/app/streams/${site.id}`} className="block text-right text-xs text-accent font-medium mt-3 hover:underline">
                  Weather forecast
                </Link>
              </div>
            </div>
          )}
        </section>

        <section className="float-card p-4 shrink-0" aria-label="Stream checks">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">
              Stream checks <span className="font-normal text-ink-3">· {(site ?? focus).name}</span>
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2 p-1 rounded-lg bg-river-soft text-sm" role="tablist">
            {(["new", "verified"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={checkTab === t}
                onClick={() => setCheckTab(t)}
                className={`rounded-md py-1.5 ${checkTab === t ? "bg-river text-white" : "text-ink-2"}`}
              >
                {t === "new" ? `New · ${checks.pendingCount}` : "Verified"}
              </button>
            ))}
          </div>
          <ul tabIndex={0} aria-label="Recent stream checks" className="mt-2 max-h-28 overflow-y-auto scroll-thin divide-y divide-line">
            {(checkTab === "new" ? checks.pending : checks.verified).slice(0, 4).map((c) => (
              <li key={c.key} className="py-1.5 text-xs">
                <span className="font-medium">{fmtDay(c.when.slice(0, 10))}</span> <span className="text-ink-3">· {c.who}</span>
                <span className="block text-ink-3 truncate">{c.items.join(" · ")}</span>
              </li>
            ))}
            {(checkTab === "new" ? checks.pending : checks.verified).length === 0 && <li className="py-2 text-xs text-ink-3">Nothing here yet.</li>}
          </ul>
          <Link href={`/app/check?site=${(site ?? focus).id}`} className="btn-accent mt-3 flex items-center justify-center gap-1.5 py-2.5 text-sm">
            <Plus size={16} /> Add new stream check
          </Link>
        </section>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block rounded-lg border border-line px-2.5 py-1.5">
      <span className="block text-[10px] text-ink-3">{label}</span>
      {children}
    </label>
  );
}

function WeatherIcon({ code }: { code: number }) {
  const cls = "shrink-0";
  if (code === 0) return <Sun size={34} className={`${cls} text-amber-500`} aria-hidden />;
  if (code <= 2) return <CloudSun size={34} className={`${cls} text-amber-500`} aria-hidden />;
  if (code === 3) return <Cloud size={34} className={`${cls} text-slate-400`} aria-hidden />;
  if (code <= 48) return <CloudFog size={34} className={`${cls} text-slate-400`} aria-hidden />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <Snowflake size={34} className={`${cls} text-sky-400`} aria-hidden />;
  if (code >= 95) return <CloudLightning size={34} className={`${cls} text-violet-500`} aria-hidden />;
  return <CloudRain size={34} className={`${cls} text-sky-600`} aria-hidden />;
}

function describe(code: number) {
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  return "Thunderstorm";
}
