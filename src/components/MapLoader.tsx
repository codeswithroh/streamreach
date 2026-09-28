"use client";

import dynamic from "next/dynamic";
import type { MapSite } from "./RiskMap";

const RiskMap = dynamic(() => import("./RiskMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-[13px] bg-line/40 animate-pulse" />,
});

export function MapLoader({ sites }: { sites: MapSite[] }) {
  return <RiskMap sites={sites} />;
}
