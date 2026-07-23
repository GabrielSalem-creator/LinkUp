export const colors = {
  light: {
    background: '#F2F5F4',
    foreground: '#0F1714',
    card: '#FFFFFF',
    cardForeground: '#0F1714',
    primary: '#0D8F72',
    primaryForeground: '#FFFFFF',
    primarySoft: '#D8F3EA',
    secondary: '#E7EEEC',
    secondaryForeground: '#0F1714',
    muted: '#E7EEEC',
    mutedForeground: '#5E6B66',
    accent: '#E8A317',
    accentForeground: '#1A1408',
    border: '#D5E0DC',
    destructive: '#E04545',
    success: '#0D8F72',
    overlay: 'rgba(15, 23, 20, 0.45)',
  },
  dark: {
    background: '#0A100E',
    foreground: '#EEF3F1',
    card: '#121A17',
    cardForeground: '#EEF3F1',
    primary: '#2BC49A',
    primaryForeground: '#042018',
    primarySoft: '#16352C',
    secondary: '#1A2420',
    secondaryForeground: '#EEF3F1',
    muted: '#1A2420',
    mutedForeground: '#8FA39A',
    accent: '#F0B429',
    accentForeground: '#1A1408',
    border: '#24302B',
    destructive: '#F07171',
    success: '#2BC49A',
    overlay: 'rgba(0, 0, 0, 0.55)',
  },
} as const;

export type ThemeColors = (typeof colors)['light'] | (typeof colors)['dark'];

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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
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
  'other',
] as const;

export const sportColors: Record<string, string> = {
  running: '#0D8F72',
  walking: '#6BA33A',
  biking: '#2F6FED',
  swimming: '#0891B2',
  hyrox: '#E67E22',
  triathlon: '#7C5CFC',
  crossfit: '#E04545',
  yoga: '#D946A6',
  hiking: '#C47B16',
  other: '#64748B',
  running_walking: '#0D8F72',
};

/** Ionicons names matched to sports for consistent UI */
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
  other: 'ellipse-outline',
  running_walking: 'walk-outline',
};
