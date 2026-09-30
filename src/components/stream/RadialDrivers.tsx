import type { Factor } from "@/lib/risk/engine";

const R = 118;
const r2 = (x: number) => Math.round(x * 100) / 100;
const RINGS = [0.25, 0.5, 0.75, 1];

function sector(r: number, a0: number, a1: number) {
  if (r <= 0.5) return "";
  const p = (a: number) => `${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M0 0 L${p(a0)} A${r} ${r} 0 ${large} 1 ${p(a1)} Z`;
}

/** Split a label into at most two lines of ~14 characters. */
function lines(label: string) {
  if (label.length <= 14) return [label];
  const words = label.split(" ");
  let a = "";
  while (words.length && (a + " " + words[0]).trim().length <= 14) a = `${a} ${words.shift()}`.trim();
  if (!a) a = words.shift()!;
  return [a, words.join(" ")].filter(Boolean);
}

/**
 * Polar "rose" of a hazard's risk factors. Each wedge is one factor: the faint
 * wedge is its full weight in the model, the solid wedge what it contributes today.
 */
export function RadialDrivers({ factors, color }: { factors: Factor[]; color: string }) {
  const n = Math.max(1, factors.length);
  const maxW = Math.max(0.5, ...factors.map((f) => f.weight));
  const step = (2 * Math.PI) / n;
  const gap = n > 1 ? 0.035 : 0;
  return (
    <svg viewBox="-235 -160 470 320" className="w-full max-w-[560px] mx-auto h-auto" role="img" aria-label="Risk factors: contribution against full weight">
      {factors.map((f, i) => {
        const a0 = i * step + gap;
        const a1 = (i + 1) * step - gap;
        const ghost = (f.weight / maxW) * R;
        const solid = (f.contribution / maxW) * R;
        return (
          <g key={f.id}>
            <title>{`${f.label}: +${f.contribution.toFixed(2)} of ${f.weight.toFixed(2)} · ${f.detail}`}</title>
            <path d={n === 1 ? "" : sector(ghost, a0, a1)} fill={color} opacity={0.16} />
            <path d={n === 1 ? "" : sector(solid, a0, a1)} fill={color} />
            {n === 1 && (
              <>
                <circle r={ghost} fill={color} opacity={0.16} />
                <circle r={solid} fill={color} />
              </>
            )}
          </g>
        );
      })}
      {/* ring grid drawn over the wedges turns them into cells */}
      {RINGS.map((t) => (
        <circle key={t} r={t * R} fill="none" stroke="#fff" strokeWidth={2} />
      ))}
      {RINGS.map((t) => (
        <circle key={`o${t}`} r={t * R} fill="none" stroke="#151c28" strokeOpacity={0.08} strokeDasharray="2 3" />
      ))}
      {n > 1 &&
        factors.map((_, i) => {
          const a = i * step;
          return <line key={i} x1={0} y1={0} x2={r2(R * Math.sin(a))} y2={r2(-R * Math.cos(a))} stroke="#fff" strokeWidth={3} />;
        })}
      {factors.map((f, i) => {
        const a = (i + 0.5) * step;
        const x = r2((R + 16) * Math.sin(a));
        const y = r2(-(R + 16) * Math.cos(a));
        const anchor = Math.abs(x) < 12 ? "middle" : x > 0 ? "start" : "end";
        const ls = lines(f.label);
        const h = (ls.length + 1) * 13;
        const dy = y < -R * 0.6 ? -h + 10 : y > R * 0.6 ? 10 : -h / 2 + 10;
        return (
          <text key={f.id} x={x} y={r2(y + dy)} textAnchor={anchor} fontSize={11.5} fill="#3d4654">
            {ls.map((l, k) => (
              <tspan key={k} x={x} dy={k ? 13 : 0}>
                {l}
              </tspan>
            ))}
            <tspan x={x} dy={13} fill="#5b6472" fontSize={10.5} fontWeight={600}>
              +{f.contribution.toFixed(1)}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
