import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { saveHeightResult } from '../services/storageService';
import { HeightResultSummary } from '../types/measurement';
import { scale, ui } from '../theme/ui';

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
    <LinearGradient colors={['#F7FAFF', '#EEF4FF']} style={styles.page}>
      <View style={styles.headerArea}>
        <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerBlock}>
          <View style={styles.topRow}>
            <Pressable style={styles.iconBtn} onPress={onBack}>
              <Text style={styles.iconText}>{'<'}</Text>
            </Pressable>
            <Text style={styles.title}>Result</Text>
            <Pressable style={styles.iconBtn} onPress={handleShareResult}>
              <Text style={styles.iconText}>↗</Text>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  headerArea: {
    minHeight: ui.header.minHeight,
    paddingHorizontal: 0,
    paddingTop: ui.header.paddingTop,
    paddingBottom: ui.header.paddingBottom,
    justifyContent: 'center',
  },
  content: { padding: scale(16), paddingBottom: scale(24) },
  headerBlock: {
    borderRadius: 0,
    paddingHorizontal: ui.header.paddingHorizontal,
    paddingVertical: ui.header.paddingBottom,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: {
    width: ui.header.iconSize,
    height: ui.header.iconSize,
    borderRadius: ui.header.iconRadius,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { color: '#FFFFFF', fontWeight: '800', fontSize: scale(14) },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: ui.header.titleFontSize,
    lineHeight: ui.header.titleLineHeight,
    fontWeight: '800',
  },
  donePill: {
    marginTop: scale(18),
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.45)',
    borderRadius: 999,
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
  },
  donePillText: { color: '#2D9FD6', fontSize: scale(11), fontWeight: '800' },
  resultLine: { marginTop: scale(18), flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  resultValue: { color: '#1F2A44', fontSize: scale(80), fontWeight: '900', lineHeight: scale(86) },
  resultUnit: { color: '#35BDF4', fontSize: scale(40), fontWeight: '800' },
  resultFeet: { textAlign: 'center', color: '#2D9FD6', fontSize: scale(24), marginTop: scale(4), fontWeight: '700' },
  compareCard: {
    marginTop: scale(22),
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    backgroundColor: '#FFFFFF',
    padding: scale(14),
  },
  youTag: { alignSelf: 'center', color: '#35BDF4', fontWeight: '800', marginBottom: scale(8) },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: scale(86) },
  bar: { width: scale(62), borderRadius: scale(8) },
  barAvg: { height: scale(45), backgroundColor: '#C8D2E8' },
  barYou: { height: scale(72), backgroundColor: '#35BDF4' },
  barRef: { height: scale(58), backgroundColor: '#6D63FF' },
  barLabels: { marginTop: scale(8), flexDirection: 'row', justifyContent: 'space-between' },
  barLabel: { color: '#4A5A7A', fontSize: scale(11), fontWeight: '700' },
  metricsRow: { marginTop: scale(14), flexDirection: 'row', gap: scale(8) },
  metricCard: {
    flex: 1,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    backgroundColor: '#FFFFFF',
    padding: scale(10),
  },
  metricValue: { color: '#1F2A44', fontSize: scale(24), fontWeight: '900' },
  metricLabel: { color: '#7C89A6', fontSize: scale(10), fontWeight: '700' },
  saveButton: {
    marginTop: 'auto',
    marginBottom: scale(24),
    backgroundColor: '#35BDF4',
    borderRadius: scale(16),
    alignItems: 'center',
    paddingVertical: scale(15),
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: scale(21), fontWeight: '800' },
});
