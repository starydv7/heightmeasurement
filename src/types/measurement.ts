export type HeightMeasurementInput = {
  personPixelHeight: number;
  referencePixelHeight: number;
  referenceRealHeightCm: number;
};

export type HeightMeasurementResult = {
  estimatedHeightCm: number;
  estimatedHeightFeet: string;
};

export type HeightResultSummary = {
  estimatedHeightCm: number;
  estimatedHeightFeet: string;
  personPixelHeight: number;
  referencePixelHeight: number;
  referenceRealHeightCm: number;
  /** Estimated confidence (0–100) from how pixel values were obtained, not physical measurement accuracy. */
  confidencePercent: number;
};

export type UserProfile = {
  fullName: string;
  age: string;
  address: string;
};
