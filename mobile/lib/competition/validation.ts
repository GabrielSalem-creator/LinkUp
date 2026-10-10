import { getSportDefinition, getStatDefinition, isCompetitionSport } from './registry.ts';
import { DomainError } from './states.ts';
import type { CompetitionSport, MatchStatus } from './types.ts';

export function isFiniteNonNegative(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0;
}

export function assertSport(sport: unknown): asserts sport is CompetitionSport {
  if (!isCompetitionSport(sport)) throw new DomainError('unknown_sport', `Unknown sport: ${String(sport)}`);
}

export interface ScoreInput {
  home: number;
  away: number;
  /** For set-based sports: [[homePts, awayPts], ...] per set (optional). */
  sets?: [number, number][];
}

/** Validates a score for a sport. Throws DomainError on invalid structures. */
export function validateScore(sport: CompetitionSport, score: ScoreInput, status: MatchStatus): void {
  const def = getSportDefinition(sport);
  if (!Number.isInteger(score.home) || !Number.isInteger(score.away) || score.home < 0 || score.away < 0) {
    throw new DomainError('invalid_score', 'Scores must be non-negative integers');
  }
  if (def.scoreKind === 'sets') {
    const max = Math.max(score.home, score.away);
    const min = Math.min(score.home, score.away);
    if (status === 'final') {
      if (max !== 3 || min > 2) throw new DomainError('invalid_score', 'A final set score must be 3-0, 3-1 or 3-2');
    } else if (max > 3) {
      throw new DomainError('invalid_score', 'Set score cannot exceed 3');
    }
    if (score.sets) {
      if (score.sets.length !== score.home + score.away) {
        throw new DomainError('invalid_score', 'Set detail does not match set totals');
      }
      let h = 0;
      let a = 0;
      for (const s of score.sets) {
        if (!Array.isArray(s) || s.length !== 2 || !s.every((x) => Number.isInteger(x) && x >= 0)) {
          throw new DomainError('invalid_score', 'Each set must be [home, away] non-negative integers');
        }
        if (s[0] === s[1]) throw new DomainError('invalid_score', 'A set cannot be tied');
        if (s[0] > s[1]) h += 1;
        else a += 1;
      }
      if (h !== score.home || a !== score.away) {
        throw new DomainError('invalid_score', 'Set winners do not match set totals');
      }
    }
  } else if (status === 'final' && def.standings && def.standings.draw === null && score.home === score.away) {
    throw new DomainError('invalid_score', `${def.label} matches cannot end in a draw`);
  }
}

export interface StatLineInput {
  stat_code: string;
  value: number;
  position?: string;
}

/** Validates a stat line against the registry (unknown codes, negatives, non-finite, derived codes). */
export function validateStatLine(sport: CompetitionSport, scope: 'player' | 'team', line: StatLineInput): void {
  const def = getStatDefinition(sport, line.stat_code);
  if (!def || def.scope !== scope) {
    throw new DomainError('unknown_stat', `Unknown ${scope} statistic "${line.stat_code}" for ${sport}`);
  }
  if (def.derivedFrom) {
    throw new DomainError('derived_stat', `"${line.stat_code}" is derived and cannot be entered directly`);
  }
  if (!isFiniteNonNegative(line.value)) {
    throw new DomainError('invalid_value', `Value for ${line.stat_code} must be a finite non-negative number`);
  }
  if (def.integer && !Number.isInteger(line.value)) {
    throw new DomainError('invalid_value', `Value for ${line.stat_code} must be an integer`);
  }
  if (def.maxPerMatch != null && line.value > def.maxPerMatch) {
    throw new DomainError('invalid_value', `Value for ${line.stat_code} exceeds ${def.maxPerMatch} per match`);
  }
  if (def.positionFilter && line.position && line.position !== def.positionFilter) {
    throw new DomainError('invalid_position', `${line.stat_code} only applies to ${def.positionFilter}`);
  }
}

export function validateReason(reason: unknown): string {
  if (typeof reason !== 'string' || reason.trim().length < 3) {
    throw new DomainError('reason_required', 'A reason of at least 3 characters is required');
  }
  if (reason.length > 500) throw new DomainError('reason_too_long', 'Reason must be 500 characters or fewer');
  return reason.trim();
}

export function isIsoDateTime(v: unknown): v is string {
  return typeof v === 'string' && !Number.isNaN(Date.parse(v));
}
