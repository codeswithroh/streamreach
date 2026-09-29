"use client";

import { dayMonth as fmt } from "@/lib/format";

export interface ChartSeries {
  name: string;
  color: string;
  values: number[]; // 0..1
}

/** Risk probability lines over daily bars (rain in mm or max temperature). */
export function RiskChart({
  dates,
  series,
  bars,
  barLabel,
  barUnit,
  todayIndex,
  selectedIndex,
  onSelect,
}: {
  dates: string[];
  series: ChartSeries[];
  bars: number[];
  barLabel: string;
  barUnit: string;
  todayIndex: number;
  selectedIndex: number;
  onSelect: (i: number) => void;
}) {
  const W = 760;
  const H = 190;
  const pad = { l: 34, r: 12, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const n = dates.length;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const y = (p: number) => pad.t + ih - p * ih;
  const barMax = Math.max(1, ...bars);
  const barW = Math.max(4, iw / n / 3.2);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-2">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <i className="w-2.5 h-2.5 rounded-sm inline-block bg-amber-400" />
          {barLabel}, {barUnit}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto mt-2" role="img" aria-label={`Risk probability by hazard and ${barLabel.toLowerCase()} over ${n} days`}>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e3e6e1" strokeDasharray={t === 0 ? undefined : "3 4"} />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#5b6472">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {/* forecast shading */}
        <rect x={x(todayIndex)} y={pad.t} width={x(n - 1) - x(todayIndex)} height={ih} fill="#1e2a44" opacity={0.035} />
        <text x={x(todayIndex) + 4} y={pad.t + 10} fontSize="10" fill="#5b6472">
          forecast
        </text>
        {bars.map((b, i) => (
          <rect key={i} x={x(i) - barW / 2} y={y((b / barMax) * 0.85)} width={barW} height={y(0) - y((b / barMax) * 0.85)} rx={2} fill="#f5a524" opacity={i < todayIndex ? 0.55 : 0.9}>
            <title>{`${fmt(dates[i])}: ${Math.round(b * 10) / 10} ${barUnit}`}</title>
          </rect>
        ))}
        {series.map((s) => (
          <path
            key={s.name}
            d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={2.2}
            strokeLinejoin="round"
          />
        ))}
        <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1={pad.t} y2={pad.t + ih} stroke="#e5484d" strokeWidth={1.5} />
        {dates.map((d, i) => (
          <g key={d}>
            {(i % 2 === 0 || i === selectedIndex) && (
              <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill={i === selectedIndex ? "#e5484d" : "#5b6472"} fontWeight={i === selectedIndex ? 600 : 400}>
                {i === todayIndex ? "Today" : fmt(d)}
              </text>
            )}
            <rect x={x(i) - iw / n / 2} y={pad.t} width={iw / n} height={ih} fill="transparent" onClick={() => onSelect(i)} style={{ cursor: "pointer" }}>
              <title>{fmt(d)}</title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  );
}
