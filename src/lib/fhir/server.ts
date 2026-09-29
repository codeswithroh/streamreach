// Minimal FHIR R4 REST facade over the StreamReach store.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { OAH_CS, TRIB_CS } from "../codes";
import { allSiteBundles, siteBundleById } from "../risk/service";
import { SITES, getSite } from "../sites";
import { addObservations, listPlans, snapshot, type StoredPlan } from "../store";
import type { HazardId, OahIndicatorCode, StreamObservation } from "../types";
import { capabilityStatement, codeSystems } from "./conformance";
import {
  bundle,
  cohortResource,
  communicationResource,
  planProvenanceResource,
  healthSignalResource,
  locationResource,
  observationResource,
  provenanceResource,
  riskAssessmentResource,
  type Resource,
} from "./resources";

export class FhirError extends Error {
  constructor(public status: number, message: string, public code = "processing") {
    super(message);
  }
}

export function operationOutcome(status: number, message: string, code = "processing"): Resource {
  return {
    resourceType: "OperationOutcome",
    issue: [{ severity: status >= 500 ? "fatal" : "error", code, diagnostics: message }],
  };
}

const refId = (ref: string | null, type: string) => (ref ? ref.replace(`${type}/`, "").split("/").pop()! : null);

export async function fhirGet(path: string[], q: URLSearchParams, base: string): Promise<Resource> {
  const [type, id] = path;
  switch (type) {
    case "metadata":
      return capabilityStatement(base);

    case "Location": {
      if (id) {
        const s = getSite(id);
        if (!s) throw new FhirError(404, `Location/${id} not found`, "not-found");
        return locationResource(s);
      }
      return bundle("searchset", SITES.map(locationResource), base);
    }

    case "Group": {
      if (id) {
        const s = SITES.find((x) => `cohort-${x.id}` === id);
        if (!s) throw new FhirError(404, `Group/${id} not found`, "not-found");
        return cohortResource(s);
      }
      return bundle("searchset", SITES.map(cohortResource), base);
    }

    case "Observation": {
      const snap = await snapshot();
      const all = (): Resource[] => [
        ...snap.observations.map(observationResource),
        ...SITES.map((s) => healthSignalResource(s, snap.signals.filter((x) => x.siteId === s.id))),
      ];
      if (id) {
        const r = all().find((x) => x.id === id);
        if (!r) throw new FhirError(404, `Observation/${id} not found`, "not-found");
        return r;
      }
      let rs = all();
      const subj = refId(q.get("subject") ?? q.get("location"), "Location");
      if (subj) rs = rs.filter((r) => r.subject?.reference === `Location/${subj}`);
      const code = q.get("code");
      if (code) {
        const c = code.split("|").pop();
        rs = rs.filter((r) => r.code?.coding?.some((x: any) => x.code === c));
      }
      rs.sort((a, b) => String(b.effectiveDateTime ?? "").localeCompare(String(a.effectiveDateTime ?? "")));
      const count = Number(q.get("_count")) || 100;
      return bundle("searchset", rs.slice(0, count), base);
    }

    case "Communication": {
      const approved = (await listPlans()).filter((p) => p.status === "approved");
      const toRes = (p: StoredPlan) => communicationResource(getSite(p.siteId)!, p as Parameters<typeof communicationResource>[1]);
      if (id) {
        const p = approved.find((x) => x.id === id);
        if (!p) throw new FhirError(404, `Communication/${id} not found`, "not-found");
        return toRes(p);
      }
      const about = refId(q.get("about") ?? q.get("location"), "Location");
      return bundle("searchset", approved.filter((p) => !about || p.siteId === about).map(toRes), base);
    }

    case "Provenance": {
      const commTarget = q.get("target")?.startsWith("Communication/") ? q.get("target")!.split("/")[1] : id?.startsWith("prov-plan-") ? id.slice(5) : undefined;
      if (commTarget) {
        const p = (await listPlans()).find((x) => x.id === commTarget && x.status === "approved");
        if (!p) throw new FhirError(404, `Provenance for Communication/${commTarget} not found`, "not-found");
        const r = planProvenanceResource(p as Parameters<typeof planProvenanceResource>[0]);
        return id ? r : bundle("searchset", [r], base);
      }
      const target = refId(q.get("target"), "Observation");
      const obs = (await snapshot()).observations.filter((o) => (id ? `prov-${o.id}` === id : target ? o.id === target : true));
      if (id && !obs.length) throw new FhirError(404, `Provenance/${id} not found`, "not-found");
      const rs = obs.slice(0, 200).map(provenanceResource);
      return id ? rs[0] : bundle("searchset", rs, base);
    }

    case "RiskAssessment": {
      if (id) {
        const m = /^risk-(.+)-(waterborne|cyanobacteria|vector)$/.exec(id);
        const sb = m && (await siteBundleById(m[1]));
        const h = sb?.risk.hazards.find((x) => x.hazard === (m![2] as HazardId));
        if (!sb || !h) throw new FhirError(404, `RiskAssessment/${id} not found`, "not-found");
        return riskAssessmentResource(sb.site, sb.risk, h);
      }
      const loc = refId(q.get("location"), "Location");
      const subj = refId(q.get("subject"), "Group");
      const code = q.get("code")?.split("|").pop();
      const bundles = await allSiteBundles();
      const rs = bundles
        .filter((b) => (!loc || b.site.id === loc) && (!subj || `cohort-${b.site.id}` === subj))
        .flatMap((b) => b.risk.hazards.filter((h) => !code || h.hazard === code).map((h) => riskAssessmentResource(b.site, b.risk, h)));
      return bundle("searchset", rs, base);
    }

    case "CodeSystem": {
      const cs = codeSystems();
      if (id) {
        const r = cs.find((c) => c.id === id);
        if (!r) throw new FhirError(404, `CodeSystem/${id} not found`, "not-found");
        return r;
      }
      return bundle("searchset", cs, base);
    }
  }
  throw new FhirError(404, `Unsupported resource type ${type}`, "not-supported");
}

const OAH_CODES: OahIndicatorCode[] = ["foam", "diptera", "waterTemperature", "hydrology", "filamentous-algae", "coliforms"];

/** Parse an incoming OAH indicator Observation into the domain model. */
export function parseObservation(r: any, performer?: { id: string; display: string }): Omit<StreamObservation, "id"> {
  if (r?.resourceType !== "Observation") throw new FhirError(400, "Expected an Observation", "invalid");
  const coding = r.code?.coding?.find((c: any) => c.system === OAH_CS);
  if (!coding || !OAH_CODES.includes(coding.code))
    throw new FhirError(422, `Observation.code must be one of ${OAH_CODES.join(", ")} from ${OAH_CS}`, "code-invalid");
  const siteId = refId(r.subject?.reference ?? null, "Location");
  if (!siteId || !getSite(siteId)) throw new FhirError(422, "Observation.subject must reference a known Location", "invalid");
  let value: StreamObservation["value"];
  if (r.valueQuantity) {
    value = { kind: "quantity", value: Number(r.valueQuantity.value), unit: r.valueQuantity.unit ?? "", ucum: r.valueQuantity.code ?? "" };
  } else if (r.valueCodeableConcept?.coding?.[0]) {
    const c = r.valueCodeableConcept.coding[0];
    if (![OAH_CS, TRIB_CS.flowState].includes(c.system)) throw new FhirError(422, `Unsupported value system ${c.system}`, "code-invalid");
    value = { kind: "coded", system: c.system, code: c.code, display: c.display ?? c.code };
  } else throw new FhirError(422, "Observation.value[x] is required (CodeableConcept or Quantity)", "required");
  const volunteer = performer?.id ?? r.performer?.[0]?.identifier?.value ?? "anonymous";
  return {
    siteId,
    effective: r.effectiveDateTime ?? new Date().toISOString(),
    code: coding.code,
    value,
    performer: { kind: "citizen", id: volunteer, display: `Volunteer ${volunteer}` },
    status: "preliminary",
    note: r.note?.[0]?.text,
  };
}

export async function fhirPost(path: string[], body: any, performer?: { id: string; display: string }): Promise<{ status: number; body: Resource }> {
  const [type] = path;
  if (type === "Observation" || (!type && body?.resourceType === "Observation")) {
    const [created] = await addObservations([parseObservation(body, performer)]);
    return { status: 201, body: observationResource(created) };
  }
  if (!type && body?.resourceType === "Bundle" && (body.type === "transaction" || body.type === "batch")) {
    const parsed = (body.entry ?? []).map((e: any) => parseObservation(e.resource, performer));
    const created = await addObservations(parsed);
    return {
      status: 200,
      body: {
        resourceType: "Bundle",
        type: `${body.type}-response`,
        entry: created.map((o) => ({
          response: { status: "201 Created", location: `Observation/${o.id}/_history/1` },
          resource: observationResource(o),
        })),
      },
    };
  }
  throw new FhirError(405, "Only Observation create and transaction Bundles of Observations are supported", "not-supported");
}

