import { Dashboard, type DashSite } from "@/components/dashboard/Dashboard";
import { ROLE_LABEL, getCurrentUser } from "@/lib/auth";
import { LEVELS } from "@/lib/risk/engine";
import { allSiteBundles } from "@/lib/risk/service";
import { snapshot } from "@/lib/store";
import type { StreamObservation } from "@/lib/types";
import { parseScenario } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const metadata = { title: "Monitoring · StreamReach" };

const LABEL: Record<StreamObservation["code"], string> = {
  foam: "Foam/smell",
  diptera: "Larvae",
  waterTemperature: "Water temp",
  hydrology: "Flow",
  "filamentous-algae": "Algae",
  coliforms: "E. coli",
};

export default async function MonitoringPage({ searchParams }: PageProps<"/app">) {
  const sp = await searchParams;
  const scenario = parseScenario(sp);
  const user = (await getCurrentUser())!;
  const [bundles, snap] = await Promise.all([allSiteBundles(scenario), snapshot()]);

  const sites: DashSite[] = bundles.map(({ site, weather, risk }) => {
    const start = Math.max(0, weather.todayIndex - 7);
    const obs = snap.observations.filter((o) => o.siteId === site.id && o.performer.kind === "citizen");
    const groups = new Map<string, { key: string; when: string; who: string; status: string; items: string[] }>();
    for (const o of obs) {
      const key = `${o.effective}|${o.performer.id}`;
      if (!groups.has(key)) groups.set(key, { key, when: o.effective, who: o.performer.id, status: o.status, items: [] });
      groups.get(key)!.items.push(`${LABEL[o.code]}: ${o.value.kind === "coded" ? o.value.display : `${o.value.value} ${o.value.unit}`}`);
    }
    const checks = [...groups.values()].sort((a, b) => b.when.localeCompare(a.when));
    return {
      id: site.id,
      name: site.name,
      river: site.river,
      city: site.city,
      district: site.district,
      country: site.country,
      lat: site.lat,
      lon: site.lon,
      source: site.source,
      uses: site.uses,
      residents: site.vulnerability.residentsWithin1km,
      overall: risk.overall,
      hazards: risk.hazards.map((h) => ({
        id: h.hazard,
        label: h.label,
        timeline: h.timeline.map((d) => ({ date: d.date, p: d.p, level: d.level, forecast: d.forecast })),
        peak: h.peak,
        confidence: h.confidence,
        factors: h.factors.slice(0, 3).map((f) => ({ label: f.label, source: f.source, detail: f.detail })),
      })),
      weather: {
        source: weather.source,
        days: weather.days.slice(start).map((d) => ({ date: d.date, rain: d.rainMm, tMax: d.tMax, forecast: d.forecast })),
        current: weather.current,
      },
      checks: {
        pending: checks.filter((c) => c.status === "preliminary").slice(0, 6),
        verified: checks.filter((c) => c.status === "final").slice(0, 6),
        pendingCount: checks.filter((c) => c.status === "preliminary").length,
      },
    };
  });

  const warnings = bundles.filter((b) => b.risk.hazards.some((h) => LEVELS.indexOf(h.peak.level) >= 2)).length;
  const reach = typeof sp.reach === "string" ? sp.reach : undefined;

  return (
    <Dashboard
      sites={sites}
      initialReach={sites.some((s) => s.id === reach) ? reach : undefined}
      scenario={scenario}
      warnings={warnings}
      user={{ name: user.name, role: user.role, roleLabel: ROLE_LABEL[user.role], email: user.email }}
    />
  );
}
