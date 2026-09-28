// In-memory data store, seeded relative to "today" so the demo always has
// recent citizen checks. Swap for a FHIR server by pointing FHIR_UPSTREAM at one
// (see src/lib/fhir/upstream.ts).

import { OAH_CS, TRIB_CS, FLOW_DISPLAY, OAH_DISPLAY } from "./codes";
import { SITES } from "./sites";
import type { ClinicalSignal, FlowState, ObservationValue, StreamObservation } from "./types";

interface Store {
  observations: StreamObservation[];
  signals: ClinicalSignal[];
  version: number;
}

const DAY = 86_400_000;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function coded(code: string): ObservationValue {
  return { kind: "coded", system: OAH_CS, code, display: OAH_DISPLAY[code] ?? code };
}
export function flow(state: FlowState): ObservationValue {
  return { kind: "coded", system: TRIB_CS.flowState, code: state, display: FLOW_DISPLAY[state] };
}
export function celsius(v: number): ObservationValue {
  return { kind: "quantity", value: Math.round(v * 10) / 10, unit: "°C", ucum: "Cel" };
}
export function cfu(v: number): ObservationValue {
  return { kind: "quantity", value: v, unit: "CFU/100 mL", ucum: "{CFU}/100.mL" };
}

interface SiteProfile {
  /** probability that a citizen check reports foam/smell present */
  sewage: number;
  diptera: number;
  algaeBand: number; // 0..4 index into cover bands
  flow: FlowState[];
  waterTempBase: number;
  coliformRecent?: number;
}

const PROFILES: Record<string, SiteProfile> = {
  "giofyros-1": { sewage: 0.55, diptera: 0.35, algaeBand: 1, flow: ["low", "low", "normal"], waterTempBase: 21, coliformRecent: 1480 },
  "giofyros-2": { sewage: 0.2, diptera: 0.5, algaeBand: 2, flow: ["stagnant", "low", "low"], waterTempBase: 22 },
  "almyros-1": { sewage: 0.1, diptera: 0.45, algaeBand: 1, flow: ["normal", "low"], waterTempBase: 20 },
  "sabato-bn": { sewage: 0.3, diptera: 0.4, algaeBand: 3, flow: ["low", "stagnant", "low"], waterTempBase: 19, coliformRecent: 720 },
  "akerselva-oslo": { sewage: 0.12, diptera: 0.05, algaeBand: 0, flow: ["normal", "high", "normal"], waterTempBase: 10, coliformRecent: 310 },
  "coselhas-coimbra": { sewage: 0.35, diptera: 0.15, algaeBand: 2, flow: ["low", "normal"], waterTempBase: 17 },
};

const ALGAE = ["0-20-percent", "21-40-percent", "41-60-percent", "61-80-percent", "81-100-percent"];
const VOLUNTEERS = ["V-7Q2", "V-K3M", "V-R8D", "V-2XA", "V-P5N", "V-H9C", "V-W4T", "V-B6L"];

function seed(now = Date.now()): Store {
  const rand = mulberry32(20260928);
  const observations: StreamObservation[] = [];
  let n = 0;
  const today = new Date(now);
  today.setUTCHours(10, 0, 0, 0);

  for (const site of SITES) {
    const p = PROFILES[site.id];
    // one citizen check every ~4-6 days over the past 60 days
    for (let daysAgo = 58; daysAgo >= 1; daysAgo -= 4 + Math.floor(rand() * 3)) {
      const when = new Date(today.getTime() - daysAgo * DAY + Math.floor(rand() * 6) * 3_600_000).toISOString();
      const vol = VOLUNTEERS[Math.floor(rand() * VOLUNTEERS.length)];
      const performer = { kind: "citizen" as const, id: vol, display: `Volunteer ${vol}` };
      const status = daysAgo > 10 ? ("final" as const) : ("preliminary" as const);
      const push = (code: StreamObservation["code"], value: ObservationValue, note?: string) =>
        observations.push({ id: `obs-${++n}`, siteId: site.id, effective: when, code, value, performer, status, note });

      // recent checks lean towards the site's "story" so the demo has signal
      const recency = daysAgo < 15 ? 1.25 : 0.8;
      const smell = rand() < p.sewage * recency;
      push("foam", coded(smell ? (rand() < 0.35 ? "extensive" : "present") : "absent"),
        smell ? "Grey foam and sewage smell below the outfall" : undefined);
      push("diptera", coded(rand() < p.diptera * recency ? "present" : "absent"));
      push("hydrology", flow(p.flow[Math.floor(rand() * p.flow.length)]));
      push("filamentous-algae", coded(ALGAE[Math.min(4, Math.max(0, p.algaeBand + Math.round((rand() - 0.5) * 1.6)))]));
      push("waterTemperature", celsius(p.waterTempBase + (rand() - 0.5) * 3));
    }
    if (p.coliformRecent) {
      observations.push({
        id: `obs-${++n}`,
        siteId: site.id,
        effective: new Date(today.getTime() - 9 * DAY).toISOString(),
        code: "coliforms",
        value: cfu(p.coliformRecent),
        performer: { kind: "lab", id: "lab-oah", display: "OneAquaHealth partner laboratory" },
        status: "final",
        note: "E. coli, membrane filtration (ISO 9308-1)",
      });
    }
  }

  const signals: ClinicalSignal[] = [];
  // background syndromic signal: a couple of GI presentations near Giofyros A
  for (const d of [6, 3]) {
    signals.push({
      id: `sig-seed-${d}`,
      siteId: "giofyros-1",
      district: "Heraklion West",
      date: new Date(today.getTime() - d * DAY).toISOString().slice(0, 10),
      syndrome: "gastrointestinal",
      source: "seed",
    });
  }
  return { observations, signals, version: 1 };
}

const g = globalThis as unknown as { __streamreachStore?: Store };

export function store(): Store {
  if (!g.__streamreachStore) g.__streamreachStore = seed();
  return g.__streamreachStore;
}

export function resetStore() {
  g.__streamreachStore = seed();
}

export function observationsFor(siteId: string): StreamObservation[] {
  return store()
    .observations.filter((o) => o.siteId === siteId)
    .sort((a, b) => b.effective.localeCompare(a.effective));
}

export function addObservations(obs: Omit<StreamObservation, "id">[]): StreamObservation[] {
  const s = store();
  const created = obs.map((o) => ({ ...o, id: `obs-${crypto.randomUUID().slice(0, 8)}` }));
  s.observations.push(...created);
  s.version++;
  return created;
}

export function addSignal(sig: Omit<ClinicalSignal, "id">): ClinicalSignal {
  const s = store();
  const created = { ...sig, id: `sig-${crypto.randomUUID().slice(0, 8)}` };
  s.signals.push(created);
  s.version++;
  return created;
}

export function signalsFor(siteId: string): ClinicalSignal[] {
  return store().signals.filter((x) => x.siteId === siteId);
}

/** Distinct citizen checks and clinic signals in the last 14 days. */
export function recentStats(now = Date.now()) {
  const s = store();
  const since = now - 14 * 86_400_000;
  const checks = new Set(
    s.observations
      .filter((o) => o.performer.kind === "citizen" && new Date(o.effective).getTime() > since)
      .map((o) => `${o.siteId}${o.effective}`),
  ).size;
  const clinic = s.signals.filter((x) => new Date(x.date).getTime() > since).length;
  return { checks, clinic };
}
