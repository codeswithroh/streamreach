// The response plan the duty-officer agent must submit, as a zod schema (for
// validation) and a strict JSON schema (for the submit tool).
import { z } from "zod";

export const OWNERS = ["public_health", "water_utility", "laboratory", "volunteers", "clinicians"] as const;
export const SOURCES = ["forecast", "weather", "citizen", "lab", "clinic", "site"] as const;
export const PRIORITIES = ["routine", "elevated", "urgent"] as const;

export const ResponsePlan = z.object({
  headline: z.string().min(1).max(800),
  priority: z.enum(PRIORITIES),
  situation: z.string().min(1).max(3000),
  public_advisory: z.object({
    language: z.string().min(1),
    local_text: z.string().min(1).max(3000),
    english_text: z.string().min(1).max(3000),
  }),
  clinician_note: z.string().min(1).max(2000),
  actions: z
    .array(
      z.object({
        action: z.string().min(1).max(600),
        owner: z.enum(OWNERS),
        when: z.string().min(1).max(120),
        rationale: z.string().min(1).max(800),
      }),
    )
    .min(1)
    .max(6),
  evidence: z
    .array(
      z.object({
        claim: z.string().min(1).max(600),
        source: z.enum(SOURCES),
        reference: z.string().min(1).max(800),
      }),
    )
    .min(1)
    .max(10),
  uncertainties: z.array(z.string().min(1).max(600)).max(5),
});

export type ResponsePlan = z.infer<typeof ResponsePlan>;

const str = { type: "string" } as const;

/** Strict JSON schema for the submit tool (every object closed, every field required). */
export const RESPONSE_PLAN_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "priority", "situation", "public_advisory", "clinician_note", "actions", "evidence", "uncertainties"],
  properties: {
    headline: { ...str, description: "One line, max ~15 words, what is happening and where." },
    priority: { type: "string", enum: [...PRIORITIES] },
    situation: { ...str, description: "3-5 sentences (under 700 characters) for the public-health team. Every number must come from a tool result." },
    public_advisory: {
      type: "object",
      additionalProperties: false,
      required: ["language", "local_text", "english_text"],
      properties: {
        language: { ...str, description: "Name of the local language, e.g. Greek." },
        local_text: { ...str, description: "Plain-language advisory for residents in the local language, max ~90 words." },
        english_text: { ...str, description: "The same advisory in English." },
      },
    },
    clinician_note: { ...str, description: "Note for local GPs, max ~80 words: what to ask, what to test, when to notify." },
    actions: {
      type: "array",
      description: "1-6 concrete, prioritised actions.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "owner", "when", "rationale"],
        properties: {
          action: str,
          owner: { type: "string", enum: [...OWNERS] },
          when: { ...str, description: "e.g. 'today', 'before Thu 1 Oct', 'within 48 h'" },
          rationale: str,
        },
      },
    },
    evidence: {
      type: "array",
      description: "1-10 claims, each tied to the tool data that supports it.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "source", "reference"],
        properties: {
          claim: str,
          source: { type: "string", enum: [...SOURCES] },
          reference: { ...str, description: "Observation id, factor id, date or signal count from the tool results." },
        },
      },
    },
    uncertainties: { type: "array", items: str, description: "0-5 things the data cannot tell us." },
  },
} as const;
