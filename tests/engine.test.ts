import { describe, expect, it } from "vitest";
import { SITES } from "@/lib/sites";
import { observationsFor, signalsFor } from "@/lib/store";
import { assessSite } from "@/lib/risk/engine";
import { applyScenario, type WeatherSeries } from "@/lib/weather";

function dryWeather(): WeatherSeries {
  const days = [];
  const today = new Date();
  for (let i = -14; i <= 6; i++) {
    const d = new Date(today.getTime() + i * 86_400_000);
    days.push({ date: d.toISOString().slice(0, 10), rainMm: 0, tMax: 27, tMean: 22, sunshineH: 10, forecast: i > 0 });
  }
  return { siteId: "x", source: "fallback-climatology", fetchedAt: "", days, todayIndex: 14 };
}

describe("risk engine", async () => {
  const site = SITES[0];
  const obs = await observationsFor(site.id);
  const sig = await signalsFor(site.id);
  it("produces three explained hazards", () => {
    const r = assessSite(site, dryWeather(), obs, sig);
    expect(r.hazards.map((h) => h.hazard)).toEqual(["waterborne", "cyanobacteria", "vector"]);
    for (const h of r.hazards) {
      expect(h.factors.length).toBeGreaterThan(0);
      expect(h.now.p).toBeGreaterThan(0);
      expect(h.now.p).toBeLessThan(1);
    }
    console.table(r.hazards.map((h) => ({ h: h.hazard, now: h.now.p.toFixed(2), peak: h.peak.p.toFixed(2), lvl: h.peak.level })));
  });

  it("a forecast storm raises waterborne risk above the overflow threshold", () => {
    const base = assessSite(site, dryWeather(), obs, sig);
    const storm = assessSite(site, applyScenario(dryWeather(), { rainMm: 40, heatC: 0 }), obs, sig);
    const b = base.hazards[0].peak.p;
    const s = storm.hazards[0].peak.p;
    expect(s).toBeGreaterThan(b + 0.3);
    expect(storm.hazards[0].factors[0].id).toBe("overflow");
  });

  it("heat raises bloom risk", () => {
    const base = assessSite(site, dryWeather(), obs, sig);
    const hot = assessSite(site, applyScenario(dryWeather(), { rainMm: 0, heatC: 6 }), obs, sig);
    expect(hot.hazards[1].peak.p).toBeGreaterThan(base.hazards[1].peak.p);
  });
});
