import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../constants/theme';
import { HeightMeasurementResult } from '../types/measurement';

type ResultCardProps = {
  result: HeightMeasurementResult | null;
  editedHeightCm: string;
  onEditedHeightChange: (value: string) => void;
};

export function ResultCard({ result, editedHeightCm, onEditedHeightChange }: ResultCardProps) {
  if (!result) {
    return (
      <View style={[styles.card, styles.warning]}>
        <Text style={styles.warningText}>Enter values and tap "Estimate Height".</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.success]}>
      <Text style={styles.resultTitle}>Estimated Height</Text>
      <Text style={styles.resultMetric}>{result.estimatedHeightCm} cm</Text>
      <Text style={styles.resultImperial}>{result.estimatedHeightFeet}</Text>
      <View style={styles.editSection}>
        <Text style={styles.editLabel}>Editable Final Height (cm)</Text>
        <TextInput
          style={styles.editInput}
          keyboardType="numeric"
          value={editedHeightCm}
          onChangeText={onEditedHeightChange}
          placeholder="Adjust final height"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  warning: {
    borderColor: '#FED7AA',
    backgroundColor: colors.warningBg,
  },
  warningText: {
    color: colors.warningText,
    fontSize: 14,
  },
  success: {
    borderColor: '#86EFAC',
    backgroundColor: colors.successBg,
  },
  resultTitle: {
    fontSize: 14,
    color: colors.successText,
    marginBottom: 8,
    fontWeight: '700',
  },
  resultMetric: {
    fontSize: 30,
    color: '#14532D',
    fontWeight: '700',
  },
  resultImperial: {
    marginTop: 4,
    fontSize: 18,
    color: '#166534',
  },
  editSection: {
    marginTop: 14,
  },
  editLabel: {
    fontSize: 13,
    color: colors.successText,
    fontWeight: '700',
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    backgroundColor: '#F0FDF4',
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#14532D',
  },
});
