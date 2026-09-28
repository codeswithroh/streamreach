import { Suspense } from "react";
import { SITES } from "@/lib/sites";
import { CheckForm } from "./CheckForm";

export const metadata = { title: "Stream check · StreamReach" };

export default function CheckPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8">
      <p className="eyebrow">Citizen stream check · 3 minutes</p>
      <h1 className="font-display text-4xl mt-1">What does the stream look like today?</h1>
      <p className="text-ink-2 mt-2">
        Five quick questions, the same ones the OneAquaHealth app asks. Your answers go into the stream&apos;s health record as
        FHIR data and update this week&apos;s warnings for your neighbours straight away.
      </p>
      <Suspense>
        <CheckForm sites={SITES.map((s) => ({ id: s.id, name: s.name, city: s.city }))} />
      </Suspense>
    </div>
  );
}
