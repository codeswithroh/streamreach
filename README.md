# StreamReach: from streams to systems

**Live demo:** https://streamreach-health.vercel.app · **CDS Hooks discovery:** https://streamreach-health.vercel.app/cds-services · **FHIR:** https://streamreach-health.vercel.app/fhir/metadata

**One Health early warning for urban streams.** Citizen stream checks and the 7-day weather forecast become explainable
FHIR risk assessments for waterborne pathogens, toxic algae and mosquito-borne disease. They reach public health teams on
a map, and GPs **inside their EHR through CDS Hooks**. GP feedback flows back into the stream's risk.

IEEE OneAquaHealth Global Hackathon 2026 · **Track 6 Resilience Informatics** (primary) + **Track 7 Digital Health
Standards**, with Track 1 (citizen UX) and Track 4 (plain-language advice) elements.

---

## Screenshots

**Situation room:** live forecast, alerts for the next 72 hours, and a what-if planner.
![Situation room](docs/screenshots/situation-room.png)

**What-if: storm tomorrow (+40 mm).** Overflow warnings light up across cities.
![What-if storm scenario](docs/screenshots/what-if-storm.png)

**Stream health record:** a daily risk timeline, with every factor named, sourced and weighted.
![Stream record](docs/screenshots/stream-record.png)

**Clinic view:** a demo EHR receiving a real CDS Hooks card, with a draft order and anonymous feedback.
![Clinic view with CDS Hooks card](docs/screenshots/clinic-cds-hooks.png)

**Citizen stream check:** five plain-language questions using OneAquaHealth indicators.
![Citizen stream check](docs/screenshots/stream-check.png)

**Data explorer:** the full record, with a coordinator verification queue.
![Data explorer](docs/screenshots/data-explorer.png)

**Standards:** OAH IG profiles, FHIR endpoints and the CDS Hooks discovery document.
![Standards](docs/screenshots/standards.png)

<p>
  <img src="docs/screenshots/mobile-home.png" alt="Situation room on a phone" width="260">
  &nbsp;
  <img src="docs/screenshots/mobile-check.png" alt="Stream check on a phone" width="260">
</p>

## The problem

Citizen scientists already watch urban streams: foam and sewage smell, still green water, mosquito larvae. Clinicians
already see the consequences: diarrhoea after a storm, a rash after a paddle, a fever in September. **The two never
meet.** The observation stays in an app, and the GP never learns that the patient's dog-walking path runs along a stream
that overflowed last night.

## What StreamReach does

1. **Stream check (citizen).** A 3-minute, 5-question check using the OneAquaHealth app's own indicators. It is saved as
   a FHIR transaction of **OAH-profiled Observations** and updates the neighbourhood's warnings immediately.
2. **Forecast-driven risk (public health).** For every reach, three explainable models combine the live Open-Meteo
   forecast, citizen checks, lab results and site vulnerability. Each gives a daily risk for the next 6 days with the
   factors behind it. A **what-if planner** stress-tests storms and heatwaves.
3. **Stream to clinic (CDS Hooks).** When a GP opens a chart, the EHR calls our `patient-view` service. StreamReach
   locates the patient, matches their active problems (SNOMED CT) to nearby stream hazards, and returns **at most two
   cards**. Cards carry the reasoning, a draft stool-culture order (LOINC 625-4) and patient advice. With no relevant
   risk, it returns nothing.
4. **Clinic to stream (feedback).** The GP can share an *anonymous* stream-linked case. The CDS Hooks feedback endpoint
   records it as an **OAH health-measure Observation**, which raises the reach's waterborne score. The One Health loop is
   closed.

## Why it matters

| Criterion | How StreamReach answers it |
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
npm run e2e        # 59 Playwright end-to-end + axe accessibility tests (local build, in-memory store)
npm run e2e:prod   # the same suite against the live deployment; rows it creates are removed afterwards
```

The E2E suite covers:
- every page and all 10 stream records, with no console errors;
- the situation-room map, alerts and what-if planner;
- the full citizen check → stream record → coordinator verification → FHIR tag flow;
- the clinic view: cards, draft order, anonymous share landing in the data explorer, dismiss with reason, and a failing
  CDS service;
- the data explorer's tabs, filters and pagination;
- the FHIR and CDS Hooks APIs, including error paths and CORS;
- phone layouts;
- a WCAG 2 AA scan with axe.

Without `DATABASE_URL` the app runs on an in-memory store. With it (Neon Postgres, provisioned through the Vercel
Marketplace), everything persists. Run `vercel env pull .env.local` to use the same database locally.

No other keys are needed. Weather comes live from [Open-Meteo](https://open-meteo.com) and falls back to a deterministic
climatology offline.

| Page | What to look at |
|---|---|
| `/` | Situation room: map, 72 h alerts, what-if planner (try "Storm tomorrow · 40 mm") |
| `/sites/giofyros-1` | Stream health record: daily risk timeline, *why this score*, citizen and lab record, FHIR JSON |
| `/check` | Citizen stream check: shows the FHIR bundle, then the before/after risk |
| `/clinic` | Demo EHR calling the real CDS Hooks service: accept or dismiss suggestions and watch the feedback land |
| `/data` | Data explorer: every citizen check, lab result, clinic signal and volunteer, plus a coordinator verification queue |
| `/standards` | Resource map, endpoints, discovery document |

## Interfaces

**FHIR R4** (`/fhir`): `metadata`, `Location`, `Observation` (search by `subject`, `code`), `RiskAssessment` (search by
`location`, `subject`, `code`), `Group`, `Provenance`, `CodeSystem`. `POST /fhir` accepts a transaction Bundle of
OAH indicator Observations.

**CDS Hooks 2.0**: `GET /cds-services`, `POST /cds-services/streamreach-stream-exposure`,
`POST /cds-services/streamreach-stream-exposure/feedback`. CORS is enabled. Once deployed, you can register the discovery URL in
the public [CDS Hooks sandbox](https://sandbox.cds-hooks.org). Patients without an address default to
`STREAMREACH_DEMO_CITY` (Heraklion).

**Profiles.** We reuse the [HL7 Europe OneAquaHealth IG](https://github.com/hl7-eu/oah) (`LocationOah`,
`ObservationIndicatorsOah`, `ObservationHealthMeasureOah`, `GroupOah`, code system `temporarySystem-oah-eu`) and add a small
FSH extension IG in [`ig/`](ig/) with:

- `StreamExposureRisk` (RiskAssessment)
- `StreamExposedCohort` (GroupOah)
- `risk-factor`, `assessed-location` and `assessment-confidence` extensions
- the `flow-state`, `stream-hazard` and `risk-factor` code systems

## Validation

`scripts/validate.sh` exports live resources and runs the official **HL7 FHIR validator** against the OneAquaHealth IG
(built from the hl7-eu/oah FSH sources) plus the StreamReach IG. Latest result ([`validation/SUMMARY.md`](validation/SUMMARY.md)):
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
- The demo dataset is synthetic: 10 reaches, 120 days, ~1,500 observations, monthly lab results and clinic signals, each
  with a storyline. It is regenerated once a day relative to today, so it never looks stale. Weather is real.
- **Persistence:** Neon Postgres in Frankfurt, with Vercel functions pinned to `fra1` next to it. Citizen checks,
  coordinator verifications, clinic feedback and CDS card state survive restarts and are shared across serverless
  instances. Demo rows (`origin = seed`) are refreshed daily. Rows added through the app (`origin = user`) are never touched.

## Data & credits

Weather: Open-Meteo (CC BY 4.0). Map: © OpenStreetMap contributors. Profiles and codes: HL7 Europe OneAquaHealth IG.
Indicators follow the OneAquaHealth field protocols (doi:10.5281/zenodo.20344421).
