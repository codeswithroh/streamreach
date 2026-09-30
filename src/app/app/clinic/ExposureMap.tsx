"use client";

import L from "leaflet";
import { useEffect } from "react";
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";

export interface NearStream {
  id: string;
  name: string;
  lat: number;
  lon: number;
  km: number | null;
  color: string;
  label: string;
}

const home = L.divIcon({
  className: "",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
  html: `<div style="width:30px;height:30px;border-radius:999px;background:#1e2a44;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:grid;place-items:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg></div>`,
});

function Fit({ home: h, streams }: { home: [number, number]; streams: NearStream[] }) {
  const map = useMap();
  const key = JSON.stringify([h, ...streams.map((s) => [s.lat, s.lon])]);
  useEffect(() => {
    const pts = JSON.parse(key) as [number, number][];
    map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 14, animate: false });
  }, [map, key]);
  return null;
}

export default function ExposureMap({ lat, lon, streams }: { lat: number; lon: number; streams: NearStream[] }) {
  return (
    <MapContainer center={[lat, lon]} zoom={13} zoomControl={false} zoomAnimation={false} fadeAnimation={false} scrollWheelZoom={false} className="h-full w-full rounded-xl" attributionControl>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" className="tile-soft" />
      <Fit home={[lat, lon]} streams={streams} />
      <Circle center={[lat, lon]} radius={2000} pathOptions={{ color: "#1e2a44", weight: 1, dashArray: "4 4", fillOpacity: 0.04 }} />
      {streams.map((s) => (
        <CircleMarker key={s.id} center={[s.lat, s.lon]} radius={10} pathOptions={{ color: "#fff", weight: 2, fillColor: s.color, fillOpacity: 0.95 }}>
          <Tooltip direction="top" offset={[0, -8]} permanent={streams.length <= 2}>
            <span className="text-xs font-medium">
              {s.name}
              {s.km != null ? ` · ${s.km} km` : ""}
            </span>
          </Tooltip>
        </CircleMarker>
      ))}
      <Marker position={[lat, lon]} icon={home} />
    </MapContainer>
  );
}
