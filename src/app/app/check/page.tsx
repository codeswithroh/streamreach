import { Suspense } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { getCurrentUser } from "@/lib/auth";
import { SITES } from "@/lib/sites";
import { CheckForm } from "./CheckForm";

export const metadata = { title: "Stream check · StreamReach" };

export default async function CheckPage() {
  const user = (await getCurrentUser())!;
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <PageHeader
        eyebrow="Citizen stream check · 3 minutes"
        title="What does the stream look like today?"
        subtitle={
          <p>
            Five quick questions, the same ones the OneAquaHealth app asks. Your answers go into the stream&apos;s health record as
            FHIR data under your pseudonymous code <b className="font-mono text-[13px]">{user.volunteerCode}</b>, and update this
            week&apos;s warnings for your neighbours straight away.
          </p>
        }
      />
      <Suspense>
        <CheckForm sites={SITES.map((s) => ({ id: s.id, name: s.name, city: s.city }))} volunteer={user.volunteerCode} />
      </Suspense>
    </div>
  );
}
