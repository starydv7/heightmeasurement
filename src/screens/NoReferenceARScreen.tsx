import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HeightResultSummary } from '../types/measurement';
import { cmToFeetAndInches } from '../utils/unit';
import { scale, ui } from '../theme/ui';

type Vec3 = [number, number, number];

type NoReferenceARScreenProps = {
  onBack: () => void;
  onResultReady: (result: HeightResultSummary) => void;
  onOpenManualFallback: () => void;
};

function distanceMeters(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function ARHeightScene(props: { onPoint: (p: Vec3) => void; stepLabel: string }) {
  // Lazy require to prevent app startup crashes if AR native module
  // isn't available in a given build/device.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ViroARScene, ViroText } = require('@reactvision/react-viro') as {
    ViroARScene: React.ComponentType<any>;
    ViroText: React.ComponentType<any>;
  };
  return (
    <ViroARScene
      onClick={(source: { position?: unknown }) => {
        const position = (source?.position ?? null) as unknown as Vec3 | null;
        if (position && position.length === 3) {
          props.onPoint(position);
        }
      }}
    >
      <ViroText
        text={props.stepLabel}
        position={[0, 0, -1] as Vec3}
        style={styles.viroText}
      />
    </ViroARScene>
  );
}

export function NoReferenceARScreen({ onBack, onResultReady, onOpenManualFallback }: NoReferenceARScreenProps) {
  const [isARActive, setIsARActive] = useState(false);
  const [isARAvailable, setIsARAvailable] = useState<boolean | null>(null);
  const [footPoint, setFootPoint] = useState<Vec3 | null>(null);
  const [headPoint, setHeadPoint] = useState<Vec3 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stepLabel = useMemo(() => {
    if (!footPoint) return 'Step 1: Tap the floor at the person’s feet';
    if (!headPoint) return 'Step 2: Tap the top of the head (feature point)';
    return 'Ready: Tap Estimate';
  }, [footPoint, headPoint]);

  const handlePoint = (p: Vec3) => {
    setError(null);
    if (!footPoint || (footPoint && headPoint)) {
      setFootPoint(p);
      setHeadPoint(null);
      return;
    }
    setHeadPoint(p);
  };

  const handleEstimate = () => {
    if (!footPoint || !headPoint) {
      setError('Tap both points first (feet then head).');
      return;
    }
    const meters = distanceMeters(footPoint, headPoint);
    if (!Number.isFinite(meters) || meters <= 0) {
      setError('Could not compute height. Try again.');
      return;
    }

    const estimatedHeightCm = Math.round(meters * 100);
    const estimatedHeightFeet = cmToFeetAndInches(estimatedHeightCm);

    onResultReady({
      estimatedHeightCm,
      estimatedHeightFeet,
      personPixelHeight: 0,
      referencePixelHeight: 0,
      referenceRealHeightCm: 0,
      confidencePercent: 72,
    });
  };

  return (
    <LinearGradient colors={['#6D63FF', '#20C7F3']} style={styles.page}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>{'‹'}</Text>
        </Pressable>
        <Text style={styles.title}>No reference (AR)</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Reference mode: High accuracy</Text>
          <Text style={styles.cardSub}>AR mode: auto scale, no manual distance (requires ARCore support).</Text>
        </View>

        {!isARActive ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>ARCore required</Text>
            <Text style={styles.cardSub}>
              If your device supports ARCore, start AR and tap feet + head points to measure height.
            </Text>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => {
                setError(null);
                try {
                  // If native module isn't present, this will throw.
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  require('@reactvision/react-viro');
                  setIsARAvailable(true);
                  setIsARActive(true);
                } catch {
                  setIsARAvailable(false);
                  setError('AR module is not available in this build/device. Use manual mode.');
                }
              }}
            >
              <LinearGradient colors={['#6D63FF', '#20C7F3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.primaryBtnGradient}>
                <Text style={styles.primaryBtnText}>Start AR Measurement</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.secondaryBtn} onPress={() => {
              Alert.alert(
                'Fallback',
                'If ARCore is not supported, use Manual No-Reference mode or Reference mode for best accuracy.',
              );
              onOpenManualFallback();
            }}>
              <Text style={styles.secondaryBtnText}>Manual no-reference fallback</Text>
            </Pressable>
          </View>
        ) : isARAvailable === false ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>AR not available</Text>
            <Text style={styles.cardSub}>This device/build can’t run AR measurement. Use manual or reference mode.</Text>
            <Pressable style={styles.secondaryBtn} onPress={onOpenManualFallback}>
              <Text style={styles.secondaryBtnText}>Open manual mode</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.arWrap}>
            {/* Lazy require AR navigator only when needed */}
            {(() => {
              // eslint-disable-next-line @typescript-eslint/no-var-requires
              let ViroARSceneNavigator: React.ComponentType<any> | null = null;
              try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                ViroARSceneNavigator = (require('@reactvision/react-viro') as { ViroARSceneNavigator: React.ComponentType<any> }).ViroARSceneNavigator;
              } catch {
                ViroARSceneNavigator = null;
              }
              if (!ViroARSceneNavigator) {
                return (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>AR failed to load</Text>
                    <Text style={styles.cardSub}>Use manual mode instead.</Text>
                  </View>
                );
              }
              return (
            <ViroARSceneNavigator
              autofocus
              initialScene={{
                scene: () => <ARHeightScene onPoint={handlePoint} stepLabel={stepLabel} />,
              }}
              style={styles.arView}
            />
              );
            })()}

            <View style={styles.arControls}>
              <Pressable style={styles.secondaryBtn} onPress={() => { setFootPoint(null); setHeadPoint(null); setError(null); }}>
                <Text style={styles.secondaryBtnText}>Reset Points</Text>
              </Pressable>
              <Pressable style={styles.estimateBtn} onPress={handleEstimate}>
                <Text style={styles.estimateBtnText}>Estimate Height</Text>
              </Pressable>
            </View>
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    minHeight: ui.header.minHeight,
    paddingHorizontal: ui.header.paddingHorizontal,
    paddingTop: ui.header.paddingTop,
    paddingBottom: ui.header.paddingBottom,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: ui.header.iconSize,
    height: ui.header.iconSize,
    borderRadius: ui.header.iconRadius,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { color: '#FFFFFF', fontSize: scale(16), fontWeight: '800' },
  headerSpacer: {
    width: ui.header.iconSize,
    height: ui.header.iconSize,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: ui.header.titleFontSize,
    lineHeight: ui.header.titleLineHeight,
    fontWeight: '800',
  },
  body: {
    flex: 1,
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: '#EAF1F7',
    paddingHorizontal: scale(16),
    paddingTop: scale(12),
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(125,145,191,0.25)',
    borderRadius: scale(14),
    padding: scale(12),
    marginTop: scale(10),
  },
  cardTitle: { color: '#4A5A7A', fontSize: scale(14), fontWeight: '900' },
  cardSub: { marginTop: scale(6), color: '#7C89A6', fontSize: scale(12), fontWeight: '600' },
  primaryBtn: { height: scale(48), borderRadius: scale(14), overflow: 'hidden', marginTop: scale(12) },
  primaryBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: scale(16), fontWeight: '900' },
  secondaryBtn: {
    height: scale(44),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(109, 99, 255, 0.4)',
    backgroundColor: '#EEF3FF',
    marginTop: scale(10),
    paddingHorizontal: scale(10),
  },
  secondaryBtnText: { color: '#5D6CFF', fontSize: scale(13), fontWeight: '900' },
  arWrap: {
    marginTop: scale(10),
    borderRadius: scale(14),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(53,189,244,0.4)',
    backgroundColor: '#000000',
    flex: 1,
  },
  arView: { flex: 1 },
  arControls: {
    flexDirection: 'row',
    gap: scale(10),
    padding: scale(10),
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  estimateBtn: {
    flex: 1,
    height: scale(44),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#35BDF4',
  },
  estimateBtnText: { color: '#FFFFFF', fontSize: scale(13), fontWeight: '900' },
  error: { marginTop: scale(10), color: '#E05B67', fontSize: scale(13), fontWeight: '700' },
  viroText: { fontSize: 18, color: '#FFFFFF' },
});

