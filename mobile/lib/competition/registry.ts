/**
 * Fixed V1 sport statistic registry (from the "Stats design" workbook).
 * Immutable and versioned. App admins may enter/correct VALUES only;
 * definitions are not configurable at runtime.
 */
import type {
  CompetitionSport,
  LeaderboardDefinition,
  RankingBoardDefinition,
  SportDefinition,
  StatDefinition,
} from './types.ts';

export const STAT_REGISTRY_VERSION = 1 as const;

const freeze = <T>(v: T): T => Object.freeze(v);

function stat(
  code: string,
  label: string,
  shortLabel: string,
  scope: 'player' | 'team',
  extra: Partial<StatDefinition> = {},
): StatDefinition {
  return freeze({ code, label, shortLabel, scope, integer: true, ...extra });
}

function board(
  code: string,
  label: string,
  statCode: string,
  aggregate: 'sum' | 'avg_per_game',
  opts: Partial<LeaderboardDefinition> = {},
): LeaderboardDefinition {
  return freeze({
    code,
    label,
    statCode,
    aggregate,
    lebaneseOnly: false,
    limit: 20,
    decimals: aggregate === 'avg_per_game' ? 1 : 0,
    ...opts,
  });
}

function ranking(
  code: string,
  label: string,
  limit: number,
  extra: Partial<RankingBoardDefinition> = {},
): RankingBoardDefinition {
  return freeze({ code, label, limit, ...extra });
}

/* ----------------------------- Basketball ----------------------------- */
const basketballPlayer = [
  stat('pts', 'Points', 'PTS', 'player', { maxPerMatch: 120 }),
  stat('ast', 'Assists', 'AST', 'player', { maxPerMatch: 50 }),
  stat('reb', 'Rebounds', 'REB', 'player', { maxPerMatch: 60 }),
  stat('stl', 'Steals', 'STL', 'player', { maxPerMatch: 30 }),
  stat('blk', 'Blocks', 'BLK', 'player', { maxPerMatch: 30 }),
];
const BB_LABELS: Record<string, [string, string]> = {
  pts: ['PPG', 'Points per game'],
  ast: ['APG', 'Assists per game'],
  reb: ['RPG', 'Rebounds per game'],
  stl: ['SPG', 'Steals per game'],
  blk: ['BPG', 'Blocks per game'],
};
const basketballBoards = (['pts', 'ast', 'reb', 'stl', 'blk'] as const).flatMap((c) => {
  const [short, label] = BB_LABELS[c];
  return [
    board(short.toLowerCase(), `${short} - ${label}`, c, 'avg_per_game'),
    board(`${short.toLowerCase()}_lb`, `${short} - Lebanese players`, c, 'avg_per_game', { lebaneseOnly: true }),
  ];
});

/* ------------------------- Football / Futsal -------------------------- */
const footballPlayer = [
  stat('goals', 'Goals', 'G', 'player', { maxPerMatch: 20 }),
  stat('assists', 'Assists', 'A', 'player', { maxPerMatch: 20 }),
  stat('goal_involvements', 'Goal involvements', 'G+A', 'player', { derivedFrom: ['goals', 'assists'] }),
  stat('clean_sheets', 'Clean sheets', 'CS', 'player', { positionFilter: 'GK', maxPerMatch: 1 }),
  stat('yellow_cards', 'Yellow cards', 'YC', 'player', { maxPerMatch: 2 }),
  stat('red_cards', 'Red cards', 'RC', 'player', { maxPerMatch: 1 }),
];
const footballTeam = [
  stat('shots', 'Shots', 'SH', 'team'),
  stat('shots_on_target', 'Shots on target', 'SOT', 'team'),
  stat('corners', 'Corners', 'CK', 'team'),
  stat('fouls', 'Fouls', 'FL', 'team'),
];
const footballBoards = [
  board('goals', 'Goals', 'goals', 'sum'),
  board('assists', 'Assists', 'assists', 'sum'),
  board('goal_involvements', 'Goal involvements', 'goal_involvements', 'sum'),
  board('clean_sheets', 'Clean sheets (GK)', 'clean_sheets', 'sum'),
  board('red_cards', 'Red cards', 'red_cards', 'sum'),
  board('yellow_cards', 'Yellow cards', 'yellow_cards', 'sum'),
];

/* ------------------------------ Handball ------------------------------ */
const handballPlayer = [
  stat('goals', 'Goals', 'G', 'player', { maxPerMatch: 30 }),
  stat('assists', 'Assists', 'A', 'player', { maxPerMatch: 30 }),
  stat('blocks', 'Blocks', 'BLK', 'player', { maxPerMatch: 30 }),
  stat('steals', 'Steals', 'STL', 'player', { maxPerMatch: 30 }),
  stat('gk_saves', 'Goalkeeper saves', 'SV', 'player', { positionFilter: 'GK', maxPerMatch: 60 }),
];
const handballBoards = [
  board('goals', 'Goals', 'goals', 'sum'),
  board('assists', 'Assists', 'assists', 'sum'),
  board('blocks', 'Blocks', 'blocks', 'sum'),
  board('steals', 'Steals', 'steals', 'sum'),
  board('gk_saves', 'Goalkeeper saves', 'gk_saves', 'sum'),
];

const STANDARD_3_1_0 = freeze({
  win: 3,
  draw: 1,
  loss: 0,
  tiebreak: ['points', 'diff', 'for', 'name'] as const,
});

const SPORTS: Readonly<Record<CompetitionSport, SportDefinition>> = freeze({
  basketball: freeze({
    sport: 'basketball',
    label: 'Basketball',
    version: 1,
    features: { fixtures: true, standings: true, playerStats: true, rankings: false },
    scoreKind: 'points',
    standings: freeze({ win: 2, draw: null, loss: 1, tiebreak: ['points', 'diff', 'for', 'name'] as const }),
    teamStats: freeze([]),
    playerStats: freeze(basketballPlayer),
    leaderboards: freeze(basketballBoards),
    rankingBoards: freeze([]),
  }),
  football: freeze({
    sport: 'football',
    label: 'Football',
    version: 1,
    features: { fixtures: true, standings: true, playerStats: true, rankings: false },
    scoreKind: 'goals',
    standings: STANDARD_3_1_0,
    teamStats: freeze(footballTeam),
    playerStats: freeze(footballPlayer),
    leaderboards: freeze(footballBoards),
    rankingBoards: freeze([]),
  }),
  futsal: freeze({
    sport: 'futsal',
    label: 'Futsal',
    version: 1,
    features: { fixtures: true, standings: true, playerStats: true, rankings: false },
    scoreKind: 'goals',
    standings: STANDARD_3_1_0,
    teamStats: freeze(footballTeam),
    playerStats: freeze(footballPlayer),
    leaderboards: freeze(footballBoards),
    rankingBoards: freeze([]),
  }),
  tennis: freeze({
    sport: 'tennis',
    label: 'Tennis',
    version: 1,
    features: { fixtures: false, standings: false, playerStats: false, rankings: true },
    scoreKind: 'sets',
    standings: null,
    teamStats: freeze([]),
    playerStats: freeze([]),
    leaderboards: freeze([]),
    rankingBoards: freeze([
      ranking('tennis_men', 'Lebanese ranking - Men', 30, { gender: 'men' }),
      ranking('tennis_women', 'Lebanese ranking - Women', 20, { gender: 'women' }),
    ]),
  }),
  padel: freeze({
    sport: 'padel',
    label: 'Padel',
    version: 1,
    features: { fixtures: false, standings: false, playerStats: false, rankings: true },
    scoreKind: 'sets',
    standings: null,
    teamStats: freeze([]),
    playerStats: freeze([]),
    leaderboards: freeze([]),
    rankingBoards: freeze(
      (['men', 'women'] as const).flatMap((g) =>
        (['A', 'B', 'C', 'D'] as const).map((k) =>
          ranking(`padel_${g}_${k.toLowerCase()}`, `${g === 'men' ? 'Men' : 'Women'} - Class ${k}`, 50, {
            gender: g,
            klass: k,
          }),
        ),
      ),
    ),
  }),
  volleyball: freeze({
    sport: 'volleyball',
    label: 'Volleyball',
    version: 1,
    features: { fixtures: true, standings: true, playerStats: false, rankings: false },
    scoreKind: 'sets',
    standings: freeze({
      win: 3,
      draw: null,
      loss: 0,
      setPoints: freeze({ '3-0': [3, 0] as const, '3-1': [3, 0] as const, '3-2': [2, 1] as const }),
      tiebreak: ['points', 'wins', 'diff', 'name'] as const,
    }),
    teamStats: freeze([]),
    playerStats: freeze([]),
    leaderboards: freeze([]),
    rankingBoards: freeze([]),
  }),
  racing: freeze({
    sport: 'racing',
    label: 'Racing',
    version: 1,
    features: { fixtures: false, standings: false, playerStats: false, rankings: true },
    scoreKind: 'points',
    standings: null,
    teamStats: freeze([]),
    playerStats: freeze([]),
    leaderboards: freeze([]),
    rankingBoards: freeze([ranking('racing_drivers', 'Driver points ranking', 50)]),
  }),
  handball: freeze({
    sport: 'handball',
    label: 'Handball',
    version: 1,
    features: { fixtures: true, standings: true, playerStats: true, rankings: false },
    scoreKind: 'goals',
    standings: STANDARD_3_1_0,
    teamStats: freeze([]),
    playerStats: freeze(handballPlayer),
    leaderboards: freeze(handballBoards),
    rankingBoards: freeze([]),
  }),
});

export function isCompetitionSport(value: unknown): value is CompetitionSport {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SPORTS, value);
}

export function getSportDefinition(sport: CompetitionSport): SportDefinition {
  return SPORTS[sport];
}

export function listSportDefinitions(): SportDefinition[] {
  return Object.values(SPORTS);
}

export function getStatDefinition(sport: CompetitionSport, code: string): StatDefinition | undefined {
  const def = SPORTS[sport];
  return def.playerStats.find((s) => s.code === code) ?? def.teamStats.find((s) => s.code === code);
}

/** Codes that an admin may enter directly (derived codes excluded). */
export function enterableStatCodes(sport: CompetitionSport, scope: 'player' | 'team'): string[] {
  const def = SPORTS[sport];
  const list = scope === 'player' ? def.playerStats : def.teamStats;
  return list.filter((s) => !s.derivedFrom).map((s) => s.code);
}

export function getLeaderboardDefinition(sport: CompetitionSport, code: string): LeaderboardDefinition | undefined {
  return SPORTS[sport].leaderboards.find((b) => b.code === code);
}

export function getRankingBoardDefinition(sport: CompetitionSport, code: string): RankingBoardDefinition | undefined {
  return SPORTS[sport].rankingBoards.find((b) => b.code === code);
}

export type CompetitionView = 'matches' | 'table' | 'stats' | 'rankings';

/** Views supported for a sport in the Competition destination. */
export function supportedViews(sport: CompetitionSport): CompetitionView[] {
  const f = SPORTS[sport].features;
  const out: CompetitionView[] = [];
  if (f.fixtures) out.push('matches');
  if (f.standings) out.push('table');
  if (f.playerStats) out.push('stats');
  if (f.rankings) out.push('rankings');
  return out;
}
