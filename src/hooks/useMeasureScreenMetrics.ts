import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BASE_W = 390;
const BASE_H = 844;

/** Approx. in-app chrome: gradient header + bottom tab bar (see App.tsx). */
function tabBarReserve(scaleW: (n: number) => number) {
  return scaleW(72);
}
function headerReserve(scaleW: (n: number) => number) {
  return scaleW(52);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

/**
 * Layout metrics for measure flows — scales with phone, foldable, tablet, rotation.
 */
export function useResponsiveContentMetrics() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const shortSide = Math.min(width, height);
    const longSide = Math.max(width, height);
    const isLandscape = width > height;
    const isTablet = shortSide >= 600;

    const scaleW = (s: number) => Math.round(clamp((width / BASE_W) * s, s * 0.82, s * 1.28));
    const scaleH = (s: number) => Math.round(clamp((height / BASE_H) * s, s * 0.82, s * 1.22));

    const horizontalPadding = clamp(shortSide * 0.035, 10, 24);
    const contentMaxWidth = isTablet ? Math.min(720, width - horizontalPadding * 2) : width;

    const meterOuter = clamp(shortSide * (isLandscape ? 0.2 : 0.26), scaleW(68), scaleW(132));
    const meterInner = meterOuter - clamp(scaleW(10), 6, 16);

    const previewMaxHeight = clamp(
      longSide * (isLandscape ? 0.38 : 0.3),
      scaleH(110),
      scaleH(isTablet ? 320 : 260),
    );

    const previewBoxMaxHeight = previewMaxHeight + scaleH(isLandscape ? 56 : 72);

    const innerBar = insets.top + insets.bottom + headerReserve(scaleW) + tabBarReserve(scaleW);
    const usableViewport = Math.max(height - innerBar, scaleH(280));
    /** Scroll body fills at least the visible area above the tab bar so content isn’t “half empty”. */
    const scrollContentMinHeight = usableViewport;

    const cardWidth = Math.min(contentMaxWidth, width);
    /** 3:4 portrait preview — use most of the usable viewport (no arbitrary 55% cap). */
    const cameraPreviewMaxHeight = clamp(
      Math.min(cardWidth * (4 / 3), usableViewport * 0.92),
      scaleH(220),
      usableViewport * 0.95,
    );

    return {
      width,
      height,
      shortSide,
      longSide,
      isLandscape,
      isTablet,
      horizontalPadding,
      contentMaxWidth,
      meterOuter,
      meterInner,
      meterValueFont: clamp(scaleW(20), 15, 30),
      meterUnitFont: clamp(scaleW(11), 10, 14),
      previewMaxHeight,
      previewBoxMaxHeight,
      statValueFont: clamp(scaleW(15), 12, 20),
      statLabelFont: clamp(scaleW(9), 8, 12),
      hintFont: clamp(scaleW(11), 10, 14),
      buttonHeight: clamp(scaleH(40), 34, 52),
      fieldHeight: clamp(scaleH(40), 36, 50),
      bodyBottomPad: insets.bottom + scaleW(8),
      scrollContentMinHeight,
      cameraPreviewMaxHeight,
      usableViewport,
      scaleW,
      scaleH,
      insets,
    };
  }, [width, height, insets.bottom, insets.left, insets.right, insets.top]);
}

export const useMeasureScreenMetrics = useResponsiveContentMetrics;
