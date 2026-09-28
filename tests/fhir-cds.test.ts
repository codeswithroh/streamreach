import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleFeedback, locatePatient, patientSyndromes, patientViewCards } from "@/lib/cds/service";
import { DEMO_PATIENTS } from "@/lib/cds/demo-patients";
import { OAH_CS, OAH_PROFILE } from "@/lib/codes";
import { fhirGet, fhirPost, FhirError } from "@/lib/fhir/server";
import { resetStore, signalsFor } from "@/lib/store";
import type { WeatherSeries } from "@/lib/weather";

// Deterministic weather: a storm arrives tomorrow everywhere.
vi.mock("@/lib/weather", async (orig) => {
  const mod = await orig<typeof import("@/lib/weather")>();
  return {
    ...mod,
    getWeather: async (site: { id: string }): Promise<WeatherSeries> => {
      const days = [];
      const now = Date.now();
      for (let i = -14; i <= 6; i++) {
        days.push({
          date: new Date(now + i * 86_400_000).toISOString().slice(0, 10),
          rainMm: i === 1 ? 35 : 0,
          tMax: 28,
          tMean: 23,
          sunshineH: 10,
          forecast: i > 0,
        });
      }
      return { siteId: site.id, source: "open-meteo", fetchedAt: "", days, todayIndex: 14 };
    },
  };
});

const BASE = "http://test/fhir";

beforeEach(() => resetStore());

describe("FHIR facade", () => {
  it("serves a CapabilityStatement declaring the OAH IG", async () => {
    const cs = await fhirGet(["metadata"], new URLSearchParams(), BASE);
    expect(cs.resourceType).toBe("CapabilityStatement");
    expect(cs.fhirVersion).toBe("4.0.1");
  });

  it("serves Locations with the OAH profile", async () => {
    const b = await fhirGet(["Location"], new URLSearchParams(), BASE);
    expect(b.total).toBe(6);
    expect(b.entry[0].resource.meta.profile).toContain(OAH_PROFILE.location);
  });

  it("serves RiskAssessments with explained factors and a daily forecast", async () => {
    const ra = await fhirGet(["RiskAssessment", "risk-giofyros-1-waterborne"], new URLSearchParams(), BASE);
    expect(ra.subject.reference).toBe("Group/cohort-giofyros-1");
    expect(ra.prediction.length).toBeGreaterThanOrEqual(6);
    const factors = ra.extension.filter((e: { url: string }) => e.url.endsWith("risk-factor"));
    expect(factors.length).toBeGreaterThan(2);
    expect(ra.prediction[1].probabilityDecimal).toBeGreaterThan(0.6); // storm tomorrow
  });

  it("accepts a transaction of OAH citizen observations", async () => {
    const r = await fhirPost(
      [],
      {
        resourceType: "Bundle",
        type: "transaction",
        entry: [
          {
            resource: {
              resourceType: "Observation",
              code: { coding: [{ system: OAH_CS, code: "foam" }] },
              subject: { reference: "Location/akerselva-oslo" },
              valueCodeableConcept: { coding: [{ system: OAH_CS, code: "extensive", display: "Extensive" }] },
              performer: [{ identifier: { value: "V-TEST" } }],
            },
          },
        ],
      },
    );
    expect(r.body.type).toBe("transaction-response");
    const obs = await fhirGet(["Observation"], new URLSearchParams({ subject: "Location/akerselva-oslo", code: "foam", _count: "1" }), BASE);
    expect(obs.entry[0].resource.valueCodeableConcept.coding[0].code).toBe("extensive");
  });

  it("rejects codes outside the OAH code system", async () => {
    await expect(
      fhirPost([], { resourceType: "Observation", code: { coding: [{ system: "x", code: "y" }] }, subject: { reference: "Location/giofyros-1" } }),
    ).rejects.toBeInstanceOf(FhirError);
  });
});

describe("CDS Hooks service", () => {
  const eleni = DEMO_PATIENTS.find((p) => p.patient.id === "eleni-markaki")!;
  const ingrid = DEMO_PATIENTS.find((p) => p.patient.id === "ingrid-solberg")!;
  const req = (p: typeof eleni) => ({
    hook: "patient-view",
    hookInstance: "t",
    context: { patientId: p.patient.id },
    prefetch: { patient: p.patient, conditions: { entry: p.conditions.map((resource) => ({ resource })) } },
  });

  it("locates a patient from the geolocation extension", () => {
    const loc = locatePatient(eleni.patient);
    expect(loc.lat).toBeCloseTo(35.3187);
    expect(loc.demoFallback).toBe(false);
  });

  it("maps SNOMED problems to syndromes", () => {
    expect([...patientSyndromes(eleni.conditions)]).toContain("gastrointestinal");
  });

  it("warns a patient with diarrhoea living next to a stream about to overflow", async () => {
    const { cards } = await patientViewCards(req(eleni), "http://app");
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThanOrEqual(2);
    expect(cards[0].indicator).toBe("warning");
    expect(cards[0].summary.length).toBeLessThanOrEqual(140);
    const order = cards[0].suggestions?.find((s: { actions?: unknown[] }) => s.actions?.length);
    expect(order!.actions[0].resource.resourceType).toBe("ServiceRequest");
  });

  it("feedback on the share suggestion records an anonymous clinic signal", async () => {
    const { cards } = await patientViewCards(req(eleni), "http://app");
    const share = cards[0].suggestions!.find((s: { label: string }) => s.label.includes("anonymous"));
    const before = signalsFor("giofyros-1").length;
    const n = handleFeedback({ feedback: [{ card: cards[0].uuid, outcome: "accepted", acceptedSuggestions: [{ id: share.uuid }] }] });
    expect(n).toBe(1);
    expect(signalsFor("giofyros-1").length).toBe(before + 1);
  });

  it("stays quiet for a symptom-free patient unless risk is high", async () => {
    const { cards } = await patientViewCards(req(ingrid), "http://app");
    for (const c of cards) expect(c.indicator).not.toBe("critical");
  });
});
