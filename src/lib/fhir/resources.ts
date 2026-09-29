// Projection of the domain model to FHIR R4 (4.0.1), conforming to the
// OneAquaHealth IG profiles where one exists and to StreamReach's small
// extension profiles otherwise.

/* eslint-disable @typescript-eslint/no-explicit-any */
import { LEVELS, type HazardAssessment, type SiteRisk } from "../risk/engine";
import type { Site } from "../sites";
import type { ClinicalSignal, HazardId, StreamObservation } from "../types";
import {
  OAH_CS,
  OAH_DISPLAY,
  OAH_LOCATION_ID_SYSTEM,
  OAH_PROFILE,
  SCT,
  TRIB,
  TRIB_CS,
  TRIB_PROFILE,
} from "../codes";

export type Resource = Record<string, any> & { resourceType: string; id?: string };

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Human-readable narrative (dom-6). */
export function narrative(text: string) {
  return { status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${esc(text)}</p></div>` };
}

export function locationResource(site: Site): Resource {
  return {
    resourceType: "Location",
    id: site.id,
    meta: { profile: [OAH_PROFILE.location] },
    text: narrative(`${site.name}: ${site.river} stream reach in ${site.city}, ${site.country}`),
    identifier: [{ system: OAH_LOCATION_ID_SYSTEM, value: site.id }],
    status: "active",
    name: site.name,
    description: `${site.river} stream reach, ${site.city} (${site.country}). ${site.source === "oah-ig" ? "Coordinates from the OneAquaHealth IG." : "StreamReach demo reach."}`,
    mode: "instance",
    type: [{ coding: [{ system: SCT, code: "420531007", display: "River" }] }],
    address: { city: site.city, district: site.district, country: site.countryCode },
    position: { longitude: site.lon, latitude: site.lat },
  };
}

export function exposedCohortId(siteId: string) {
  return `cohort-${siteId}`;
}

/** People living near or using the reach: the population a RiskAssessment is about. */
export function cohortResource(site: Site): Resource {
  return {
    resourceType: "Group",
    id: exposedCohortId(site.id),
    meta: { profile: [OAH_PROFILE.group, TRIB_PROFILE.exposedCohort] },
    text: narrative(`People living within 1 km of ${site.name} (~${site.vulnerability.residentsWithin1km})`),
    type: "person",
    actual: false,
    name: `People living within 1 km of ${site.name}`,
    quantity: site.vulnerability.residentsWithin1km,
    characteristic: [
      {
        code: { coding: [{ system: SCT, code: "20733006", display: "Living place" }] },
        valueReference: { reference: `Location/${site.id}`, display: site.name },
        exclude: false,
      },
    ],
  };
}

export function observationResource(o: StreamObservation): Resource {
  const value =
    o.value.kind === "coded"
      ? { valueCodeableConcept: { coding: [{ system: o.value.system, code: o.value.code, display: o.value.display }] } }
      : {
          valueQuantity: { value: o.value.value, unit: o.value.unit, system: "http://unitsofmeasure.org", code: o.value.ucum },
        };
  return {
    resourceType: "Observation",
    id: o.id,
    meta: {
      profile: [OAH_PROFILE.indicator],
      tag:
        o.performer.kind === "citizen"
          ? [{ system: `${TRIB}/CodeSystem/data-origin`, code: o.status === "final" ? "citizen-verified" : "citizen-unverified" }]
          : [{ system: `${TRIB}/CodeSystem/data-origin`, code: "laboratory" }],
    },
    text: narrative(
      `${OAH_DISPLAY[o.code]} at ${o.siteId}: ${o.value.kind === "coded" ? o.value.display : `${o.value.value} ${o.value.unit}`} (${o.performer.display}, ${o.effective.slice(0, 10)})`,
    ),
    // The OAH indicator profile fixes status to "final"; verification state travels in meta.tag + Provenance.
    status: "final",
    category: [
      {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/observation-category",
            code: o.performer.kind === "lab" ? "laboratory" : "survey",
          },
        ],
      },
    ],
    code: { coding: [{ system: OAH_CS, code: o.code, display: OAH_DISPLAY[o.code] }] },
    subject: { reference: `Location/${o.siteId}` },
    effectiveDateTime: o.effective,
    performer: [
      o.performer.kind === "citizen"
        ? { identifier: { system: TRIB_CS.volunteer, value: o.performer.id }, display: o.performer.display }
        : { display: o.performer.display },
    ],
    ...value,
    ...(o.note ? { note: [{ text: o.note }] } : {}),
  };
}

export function provenanceResource(o: StreamObservation): Resource {
  return {
    resourceType: "Provenance",
    id: `prov-${o.id}`,
    text: narrative(`Observation ${o.id} recorded by ${o.performer.display}`),
    target: [{ reference: `Observation/${o.id}` }],
    recorded: o.effective,
    activity: {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-DataOperation", code: "CREATE" }],
    },
    agent: [
      {
        type: {
          coding: [{ system: "http://terminology.hl7.org/CodeSystem/provenance-participant-type", code: "author" }],
        },
        who:
          o.performer.kind === "citizen"
            ? { identifier: { system: TRIB_CS.volunteer, value: o.performer.id }, display: `${o.performer.display} (pseudonymous)` }
            : { display: o.performer.display },
      },
    ],
    ...(o.performer.kind === "citizen"
      ? { policy: ["https://streamreach.io/policy/citizen-data-pseudonymous"] }
      : {}),
  };
}

const QUAL: Record<string, { code: string; display: string }> = {
  low: { code: "low", display: "Low likelihood" },
  moderate: { code: "moderate", display: "Moderate likelihood" },
  high: { code: "high", display: "High likelihood" },
  "very-high": { code: "high", display: "High likelihood" },
};

export const HAZARD_DISPLAY: Record<HazardId, string> = {
  waterborne: "Waterborne enteric pathogen exposure",
  cyanobacteria: "Cyanobacterial toxin exposure",
  vector: "Mosquito-borne arbovirus exposure",
};

export function riskAssessmentId(siteId: string, hazard: HazardId) {
  return `risk-${siteId}-${hazard}`;
}

export function riskAssessmentResource(site: Site, risk: SiteRisk, h: HazardAssessment): Resource {
  const hazardCode = { system: TRIB_CS.hazard, code: h.hazard, display: HAZARD_DISPLAY[h.hazard] };
  const evidence = [...new Set(h.factors.flatMap((f) => f.evidence))];
  const upcoming = h.timeline.filter((d) => d.date >= h.now.date);
  return {
    resourceType: "RiskAssessment",
    id: riskAssessmentId(site.id, h.hazard),
    meta: { profile: [TRIB_PROFILE.riskAssessment], lastUpdated: risk.computedAt },
    text: narrative(
      `${HAZARD_DISPLAY[h.hazard]} near ${site.name}: ${h.peak.level} (${Math.round(h.peak.p * 100)}%) peaking ${h.peak.date}. ${h.factors
        .slice(0, 3)
        .map((f) => f.label)
        .join(", ")}.`,
    ),
    status: "final",
    method: {
      coding: [{ system: `${TRIB}/CodeSystem/risk-method`, code: "streamreach-logit-v1", display: "StreamReach explainable logistic model v1" }],
    },
    code: { coding: [hazardCode] },
    subject: { reference: `Group/${exposedCohortId(site.id)}`, display: `People living within 1 km of ${site.name}` },
    occurrenceDateTime: risk.computedAt,
    extension: [
      {
        url: `${TRIB}/StructureDefinition/assessed-location`,
        valueReference: { reference: `Location/${site.id}`, display: site.name },
      },
      {
        url: `${TRIB}/StructureDefinition/assessment-confidence`,
        valueCodeableConcept: { coding: [{ system: `${TRIB}/CodeSystem/confidence`, code: h.confidence }], text: h.confidenceReason },
      },
      ...h.factors.map((f) => ({
        url: `${TRIB}/StructureDefinition/risk-factor`,
        extension: [
          { url: "factor", valueCoding: { system: TRIB_CS.riskFactor, code: f.id, display: f.label } },
          { url: "source", valueCode: f.source },
          { url: "value", valueDecimal: round(f.value) },
          { url: "weight", valueDecimal: f.weight },
          { url: "contribution", valueDecimal: round(f.contribution) },
          { url: "explanation", valueString: f.detail },
        ],
      })),
    ],
    basis: [
      { reference: `Location/${site.id}` },
      ...evidence.filter((e) => e.startsWith("obs-")).map((e) => ({ reference: `Observation/${e}` })),
      ...(evidence.some((e) => e.startsWith("sig-")) ? [{ reference: `Observation/health-${site.id}-gastrointestinal` }] : []),
    ],
    prediction: upcoming.map((d) => ({
      outcome: { coding: [hazardCode] },
      probabilityDecimal: round(d.p),
      qualitativeRisk: {
        coding: [{ system: "http://terminology.hl7.org/CodeSystem/risk-probability", ...QUAL[d.level] }],
        text: d.level,
      },
      whenPeriod: { start: `${d.date}T00:00:00Z`, end: `${d.date}T23:59:59Z` },
      rationale: d.forecast ? "Forecast weather + latest observations" : "Observed weather + latest observations",
    })),
    mitigation: `Public: ${h.publicAdvice} Clinical: ${h.clinicalAdvice}`,
    note: [{ text: `Peak ${LEVELS.includes(h.peak.level) ? h.peak.level : ""} on ${h.peak.date}. Weather source: ${risk.weatherSource}.` }],
  };
}

/** Aggregated anonymous clinic signal, as an OAH health-measure Observation. */
export function healthSignalResource(site: Site, signals: ClinicalSignal[]): Resource {
  const gi = signals.filter((s) => s.syndrome === "gastrointestinal");
  const end = new Date();
  const start = new Date(end.getTime() - 14 * 86_400_000);
  const recent = gi.filter((s) => new Date(s.date) >= start);
  return {
    resourceType: "Observation",
    id: `health-${site.id}-gastrointestinal`,
    meta: { profile: [OAH_PROFILE.healthMeasure] },
    status: "final",
    code: { coding: [{ system: OAH_CS, code: "gastrointestinal", display: OAH_DISPLAY.gastrointestinal }] },
    subject: { reference: `Location/${site.id}` },
    focus: [{ reference: `Group/${exposedCohortId(site.id)}` }],
    performer: [{ display: "StreamReach CDS Hooks feedback aggregator" }],
    text: narrative(`${recent.length} anonymous stream-linked gastrointestinal presentations near ${site.name} in 14 days`),
    effectivePeriod: { start: start.toISOString(), end: end.toISOString() },
    valueQuantity: {
      value: round((recent.length / site.vulnerability.residentsWithin1km) * 100_000),
      unit: "cases per 100 000 (14 d)",
      system: "http://unitsofmeasure.org",
      code: "{cases}/100000",
    },
    note: [{ text: `${recent.length} clinician-reported presentations with stream exposure (anonymous, via CDS Hooks feedback).` }],
  };
}

export function bundle(type: "searchset" | "collection" | "transaction-response", resources: Resource[], base: string): Resource {
  return {
    resourceType: "Bundle",
    type,
    timestamp: new Date().toISOString(),
    ...(type === "searchset" ? { total: resources.length } : {}),
    entry: resources.map((r) => ({
      fullUrl: `${base}/${r.resourceType}/${r.id}`,
      resource: r,
      ...(type === "searchset" ? { search: { mode: "match" } } : {}),
    })),
  };
}

function round(x: number) {
  return Math.round(x * 1000) / 1000;
}

// ------------------------------------------------ AI-drafted, human-approved advisories

interface PlanLike {
  id: string;
  siteId: string;
  model: string;
  createdAt: string;
  decidedAt?: string;
  decidedBy?: string;
  plan: {
    headline: string;
    priority: "routine" | "elevated" | "urgent";
    public_advisory: { language: string; local_text: string; english_text: string };
    clinician_note: string;
  };
}

const FHIR_PRIORITY = { routine: "routine", elevated: "urgent", urgent: "asap" } as const;

/** An approved response plan's public advisory, as a FHIR Communication to the exposed cohort. */
export function communicationResource(site: Site, p: PlanLike): Resource {
  return {
    resourceType: "Communication",
    id: p.id,
    text: narrative(`${p.plan.headline}. ${p.plan.public_advisory.english_text}`),
    status: "completed",
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/communication-category", code: "alert", display: "Alert" }] }],
    priority: FHIR_PRIORITY[p.plan.priority],
    subject: { reference: `Group/${exposedCohortId(site.id)}`, display: `People living within 1 km of ${site.name}` },
    about: [{ reference: `Location/${site.id}`, display: site.name }],
    topic: { text: p.plan.headline },
    sent: p.decidedAt,
    sender: { display: `Public health duty officer: ${p.decidedBy}` },
    payload: [
      { contentString: p.plan.public_advisory.local_text },
      { contentString: p.plan.public_advisory.english_text },
    ],
    note: [
      { text: `Clinician note: ${p.plan.clinician_note}` },
      { text: `Drafted by the StreamReach duty-officer agent (${p.model}) on ${p.createdAt}; reviewed and approved by ${p.decidedBy} on ${p.decidedAt}.` },
    ],
  };
}

/** Who made the advisory: the AI agent authored it, a named human verified it. */
export function planProvenanceResource(p: PlanLike): Resource {
  const role = (code: string) => ({ coding: [{ system: "http://terminology.hl7.org/CodeSystem/provenance-participant-type", code }] });
  return {
    resourceType: "Provenance",
    id: `prov-${p.id}`,
    text: narrative(`Communication ${p.id}: drafted by an AI agent (${p.model}), approved by ${p.decidedBy}`),
    target: [{ reference: `Communication/${p.id}` }],
    occurredPeriod: { start: p.createdAt, end: p.decidedAt },
    recorded: p.decidedAt ?? p.createdAt,
    activity: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-DataOperation", code: "CREATE" }] },
    agent: [
      { type: role("author"), who: { display: `StreamReach duty-officer agent (${p.model})` } },
      { type: role("verifier"), who: { display: p.decidedBy } },
    ],
    policy: ["https://streamreach.io/policy/ai-drafts-require-human-approval"],
  };
}
