"use client";

import L from "leaflet";
import { Crosshair, Layers, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

export interface MapPoint {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  color: string;
  label: string;
}

const EUROPE: L.LatLngBoundsExpression = [
  [34.5, -10],
  [61, 27],
];

const pin = L.divIcon({
  className: "",
  iconSize: [28, 36],
  iconAnchor: [14, 34],
  html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.5 14 35 14 35s12.5-12.5 12.5-21.8C26.5 6.4 21 1 14 1Z" fill="#e5484d" stroke="#fff" stroke-width="2"/><circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>`,
});

/** Keep streams clear of the floating panels on large screens. */
function panelPadding(): L.FitBoundsOptions {
  const wide = typeof window !== "undefined" && window.innerWidth >= 1024;
  return wide ? { paddingTopLeft: [150, 110], paddingBottomRight: [430, 370] } : { padding: [30, 30] };
}

function Controller({ selected, bounds, onReady }: { selected?: MapPoint; bounds: L.LatLngBounds; onReady: (m: L.Map) => void }) {
  const map = useMap();
  useEffect(() => onReady(map), [map, onReady]);
  useEffect(() => {
    if (selected) {
      const wide = window.innerWidth >= 1024;
      // centre the stream in the visible map area, left of the side panel and above the chart
      const target = map.project([selected.lat, selected.lon], 15).add(wide ? [190, 150] : [0, 0]);
      map.flyTo(map.unproject(target, 15), 15, { duration: 0.9 });
    } else map.flyToBounds(bounds, { ...panelPadding(), duration: 0.9 });
  }, [selected, map, bounds]);
  return null;
}

export default function SatelliteMap({
  points,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  const [map, setMap] = useState<L.Map>();
  const [satellite, setSatellite] = useState(true);
  const selected = useMemo(() => points.find((p) => p.id === selectedId), [points, selectedId]);
  const bounds = useMemo(() => L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])), [points]);

  return (
    <div className="absolute inset-0">
      <MapContainer bounds={EUROPE} zoomControl={false} scrollWheelZoom className="h-full w-full" attributionControl>
        {satellite ? (
          <TileLayer
            attribution="Tiles &copy; Esri, Maxar, Earthstar Geographics"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        ) : (
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        )}
        <Controller selected={selected} bounds={bounds} onReady={setMap} />
        {points.map((p) =>
          p.id === selectedId ? (
            <Circle
              key={p.id}
              center={[p.lat, p.lon]}
              radius={420}
              className={`zone-${p.id}`}
              pathOptions={{ color: "#ffffff", weight: 2, fillColor: p.color, fillOpacity: 0.55 }}
            />
          ) : (
            <CircleMarker
              key={p.id}
              center={[p.lat, p.lon]}
              radius={9}
              className={`marker-${p.id}`}
              pathOptions={{ color: "#fff", weight: 2, fillColor: p.color, fillOpacity: 0.95 }}
              eventHandlers={{ click: () => onSelect(p.id) }}
            >
              <Tooltip direction="top" offset={[0, -8]}>
                <div className="text-xs">
                  <div className="font-semibold">{p.name}</div>
                  <div>
                    {p.city}: {p.label}
                  </div>
                </div>
              </Tooltip>
            </CircleMarker>
          ),
        )}
        {selected && <Marker position={[selected.lat, selected.lon]} icon={pin} />}
      </MapContainer>

      <div className="absolute z-[500] left-4 lg:left-6 top-24 lg:top-28 flex flex-col gap-2">
        <button
          onClick={() => setSatellite((v) => !v)}
          aria-label={satellite ? "Switch to street map" : "Switch to satellite"}
          title={satellite ? "Street map" : "Satellite"}
          className="grid place-items-center w-10 h-10 rounded-xl bg-white shadow text-ink-2 hover:text-ink"
        >
          <Layers size={18} />
        </button>
        <div className="flex flex-col rounded-xl bg-white shadow overflow-hidden">
          <button aria-label="Zoom in" onClick={() => map?.zoomIn()} className="grid place-items-center w-10 h-10 text-ink-2 hover:bg-river-soft">
            <Plus size={18} />
          </button>
          <span className="h-px bg-line" />
          <button aria-label="Zoom out" onClick={() => map?.zoomOut()} className="grid place-items-center w-10 h-10 text-ink-2 hover:bg-river-soft">
            <Minus size={18} />
          </button>
        </div>
        <button
          aria-label="Show all streams"
          title="All streams"
          onClick={() => map?.flyToBounds(bounds, { ...panelPadding(), duration: 0.9 })}
          className="grid place-items-center w-10 h-10 rounded-xl bg-white shadow text-ink-2 hover:text-ink"
        >
          <Crosshair size={18} />
        </button>
      </div>
    </div>
  );
}
