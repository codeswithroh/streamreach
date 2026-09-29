import { DEMO_PATIENTS } from "@/lib/cds/demo-patients";
import { DISCOVERY } from "@/lib/cds/service";
import { PageHeader } from "@/components/shell/PageHeader";
import { Ehr } from "./Ehr";

export const metadata = { title: "Clinic view · StreamReach" };

export default function ClinicPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <PageHeader
        eyebrow="Clinic view · demo EHR calling a real CDS Hooks service"
        title="The stream shows up in the consultation."
        subtitle={
          <>
            <p>
              When a GP opens a chart, the EHR fires the <code className="text-[13px] bg-white border border-line px-1 rounded">patient-view</code> hook.
              StreamReach checks where the patient lives, matches their symptoms to nearby stream hazards, and returns at most two
              cards. The GP can share an anonymous case back, and that feeds the stream&apos;s risk score.
            </p>
            <a href="/cds-services" target="_blank" className="inline-block mt-2 text-sm text-accent font-medium hover:underline">
              CDS Hooks discovery endpoint ↗
            </a>
          </>
        }
      />
      <Ehr patients={DEMO_PATIENTS} serviceId={DISCOVERY.services[0].id} />
    </div>
  );
}
