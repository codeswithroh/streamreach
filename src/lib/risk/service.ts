import { SITES, getSite, type Site } from "../sites";
import { observationsFor, signalsFor } from "../store";
import { applyScenario, getWeather, NO_SCENARIO, type Scenario, type WeatherSeries } from "../weather";
import { assessSite, type SiteRisk } from "./engine";

export interface SiteBundle {
  site: Site;
  weather: WeatherSeries;
  risk: SiteRisk;
}

export async function siteBundle(site: Site, scenario: Scenario = NO_SCENARIO): Promise<SiteBundle> {
  const weather = applyScenario(await getWeather(site), scenario);
  const [obs, sig] = await Promise.all([observationsFor(site.id), signalsFor(site.id)]);
  const risk = assessSite(site, weather, obs, sig);
  return { site, weather, risk };
}

export async function allSiteBundles(scenario: Scenario = NO_SCENARIO): Promise<SiteBundle[]> {
  return Promise.all(SITES.map((s) => siteBundle(s, scenario)));
}

export async function siteBundleById(id: string, scenario: Scenario = NO_SCENARIO) {
  const site = getSite(id);
  return site ? siteBundle(site, scenario) : undefined;
}
