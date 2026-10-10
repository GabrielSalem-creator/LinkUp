import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  COMPETITION_SPORTS,
  DomainError,
  assertMatchTransition,
  canTransitionMatch,
  computeLeaderboards,
  computeStandings,
  enterableStatCodes,
  getSportDefinition,
  isCompetitionSport,
  listSportDefinitions,
  rankEntries,
  resolveTeamMedia,
  supportedViews,
  validateReason,
  validateScore,
  validateStatLine,
} from '../lib/competition/index.ts';
import type { TeamMedia } from '../lib/competition/index.ts';

describe('sport-stat registry (workbook matrix)', () => {
  it('covers every V1 sport with version 1 immutable definitions', () => {
    assert.deepEqual([...COMPETITION_SPORTS].sort(), [
      'basketball',
      'football',
      'futsal',
      'handball',
      'padel',
      'racing',
      'tennis',
      'volleyball',
    ]);
    for (const def of listSportDefinitions()) {
      assert.equal(def.version, 1);
      assert.ok(Object.isFrozen(def));
      assert.ok(Object.isFrozen(def.playerStats));
      assert.throws(() => {
        (def as { label: string }).label = 'x';
      });
    }
  });

  it('basketball: standings, fixtures, PPG/APG/RPG/SPG/BPG plus Lebanese boards', () => {
    const d = getSportDefinition('basketball');
    assert.deepEqual(supportedViews('basketball'), ['matches', 'table', 'stats']);
    const codes = d.leaderboards.map((b) => b.code);
    for (const c of ['ppg', 'apg', 'rpg', 'spg', 'bpg']) {
      assert.ok(codes.includes(c), c);
      assert.ok(codes.includes(`${c}_lb`), `${c}_lb`);
      assert.equal(d.leaderboards.find((b) => b.code === `${c}_lb`)?.lebaneseOnly, true);
    }
    assert.equal(d.standings?.draw, null);
  });

  it('football & futsal: standings, fixtures, goals, assists, G+A, GK clean sheets, red & yellow cards', () => {
    for (const s of ['football', 'futsal'] as const) {
      const d = getSportDefinition(s);
      assert.deepEqual(supportedViews(s), ['matches', 'table', 'stats']);
      assert.deepEqual(
        d.leaderboards.map((b) => b.code),
        ['goals', 'assists', 'goal_involvements', 'clean_sheets', 'red_cards', 'yellow_cards'],
      );
      assert.equal(d.playerStats.find((p) => p.code === 'clean_sheets')?.positionFilter, 'GK');
      assert.deepEqual(d.playerStats.find((p) => p.code === 'goal_involvements')?.derivedFrom, ['goals', 'assists']);
      assert.ok(!enterableStatCodes(s, 'player').includes('goal_involvements'));
    }
  });

  it('tennis: Lebanese rankings top 30 men / top 20 women only', () => {
    const d = getSportDefinition('tennis');
    assert.deepEqual(supportedViews('tennis'), ['rankings']);
    assert.deepEqual(
      d.rankingBoards.map((b) => [b.code, b.limit, b.gender]),
      [
        ['tennis_men', 30, 'men'],
        ['tennis_women', 20, 'women'],
      ],
    );
  });

  it('padel: men and women classes A-D, no fixtures', () => {
    const d = getSportDefinition('padel');
    assert.equal(d.features.fixtures, false);
    assert.equal(d.rankingBoards.length, 8);
    assert.deepEqual(
      d.rankingBoards.map((b) => b.code),
      ['padel_men_a', 'padel_men_b', 'padel_men_c', 'padel_men_d', 'padel_women_a', 'padel_women_b', 'padel_women_c', 'padel_women_d'],
    );
  });

  it('volleyball: standings and fixtures only', () => {
    assert.deepEqual(supportedViews('volleyball'), ['matches', 'table']);
    assert.equal(getSportDefinition('volleyball').playerStats.length, 0);
  });

  it('racing: driver points ranking only', () => {
    assert.deepEqual(supportedViews('racing'), ['rankings']);
    assert.deepEqual(getSportDefinition('racing').rankingBoards.map((b) => b.code), ['racing_drivers']);
  });

  it('handball: standings, fixtures, goals, assists, blocks, steals, GK saves', () => {
    const d = getSportDefinition('handball');
    assert.deepEqual(d.leaderboards.map((b) => b.code), ['goals', 'assists', 'blocks', 'steals', 'gk_saves']);
    assert.equal(d.playerStats.find((p) => p.code === 'gk_saves')?.positionFilter, 'GK');
  });

  it('rejects unknown sports', () => {
    assert.equal(isCompetitionSport('running'), false);
    assert.equal(isCompetitionSport('football'), true);
  });
});

describe('validation', () => {
  it('rejects unknown, derived, negative, non-finite and non-integer stat values', () => {
    assert.throws(() => validateStatLine('football', 'player', { stat_code: 'ppg', value: 1 }), /Unknown/);
    assert.throws(() => validateStatLine('football', 'player', { stat_code: 'goal_involvements', value: 1 }), /derived/);
    assert.throws(() => validateStatLine('football', 'player', { stat_code: 'goals', value: -1 }), /non-negative/);
    assert.throws(() => validateStatLine('football', 'player', { stat_code: 'goals', value: Number.NaN }), /non-negative/);
    assert.throws(() => validateStatLine('football', 'player', { stat_code: 'goals', value: Infinity }), /non-negative/);
    assert.throws(() => validateStatLine('basketball', 'player', { stat_code: 'pts', value: 1.5 }), /integer/);
    assert.throws(() => validateStatLine('football', 'player', { stat_code: 'red_cards', value: 2 }), /exceeds/);
    assert.throws(
      () => validateStatLine('football', 'player', { stat_code: 'clean_sheets', value: 1, position: 'FW' }),
      /only applies to GK/,
    );
    validateStatLine('football', 'player', { stat_code: 'clean_sheets', value: 1, position: 'GK' });
    validateStatLine('football', 'team', { stat_code: 'corners', value: 7 });
    assert.throws(() => validateStatLine('football', 'player', { stat_code: 'corners', value: 7 }), /Unknown player/);
  });

  it('validates score structures per sport', () => {
    validateScore('football', { home: 2, away: 2 }, 'final');
    assert.throws(() => validateScore('basketball', { home: 80, away: 80 }, 'final'), /cannot end in a draw/);
    assert.throws(() => validateScore('football', { home: -1, away: 0 }, 'final'), /non-negative/);
    assert.throws(() => validateScore('football', { home: 1.5, away: 0 }, 'final'), /non-negative integers/);
    validateScore('volleyball', { home: 3, away: 2, sets: [[25, 20], [20, 25], [25, 23], [22, 25], [15, 10]] }, 'final');
    assert.throws(() => validateScore('volleyball', { home: 3, away: 3 }, 'final'), /3-0, 3-1 or 3-2/);
    assert.throws(() => validateScore('volleyball', { home: 2, away: 1 }, 'final'), /3-0, 3-1 or 3-2/);
    assert.throws(() => validateScore('volleyball', { home: 3, away: 0, sets: [[25, 20]] }, 'final'), /does not match/);
    assert.throws(
      () => validateScore('volleyball', { home: 3, away: 0, sets: [[25, 20], [25, 25], [25, 20]] }, 'final'),
      /tied/,
    );
    validateScore('volleyball', { home: 1, away: 1 }, 'live');
  });

  it('requires a correction reason', () => {
    assert.throws(() => validateReason(''), DomainError);
    assert.throws(() => validateReason('ab'), /at least 3/);
    assert.equal(validateReason('  typo in score  '), 'typo in score');
  });
});

describe('match status machine', () => {
  it('allows only approved transitions', () => {
    assert.ok(canTransitionMatch('scheduled', 'live'));
    assert.ok(canTransitionMatch('scheduled', 'final'));
    assert.ok(canTransitionMatch('live', 'final'));
    assert.ok(canTransitionMatch('postponed', 'scheduled'));
    assert.ok(canTransitionMatch('final', 'final'));
    assert.ok(canTransitionMatch('scheduled', 'scheduled'));
    assert.equal(canTransitionMatch('final', 'scheduled'), false);
    assert.equal(canTransitionMatch('final', 'live'), false);
    assert.equal(canTransitionMatch('cancelled', 'scheduled'), false);
    assert.throws(() => assertMatchTransition('cancelled', 'live'), /cannot move/);
  });
});

describe('standings derivation', () => {
  const teams = [
    { id: 'a', name: 'Alpha' },
    { id: 'b', name: 'Beta' },
    { id: 'c', name: 'Gamma' },
  ];
  it('football: 3/1/0 with goal-difference tiebreak; non-final matches ignored', () => {
    const rows = computeStandings('football', teams, [
      { home_team_id: 'a', away_team_id: 'b', home_score: 2, away_score: 0, status: 'final', kickoff_at: '2026-01-01' },
      { home_team_id: 'b', away_team_id: 'c', home_score: 1, away_score: 1, status: 'final', kickoff_at: '2026-01-02' },
      { home_team_id: 'c', away_team_id: 'a', home_score: 3, away_score: 1, status: 'final', kickoff_at: '2026-01-03' },
      { home_team_id: 'a', away_team_id: 'c', home_score: 9, away_score: 0, status: 'scheduled', kickoff_at: '2026-01-04' },
    ]);
    assert.deepEqual(
      rows.map((r) => [r.rank, r.team_id, r.points, r.diff, r.form]),
      [
        [1, 'c', 4, 2, 'DW'],
        [2, 'a', 3, 0, 'WL'],
        [3, 'b', 1, -2, 'LD'],
      ],
    );
  });
  it('basketball: 2 for a win, 1 for a loss', () => {
    const rows = computeStandings('basketball', teams, [
      { home_team_id: 'a', away_team_id: 'b', home_score: 80, away_score: 70, status: 'final', kickoff_at: '2026-01-01' },
    ]);
    assert.equal(rows[0].points, 2);
    assert.equal(rows[1].points, 1);
    assert.equal(rows[2].points, 0);
  });
  it('volleyball: 3-2 wins give 2/1 points', () => {
    const rows = computeStandings('volleyball', teams, [
      { home_team_id: 'a', away_team_id: 'b', home_score: 3, away_score: 2, status: 'final', kickoff_at: '2026-01-01' },
      { home_team_id: 'c', away_team_id: 'b', home_score: 3, away_score: 0, status: 'final', kickoff_at: '2026-01-02' },
    ]);
    const byId = Object.fromEntries(rows.map((r) => [r.team_id, r]));
    assert.equal(byId.a.points, 2);
    assert.equal(byId.b.points, 1);
    assert.equal(byId.c.points, 3);
    assert.equal(rows[0].team_id, 'c');
  });
  it('returns nothing for sports without standings', () => {
    assert.deepEqual(computeStandings('tennis', teams, []), []);
  });
});

describe('leaderboard derivation', () => {
  const players = [
    { id: 'p1', is_lebanese: true },
    { id: 'p2', is_lebanese: false },
    { id: 'p3', is_lebanese: true },
  ];
  const matches = [
    { id: 'm1', status: 'final' as const },
    { id: 'm2', status: 'final' as const },
    { id: 'm3', status: 'scheduled' as const },
  ];
  it('basketball averages per game and splits Lebanese boards', () => {
    const lines = [
      { match_id: 'm1', team_id: 't1', player_id: 'p1', stat_code: 'pts', value: 20 },
      { match_id: 'm2', team_id: 't1', player_id: 'p1', stat_code: 'pts', value: 10 },
      { match_id: 'm1', team_id: 't2', player_id: 'p2', stat_code: 'pts', value: 31 },
      { match_id: 'm3', team_id: 't2', player_id: 'p2', stat_code: 'pts', value: 99 }, // not final
      { match_id: 'm1', team_id: 't2', player_id: 'p3', stat_code: 'ast', value: 7 },
    ];
    const out = computeLeaderboards('basketball', players, matches, lines);
    const ppg = out.filter((e) => e.board_code === 'ppg');
    assert.deepEqual(ppg.map((e) => [e.rank, e.player_id, e.value, e.games]), [
      [1, 'p2', 31, 1],
      [2, 'p1', 15, 2],
    ]);
    const ppgLb = out.filter((e) => e.board_code === 'ppg_lb');
    assert.deepEqual(ppgLb.map((e) => e.player_id), ['p1']);
    assert.deepEqual(out.filter((e) => e.board_code === 'apg').map((e) => e.player_id), ['p3']);
  });
  it('football sums and derives goal involvements', () => {
    const lines = [
      { match_id: 'm1', team_id: 't1', player_id: 'p1', stat_code: 'goals', value: 2 },
      { match_id: 'm2', team_id: 't1', player_id: 'p1', stat_code: 'assists', value: 1 },
      { match_id: 'm1', team_id: 't2', player_id: 'p2', stat_code: 'goals', value: 1 },
      { match_id: 'm1', team_id: 't2', player_id: 'p3', stat_code: 'clean_sheets', value: 1 },
    ];
    const out = computeLeaderboards('football', players, matches, lines);
    const gi = out.filter((e) => e.board_code === 'goal_involvements');
    assert.deepEqual(gi.map((e) => [e.player_id, e.value]), [
      ['p1', 3],
      ['p2', 1],
    ]);
    assert.deepEqual(out.filter((e) => e.board_code === 'clean_sheets').map((e) => e.player_id), ['p3']);
    assert.equal(out.filter((e) => e.board_code === 'red_cards').length, 0);
  });
  it('ranking boards sort by points then name and cap at the limit', () => {
    const ranked = rankEntries(
      [
        { player_id: 'x', points: 10 },
        { player_id: 'y', points: 30 },
        { player_id: 'z', points: 10 },
      ],
      (id) => ({ x: 'Zed', y: 'Why', z: 'Aye' })[id] ?? id,
      2,
    );
    assert.deepEqual(ranked.map((r) => [r.rank, r.player_id]), [
      [1, 'y'],
      [2, 'z'],
    ]);
  });
});

describe('team media resolver', () => {
  const media: TeamMedia[] = [
    { id: '1', team_id: 't', kind: 'default', image_url: 'default.jpg', sort: 0 },
    { id: '2', team_id: 't', kind: 'venue', venue_id: 'v', image_url: 'venue.jpg', sort: 0 },
    { id: '3', team_id: 't', kind: 'competition', competition_id: 'c', image_url: 'comp.jpg', sort: 0 },
    { id: '4', team_id: 't', kind: 'competition_venue', competition_id: 'c', venue_id: 'v', image_url: 'cv.jpg', sort: 0 },
    { id: '5', team_id: 'other', kind: 'default', image_url: 'other.jpg', sort: 0 },
  ];
  it('follows the six-level precedence', () => {
    assert.equal(resolveTeamMedia(media, { teamId: 't', competitionId: 'c', venueId: 'v', matchOverrideUrl: 'o.jpg' }).imageUrl, 'o.jpg');
    const full = resolveTeamMedia(media, { teamId: 't', competitionId: 'c', venueId: 'v' });
    assert.equal(full.level, 'team_competition_venue');
    assert.deepEqual(
      full.chain.map((c) => c.level),
      ['team_competition_venue', 'team_competition', 'team_venue', 'team_default', 'team_colors'],
    );
    assert.equal(resolveTeamMedia(media, { teamId: 't', competitionId: 'c', venueId: 'zz' }).imageUrl, 'comp.jpg');
    assert.equal(resolveTeamMedia(media, { teamId: 't', competitionId: 'zz', venueId: 'v' }).imageUrl, 'venue.jpg');
    assert.equal(resolveTeamMedia(media, { teamId: 't' }).imageUrl, 'default.jpg');
    const none = resolveTeamMedia(media, { teamId: 'nobody' });
    assert.equal(none.level, 'team_colors');
    assert.equal(none.imageUrl, undefined);
  });
});
