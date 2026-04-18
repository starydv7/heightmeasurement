import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { saveHeightResult } from '../services/storageService';
import { HeightResultSummary } from '../types/measurement';

type ResultScreenProps = {
  result: HeightResultSummary;
  onBack: () => void;
  onSaved: () => void;
};

export function ResultScreen({ result, onBack, onSaved }: ResultScreenProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveResult = async () => {
    try {
      setIsSaving(true);
      await saveHeightResult(result);
      Alert.alert('Saved', 'Result saved locally on this device.');
      onSaved();
    } catch {
      Alert.alert('Save failed', 'Could not save result. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareResult = async () => {
    try {
      await Share.share({
        message: `Height result: ${result.estimatedHeightCm} cm (${result.estimatedHeightFeet}). Person pixels: ${result.personPixelHeight}px, reference pixels: ${result.referencePixelHeight}px, confidence: ${result.confidencePercent}%.`,
      });
    } catch {
      Alert.alert('Share failed', 'Could not open the share dialog.');
    }
  };

  return (
    <LinearGradient colors={['#020817', '#0B1635', '#040A1D']} style={styles.page}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Pressable style={styles.iconBtn} onPress={onBack}>
            <Text style={styles.iconText}>{'<'}</Text>
          </Pressable>
          <Text style={styles.title}>Result</Text>
          <Pressable style={styles.iconBtn} onPress={handleShareResult}>
            <Text style={styles.iconText}>↗</Text>
          </Pressable>
        </View>

        <View style={styles.donePill}>
          <Text style={styles.donePillText}>MEASUREMENT COMPLETE</Text>
        </View>

        <View style={styles.resultLine}>
          <Text style={styles.resultValue}>{result.estimatedHeightCm}</Text>
          <Text style={styles.resultUnit}>cm</Text>
        </View>
        <Text style={styles.resultFeet}>≈ {result.estimatedHeightFeet}</Text>

        <View style={styles.compareCard}>
          <Text style={styles.youTag}>YOU</Text>
          <View style={styles.bars}>
            <View style={[styles.bar, styles.barAvg]} />
            <View style={[styles.bar, styles.barYou]} />
            <View style={[styles.bar, styles.barRef]} />
          </View>
          <View style={styles.barLabels}>
            <Text style={styles.barLabel}>{result.referenceRealHeightCm} cm</Text>
            <Text style={styles.barLabel}>{result.estimatedHeightCm} cm</Text>
            <Text style={styles.barLabel}>{result.referenceRealHeightCm} cm</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{result.personPixelHeight}px</Text>
            <Text style={styles.metricLabel}>PERSON PIXELS</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{result.referencePixelHeight}px</Text>
            <Text style={styles.metricLabel}>REF PIXELS</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{result.confidencePercent}%</Text>
            <Text style={styles.metricLabel}>CONFIDENCE</Text>
          </View>
        </View>

        <Pressable style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} onPress={handleSaveResult} disabled={isSaving}>
          <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save Result'}</Text>
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flex: 1, padding: 16, paddingTop: 24 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.3)',
    backgroundColor: 'rgba(30,41,59,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#67E8F9', fontWeight: '800' },
  title: { color: '#F8FAFC', fontSize: 25, fontWeight: '800' },
  donePill: {
    marginTop: 18,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  donePillText: { color: '#22D3EE', fontSize: 11, fontWeight: '800' },
  resultLine: { marginTop: 18, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  resultValue: { color: '#F8FAFC', fontSize: 80, fontWeight: '900', lineHeight: 86 },
  resultUnit: { color: '#22D3EE', fontSize: 40, fontWeight: '800' },
  resultFeet: { textAlign: 'center', color: '#93C5FD', fontSize: 24, marginTop: 4, fontWeight: '700' },
  compareCard: {
    marginTop: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(30,41,59,0.5)',
    padding: 14,
  },
  youTag: { alignSelf: 'center', color: '#22D3EE', fontWeight: '800', marginBottom: 8 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 86 },
  bar: { width: 62, borderRadius: 8 },
  barAvg: { height: 45, backgroundColor: '#334155' },
  barYou: { height: 72, backgroundColor: '#22D3EE' },
  barRef: { height: 58, backgroundColor: '#3730A3' },
  barLabels: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: '#93C5FD', fontSize: 11, fontWeight: '700' },
  metricsRow: { marginTop: 14, flexDirection: 'row', gap: 8 },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.25)',
    backgroundColor: 'rgba(30,41,59,0.5)',
    padding: 10,
  },
  metricValue: { color: '#F8FAFC', fontSize: 24, fontWeight: '900' },
  metricLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  saveButton: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: '#22D3EE',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 15,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: { color: '#042F2E', fontSize: 21, fontWeight: '800' },
});
