// Monitoring sites. Coordinates for the Heraklion reaches come from the official
// OneAquaHealth FHIR IG examples (hl7-eu/oah); the others are demo reaches placed
// in OneAquaHealth case-study cities.

export type SiteSource = "oah-ig" | "demo";

export interface Vulnerability {
  /** Share of sealed surface in the upstream catchment, 0..1 */
  impervious: number;
  /** Combined sewer overflows / storm outfalls within 2 km upstream */
  overflowsUpstream: number;
  /** Daily rainfall (mm) at which overflows typically start spilling */
  overflowThresholdMm: number;
  /** People living within 1 km of the reach */
  residentsWithin1km: number;
  /** Stream is used for paddling, dog walking, fishing, allotment irrigation */
  recreationalUse: boolean;
  /** West Nile / Culex activity reported in the region in recent seasons */
  vectorEndemic: boolean;
}

export interface Site {
  id: string;
  name: string;
  river: string;
  city: string;
  country: string;
  countryCode: string;
  district: string;
  lat: number;
  lon: number;
  source: SiteSource;
  vulnerability: Vulnerability;
  /** Plain-language description of what people do here, used in advisories */
  uses: string;
}

export const SITES: Site[] = [
  {
    id: "giofyros-1",
    name: "Giofyros Reach A",
    river: "Giofyros",
    city: "Heraklion",
    country: "Greece",
    countryCode: "GR",
    district: "Heraklion West",
    lat: 35.32135,
    lon: 25.10592,
    source: "oah-ig",
    uses: "walking path, dog walking, allotment irrigation",
    vulnerability: {
      impervious: 0.62,
      overflowsUpstream: 3,
      overflowThresholdMm: 12,
      residentsWithin1km: 14800,
      recreationalUse: true,
      vectorEndemic: true,
    },
  },
  {
    id: "giofyros-2",
    name: "Giofyros Lower Reach",
    river: "Giofyros",
    city: "Heraklion",
    country: "Greece",
    countryCode: "GR",
    district: "Heraklion South",
    lat: 35.2623,
    lon: 25.10458,
    source: "oah-ig",
    uses: "farm irrigation, grazing, informal bathing in summer",
    vulnerability: {
      impervious: 0.28,
      overflowsUpstream: 1,
      overflowThresholdMm: 18,
      residentsWithin1km: 3900,
      recreationalUse: true,
      vectorEndemic: true,
    },
  },
  {
    id: "almyros-1",
    name: "Almyros Reach",
    river: "Almyros",
    city: "Heraklion",
    country: "Greece",
    countryCode: "GR",
    district: "Gazi",
    lat: 35.33399,
    lon: 25.04834,
    source: "oah-ig",
    uses: "coastal wetland, birdwatching, children playing at the mouth",
    vulnerability: {
      impervious: 0.35,
      overflowsUpstream: 1,
      overflowThresholdMm: 20,
      residentsWithin1km: 6200,
      recreationalUse: true,
      vectorEndemic: true,
    },
  },
  {
    id: "sabato-bn",
    name: "Sabato at Ponte Leproso",
    river: "Sabato",
    city: "Benevento",
    country: "Italy",
    countryCode: "IT",
    district: "Benevento Centro",
    lat: 41.1266,
    lon: 14.7676,
    source: "demo",
    uses: "riverside park, fishing, summer paddling",
    vulnerability: {
      impervious: 0.48,
      overflowsUpstream: 2,
      overflowThresholdMm: 15,
      residentsWithin1km: 11200,
      recreationalUse: true,
      vectorEndemic: true,
    },
  },
  {
    id: "akerselva-oslo",
    name: "Akerselva at Nydalen",
    river: "Akerselva",
    city: "Oslo",
    country: "Norway",
    countryCode: "NO",
    district: "Nordre Aker",
    lat: 59.9496,
    lon: 10.7648,
    source: "demo",
    uses: "popular riverside trail, swimming spots, dog walking",
    vulnerability: {
      impervious: 0.55,
      overflowsUpstream: 4,
      overflowThresholdMm: 10,
      residentsWithin1km: 19500,
      recreationalUse: true,
      vectorEndemic: false,
    },
  },
  {
    id: "coselhas-coimbra",
    name: "Ribeira de Coselhas",
    river: "Coselhas",
    city: "Coimbra",
    country: "Portugal",
    countryCode: "PT",
    district: "Eiras",
    lat: 40.2231,
    lon: -8.4142,
    source: "demo",
    uses: "urban green corridor, community gardens, school nature walks",
    vulnerability: {
      impervious: 0.58,
      overflowsUpstream: 2,
      overflowThresholdMm: 12,
      residentsWithin1km: 9800,
      recreationalUse: true,
      vectorEndemic: false,
    },
  },
  {
    id: "calore-bn",
    name: "Calore at Ponte Vanvitelli",
    river: "Calore",
    city: "Benevento",
    country: "Italy",
    countryCode: "IT",
    district: "Benevento Nord",
    lat: 41.1338,
    lon: 14.7742,
    source: "demo",
    uses: "riverside walks, fishing, summer camp activities",
    vulnerability: {
      impervious: 0.41,
      overflowsUpstream: 2,
      overflowThresholdMm: 16,
      residentsWithin1km: 8700,
      recreationalUse: true,
      vectorEndemic: true,
    },
  },
  {
    id: "alna-oslo",
    name: "Alna at Kværnerdalen",
    river: "Alna",
    city: "Oslo",
    country: "Norway",
    countryCode: "NO",
    district: "Gamle Oslo",
    lat: 59.9052,
    lon: 10.7885,
    source: "demo",
    uses: "reopened urban stream, playground, cycle path",
    vulnerability: {
      impervious: 0.71,
      overflowsUpstream: 5,
      overflowThresholdMm: 8,
      residentsWithin1km: 23400,
      recreationalUse: true,
      vectorEndemic: false,
    },
  },
  {
    id: "hovinbekken-oslo",
    name: "Hovinbekken at Ensjø",
    river: "Hovinbekken",
    city: "Oslo",
    country: "Norway",
    countryCode: "NO",
    district: "Gamle Oslo",
    lat: 59.9146,
    lon: 10.7868,
    source: "demo",
    uses: "daylighted stream through new housing, school garden",
    vulnerability: {
      impervious: 0.66,
      overflowsUpstream: 3,
      overflowThresholdMm: 9,
      residentsWithin1km: 17600,
      recreationalUse: true,
      vectorEndemic: false,
    },
  },
  {
    id: "mondego-coimbra",
    name: "Mondego at Choupal",
    river: "Mondego",
    city: "Coimbra",
    country: "Portugal",
    countryCode: "PT",
    district: "Coimbra Centro",
    lat: 40.2153,
    lon: -8.4418,
    source: "demo",
    uses: "rowing club, riverside park, informal swimming in summer",
    vulnerability: {
      impervious: 0.37,
      overflowsUpstream: 2,
      overflowThresholdMm: 18,
      residentsWithin1km: 12900,
      recreationalUse: true,
      vectorEndemic: false,
    },
  },
];

export function getSite(id: string): Site | undefined {
  return SITES.find((s) => s.id === id);
}

/** Great-circle distance in km */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
