import { Dimensions } from 'react-native';

const { width } = Dimensions.get('window');
const baseWidth = 390;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function scale(size: number): number {
  return Math.round(clamp((width / baseWidth) * size, size * 0.88, size * 1.2));
}

export const ui = {
  gradient: ['#6D63FF', '#20C7F3'] as const,
  colors: {
    textPrimary: '#1F2A44',
    textMuted: '#7C89A6',
    textSoft: '#95A1BD',
    accent: '#35BDF4',
    accentSoft: '#5D6CFF',
    accentDark: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceAlt: '#EEF3FF',
    border: 'rgba(125, 145, 191, 0.28)',
    borderAccent: 'rgba(53, 189, 244, 0.4)',
    inputSurface: '#F2F5FD',
  },
  spacing: {
    page: scale(16),
    sectionGap: scale(10),
    cardPadding: scale(12),
  },
  radius: {
    card: scale(16),
    control: scale(12),
    button: scale(14),
  },
  /** Slim app headers — use everywhere for consistent typography */
  header: {
    minHeight: scale(52),
    paddingTop: scale(8),
    paddingBottom: scale(8),
    paddingHorizontal: scale(16),
    titleFontSize: scale(20),
    titleLineHeight: scale(24),
    subtitleFontSize: scale(13),
    iconSize: scale(28),
    iconRadius: scale(9),
  },
} as const;
