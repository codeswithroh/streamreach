# Tributary: from streams to systems

**One Health early warning for urban streams.** Citizen stream checks and the 7-day weather forecast become explainable
FHIR risk assessments for waterborne pathogens, toxic algae and mosquito-borne disease. They reach public health teams on
a map, and GPs **inside their EHR through CDS Hooks**. GP feedback flows back into the stream's risk.

IEEE OneAquaHealth Global Hackathon 2026 · **Track 6 Resilience Informatics** (primary) + **Track 7 Digital Health
Standards**, with Track 1 (citizen UX) and Track 4 (plain-language advice) elements.

---

## The problem

Citizen scientists already watch urban streams: foam and sewage smell, still green water, mosquito larvae. Clinicians
already see the consequences: diarrhoea after a storm, a rash after a paddle, a fever in September. **The two never
meet.** The observation stays in an app, and the GP never learns that the patient's dog-walking path runs along a stream
that overflowed last night.

## What Tributary does

1. **Stream check (citizen).** A 3-minute, 5-question check using the OneAquaHealth app's own indicators. It is saved as
   a FHIR transaction of **OAH-profiled Observations** and updates the neighbourhood's warnings immediately.
2. **Forecast-driven risk (public health).** For every reach, three explainable models combine the live Open-Meteo
   forecast, citizen checks, lab results and site vulnerability. Each gives a daily risk for the next 6 days with the
   factors behind it. A **what-if planner** stress-tests storms and heatwaves.
3. **Stream to clinic (CDS Hooks).** When a GP opens a chart, the EHR calls our `patient-view` service. Tributary
   locates the patient, matches their active problems (SNOMED CT) to nearby stream hazards, and returns **at most two
   cards**. Cards carry the reasoning, a draft stool-culture order (LOINC 625-4) and patient advice. With no relevant
   risk, it returns nothing.
4. **Clinic to stream (feedback).** The GP can share an *anonymous* stream-linked case. The CDS Hooks feedback endpoint
   records it as an **OAH health-measure Observation**, which raises the reach's waterborne score. The One Health loop is
   closed.

## Why it matters

| Criterion | How Tributary answers it |
|---|---|
| Impact & OneAquaHealth mission | Links ecosystem signals to human health outcomes in both directions: early detection of environmental risk, as the project aims for. |
| Innovation | First bridge from citizen stream science into the clinical workflow via CDS Hooks. Forecast-driven rather than retrospective. |
| Architecture | Standards end to end: OAH FHIR IG profiles, FHIR RiskAssessment with structured factor extensions, CDS Hooks 2.0 (discovery, prefetch, fhirServer fallback, suggestions, override reasons, feedback). |
| UX | 3-minute citizen check with "why we ask" explanations; plain-language advice for residents; two-card cap to avoid alert fatigue for GPs. |
| Scale | Any FHIR R4 server can store it, any CDS Hooks-capable EHR can consume it, and any city with citizen checks and a weather forecast can deploy it. No proprietary data. |

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 13 unit tests: risk engine, FHIR facade, CDS Hooks
```

No keys needed. Weather comes live from [Open-Meteo](https://open-meteo.com) and falls back to a deterministic
climatology offline.

| Page | What to look at |
|---|---|
| `/` | Situation room: map, 72 h alerts, what-if planner (try "Storm tomorrow · 40 mm") |
| `/sites/giofyros-1` | Stream health record: daily risk timeline, *why this score*, citizen and lab record, FHIR JSON |
| `/check` | Citizen stream check: shows the FHIR bundle, then the before/after risk |
| `/clinic` | Demo EHR calling the real CDS Hooks service: accept or dismiss suggestions and watch the feedback land |
| `/standards` | Resource map, endpoints, discovery document |

## Interfaces

**FHIR R4** (`/fhir`): `metadata`, `Location`, `Observation` (search by `subject`, `code`), `RiskAssessment` (search by
`location`, `subject`, `code`), `Group`, `Provenance`, `CodeSystem`. `POST /fhir` accepts a transaction Bundle of
OAH indicator Observations.

**CDS Hooks 2.0**: `GET /cds-services`, `POST /cds-services/tributary-stream-exposure`,
`POST /cds-services/tributary-stream-exposure/feedback`. CORS is enabled. Once deployed, you can register the discovery URL in
the public [CDS Hooks sandbox](https://sandbox.cds-hooks.org). Patients without an address default to
`TRIBUTARY_DEMO_CITY` (Heraklion).

**Profiles.** We reuse the [HL7 Europe OneAquaHealth IG](https://github.com/hl7-eu/oah) (`LocationOah`,
`ObservationIndicatorsOah`, `ObservationHealthMeasureOah`, `GroupOah`, code system `temporarySystem-oah-eu`) and add a small
FSH extension IG in [`ig/`](ig/) with:

- `StreamExposureRisk` (RiskAssessment)
- `StreamExposedCohort` (GroupOah)
- `risk-factor`, `assessed-location` and `assessment-confidence` extensions
- the `flow-state`, `stream-hazard` and `risk-factor` code systems

## Validation

`scripts/validate.sh` exports live resources and runs the official **HL7 FHIR validator** against the OneAquaHealth IG
(built from the hl7-eu/oah FSH sources) plus the Tributary IG. Latest result ([`validation/SUMMARY.md`](validation/SUMMARY.md)):
**0 errors, 4 warnings**. Two warnings come from codes that the OAH IG's own examples also use (SNOMED "River" for
Location.type, SNOMED "Living place" for cohort characteristics). The other two are UCUM annotation notes.

## Architecture

```
 citizen PWA ──FHIR txn──▶ /fhir ──▶ store ─┐
                                            ├─▶ risk engine (3 explainable logistic models)
 Open-Meteo 7-day forecast ────────────────┘        │
                                                     ├─▶ RiskAssessment (FHIR) ──▶ situation room / stream record
 EHR ──patient-view──▶ /cds-services/… ◀─────────────┘
     ◀──cards (≤2) + suggestions ──┘
     ──feedback (accepted "share")──▶ anonymous OAH health-measure Observation ──▶ back into the risk engine
```

Next.js 16 (App Router, route handlers), TypeScript, Tailwind v4, Leaflet/OpenStreetMap, Vitest. The risk model is
documented in [`docs/MODEL.md`](docs/MODEL.md).

## Honest limitations

- Model weights are literature-informed **priors**, not fitted coefficients. They are built to be recalibrated on
  OneAquaHealth lab and syndromic data.
- Three reaches (Giofyros A, Giofyros lower, Almyros) use coordinates from the OAH IG. Benevento, Oslo and Coimbra are
  demo reaches in OAH case-study cities. Vulnerability parameters are placeholders a city would replace.
- Citizen history is seeded synthetic data. Weather is real.
- The store is in memory. Production would put the same REST interface in front of a FHIR server.

## Data & credits

Weather: Open-Meteo (CC BY 4.0). Map: © OpenStreetMap contributors. Profiles and codes: HL7 Europe OneAquaHealth IG.
Indicators follow the OneAquaHealth field protocols (doi:10.5281/zenodo.20344421).
