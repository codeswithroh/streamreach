import Link from "next/link";
import { SITES, getSite } from "@/lib/sites";
import { snapshot, storeKind } from "@/lib/store";
import type { StoredObservation } from "@/lib/seed";
import { PageHeader } from "@/components/shell/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { VerifyButton } from "./VerifyButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data explorer · StreamReach" };

const LABEL: Record<StoredObservation["code"], string> = {
  foam: "Foam/smell",
  diptera: "Larvae",
  waterTemperature: "Water temp",
  hydrology: "Flow",
  "filamentous-algae": "Algae cover",
  coliforms: "E. coli",
};

const SYNDROME: Record<string, string> = { gastrointestinal: "Gastrointestinal", "skin-rash": "Skin rash", febrile: "Fever" };

type Tab = "checks" | "queue" | "lab" | "clinic" | "volunteers";
const TABS: { id: Tab; label: string }[] = [
  { id: "checks", label: "Citizen checks" },
  { id: "queue", label: "Verification queue" },
  { id: "lab", label: "Lab results" },
  { id: "clinic", label: "Clinic signals" },
  { id: "volunteers", label: "Volunteers" },
];

interface Check {
  key: string;
  siteId: string;
  when: string;
  who: string;
  status: string;
  origin: string;
  items: StoredObservation[];
}

function groupChecks(obs: StoredObservation[]): Check[] {
  const map = new Map<string, Check>();
  for (const o of obs) {
    if (o.performer.kind !== "citizen") continue;
    const key = `${o.siteId}|${o.effective}|${o.performer.id}`;
    if (!map.has(key)) map.set(key, { key, siteId: o.siteId, when: o.effective, who: o.performer.id, status: o.status, origin: o.origin, items: [] });
    map.get(key)!.items.push(o);
  }
  return [...map.values()].sort((a, b) => b.when.localeCompare(a.when));
}

const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const val = (o: StoredObservation) => (o.value.kind === "coded" ? o.value.display : `${o.value.value} ${o.value.unit}`);

export default async function DataPage({ searchParams }: PageProps<"/app/data">) {
  const sp = await searchParams;
  const tab = (TABS.find((t) => t.id === sp.tab)?.id ?? "checks") as Tab;
  const site = typeof sp.site === "string" && getSite(sp.site) ? sp.site : "";
  const limit = Math.min(1000, Number(sp.limit) || 60);
  const snap = await snapshot();
  const user = (await getCurrentUser())!;
  const obs = site ? snap.observations.filter((o) => o.siteId === site) : snap.observations;
  const sigs = (site ? snap.signals.filter((s) => s.siteId === site) : snap.signals).sort((a, b) => b.date.localeCompare(a.date));
  const checks = groupChecks(obs);
  const queue = checks.filter((c) => c.status === "preliminary");
  const labs = obs.filter((o) => o.performer.kind === "lab").sort((a, b) => b.effective.localeCompare(a.effective));
  const userChecks = checks.filter((c) => c.origin === "user").length;

  const vols = new Map<string, { id: string; checks: number; sites: Set<string>; last: string; verified: number }>();
  for (const c of checks) {
    const v = vols.get(c.who) ?? { id: c.who, checks: 0, sites: new Set<string>(), last: "", verified: 0 };
    v.checks++;
    v.sites.add(c.siteId);
    if (c.status === "final") v.verified++;
    if (c.when > v.last) v.last = c.when;
    vols.set(c.who, v);
  }
  const volunteers = [...vols.values()].sort((a, b) => b.checks - a.checks);

  const href = (p: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const merged = { tab, site, ...p };
    for (const [k, v] of Object.entries(merged)) if (v && !(k === "tab" && v === "checks")) q.set(k, v);
    return `/app/data${q.size ? `?${q}` : ""}`;
  };
  const counts: Record<Tab, number> = { checks: checks.length, queue: queue.length, lab: labs.length, clinic: sigs.length, volunteers: volunteers.length };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <PageHeader
        eyebrow="Data explorer · every record behind the forecasts"
        title="The full record, open to inspection."
        subtitle={
          <>
            <p>
              {snap.observations.length.toLocaleString("en")} observations and {snap.signals.length} clinic signals across {SITES.length} reaches
              over 120 days. {userChecks > 0 && <>{userChecks} check{userChecks === 1 ? "" : "s"} added by visitors. </>}
              Everything is also available as FHIR at{" "}
              <a className="text-accent underline" href="/fhir/Observation?_count=50" target="_blank">/fhir/Observation</a>.
            </p>
            <p className="text-[11px] text-ink-3 mt-1">
              Storage: {storeKind() === "postgres" ? "Neon Postgres (persistent)" : "in-memory (local dev)"}
              {user.role !== "officer" && " · Only public-health officers can verify checks."}
            </p>
          </>
        }
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link key={t.id} href={href({ tab: t.id, limit: undefined })} className={`text-sm px-3 py-1.5 rounded-full border ${tab === t.id ? "bg-ink text-white border-ink" : "border-line hover:border-ink-3 text-ink-2"}`}>
            {t.label} <span className="tabular-nums opacity-80">{counts[t.id]}</span>
          </Link>
        ))}
        <form className="ml-auto" action="/app/data">
          <input type="hidden" name="tab" value={tab} />
          <select name="site" aria-label="Filter by reach" defaultValue={site} className="rounded-lg border border-line bg-white px-2 py-1.5 text-sm">
            <option value="">All reaches</option>
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {s.city}
              </option>
            ))}
          </select>
          <button className="ml-1.5 text-sm rounded-lg border border-line px-2.5 py-1.5 hover:border-ink-3">Filter</button>
        </form>
      </div>

      <div className="card mt-4 overflow-x-auto">
        {(tab === "checks" || tab === "queue") && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Reach</th>
                <th className="p-3 font-medium">Volunteer</th>
                <th className="p-3 font-medium">Observations (OAH indicators)</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(tab === "queue" ? queue : checks).slice(0, limit).map((c) => (
                <tr key={c.key} className="border-b border-line last:border-0 align-top">
                  <td className="p-3 whitespace-nowrap text-ink-2">{fmt(c.when)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <Link href={`/app/streams/${c.siteId}`} className="hover:underline">{getSite(c.siteId)?.name}</Link>
                    <span className="block text-[11px] text-ink-3">{getSite(c.siteId)?.city}</span>
                  </td>
                  <td className="p-3 whitespace-nowrap font-mono text-xs">
                    {c.who}
                    {c.origin === "user" && <span className="ml-1.5 font-sans text-[10px] rounded bg-sky-100 text-sky-800 px-1">new</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {c.items.map((o) => (
                        <span key={o.id} className="text-[11px] rounded-md bg-stone-100 px-1.5 py-0.5">
                          <span className="text-ink-3">{LABEL[o.code]}:</span> {val(o)}
                        </span>
                      ))}
                    </div>
                    {c.items.find((o) => o.note)?.note && <p className="text-[11px] text-ink-3 mt-1 italic">“{c.items.find((o) => o.note)!.note}”</p>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <VerifyButton ids={c.items.map((o) => o.id)} status={c.status as "final" | "preliminary"} canEdit={user.role === "officer"} />
                  </td>
                </tr>
              ))}
              {(tab === "queue" ? queue : checks).length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-ink-3">Nothing here.</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === "lab" && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Reach</th>
                <th className="p-3 font-medium">E. coli</th>
                <th className="p-3 font-medium">vs EU inland bathing thresholds</th>
                <th className="p-3 font-medium">Method</th>
              </tr>
            </thead>
            <tbody>
              {labs.slice(0, limit).map((o) => {
                const v = o.value.kind === "quantity" ? o.value.value : 0;
                const cls = v <= 500 ? ["Excellent", "lvl-low"] : v <= 900 ? ["Sufficient", "lvl-moderate"] : v <= 1800 ? ["Poor", "lvl-high"] : ["Very poor", "lvl-very-high"];
                return (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="p-3 whitespace-nowrap text-ink-2">{fmt(o.effective)}</td>
                    <td className="p-3"><Link href={`/app/streams/${o.siteId}`} className="hover:underline">{getSite(o.siteId)?.name}</Link></td>
                    <td className="p-3 tabular-nums font-medium">{val(o)}</td>
                    <td className="p-3"><span className={`chip ${cls[1]}`}>{cls[0]}</span></td>
                    <td className="p-3 text-xs text-ink-3">{o.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === "clinic" && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="p-3 font-medium">Date</th>
                <th className="p-3 font-medium">Nearest reach</th>
                <th className="p-3 font-medium">District</th>
                <th className="p-3 font-medium">Syndrome</th>
                <th className="p-3 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {sigs.slice(0, limit).map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="p-3 whitespace-nowrap text-ink-2">{fmt(s.date)}</td>
                  <td className="p-3"><Link href={`/app/streams/${s.siteId}`} className="hover:underline">{getSite(s.siteId)?.name}</Link></td>
                  <td className="p-3 text-ink-2">{s.district}</td>
                  <td className="p-3">{SYNDROME[s.syndrome]}</td>
                  <td className="p-3 text-xs">
                    {s.origin === "user" ? <span className="rounded bg-sky-100 text-sky-800 px-1.5 py-0.5">CDS Hooks feedback (live)</span> : <span className="text-ink-3">Anonymous GP report (demo history)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "volunteers" && (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="p-3 font-medium">#</th>
                <th className="p-3 font-medium">Volunteer (pseudonymous)</th>
                <th className="p-3 font-medium">Checks</th>
                <th className="p-3 font-medium">Verified</th>
                <th className="p-3 font-medium">Reaches</th>
                <th className="p-3 font-medium">Last check</th>
              </tr>
            </thead>
            <tbody>
              {volunteers.slice(0, limit).map((v, i) => (
                <tr key={v.id} className="border-b border-line last:border-0">
                  <td className="p-3 text-ink-3 tabular-nums">{i + 1}</td>
                  <td className="p-3 font-mono text-xs">{v.id}</td>
                  <td className="p-3 tabular-nums">
                    <span className="inline-flex items-center gap-2">
                      {v.checks}
                      <span className="h-1.5 rounded-full bg-river" style={{ width: `${(v.checks / volunteers[0].checks) * 80}px` }} />
                    </span>
                  </td>
                  <td className="p-3 tabular-nums text-ink-2">{Math.round((v.verified / v.checks) * 100)}%</td>
                  <td className="p-3 text-ink-2">{[...v.sites].map((s) => getSite(s)?.name).join(", ")}</td>
                  <td className="p-3 whitespace-nowrap text-ink-2">{fmt(v.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {counts[tab] > limit && (
        <div className="text-center mt-4">
          <Link href={href({ limit: String(limit + 120) })} className="text-sm text-river hover:underline" scroll={false}>
            Show more ({counts[tab] - limit} remaining)
          </Link>
        </div>
      )}
    </div>
  );
}
