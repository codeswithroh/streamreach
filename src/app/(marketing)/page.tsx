import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  CloudRain,
  HeartPulse,
  LineChart,
  Map,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Users,
  Waves,
} from "lucide-react";
import Link from "next/link";

export const metadata = { title: "StreamReach: One Health early warning for urban streams" };

const FEATURES = [
  {
    icon: Map,
    title: "Monitoring dashboard",
    text: "Every stream on a satellite map, coloured by forecast risk. Step through the next six days and stress-test storms and heatwaves.",
  },
  {
    icon: LineChart,
    title: "Explainable forecasts",
    text: "Three risk models (sewage germs, toxic algae, mosquito-borne disease) with every factor named, sourced and weighted. No black box.",
  },
  {
    icon: ClipboardCheck,
    title: "3-minute stream checks",
    text: "Citizens answer five plain-language questions based on OneAquaHealth indicators, and see straight away what their check changed.",
  },
  {
    icon: Stethoscope,
    title: "Alerts inside the EHR",
    text: "A CDS Hooks service puts stream risk in front of GPs when they open a chart, matched to the patient's symptoms. Two cards at most.",
  },
  {
    icon: Sparkles,
    title: "AI duty officer",
    text: "An AI agent gathers the evidence and drafts a response plan in the local language. A named officer approves it before anything is published.",
  },
  {
    icon: BookOpen,
    title: "Built on health standards",
    text: "HL7 FHIR R4 with the official OneAquaHealth profiles, validated with the HL7 validator. Any FHIR server or EHR can plug in.",
  },
];

const STEPS = [
  { icon: Users, title: "Citizens check", text: "Foam, flow, algae and larvae, reported in three minutes." },
  { icon: CloudRain, title: "Forecast", text: "Checks, lab results and the 7-day weather become a daily risk." },
  { icon: ShieldCheck, title: "Public health acts", text: "Warnings, what-if planning and AI-drafted advisories, approved by a person." },
  { icon: Stethoscope, title: "Clinicians see it", text: "Relevant alerts appear in the patient chart when it matters." },
  { icon: HeartPulse, title: "The loop closes", text: "GPs share anonymous stream-linked cases, which sharpen the forecast." },
];

const ROLES = [
  {
    icon: ShieldCheck,
    title: "Public-health teams",
    points: ["City-wide stream risk at a glance", "What-if planning for storms and heat", "AI-drafted, human-approved advisories", "A verification queue for citizen data"],
  },
  {
    icon: Users,
    title: "Citizen volunteers",
    points: ["A simple guided check with 'why we ask'", "See how your check changed the warnings", "Pseudonymous: your name is never published", "Works on any phone"],
  },
  {
    icon: Stethoscope,
    title: "Clinicians",
    points: ["Stream exposure alerts in the EHR", "Symptom-matched, with suggested tests", "One-click anonymous feedback", "Silent when nothing is relevant"],
  },
];

export default function Landing() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pt-14 sm:pt-20 pb-16 grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-12 items-center">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white border border-line px-3 py-1 text-xs font-medium text-ink-2">
            <Waves size={14} className="text-accent" /> One Health early warning for urban streams
          </p>
          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-[56px] font-semibold tracking-tight leading-[1.08]">
            From streams <span className="text-accent">to systems.</span>
          </h1>
          <p className="mt-5 text-lg text-ink-2 max-w-xl">
            StreamReach turns citizen stream checks and the weather forecast into early warnings for waterborne germs, toxic
            algae and mosquito-borne disease, and delivers them to public health teams and to GPs inside the patient record.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/signin" className="btn-accent inline-flex items-center gap-2 px-5 py-3 text-[15px]">
              Try the live demo <ArrowRight size={18} />
            </Link>
            <Link href="/#how" className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-white px-5 py-3 text-[15px] font-medium hover:border-ink-3">
              How it works
            </Link>
          </div>
          <p className="mt-6 text-xs text-ink-3">Built on HL7 FHIR R4 · CDS Hooks 2.0 · OneAquaHealth FHIR IG · Claude</p>
        </div>
        <div className="relative">
          <div className="rounded-[22px] bg-[#1b1f24] p-2.5 shadow-[0_30px_80px_rgba(12,18,28,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/landing/dashboard.png" alt="StreamReach monitoring dashboard: satellite map of a stream with risk zone, forecast chart and stream details" className="rounded-[14px] w-full h-auto" />
          </div>
          <div className="hidden sm:block absolute -bottom-6 -left-6 float-card p-4 w-64">
            <p className="text-xs text-ink-3">Giofyros Reach A · Heraklion</p>
            <p className="font-semibold mt-1">Overflow likely after 40 mm of rain</p>
            <p className="mt-2 inline-flex chip lvl-very-high">Very high · 91%</p>
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <dl className="mx-auto max-w-7xl px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ["10", "urban streams in 4 OneAquaHealth cities"],
            ["3", "One Health hazards forecast daily"],
            ["7 days", "of live weather forecast"],
            ["0", "errors against the official FHIR validator"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="text-3xl font-semibold tracking-tight">{v}</dd>
              <dd className="text-sm text-ink-3 mt-1">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20 grid md:grid-cols-2 gap-10 items-start">
        <div>
          <p className="eyebrow">The problem</p>
          <h2 className="text-3xl font-semibold tracking-tight mt-2">Two groups watch the same stream and never talk.</h2>
        </div>
        <div className="text-ink-2 space-y-4 text-[17px]">
          <p>
            Volunteers notice sewage smells, green water and mosquito larvae. Doctors see the diarrhoea, rashes and fevers that follow.
          </p>
          <p>
            But the observation stays in an app, and the GP never learns that the patient&apos;s dog-walking path runs along a stream that
            overflowed last night. StreamReach connects the two, in the systems each side already uses.
          </p>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-4 sm:px-6 pb-20 scroll-mt-20">
        <p className="eyebrow">Features</p>
        <h2 className="text-3xl font-semibold tracking-tight mt-2">Everything a city needs to act early</h2>
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article key={title} className="card p-6">
              <span className="grid place-items-center w-11 h-11 rounded-xl bg-river-soft text-river">
                <Icon size={20} />
              </span>
              <h3 className="font-semibold text-lg mt-4">{title}</h3>
              <p className="text-sm text-ink-2 mt-2 leading-relaxed">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="how" className="bg-river text-white scroll-mt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <p className="eyebrow !text-white/70">How it works</p>
          <h2 className="text-3xl font-semibold tracking-tight mt-2">One loop, from the stream bank to the clinic and back</h2>
          <ol className="mt-10 grid md:grid-cols-5 gap-4">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="rounded-2xl bg-white/5 border border-white/10 p-5">
                <span className="text-xs text-white/60 font-semibold">0{i + 1}</span>
                <Icon size={22} className="mt-3 text-[#ff8a8e]" />
                <p className="font-semibold mt-3">{title}</p>
                <p className="text-sm text-white/75 mt-1.5">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="roles" className="mx-auto max-w-7xl px-4 sm:px-6 py-20 scroll-mt-20">
        <p className="eyebrow">Who it&apos;s for</p>
        <h2 className="text-3xl font-semibold tracking-tight mt-2">One platform, three roles</h2>
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          {ROLES.map(({ icon: Icon, title, points }) => (
            <article key={title} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="grid place-items-center w-11 h-11 rounded-xl bg-accent-soft text-accent">
                  <Icon size={20} />
                </span>
                <h3 className="font-semibold text-lg">{title}</h3>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-ink-2">
                {points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-accent">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <div className="rounded-3xl bg-white border border-line p-8 sm:p-12 flex flex-col md:flex-row md:items-center gap-6 justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">See it with live data</h2>
            <p className="text-ink-2 mt-2 max-w-xl">
              Sign in with a demo account as an officer, a volunteer or a clinician. No sign-up needed. The weather forecast is live.
            </p>
          </div>
          <Link href="/signin" className="btn-accent inline-flex items-center gap-2 px-6 py-3 text-[15px] shrink-0">
            Try the live demo <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
