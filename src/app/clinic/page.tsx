import { DEMO_PATIENTS } from "@/lib/cds/demo-patients";
import { DISCOVERY } from "@/lib/cds/service";
import { Ehr } from "./Ehr";

export const metadata = { title: "Clinic view · Tributary" };

export default function ClinicPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="eyebrow">Clinic view · demo EHR calling a real CDS Hooks service</p>
          <h1 className="font-display text-4xl mt-1">The stream shows up in the consultation.</h1>
          <p className="text-ink-2 mt-2">
            When a GP opens a chart, the EHR fires the <code className="text-[13px] bg-stone-200/70 px-1 rounded">patient-view</code> hook.
            Tributary checks where the patient lives, matches their symptoms to nearby stream hazards, and returns at most two
            cards. The GP can share an anonymous case back, and that feeds the stream&apos;s risk score.
          </p>
        </div>
        <a href="/cds-services" target="_blank" className="text-sm text-river hover:underline shrink-0">
          CDS Hooks discovery endpoint ↗
        </a>
      </div>
      <Ehr patients={DEMO_PATIENTS} serviceId={DISCOVERY.services[0].id} />
    </div>
  );
}
