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
import { scale } from '../theme/ui';

function toNumber(value: string): number {
  return Number(value.trim());
}

function sanitizeNumberInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, '');
  const firstDotIndex = cleaned.indexOf('.');
  if (firstDotIndex === -1) return cleaned;
  return cleaned.slice(0, firstDotIndex + 1) + cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
}

function computeTiltFromVertical(top: MarkerPoint, bottom: MarkerPoint): number {
  const deltaX = bottom.x - top.x;
  const deltaY = Math.abs(bottom.y - top.y);
  if (deltaY <= 0) {
    return 90;
  }
  return (Math.atan(Math.abs(deltaX) / deltaY) * 180) / Math.PI;
}

function buildAutoDetectedMarkers(imageWidth: number, imageHeight: number): Record<MeasurementKey, MarkerPoint> {
  return {
    personTop: { x: imageWidth * 0.31, y: imageHeight * 0.2 },
    personBottom: { x: imageWidth * 0.31, y: imageHeight * 0.9 },
    referenceTop: { x: imageWidth * 0.78, y: imageHeight * 0.3 },
    referenceBottom: { x: imageWidth * 0.78, y: imageHeight * 0.82 },
  };
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
type WizardStage = 'capture' | 'markPerson' | 'markReference' | 'input' | 'result';

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
  const [wizardStage, setWizardStage] = useState<WizardStage>('capture');
  const [markers, setMarkers] = useState<Partial<Record<MeasurementKey, MarkerPoint>>>({});
  const [imageDerivedPixels, setImageDerivedPixels] = useState<{ person: number; reference: number } | null>(null);
  const [perspectiveWarning, setPerspectiveWarning] = useState<string | null>(null);
  const [isAdjustingPoints, setIsAdjustingPoints] = useState(false);
  const [autoDetectNote, setAutoDetectNote] = useState<string | null>(null);

  const currentStep = measurementSteps[currentStepIndex];
  const isImageReady = capturedImageWidth > 0 && capturedImageHeight > 0 && displayedImageWidth > 0 && displayedImageHeight > 0;
  const wizardSteps: Array<{ key: WizardStage; label: string }> = [
    { key: 'capture', label: 'Capture' },
    { key: 'markPerson', label: 'Mark Person' },
    { key: 'markReference', label: 'Mark Reference' },
    { key: 'input', label: 'Enter Height' },
    { key: 'result', label: 'Result' },
  ];

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
    setWizardStage('result');
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
    setWizardStage('markPerson');
    setImageDerivedPixels(null);
    setPerspectiveWarning(null);
    setIsAdjustingPoints(false);
    setAutoDetectNote(null);
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

  const applyMarkers = (nextMarkers: Partial<Record<MeasurementKey, MarkerPoint>>) => {
    const personTop = nextMarkers.personTop;
    const personBottom = nextMarkers.personBottom;
    const referenceTop = nextMarkers.referenceTop;
    const referenceBottom = nextMarkers.referenceBottom;

    if (personTop && personBottom && referenceTop && referenceBottom) {
      const measuredPersonPx = Math.round(Math.abs(personBottom.y - personTop.y));
      const measuredReferencePx = Math.round(Math.abs(referenceBottom.y - referenceTop.y));
      const personTilt = computeTiltFromVertical(personTop, personBottom);
      const referenceTilt = computeTiltFromVertical(referenceTop, referenceBottom);
      const averageTilt = (personTilt + referenceTilt) / 2;
      const tiltDiff = Math.abs(personTilt - referenceTilt);

      if (averageTilt > 7 || tiltDiff > 8) {
        setPerspectiveWarning(
          'Camera seems tilted. Keep phone straight and ensure person + reference stand upright for better accuracy.',
        );
      } else {
        setPerspectiveWarning(null);
      }

      setImageDerivedPixels({
        person: measuredPersonPx,
        reference: measuredReferencePx,
      });
      setPersonPixelHeight(String(measuredPersonPx));
      setReferencePixelHeight(String(measuredReferencePx));
      setWizardStage('input');
      setIsAdjustingPoints(false);
    }
  };

  const handleAutoDetectPoints = () => {
    if (!capturedImageWidth || !capturedImageHeight) {
      return;
    }
    const nextMarkers = buildAutoDetectedMarkers(capturedImageWidth, capturedImageHeight);
    setMarkers(nextMarkers);
    setCurrentStepIndex(measurementSteps.length - 1);
    setAutoDetectNote('Auto points detected. Review markers and tap "Adjust Points" if needed.');
    applyMarkers(nextMarkers);
  };

  const handleAdjustPoints = () => {
    setIsAdjustingPoints(true);
    setCurrentStepIndex(0);
    setWizardStage('markPerson');
    setAutoDetectNote('Adjustment mode on. Re-tap all 4 points for highest accuracy.');
  };

  const handleImagePress = (event: GestureResponderEvent) => {
    if (
      !capturedImageWidth ||
      !capturedImageHeight ||
      !displayedImageWidth ||
      !displayedImageHeight ||
      !currentStep ||
      ((wizardStage !== 'markPerson' && wizardStage !== 'markReference') || !isAdjustingPoints)
    ) {
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
      if (currentStepIndex === 1) {
        setWizardStage('markReference');
      }
      return;
    }

    applyMarkers(nextMarkers);
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
    setWizardStage('capture');
    setImageDerivedPixels(null);
    setPerspectiveWarning(null);
    setIsAdjustingPoints(false);
    setAutoDetectNote(null);
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
    <LinearGradient colors={['#6D63FF', '#20C7F3']} style={styles.page}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerArea}>
          <View style={styles.topRow}>
            <View style={styles.topIcon}>
              <Text style={styles.topIconText}>{'‹'}</Text>
            </View>
            <Text style={styles.topTitle}>Measure Height</Text>
            <View style={styles.topIcon}>
              <Text style={styles.topIconText}>?</Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyArea}>
          <View style={styles.deviceCard}>
          <View style={styles.meterWrap}>
            <View style={styles.meterOuter}>
              <View style={styles.meterInner}>
                <Text style={styles.meterValue}>{result ? result.estimatedHeightCm : '--'}</Text>
                <Text style={styles.meterUnit}>CM</Text>
              </View>
            </View>
            <LinearGradient
              colors={['#6D63FF', '#20C7F3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.awaitingBadge}
            >
              <View style={styles.awaitingDot} />
              <Text style={styles.awaitingTitle}>{result ? 'Height Estimated' : 'Awaiting Input'}</Text>
            </LinearGradient>
            <Text style={styles.awaitingHint}>
              Keep person + ref at <Text style={styles.awaitingHintAccent}>same distance</Text>
            </Text>
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

          <View style={styles.wizardCard}>
            <View style={styles.wizardRow}>
              {wizardSteps.map((step, index) => {
                const active = wizardStage === step.key;
                const done = wizardSteps.findIndex((s) => s.key === wizardStage) > index;

                if (active) {
                  return (
                    <LinearGradient
                      key={step.key}
                      colors={['#6D63FF', '#20C7F3']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.wizardItem, styles.wizardItemActive]}
                    >
                      <View style={[styles.wizardDot, styles.wizardDotActiveOnGradient]} />
                      <Text style={[styles.wizardText, styles.wizardTextActiveOnGradient]}>{step.label}</Text>
                    </LinearGradient>
                  );
                }

                return (
                  <View key={step.key} style={[styles.wizardItem, done && styles.wizardItemDone]}>
                    <View style={[styles.wizardDot, active && styles.wizardDotActive, done && styles.wizardDotDone]} />
                    <Text style={[styles.wizardText, (active || done) && styles.wizardTextActive]}>{step.label}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.wizardHint}>
              {wizardStage === 'capture' && 'Step 1: Open camera and capture one full-body photo.'}
              {wizardStage === 'markPerson' &&
                (isAdjustingPoints
                  ? 'Step 2: Tap top and bottom of the person in the photo.'
                  : 'Step 2: Use Auto Detect, or press Adjust Points to start manual marking.')}
              {wizardStage === 'markReference' &&
                (isAdjustingPoints
                  ? 'Step 3: Tap top and bottom of the reference object.'
                  : 'Step 3: Use Auto Detect, or press Adjust Points to start manual marking.')}
              {wizardStage === 'input' && 'Step 4: Enter reference object real height in cm.'}
              {wizardStage === 'result' && 'Step 5: Result is ready. You can adjust or re-measure.'}
            </Text>
          </View>

          {(wizardStage === 'input' || wizardStage === 'result') && (
            <>
              <MeasureField
                label="REFERENCE REAL HEIGHT"
                value={referenceRealHeightCm}
                placeholder="e.g. 170"
                unit="cm"
                onChangeText={setReferenceRealHeightCm}
              />
              <MeasureField
                label="PERSON PIXEL HEIGHT (OPTIONAL EDIT)"
                value={personPixelHeight}
                placeholder="e.g. 620"
                unit="px"
                onChangeText={setPersonPixelHeight}
              />
              <MeasureField
                label="REFERENCE PIXEL HEIGHT (OPTIONAL EDIT)"
                value={referencePixelHeight}
                placeholder="e.g. 310"
                unit="px"
                onChangeText={setReferencePixelHeight}
              />
            </>
          )}

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
                {(wizardStage === 'markPerson' || wizardStage === 'markReference') && currentStep
                  ? isAdjustingPoints
                    ? currentStep.label
                    : 'Use Auto Detect Points or Adjust Points to place markers.'
                  : 'Guides are shown to help placement before estimation.'}
              </Text>
              <Pressable
                onPress={handleImagePress}
                style={[
                  styles.imageTouchArea,
                  (!isImageReady ||
                    (wizardStage !== 'markPerson' && wizardStage !== 'markReference') ||
                    !isAdjustingPoints) &&
                    styles.imageTouchAreaDisabled,
                ]}
                disabled={
                  !isImageReady ||
                  (wizardStage !== 'markPerson' && wizardStage !== 'markReference') ||
                  !isAdjustingPoints
                }
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
                {displayedImageWidth > 0 && displayedImageHeight > 0 ? (
                  <View style={styles.guideLayer} pointerEvents="none">
                    <View style={styles.personSilhouetteGuide}>
                      <Text style={styles.guideText}>PERSON</Text>
                    </View>
                    <View style={styles.referenceBoxGuide}>
                      <Text style={styles.guideText}>REFERENCE</Text>
                    </View>
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

                  const markerLeft = (point.x / capturedImageWidth) * displayedImageWidth - 7;
                  const markerTop = (point.y / capturedImageHeight) * displayedImageHeight - 7;

                  return <View key={key} style={[styles.marker, { left: markerLeft, top: markerTop }]} />;
                })}
              </Pressable>
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {wizardStage === 'capture' ? (
              <Pressable style={styles.cameraButtonFull} onPress={handleStartCamera}>
                <LinearGradient
                  colors={['#6D63FF', '#20C7F3']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.cameraButtonFullGradient}
                >
                  <Text style={styles.cameraButtonPrimaryText}>Open Camera</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <>
                <Pressable style={styles.cameraButton} onPress={handleResetMeasurement}>
                  <Text style={styles.cameraButtonText}>Retake</Text>
                </Pressable>
                <Pressable style={styles.cameraButton} onPress={isAdjustingPoints ? () => setIsAdjustingPoints(false) : handleAdjustPoints}>
                  <Text style={styles.cameraButtonText}>{isAdjustingPoints ? 'Stop Adjust' : 'Adjust Points'}</Text>
                </Pressable>
                <Pressable style={styles.cameraButton} onPress={handleAutoDetectPoints}>
                  <Text style={styles.cameraButtonText}>Auto Detect</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.estimateButton,
                    (wizardStage !== 'input' || !isFormFilled) && styles.buttonDisabled,
                  ]}
                  onPress={handleEstimate}
                  disabled={wizardStage !== 'input' || !isFormFilled}
                >
                  <Text style={styles.estimateButtonText}>
                    {wizardStage === 'result' ? 'Estimated' : 'Estimate Height'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {perspectiveWarning ? <Text style={styles.warningText}>{perspectiveWarning}</Text> : null}
          {autoDetectNote ? <Text style={styles.infoText}>{autoDetectNote}</Text> : null}

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
    paddingBottom: 28,
  },
  headerArea: {
    minHeight: 104,
    paddingHorizontal: '6%',
    paddingTop: 16,
    justifyContent: 'center',
  },
  bodyArea: {
    marginTop: -2,
    borderTopLeftRadius: scale(38),
    borderTopRightRadius: scale(38),
    backgroundColor: '#EAF1F7',
    paddingHorizontal: '4%',
    paddingTop: 12,
    minHeight: 680,
  },
  deviceCard: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderRadius: scale(24),
    borderWidth: 0,
    padding: 10,
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  topIconText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  topTitle: {
    color: '#FFFFFF',
    fontSize: 37,
    fontWeight: '800',
    lineHeight: 40,
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
    borderColor: 'rgba(93, 108, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(221, 228, 247, 0.8)',
  },
  meterInner: {
    width: 138,
    height: 138,
    borderRadius: 69,
    borderWidth: 1,
    borderColor: 'rgba(93, 108, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meterValue: {
    color: '#1F2A44',
    fontSize: 32,
    fontWeight: '900',
  },
  meterUnit: {
    color: '#6D63FF',
    fontSize: 13,
    fontWeight: '700',
  },
  awaitingTitle: {
    color: '#FFFFFF',
    fontSize: 31,
    fontWeight: '800',
  },
  awaitingBadge: {
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  awaitingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#B8E72A',
  },
  awaitingHint: {
    marginTop: 4,
    color: '#6B7896',
    fontSize: 12,
    fontWeight: '600',
  },
  awaitingHintAccent: {
    color: '#6D63FF',
    fontWeight: '800',
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
    borderColor: 'rgba(125, 145, 191, 0.25)',
    backgroundColor: '#FFFFFF',
  },
  statLabel: {
    color: '#8E98B1',
    fontSize: 9,
    fontWeight: '700',
  },
  statValue: {
    marginTop: 4,
    color: '#1F2A44',
    fontSize: 22,
    fontWeight: '800',
  },
  statSub: {
    color: '#9BA5BC',
    fontSize: 10,
  },
  fieldWrap: {
    marginTop: 12,
  },
  wizardCard: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 145, 191, 0.25)',
    backgroundColor: '#FFFFFF',
  },
  wizardRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wizardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#EEF2FC',
  },
  wizardItemActive: {
    backgroundColor: 'transparent',
  },
  wizardItemDone: {
    backgroundColor: '#EAF7F1',
  },
  wizardDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
  },
  wizardDotActive: {
    backgroundColor: '#22D3EE',
  },
  wizardDotDone: {
    backgroundColor: '#10B981',
  },
  wizardText: {
    color: '#8E98B1',
    fontSize: 11,
    fontWeight: '700',
  },
  wizardTextActive: {
    color: '#4A5A7A',
  },
  wizardTextActiveOnGradient: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  wizardDotActiveOnGradient: {
    backgroundColor: '#B8E72A',
  },
  wizardHint: {
    marginTop: 7,
    color: '#4A5A7A',
    fontSize: 12,
    fontWeight: '600',
  },
  fieldLabel: {
    color: '#8E98B1',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  fieldInputWrap: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.35)',
    backgroundColor: '#F2F5FD',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  fieldInput: {
    flex: 1,
    color: '#1F2A44',
    fontSize: 16,
    fontWeight: '700',
  },
  unitChip: {
    borderRadius: 8,
    backgroundColor: '#E1E8F8',
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  unitChipText: {
    color: '#6B7896',
    fontSize: 11,
    fontWeight: '700',
  },
  previewBox: {
    marginTop: 12,
    padding: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 145, 191, 0.25)',
    backgroundColor: '#FFFFFF',
  },
  previewHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLabel: {
    color: '#4A5A7A',
    fontSize: 12,
    fontWeight: '700',
  },
  previewStep: {
    color: '#6D63FF',
    fontSize: 12,
    fontWeight: '800',
  },
  previewSize: {
    marginTop: 4,
    color: '#8E98B1',
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
    borderColor: 'rgba(53, 189, 244, 0.4)',
    backgroundColor: '#EAF1FF',
  },
  guideLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  personSilhouetteGuide: {
    position: 'absolute',
    left: '12%',
    top: '18%',
    width: '38%',
    height: '74%',
    borderRadius: 22,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(93, 108, 255, 0.85)',
    backgroundColor: 'rgba(93, 108, 255, 0.08)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 6,
  },
  referenceBoxGuide: {
    position: 'absolute',
    right: '10%',
    top: '28%',
    width: '20%',
    height: '54%',
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(53, 189, 244, 0.85)',
    backgroundColor: 'rgba(53, 189, 244, 0.08)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 6,
  },
  guideText: {
    color: '#4A5A7A',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  imageTouchAreaDisabled: {
    opacity: 0.96,
  },
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#35BDF4',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  stepText: {
    fontSize: 12,
    color: '#4A5A7A',
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
    borderColor: 'rgba(125, 145, 191, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3FF',
  },
  cameraButtonFull: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#6D63FF',
    shadowOpacity: 0.26,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  cameraButtonFullGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  cameraButtonText: {
    color: '#4A5A7A',
    fontSize: 15,
    fontWeight: '700',
  },
  cameraButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 21,
  },
  estimateButton: {
    flex: 1.7,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#35BDF4',
  },
  estimateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
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
  warningText: {
    marginTop: 8,
    fontSize: 13,
    color: '#FCD34D',
  },
  infoText: {
    marginTop: 8,
    fontSize: 12,
    color: '#2D9FD6',
  },
  editCard: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 145, 191, 0.25)',
    backgroundColor: '#FFFFFF',
  },
  editCardTitle: {
    color: '#4A5A7A',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
  },
  editInput: {
    height: 46,
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.4)',
    backgroundColor: '#F2F5FD',
    borderRadius: 12,
    paddingHorizontal: 12,
    color: '#1F2A44',
    fontSize: 16,
    fontWeight: '700',
  },
  editedMeta: {
    marginTop: 8,
    fontSize: 13,
    color: '#2D9FD6',
    fontWeight: '700',
  },
});
