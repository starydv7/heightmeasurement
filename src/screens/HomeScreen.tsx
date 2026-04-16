import { useMemo, useState } from 'react';
import { GestureResponderEvent, Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LabeledInput } from '../components/LabeledInput';
import { ResultCard } from '../components/ResultCard';
import { colors } from '../constants/theme';
import { estimateHeight } from '../services/measurementService';
import { HeightMeasurementResult } from '../types/measurement';
import { cmToFeetAndInches } from '../utils/unit';

function toNumber(value: string): number {
  return Number(value.trim());
}

function sanitizeNumberInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDotIndex = cleaned.indexOf('.');
  if (firstDotIndex === -1) return cleaned;
  return cleaned.slice(0, firstDotIndex + 1) + cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
}

const measurementSteps = [
  { key: 'personTop', label: 'Tap the top of the person' },
  { key: 'personBottom', label: 'Tap the bottom of the person' },
  { key: 'referenceTop', label: 'Tap the top of the reference object' },
  { key: 'referenceBottom', label: 'Tap the bottom of the reference object' },
] as const;

type MeasurementKey = (typeof measurementSteps)[number]['key'];

type MarkerPoint = {
  x: number;
  y: number;
};

export function HomeScreen() {
  const [personPixelHeight, setPersonPixelHeight] = useState('');
  const [referencePixelHeight, setReferencePixelHeight] = useState('');
  const [referenceRealHeightCm, setReferenceRealHeightCm] = useState('');
  const [result, setResult] = useState<HeightMeasurementResult | null>(null);
  const [editedHeightCm, setEditedHeightCm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editedHeightError, setEditedHeightError] = useState<string | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedImageSize, setCapturedImageSize] = useState<string | null>(null);
  const [capturedImageWidth, setCapturedImageWidth] = useState(0);
  const [capturedImageHeight, setCapturedImageHeight] = useState(0);
  const [displayedImageWidth, setDisplayedImageWidth] = useState(0);
  const [displayedImageHeight, setDisplayedImageHeight] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [markers, setMarkers] = useState<Partial<Record<MeasurementKey, MarkerPoint>>>({});

  const currentStep = measurementSteps[currentStepIndex];
  const isImageReady = capturedImageWidth > 0 && capturedImageHeight > 0 && displayedImageWidth > 0 && displayedImageHeight > 0;

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
    setEditedHeightCm(String(nextResult.estimatedHeightCm));
    setEditedHeightError(null);
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
    setCapturedImageWidth(width);
    setCapturedImageHeight(height);
    setDisplayedImageWidth(0);
    setDisplayedImageHeight(0);
    setMarkers({});
    setCurrentStepIndex(0);
    setPersonPixelHeight('');
    setReferencePixelHeight('');
    setResult(null);
    setEditedHeightCm('');
    setEditedHeightError(null);
    setError(null);
  };

  const handleImageLayout = (event: LayoutChangeEvent) => {
    setDisplayedImageWidth(event.nativeEvent.layout.width);
    setDisplayedImageHeight(event.nativeEvent.layout.height);
  };

  const handleImagePress = (event: GestureResponderEvent) => {
    if (!capturedImageWidth || !capturedImageHeight || !displayedImageWidth || !displayedImageHeight || !currentStep) {
      return;
    }

    const { locationX, locationY } = event.nativeEvent;
    const sourceX = (locationX / displayedImageWidth) * capturedImageWidth;
    const sourceY = (locationY / displayedImageHeight) * capturedImageHeight;

    if (!Number.isFinite(sourceX) || !Number.isFinite(sourceY)) {
      return;
    }

    const nextMarkers = {
      ...markers,
      [currentStep.key]: { x: sourceX, y: sourceY },
    };

    setMarkers(nextMarkers);
    setError(null);

    if (currentStepIndex < measurementSteps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      return;
    }

    const personTop = nextMarkers.personTop;
    const personBottom = nextMarkers.personBottom;
    const referenceTop = nextMarkers.referenceTop;
    const referenceBottom = nextMarkers.referenceBottom;

    if (personTop && personBottom && referenceTop && referenceBottom) {
      const measuredPersonPx = Math.round(Math.abs(personBottom.y - personTop.y));
      const measuredReferencePx = Math.round(Math.abs(referenceBottom.y - referenceTop.y));
      setPersonPixelHeight(String(measuredPersonPx));
      setReferencePixelHeight(String(measuredReferencePx));
    }
  };

  const handleResetMeasurement = () => {
    setMarkers({});
    setCurrentStepIndex(0);
    setPersonPixelHeight('');
    setReferencePixelHeight('');
    setResult(null);
    setEditedHeightCm('');
    setEditedHeightError(null);
    setError(null);
  };

  const handleEditedHeightChange = (value: string) => {
    const sanitized = sanitizeNumberInput(value);
    setEditedHeightCm(sanitized);

    if (!sanitized.trim().length) {
      setEditedHeightError(null);
      return;
    }

    const parsed = toNumber(sanitized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setEditedHeightError('Enter a valid number greater than zero.');
    } else {
      setEditedHeightError(null);
    }
  };

  const editedHeightNumber = editedHeightCm.trim().length ? toNumber(editedHeightCm) : NaN;
  const finalHeightFeet =
    Number.isFinite(editedHeightNumber) && editedHeightNumber > 0 ? cmToFeetAndInches(editedHeightNumber) : '';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Height Measurement</Text>
        <Text style={styles.subtitle}>
          Capture one photo, tap 4 points, then estimate height using a known reference object.
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Capture</Text>
          <Text style={styles.sectionHint}>Keep the person and reference object at the same distance from the camera.</Text>
        </View>

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
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            {capturedImageUri ? 'Retake Photo' : 'Start Camera'}
          </Text>
        </Pressable>
        {capturedImageUri ? (
          <View style={styles.previewBox}>
            <View style={styles.previewHeaderRow}>
              <View style={styles.previewHeaderLeft}>
                <Text style={styles.previewTitle}>Tap points</Text>
                {capturedImageSize ? <Text style={styles.previewMeta}>{capturedImageSize}</Text> : null}
              </View>
              <View style={styles.stepPill}>
                <Text style={styles.stepPillText}>
                  Step {Math.min(currentStepIndex + 1, measurementSteps.length)} / {measurementSteps.length}
                </Text>
              </View>
            </View>
            <Text style={styles.stepText}>
              {currentStep ? currentStep.label : 'Measurement points captured. You can retake or estimate now.'}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(((currentStepIndex + 1) / measurementSteps.length) * 100)}%` },
                ]}
              />
            </View>
            <Pressable
              onPress={handleImagePress}
              style={[styles.imageTouchArea, !isImageReady && styles.imageTouchAreaDisabled]}
              disabled={!isImageReady}
            >
              <Image
                source={{ uri: capturedImageUri }}
                style={[
                  styles.previewImage,
                  capturedImageWidth && capturedImageHeight
                    ? { aspectRatio: capturedImageWidth / capturedImageHeight }
                    : null,
                ]}
                resizeMode="stretch"
                onLayout={handleImageLayout}
              />
              {!isImageReady ? (
                <View style={styles.imageOverlay}>
                  <Text style={styles.imageOverlayText}>Preparing image…</Text>
                </View>
              ) : null}
              {Object.entries(markers).map(([key, point]) => {
                if (
                  !point ||
                  !Number.isFinite(point.x) ||
                  !Number.isFinite(point.y) ||
                  !displayedImageWidth ||
                  !displayedImageHeight ||
                  !capturedImageWidth ||
                  !capturedImageHeight
                ) {
                  return null;
                }

                const markerLeft = (point.x / capturedImageWidth) * displayedImageWidth - 8;
                const markerTop = (point.y / capturedImageHeight) * displayedImageHeight - 8;

                return (
                  <View
                    key={key}
                    style={[
                      styles.marker,
                      {
                        left: markerLeft,
                        top: markerTop,
                      },
                    ]}
                  />
                );
              })}
            </Pressable>
            <View style={styles.row}>
              <Pressable style={[styles.button, styles.smallButton]} onPress={handleResetMeasurement}>
                <Text style={styles.buttonText}>Reset Points</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Pressable
          style={[styles.button, styles.primaryButton, !isFormFilled && styles.buttonDisabled]}
          onPress={handleEstimate}
          disabled={!isFormFilled}
        >
          <Text style={styles.buttonText}>Estimate Height</Text>
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ResultCard
          result={result}
          editedHeightCm={editedHeightCm}
          onEditedHeightChange={handleEditedHeightChange}
        />
        {editedHeightError ? <Text style={styles.errorText}>{editedHeightError}</Text> : null}
        {finalHeightFeet ? (
          <Text style={styles.editedMeta}>Edited height in feet/inches: {finalHeightFeet}</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: 28,
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 30,
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
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionHint: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  button: {
    marginTop: 8,
    backgroundColor: colors.accent,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryButton: {
    marginTop: 10,
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
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewHeaderLeft: {
    flex: 1,
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
  stepPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stepPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
  },
  previewImage: {
    width: '100%',
    height: undefined,
    borderRadius: 10,
  },
  imageTouchArea: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#0F172A',
  },
  imageTouchAreaDisabled: {
    opacity: 0.96,
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  marker: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stepText: {
    fontSize: 13,
    color: colors.textPrimary,
    marginBottom: 10,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  smallButton: {
    flex: 1,
  },
  editedMeta: {
    marginTop: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
});
