// Demo dataset: 120 days of citizen checks, monthly lab samples and clinic
// signals for every reach, generated relative to "today" so the record always
// looks current. Each reach has a storyline (sewage episodes, a summer bloom,
// a mosquito season) so the data reads like a real monitoring programme.
// Seed rows are tagged origin = "seed"; anything judges or users add is
// origin = "user" and is never touched by a reseed.

import { FLOW_DISPLAY, OAH_CS, OAH_DISPLAY, TRIB_CS } from "./codes";
import { SITES } from "./sites";
import type { ClinicalSignal, FlowState, ObservationValue, StreamObservation } from "./types";

export type Origin = "seed" | "user";
export type StoredObservation = StreamObservation & { origin: Origin };
export type StoredSignal = ClinicalSignal & { origin: Origin };

const DAY = 86_400_000;
export const SEED_DAYS = 120;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const coded = (code: string): ObservationValue => ({ kind: "coded", system: OAH_CS, code, display: OAH_DISPLAY[code] ?? code });
export const flow = (state: FlowState): ObservationValue => ({ kind: "coded", system: TRIB_CS.flowState, code: state, display: FLOW_DISPLAY[state] });
export const celsius = (v: number): ObservationValue => ({ kind: "quantity", value: Math.round(v * 10) / 10, unit: "°C", ucum: "Cel" });
export const cfu = (v: number): ObservationValue => ({ kind: "quantity", value: Math.round(v), unit: "CFU/100 mL", ucum: "{CFU}/100.mL" });

interface Episode {
  /** days ago the episode starts / ends */
  from: number;
  to: number;
  sewage?: number;
  diptera?: number;
  algae?: number; // band shift
  flow?: FlowState[];
}

interface Profile {
  volunteers: string[];
  cadence: [number, number]; // days between checks
  sewage: number;
  diptera: number;
  algaeBand: number;
  flow: FlowState[];
  waterTemp: number; // late-summer mean
  seasonalAmp: number;
  ecoli: number; // typical lab E. coli
  episodes: Episode[];
  notes: string[];
}

const P: Record<string, Profile> = {
  "giofyros-1": {
    volunteers: ["V-7Q2", "V-K3M", "V-R8D", "V-H9C"],
    cadence: [2, 4],
    sewage: 0.35,
    diptera: 0.3,
    algaeBand: 1,
    flow: ["low", "low", "normal"],
    waterTemp: 22,
    seasonalAmp: 3,
    ecoli: 820,
    episodes: [
      { from: 78, to: 70, sewage: 0.9, flow: ["high", "high", "normal"] },
      { from: 12, to: 0, sewage: 0.75 },
    ],
    notes: ["Grey foam below the Knossou outfall", "Sewage smell near the footbridge", "Plastic bottles caught in reeds", "Ducks and a heron feeding"],
  },
  "giofyros-2": {
    volunteers: ["V-2XA", "V-P5N", "V-M1E"],
    cadence: [3, 6],
    sewage: 0.15,
    diptera: 0.45,
    algaeBand: 2,
    flow: ["stagnant", "low", "low", "dry"],
    waterTemp: 23,
    seasonalAmp: 3.5,
    ecoli: 460,
    episodes: [{ from: 60, to: 25, diptera: 0.8, algae: 1, flow: ["stagnant", "dry"] }],
    notes: ["Pools drying out, lots of larvae", "Goats drinking from the stream", "Green film on still pools"],
  },
  "almyros-1": {
    volunteers: ["V-W4T", "V-B6L", "V-Z3K"],
    cadence: [3, 5],
    sewage: 0.08,
    diptera: 0.35,
    algaeBand: 1,
    flow: ["normal", "low"],
    waterTemp: 21,
    seasonalAmp: 3,
    ecoli: 240,
    episodes: [{ from: 75, to: 40, diptera: 0.75 }],
    notes: ["Many dragonflies", "Kids playing at the mouth", "Reed warblers singing", "Mosquitoes biting at dusk"],
  },
  "sabato-bn": {
    volunteers: ["V-S1A", "V-L7G", "V-C4F", "V-N2D"],
    cadence: [2, 5],
    sewage: 0.22,
    diptera: 0.3,
    algaeBand: 2,
    flow: ["low", "stagnant", "low"],
    waterTemp: 20,
    seasonalAmp: 4,
    ecoli: 640,
    episodes: [
      { from: 55, to: 30, algae: 2, flow: ["stagnant", "low"], diptera: 0.6 },
      { from: 9, to: 5, sewage: 0.7, flow: ["high"] },
    ],
    notes: ["Thick green mats near Ponte Leproso", "Dead fish in a backwater", "Anglers report murky water", "Swallows over the water"],
  },
  "calore-bn": {
    volunteers: ["V-D5R", "V-T8V", "V-F2Q"],
    cadence: [4, 7],
    sewage: 0.18,
    diptera: 0.25,
    algaeBand: 1,
    flow: ["normal", "low"],
    waterTemp: 19,
    seasonalAmp: 4,
    ecoli: 510,
    episodes: [{ from: 45, to: 35, algae: 1, diptera: 0.5 }],
    notes: ["Summer camp kids helped with the check", "Kingfisher seen", "Litter after the weekend"],
  },
  "akerselva-oslo": {
    volunteers: ["V-O3S", "V-E9J", "V-A6K", "V-G1U"],
    cadence: [2, 4],
    sewage: 0.08,
    diptera: 0.03,
    algaeBand: 0,
    flow: ["normal", "high", "normal"],
    waterTemp: 12,
    seasonalAmp: 4,
    ecoli: 190,
    episodes: [{ from: 34, to: 31, sewage: 0.8, flow: ["high"] }],
    notes: ["Brown trout jumping", "Swimmers at Nydalen", "Overflow smell after the cloudburst", "Crystal clear today"],
  },
  "alna-oslo": {
    volunteers: ["V-Y4H", "V-U7C", "V-I2W"],
    cadence: [3, 5],
    sewage: 0.3,
    diptera: 0.04,
    algaeBand: 1,
    flow: ["normal", "high", "low"],
    waterTemp: 11,
    seasonalAmp: 4,
    ecoli: 1150,
    episodes: [
      { from: 34, to: 30, sewage: 0.95, flow: ["high"] },
      { from: 6, to: 0, sewage: 0.6 },
    ],
    notes: ["Grey water from a misconnected pipe", "Road salt smell", "Sea trout returning", "Oil sheen near the culvert"],
  },
  "hovinbekken-oslo": {
    volunteers: ["V-J5B", "V-Q8M"],
    cadence: [5, 9],
    sewage: 0.2,
    diptera: 0.05,
    algaeBand: 1,
    flow: ["low", "normal"],
    waterTemp: 12,
    seasonalAmp: 4,
    ecoli: 700,
    episodes: [{ from: 33, to: 30, sewage: 0.7 }],
    notes: ["School class check", "New plantings on the bank", "Frogs in the pond section"],
  },
  "coselhas-coimbra": {
    volunteers: ["V-K2P", "V-R4S", "V-E7T"],
    cadence: [3, 6],
    sewage: 0.25,
    diptera: 0.15,
    algaeBand: 2,
    flow: ["low", "normal"],
    waterTemp: 18,
    seasonalAmp: 3,
    ecoli: 760,
    episodes: [{ from: 20, to: 14, sewage: 0.6, algae: 1 }],
    notes: ["Community garden plot irrigating from the stream", "Foam at the culvert", "School nature walk"],
  },
  "mondego-coimbra": {
    volunteers: ["V-M6N", "V-C8L", "V-F1R", "V-B3A"],
    cadence: [3, 5],
    sewage: 0.12,
    diptera: 0.12,
    algaeBand: 1,
    flow: ["normal", "low"],
    waterTemp: 20,
    seasonalAmp: 3,
    ecoli: 380,
    episodes: [{ from: 50, to: 38, algae: 2, flow: ["low", "stagnant"] }],
    notes: ["Rowing club members joined", "Swimmers near the beach", "Green scum in the slow side channel", "Otter tracks on the sandbank"],
  },
};

const ALGAE = ["0-20-percent", "21-40-percent", "41-60-percent", "61-80-percent", "81-100-percent"];

const CLINIC_STORY: { siteId: string; daysAgo: number[]; syndrome: ClinicalSignal["syndrome"] }[] = [
  { siteId: "giofyros-1", daysAgo: [75, 74, 73, 71, 70, 6, 3], syndrome: "gastrointestinal" },
  { siteId: "giofyros-2", daysAgo: [48, 41], syndrome: "febrile" },
  { siteId: "almyros-1", daysAgo: [66, 64, 58], syndrome: "skin-rash" },
  { siteId: "almyros-1", daysAgo: [55], syndrome: "febrile" },
  { siteId: "sabato-bn", daysAgo: [47, 44], syndrome: "skin-rash" },
  { siteId: "sabato-bn", daysAgo: [39], syndrome: "febrile" },
  { siteId: "sabato-bn", daysAgo: [7], syndrome: "gastrointestinal" },
  { siteId: "akerselva-oslo", daysAgo: [32, 31], syndrome: "gastrointestinal" },
  { siteId: "alna-oslo", daysAgo: [33, 32, 30, 4], syndrome: "gastrointestinal" },
  { siteId: "coselhas-coimbra", daysAgo: [17], syndrome: "gastrointestinal" },
  { siteId: "mondego-coimbra", daysAgo: [44], syndrome: "skin-rash" },
];

export function generateSeed(now = Date.now()): { observations: StoredObservation[]; signals: StoredSignal[] } {
  const rand = mulberry32(20260928);
  const observations: StoredObservation[] = [];
  const signals: StoredSignal[] = [];
  const today = new Date(now);
  today.setUTCHours(10, 0, 0, 0);
  let n = 0;

  for (const site of SITES) {
    const p = P[site.id];
    if (!p) continue;
    const southern = site.lat < 50;

    for (let daysAgo = SEED_DAYS; daysAgo >= 1; daysAgo -= p.cadence[0] + Math.floor(rand() * (p.cadence[1] - p.cadence[0] + 1))) {
      const at = new Date(today.getTime() - daysAgo * DAY + Math.floor(rand() * 8 - 2) * 3_600_000);
      const when = at.toISOString();
      const vol = p.volunteers[Math.floor(rand() * p.volunteers.length)];
      const performer = { kind: "citizen" as const, id: vol, display: `Volunteer ${vol}` };
      const status = daysAgo > 10 ? ("final" as const) : ("preliminary" as const);
      const ep = p.episodes.find((e) => daysAgo <= e.from && daysAgo >= e.to);
      const sewageP = ep?.sewage ?? p.sewage;
      const dipteraP = ep?.diptera ?? p.diptera;
      const flows = ep?.flow ?? p.flow;
      const band = p.algaeBand + (ep?.algae ?? 0);
      // seasonal water temperature: peaks around day-of-year 215 (early August)
      const doy = Math.floor((at.getTime() - Date.UTC(at.getUTCFullYear(), 0, 0)) / DAY);
      const season = Math.cos(((doy - 215) / 365) * 2 * Math.PI);
      const temp = p.waterTemp + p.seasonalAmp * (season - 0.75) + (rand() - 0.5) * 2.5;
      const noteRoll = rand();
      const note = noteRoll < 0.3 ? p.notes[Math.floor(rand() * p.notes.length)] : undefined;

      const push = (code: StreamObservation["code"], value: ObservationValue, withNote = false) =>
        observations.push({ id: `seed-${++n}`, siteId: site.id, effective: when, code, value, performer, status, note: withNote ? note : undefined, origin: "seed" });

      const smell = rand() < sewageP;
      push("foam", coded(smell ? (rand() < 0.4 ? "extensive" : "present") : "absent"), true);
      push("hydrology", flow(flows[Math.floor(rand() * flows.length)]));
      push("filamentous-algae", coded(ALGAE[Math.min(4, Math.max(0, band + Math.round((rand() - 0.5) * 1.6)))]));
      if (southern || rand() < 0.5) push("diptera", coded(rand() < dipteraP ? "present" : "absent"));
      if (rand() < 0.8) push("waterTemperature", celsius(temp));
    }

    // monthly partner-lab E. coli, higher during sewage episodes
    for (let daysAgo = 112; daysAgo >= 5; daysAgo -= 28) {
      const lab = daysAgo === 112 - 28 * 3 ? 9 : daysAgo; // last sample 9 days ago
      const ep = p.episodes.find((e) => lab <= e.from + 2 && lab >= e.to - 2 && (e.sewage ?? 0) > 0.5);
      const val = p.ecoli * (ep ? 2.4 : 1) * (0.7 + rand() * 0.6);
      observations.push({
        id: `seed-${++n}`,
        siteId: site.id,
        effective: new Date(today.getTime() - lab * DAY).toISOString(),
        code: "coliforms",
        value: cfu(val),
        performer: { kind: "lab", id: "lab-oah", display: "OneAquaHealth partner laboratory" },
        status: "final",
        note: "E. coli, membrane filtration (ISO 9308-1)",
        origin: "seed",
      });
    }
  }

  for (const story of CLINIC_STORY) {
    const site = SITES.find((s) => s.id === story.siteId)!;
    for (const d of story.daysAgo) {
      signals.push({
        id: `seed-sig-${story.siteId}-${story.syndrome}-${d}`,
        siteId: site.id,
        district: site.district,
        date: new Date(today.getTime() - d * DAY).toISOString().slice(0, 10),
        syndrome: story.syndrome,
        source: "seed",
        origin: "seed",
      });
    }
  }
  return { observations, signals };
}
