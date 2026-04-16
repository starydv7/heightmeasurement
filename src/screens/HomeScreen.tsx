import { useMemo, useState } from 'react';
import {
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { estimateHeight } from '../services/measurementService';
import { HeightMeasurementResult, HeightResultSummary } from '../types/measurement';
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

function computeConfidencePercent(params: {
  personPx: number;
  referencePx: number;
  imageDerivedPixels: { person: number; reference: number } | null;
  hasCapturedImage: boolean;
  markerKeys: string[];
}): number {
  const { personPx, referencePx, imageDerivedPixels, hasCapturedImage, markerKeys } = params;
  const fullTaps = markerKeys.length >= 4;
  const matchesTapDerived =
    imageDerivedPixels != null &&
    personPx === imageDerivedPixels.person &&
    referencePx === imageDerivedPixels.reference;

  if (matchesTapDerived && fullTaps && hasCapturedImage) {
    return 78;
  }
  if (imageDerivedPixels != null && fullTaps && hasCapturedImage) {
    return 58;
  }
  if (hasCapturedImage && fullTaps) {
    return 50;
  }
  if (hasCapturedImage) {
    return 42;
  }
  return 32;
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

type FieldProps = {
  label: string;
  value: string;
  placeholder: string;
  unit: string;
  onChangeText: (value: string) => void;
};

function MeasureField({ label, value, placeholder, unit, onChangeText }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputWrap}>
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          onChangeText={onChangeText}
          keyboardType="numeric"
          style={styles.fieldInput}
        />
        <View style={styles.unitChip}>
          <Text style={styles.unitChipText}>{unit}</Text>
        </View>
      </View>
    </View>
  );
}

type HomeScreenProps = {
  onResultReady: (result: HeightResultSummary) => void;
};

export function HomeScreen({ onResultReady }: HomeScreenProps) {
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
  const [imageDerivedPixels, setImageDerivedPixels] = useState<{ person: number; reference: number } | null>(null);

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
    onResultReady({
      estimatedHeightCm: nextResult.estimatedHeightCm,
      estimatedHeightFeet: nextResult.estimatedHeightFeet,
      personPixelHeight: personPx,
      referencePixelHeight: referencePx,
      referenceRealHeightCm: referenceCm,
      confidencePercent: computeConfidencePercent({
        personPx,
        referencePx,
        imageDerivedPixels,
        hasCapturedImage: Boolean(capturedImageUri),
        markerKeys: Object.keys(markers),
      }),
    });
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
    setImageDerivedPixels(null);
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
      setImageDerivedPixels({
        person: measuredPersonPx,
        reference: measuredReferencePx,
      });
      setPersonPixelHeight(String(measuredPersonPx));
      setReferencePixelHeight(String(measuredReferencePx));
    }
  };

  const handleResetMeasurement = () => {
    setCapturedImageUri(null);
    setCapturedImageSize(null);
    setCapturedImageWidth(0);
    setCapturedImageHeight(0);
    setDisplayedImageWidth(0);
    setDisplayedImageHeight(0);
    setMarkers({});
    setCurrentStepIndex(0);
    setImageDerivedPixels(null);
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
    <LinearGradient colors={['#020817', '#0B1635', '#040A1D']} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.deviceCard}>
          <View style={styles.topRow}>
            <View style={styles.topIcon}>
              <Text style={styles.topIconText}>{'<'}</Text>
            </View>
            <Text style={styles.topTitle}>Measure Height</Text>
            <View style={styles.topIcon}>
              <Text style={styles.topIconText}>?</Text>
            </View>
          </View>

          <View style={styles.meterWrap}>
            <View style={styles.meterOuter}>
              <View style={styles.meterInner}>
                <Text style={styles.meterValue}>{result ? result.estimatedHeightCm : '--'}</Text>
                <Text style={styles.meterUnit}>CM</Text>
              </View>
            </View>
            <Text style={styles.awaitingTitle}>{result ? 'Height Estimated' : 'Awaiting Input'}</Text>
            <Text style={styles.awaitingHint}>• Keep person + ref at same distance</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PERSON PX</Text>
              <Text style={styles.statValue}>{personPixelHeight || '0'}</Text>
              <Text style={styles.statSub}>pixels tall</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>REF PX</Text>
              <Text style={styles.statValue}>{referencePixelHeight || '0'}</Text>
              <Text style={styles.statSub}>pixels tall</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>REF REAL</Text>
              <Text style={styles.statValue}>{referenceRealHeightCm || '0'}</Text>
              <Text style={styles.statSub}>cm</Text>
            </View>
          </View>

          <MeasureField
            label="PERSON PIXEL HEIGHT"
            value={personPixelHeight}
            placeholder="e.g. 620"
            unit="px"
            onChangeText={setPersonPixelHeight}
          />
          <MeasureField
            label="REFERENCE OBJECT PIXEL HEIGHT"
            value={referencePixelHeight}
            placeholder="e.g. 310"
            unit="px"
            onChangeText={setReferencePixelHeight}
          />
          <MeasureField
            label="REFERENCE REAL HEIGHT"
            value={referenceRealHeightCm}
            placeholder="e.g. 170"
            unit="cm"
            onChangeText={setReferenceRealHeightCm}
          />

          {capturedImageUri ? (
            <View style={styles.previewBox}>
              <View style={styles.previewHead}>
                <Text style={styles.previewLabel}>Tap points on photo</Text>
                <Text style={styles.previewStep}>
                  {Math.min(currentStepIndex + 1, measurementSteps.length)}/{measurementSteps.length}
                </Text>
              </View>
              {capturedImageSize ? <Text style={styles.previewSize}>{capturedImageSize}</Text> : null}
              <Text style={styles.stepText}>
                {currentStep ? currentStep.label : 'All points captured. You can estimate now.'}
              </Text>
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

                  const markerLeft = (point.x / capturedImageWidth) * displayedImageWidth - 7;
                  const markerTop = (point.y / capturedImageHeight) * displayedImageHeight - 7;

                  return <View key={key} style={[styles.marker, { left: markerLeft, top: markerTop }]} />;
                })}
              </Pressable>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            <Pressable style={styles.cameraButton} onPress={capturedImageUri ? handleResetMeasurement : handleStartCamera}>
              <Text style={styles.cameraButtonText}>{capturedImageUri ? 'Reset Points' : 'Camera'}</Text>
            </Pressable>
            <Pressable
              style={[styles.estimateButton, !isFormFilled && styles.buttonDisabled]}
              onPress={handleEstimate}
              disabled={!isFormFilled}
            >
              <Text style={styles.estimateButtonText}>Estimate Height</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {result ? (
            <View style={styles.editCard}>
              <Text style={styles.editCardTitle}>Editable Final Height (cm)</Text>
              <TextInput
                value={editedHeightCm}
                onChangeText={handleEditedHeightChange}
                placeholder="Adjust final height"
                placeholderTextColor="#64748B"
                keyboardType="numeric"
                style={styles.editInput}
              />
              {editedHeightError ? <Text style={styles.errorText}>{editedHeightError}</Text> : null}
              {finalHeightFeet ? <Text style={styles.editedMeta}>{finalHeightFeet}</Text> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 18,
    paddingBottom: 30,
  },
  deviceCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    padding: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  topIconText: {
    color: '#67E8F9',
    fontSize: 14,
    fontWeight: '700',
  },
  topTitle: {
    color: '#F8FAFC',
    fontSize: 25,
    fontWeight: '800',
  },
  meterWrap: {
    marginTop: 16,
    alignItems: 'center',
  },
  meterOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1.5,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 47, 73, 0.35)',
  },
  meterInner: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterValue: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '900',
  },
  meterUnit: {
    color: '#22D3EE',
    fontSize: 13,
    fontWeight: '700',
  },
  awaitingTitle: {
    marginTop: 12,
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
  },
  awaitingHint: {
    marginTop: 4,
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: '500',
  },
  statsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(30, 41, 59, 0.55)',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
  },
  statValue: {
    marginTop: 4,
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  statSub: {
    color: '#64748B',
    fontSize: 10,
  },
  fieldWrap: {
    marginTop: 12,
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInputWrap: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  fieldInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  unitChip: {
    borderRadius: 8,
    backgroundColor: 'rgba(51, 65, 85, 0.8)',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  unitChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  previewBox: {
    marginTop: 12,
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLabel: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  previewStep: {
    color: '#22D3EE',
    fontSize: 12,
    fontWeight: '800',
  },
  previewSize: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 11,
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
    borderColor: 'rgba(34, 211, 238, 0.4)',
    backgroundColor: '#020617',
  },
  imageTouchAreaDisabled: {
    opacity: 0.96,
  },
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22D3EE',
    borderWidth: 2,
    borderColor: '#082F49',
  },
  stepText: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  cameraButton: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
  },
  cameraButtonText: {
    color: '#E2E8F0',
    fontSize: 17,
    fontWeight: '700',
  },
  estimateButton: {
    flex: 1.7,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22D3EE',
  },
  estimateButtonText: {
    color: '#042F2E',
    fontSize: 17,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  errorText: {
    marginTop: 10,
    fontSize: 13,
    color: '#FCA5A5',
  },
  editCard: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
  },
  editCardTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  editInput: {
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.5)',
    backgroundColor: 'rgba(2, 6, 23, 0.6)',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  editedMeta: {
    marginTop: 8,
    fontSize: 13,
    color: '#67E8F9',
    fontWeight: '700',
  },
});
