// Data store. With DATABASE_URL set (Neon Postgres, provisioned through the
// Vercel Marketplace in the same region as the functions) every citizen check,
// clinic signal and CDS card survives restarts and is shared across serverless
// instances. Without it (local dev, tests) the same API runs in memory.
//
// Demo rows (origin = "seed") are regenerated once per day relative to today,
// so the record never goes stale. Rows added through the app (origin = "user")
// are never touched by a reseed.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { generateSeed, type StoredObservation, type StoredSignal } from "./seed";
import type { ClinicalSignal, HazardId, StreamObservation } from "./types";

export { celsius, cfu, coded, flow } from "./seed";

export interface Snapshot {
  observations: StoredObservation[];
  signals: StoredSignal[];
}

export interface CardMeta {
  siteId: string;
  district: string;
  hazard: HazardId;
  syndrome?: ClinicalSignal["syndrome"];
}

export interface StoredPlan {
  id: string;
  siteId: string;
  status: "draft" | "approved" | "discarded";
  /** ResponsePlan (src/lib/agent/plan.ts) */
  plan: unknown;
  /** the agent's tool calls and notes, for the audit trail */
  trace: unknown;
  model: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

interface Backend {
  kind: "postgres" | "memory";
  /** Changes whenever any instance writes; lets every instance keep a cache that is never stale. */
  version(): Promise<string>;
  load(): Promise<Snapshot>;
  insertObservations(rows: StoredObservation[]): Promise<void>;
  insertSignal(row: StoredSignal): Promise<void>;
  setStatus(id: string, status: StreamObservation["status"]): Promise<boolean>;
  putCard(uuid: string, meta: CardMeta): Promise<void>;
  takeCard(uuid: string): Promise<CardMeta | undefined>;
  savePlan(p: StoredPlan): Promise<void>;
  getPlan(id: string): Promise<StoredPlan | undefined>;
  listPlans(siteId?: string): Promise<StoredPlan[]>;
  /** draft -> approved | discarded; returns undefined if the plan is not a pending draft */
  decidePlan(id: string, status: "approved" | "discarded", by: string): Promise<StoredPlan | undefined>;
  /** increments and returns today's agent-run counter */
  countAgentRun(day: string): Promise<number>;
}

const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ memory

function memoryBackend(): Backend {
  let seededFor = "";
  let snap: Snapshot = { observations: [], signals: [] };
  const cards = new Map<string, CardMeta>();
  const plans = new Map<string, StoredPlan>();
  const runs = new Map<string, number>();
  let ver = 0;
  const ensure = () => {
    if (seededFor === today()) return;
    const seed = generateSeed();
    snap = {
      observations: [...seed.observations, ...snap.observations.filter((o) => o.origin === "user")],
      signals: [...seed.signals, ...snap.signals.filter((s) => s.origin === "user")],
    };
    seededFor = today();
    ver++;
  };
  return {
    kind: "memory",
    async version() {
      ensure();
      return String(ver);
    },
    async load() {
      ensure();
      return snap;
    },
    async insertObservations(rows) {
      ensure();
      snap.observations.push(...rows);
      ver++;
    },
    async insertSignal(row) {
      ensure();
      snap.signals.push(row);
      ver++;
    },
    async setStatus(id, status) {
      const o = snap.observations.find((x) => x.id === id);
      if (o) o.status = status;
      ver++;
      return !!o;
    },
    async putCard(uuid, meta) {
      cards.set(uuid, meta);
    },
    async takeCard(uuid) {
      const m = cards.get(uuid);
      cards.delete(uuid);
      return m;
    },
    async savePlan(p) {
      plans.set(p.id, structuredClone(p));
    },
    async getPlan(id) {
      const p = plans.get(id);
      return p && structuredClone(p);
    },
    async listPlans(siteId) {
      return [...plans.values()]
        .filter((p) => !siteId || p.siteId === siteId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 50)
        .map((p) => structuredClone(p));
    },
    async decidePlan(id, status, by) {
      const p = plans.get(id);
      if (!p || p.status !== "draft") return undefined;
      Object.assign(p, { status, decidedBy: by, decidedAt: new Date().toISOString() });
      return structuredClone(p);
    },
    async countAgentRun(day) {
      const n = (runs.get(day) ?? 0) + 1;
      runs.set(day, n);
      return n;
    },
  };
}

// ---------------------------------------------------------------- postgres

const SCHEMA = [
  `create table if not exists observations (
     id text primary key, site_id text not null, effective timestamptz not null, code text not null,
     value jsonb not null, performer jsonb not null, status text not null, note text,
     origin text not null default 'user', created_at timestamptz not null default now())`,
  `create index if not exists observations_site on observations (site_id, effective desc)`,
  `create table if not exists signals (
     id text primary key, site_id text not null, district text not null, date date not null,
     syndrome text not null, source text not null, origin text not null default 'user',
     created_at timestamptz not null default now())`,
  `create table if not exists cds_cards (uuid text primary key, meta jsonb not null, created_at timestamptz not null default now())`,
  `create table if not exists kv (key text primary key, value text not null)`,
  `insert into kv (key, value) values ('seed_date', '') on conflict do nothing`,
  `insert into kv (key, value) values ('version', '0') on conflict do nothing`,
  `create table if not exists agent_plans (
     id text primary key, site_id text not null, status text not null, plan jsonb not null, trace jsonb not null,
     model text not null, created_at timestamptz not null default now(), decided_at timestamptz, decided_by text)`,
  `create index if not exists agent_plans_site on agent_plans (site_id, created_at desc)`,
];

type PlanRow = {
  id: string;
  site_id: string;
  status: StoredPlan["status"];
  plan: unknown;
  trace: unknown;
  model: string;
  created_at: string | Date;
  decided_at: string | Date | null;
  decided_by: string | null;
};
const planFromRow = (r: PlanRow): StoredPlan => ({
  id: r.id,
  siteId: r.site_id,
  status: r.status,
  plan: r.plan,
  trace: r.trace,
  model: r.model,
  createdAt: new Date(r.created_at).toISOString(),
  ...(r.decided_at ? { decidedAt: new Date(r.decided_at).toISOString() } : {}),
  ...(r.decided_by ? { decidedBy: r.decided_by } : {}),
});

const BUMP = `update kv set value = (value::bigint + 1)::text where key = 'version'`;

type ObsRow = {
  id: string;
  site_id: string;
  effective: string | Date;
  code: StreamObservation["code"];
  value: StreamObservation["value"];
  performer: StreamObservation["performer"];
  status: StreamObservation["status"];
  note: string | null;
  origin: "seed" | "user";
};
type SigRow = {
  id: string;
  site_id: string;
  district: string;
  date: string | Date;
  syndrome: ClinicalSignal["syndrome"];
  source: ClinicalSignal["source"];
  origin: "seed" | "user";
};

const iso = (d: string | Date) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const day = (d: string | Date) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));

const obsJson = (rows: StoredObservation[]) =>
  JSON.stringify(
    rows.map((o) => ({
      id: o.id,
      site_id: o.siteId,
      effective: o.effective,
      code: o.code,
      value: o.value,
      performer: o.performer,
      status: o.status,
      note: o.note ?? null,
      origin: o.origin,
    })),
  );
const sigJson = (rows: StoredSignal[]) => JSON.stringify(rows.map((s) => ({ ...s, site_id: s.siteId })));

const INSERT_OBS = `insert into observations (id, site_id, effective, code, value, performer, status, note, origin)
  select id, site_id, effective, code, value, performer, status, note, origin
  from json_to_recordset($1::json) as x(id text, site_id text, effective timestamptz, code text, value jsonb,
    performer jsonb, status text, note text, origin text)
  on conflict (id) do nothing`;

const INSERT_SIG = `insert into signals (id, site_id, district, date, syndrome, source, origin)
  select id, site_id, district, date, syndrome, source, origin
  from json_to_recordset($1::json) as x(id text, site_id text, district text, date date, syndrome text, source text, origin text)
  on conflict (id) do nothing`;

function postgresBackend(url: string): Backend {
  const sql: NeonQueryFunction<false, false> = neon(url);
  let ready: Promise<void> | undefined;
  let checkedSeedFor = "";

  const init = () =>
    (ready ??= (async () => {
      for (const s of SCHEMA) await sql.query(s);
    })().catch((e) => {
      ready = undefined;
      throw e;
    }));

  /** Refresh demo rows once per day. The conditional UPDATE lets exactly one instance win. */
  async function reseedIfStale() {
    const t = today();
    if (checkedSeedFor === t) return;
    const claimed = await sql.query(`update kv set value = $1 where key = 'seed_date' and value <> $1 returning 1`, [t]);
    if (claimed.length) {
      const seed = generateSeed();
      await sql.transaction([
        sql.query(`delete from observations where origin = 'seed'`),
        sql.query(`delete from signals where origin = 'seed'`),
        sql.query(INSERT_OBS, [obsJson(seed.observations)]),
        sql.query(INSERT_SIG, [sigJson(seed.signals)]),
        sql.query(BUMP),
      ]);
    }
    checkedSeedFor = t;
  }

  return {
    kind: "postgres",
    async version() {
      await init();
      await reseedIfStale();
      const r = (await sql.query(`select value from kv where key = 'version'`)) as { value: string }[];
      return r[0]?.value ?? "0";
    },
    async load() {
      await init();
      await reseedIfStale();
      const [obs, sig] = (await Promise.all([
        sql.query(`select id, site_id, effective, code, value, performer, status, note, origin from observations`),
        sql.query(`select id, site_id, district, date, syndrome, source, origin from signals`),
      ])) as [ObsRow[], SigRow[]];
      return {
        observations: obs.map((r) => ({
          id: r.id,
          siteId: r.site_id,
          effective: iso(r.effective),
          code: r.code,
          value: r.value,
          performer: r.performer,
          status: r.status,
          note: r.note ?? undefined,
          origin: r.origin,
        })),
        signals: sig.map((r) => ({
          id: r.id,
          siteId: r.site_id,
          district: r.district,
          date: day(r.date),
          syndrome: r.syndrome,
          source: r.source,
          origin: r.origin,
        })),
      };
    },
    async insertObservations(rows) {
      await init();
      await sql.transaction([sql.query(INSERT_OBS, [obsJson(rows)]), sql.query(BUMP)]);
    },
    async insertSignal(row) {
      await init();
      await sql.transaction([sql.query(INSERT_SIG, [sigJson([row])]), sql.query(BUMP)]);
    },
    async setStatus(id, status) {
      await init();
      const [r] = await sql.transaction([
        sql.query(`update observations set status = $2 where id = $1 returning 1`, [id, status]),
        sql.query(BUMP),
      ]);
      return r.length > 0;
    },
    async putCard(uuid, meta) {
      await init();
      await sql.query(`insert into cds_cards (uuid, meta) values ($1, $2::jsonb) on conflict do nothing`, [uuid, JSON.stringify(meta)]);
      // cards only matter for feedback within a few days; prune occasionally
      if (Math.random() < 0.05) await sql.query(`delete from cds_cards where created_at < now() - interval '7 days'`);
    },
    async takeCard(uuid) {
      await init();
      const r = (await sql.query(`delete from cds_cards where uuid = $1 returning meta`, [uuid])) as { meta: CardMeta }[];
      return r[0]?.meta;
    },
    async savePlan(p) {
      await init();
      await sql.query(
        `insert into agent_plans (id, site_id, status, plan, trace, model, created_at) values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)`,
        [p.id, p.siteId, p.status, JSON.stringify(p.plan), JSON.stringify(p.trace), p.model, p.createdAt],
      );
    },
    async getPlan(id) {
      await init();
      const r = (await sql.query(`select * from agent_plans where id = $1`, [id])) as PlanRow[];
      return r[0] && planFromRow(r[0]);
    },
    async listPlans(siteId) {
      await init();
      const r = (await (siteId
        ? sql.query(`select * from agent_plans where site_id = $1 order by created_at desc limit 50`, [siteId])
        : sql.query(`select * from agent_plans order by created_at desc limit 50`))) as PlanRow[];
      return r.map(planFromRow);
    },
    async decidePlan(id, status, by) {
      await init();
      const r = (await sql.query(
        `update agent_plans set status = $2, decided_by = $3, decided_at = now() where id = $1 and status = 'draft' returning *`,
        [id, status, by],
      )) as PlanRow[];
      return r[0] && planFromRow(r[0]);
    },
    async countAgentRun(day) {
      await init();
      const r = (await sql.query(
        `insert into kv (key, value) values ($1, '1') on conflict (key) do update set value = (kv.value::int + 1)::text returning value`,
        [`agent_runs:${day}`],
      )) as { value: string }[];
      return Number(r[0].value);
    },
  };
}

// ------------------------------------------------------------------ facade

const g = globalThis as unknown as {
  __srBackendV2?: Backend;
  __srCache?: { version: string; snap: Promise<Snapshot> };
  __srVersion?: { at: number; v: Promise<string> };
};

function backend(): Backend {
  if (!g.__srBackendV2) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    g.__srBackendV2 = url ? postgresBackend(url) : memoryBackend();
  }
  return g.__srBackendV2;
}

export function storeKind() {
  return backend().kind;
}

/** One version lookup serves all reads within a single render (they arrive within milliseconds). */
function currentVersion(): Promise<string> {
  const c = g.__srVersion;
  if (c && Date.now() - c.at < 250) return c.v;
  const v = backend().version();
  g.__srVersion = { at: Date.now(), v };
  v.catch(() => (g.__srVersion = undefined));
  return v;
}

/** Current data. Cached per instance and reloaded as soon as any instance has written. */
export async function snapshot(): Promise<Snapshot> {
  const v = await currentVersion();
  const c = g.__srCache;
  if (c && c.version === v) return c.snap;
  const snap = backend().load();
  g.__srCache = { version: v, snap };
  snap.catch(() => (g.__srCache = undefined));
  return snap;
}

function invalidate() {
  g.__srCache = undefined;
  g.__srVersion = undefined;
}

/** Tests only: fresh in-memory store. */
export function resetStore() {
  g.__srBackendV2 = memoryBackend();
  invalidate();
}

export async function observationsFor(siteId: string): Promise<StoredObservation[]> {
  const s = await snapshot();
  return s.observations.filter((o) => o.siteId === siteId).sort((a, b) => b.effective.localeCompare(a.effective));
}

export async function signalsFor(siteId: string): Promise<StoredSignal[]> {
  const s = await snapshot();
  return s.signals.filter((x) => x.siteId === siteId);
}

export async function addObservations(obs: Omit<StreamObservation, "id">[]): Promise<StoredObservation[]> {
  const created = obs.map((o) => ({ ...o, id: `obs-${crypto.randomUUID().slice(0, 8)}`, origin: "user" as const }));
  await backend().insertObservations(created);
  invalidate();
  return created;
}

export async function addSignal(sig: Omit<ClinicalSignal, "id">): Promise<StoredSignal> {
  const created = { ...sig, id: `sig-${crypto.randomUUID().slice(0, 8)}`, origin: "user" as const };
  await backend().insertSignal(created);
  invalidate();
  return created;
}

/** Coordinator review: verify (final) or send back to pending (preliminary). */
export async function setObservationStatus(ids: string[], status: StreamObservation["status"]) {
  let n = 0;
  for (const id of ids) if (await backend().setStatus(id, status)) n++;
  invalidate();
  return n;
}

export const putCard = (uuid: string, meta: CardMeta) => backend().putCard(uuid, meta);
export const takeCard = (uuid: string) => backend().takeCard(uuid);

/** Distinct citizen checks and clinic signals in the last 14 days. */
export async function recentStats(now = Date.now()) {
  const s = await snapshot();
  const since = now - 14 * 86_400_000;
  const checks = new Set(
    s.observations
      .filter((o) => o.performer.kind === "citizen" && new Date(o.effective).getTime() > since)
      .map((o) => `${o.siteId}${o.effective}`),
  ).size;
  const clinic = s.signals.filter((x) => new Date(x.date).getTime() > since).length;
  return { checks, clinic };
}

export const savePlan = (p: StoredPlan) => backend().savePlan(p);
export const getPlan = (id: string) => backend().getPlan(id);
export const listPlans = (siteId?: string) => backend().listPlans(siteId);
export const decidePlan = (id: string, status: "approved" | "discarded", by: string) => backend().decidePlan(id, status, by);
export const countAgentRun = (day = new Date().toISOString().slice(0, 10)) => backend().countAgentRun(day);
