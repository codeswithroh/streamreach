"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

const PRESETS = [
  { label: "Today's forecast", rain: 0, heat: 0 },
  { label: "Storm tomorrow · 40 mm", rain: 40, heat: 0 },
  { label: "Heatwave · +6 °C", rain: 0, heat: 6 },
  { label: "Storm after heat", rain: 30, heat: 4 },
];

export function ScenarioControls() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [rain, setRain] = useState(Number(sp.get("rain")) || 0);
  const [heat, setHeat] = useState(Number(sp.get("heat")) || 0);
  const [pending, start] = useTransition();

  const apply = (r: number, h: number) => {
    setRain(r);
    setHeat(h);
    const q = new URLSearchParams();
    if (r) q.set("rain", String(r));
    if (h) q.set("heat", String(h));
    start(() => router.replace(`${path}${q.size ? `?${q}` : ""}`, { scroll: false }));
  };
  const active = rain !== 0 || heat !== 0;

  return (
    <div className={`card p-4 ${active ? "ring-2 ring-amber-400/60" : ""}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">What-if planner</p>
          <p className="text-sm text-ink-2 mt-0.5">Stress-test the forecast before it happens.</p>
        </div>
        {pending && <span className="text-xs text-ink-3 animate-pulse">recomputing…</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {PRESETS.map((p) => {
          const on = p.rain === rain && p.heat === heat;
          return (
            <button
              key={p.label}
              onClick={() => apply(p.rain, p.heat)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                on ? "bg-ink text-white border-ink" : "border-line hover:border-ink-3 text-ink-2"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <label className="text-xs text-ink-2">
          <span className="flex justify-between">
            Extra rain (next 48 h) <b className="tabular-nums text-ink">{rain} mm</b>
          </span>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={rain}
            onChange={(e) => setRain(Number(e.target.value))}
            onPointerUp={() => apply(rain, heat)}
            onKeyUp={() => apply(rain, heat)}
            className="w-full accent-river mt-1"
          />
        </label>
        <label className="text-xs text-ink-2">
          <span className="flex justify-between">
            Warmer by <b className="tabular-nums text-ink">{heat > 0 ? "+" : ""}{heat} °C</b>
          </span>
          <input
            type="range"
            min={0}
            max={10}
            step={1}
            value={heat}
            onChange={(e) => setHeat(Number(e.target.value))}
            onPointerUp={() => apply(rain, heat)}
            onKeyUp={() => apply(rain, heat)}
            className="w-full accent-river mt-1"
          />
        </label>
      </div>
    </div>
  );
}
