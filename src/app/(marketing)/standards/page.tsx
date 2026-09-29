import { DISCOVERY } from "@/lib/cds/service";
import { OAH_CS, OAH_PROFILE, TRIB_CS, TRIB_PROFILE } from "@/lib/codes";

export const metadata = { title: "Standards · StreamReach" };

const MAP = [
  ["Stream reach", "Location", OAH_PROFILE.location, "OAH IG"],
  ["Citizen / lab indicator (foam, flow, algae, larvae, temperature, coliforms)", "Observation", OAH_PROFILE.indicator, "OAH IG"],
  ["Who reported it (pseudonymous volunteer, lab)", "Provenance", "core R4", "FHIR core"],
  ["People exposed to a reach", "Group", `${OAH_PROFILE.group} + ${TRIB_PROFILE.exposedCohort}`, "OAH IG + StreamReach"],
  ["Hazard forecast with explanation", "RiskAssessment", TRIB_PROFILE.riskAssessment, "StreamReach"],
  ["Clinic-reported stream-linked cases (anonymous)", "Observation", OAH_PROFILE.healthMeasure, "OAH IG"],
  ["Alert inside the EHR", "CDS Hooks card (patient-view)", "CDS Hooks 2.0", "HL7"],
  ["Suggested work-up", "ServiceRequest (draft, LOINC 625-4)", "core R4", "FHIR core"],
  ["AI-drafted, human-approved resident advisory", "Communication (subject: exposed cohort)", "core R4", "FHIR core"],
  ["Who wrote and who approved the advisory", "Provenance (author: AI agent, verifier: officer)", "core R4", "FHIR core"],
];

const STEPS = [
  { t: "Citizen check", s: "OAH indicator Observations", c: "#2f6b45" },
  { t: "Weather forecast", s: "Open-Meteo, 7 days", c: "#2a6f9c" },
  { t: "Risk engine", s: "explainable logistic model", c: "#0a4f58" },
  { t: "RiskAssessment", s: "about an OAH cohort Group", c: "#0a4f58" },
  { t: "CDS Hooks card", s: "in the GP's EHR", c: "#9c4c12" },
  { t: "Feedback", s: "OAH health-measure Observation", c: "#9b2a23" },
];

export default function StandardsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
      <p className="eyebrow">Track 7 · Digital Health Standards</p>
      <h1 className="font-display text-4xl mt-1">Built on the standards health systems already speak.</h1>
      <p className="text-ink-2 mt-3 max-w-3xl">
        StreamReach adds no new data silo. Stream data is stored with the official <b>HL7 Europe OneAquaHealth FHIR IG</b> profiles,
        risk is published as FHIR <b>RiskAssessment</b>, and alerts reach clinicians through <b>CDS Hooks</b>, the HL7 standard
        EHRs already use for decision support. Anything that speaks FHIR R4 can read it, including OneAquaHealth&apos;s own platform.
      </p>

      <section className="card p-5 mt-8">
        <p className="eyebrow">The loop</p>
        <ol className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
          {STEPS.map((s, i) => (
            <li key={s.t} className="relative rounded-lg border border-line bg-white p-3">
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: s.c }}>0{i + 1}</span>
              <p className="text-sm font-medium leading-tight mt-0.5">{s.t}</p>
              <p className="text-[11px] text-ink-3 mt-1 leading-snug">{s.s}</p>
              {i < STEPS.length - 1 && <span className="hidden md:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-ink-3 text-xs">→</span>}
            </li>
          ))}
        </ol>
        <p className="text-xs text-ink-3 mt-3">
          Step 6 feeds back into step 3. Anonymous clinic signals raise the waterborne score for the reach, which closes the
          One Health loop between ecosystem and human health.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="font-display text-2xl">Resource map</h2>
        <div className="card mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-ink-3">
              <tr className="border-b border-line">
                <th className="p-3 font-medium">Concept</th>
                <th className="p-3 font-medium">FHIR</th>
                <th className="p-3 font-medium">Profile</th>
                <th className="p-3 font-medium">From</th>
              </tr>
            </thead>
            <tbody>
              {MAP.map(([c, r, p, f]) => (
                <tr key={c} className="border-b border-line last:border-0 align-top">
                  <td className="p-3">{c}</td>
                  <td className="p-3 font-medium whitespace-nowrap">{r}</td>
                  <td className="p-3 font-mono text-[11px] text-ink-2 break-all">{p}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`text-[11px] rounded px-1.5 py-0.5 ${f.startsWith("OAH") ? "bg-river-soft text-river-deep" : "bg-stone-100"}`}>{f}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-3 mt-2">
          Indicator codes come from the OAH code system <code className="font-mono break-all">{OAH_CS}</code>. StreamReach only adds codes the
          IG lacks: <code className="font-mono break-all">{TRIB_CS.flowState}</code> (citizen-observable flow) and{" "}
          <code className="font-mono break-all">{TRIB_CS.hazard}</code>.
        </p>
      </section>

      <section className="mt-8 grid md:grid-cols-2 gap-5 [&>*]:min-w-0">
        <div className="card p-5">
          <h2 className="font-display text-2xl">FHIR R4 endpoints</h2>
          <ul className="mt-3 space-y-1.5 text-sm font-mono">
            {[
              "/fhir/metadata",
              "/fhir/Location",
              "/fhir/Observation?subject=Location/giofyros-1",
              "/fhir/RiskAssessment?location=Location/giofyros-1",
              "/fhir/RiskAssessment/risk-giofyros-1-waterborne",
              "/fhir/Group/cohort-giofyros-1",
              "/fhir/Observation/health-giofyros-1-gastrointestinal",
              "/fhir/Provenance?target=Observation/obs-1",
              "/fhir/CodeSystem/flow-state",
            ].map((u) => (
              <li key={u}>
                <a href={u} target="_blank" className="text-river hover:underline break-all">
                  GET {u}
                </a>
              </li>
            ))}
            <li className="text-ink-2">POST /fhir (transaction Bundle of OAH Observations)</li>
          </ul>
        </div>
        <div className="card p-5">
          <h2 className="font-display text-2xl">CDS Hooks 2.0</h2>
          <ul className="mt-3 space-y-1.5 text-sm font-mono">
            <li>
              <a href="/cds-services" target="_blank" className="text-river hover:underline">GET /cds-services</a>
            </li>
            <li className="text-ink-2">POST /cds-services/{DISCOVERY.services[0].id}</li>
            <li className="text-ink-2">POST /cds-services/{DISCOVERY.services[0].id}/feedback</li>
          </ul>
          <p className="text-sm text-ink-2 mt-3">
            Register the discovery URL in any CDS Hooks client, for example the public{" "}
            <a className="text-river underline" href="https://sandbox.cds-hooks.org" target="_blank">CDS Hooks sandbox</a>. Uses prefetch
            when the EHR provides it and otherwise queries the EHR&apos;s <code>fhirServer</code>. Returns at most two cards, with
            override reasons and feedback.
          </p>
          <pre tabIndex={0} className="json mt-3 max-h-56 overflow-auto rounded-lg bg-ink text-emerald-100 p-3">{JSON.stringify(DISCOVERY, null, 2)}</pre>
        </div>
      </section>

      <section className="card p-5 mt-8">
        <h2 className="font-display text-2xl">Honest by design</h2>
        <ul className="mt-3 space-y-2 text-sm text-ink-2 list-disc pl-5">
          <li>
            <b>Explainable, not a black box.</b> Each hazard is a small logistic model with named factors and published weights.
            Every RiskAssessment carries the factors that produced it as structured extensions.
          </li>
          <li>
            <b>Expert priors, ready to learn.</b> Weights are literature-informed priors, not fitted coefficients. They are
            built to be recalibrated against OneAquaHealth lab campaigns and syndromic data.
          </li>
          <li>
            <b>Privacy.</b> Volunteers are pseudonymous. Clinic feedback shares a count per stream reach, never the patient.
          </li>
          <li>
            <b>Humans decide.</b> Cards suggest, never order. Citizen checks stay &ldquo;awaiting verification&rdquo; until a
            coordinator reviews them. Low data freshness lowers the stated confidence.
          </li>
        </ul>
      </section>
    </div>
  );
}
