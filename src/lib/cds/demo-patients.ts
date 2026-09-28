// Synthetic patients for the demo EHR. Plain FHIR R4 resources, like an EHR
// would send as CDS Hooks prefetch.

const geo = (lat: number, lon: number) => ({
  url: "http://hl7.org/fhir/StructureDefinition/geolocation",
  extension: [
    { url: "latitude", valueDecimal: lat },
    { url: "longitude", valueDecimal: lon },
  ],
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

function condition(id: string, patient: string, code: string, display: string, onset: number) {
  return {
    resourceType: "Condition",
    id,
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
    verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "provisional" }] },
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis" }] }],
    code: { coding: [{ system: "http://snomed.info/sct", code, display }], text: display },
    subject: { reference: `Patient/${patient}` },
    onsetDateTime: daysAgo(onset),
  };
}

export interface DemoPatient {
  patient: Record<string, unknown> & { id: string };
  conditions: Record<string, unknown>[];
  reason: string;
  vitals: string;
}

export const DEMO_PATIENTS: DemoPatient[] = [
  {
    patient: {
      resourceType: "Patient",
      id: "eleni-markaki",
      name: [{ given: ["Eleni"], family: "Markaki" }],
      gender: "female",
      birthDate: "1991-04-12",
      address: [{ line: ["Odos Knossou 118"], city: "Heraklion", country: "GR", extension: [geo(35.3187, 25.1102)] }],
    },
    conditions: [condition("c-em-1", "eleni-markaki", "62315008", "Diarrhea", 2), condition("c-em-2", "eleni-markaki", "21522001", "Abdominal pain", 2)],
    reason: "Watery diarrhoea and cramps for 2 days. Walks her dog along the Giofyros path daily.",
    vitals: "T 37.9 °C · HR 96 · BP 118/74",
  },
  {
    patient: {
      resourceType: "Patient",
      id: "marco-esposito",
      name: [{ given: ["Marco"], family: "Esposito" }],
      gender: "male",
      birthDate: "1958-09-02",
      address: [{ line: ["Via Posillipo 7"], city: "Benevento", country: "IT", extension: [geo(41.1281, 14.7712)] }],
    },
    conditions: [condition("c-me-1", "marco-esposito", "386661006", "Fever", 3), condition("c-me-2", "marco-esposito", "25064002", "Headache", 3)],
    reason: "Fever and headache for 3 days, some confusion this morning. Fishes on the Sabato most evenings.",
    vitals: "T 39.1 °C · HR 104 · BP 132/80",
  },
  {
    patient: {
      resourceType: "Patient",
      id: "nikos-papadakis",
      name: [{ given: ["Nikos"], family: "Papadakis" }],
      gender: "male",
      birthDate: "2018-06-20",
      address: [{ line: ["Leoforos Gazi 42"], city: "Heraklion", country: "GR", extension: [geo(35.3318, 25.0512)] }],
    },
    conditions: [condition("c-np-1", "nikos-papadakis", "271807003", "Eruption of skin", 1)],
    reason: "Itchy rash on legs after playing at the Almyros mouth at the weekend.",
    vitals: "T 36.8 °C · HR 92",
  },
  {
    patient: {
      resourceType: "Patient",
      id: "ingrid-solberg",
      name: [{ given: ["Ingrid"], family: "Solberg" }],
      gender: "female",
      birthDate: "1996-01-30",
      address: [{ line: ["Nydalsveien 30"], city: "Oslo", country: "NO", extension: [geo(59.9489, 10.7661)] }],
    },
    conditions: [],
    reason: "Routine check-up before a trail-running season.",
    vitals: "T 36.6 °C · HR 58 · BP 112/70",
  },
];
