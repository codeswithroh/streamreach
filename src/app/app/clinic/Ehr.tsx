"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Activity, Bell, ClipboardList, HeartPulse, Share2, Thermometer, Users } from "lucide-react";
import dynamic from "next/dynamic";
import { Fragment, useCallback, useEffect, useState } from "react";
import type { DemoPatient } from "@/lib/cds/demo-patients";
import type { NearStream } from "./ExposureMap";

const ExposureMap = dynamic(() => import("./ExposureMap"), { ssr: false, loading: () => <div className="h-full w-full rounded-xl bg-river-soft animate-pulse" /> });

const LEVEL_HEX: Record<string, string> = { low: "#3f8a5a", moderate: "#d4a72c", high: "#e07a2c", "very-high": "#d23b33" };
const LEVEL_LABEL: Record<string, string> = { low: "Low", moderate: "Moderate", high: "High", "very-high": "Very high" };
const AVATAR = ["#1e2a44", "#b8322a", "#2f5fb8", "#1b7049", "#6d43d8", "#9a4a16"];
const VITAL: Record<string, { label: string; icon: typeof Thermometer }> = {
  T: { label: "Temperature", icon: Thermometer },
  HR: { label: "Heart rate", icon: HeartPulse },
  BP: { label: "Blood pressure", icon: Activity },
};

type Summary = { cards: number; indicator?: Card["indicator"] };

interface Card {
  uuid: string;
  summary: string;
  detail: string;
  indicator: "info" | "warning" | "critical";
  source: { label: string; url: string };
  suggestions?: { label: string; uuid: string; actions?: { type: string; description: string; resource: any }[] }[];
  overrideReasons?: { code: string; display: string }[];
  links?: { label: string; url: string }[];
}

type Outcome = { kind: "accepted"; labels: string[] } | { kind: "overridden"; reason: string };

const age = (b: string) => Math.floor((Date.now() - new Date(b).getTime()) / (365.25 * 86_400_000));
const nameOf = (p: any) => `${p.name[0].given[0]} ${p.name[0].family}`;
const initials = (p: any) => `${p.name[0].given[0][0]}${p.name[0].family[0]}`;
const summarise = (res: any): Summary => ({
  cards: res.cards?.length ?? 0,
  indicator: res.cards?.some((c: Card) => c.indicator === "critical") ? "critical" : res.cards?.some((c: Card) => c.indicator === "warning") ? "warning" : res.cards?.length ? "info" : undefined,
});

export function Ehr({ patients, serviceId }: { patients: DemoPatient[]; serviceId: string }) {
  const [sel, setSel] = useState(patients[0].patient.id);
  const [cards, setCards] = useState<Card[]>();
  const [error, setError] = useState<string>();
  const [req, setReq] = useState<any>();
  const [res, setRes] = useState<any>();
  const [ms, setMs] = useState<number>();
  const [tab, setTab] = useState<"cards" | "request" | "response">("cards");
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [orders, setOrders] = useState<string[]>([]);
  const [toast, setToast] = useState<string>();
  const current = patients.find((p) => p.patient.id === sel)!;

  const [summaries, setSummaries] = useState<Record<string, Summary>>({});
  const [shared, setShared] = useState(0);

  const fire = useCallback(
    (p: DemoPatient) =>
      runHook(p, serviceId)
        .then(({ body, res, ms }) => {
          setMs(ms);
          setReq(body);
          setRes(res);
          setCards(res.cards ?? []);
          setSummaries((s) => ({ ...s, [p.patient.id]: summarise(res) }));
        })
        .catch((e: Error) => setError(e.message)),
    [serviceId],
  );

  useEffect(() => {
    fire(patients[0]);
    // triage the rest of today's list in the background, for the badges and totals
    for (const p of patients.slice(1))
      runHook(p, serviceId)
        .then(({ res }) => setSummaries((s) => ({ ...s, [p.patient.id]: summarise(res) })))
        .catch(() => {});
  }, [patients, fire, serviceId]);

  function select(p: DemoPatient) {
    setSel(p.patient.id);
    setCards(undefined);
    setError(undefined);
    setOutcomes({});
    setOrders([]);
    fire(p);
  }

  async function feedback(card: Card, outcome: "accepted" | "overridden", opts: { suggestionIds?: string[]; reason?: { code: string; display: string } }) {
    const body = {
      feedback: [
        {
          card: card.uuid,
          outcome,
          ...(opts.suggestionIds ? { acceptedSuggestions: opts.suggestionIds.map((id) => ({ id })) } : {}),
          ...(opts.reason ? { overrideReason: { reason: { code: opts.reason.code, display: opts.reason.display } } } : {}),
          outcomeTimestamp: new Date().toISOString(),
        },
      ],
    };
    const r = await fetch(`/cds-services/${serviceId}/feedback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return r.json();
  }

  async function accept(card: Card, s: NonNullable<Card["suggestions"]>[number]) {
    const r = await feedback(card, "accepted", { suggestionIds: [s.uuid] });
    for (const a of s.actions ?? []) if (a.type === "create") setOrders((o) => [...o, a.resource.code?.coding?.[0]?.display ?? a.description]);
    setOutcomes((o) => {
      const prev = o[card.uuid];
      const labels = prev?.kind === "accepted" ? [...prev.labels, s.label] : [s.label];
      return { ...o, [card.uuid]: { kind: "accepted", labels } };
    });
    if (r.recorded) setShared((n) => n + 1);
    if (r.recorded) setToast("Anonymous case shared. The stream's waterborne score now includes it. Open the stream record to see the clinic signal.");
    else if (s.actions?.length) setToast(`${s.actions[0].description} added to the chart as a draft.`);
  }

  async function override(card: Card, reason: { code: string; display: string }) {
    await feedback(card, "overridden", { reason });
    setOutcomes((o) => ({ ...o, [card.uuid]: { kind: "overridden", reason: reason.display } }));
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const flagged = Object.values(summaries).filter((x) => x.cards > 0).length;
  const totalCards = Object.values(summaries).reduce((n, x) => n + x.cards, 0);
  const addr = (current.patient.address as any)[0];
  const meta = res?._meta;
  const near: NearStream[] = (meta?.streams ?? []).map((x: any) => ({
    id: x.id,
    name: x.name,
    lat: x.lat,
    lon: x.lon,
    km: x.km,
    color: LEVEL_HEX[x.level],
    label: LEVEL_LABEL[x.level],
  }));
  const vitals = current.vitals.split(" · ").map((v) => {
    const [k, ...rest] = v.split(" ");
    return { key: k, value: rest.join(" "), ...(VITAL[k] ?? { label: k, icon: Activity }) };
  });

  return (
    <div className="mt-6 space-y-4">
      {/* totals */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(
          [
            ["Patients today", patients.length, Users, "bg-river-soft text-river"],
            ["With a stream alert", flagged, Bell, "bg-accent-soft text-accent"],
            ["Cards shown", totalCards, ClipboardList, "bg-amber-50 text-amber-700"],
            ["Cases shared", shared, Share2, "bg-emerald-50 text-emerald-700"],
          ] as const
        ).map(([label, value, Icon, tone]) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <span className={`grid place-items-center w-10 h-10 rounded-xl ${tone}`}>
              <Icon size={18} />
            </span>
            <div>
              <p className="text-[11px] text-ink-3">{label}</p>
              <p className="text-xl font-semibold tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_420px] gap-4 items-start">
        <aside className="card p-2" aria-label="Today's list">
          <p className="text-sm font-semibold px-2 pt-2 pb-2">Today&apos;s list</p>
          {patients.map((p, i) => {
            const sm = summaries[p.patient.id];
            return (
              <button
                key={p.patient.id}
                onClick={() => select(p)}
                aria-current={sel === p.patient.id}
                className={`w-full flex items-center gap-3 text-left px-2.5 py-2.5 rounded-xl ${sel === p.patient.id ? "bg-river-soft" : "hover:bg-black/[0.03]"}`}
              >
                <span className="grid place-items-center w-9 h-9 rounded-full text-white text-xs font-semibold shrink-0" style={{ background: AVATAR[i % AVATAR.length] }} aria-hidden>
                  {initials(p.patient)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium truncate">{nameOf(p.patient)}</span>
                  <span className="block text-[11px] text-ink-3 truncate">
                    {age(p.patient.birthDate as string)} y · {(p.patient.address as any)[0].city}
                  </span>
                </span>
                {sm && (
                  <span
                    className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${sm.indicator === "warning" || sm.indicator === "critical" ? "bg-accent-soft text-accent" : sm.cards ? "bg-sky-50 text-sky-800" : "bg-emerald-50 text-emerald-800"}`}
                  >
                    {sm.cards ? `${sm.cards} alert${sm.cards > 1 ? "s" : ""}` : "clear"}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* chart */}
        <section className="space-y-4 min-w-0" aria-label="Patient chart">
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <span className="grid place-items-center w-12 h-12 rounded-full text-white font-semibold" style={{ background: AVATAR[patients.indexOf(current) % AVATAR.length] }} aria-hidden>
              {initials(current.patient)}
            </span>
            <div className="min-w-0" data-testid="chart-header">
              <p className="text-lg font-semibold leading-tight">{nameOf(current.patient)}</p>
              <p className="text-xs text-ink-3 capitalize">
                {current.patient.gender as string} · {age(current.patient.birthDate as string)} y · {addr.city}
              </p>
            </div>
            <span className="ml-auto text-[11px] text-ink-3 font-mono">MRN {current.patient.id.toUpperCase().slice(0, 8)}</span>
            <p className="w-full text-sm text-ink-2 border-t border-line pt-3">{current.reason}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {vitals.map((v) => (
              <div key={v.key} className="card p-3">
                <v.icon size={16} className="text-accent" aria-hidden />
                <p className="text-[11px] text-ink-3 mt-1.5">{v.label}</p>
                <p className="text-base font-semibold tabular-nums">{v.value}</p>
              </div>
            ))}
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">Stream exposure</p>
              <span className="text-[11px] text-ink-3 truncate">{meta ? `${near.length} stream${near.length === 1 ? "" : "s"} within 5 km of home` : ""}</span>
            </div>
            <div className="mt-3 grid sm:grid-cols-[minmax(0,1fr)_200px] gap-3">
              <div className="h-56 relative z-0">
                {addr.extension?.[0] ? (
                  <ExposureMap key={current.patient.id} lat={addr.extension[0].extension[0].valueDecimal} lon={addr.extension[0].extension[1].valueDecimal} streams={near} />
                ) : (
                  <div className="h-full rounded-xl bg-river-soft grid place-items-center text-xs text-ink-3">No geocoded address</div>
                )}
              </div>
              <ul className="space-y-2">
                {near.slice(0, 3).map((x) => (
                  <li key={x.id} className="rounded-xl border border-line p-2.5">
                    <p className="text-xs font-medium truncate">{x.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[11px] text-ink-3 tabular-nums">{x.km != null ? `${x.km} km` : "same city"}</span>
                      <span className="text-[10px] font-semibold rounded-full px-2 py-0.5 text-white" style={{ background: x.color }}>
                        {x.label}
                      </span>
                    </div>
                  </li>
                ))}
                {meta && near.length === 0 && <li className="text-xs text-ink-3">No monitored stream nearby.</li>}
              </ul>
            </div>
          </div>

          <div className="card p-4 grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-semibold">Problems</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {current.conditions.length === 0 && <span className="text-xs text-ink-3">None recorded</span>}
                {current.conditions.map((c: any) => (
                  <span key={c.id} title={`SNOMED ${c.code.coding[0].code} · since ${c.onsetDateTime}`} className="text-xs rounded-full bg-river-soft text-river px-2.5 py-1">
                    {c.code.text}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold">Orders</p>
              {orders.length === 0 ? (
                <p className="mt-2 text-xs text-ink-3">None yet</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {orders.map((o, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] font-semibold uppercase bg-amber-100 text-amber-900 px-1.5 rounded">draft</span>
                      {o}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* CDS panel */}
        <section className="card lg:col-span-2 xl:col-span-1" aria-label="CDS Hooks">
          <div className="flex items-center gap-1 border-b border-line px-3 pt-2">
            {(["cards", "request", "response"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`text-xs px-3 py-2 -mb-px border-b-2 ${tab === t ? "border-accent text-ink font-medium" : "border-transparent text-ink-3"}`}>
                {t === "cards" ? `CDS cards${cards ? ` (${cards.length})` : ""}` : t === "request" ? "Hook request" : "Service response"}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-ink-3 tabular-nums">{ms != null ? `${ms} ms` : ""}</span>
          </div>
          <div className="p-4">
            {tab === "cards" && (
              <div className="space-y-3">
                {error && (
                  <div role="alert" className="text-sm rounded-lg border border-red-200 bg-red-50 text-red-900 p-4">
                    The CDS service didn&apos;t answer ({error}). The EHR carries on without cards.{" "}
                    <button onClick={() => select(current)} className="underline">Retry</button>
                  </div>
                )}
                {!cards && !error && <div className="h-24 rounded-lg bg-line/40 animate-pulse" />}
                {cards?.length === 0 && (
                  <div className="text-sm text-ink-3 rounded-xl border border-dashed border-line p-4 text-center">
                    Nothing relevant near this patient, so StreamReach stays quiet.
                  </div>
                )}
                {cards?.map((c) => (
                  <CdsCard key={c.uuid} card={c} outcome={outcomes[c.uuid]} onAccept={(s) => accept(c, s)} onOverride={(r) => override(c, r)} />
                ))}
              </div>
            )}
            {tab !== "cards" && (
              <pre tabIndex={0} className="json max-h-[560px] overflow-auto rounded-lg bg-ink text-emerald-100 p-3">{JSON.stringify(tab === "request" ? req : res, null, 2)}</pre>
            )}
          </div>
        </section>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] max-w-lg rounded-xl bg-ink text-white text-sm px-4 py-3 shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

async function runHook(p: DemoPatient, serviceId: string) {
  const body = {
    hook: "patient-view",
    hookInstance: crypto.randomUUID(),
    context: { userId: "Practitioner/dr-demo", patientId: p.patient.id },
    prefetch: {
      patient: p.patient,
      conditions: { resourceType: "Bundle", type: "searchset", entry: p.conditions.map((resource) => ({ resource })) },
    },
  };
  const t0 = performance.now();
  const r = await fetch(`/cds-services/${serviceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const res = await r.json();
  return { body, res, ms: Math.round(performance.now() - t0) };
}

function CdsCard({ card, outcome, onAccept, onOverride }: { card: Card; outcome?: Outcome; onAccept: (s: NonNullable<Card["suggestions"]>[number]) => void; onOverride: (r: { code: string; display: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [overriding, setOverriding] = useState(false);
  const accepted = outcome?.kind === "accepted" ? outcome.labels : [];
  const head = card.detail.match(/^\*\*(.+?)\*\*.*?\*\*(.+?)\*\* \((\d+%)\)/);
  const tone = card.indicator === "warning" ? "border-l-lvl-high bg-orange-50/60" : card.indicator === "critical" ? "border-l-lvl-very-high bg-red-50/60" : "border-l-sky-500 bg-sky-50/50";
  return (
    <article className={`rounded-lg border border-line border-l-4 ${tone} p-3`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${card.indicator === "warning" ? "bg-orange-700 text-white" : "bg-sky-700 text-white"}`}>{card.indicator}</span>
        <p className="text-sm font-semibold leading-snug flex-1">{card.summary}</p>
        <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-ink-3 hover:text-ink whitespace-nowrap" aria-expanded={open}>{open ? "Less" : "Why"}</button>
      </div>
      {head && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">{head[1]}</span>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: LEVEL_HEX[head[2].toLowerCase().replace(" ", "-")] ?? "#5b6472" }}>
            {head[2]} · {head[3]}
          </span>
        </p>
      )}
      {open && <div className="mt-2 text-[13px] text-ink-2 space-y-1"><Markdown text={card.detail} /></div>}
      <p className="text-[11px] text-ink-3 mt-2">
        Source: <a href={card.source.url} target="_blank" className="underline">{card.source.label}</a>
      </p>
      {outcome?.kind === "overridden" ? (
        <p className="text-xs mt-3 text-ink-3">Dismissed: {outcome.reason}. Feedback sent.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mt-3">
          {card.suggestions?.map((s) => {
            const done = accepted.includes(s.label);
            return (
              <button key={s.uuid} disabled={done} onClick={() => onAccept(s)} className={`text-xs rounded-md px-2.5 py-1.5 border ${done ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-river text-river hover:bg-river hover:text-white"}`}>
                {done ? "✓ " : ""}
                {s.label}
              </button>
            );
          })}
          {card.links?.map((l) => (
            <a key={l.url} href={l.url} target="_blank" className="text-xs rounded-md px-2.5 py-1.5 border border-line bg-white hover:border-ink-3">
              {l.label} ↗
            </a>
          ))}
          {card.overrideReasons && !overriding && (
            <button onClick={() => setOverriding(true)} className="text-xs text-ink-3 hover:text-ink ml-auto">Dismiss…</button>
          )}
          {overriding && (
            <div className="w-full flex flex-wrap gap-1.5 pt-1">
              {card.overrideReasons?.map((r) => (
                <button key={r.code} onClick={() => onOverride(r)} className="text-[11px] rounded-md px-2 py-1 border border-line bg-white hover:border-ink-3">
                  {r.display}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/** Tiny renderer for the CommonMark subset our cards use (bold, italics, bullets). */
function Markdown({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
      part.startsWith("**") ? <strong key={i} className="text-ink">{part.slice(2, -2)}</strong> : part.startsWith("_") && part.endsWith("_") && part.length > 2 ? <em key={i} className="text-ink-3 text-[12px]">{part.slice(1, -1)}</em> : <Fragment key={i}>{part}</Fragment>,
    );
  const blocks = text.split("\n");
  return (
    <>
      {blocks.map((l, i) =>
        l.startsWith("- ") ? (
          <p key={i} className="pl-3 relative before:content-['•'] before:absolute before:left-0 before:text-ink-3">{inline(l.slice(2))}</p>
        ) : l.trim() ? (
          <p key={i}>{inline(l)}</p>
        ) : null,
      )}
    </>
  );
}
