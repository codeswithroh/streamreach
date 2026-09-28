// Explainable One Health risk engine.
//
// Each hazard is a small logistic model: a set of named factors (0..1) with
// transparent, literature-informed weights. Weights are expert priors, not
// fitted coefficients. They are written to be recalibrated against lab and
// syndromic data as OneAquaHealth collects it (see docs/MODEL.md). Every score
// ships with the factors that produced it, so nobody has to trust a black box.

import type { Site } from "../sites";
import type { ClinicalSignal, HazardId, RiskLevel, StreamObservation } from "../types";
import type { WeatherSeries } from "../weather";

export type FactorSource = "forecast" | "weather" | "citizen" | "lab" | "site" | "clinical";

export interface Factor {
  id: string;
  label: string;
  detail: string;
  source: FactorSource;
  /** normalised factor value 0..1 */
  value: number;
  weight: number;
  /** weight × value, in log-odds */
  contribution: number;
  evidence: string[]; // observation / signal ids
}

export interface HazardDay {
  date: string;
  p: number;
  level: RiskLevel;
  forecast: boolean;
}

export interface HazardAssessment {
  hazard: HazardId;
  label: string;
  short: string;
  now: HazardDay;
  peak: HazardDay; // worst of today + next 3 days
  timeline: HazardDay[];
  factors: Factor[]; // at the peak day
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
  publicAdvice: string;
  clinicalAdvice: string;
}

export interface SiteRisk {
  siteId: string;
  weatherSource: WeatherSeries["source"];
  hazards: HazardAssessment[];
  overall: RiskLevel;
  computedAt: string;
  latestCheck?: string;
}

export const LEVELS: RiskLevel[] = ["low", "moderate", "high", "very-high"];
export const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  "very-high": "Very high",
};

export function level(p: number): RiskLevel {
  if (p < 0.2) return "low";
  if (p < 0.4) return "moderate";
  if (p < 0.65) return "high";
  return "very-high";
}

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const DAY = 86_400_000;
const r1 = (x: number) => Math.round(x * 10) / 10;

interface Ctx {
  site: Site;
  w: WeatherSeries;
  obs: StreamObservation[];
  signals: ClinicalSignal[];
}

function dayTime(date: string) {
  return new Date(`${date}T12:00:00Z`).getTime();
}

/** Most recent observation of a code on/before day t, with its age in days. */
function latest(ctx: Ctx, code: StreamObservation["code"], t: number, maxAgeDays: number) {
  let best: StreamObservation | undefined;
  for (const o of ctx.obs) {
    if (o.code !== code) continue;
    const at = new Date(o.effective).getTime();
    if (at > t + DAY / 2) continue;
    if ((t - at) / DAY > maxAgeDays) continue;
    if (!best || o.effective > best.effective) best = o;
  }
  if (!best) return undefined;
  return { obs: best, age: Math.max(0, (t - new Date(best.effective).getTime()) / DAY) };
}

function sumRain(w: WeatherSeries, from: number, to: number) {
  let s = 0;
  for (let i = Math.max(0, from); i <= Math.min(w.days.length - 1, to); i++) s += w.days[i].rainMm;
  return s;
}
function meanT(w: WeatherSeries, from: number, to: number) {
  let s = 0,
    n = 0;
  for (let i = Math.max(0, from); i <= Math.min(w.days.length - 1, to); i++) {
    s += w.days[i].tMean;
    n++;
  }
  return n ? s / n : 0;
}

function f(
  id: string,
  label: string,
  detail: string,
  source: FactorSource,
  value: number,
  weight: number,
  evidence: string[] = [],
): Factor {
  const v = clamp01(value);
  return { id, label, detail, source, value: v, weight, contribution: v * weight, evidence };
}

// ---------------------------------------------------------------- waterborne

function waterborne(ctx: Ctx, i: number): Factor[] {
  const { site, w } = ctx;
  const t = dayTime(w.days[i].date);
  const v = site.vulnerability;
  const rainEff = w.days[i].rainMm + 0.5 * (w.days[i - 1]?.rainMm ?? 0);
  const spill = sigmoid((rainEff - v.overflowThresholdMm) / (v.overflowThresholdMm * 0.25));
  const outfallScale = Math.min(1, (v.overflowsUpstream + 1) / 3);
  const rain72 = sumRain(w, i - 2, i);
  const future = w.days[i].forecast;

  const factors: Factor[] = [
    f(
      "overflow",
      "Storm overflow likely",
      `${r1(rainEff)} mm effective rain ${future ? "forecast" : "recorded"} vs ~${v.overflowThresholdMm} mm spill threshold, ${v.overflowsUpstream} outfall(s) upstream`,
      future ? "forecast" : "weather",
      spill * outfallScale,
      2.4,
    ),
    f("flush", "Runoff flush", `${r1(rain72)} mm over 72 h washing streets and pastures into the stream`, future ? "forecast" : "weather", rain72 / (v.overflowThresholdMm * 2), 0.8),
  ];

  const foam = latest(ctx, "foam", t, 21);
  if (foam && foam.obs.value.kind === "coded") {
    const sev = foam.obs.value.code === "extensive" ? 1 : foam.obs.value.code === "present" ? 0.6 : 0;
    factors.push(
      f("sewage-signs", "Sewage signs reported", `Citizen check ${Math.round(foam.age)} d ago: foam/colour/smell ${foam.obs.value.display.toLowerCase()}`, "citizen", sev * Math.exp(-foam.age / 7), 1.4, [foam.obs.id]),
    );
  }
  const col = latest(ctx, "coliforms", t, 45);
  if (col && col.obs.value.kind === "quantity") {
    const val = col.obs.value.value;
    const x = clamp01((Math.log10(val) - Math.log10(500)) / (Math.log10(2000) - Math.log10(500)));
    factors.push(
      f("coliforms", "Faecal bacteria (lab)", `E. coli ${val} CFU/100 mL, ${Math.round(col.age)} d ago (EU bathing 'sufficient' limit for inland water: 900)`, "lab", x * Math.exp(-col.age / 21), 1.5, [col.obs.id]),
    );
  }
  factors.push(f("impervious", "Sealed catchment", `${Math.round(v.impervious * 100)}% of catchment is paved`, "site", v.impervious, 0.6));

  const recent = ctx.signals.filter((s) => s.syndrome === "gastrointestinal" && t - dayTime(s.date) >= -DAY / 2 && t - dayTime(s.date) <= 14 * DAY);
  if (recent.length)
    factors.push(
      f("clinical", "Clinic signal", `${recent.length} gastrointestinal presentation(s) near this reach in 14 d, reported via CDS Hooks feedback`, "clinical", recent.length / 4, 1.2, recent.map((s) => s.id)),
    );
  return factors;
}

// ------------------------------------------------------------ cyanobacteria

function cyanobacteria(ctx: Ctx, i: number): Factor[] {
  const { w } = ctx;
  const t = dayTime(w.days[i].date);
  const future = w.days[i].forecast;
  const factors: Factor[] = [];

  const measured = latest(ctx, "waterTemperature", t, 5);
  let tw: number;
  let twDetail: string;
  const evidence: string[] = [];
  if (measured && measured.obs.value.kind === "quantity") {
    const obsIdx = w.days.findIndex((d) => d.date === measured.obs.effective.slice(0, 10));
    const drift = obsIdx >= 0 ? (w.days[i].tMean - w.days[obsIdx].tMean) * 0.6 : 0;
    tw = measured.obs.value.value + drift;
    twDetail = `${r1(tw)} °C (citizen thermometer ${Math.round(measured.age)} d ago${Math.abs(drift) > 0.2 ? `, adjusted for forecast ${drift > 0 ? "+" : ""}${r1(drift)} °C` : ""})`;
    evidence.push(measured.obs.id);
  } else {
    tw = 0.75 * meanT(w, i - 6, i) + 2.5;
    twDetail = `~${r1(tw)} °C estimated from the 7-day air temperature`;
  }
  factors.push(f("water-temp", "Warm water", `${twDetail}; blooms accelerate above ~20 °C`, measured ? "citizen" : future ? "forecast" : "weather", sigmoid((tw - 20) / 1.8), 2.6, evidence));

  const rain7 = sumRain(w, i - 6, i);
  const fl = latest(ctx, "hydrology", t, 10);
  const flowScore: Record<string, number> = { stagnant: 1, dry: 0.6, low: 0.7, normal: 0.2, high: 0 };
  const flowV = fl && fl.obs.value.kind === "coded" ? flowScore[fl.obs.value.code] ?? 0.3 : 0.4;
  factors.push(
    f(
      "stagnation",
      "Slow, still water",
      `${r1(rain7)} mm rain in 7 d${fl ? `; citizens report "${fl.obs.value.kind === "coded" ? fl.obs.value.display.toLowerCase() : ""}"` : ""}`,
      fl ? "citizen" : "weather",
      0.5 * (1 - Math.min(1, rain7 / 15)) + 0.5 * flowV,
      1.3,
      fl ? [fl.obs.id] : [],
    ),
  );
  let sun = 0,
    n = 0;
  for (let k = Math.max(0, i - 2); k <= i; k++) {
    sun += w.days[k].sunshineH;
    n++;
  }
  factors.push(f("sunshine", "Strong sunshine", `${r1(sun / n)} h/day of sun`, future ? "forecast" : "weather", sun / n / 12, 0.7));

  const algae = latest(ctx, "filamentous-algae", t, 21);
  if (algae && algae.obs.value.kind === "coded") {
    const bands = ["0-20-percent", "21-40-percent", "41-60-percent", "61-80-percent", "81-100-percent"];
    const b = bands.indexOf(algae.obs.value.code);
    factors.push(
      f("nutrients", "Nutrient-rich water", `Filamentous algae covering ${algae.obs.value.display} of the bed (${Math.round(algae.age)} d ago)`, "citizen", (b / 4) * Math.exp(-algae.age / 14), 1.6, [algae.obs.id]),
    );
  }
  return factors;
}

// -------------------------------------------------------------------- vector

function vector(ctx: Ctx, i: number): Factor[] {
  const { site, w } = ctx;
  const t = dayTime(w.days[i].date);
  const future = w.days[i].forecast;
  const t7 = meanT(w, i - 6, i);
  const pastRain = sumRain(w, i - 14, i - 5);
  const flush = sumRain(w, i - 2, i);
  const factors: Factor[] = [
    f("warmth", "Mosquito-friendly warmth", `7-day mean ${r1(t7)} °C; Culex and West Nile amplification speed up above ~20 °C`, future ? "forecast" : "weather", sigmoid((t7 - 20) / 2.5), 2.2),
    f("pools", "Breeding pools", `${r1(pastRain)} mm rain 5–14 d ago left pools; ${r1(flush)} mm in last 72 h`, "weather", Math.min(1, pastRain / 25) * (1 - Math.min(1, flush / 20)), 1.1),
  ];
  const larvae = latest(ctx, "diptera", t, 21);
  if (larvae && larvae.obs.value.kind === "coded" && larvae.obs.value.code !== "absent")
    factors.push(f("larvae", "Larvae spotted", `Citizens saw mosquito/midge larvae ${Math.round(larvae.age)} d ago`, "citizen", Math.exp(-larvae.age / 10), 1.5, [larvae.obs.id]));
  factors.push(f("endemic", "Regional West Nile activity", site.vulnerability.vectorEndemic ? `West Nile virus circulated in ${site.country} in recent seasons` : `No recent West Nile circulation reported in ${site.country}`, "site", site.vulnerability.vectorEndemic ? 1 : 0, 1.0));
  return factors;
}

// ------------------------------------------------------------------- shared

const MODELS: Record<
  HazardId,
  { label: string; short: string; intercept: number; fn: (c: Ctx, i: number) => Factor[] }
> = {
  waterborne: { label: "Waterborne pathogens", short: "Gut bugs", intercept: -3.4, fn: waterborne },
  cyanobacteria: { label: "Toxic algal bloom", short: "Algae", intercept: -4.2, fn: cyanobacteria },
  vector: { label: "Mosquito-borne disease", short: "Mosquitoes", intercept: -4.3, fn: vector },
};

const ADVICE: Record<HazardId, Record<RiskLevel, { pub: string; clin: string }>> = {
  waterborne: {
    low: { pub: "Water looks fine for walking and play along the banks. Wash hands after touching the water.", clin: "No elevated waterborne exposure signal." },
    moderate: { pub: "Avoid swallowing stream water. Wash hands and rinse dogs after contact.", clin: "Mild waterborne signal. Ask about stream contact in patients with diarrhoea." },
    high: { pub: "Keep children and dogs out of the water for 48 h. Don't use it to water vegetables.", clin: "Elevated risk of Campylobacter, Cryptosporidium, Giardia and pathogenic E. coli after sewer overflow. Take an exposure history; consider a stool pathogen panel." },
    "very-high": { pub: "Stay out of the water. Sewage is likely spilling after heavy rain. Don't water crops with it.", clin: "Probable sewage contamination. For acute gastroenteritis with stream exposure, send stool culture/PCR and notify public health if clustered." },
  },
  cyanobacteria: {
    low: { pub: "No sign of toxic algae.", clin: "No bloom signal." },
    moderate: { pub: "Keep dogs from drinking still, green water.", clin: "Conditions favour cyanobacteria. Consider in unexplained rash, conjunctivitis or GI upset after water contact." },
    high: { pub: "Avoid contact with green, scummy or still water. Dogs are especially at risk.", clin: "Probable cyanobacterial bloom. Cyanotoxin exposure can cause dermatitis, GI illness and, in dogs, fatal hepatotoxicity." },
    "very-high": { pub: "Avoid all contact. Keep pets away. Report scum or dead fish.", clin: "Bloom highly likely. Consider cyanotoxin exposure for rash/GI/respiratory symptoms after recreation; alert veterinary services." },
  },
  vector: {
    low: { pub: "Few mosquitoes expected.", clin: "No vector signal." },
    moderate: { pub: "Use repellent at dusk near the water.", clin: "Mosquito activity expected. Keep arboviral causes in mind for febrile illness." },
    high: { pub: "Use repellent, cover up at dusk, empty standing water around homes.", clin: "Conditions favour Culex and West Nile amplification. For fever with headache or neurological signs, consider West Nile virus testing." },
    "very-high": { pub: "High mosquito risk. Use repellent, avoid the banks at dusk, and report larvae.", clin: "High arboviral risk. Test for West Nile virus in febrile neurological illness; report to public health." },
  },
};

export function assessSite(site: Site, w: WeatherSeries, obs: StreamObservation[], signals: ClinicalSignal[]): SiteRisk {
  const ctx: Ctx = { site, w, obs, signals };
  const start = Math.max(0, w.todayIndex - 7);
  const hazards: HazardAssessment[] = (Object.keys(MODELS) as HazardId[]).map((h) => {
    const m = MODELS[h];
    const timeline: HazardDay[] = [];
    const factorsByDay: Factor[][] = [];
    for (let i = start; i < w.days.length; i++) {
      const fs = m.fn(ctx, i);
      const p = sigmoid(m.intercept + fs.reduce((a, x) => a + x.contribution, 0));
      timeline.push({ date: w.days[i].date, p, level: level(p), forecast: i > w.todayIndex });
      factorsByDay.push(fs);
    }
    const ti = w.todayIndex - start;
    let pk = ti;
    for (let k = ti; k <= Math.min(timeline.length - 1, ti + 3); k++) if (timeline[k].p > timeline[pk].p) pk = k;
    const recentChecks = obs.filter((o) => o.performer.kind === "citizen" && Date.now() - new Date(o.effective).getTime() < 14 * DAY);
    const checkDays = new Set(recentChecks.map((o) => o.effective.slice(0, 10))).size;
    const confidence = checkDays >= 3 ? "high" : checkDays >= 1 ? "medium" : "low";
    const lv = timeline[pk].level;
    return {
      hazard: h,
      label: m.label,
      short: m.short,
      now: timeline[ti],
      peak: timeline[pk],
      timeline,
      factors: factorsByDay[pk].slice().sort((a, b) => b.contribution - a.contribution),
      confidence,
      confidenceReason:
        confidence === "high"
          ? `${checkDays} citizen checks in the last 14 days`
          : confidence === "medium"
            ? `Only ${checkDays} citizen check(s) in 14 days. A fresh check would sharpen this.`
            : "No citizen check in 14 days. Weather-only estimate.",
      publicAdvice: ADVICE[h][lv].pub,
      clinicalAdvice: ADVICE[h][lv].clin,
    };
  });
  const overall = hazards.reduce<RiskLevel>((a, h) => (LEVELS.indexOf(h.peak.level) > LEVELS.indexOf(a) ? h.peak.level : a), "low");
  const latestCheck = obs.filter((o) => o.performer.kind === "citizen").map((o) => o.effective).sort().pop();
  return { siteId: site.id, weatherSource: w.source, hazards, overall, computedAt: new Date().toISOString(), latestCheck };
}
