export const surfaceNames = {
  patient: "Pharmacy Finder",
  prescriber: "Medication Lookup",
  methodology: "Methodology",
} as const;

export const openSurfaceLabels = {
  patient: `Open ${surfaceNames.patient}`,
  prescriber: `Open ${surfaceNames.prescriber}`,
} as const;

export const combinedSurfaceLabel = `${surfaceNames.patient} + ${surfaceNames.prescriber}`;
