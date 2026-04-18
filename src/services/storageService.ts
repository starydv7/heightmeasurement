import AsyncStorage from '@react-native-async-storage/async-storage';
import { HeightResultSummary, UserProfile } from '../types/measurement';

const HEIGHT_HISTORY_KEY = 'heightmeasurement:history';
const PROFILE_KEY = 'heightmeasurement:profile';

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

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function getUserProfile(): Promise<UserProfile> {
  const existing = await AsyncStorage.getItem(PROFILE_KEY);
  if (!existing) {
    return {
      fullName: '',
      age: '',
      address: '',
    };
  }

  return JSON.parse(existing) as UserProfile;
}
