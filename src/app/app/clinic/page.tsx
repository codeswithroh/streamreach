import { DEMO_PATIENTS } from "@/lib/cds/demo-patients";
import { DISCOVERY } from "@/lib/cds/service";
import { PageHeader } from "@/components/shell/PageHeader";
import { Ehr } from "./Ehr";

export const metadata = { title: "Clinic view · StreamReach" };

export default function ClinicPage() {
  return (
    <div className="mx-auto max-w-[1500px] px-4 sm:px-6 py-6">
      <PageHeader
        eyebrow="Demo EHR"
        title="Clinic view"
        subtitle={
          <p>
            Stream alerts inside the patient chart, via{" "}
            <a href="/cds-services" target="_blank" className="text-accent font-medium hover:underline">
              CDS Hooks ↗
            </a>
          </p>
        }
      />
      <Ehr patients={DEMO_PATIENTS} serviceId={DISCOVERY.services[0].id} />
    </div>
  );
}
