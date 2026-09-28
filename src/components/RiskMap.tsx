"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useRouter } from "next/navigation";
import type { RiskLevel } from "@/lib/types";

export interface MapSite {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  level: RiskLevel;
  headline: string;
}

const HEX: Record<RiskLevel, string> = { low: "#3f8a5a", moderate: "#b8901c", high: "#d06a1f", "very-high": "#b8322a" };

const REGIONS: Record<string, { label: string; bounds: [[number, number], [number, number]] }> = {
  europe: { label: "All", bounds: [[34.5, -10], [61, 27]] },
  heraklion: { label: "Heraklion", bounds: [[35.24, 25.0], [35.36, 25.15]] },
  benevento: { label: "Benevento", bounds: [[41.115, 14.75], [41.142, 14.79]] },
  oslo: { label: "Oslo", bounds: [[59.9, 10.74], [59.955, 10.81]] },
  coimbra: { label: "Coimbra", bounds: [[40.205, -8.455], [40.232, -8.405]] },
};

function Fit({ region }: { region: string }) {
  const map = useMap();
  useEffect(() => {
    map.flyToBounds(REGIONS[region].bounds, { duration: 0.8, padding: [20, 20] });
  }, [region, map]);
  return null;
}

export default function RiskMap({ sites }: { sites: MapSite[] }) {
  const [region, setRegion] = useState("europe");
  const router = useRouter();
  const sorted = useMemo(() => [...sites].sort((a, b) => ["low", "moderate", "high", "very-high"].indexOf(a.level) - ["low", "moderate", "high", "very-high"].indexOf(b.level)), [sites]);
  return (
    <div className="relative h-full">
      <MapContainer bounds={REGIONS.europe.bounds} scrollWheelZoom={false} className="h-full w-full rounded-[13px]" attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="tile-soft"
        />
        <Fit region={region} />
        {sorted.map((s) => (
          <CircleMarker
            key={s.id}
            center={[s.lat, s.lon]}
            radius={region === "europe" ? 9 : 14}
            pathOptions={{ color: "#fff", weight: 2, fillColor: HEX[s.level], fillOpacity: 0.95 }}
            eventHandlers={{ click: () => router.push(`/sites/${s.id}${window.location.search}`) }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <div className="text-xs">
                <div className="font-semibold">{s.name}</div>
                <div>{s.city}: {s.headline}</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="absolute top-3 right-3 left-14 sm:left-auto justify-end z-[500] flex flex-wrap gap-1 bg-card/95 border border-line rounded-lg p-1 text-xs shadow-sm">
        {Object.entries(REGIONS).map(([k, r]) => (
          <button
            key={k}
            onClick={() => setRegion(k)}
            className={`px-2 py-1 rounded-md ${region === k ? "bg-river text-white" : "hover:bg-black/5 text-ink-2"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
