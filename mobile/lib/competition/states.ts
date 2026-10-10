import type { MatchStatus } from './types.ts';

const TRANSITIONS: Readonly<Record<MatchStatus, readonly MatchStatus[]>> = Object.freeze({
  scheduled: ['live', 'final', 'postponed', 'cancelled'],
  live: ['final', 'postponed', 'cancelled'],
  postponed: ['scheduled', 'cancelled'],
  // A final match may only be re-finalised through an audited correction.
  final: ['final'],
  cancelled: [],
});

export function canTransitionMatch(from: MatchStatus, to: MatchStatus): boolean {
  if (from === to && from !== 'final') return true; // metadata-only edits
  return TRANSITIONS[from].includes(to);
}

export function assertMatchTransition(from: MatchStatus, to: MatchStatus): void {
  if (!canTransitionMatch(from, to)) {
    throw new DomainError('invalid_transition', `Match cannot move from ${from} to ${to}`);
  }
}

export function isMatchReadOnly(status: MatchStatus): boolean {
  return status === 'final' || status === 'cancelled';
}

export class DomainError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.status = status;
  }
}
