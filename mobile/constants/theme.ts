export const colors = {
  light: {
    background: '#F7F7F8',
    foreground: '#14171F',
    card: '#FFFFFF',
    cardForeground: '#14171F',
    primary: '#129B7A',
    primaryForeground: '#FFFFFF',
    secondary: '#EEF0F3',
    secondaryForeground: '#14171F',
    muted: '#EEF0F3',
    mutedForeground: '#6B7280',
    accent: '#F59E0B',
    accentForeground: '#FFFFFF',
    border: '#E5E7EB',
    destructive: '#EF4444',
    success: '#10B981',
  },
  dark: {
    background: '#0C1017',
    foreground: '#F2F3F5',
    card: '#151A22',
    cardForeground: '#F2F3F5',
    primary: '#14B891',
    primaryForeground: '#FFFFFF',
    secondary: '#232A35',
    secondaryForeground: '#F2F3F5',
    muted: '#232A35',
    mutedForeground: '#8B93A0',
    accent: '#F59E0B',
    accentForeground: '#FFFFFF',
    border: '#2A3140',
    destructive: '#EF4444',
    success: '#10B981',
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
  running: '#10B981',
  walking: '#84CC16',
  biking: '#3B82F6',
  swimming: '#06B6D4',
  hyrox: '#F97316',
  triathlon: '#A855F7',
  crossfit: '#EF4444',
  yoga: '#EC4899',
  hiking: '#F59E0B',
  other: '#64748B',
  running_walking: '#10B981',
};
