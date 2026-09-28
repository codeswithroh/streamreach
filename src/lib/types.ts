// Internal domain model. Everything here is projected to FHIR R4 in src/lib/fhir.

/** Codes from the OneAquaHealth IG code system (TemporaryOahSystem) that StreamReach reads. */
export type OahIndicatorCode =
  | "foam" // Foam/colour/smell
  | "diptera" // Diptera (Culicidae and Psychodidae)
  | "waterTemperature"
  | "hydrology" // flow state
  | "filamentous-algae"
  | "coliforms";

export type FlowState = "dry" | "stagnant" | "low" | "normal" | "high";

export type ObservationValue =
  | { kind: "coded"; system: string; code: string; display: string }
  | { kind: "quantity"; value: number; unit: string; ucum: string };

export type PerformerKind = "citizen" | "lab";

export interface StreamObservation {
  id: string;
  siteId: string;
  /** ISO date-time */
  effective: string;
  code: OahIndicatorCode;
  value: ObservationValue;
  performer: { kind: PerformerKind; id: string; display: string };
  /** Citizen checks start as preliminary until a coordinator verifies them */
  status: "preliminary" | "final";
  note?: string;
}

/** Anonymous, aggregated clinical signal fed back from clinicians via CDS Hooks feedback. */
export interface ClinicalSignal {
  id: string;
  siteId: string;
  district: string;
  /** ISO date */
  date: string;
  syndrome: "gastrointestinal" | "skin-rash" | "febrile";
  source: "cds-feedback" | "seed";
}

export type HazardId = "waterborne" | "cyanobacteria" | "vector";

export type RiskLevel = "low" | "moderate" | "high" | "very-high";
