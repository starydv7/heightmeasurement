import { HeightMeasurementInput, HeightMeasurementResult } from '../types/measurement';
import { cmToFeetAndInches } from '../utils/unit';

export function estimateHeight(input: HeightMeasurementInput): HeightMeasurementResult {
  const ratio = input.personPixelHeight / input.referencePixelHeight;
  const estimatedHeightCm = Number((ratio * input.referenceRealHeightCm).toFixed(1));

  return {
    estimatedHeightCm,
    estimatedHeightFeet: cmToFeetAndInches(estimatedHeightCm),
  };
}
