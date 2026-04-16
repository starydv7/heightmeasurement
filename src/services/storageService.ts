import AsyncStorage from '@react-native-async-storage/async-storage';
import { HeightResultSummary } from '../types/measurement';

const HEIGHT_HISTORY_KEY = 'heightmeasurement:history';

export type SavedHeightRecord = HeightResultSummary & {
  id: string;
  savedAt: string;
};

export async function saveHeightResult(result: HeightResultSummary): Promise<SavedHeightRecord> {
  const record: SavedHeightRecord = {
    ...result,
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
  };

  const existing = await AsyncStorage.getItem(HEIGHT_HISTORY_KEY);
  const records: SavedHeightRecord[] = existing ? JSON.parse(existing) : [];
  const nextRecords = [record, ...records];
  await AsyncStorage.setItem(HEIGHT_HISTORY_KEY, JSON.stringify(nextRecords));

  return record;
}

export async function getSavedHeightResults(): Promise<SavedHeightRecord[]> {
  const existing = await AsyncStorage.getItem(HEIGHT_HISTORY_KEY);
  return existing ? (JSON.parse(existing) as SavedHeightRecord[]) : [];
}
