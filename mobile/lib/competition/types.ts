/**
 * Competition domain contracts (Task 1).
 * Platform-neutral: no React Native, no Appwrite imports.
 * Community `ClubEvent` / `Sport` / `League` types in `@/types` are untouched.
 */

export const COMPETITION_SPORTS = [
  'basketball',
  'football',
  'futsal',
  'tennis',
  'padel',
  'volleyball',
  'racing',
  'handball',
] as const;
export type CompetitionSport = (typeof COMPETITION_SPORTS)[number];

export const MATCH_STATUSES = ['scheduled', 'live', 'final', 'postponed', 'cancelled'] as const;
export type MatchStatus = (typeof MATCH_STATUSES)[number];

export const COMPETITION_STATUSES = ['draft', 'published', 'archived'] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const SEASON_STATUSES = ['upcoming', 'active', 'completed'] as const;
export type SeasonStatus = (typeof SEASON_STATUSES)[number];

export type StatScope = 'player' | 'team';
export type StatAggregate = 'sum' | 'avg_per_game';

export interface StatDefinition {
  readonly code: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly scope: StatScope;
  /** Values must be integers (counts). */
  readonly integer: boolean;
  /** Restrict to a position (e.g. goalkeeper clean sheets). */
  readonly positionFilter?: string;
  /** Derived from other codes (summed) rather than entered directly. */
  readonly derivedFrom?: readonly string[];
  /** Per-match upper bound sanity check (optional). */
  readonly maxPerMatch?: number;
}

export interface LeaderboardDefinition {
  readonly code: string;
  readonly label: string;
  readonly statCode: string;
  readonly aggregate: StatAggregate;
  readonly lebaneseOnly: boolean;
  readonly limit: number;
  readonly decimals: number;
}

export interface RankingBoardDefinition {
  readonly code: string;
  readonly label: string;
  readonly limit: number;
  readonly gender?: 'men' | 'women';
  readonly klass?: 'A' | 'B' | 'C' | 'D';
}

export type ScoreKind = 'goals' | 'points' | 'sets';

export interface StandingsRule {
  readonly win: number;
  readonly draw: number | null; // null = draws are invalid for this sport
  readonly loss: number;
  /** Volleyball-style per-set-score points. Key "3-2" => [winnerPts, loserPts]. */
  readonly setPoints?: Readonly<Record<string, readonly [number, number]>>;
  readonly tiebreak: readonly ('points' | 'diff' | 'for' | 'wins' | 'name')[];
}

export interface SportDefinition {
  readonly sport: CompetitionSport;
  readonly label: string;
  readonly version: 1;
  readonly features: {
    readonly fixtures: boolean;
    readonly standings: boolean;
    readonly playerStats: boolean;
    readonly rankings: boolean;
  };
  readonly scoreKind: ScoreKind;
  readonly standings: StandingsRule | null;
  readonly teamStats: readonly StatDefinition[];
  readonly playerStats: readonly StatDefinition[];
  readonly leaderboards: readonly LeaderboardDefinition[];
  readonly rankingBoards: readonly RankingBoardDefinition[];
}

/* ---------- Records (mirror Appwrite collections, additive) ---------- */

export interface Competition {
  id: string;
  name: string;
  slug: string;
  sport: CompetitionSport;
  status: CompetitionStatus;
  division?: string;
  category?: string;
  gender?: 'men' | 'women' | 'mixed';
  format?: string;
  logo_url?: string;
  country: string;
  tiebreak_note?: string;
  sort: number;
}

export interface Season {
  id: string;
  competition_id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: SeasonStatus;
  is_current: boolean;
  matchweeks: number;
}

export interface CompetitionTeam {
  id: string;
  competition_id: string;
  club_id?: string;
  name: string;
  short_name: string;
  logo_url?: string;
  primary_color: string;
  secondary_color: string;
  city?: string;
}

export interface Player {
  id: string;
  full_name: string;
  nationality: string; // ISO 3166-1 alpha-2
  is_lebanese: boolean;
  position?: string;
  gender?: 'men' | 'women';
  photo_url?: string;
  birth_year?: number;
}

export interface TeamPlayer {
  id: string;
  season_id: string;
  team_id: string;
  player_id: string;
  shirt_number?: number;
  role?: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  address?: string;
  capacity: number;
  image_url?: string;
}

export interface Match {
  id: string;
  competition_id: string;
  season_id: string;
  home_team_id: string;
  away_team_id: string;
  venue_id?: string;
  kickoff_at: string; // ISO datetime
  matchweek?: number;
  round_label?: string;
  status: MatchStatus;
  home_score?: number;
  away_score?: number;
  /** JSON string, e.g. { sets: [[25,20],[23,25],...] } or { periods: [...] } */
  score_detail?: string;
  published: boolean;
  media_override_home?: string;
  media_override_away?: string;
  result_version: number;
  note?: string;
}

export interface MatchTeamStat {
  id: string;
  match_id: string;
  team_id: string;
  stat_code: string;
  value: number;
}

export interface MatchPlayerStat {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  stat_code: string;
  value: number;
}

export interface StatCorrection {
  id: string;
  match_id?: string;
  target_type: 'score' | 'status' | 'team_stat' | 'player_stat' | 'ranking' | 'match';
  target_id?: string;
  stat_code?: string;
  before_json: string;
  after_json: string;
  reason: string;
  actor_id: string;
  correlation_id: string;
  created_at: string;
}

export type TeamMediaKind = 'default' | 'competition' | 'venue' | 'competition_venue';

export interface TeamMedia {
  id: string;
  team_id: string;
  kind: TeamMediaKind;
  competition_id?: string;
  venue_id?: string;
  image_url: string;
  sort: number;
}

export interface StandingRow {
  id: string;
  season_id: string;
  team_id: string;
  rank: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  diff: number;
  points: number;
  form: string; // e.g. "WWDLW"
}

export interface LeaderboardEntry {
  id: string;
  season_id: string;
  board_code: string;
  player_id: string;
  team_id?: string;
  rank: number;
  value: number;
  games: number;
}

export interface RankingEntry {
  id: string;
  season_id: string;
  board_code: string;
  player_id: string;
  rank: number;
  points: number;
  previous_rank?: number;
}
