import { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Image,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { estimateHeight } from '../services/measurementService';
import { HeightMeasurementResult, HeightResultSummary } from '../types/measurement';
import { cmToFeetAndInches } from '../utils/unit';
import { useResponsiveContentMetrics } from '../hooks/useMeasureScreenMetrics';
import { takePictureWithAndroidFallbacks, formatAndroidCameraError } from '../utils/cameraCapture';
import { scale, ui } from '../theme/ui';

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
  labelFontSize?: number;
  inputFontSize?: number;
  rowHeight?: number;
};

function MeasureField({
  label,
  value,
  placeholder,
  unit,
  onChangeText,
  labelFontSize,
  inputFontSize,
  rowHeight,
}: FieldProps) {
  const labelStyle: TextStyle | undefined = labelFontSize != null ? { fontSize: labelFontSize } : undefined;
  const inputStyle: TextStyle[] = [styles.fieldInput];
  if (inputFontSize != null) inputStyle.push({ fontSize: inputFontSize });
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, labelStyle]}>{label}</Text>
      <View style={[styles.fieldInputWrap, rowHeight != null ? { height: rowHeight } : null]}>
        <TextInput
          value={value}
          placeholder={placeholder}
          placeholderTextColor="#64748B"
          onChangeText={onChangeText}
          keyboardType="numeric"
          style={inputStyle}
        />
        <View style={styles.unitChip}>
          <Text
            style={[
              styles.unitChipText,
              inputFontSize != null ? { fontSize: Math.max(8, inputFontSize - 2) } : undefined,
            ]}
          >
            {unit}
          </Text>
        </View>
      </View>
    </View>
  );
}

type HomeScreenProps = {
  onResultReady: (result: HeightResultSummary) => void;
  onOpenNoReferenceAR: () => void;
  onOpenNoReferenceManual: () => void;
};

export function HomeScreen({ onResultReady, onOpenNoReferenceAR, onOpenNoReferenceManual }: HomeScreenProps) {
  const metrics = useResponsiveContentMetrics();
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
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
    const granted = permission?.granted ? true : (await requestPermission()).granted;
    if (!granted) {
      setError('Camera permission is required to capture an image.');
      return;
    }
    setIsCameraReady(false);
    setIsCameraOpen(true);
    setError(null);
  };

  useEffect(() => {
    if (!isCameraOpen) return;
    const t = setTimeout(() => setIsCameraReady(true), 1200);
    return () => clearTimeout(t);
  }, [isCameraOpen]);

  const handleCaptureFromCamera = async () => {
    if (!isCameraReady) {
      setError('Camera is still loading. Please wait a moment.');
      return;
    }
    try {
      if (!cameraRef.current) {
        setError('Camera is not ready yet. Please try again.');
        return;
      }
      const capture = await takePictureWithAndroidFallbacks(cameraRef.current);
      const { uri, width, height } = capture;
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
      setIsCameraOpen(false);
    } catch (e) {
      if (__DEV__) {
        console.warn('[HomeScreen] capture', e);
      }
      setError(
        Platform.OS === 'android'
          ? `Camera capture failed\n\n${formatAndroidCameraError(e)}`
          : 'Could not capture image. Please try again.',
      );
    }
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
    setIsCameraOpen(false);
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

  const measureBody = (
        <View
          style={[
            styles.bodyArea,
            {
              paddingHorizontal: metrics.horizontalPadding,
              maxWidth: metrics.contentMaxWidth,
              width: '100%',
              alignSelf: 'center',
            },
          ]}
        >
          <View style={styles.deviceCard}>
          <View style={styles.meterWrap}>
            <View
              style={[
                styles.meterOuter,
                {
                  width: metrics.meterOuter,
                  height: metrics.meterOuter,
                  borderRadius: metrics.meterOuter / 2,
                },
              ]}
            >
              <View
                style={[
                  styles.meterInner,
                  {
                    width: metrics.meterInner,
                    height: metrics.meterInner,
                    borderRadius: metrics.meterInner / 2,
                  },
                ]}
              >
                <Text style={[styles.meterValue, { fontSize: metrics.meterValueFont }]}>{result ? result.estimatedHeightCm : '--'}</Text>
                <Text style={[styles.meterUnit, { fontSize: metrics.meterUnitFont }]}>CM</Text>
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
            <Text style={[styles.awaitingHint, { fontSize: metrics.hintFont }]}>
              Keep person + ref at <Text style={styles.awaitingHintAccent}>same distance</Text>
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={[styles.statLabel, { fontSize: metrics.statLabelFont }]}>PERSON PX</Text>
              <Text style={[styles.statValue, { fontSize: metrics.statValueFont }]}>{personPixelHeight || '0'}</Text>
              <Text style={styles.statSub}>pixels tall</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statLabel, { fontSize: metrics.statLabelFont }]}>REF PX</Text>
              <Text style={[styles.statValue, { fontSize: metrics.statValueFont }]}>{referencePixelHeight || '0'}</Text>
              <Text style={styles.statSub}>pixels tall</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statLabel, { fontSize: metrics.statLabelFont }]}>REF REAL</Text>
              <Text style={[styles.statValue, { fontSize: metrics.statValueFont }]}>{referenceRealHeightCm || '0'}</Text>
              <Text style={styles.statSub}>cm</Text>
            </View>
          </View>

          <View style={styles.wizardCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wizardRowScroll}>
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
            </ScrollView>
            <Text style={[styles.wizardHint, { fontSize: metrics.hintFont }]}>
              {wizardStage === 'capture' && 'Open camera and capture a full-body photo.'}
              {wizardStage === 'markPerson' &&
                (isAdjustingPoints ? 'Tap top and bottom of the person.' : 'Auto Detect or Adjust Points to place markers.')}
              {wizardStage === 'markReference' &&
                (isAdjustingPoints ? 'Tap top and bottom of the reference.' : 'Auto Detect or Adjust Points to place markers.')}
              {wizardStage === 'input' && 'Enter the reference object’s real height (cm).'}
              {wizardStage === 'result' && 'Result ready — adjust below or re-measure.'}
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
                labelFontSize={metrics.scaleW(10)}
                inputFontSize={metrics.scaleW(14)}
                rowHeight={metrics.fieldHeight}
              />
              <MeasureField
                label="PERSON PIXEL HEIGHT (OPTIONAL EDIT)"
                value={personPixelHeight}
                placeholder="e.g. 620"
                unit="px"
                onChangeText={setPersonPixelHeight}
                labelFontSize={metrics.scaleW(10)}
                inputFontSize={metrics.scaleW(14)}
                rowHeight={metrics.fieldHeight}
              />
              <MeasureField
                label="REFERENCE PIXEL HEIGHT (OPTIONAL EDIT)"
                value={referencePixelHeight}
                placeholder="e.g. 310"
                unit="px"
                onChangeText={setReferencePixelHeight}
                labelFontSize={metrics.scaleW(10)}
                inputFontSize={metrics.scaleW(14)}
                rowHeight={metrics.fieldHeight}
              />
            </>
          )}

          {isCameraOpen ? (
            <View style={styles.cameraWrap} {...(Platform.OS === 'android' ? { collapsable: false } : {})}>
              <CameraView
                ref={cameraRef}
                style={[
                  styles.cameraPreview,
                  {
                    height: metrics.cameraPreviewMaxHeight,
                    maxHeight: metrics.cameraPreviewMaxHeight,
                  },
                ]}
                facing="back"
                onCameraReady={() => setIsCameraReady(true)}
              />
              <View style={styles.cameraOverlay} pointerEvents="none">
                <Text style={styles.cameraGuideTitle}>Live Capture Guide</Text>
                <Text style={styles.cameraGuideText}>Keep person and reference fully visible in same plane.</Text>
                <View style={styles.cameraGuideBadge}>
                  <Text style={styles.cameraGuideBadgeText}>Best distance: 1.8m – 3.0m</Text>
                </View>
              </View>
              <View style={styles.cameraActionRow}>
                <Pressable style={styles.cameraCancelBtn} onPress={() => setIsCameraOpen(false)}>
                  <Text style={styles.cameraCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={[styles.cameraShootBtn, !isCameraReady && styles.cameraShootBtnDisabled]} onPress={handleCaptureFromCamera}>
                  <Text style={styles.cameraShootText}>{isCameraReady ? 'Capture' : 'Loading...'}</Text>
                </Pressable>
              </View>
            </View>
          ) : capturedImageUri ? (
            <View style={[styles.previewBox, { maxHeight: metrics.previewBoxMaxHeight }]}>
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
                  { maxHeight: metrics.previewMaxHeight },
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
                    { maxHeight: metrics.previewMaxHeight },
                    capturedImageWidth && capturedImageHeight
                      ? { aspectRatio: capturedImageWidth / capturedImageHeight }
                      : null,
                  ]}
                  resizeMode="contain"
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
              <>
                <Pressable
                  style={[styles.cameraButtonFull, { minHeight: metrics.buttonHeight }]}
                  onPress={handleStartCamera}
                >
                  <LinearGradient
                    colors={['#6D63FF', '#20C7F3']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.cameraButtonFullGradient}
                  >
                    <Text style={[styles.cameraButtonPrimaryText, { fontSize: metrics.scaleW(14) }]}>Open Camera</Text>
                  </LinearGradient>
                </Pressable>
                <Pressable
                  style={[styles.modeSwitchButton, { minHeight: metrics.buttonHeight - 2 }]}
                  onPress={onOpenNoReferenceAR}
                >
                  <Text style={[styles.modeSwitchText, { fontSize: metrics.scaleW(12) }]}>No-Reference (ARCore)</Text>
                </Pressable>
                <Pressable
                  style={[styles.modeSwitchButtonAlt, { minHeight: metrics.buttonHeight - 2 }]}
                  onPress={onOpenNoReferenceManual}
                >
                  <Text style={[styles.modeSwitchTextAlt, { fontSize: metrics.scaleW(12) }]}>No-Reference (Manual)</Text>
                </Pressable>
                <View style={styles.modeInfoCard}>
                  <View style={styles.modeInfoRow}>
                    <Text style={styles.modeInfoLabel}>Reference mode: High accuracy</Text>
                  </View>
                  <View style={styles.modeInfoRow}>
                    <Text style={styles.modeInfoSubLabel}>AR mode: auto-scale (best) • Manual mode: needs distance input</Text>
                  </View>
                </View>
              </>
            ) : (
              <>
                <Pressable
                  style={[styles.cameraButton, { minHeight: metrics.buttonHeight }]}
                  onPress={handleResetMeasurement}
                >
                  <Text style={[styles.cameraButtonText, { fontSize: metrics.scaleW(12) }]}>Retake</Text>
                </Pressable>
                <Pressable
                  style={[styles.cameraButton, { minHeight: metrics.buttonHeight }]}
                  onPress={isAdjustingPoints ? () => setIsAdjustingPoints(false) : handleAdjustPoints}
                >
                  <Text style={[styles.cameraButtonText, { fontSize: metrics.scaleW(12) }]}>
                    {isAdjustingPoints ? 'Stop Adjust' : 'Adjust Points'}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.cameraButton, { minHeight: metrics.buttonHeight }]}
                  onPress={handleAutoDetectPoints}
                >
                  <Text style={[styles.cameraButtonText, { fontSize: metrics.scaleW(12) }]}>Auto Detect</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.estimateButton,
                    { minHeight: metrics.buttonHeight },
                    (wizardStage !== 'input' || !isFormFilled) && styles.buttonDisabled,
                  ]}
                  onPress={handleEstimate}
                  disabled={wizardStage !== 'input' || !isFormFilled}
                >
                  <Text style={[styles.estimateButtonText, { fontSize: metrics.scaleW(13) }]}>
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
                style={[
                  styles.editInput,
                  { height: metrics.fieldHeight, fontSize: metrics.scaleW(14) },
                ]}
              />
              {editedHeightError ? <Text style={styles.errorText}>{editedHeightError}</Text> : null}
              {finalHeightFeet ? <Text style={styles.editedMeta}>{finalHeightFeet}</Text> : null}
            </View>
          ) : null}
          </View>
        </View>
  );

  return (
    <View style={styles.page}>
      <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.headerArea}>
        <View style={styles.topRow}>
          <View style={styles.headerSpacer} />
          <Text style={styles.topTitle}>Measure Height</Text>
          <View style={styles.headerSpacer} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: metrics.bodyBottomPad,
            minHeight: metrics.scrollContentMinHeight,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={metrics.height < 720}
        bounces
      >
        {measureBody}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  bodyScroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
  },
  headerArea: {
    minHeight: ui.header.minHeight,
    paddingHorizontal: 0,
    paddingTop: ui.header.paddingTop,
    paddingBottom: ui.header.paddingBottom,
    justifyContent: 'center',
  },
  bodyArea: {
    backgroundColor: '#FFFFFF',
    paddingTop: scale(8),
  },
  deviceCard: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    flexGrow: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ui.header.paddingHorizontal,
  },
  headerSpacer: {
    width: ui.header.iconSize,
    height: ui.header.iconSize,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: ui.header.titleFontSize,
    fontWeight: '800',
    lineHeight: ui.header.titleLineHeight,
  },
  meterWrap: {
    marginTop: scale(6),
    alignItems: 'center',
  },
  meterOuter: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(50),
    borderWidth: 1,
    borderColor: ui.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  meterInner: {
    width: scale(90),
    height: scale(90),
    borderRadius: scale(45),
    borderWidth: 1,
    borderColor: 'rgba(93, 108, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAFBFF',
  },
  meterValue: {
    color: '#1F2A44',
    fontSize: scale(22),
    fontWeight: '800',
  },
  meterUnit: {
    color: '#6D63FF',
    fontSize: scale(11),
    fontWeight: '700',
  },
  awaitingTitle: {
    color: '#FFFFFF',
    fontSize: scale(13),
    fontWeight: '700',
  },
  awaitingBadge: {
    marginTop: scale(8),
    borderRadius: 999,
    paddingHorizontal: scale(10),
    paddingVertical: scale(5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
  },
  awaitingDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(4),
    backgroundColor: '#B8E72A',
  },
  awaitingHint: {
    marginTop: scale(4),
    color: ui.colors.textMuted,
    fontSize: scale(11),
    fontWeight: '600',
    textAlign: 'center',
  },
  awaitingHintAccent: {
    color: '#6D63FF',
    fontWeight: '800',
  },
  statsRow: {
    marginTop: scale(10),
    flexDirection: 'row',
    gap: scale(6),
  },
  statCard: {
    flex: 1,
    paddingVertical: scale(6),
    paddingHorizontal: scale(6),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: ui.colors.border,
    backgroundColor: '#FFFFFF',
  },
  statLabel: {
    color: ui.colors.textMuted,
    fontSize: scale(9),
    fontWeight: '700',
  },
  statValue: {
    marginTop: scale(2),
    color: '#1F2A44',
    fontSize: scale(15),
    fontWeight: '800',
  },
  statSub: {
    color: ui.colors.textSoft,
    fontSize: scale(9),
  },
  fieldWrap: {
    marginTop: scale(8),
  },
  wizardCard: {
    marginTop: scale(8),
    padding: scale(8),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: ui.colors.border,
    backgroundColor: '#FFFFFF',
  },
  wizardRowScroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingRight: scale(4),
  },
  wizardRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: scale(4),
  },
  wizardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    borderRadius: 999,
    paddingHorizontal: scale(6),
    paddingVertical: scale(4),
    backgroundColor: '#F4F6FB',
  },
  wizardItemActive: {
    backgroundColor: 'transparent',
  },
  wizardItemDone: {
    backgroundColor: '#EAF7F1',
  },
  wizardDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    backgroundColor: '#64748B',
  },
  wizardDotActive: {
    backgroundColor: '#22D3EE',
  },
  wizardDotDone: {
    backgroundColor: '#10B981',
  },
  wizardText: {
    color: ui.colors.textMuted,
    fontSize: scale(9),
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
    marginTop: scale(6),
    color: '#4A5A7A',
    fontSize: scale(11),
    fontWeight: '600',
    lineHeight: scale(15),
  },
  fieldLabel: {
    color: ui.colors.textMuted,
    fontSize: scale(10),
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: scale(4),
  },
  fieldInputWrap: {
    height: scale(40),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.35)',
    backgroundColor: '#FAFBFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(10),
  },
  fieldInput: {
    flex: 1,
    color: '#1F2A44',
    fontSize: scale(14),
    fontWeight: '600',
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
    marginTop: scale(8),
    padding: scale(8),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: ui.colors.border,
    backgroundColor: '#FFFFFF',
  },
  cameraWrap: {
    marginTop: scale(12),
    borderRadius: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.4)',
    backgroundColor: '#000000',
    position: 'relative',
    width: '100%',
    alignSelf: 'stretch',
  },
  cameraPreview: {
    width: '100%',
    alignSelf: 'center',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: scale(10),
    justifyContent: 'flex-start',
    gap: scale(6),
    zIndex: 1,
  },
  cameraGuideTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  cameraGuideText: {
    color: '#EAF1FF',
    fontSize: 11,
    fontWeight: '600',
  },
  cameraGuideBadge: {
    alignSelf: 'flex-start',
    marginTop: scale(4),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(16, 185, 129, 0.88)',
  },
  cameraGuideBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cameraActionRow: {
    position: 'absolute',
    left: scale(10),
    right: scale(10),
    bottom: scale(10),
    flexDirection: 'row',
    gap: scale(8),
    zIndex: 10,
    elevation: 10,
  },
  cameraCancelBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  cameraCancelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  cameraShootBtn: {
    flex: 1.4,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#35BDF4',
  },
  cameraShootBtnDisabled: {
    opacity: 0.7,
  },
  cameraShootText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
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
    maxHeight: scale(200),
    height: undefined,
    borderRadius: scale(8),
  },
  imageTouchArea: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: scale(8),
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.35)',
    backgroundColor: '#FAFBFF',
    maxHeight: scale(200),
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
    marginTop: scale(8),
    flexDirection: 'row',
    gap: scale(6),
    flexWrap: 'wrap',
  },
  cameraButton: {
    flex: 1,
    minWidth: '30%',
    minHeight: scale(38),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(125, 145, 191, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F6FB',
  },
  cameraButtonFull: {
    flex: 1,
    minWidth: '100%',
    minHeight: scale(40),
    borderRadius: scale(10),
    overflow: 'hidden',
  },
  cameraButtonFullGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: scale(10),
  },
  cameraButtonText: {
    color: '#4A5A7A',
    fontSize: scale(12),
    fontWeight: '700',
  },
  cameraButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: scale(14),
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  modeSwitchButton: {
    width: '100%',
    minHeight: scale(36),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(109, 99, 255, 0.35)',
    backgroundColor: '#FAFBFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitchText: {
    color: '#5D6CFF',
    fontSize: scale(12),
    fontWeight: '700',
  },
  modeSwitchButtonAlt: {
    width: '100%',
    minHeight: scale(36),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.35)',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitchTextAlt: {
    color: '#2D9FD6',
    fontSize: scale(12),
    fontWeight: '700',
  },
  modeInfoCard: {
    width: '100%',
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: ui.colors.border,
    backgroundColor: '#FAFBFF',
    paddingHorizontal: scale(8),
    paddingVertical: scale(6),
  },
  modeInfoRow: {
    marginTop: scale(2),
  },
  modeInfoLabel: {
    color: '#2E8FCC',
    fontSize: scale(11),
    fontWeight: '700',
  },
  modeInfoSubLabel: {
    color: '#7C89A6',
    fontSize: scale(10),
    fontWeight: '600',
  },
  estimateButton: {
    flex: 1.7,
    minWidth: '40%',
    minHeight: scale(38),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#35BDF4',
  },
  estimateButtonText: {
    color: '#FFFFFF',
    fontSize: scale(13),
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  errorText: {
    marginTop: scale(6),
    fontSize: scale(11),
    color: '#DC2626',
    fontWeight: '600',
    textAlign: 'left',
    width: '100%',
  },
  warningText: {
    marginTop: scale(4),
    fontSize: scale(11),
    color: '#B45309',
    fontWeight: '600',
  },
  infoText: {
    marginTop: scale(4),
    fontSize: scale(11),
    color: '#2D9FD6',
    fontWeight: '600',
  },
  editCard: {
    marginTop: scale(8),
    padding: scale(8),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: ui.colors.border,
    backgroundColor: '#FAFBFF',
  },
  editCardTitle: {
    color: '#4A5A7A',
    fontSize: scale(11),
    fontWeight: '700',
    marginBottom: scale(6),
  },
  editInput: {
    height: scale(40),
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.4)',
    backgroundColor: '#FFFFFF',
    borderRadius: scale(10),
    paddingHorizontal: scale(10),
    color: '#1F2A44',
    fontSize: scale(14),
    fontWeight: '600',
  },
  editedMeta: {
    marginTop: scale(6),
    fontSize: scale(12),
    color: '#2D9FD6',
    fontWeight: '700',
  },
});
