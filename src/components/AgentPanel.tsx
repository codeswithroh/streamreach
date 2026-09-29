"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ResponsePlan } from "@/lib/agent/plan";

type Ev =
  | { type: "start"; model: string; mode: "live" | "mock" }
  | { type: "note"; text: string }
  | { type: "tool"; id: string; name: string; label: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; summary: string; isError?: boolean }
  | { type: "plan"; plan: ResponsePlan }
  | { type: "error"; message: string }
  | { type: "saved"; planId: string; reused: boolean; createdAt: string; status: "draft" | "approved" | "discarded" };

interface Step {
  id: string;
  label: string;
  summary?: string;
  isError?: boolean;
  done: boolean;
}

type TraceItem = { kind: "step"; step: Step } | { kind: "note"; text: string };

const OWNER: Record<string, string> = {
  public_health: "Public health",
  water_utility: "Water utility",
  laboratory: "Laboratory",
  volunteers: "Volunteers",
  clinicians: "Clinicians",
};
const SOURCE_CLASS: Record<string, string> = {
  forecast: "bg-sky-100 text-sky-800",
  weather: "bg-sky-50 text-sky-800",
  citizen: "bg-emerald-100 text-emerald-800",
  lab: "bg-violet-100 text-violet-800",
  clinic: "bg-rose-100 text-rose-800",
  site: "bg-stone-200 text-stone-700",
};
const PRIORITY: Record<string, string> = {
  routine: "lvl-low",
  elevated: "lvl-high",
  urgent: "lvl-very-high",
};

export function AgentPanel({ siteId, mode }: { siteId: string; mode: "live" | "mock" | "off" }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [trace, setTrace] = useState<TraceItem[]>([]);
  const [plan, setPlan] = useState<ResponsePlan>();
  const [planId, setPlanId] = useState<string>();
  const [meta, setMeta] = useState<{ model?: string; reused?: boolean; createdAt?: string }>({});
  const [error, setError] = useState<string>();
  const [lang, setLang] = useState<"local" | "en">("local");
  const [officer, setOfficer] = useState("");
  const [decision, setDecision] = useState<"approved" | "discarded">();
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function draft(fresh: boolean) {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setRunning(true);
    setTrace([]);
    setPlan(undefined);
    setPlanId(undefined);
    setError(undefined);
    setDecision(undefined);
    setMeta({});
    try {
      const res = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, fresh }),
        signal: ctl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (chunk.startsWith("data: ")) handle(JSON.parse(chunk.slice(6)) as Ev);
        }
      }
    } catch (e) {
      if (!ctl.signal.aborted) setError(`The agent could not be reached (${e instanceof Error ? e.message : e}).`);
    } finally {
      setRunning(false);
    }
  }

  function handle(e: Ev) {
    switch (e.type) {
      case "start":
        setMeta((m) => ({ ...m, model: e.model }));
        break;
      case "note":
        setTrace((t) => [...t, { kind: "note", text: e.text }]);
        break;
      case "tool":
        setTrace((t) => [...t, { kind: "step", step: { id: e.id, label: e.label, done: false } }]);
        break;
      case "tool_result":
        setTrace((t) => t.map((x) => (x.kind === "step" && x.step.id === e.id ? { kind: "step", step: { ...x.step, done: true, summary: e.summary, isError: e.isError } } : x)));
        break;
      case "plan":
        setPlan(e.plan);
        break;
      case "saved":
        setPlanId(e.planId);
        if (e.status !== "draft") setDecision(e.status);
        setMeta((m) => ({ ...m, reused: e.reused, createdAt: e.createdAt }));
        break;
      case "error":
        setError(e.message);
        break;
    }
  }

  async function decide(d: "approve" | "discard") {
    if (!planId) return;
    setBusy(true);
    const res = await fetch(`/api/agent/plans/${planId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: d, officer: officer.trim() || "Duty officer" }),
    });
    setBusy(false);
    if (res.ok) {
      setDecision(d === "approve" ? "approved" : "discarded");
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? `Could not save the decision (HTTP ${res.status}).`);
    }
  }

  const started = running || trace.length > 0 || plan || error;

  return (
    <section className="card p-5 mt-6" aria-labelledby="agent-heading">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="eyebrow">AI duty officer · drafts, a human decides</p>
          <h2 id="agent-heading" className="font-display text-2xl mt-0.5">Response plan</h2>
          <p className="text-sm text-ink-2 mt-1 max-w-2xl">
            An AI agent reads this stream&apos;s risk model, citizen checks, lab results, clinic reports and the forecast, then drafts
            a resident advisory in the local language, a GP note and prioritised actions. Nothing is published until you approve it.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {!started && (
            <button
              onClick={() => draft(false)}
              disabled={mode === "off"}
              className="rounded-lg bg-river text-white text-sm px-4 py-2 hover:bg-river-deep disabled:opacity-40"
            >
              Draft response plan
            </button>
          )}
          {started && !running && (
            <button onClick={() => draft(true)} disabled={mode === "off"} className="rounded-lg border border-line text-sm px-3 py-2 hover:border-ink-3 disabled:opacity-40">
              Draft a new plan
            </button>
          )}
          {running && (
            <button onClick={() => abort.current?.abort()} className="rounded-lg border border-line text-sm px-3 py-2 hover:border-ink-3">
              Stop
            </button>
          )}
        </div>
      </div>
      {mode === "off" && <p className="text-sm text-ink-3 mt-3">The AI agent isn&apos;t configured on this deployment.</p>}

      {started && (
        <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-6 mt-5">
          <div>
            <p className="eyebrow">What the agent did</p>
            <ol className="mt-3 space-y-2.5" aria-live="polite">
              {trace.map((t, i) =>
                t.kind === "note" ? (
                  <li key={i} className="text-xs text-ink-3 italic pl-6">
                    {t.text}
                  </li>
                ) : (
                  <li key={t.step.id} className="flex gap-2 text-sm">
                    <span className="w-4 shrink-0 mt-0.5" aria-hidden>
                      {!t.step.done ? (
                        <span className="block w-3.5 h-3.5 rounded-full border-2 border-river border-t-transparent animate-spin" />
                      ) : t.step.isError ? (
                        <span className="text-lvl-high">!</span>
                      ) : (
                        <span className="text-emerald-700">✓</span>
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="font-medium">{t.step.label}</span>
                      {t.step.summary && <span className="block text-xs text-ink-3">{t.step.summary}</span>}
                    </span>
                  </li>
                ),
              )}
              {running && trace.length === 0 && <li className="text-sm text-ink-3 animate-pulse">Starting the agent…</li>}
            </ol>
            {meta.model && (
              <p className="text-[11px] text-ink-3 mt-4">
                {meta.model === "mock" ? "Mock mode (no model call)" : `Model: ${meta.model}`}
                {meta.reused && meta.createdAt && ` · reused a draft from ${new Date(meta.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}
              </p>
            )}
          </div>

          <div className="min-w-0">
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 text-red-900 text-sm p-4">
                {error}
              </div>
            )}
            {!plan && !error && (
              <div className="rounded-lg border border-dashed border-line p-6 text-sm text-ink-3">The draft will appear here.</div>
            )}
            {plan && (
              <article className="rounded-xl border border-line bg-white p-5" data-testid="response-plan">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${PRIORITY[plan.priority]}`}>{plan.priority}</span>
                  <span className="text-[11px] rounded bg-amber-100 text-amber-900 px-1.5 py-0.5">
                    {decision === "approved" ? "approved" : decision === "discarded" ? "discarded" : "AI draft, awaiting review"}
                  </span>
                </div>
                <h3 className="font-display text-xl mt-2">{plan.headline}</h3>
                <p className="text-sm text-ink-2 mt-2">{plan.situation}</p>

                <div className="mt-5">
                  <div className="flex items-center justify-between">
                    <p className="eyebrow">Resident advisory</p>
                    <div className="flex text-xs border border-line rounded-md overflow-hidden" role="group" aria-label="Advisory language">
                      <button aria-pressed={lang === "local"} onClick={() => setLang("local")} className={`px-2 py-1 ${lang === "local" ? "bg-ink text-white" : ""}`}>
                        {plan.public_advisory.language}
                      </button>
                      <button aria-pressed={lang === "en"} onClick={() => setLang("en")} className={`px-2 py-1 ${lang === "en" ? "bg-ink text-white" : ""}`}>
                        English
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 rounded-lg bg-river-soft/60 p-3 text-sm" lang={lang === "en" ? "en" : undefined}>
                    {lang === "local" ? plan.public_advisory.local_text : plan.public_advisory.english_text}
                  </p>
                </div>

                <div className="mt-4">
                  <p className="eyebrow">Note for local GPs</p>
                  <p className="mt-2 rounded-lg bg-stone-100 p-3 text-sm">{plan.clinician_note}</p>
                </div>

                <div className="mt-4">
                  <p className="eyebrow">Actions</p>
                  <ul className="mt-2 divide-y divide-line">
                    {plan.actions.map((a, i) => (
                      <li key={i} className="py-2 text-sm flex flex-col sm:flex-row gap-1 sm:gap-3">
                        <span className="sm:w-28 shrink-0 text-xs font-medium text-river-deep">{OWNER[a.owner]}</span>
                        <span className="min-w-0">
                          <span className="font-medium">{a.action}</span> <span className="text-xs text-ink-3">· {a.when}</span>
                          <span className="block text-xs text-ink-3">{a.rationale}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <details className="mt-4">
                  <summary className="eyebrow cursor-pointer">Evidence ({plan.evidence.length}) and uncertainties</summary>
                  <ul className="mt-2 space-y-1.5">
                    {plan.evidence.map((e, i) => (
                      <li key={i} className="text-xs flex gap-2">
                        <span className={`shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded h-fit ${SOURCE_CLASS[e.source]}`}>{e.source}</span>
                        <span>
                          {e.claim} <span className="text-ink-3 font-mono">[{e.reference}]</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {plan.uncertainties.length > 0 && (
                    <ul className="mt-3 list-disc pl-5 text-xs text-ink-3 space-y-1">
                      {plan.uncertainties.map((u, i) => (
                        <li key={i}>{u}</li>
                      ))}
                    </ul>
                  )}
                </details>

                {planId && !decision && (
                  <div className="mt-5 pt-4 border-t border-line flex flex-col sm:flex-row sm:items-center gap-2">
                    <label className="text-xs text-ink-2 flex items-center gap-2">
                      Your name
                      <input
                        value={officer}
                        onChange={(e) => setOfficer(e.target.value)}
                        placeholder="Duty officer"
                        className="rounded-md border border-line bg-white px-2 py-1.5 text-sm w-40"
                      />
                    </label>
                    <div className="flex gap-2 sm:ml-auto">
                      <button disabled={busy} onClick={() => decide("discard")} className="rounded-lg border border-line text-sm px-3 py-2 hover:border-ink-3 disabled:opacity-40">
                        Discard
                      </button>
                      <button disabled={busy} onClick={() => decide("approve")} className="rounded-lg bg-river text-white text-sm px-4 py-2 hover:bg-river-deep disabled:opacity-40">
                        Approve &amp; publish
                      </button>
                    </div>
                  </div>
                )}
                {decision === "approved" && planId && (
                  <p role="status" className="mt-5 pt-4 border-t border-line text-sm text-emerald-800">
                    Published as{" "}
                    <a className="underline" href={`/fhir/Communication/${planId}`} target="_blank">
                      FHIR Communication/{planId}
                    </a>{" "}
                    with a{" "}
                    <a className="underline" href={`/fhir/Provenance?target=Communication/${planId}`} target="_blank">
                      Provenance
                    </a>{" "}
                    record naming the AI author and you as the approver.
                  </p>
                )}
                {decision === "discarded" && <p className="mt-5 pt-4 border-t border-line text-sm text-ink-3">Discarded. Nothing was published.</p>}
              </article>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
