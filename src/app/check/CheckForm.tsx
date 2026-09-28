"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { OAH_CS, TRIB_CS, OAH_DISPLAY, FLOW_DISPLAY } from "@/lib/codes";
import type { RiskLevel } from "@/lib/types";

interface Summary {
  overall: RiskLevel;
  hazards: { hazard: string; label: string; level: RiskLevel; p: number; confidence: string }[];
}

type Choice<T extends string> = { value: T; label: string; hint?: string; visual?: React.ReactNode };

const FOAM: Choice<string>[] = [
  { value: "absent", label: "Nothing unusual" },
  { value: "present", label: "A little", hint: "some foam, odd colour or faint smell" },
  { value: "extensive", label: "A lot", hint: "grey foam, sewage smell, discoloured" },
];
const FLOW: Choice<string>[] = (["dry", "stagnant", "low", "normal", "high"] as const).map((v) => ({
  value: v,
  label: { dry: "Dry", stagnant: "Still", low: "Trickling", normal: "Flowing", high: "Rushing / muddy" }[v],
  hint: FLOW_DISPLAY[v],
  visual: <FlowGlyph state={v} />,
}));
const ALGAE: Choice<string>[] = [
  ["0-20-percent", "Almost none"],
  ["21-40-percent", "Patches"],
  ["41-60-percent", "About half"],
  ["61-80-percent", "Most of it"],
  ["81-100-percent", "Carpeted"],
].map(([value, label], i) => ({
  value,
  label,
  hint: OAH_DISPLAY[value],
  visual: (
    <span className="flex h-2 w-full rounded-full bg-stone-200 overflow-hidden">
      <span className="bg-emerald-600" style={{ width: `${(i + 0.5) * 20}%` }} />
    </span>
  ),
}));
const LARVAE: Choice<string>[] = [
  { value: "absent", label: "None seen" },
  { value: "present", label: "Yes, wriggling larvae" },
  { value: "unknown", label: "Didn't look" },
];

const LVL = ["low", "moderate", "high", "very-high"];
const LVL_LABEL: Record<string, string> = { low: "Low", moderate: "Moderate", high: "High", "very-high": "Very high" };

export function CheckForm({ sites }: { sites: { id: string; name: string; city: string }[] }) {
  const sp = useSearchParams();
  const [siteId, setSiteId] = useState(sp.get("site") ?? sites[0].id);
  const [foam, setFoam] = useState<string>();
  const [flow, setFlow] = useState<string>();
  const [algae, setAlgae] = useState<string>();
  const [larvae, setLarvae] = useState<string>();
  const [temp, setTemp] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ before: Summary; after: Summary; ids: string[] }>();
  const [error, setError] = useState<string>();
  const [showFhir, setShowFhir] = useState(false);
  const [volunteer, setVolunteer] = useState("V-you");

  const answered = [foam, flow, algae, larvae].filter(Boolean).length;
  const bundle = useMemo(() => buildBundle({ siteId, foam, flow, algae, larvae, temp, volunteer }), [siteId, foam, flow, algae, larvae, temp, volunteer]);

  async function submit() {
    setBusy(true);
    setError(undefined);
    const vol = volunteerId();
    setVolunteer(vol);
    try {
      const before: Summary = await fetch(`/api/sites/${siteId}`).then((r) => r.json());
      const res = await fetch("/fhir", { method: "POST", headers: { "Content-Type": "application/fhir+json" }, body: JSON.stringify({ ...bundle, entry: bundle.entry.map((e) => ({ ...e, resource: { ...e.resource, performer: [{ identifier: { system: TRIB_CS.volunteer, value: vol } }] } })) }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.issue?.[0]?.diagnostics ?? `HTTP ${res.status}`);
      const after: Summary = await fetch(`/api/sites/${siteId}`).then((r) => r.json());
      setResult({ before, after, ids: body.entry.map((e: { response: { location: string } }) => e.response.location.split("/_history")[0]) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const site = sites.find((s) => s.id === siteId)!;
    return (
      <div className="mt-8 space-y-5">
        <div className="card p-6">
          <p className="eyebrow !text-river">Thank you, {volunteer}</p>
          <h2 className="font-display text-3xl mt-1">Your check is now part of {site.name}&apos;s record.</h2>
          <p className="text-ink-2 mt-2 text-sm">
            It was saved as {result.ids.length} FHIR Observations using the OneAquaHealth indicator profile, marked
            &ldquo;awaiting verification&rdquo; until a coordinator reviews it. Here is what it changed:
          </p>
          <ul className="mt-5 divide-y divide-line">
            {result.after.hazards.map((h) => {
              const b = result.before.hazards.find((x) => x.hazard === h.hazard)!;
              const delta = Math.round((h.p - b.p) * 100);
              const moved = LVL.indexOf(h.level) - LVL.indexOf(b.level);
              return (
                <li key={h.hazard} className="py-3 flex items-center gap-3 text-sm">
                  <span className="flex-1">{h.label}</span>
                  <span className={`chip lvl-${b.level}`}>{LVL_LABEL[b.level]}</span>
                  <span className="text-ink-3">→</span>
                  <span className={`chip lvl-${h.level}`}>{LVL_LABEL[h.level]}</span>
                  <span className={`w-14 text-right tabular-nums ${delta > 0 ? "text-lvl-high" : delta < 0 ? "text-lvl-low" : "text-ink-3"}`}>
                    {delta > 0 ? "+" : ""}
                    {delta} pts
                  </span>
                  {moved !== 0 && <span className="text-[11px] text-ink-3 w-28">{moved > 0 ? "warning raised" : "warning eased"}</span>}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-ink-3 mt-3">
            Confidence for this reach is now <b>{result.after.hazards[0].confidence}</b>. Checks from different days make the
            forecast sharper.
          </p>
          <div className="flex flex-wrap gap-2 mt-5">
            <Link href={`/sites/${siteId}`} className="rounded-lg bg-river text-white text-sm px-4 py-2 hover:bg-river-deep">
              See the stream record
            </Link>
            <button onClick={() => { setResult(undefined); setFoam(undefined); setFlow(undefined); setAlgae(undefined); setLarvae(undefined); setTemp(""); }} className="rounded-lg border border-line text-sm px-4 py-2 hover:border-ink-3">
              Check another reach
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      <label className="card p-4 block">
        <span className="eyebrow">Where are you?</span>
        <select value={siteId} onChange={(e) => setSiteId(e.target.value)} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2">
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.city}
            </option>
          ))}
        </select>
      </label>

      <Question n={1} title="Any foam, odd colour or sewage smell?" why="Sewage signs are the earliest clue that gut bugs like Campylobacter or Cryptosporidium are in the water." options={FOAM} value={foam} onChange={setFoam} />
      <Question n={2} title="How is the water moving?" why="Still, warm water lets toxic algae and mosquito larvae grow. Rushing, muddy water after rain often carries sewage overflow." options={FLOW} value={flow} onChange={setFlow} cols={5} />
      <Question n={3} title="How much of the bed is covered in green threads or slime?" why="Lots of filamentous algae means lots of nutrients, which is fuel for toxic blooms." options={ALGAE} value={algae} onChange={setAlgae} cols={5} />
      <Question n={4} title="Any wriggling larvae in still pockets or puddles by the bank?" why="Culex mosquito larvae in urban streams can spread West Nile virus to birds, horses and people." options={LARVAE} value={larvae} onChange={setLarvae} />

      <div className="card p-4">
        <p className="text-sm font-medium"><span className="text-ink-3 mr-2">5</span>Water temperature <span className="text-ink-3 font-normal">(optional, if you have a thermometer)</span></p>
        <div className="flex items-center gap-2 mt-3">
          <input inputMode="decimal" value={temp} onChange={(e) => setTemp(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="e.g. 21.5" className="w-28 rounded-lg border border-line bg-white px-3 py-2" />
          <span className="text-ink-3">°C</span>
        </div>
      </div>

      {error && <p className="text-sm text-lvl-very-high">Couldn&apos;t save: {error}</p>}

      <div className="flex items-center gap-3 pt-2">
        <button disabled={answered < 3 || busy} onClick={submit} className="rounded-lg bg-river text-white px-5 py-2.5 disabled:opacity-40 hover:bg-river-deep">
          {busy ? "Saving…" : "Submit check"}
        </button>
        <span className="text-xs text-ink-3">{answered}/4 answered{answered < 3 ? ". Answer at least 3." : ""}</span>
        <button onClick={() => setShowFhir((v) => !v)} className="ml-auto text-xs text-river hover:underline">
          {showFhir ? "hide" : "preview"} FHIR bundle
        </button>
      </div>
      {showFhir && <pre tabIndex={0} className="json max-h-96 overflow-auto rounded-lg bg-ink text-emerald-100 p-4">{JSON.stringify(bundle, null, 2)}</pre>}
    </div>
  );
}

/** Pseudonymous volunteer code, kept on this device only. */
function volunteerId() {
  try {
    const k = "streamreach-volunteer";
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const v = `V-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    localStorage.setItem(k, v);
    return v;
  } catch {
    return "V-ANON";
  }
}

function Question<T extends string>({ n, title, why, options, value, onChange, cols = 3 }: { n: number; title: string; why: string; options: Choice<T>[]; value?: string; onChange: (v: T) => void; cols?: number }) {
  return (
    <fieldset className="card p-4">
      <legend className="sr-only">{title}</legend>
      <p className="text-sm font-medium"><span className="text-ink-3 mr-2">{n}</span>{title}</p>
      <div className={`grid gap-2 mt-3 ${cols === 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-1 sm:grid-cols-3"}`}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              title={o.hint}
              onClick={() => onChange(o.value)}
              className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${on ? "border-river bg-river-soft/70 ring-1 ring-river" : "border-line hover:border-ink-3 bg-white"}`}
            >
              {o.visual && <span className="block mb-2">{o.visual}</span>}
              <span className="block text-sm font-medium">{o.label}</span>
              {o.hint && cols !== 5 && <span className="block text-[11px] text-ink-3 mt-0.5">{o.hint}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-3 mt-2.5">Why we ask: {why}</p>
    </fieldset>
  );
}

function FlowGlyph({ state }: { state: string }) {
  const lines = { dry: 0, stagnant: 1, low: 1, normal: 2, high: 3 }[state] ?? 1;
  return (
    <svg viewBox="0 0 60 18" className="w-full h-4" aria-hidden>
      {state === "dry" && <path d="M4 12 L20 9 L34 13 L56 10" stroke="#b6a58a" strokeWidth="2" fill="none" strokeDasharray="3 3" />}
      {Array.from({ length: lines }).map((_, i) =>
        state === "stagnant" ? (
          <line key={i} x1="6" x2="54" y1={9} y2={9} stroke="#3d8fc4" strokeWidth="2" />
        ) : (
          <path key={i} d={`M4 ${5 + i * 5} q7 -4 14 0 t14 0 t14 0 t14 0`} stroke={state === "high" ? "#8a6d3b" : "#3d8fc4"} strokeWidth="1.8" fill="none" />
        ),
      )}
    </svg>
  );
}

function buildBundle(a: { siteId: string; foam?: string; flow?: string; algae?: string; larvae?: string; temp: string; volunteer: string }) {
  const now = new Date().toISOString();
  const base = (code: string) => ({
    resourceType: "Observation",
    meta: { profile: ["http://hl7.eu/fhir/ig/oah/StructureDefinition/observation-indicators-oah"] },
    status: "final",
    code: { coding: [{ system: OAH_CS, code, display: OAH_DISPLAY[code] }] },
    subject: { reference: `Location/${a.siteId}` },
    effectiveDateTime: now,
    performer: [{ identifier: { system: TRIB_CS.volunteer, value: a.volunteer } }],
  });
  const coded = (code: string, system: string, value: string, display: string) => ({
    ...base(code),
    valueCodeableConcept: { coding: [{ system, code: value, display }] },
  });
  const entries: object[] = [];
  if (a.foam) entries.push(coded("foam", OAH_CS, a.foam, OAH_DISPLAY[a.foam]));
  if (a.flow) entries.push(coded("hydrology", TRIB_CS.flowState, a.flow, FLOW_DISPLAY[a.flow]));
  if (a.algae) entries.push(coded("filamentous-algae", OAH_CS, a.algae, OAH_DISPLAY[a.algae]));
  if (a.larvae && a.larvae !== "unknown") entries.push(coded("diptera", OAH_CS, a.larvae, OAH_DISPLAY[a.larvae]));
  const t = parseFloat(a.temp);
  if (!Number.isNaN(t)) entries.push({ ...base("waterTemperature"), valueQuantity: { value: t, unit: "°C", system: "http://unitsofmeasure.org", code: "Cel" } });
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry: entries.map((resource) => ({ resource, request: { method: "POST", url: "Observation" } })),
  };
}
