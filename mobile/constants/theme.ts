/** Côte Sport — Energetic · Mediterranean · Vibrant */
export const colors = {
  light: {
    background: '#FFF2E2',
    foreground: '#1D1D1B',
    card: '#FFFFFF',
    cardForeground: '#1D1D1B',
    primary: '#133440',
    primaryForeground: '#FFFFFF',
    primarySoft: '#D6E8E6',
    secondary: '#F5E6D4',
    secondaryForeground: '#1D1D1B',
    muted: '#F5E6D4',
    mutedForeground: '#6B6560',
    accent: '#FF5E4A',
    accentForeground: '#FFFFFF',
    aqua: '#5ABDB7',
    aquaForeground: '#0B2A28',
    border: '#E8D5C0',
    destructive: '#E04545',
    success: '#5ABDB7',
    overlay: 'rgba(19, 52, 64, 0.55)',
  },
  dark: {
    background: '#0C1A20',
    foreground: '#FFF2E2',
    card: '#133440',
    cardForeground: '#FFF2E2',
    primary: '#5ABDB7',
    primaryForeground: '#0C1A20',
    primarySoft: '#1A3A42',
    secondary: '#1A3A42',
    secondaryForeground: '#FFF2E2',
    muted: '#1A3A42',
    mutedForeground: '#A8B8B6',
    accent: '#FF5E4A',
    accentForeground: '#FFFFFF',
    aqua: '#5ABDB7',
    aquaForeground: '#0C1A20',
    border: '#2A4A52',
    destructive: '#F07171',
    success: '#5ABDB7',
    overlay: 'rgba(0, 0, 0, 0.55)',
  },
} as const;

export type ThemeColors = (typeof colors)['light'] | (typeof colors)['dark'];

/** MVP club subscription — flip later */
export const CLUB_SUBSCRIPTION_USD = 0;

export const INVITE_BASE_URL = 'https://linkup-gold-gamma.vercel.app';

export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  headingSemi: 'SpaceGrotesk_600SemiBold',
  headingMed: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMed: 'Inter_500Medium',
  bodySemi: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
  full: 999,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const SPORTS = [
  'Running',
  'Walking',
  'Biking',
  'Swimming',
  'Hyrox',
  'Triathlon',
  'CrossFit',
  'Yoga',
  'Hiking',
  'Tennis',
  'Pilates',
  'Other',
] as const;

export const SPORT_ORDER = [
  'running',
  'walking',
  'biking',
  'swimming',
  'hyrox',
  'triathlon',
  'crossfit',
  'yoga',
  'hiking',
  'tennis',
  'pilates',
  'other',
] as const;

export const sportColors: Record<string, string> = {
  running: '#FF5E4A',
  walking: '#5ABDB7',
  biking: '#133440',
  swimming: '#5ABDB7',
  hyrox: '#FF5E4A',
  triathlon: '#133440',
  crossfit: '#FF5E4A',
  yoga: '#5ABDB7',
  hiking: '#C47B16',
  tennis: '#133440',
  pilates: '#5ABDB7',
  other: '#6B6560',
  running_walking: '#FF5E4A',
};

export const sportIcons: Record<string, string> = {
  walking: 'walk-outline',
  running: 'flash-outline',
  biking: 'bicycle-outline',
  swimming: 'water-outline',
  hyrox: 'barbell-outline',
  triathlon: 'medal-outline',
  crossfit: 'fitness-outline',
  yoga: 'leaf-outline',
  hiking: 'trail-sign-outline',
  tennis: 'tennisball',
  pilates: 'fitness-outline',
  other: 'ellipse-outline',
  running_walking: 'walk-outline',
};
