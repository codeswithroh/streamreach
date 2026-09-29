# Devpost submission: StreamReach

## Tagline
From streams to systems: citizen stream science that shows up in the GP's EHR before the outbreak does.

## Track alignment
**Primary: Track 6, Resilience Informatics.** A forecast-driven early-warning system. The live 7-day forecast plus
citizen and lab observations give a daily risk per stream reach for three One Health hazards. A what-if planner
stress-tests storms and heatwaves.

**Secondary: Track 7, Digital Health Standards.**
- Built on the official HL7 Europe OneAquaHealth FHIR IG.
- Risk is published as FHIR RiskAssessment.
- Delivered into clinical workflows with CDS Hooks 2.0.
- A small FSH extension IG adds the pieces the OAH IG doesn't have yet.
- Resources validate against both IGs with the official HL7 validator.
- Track 7 lists "AI agents": an AI duty officer drafts response plans, which are published as FHIR Communication with a
  Provenance naming the AI author and the human approver.

Also touches Track 1 (a 3-minute guided check with "why we ask" explanations), Track 3 (AI that supports, and never
replaces, human judgment) and Track 4 (plain-language, multilingual advice for residents).

## Inspiration
Two groups watch the same stream without ever talking to each other. Volunteers see foam, still green water and
mosquito larvae. GPs see diarrhoea after storms, rashes after paddling and fevers in late summer. OneAquaHealth's
mission is to connect ecosystem health and human health. We wanted to connect them literally: in the systems clinicians
already use.

## What it does
0. **Landing page, sign-in and roles.** Anyone can explore through one-click demo accounts: a public-health officer, a
   citizen volunteer or a clinician. Real accounts use hashed passwords and database sessions. Each role only gets what
   it needs: citizens report, officers verify and approve AI drafts, clinicians see the EHR integration.
1. **Stream check.** Residents answer five picture-based questions (the OneAquaHealth app's indicators). Each check is
   stored as OAH-profiled FHIR Observations and immediately updates the neighbourhood's warnings. The volunteer sees
   what their check changed.
2. **Monitoring dashboard.** A satellite map with each stream's risk zone, a day-by-day forecast strip, a risk and rain chart, live weather and the latest checks. Each reach also has a daily risk timeline. Every score has a "why this
   score" breakdown: storm overflow likely, sewage signs reported, warm water, larvae spotted, and so on. Each factor
   is tagged with its source (forecast, citizen, lab, site, clinic).
3. **Stream to clinic.** A CDS Hooks `patient-view` service. When a GP opens a chart, StreamReach:
   - locates the patient;
   - matches their active SNOMED CT problems to nearby hazards;
   - returns at most two cards with the reasoning, a draft stool-culture order and patient advice.

   When nothing is relevant, it stays silent.
4. **Clinic to stream.** The GP can share an anonymous stream-linked case. The CDS Hooks feedback endpoint turns it into
   an OAH health-measure Observation, which feeds back into the reach's risk.
5. **AI duty officer.** On any stream record, a Claude agent gathers the evidence with read-only tools: the risk model,
   observations, clinic reports, the weather and other reaches in the city. You watch each step live. It then drafts a
   response plan:
   - a resident advisory in the local language (Greek, Italian, Norwegian or Portuguese) plus English;
   - a GP note;
   - owned, time-bound actions;
   - evidence citing observation ids;
   - honest uncertainties.

   A named duty officer approves or discards it. Only approved plans are published, as FHIR Communication plus
   Provenance.

## How we built it
- **Stack:** Next.js 16 route handlers serve a FHIR R4 facade (`/fhir`) and CDS Hooks endpoints (`/cds-services`).
  The UI uses TypeScript, Tailwind and Leaflet/OpenStreetMap.
- **Weather:** live from Open-Meteo (no key).
- **Risk engine:** three small logistic models with named, weighted factors. The weights are literature-informed
  priors (EU Bathing Water Directive thresholds; CSO–gastroenteritis, cyanobacteria–temperature and West Nile–temperature
  studies), documented in `docs/MODEL.md`.
- **Standards:** the OAH IG profiles LocationOah, ObservationIndicatorsOah, ObservationHealthMeasureOah and GroupOah,
  plus our own FSH IG: a StreamExposureRisk profile, risk-factor, assessed-location and confidence extensions, and the
  flow-state and stream-hazard code systems.
- **Validation:** `scripts/validate.sh` runs the official HL7 validator against both IGs. Result: 0 errors.
- **Persistence:** Neon Postgres (Frankfurt) via the Vercel Marketplace, with functions pinned to the same region. The
  store holds a 120-day demo dataset across 10 reaches; anything visitors add persists.
- **Data explorer:** every check, lab result, clinic signal and volunteer, plus a coordinator verification queue
  (human in the loop).
- **AI agent:** Claude Opus 5.5 via the Anthropic TypeScript SDK in a manual tool-use loop. There are five read-only
  tools and a strictly typed `submit_response_plan` tool, validated again with zod. Refusal fallback is on. The agent's
  steps stream to the browser as server-sent events. Drafts and decisions are stored in Postgres. Usage guards: a
  per-visitor cooldown, a daily cap and one-hour draft reuse. A deterministic mock mode lets the E2E suite test the
  whole flow without model calls.
- **Tests:** 13 Vitest unit tests, a live agent test, and 83 Playwright end-to-end tests with an axe WCAG 2 AA scan. The E2E suite
  passes against the live deployment.

## Challenges
- The OAH IG isn't published as a package yet, so we built it from the hl7-eu/oah FSH sources to validate against it.
- Keeping the model honest. We chose explainable priors over a black box trained on synthetic data, and report
  confidence separately from risk.
- Alert fatigue. Cards need a symptom match or high risk, and the service returns at most two.
- Trustworthy AI. The agent only sees StreamReach's own data, must cite evidence for its claims, states its
  uncertainties, and cannot publish anything itself.

## Accomplishments
- The loop is real and demoable in 3 minutes. A citizen check changes a forecast, the forecast raises a card in an EHR,
  and the GP's feedback changes the forecast again.
- It runs on the real forecast. On 28 Sep 2026, Open-Meteo forecast ~27 mm of rain over Heraklion. StreamReach flagged
  very high waterborne risk at Giofyros Reach A for 1 October, three days ahead.

## What's next
- Recalibrate the weights on OneAquaHealth lab campaigns and anonymous syndromic data.
- Plug into the OneAquaHealth app and Open Information Hub as a FHIR endpoint.
- Pilot with one health authority's EHR sandbox.
- Add a second CDS hook (`order-select`) and cyanotoxin/veterinary cards.

## Built with
nextjs, typescript, tailwindcss, fhir, hl7, cds-hooks, claude, anthropic, fsh-sushi, neon, postgres, open-meteo, openstreetmap, leaflet, vitest, playwright

---

# Demo video script (≈4 min)

**0:00–0:20 · Hook** (situation room)
> "This is Giofyros Reach A in Heraklion, one of OneAquaHealth's monitoring sites. Right now it's calm. But the real
> forecast says 27 mm of rain on Wednesday. StreamReach already knows what that means."

Point at the red dot and the "Very high: waterborne pathogens" alert.

**0:20–1:10 · Why this score** (`/sites/giofyros-1`)
- The timeline: observed bars, then hatched forecast bars climbing on Wed–Thu.
- "Why this score": storm overflow likely (forecast), faecal bacteria (lab), sewage signs (citizen), clinic signal.
  "Every factor is named, sourced and weighted. No black box."
- Advice for residents vs clinicians.

**1:10–1:50 · Citizen check** (`/check?site=giofyros-1`)
- Answer "A lot" of foam, "Rushing / muddy", then submit. Show "preview FHIR bundle" first: OAH-profiled Observations.
- The result screen shows before → after risk. "Her three minutes just sharpened the warning for 14,800 neighbours."

**1:50–3:00 · The clinic** (`/clinic`)
- Eleni Markaki: diarrhoea for 2 days. The EHR fires `patient-view` and a warning card appears. Read the summary.
- Click "Order stool culture": a draft order lands in the chart. Click "Share anonymous case".
- Show the Hook request / Service response tabs: plain CDS Hooks 2.0 JSON.
- Ingrid in Oslo: no card. "Silence is a feature."
- Back to the stream record: the clinic signal factor has grown. "The GP just told the stream something."

**3:00–3:40 · Standards & scale** (`/standards`)
- Resource map: OAH IG profiles plus our small extension IG. "Validated with the official HL7 validator: 0 errors."
- "Any FHIR server, any CDS Hooks EHR, any city with citizen checks and a forecast."

**3:40–4:00 · What-if planner** (back to `/`)
- Click "Heatwave +6 °C": algae and mosquito warnings light up across the south. Close:
  "From streams to systems."
