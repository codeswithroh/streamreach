// CDS Hooks 2.0 service: pushes stream-exposure risk into the clinician's EHR
// when a patient chart is opened (patient-view), and reads clinician feedback
// back into the risk engine as an anonymous syndromic signal. That closes the
// One Health loop from stream to clinic and back.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { SYNDROMES, SCT, LOINC } from "../codes";
import { LEVELS, LEVEL_LABEL, type HazardAssessment } from "../risk/engine";
import { allSiteBundles, type SiteBundle } from "../risk/service";
import { distanceKm } from "../sites";
import { addSignal } from "../store";
import type { ClinicalSignal, HazardId } from "../types";

export const SERVICE_ID = "tributary-stream-exposure";

export const DISCOVERY = {
  services: [
    {
      hook: "patient-view",
      id: SERVICE_ID,
      title: "Tributary: urban stream exposure risk",
      description:
        "Warns when a patient lives near an urban stream with elevated waterborne-pathogen, toxic-algae or mosquito-borne risk (OneAquaHealth citizen science + weather forecast). Links matching symptoms to likely exposures and suggests work-up.",
      prefetch: {
        patient: "Patient/{{context.patientId}}",
        conditions: "Condition?patient={{context.patientId}}",
      },
      usageRequirements:
        "Patient.address should carry the FHIR geolocation extension or a city. Feedback on the 'report' suggestion shares an anonymous, reach-level count and never the patient identity.",
    },
  ],
};

const HAZARD_SYNDROME: Record<HazardId, ClinicalSignal["syndrome"][]> = {
  waterborne: ["gastrointestinal"],
  cyanobacteria: ["gastrointestinal", "skin-rash"],
  vector: ["febrile", "skin-rash"],
};

const SYNDROME_LABEL: Record<ClinicalSignal["syndrome"], string> = {
  gastrointestinal: "gastrointestinal symptoms",
  "skin-rash": "skin rash",
  febrile: "fever",
};

interface CardMeta {
  siteId: string;
  district: string;
  hazard: HazardId;
  syndrome?: ClinicalSignal["syndrome"];
}
const g = globalThis as unknown as { __tribCards?: Map<string, CardMeta> };
const cardIndex = () => (g.__tribCards ??= new Map());

export interface PatientLocation {
  lat?: number;
  lon?: number;
  city?: string;
  demoFallback: boolean;
  label: string;
}

export function locatePatient(patient: any): PatientLocation {
  for (const a of patient?.address ?? []) {
    const geo = a.extension?.find((e: any) => e.url === "http://hl7.org/fhir/StructureDefinition/geolocation");
    const lat = geo?.extension?.find((e: any) => e.url === "latitude")?.valueDecimal;
    const lon = geo?.extension?.find((e: any) => e.url === "longitude")?.valueDecimal;
    if (typeof lat === "number" && typeof lon === "number")
      return { lat, lon, city: a.city, demoFallback: false, label: [a.line?.[0], a.city].filter(Boolean).join(", ") };
  }
  const city = patient?.address?.find((a: any) => a.city)?.city;
  if (city) return { city, demoFallback: false, label: city };
  const fallback = process.env.TRIBUTARY_DEMO_CITY ?? "Heraklion";
  return { city: fallback, demoFallback: true, label: `${fallback} (demo default: no address on record)` };
}

export function patientSyndromes(conditions: any[]): Set<ClinicalSignal["syndrome"]> {
  const out = new Set<ClinicalSignal["syndrome"]>();
  const text = (c: any) => `${c.code?.text ?? ""} ${(c.code?.coding ?? []).map((x: any) => x.display ?? "").join(" ")}`.toLowerCase();
  for (const c of conditions) {
    const status = c.clinicalStatus?.coding?.[0]?.code;
    if (status && !["active", "recurrence", "relapse"].includes(status)) continue;
    const codes = (c.code?.coding ?? []).filter((x: any) => x.system === SCT).map((x: any) => x.code);
    for (const [syn, list] of Object.entries(SYNDROMES) as [ClinicalSignal["syndrome"], readonly { code: string }[]][]) {
      if (list.some((x) => codes.includes(x.code))) out.add(syn);
    }
    const t = text(c);
    if (/diarrh|gastro|vomit|enteritis|abdominal pain|nausea/.test(t)) out.add("gastrointestinal");
    if (/rash|dermatitis|eruption/.test(t)) out.add("skin-rash");
    if (/fever|febrile|pyrexia|meningitis|encephalitis/.test(t)) out.add("febrile");
  }
  return out;
}

function nearby(bundles: SiteBundle[], loc: PatientLocation) {
  return bundles
    .map((b) => {
      const d = loc.lat != null && loc.lon != null ? distanceKm(loc.lat, loc.lon, b.site.lat, b.site.lon) : undefined;
      const sameCity = loc.city && b.site.city.toLowerCase() === loc.city.toLowerCase();
      return { b, d, near: d != null ? d <= 5 : !!sameCity };
    })
    .filter((x) => x.near)
    .sort((a, b) => (a.d ?? 99) - (b.d ?? 99));
}

const rank = (h: HazardAssessment) => LEVELS.indexOf(h.peak.level);
const pct = (p: number) => `${Math.round(p * 100)}%`;

export async function patientViewCards(req: any, appBase: string) {
  let patient = req.prefetch?.patient;
  let conditions: any[] = (req.prefetch?.conditions?.entry ?? []).map((e: any) => e.resource).filter(Boolean);

  // Spec: if prefetch is absent the service may query the EHR's FHIR server itself.
  if (!patient && req.fhirServer && req.context?.patientId) {
    const headers: Record<string, string> = { Accept: "application/fhir+json" };
    if (req.fhirAuthorization?.access_token) headers.Authorization = `Bearer ${req.fhirAuthorization.access_token}`;
    try {
      const [p, c] = await Promise.all([
        fetch(`${req.fhirServer}/Patient/${req.context.patientId}`, { headers }).then((r) => r.json()),
        fetch(`${req.fhirServer}/Condition?patient=${req.context.patientId}`, { headers }).then((r) => r.json()),
      ]);
      patient = p;
      conditions = (c.entry ?? []).map((e: any) => e.resource);
    } catch {
      /* fall through with what we have */
    }
  }

  const loc = locatePatient(patient);
  const syndromes = patientSyndromes(conditions);
  const bundles = await allSiteBundles();
  const near = nearby(bundles, loc);

  type Candidate = { b: SiteBundle; d?: number; h: HazardAssessment; match?: ClinicalSignal["syndrome"] };
  const candidates: Candidate[] = [];
  for (const { b, d } of near) {
    for (const h of b.risk.hazards) {
      const match = HAZARD_SYNDROME[h.hazard].find((s) => syndromes.has(s));
      const threshold = match ? 1 : 2; // with matching symptoms, moderate is enough; otherwise only high+
      if (rank(h) >= threshold) candidates.push({ b, d, h, match });
    }
  }
  // Alert-fatigue guard: at most two cards, symptom-matched first, then by severity.
  candidates.sort((x, y) => Number(!!y.match) - Number(!!x.match) || rank(y.h) - rank(x.h) || y.h.peak.p - x.h.peak.p);
  const seen = new Set<string>();
  const chosen = candidates.filter((c) => {
    const k = `${c.h.hazard}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 2);

  const cards = chosen.map((c) => buildCard(c, loc, req, appBase));
  return { cards, _meta: { location: loc, syndromes: [...syndromes], sitesConsidered: near.length } };
}

function buildCard(
  c: { b: SiteBundle; d?: number; h: HazardAssessment; match?: ClinicalSignal["syndrome"] },
  loc: PatientLocation,
  req: any,
  appBase: string,
) {
  const { b, d, h, match } = c;
  const uuid = crypto.randomUUID();
  cardIndex().set(uuid, { siteId: b.site.id, district: b.site.district, hazard: h.hazard, syndrome: match });
  const where = d != null ? `${d.toFixed(1)} km from ${b.site.name}` : `near ${b.site.name}, ${b.site.city}`;
  const lvl = LEVEL_LABEL[h.peak.level].toLowerCase();
  const indicator = match ? (rank(h) >= 2 ? "warning" : "info") : rank(h) >= 3 ? "warning" : "info";

  const summary = match
    ? `${cap(SYNDROME_LABEL[match])} + ${lvl} ${h.label.toLowerCase()} risk at a stream ${d != null ? `${d.toFixed(1)} km` : ""} from home`
    : `Patient lives ${where}: ${lvl} ${h.label.toLowerCase()} risk this week`;

  const top = h.factors.filter((f) => f.contribution > 0.15).slice(0, 3);
  const detail = [
    `**${b.site.name}** (${b.site.river}, ${b.site.city}): **${LEVEL_LABEL[h.peak.level]}** (${pct(h.peak.p)}) peaking ${h.peak.date}.`,
    "",
    "**Why:**",
    ...top.map((f) => `- ${f.label}: ${f.detail}`),
    "",
    `**Clinical note:** ${h.clinicalAdvice}`,
    "",
    `**Patient advice:** ${h.publicAdvice}`,
    "",
    `_Confidence ${h.confidence}: ${h.confidenceReason}. Stream used for: ${b.site.uses}. ${loc.demoFallback ? "Location defaulted for demo." : ""}_`,
  ].join("\n");

  const suggestions: any[] = [];
  const patientRef = req.context?.patientId ? { reference: `Patient/${req.context.patientId}` } : undefined;
  if (match && h.hazard === "waterborne") {
    suggestions.push({
      label: "Order stool culture (enteric pathogens)",
      uuid: crypto.randomUUID(),
      actions: [
        {
          type: "create",
          description: "Draft stool culture order",
          resource: {
            resourceType: "ServiceRequest",
            status: "draft",
            intent: "proposal",
            code: { coding: [{ system: LOINC, code: "625-4", display: "Bacteria identified in Stool by Culture" }] },
            subject: patientRef,
            reasonCode: [{ text: `Gastroenteritis with possible exposure to ${b.site.name} (Tributary ${lvl} waterborne risk)` }],
          },
        },
      ],
    });
  }
  if (match) {
    const reportId = crypto.randomUUID();
    cardIndex().set(reportId, { siteId: b.site.id, district: b.site.district, hazard: h.hazard, syndrome: match });
    suggestions.push({
      label: "Share anonymous stream-linked case with OneAquaHealth",
      uuid: reportId,
    });
  }

  return {
    uuid,
    summary: summary.slice(0, 140),
    detail,
    indicator,
    source: {
      label: "Tributary · OneAquaHealth citizen science + forecast",
      url: `${appBase}/sites/${b.site.id}`,
      topic: { system: "https://tributary.health/fhir/CodeSystem/stream-hazard", code: h.hazard, display: h.label },
    },
    ...(suggestions.length ? { suggestions, selectionBehavior: "any" } : {}),
    ...(indicator === "warning"
      ? {
          overrideReasons: [
            { code: "no-exposure", system: "https://tributary.health/fhir/CodeSystem/override", display: "Patient reports no stream contact" },
            { code: "alt-dx", system: "https://tributary.health/fhir/CodeSystem/override", display: "Alternative cause confirmed" },
          ],
        }
      : {}),
    links: [{ label: "Open stream health record", url: `${appBase}/sites/${b.site.id}`, type: "absolute" }],
  };
}

/** CDS Hooks feedback: accepted "share" suggestions become anonymous syndromic signals. */
export function handleFeedback(body: any) {
  let recorded = 0;
  for (const fb of body?.feedback ?? []) {
    if (fb.outcome !== "accepted") continue;
    for (const s of fb.acceptedSuggestions ?? []) {
      const meta = cardIndex().get(s.id);
      if (!meta?.syndrome) continue;
      addSignal({
        siteId: meta.siteId,
        district: meta.district,
        date: (fb.outcomeTimestamp ?? new Date().toISOString()).slice(0, 10),
        syndrome: meta.syndrome,
        source: "cds-feedback",
      });
      cardIndex().delete(s.id);
      recorded++;
    }
  }
  return recorded;
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
