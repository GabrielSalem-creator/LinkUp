import type { Activity, LeagueSport, Sport } from '@/types';

export type ScoreMetric = 'distance_km' | 'duration_hours' | 'sessions';

export function metricForSport(sport: string): ScoreMetric {
  const s = sport.toLowerCase().replace(/\s+/g, '_');
  if (
    ['running', 'walking', 'biking', 'swimming', 'hiking', 'triathlon', 'running_walking'].includes(s)
  ) {
    return 'distance_km';
  }
  if (['tennis', 'other'].includes(s)) {
    return 'duration_hours';
  }
  // yoga, pilates, crossfit, hyrox, etc.
  return 'sessions';
}

export function sportsForLeague(leagueSport: LeagueSport | string): string[] {
  if (leagueSport === 'running_walking') return ['running', 'walking'];
  return [leagueSport];
}

export type ScoredRow = {
  email: string;
  name: string;
  value: number;
  activityCount: number;
  metric: ScoreMetric;
};

export function scoreActivities(
  activities: Activity[],
  opts: {
    emails: { email: string; name: string }[];
    sports: string[];
    startDate?: string;
    endDate?: string;
    metricSport: string;
  },
): ScoredRow[] {
  const metric = metricForSport(opts.metricSport);
  const sportSet = new Set(opts.sports.map((s) => s.toLowerCase()));

  return opts.emails
    .map(({ email, name }) => {
      const mine = activities.filter((a) => {
        if (a.user_email !== email) return false;
        if (!sportSet.has(a.sport.toLowerCase())) return false;
        if (opts.startDate && a.date < opts.startDate) return false;
        if (opts.endDate && a.date > opts.endDate) return false;
        return true;
      });

      let value = 0;
      if (metric === 'distance_km') {
        value = mine.reduce((s, a) => s + (a.distance_km || 0), 0);
      } else if (metric === 'duration_hours') {
        value = mine.reduce((s, a) => s + (a.duration_minutes || 0), 0) / 60;
      } else {
        value = mine.length;
      }

      return { email, name, value, activityCount: mine.length, metric };
    })
    .sort((a, b) => b.value - a.value);
}

export function formatScore(value: number, metric: ScoreMetric): string {
  if (metric === 'distance_km') return `${value.toFixed(1)} km`;
  if (metric === 'duration_hours') return `${value.toFixed(1)} h`;
  return `${Math.round(value)} sessions`;
}

export function metricLabel(metric: ScoreMetric): string {
  if (metric === 'distance_km') return 'Distance';
  if (metric === 'duration_hours') return 'Hours';
  return 'Sessions';
}

export function normalizeSport(s: string): Sport {
  const key = s.toLowerCase().replace(/\s+/g, '_') as Sport;
  return key;
}

/** 6-char attendance / invite style code */
export function generateCode(prefix = '', length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return (prefix + out).slice(0, Math.max(length, prefix.length)).toUpperCase();
}
