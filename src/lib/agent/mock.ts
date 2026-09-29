// Deterministic stand-in for the model (STREAMREACH_AGENT_MOCK=1), used by the
// E2E suite and offline demos. It runs the real tools and builds a plan from
// their output with templates, so the UI, validation and approval flow are
// exercised without calling the API.
import { LEVEL_LABEL, LEVELS } from "../risk/engine";
import { siteBundleById } from "../risk/service";
import { signalsFor } from "../store";
import type { Emit } from "./run";
import { ResponsePlan } from "./plan";
import { LANGUAGE, TOOL_LABEL, runTool } from "./tools";

export async function mockRun(siteId: string, emit: Emit): Promise<ResponsePlan | undefined> {
  const calls: [string, object][] = [
    ["get_stream_risk", { site_id: siteId }],
    ["get_recent_observations", { site_id: siteId, days: 14 }],
    ["get_clinic_signals", { site_id: siteId, days: 14 }],
    ["get_weather_outlook", { site_id: siteId }],
    ["compare_city_reaches", { site_id: siteId }],
  ];
  emit({ type: "note", text: "Gathering the risk model, recent checks, clinic reports and the forecast." });
  for (const [i, [name, input]] of calls.entries()) {
    emit({ type: "tool", id: `mock-${i}`, name, label: TOOL_LABEL[name], input });
    const out = await runTool(name, input);
    emit({ type: "tool_result", id: `mock-${i}`, name, summary: out.summary, isError: out.isError });
  }

  const sb = (await siteBundleById(siteId))!;
  const top = [...sb.risk.hazards].sort((a, b) => b.peak.p - a.peak.p)[0];
  const sig = (await signalsFor(siteId)).filter((s) => Date.now() - new Date(s.date).getTime() < 14 * 86_400_000);
  const rank = LEVELS.indexOf(top.peak.level);
  const lvl = LEVEL_LABEL[top.peak.level].toLowerCase();

  emit({ type: "tool", id: "mock-submit", name: "submit_response_plan", label: TOOL_LABEL.submit_response_plan, input: {} });
  const plan = ResponsePlan.parse({
    headline: `${LEVEL_LABEL[top.peak.level]} ${top.label.toLowerCase()} risk at ${sb.site.name}, peaking ${top.peak.date}`,
    priority: rank >= 3 ? "urgent" : rank >= 2 ? "elevated" : "routine",
    situation: `${top.label} risk at ${sb.site.name} (${sb.site.city}) is ${lvl}, peaking at ${Math.round(top.peak.p * 100)}% on ${top.peak.date}. Main drivers: ${top.factors
      .slice(0, 3)
      .map((f) => f.label.toLowerCase())
      .join(", ")}. ${sig.length} anonymous clinic report(s) in the last 14 days. Confidence: ${top.confidence}.`,
    public_advisory: {
      language: LANGUAGE[sb.site.countryCode] ?? "English",
      local_text: `[mock translation] ${top.publicAdvice}`,
      english_text: top.publicAdvice,
    },
    clinician_note: top.clinicalAdvice,
    actions: [
      { action: `Publish the resident advisory for ${sb.site.name}`, owner: "public_health", when: "today", rationale: `${LEVEL_LABEL[top.peak.level]} ${top.label.toLowerCase()} risk` },
      { action: "Request two fresh citizen checks at the reach", owner: "volunteers", when: "within 48 h", rationale: top.confidenceReason },
      ...(rank >= 2 ? [{ action: "Take an E. coli sample at the reach", owner: "laboratory" as const, when: `before ${top.peak.date}`, rationale: "Confirm the forecast with a lab result" }] : []),
    ],
    evidence: top.factors.slice(0, 4).map((f) => ({ claim: `${f.label}: ${f.detail}`.slice(0, 240), source: f.source, reference: `factor:${f.id}${f.evidence[0] ? ` ${f.evidence[0]}` : ""}` })),
    uncertainties: ["Mock mode: this plan was assembled from templates, not written by the model."],
  });
  emit({ type: "tool_result", id: "mock-submit", name: "submit_response_plan", summary: "Plan ready for human review" });
  emit({ type: "plan", plan });
  return plan;
}
