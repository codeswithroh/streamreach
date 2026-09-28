// Canonical URLs and codes. OAH artefacts are referenced exactly as published in
// the hl7-eu/oah IG (canonical http://hl7.eu/fhir/ig/oah).

export const OAH_IG = "http://hl7.eu/fhir/ig/oah";
export const OAH_CS = `${OAH_IG}/CodeSystem/temporarySystem-oah-eu`;
export const OAH_PROFILE = {
  location: `${OAH_IG}/StructureDefinition/location-oah`,
  indicator: `${OAH_IG}/StructureDefinition/observation-indicators-oah`,
  healthMeasure: `${OAH_IG}/StructureDefinition/observation-health-measure-oah`,
  group: `${OAH_IG}/StructureDefinition/group-oah`,
};
export const OAH_LOCATION_ID_SYSTEM = "https://oneaquahealth.eu/location-id";

// Tributary's own artefacts (small extension IG, see /standards)
export const TRIB = "https://tributary.health/fhir";
export const TRIB_CS = {
  flowState: `${TRIB}/CodeSystem/flow-state`,
  hazard: `${TRIB}/CodeSystem/stream-hazard`,
  riskFactor: `${TRIB}/CodeSystem/risk-factor`,
  volunteer: `${TRIB}/sid/volunteer`,
};
export const TRIB_PROFILE = {
  riskAssessment: `${TRIB}/StructureDefinition/stream-exposure-risk`,
  exposedCohort: `${TRIB}/StructureDefinition/stream-exposed-cohort`,
};

export const SCT = "http://snomed.info/sct";
export const LOINC = "http://loinc.org";
export const UCUM = "http://unitsofmeasure.org";

export const OAH_DISPLAY: Record<string, string> = {
  foam: "Foam/colour/smell",
  diptera: "Diptera",
  waterTemperature: "Water temperature",
  hydrology: "Hydrology of the stream",
  "filamentous-algae": "Filamentous algae",
  coliforms: "Coliforms",
  absent: "Absent",
  present: "Present",
  extensive: "Extensive",
  "0-20-percent": "0-20%",
  "21-40-percent": "21-40%",
  "41-60-percent": "41-60%",
  "61-80-percent": "61-80%",
  "81-100-percent": "81-100%",
  gastrointestinal: "% of people with Cases of Gastrointestinal diseases",
};

export const FLOW_DISPLAY: Record<string, string> = {
  dry: "Dry bed",
  stagnant: "Standing water, no visible flow",
  low: "Low flow",
  normal: "Normal flow",
  high: "High / turbid flow",
};

/** SNOMED CT concepts used to match patient problems to stream hazards. */
export const SYNDROMES = {
  gastrointestinal: [
    { code: "25374005", display: "Gastroenteritis" },
    { code: "62315008", display: "Diarrhea" },
    { code: "422400008", display: "Vomiting" },
    { code: "422587007", display: "Nausea" },
    { code: "21522001", display: "Abdominal pain" },
  ],
  "skin-rash": [{ code: "271807003", display: "Eruption of skin" }],
  febrile: [
    { code: "386661006", display: "Fever" },
    { code: "25064002", display: "Headache" },
  ],
} as const;
