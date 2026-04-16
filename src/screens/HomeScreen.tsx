import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LabeledInput } from '../components/LabeledInput';
import { ResultCard } from '../components/ResultCard';
import { colors } from '../constants/theme';
import { estimateHeight } from '../services/measurementService';
import { HeightMeasurementResult } from '../types/measurement';

function toNumber(value: string): number {
  return Number(value.trim());
}

export function HomeScreen() {
  const [personPixelHeight, setPersonPixelHeight] = useState('');
  const [referencePixelHeight, setReferencePixelHeight] = useState('');
  const [referenceRealHeightCm, setReferenceRealHeightCm] = useState('');
  const [result, setResult] = useState<HeightMeasurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedImageSize, setCapturedImageSize] = useState<string | null>(null);

  const isFormFilled = useMemo(() => {
    return (
      personPixelHeight.trim().length > 0 &&
      referencePixelHeight.trim().length > 0 &&
      referenceRealHeightCm.trim().length > 0
    );
  }, [personPixelHeight, referencePixelHeight, referenceRealHeightCm]);

  const handleEstimate = () => {
    const personPx = toNumber(personPixelHeight);
    const referencePx = toNumber(referencePixelHeight);
    const referenceCm = toNumber(referenceRealHeightCm);

    if (!personPx || !referencePx || !referenceCm) {
      setError('Please enter valid numeric values greater than zero.');
      setResult(null);
      return;
    }

    const nextResult = estimateHeight({
      personPixelHeight: personPx,
      referencePixelHeight: referencePx,
      referenceRealHeightCm: referenceCm,
    });

    setError(null);
    setResult(nextResult);
  };

  const handleStartCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setError('Camera permission is required to capture an image.');
      return;
    }

    const capture = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (capture.canceled || !capture.assets[0]) {
      return;
    }

    const { uri, width, height } = capture.assets[0];
    setCapturedImageUri(uri);
    setCapturedImageSize(`${width} x ${height} px`);
    setError(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Height Measurement App</Text>
      <Text style={styles.subtitle}>
        Estimate a person’s height from image pixel measurements and a known reference object.
      </Text>

      <View style={styles.card}>
        <LabeledInput
          label="Person Pixel Height"
          value={personPixelHeight}
          placeholder="e.g. 620"
          onChangeText={setPersonPixelHeight}
        />
        <LabeledInput
          label="Reference Object Pixel Height"
          value={referencePixelHeight}
          placeholder="e.g. 310"
          onChangeText={setReferencePixelHeight}
        />
        <LabeledInput
          label="Reference Real Height (cm)"
          value={referenceRealHeightCm}
          placeholder="e.g. 170"
          onChangeText={setReferenceRealHeightCm}
        />

        <Pressable style={[styles.button, styles.secondaryButton]} onPress={handleStartCamera}>
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>Start Camera</Text>
        </Pressable>
        {capturedImageUri ? (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Captured Image</Text>
            {capturedImageSize ? <Text style={styles.previewMeta}>{capturedImageSize}</Text> : null}
            <Image source={{ uri: capturedImageUri }} style={styles.previewImage} />
          </View>
        ) : null}

        <Pressable
          style={[styles.button, !isFormFilled && styles.buttonDisabled]}
          onPress={handleEstimate}
          disabled={!isFormFilled}
        >
          <Text style={styles.buttonText}>Estimate Height</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ResultCard result={result} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 18,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButton: {
    backgroundColor: '#E2E8F0',
  },
  secondaryButtonText: {
    color: '#1E293B',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#B91C1C',
  },
  previewBox: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  previewMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 8,
  },
  previewImage: {
    width: '100%',
    height: 180,
    borderRadius: 10,
  },
});
