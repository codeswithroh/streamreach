// Daily weather for each site from Open-Meteo (no key needed): 14 past days plus
// a 7-day forecast. Falls back to a deterministic climatology when offline so
// the demo never breaks.

import type { Site } from "./sites";

export interface WeatherDay {
  date: string; // YYYY-MM-DD (site-local)
  rainMm: number;
  tMax: number;
  tMean: number;
  sunshineH: number;
  forecast: boolean;
}

export interface CurrentWeather {
  time: string;
  tempC: number;
  humidity: number;
  windKmh: number;
  cloudCover: number;
  precipMm: number;
  /** WMO weather interpretation code */
  code: number;
}

export interface WeatherSeries {
  siteId: string;
  source: "open-meteo" | "fallback-climatology";
  fetchedAt: string;
  days: WeatherDay[];
  /** index of "today" in days */
  todayIndex: number;
  current?: CurrentWeather;
}

/** What-if levers for resilience planning. */
export interface Scenario {
  /** extra rain (mm) spread over tomorrow and the day after */
  rainMm: number;
  /** degrees added to every forecast day */
  heatC: number;
}

export const NO_SCENARIO: Scenario = { rainMm: 0, heatC: 0 };

const cache = new Map<string, { at: number; data: WeatherSeries }>();
const TTL = 30 * 60_000;

export async function getWeather(site: Site): Promise<WeatherSeries> {
  const hit = cache.get(site.id);
  if (hit && Date.now() - hit.at < TTL) return hit.data;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${site.lat}&longitude=${site.lon}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_mean,sunshine_duration` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,cloud_cover,precipitation,weather_code` +
    `&past_days=14&forecast_days=7&timezone=auto`;
  let data: WeatherSeries;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) throw new Error(`open-meteo ${res.status}`);
    const j = await res.json();
    const d = j.daily;
    const todayIndex = 14;
    const c = j.current;
    data = {
      current: c
        ? {
            time: c.time,
            tempC: c.temperature_2m,
            humidity: c.relative_humidity_2m,
            windKmh: c.wind_speed_10m,
            cloudCover: c.cloud_cover,
            precipMm: c.precipitation,
            code: c.weather_code,
          }
        : undefined,
      siteId: site.id,
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
      todayIndex,
      days: d.time.map((t: string, i: number) => ({
        date: t,
        rainMm: d.precipitation_sum[i] ?? 0,
        tMax: d.temperature_2m_max[i] ?? 0,
        tMean: d.temperature_2m_mean[i] ?? 0,
        sunshineH: (d.sunshine_duration[i] ?? 0) / 3600,
        forecast: i > todayIndex,
      })),
    };
  } catch {
    data = fallback(site);
  }
  cache.set(site.id, { at: Date.now(), data });
  return data;
}

function fallback(site: Site): WeatherSeries {
  const today = new Date();
  const month = today.getUTCMonth();
  const seasonal = Math.cos(((month - 6.5) / 12) * 2 * Math.PI); // 1 in July, -1 in January
  const base = site.lat > 55 ? 8 : site.lat > 40 ? 15 : 20;
  const days: WeatherDay[] = [];
  for (let i = -14; i <= 6; i++) {
    const dt = new Date(today.getTime() + i * 86_400_000);
    const wobble = Math.sin((i + site.lon) * 1.7);
    const tMean = base + seasonal * 8 + wobble * 2;
    days.push({
      date: dt.toISOString().slice(0, 10),
      rainMm: Math.max(0, Math.round((Math.sin(i * 2.3 + site.lat) * 6 + 1) * 10) / 10),
      tMax: tMean + 5,
      tMean,
      sunshineH: 8 + seasonal * 3,
      forecast: i > 0,
    });
  }
  return { siteId: site.id, source: "fallback-climatology", fetchedAt: new Date().toISOString(), days, todayIndex: 14 };
}

export function applyScenario(w: WeatherSeries, s: Scenario): WeatherSeries {
  if (!s.rainMm && !s.heatC) return w;
  const days = w.days.map((d, i) => {
    const ahead = i - w.todayIndex;
    if (ahead < 0) return d;
    const rain = ahead === 1 ? s.rainMm * 0.65 : ahead === 2 ? s.rainMm * 0.35 : 0;
    return {
      ...d,
      rainMm: Math.round((d.rainMm + rain) * 10) / 10,
      tMax: d.tMax + s.heatC,
      tMean: d.tMean + s.heatC,
      sunshineH: s.heatC > 0 ? Math.min(13, d.sunshineH + s.heatC * 0.3) : d.sunshineH,
    };
  });
  return { ...w, days };
}

export function parseScenario(sp: URLSearchParams | Record<string, string | string[] | undefined>): Scenario {
  const get = (k: string) => {
    const v = sp instanceof URLSearchParams ? sp.get(k) : sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    rainMm: clamp(Number(get("rain")) || 0, 0, 120),
    heatC: clamp(Number(get("heat")) || 0, -5, 10),
  };
}

/** Short description for a WMO weather code. */
export function describeWeather(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorm";
}
