"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment, useCallback, useEffect, useState } from "react";
import type { DemoPatient } from "@/lib/cds/demo-patients";

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

export function Ehr({ patients, serviceId }: { patients: DemoPatient[]; serviceId: string }) {
  const [sel, setSel] = useState(patients[0].patient.id);
  const [cards, setCards] = useState<Card[]>();
  const [req, setReq] = useState<any>();
  const [res, setRes] = useState<any>();
  const [ms, setMs] = useState<number>();
  const [tab, setTab] = useState<"cards" | "request" | "response">("cards");
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [orders, setOrders] = useState<string[]>([]);
  const [toast, setToast] = useState<string>();
  const current = patients.find((p) => p.patient.id === sel)!;

  const fire = useCallback(
    (p: DemoPatient) =>
      runHook(p, serviceId).then(({ body, res, ms }) => {
        setMs(ms);
        setReq(body);
        setRes(res);
        setCards(res.cards ?? []);
      }),
    [serviceId],
  );

  useEffect(() => {
    fire(patients[0]);
  }, [patients, fire]);

  function select(p: DemoPatient) {
    setSel(p.patient.id);
    setCards(undefined);
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

  return (
    <div className="mt-8 grid lg:grid-cols-[230px_1fr] gap-5">
      <aside className="card p-2 h-fit">
        <p className="eyebrow px-2 pt-2 pb-1">Today&apos;s list</p>
        {patients.map((p) => (
          <button
            key={p.patient.id}
            onClick={() => select(p)}
            className={`w-full text-left px-3 py-2.5 rounded-lg ${sel === p.patient.id ? "bg-river-soft" : "hover:bg-black/[0.03]"}`}
          >
            <span className="block text-sm font-medium">{nameOf(p.patient)}</span>
            <span className="block text-xs text-ink-3">
              {age(p.patient.birthDate as string)} y · {(p.patient.address as any)[0].city}
            </span>
          </button>
        ))}
      </aside>

      <div className="grid xl:grid-cols-[1fr_440px] gap-5 min-w-0">
        {/* chart */}
        <section className="card overflow-hidden h-fit">
          <div className="bg-stone-800 text-stone-100 px-5 py-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-lg font-semibold">{nameOf(current.patient)}</span>
            <span className="text-sm text-stone-300">
              {current.patient.gender as string}, {age(current.patient.birthDate as string)} y · DOB {current.patient.birthDate as string}
            </span>
            <span className="text-xs text-stone-400 ml-auto">MRN {current.patient.id.toUpperCase().slice(0, 8)}</span>
          </div>
          <div className="p-5 grid sm:grid-cols-2 gap-5 text-sm">
            <div>
              <p className="eyebrow">Reason for visit</p>
              <p className="mt-1">{current.reason}</p>
            </div>
            <div>
              <p className="eyebrow">Vitals</p>
              <p className="mt-1 tabular-nums">{current.vitals}</p>
            </div>
            <div>
              <p className="eyebrow">Problems (active)</p>
              <ul className="mt-1 space-y-0.5">
                {current.conditions.length === 0 && <li className="text-ink-3">None recorded</li>}
                {current.conditions.map((c: any) => (
                  <li key={c.id}>
                    {c.code.text} <span className="text-[11px] text-ink-3">SNOMED {c.code.coding[0].code} · since {c.onsetDateTime}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow">Address</p>
              <p className="mt-1">
                {(current.patient.address as any)[0].line[0]}, {(current.patient.address as any)[0].city}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="eyebrow">Orders (this visit)</p>
              {orders.length === 0 ? (
                <p className="mt-1 text-ink-3">None yet</p>
              ) : (
                <ul className="mt-1 space-y-1">
                  {orders.map((o, i) => (
                    <li key={i} className="flex items-center gap-2">
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
        <section className="card h-fit">
          <div className="flex items-center gap-1 border-b border-line px-3 pt-2">
            {(["cards", "request", "response"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`text-xs px-3 py-2 -mb-px border-b-2 ${tab === t ? "border-river text-ink font-medium" : "border-transparent text-ink-3"}`}>
                {t === "cards" ? `CDS cards${cards ? ` (${cards.length})` : ""}` : t === "request" ? "Hook request" : "Service response"}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-ink-3 tabular-nums">{ms != null ? `${ms} ms` : ""}</span>
          </div>
          <div className="p-4">
            {tab === "cards" && (
              <div className="space-y-3">
                {!cards && <div className="h-24 rounded-lg bg-line/40 animate-pulse" />}
                {cards?.length === 0 && (
                  <div className="text-sm text-ink-3 rounded-lg border border-dashed border-line p-4">
                    No cards. Nothing relevant near this patient, so Tributary stays quiet. Avoiding alert fatigue is part of the design.
                    {res?._meta && (
                      <span className="block text-[11px] mt-1">
                        Located: {res._meta.location.label} · {res._meta.sitesConsidered} reach(es) considered
                      </span>
                    )}
                  </div>
                )}
                {cards?.map((c) => (
                  <CdsCard key={c.uuid} card={c} outcome={outcomes[c.uuid]} onAccept={(s) => accept(c, s)} onOverride={(r) => override(c, r)} />
                ))}
              </div>
            )}
            {tab !== "cards" && (
              <pre className="json max-h-[560px] overflow-auto rounded-lg bg-ink text-emerald-100 p-3">{JSON.stringify(tab === "request" ? req : res, null, 2)}</pre>
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
  const res = await r.json();
  return { body, res, ms: Math.round(performance.now() - t0) };
}

function CdsCard({ card, outcome, onAccept, onOverride }: { card: Card; outcome?: Outcome; onAccept: (s: NonNullable<Card["suggestions"]>[number]) => void; onOverride: (r: { code: string; display: string }) => void }) {
  const [open, setOpen] = useState(true);
  const [overriding, setOverriding] = useState(false);
  const accepted = outcome?.kind === "accepted" ? outcome.labels : [];
  const tone = card.indicator === "warning" ? "border-l-lvl-high bg-orange-50/60" : card.indicator === "critical" ? "border-l-lvl-very-high bg-red-50/60" : "border-l-sky-500 bg-sky-50/50";
  return (
    <article className={`rounded-lg border border-line border-l-4 ${tone} p-3`}>
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${card.indicator === "warning" ? "bg-lvl-high text-white" : "bg-sky-600 text-white"}`}>{card.indicator}</span>
        <p className="text-sm font-semibold leading-snug flex-1">{card.summary}</p>
        <button onClick={() => setOpen((v) => !v)} className="text-xs text-ink-3" aria-expanded={open}>{open ? "−" : "+"}</button>
      </div>
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
