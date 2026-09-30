"use client";

import { useRouter } from "next/navigation";

export function StreamSwitcher({ current, sites }: { current: string; sites: { id: string; name: string; city: string }[] }) {
  const router = useRouter();
  return (
    <select
      aria-label="Switch stream"
      value={current}
      onChange={(e) => router.push(`/app/streams/${e.target.value}`)}
      className="h-11 max-w-[220px] rounded-xl border border-line bg-white px-3 text-sm font-medium focus:outline-none focus:border-ink-3"
    >
      {sites.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} · {s.city}
        </option>
      ))}
    </select>
  );
}
