// Duty-officer agent: a manual tool-use loop on the Claude API. It reads
// StreamReach data through read-only tools, then submits a structured response
// plan. Nothing is published until a human approves it.
import Anthropic from "@anthropic-ai/sdk";
import { getSite } from "../sites";
import { mockRun } from "./mock";
import { ResponsePlan } from "./plan";
import { LANGUAGE, TOOLS, TOOL_LABEL, runTool } from "./tools";

export const AGENT_MODEL = "claude-opus-5-5";
const MAX_TURNS = 10;

export type AgentEvent =
  | { type: "start"; model: string; mode: "live" | "mock" }
  | { type: "note"; text: string }
  | { type: "tool"; id: string; name: string; label: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; summary: string; isError?: boolean }
  | { type: "plan"; plan: ResponsePlan }
  | { type: "error"; message: string };

export type Emit = (e: AgentEvent) => void;

export function agentMode(): "live" | "mock" | "off" {
  if (process.env.STREAMREACH_AGENT_MOCK === "1") return "mock";
  return process.env.ANTHROPIC_API_KEY ? "live" : "off";
}

const SYSTEM = `You are the StreamReach duty-officer assistant for a city public-health team in the EU OneAquaHealth programme.
StreamReach forecasts One Health risks from urban streams (waterborne pathogens after sewer overflows, toxic cyanobacterial blooms, mosquito-borne disease) from citizen stream checks, partner-lab results, anonymous clinic reports and the weather forecast.

Your job: for one stream reach, gather the evidence with your tools and draft a response plan that a human duty officer will review before anything is published.

How to work:
- Start with get_stream_risk. Then look at the observations, clinic signals, weather and other reaches in the city as needed. Call independent tools in parallel.
- Ground every statement in tool results. Quote numbers, dates and observation ids exactly as the tools return them; never invent data. If evidence is thin or stale, say so in uncertainties and lower your confidence rather than overstating risk.
- Match the response to the risk: routine monitoring for low risk, clear precautions for elevated risk, urgent action only when the evidence supports it.
- The public advisory is for residents: calm, specific, plain words, no jargon, max about 90 words, in the reach's local language plus an English version.
- The clinician note is for local GPs: what exposure history to take, what to test for, when to notify public health. Max about 80 words. Do not diagnose individuals.
- Actions must be concrete and owned (public_health, water_utility, laboratory, volunteers, clinicians), with a time frame. Use volunteers to fill data gaps.
- Finish by calling submit_response_plan exactly once. Do not write the plan as text.`;

export async function runAgent(siteId: string, emit: Emit, signal?: AbortSignal): Promise<ResponsePlan | undefined> {
  const site = getSite(siteId);
  if (!site) {
    emit({ type: "error", message: `Unknown reach ${siteId}` });
    return;
  }
  const mode = agentMode();
  if (mode === "off") {
    emit({ type: "error", message: "The AI agent is not configured on this deployment (ANTHROPIC_API_KEY is missing)." });
    return;
  }
  emit({ type: "start", model: mode === "mock" ? "mock" : AGENT_MODEL, mode });
  if (mode === "mock") return mockRun(siteId, emit);

  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `Draft a response plan for reach "${site.id}" (${site.name}, ${site.city}, ${site.country}; local language: ${LANGUAGE[site.countryCode] ?? "English"}). Today is ${today}.`,
    },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let message: Anthropic.Beta.BetaMessage;
    try {
      message = await client.beta.messages.create(
        {
          model: AGENT_MODEL,
          max_tokens: 16000,
          system: SYSTEM,
          tools: TOOLS,
          thinking: { type: "adaptive", display: "updates" },
          output_config: { effort: "medium" },
          betas: ["server-side-fallback-2026-07-01", "thinking-display-updates-2026-08-18"],
          fallbacks: "default",
          messages,
        },
        { signal },
      );
    } catch (e) {
      emit({ type: "error", message: apiErrorMessage(e) });
      return;
    }

    for (const block of message.content) {
      if (block.type === "thinking" && block.thinking.trim()) emit({ type: "note", text: block.thinking.trim() });
      if (block.type === "text" && block.text.trim()) emit({ type: "note", text: block.text.trim() });
    }

    if (message.stop_reason === "refusal") {
      emit({ type: "error", message: "The model declined this request." });
      return;
    }
    if (message.stop_reason === "max_tokens") {
      emit({ type: "error", message: "The draft was cut off (output limit). Try again." });
      return;
    }

    const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    if (toolUses.length === 0) {
      // Ended without submitting: ask once more, keeping the history append-only.
      messages.push({ role: "assistant", content: message.content });
      messages.push({ role: "user", content: "Please submit the plan now with submit_response_plan." });
      continue;
    }

    messages.push({ role: "assistant", content: message.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let submitted: ResponsePlan | undefined;

    for (const tu of toolUses) {
      emit({ type: "tool", id: tu.id, name: tu.name, label: TOOL_LABEL[tu.name] ?? tu.name, input: tu.input });
      if (tu.name === "submit_response_plan") {
        const parsed = ResponsePlan.safeParse(tu.input);
        if (parsed.success) {
          submitted = parsed.data;
          emit({ type: "tool_result", id: tu.id, name: tu.name, summary: "Plan ready for human review" });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: "Received. A human duty officer will review it." });
        } else {
          const why = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
          emit({ type: "tool_result", id: tu.id, name: tu.name, summary: `Plan rejected by validation (${why}); revising`, isError: true });
          results.push({ type: "tool_result", tool_use_id: tu.id, is_error: true, content: `Plan failed validation: ${why}. Fix and submit again.` });
        }
        continue;
      }
      const out = await runTool(tu.name, tu.input);
      emit({ type: "tool_result", id: tu.id, name: tu.name, summary: out.summary, isError: out.isError });
      results.push({ type: "tool_result", tool_use_id: tu.id, content: out.content, ...(out.isError ? { is_error: true } : {}) });
    }

    if (submitted) {
      emit({ type: "plan", plan: submitted });
      return submitted;
    }
    messages.push({ role: "user", content: results });
  }
  emit({ type: "error", message: "The agent did not finish within its step limit. Try again." });
}

function apiErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The AI service rejected the API key.";
  if (e instanceof Anthropic.RateLimitError) return "The AI service is busy (rate limited). Try again in a minute.";
  if (e instanceof Anthropic.APIUserAbortError) return "Cancelled.";
  if (e instanceof Anthropic.APIConnectionError) return "Could not reach the AI service.";
  if (e instanceof Anthropic.APIError) return `The AI service returned an error (${e.status ?? "unknown"}).`;
  return "The agent failed unexpectedly.";
}
