import { FLOW_DISPLAY, OAH_PROFILE, TRIB, TRIB_CS, TRIB_PROFILE } from "../codes";
import { HAZARD_DISPLAY, type Resource } from "./resources";

export function capabilityStatement(base: string): Resource {
  const read = [{ code: "read" }, { code: "search-type" }];
  return {
    resourceType: "CapabilityStatement",
    id: "tributary",
    url: `${TRIB}/CapabilityStatement/tributary`,
    name: "TributaryServer",
    title: "Tributary One Health early-warning FHIR server",
    status: "active",
    date: "2026-09-28",
    kind: "instance",
    software: { name: "Tributary", version: "0.1.0" },
    implementation: { description: "Tributary stream risk server", url: base },
    fhirVersion: "4.0.1",
    format: ["application/fhir+json"],
    implementationGuide: ["http://hl7.eu/fhir/ig/oah/ImplementationGuide/hl7.eu.fhir.oah"],
    rest: [
      {
        mode: "server",
        interaction: [{ code: "transaction" }],
        resource: [
          { type: "Location", supportedProfile: [OAH_PROFILE.location], interaction: read },
          {
            type: "Observation",
            supportedProfile: [OAH_PROFILE.indicator, OAH_PROFILE.healthMeasure],
            interaction: [...read, { code: "create" }],
            searchParam: [
              { name: "subject", type: "reference" },
              { name: "code", type: "token" },
              { name: "_count", type: "number" },
            ],
          },
          {
            type: "RiskAssessment",
            supportedProfile: [TRIB_PROFILE.riskAssessment],
            interaction: read,
            searchParam: [
              { name: "subject", type: "reference" },
              { name: "code", type: "token" },
              { name: "location", type: "reference", documentation: "Tributary: the assessed stream reach" },
            ],
          },
          { type: "Group", supportedProfile: [OAH_PROFILE.group, TRIB_PROFILE.exposedCohort], interaction: read },
          { type: "Provenance", interaction: read, searchParam: [{ name: "target", type: "reference" }] },
          { type: "CodeSystem", interaction: read },
        ],
      },
    ],
  };
}

export function codeSystems(): Resource[] {
  return [
    {
      resourceType: "CodeSystem",
      id: "flow-state",
      url: TRIB_CS.flowState,
      name: "StreamFlowState",
      title: "Stream flow state (citizen-observable)",
      status: "active",
      content: "complete",
      caseSensitive: true,
      concept: Object.entries(FLOW_DISPLAY).map(([code, display]) => ({ code, display })),
    },
    {
      resourceType: "CodeSystem",
      id: "stream-hazard",
      url: TRIB_CS.hazard,
      name: "StreamHazard",
      title: "One Health hazards arising from urban streams",
      status: "active",
      content: "complete",
      caseSensitive: true,
      concept: Object.entries(HAZARD_DISPLAY).map(([code, display]) => ({ code, display })),
    },
  ];
}
