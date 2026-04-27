import { useMemo, useRef, useState } from 'react';
import { GestureResponderEvent, Image, LayoutChangeEvent, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { HeightResultSummary } from '../types/measurement';
import { scale } from '../theme/ui';
import { cmToFeetAndInches } from '../utils/unit';

type Point = { x: number; y: number };
type LensPreset = 'standard' | 'wide' | 'tele';

type NoReferenceScreenProps = {
  onBack: () => void;
  onResultReady: (result: HeightResultSummary) => void;
};

const LENS_FOV: Record<LensPreset, number> = {
  standard: 53,
  wide: 60,
  tele: 45,
};

function toNumber(value: string): number {
  return Number(value.trim());
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function computeNoReferenceConfidence(params: {
  distanceMeters: number;
  bodyCoverageRatio: number;
  tiltDeg: number;
  hasBothPoints: boolean;
}): number {
  const { distanceMeters, bodyCoverageRatio, tiltDeg, hasBothPoints } = params;
  if (!hasBothPoints) return 0;

  let score = 74;

  // Distance sweet spot for this method is usually around 1.8m-3.0m.
  if (distanceMeters < 1.6 || distanceMeters > 3.3) score -= 16;
  else if (distanceMeters < 1.8 || distanceMeters > 3.0) score -= 8;

  // Body should occupy a healthy fraction of image height.
  if (bodyCoverageRatio < 0.42 || bodyCoverageRatio > 0.92) score -= 16;
  else if (bodyCoverageRatio < 0.5 || bodyCoverageRatio > 0.85) score -= 8;

  // Strong tilt harms quality.
  if (tiltDeg > 9) score -= 18;
  else if (tiltDeg > 5) score -= 10;

  return clamp(Math.round(score), 28, 82);
}

export function NoReferenceScreen({ onBack, onResultReady }: NoReferenceScreenProps) {
  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedImageWidth, setCapturedImageWidth] = useState(0);
  const [capturedImageHeight, setCapturedImageHeight] = useState(0);
  const [displayedImageWidth, setDisplayedImageWidth] = useState(0);
  const [displayedImageHeight, setDisplayedImageHeight] = useState(0);
  const [personTop, setPersonTop] = useState<Point | null>(null);
  const [personBottom, setPersonBottom] = useState<Point | null>(null);
  const [cameraDistanceMeters, setCameraDistanceMeters] = useState('2');
  const [lensPreset, setLensPreset] = useState<LensPreset>('standard');
  const [error, setError] = useState<string | null>(null);

  const personPixelHeight = useMemo(() => {
    if (!personTop || !personBottom) return 0;
    return Math.round(Math.abs(personBottom.y - personTop.y));
  }, [personTop, personBottom]);
  const hasPhoto = Boolean(capturedImageUri);
  const hasBothPoints = Boolean(personTop && personBottom);
  const bodyCoverageRatio = capturedImageHeight > 0 ? personPixelHeight / capturedImageHeight : 0;
  const distanceValue = toNumber(cameraDistanceMeters);
  const distanceStatus = !Number.isFinite(distanceValue)
    ? { label: 'Enter distance', tone: 'warn' as const }
    : distanceValue < 1.8
    ? { label: 'Too close', tone: 'bad' as const }
    : distanceValue > 3
    ? { label: 'Too far', tone: 'bad' as const }
    : { label: 'Good distance', tone: 'good' as const };
  const tiltDeg = useMemo(() => {
    if (!personTop || !personBottom) return 0;
    const deltaX = Math.abs(personBottom.x - personTop.x);
    const deltaY = Math.abs(personBottom.y - personTop.y);
    if (!deltaY) return 90;
    return Math.round((Math.atan(deltaX / deltaY) * 180) / Math.PI);
  }, [personTop, personBottom]);

  const handleStartCamera = async () => {
    const granted = permission?.granted ? true : (await requestPermission()).granted;
    if (!granted) {
      setError('Camera permission is required.');
      return;
    }
    setIsCameraOpen(true);
    setError(null);
  };

  const handleCaptureFromCamera = async () => {
    try {
      const capture = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (!capture?.uri || !capture.width || !capture.height) return;
      setCapturedImageUri(capture.uri);
      setCapturedImageWidth(capture.width);
      setCapturedImageHeight(capture.height);
      setDisplayedImageWidth(0);
      setDisplayedImageHeight(0);
      setPersonTop(null);
      setPersonBottom(null);
      setIsCameraOpen(false);
      setError(null);
    } catch {
      setError('Could not capture image. Try again.');
    }
  };

  const handleImageLayout = (event: LayoutChangeEvent) => {
    setDisplayedImageWidth(event.nativeEvent.layout.width);
    setDisplayedImageHeight(event.nativeEvent.layout.height);
  };

  const handleImagePress = (event: GestureResponderEvent) => {
    if (!capturedImageWidth || !capturedImageHeight || !displayedImageWidth || !displayedImageHeight) return;
    const sourceX = (event.nativeEvent.locationX / displayedImageWidth) * capturedImageWidth;
    const sourceY = (event.nativeEvent.locationY / displayedImageHeight) * capturedImageHeight;
    const point = { x: sourceX, y: sourceY };

    if (!personTop || (personTop && personBottom)) {
      setPersonTop(point);
      setPersonBottom(null);
      return;
    }
    setPersonBottom(point);
  };

  const handleEstimateWithoutReference = () => {
    const distance = toNumber(cameraDistanceMeters);
    if (!personPixelHeight || !capturedImageHeight) {
      setError('Tap top and bottom of the person first.');
      return;
    }
    if (!Number.isFinite(distance) || distance <= 0) {
      setError('Enter a valid camera distance in meters (example: 2.0).');
      return;
    }
    if (distance < 1 || distance > 5) {
      setError('Keep camera distance between 1m and 5m for better estimates.');
      return;
    }
    if (bodyCoverageRatio < 0.35) {
      setError('Person appears too small in frame. Move closer and recapture.');
      return;
    }
    if (bodyCoverageRatio > 0.95) {
      setError('Person is too zoomed-in. Move back and recapture full body.');
      return;
    }

    const verticalFovRad = (LENS_FOV[lensPreset] * Math.PI) / 180;
    const sceneHeightMeters = 2 * distance * Math.tan(verticalFovRad / 2);
    const centerY = ((personTop?.y ?? 0) + (personBottom?.y ?? 0)) / 2 / capturedImageHeight;
    const perspectiveCorrection = 1 + clamp((0.5 - centerY) * 0.06, -0.03, 0.03);
    const estimatedHeightMeters = sceneHeightMeters * (personPixelHeight / capturedImageHeight) * perspectiveCorrection;
    const estimatedHeightCm = Math.round(estimatedHeightMeters * 100);
    const estimatedHeightFeet = cmToFeetAndInches(estimatedHeightCm);
    const confidencePercent = computeNoReferenceConfidence({
      distanceMeters: distance,
      bodyCoverageRatio,
      tiltDeg,
      hasBothPoints,
    });

    onResultReady({
      estimatedHeightCm,
      estimatedHeightFeet,
      personPixelHeight,
      referencePixelHeight: 0,
      referenceRealHeightCm: 0,
      confidencePercent,
    });
  };

  return (
    <LinearGradient colors={['#6D63FF', '#20C7F3']} style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.title}>No Reference Mode</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.body}>
          <View style={styles.modePillRow}>
            <View style={styles.modePillPrimary}>
              <Text style={styles.modePillPrimaryText}>Reference mode: High accuracy</Text>
            </View>
            <View style={styles.modePillSecondary}>
              <Text style={styles.modePillSecondaryText}>No-reference mode: Quick estimate (lower confidence)</Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <Text style={styles.stepTitle}>No-Reference Steps</Text>
            <Text style={styles.stepItem}>{hasPhoto ? '1. Photo captured' : '1. Capture full-body photo'}</Text>
            <Text style={styles.stepItem}>{hasBothPoints ? '2. Top and bottom points marked' : '2. Tap top and bottom of person'}</Text>
            <Text style={styles.stepItem}>3. Enter camera distance and estimate</Text>
          </View>

          <View style={styles.inputCard}>
            <Text style={styles.inputLabel}>Camera distance from person (meters)</Text>
            <TextInput
              value={cameraDistanceMeters}
              onChangeText={setCameraDistanceMeters}
              keyboardType="numeric"
              placeholder="e.g. 2.0"
              placeholderTextColor="#8E98B1"
              style={styles.input}
            />
            <Text style={styles.inputHint}>Tip: keep phone chest-height and straight for better estimate.</Text>
            <View style={styles.lensRow}>
              <Text style={styles.inputLabel}>Lens profile</Text>
              <View style={styles.lensOptions}>
                {(['standard', 'wide', 'tele'] as const).map((preset) => {
                  const active = lensPreset === preset;
                  return (
                    <Pressable key={preset} style={[styles.lensChip, active && styles.lensChipActive]} onPress={() => setLensPreset(preset)}>
                      <Text style={[styles.lensChipText, active && styles.lensChipTextActive]}>{preset}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {isCameraOpen ? (
            <View style={styles.cameraWrap}>
              <CameraView ref={cameraRef} style={styles.cameraPreview} facing="back" />
              <View style={styles.cameraOverlay} pointerEvents="none">
                <Text style={styles.cameraGuideTitle}>Live Position Guide</Text>
                <Text style={styles.cameraGuideText}>Keep full body in frame and phone straight.</Text>
                <View style={[styles.distanceBadge, distanceStatus.tone === 'good' ? styles.distanceBadgeGood : styles.distanceBadgeBad]}>
                  <Text style={styles.distanceBadgeText}>
                    {distanceStatus.label} ({Number.isFinite(distanceValue) ? `${distanceValue.toFixed(1)}m` : '--'})
                  </Text>
                </View>
                <Text style={styles.cameraGuideRange}>Best range: 1.8m - 3.0m</Text>
              </View>
              <View style={styles.cameraActionRow}>
                <Pressable style={styles.cameraCancelBtn} onPress={() => setIsCameraOpen(false)}>
                  <Text style={styles.cameraCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.cameraShootBtn} onPress={handleCaptureFromCamera}>
                  <Text style={styles.cameraShootText}>Capture</Text>
                </Pressable>
              </View>
            </View>
          ) : capturedImageUri ? (
            <Pressable onPress={handleImagePress} style={styles.imageWrap}>
              <Image
                source={{ uri: capturedImageUri }}
                style={[styles.image, capturedImageWidth && capturedImageHeight ? { aspectRatio: capturedImageWidth / capturedImageHeight } : null]}
                resizeMode="stretch"
                onLayout={handleImageLayout}
              />
              {[personTop, personBottom].map((point, idx) => {
                if (!point || !capturedImageWidth || !capturedImageHeight || !displayedImageWidth || !displayedImageHeight) return null;
                const left = (point.x / capturedImageWidth) * displayedImageWidth - 7;
                const top = (point.y / capturedImageHeight) * displayedImageHeight - 7;
                return <View key={idx} style={[styles.marker, { left, top }]} />;
              })}
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable style={styles.primaryBtn} onPress={handleStartCamera}>
              <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                <Text style={styles.primaryBtnText}>{capturedImageUri ? 'Retake Photo' : 'Open Camera'}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={handleEstimateWithoutReference}>
              <Text style={styles.secondaryBtnText}>Estimate Without Reference</Text>
            </Pressable>
          </View>
          {hasBothPoints ? (
            <Text style={styles.qualityText}>
              Quality check - Coverage: {Math.round(bodyCoverageRatio * 100)}%, Tilt: {tiltDeg}deg
            </Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingBottom: scale(24) },
  header: {
    minHeight: scale(104),
    paddingHorizontal: 0,
    paddingTop: scale(16),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(10),
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#FFFFFF', fontSize: scale(16), fontWeight: '800' },
  title: { color: '#FFFFFF', fontSize: scale(30), fontWeight: '800' },
  body: {
    marginTop: -2,
    borderTopLeftRadius: scale(38),
    borderTopRightRadius: scale(38),
    backgroundColor: '#EAF1F7',
    paddingHorizontal: '4%',
    paddingTop: scale(14),
    minHeight: scale(660),
  },
  hint: { color: '#4A5A7A', fontSize: 13, fontWeight: '600' },
  modePillRow: {
    gap: 8,
  },
  modePillPrimary: {
    borderRadius: 10,
    backgroundColor: 'rgba(53, 189, 244, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modePillPrimaryText: {
    color: '#2E8FCC',
    fontSize: 12,
    fontWeight: '800',
  },
  modePillSecondary: {
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(125, 145, 191, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modePillSecondaryText: {
    color: '#7C89A6',
    fontSize: 11,
    fontWeight: '700',
  },
  stepCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 145, 191, 0.25)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  stepTitle: {
    color: '#4A5A7A',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  stepItem: {
    color: '#6B7896',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  inputCard: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(125, 145, 191, 0.25)',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  inputLabel: {
    color: '#4A5A7A',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.35)',
    backgroundColor: '#F2F5FD',
    paddingHorizontal: 12,
    color: '#1F2A44',
    fontSize: 15,
    fontWeight: '700',
  },
  inputHint: {
    marginTop: 6,
    color: '#7C89A6',
    fontSize: 11,
    fontWeight: '600',
  },
  lensRow: {
    marginTop: 10,
  },
  lensOptions: {
    marginTop: 6,
    flexDirection: 'row',
    gap: 8,
  },
  lensChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.35)',
    backgroundColor: '#EEF3FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lensChipActive: {
    borderColor: '#35BDF4',
    backgroundColor: 'rgba(53,189,244,0.18)',
  },
  lensChipText: {
    color: '#6B7896',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  lensChipTextActive: {
    color: '#2D9FD6',
  },
  imageWrap: {
    marginTop: scale(12),
    borderRadius: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.4)',
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  cameraWrap: {
    marginTop: scale(12),
    borderRadius: scale(12),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(53, 189, 244, 0.4)',
    backgroundColor: '#000000',
  },
  cameraPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 10,
    justifyContent: 'space-between',
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
  distanceBadge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  distanceBadgeGood: {
    backgroundColor: 'rgba(16, 185, 129, 0.88)',
  },
  distanceBadgeBad: {
    backgroundColor: 'rgba(225, 95, 107, 0.9)',
  },
  distanceBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cameraGuideRange: {
    color: '#EAF1FF',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 56,
  },
  cameraActionRow: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    gap: 8,
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
  cameraShootText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  image: { width: '100%', height: undefined },
  marker: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#35BDF4',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  actions: { marginTop: scale(12), gap: scale(10) },
  primaryBtn: {
    height: scale(48),
    borderRadius: scale(14),
    overflow: 'hidden',
  },
  primaryBtnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#FFFFFF', fontSize: scale(16), fontWeight: '800' },
  secondaryBtn: {
    height: scale(46),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(109, 99, 255, 0.4)',
    backgroundColor: '#EEF3FF',
  },
  secondaryBtnText: { color: '#5D6CFF', fontSize: scale(14), fontWeight: '800' },
  qualityText: {
    marginTop: 8,
    color: '#4A5A7A',
    fontSize: 12,
    fontWeight: '700',
  },
  error: { marginTop: scale(8), color: '#E05B67', fontSize: scale(13), fontWeight: '600' },
});
