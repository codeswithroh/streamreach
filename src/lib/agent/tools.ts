// Read-only tools the duty-officer agent uses to ground its plan in StreamReach data.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { LEVEL_LABEL } from "../risk/engine";
import { siteBundleById } from "../risk/service";
import { SITES, getSite } from "../sites";
import { observationsFor, signalsFor } from "../store";
import { RESPONSE_PLAN_JSON_SCHEMA } from "./plan";

const DAY = 86_400_000;

export const LANGUAGE: Record<string, string> = { GR: "Greek", IT: "Italian", NO: "Norwegian (Bokmål)", PT: "Portuguese" };

const SiteArg = z.object({ site_id: z.string() });
const SiteDaysArg = z.object({ site_id: z.string(), days: z.number().int().min(1).max(120) });

const siteProp = { site_id: { type: "string", description: "StreamReach reach id, e.g. giofyros-1" } } as const;

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_stream_risk",
    description:
      "Current and forecast One Health risk for a stream reach: for each hazard (waterborne pathogens, toxic algal bloom, mosquito-borne disease) the level and probability today and at the 72 h peak, the daily forecast, the named factors that drive the score, and data confidence. Also returns reach context (city, country, local language, uses, residents nearby). Call this first.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["site_id"], properties: siteProp },
  },
  {
    name: "get_recent_observations",
    description:
      "Citizen stream checks and partner-lab results for a reach over the last N days, newest first, with observation ids you can cite, verification status and volunteer notes.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["site_id", "days"],
      properties: { ...siteProp, days: { type: "integer", description: "Look-back window in days (1-120)." } },
    },
  },
  {
    name: "get_clinic_signals",
    description:
      "Anonymous stream-linked presentations reported by local GPs through CDS Hooks feedback for a reach over the last N days, counted by syndrome (gastrointestinal, skin rash, fever) with dates.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["site_id", "days"],
      properties: { ...siteProp, days: { type: "integer", description: "Look-back window in days (1-120)." } },
    },
  },
  {
    name: "get_weather_outlook",
    description: "Daily rain, max and mean temperature and sunshine for the reach: the last 7 days and the 6-day forecast (Open-Meteo).",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["site_id"], properties: siteProp },
  },
  {
    name: "compare_city_reaches",
    description:
      "Risk summary for every other monitored reach in the same city, to judge whether the situation is local or city-wide and to prioritise field teams.",
    strict: true,
    input_schema: { type: "object", additionalProperties: false, required: ["site_id"], properties: siteProp },
  },
  {
    name: "submit_response_plan",
    description:
      "Submit the final response plan. Call exactly once, as your last step, after gathering evidence. A human duty officer reviews it before anything is published.",
    strict: true,
    input_schema: RESPONSE_PLAN_JSON_SCHEMA as unknown as Anthropic.Beta.BetaTool.InputSchema,
  },
];

export const TOOL_LABEL: Record<string, string> = {
  get_stream_risk: "Reading the risk model",
  get_recent_observations: "Reviewing citizen checks and lab results",
  get_clinic_signals: "Checking clinic reports",
  get_weather_outlook: "Reading the weather outlook",
  compare_city_reaches: "Comparing other streams in the city",
  submit_response_plan: "Drafting the response plan",
};

export interface ToolOutcome {
  /** JSON sent back to the model */
  content: string;
  /** one-line human summary for the live trace */
  summary: string;
  isError?: boolean;
}

const pct = (p: number) => `${Math.round(p * 100)}%`;

export async function runTool(name: string, input: unknown): Promise<ToolOutcome> {
  const fail = (msg: string): ToolOutcome => ({ content: JSON.stringify({ error: msg }), summary: msg, isError: true });
  try {
    switch (name) {
      case "get_stream_risk": {
        const { site_id } = SiteArg.parse(input);
        const sb = await siteBundleById(site_id);
        if (!sb) return fail(`Unknown reach ${site_id}`);
        const { site, risk } = sb;
        const data = {
          reach: {
            id: site.id,
            name: site.name,
            river: site.river,
            city: site.city,
            district: site.district,
            country: site.country,
            local_language: LANGUAGE[site.countryCode] ?? "English",
            uses: site.uses,
            residents_within_1km: site.vulnerability.residentsWithin1km,
            sewer_overflows_upstream: site.vulnerability.overflowsUpstream,
            overflow_threshold_mm_per_day: site.vulnerability.overflowThresholdMm,
          },
          overall_level: risk.overall,
          weather_source: risk.weatherSource,
          hazards: risk.hazards.map((h) => ({
            hazard: h.label,
            today: { date: h.now.date, level: h.now.level, probability: pct(h.now.p) },
            peak_72h: { date: h.peak.date, level: h.peak.level, probability: pct(h.peak.p) },
            daily_forecast: h.timeline.filter((d) => d.date >= h.now.date).map((d) => `${d.date}: ${d.level} ${pct(d.p)}`),
            factors: h.factors.map((f) => ({ id: f.id, name: f.label, source: f.source, contribution: Number(f.contribution.toFixed(2)), detail: f.detail, evidence_ids: f.evidence })),
            confidence: `${h.confidence}: ${h.confidenceReason}`,
            model_public_advice: h.publicAdvice,
            model_clinical_advice: h.clinicalAdvice,
          })),
        };
        const top = [...risk.hazards].sort((a, b) => b.peak.p - a.peak.p)[0];
        return { content: JSON.stringify(data), summary: `${site.name}: ${LEVEL_LABEL[top.peak.level].toLowerCase()} ${top.label.toLowerCase()} (peak ${pct(top.peak.p)} on ${top.peak.date})` };
      }

      case "get_recent_observations": {
        const { site_id, days } = SiteDaysArg.parse(input);
        if (!getSite(site_id)) return fail(`Unknown reach ${site_id}`);
        const since = Date.now() - days * DAY;
        const obs = (await observationsFor(site_id)).filter((o) => new Date(o.effective).getTime() >= since).slice(0, 120);
        const rows = obs.map((o) => ({
          id: o.id,
          date: o.effective.slice(0, 10),
          indicator: o.code,
          value: o.value.kind === "coded" ? o.value.display : `${o.value.value} ${o.value.unit}`,
          by: o.performer.kind === "lab" ? "partner lab" : "citizen volunteer",
          status: o.status === "final" ? "verified" : "awaiting verification",
          ...(o.note ? { note: o.note } : {}),
        }));
        const checks = new Set(obs.filter((o) => o.performer.kind === "citizen").map((o) => o.effective)).size;
        const labs = obs.filter((o) => o.performer.kind === "lab").length;
        return { content: JSON.stringify({ window_days: days, citizen_checks: checks, lab_results: labs, observations: rows }), summary: `${checks} citizen checks and ${labs} lab result(s) in ${days} days` };
      }

      case "get_clinic_signals": {
        const { site_id, days } = SiteDaysArg.parse(input);
        if (!getSite(site_id)) return fail(`Unknown reach ${site_id}`);
        const since = Date.now() - days * DAY;
        const sig = (await signalsFor(site_id)).filter((s) => new Date(s.date).getTime() >= since);
        const by: Record<string, string[]> = {};
        for (const s of sig) (by[s.syndrome] ??= []).push(s.date);
        return {
          content: JSON.stringify({ window_days: days, total: sig.length, by_syndrome: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, { count: v.length, dates: v.sort() }])) }),
          summary: sig.length ? `${sig.length} anonymous clinic report(s) in ${days} days` : `No clinic reports in ${days} days`,
        };
      }

      case "get_weather_outlook": {
        const { site_id } = SiteArg.parse(input);
        const sb = await siteBundleById(site_id);
        if (!sb) return fail(`Unknown reach ${site_id}`);
        const w = sb.weather;
        const days = w.days.slice(Math.max(0, w.todayIndex - 7)).map((d) => ({
          date: d.date,
          kind: d.forecast ? "forecast" : d.date === w.days[w.todayIndex].date ? "today" : "observed",
          rain_mm: d.rainMm,
          t_max_c: Math.round(d.tMax * 10) / 10,
          t_mean_c: Math.round(d.tMean * 10) / 10,
          sunshine_h: Math.round(d.sunshineH * 10) / 10,
        }));
        const next72 = days.filter((d) => d.kind !== "observed").slice(0, 4).reduce((a, d) => a + d.rain_mm, 0);
        return { content: JSON.stringify({ source: w.source, days }), summary: `${Math.round(next72)} mm rain expected over the next 72 h` };
      }

      case "compare_city_reaches": {
        const { site_id } = SiteArg.parse(input);
        const site = getSite(site_id);
        if (!site) return fail(`Unknown reach ${site_id}`);
        const others = SITES.filter((s) => s.city === site.city && s.id !== site.id);
        const rows = await Promise.all(
          others.map(async (s) => {
            const sb = (await siteBundleById(s.id))!;
            return {
              id: s.id,
              name: s.name,
              overall: sb.risk.overall,
              hazards: sb.risk.hazards.map((h) => `${h.label}: ${h.peak.level} ${pct(h.peak.p)} (peak ${h.peak.date})`),
            };
          }),
        );
        const elevated = rows.filter((r) => r.overall === "high" || r.overall === "very-high").length;
        return { content: JSON.stringify({ city: site.city, other_reaches: rows }), summary: `${rows.length} other reach(es) in ${site.city}, ${elevated} at high risk or above` };
      }
    }
    return fail(`Unknown tool ${name}`);
  } catch (e) {
    return fail(e instanceof z.ZodError ? `Invalid input: ${e.issues.map((i) => i.message).join("; ")}` : "Tool failed");
  }
}
