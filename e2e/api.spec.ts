import { expect, test } from "@playwright/test";
import { AUTH, e2eState } from "./helpers";

const OAH = "http://hl7.eu/fhir/ig/oah/CodeSystem/temporarySystem-oah-eu";

test.describe("FHIR R4 API", () => {
  test("conformance and reads", async ({ request }) => {
    const md = await request.get("/fhir/metadata");
    expect(md.headers()["content-type"]).toContain("application/fhir+json");
    expect((await md.json()).resourceType).toBe("CapabilityStatement");
    expect((await (await request.get("/fhir")).json()).resourceType).toBe("CapabilityStatement");

    const locs = await (await request.get("/fhir/Location")).json();
    expect(locs.total).toBe(10);
    for (const e of locs.entry) {
      const id = e.resource.id;
      expect((await request.get(`/fhir/Location/${id}`)).status()).toBe(200);
      expect((await request.get(`/fhir/Group/cohort-${id}`)).status()).toBe(200);
      const ra = await (await request.get(`/fhir/RiskAssessment?location=Location/${id}`)).json();
      expect(ra.total).toBe(3);
    }
    const ra = await (await request.get("/fhir/RiskAssessment/risk-giofyros-1-waterborne")).json();
    expect(ra.extension.some((x: { url: string }) => x.url.endsWith("risk-factor"))).toBe(true);
    expect((await (await request.get("/fhir/RiskAssessment?code=vector")).json()).total).toBe(10);

    const obs = await (await request.get("/fhir/Observation?subject=Location/sabato-bn&code=coliforms")).json();
    expect(obs.total).toBeGreaterThan(0);
    const one = obs.entry[0].resource;
    expect((await request.get(`/fhir/Observation/${one.id}`)).status()).toBe(200);
    const prov = await (await request.get(`/fhir/Provenance?target=Observation/${one.id}`)).json();
    expect(prov.total).toBe(1);
    expect((await request.get(`/fhir/Provenance/prov-${one.id}`)).status()).toBe(200);
    expect((await (await request.get("/fhir/CodeSystem")).json()).total).toBe(2);
    expect((await request.get("/fhir/CodeSystem/flow-state")).status()).toBe(200);
    expect((await (await request.get("/fhir/Observation/health-alna-oslo-gastrointestinal")).json()).valueQuantity).toBeTruthy();
  });

  test("errors come back as OperationOutcome", async ({ request }) => {
    for (const [path, status] of [
      ["/fhir/Location/nope", 404],
      ["/fhir/Observation/nope", 404],
      ["/fhir/RiskAssessment/nope", 404],
      ["/fhir/Group/nope", 404],
      ["/fhir/Provenance/nope", 404],
      ["/fhir/CodeSystem/nope", 404],
      ["/fhir/Patient", 404],
    ] as const) {
      const r = await request.get(path);
      expect(r.status(), path).toBe(status);
      expect((await r.json()).resourceType).toBe("OperationOutcome");
    }
    const bad = await request.post("/fhir", { headers: { "Content-Type": "application/fhir+json" }, data: "{not json" });
    expect(bad.status()).toBe(400);
    const wrongCode = await request.post("/fhir/Observation", {
      data: { resourceType: "Observation", code: { coding: [{ system: "x", code: "y" }] }, subject: { reference: "Location/giofyros-1" } },
    });
    expect(wrongCode.status()).toBe(422);
    const wrongSite = await request.post("/fhir/Observation", {
      data: { resourceType: "Observation", code: { coding: [{ system: OAH, code: "foam" }] }, subject: { reference: "Location/nowhere" } },
    });
    expect(wrongSite.status()).toBe(422);
    const noValue = await request.post("/fhir/Observation", {
      data: { resourceType: "Observation", code: { coding: [{ system: OAH, code: "foam" }] }, subject: { reference: "Location/giofyros-1" } },
    });
    expect(noValue.status()).toBe(422);
    const notSupported = await request.post("/fhir/Location", { data: { resourceType: "Location" } });
    expect(notSupported.status()).toBe(405);
  });

  test("create Observation as a signed-in citizen, then read it back", async ({ playwright }) => {
    const request = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL, storageState: AUTH.citizen });
    const vol = e2eState().citizenCode;
    const r = await request.post("/fhir/Observation", {
      headers: { "Content-Type": "application/fhir+json" },
      data: {
        resourceType: "Observation",
        code: { coding: [{ system: OAH, code: "waterTemperature" }] },
        subject: { reference: "Location/calore-bn" },
        valueQuantity: { value: 19.2, unit: "°C", system: "http://unitsofmeasure.org", code: "Cel" },
        performer: [{ identifier: { value: "V-SPOOFED" } }],
      },
    });
    expect(r.status()).toBe(201);
    const created = await r.json();
    const back = await (await request.get(`/fhir/Observation/${created.id}`)).json();
    expect(back.valueQuantity.value).toBe(19.2);
    expect(back.performer[0].identifier.value).toBe(vol); // server stamps the signed-in user's code, not the client's claim
    await request.dispose();
  });

  test("CORS preflight is allowed for FHIR and CDS Hooks", async ({ request }) => {
    for (const p of ["/fhir/Observation", "/cds-services", "/cds-services/streamreach-stream-exposure"]) {
      const r = await request.fetch(p, { method: "OPTIONS" });
      expect(r.status(), p).toBe(204);
      expect(r.headers()["access-control-allow-origin"]).toBe("*");
    }
    const get = await request.get("/cds-services");
    expect(get.headers()["access-control-allow-origin"]).toBe("*");
  });
});

test.describe("CDS Hooks API", () => {
  const patient = {
    resourceType: "Patient",
    id: "p1",
    address: [
      {
        city: "Heraklion",
        extension: [
          {
            url: "http://hl7.org/fhir/StructureDefinition/geolocation",
            extension: [
              { url: "latitude", valueDecimal: 35.3187 },
              { url: "longitude", valueDecimal: 25.1102 },
            ],
          },
        ],
      },
    ],
  };
  const diarrhoea = { resourceType: "Condition", code: { coding: [{ system: "http://snomed.info/sct", code: "62315008", display: "Diarrhea" }] } };

  test("discovery document", async ({ request }) => {
    const d = await (await request.get("/cds-services")).json();
    expect(d.services[0]).toMatchObject({ hook: "patient-view", id: "streamreach-stream-exposure" });
    expect(d.services[0].prefetch.patient).toBe("Patient/{{context.patientId}}");
  });

  test("validates requests", async ({ request }) => {
    expect((await request.post("/cds-services/unknown", { data: {} })).status()).toBe(404);
    expect((await request.post("/cds-services/streamreach-stream-exposure", { data: {} })).status()).toBe(400);
    const fb = await request.post("/cds-services/streamreach-stream-exposure/feedback", { data: { feedback: [{ card: "x", outcome: "accepted", acceptedSuggestions: [{ id: "unknown" }] }] } });
    expect((await fb.json()).recorded).toBe(0);
    const fbBad = await request.post("/cds-services/streamreach-stream-exposure/feedback", { data: "nonsense" });
    expect(fbBad.status()).toBe(200);
  });

  test("patient without address falls back to the demo city", async ({ request }) => {
    const r = await request.post("/cds-services/streamreach-stream-exposure", {
      data: { hook: "patient-view", hookInstance: "e2e", context: { patientId: "x" }, prefetch: { patient: { resourceType: "Patient", id: "x" } } },
    });
    const j = await r.json();
    expect(j._meta.location.demoFallback).toBe(true);
    expect(Array.isArray(j.cards)).toBe(true);
  });

  test("card → feedback round trip; a card can only be redeemed once", async ({ request }) => {
    const r = await request.post("/cds-services/streamreach-stream-exposure", {
      data: { hook: "patient-view", hookInstance: "e2e", context: { patientId: "p1" }, prefetch: { patient, conditions: { entry: [{ resource: diarrhoea }] } } },
    });
    const { cards } = await r.json();
    expect(cards.length).toBeGreaterThan(0);
    for (const c of cards) {
      expect(c.summary.length).toBeLessThanOrEqual(140);
      expect(["info", "warning", "critical"]).toContain(c.indicator);
      expect(c.source.label).toBeTruthy();
    }
    const share = cards[0].suggestions.find((s: { label: string }) => /anonymous/.test(s.label));
    const body = { feedback: [{ card: cards[0].uuid, outcome: "accepted", acceptedSuggestions: [{ id: share.uuid }] }] };
    expect((await (await request.post("/cds-services/streamreach-stream-exposure/feedback", { data: body })).json()).recorded).toBe(1);
    expect((await (await request.post("/cds-services/streamreach-stream-exposure/feedback", { data: body })).json()).recorded).toBe(0);
  });

  test("the fhirServer fallback is used when prefetch is missing", async ({ request }) => {
    const base = test.info().project.use.baseURL;
    const r = await request.post("/cds-services/streamreach-stream-exposure", {
      data: { hook: "patient-view", hookInstance: "e2e", context: { patientId: "nobody" }, fhirServer: `${base}/fhir` },
    });
    expect(r.status()).toBe(200);
    expect(Array.isArray((await r.json()).cards)).toBe(true);
  });
});

test.describe("internal API", () => {
  test("site summary and status validation", async ({ request }) => {
    const s = await (await request.get("/api/sites/giofyros-1")).json();
    expect(s.hazards).toHaveLength(3);
    expect((await request.get("/api/sites/nope")).status()).toBe(404);
    expect((await request.post("/api/observations/status", { data: { ids: "x", status: "final" } })).status()).toBe(400);
    expect((await request.post("/api/observations/status", { data: { ids: ["x"], status: "weird" } })).status()).toBe(400);
    expect((await (await request.post("/api/observations/status", { data: { ids: ["does-not-exist"], status: "final" } })).json()).updated).toBe(0);
  });
});
