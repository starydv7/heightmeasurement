export type HeightMeasurementInput = {
  personPixelHeight: number;
  referencePixelHeight: number;
  referenceRealHeightCm: number;
};

export type HeightMeasurementResult = {
  estimatedHeightCm: number;
  estimatedHeightFeet: string;
};
